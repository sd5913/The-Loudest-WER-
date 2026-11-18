"""Local preview server and optional ElevenLabs sound-effects proxy.

Run: python3 local_server.py
Set ELEVENLABS_API_KEY in the process environment to enable generation.
No key is read from the webpage or stored in this folder.
"""
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent


def load_local_env():
    path = ROOT / ".env.local"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            os.environ.setdefault(name.strip(), value.strip().strip("\"'"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        target = Path(self.translate_path(self.path))
        if any(part.startswith(".") for part in target.relative_to(ROOT).parts) or not target.resolve().is_relative_to(ROOT):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        if self.path not in ("/api/generate-sample", "/api/generate-song", "/api/generate-speech"):
            self.send_error(404)
            return
        key = os.environ.get("ELEVENLABS_API_KEY")
        if not key:
            self.reply(503, {"error": "API key is not configured"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 2048:
                self.reply(400, {"error": "Invalid request size"})
                return
            value = json.loads(self.rfile.read(size))
            if not isinstance(value, dict):
                self.reply(400, {"error": "Expected a JSON object"})
                return
            idea = value.get("text", "")
            speech = self.path == "/api/generate-speech"
            song = self.path == "/api/generate-song"
            if not isinstance(idea, str) or not (1 if speech else 8) <= len(idea.strip()) <= (600 if song else 180):
                self.reply(400, {"error": "Invalid music description" if song else "Describe a short sound in 8–180 characters"})
                return
            if speech:
                voice = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
                if not voice.isalnum():
                    self.reply(503, {"error": "Invalid voice ID"})
                    return
                payload = json.dumps({
                    "text": idea.strip(),
                    "model_id": "eleven_v3",
                }).encode()
                endpoint = "https://api.elevenlabs.io/v1/text-to-speech/" + voice
            elif song:
                duration = value.get("duration_ms")
                if not isinstance(duration, int) or not 3000 <= duration <= 60000:
                    self.reply(400, {"error": "Choose 3–60 seconds"})
                    return
                payload = json.dumps({"prompt": idea.strip(), "music_length_ms": duration,
                                      "model_id": "music_v2_5", "force_instrumental": value.get("instrumental") is not False}).encode()
            else:
                payload = json.dumps({"text": idea.strip(), "duration_seconds": 15,
                                      "loop": False, "model_id": "eleven_text_to_sound_v3"}).encode()
            request = Request(
                endpoint if speech else ("https://api.elevenlabs.io/v1/music" if song else "https://api.elevenlabs.io/v1/sound-generation"),
                data=payload,
                headers={
                    "xi-api-key": key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                method="POST",
            )
            limit = 8_000_000 if song else 2_000_000
            with urlopen(request, timeout=120 if song else 45) as response:
                audio = response.read(limit + 1)
            if len(audio) > limit:
                self.reply(502, {"error": "Generated audio is too large"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except (ValueError, json.JSONDecodeError):
            self.reply(400, {"error": "Invalid request"})
        except HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(raw).get("detail", {})
                if isinstance(detail, dict):
                    message = str(detail.get("message", detail.get("status", "Request rejected")))
                else:
                    message = str(detail)
            except ValueError:
                message = "Provider rejected the request"
            message = message.replace(key, "[HIDDEN]")
            self.reply(502, {"error": "ElevenLabs HTTP " + str(error.code) + ": " + message[:1200]})
        except URLError as error:
            message = str(error.reason).replace(key, "[HIDDEN]")
            self.reply(502, {"error": "Connection failed: " + message[:500]})

    def reply(self, status, value):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        # Do not log user sound descriptions.
        pass


if __name__ == "__main__":
    load_local_env()
    print("WER local preview: http://localhost:8766/studio.html")
    ThreadingHTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
