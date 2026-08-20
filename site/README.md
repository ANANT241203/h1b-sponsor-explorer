# H-1B Sponsor Explorer — hosted build

Static site. No backend, no database, no build step. Everything runs in the visitor's browser.

    index.html        77 KB   the app
    payload.bin.gz   6.7 MB   the dataset (gzip, decompressed in-browser)
    _headers                  cache + content-type rules (Cloudflare Pages / Netlify)
    serve.py                  local server that logs requests (self-hosting only)
    stats.py                  turns that log into a traffic summary

`index.html` fetches `payload.bin.gz` at load, so this build **must be served over http(s)** —
opening index.html from disk will fail on CORS. For local/offline use, use the single-file
`H1B_Sponsor_Explorer.html` instead, which has the data inlined.

## Deploy to a static host (recommended)

    # Cloudflare Pages
    npx wrangler pages deploy . --project-name h1b-explorer

    # Netlify
    npx netlify deploy --prod --dir .

    # GitHub Pages: commit these files to a repo, Settings -> Pages -> deploy from branch

Delete `serve.py` and `stats.py` before deploying to a static host — they are only for
self-hosting, and on a static host they would just sit there as downloadable text.

## Serve from your own laptop (with traffic stats)

    python3 serve.py                     # terminal 1 - port 8080
    cloudflared tunnel --url http://localhost:8080   # terminal 2

`serve.py` is a drop-in replacement for `python3 -m http.server` that also records one JSON
line per request to `visits.jsonl`. Behind the tunnel the socket only ever sees 127.0.0.1,
so it reads the real visitor IP from Cloudflare's `CF-Connecting-IP` header, plus
`CF-IPCountry` for geography.

    python3 stats.py            # summary in the terminal
    python3 stats.py --html     # also writes stats.html

Reports page loads, unique visitors, dataset downloads, bandwidth, per-day traffic, country,
referrer, device and browser. Note that `payload.bin.gz` is cached for a year, so returning
visitors show a page load without a matching dataset download - that gap is the returning-visitor
signal.

**Privacy:** IPs are salted-hashed before they reach disk (enough to count unique visitors, not
enough to identify anyone or to be worth leaking). The salt is generated once into `.salt`, mode
0600. Set `RAW_IPS=1` to store full addresses instead, if you have a reason to.

`serve.py` refuses to serve `visits.jsonl`, `.salt`, `stats.html`, `README.md` and any `.py` or
dotfile - they return 404 even though they sit in this folder. `stats.py` writes the report to the
**parent** directory for the same reason, so it can never be published by accident.

If you would rather not run your own logging at all, Cloudflare Web Analytics is a one-line
script tag, free, and cookie-less - but it is a third-party beacon, and it will not see visitors
who block trackers.

The second command prints a public HTTPS URL. No port forwarding, no dynamic DNS, and your
home IP stays private because the tunnel dials out rather than accepting inbound connections.
The laptop has to stay awake: `systemd-inhibit --what=sleep --why="hosting" sleep infinity`.

### Caddy (if you want a long-running server instead)

    # Caddyfile
    yourdomain.com {
        root * /path/to/site
        file_server
        encode zstd gzip
        header /payload.bin.gz Cache-Control "public, max-age=31536000, immutable"
    }

Do not let the server re-compress `payload.bin.gz` — it is already gzip and the app decompresses
it in JavaScript. The `_headers` file sets `Content-Encoding: identity` for that reason.

## Data

U.S. Department of Labor, OFLC LCA Disclosure Data — 799,016 LCAs, FY2023 Q4 through
FY2026 Q3. Public federal data. Contains employer and law-firm organization names only; no
attorney names, emails, phone numbers or tax IDs. Full method notes are in the app under
"Methodology".

The Lottery view is a separate national series from USCIS's H-1B electronic-registration table
(FY2021–FY2026), plus DHS's projected FY2027 wage-level selection probabilities. It is not joined to
the DOL records and does not claim employer-specific or person-specific lottery odds.
