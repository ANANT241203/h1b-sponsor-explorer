"""Emit both builds from one template: a self-contained file and a hosted site."""
import base64, os, shutil
import sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# the template is assembled from src/ in order
tpl = ''.join(open(f'src/{f}').read() for f in
              ['head.html', 'app.js', 'app2.js', 'lottery_data.js', 'app3.js', 'app4.js'])
open('template.html', 'w').write(tpl)

# prefer the freshly built payload; fall back to the one committed under site/
if os.path.exists('payload.b64'):
    b64 = open('payload.b64').read().strip()
elif os.path.exists('site/payload.bin.gz'):
    b64 = base64.b64encode(open('site/payload.bin.gz', 'rb').read()).decode()
else:
    sys.exit('No payload found. Run pipeline/ingest.py then pipeline/build.py first.')

os.makedirs('dist', exist_ok=True)

# 1. single file - payload inlined, works from disk, works offline, easy to email
single = tpl.replace('__PAYLOAD__', b64)
open('dist/H1B_Sponsor_Explorer.html', 'w').write(single)

# 2. hosted site - payload as a separate gzip the browser caches on its own
os.makedirs('site', exist_ok=True)
index = tpl.replace('__PAYLOAD__', '')
open('site/index.html', 'w').write(index)
raw = base64.b64decode(b64)                      # already gzip-compressed bytes
open('site/payload.bin.gz', 'wb').write(raw)
open('site/_headers', 'w').write(
    "/payload.bin.gz\n"
    "  Content-Type: application/octet-stream\n"
    "  Content-Encoding: identity\n"          # we decompress in JS; don't let the CDN re-encode
    "  Cache-Control: public, max-age=31536000, immutable\n"
    "/index.html\n"
    "  Cache-Control: public, max-age=300\n")
mb = lambda p: os.path.getsize(p)/1048576
print(f'single-file  dist/H1B_Sponsor_Explorer.html  {mb("dist/H1B_Sponsor_Explorer.html"):.2f} MB')
print(f'hosted       site/index.html            {mb("site/index.html")*1024:.0f} KB')
print(f'             site/payload.bin.gz        {mb("site/payload.bin.gz"):.2f} MB')
print(f'             total over the wire        {mb("site/index.html")+mb("site/payload.bin.gz"):.2f} MB'
      f'   ({(1-(mb("site/index.html")+mb("site/payload.bin.gz"))/mb("dist/H1B_Sponsor_Explorer.html"))*100:.0f}% lighter)')
