// 검사: 유입(score>0) vs 이탈(score<0) 격차가 '레짐(50일선 방향) 프록시'는 아닌가
//  유입 섹터 소속 ≈ 그 종목도 상승 레짐일 확률이 높다 → 격차가 레짐 안에서 사라지면 로테이션 고유 정보가 아니다
import fs from 'fs'
const S = JSON.parse(fs.readFileSync('.swing-rot-obs.json', 'utf8')).filter(s => s.score != null)
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const f = n => n == null ? ' n/a' : (n >= 0 ? '+' : '') + n.toFixed(2)

// 시장 baseline 은 신호 자체의 초과분 비교라 여기선 유입-이탈 **직접 대조**만 본다(같은 레짐 안 비교라 baseline 불필요)
for (const h of [10, 15]) {
  console.log(`\n전방 ${h}봉 — 레짐 안에서 유입 vs 이탈 (절사 평균 원수익 %)`)
  for (const rg of ['up', 'flat', 'down']) {
    const g = S.filter(s => s.regime === rg)
    const inn = g.filter(s => s.score > 0).map(s => s.ret[h])
    const out = g.filter(s => s.score < 0).map(s => s.ret[h])
    if (inn.length < 10 || out.length < 10) { console.log(`  ${rg.padEnd(5)} 표본 부족 (유입 ${inn.length} · 이탈 ${out.length})`); continue }
    const ti = avg(trim(inn)), to = avg(trim(out))
    console.log(`  ${rg.padEnd(5)} 유입 n=${String(inn.length).padStart(4)} 절사 ${f(ti)}%  |  이탈 n=${String(out.length).padStart(4)} 절사 ${f(to)}%  |  격차 ${f(ti - to)}%p`)
  }
}
// 트랙 A(회복)만 — 가장 격차가 컸던 트랙의 레짐 분해
console.log(`\n트랙 A(회복)만 · 15봉`)
for (const rg of ['up', 'flat', 'down']) {
  const g = S.filter(s => s.track === 'A회복' && s.regime === rg)
  const inn = g.filter(s => s.score > 0).map(s => s.ret[15])
  const out = g.filter(s => s.score < 0).map(s => s.ret[15])
  if (inn.length < 10 || out.length < 10) { console.log(`  ${rg.padEnd(5)} 표본 부족 (유입 ${inn.length} · 이탈 ${out.length})`); continue }
  const ti = avg(trim(inn)), to = avg(trim(out))
  console.log(`  ${rg.padEnd(5)} 유입 n=${String(inn.length).padStart(4)} 절사 ${f(ti)}%  |  이탈 n=${String(out.length).padStart(4)} 절사 ${f(to)}%  |  격차 ${f(ti - to)}%p`)
}
