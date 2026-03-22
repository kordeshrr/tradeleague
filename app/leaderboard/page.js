'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Leaderboard() {
  const [players, setPlayers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth')
      else { setCurrentUser(session.user); loadLeaderboard(session.user.id) }
    })
  }, [])

  useEffect(() => {
    if (currentUser) loadLeaderboard(currentUser.id)
  }, [period])

  async function loadLeaderboard(userId) {
  setLoading(true)
  const { data: portfolios } = await supabase
    .from('portfolio_totals')
    .select('*, profiles(username)')

  if (!portfolios) { setLoading(false); return }

  const ranked = portfolios
    .map(p => ({
      userId: p.user_id,
      username: p.profiles?.username || 'Anonyme',
      total: p.total_value,
      gain: p.total_value - p.starting_capital,
      gainPct: ((p.total_value - p.starting_capital) / p.starting_capital * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  setPlayers(ranked)
  const myRankData = ranked.find(p => p.userId === userId)
  setMyRank(myRankData)
  setLoading(false)
}

  function getMedal(rank) {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  function getRankColor(rank) {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold"><a href="/">Trade<span className="text-emerald-400">League</span></a></h1>
        <div className="flex gap-6">
          <a href="/" className="text-gray-400 hover:text-white text-sm">Trader</a>
          <a href="/portfolio" className="text-gray-400 hover:text-white text-sm">Portefeuille</a>
          <a href="/history" className="text-gray-400 hover:text-white text-sm">Historique</a>
          <a href="/orders" className="text-gray-400 hover:text-white text-sm">Ordres</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">🏆 Classement</h2>
            <p className="text-gray-400 mt-1">Les meilleurs traders de TradeLeague</p>
          </div>
        </div>

        {/* MA POSITION */}
        {myRank && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-xl font-bold text-emerald-400">
                  {myRank.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-emerald-400 font-medium">Ma position</p>
                  <p className="text-white font-bold text-lg">{myRank.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase">Rang</p>
                  <p className={`text-2xl font-bold ${getRankColor(myRank.rank)}`}>{getMedal(myRank.rank)}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase">Total</p>
                  <p className="text-white font-bold">${myRank.total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase">Performance</p>
                  <p className={`font-bold text-lg ${myRank.gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {myRank.gainPct >= 0 ? '+' : ''}{myRank.gainPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLEAU DU CLASSEMENT */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-semibold">Top Traders</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Rang','Trader','Portefeuille total','Gain/Perte','Performance'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.userId}
                    className={`border-t border-gray-800 transition-colors ${p.userId === currentUser?.id ? 'bg-emerald-500/5' : 'hover:bg-gray-800/30'}`}>
                    <td className="px-6 py-4">
                      <span className={`text-xl font-bold ${getRankColor(p.rank)}`}>{getMedal(p.rank)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-white">{p.username}</span>
                          {p.userId === currentUser?.id && (
                            <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Vous</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      ${p.total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className={`px-6 py-4 font-semibold ${p.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.gain >= 0 ? '+' : ''}${Math.abs(p.gain).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${p.gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.gainPct >= 0 ? '+' : ''}{p.gainPct.toFixed(2)}%
                        </span>
                        <div className="flex-1 max-w-24 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${p.gainPct >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(Math.abs(p.gainPct) * 2, 100)}%` }}
                          />
                        </div>
                      </div>
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