// 동종 기업 PER 중앙값 계산(순수) — getSectorPeers 가 쓴다. 대상 제외 · 양수만 · 같은 회사의 다른 주식(GOOG/GOOGL · BRK-A/BRK-B)은 한 곳으로
//   'use server' 파일은 async 함수만 export 할 수 있어 검증 스크립트가 부를 수 있게 여기로 뺐다.

/** 이 수보다 적으면 중앙값이라 부르기 어려워 null */
export const PER_MEDIAN_MIN = 3

/** 회사 이름 키 — 소문자 · 'Class A/B/C' 표기 제거 · 글자·숫자만(같은 회사의 다른 주식 종류를 한 곳으로 묶는다) */
export const companyKey = (n: string) => n.toLowerCase().replace(/\bclass\s+[a-z]\b/g, '').replace(/[^a-z0-9가-힣]/g, '')

export function peerPerMedian(targetName: string, peers: { name: string; pe: number | null }[]): { perMedian: number | null; perCount: number } {
  const seen = new Set<string>([companyKey(targetName)])   // 대상과 같은 회사(다른 주식 종류 포함)는 뺀다
  const vals: number[] = []
  for (const p of peers) {
    const k = companyKey(p.name ?? '')
    if (!k || seen.has(k)) continue
    if (!(typeof p.pe === 'number' && isFinite(p.pe) && p.pe > 0)) continue
    seen.add(k)
    vals.push(p.pe)
  }
  vals.sort((a, b) => a - b)
  const n = vals.length
  const perMedian = n >= PER_MEDIAN_MIN ? +(n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2).toFixed(2) : null
  return { perMedian, perCount: n }
}
