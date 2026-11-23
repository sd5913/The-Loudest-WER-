import { createRemoteJWKSet, jwtVerify } from "jose";

const routes = new Map([
  ["/api/generate-sample", "sound-generation"],
  ["/api/generate-song", "music"],
  ["/api/generate-speech", "text-to-speech/21m00Tcm4TlvDq8ikWAM"]
]);
const teamDomain = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const audienceTag = /^[a-f0-9]{64}$/;
const keySets = new Map();

function error(status, message, headers = {}) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function authorizedSubject(request, env) {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || assertion.length > 16384) return null;
  const issuer = "https://" + env.ACCESS_TEAM_DOMAIN;
  if (!keySets.has(issuer)) {
    keySets.set(issuer, createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer)));
  }
  try {
    const { payload } = await jwtVerify(assertion, keySets.get(issuer), {
      algorithms: ["RS256"], issuer, audience: env.ACCESS_AUD,
      requiredClaims: ["exp", "sub", "email", "type"]
    });
    // Access issues a user application token after the configured team's Allow policy succeeds.
    if (payload.type === "app" && typeof payload.sub === "string" && payload.sub.trim() &&
        typeof payload.email === "string" && payload.email.trim()) return payload.sub;
  } catch {
    // An unavailable signing key or invalid assertion must never authorize generation.
  }
  return null;
}

// Both client requests and upstream responses may arrive without a Content-Length.
async function readLimited(message, maxBytes) {
  if (Number(message.headers.get("Content-Length")) > maxBytes) {
    await message.body?.cancel();
    throw new RangeError();
  }
  if (!message.body) return new Uint8Array();
  const reader = message.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function providerPayload(route, input) {
  if (input === null || typeof input !== "object" || Array.isArray(input) || typeof input.text !== "string") return null;
  const song = route === "music";
  const speech = route.startsWith("text-to-speech/");
  const allowed = song ? ["text", "duration_ms", "instrumental"] : ["text"];
  if (Object.keys(input).some(key => !allowed.includes(key))) return null;
  const text = input.text.trim();
  const length = Array.from(text).length;
  if (length < (speech ? 1 : 8) || length > (song ? 600 : 180)) return null;
  if (speech) return { text, model_id: "eleven_v3" };
  if (song) {
    const duration = input.duration_ms;
    if (!Number.isInteger(duration) || duration < 3000 || duration > 60000 ||
        ("instrumental" in input && typeof input.instrumental !== "boolean")) return null;
    return { prompt: text, music_length_ms: duration, force_instrumental: input.instrumental !== false, model_id: "music_v2_5" };
  }
  return { text, duration_seconds: 15, loop: false, model_id: "eleven_text_to_sound_v3" };
}

async function generate(route, payload, key) {
  const song = route === "music";
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/" + route, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(song ? 120_000 : 45_000),
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(payload)
    });
    if (!response.ok || response.headers.get("Content-Type")?.split(";")[0].toLowerCase() !== "audio/mpeg") {
      await response.body?.cancel();
      throw new Error();
    }
    const bytes = await readLimited(response, song ? 8_000_000 : 2_000_000);
    if (!bytes.length) throw new Error();
    return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return error(502, "Audio generation failed.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routes.get(url.pathname);
    if (!route) {
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return error(404, "Unknown API route.");
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") return error(405, "Use POST.", { Allow: "POST" });
    if (request.headers.get("Origin") !== url.origin) return error(403, "Open the Studio on this site.");
    const type = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (type !== "application/json") return error(415, "Expected JSON.");
    if (!teamDomain.test(env.ACCESS_TEAM_DOMAIN) || !audienceTag.test(env.ACCESS_AUD) ||
        typeof env.GENERATION_LIMITER?.limit !== "function" ||
        typeof env.ELEVENLABS_API_KEY !== "string" || !env.ELEVENLABS_API_KEY.trim()) {
      return error(503, "Generation is unavailable.");
    }
    const subject = await authorizedSubject(request, env);
    if (!subject) return error(401, "Team sign-in required.");

    let payload;
    try {
      const bytes = await readLimited(request, 2048);
      const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      payload = providerPayload(route, JSON.parse(json));
    } catch (failure) {
      if (failure instanceof RangeError) return error(413, "Request is too large.");
    }
    if (!payload) return error(400, "Invalid generation request.");
    try {
      const result = await env.GENERATION_LIMITER.limit({ key: subject });
      if (result.success !== true) return error(429, "Generation limit reached. Try again later.");
    } catch {
      return error(503, "Generation is unavailable.");
    }
    return generate(route, payload, env.ELEVENLABS_API_KEY);
  }
};
