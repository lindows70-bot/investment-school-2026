'use client'
// 🏛️ 부동산 정책 레이더 — 📜확정(고시·훈령) + 📰예고(뉴스)를 한 타임라인에, 4대 경로와 시차로 분해
import { useState, useEffect } from 'react'
import type { RePolicyResult } from '@/app/api/re-policy/route'
import { CHANNEL_META, type Channel, type Stance } from '@/lib/rePolicy'
import { TK, FS } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border
// ⚠️ 색은 '가격 방향'이 아니라 '규제 강도'다 — 🔴을 악재로 읽히게 하면 정치적 해석이 된다
const ST: Record<Stance, { c: string; dot: string; label: string }> = {
  tighten: { c: TK.orange400, dot: '🔴', label: '규제 강화 쪽' },
  ease:    { c: TK.green400,  dot: '🟢', label: '규제 완화 쪽' },
  discuss: { c: TK.amber400,  dot: '🟡', label: '논의·혼재' },
}

export default function RePolicyRadar() {
  const [d, setD] = useState<RePolicyResult | null>(null)
  const [err, setErr] = useState(false)      // 실패를 상태로 — '없음'과 '못 불러옴'은 다르다
  const [tab, setTab] = useState<'all' | 'law' | 'news'>('all')
  const [ch, setCh] = useState<Channel | 'all'>('all')

  useEffect(() => {
    let alive = true
    fetch('/api/re-policy', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('http') ; return r.json() })
      .then(j => { if (alive) setD(j) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  if (err) return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>
      🏛️ 정책 레이더를 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.
    </div>
  )
  if (!d) return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', fontSize: FS.tiny, color: TK.sub }}>
      🏛️ 정부 부동산 정책을 모으는 중…
    </div>
  )

  const cm = ST[d.climate.stance]
  const shown = d.items.filter(i => (tab === 'all' || i.source === tab) && (ch === 'all' || i.channel === ch))

  return (
    <div style={{ background: CARD, border: `1px solid ${cm.c}44`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* 헤더 — 기후 신호등 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🏛️ 부동산 정책 레이더</b>
        <span style={{ background: `${cm.c}1f`, color: cm.c, border: `1px solid ${cm.c}55`, borderRadius: 999, padding: '2px 11px', fontWeight: 800, fontSize: FS.tiny }}>
          {cm.dot} {cm.label}
        </span>
        <span style={{ color: TK.sub2, fontSize: FS.micro }}>
          최근 정책 {d.climate.n}건 기준(확정 {d.lawN} · 예고 {d.newsN}) — 강화 {d.climate.tighten} vs 완화 {d.climate.ease}
        </span>
      </div>

      {/* ⚠️ 샘플 키·법령 축 장애를 조용히 넘기지 않는다 */}
      {d.lawSample && (
        <div style={{ background: TK.bg3, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '7px 11px', fontSize: FS.micro, color: TK.sub2 }}>
          ⚠️ 법령 조회가 <b>샘플 키</b>로 동작 중입니다 — law.go.kr에서 무료 OC를 발급받아 <b>LAW_API_OC</b>에 등록하면 안정화됩니다.
        </div>
      )}
      {d.lawDown && (
        <div style={{ background: TK.bg3, border: `1px solid ${TK.amber400}44`, borderRadius: 8, padding: '7px 11px', fontSize: FS.micro, color: TK.sub2 }}>
          📜 확정(법령) 조회를 못 했습니다 — 지금은 <b>뉴스(예고)만</b> 보고 계십니다.
        </div>
      )}

      {/* 4대 전달 경로 — 정책이 어느 지표에 언제 닿나 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
        {d.channels.map(c => {
          const m = CHANNEL_META[c.channel]
          const on = ch === c.channel
          return (
            <div key={c.channel} onClick={() => setCh(on ? 'all' : c.channel)}
              style={{ cursor: 'pointer', background: on ? `${TK.orange400}14` : TK.bg3, border: `1px solid ${on ? `${TK.orange400}66` : BORDER}`, borderRadius: 10, padding: '9px 12px' }}>
              <div style={{ fontSize: FS.tiny, fontWeight: 800, color: TK.slate200 }}>{m.emoji} {m.label}
                <span style={{ color: TK.sub3, fontWeight: 400 }}> {c.lawN + c.newsN}건</span>
              </div>
              <div style={{ fontSize: FS.micro, color: TK.sub2, marginTop: 3, lineHeight: 1.5 }}>{m.metric}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: FS.micro, color: TK.orange400, fontWeight: 700 }}>⏳ 효과까지 {m.lagLabel}</span>
                {/* 🔗 카드 본체는 '필터 토글'이라 링크를 겹치면 필터를 잃는다 — 별도 링크 + 전파 차단 */}
                <a href={m.href} onClick={e => e.stopPropagation()}
                  style={{ fontSize: FS.micro, color: TK.indigo400, textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  지표 보기 →
                </a>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginTop: -4 }}>
        💡 <b>공급 대책 발표 = 곧 집값 하락</b>이 아닙니다. 착공에서 입주까지 2~3년이라 지금 발표는 <b>2~3년 뒤 물량</b>이에요.
        가장 빨리 나타나는 건 <b>금융(대출) 규제</b>입니다.
      </div>

      {/* 확정 / 예고 탭 */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['all', `전체 ${d.items.length}`], ['law', `📜 확정 ${d.lawN}`], ['news', `📰 예고 ${d.newsN}`]] as const).map(([k, lb]) => (
          <span key={k} onClick={() => setTab(k)} style={{ cursor: 'pointer', fontSize: FS.micro, fontWeight: 700, padding: '3px 10px', borderRadius: 7,
            background: tab === k ? `${TK.orange400}22` : TK.bg6, color: tab === k ? TK.orange400 : TK.sub2, border: `1px solid ${tab === k ? `${TK.orange400}66` : BORDER}` }}>{lb}</span>
        ))}
        {ch !== 'all' && (
          <span onClick={() => setCh('all')} style={{ cursor: 'pointer', fontSize: FS.micro, color: TK.sub3 }}>
            · {CHANNEL_META[ch as Exclude<Channel, 'other'>]?.label} 필터 해제 ✕
          </span>
        )}
      </div>

      {/* 타임라인 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
        {shown.length === 0
          ? <div style={{ fontSize: FS.tiny, color: TK.sub3, padding: '6px 0' }}>이 조건에 해당하는 정책이 없습니다.</div>
          : shown.map((i, k) => {
            const s = ST[i.stance], m = CHANNEL_META[i.channel as Exclude<Channel, 'other'>]
            return (
              <a key={k} href={i.link} target="_blank" rel="noreferrer"
                style={{ display: 'block', padding: '6px 9px', borderRadius: 8, background: TK.bg6, textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: FS.micro, fontWeight: 800, color: i.source === 'law' ? TK.green400 : TK.sub2, minWidth: 34 }}>
                    {i.source === 'law' ? '📜확정' : '📰예고'}
                  </span>
                  <span style={{ fontSize: FS.micro, color: TK.sub3, fontFamily: 'monospace', minWidth: 62 }}>{i.date}</span>
                  <span style={{ fontSize: FS.micro, minWidth: 20 }}>{m?.emoji}</span>
                  <span style={{ flex: 1, fontSize: FS.tiny, color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                  <span style={{ fontSize: FS.micro, color: s.c, whiteSpace: 'nowrap' }}>{s.dot}</span>
                  <span style={{ fontSize: FS.micro, color: TK.slate500, whiteSpace: 'nowrap', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {i.meta}{i.effective && i.effective !== i.date ? ` · 시행 ${i.effective}` : ''}
                  </span>
                </div>
                {/* 📌 무엇을 정하는 고시인지 — 제목만으론 알 수 없다. 원문 문장 그대로 주고 자르는 건 화면이 한다(2줄) */}
                {i.purpose && (
                  <div style={{ marginTop: 3, marginLeft: 42, fontSize: FS.micro, color: TK.sub3, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    📌 {i.purpose}
                  </div>
                )}
              </a>
            )
          })}
      </div>

      {/* 정직 캐비엇 */}
      <div style={{ fontSize: FS.micro, color: TK.sub3, lineHeight: 1.7 }}>
        📜 <b>확정</b>은 이미 발령된 고시·훈령(법령정보 원문 링크) · 📰 <b>예고</b>는 언론 보도라 <b>확정이 아닙니다</b>.
        {d.politicsFiltered > 0 && <> 정치 공방 기사 <b>{d.politicsFiltered}건</b>은 시장과 무관해 제외했습니다.</>}
        {d.offTopicFiltered > 0 && <> 4대 경로에 해당하지 않는 행정 절차성 고시 <b>{d.offTopicFiltered}건</b>도 제외했습니다.</>}
        {' '}⛔ 가격 예측이 아니라 <b>정책이 어느 지표를 언제 움직이는지의 지도</b>입니다.
        정책의 정치적 평가는 하지 않으며, 🔴/🟢는 <b>규제 강도</b>이지 호재·악재가 아닙니다(억제책은 실수요자에겐 기회일 수 있습니다).
      </div>
    </div>
  )
}
