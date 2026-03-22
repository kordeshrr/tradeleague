export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return Response.json({ results: [] })
  }

  const finnhubKey = process.env.NEXT_PUBLIC_FINNHUB_KEY

  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${finnhubKey}`,
        { next: { revalidate: 3600 } }
      )
      const data = await res.json()
      if (data.result?.length > 0) {
        return Response.json({
          results: data.result.slice(0, 10).map(r => ({
            symbol: r.symbol,
            name: r.description,
            type: r.type,
            exchange: r.displaySymbol
          }))
        })
      }
    } catch(e) {}
  }

  return Response.json({ results: [] })
}