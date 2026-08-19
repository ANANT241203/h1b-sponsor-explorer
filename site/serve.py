#!/usr/bin/env python3
"""Static file server for the H-1B Sponsor Explorer, with a request log.

Drop-in replacement for `python3 -m http.server` that records one JSON line per
request to visits.jsonl. Behind a Cloudflare tunnel the real visitor IP arrives in
the CF-Connecting-IP header (the socket itself only ever shows 127.0.0.1), so that
is what gets read.

    python3 serve.py                # port 8080
    python3 serve.py 9000           # another port
    RAW_IPS=1 python3 serve.py      # store full IPs instead of salted hashes

By default IPs are salted-hashed before they touch disk: enough to count unique
visitors, not enough to identify anyone or to be worth leaking. The salt lives in
.salt and is generated once.
"""
import http.server, socketserver, json, os, sys, hashlib, secrets, datetime, threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, 'visits.jsonl')
RAW = os.environ.get('RAW_IPS') == '1'

_salt_path = os.path.join(HERE, '.salt')
if os.path.exists(_salt_path):
    SALT = open(_salt_path).read().strip()
else:
    SALT = secrets.token_hex(16)
    open(_salt_path, 'w').write(SALT)
    os.chmod(_salt_path, 0o600)

_lock = threading.Lock()

# Never serve these over the tunnel: the visit log, the hashing salt, the generated
# report, and the server source. Requests for them get a plain 404.
BLOCKED = {'/visits.jsonl', '/.salt', '/stats.html', '/serve.py', '/stats.py', '/README.md'}


def anon(ip):
    if not ip:
        return ''
    if RAW:
        return ip
    return hashlib.sha256((SALT + ip).encode()).hexdigest()[:16]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        self._len = 0
        super().__init__(*a, directory=HERE, **kw)

    def _forbidden(self):
        p = self.path.split('?')[0].rstrip('/') or '/'
        return p in BLOCKED or p.rsplit('/', 1)[-1].startswith('.') or p.endswith('.py')

    def send_head(self):
        if self._forbidden():
            self.send_error(404, 'File not found')
            return None
        return super().send_head()

    def send_header(self, key, value):
        if key.lower() == 'content-length':
            try: self._len = int(value)
            except (TypeError, ValueError): pass
        super().send_header(key, value)

    def log_message(self, fmt, *args):
        pass                                   # everything goes through _write_log

    def log_request(self, code='-', size='-'):
        # fires before headers are sent, so only stash the status here
        self._code = code if isinstance(code, int) else getattr(code, 'value', 0)

    def handle_one_request(self):
        self._len, self._code, self.path = 0, 0, None
        super().handle_one_request()
        if self._code and self.path:
            self._write_log()

    def _write_log(self):
        h = self.headers
        if self._code == 304:                  # 304 sends no body
            self._len = 0
        ip = h.get('CF-Connecting-IP') or h.get('X-Forwarded-For', '').split(',')[0].strip() \
             or self.client_address[0]
        rec = {
            'ts': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
            'path': self.path.split('?')[0],
            'status': self._code,
            'bytes': self._len,
            'visitor': anon(ip),
            'country': h.get('CF-IPCountry', ''),
            'ref': (h.get('Referer') or '')[:200],
            'ua': (h.get('User-Agent') or '')[:250],
            'via_tunnel': bool(h.get('CF-Connecting-IP')),
        }
        with _lock:
            with open(LOG, 'a') as f:
                f.write(json.dumps(rec) + '\n')
        sys.stderr.write(f"{rec['ts']}  {rec['status']}  {rec['path']}  "
                         f"{rec['country'] or '--'}  {rec['visitor'][:8]}\n")

    def end_headers(self):
        # payload.bin.gz is already gzip and is inflated in JS - don't let anything re-encode it
        if self.path.endswith('.bin.gz'):
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        elif self.path.endswith('.html') or self.path in ('/', ''):
            self.send_header('Cache-Control', 'public, max-age=300')
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    print(f'serving {HERE} on http://localhost:{PORT}')
    print(f'logging to {LOG}  (IPs {"RAW" if RAW else "salted-hashed"})')
    print('run  python3 stats.py  in another terminal for a summary\n')
    try:
        Server(('', PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
