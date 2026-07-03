# KRX 공매도 데이터 수집 로컬 러너 — 선생님 PC에서 하루 1회 실행(작업 스케줄러), Supabase app_cache에 적재
# 데이터: ① 시장 전체(코스피·코스닥) 공매도 비중 Top ② 학생 보유 KR 종목별 60일 공매도 추이+잔고
# ⚠️ KRX_ID/KRX_PW는 .env.local 전용(커밋 금지). 웹앱은 이 러너가 적재한 DB만 읽음(계정 노출 0).
import os, sys, json, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_env():
    env = {}
    with open(os.path.join(ROOT, '.env.local'), encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"')
    for k in ('KRX_ID', 'KRX_PW'):
        os.environ[k] = env.get(k, '')
    return env

ENV = load_env()
SUPA = ENV.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SVC = ENV.get('SUPABASE_SERVICE_ROLE_KEY', '')

def supa_req(method, path, body=None, prefer=None):
    req = urllib.request.Request(f'{SUPA}{path}', method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'apikey': SVC, 'Authorization': f'Bearer {SVC}', 'Content-Type': 'application/json',
                 **({'Prefer': prefer} if prefer else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')

def main():
    from pykrx import stock

    # 최근 거래일 탐색(오늘부터 최대 7일 역행 — 전종목 결과가 비면 휴장)
    day = None
    d = datetime.date.today()
    for _ in range(7):
        ds = d.strftime('%Y%m%d')
        try:
            df = stock.get_shorting_volume_by_ticker(ds, market='KOSPI')
            if len(df) > 100 and df['공매도'].sum() > 0:
                day = ds
                break
        except Exception:
            pass
        d -= datetime.timedelta(days=1)
    if not day:
        print('거래일 탐색 실패'); sys.exit(1)
    print('기준 거래일:', day)

    # ① 시장 전체 공매도 비중 Top (코스피·코스닥 각 15) — 초저유동성 왜곡 방지: 공매도 1만주+ 필터
    market_top = []
    for mkt in ('KOSPI', 'KOSDAQ'):
        df = stock.get_shorting_volume_by_ticker(day, market=mkt)
        df = df[df['공매도'] >= 10000].sort_values('비중', ascending=False).head(15)
        for t, row in df.iterrows():
            try: name = stock.get_market_ticker_name(t)
            except Exception: name = t
            market_top.append({'ticker': t, 'name': str(name), 'market': mkt,
                               'shortVol': int(row['공매도']), 'buyVol': int(row['매수']),
                               'ratio': round(float(row['비중']), 2)})
    print('시장 Top:', len(market_top))

    # ② 학생 보유 KR 개별주식(전체 학생 합집합) — 종목별 60일 공매도 추이 + 최신 잔고
    rows = supa_req('GET', '/rest/v1/investments?select=ticker,name,market')
    kr = {}
    for r in rows or []:
        t = (r.get('ticker') or '').strip()
        if len(t) == 6 and t.isdigit() and (r.get('market') or '').upper() == 'KR':
            kr.setdefault(t, r.get('name') or t)
    print('보유 KR 종목:', len(kr))

    start = (datetime.datetime.strptime(day, '%Y%m%d') - datetime.timedelta(days=90)).strftime('%Y%m%d')
    holdings = []
    for t, name in kr.items():
        try:
            v = stock.get_shorting_volume_by_date(start, day, t)
            series = [{'date': idx.strftime('%Y-%m-%d'), 'shortVol': int(row['공매도']), 'ratio': round(float(row['비중']), 2)}
                      for idx, row in v.iterrows()]
        except Exception:
            series = []
        bal, bal_series = None, []
        try:
            b = stock.get_shorting_balance_by_date(start, day, t)
            if len(b):
                bal_series = [{'date': idx.strftime('%Y-%m-%d'), 'qty': int(row['공매도잔고']),
                               'pct': round(float(row['비중']), 2)} for idx, row in b.iterrows()][-60:]
                last = bal_series[-1]
                # 잔고 모멘텀: 20거래일 전 대비 수량 변화율(%) — 미국판 '전월비'와 동급
                prev = bal_series[-21]['qty'] if len(bal_series) > 20 else None
                chg = round((last['qty'] - prev) / prev * 100, 1) if prev else None
                bal = {'date': last['date'], 'qty': last['qty'], 'pct': last['pct'], 'chg20d': chg}
        except Exception:
            pass
        if series or bal:
            holdings.append({'ticker': t, 'name': name, 'series': series[-60:], 'balance': bal, 'balSeries': bal_series})
        print(' -', t, name, f'추이 {len(series)}일', f"잔고 {bal['pct']}% ({bal['chg20d']}%/20일)" if bal else '잔고없음')

    payload = {'date': f'{day[:4]}-{day[4:6]}-{day[6:]}', 'marketTop': market_top, 'holdings': holdings,
               'asOf': datetime.datetime.now().isoformat()}
    supa_req('POST', '/rest/v1/app_cache?on_conflict=key',
             [{'key': 'krx-short-daily', 'payload': payload, 'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'}],
             prefer='resolution=merge-duplicates')
    print(f'✅ Supabase 적재 완료: 시장Top {len(market_top)} · 보유 {len(holdings)}종목 · 기준일 {payload["date"]}')

if __name__ == '__main__':
    main()
