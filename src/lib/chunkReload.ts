// 배포 뒤 옛 번들이 사라진 청크를 받으려다 실패하는 오류(ChunkLoadError)를 알아보고 **한 번만** 새로고침한다(무한 루프 방지 — sessionStorage 표식)
export function isChunkLoadError(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null
  const msg = `${err?.name ?? ''} ${err?.message ?? ''}`
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)
}

const FLAG = 'chunk-reload-once'

export function reloadOnceForChunk(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(FLAG) === '1') return   // 이미 한 번 새로 고쳤는데도 실패 — 더 돌리지 않는다(버튼으로 남긴다)
    sessionStorage.setItem(FLAG, '1')
  } catch { /* 저장소 불가 — 그래도 한 번은 새로 고친다 */ }
  window.location.reload()
}

/** 정상 로드 뒤 표식을 지운다(다음 배포에서 또 한 번 허용) — 루트 레이아웃이 마운트 때 부른다 */
export function clearChunkReloadFlag(): void {
  try { sessionStorage.removeItem(FLAG) } catch { /* 무시 */ }
}
