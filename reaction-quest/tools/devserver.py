# -*- coding: utf-8 -*-
"""本機開發／驗證用靜態伺服器。
額外提供 POST /__save/<檔名> 供瀏覽器端把編譯好的 .mind 位元組寫回磁碟
（因為 Windows 上 node canvas 無法編譯，改以瀏覽器執行 MindAR Compiler）。
用法： python tools/devserver.py [port]
"""
import os, sys, http.server, socketserver

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=BASE, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if not self.path.startswith("/__save/"):
            self.send_error(404)
            return
        name = os.path.basename(self.path[len("/__save/"):])
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n)
        out = os.path.join(BASE, "targets", name)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(data)
        print("[saved] %s  %d bytes" % (out, len(data)))
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok %d" % len(data))

    def log_message(self, fmt, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
    print("serving %s at http://localhost:%d" % (BASE, PORT))
    httpd.serve_forever()
