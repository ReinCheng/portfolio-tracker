# Portfolio Tracker

A simple web app to track your personal investment portfolio.

## Features

- **Add holdings** — Symbol, quantity, purchase price, and current price
- **Fetch price** — Auto-fill current price from Yahoo Finance (previous day close)
- **Summary dashboard** — Total value, total cost, and P&L (profit/loss)
- **Charts & scenarios** — Past 1-year performance and multi-scenario projections
- **Monthly return histograms** — Per-ticker distribution with mean/median/25%/75%
- **Risk analytics** — Beta (vs SPY), variance/volatility, risk contributions
- **Persistent storage** — Data saved in your browser's localStorage
- **Responsive design** — Works on desktop and mobile

## How to Use

1. Enter a symbol (e.g. AAPL, VOO, BTC-USD) and click **Fetch** to get the latest previous-close price
2. Fill in quantity and purchase price
3. Click **Add Holding**
4. Your data is saved locally in the browser

## Notes

- Data stays in your browser — it's not sent anywhere
- Yahoo Finance history is cached in your browser (localStorage) for resilience
- No server is used; cached data is local only on your device
- Yahoo Finance symbols: use standard tickers (AAPL, MSFT, VOO) or crypto like BTC-USD, ETH-USD
- Works fully offline after first load (fonts load from Google)
