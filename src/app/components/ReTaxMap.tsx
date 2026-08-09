'use client'
// 💰 부동산 세금 지도 — 살 때(취득세)·갖고 있을 때(종부세)·팔 때(양도세) 세율을 법령 원문 그대로
import { useState, useEffect } from 'react'
import type { ReTaxResult, TaxStage } from '@/app/api/re-tax/route'
import { TK, FS } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s)

export default function ReTaxMap() {
  const [d, setD] = useState<ReTaxResult | null>(null)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<TaxStage['key'] | null>('hold')   // 요즘 관심 1순위가 보유세라 기본 펼침

  useEffect(() => {
    let alive = true
    fetch('/api/re-tax', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('http'); return r.json() })
      .then(j => { if (alive) setD(j) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  if (err) return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>
      💰 세금 지도를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.
    </div>
  )
  if (!d) return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>
      💰 부동산 세법 원문을 불러오는 중…
    </div>
  )

  return (
    <div style={{ background: CARD, border: `1px solid ${TK.amber400}33`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>💰 부동산 세금 지도</b>
        <span style={{ color: TK.sub2, fontSize: FS.micro }}>살 때 · 갖고 있을 때 · 팔 때 — 국가법령정보 <b>원문 그대로</b></span>
      </div>

      {/* ⚠️ 조회 실패를 조용히 넘기지 않는다 — 세목이 빠진 걸 학생이 '해당 세금 없음'으로 읽으면 안 된다 */}
      {d.failed.length > 0 && (
        <div style={{ background: TK.bg3, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '7px 11px', fontSize: FS.micro, color: TK.sub2 }}>
          ⚠️ {d.failed.join(' · ')} 조회 실패 — 그 세목은 지금 화면에 없습니다(세금이 없는 게 아닙니다).
        </div>
      )}

      {d.stages.map(s => {
        const on = open === s.key
        return (
          <div key={s.key} style={{ background: TK.bg3, border: `1px solid ${on ? `${TK.amber400}55` : BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setOpen(on ? null : s.key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 13px', textAlign: 'left' }}>
              <span style={{ fontSize: FS.body }}>{s.emoji}</span>
              <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>{s.label}</b>
              <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{s.lawName} · 시행 {ymd(s.effective)}</span>
              <span style={{ marginLeft: 'auto', fontSize: FS.micro, color: TK.amber400 }}>{on ? '▲ 접기' : '▼ 세율 보기'}</span>
            </button>
            <div style={{ padding: '0 13px 10px', fontSize: FS.micro, color: TK.sub2, lineHeight: 1.6 }}>{s.note}</div>

            {on && (
              <div style={{ padding: '0 13px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {s.articles.map(a => (
                  <div key={a.no}>
                    <div style={{ fontSize: FS.micro, color: TK.slate300, fontWeight: 700, marginBottom: 4 }}>
                      제{a.no}조 {a.title}
                      {a.revised && <span style={{ color: TK.sub4, fontWeight: 400 }}> · {a.revised}</span>}
                    </div>
                    {/* 📜 원문 그대로 — 박스 문자로 그려진 세율표가 표로 보인다. 가로 스크롤로 가둔다(본문이 밀리지 않게) */}
                    <pre style={{
                      margin: 0, padding: '9px 11px', background: TK.bg1, borderRadius: 7, border: `1px solid ${BORDER}`,
                      fontSize: FS.micro, color: TK.slate300, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', maxHeight: 360,
                    }}>{a.text}</pre>
                  </div>
                ))}
                <a href={s.link} target="_blank" rel="noreferrer"
                  style={{ fontSize: FS.micro, color: TK.amber400, textDecoration: 'none', fontWeight: 700 }}>
                  📜 {s.lawName} 전문 보기 (국가법령정보센터) →
                </a>
              </div>
            )}
          </div>
        )
      })}

      {/* 정직 캐비엇 — 세금은 틀리면 실질 피해다 */}
      <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.7 }}>
        📜 위 표는 <b>법령 원문 그대로</b>이며 앱이 요약·해석하지 않았습니다(조문 하나에 기본·중과·단기 세율이 섞여 있어
        골라 옮기면 오설명이 됩니다). <b>공제·감면·특례·지방소득세는 별도</b>라 실제 낼 세금과 다릅니다.
        ⛔ 개인 세액 계산은 하지 않습니다 — 정확한 금액은 <b>홈택스 모의계산</b>이나 <b>세무사</b>에게 확인하세요.
        {d.lawSample && <> ⚠️ 지금은 샘플 키로 조회 중입니다.</>}
      </div>
    </div>
  )
}
