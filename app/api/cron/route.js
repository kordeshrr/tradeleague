import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  // Vérifier la clé secrète pour sécuriser le cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    // Récupérer tous les portefeuilles avec leurs positions
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('*, portfolios(cash, starting_capital)')

    if (!allHoldings?.length) {
      return Response.json({ ok: true, message: 'Aucune position' })
    }

    // Grouper par utilisateur
    const byUser = {}
    for (const h of allHoldings) {
      if (!byUser[h.user_id]) {
        byUser[h.user_id] = {
          holdings: [],
          cash: h.portfolios?.cash || 0,
          startingCapital: h.portfolios?.starting_capital || 100000
        }
      }
      byUser[h.user_id].holdings.push(h)
    }

    // Pour chaque utilisateur, récupérer les prix et sauvegarder
    const results = []
    for (const [userId, data] of Object.entries(byUser)) {
      let marketValue = 0

      for (const h of data.holdings) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/price?symbol=${h.ticker}`,
            { next: { revalidate: 0 } }
          )
          const priceData = await res.json()
          if (priceData.price) {
            marketValue += h.quantity * priceData.price
          } else {
            marketValue += h.quantity * h.avg_price
          }
        } catch(e) {
          marketValue += h.quantity * h.avg_price
        }
      }

      const totalValue = data.cash + marketValue

      // Sauvegarder dans portfolio_history
      await supabase.from('portfolio_history').insert({
        user_id: userId,
        total_value: totalValue,
        cash: data.cash,
        market_value: marketValue
      })

      results.push({ userId, totalValue })
    }

    return Response.json({ ok: true, updated: results.length, results })
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}