# MPR Consulting Site

## Stock Signal Dashboard Live Data

The stock dashboard at `/stocks` uses live market data only when at least one provider key is configured. It tries Finnhub first, then Alpha Vantage, then the latest successful in-memory quote cache, and uses mock data only as an emergency fallback with a visible warning.

### 1. Get API Keys

Finnhub:
- Create a free account at `https://finnhub.io/`
- Open your dashboard and copy your API token
- This is the primary live quote provider

Alpha Vantage:
- Create a free API key at `https://www.alphavantage.co/support/#api-key`
- This is the fallback live quote provider

### 2. Add Keys Locally

Open `.env.local` in the project root and replace the placeholders:

```env
FINNHUB_API_KEY=your_real_finnhub_key
ALPHA_VANTAGE_API_KEY=your_real_alpha_vantage_key
```

You can use either key, but Finnhub is preferred. If both are present, the dashboard uses Finnhub first and falls back to Alpha Vantage only when Finnhub fails.

### 3. Restart The Dev Server

Environment variables are read when the Next.js dev server starts. After editing `.env.local`, stop the current server and restart it:

```bash
npm run dev
```

Then open:

```text
http://localhost:3001/stocks
```

### 4. Debug A Live Quote

Use the debug route to confirm key detection and provider output:

```text
http://localhost:3001/api/stocks/debug-live?symbol=NVDA
```

The response includes the symbol, provider, price, change, percent change, raw provider response, and whether a real API key was detected.
