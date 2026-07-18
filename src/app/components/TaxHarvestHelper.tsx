'use client'
// 💸 연말 절세 도우미 — 올해 해외주식 확정 양도차익·250만 공제 게이지·예상 세금 + 손실 매도/공제 여유 익절 처방(거래 기록 탭)
//    ⛔ 자동매매 없음·세무 상담 아님(교육·참고). 계산은 /api/tax-helper 결정론(제2원칙: transactions·현재가 SSOT 재사용)
import { useEffect, useState } from 'react'
import type { TaxHelperResult } from '@/app/api/tax-helper/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const fmtW = (n: number) => {
  const v = Math.round(n), a = Math.abs(v)
  const s = a >= 1e8 ? `${(a / 1e8).toFixed(1)}억` : a >= 1e4 ? `${Math.round(a / 1e4).toLocaleString('ko-KR')}만` : a.toLocaleString('ko-KR')
  return `${v < 0 ? '−' : ''}₩${s}`
}

export default function TaxHarvestHelper() {
  const [data, setData] = useState<TaxHelperResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/tax-helper').then(r => r.ok ? r.json() : Promise.reject())
      .then(setData).catch(() => setErr(true))
  }, [])

  if (err) return <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>절세 도우미를 불러오지 못했습니다 — 새로고침해 주세요.</div>
  if (!data) return <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>💸 올해 실현 손익을 집계하는 중…</div>

  const d = data
  const pct = Math.min(100, Math.max(0, d.realizedUsKrw / d.deductionKrw * 100))
  const over = d.taxableKrw > 0
  const noActivity = d.usSellCount === 0 && d.realizedUsKrw === 0 && d.harvest.length === 0 && d.gainHarvest.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TK.slate200 }}>💸 {d.year}년 연말 절세 도우미</span>
        <span style={{ fontSize: 11.5, color: TK.sub4 }}>해외주식 양도세 손익통산 · 연말까지 <b style={{ color: TK.amber400 }}>D-{d.daysLeft}</b></span>
      </div>

      {/* KPI 4종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 4 }}>올해 확정 양도차익 (해외)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: d.realizedUsKrw >= 0 ? TK.red400 : TK.blue400 }}>{fmtW(d.realizedUsKrw)}</div>
          <div style={{ fontSize: 10.5, color: TK.sub2, marginTop: 3 }}>${d.realizedUsUsd.toLocaleString('en-US')} · 매도 {d.usSellCount}건 · 환율 {Math.round(d.usdKrw).toLocaleString()}원 환산(추정)</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 4 }}>기본공제 250만원 사용률</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: over ? TK.red400 : TK.green400 }}>{pct.toFixed(0)}%</div>
          <div style={{ height: 7, borderRadius: 4, background: TK.bg2, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: over ? TK.red400 : TK.green400, transition: 'width .4s' }} />
          </div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 4 }}>예상 세금 (초과분 × 22%)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: d.estTaxKrw > 0 ? TK.red400 : TK.slate200 }}>{fmtW(d.estTaxKrw)}</div>
          {d.taxableKrw > 0 && <div style={{ fontSize: 10.5, color: TK.sub2, marginTop: 3 }}>과세표준 {fmtW(d.taxableKrw)}</div>}
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 4 }}>남은 비과세 이익 실현 여유</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: d.roomKrw > 0 ? TK.green400 : TK.sub4 }}>{fmtW(d.roomKrw)}</div>
          <div style={{ fontSize: 10.5, color: TK.sub2, marginTop: 3 }}>이만큼은 익절해도 세금 0</div>
        </div>
      </div>

      {noActivity && (
        <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>
          올해 이 앱에 기록된 해외주식 매도가 없습니다 — 매도를 기록하면 확정 손익·절세 기회가 자동 집계됩니다.
        </div>
      )}

      {/* 🔻 절세 매도 후보 (세금 발생 시) */}
      {over && d.harvest.length > 0 && (
        <div style={{ ...CARD, border: `1px solid ${TK.red400}55` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TK.red400, marginBottom: 4 }}>🔻 절세 매도 후보 — 손실 {fmtW(d.taxableKrw)}만 실현하면 올해 세금 0원</div>
          <div style={{ fontSize: 11.5, color: TK.sub4, marginBottom: 10 }}>
            한국 해외주식 양도세엔 워시세일 규정이 없어 <b style={{ color: TK.slate200 }}>매도 직후 재매수해 포지션을 유지하면서 손실만 실현</b>할 수 있습니다
            (재매수하면 취득가가 리셋돼 미래 양도차익은 커집니다 — 손절 강요가 아니라 세금 관점 참고).
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: TK.sub4, fontSize: 11 }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>종목</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>보유·평단→현재</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>평가손실</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>전량 매도 시 절약</th>
            </tr></thead>
            <tbody>
              {d.harvest.map(h => (
                <tr key={h.ticker} style={{ borderTop: `1px solid ${TK.border}` }}>
                  <td style={{ padding: '7px 6px', color: TK.slate200, fontWeight: 700 }}>{h.name} <span style={{ color: TK.sub2, fontSize: 10.5, fontFamily: 'monospace' }}>{h.ticker}</span></td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.sub4, fontSize: 11.5 }}>{h.quantity}주 · ${h.avgPrice}→${h.curPrice}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.blue400, fontWeight: 700 }}>{fmtW(h.unrealizedKrw)}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.green400, fontWeight: 800 }}>{fmtW(h.saveKrw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {over && d.harvest.length === 0 && (
        <div style={{ ...CARD, fontSize: 12.5, color: TK.sub4 }}>
          예상 세금 {fmtW(d.estTaxKrw)} — 현재 보유 해외주식 중 손실 종목이 없어 상계할 카드가 없습니다(이익만 있는 해 = 좋은 문제).
        </div>
      )}

      {/* 🟢 공제 여유 익절 (여유 남을 때) */}
      {!over && d.roomKrw > 0 && d.gainHarvest.length > 0 && (
        <div style={{ ...CARD, border: `1px solid ${TK.green400}55` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TK.green400, marginBottom: 4 }}>🟢 공제 여유 {fmtW(d.roomKrw)} 활용 — 익절 후 재매수로 취득가 올리기</div>
          <div style={{ fontSize: 11.5, color: TK.sub4, marginBottom: 10 }}>
            여유 한도 안에서 이익을 실현하면 <b style={{ color: TK.slate200 }}>세금 0원으로 취득가를 현재가로 리셋</b> — 미래에 팔 때 낼 세금이 최대 {fmtW(Math.round(d.roomKrw * 0.22))} 줄어드는 효과입니다(매도 후 즉시 재매수 가능).
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: TK.sub4, fontSize: 11 }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>종목</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>주당 이익</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>여유 내 매도 가능</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>활용 금액</th>
            </tr></thead>
            <tbody>
              {d.gainHarvest.map(g => (
                <tr key={g.ticker} style={{ borderTop: `1px solid ${TK.border}` }}>
                  <td style={{ padding: '7px 6px', color: TK.slate200, fontWeight: 700 }}>{g.name} <span style={{ color: TK.sub2, fontSize: 10.5, fontFamily: 'monospace' }}>{g.ticker}</span></td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.red400 }}>{fmtW(g.perShareGainKrw)}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.slate200, fontWeight: 700 }}>{g.maxQty}주</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: TK.green400, fontWeight: 800 }}>{fmtW(g.useKrw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10.5, color: TK.sub2, marginTop: 8 }}>※ 각 행은 그 종목 <b>단독 실행 기준</b> — 여러 종목을 함께 익절할 땐 합산 이익이 여유 한도({fmtW(d.roomKrw)})를 넘지 않게 조절하세요.</div>
        </div>
      )}

      {/* 국내·코인 참고 */}
      {(d.krSellCount > 0 || d.cryptoSellCount > 0) && (
        <div style={{ ...CARD, fontSize: 11.5, color: TK.sub4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {d.krSellCount > 0 && <div>🇰🇷 국내 실현손익 <b style={{ color: d.realizedKrKrw >= 0 ? TK.red400 : TK.blue400 }}>{fmtW(d.realizedKrKrw)}</b> ({d.krSellCount}건) — 상장주식 소액주주 장내 매도는 <b style={{ color: TK.slate200 }}>비과세</b>(해외분과 통산 대상 아님)</div>}
          {d.krEtfSellCount > 0 && <div>⚠️ 국내 상장 해외/파생형 ETF 매도 {d.krEtfSellCount}건 포함 — 이 유형의 매매차익은 <b style={{ color: TK.slate200 }}>배당소득세 15.4%</b>가 원천징수로 별도 과세(손익통산 불가·금융소득종합과세 합산 대상)</div>}
          {d.cryptoSellCount > 0 && <div>🪙 코인 매도 {d.cryptoSellCount}건 — 가상자산 과세는 <b style={{ color: TK.slate200 }}>2027년으로 유예</b>(현재 비과세)</div>}
        </div>
      )}

      {/* 캐비엇 */}
      <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
        ⚠️ <b>이 앱에 기록된 거래 기준</b>의 추정치입니다 — 공제 250만원은 인별(전 계좌 합산)이라 앱 밖 계좌 실현손익이 있으면 달라집니다.
        세법상 환산은 매수·매도 각각의 <b>결제일 환율</b> 기준이라 현재 환율 일괄 환산(위 수치)과 다소 차이날 수 있습니다 — 실제 신고는 증권사 &lsquo;해외주식 양도소득 내역&rsquo;이 기준.
        과세연도 귀속은 <b>결제일(T+1)</b> 기준 — 연말 마지막 거래일 매도는 이듬해로 넘어갈 수 있으니 며칠 여유를 두세요.
        본 도우미는 교육·참고용이며 세무 상담이 아닙니다 · 자동 주문 없음.
      </div>
    </div>
  )
}
