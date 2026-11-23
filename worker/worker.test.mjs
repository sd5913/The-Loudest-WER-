import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./index.mjs";

const site = "https://studio.example";
const domain = "sd5913.cloudflareaccess.com";
const audience = "a".repeat(64);
const subject = "64769693-f0c2-4d84-883f-2dede15900de";
const now = Math.floor(Date.now() / 1000);
const claims = {
  type: "app", sub: subject, email: "student@example.test",
  iss: "https://" + domain, aud: [audience], exp: now + 3600, nbf: now - 5, iat: now - 5
};
const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
const keys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
const jwk = { ...await crypto.subtle.exportKey("jwk", keys.publicKey), kid: "test-key", use: "sig" };
const audio = Uint8Array.of(0x49, 0x44, 0x33, 1);

async function sign(payload = {}, header = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const encoded = encode({ alg: "RS256", kid: jwk.kid, ...header }) + "." + encode({ ...claims, ...payload });
  const signature = await crypto.subtle.sign(algorithm.name, keys.privateKey, new TextEncoder().encode(encoded));
  return encoded + "." + Buffer.from(signature).toString("base64url");
}
const assertion = await sign();

function post(route, body, headers = {}) {
  return new Request(site + "/api/generate-" + route, {
    method: "POST", duplex: "half",
    headers: { origin: site, "content-type": "application/json", "cf-access-jwt-assertion": assertion, ...headers },
    body: typeof body === "string" || body instanceof ReadableStream ? body : JSON.stringify(body)
  });
}

function fixture(t) {
  const calls = [];
  const limits = [];
  const env = {
    ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: audience, ELEVENLABS_API_KEY: "mock-value",
    GENERATION_LIMITER: { async limit({ key }) { limits.push(key); return { success: true }; } }
  };
  let respond = () => new Response(audio, { headers: { "content-type": "audio/mpeg" } });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url) === "https://" + domain + "/cdn-cgi/access/certs") {
      assert.equal(init.redirect, "manual");
      return Response.json({ keys: [jwk] });
    }
    calls.push({ url: String(url), init });
    return respond();
  });
  return { calls, limits, env, setProvider(fn) { respond = fn; } };
}

test("public HTML and audio use the static binding without credentials", async () => {
  for (const path of ["/studio.html", "/audio/cat.wav"]) {
    const request = new Request(site + path);
    const response = await worker.fetch(request, { ASSETS: { fetch(input) {
      assert.equal(input.url, request.url);
      return new Response("asset");
    } } });
    assert.equal(await response.text(), "asset");
  }
});

test("only same-origin JSON POSTs to Studio generation routes are accepted", async t => {
  const { env, calls } = fixture(t);
  const payload = { text: "short drum" };
  const requests = [
    [new Request(site + "/api/generate-song"), 405],
    [new Request(site + "/api/unknown"), 404],
    [post("sample", payload, { origin: "https://elsewhere.example" }), 403],
    [post("sample", payload, { origin: "" }), 403],
    [post("sample", payload, { "content-type": "text/plain" }), 415],
    [post("sample", payload, { "cf-access-jwt-assertion": "" }), 401]
  ];
  for (const [request, status] of requests) assert.equal((await worker.fetch(request, env)).status, status);
  assert.equal(calls.length, 0);
});

test("a paid request needs a verified and current user application token for this issuer and audience", async t => {
  const { env, calls, limits } = fixture(t);
  const forged = assertion.slice(0, assertion.lastIndexOf(".") + 1) + "AAAA";
  const invalid = [
    "bad", forged, await sign({ aud: ["another"] }), await sign({ iss: site }), await sign({ exp: now - 1 }),
    await sign({ nbf: now + 3600 }), await sign({ exp: "soon" }), await sign({ type: "org" }),
    await sign({ email: "", sub: "" }), await sign({}, { alg: "HS256" }), await sign({}, { kid: "another" })
  ];
  for (const token of invalid) {
    const request = post("sample", { text: "short drum" }, { "cf-access-jwt-assertion": token });
    assert.equal((await worker.fetch(request, env)).status, 401);
  }
  assert.equal(calls.length, 0);
  assert.equal(limits.length, 0);
});

test("missing policy, secret or functioning rate limiter fails closed", async t => {
  const { env, calls } = fixture(t);
  for (const override of [
    { ACCESS_TEAM_DOMAIN: "" }, { ACCESS_TEAM_DOMAIN: "wrong.example" }, { ACCESS_AUD: "" },
    { ELEVENLABS_API_KEY: "" }, { GENERATION_LIMITER: undefined },
    { GENERATION_LIMITER: { async limit() { throw new Error("unavailable"); } } }
  ]) {
    assert.equal((await worker.fetch(post("speech", { text: "hi" }), { ...env, ...override })).status, 503);
  }
  assert.equal(calls.length, 0);
});

test("malformed JSON, invalid models of input and oversized streams never reach the provider", async t => {
  const { env, calls, limits } = fixture(t);
  for (const [route, body] of [
    ["sample", "{"], ["sample", []], ["sample", { text: "short" }], ["speech", { text: "x".repeat(181) }],
    ["song", { text: "short drum", duration_ms: 60001 }], ["song", { text: "short drum", duration_ms: 3000, instrumental: 1 }],
    ["sample", { text: "short drum", url: "https://unexpected.example" }]
  ]) assert.equal((await worker.fetch(post(route, body), env)).status, 400);
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(2048)); c.enqueue(Uint8Array.of(1)); c.close(); } });
  assert.equal((await worker.fetch(post("sample", stream), env)).status, 413);
  assert.equal(calls.length, 0);
  assert.equal(limits.length, 0);
});

test("all three routes share a subject limit before provider fetch", async t => {
  const { env, calls, limits } = fixture(t);
  env.GENERATION_LIMITER.limit = async ({ key }) => { limits.push(key); return { success: false }; };
  for (const route of ["sample", "speech", "song"]) {
    const body = route === "song" ? { text: "short drum", duration_ms: 3000 } : { text: "short drum" };
    assert.equal((await worker.fetch(post(route, body), env)).status, 429);
  }
  assert.deepEqual(limits, [subject, subject, subject]);
  assert.equal(calls.length, 0);
});

test("signed team requests translate the local Studio contract to fixed provider calls", async t => {
  const { env, calls, limits } = fixture(t);
  for (const [route, body, path, payload] of [
    ["sample", { text: "  short drum  " }, "sound-generation", { text: "short drum", duration_seconds: 15, loop: false, model_id: "eleven_text_to_sound_v3" }],
    ["speech", { text: "Hi" }, "text-to-speech/21m00Tcm4TlvDq8ikWAM", { text: "Hi", model_id: "eleven_v3" }],
    ["song", { text: "short drum", duration_ms: 3000, instrumental: false }, "music", { prompt: "short drum", music_length_ms: 3000, force_instrumental: false, model_id: "music_v2_5" }]
  ]) {
    const response = await worker.fetch(post(route, body), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio);
    const { url, init } = calls.at(-1);
    assert.equal(url, "https://api.elevenlabs.io/v1/" + path);
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(init.body), payload);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("xi-api-key"), env.ELEVENLABS_API_KEY);
    assert.equal(headers.get("cf-access-jwt-assertion"), null);
  }
  assert.equal(calls.length, 3);
  assert.deepEqual(limits, [subject, subject, subject]);
});

test("upstream failures, unexpected content and oversized audio return a generic error", async t => {
  const { env, setProvider } = fixture(t);
  for (const provider of [
    () => new Response("private details", { status: 403 }),
    () => Response.redirect("https://elsewhere.example", 307),
    () => new Response("private details", { headers: { "content-type": "application/json" } }),
    () => new Response(new Uint8Array(2_000_001), { headers: { "content-type": "audio/mpeg" } }),
    () => { throw new Error("private details"); }
  ]) {
    setProvider(provider);
    const response = await worker.fetch(post("sample", { text: "short drum" }), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Audio generation failed." });
  }
});
