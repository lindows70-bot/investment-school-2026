'use client'
// 🎯 스윙 타점 — 1~2주 단기 매매. **대부분의 날은 비어 있는 화면**이다(647종 스캔에 1건).
//   그래서 목록이 아니라 "오늘 자리가 있나/없나"를 먼저 답하고, 없으면 그 이유를 말한다.
//   ⛔ 자동매매 없음 · ⛔ 목표 수익률 약속 없음 — edge 는 전부 '시장 대비'다.
import { useEffect, useState } from 'react'
import type { SwingRadar, SwingItem } from '@/lib/swingRadar'
import { SWING_TRACKS, positionSize, SWING_RISK_PCT, SWING_BEST_REF, type SwingRegime } from '@/lib/swingSetup'
import { SWING_MIN_SAMPLE, type SwingGrade } from '@/lib/swingHistory'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
const REGIME_KO: Record<SwingRegime, string> = { up: '상승', down: '하락', flat: '중립' }
const REGIME_C: Record<SwingRegime, string> = { up: TK.green400, down: TK.orange400, flat: TK.sub3 }

export default function SwingPage() {
  const [d, setD] = useState<SwingRadar | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [equity, setEquity] = useState(10_000_000)

  useEffect(() => {
    let alive = true
    fetch('/api/swing-radar', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setErr(j.note ?? j.error); else setD(j) })
      .catch(() => { if (alive) setErr('스윙 레이더를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.') })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ padding: '20px 22px', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SP.md }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,${TK.bg2},${TK.bg1})`, border: `1px solid ${TK.green400}33`, borderRadius: RAD.md, padding: '16px 18px' }}>
        <div style={{ fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>🎯 스윙 타점 — 1~2주 짧게 먹고 나오기</div>
        <div style={{ fontSize: FS.tiny, color: TK.sub, marginTop: 4, lineHeight: 1.6 }}>
          중장기 원칙은 그대로 두고, <b style={{ color: TK.green400 }}>국면이 맞을 때만</b> 짧게 들어가는 별도 트랙입니다.
          우리 백테스트(KR40+US40·5년)가 <b>살아남는다고 확인한 두 가지</b>만 씁니다 —
          <b> 눌림목을 기다리는 형태는 세 번 재서 세 번 다 손해</b>라 넣지 않았습니다.
        </div>
      </div>

      {err && (
        <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub2 }}>⚠️ {err}</div>
      )}
      {!d && !err && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.sm, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>스윙 자리를 훑는 중…</div>
      )}

      {d && (
        <>
          {/* 🚦 국면 신호등 — 이 화면의 첫 질문에 답한다 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, marginBottom: 8 }}>🚦 지금 어느 기법의 자리인가</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: SP.sm }}>
              {Object.values(SWING_TRACKS).map(t => {
                const st = d.tracks.find(x => x.key === t.key)
                const idx = t.market === 'KR' ? d.indexRegime.KR : d.indexRegime.US
                const on = st?.on ?? false
                return (
                  <div key={t.key} style={{ background: on ? `${TK.green400}12` : TK.bg3, border: `1px solid ${on ? `${TK.green400}55` : BORDER}`, borderRadius: RAD.sm, padding: '11px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: FS.body }}>{t.icon}</span>
                      <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>{t.label}</b>
                      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{t.market === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'} · {REGIME_KO[t.regime]}장</span>
                      <span style={{ marginLeft: 'auto', fontSize: FS.micro, fontWeight: 800, color: on ? TK.green400 : TK.sub3 }}>{on ? '자리 있음' : '대기'}</span>
                    </div>
                    <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 5, lineHeight: 1.55 }}>{t.note}</div>
                    <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: 5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      시장 대비 <b style={{ color: TK.green400 }}>+{t.edgePp}%p</b> · 승률 {t.winRate}% · 표본 {t.sample}건 · 보유 {t.holdLabel}
                    </div>
                    <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: 4 }}>
                      지금 지수: <b style={{ color: idx ? REGIME_C[idx] : TK.sub3 }}>{idx ? `${REGIME_KO[idx]}장` : '확인 못 함'}</b>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 🎯 오늘의 자리 — 없는 게 기본이다 */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>🎯 오늘의 자리</span>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{d.scanned}종 스캔 · 캔들 확보 {d.okCount}종</span>
              {d.cappedOut > 0 && (
                <span style={{ fontSize: FS.micro, color: TK.amber400 }}>
                  🧢 {d.cappedOut}건은 하루 상한(3건)에 걸려 뺐습니다 — 같은 장세에 여러 건은 분산이 아니라 같은 베팅의 반복이라서요
                </span>
              )}
            </div>

            {d.items.length === 0 ? (
              // ⚠️ 빈 화면이 이 기능의 기본값이다 — "없다"를 사실로 말하고 이유를 붙인다(억지로 채우면 유튜브가 된다)
              <div style={{ background: TK.bg3, border: `1px dashed ${BORDER}`, borderRadius: RAD.sm, padding: '16px 14px' }}>
                <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate300 }}>오늘은 자리가 없습니다</div>
                <div style={{ fontSize: FS.tiny, color: TK.sub2, marginTop: 6, lineHeight: 1.7 }}>
                  이건 고장이 아니라 <b>정상</b>입니다. 진입 조건이 &ldquo;오늘 처음 그 선을 되찾는 날&rdquo;이라 종목당 몇 달에 한 번 나옵니다
                  (백테스트에서도 5년·80종에 419건 — <b>종목당 연 1회꼴</b>).
                  <b> 기다리는 것이 이 기법의 일부</b>입니다.
                </div>
                <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {d.tracks.map(t => (
                    <div key={t.key} style={{ fontSize: FS.micro, color: TK.sub3 }}>
                      {SWING_TRACKS[t.key].icon} <b style={{ color: TK.sub2 }}>{SWING_TRACKS[t.key].label}</b> — {t.why}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
                {d.items.map(it => <SwingCard key={`${it.track}:${it.ticker}`} it={it} equity={equity} usdKrw={d.usdKrw} />)}
              </div>
            )}
          </div>

          {/* 📋 앱이 추천한 것의 실제 성적 — 승률을 보여주려면 개별 건도 함께 보여야 믿는다 */}
          <SwingRecord d={d} />

          {/* 💰 포지션 계산기 — 자리가 없는 날에도 쓰는 유일한 도구라 상시 노출 */}
          <div style={{ background: CARD, border: `1px solid ${TK.indigo400}33`, borderRadius: RAD.md, padding: '14px 16px' }}>
            <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>💰 얼마나 살까 — 잃을 금액부터 정합니다</div>
            <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 4, lineHeight: 1.6 }}>
              수량을 먼저 정하지 않습니다. <b>한 번에 잃어도 되는 금액</b>(자산의 {SWING_RISK_PCT}%)을 정하고,
              손절까지의 거리로 나눠 수량을 역산합니다 — <b>손절폭이 넓은 종목은 자동으로 적게 사게</b> 됩니다.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: FS.tiny, color: TK.sub2 }}>내 투자금</span>
              <input type="number" value={equity} onChange={e => setEquity(Math.max(0, Number(e.target.value) || 0))}
                style={{ background: TK.bg0, border: `1px solid ${BORDER}`, borderRadius: RAD.xs, padding: '6px 10px', color: TK.slate100, fontSize: FS.tiny, width: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>원 · 한 번에 잃을 금액 <b style={{ color: TK.orange400 }}>{Math.round(equity * SWING_RISK_PCT / 100).toLocaleString()}원</b></span>
            </div>
          </div>

          {/* 캐비엇 */}
          <div style={{ fontSize: FS.micro, color: TK.sub4, lineHeight: 1.75 }}>
            ⚠️ 위 <b>+%p는 &lsquo;시장 대비&rsquo;</b>입니다 — 같은 기간 시장이 0.8% 오를 때 그보다 그만큼 더 났다는 뜻이지,
            5~20% 수익을 뜻하지 않습니다. 승률·표본은 <b>그 표본·그 국면의 기록</b>이며 다음 거래를 보장하지 않습니다.
            <b> 세금·수수료·슬리피지는 반영돼 있지 않습니다</b>(단기매매에서 이 비용이 성적을 크게 깎습니다).
            ⛔ 체결·주문은 하지 않습니다 · ⛔ 손실 종목에 추가 매수(물타기)를 권하지 않습니다 · 교육용이며 투자 추천이 아닙니다.
          </div>
        </>
      )}
    </div>
  )
}

function SwingCard({ it, equity, usdKrw }: { it: SwingItem; equity: number; usdKrw: number }) {
  const t = SWING_TRACKS[it.track]
  // 💱 **투자금을 종목 통화로 맞춘 뒤** 수량을 낸다 — 원화를 달러 주가로 나누면
  //    1천만원으로 172만 달러를 사라는 값이 나온다(화면검증에서 실제로 나왔다).
  const isKr = it.market === 'KR'
  const eqLocal = isKr ? equity : (usdKrw > 0 ? equity / usdKrw : 0)
  const ps = eqLocal > 0 ? positionSize(eqLocal, it.price, it.stop) : null
  const cur = isKr ? '₩' : '$'
  const fmt = (n: number) => isKr ? Math.round(n).toLocaleString() : n.toFixed(2)
  const money = (n: number) => isKr ? `${Math.round(n).toLocaleString()}원` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  return (
    <div style={{ background: TK.bg3, border: `1px solid ${TK.green400}44`, borderRadius: RAD.sm, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.tiny }}>{it.flag}</span>
        <b style={{ fontSize: FS.body, color: TK.slate100 }}>{it.name}</b>
        <span style={{ fontSize: FS.micro, color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{it.ticker}</span>
        {it.sector && <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{it.sector}</span>}
        <span style={{ marginLeft: 'auto', fontSize: FS.micro, fontWeight: 800, color: TK.green400 }}>{t.icon} {t.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 10 }}>
        <Cell label="지금 가격" value={`${cur}${fmt(it.price)}`} />
        <Cell label="손절선" value={`${cur}${fmt(it.stop)}`} sub={`−${it.stopPct}%`} c={TK.orange400} />
        <Cell label="보유 기간" value={t.holdLabel} sub={`${t.holdBars}거래일`} />
        <Cell label="이 기법 성적" value={`+${t.edgePp}%p`} sub={`승률 ${t.winRate}% · ${t.sample}건`} c={TK.green400} />
      </div>

      {ps ? (
        <div style={{ marginTop: 9, background: TK.bg0, borderRadius: RAD.xs, padding: '8px 11px', fontSize: FS.micro, color: TK.sub2, lineHeight: 1.6 }}>
          💰 투자금 {equity.toLocaleString()}원 기준 — <b style={{ color: TK.slate200 }}>{ps.qty.toLocaleString()}주</b>
          <span style={{ color: TK.sub3 }}> (약 {money(ps.positionValue)}
            {!isKr && <> · 원화로 약 {Math.round(ps.positionValue * usdKrw).toLocaleString()}원</>}
            {' '}· 손절 시 손실 {money(ps.riskAmount)}{ps.capped ? '' : ` = 투자금의 ${SWING_RISK_PCT}%`})</span>
          {!isKr && <span style={{ color: TK.sub4 }}> · 환율 ₩{Math.round(usdKrw).toLocaleString()} 적용</span>}
          {ps.capped && (
            <div style={{ color: TK.amber400, marginTop: 3 }}>
              🧢 손절폭이 좁아 수량이 커질 자리라, <b>한 종목 상한(투자금의 20%)</b>으로 잘랐습니다 — 몰빵 방지.
            </div>
          )}
          {/* 📊 기대치 현실 — "10% 이상"이 얼마나 나오는지 실측 그대로 */}
          <div style={{ color: TK.sub3, marginTop: 3 }}>
            📊 과거 이 자리 10번 중 — <b>+5% 이상 약 {Math.round(t.ge5Rate / 10)}번</b> · <b>+10% 이상 약 {Math.round(t.ge10Rate / 10)}번</b> · 절반은 ±{Math.abs(t.medPct).toFixed(1)}% 근처에서 끝났습니다.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 9, fontSize: FS.micro, color: TK.sub3 }}>
          💰 지금 투자금으로는 <b>한 주도 살 수 없는 자리</b>입니다 — 손절폭 대비 금액이 모자랍니다.
        </div>
      )}

      <SetupChart it={it} />

      <ul style={{ margin: '9px 0 0', paddingLeft: 17, fontSize: FS.micro, color: TK.sub2, lineHeight: 1.7 }}>
        {it.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <a href={`/research?q=${encodeURIComponent(it.ticker)}`}
          style={{ fontSize: FS.micro, fontWeight: 700, color: TK.amber400, textDecoration: 'none', background: `${TK.amber500}18`, border: `1px solid ${TK.amber500}44`, borderRadius: RAD.xs, padding: '3px 8px' }}>
          🎯 종합 판정으로 한 번 더 보기
        </a>
      </div>
    </div>
  )
}

/** 📉 자리 차트 — 최근 60일 **캔들**(증권사 차트 관례) 위에 진입·손절·기대선을 얹는다.
 *  🕯️ 색은 한국식: 빨강=상승·파랑=하락(앱 공통 규약 — '주가 등락'은 한국식).
 *  ⚠️ '익절선'은 백테스트가 잰 것이 아니다 — 백테스트는 **N거래일 뒤 종가**를 쟀다.
 *     그래서 목표선을 '반드시 도달하는 선'처럼 그리지 않고, 기대 폭을 **옅은 띠**로만 두고 라벨로 설명한다. */
function SetupChart({ it }: { it: SwingItem }) {
  const t = SWING_TRACKS[it.track]
  const cs = it.candles
  if (!cs || cs.length < 10) return null
  const target = it.price * (1 + t.edgePp / 100)
  const lo = Math.min(...cs.map(k => k.l), it.stop) * 0.995
  const hi = Math.max(...cs.map(k => k.h), target) * 1.005
  const W = 100, H = 44                      // viewBox 단위(반응형 — 실제 크기는 CSS가 정한다)
  const slot = W / cs.length
  const bw = Math.max(0.5, slot * 0.62)      // 몸통 폭
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H
  return (
    <div style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 130, display: 'block' }}>
        {/* 기대 폭 띠 — 도달을 약속하지 않는다는 뜻으로 옅게 */}
        <rect x={0} y={y(target)} width={W} height={Math.max(0.4, y(it.price) - y(target))} fill={TK.green400} opacity={0.10} />
        {/* 손절 아래 위험 구간 */}
        <rect x={0} y={y(it.stop)} width={W} height={Math.max(0.4, H - y(it.stop))} fill={TK.orange400} opacity={0.08} />
        {cs.map((k, i) => {
          const cx = i * slot + slot / 2
          const up = k.c >= k.o
          const col = up ? TK.red400 : TK.blue400            // 🇰🇷 빨강=상승·파랑=하락
          const bodyTop = y(Math.max(k.o, k.c)), bodyBot = y(Math.min(k.o, k.c))
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(k.h)} y2={y(k.l)} stroke={col} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
              <rect x={cx - bw / 2} y={bodyTop} width={bw} height={Math.max(0.35, bodyBot - bodyTop)}
                fill={up ? col : TK.bg1} stroke={col} strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
        {[[it.price, TK.amber400, '4 0'], [it.stop, TK.orange400, '3 2'], [target, TK.green400, '3 2']].map(([v, c, dash], i) => (
          <line key={`ln${i}`} x1={0} x2={W} y1={y(v as number)} y2={y(v as number)} stroke={c as string}
            strokeWidth={0.6} strokeDasharray={dash as string} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, fontSize: FS.micro }}>
        <span style={{ color: TK.amber400 }}>━ 지금 들어가는 자리</span>
        <span style={{ color: TK.orange400 }}>┅ 손절선(여기 깨지면 정리)</span>
        <span style={{ color: TK.green400 }}>┅ 기대 폭 <b>+{t.edgePp}%p</b></span>
        <span style={{ color: TK.sub4 }}>· 최근 60일 캔들(<span style={{ color: TK.red400 }}>빨강=상승</span>·<span style={{ color: TK.blue400 }}>파랑=하락</span>)</span>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub4, marginTop: 3, lineHeight: 1.5 }}>
        ⚠️ 초록 띠는 <b>목표가가 아니라 기대 폭</b>입니다 — 백테스트는 &ldquo;{t.holdLabel} 뒤 종가&rdquo;를 쟀지
        특정 가격 도달을 잰 게 아닙니다. <b>{t.holdBars}거래일이 지나면 도달 여부와 무관하게 정리</b>하는 방식입니다.
      </div>
    </div>
  )
}

/** 📋 누적 성적 — 승률만 크게 띄우면 못 믿는다. 표본·시점·개별 건을 함께 보여준다. */
function SwingRecord({ d }: { d: SwingRadar }) {
  const all = d.grades.find(g => g.track === 'all')
  if (!all) return null
  const started = all.firstDate
  return (
    <div style={{ background: CARD, border: `1px solid ${TK.indigo400}33`, borderRadius: RAD.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100 }}>📋 이 화면이 추천한 것의 실제 성적</span>
        <span style={{ fontSize: FS.micro, color: TK.sub3 }}>
          {started ? `${started}부터 적립 중` : '아직 추천 이력이 없습니다'} · 소급 채점 없음
        </span>
      </div>

      {all.n === 0 ? (
        <div style={{ marginTop: 8, fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7 }}>
          {all.pending > 0
            ? <>지금 <b>{all.pending}건</b>이 보유 기간을 채우는 중입니다 — 기간이 지나야 채점됩니다. <b>아직 숫자를 말할 수 없습니다.</b></>
            : <>아직 채점할 기록이 없습니다. 자리가 나오는 날부터 하나씩 쌓입니다.</>}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 10 }}>
            {d.grades.map(g => <GradeCell key={g.track} g={g} />)}
          </div>
          {all.thin && (
            <div style={{ marginTop: 8, background: `${TK.amber400}12`, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.xs, padding: '7px 10px', fontSize: FS.micro, color: TK.amber400, lineHeight: 1.6 }}>
              ⚠️ 아직 <b>통계로 볼 수준이 아닙니다</b> — {all.n < SWING_MIN_SAMPLE ? `${SWING_MIN_SAMPLE}건 이상` : '서로 다른 주(週) 2개 이상'}이 모여야 합니다
              (현재 {all.n}건 · {all.cohorts}개 주). 그때까지 이 숫자는 <b>참고용</b>입니다.
            </div>
          )}
        </>
      )}

      {/* 🔬 보유 기간 실험 — "얼마까지 가나"는 이 표가 데이터로 답한다(1주~1달 전 구간 동시 채점) */}
      <div style={{ marginTop: 12, background: TK.bg3, borderRadius: RAD.sm, padding: '10px 12px' }}>
        <div style={{ fontSize: FS.tiny, fontWeight: 800, color: TK.slate200 }}>🔬 보유 기간 실험 — 1주·2주·3주·1달을 전부 추적 중</div>
        {d.horizons.some(h => h.n > 0) ? (
          <div style={{ overflowX: 'auto', marginTop: 7 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: FS.micro, color: TK.sub2, minWidth: 420 }}>
              <thead><tr style={{ color: TK.sub4 }}>
                {['보유', '표본', '평균', '중위', '승률', '+5%↑', '+10%↑'].map(h => <th key={h} style={{ textAlign: 'right', padding: '3px 9px', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {d.horizons.map(h => (
                  <tr key={h.bars} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ textAlign: 'right', padding: '3px 9px', color: TK.slate300, fontWeight: 700 }}>{h.label}</td>
                    <td style={{ textAlign: 'right', padding: '3px 9px' }}>{h.n || '—'}</td>
                    {[h.avgPct, h.medPct].map((v, i) => <td key={i} style={{ textAlign: 'right', padding: '3px 9px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: v == null ? TK.sub4 : v > 0 ? TK.green400 : TK.orange400 }}>{v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`}</td>)}
                    {[h.winRate, h.ge5Rate, h.ge10Rate].map((v, i) => <td key={`p${i}`} style={{ textAlign: 'right', padding: '3px 9px' }}>{v == null ? '—' : `${v}%`}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {d.peak.n > 0 && (
              <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 6, lineHeight: 1.6 }}>
                🏔️ 보유 중 <b>최고점</b>(고가 기준·최대 1달): 평균 <b style={{ color: TK.green400 }}>+{d.peak.avgPct}%</b> · 중위 +{d.peak.medPct}%
                · +10% 터치 {d.peak.ge10Rate}% · 평균 <b>{d.peak.avgBar}일째</b>가 고점이었습니다 — 끝값과의 차이가 곧 &lsquo;매도 타이밍의 값&rsquo;입니다.
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 5, lineHeight: 1.7 }}>
            아직 1주가 안 지나 채점된 구간이 없습니다. 구간이 차는 대로 여기서 <b>최적 보유 기간이 데이터로 드러납니다</b>.
            <br />참고(백테스트 {SWING_BEST_REF.asOf} · 최적 시점 매도 <b>가정</b>의 상한): 회복 트랙 최고점 중위 +{SWING_BEST_REF.reversion.medBestPct}% · +10% 도달 {SWING_BEST_REF.reversion.ge10Rate}%({SWING_BEST_REF.reversion.sample}건) /
            추세 트랙 +{SWING_BEST_REF.trend.medBestPct}% · {SWING_BEST_REF.trend.ge10Rate}%({SWING_BEST_REF.trend.sample}건).
          </div>
        )}
      </div>

      {d.recent.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 5 }}>최근 추천 내역 — 승률만 보고 믿지 마시고 개별 건을 확인하세요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
            {d.recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', background: i % 2 ? 'transparent' : TK.bg3, borderRadius: RAD.xs, fontSize: FS.micro }}>
                <span style={{ color: TK.sub3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', minWidth: 66 }}>{r.date}</span>
                <span>{r.flag}</span>
                <span style={{ color: TK.slate300, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ color: TK.sub4 }}>{SWING_TRACKS[r.track].icon}</span>
                {r.stopHit && <span style={{ color: TK.orange400 }} title="보유 중 손절선을 건드렸습니다">🛡</span>}
                <span style={{ minWidth: 54, textAlign: 'right', fontWeight: 800, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  color: r.retPct == null ? TK.sub4 : r.retPct > 0 ? TK.green400 : TK.orange400 }}>
                  {r.retPct == null ? '진행 중' : `${r.retPct > 0 ? '+' : ''}${r.retPct}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GradeCell({ g }: { g: SwingGrade }) {
  const label = g.track === 'all' ? '전체' : SWING_TRACKS[g.track].label
  return (
    <div style={{ background: TK.bg3, borderRadius: RAD.sm, padding: '9px 11px' }}>
      <div style={{ fontSize: FS.micro, color: TK.sub3 }}>{g.track === 'all' ? '📋' : SWING_TRACKS[g.track].icon} {label}</div>
      {g.n === 0 ? (
        <div style={{ fontSize: FS.tiny, color: TK.sub4, marginTop: 3 }}>적립 중{g.pending > 0 && ` · ${g.pending}건 대기`}</div>
      ) : (
        <>
          <div style={{ fontSize: FS.lg, fontWeight: 900, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: g.thin ? TK.sub3 : (g.winRate ?? 0) >= 50 ? TK.green400 : TK.orange400 }}>
            {g.winRate}%
          </div>
          <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.5 }}>
            {g.n}건{g.pending > 0 && ` · ${g.pending} 대기`} · 평균 {g.avgPct}% · 중위 {g.medPct}%
            {g.stopHitRate != null && <> · 손절 터치 {g.stopHitRate}%</>}
            {/* PF = 총이익÷총손실 — 승률이 높아도 이게 1 아래면 지는 시스템이다(큰 손실이 다 까먹는 구조) */}
            {g.profitFactor != null && <> · 수익 인자 <b style={{ color: g.profitFactor >= 1.5 ? TK.green400 : g.profitFactor >= 1 ? TK.sub2 : TK.orange400 }}>{g.profitFactor}</b></>}
          </div>
        </>
      )}
    </div>
  )
}

function Cell({ label, value, sub, c }: { label: string; value: string; sub?: string; c?: string }) {
  return (
    <div style={{ background: TK.bg0, borderRadius: RAD.xs, padding: '7px 10px' }}>
      <div style={{ fontSize: FS.micro, color: TK.sub4 }}>{label}</div>
      <div style={{ fontSize: FS.tiny, fontWeight: 800, color: c ?? TK.slate200, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: FS.micro, color: TK.sub3 }}>{sub}</div>}
    </div>
  )
}
