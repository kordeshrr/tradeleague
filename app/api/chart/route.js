import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  const { userId, totalValue, cash, marketValue } = await request.json()

  await supabase.from('portfolio_history').insert({
    user_id: userId,
    total_value: totalValue,
    cash,
    market_value: marketValue
  })

  return Response.json({ ok: true })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const period = searchParams.get('period') || '1M'

  const periodMap = {
    '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 9999
  }
  const days = periodMap[period] || 30
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await supabase
    .from('portfolio_history')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  return Response.json({ history: data || [] })
}