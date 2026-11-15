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


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path not in ("/api/generate-sample", "/api/generate-song"):
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
            idea = value.get("text", "")
            song = self.path == "/api/generate-song"
            if not isinstance(idea, str) or not 8 <= len(idea.strip()) <= (600 if song else 180):
                self.reply(400, {"error": "Invalid music description" if song else "Describe a short sound in 8–180 characters"})
                return
            if song:
                duration = value.get("duration_ms")
                if not isinstance(duration, int) or not 3000 <= duration <= 60000:
                    self.reply(400, {"error": "Choose 3–60 seconds"})
                    return
                payload = json.dumps({"prompt": idea.strip(), "music_length_ms": duration,
                                      "model_id": "music_v2_5", "force_instrumental": value.get("instrumental") is not False}).encode()
            else:
                payload = json.dumps({"text": idea.strip(), "duration_seconds": 1.5,
                                      "loop": False, "model_id": "eleven_text_to_sound_v3"}).encode()
            request = Request(
                "https://api.elevenlabs.io/v1/music" if song else "https://api.elevenlabs.io/v1/sound-generation",
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
        except (HTTPError, URLError):
            self.reply(502, {"error": "Sound generation is unavailable"})

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
    print("WER local preview: http://localhost:8766/studio.html")
    ThreadingHTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
