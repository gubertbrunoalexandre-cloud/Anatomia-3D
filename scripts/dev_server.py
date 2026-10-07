"""Servidor local de desenvolvimento: igual ao `python -m http.server`, mas manda
`Cache-Control: no-store` para o navegador nunca usar JS/JSON antigo em cache.

Uso:  python scripts/dev_server.py [porta]   (padrao 8080)
"""
import http.server
import os
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    with Server(("", port), NoCacheHandler) as httpd:
        print(f"Servindo anatomia-fono-3d em http://localhost:{port}/web/index.html (sem cache)")
        httpd.serve_forever()
