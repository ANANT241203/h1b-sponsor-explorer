#!/usr/bin/env python3
"""Summarise visits.jsonl.

    python3 stats.py              # print a summary to the terminal
    python3 stats.py --html       # also write stats.html and tell you where it is

A "visit" is a request for the page itself (/ or /index.html). Requests for
payload.bin.gz are counted separately: it is cached for a year, so a returning
visitor loads the page without re-fetching the data.
"""
import json, os, sys, collections, datetime, html, signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)   # allow piping into head/less

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.abspath(os.path.join(HERE, os.pardir))   # parent dir - not served
LOG = os.path.join(HERE, 'visits.jsonl')
PAGE = ('/', '/index.html')

if not os.path.exists(LOG):
    sys.exit('No visits.jsonl yet — start serve.py and load the site once.')

rows = []
for line in open(LOG):
    line = line.strip()
    if line:
        try: rows.append(json.loads(line))
        except json.JSONDecodeError: pass
if not rows:
    sys.exit('visits.jsonl is empty.')

page = [r for r in rows if r['path'] in PAGE and r['status'] in (200, 304)]
data = [r for r in rows if r['path'].endswith('.bin.gz') and r['status'] in (200, 206)]
day = lambda r: r['ts'][:10]

visitors   = {r['visitor'] for r in page}
by_day     = collections.Counter(day(r) for r in page)
uniq_day   = collections.defaultdict(set)
for r in page: uniq_day[day(r)].add(r['visitor'])
countries  = collections.Counter(r['country'] for r in page if r['country'])
refs       = collections.Counter(r['ref'].split('/')[2] for r in page
                                 if r['ref'].startswith('http') and len(r['ref'].split('/')) > 2)
hours      = collections.Counter(int(r['ts'][11:13]) for r in page)
tunnelled  = sum(1 for r in page if r['via_tunnel'])
gb         = sum(r['bytes'] for r in rows) / 1e9

def device(ua):
    u = ua.lower()
    if 'ipad' in u or 'tablet' in u: return 'Tablet'
    if 'mobi' in u or 'iphone' in u or 'android' in u: return 'Phone'
    if not u: return 'Unknown'
    return 'Desktop'
def browser(ua):
    u = ua.lower()
    for name, key in [('Edge','edg/'),('Chrome','chrome/'),('Firefox','firefox/'),
                      ('Safari','safari/')]:
        if key in u: return name
    return 'Other'
devices  = collections.Counter(device(r['ua']) for r in page)
browsers = collections.Counter(browser(r['ua']) for r in page)

def bar(n, mx, w=34):
    return '█' * max(1, round(w * n / mx)) if n else ''

print(f"\n  H-1B Sponsor Explorer — traffic\n  {'-'*46}")
print(f"  page loads            {len(page):>8,}")
print(f"  unique visitors       {len(visitors):>8,}")
print(f"  dataset downloads     {len(data):>8,}   (cached after first visit)")
print(f"  bandwidth served      {gb:>8.2f} GB")
print(f"  arrived via tunnel    {tunnelled:>8,} of {len(page):,}")
if page:
    print(f"  first / last          {page[0]['ts'][:16]}  ->  {page[-1]['ts'][:16]}")

if by_day:
    mx = max(by_day.values())
    print(f"\n  BY DAY                 loads  unique")
    for d in sorted(by_day)[-14:]:
        print(f"  {d}   {by_day[d]:>6,}  {len(uniq_day[d]):>6,}  {bar(by_day[d], mx)}")
for title, ctr in [('COUNTRY', countries), ('REFERRER', refs),
                   ('DEVICE', devices), ('BROWSER', browsers)]:
    if ctr:
        mx = max(ctr.values())
        print(f"\n  {title}")
        for k, v in ctr.most_common(8):
            print(f"  {str(k)[:26]:<26} {v:>6,}  {bar(v, mx, 22)}")
print()

if '--html' in sys.argv:
    days = sorted(by_day)[-30:]
    mx = max([by_day[d] for d in days], default=1)
    row = lambda k, v, m: (f'<tr><td>{html.escape(str(k))}</td><td class=n>{v:,}</td>'
                           f'<td><div class=b style="width:{v/m*100:.1f}%"></div></td></tr>')
    tbl = lambda t, c: (f'<div class=p><h2>{t}</h2><table>' +
                        ''.join(row(k, v, max(c.values())) for k, v in c.most_common(10)) +
                        '</table></div>') if c else ''
    open(os.path.join(OUT, 'stats.html'), 'w').write(f"""<!DOCTYPE html><meta charset=utf-8>
<title>Traffic — H-1B Sponsor Explorer</title><style>
body{{background:#0c1017;color:#e6edf3;font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px}}
h1{{font-size:18px;margin:0 0 4px}} h2{{font-size:12px;text-transform:uppercase;letter-spacing:.6px;
color:#64748b;margin:0 0 8px}} .sub{{color:#64748b;font-size:12px;margin-bottom:20px}}
.k{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}}
.c{{background:#141a23;border:1px solid #252e3b;border-radius:8px;padding:11px 13px}}
.c .l{{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#64748b}}
.c .v{{font-size:21px;font-weight:650;margin-top:3px}}
.g{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}}
.p{{background:#141a23;border:1px solid #252e3b;border-radius:8px;padding:13px}}
table{{width:100%;border-collapse:collapse;font-size:12.5px}}
td{{padding:3px 6px;border-bottom:1px solid #1a212b}} td.n{{text-align:right;width:64px}}
.b{{height:7px;background:linear-gradient(90deg,#1f6feb,#39c5cf);border-radius:4px;min-width:2px}}
</style><h1>H-1B Sponsor Explorer — traffic</h1>
<div class=sub>{len(rows):,} requests logged · generated {datetime.datetime.now():%Y-%m-%d %H:%M}</div>
<div class=k>
<div class=c><div class=l>Page loads</div><div class=v>{len(page):,}</div></div>
<div class=c><div class=l>Unique visitors</div><div class=v>{len(visitors):,}</div></div>
<div class=c><div class=l>Dataset downloads</div><div class=v>{len(data):,}</div></div>
<div class=c><div class=l>Bandwidth</div><div class=v>{gb:.2f} GB</div></div>
</div>
<div class=p style="margin-bottom:12px"><h2>Page loads by day</h2><table>
{''.join(row(d, by_day[d], mx) for d in days)}</table></div>
<div class=g>{tbl('Country', countries)}{tbl('Referrer', refs)}
{tbl('Device', devices)}{tbl('Browser', browsers)}</div>""")
    p = os.path.join(OUT, 'stats.html')
    print(f'  wrote {p}')
    print(f'  open it with:  xdg-open {p}\n')
