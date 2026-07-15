import { TK } from '@/lib/theme'
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
  slow_grower: TK.sub,
  stalwart: TK.blue500,
  fast_grower: TK.emerald500,
  cyclical: TK.amber500,
  turnaround: TK.red500,
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
