#!/usr/bin/env python3
import http.server
import socketserver
import os
from pathlib import Path

class SimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent / "simple-ui"), **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

PORT = 8080
Handler = SimpleHTTPRequestHandler

print(f"🚀 Server Python avviato su http://localhost:{PORT}")
print(f"📁 Servendo files da: {Path(__file__).parent / 'simple-ui'}")
print("📝 Premi Ctrl+C per fermare il server")

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n🛑 Server fermato dall'utente")
except Exception as e:
    print(f"❌ Errore server: {e}")
