'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PerformanceChart from './components/PerformanceChart'

export default function Home() {
  const [user, setUser] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [ticker, setTicker] = useState('')
  const [price, setPrice] = useState(null)
  const [priceChange, setPriceChange] = useState(null)
  const [qty, setQty] = useState(1)
  const [action, setAction] = useState('buy')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const holdingsRef = useRef([])
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth')
      else { setUser(session.user); loadPortfolio(session.user.id) }
    })
  }, [])

  useEffect(() => {
    if (user && portfolio) {
      saveHistory()
      const interval = setInterval(saveHistory, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user, portfolio, holdings])

  useEffect(() => { holdingsRef.current = holdings }, [holdings])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      if (holdingsRef.current.length > 0) refreshPrices()
    }, 30000)
    return () => clearInterval(interval)
  }, [user])

  async function refreshPrices() {
    if (!holdingsRef.current.length) return
    setRefreshing(true)
    const newPrices = {}
    for (const h of holdingsRef.current) {
      try {
        const res = await fetch(`/api/price?symbol=${h.ticker}`)
        const data = await res.json()
        if (data.price) newPrices[h.ticker] = { price: data.price, change: data.change }
      } catch(e) {}
    }
    setLivePrices(prev => ({ ...prev, ...newPrices }))
    setLastRefresh(new Date())
    setRefreshing(false)
  }

  async function saveHistory() {
    if (!user || !portfolio) return
    const mv = holdingsRef.current.reduce((acc, h) => {
      const lp = livePrices[h.ticker]?.price || h.avg_price
      return acc + (h.quantity * lp)
    }, 0)
    try {
      await fetch('/api/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          totalValue: portfolio.cash + mv,
          cash: portfolio.cash,
          marketValue: mv
        })
      })
    } catch(e) {}
  }

  async function loadPortfolio(userId) {
    const { data: port } = await supabase.from('portfolios').select('*').eq('user_id', userId).single()
    setPortfolio(port)
    const { data: hold } = await supabase.from('holdings').select('*').eq('user_id', userId)
    setHoldings(hold || [])
if (hold?.length > 0) {
  setTimeout(() => refreshPrices(), 500)
}
  }

  async function searchTicker(value) {
    setTicker(value)
    setPrice(null)
    if (value.length < 2) { setSuggestions([]); return }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
      const data = await res.json()
      setSuggestions(data.results || [])
      setShowSuggestions(true)
    } catch(e) {}
  }

  async function fetchPrice(sym) {
    const t = (sym || ticker).toUpperCase().trim()
    if (!t) return
    setLoading(true)
    setPrice(null)
    try {
      const res = await fetch(`/api/price?symbol=${t}`)
      const data = await res.json()
      if (data.price) {
        setPrice(data.price)
        setPriceChange(data.change)
        setTicker(t)
        setLivePrices(prev => ({ ...prev, [t]: { price: data.price, change: data.change } }))
      } else {
        setMsg({ text: data.error || 'Ticker introuvable', ok: false })
      }
    } catch(e) {
      setMsg({ text: 'Erreur de connexion', ok: false })
    }
    setLoading(false)
  }

  async function executeTrade() {
    if (!price || !user) return
    setLoading(true)
    const total = price * qty
    const res = await fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ticker: ticker.toUpperCase(), action, qty: Number(qty), price, total })
    })
    const data = await res.json()
    if (data.error) setMsg({ text: data.error, ok: false })
    else { setMsg({ text: data.message, ok: true }); loadPortfolio(user.id); saveHistory() }
    setLoading(false)
  }

  // ══ TRI ══
  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function getSortValue(h, col) {
    const liveData = livePrices[h.ticker]
    const currentPrice = liveData?.price || h.avg_price
    const val = h.quantity * currentPrice
    const pnl = val - h.total_cost
    const pnlPct = h.total_cost > 0 ? (pnl / h.total_cost * 100) : 0
    switch(col) {
      case 'ticker':    return h.ticker
      case 'qty':       return h.quantity
      case 'avgPrice':  return h.avg_price
      case 'current':   return currentPrice
      case 'change':    return liveData?.change || 0
      case 'value':     return val
      case 'pnl':       return pnl
      case 'pnlPct':    return pnlPct
      default:          return 0
    }
  }

  const sortedHoldings = [...holdings].sort((a, b) => {
    if (!sortCol) return 0
    const va = getSortValue(a, sortCol)
    const vb = getSortValue(b, sortCol)
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir === 'asc' ? va - vb : vb - va
  })

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-gray-600 ml-1">↕</span>
    return <span className="text-emerald-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const marketValue = holdings.reduce((acc, h) => {
    const lp = livePrices[h.ticker]?.price || h.avg_price
    return acc + (h.quantity * lp)
  }, 0)
  const totalCost = holdings.reduce((acc, h) => acc + h.total_cost, 0)
  const unrealized = marketValue - totalCost
  const totalPortfolio = portfolio ? portfolio.cash + marketValue : 0
  const totalGain = totalPortfolio - 100000
  const buyingPower = portfolio ? portfolio.cash + Math.max(0, unrealized) : 0

  if (!portfolio) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-4">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-white">Chargement...</p>
      <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm mt-4">
        Retour à la connexion
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Trade<span className="text-emerald-400">League</span></h1>
        <div className="flex gap-6 items-center">
          {lastRefresh && (
            <span className="text-gray-500 text-xs">
              {refreshing ? '🔄 Actualisation...' : `Mis à jour ${lastRefresh.toLocaleTimeString('fr-FR')}`}
            </span>
          )}
          <a href="/portfolio" className="text-gray-400 hover:text-white text-sm">Portefeuille</a>
          <a href="/history" className="text-gray-400 hover:text-white text-sm">Historique</a>
          <a href="/orders" className="text-gray-400 hover:text-white text-sm transition-colors">Ordres</a>
          <a href="/leaderboard" className="text-gray-400 hover:text-white text-sm transition-colors">🏆 Classement</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Portefeuille total', value: `$${totalPortfolio.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` },
            { label: 'Cash', value: `$${portfolio.cash.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` },
            { label: '⚡ Pouvoir d\'achat', value: `$${buyingPower.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`, highlight: true },
            { label: 'Gains latents', value: `${unrealized >= 0 ? '+' : ''}$${unrealized.toFixed(2)}`, positive: unrealized >= 0 },
            { label: 'Gain total', value: `${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)}`, positive: totalGain >= 0 },
          ].map((m, i) => (
            <div key={i} className={`rounded-xl p-4 border ${m.highlight ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-800 bg-gray-900'}`}>
              <p className={`text-xs uppercase tracking-wider mb-1 ${m.highlight ? 'text-emerald-400' : 'text-gray-400'}`}>{m.label}</p>
              <p className={`text-lg font-bold ${m.positive === true ? 'text-emerald-400' : m.positive === false ? 'text-red-400' : 'text-white'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {user && <PerformanceChart userId={user.id} />}

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
          {msg.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${msg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {msg.text}
            </div>
          )}
          <div className="flex gap-3 flex-wrap items-end">
            <div className="relative flex-1 min-w-64">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Ticker ou nom d'entreprise</label>
              <input
                value={ticker}
                onChange={e => searchTicker(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPrice()}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="AAPL, Apple, LVMH, Bitcoin..."
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none transition-colors"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-700 rounded-xl mt-1 z-50 max-h-64 overflow-y-auto shadow-2xl">
                  {suggestions.map((s, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0"
                      onMouseDown={() => { setTicker(s.symbol); setSuggestions([]); setShowSuggestions(false); fetchPrice(s.symbol) }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white">{s.symbol}</span>
                          <span className="text-gray-400 text-sm ml-2">{s.name}</span>
                        </div>
                        <span className="text-gray-500 text-xs bg-gray-700 px-2 py-1 rounded">{s.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-24">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Quantité</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none" />
            </div>
            <div className="w-32">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Action</label>
              <select value={action} onChange={e => setAction(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none">
                <option value="buy">Acheter</option>
                <option value="sell">Vendre</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block opacity-0">x</label>
              <div className="flex gap-2">
                <button onClick={() => fetchPrice()} disabled={loading || !ticker}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-3 rounded-lg font-medium">
                  {loading ? '...' : 'Prix'}
                </button>
                <button onClick={executeTrade} disabled={!price || loading}
                  className={`px-6 py-3 rounded-lg font-semibold disabled:opacity-50 ${action === 'buy' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
                  {price ? `${action === 'buy' ? 'Acheter' : 'Vendre'} — $${(price * qty).toFixed(2)}` : action === 'buy' ? 'Acheter' : 'Vendre'}
                </button>
              </div>
            </div>
          </div>
          {price && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-gray-400 text-sm">{ticker}</span>
              <span className="text-white font-bold text-lg">${price.toFixed(price < 1 ? 4 : 2)}</span>
              {priceChange !== null && (
                <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
              <span className="text-gray-500 text-xs">● live</span>
            </div>
          )}
        </div>

        {/* POSITIONS OUVERTES avec TRI */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold">Positions ouvertes</h2>
            <div className="flex items-center gap-3">
              <button onClick={refreshPrices} disabled={refreshing}
                className="text-gray-400 hover:text-emerald-400 text-xs disabled:opacity-50">
                {refreshing ? '🔄 Actualisation...' : '↻ Actualiser'}
              </button>
              <span className="text-gray-400 text-sm">{holdings.length} position{holdings.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          {holdings.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-2">Aucune position ouverte</p>
              <p className="text-gray-500 text-sm">Recherchez une action ou une crypto pour commencer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    {[
                      { label: 'Ticker',       col: 'ticker'   },
                      { label: 'Quantité',     col: 'qty'      },
                      { label: 'Prix achat',   col: 'avgPrice' },
                      { label: 'Prix actuel',  col: 'current'  },
                      { label: 'Variation',    col: 'change'   },
                      { label: 'Valeur',       col: 'value'    },
                      { label: 'P&L $',        col: 'pnl'      },
                    ].map(({ label, col }) => (
                      <th key={col}
                        onClick={() => handleSort(col)}
                        className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none transition-colors"
                      >
                        {label}<SortIcon col={col} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map(h => {
                    const liveData = livePrices[h.ticker]
                    const currentPrice = liveData?.price || h.avg_price
                    const val = h.quantity * currentPrice
                    const pnl = val - h.total_cost
                    const pnlPct = h.total_cost > 0 ? (pnl / h.total_cost * 100) : 0
                    const dayChange = liveData?.change || 0
                    return (
                      <tr key={h.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">{h.ticker}</td>
                        <td className="px-6 py-4 text-gray-300">{h.quantity}</td>
                        <td className="px-6 py-4 text-gray-400">${h.avg_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-white font-medium">
                          ${currentPrice.toFixed(currentPrice < 1 ? 4 : 2)}
                          {liveData && <span className="ml-1 text-xs text-emerald-400">●</span>}
                        </td>
                        <td className={`px-6 py-4 text-sm font-medium ${dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {liveData ? `${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-6 py-4 text-white">${val.toFixed(2)}</td>
                        <td className={`px-6 py-4 font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}