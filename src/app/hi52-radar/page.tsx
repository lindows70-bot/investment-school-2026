'use client'
// 🐎 신고가 레이더 — '달리는 말에 올라타라'를 자체 백테스트로 판정한 화면.
//   결론: 말(추세)은 타되 **말이 숨 고를 때** 타라 — 갓 돌파(≥98%) 추격은 우리 표본에서 명확히 나빴다.
//   ⛔ hi52는 점수에 미반영(모집 필터·위치 라벨만). 판정은 기존 SSOT(신호등·정예 타점·유니버스 퀀트).
import { useEffect, useMemo, useState } from 'react'
import type { Hi52Radar, Hi52Item } from '@/lib/hi52Radar'
import { TK, FS } from '@/lib/theme'
import { sectorMeta } from '@/lib/gicsSectorMeta'
import { marketFlag } from '@/lib/globalTickers'

const CARD = TK.bg6, BORDER = TK.border
const ROT_CHIP: Record<string, { t: string; c: string }> = {
  leading: { t: '🌱 주도', c: TK.green400 }, improving: { t: '❄️ 태동', c: TK.cyan400 },
  weakening: { t: '🔥 과열', c: TK.orange400 }, lagging: { t: '🍂 이탈', c: TK.red400 },
}

function Spark({ v }: { v: number[] }) {
  if (!v || v.length < 5) return null
  const w = 86, h = 26, mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${h - ((x - mn) / rg) * (h - 3) - 1.5}`).join(' ')
  const up = v[v.length - 1] >= v[0]
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={up ? TK.green400 : TK.red400} strokeWidth="1.4" /></svg>
}

// 52주 위치 게이지 — 75(모집 하한)~100. 98 이상은 '갓 돌파' 존(주황)
function Hi52Gauge({ v }: { v: number }) {
  const p = Math.max(0, Math.min(100, (v - 75) / 25 * 100))
  const c = v >= 98 ? TK.orange400 : v >= 92 ? TK.amber400 : TK.green400
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 64, height: 6, background: TK.bg3, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <span style={{ position: 'absolute', left: `${(98 - 75) / 25 * 100}%`, top: 0, bottom: 0, width: 1, background: TK.sub2 }} />
        <span style={{ display: 'block', width: `${p}%`, height: '100%', background: c }} />
      </span>
      <b style={{ color: c, fontFamily: 'monospace', fontSize: FS.tiny }}>{v}%</b>
    </span>
  )
}

function Row({ it }: { it: Hi52Item }) {
  const rot = it.rotQuad ? ROT_CHIP[it.rotQuad] : null
  const sm = sectorMeta(it.sector)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', padding: '8px 2px', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12 }}>{marketFlag(it.ticker, it.market)}</span>
      <span style={{ color: TK.slate200, fontWeight: 800, fontSize: FS.body, minWidth: 90 }}>{it.market === 'KR' ? it.name.slice(0, 10) : it.ticker}</span>
      {sm && <span style={{ fontSize: FS.micro, color: sm.color, background: `${sm.color}16`, border: `1px solid ${sm.color}44`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{sm.icon} {sm.ko}</span>}
      {rot && <span style={{ fontSize: FS.micro, fontWeight: 700, color: rot.c }}>{rot.t}</span>}
      <Spark v={it.spark} />
      <Hi52Gauge v={it.hi52} />
      {/* 신호등 라벨은 SSOT 문자열 그대로(🟢 포함) — 이모지 char class 정규식은 서로게이트를 쪼개므로 가공하지 않는다 */}
      <span style={{ fontSize: FS.micro, color: TK.sub }}>{it.lightLabel}</span>
      {it.trigger && <span style={{ fontSize: FS.micro, fontWeight: 800, color: '#3a2c05', background: TK.amber400, borderRadius: 5, padding: '1px 7px' }}>{it.trigger === 'prime' ? '🏅 정예 타점' : '🎼 첫 눌림목'}</span>}
      {it.reasons.map((r, i) => <span key={i} style={{ fontSize: FS.micro, color: TK.orange400, background: `${TK.orange400}14`, border: `1px solid ${TK.orange400}44`, borderRadius: 5, padding: '1px 6px' }}>⏳ {r}</span>)}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {it.peg != null && it.peg > 0 && <span style={{ fontSize: FS.micro, color: it.peg <= 1 ? TK.blue400 : TK.sub, fontFamily: 'monospace' }}>PEG {it.peg.toFixed(2)}</span>}
        <span title="유니버스 퀀트 점수(가치·마진·FCF 합성 — 4계절 매수후보와 동일 SSOT). 신고가 여부와 무관한 펀더멘탈 참고값" style={{ fontSize: FS.micro, color: TK.slate300, fontFamily: 'monospace' }}>퀀트 <b style={{ color: it.quant >= 70 ? TK.green400 : it.quant >= 50 ? TK.amber400 : TK.sub }}>{it.quant}</b></span>
        <a href={`/tech-chart?ticker=${encodeURIComponent(it.ticker)}&market=${it.market}`} style={{ fontSize: FS.micro, fontWeight: 700, color: TK.violet300, textDecoration: 'none', background: `${TK.violet400}18`, border: `1px solid ${TK.violet400}44`, borderRadius: 5, padding: '2px 6px' }}>📉 차트</a>
        <a href={`/research?q=${encodeURIComponent(it.ticker)}`} style={{ fontSize: FS.micro, fontWeight: 700, color: TK.amber400, textDecoration: 'none', background: `${TK.amber500}18`, border: `1px solid ${TK.amber500}44`, borderRadius: 5, padding: '2px 6px' }}>🎯 종합 판정</a>
      </span>
    </div>
  )
}

function Group({ icon, title, sub, color, items, empty }: { icon: string; title: string; sub: string; color: string; items: Hi52Item[]; empty: string }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${color}44`, padding: '13px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ color, fontWeight: 800, fontSize: FS.lg }}>{title}</span>
        <span style={{ color: TK.sub, fontSize: FS.tiny }}>{sub}</span>
        <span style={{ marginLeft: 'auto', color: TK.slate400, fontWeight: 700, fontSize: FS.tiny }}>{items.length}종</span>
      </div>
      {items.length === 0
        ? <div style={{ color: TK.sub2, fontSize: FS.tiny, padding: '8px 0' }}>{empty}</div>
        : items.map(it => <Row key={`${it.ticker}:${it.market}`} it={it} />)}
    </div>
  )
}

export default function Hi52RadarPage() {
  const [data, setData] = useState<Hi52Radar | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mk, setMk] = useState<'ALL' | 'US' | 'KR'>('ALL')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/hi52-radar', { cache: 'no-store' })
        const j = await r.json()
        if (!alive) return
        if (j.error) { setErr(j.note ?? '데이터를 불러오지 못했습니다.'); return }
        setData(j)
      } catch { if (alive) setErr('데이터를 불러오지 못했습니다.') }
    })()
    return () => { alive = false }
  }, [])

  const f = useMemo(() => {
    const flt = (a: Hi52Item[]) => mk === 'ALL' ? a : a.filter(x => x.market === mk)
    return data ? { ride: flt(data.ride), wait: flt(data.wait), caution: flt(data.caution) } : null
  }, [data, mk])

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '15px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🐎</span>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: FS.h2 }}>신고가 레이더 — 달리는 말에 올라타라?</span>
          {data && <span style={{ color: TK.sub, fontSize: FS.tiny }}>52주 고점 75%+ {data.scanned}종 · 기준 {data.asOf}</span>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
            {(['ALL', 'US', 'KR'] as const).map(m => (
              <button key={m} onClick={() => setMk(m)} style={{ padding: '3px 11px', borderRadius: 6, cursor: 'pointer', fontSize: FS.tiny, fontWeight: 700, background: mk === m ? TK.blue500 : TK.bg3, color: mk === m ? '#fff' : TK.slate400, border: `1px solid ${mk === m ? TK.blue500 : BORDER}` }}>{m === 'ALL' ? '전체' : m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}</button>
            ))}
          </span>
        </div>
        <div style={{ color: TK.sub13, fontSize: FS.tiny, lineHeight: 1.6, marginTop: 6 }}>
          증권 격언을 자체 백테스트(84종목·2년·워크포워드)로 검증했습니다 — <b style={{ color: TK.slate300 }}>말(상승추세)은 맞고, 올라타는 순간(갓 돌파)은 틀렸습니다.</b>{' '}
          갓 신고가(98%+)에서 사면 3개월 중위 <b style={{ color: TK.red400 }}>−4.1%·승률 −6.8%p</b>(같은 표본 대비) — 반면 검증된 트리거(정예 타점·이상치 제거 후 <b style={{ color: TK.green400 }}>+1.8%p</b>)가 온 눌림 자리가 진짜 올라탈 곳입니다.
        </div>
        {data?.momCrash && (
          <div style={{ marginTop: 8, background: 'rgba(251,146,60,0.09)', border: `1px solid ${TK.orange400}55`, borderRadius: 8, padding: '7px 10px', color: TK.amber400, fontSize: FS.tiny, lineHeight: 1.5 }}>
            ⚠️ 지금은 <b>모멘텀 크래시 주의 국면</b>(승패 해부실 실측) — 낙폭과대주가 승자보다 더 오르는 반전 장이라, 달리는 말 추격이 가장 잘 무너지는 구간입니다. 분할·신중 진입을 권합니다.
          </div>
        )}
      </div>

      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 22, textAlign: 'center', color: TK.sub2 }}>{err}</div>}
      {!data && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 30, textAlign: 'center', color: TK.sub2 }}>🐎 신고가권 종목을 스캔 중입니다… (첫 로드는 1~2분)</div>}

      {f && (
        <>
          <Group icon="🎯" title="지금 올라탈 자리" color={TK.green400} items={f.ride}
            sub="상승 구조(green) + 검증 트리거(정예 타점·첫 눌림목) + 과열·급락 아님" empty="지금은 없습니다 — 억지로 채우지 않습니다. 말이 숨 고르기를 기다리세요." />
          <Group icon="🐎" title="달리는 중 — 눌림·트리거 대기" color={TK.blue400} items={f.wait}
            sub="관심 목록 — green 구조와 트리거(정예·첫 눌림목)가 모두 갖춰지면 위 그룹으로 올라옵니다" empty="해당 없음" />
          <Group icon="⏳" title="추격 주의" color={TK.orange400} items={f.caution}
            sub="갓 돌파·과대이격·에너지 소진·급락 — 우리 표본에서 나빴던 자리(사유 칩 참고)" empty="해당 없음" />
        </>
      )}

      {/* 정직 캐비엇 */}
      <div style={{ color: TK.sub2, fontSize: FS.micro, lineHeight: 1.7, padding: '0 4px' }}>
        ※ 백테스트: 84종목·약 2년·전방 60봉·비중복 샘플링·이상치 상하위 10% 제거 — 표본이 제한적이고 거래비용 미반영, 과거가 미래를 보장하지 않습니다.
        한국 표본은 2026 상반기 급등장에 의존적이라 국면이 바뀌면 결과가 달라질 수 있습니다. 신고가 근접의 겉보기 우위는 상당 부분 &lsquo;건강한 추세 효과&rsquo;였습니다(같은 추세 종목 대비로는 소멸) — 그래서 판정은 추세·트리거가 하고 신고가는 모집 라벨만 합니다.
        52주 위치는 일봉 고가 기준(로테이션 시계의 주봉 종가 기준과 소폭 다를 수 있음). 퀀트 점수는 4계절 매수후보와 동일 SSOT이며 신고가와 무관합니다. 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
