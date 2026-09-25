// 히트맵 칸 배치(squarify)와 칸 색 규칙 — 크기 = 평가금액, 색 = 오늘 등락(한국식 빨강 상승·파랑 하락)
export interface Rect { x: number; y: number; w: number; h: number }

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0)
  const mx = Math.max(...row), mn = Math.min(...row)
  return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
}

/**
 * values 순서는 자유(정렬 전제조건 없음) — 내부에서 값 큰 순으로 정렬해 배치한 뒤
 * 결과 칸을 입력 순서로 되돌린다. 결과 칸 수는 항상 입력 값 수와 같다(빈 상자·전량 0 이하도
 * 크기 0 칸으로 채운다 — 개수가 줄어들면 호출부의 인덱스 매핑이 깨진다).
 * 0 이하 값은 크기 0 칸이 된다(worst()가 최소 면적으로 나누므로, 양수 값만 배치 계산에 넣고
 * 0 이하 값은 계산에서 빼서 NaN/Infinity 를 막는다).
 */
export function squarify(values: number[], box: Rect): Rect[] {
  if (!values.length) return []
  const zeroRects = () => values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }))
  if (box.w <= 0 || box.h <= 0) return zeroRects()
  const total = values.reduce((a, b) => a + (b > 0 ? b : 0), 0)
  if (total <= 0) return zeroRects()

  const pairs: { idx: number; val: number }[] = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0) pairs.push({ idx: i, val: values[i] })
  }
  pairs.sort((a, b) => b.val - a.val)
  const posIdx = pairs.map(p => p.idx)
  const areas = pairs.map(p => p.val * (box.w * box.h) / total)

  const rects: Rect[] = zeroRects()
  const out: Rect[] = []
  let rest = { ...box }, i = 0
  while (i < areas.length) {
    const side = Math.min(rest.w, rest.h)
    const row = [areas[i]]; let j = i + 1
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) { row.push(areas[j]); j++ }
    const sum = row.reduce((a, b) => a + b, 0)
    if (rest.w >= rest.h) {
      const cw = sum / rest.h; let y = rest.y
      for (const a of row) { const h = a / cw; out.push({ x: rest.x, y, w: cw, h }); y += h }
      rest = { x: rest.x + cw, y: rest.y, w: rest.w - cw, h: rest.h }
    } else {
      const rh = sum / rest.w; let x = rest.x
      for (const a of row) { const w = a / rh; out.push({ x, y: rest.y, w, h: rh }); x += w }
      rest = { x: rest.x, y: rest.y + rh, w: rest.w, h: rest.h - rh }
    }
    i = j
  }
  for (let k = 0; k < out.length; k++) rects[posIdx[k]] = out[k]
  return rects
}

/** 코어·위성 두 묶음으로 상자를 좌우로 나눈다(폭 = 평가금액 비율). 음수·NaN·Infinity 는 0으로 방어. */
export function splitGroups(coreVal: number, satVal: number, box: Rect): { core: Rect; sat: Rect } {
  const c = Number.isFinite(coreVal) && coreVal > 0 ? coreVal : 0
  const s = Number.isFinite(satVal) && satVal > 0 ? satVal : 0
  const t = c + s
  const cw = t > 0 ? box.w * c / t : 0
  return { core: { x: box.x, y: box.y, w: cw, h: box.h }, sat: { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h } }
}

/** 칸 색 — null 은 '시세 없음'(화면이 점선 칸으로 그린다). 알파 두 자리를 토큰 뒤에 붙인다. */
export function heatFill(changePct: number | null, tk: { red500: string; blue500: string; flat2: string }): string | null {
  if (changePct == null || !Number.isFinite(changePct)) return null
  if (Math.abs(changePct) < 0.05) return tk.flat2   // 0.05 미만만 회색 — 화면 1자리 표시("0.1")와 경계 일치
  const t = Math.min(Math.abs(changePct) / 3, 1)             // 3% 이상이면 가장 진하다
  const alpha = Math.round((0.28 + 0.5 * t) * 255).toString(16).padStart(2, '0')
  return `${changePct > 0 ? tk.red500 : tk.blue500}${alpha}`
}
