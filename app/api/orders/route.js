import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Récupérer les ordres
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const { data } = await supabase
    .from('limit_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  return Response.json({ orders: data || [] })
}

// Créer un ordre
export async function POST(request) {
  const { userId, ticker, type, quantity, limitPrice } = await request.json()
  const { data, error } = await supabase
    .from('limit_orders')
    .insert({ user_id: userId, ticker, type, quantity, limit_price: limitPrice })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ order: data, message: `✓ Ordre limite ${type === 'buy' ? 'achat' : 'vente'} créé — ${ticker} à $${limitPrice}` })
}

// Annuler un ordre
export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('id')
  await supabase.from('limit_orders').update({ status: 'cancelled' }).eq('id', orderId)
  return Response.json({ message: 'Ordre annulé' })
}