// VTT → 타임스탬프 붙은 문단 텍스트(중복 제거). /watch 가 429 로 막혔을 때의 대체 경로.
import { readFileSync } from 'node:fs'
const raw = readFileSync(process.argv[2], 'utf8')
const lines = raw.split(/\r?\n/)
const out = []
let cur = null
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\d{2}):(\d{2}):(\d{2})\.\d{3} --> /)
  if (m) { cur = `${m[2]}:${m[3]}`; if (m[1] !== '00') cur = `${m[1]}:${m[2]}:${m[3]}`; continue }
  if (!cur) continue
  const t = lines[i].replace(/<[^>]*>/g, '').trim()
  if (!t) continue
  const prev = out.length ? out[out.length - 1].t : ''
  if (t === prev || prev.endsWith(t)) continue
  out.push({ ts: cur, t })
}
// 중복 누적 자막 정리 — 뒤 줄이 앞 줄을 포함하면 앞 줄 버림
const clean = []
for (const o of out) {
  if (clean.length && o.t.startsWith(clean[clean.length - 1].t)) clean[clean.length - 1] = o
  else clean.push(o)
}
let buf = '', last = clean[0]?.ts ?? '00:00'
for (const c of clean) {
  buf += c.t + ' '
  if (buf.length > 220) { console.log(`[${last}] ${buf.trim()}`); buf = ''; last = c.ts }
}
if (buf.trim()) console.log(`[${last}] ${buf.trim()}`)
