"""Stage the five public pages, their frontend code, and tracked media for Workers."""
from html.parser import HTMLParser
from pathlib import Path
from shutil import copyfile, rmtree
from subprocess import check_output
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".worker-assets"
PAGES = ("index.html", "studio.html", "pets.html", "gallery.html", "collection.html")


class FrontendFiles(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            url = attrs.get("src")
        elif tag == "link" and attrs.get("rel") == "stylesheet":
            url = attrs.get("href")
        else:
            return
        if url:
            path = Path(urlsplit(url).path)
            if path.suffix not in {".js", ".css"} or path.is_absolute() or ".." in path.parts:
                raise ValueError(f"Unexpected frontend reference in public page: {path}")
            self.paths.add(path)


def build():
    parser = FrontendFiles()
    for name in PAGES:
        parser.feed((ROOT / name).read_text(encoding="utf-8"))
    paths = {Path(name) for name in PAGES} | parser.paths
    tracked = check_output(["git", "ls-files", "-z", "--", "assets"], cwd=ROOT)
    for name in tracked.decode().split("\0"):
        path = Path(name)
        if (path.suffix in {".png", ".svg", ".wav", ".mp3"} or
            path.name in {"README.txt", "CREDITS.txt", "sample-sources.json"}):
            paths.add(path)
    if OUTPUT.exists():
        rmtree(OUTPUT)
    for path in sorted(paths):
        source = ROOT / path
        if source.resolve() != source or any(part.startswith(".") for part in path.parts):
            raise ValueError(f"Unexpected public file: {path}")
        target = OUTPUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        copyfile(source, target)
    (OUTPUT / "_redirects").write_text("/ /index.html 302\n")
    print(f"Staged {len(paths)} public files and the home redirect in {OUTPUT.name}")


if __name__ == "__main__":
    build()
