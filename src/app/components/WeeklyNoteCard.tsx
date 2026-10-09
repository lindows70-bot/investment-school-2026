'use client'
// 관리자 대시보드 '이번 주 소식 문구' 카드 — 만들기 → 미리보기 → 복사(반 단톡방에 붙여넣기). 학생 복귀 2단계(2026-10-09)
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'

type State = 'idle' | 'loading' | 'ok' | 'failed'

export default function WeeklyNoteCard() {
  const [state, setState] = useState<State>('idle')
  const [text, setText] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const [copied, setCopied] = useState<'no' | 'yes' | 'fail'>('no')

  const build = async () => {
    setState('loading'); setCopied('no')
    try {
      const r = await fetch('/api/teacher/weekly-note', { cache: 'no-store' })
      const j = await r.json().catch(() => null) as { text?: unknown; missing?: unknown } | null
      if (!r.ok || typeof j?.text !== 'string') { setState('failed'); return }
      setText(j.text); setMissing(Array.isArray(j.missing) ? j.missing.filter((m): m is string => typeof m === 'string') : []); setState('ok')
    } catch { setState('failed') }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied('yes') } catch { setCopied('fail') }
  }

  return (
    <section aria-label="이번 주 소식 문구" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, padding: SP.lg, borderRadius: RAD.md, background: TK.card, border: `1px solid ${TK.border}`, marginBottom: SP.xl }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <span style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate100 }}>📣 이번 주 소식 문구</span>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>리그 순위·변화, 지난주 시장, 이번 주 일정을 한 글로 — 복사해서 반 단톡방에 붙여넣으세요. 금액은 들어가지 않아요.</span>
        </div>
        <button type="button" onClick={build} disabled={state === 'loading'} style={{ height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: 'none', background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, cursor: state === 'loading' ? 'default' : 'pointer' }}>
          {state === 'loading' ? '만드는 중…' : state === 'ok' ? '다시 만들기' : '문구 만들기'}
        </button>
      </div>
      {state === 'failed' && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>문구를 못 만들었어요 — 잠시 뒤 다시 눌러 주세요.</span>}
      {state === 'ok' && (
        <>
          <textarea readOnly value={text} rows={Math.min(16, text.split('\n').length + 1)} style={{ width: '100%', boxSizing: 'border-box', padding: SP.md, borderRadius: RAD.sm, background: TK.bg0, border: `1px solid ${TK.border}`, color: TK.slate100, fontSize: FS.body, lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' }}>
            <button type="button" onClick={copy} style={{ height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.border}`, background: TK.bg10, color: TK.slate100, fontSize: FS.body, fontWeight: 700, cursor: 'pointer' }}>복사</button>
            {copied === 'yes' && <span style={{ fontSize: FS.tiny, color: TK.green400 }}>복사했어요 — 카톡에 붙여넣으세요.</span>}
            {copied === 'fail' && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>복사가 막혔어요 — 글을 직접 드래그해 복사해 주세요.</span>}
            {missing.length > 0 && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>못 가져온 재료라 뺀 줄: {missing.join(' · ')}</span>}
          </div>
        </>
      )}
    </section>
  )
}
