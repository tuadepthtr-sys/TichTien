import http.server
import socketserver
import socket
import sys

PORT = 5544

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    local_ip = get_local_ip()
    print("=" * 65)
    print(" >>> MAY CHU TICH TIEU THANH DAI DANG CHAY")
    print("=" * 65)
    print(f" * Tren may tinh nay:             http://localhost:{PORT}")
    print(f" * Tren dien thoai (chung Wi-Fi): http://{local_ip}:{PORT}")
    print("=" * 65)
    print(" Nhan Ctrl + C de dung may chu.\n")
    
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã dừng máy chủ thành công.")
            sys.exit(0)
