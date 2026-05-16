'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

const TAG_COLOR: Record<string, string> = {
  '공지': '#60a5fa', '필독': '#ef4444', '일정': '#fbbf24',
}

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Notice {
  id: string; user_id: string | null; title: string
  content: string | null; tag: string
  is_edited: boolean; created_at: string
}
interface Post {
  id: string; user_id: string; author_name: string
  content: string; is_admin_post: boolean; is_edited: boolean; created_at: string
  comments: Comment[]
}
interface Comment {
  id: string; post_id: string; user_id: string; author_name: string
  content: string; is_edited: boolean; created_at: string
}
interface Me { id: string; name: string; isAdmin: boolean }

// ── 인라인 아이콘 ─────────────────────────────────────────────────────────────
const IcoTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const IcoPen  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoSend = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const IcoReply= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>

// ── 날짜 포맷 ─────────────────────────────────────────────────────────────────
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })

// ══════════════════════════════════════════════════════════════════════════════
export default function SchoolLoungePage() {
  const sb = createClient()

  // ── 인증 / 권한 ──
  const [me, setMe] = useState<Me | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── 데이터 ──
  const [notices,  setNotices]  = useState<Notice[]>([])
  const [posts,    setPosts]    = useState<Post[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // ── UI 상태 ──
  const [showAddNotice,  setShowAddNotice]  = useState(false)
  const [noticeTitle,    setNoticeTitle]    = useState('')
  const [noticeContent,  setNoticeContent]  = useState('')
  const [noticeTag,      setNoticeTag]      = useState('공지')
  const [expandNotice,   setExpandNotice]   = useState<string | null>(null)  // 본문 펼치기
  const [editNotice,     setEditNotice]     = useState<{ id: string; title: string; content: string; tag: string } | null>(null)
  const [newPost,       setNewPost]       = useState('')
  const [openThread,    setOpenThread]    = useState<string | null>(null)
  const [replyInputs,   setReplyInputs]   = useState<Record<string, string>>({})
  const [editPost,      setEditPost]      = useState<{ id: string; val: string } | null>(null)
  const [editComment,   setEditComment]   = useState<{ id: string; postId: string; val: string } | null>(null)
  const [busy,          setBusy]          = useState(false)

  // ── 1. 사용자 정보 로드 ──────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setAuthLoading(false); return }
      const { data: profile } = await sb.from('profiles')
        .select('full_name, role').eq('id', user.id).single()
      setMe({
        id:      user.id,
        name:    profile?.full_name ?? user.email?.split('@')[0] ?? '학생',
        isAdmin: profile?.role === 'teacher',
      })
      setAuthLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. 데이터 전체 로드 ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setDataLoading(true)
    setError(null)
    const [nRes, pRes, cRes] = await Promise.all([
      sb.from('notices').select('*').order('created_at', { ascending: false }),
      sb.from('lounge_posts').select('*').order('created_at', { ascending: false }),
      sb.from('lounge_comments').select('*').order('created_at', { ascending: true }),
    ])
    if (nRes.error) { setError(nRes.error.message); setDataLoading(false); return }
    setNotices(nRes.data ?? [])
    const withComments: Post[] = (pRes.data ?? []).map(p => ({
      ...p,
      comments: (cRes.data ?? []).filter(c => c.post_id === p.id),
    }))
    setPosts(withComments)
    setDataLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── 공통 헬퍼 ────────────────────────────────────────────────────────────────
  const canDelete = (authorId: string) => me?.isAdmin || me?.id === authorId
  const canEdit   = (authorId: string) => me?.id === authorId

  // ══ 공지사항 ════════════════════════════════════════════════════════════════
  // content / is_edited 컬럼은 이미 DB에 존재 — 런타임 체크 불필요

  const addNotice = async () => {
    if (!noticeTitle.trim() || !me) return
    setBusy(true)
    const { data, error } = await sb.from('notices')
      .insert({
        title:   noticeTitle.trim(),
        content: noticeContent.trim() || null,
        tag:     noticeTag,
        user_id: me.id,
      })
      .select('id,title,content,tag,is_edited,created_at,user_id')
      .single()
    setBusy(false)
    if (error) {
      alert(`공지 등록 실패: ${error.message}`)
      return
    }
    if (!data) return
    setNotices([data as Notice, ...notices])
    setNoticeTitle(''); setNoticeContent(''); setShowAddNotice(false)
  }

  const saveEditNotice = async () => {
    if (!editNotice || !editNotice.title.trim()) return
    setBusy(true)
    const payload = {
      title:     editNotice.title.trim(),
      content:   editNotice.content.trim() || null,
      tag:       editNotice.tag,
      is_edited: true,
    }
    const { error } = await sb.from('notices')
      .update(payload)
      .eq('id', editNotice.id)
    setBusy(false)
    if (error) {
      alert(`공지 수정 실패: ${error.message}`)
      return
    }
    // 로컬 상태 즉시 반영
    setNotices(notices.map(n =>
      n.id === editNotice.id ? { ...n, ...payload } : n
    ))
    setEditNotice(null)
  }

  const deleteNotice = async (id: string) => {
    if (!confirm('공지를 삭제하시겠습니까?')) return
    const { error } = await sb.from('notices').delete().eq('id', id)
    if (!error) { setNotices(notices.filter(n => n.id !== id)); if (expandNotice === id) setExpandNotice(null) }
  }

  // ══ 소통방 게시글 ════════════════════════════════════════════════════════════

  const addPost = async () => {
    if (!newPost.trim() || !me) return
    setBusy(true)
    const { data, error } = await sb.from('lounge_posts')
      .insert({ user_id: me.id, author_name: me.name, content: newPost.trim(), is_admin_post: me.isAdmin })
      .select().single()
    setBusy(false)
    if (error || !data) return
    setPosts([{ ...data, comments: [] }, ...posts])
    setNewPost('')
  }

  const saveEditPost = async () => {
    if (!editPost?.val.trim()) return
    const { error } = await sb.from('lounge_posts')
      .update({ content: editPost.val.trim(), is_edited: true }).eq('id', editPost.id)
    if (error) return
    setPosts(posts.map(p => p.id === editPost.id ? { ...p, content: editPost.val.trim(), is_edited: true } : p))
    setEditPost(null)
  }

  const deletePost = async (id: string) => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return
    const { error } = await sb.from('lounge_posts').delete().eq('id', id)
    if (!error) { setPosts(posts.filter(p => p.id !== id)); if (openThread === id) setOpenThread(null) }
  }

  // ══ 댓글 ════════════════════════════════════════════════════════════════════

  const addComment = async (postId: string) => {
    const content = replyInputs[postId]?.trim()
    if (!content || !me) return
    const { data, error } = await sb.from('lounge_comments')
      .insert({ post_id: postId, user_id: me.id, author_name: me.name, content })
      .select().single()
    if (error || !data) return
    setPosts(posts.map(p => p.id === postId ? { ...p, comments: [...p.comments, data] } : p))
    setReplyInputs({ ...replyInputs, [postId]: '' })
  }

  const saveEditComment = async () => {
    if (!editComment?.val.trim()) return
    const { error } = await sb.from('lounge_comments')
      .update({ content: editComment.val.trim(), is_edited: true }).eq('id', editComment.id)
    if (error) return
    setPosts(posts.map(p => p.id === editComment.postId
      ? { ...p, comments: p.comments.map(c => c.id === editComment.id ? { ...c, content: editComment.val.trim(), is_edited: true } : c) }
      : p
    ))
    setEditComment(null)
  }

  const deleteComment = async (postId: string, commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return
    const { error } = await sb.from('lounge_comments').delete().eq('id', commentId)
    if (!error) setPosts(posts.map(p => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p))
  }

  // ══ 로딩 / 오류 상태 ════════════════════════════════════════════════════════
  if (authLoading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#454868', fontFamily: 'sans-serif' }}>인증 확인 중…</div>
  )

  // ══ 렌더 ════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '36px 28px 60px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: '#dde4f0', maxWidth: 1100 }}>
      <style>{`
        textarea:focus,input:focus,select:focus{outline:none}
        @keyframes glow{0%,100%{box-shadow:${SHO},0 0 12px rgba(251,191,36,.25)}50%{box-shadow:${SHO},0 0 24px rgba(251,191,36,.45)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>💬 SCHOOL LOUNGE</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.4px' }}>투자학교 학생 커뮤니티</h1>
      </div>

      {/* 교장의 한마디 배너 */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: '1px solid #4338ca', borderRadius: 14, padding: '16px 22px', marginBottom: 26, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 0 20px rgba(99,102,241,.2)' }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>🏹</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>교장의 한마디</div>
          <p style={{ fontSize: 13, color: '#c7d2fe', margin: 0, lineHeight: 1.6 }}>
            &ldquo;좋은 투자는 혼자 하는 것이 아닙니다. 함께 공부하고 인사이트를 나눌 때 더 강해집니다. 마음껏 질문하고 공유하세요!&rdquo;
          </p>
        </div>
        {me?.isAdmin && <span style={{ fontSize: 10, color: '#4338ca', background: 'rgba(99,102,241,.15)', border: '1px solid #4338ca', borderRadius: 6, padding: '3px 9px', fontWeight: 700, flexShrink: 0 }}>관리자 모드</span>}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f87171' }}>⚠️ {error} — <button onClick={fetchAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', textDecoration: 'underline', fontSize: 13 }}>재시도</button></div>}

      {/* 2컬럼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ════ 좌측: 공지사항 ════ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#dde4f0' }}>📌 공지사항</span>
            {me?.isAdmin && (
              <button onClick={() => setShowAddNotice(!showAddNotice)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: N, boxShadow: SHO, color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>
                <IcoPlus/> 추가
              </button>
            )}
          </div>

          {/* ── 공지 추가 폼 ── */}
          {me?.isAdmin && showAddNotice && (
            <div style={{ background: N, boxShadow: SHO, borderRadius: 12, padding: 16, marginBottom: 12, animation: 'fadeIn .2s' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.08em', marginBottom: 10 }}>📌 새 공지 작성</div>
              <select value={noticeTag} onChange={e => setNoticeTag(e.target.value)}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '7px 10px', fontSize: 12, marginBottom: 8, cursor: 'pointer' }}>
                <option>공지</option><option>필독</option><option>일정</option>
              </select>
              <input placeholder="공지 제목 *" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '8px 10px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' as const }}/>
              <textarea placeholder="본문 내용 (선택 — 상세 내용을 입력하세요)" value={noticeContent}
                onChange={e => setNoticeContent(e.target.value)} rows={4}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '8px 10px', fontSize: 12, marginBottom: 10, boxSizing: 'border-box' as const, resize: 'vertical', lineHeight: 1.6 }}/>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={addNotice} disabled={busy || !noticeTitle.trim()}
                  style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: noticeTitle.trim() ? 'pointer' : 'not-allowed', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: '#fff', fontSize: 12, fontWeight: 700, opacity: noticeTitle.trim() ? 1 : 0.5 }}>등록</button>
                <button onClick={() => { setShowAddNotice(false); setNoticeTitle(''); setNoticeContent('') }}
                  style={{ padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#13162a', boxShadow: SHI, color: '#6b7280', fontSize: 12 }}>취소</button>
              </div>
            </div>
          )}

          {/* ── 공지 수정 폼 ── */}
          {me?.isAdmin && editNotice && (
            <div style={{ background: N, boxShadow: SHO, borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid rgba(251,191,36,.3)', animation: 'fadeIn .2s' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.08em', marginBottom: 10 }}>✏️ 공지 수정</div>
              <select value={editNotice.tag} onChange={e => setEditNotice({ ...editNotice, tag: e.target.value })}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '7px 10px', fontSize: 12, marginBottom: 8, cursor: 'pointer' }}>
                <option>공지</option><option>필독</option><option>일정</option>
              </select>
              <input value={editNotice.title} onChange={e => setEditNotice({ ...editNotice, title: e.target.value })}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '8px 10px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' as const }}/>
              <textarea value={editNotice.content} onChange={e => setEditNotice({ ...editNotice, content: e.target.value })} rows={4}
                placeholder="본문 내용 (선택)"
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '8px 10px', fontSize: 12, marginBottom: 10, boxSizing: 'border-box' as const, resize: 'vertical', lineHeight: 1.6 }}/>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={saveEditNotice} disabled={busy || !editNotice.title.trim()}
                  style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#78350f,#f59e0b)', color: '#fff', fontSize: 12, fontWeight: 700 }}>저장</button>
                <button onClick={() => setEditNotice(null)}
                  style={{ padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#13162a', boxShadow: SHI, color: '#6b7280', fontSize: 12 }}>취소</button>
              </div>
            </div>
          )}

          {dataLoading ? (
            [1,2,3].map(i => <div key={i} style={{ height: 56, background: N, boxShadow: SHO, borderRadius: 11, marginBottom: 9, opacity: 0.5 }}/>)
          ) : notices.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#363855', fontSize: 12, padding: '24px 0' }}>공지사항이 없습니다</div>
          ) : notices.map(n => (
            <div key={n.id} style={{ background: N, boxShadow: SHO, borderRadius: 11, marginBottom: 9, animation: 'fadeIn .3s', overflow: 'hidden' }}>
              {/* 공지 헤더 행 */}
              <div
                onClick={() => n.content ? setExpandNotice(expandNotice === n.id ? null : n.id) : undefined}
                style={{ padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 9, cursor: n.content ? 'pointer' : 'default' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TAG_COLOR[n.tag] ?? '#60a5fa', background: `${TAG_COLOR[n.tag] ?? '#60a5fa'}18`, border: `1px solid ${TAG_COLOR[n.tag] ?? '#60a5fa'}44`, borderRadius: 5, padding: '2px 7px', flexShrink: 0, marginTop: 1 }}>{n.tag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#dde4f0', lineHeight: 1.4, marginBottom: 3 }}>
                    {n.title}
                    {n.is_edited && <span style={{ fontSize: 9, color: '#4b5563', marginLeft: 5 }}>(수정됨)</span>}
                    {n.content && (
                      <span style={{ fontSize: 9, color: '#60a5fa', marginLeft: 6 }}>{expandNotice === n.id ? '▲' : '▼'}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#454868' }}>{fmtDate(n.created_at)}</div>
                </div>
                {me?.isAdmin && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {/* 수정 버튼 */}
                    <button
                      onClick={() => { setEditNotice({ id: n.id, title: n.title, content: n.content ?? '', tag: n.tag }); setShowAddNotice(false) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.color='#fbbf24')}
                      onMouseLeave={e => (e.currentTarget.style.color='#4b5563')}>
                      <IcoPen/>
                    </button>
                    {/* 삭제 버튼 */}
                    <button onClick={() => deleteNotice(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 2 }} onMouseEnter={e => (e.currentTarget.style.color='#f87171')} onMouseLeave={e => (e.currentTarget.style.color='#4b5563')}>
                      <IcoTrash/>
                    </button>
                  </div>
                )}
              </div>
              {/* 본문 펼침 영역 */}
              {n.content && expandNotice === n.id && (
                <div style={{ padding: '0 13px 13px 13px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, marginTop: 0 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{n.content}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ════ 우측: 소통방 ════ */}
        <div>
          {/* 글쓰기 */}
          {me && (
            <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <textarea placeholder="투자 인사이트를 공유해보세요... 종목 분석, 시장 의견, 질문 모두 환영합니다 💬"
                value={newPost} onChange={e => setNewPost(e.target.value)} rows={3}
                style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 9, color: '#dde4f0', padding: '11px 13px', fontSize: 13, resize: 'none', lineHeight: 1.6, boxSizing: 'border-box' as const }}/>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={addPost} disabled={!newPost.trim() || busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', cursor: newPost.trim() ? 'pointer' : 'not-allowed', background: newPost.trim() ? 'linear-gradient(135deg,#78350f,#f59e0b)' : '#13162a', boxShadow: newPost.trim() ? '0 4px 14px rgba(245,158,11,.3)' : SHI, color: newPost.trim() ? '#fff' : '#454868', fontSize: 13, fontWeight: 700, transition: 'all .2s' }}>
                  <IcoSend/> 게시하기
                </button>
              </div>
            </div>
          )}

          {/* 피드 */}
          {dataLoading ? (
            [1,2].map(i => <div key={i} style={{ height: 120, background: N, boxShadow: SHO, borderRadius: 14, marginBottom: 14, opacity: 0.5 }}/>)
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {posts.length === 0 && <div style={{ textAlign: 'center', color: '#363855', fontSize: 13, padding: '40px 0' }}><div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>첫 번째 인사이트를 공유해보세요!</div>}

              {posts.map(post => (
                <div key={post.id} style={{ background: N, boxShadow: post.is_admin_post ? `${SHO},0 0 0 1px rgba(251,191,36,.35)` : SHO, borderRadius: 14, border: post.is_admin_post ? '1px solid rgba(251,191,36,.3)' : 'none', animation: post.is_admin_post ? 'glow 3s infinite' : 'fadeIn .3s', overflow: 'hidden' }}>

                  {/* 글 본문 or 수정 입력창 */}
                  <div style={{ padding: '16px 18px' }}>
                    {/* 작성자 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: post.is_admin_post ? 'linear-gradient(135deg,#92400e,#b45309)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {post.author_name[0]}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{post.author_name}</span>
                            {post.is_admin_post && <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.4)', borderRadius: 4, padding: '1px 6px' }}>교장</span>}
                            {post.is_edited && <span style={{ fontSize: 9, color: '#454868' }}>수정됨</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#454868' }}>{fmtDate(post.created_at)}</div>
                        </div>
                      </div>
                      {/* 수정/삭제 버튼 */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {canEdit(post.user_id) && !editPost && (
                          <button onClick={() => setEditPost({ id: post.id, val: post.content })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#454868', padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color='#60a5fa')} onMouseLeave={e => (e.currentTarget.style.color='#454868')}><IcoPen/></button>
                        )}
                        {canDelete(post.user_id) && (
                          <button onClick={() => deletePost(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#454868', padding: 4 }} onMouseEnter={e => (e.currentTarget.style.color='#f87171')} onMouseLeave={e => (e.currentTarget.style.color='#454868')}><IcoTrash/></button>
                        )}
                      </div>
                    </div>

                    {/* 본문 or 수정창 */}
                    {editPost?.id === post.id ? (
                      <div>
                        <textarea value={editPost.val} onChange={e => setEditPost({ ...editPost, val: e.target.value })} rows={3}
                          style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 9, color: '#dde4f0', padding: '10px 12px', fontSize: 13, resize: 'none', marginBottom: 8, boxSizing: 'border-box' as const }}/>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={saveEditPost} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: '#fff', fontSize: 12, fontWeight: 700 }}>저장</button>
                          <button onClick={() => setEditPost(null)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#13162a', boxShadow: SHI, color: '#6b7280', fontSize: 12 }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: '#dde4f0', lineHeight: 1.7, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                    )}

                    {/* 답글 토글 버튼 */}
                    {!editPost && (
                      <button onClick={() => setOpenThread(openThread === post.id ? null : post.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: openThread === post.id ? '#60a5fa' : '#454868', fontSize: 12, fontWeight: 600, padding: 0 }}>
                        <IcoReply/> 답글 {post.comments.length > 0 ? `(${post.comments.length})` : '달기'}
                      </button>
                    )}
                  </div>

                  {/* 스레드 */}
                  {openThread === post.id && (
                    <div style={{ borderTop: '1px solid #1e2140', background: '#13162a', padding: '14px 18px' }}>
                      {post.comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: 9, marginBottom: 12, animation: 'fadeIn .2s' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{c.author_name[0]}</div>
                          <div style={{ flex: 1, background: N, borderRadius: 9, padding: '9px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#dde4f0' }}>{c.author_name}</span>
                                {c.is_edited && <span style={{ fontSize: 9, color: '#454868' }}>수정됨</span>}
                                <span style={{ fontSize: 10, color: '#363855' }}>{fmtDate(c.created_at)}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {canEdit(c.user_id) && !editComment && (
                                  <button onClick={() => setEditComment({ id: c.id, postId: post.id, val: c.content })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#454868', padding: 2 }} onMouseEnter={e => (e.currentTarget.style.color='#60a5fa')} onMouseLeave={e => (e.currentTarget.style.color='#454868')}><IcoPen/></button>
                                )}
                                {canDelete(c.user_id) && (
                                  <button onClick={() => deleteComment(post.id, c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#454868', padding: 2 }} onMouseEnter={e => (e.currentTarget.style.color='#f87171')} onMouseLeave={e => (e.currentTarget.style.color='#454868')}><IcoTrash/></button>
                                )}
                              </div>
                            </div>
                            {editComment?.id === c.id ? (
                              <div>
                                <input value={editComment.val} onChange={e => setEditComment({ ...editComment, val: e.target.value })}
                                  style={{ width: '100%', background: '#13162a', boxShadow: SHI, border: 'none', borderRadius: 7, color: '#dde4f0', padding: '7px 10px', fontSize: 12, marginBottom: 7, boxSizing: 'border-box' as const }}/>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={saveEditComment} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>저장</button>
                                  <button onClick={() => setEditComment(null)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#0e1020', color: '#6b7280', fontSize: 11 }}>취소</button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{c.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* 답글 입력 */}
                      {me && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <textarea placeholder="답글을 입력하세요..." value={replyInputs[post.id] ?? ''} onChange={e => setReplyInputs({ ...replyInputs, [post.id]: e.target.value })} rows={2}
                            style={{ flex: 1, background: N, boxShadow: SHI, border: 'none', borderRadius: 8, color: '#dde4f0', padding: '9px 12px', fontSize: 12, resize: 'none', lineHeight: 1.5 }}/>
                          <button onClick={() => addComment(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1e3a5f,#3b82f6)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            <IcoSend/> 등록
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
