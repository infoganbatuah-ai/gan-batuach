"""Disposable guest-only TCP/Unix write stand-ins. No original data or mounts."""
import os
import socketserver
import threading

PATH = "/tmp/qa-writer-events"
UNIX_PATH = "/tmp/qa-writer.sock"
LOCK = threading.Lock()


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        while self.rfile.readline() == b"W\n":
            with LOCK:
                fd = os.open(PATH, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                try:
                    os.write(fd, b"x")
                finally:
                    os.close(fd)
            self.wfile.write(b"OK\n")
            self.wfile.flush()


class TCP(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class Unix(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True


def main():
    try:
        os.unlink(UNIX_PATH)
    except FileNotFoundError:
        pass
    servers = [TCP(("127.0.0.1", p), Handler) for p in (18080, 15432)]
    servers.append(Unix(UNIX_PATH, Handler))
    # Synthetic guest-only socket is intentionally reachable by the test user.
    os.chmod(UNIX_PATH, 0o666)
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    threading.Event().wait()


if __name__ == "__main__":
    main()
