'use client'
// 💰 부동산 세금 지도 — 살 때(취득세)·갖고 있을 때(종부세)·팔 때(양도세) 세율을 법령 원문 그대로
import { useState, useEffect } from 'react'
import type { ReTaxResult, TaxStage } from '@/app/api/re-tax/route'
import { parseTaxArticle } from '@/lib/taxParse'   // 📊 원문 → 구간·세율 표(적용 대상별로 전부)
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
              <div style={{ padding: '0 13px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {s.articles.map(a => {
                  const parsed = parseTaxArticle(a.text)
                  return (
                    <div key={a.no}>
                      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 6 }}>
                        제{a.no}조 {a.title}
                        {a.revised && <span style={{ color: TK.sub4 }}> · {a.revised}</span>}
                      </div>

                      {/* 📊 요약 — 적용 대상별로 **전부** 보여준다(하나만 골라 요약하면 오설명) */}
                      {parsed.groups.map((g, gi) => (
                        <div key={gi} style={{ marginBottom: 9 }}>
                          <div style={{ fontSize: FS.tiny, color: TK.amber400, fontWeight: 800, marginBottom: 5, lineHeight: 1.4 }}>
                            ▸ {g.title}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {g.rows.map((row, ri) => (
                              <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                background: ri % 2 ? 'transparent' : TK.bg1, borderRadius: 6, padding: '5px 10px' }}>
                                <span style={{ flex: 1, fontSize: FS.tiny, color: TK.slate300 }}>{row.band}</span>
                                {row.plus && <span style={{ fontSize: FS.micro, color: TK.sub3, fontFamily: 'monospace' }}>{row.plus}</span>}
                                <span style={{ fontSize: FS.tiny, fontWeight: 900, fontFamily: 'monospace', color: TK.amber400,
                                  minWidth: 52, textAlign: 'right' }}>{row.rate}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* ⚠️ 못 읽은 게 있으면 반드시 말한다 — 빠진 걸 '없는 것'으로 읽으면 오해가 커진다 */}
                      {parsed.partial && (
                        <div style={{ background: `${TK.orange400}14`, border: `1px solid ${TK.orange400}44`, borderRadius: 7,
                          padding: '7px 10px', fontSize: FS.micro, color: TK.orange400, lineHeight: 1.6, marginBottom: 8 }}>
                          ⚠️ 이 조문은 <b>별표·다른 법 참조</b>가 섞여 있어 위 요약에 <b>빠진 세율이 있습니다</b>
                          (예: 집을 사고팔 때의 주택 유상거래 세율). 아래 <b>원문</b>을 꼭 함께 보세요.
                        </div>
                      )}
                      {parsed.groups.length === 0 && (
                        <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 8 }}>
                          이 조문은 표로 정리하기 어려운 서식이라 원문으로만 제공합니다.
                        </div>
                      )}

                      {/* 📜 원문 — 요약을 학생이 직접 검증할 수 있게 접이식으로 함께 둔다 */}
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: FS.micro, color: TK.sub3 }}>📜 법령 원문 그대로 보기</summary>
                        <pre style={{
                          margin: '6px 0 0', padding: '9px 11px', background: TK.bg1, borderRadius: 7, border: `1px solid ${BORDER}`,
                          fontSize: FS.micro, color: TK.slate300, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', maxHeight: 320,
                        }}>{a.text}</pre>
                      </details>
                    </div>
                  )
                })}
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
        📊 위 요약은 <b>법령 원문에서 기계로 뽑은 것</b>입니다(사람이 옮겨 적지 않았습니다) — 각 조문의 <b>원문</b>을 접어서 함께 뒀으니 직접 확인하실 수 있어요.
        ⚠️ 세율은 <b>적용 대상마다 다릅니다</b> — 종부세만 해도 <b>2주택 이하 / 3주택 이상 / 법인</b>이 각각 다른 표예요. <b>▸ 로 시작하는 대상 문구</b>를 꼭 함께 보세요.
        <b>공제·감면·특례·지방소득세는 별도</b>라 실제 낼 세금과 다릅니다.
        ⛔ 개인 세액 계산은 하지 않습니다 — 정확한 금액은 <b>홈택스 모의계산</b>이나 <b>세무사</b>에게 확인하세요.
        {d.lawSample && <> ⚠️ 지금은 샘플 키로 조회 중입니다.</>}
      </div>
    </div>
  )
}
