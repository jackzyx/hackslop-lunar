"""Run Sun Shade from this folder (USB stick, no internet): python serve.py

Browsers refuse the app's module script and its terrain fetch on file:// pages, so it needs a
local server. Python standard library only; works on Windows and macOS.
"""
import functools
import http.server
import pathlib
import webbrowser
from urllib.parse import urlsplit

PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows can map .js to text/plain in its registry; browsers refuse module scripts served that way.
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def translate_path(self, path):
        if urlsplit(path).path in ("/about", "/compare", "/privacy", "/terms", "/accessibility"):
            path = "/index.html"
        return super().translate_path(path)

    def send_error(self, code, message=None, explain=None):
        if code == 404 and "text/html" in self.headers.get("Accept", "text/html"):
            try:
                html = (pathlib.Path(self.directory) / "404.html").read_bytes()
            except OSError:
                pass
            else:
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(html)
                return
        super().send_error(code, message, explain)


if __name__ == "__main__":
    here = str(pathlib.Path(__file__).resolve().parent)
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=here)) as httpd:
        url = f"http://127.0.0.1:{PORT}/"
        print(f"Sun Shade at {url}  (Ctrl+C to stop)")
        webbrowser.open(url)
        httpd.serve_forever()
