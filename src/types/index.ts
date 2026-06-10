export type PeterLynchCategory =
  | 'slow_grower'
  | 'stalwart'
  | 'fast_grower'
  | 'cyclical'
  | 'turnaround'
  | 'asset_play'

export const PETER_LYNCH_LABELS: Record<PeterLynchCategory, string> = {
  slow_grower: '저성장주',
  stalwart: '대형 우량주',
  fast_grower: '빠른 성장주',
  cyclical: '경기 순환주',
  turnaround: '회생 기업주',
  asset_play: '자산 보유주',
}

export const PETER_LYNCH_COLORS: Record<PeterLynchCategory, string> = {
  slow_grower: '#8a9aaa',
  stalwart: '#3B82F6',
  fast_grower: '#10B981',
  cyclical: '#F59E0B',
  turnaround: '#EF4444',
  asset_play: '#8B5CF6',
}

export type AssetType = 'stock' | 'crypto'

export interface Holding {
  id: string
  user_id: string
  name: string
  ticker: string
  asset_type: AssetType
  quantity: number
  purchase_price: number
  purchase_date: string
  current_price: number | null
  peter_lynch_category: PeterLynchCategory | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
}
