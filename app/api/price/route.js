export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.toUpperCase().trim()

  if (!symbol) {
    return Response.json({ error: 'Symbol requis' }, { status: 400 })
  }

  // ══ 1. CRYPTO → CoinGecko (sans clé, gratuit) ══
  const cryptoIds = {
    'BTC-USD':'bitcoin','ETH-USD':'ethereum','BNB-USD':'binancecoin',
    'SOL-USD':'solana','XRP-USD':'ripple','ADA-USD':'cardano',
    'DOGE-USD':'dogecoin','SHIB-USD':'shiba-inu','AVAX-USD':'avalanche-2',
    'DOT-USD':'polkadot','MATIC-USD':'matic-network','LINK-USD':'chainlink',
    'UNI-USD':'uniswap','AAVE-USD':'aave','LTC-USD':'litecoin',
    'BCH-USD':'bitcoin-cash','ATOM-USD':'cosmos','ALGO-USD':'algorand',
    'APT-USD':'aptos','OP-USD':'optimism','ARB-USD':'arbitrum',
    'SUI-USD':'sui','NEAR-USD':'near','ICP-USD':'internet-computer',
    'FTM-USD':'fantom','ETC-USD':'ethereum-classic','XMR-USD':'monero',
    'HBAR-USD':'hedera-hashgraph','XLM-USD':'stellar','RUNE-USD':'thorchain',
    'INJ-USD':'injective-protocol','MKR-USD':'maker','TIA-USD':'celestia',
    'JUP-USD':'jupiter-exchange-solana','WLD-USD':'worldcoin-wld',
    'PEPE-USD':'pepe','FLOKI-USD':'floki','BONK-USD':'bonk',
    'SEI-USD':'sei-network','PYTH-USD':'pyth-network',
  }

  if (cryptoIds[symbol]) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds[symbol]}&vs_currencies=usd&include_24hr_change=true`,
        { next: { revalidate: 30 } }
      )
      const data = await res.json()
      const id = cryptoIds[symbol]
      if (data[id]?.usd > 0) {
        return Response.json({
          price: data[id].usd,
          change: data[id].usd_24h_change || 0,
          symbol
        })
      }
    } catch(e) {}
  }

  const finnhubKey = process.env.NEXT_PUBLIC_FINNHUB_KEY

  // ══ 2. Convertir suffixes de bourse → format Finnhub ══
  // Finnhub utilise le format EXCHANGE:TICKER
  // Ex: MC.PA → ENXTPA:MC
  //     SAP.DE → FWB:SAP
  //     HSBA.L → LSE:HSBA
  function toFinnhub(sym) {
    const suffixMap = {
      // Europe
      'PA': 'ENXTPA',   // Euronext Paris
      'DE': 'XETRA',    // Frankfurt/XETRA
      'L':  'LSE',      // London
      'AS': 'ENXTAM',   // Amsterdam
      'SW': 'SIX',      // Suisse
      'MI': 'BIT',      // Milan
      'MC': 'BME',      // Madrid
      'BR': 'ENXTBR',   // Bruxelles
      'LS': 'ENXTLS',   // Lisbonne
      'ST': 'OMX',      // Stockholm
      'CO': 'CPH',      // Copenhague
      'OL': 'OSL',      // Oslo
      'HE': 'HEL',      // Helsinki
      'VI': 'WBAG',     // Vienne
      'WA': 'WSE',      // Varsovie
      'PR': 'PRA',      // Prague
      'BU': 'BET',      // Bucarest
      // Amériques
      'TO': 'TSX',      // Toronto
      'V':  'TSXV',     // TSX Venture
      'SA': 'BVMF',     // Brésil B3
      'MX': 'BMV',      // Mexique
      // Asie-Pacifique
      'AX': 'ASX',      // Australie
      'NZ': 'NZX',      // Nouvelle-Zélande
      'T':  'TSE',      // Tokyo
      'OS': 'OSA',      // Osaka
      'KS': 'KRX',      // Corée du Sud
      'HK': 'HKEX',     // Hong Kong
      'SS': 'SHSE',     // Shanghai
      'SZ': 'SZSE',     // Shenzhen
      'NS': 'NSE',      // Inde NSE
      'BO': 'BSE',      // Inde BSE
      'SI': 'SGX',      // Singapour
      'KL': 'KLSE',     // Malaisie
      'BK': 'SET',      // Thaïlande
      'JK': 'IDX',      // Indonésie
      // Afrique / Moyen-Orient
      'JO': 'JSE',      // Afrique du Sud
      'TA': 'TASE',     // Israël
      'CA': 'EGX',      // Egypte
    }

    const parts = sym.split('.')
    if (parts.length === 2) {
      const ticker = parts[0]
      const suffix = parts[1]
      const exchange = suffixMap[suffix]
      if (exchange) return `${exchange}:${ticker}`
    }
    return sym // US ticker, pas de conversion
  }

  // ══ 3. Finnhub → toutes bourses mondiales ══
  if (finnhubKey) {
    const finnhubSymbol = toFinnhub(symbol)
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${finnhubKey}`,
        { next: { revalidate: 30 } }
      )
      const data = await res.json()
      if (data.c > 0) {
        return Response.json({
          price: data.c,
          change: data.pc > 0 ? ((data.c - data.pc) / data.pc * 100) : 0,
          symbol
        })
      }
    } catch(e) {}

    // Si pas trouvé, essayer aussi sans conversion (certains tickers fonctionnent tels quels)
    if (toFinnhub(symbol) !== symbol) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`,
          { next: { revalidate: 30 } }
        )
        const data = await res.json()
        if (data.c > 0) {
          return Response.json({
            price: data.c,
            change: data.pc > 0 ? ((data.c - data.pc) / data.pc * 100) : 0,
            symbol
          })
        }
      } catch(e) {}
    }
  }

  // ══ 4. Yahoo Finance (fallback sans proxy — fonctionne côté serveur) ══
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        next: { revalidate: 30 },
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    )
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (meta?.regularMarketPrice > 0) {
      const change = meta.previousClose > 0
        ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100)
        : 0
      return Response.json({
        price: meta.regularMarketPrice,
        change,
        symbol
      })
    }
  } catch(e) {}

  // Essayer aussi query2
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        next: { revalidate: 30 },
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    )
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (meta?.regularMarketPrice > 0) {
      const change = meta.previousClose > 0
        ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100)
        : 0
      return Response.json({
        price: meta.regularMarketPrice,
        change,
        symbol
      })
    }
  } catch(e) {}

  return Response.json({ error: `Prix introuvable pour "${symbol}". Vérifiez le ticker.` }, { status: 404 })
}