# Portfolio Tracker

A simple web app to track your personal investment portfolio.

## Features

- **Add holdings** — Symbol, quantity, purchase price, and current price
- **Fetch price** — Auto-fill current price from Yahoo Finance (previous day close)
- **Summary dashboard** — Total value, total cost, and P&L (profit/loss)
- **Persistent storage** — Data saved in your browser's localStorage
- **Responsive design** — Works on desktop and mobile

## How to Use

1. Enter a symbol (e.g. AAPL, VOO, BTC-USD) and click **Fetch** to get the latest previous-close price
2. Fill in quantity and purchase price
3. Click **Add Holding**
4. Your data is saved locally in the browser

## Deploy to GitHub (view on phone)

1. Create a new repository on GitHub (e.g. `portfolio-tracker`)
2. Push these files to the repo:

   ```bash
   cd C:\Users\10655\Documents\portfolio-tracker
   git init
   git add index.html styles.css app.js README.md
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/portfolio-tracker.git
   git push -u origin main
   ```

3. In your GitHub repo: **Settings** → **Pages** → under "Build and deployment", set **Source** to "Deploy from a branch"
4. Select branch **main** and folder **/ (root)** → Save
5. After 1–2 minutes, your site will be at:
   **https://YOUR_USERNAME.github.io/portfolio-tracker/**

You can bookmark that URL on your phone to access it anywhere. Data is stored per device (localStorage is device-specific).

## File Structure

```
portfolio-tracker/
├── index.html   — Main page
├── styles.css   — Styling
├── app.js       — Logic and data
└── README.md    — This file
```

## Notes

- Data stays in your browser — it's not sent anywhere
- Yahoo Finance symbols: use standard tickers (AAPL, MSFT, VOO) or crypto like BTC-USD, ETH-USD
- Works fully offline after first load (fonts load from Google)
