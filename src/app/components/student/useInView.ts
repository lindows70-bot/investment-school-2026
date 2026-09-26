'use client'
// 화면에 (거의) 들어왔는지 — 한 번 보이면 true 로 남는다. 무거운 카드를 보일 때만 불러오려고 쓴다
import { useEffect, useState } from 'react'

/** [ref 콜백, seen]. rootMargin 만큼 미리(기본 200px) 들어오면 seen=true */
export function useInView<E extends Element = HTMLElement>(rootMargin = '200px'): [(el: E | null) => void, boolean] {
  const [el, setEl] = useState<E | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen || !el) return
    // 관찰기가 없는 브라우저는 바로 불러온다(안 보이는 채로 영영 안 부르는 것보다 낫다)
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [el, seen, rootMargin])
  return [setEl, seen]
}
