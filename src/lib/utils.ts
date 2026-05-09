import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number, decimals = 0): string {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(n) >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 10_000)        return `${(n / 10_000).toFixed(1)}만`
  return fmt(n)
}

export function fmtPct(n: number, sign = true): string {
  const s = sign && n > 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}
