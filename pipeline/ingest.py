"""Stage 1: each LCA_Disclosure_Data_FY*.xlsx -> a typed, minimal parquet.

Runs once per source file and skips anything already ingested, so dropping new
fiscal years into the folder and re-running only pays for the new files.
"""
import pandas as pd, glob, os, re, sys, time

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
COLS = ["CASE_NUMBER","CASE_STATUS","DECISION_DATE","VISA_CLASS","JOB_TITLE","SOC_CODE","SOC_TITLE",
        "FULL_TIME_POSITION","TOTAL_WORKER_POSITIONS","NEW_EMPLOYMENT","CONTINUED_EMPLOYMENT",
        "CHANGE_EMPLOYER","EMPLOYER_NAME","EMPLOYER_CITY","EMPLOYER_STATE","NAICS_CODE",
        "LAWFIRM_NAME_BUSINESS_NAME","WORKSITE_CITY","WORKSITE_STATE",
        "WAGE_RATE_OF_PAY_FROM","WAGE_RATE_OF_PAY_TO","WAGE_UNIT_OF_PAY","PREVAILING_WAGE",
        "PW_UNIT_OF_PAY","PW_WAGE_LEVEL","H_1B_DEPENDENT","WILLFUL_VIOLATOR"]
NUM = {"TOTAL_WORKER_POSITIONS","NEW_EMPLOYMENT","CONTINUED_EMPLOYMENT","CHANGE_EMPLOYER",
       "WAGE_RATE_OF_PAY_FROM","WAGE_RATE_OF_PAY_TO","PREVAILING_WAGE"}

def ingest(path):
    tag = re.search(r'FY(\d{4})_Q(\d)', os.path.basename(path))
    if not tag:
        print(f'  ! skipping unrecognised name: {os.path.basename(path)}'); return None
    fy, fq = tag.group(1), tag.group(2)
    out = f'raw_FY{fy}Q{fq}.parquet'
    if os.path.exists(out):
        print(f'  = {os.path.basename(path)} already ingested -> {out}'); return out
    t = time.time()
    # tolerate schema drift: older files lack a few columns
    head = pd.read_excel(path, engine='calamine', nrows=0)
    use = [c for c in COLS if c in head.columns]
    missing = [c for c in COLS if c not in head.columns]
    df = pd.read_excel(path, engine='calamine', usecols=use)
    for c in df.columns:
        if c in NUM: df[c] = pd.to_numeric(df[c], errors='coerce')
        elif c == 'DECISION_DATE': df[c] = pd.to_datetime(df[c], errors='coerce')
        else: df[c] = df[c].astype('string').str.strip()
    for c in missing: df[c] = pd.NA
    df['SRC_FY'] = int(fy)
    df.to_parquet(out, index=False, compression='zstd')
    print(f'  + {os.path.basename(path)}: {len(df):>8,} rows -> {out}  ({time.time()-t:.0f}s)'
          + (f'  [missing cols: {missing}]' if missing else ''))
    return out

if __name__ == '__main__':
    files = sorted(glob.glob(f'{SRC}/LCA_Disclosure_Data_FY*.xlsx'))
    print(f'found {len(files)} source file(s) in {SRC}')
    for f in files: ingest(f)
    print('\ningested parquets:', sorted(glob.glob('raw_FY*.parquet')))
