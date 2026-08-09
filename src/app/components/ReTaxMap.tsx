'use client'
// 💰 부동산 세금 지도 — 집의 **생애주기**(살 때 한 번 / 가질 때 매년 / 팔 때 차익에)로 세금을 읽는다
//
// 왜 이 구조인가: 세금은 세목 이름이 아니라 **언제 무엇에 붙는가**로 이해된다. 앞면엔 그 세 가지만 두고,
// 조문 표는 눌렀을 때만 편다. 이전 버전은 법 조문을 그대로 펼쳐 "제94조제1항제4호다목에 따른 자산…"이
// 학생에게 그대로 노출됐다 — 읽을 수 없는 건 요약이 아니다.
import { useState, useEffect } from 'react'
import type { ReTaxResult, TaxStage } from '@/app/api/re-tax/route'
import { parseTaxArticle, cleanForStudents, rateRange, isDeduction, isSentenceTitle } from '@/lib/taxParse'
import { TK, FS } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}.${s.slice(4, 6)}` : s)

// 🎨 단계별 색 — 진입(파랑) → 보유(호박) → 실현(초록). 세금의 성격 차이를 색으로 encode 한다
const TONE: Record<TaxStage['key'], { c: string; when: string; what: string }> = {
  acquire: { c: TK.blue400, when: '한 번', what: '집값에' },
  hold: { c: TK.amber400, when: '매년', what: '공시가에' },
  transfer: { c: TK.green400, when: '팔 때', what: '차익에' },
}

// 💡 조문 한 줄 안내 — 제목만으론 무슨 표인지 모른다. 특히 제55조는 '종합소득' 세율표인데
//    양도세가 그대로 준용한다(제104조제1항제1호). 안내 없이 두면 학생이 남의 세금표로 읽는다.
const ARTICLE_HINT: Record<string, string> = {
  '55': '양도세 기본세율. 제104조가 이 표를 그대로 씁니다',
  '104': '기본세율 대신 이 세율이 붙는 경우(단기 보유·미등기 등)',
}

export default function ReTaxMap() {
  const [d, setD] = useState<ReTaxResult | null>(null)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<TaxStage['key'] | null>(null)

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
      💰 부동산 세법을 불러오는 중…
    </div>
  )

  // 조문을 학생이 읽을 수 있는 형태로 정리 + 카드 앞면 대표 숫자 계산
  const view = d.stages.map(s => {
    const arts = s.articles.map(a => ({ ...a, p: cleanForStudents(parseTaxArticle(a.text)) }))
    const rateRows = arts.flatMap(a => a.p.groups.filter(g => !isDeduction(g.title)).flatMap(g => g.rows))
    const anyPartial = arts.some(a => a.p.partial)
    // ⚠️ 못 읽은 게 있으면 대표 숫자를 **쓰지 않는다** — 취득세는 주택 유상거래(별표)가 빠져 있어
    //    남은 값(2.3~3.5%)을 크게 띄우면 "집 살 때 3.5%"라는 **틀린 인상**을 준다.
    const headline = anyPartial ? null : rateRange(rateRows)
    return { s, arts, headline, anyPartial }
  })

  return (
    <div style={{ background: CARD, border: `1px solid ${TK.amber400}33`, borderRadius: 14, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>💰 부동산 세금, 언제 얼마나 내나</b>
        <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 3 }}>
          집은 <b>살 때 한 번</b>, <b>갖고 있는 동안 매년</b>, <b>팔 때 차익에</b> 세금이 붙습니다. 카드를 누르면 세율표가 열려요.
        </div>
      </div>

      {/* 🧭 생애주기 3단계 — 세금의 성격 차이(언제·무엇에)를 앞면에 둔다 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
        {view.map(({ s, headline, anyPartial }) => {
          const t = TONE[s.key]
          const on = open === s.key
          return (
            <button key={s.key} onClick={() => setOpen(on ? null : s.key)}
              style={{
                textAlign: 'left', cursor: 'pointer', background: on ? `${t.c}14` : TK.bg3,
                border: `1px solid ${on ? `${t.c}77` : BORDER}`, borderRadius: 11, padding: '11px 13px',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: FS.body }}>{s.emoji}</span>
                <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>{s.label.replace(/^.*— /, '')}</b>
                <span style={{ marginLeft: 'auto', fontSize: FS.micro, color: t.c, fontWeight: 800 }}>{on ? '접기 ▲' : '세율 ▼'}</span>
              </div>
              {/* 대표 숫자 — 카드에서 가장 크게. 한 숫자로 못 줄이는 세목은 표로 안내한다
                  (종부세는 주택분·토지분이, 양도세는 기본세율·중과세율이 한 카드에 섞인다) */}
              <div style={{
                fontSize: headline ? FS.xl : FS.lg, fontWeight: 900, lineHeight: 1.15,
                fontFamily: headline ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
                color: headline ? t.c : TK.slate300,
              }}>
                {headline ?? '세율표 보기 →'}
              </div>
              <div style={{ fontSize: FS.micro, color: TK.sub2, lineHeight: 1.5 }}>
                <b style={{ color: t.c }}>{t.when}</b> · {t.what} 붙어요
                {anyPartial && <span style={{ color: TK.orange400 }}> · 이 범위 밖 세율도 있어요</span>}
              </div>
              <div style={{ fontSize: FS.micro, color: TK.slate500 }}>{s.lawName} · 시행 {ymd(s.effective)}</div>
            </button>
          )
        })}
      </div>

      {d.failed.length > 0 && (
        <div style={{ background: TK.bg3, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '7px 11px', fontSize: FS.micro, color: TK.sub2 }}>
          ⚠️ {d.failed.join(' · ')} 조회 실패 — 그 세목은 지금 화면에 없습니다(세금이 없는 게 아닙니다).
        </div>
      )}

      {/* 📖 펼친 단계의 상세 — 세율과 '깎아주는 것'을 갈라서 */}
      {view.filter(v => v.s.key === open).map(({ s, arts }) => {
        const t = TONE[s.key]
        return (
          <div key={s.key} style={{ background: TK.bg3, border: `1px solid ${t.c}44`, borderRadius: 11, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.6 }}>{s.note}</div>

            {arts.map(a => {
              const rates = a.p.groups.filter(g => !isDeduction(g.title))
              const deducts = a.p.groups.filter(g => isDeduction(g.title))
              return (
                <div key={a.no} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* 📌 조문 헤더 — 어느 조문의 표인지 모르면 기본세율과 중과세율이 뒤섞여 보인다 */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: FS.tiny, color: TK.slate200 }}>제{a.no}조 {a.title}</b>
                    {ARTICLE_HINT[a.no] && (
                      <span style={{ fontSize: FS.micro, color: TK.sub2 }}>— {ARTICLE_HINT[a.no]}</span>
                    )}
                  </div>
                  {rates.map((g, gi) => (
                    <div key={gi}>
                      {!isSentenceTitle(g.title) && (
                        <div style={{ fontSize: FS.tiny, color: t.c, fontWeight: 800, marginBottom: 5 }}>{g.title}</div>
                      )}
                      {g.rows.map((row, ri) => (
                        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                          background: ri % 2 ? 'transparent' : TK.bg1, borderRadius: 6 }}>
                          <span style={{ flex: 1, fontSize: FS.tiny, color: TK.slate300 }}>{row.band}</span>
                          {row.plus && <span style={{ fontSize: FS.micro, color: TK.slate500, fontFamily: 'monospace' }}>{row.plus}</span>}
                          <span style={{ fontSize: FS.tiny, fontWeight: 900, fontFamily: 'monospace', color: t.c, minWidth: 50, textAlign: 'right' }}>{row.rate}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* 💸 공제는 세율이 아니다 — 섞으면 '20%'를 세율로 읽는다 */}
                  {deducts.length > 0 && (
                    <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 8 }}>
                      <div style={{ fontSize: FS.tiny, color: TK.green400, fontWeight: 800, marginBottom: 5 }}>💸 이만큼 깎아줍니다 (공제)</div>
                      {deducts.map((g, gi) => (
                        <div key={gi} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 3, lineHeight: 1.5 }}>{g.title}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {g.rows.map((row, ri) => (
                              <span key={ri} style={{ fontSize: FS.micro, color: TK.green400, background: `${TK.green400}14`,
                                border: `1px solid ${TK.green400}44`, borderRadius: 999, padding: '3px 9px' }}>
                                {row.band} <b style={{ fontFamily: 'monospace' }}>{row.rate}</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {a.p.partial && (
                    <div style={{ background: `${TK.orange400}14`, border: `1px solid ${TK.orange400}44`, borderRadius: 7,
                      padding: '7px 10px', fontSize: FS.micro, color: TK.orange400, lineHeight: 1.6 }}>
                      {rates.length === 0
                        ? <>⚠️ 이 조문은 세율을 <b>다른 조문을 가리키는 방식</b>으로 적어 표로 정리하지 못했습니다.
                            무엇에 얼마가 붙는지는 아래 원문에서 확인하세요.</>
                        : <>⚠️ 위 표의 범위를 <b>벗어나는 세율</b>이 원문에 더 있습니다(중과·특례·다른 조문 참조).
                            대표 숫자만 보고 판단하지 말고 아래 원문을 함께 보세요.</>}
                    </div>
                  )}

                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: FS.micro, color: TK.sub3 }}>
                      📜 제{a.no}조 {a.title} 원문 보기{a.revised ? ` · ${a.revised}` : ''}
                    </summary>
                    <pre style={{
                      margin: '6px 0 0', padding: '9px 11px', background: TK.bg1, borderRadius: 7, border: `1px solid ${BORDER}`,
                      fontSize: FS.micro, color: TK.slate300, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', maxHeight: 300,
                    }}>{a.text}</pre>
                  </details>
                </div>
              )
            })}

            <a href={s.link} target="_blank" rel="noreferrer"
              style={{ fontSize: FS.micro, color: t.c, textDecoration: 'none', fontWeight: 700 }}>
              📜 {s.lawName} 전문 보기 (국가법령정보센터) →
            </a>
          </div>
        )
      })}

      <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.7 }}>
        표는 <b>법령 원문에서 기계로 뽑은 것</b>이고 원문도 함께 접어 뒀습니다. 법 조문끼리 서로를 가리키는 부분은
        학생이 읽기 어려워 요약에서 뺐으니, 정확히 보시려면 원문을 펼치세요.
        ⚠️ 세율은 <b>적용 대상마다 다릅니다</b>(2주택 이하 / 3주택 이상 / 법인). <b>공제·감면·특례·지방소득세는 별도</b>예요.
        ⛔ 개인 세액 계산은 하지 않습니다 — 정확한 금액은 <b>홈택스 모의계산</b>이나 <b>세무사</b>에게 확인하세요.
      </div>
    </div>
  )
}
