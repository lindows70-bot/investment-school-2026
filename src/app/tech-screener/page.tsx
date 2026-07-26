'use client'
// 🔎 기술적 종목 검색기 — 증권사 검색기처럼 '지금 기술적 조건이 성립한 종목'을 찾는 화면.
//   ⭐ 차별점: 각 필터에 자체 백테스트 성적(초과수익·승률·표본)을 붙여 신호를 맹신하지 않게 한다.
//   ⛔ WHEN만 본다 — 마음에 드는 종목은 ①기술적 차트로 눈 확인 ②종합 매수 판정(펀더멘탈)으로 스스로 판단.
import { useEffect, useMemo, useState } from 'react'
import type { TechScreenerApi } from '@/app/api/tech-screener/route'
import type { ScreenHit } from '@/lib/techScreener'
import { TK, FS } from '@/lib/theme'
import { sectorMeta } from '@/lib/gicsSectorMeta'

const CARD = TK.bg6, BORDER = TK.border
const pct = (v: number | null, d = 1) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`
const pcol = (v: number | null) => v == null ? TK.sub : v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.slate300
const LIGHT: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

type SortKey = 'rank' | 'ret1m' | 'ret1w' | 'hi52' | 'rsi'

export default function TechScreenerPage() {
  const [data, setData] = useState<TechScreenerApi | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set(['prime']))   // 기본 = 백테스트 1위
  const [mk, setMk] = useState<'ALL' | 'US' | 'KR'>('ALL')
  const [sort, setSort] = useState<SortKey>('rank')
  const [hideKnife, setHideKnife] = useState(true)
  const [hideChoppy, setHideChoppy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/tech-screener', { cache: 'no-store' })
        const j = await r.json()
        if (!alive) return
        if (j.error) { setErr(j.note ?? '데이터를 불러오지 못했습니다.'); return }
        setData(j)
      } catch { if (alive) setErr('데이터를 불러오지 못했습니다.') }
    })()
    return () => { alive = false }
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    let h = data.hits
    if (sel.size > 0) h = h.filter(x => x.setups.some(k => sel.has(k)))
    if (mk !== 'ALL') h = h.filter(x => x.market === mk)
    if (hideKnife) h = h.filter(x => !x.knife)
    if (hideChoppy) h = h.filter(x => !x.choppy)
    const key = (x: ScreenHit) => sort === 'rank'
      ? (x.setups.includes('prime') ? 1000 : 0) + x.setups.length * 10 + (x.momentumScore ?? 0) / 100
      : (x[sort] ?? -999)
    return [...h].sort((a, b) => key(b) - key(a))
  }, [data, sel, mk, sort, hideKnife, hideChoppy])

  const toggle = (k: string) => setSel(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0 40px' }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,rgba(124,58,237,0.15),${TK.bg3})`, border: `1px solid ${TK.violet400}55`, borderRadius: 12, padding: '13px 16px' }}>
        <div style={{ fontSize: FS.xl, fontWeight: 900, color: TK.slate100 }}>🔎 기술적 종목 검색기</div>
        <div style={{ fontSize: FS.tiny, color: TK.slate300, marginTop: 4, lineHeight: 1.6 }}>
          유니버스 <b>{data?.universe ?? '—'}종목</b>을 매일 스캔해 <b>지금 기술적 셋업이 성립한 종목</b>을 찾습니다.
          증권사 검색기와 다른 점은 <b style={{ color: TK.amber400 }}>각 필터의 자체 백테스트 성적</b>을 함께 보여준다는 것입니다 — 신호를 맹신하지 않기 위해서입니다.
        </div>
        <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 6, lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
          ⛔ 이 화면은 <b>WHEN(타이밍)</b>만 봅니다. <b>종목 선정(WHAT)은 펀더멘탈</b>이라 여기서 걸린 종목이 좋은 기업이라는 뜻이 아닙니다.
          마음에 드는 종목은 행을 눌러 <b>①기술적 차트</b>로 눈으로 확인하고 <b>②종합 매수 판정</b>에서 가치·퀄리티·수급을 직접 따져 스스로 결정하세요.
        </div>
      </div>

      {err && <div style={{ background: CARD, border: `1px solid ${TK.red400}55`, borderRadius: 10, padding: '14px 16px', fontSize: FS.body, color: TK.slate300 }}>{err}</div>}
      {!data && !err && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '18px', fontSize: FS.body, color: TK.sub2 }}>유니버스를 스캔하는 중입니다… (첫 조회는 시간이 걸릴 수 있습니다)</div>}

      {data && (
        <>
          {/* 셋업 필터 */}
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate200 }}>셋업 필터</span>
              <span style={{ fontSize: FS.micro, color: TK.sub2 }}>클릭해서 켜고 끄기 · 여러 개 선택하면 <b>하나라도 성립</b>한 종목이 나옵니다</span>
              <button onClick={() => setSel(new Set())} style={{ marginLeft: 'auto', fontSize: FS.micro, background: TK.bg3, color: TK.sub2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>전체 해제</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 7 }}>
              {data.setups.map(s => {
                const on = sel.has(s.key), n = data.counts[s.key] ?? 0
                return (
                  <button key={s.key} onClick={() => toggle(s.key)} title={s.desc + (s.note ? `\n\n${s.note}` : '')}
                    style={{ textAlign: 'left', cursor: 'pointer', background: on ? `${TK.violet400}22` : TK.bg3, border: `1px solid ${on ? TK.violet400 : BORDER}`, borderRadius: 9, padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: FS.tiny, fontWeight: 800, color: on ? TK.violet300 : TK.slate300 }}>{s.icon} {s.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: FS.micro, fontWeight: 800, color: n > 0 ? TK.amber400 : TK.sub3 }}>{n}종목</span>
                    </div>
                    <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 3, lineHeight: 1.45 }}>{s.desc}</div>
                    <div style={{ fontSize: FS.micro, marginTop: 4, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ color: (s.edge20 ?? 0) > 0 ? TK.green400 : TK.red400, fontWeight: 800 }}>초과수익 {pct(s.edge20, 2)}</span>
                      <span style={{ color: TK.sub }}>승률 {s.winRate?.toFixed(1) ?? '—'}%</span>
                      <span style={{ color: TK.sub3 }}>표본 {s.sample?.toLocaleString() ?? '—'}</span>
                    </div>
                    {s.note && <div style={{ fontSize: FS.micro, color: TK.amber500, marginTop: 3, lineHeight: 1.4 }}>{s.note}</div>}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: FS.micro, color: TK.sub8, marginTop: 8, lineHeight: 1.55 }}>
              ※ 초과수익 = 20거래일 뒤 수익률이 <b>전체 평균보다</b> 얼마나 높았는지(2026-07-26 자체 백테스트 · 60~120종목 · 12,594봉 · 워크포워드).
              승률 50%가 기준선입니다 — <b>어떤 기법도 승률로는 큰 우위가 없었습니다</b>. 2년 표본(상승장 우세)·거래비용 미반영이라 과최적화 여지가 있습니다.
            </div>
          </div>

          {/* 결과 */}
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
              <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate200 }}>검색 결과 <b style={{ color: TK.amber400 }}>{rows.length}종목</b></span>
              <span style={{ fontSize: FS.micro, color: TK.sub2 }}>스캔 {data.scanned}/{data.universe}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['ALL', 'US', 'KR'] as const).map(m => (
                  <button key={m} onClick={() => setMk(m)} style={{ fontSize: FS.micro, fontWeight: 700, cursor: 'pointer', background: mk === m ? TK.violet400 : TK.bg3, color: mk === m ? TK.bg1 : TK.sub2, border: `1px solid ${mk === m ? TK.violet400 : BORDER}`, borderRadius: 6, padding: '3px 9px' }}>
                    {m === 'ALL' ? '전체' : m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
                  </button>
                ))}
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                  style={{ fontSize: FS.micro, background: TK.bg3, color: TK.slate200, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 7px' }}>
                  <option value="rank">추천 순(셋업 수·정예 우선)</option>
                  <option value="ret1m">1개월 수익률</option>
                  <option value="ret1w">1주 수익률</option>
                  <option value="hi52">52주 고점 근접</option>
                  <option value="rsi">RSI</option>
                </select>
                <label style={{ fontSize: FS.micro, color: TK.sub2, display: 'inline-flex', gap: 3, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hideKnife} onChange={e => setHideKnife(e.target.checked)} />🔪 칼날 제외
                </label>
                <label style={{ fontSize: FS.micro, color: TK.sub2, display: 'inline-flex', gap: 3, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hideChoppy} onChange={e => setHideChoppy(e.target.checked)} />⬛ 약한 추세 제외
                </label>
              </div>
            </div>

            {rows.length === 0 ? (
              <div style={{ fontSize: FS.body, color: TK.sub2, padding: '16px 4px', lineHeight: 1.7 }}>
                선택한 조건에 맞는 종목이 없습니다. 셋업을 더 켜거나 필터를 완화해 보세요.
                <div style={{ fontSize: FS.micro, color: TK.sub8, marginTop: 5 }}>정예 타점처럼 희소한 셋업은 하루에 몇 종목만 걸립니다(성립률 약 1~5%) — 안 뜨는 게 정상입니다.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS.tiny }}>
                  <thead>
                    <tr style={{ color: TK.sub, fontSize: FS.micro }}>
                      {['종목', '섹터', '성립 셋업', '신호등', '현재가', '1주', '1개월', '52주위치', 'RSI', 'ADX', 'PEG', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i >= 4 && i <= 10 ? 'right' : 'left', padding: '4px 7px', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 120).map(h => {
                      const sm = sectorMeta(h.sector)
                      return (
                        <tr key={`${h.market}:${h.ticker}`} style={{ borderBottom: `1px solid ${TK.bg3}` }}>
                          <td style={{ padding: '6px 7px', color: TK.slate200, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {h.name}<span style={{ fontSize: FS.micro, color: TK.sub8, fontWeight: 400 }}> {h.ticker}</span>
                            {h.knife && <span title="떨어지는 칼날 — 급락+하락추세" style={{ marginLeft: 4 }}>🔪</span>}
                          </td>
                          <td style={{ padding: '6px 7px', color: TK.sub2, whiteSpace: 'nowrap', fontSize: FS.micro }}>
                            {sm ? `${sm.icon} ${sm.ko}` : (h.industry ?? '—')}
                          </td>
                          <td style={{ padding: '6px 7px' }}>
                            <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
                              {h.setups.filter(k => sel.size === 0 || sel.has(k)).concat(h.setups.filter(k => sel.size > 0 && !sel.has(k))).slice(0, 4).map(k => {
                                const m = data.setups.find(s => s.key === k)
                                const hot = k === 'prime'
                                return <span key={k} title={m?.desc} style={{ fontSize: FS.micro, fontWeight: hot ? 900 : 700, color: hot ? TK.bg1 : TK.violet300, background: hot ? TK.amber500 : `${TK.violet400}22`, border: `1px solid ${hot ? TK.amber500 : TK.violet400 + '55'}`, borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap' }}>{m?.icon}{m?.label}</span>
                              })}
                              {h.setups.length > 4 && <span style={{ fontSize: FS.micro, color: TK.sub3 }}>+{h.setups.length - 4}</span>}
                            </span>
                          </td>
                          <td style={{ padding: '6px 7px', whiteSpace: 'nowrap' }}>{h.light ? LIGHT[h.light] : '—'}{h.choppy && <span title="추세 강도 약함(ADX<20) — 가짜 돌파 주의"> ⬛</span>}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: TK.slate300 }}>{h.price != null ? (h.market === 'KR' ? `₩${Math.round(h.price).toLocaleString()}` : h.price.toLocaleString(undefined, { maximumFractionDigits: 2 })) : '—'}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: pcol(h.ret1w) }}>{pct(h.ret1w)}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: pcol(h.ret1m), fontWeight: 700 }}>{pct(h.ret1m)}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: (h.hi52 ?? 0) >= 98 ? TK.amber400 : TK.sub2 }}>{h.hi52 != null ? `${h.hi52.toFixed(0)}%` : '—'}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: (h.rsi ?? 50) >= 70 ? TK.red400 : (h.rsi ?? 50) <= 30 ? TK.sky400 : TK.sub2 }}>{h.rsi ?? '—'}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: TK.sub2 }}>{h.adx ?? '—'}</td>
                          <td style={{ padding: '6px 7px', textAlign: 'right', fontFamily: 'monospace', color: TK.sub2 }}>{h.peg != null ? h.peg.toFixed(2) : '—'}</td>
                          <td style={{ padding: '6px 7px', whiteSpace: 'nowrap' }}>
                            <a href={`/tech-chart?ticker=${encodeURIComponent(h.ticker)}&market=${h.market}`} style={{ fontSize: FS.micro, fontWeight: 700, color: TK.violet300, textDecoration: 'none', background: `${TK.violet400}18`, border: `1px solid ${TK.violet400}44`, borderRadius: 5, padding: '2px 6px' }}>📉 차트</a>
                            <a href={`/research?q=${encodeURIComponent(h.ticker)}`} style={{ marginLeft: 4, fontSize: FS.micro, fontWeight: 700, color: TK.amber400, textDecoration: 'none', background: `${TK.amber500}18`, border: `1px solid ${TK.amber500}44`, borderRadius: 5, padding: '2px 6px' }}>🎯 정성분석</a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > 120 && <div style={{ fontSize: FS.micro, color: TK.sub8, marginTop: 6 }}>상위 120종목만 표시합니다({rows.length}종목 중). 셋업을 좁히면 정확도가 올라갑니다.</div>}
              </div>
            )}
          </div>

          {/* 사용법 */}
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate200, marginBottom: 7 }}>🎓 이 검색기를 쓰는 법</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8 }}>
              {[
                { n: '①', t: '셋업으로 후보를 좁힌다', b: '초과수익이 높은 셋업부터 켜 보세요. 다만 표본이 작은 셋업(엘리펀트 바 182건)은 우연일 수 있어 표본 수를 함께 봐야 합니다.' },
                { n: '②', t: '차트로 눈으로 확인한다', b: '📉 차트를 눌러 실제 모양을 봅니다. 숫자가 좋아도 차트가 이상하면 넘기세요 — 판독기가 3대 함정(휩쏘·칼날·조기청산)을 짚어줍니다.' },
                { n: '③', t: '정성분석으로 스스로 결정한다', b: '🎯 정성분석에서 종합 매수 판정(가치·퀄리티·모멘텀·주도섹터·수급·계절 6축)과 해자·경쟁사·역-DCF를 확인합니다. 여기가 진짜 판단 지점입니다.' },
                { n: '④', t: '수량·손절을 먼저 정한다', b: '살 종목을 정했다면 통합추천의 매매 플랜 카드에서 1% 리스크 룰로 수량과 손절선을 계산하세요. 손익비가 안 맞으면 좋은 자리가 아닙니다.' },
              ].map(x => (
                <div key={x.n} style={{ background: TK.bg3, borderRadius: 9, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${TK.violet400}`, padding: '8px 11px' }}>
                  <div style={{ fontSize: FS.tiny, fontWeight: 800, color: TK.violet300 }}>{x.n} {x.t}</div>
                  <div style={{ fontSize: FS.micro, color: TK.sub2, lineHeight: 1.55, marginTop: 3 }}>{x.b}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: FS.micro, color: TK.sub8, marginTop: 8, lineHeight: 1.6 }}>
              ⚠️ 기술적 신호는 <b>추천 점수·선정에 반영하지 않습니다</b>(WHAT은 펀더멘탈, WHEN은 기술). 이 화면은 후보를 <b>찾아주는</b> 도구이고,
              사는 판단과 책임은 본인에게 있습니다. 교육용이며 투자 권유가 아닙니다.
              <br />※ 유니버스는 앱의 공용 스크리너 종목(통합추천·리밸런싱과 동일)이며 매일 1회 갱신됩니다. 상장 130봉 미만 신생 종목은 판정을 생략합니다.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
