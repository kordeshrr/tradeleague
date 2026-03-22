'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Orders() {
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [ticker, setTicker] = useState('')
  const [type, setType] = useState('buy')
  const [quantity, setQuantity] = useState(1)
  const [limitPrice, setLimitPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth')
      else { setUser(session.user); loadOrders(session.user.id) }
    })
  }, [])

  // Vérifier les ordres toutes les 30 secondes
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => checkOrders(), 30000)
    return () => clearInterval(interval)
  }, [user])

  async function loadOrders(userId) {
    const res = await fetch(`/api/orders?userId=${userId}`)
    const data = await res.json()
    setOrders(data.orders || [])
  }

  async function checkOrders() {
    if (!user) return
    const res = await fetch('/api/orders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
    const data = await res.json()
    if (data.executed?.length > 0) {
      data.executed.forEach(e => {
        setMsg({ text: `✓ Ordre exécuté ! ${e.type === 'buy' ? 'Acheté' : 'Vendu'} ${e.qty} × ${e.ticker} à $${e.price.toFixed(2)}`, ok: true })
      })
      loadOrders(user.id)
    }
  }

  async function fetchCurrentPrice() {
    if (!ticker) return
    setLoading(true)
    const res = await fetch(`/api/price?symbol=${ticker.toUpperCase()}`)
    const data = await res.json()
    if (data.price) {
      setCurrentPrice(data.price)
      setLimitPrice(data.price.toFixed(2))
    }
    setLoading(false)
  }

  async function createOrder() {
    if (!ticker || !limitPrice || !user) return
    setLoading(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        ticker: ticker.toUpperCase(),
        type,
        quantity: Number(quantity),
        limitPrice: Number(limitPrice)
      })
    })
    const data = await res.json()
    if (data.error) setMsg({ text: data.error, ok: false })
    else {
      setMsg({ text: data.message, ok: true })
      loadOrders(user.id)
      setTicker('')
      setLimitPrice('')
      setCurrentPrice(null)
    }
    setLoading(false)
  }

  async function cancelOrder(id) {
    await fetch(`/api/orders?id=${id}`, { method: 'DELETE' })
    loadOrders(user.id)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold"><a href="/">Trade<span className="text-emerald-400">League</span></a></h1>
        <div className="flex gap-6">
          <a href="/" className="text-gray-400 hover:text-white text-sm">Trader</a>
          <a href="/portfolio" className="text-gray-400 hover:text-white text-sm">Portefeuille</a>
          <a href="/history" className="text-gray-400 hover:text-white text-sm">Historique</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="text-gray-400 hover:text-red-400 text-sm">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Ordres Limites</h2>

        {/* CRÉER UN ORDRE */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
          <h3 className="font-semibold mb-4 text-gray-300">Créer un ordre limite</h3>

          {msg.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${msg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Ticker</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onBlur={fetchCurrentPrice}
                onKeyDown={e => e.key === 'Enter' && fetchCurrentPrice()}
                placeholder="AAPL, BTC-USD..."
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none">
                <option value="buy">Achat limite</option>
                <option value="sell">Vente limite</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Quantité</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">
                Prix limite {currentPrice && <span className="text-gray-500 normal-case">(actuel: ${currentPrice.toFixed(2)})</span>}
              </label>
              <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                placeholder="0.00" step="0.01"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:border-emerald-500 outline-none" />
            </div>
          </div>

          {/* EXPLICATION */}
          {limitPrice && currentPrice && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm text-gray-400">
              {type === 'buy'
                ? `📋 Achètera ${quantity} × ${ticker || '...'} automatiquement quand le prix descend à $${limitPrice} ou moins`
                : `📋 Vendra ${quantity} × ${ticker || '...'} automatiquement quand le prix monte à $${limitPrice} ou plus`
              }
            </div>
          )}

          <button onClick={createOrder} disabled={loading || !ticker || !limitPrice}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-all">
            {loading ? 'Création...' : 'Créer l\'ordre'}
          </button>
        </div>

        {/* ORDRES EN ATTENTE */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold">Ordres en attente</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-gray-400 text-xs">Vérification auto toutes les 30 sec</span>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Aucun ordre en attente</p>
              <p className="text-gray-500 text-sm mt-1">Créez un ordre limite ci-dessus</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Type','Ticker','Quantité','Prix limite','Total estimé','Créé le','Action'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${o.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {o.type === 'buy' ? 'ACHAT' : 'VENTE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{o.ticker}</td>
                    <td className="px-6 py-4 text-gray-300">{o.quantity}</td>
                    <td className="px-6 py-4 text-white font-medium">${o.limit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">${(o.quantity * o.limit_price).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{new Date(o.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => cancelOrder(o.id)}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors">
                        Annuler
                      </button>
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