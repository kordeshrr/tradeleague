import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
export async function POST(request) {
  const { userId, ticker, action, qty, price, total } = await request.json()

  // Charger le portefeuille
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!portfolio) return Response.json({ error: 'Portefeuille introuvable' }, { status: 404 })

  // Charger la position existante
  const { data: holding } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .single()

  if (action === 'buy') {
    // Vérifier le pouvoir d'achat
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', userId)

    const unrealized = (allHoldings || []).reduce((acc, h) => acc + (h.quantity * h.avg_price) - h.total_cost, 0)
    const buyingPower = portfolio.cash + Math.max(0, unrealized)

    if (total > buyingPower) {
      return Response.json({ error: `Pouvoir d'achat insuffisant. Disponible: $${buyingPower.toFixed(2)}` }, { status: 400 })
    }

    // Mettre à jour le cash
    const newCash = Math.max(0, portfolio.cash - total)
    await supabase.from('portfolios').update({ cash: newCash, updated_at: new Date() }).eq('user_id', userId)

    // Mettre à jour ou créer la position
    if (holding) {
      const newQty = holding.quantity + qty
      const newCost = holding.total_cost + total
      const newAvg = newCost / newQty
      await supabase.from('holdings').update({
        quantity: newQty,
        avg_price: newAvg,
        total_cost: newCost,
        updated_at: new Date()
      }).eq('id', holding.id)
    } else {
      await supabase.from('holdings').insert({
        user_id: userId,
        ticker,
        quantity: qty,
        avg_price: price,
        total_cost: total
      })
    }

    // Enregistrer la transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      ticker,
      type: 'buy',
      quantity: qty,
      price,
      total,
      pnl: 0
    })

    return Response.json({ message: `✓ Acheté ${qty} × ${ticker} à $${price.toFixed(2)}` })

  } else {
    // VENDRE
    if (!holding || holding.quantity < qty) {
      return Response.json({ error: `Pas assez de ${ticker} en portefeuille` }, { status: 400 })
    }

    const pnl = (price - holding.avg_price) * qty
    const newCash = portfolio.cash + total
    await supabase.from('portfolios').update({ cash: newCash, updated_at: new Date() }).eq('user_id', userId)

    const newQty = holding.quantity - qty
    if (newQty === 0) {
      await supabase.from('holdings').delete().eq('id', holding.id)
    } else {
      await supabase.from('holdings').update({
        quantity: newQty,
        total_cost: holding.avg_price * newQty,
        updated_at: new Date()
      }).eq('id', holding.id)
    }

    await supabase.from('transactions').insert({
      user_id: userId,
      ticker,
      type: 'sell',
      quantity: qty,
      price,
      total,
      pnl
    })

    return Response.json({ message: `✓ Vendu ${qty} × ${ticker} à $${price.toFixed(2)} (P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})` })
  }
}