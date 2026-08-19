"""Stage 2: all raw_FY*.parquet -> the compressed payload the dashboard embeds.

Grain is split in two so adding fiscal quarters stays cheap:
  K  one row per (employer, occupation, worksite state)      - period-independent attributes
  P  one row per (K row, fiscal quarter)                     - everything that varies over time
Most (employer, role, state) combinations appear in only one or two quarters, so P
grows far more slowly than periods x K.
"""
import pandas as pd, numpy as np, glob, json, gzip, base64, time

t0 = time.time()
files = sorted(glob.glob('raw_FY*.parquet'))
df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
before = len(df)
# A case can appear in two files: certified once, then withdrawn later (all 5,896 overlaps
# in this build are exactly Certified -> Certified - Withdrawn, median 409 days apart).
# Keep the EARLIEST decision so the petition counts in the quarter it was actually certified,
# rather than being moved years forward into the quarter it was withdrawn.
df = df.sort_values('DECISION_DATE', kind='stable').drop_duplicates('CASE_NUMBER', keep='first')
print(f'loaded {len(files)} files: {before:,} rows -> {len(df):,} after dedupe  ({time.time()-t0:.0f}s)')

# ---------- period ----------
d = df.DECISION_DATE
df = df[d.notna()].copy(); d = df.DECISION_DATE
df['FY'] = (d.dt.year + (d.dt.month >= 10).astype(int)).astype(int)
df['FQ'] = (((d.dt.month - 10) % 12) // 3 + 1).astype(int)
periods = sorted(set(zip(df.FY, df.FQ)))
PID = {p: i for i, p in enumerate(periods)}
df['P'] = [PID[(a, b)] for a, b in zip(df.FY, df.FQ)]
print('periods present:', ', '.join(f'FY{a}Q{b}' for a, b in periods))

# ---------- canonical employer ----------
SUFFIX = (r'\b(INC|INCORPORATED|LLC|L\.?L\.?C|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|LP|LLP|PLLC|'
          r'PC|PA|USA|US|U\.?S\.?A|AMERICA|AMERICAS|NA|N\.?A|HOLDINGS?|GROUP|INTERNATIONAL|'
          r'TECHNOLOGIES|TECHNOLOGY|SOLUTIONS|SERVICES|SYSTEMS|GMBH|BV|AG|SA|PVT|PRIVATE|PLC)\b')
s = (df.EMPLOYER_NAME.str.upper().str.replace(r'[^A-Z0-9& ]', ' ', regex=True)
       .str.replace(r'\s+', ' ', regex=True).str.strip())
core = s.str.replace(SUFFIX, '', regex=True).str.replace(r'\s+', ' ', regex=True).str.strip()
df['EMP_KEY'] = core.where(core.str.len() >= 3, s)
disp = (df.groupby(['EMP_KEY', 'EMPLOYER_NAME']).size().rename('n').reset_index()
          .sort_values('n', ascending=False).drop_duplicates('EMP_KEY')
          .set_index('EMP_KEY')['EMPLOYER_NAME'])
df['EMP'] = df.EMP_KEY.map(disp)
print(f'employers {df.EMPLOYER_NAME.nunique():,} raw -> {df.EMP.nunique():,} canonical')

# ---------- wages ----------
MULT = {'Year': 1, 'Hour': 2080, 'Month': 12, 'Week': 52, 'Bi-Weekly': 26}
wm = df.WAGE_UNIT_OF_PAY.map(MULT).astype('float64')
lo = pd.to_numeric(df.WAGE_RATE_OF_PAY_FROM, errors='coerce') * wm
hi = pd.to_numeric(df.WAGE_RATE_OF_PAY_TO, errors='coerce') * wm
df['WAGE'] = np.where(hi.notna() & (hi > lo), (lo + hi) / 2, lo)
df['PWAGE'] = pd.to_numeric(df.PREVAILING_WAGE, errors='coerce') * df.PW_UNIT_OF_PAY.map(MULT).astype('float64')
for c in ('WAGE', 'PWAGE'):
    df.loc[(df[c] < 15000) | (df[c] > 2_000_000), c] = np.nan
df['PWRATIO'] = df.WAGE / df.PWAGE

# ---------- flags ----------
df['CERT']   = df.CASE_STATUS.isin(['Certified', 'Certified - Withdrawn'])
df['DENIED'] = df.CASE_STATUS.eq('Denied')
num = lambda c, f=0: pd.to_numeric(df[c], errors='coerce').fillna(f)
df['NEWPOS'], df['CONTPOS'] = num('NEW_EMPLOYMENT'), num('CONTINUED_EMPLOYMENT')
df['WORKERS'] = num('TOTAL_WORKER_POSITIONS', 1).replace(0, 1)
df['LVL'] = df.PW_WAGE_LEVEL.map({'I': 1, 'II': 2, 'III': 3, 'IV': 4}).astype('float64')
df['CITY'] = df.WORKSITE_CITY.str.title().fillna('Unknown')
df['ST'] = df.WORKSITE_STATE.fillna('??')
df['JT'] = df.JOB_TITLE.str.title().fillna('Unknown')

# ---------- dictionaries ----------
def dic(series):
    cats = pd.Index(series.astype(str).unique()).sort_values()
    return list(cats), pd.Series(range(len(cats)), index=cats)
emp_l, emp_i   = dic(df.EMP)
soc_l, soc_i   = dic(df.SOC_TITLE)
st_l,  st_i    = dic(df.ST)
city_l, city_i = dic(df.CITY + ', ' + df.ST)
jt_l,  jt_i    = dic(df.JT)
df['e'] = df.EMP.map(emp_i).astype('int32')
df['s'] = df.SOC_TITLE.map(soc_i).astype('int32')
df['t'] = df.ST.map(st_i).astype('int16')
df['c'] = (df.CITY + ', ' + df.ST).map(city_i).astype('int32')
df['j'] = df.JT.map(jt_i).astype('int32')

q = lambda x, p: (float(np.percentile(x.dropna(), p)) if x.notna().any() else np.nan)

# ---------- K: one row per employer x occupation x state ----------
K = (df.groupby(['e', 's', 't'], observed=True, sort=True)
       .agg(p25=('WAGE', lambda x: q(x, 25)), p75=('WAGE', lambda x: q(x, 75)),
            pwr=('PWRATIO', 'median'), ft=('FULL_TIME_POSITION', lambda x: (x == 'Y').mean()),
            c=('c', lambda x: x.mode().iat[0]), j=('j', lambda x: x.mode().iat[0]))
       .reset_index())
K['ki'] = np.arange(len(K), dtype='int32')
df = df.merge(K[['e', 's', 't', 'ki']], on=['e', 's', 't'], how='left')
print(f'K rows {len(K):,}  ({time.time()-t0:.0f}s)')

# ---------- P: one row per K row x fiscal quarter ----------
P = (df.groupby(['ki', 'P'], observed=True, sort=True)
       .agg(n=('CASE_NUMBER', 'size'), w=('WORKERS', 'sum'),
            new=('NEWPOS', 'sum'), cont=('CONTPOS', 'sum'),
            cert=('CERT', 'sum'), den=('DENIED', 'sum'),
            p50=('WAGE', lambda x: q(x, 50)), lvl=('LVL', 'mean'))
       .reset_index())
print(f'P rows {len(P):,}  ({len(P)/len(K):.2f} per K row)  ({time.time()-t0:.0f}s)')

# ---------- employer / occupation / state reference stats (all periods) ----------
ew = df.dropna(subset=['WAGE']).groupby('e').WAGE
empwage = pd.DataFrame({'p25': ew.quantile(.25), 'p50': ew.quantile(.50), 'p75': ew.quantile(.75)}) \
            .reindex(range(len(emp_l)))
eg = df.groupby('e')
emeta = pd.DataFrame({
    'dep': eg.H_1B_DEPENDENT.agg(lambda x: (x == 'Yes').mean()),
    'wv':  eg.WILLFUL_VIOLATOR.agg(lambda x: (x == 'Yes').mean()),
    'naics': eg.NAICS_CODE.agg(lambda x: x.mode().iat[0] if len(x.mode()) else ''),
    'law': eg.LAWFIRM_NAME_BUSINESS_NAME.agg(lambda x: x.mode().iat[0] if len(x.mode()) else ''),
    'hq': eg.apply(lambda d: (d.EMPLOYER_CITY.fillna('') + ', ' + d.EMPLOYER_STATE.fillna('')).mode().iat[0],
                   include_groups=False),
}).reindex(range(len(emp_l)))
sg = df.groupby('s').WAGE
socbench = pd.DataFrame({'n': df.groupby('s').size(), 'p25': sg.quantile(.25), 'p50': sg.quantile(.50),
                         'p75': sg.quantile(.75), 'p90': sg.quantile(.90)}).reindex(range(len(soc_l)))
stbench = pd.DataFrame({'n': df.groupby('t').size(),
                        'p50': df.groupby('t').WAGE.median()}).reindex(range(len(st_l)))

# ---------- occupation groups ----------
GROUPS = [("Technology & Software", {"15"}), ("Engineering & Architecture", {"17"}),
          ("Business & Finance", {"13"}), ("Management", {"11"}),
          ("Healthcare & Medicine", {"29", "31"}), ("Science & Research", {"19"}),
          ("Education & Academia", {"25"}), ("Arts, Design & Media", {"27"}),
          ("Legal", {"23"}), ("Sales & Marketing", {"41"}), ("Other & Support", set())]
OTHER = len(GROUPS) - 1
MG2G = {mg: i for i, (_, mgs) in enumerate(GROUPS) for mg in mgs}
modal_mg = df.assign(MG=df.SOC_CODE.str.slice(0, 2)).groupby('SOC_TITLE').MG.agg(lambda x: x.mode().iat[0])
socgrp = [MG2G.get(modal_mg.get(tt, ''), OTHER) for tt in soc_l]

# ---------- serialise ----------
ints  = lambda s, f=0: [int(v) for v in pd.to_numeric(s, errors='coerce').fillna(f).round()]
r500  = lambda s: [int(x) if x == x else 0 for x in (pd.to_numeric(s, errors='coerce') / 500).round().fillna(0)]
ki = P.ki.to_numpy()
kd = np.empty(len(ki), dtype='int64'); kd[0] = ki[0]; kd[1:] = np.diff(ki)   # delta-encoded

payload = {
  'meta': {'rows': int(len(df)), 'employers': len(emp_l),
           'generated': time.strftime('%Y-%m-%d'),
           'source': 'DOL OFLC LCA Disclosure Data',
           'medwage': int(round(df.WAGE.median()))},
  'periods': [f'FY{a}Q{b}' for a, b in periods],
  'pmonths': [[f'{a}-{b}' for a, b in [(y, m)]] for y, m in [(0, 0)]][:0] or None,
  'emp': emp_l, 'soc': soc_l, 'st': st_l, 'city': city_l, 'jt': jt_l,
  'grp': [g[0] for g in GROUPS], 'socgrp': socgrp,
  'K': {'e': ints(K.e), 's': ints(K.s), 't': ints(K.t), 'c': ints(K.c), 'j': ints(K.j),
        'p25': r500(K.p25), 'p75': r500(K.p75), 'pwr': ints(K.pwr * 100), 'ft': ints(K.ft * 100)},
  'P': {'kd': [int(v) for v in kd], 'q': ints(P.P),
        'n': ints(P.n), 'w': ints(P.w), 'new': ints(P.new), 'cont': ints(P.cont),
        'cert': ints(P.cert), 'den': ints(P.den), 'p50': r500(P.p50), 'lvl': ints(P.lvl * 10)},
  'empmeta': {'dep': ints(emeta.dep * 100), 'wv': ints(emeta.wv * 100),
              'naics': [str(x)[:6] if x == x else '' for x in emeta.naics],
              'hq': [str(x).strip(' ,') if x == x else '' for x in emeta.hq]},
  'empwage': {'p25': r500(empwage.p25), 'p50': r500(empwage.p50), 'p75': r500(empwage.p75)},
  'socbench': {'n': ints(socbench.n), 'p25': r500(socbench.p25), 'p50': r500(socbench.p50),
               'p75': r500(socbench.p75), 'p90': r500(socbench.p90)},
  'stbench': {'n': ints(stbench.n), 'p50': r500(stbench.p50),
              'exact': ints(stbench.p50.fillna(0))},
}
del payload['pmonths']
# law firms as sparse pairs
lawd, lix, lval = {}, [], []
for i, v in enumerate(emeta.law):
    if isinstance(v, str) and v and v != 'nan':
        lawd.setdefault(v, len(lawd)); lix.append(i); lval.append(lawd[v])
payload['empmeta']['lawix'], payload['empmeta']['lawval'] = lix, lval
payload['lawdict'] = list(lawd.keys())

raw = json.dumps(payload, separators=(',', ':')).encode()
comp = gzip.compress(raw, 9)
open('payload.b64', 'w').write(base64.b64encode(comp).decode())
print(f'\njson {len(raw)/1e6:.1f}MB -> gzip {len(comp)/1e6:.2f}MB -> b64 {len(comp)*4/3/1e6:.2f}MB'
      f'   ({time.time()-t0:.0f}s)')

# ---------- verification ----------
chk = {'total_rows': int(len(df)), 'P_n_sum': int(P.n.sum()),
       'per_period': {f'FY{a}Q{b}': int((df.P == PID[(a, b)]).sum()) for a, b in periods},
       'employers': len(emp_l), 'K': len(K), 'P': len(P),
       'median_wage': int(round(df.WAGE.median()))}
json.dump(chk, open('checks.json', 'w'), indent=2)
assert int(P.n.sum()) == len(df), f'P totals {P.n.sum():,} != rows {len(df):,}'
print('P petition totals reconcile to', f'{len(df):,}', 'rows')
for k, v in chk['per_period'].items(): print(f'   {k}: {v:>8,}')
