'use client'

/**
 * 🕵️ InsiderReceipt — CEO의 장바구니 (비밀병기 5단계)
 *
 * SEC EDGAR Form 4(내부자 공시)에서 최근 90일 '장내매수(코드 P)'만 추려
 * '황금 영수증' UI로 보여준다. 서로 다른 내부자 ≥2명이 샀으면(클러스터)
 * 🔥 사이렌 이펙트로 '경영진 고확신'을 강조.
 *
 * 데이터: 서버액션 getInsiderSignal (게으른 캐싱, 종목 진입 시 자동)
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import { getInsiderSignal, type InsiderSignal } from '@/app/actions/getInsiderSignal'

interface Props { ticker: string; name: string; market: string }

const C = {
  card:    '#1a1d27',
  card2:   '#141720',
  border:  '#2a2d3a',
  gold:    '#f59e0b',
  green:   '#4ade80',
  red:     '#f87171',
  text:    '#f1f5f9',
  textSub: '#94a3b8',
  textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`
const krw = (n: number) =>
  n >= 1e8 ? `₩${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `₩${Math.round(n / 1e4).toLocaleString()}만` : `₩${Math.round(n).toLocaleString()}`
const money = (n: number, cur?: 'USD' | 'KRW') => cur === 'KRW' ? krw(n) : usd(n)

export default function InsiderReceipt({ ticker, name, market }: Props) {
  const [data, setData] = useState<InsiderSignal | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    getInsiderSignal({ ticker, market })
      .then(r => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market])

  // 로딩 — 가볍게 (메인 화면 방해 X)
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, fontFamily: FONT }}>
        <div className="ins-spin" style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.gold, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: C.textLow }}>🕵️ 내부자 거래(SEC Form 4)를 확인하는 중…</span>
        <style jsx>{`@keyframes ins-spin{to{transform:rotate(360deg)}}.ins-spin{animation:ins-spin .8s linear infinite}`}</style>
      </div>
    )
  }
  if (!data) return null

  // 매수 없음 / 미지원 — 슬림 안내 (투명성)
  if (data.status !== 'ok') {
    const msg = data.status === 'none'
      ? '🧾 최근 90일 내부자의 장내매수 내역이 없습니다 — 특이 시그널 없음.'
      : data.status === 'unsupported'
      ? `🧾 ${data.message || '내부자 신호는 미국 상장 종목만 지원합니다.'}`
      : `🧾 ${data.message || '내부자 데이터를 불러오지 못했습니다.'}`
    return (
      <div style={{ padding: '12px 18px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, fontSize: 12, color: C.textLow, fontFamily: FONT }}>
        {msg}
      </div>
    )
  }

  const accent = data.cluster ? C.red : C.gold   // 클러스터=사이렌(레드), 단일=골드

  return (
    <div style={{
      borderRadius: 14, fontFamily: FONT, overflow: 'hidden',
      background: C.card,
      border: `1px solid ${accent}66`,
      boxShadow: data.cluster ? `0 0 0 1px ${accent}33, 0 0 22px ${accent}22` : 'none',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: `1px dashed ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🧾</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>CEO의 장바구니</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.gold}22`, color: C.gold, fontWeight: 700 }}>SECRET · 내부자</span>
        </div>
        {data.cluster && (
          <span className="ins-siren" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 800, color: '#fff',
            padding: '4px 10px', borderRadius: 20, background: accent,
          }}>
            🔥 경영진 고확신 · 클러스터 매수
          </span>
        )}
      </div>

      {/* 요약 라인 */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', background: `${accent}0d` }}>
        <div>
          <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>최근 90일 내부자 장내매수</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: accent, fontFamily: 'monospace' }}>
              {data.totalValue > 0 ? money(data.totalValue, data.currency) : `${data.buys.reduce((s, b) => s + b.shares, 0).toLocaleString()}주`}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>· 내부자 {data.buyerCount}명</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180, fontSize: 11.5, color: C.textSub, lineHeight: 1.5 }}>
          {name || ticker}의 경영진이 <strong style={{ color: accent }}>자기 돈으로</strong> 장내에서 직접 사들인 내역입니다.
        </div>
      </div>

      {/* 영수증 본문 (매수 내역) */}
      <div style={{ padding: '6px 18px 10px' }}>
        {data.buys.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '9px 0', borderBottom: i < data.buys.length - 1 ? `1px dashed ${C.border}` : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
              <div style={{ fontSize: 10.5, color: C.textLow }}>{b.role} · {b.date}</div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                {b.value > 0 ? money(b.value, data.currency) : `${Math.round(b.shares).toLocaleString()}주`}
              </div>
              <div style={{ fontSize: 10, color: C.textLow, fontFamily: 'monospace' }}>
                {b.value > 0 ? `${Math.round(b.shares).toLocaleString()}주 매수` : '장내매수'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 린치 코멘트 */}
      <div style={{ margin: '0 18px 14px', padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.7, fontStyle: 'italic' }}>
          &ldquo;{data.lynchComment}&rdquo;
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ padding: '0 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 9.5, color: C.textLow }}>
          {data.source === 'dart'
            ? '📑 DART 임원·주요주주 소유보고 · 보고서 원문 ‘장내매수’만 집계 · 금액은 현재가 기준 추정'
            : '📑 SEC EDGAR Form 4(공시) · 코드 P(장내매수)만 집계 · 옵션행사·보너스 제외'}
        </span>
        <span style={{ fontSize: 9.5, color: C.textLow, fontFamily: 'monospace' }}>
          {data.cached ? '💾 저장된 신호' : '✨ 방금 조회'} · 90일
        </span>
      </div>

      <style jsx>{`
        @keyframes ins-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.78;transform:scale(1.04)} }
        .ins-siren { animation: ins-pulse 1.1s ease-in-out infinite; box-shadow: 0 0 12px ${accent}; }
      `}</style>
    </div>
  )
}
