// Portfolio Tracker - stores data in localStorage
const STORAGE_KEY = 'portfolio-holdings';

let holdings = loadHoldings();

function loadHoldings() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHoldings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function addHolding(symbol, quantity, purchasePrice, currentPrice) {
  const holding = {
    id: crypto.randomUUID?.() ?? Date.now().toString(),
    symbol: symbol.toUpperCase().trim(),
    quantity: parseFloat(quantity),
    purchasePrice: parseFloat(purchasePrice),
    currentPrice: parseFloat(currentPrice),
    addedAt: new Date().toISOString(),
  };
  holdings.push(holding);
  saveHoldings();
}

function removeHolding(id) {
  holdings = holdings.filter((h) => h.id !== id);
  saveHoldings();
}

function updateCurrentPrice(id, currentPrice) {
  const holding = holdings.find((h) => h.id === id);
  if (holding) {
    holding.currentPrice = parseFloat(currentPrice);
    saveHoldings();
  }
}

function renderHoldings() {
  const list = document.getElementById('holdingsList');
  const emptyState = document.getElementById('emptyState');

  if (holdings.length === 0) {
    list.innerHTML = '<p class="empty-state" id="emptyState">No holdings yet. Add your first investment above.</p>';
    return;
  }

  emptyState?.remove();

  const headerRow = document.createElement('div');
  headerRow.className = 'holding-row header-row';
  headerRow.innerHTML = `
    <span class="col-symbol">Symbol</span>
    <span class="col-qty">Qty</span>
    <span class="col-cost">Cost Basis</span>
    <span class="col-value">Current Value</span>
    <span class="col-pnl">P&L</span>
    <span class="col-actions"></span>
  `;

  const rows = holdings.map((h) => {
    const cost = h.quantity * h.purchasePrice;
    const value = h.quantity * h.currentPrice;
    const pnl = value - cost;
    const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;

    const row = document.createElement('div');
    row.className = 'holding-row';
    row.innerHTML = `
      <span class="holding-symbol col-symbol">${h.symbol}</span>
      <span class="col-qty">${h.quantity}</span>
      <span class="holding-cost col-cost">${formatCurrency(cost)}</span>
      <span class="holding-value col-value">${formatCurrency(value)}</span>
      <span class="holding-pnl col-pnl ${pnl >= 0 ? 'positive' : 'negative'}">
        ${formatCurrency(pnl)} <span class="holding-pnl-percent">(${formatPercent(pnlPercent)})</span>
      </span>
      <div class="col-actions">
        <button class="btn btn-danger" data-action="remove" data-id="${h.id}">Remove</button>
      </div>
    `;
    return row;
  });

  list.innerHTML = '';
  list.appendChild(headerRow);
  rows.forEach((row) => list.appendChild(row));

  // Attach remove handlers
  list.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeHolding(btn.dataset.id);
      render();
    });
  });
}

function renderSummary() {
  let totalCost = 0;
  let totalValue = 0;

  holdings.forEach((h) => {
    totalCost += h.quantity * h.purchasePrice;
    totalValue += h.quantity * h.currentPrice;
  });

  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  document.getElementById('totalValue').textContent = formatCurrency(totalValue);
  document.getElementById('totalCost').textContent = formatCurrency(totalCost);

  const pnlEl = document.getElementById('totalPnl');
  const pnlPercentEl = document.getElementById('totalPnlPercent');

  pnlEl.textContent = formatCurrency(pnl);
  pnlEl.className = `card-value ${pnl >= 0 ? 'positive' : 'negative'}`;
  pnlPercentEl.textContent = formatPercent(pnlPercent);
  pnlPercentEl.className = `card-percent ${pnl >= 0 ? 'positive' : 'negative'}`;
}

function renderAnalysis() {
  const section = document.getElementById('analysisSection');
  const intro = document.getElementById('analysisIntro');
  const content = document.getElementById('analysisContent');

  if (holdings.length === 0) {
    intro.classList.remove('hidden');
    content.classList.remove('visible');
    return;
  }

  intro.classList.add('hidden');
  content.classList.add('visible');

  let totalCost = 0;
  let totalValue = 0;
  const holdingStats = holdings.map((h) => {
    const cost = h.quantity * h.purchasePrice;
    const value = h.quantity * h.currentPrice;
    const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;
    totalCost += cost;
    totalValue += value;
    return { ...h, cost, value, pnlPercent };
  });

  // Allocation
  const allocationList = document.getElementById('allocationList');
  allocationList.innerHTML = holdingStats
    .map((h) => {
      const pct = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
      return `
        <div class="allocation-row">
          <span class="allocation-symbol">${h.symbol}</span>
          <span>${formatCurrency(h.value)}</span>
          <div class="allocation-bar-wrap"><div class="allocation-bar" style="width: ${Math.max(pct, 2)}%"></div></div>
          <span style="font-family: 'JetBrains Mono', monospace; min-width: 4ch;">${pct.toFixed(1)}%</span>
        </div>
      `;
    })
    .join('');

  // Top & bottom performers (by P&L %)
  const sorted = [...holdingStats].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const top = sorted.slice(0, 3);
  const topIds = new Set(top.map((h) => h.id));
  const bottom = sorted.filter((h) => !topIds.has(h.id)).slice(-3).reverse();
  const performanceList = document.getElementById('performanceList');
  performanceList.innerHTML = [
    ...top.map((h) => `<div class="performance-row"><span class="performance-symbol">${h.symbol}</span><span class="holding-pnl positive">${formatPercent(h.pnlPercent)}</span></div>`),
    ...bottom.map((h) => `<div class="performance-row"><span class="performance-symbol">${h.symbol}</span><span class="holding-pnl ${h.pnlPercent >= 0 ? 'positive' : 'negative'}">${formatPercent(h.pnlPercent)}</span></div>`),
  ].join('');

  // Past annual return distribution by ticker (when chart data loaded)
  const tickerDistsEl = document.getElementById('tickerDistributions');
  const chartData = window.__chartData;
  if (tickerDistsEl) {
    if (chartData?.annualReturnsBySymbol && chartData.annualReturnsBySymbol.size > 0) {
      const percentilesBySymbol = chartData.percentilesBySymbol || new Map();
      tickerDistsEl.innerHTML = holdings.map((h) => {
        const annualReturns = chartData.annualReturnsBySymbol[h.symbol] || [];
        const p = percentilesBySymbol.get(h.symbol) || { p10: 0, p50: 0, p90: 0 };
        const yearBars = annualReturns
          .map((r) => {
            const pct = Math.min(100, Math.max(8, Math.abs(r.return) * 2.5));
            return `<span class="year-bar ${r.return >= 0 ? 'positive' : 'negative'}" style="height: ${pct}%;" title="${r.year}: ${(r.return * 100).toFixed(1)}%"></span>`;
          })
          .join('');
        const yearList = annualReturns
          .slice()
          .reverse()
          .map((r) => `<span class="year-pill ${r.return >= 0 ? 'positive' : 'negative'}">${r.year}: ${(r.return >= 0 ? '+' : '')}${(r.return * 100).toFixed(1)}%</span>`)
          .join('');
        return `
          <div class="ticker-distribution-card">
            <div class="ticker-distribution-header">
              <span class="ticker-distribution-symbol">${h.symbol}</span>
              <span class="ticker-distribution-stats">90th: ${(p.p90 * 100).toFixed(1)}% · med: ${(p.p50 * 100).toFixed(1)}% · 10th: ${(p.p10 * 100).toFixed(1)}%</span>
            </div>
            <div class="ticker-distribution-bars" title="Each bar = one year return">${yearBars}</div>
            <div class="ticker-distribution-years">${yearList}</div>
          </div>
        `;
      }).join('');
    } else {
      tickerDistsEl.innerHTML = '<p class="distribution-placeholder">Load &quot;Past year &amp; scenarios&quot; above to see each ticker’s annual return distribution.</p>';
    }
  }

  // Trajectory: 3 scenarios (only when chart data loaded) or simple fallback
  const trajectoryCards = document.getElementById('trajectoryCards');

  if (chartData && chartData.percentilesBySymbol) {
    const sixMoOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 0.5);
    const oneYrOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 1);
    const sixMoAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 0.5);
    const oneYrAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 1);
    const sixMoPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 0.5);
    const oneYrPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 1);

    trajectoryCards.innerHTML = `
      <div class="scenario-card optimistic">
        <div class="scenario-label">Optimistic (top 10%)</div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoOpt)}</span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrOpt)}</span></div>
      </div>
      <div class="scenario-card average">
        <div class="scenario-label">Average (historical)</div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoAvg)}</span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrAvg)}</span></div>
      </div>
      <div class="scenario-card pessimistic">
        <div class="scenario-label">Pessimistic (bottom 10%)</div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoPess)}</span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrPess)}</span></div>
      </div>
    `;
  } else {
    const pnlDecimal = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;
    const sixMo = totalValue * Math.pow(1 + pnlDecimal, 0.5);
    const oneYr = totalValue * Math.pow(1 + pnlDecimal, 1);
    trajectoryCards.innerHTML = `
      <div class="trajectory-card" style="grid-column: 1 / -1;">
        <div class="label">Simple projection (current return rate)</div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMo)}</span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYr)}</span></div>
        <p class="charts-hint" style="margin-top: 0.75rem; margin-bottom: 0;">Click &quot;Load past year &amp; scenarios&quot; above for optimistic / average / pessimistic based on each ticker&apos;s history.</p>
      </div>
    `;
  }
}

function render() {
  renderSummary();
  renderHoldings();
  renderAnalysis();
}

// Yahoo Finance - fetch previous close and historical via CORS proxy
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';

async function fetchPreviousClose(symbol) {
  const url = CORS_PROXY + encodeURIComponent(YAHOO_CHART + symbol.toUpperCase().trim());
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed');
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Invalid symbol');
  const prevClose = result.meta?.previousClose ?? result.meta?.regularMarketPrice;
  if (prevClose == null) throw new Error('No price data');
  return prevClose;
}

async function fetchHistorical(symbol, range = '1y') {
  const params = new URLSearchParams({ range, interval: '1d' });
  const url = CORS_PROXY + encodeURIComponent(YAHOO_CHART + symbol.toUpperCase().trim() + '?' + params);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed');
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Invalid symbol');
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  const closes = (quotes && quotes.close) || [];
  const series = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close != null && close > 0 && Number.isFinite(close)) {
      series.push({ date: timestamps[i] * 1000, close });
    }
  }
  return series;
}

/** End-of-year close per year, then annual return = (close_Y - close_Y-1) / close_Y-1 */
function computeAnnualReturns(series) {
  if (!series.length) return [];
  const sorted = [...series].sort((a, b) => a.date - b.date);
  const endOfYear = new Map();
  sorted.forEach((p) => {
    const y = new Date(p.date).getFullYear();
    endOfYear.set(y, p.close);
  });
  const years = [...endOfYear.keys()].sort((a, b) => a - b);
  const result = [];
  for (let i = 1; i < years.length; i++) {
    const yPrev = years[i - 1];
    const yCurr = years[i];
    const closePrev = endOfYear.get(yPrev);
    const closeCurr = endOfYear.get(yCurr);
    if (closePrev != null && closeCurr != null && closePrev > 0) {
      result.push({ year: yCurr, return: (closeCurr - closePrev) / closePrev });
    }
  }
  return result;
}

/** Percentiles of annual returns (already annual, no extra annualization) */
function computeAnnualReturnPercentiles(annualReturns) {
  const returns = annualReturns.map((r) => r.return).filter((r) => Number.isFinite(r));
  if (returns.length === 0) return { p10: 0, p50: 0, p90: 0, returns: [] };
  const sorted = [...returns].sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 10),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    returns,
  };
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const k = (sortedArr.length - 1) * (p / 100);
  const i = Math.floor(k);
  const f = k - i;
  const a = sortedArr[i] ?? 0;
  const b = sortedArr[Math.min(i + 1, sortedArr.length - 1)] ?? a;
  return a + f * (b - a);
}

let chartPastInstance = null;
let chartFutureInstance = null;

function buildPastSeries(seriesBySymbol, holdings, maxAgeMs = 365 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  const dateSet = new Set();
  seriesBySymbol.forEach((s) => s.forEach((p) => {
    if (p.date >= cutoff && Number.isFinite(p.date) && p.close != null) dateSet.add(p.date);
  }));
  const dates = Array.from(dateSet).sort((a, b) => a - b);
  const getPrice = (symbol, date) => {
    const series = seriesBySymbol.get(symbol) || [];
    const exact = series.find((p) => p.date === date);
    if (exact) return exact.close;
    const after = series.find((p) => p.date >= date);
    const before = series.filter((p) => p.date < date).pop();
    if (after && !before) return after.close;
    if (before && !after) return before.close;
    if (before && after) return before.close;
    return null;
  };
  return dates.map((date) => {
    let value = 0;
    holdings.forEach((h) => {
      const price = getPrice(h.symbol, date);
      if (price != null && Number.isFinite(price)) value += h.quantity * price;
    });
    return { date, value };
  }).filter((p) => p.value > 0);
}


function projectAt(holdings, totalValueNow, percentilesBySymbol, scenario, years) {
  const key = scenario === 'opt' ? 'p90' : scenario === 'avg' ? 'p50' : 'p10';
  let total = 0;
  holdings.forEach((h) => {
    const value = h.quantity * h.currentPrice;
    const r = percentilesBySymbol.get(h.symbol)?.[key] ?? 0;
    total += value * Math.pow(1 + r, years);
  });
  return total;
}

function drawPastChart(canvasId, pastSeries) {
  if (chartPastInstance) {
    chartPastInstance.destroy();
    chartPastInstance = null;
  }
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx || !pastSeries.length) return;

  const labels = pastSeries.map((p) => {
    const d = new Date(p.date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  });
  const values = pastSeries.map((p) => p.value);

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(52, 199, 123, 0.35)');
  gradient.addColorStop(1, 'rgba(52, 199, 123, 0)');

  if (typeof Chart === 'undefined') return;
  chartPastInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio value',
        data: values,
        borderColor: '#34c77b',
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          ticks: { color: '#8896a6', maxTicksLimit: 8 },
        },
        y: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          ticks: {
            color: '#8896a6',
            callback: (v) => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : v),
          },
        },
      },
    },
  });
}

function drawFutureChart(canvasId, totalNow, holdings, percentilesBySymbol) {
  if (chartFutureInstance) {
    chartFutureInstance.destroy();
    chartFutureInstance = null;
  }
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const now = totalNow;
  const sixMoOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 0.5);
  const oneYrOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 1);
  const sixMoAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 0.5);
  const oneYrAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 1);
  const sixMoPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 0.5);
  const oneYrPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 1);

  const labels = ['Today', '6 months', '1 year'];

  if (typeof Chart === 'undefined') return;
  chartFutureInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Optimistic',
          data: [now, sixMoOpt, oneYrOpt],
          borderColor: '#34c77b',
          backgroundColor: 'rgba(52, 199, 123, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'Average',
          data: [now, sixMoAvg, oneYrAvg],
          borderColor: '#5b9cf4',
          backgroundColor: 'rgba(91, 156, 244, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'Pessimistic',
          data: [now, sixMoPess, oneYrPess],
          borderColor: '#e85a5a',
          backgroundColor: 'rgba(232, 90, 90, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#e8ecf1', padding: 16 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          ticks: { color: '#8896a6' },
        },
        y: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          ticks: {
            color: '#8896a6',
            callback: (v) => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : v),
          },
        },
      },
    },
  });
}

document.getElementById('loadChartsBtn').addEventListener('click', async () => {
  if (holdings.length === 0) return;
  const btn = document.getElementById('loadChartsBtn');
  const wrap = document.getElementById('chartsWrap');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  const series1yBySymbol = new Map();
  const percentilesBySymbol = new Map();
  const annualReturnsBySymbol = new Map();

  // 1) Fetch 1y daily for each symbol (reliable, fast) – used for past chart
  for (const h of holdings) {
    try {
      const series = await fetchHistorical(h.symbol, '1y');
      if (series.length) series1yBySymbol.set(h.symbol, series);
    } catch {
      // skip
    }
  }

  const pastSeries = buildPastSeries(series1yBySymbol, holdings);
  let totalValue = 0;
  holdings.forEach((h) => { totalValue += h.quantity * h.currentPrice; });

  // Show chart area and draw past chart (1y data is reliable and fast)
  wrap.classList.add('visible');
  if (pastSeries.length) {
    requestAnimationFrame(() => {
      drawPastChart('chartPast', pastSeries);
    });
  }

  // 2) Fetch 10y for annual returns (scenarios). Fallback to 5y then 2y if 10y fails
  for (const h of holdings) {
    let seriesLong = null;
    for (const range of ['10y', '5y', '2y']) {
      try {
        seriesLong = await fetchHistorical(h.symbol, range);
        if (seriesLong.length >= 60) break; // need enough points for multiple years
      } catch {
        continue;
      }
    }
    if (seriesLong && seriesLong.length) {
      const annualReturns = computeAnnualReturns(seriesLong);
      if (annualReturns.length) {
        annualReturnsBySymbol.set(h.symbol, annualReturns);
        const { p10, p50, p90 } = computeAnnualReturnPercentiles(annualReturns);
        percentilesBySymbol.set(h.symbol, { p10, p50, p90 });
      }
    }
  }

  window.__chartData = { pastSeries, percentilesBySymbol, annualReturnsBySymbol };

  if (percentilesBySymbol.size) {
    requestAnimationFrame(() => {
      drawFutureChart('chartFuture', totalValue, holdings, percentilesBySymbol);
    });
  }

  btn.textContent = 'Refresh charts';
  btn.disabled = false;
  render();
});

document.getElementById('fetchPriceBtn').addEventListener('click', async () => {
  const symbolInput = document.getElementById('symbol');
  const priceInput = document.getElementById('currentPrice');
  const statusEl = document.getElementById('priceFetchStatus');
  const btn = document.getElementById('fetchPriceBtn');

  const symbol = symbolInput.value.trim();
  if (!symbol) {
    statusEl.textContent = 'Enter a symbol first';
    statusEl.className = 'price-fetch-status error';
    symbolInput.focus();
    return;
  }

  btn.disabled = true;
  statusEl.textContent = 'Fetching...';
  statusEl.className = 'price-fetch-status';

  try {
    const price = await fetchPreviousClose(symbol);
    priceInput.value = price.toFixed(2);
    statusEl.textContent = `Previous close: $${price.toFixed(2)}`;
    statusEl.className = 'price-fetch-status success';
  } catch (err) {
    statusEl.textContent = err.message || 'Could not fetch price';
    statusEl.className = 'price-fetch-status error';
  } finally {
    btn.disabled = false;
  }
});

// Refresh all prices
document.getElementById('refreshAllBtn').addEventListener('click', async () => {
  if (holdings.length === 0) return;
  const btn = document.getElementById('refreshAllBtn');
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Refreshing...';

  let updated = 0;
  for (const h of holdings) {
    try {
      const price = await fetchPreviousClose(h.symbol);
      h.currentPrice = price;
      updated++;
    } catch {
      // skip failed symbols
    }
  }
  saveHoldings();
  render();

  btn.textContent = prevText;
  btn.disabled = false;
});

// Form submission
document.getElementById('holdingForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const symbol = document.getElementById('symbol').value;
  const quantity = document.getElementById('quantity').value;
  const purchasePrice = document.getElementById('purchasePrice').value;
  const currentPrice = document.getElementById('currentPrice').value;

  addHolding(symbol, quantity, purchasePrice, currentPrice);

  // Reset form but keep symbol for adding more of same
  document.getElementById('quantity').value = '';
  document.getElementById('purchasePrice').value = '';
  document.getElementById('currentPrice').value = '';
  document.getElementById('symbol').focus();

  render();
});

// Initial render
render();
