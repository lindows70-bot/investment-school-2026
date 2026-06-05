// 매수/매도 등 보유종목 변경 후 서버측 user 캐시(리밸런싱·상관행렬)를 무효화하는 클라이언트 헬퍼
export async function bustServerCache(): Promise<void> {
  try { await fetch('/api/cache/bust', { method: 'POST' }) } catch { /* graceful */ }
}
