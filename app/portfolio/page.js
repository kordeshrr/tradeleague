'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState(null)
  const [holdings, setHoldings] = useState([])
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth')
      else loadData(session.user.id)
    })
  }, [])

  async function loadData(userId) {
    const { data: port } = await supabase.from('portfolios').select('*').eq('user_id', userId).single()
    const { data: hold } = await supabase.from('holdings').select('*').eq('user_id', userId)
    setPortfolio(port)
    setHoldings(hold || [])
  }

  const marketValue = holdings.reduce((acc, h) => acc + (h.quantity * h.avg_price), 0)
  const totalCost = holdings.reduce((acc, h) => acc + h.total_cost, 0)
  const unrealized = marketValue - totalCost
  const totalPortfolio = portfolio ? portfolio.cash + marketValue : 0
  const totalGain = totalPortfolio - 100000
  const buyingPower = portfolio ? portfolio.cash + Math.max(0, unrealized) : 0

  if (!portfolio) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold"><a href="/">Trade<span className="text-emerald-400">League</span></a></h1>
        <div className="flex gap-6">
          <a href="/" className="text-gray-400 hover:text-white text-sm">Trader</a>
          <a href="/history" className="text-gray-400 hover:text-white text-sm">Historique</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Mon Portefeuille</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total portefeuille', value: `$${totalPortfolio.toFixed(2)}` },
            { label: 'Cash disponible', value: `$${portfolio.cash.toFixed(2)}` },
            { label: '⚡ Pouvoir d\'achat', value: `$${buyingPower.toFixed(2)}`, highlight: true },
            { label: 'Gain total', value: `${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)}`, positive: totalGain >= 0 },
          ].map((m, i) => (
            <div key={i} className={`rounded-xl p-4 border ${m.highlight ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-800 bg-gray-900'}`}>
              <p className={`text-xs uppercase tracking-wider mb-1 ${m.highlight ? 'text-emerald-400' : 'text-gray-400'}`}>{m.label}</p>
              <p className={`text-xl font-bold ${m.positive === true ? 'text-emerald-400' : m.positive === false ? 'text-red-400' : 'text-white'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-semibold">Gains latents réinvestissables</h3>
          </div>
          <div className="px-6 py-4 flex justify-between items-center border-b border-gray-800">
            <span className="text-gray-400">Gains latents</span>
            <span className={`font-semibold ${unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealized >= 0 ? '+' : ''}${unrealized.toFixed(2)}
            </span>
          </div>
          <div className="px-6 py-4 flex justify-between items-center">
            <span className="font-semibold">Pouvoir d'achat total</span>
            <span className="text-emerald-400 font-bold text-xl">${buyingPower.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-semibold">Positions ouvertes — {holdings.length}</h3>
          </div>
          {holdings.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Aucune position ouverte</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Ticker','Quantité','Prix moy.','Valeur','Coût','P&L','%'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const val = h.quantity * h.avg_price
                  const pnl = val - h.total_cost
                  const pct = h.total_cost > 0 ? (pnl / h.total_cost * 100) : 0
                  return (
                    <tr key={h.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="px-6 py-4 font-bold">{h.ticker}</td>
                      <td className="px-6 py-4 text-gray-300">{h.quantity}</td>
                      <td className="px-6 py-4 text-gray-300">${h.avg_price.toFixed(2)}</td>
                      <td className="px-6 py-4">${val.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-400">${h.total_cost.toFixed(2)}</td>
                      <td className={`px-6 py-4 font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 text-sm ${pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}