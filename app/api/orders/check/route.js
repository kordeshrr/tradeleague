import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  const { userId } = await request.json()
  const executed = []

  // Récupérer tous les ordres en attente
  const { data: orders } = await supabase
    .from('limit_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (!orders?.length) return Response.json({ executed: [] })

  // Récupérer le portefeuille
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .single()

  for (const order of orders) {
    try {
      // Récupérer le prix actuel
      const priceRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/price?symbol=${order.ticker}`)
      const priceData = await priceRes.json()
      if (!priceData.price) continue

      const currentPrice = priceData.price
      const shouldExecute =
        (order.type === 'buy'  && currentPrice <= order.limit_price) ||
        (order.type === 'sell' && currentPrice >= order.limit_price)

      if (!shouldExecute) continue

      // Exécuter le trade
      const tradeRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ticker: order.ticker,
          action: order.type,
          qty: order.quantity,
          price: currentPrice,
          total: currentPrice * order.quantity
        })
      })
      const tradeData = await tradeRes.json()

      if (!tradeData.error) {
        await supabase
          .from('limit_orders')
          .update({ status: 'executed', executed_at: new Date() })
          .eq('id', order.id)
        executed.push({ ticker: order.ticker, type: order.type, price: currentPrice, qty: order.quantity })
      }
    } catch(e) {}
  }

  return Response.json({ executed })
}