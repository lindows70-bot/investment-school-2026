'use client'
// 학생 홈 '위기 신호등' 카드 — 신호등 한 대 + 빨강·노랑·초록 개수 + 등 9개의 색(돈줄 3 · 거품 6). 누르면 상세(/s/signal)
//   2026-11-21 사용자 요청: "앱을 켰을 때 간편 모드에서 쉽게 볼 수 있도록". 색은 서버(/api/crisis-signal)가 기존 화면들의 판정을 모아 정한다 — 여기선 그리기만
//   글자는 색칠하지 않는다(빨강 = 오른 값이라는 등락색과 섞이지 않게) · 색 이름은 늘 글자로 함께
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import type { CrisisSignal, LightColor } from '@/lib/crisisSignal'
import { card, FailRow, noteStyle } from './homeUi'
import { TrafficLight, Lamp, LampChip, COLOR_KO } from '@/app/components/student/signal/signalUi'

const ORDER: LightColor[] = ['red', 'yellow', 'green', 'none']

/** 빨강 n · 노랑 n · 초록 n — 등 한 알씩 붙여서(모름은 있을 때만) */
export function SignalCounts({ counts, size = FS.lg }: { counts: Record<LightColor, number>; size?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: SP.md, rowGap: SP.xs, fontSize: size, fontWeight: 800, letterSpacing: '-0.02em', color: TK.slate100, fontVariantNumeric: 'tabular-nums' }}>
      {ORDER.filter(c => c !== 'none' || counts.none > 0).map(c => (
        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: SP.xs + 2, whiteSpace: 'nowrap' }}>
          <Lamp color={c} size={Math.round(size * 0.72)} />{COLOR_KO[c]} {counts[c]}
        </span>
      ))}
    </span>
  )
}

export default function CrisisSignalCard() {
  const r = useJson<CrisisSignal>('/api/crisis-signal')
  const d = r.state === 'ok' && r.data && Array.isArray(r.data.lights) && r.data.overall && r.data.counts ? r.data : null

  return (
    <section aria-label="위기 신호등" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      {/* 머리 줄(신호등 + 제목 + ›)과 개수 줄을 나눈다 — 한 줄에 두면 폰(375)에서 '빨강 3 · 노랑 2' 뒤 '초록 2' 가 다음 줄로 꺾였다(2026-11-21 화면 실측) */}
      <Link href="/s/signal" aria-label="위기 신호등 자세히 보기" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm, minWidth: 0, textDecoration: 'none', color: TK.slate200 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 44, minWidth: 0 }}>
          <TrafficLight color={d ? d.overall.color : 'none'} lamp={16} />
          <span style={{ flex: 1, minWidth: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100, whiteSpace: 'nowrap' }}>위기 신호등</span>
          <span style={{ fontSize: FS.tiny, color: TK.sub, flexShrink: 0, whiteSpace: 'nowrap' }}>자세히 ›</span>
        </span>
        {d ? <SignalCounts counts={d.counts} />
          : <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.sub }}>{r.state === 'failed' ? '신호등을 못 켰어요' : '신호등을 켜는 중…'}</span>}
      </Link>

      {r.state === 'failed' && <FailRow text="신호를 못 가져왔어요." onRetry={r.reload} retryLabel="위기 신호등 다시 불러오기" />}
      {r.state === 'ok' && !d && <FailRow text="신호가 아직 안 잡혔어요 — 잠시 뒤 다시 열어 보세요." onRetry={r.reload} retryLabel="위기 신호등 다시 불러오기" />}

      {d && (
        <>
          <span style={{ fontSize: FS.tiny, lineHeight: 1.5, color: TK.slate300, wordBreak: 'keep-all' }}>{d.overall.line}</span>
          {/* 묶음마다 한 줄 — 이름표(돈줄·거품) + 등 칩. 좁으면 칩이 다음 줄로(미디어쿼리 없이 폭 기준) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}>
            {d.groups.map(g => (
              <div key={g.key} style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, minWidth: 0 }}>
                <span style={{ flexShrink: 0, width: 34, fontSize: FS.micro, fontWeight: 700, color: TK.sub, whiteSpace: 'nowrap' }}>{g.key === 'money' ? '돈줄' : '거품'}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: SP.md, rowGap: SP.xs, fontSize: FS.tiny, color: TK.slate200, minWidth: 0 }}>
                  {d.lights.filter(l => l.group === g.key).map(l => <LampChip key={l.key} color={l.color} name={l.name} />)}
                </span>
              </div>
            ))}
          </div>
          {/* 바닥 신호 한 줄 — 위기와 다른 질문(지금이 바닥인가). 결론 문장은 서버가 데이터에서 만든다 */}
          {d.bottom && <span style={{ fontSize: FS.tiny, lineHeight: 1.5, color: TK.slate300, wordBreak: 'keep-all', paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}><b style={{ color: TK.slate100 }}>바닥 신호</b> · {d.bottom.headline}</span>}
          {d.stale && <span style={noteStyle(TK.amber400)}>새 값을 못 가져와 마지막으로 잰 값을 보여 주고 있어요.</span>}
        </>
      )}
    </section>
  )
}
