'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function History() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth')
      else loadHistory(session.user.id)
    })
  }, [])

  async function loadHistory(userId) {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  const totalPnl = transactions.filter(t => t.type === 'sell').reduce((acc, t) => acc + (t.pnl || 0), 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold"><a href="/">Trade<span className="text-emerald-400">League</span></a></h1>
        <div className="flex gap-6">
          <a href="/" className="text-gray-400 hover:text-white text-sm">Trader</a>
          <a href="/portfolio" className="text-gray-400 hover:text-white text-sm">Portefeuille</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Historique des transactions</h2>
          <div className={`px-4 py-2 rounded-lg font-semibold ${totalPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            P&L réalisé : {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Aucune transaction enregistrée</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Type','Ticker','Quantité','Prix','Total','P&L','Date'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {tx.type === 'buy' ? 'ACHAT' : 'VENTE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{tx.ticker}</td>
                    <td className="px-6 py-4 text-gray-300">{tx.quantity}</td>
                    <td className="px-6 py-4 text-gray-300">${tx.price.toFixed(2)}</td>
                    <td className="px-6 py-4">${tx.total.toFixed(2)}</td>
                    <td className={`px-6 py-4 font-semibold ${tx.pnl >= 0 ? 'text-emerald-400' : tx.pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {tx.pnl !== 0 ? `${tx.pnl >= 0 ? '+' : ''}$${tx.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(tx.created_at).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}