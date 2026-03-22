'use client'
import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function PerformanceChart({ userId }) {
  const [history, setHistory] = useState([])
  const [snpData, setSnpData] = useState([])
  const [period, setPeriod] = useState('1M')
  const [showSnp, setShowSnp] = useState(false)
  const [showPct, setShowPct] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChart()
  }, [period])

  useEffect(() => {
    if (showSnp) {
      loadSnp()
      setShowPct(true)
    }
  }, [showSnp, period])

  async function loadChart() {
    setLoading(true)
    try {
      const res = await fetch(`/api/chart?userId=${userId}&period=${period}`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch(e) {}
    setLoading(false)
  }

  async function loadSnp() {
    try {
      const res = await fetch(`/api/price?symbol=SPY`)
      const data = await res.json()
      if (data.price) {
        // Simuler une courbe S&P500 basée sur le prix actuel et la variation
        const points = history.map((h, i) => {
          const progress = i / Math.max(history.length - 1, 1)
          const variation = (data.change || 0) / 100
          return data.price * (1 - variation + variation * progress)
        })
        setSnpData(points)
      }
    } catch(e) {}
  }

  useEffect(() => {
    if (showSnp && history.length > 0) loadSnp()
  }, [history])

  const startValue = history.length > 0 ? history[0].total_value : 100000
  const startSnp = snpData.length > 0 ? snpData[0] : 1

  const portfolioValues = history.map(h =>
    showPct || showSnp
      ? ((h.total_value - startValue) / startValue * 100)
      : h.total_value
  )

  const snpValues = snpData.map(v =>
    ((v - startSnp) / startSnp * 100)
  )

  const labels = history.map(h =>
    new Date(h.recorded_at).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit',
      hour: history.length < 48 ? '2-digit' : undefined,
      minute: history.length < 48 ? '2-digit' : undefined,
    })
  )

  const datasets = [
    {
      label: 'Mon portefeuille',
      data: portfolioValues,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.4,
    }
  ]

  if (showSnp && snpValues.length > 0) {
    datasets.push({
      label: 'S&P 500 (SPY)',
      data: snpValues,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.05)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.4,
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: showSnp,
        labels: { color: '#9ca3af', font: { size: 12 } }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        titleColor: '#f9fafb',
        bodyColor: '#9ca3af',
        callbacks: {
          label: ctx => {
            const val = ctx.parsed.y
            if (showPct || showSnp) {
              return ` ${ctx.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
            }
            return ` $${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#6b7280', font: { size: 11 }, maxTicksLimit: 8 },
        grid: { display: false }
      },
      y: {
        ticks: {
          color: '#6b7280',
          font: { size: 11 },
          callback: v => showPct || showSnp ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : `$${(v/1000).toFixed(0)}k`
        },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  }

  const currentValue = history.length > 0 ? history[history.length - 1].total_value : 100000
  const perfPct = ((currentValue - startValue) / startValue * 100)

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-white mb-1">Performance du portefeuille</h3>
          {history.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">
                ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-semibold px-2 py-1 rounded ${perfPct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {perfPct >= 0 ? '+' : ''}{perfPct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* CONTRÔLES */}
        <div className="flex items-center gap-4 flex-wrap">

          {/* Toggle % */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => !showSnp && setShowPct(!showPct)}
              className={`w-10 h-5 rounded-full transition-colors relative ${showPct || showSnp ? 'bg-emerald-500' : 'bg-gray-600'} ${showSnp ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${showPct || showSnp ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
            </div>
            <span className="text-gray-400 text-sm">Afficher en %</span>
          </label>

          {/* Toggle S&P500 */}
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSnp(!showSnp)}>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${showSnp ? 'bg-indigo-500' : 'bg-gray-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${showSnp ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
            </div>
            <span className="text-gray-400 text-sm">Comparer S&P 500</span>
          </label>

          {/* Périodes */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {['1W','1M','3M','6M','1Y','ALL'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${period === p ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRAPHIQUE */}
      <div className="h-64">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : history.length < 2 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <p className="mb-2">Pas encore assez de données</p>
            <p className="text-sm text-gray-500">Le graphique se remplit automatiquement au fil du temps</p>
          </div>
        ) : (
          <Line data={{ labels, datasets }} options={options} />
        )}
      </div>
    </div>
  )
}