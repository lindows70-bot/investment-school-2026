'use client'

/**
 * ErrorBoundary — React 렌더링 에러 차단막
 *
 * 문제 배경:
 *   - 'use client' 컴포넌트에서 렌더링 에러가 발생하면
 *     Next.js 기본 동작은 전체 페이지가 흰 화면(White Screen)이 됨
 *   - 어떤 탭 컴포넌트(EarningsTerminal, LynchValuation 등)가 예외를 던져도
 *     다른 탭까지 사용 불능 상태가 되는 문제
 *
 * 해결:
 *   - 각 탭 컨텐츠를 <ErrorBoundary>로 감싸면
 *     해당 탭만 에러 UI를 보여주고 나머지 탭은 정상 작동
 */

import React from 'react'
import { TK } from '@/lib/theme'

interface Props {
  children:    React.ReactNode
  fallback?:   React.ReactNode   // 커스텀 에러 UI (없으면 기본 UI 사용)
  label?:      string            // 어떤 탭/섹션인지 표시용 (디버깅)
}

interface State {
  hasError:  boolean
  error:     Error | null
  errorInfo: React.ErrorInfo | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    // 개발 콘솔에 상세 에러 출력 (프로덕션에서도 확인 가능)
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 fallback이 있으면 사용
      if (this.props.fallback) return this.props.fallback

      // 기본 에러 UI (투자학교 다크 테마)
      return (
        <div style={{
          padding: '28px 24px', borderRadius: 14,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: TK.red400 }}>
                {this.props.label ? `[${this.props.label}] ` : ''}컴포넌트 렌더링 오류
              </div>
              <div style={{ fontSize: 11, color: TK.sub2, marginTop: 2 }}>
                이 화면만 오류가 발생했습니다. 다른 탭은 정상 작동합니다.
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {this.state.error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: TK.bg3, border: `1px solid ${TK.line1}`,
              fontFamily: 'monospace', fontSize: 11, color: TK.slate400,
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {this.state.error.message}
            </div>
          )}

          {/* 재시도 버튼 */}
          <button
            onClick={this.handleRetry}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 18px', borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: TK.red400,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔄 재시도
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
