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

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function getCacheKey(symbol, range) {
  return `pt_cache_${symbol}_${range}`;
}

function getCachedSeries(symbol, range) {
  try {
    const raw = localStorage.getItem(getCacheKey(symbol, range));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.series)) return null;
    return parsed.series;
  } catch {
    return null;
  }
}

function setCachedSeries(symbol, range, series) {
  try {
    localStorage.setItem(getCacheKey(symbol, range), JSON.stringify({
      savedAt: Date.now(),
      series,
    }));
  } catch {
    // ignore cache failures
  }
}

function computeMonthlyReturns(series) {
  if (!series.length) return [];
  const sorted = [...series].sort((a, b) => a.date - b.date);
  const endOfMonth = new Map();
  sorted.forEach((p) => {
    const d = new Date(p.date);
    const key = d.getFullYear() * 12 + d.getMonth();
    endOfMonth.set(key, p.close);
  });
  const months = [...endOfMonth.keys()].sort((a, b) => a - b);
  const result = [];
  for (let i = 1; i < months.length; i++) {
    const prev = endOfMonth.get(months[i - 1]);
    const curr = endOfMonth.get(months[i]);
    if (prev != null && curr != null && prev > 0) {
      result.push((curr - prev) / prev);
    }
  }
  return result;
}

function computeMonthlyReturnMap(series) {
  if (!series.length) return new Map();
  const sorted = [...series].sort((a, b) => a.date - b.date);
  const endOfMonth = new Map();
  sorted.forEach((p) => {
    const d = new Date(p.date);
    const key = d.getFullYear() * 12 + d.getMonth();
    endOfMonth.set(key, p.close);
  });
  const months = [...endOfMonth.keys()].sort((a, b) => a - b);
  const result = new Map();
  for (let i = 1; i < months.length; i++) {
    const prev = endOfMonth.get(months[i - 1]);
    const curr = endOfMonth.get(months[i]);
    if (prev != null && curr != null && prev > 0) {
      result.set(months[i], (curr - prev) / prev);
    }
  }
  return result;
}

function variance(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return sumSq / values.length;
}

function covariance(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  const meanA = a.reduce((x, y) => x + y, 0) / a.length;
  const meanB = b.reduce((x, y) => x + y, 0) / b.length;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - meanA) * (b[i] - meanB);
  return sum / a.length;
}

function alignReturnsByMonth(returnMapBySymbol) {
  const months = [];
  const symbols = Array.from(returnMapBySymbol.keys());
  if (!symbols.length) return { months, seriesBySymbol: new Map() };
  const baseMonths = new Set(returnMapBySymbol.get(symbols[0])?.keys() || []);
  symbols.slice(1).forEach((symbol) => {
    const keys = returnMapBySymbol.get(symbol)?.keys() || [];
    const next = new Set(keys);
    for (const m of baseMonths) {
      if (!next.has(m)) baseMonths.delete(m);
    }
  });
  months.push(...Array.from(baseMonths).sort((a, b) => a - b));
  const seriesBySymbol = new Map();
  symbols.forEach((symbol) => {
    const map = returnMapBySymbol.get(symbol);
    seriesBySymbol.set(symbol, months.map((m) => map.get(m)).filter((v) => Number.isFinite(v)));
  });
  return { months, seriesBySymbol };
}

function buildHistogram(values, bins = 12) {
  if (!values.length) {
    return { bins: [], counts: [], min: 0, max: 0, maxCount: 0 };
  }
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const pad = Math.max(0.02, (maxVal - minVal) * 0.1);
  const min = minVal - pad;
  const max = maxVal + pad;
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => {
    const clamped = Math.min(max, Math.max(min, v));
    const idx = Math.min(bins - 1, Math.floor((clamped - min) / step));
    counts[idx] += 1;
  });
  const maxCount = Math.max(...counts);
  const binRanges = counts.map((_, i) => {
    const from = min + i * step;
    const to = from + step;
    return { from, to };
  });
  return { bins: binRanges, counts, min, max, maxCount };
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

  // Past monthly return distribution by ticker (when chart data loaded)
  const tickerDistsEl = document.getElementById('tickerDistributions');
  const chartData = window.__chartData;
  if (tickerDistsEl) {
    if (chartData?.monthlyReturnsBySymbol && chartData.monthlyReturnsBySymbol.size > 0) {
      const distributionSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));
      tickerDistsEl.innerHTML = distributionSymbols.map((symbol, idx) => {
        const data = chartData.monthlyReturnsBySymbol.get(symbol) || [];
        if (!data.length) {
          return `
            <div class="ticker-distribution-card">
              <div class="ticker-distribution-header">
                <span class="ticker-distribution-symbol">${symbol}</span>
                <span class="ticker-distribution-stats">No data</span>
              </div>
              <p class="distribution-placeholder">Yahoo Finance did not return enough data for this ticker.</p>
            </div>
          `;
        }
        const chartId = `dist-${idx}`;
        return `
          <div class="ticker-distribution-card">
            <div class="ticker-distribution-header">
              <span class="ticker-distribution-symbol">${symbol}</span>
              <span class="ticker-distribution-stats">${data.length} months</span>
            </div>
            <div class="distribution-plot" id="${chartId}"></div>
          </div>
        `;
      }).join('');

      if (typeof Plotly !== 'undefined') {
        distributionSymbols.forEach((symbol, idx) => {
          const returns = chartData.monthlyReturnsBySymbol.get(symbol) || [];
          if (!returns.length) return;
          const sorted = [...returns].sort((a, b) => a - b);
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const median = percentile(sorted, 50);
          const p25 = percentile(sorted, 25);
          const p75 = percentile(sorted, 75);

          const trace = {
            x: returns.map((r) => r * 100),
            type: 'histogram',
            nbinsx: 20,
            marker: {
              color: 'rgba(232, 236, 241, 0.7)',
              line: { color: 'rgba(42, 51, 64, 0.9)', width: 1 },
            },
            hovertemplate: '%{x:.2f}%<br>count: %{y}<extra></extra>',
          };

          const shapes = [
            { x: mean * 100, label: 'Mean', color: '#5b9cf4' },
            { x: median * 100, label: 'Median', color: '#34c77b' },
            { x: p25 * 100, label: '25%', color: '#f4c542' },
            { x: p75 * 100, label: '75%', color: '#9b7cf6' },
          ].map((s) => ({
            type: 'line',
            x0: s.x,
            x1: s.x,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: s.color, width: 2, dash: 'dot' },
          }));

          const annotations = [
            { x: mean * 100, label: `Mean ${formatPercent(mean)}` , color: '#5b9cf4' },
            { x: median * 100, label: `Median ${formatPercent(median)}`, color: '#34c77b' },
            { x: p25 * 100, label: `25% ${formatPercent(p25)}`, color: '#f4c542' },
            { x: p75 * 100, label: `75% ${formatPercent(p75)}`, color: '#9b7cf6' },
          ].map((a, idx) => ({
            x: a.x,
            y: 1.05,
            yref: 'paper',
            text: a.label,
            showarrow: false,
            font: { color: a.color, size: 10 },
            xanchor: idx % 2 === 0 ? 'left' : 'right',
          }));

          Plotly.newPlot(`dist-${idx}`, [trace], {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 40, r: 20, t: 28, b: 36 },
            xaxis: {
              title: 'Monthly return',
              tickfont: { color: '#c2cbd6' },
              gridcolor: 'rgba(42, 51, 64, 0.5)',
              zerolinecolor: 'rgba(42, 51, 64, 0.8)',
              showline: true,
              linecolor: 'rgba(42, 51, 64, 0.9)',
              tickformat: '.1f',
              ticksuffix: '%',
              ticks: 'outside',
              ticklen: 6,
              tickcolor: 'rgba(42, 51, 64, 0.9)',
            },
            yaxis: {
              title: 'Count',
              tickfont: { color: '#c2cbd6' },
              gridcolor: 'rgba(42, 51, 64, 0.5)',
              zerolinecolor: 'rgba(42, 51, 64, 0.8)',
              showline: true,
              linecolor: 'rgba(42, 51, 64, 0.9)',
              ticks: 'outside',
              ticklen: 6,
              tickcolor: 'rgba(42, 51, 64, 0.9)',
            },
            hovermode: 'x',
            shapes,
            annotations,
          }, { displayModeBar: false, responsive: true });
        });
      } else {
        tickerDistsEl.insertAdjacentHTML('beforeend', '<p class="distribution-placeholder">Plotly failed to load. Please refresh to view charts.</p>');
      }
    } else {
      tickerDistsEl.innerHTML = '<p class="distribution-placeholder">Load &quot;Past year &amp; scenarios&quot; above to see each ticker’s monthly return distribution.</p>';
    }
  }

  // Trajectory: 3 scenarios (only when chart data loaded) or simple fallback
  const trajectoryCards = document.getElementById('trajectoryCards');

  if (chartData && chartData.percentilesBySymbol) {
    const threeMoOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 0.25);
    const sixMoOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 0.5);
    const nineMoOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 0.75);
    const oneYrOpt = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'opt', 1);
    const threeMoAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 0.25);
    const sixMoAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 0.5);
    const nineMoAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 0.75);
    const oneYrAvg = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'avg', 1);
    const threeMoPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 0.25);
    const sixMoPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 0.5);
    const nineMoPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 0.75);
    const oneYrPess = projectAt(holdings, totalValue, chartData.percentilesBySymbol, 'pess', 1);
    const toPct = (value) => (totalValue > 0 ? ((value / totalValue) - 1) * 100 : 0);

    trajectoryCards.innerHTML = `
      <div class="scenario-card optimistic">
        <div class="scenario-label">Optimistic (top 10%)</div>
        <div class="scenario-row"><span>3 months</span><span class="scenario-value">${formatCurrency(threeMoOpt)} <span class="scenario-percent">${formatPercent(toPct(threeMoOpt))}</span></span></div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoOpt)} <span class="scenario-percent">${formatPercent(toPct(sixMoOpt))}</span></span></div>
        <div class="scenario-row"><span>9 months</span><span class="scenario-value">${formatCurrency(nineMoOpt)} <span class="scenario-percent">${formatPercent(toPct(nineMoOpt))}</span></span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrOpt)} <span class="scenario-percent">${formatPercent(toPct(oneYrOpt))}</span></span></div>
      </div>
      <div class="scenario-card average">
        <div class="scenario-label">Average (historical)</div>
        <div class="scenario-row"><span>3 months</span><span class="scenario-value">${formatCurrency(threeMoAvg)} <span class="scenario-percent">${formatPercent(toPct(threeMoAvg))}</span></span></div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoAvg)} <span class="scenario-percent">${formatPercent(toPct(sixMoAvg))}</span></span></div>
        <div class="scenario-row"><span>9 months</span><span class="scenario-value">${formatCurrency(nineMoAvg)} <span class="scenario-percent">${formatPercent(toPct(nineMoAvg))}</span></span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrAvg)} <span class="scenario-percent">${formatPercent(toPct(oneYrAvg))}</span></span></div>
      </div>
      <div class="scenario-card pessimistic">
        <div class="scenario-label">Pessimistic (bottom 10%)</div>
        <div class="scenario-row"><span>3 months</span><span class="scenario-value">${formatCurrency(threeMoPess)} <span class="scenario-percent">${formatPercent(toPct(threeMoPess))}</span></span></div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMoPess)} <span class="scenario-percent">${formatPercent(toPct(sixMoPess))}</span></span></div>
        <div class="scenario-row"><span>9 months</span><span class="scenario-value">${formatCurrency(nineMoPess)} <span class="scenario-percent">${formatPercent(toPct(nineMoPess))}</span></span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYrPess)} <span class="scenario-percent">${formatPercent(toPct(oneYrPess))}</span></span></div>
      </div>
    `;
  } else {
    const pnlDecimal = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;
    const threeMo = totalValue * Math.pow(1 + pnlDecimal, 0.25);
    const sixMo = totalValue * Math.pow(1 + pnlDecimal, 0.5);
    const nineMo = totalValue * Math.pow(1 + pnlDecimal, 0.75);
    const oneYr = totalValue * Math.pow(1 + pnlDecimal, 1);
    const toPct = (value) => (totalValue > 0 ? ((value / totalValue) - 1) * 100 : 0);
    trajectoryCards.innerHTML = `
      <div class="trajectory-card" style="grid-column: 1 / -1;">
        <div class="label">Simple projection (current return rate)</div>
        <div class="scenario-row"><span>3 months</span><span class="scenario-value">${formatCurrency(threeMo)} <span class="scenario-percent">${formatPercent(toPct(threeMo))}</span></span></div>
        <div class="scenario-row"><span>6 months</span><span class="scenario-value">${formatCurrency(sixMo)} <span class="scenario-percent">${formatPercent(toPct(sixMo))}</span></span></div>
        <div class="scenario-row"><span>9 months</span><span class="scenario-value">${formatCurrency(nineMo)} <span class="scenario-percent">${formatPercent(toPct(nineMo))}</span></span></div>
        <div class="scenario-row"><span>1 year</span><span class="scenario-value">${formatCurrency(oneYr)} <span class="scenario-percent">${formatPercent(toPct(oneYr))}</span></span></div>
        <p class="charts-hint" style="margin-top: 0.75rem; margin-bottom: 0;">Click &quot;Load past year &amp; scenarios&quot; above for optimistic / average / pessimistic based on each ticker&apos;s history.</p>
      </div>
    `;
  }

  // Risk analytics (beta, variance, risk contributions)
  const riskEl = document.getElementById('riskMetrics');
  const riskRows = document.getElementById('riskRows');
  if (riskEl && riskRows) {
    const analytics = chartData?.riskAnalytics;
    if (analytics?.ready) {
      riskEl.innerHTML = `
        <div class="risk-metric">
          <span class="risk-label">Portfolio beta (vs SPY)</span>
          <span class="risk-value">${analytics.beta == null ? '—' : formatNumber(analytics.beta, 2)}</span>
        </div>
        <div class="risk-metric">
          <span class="risk-label">Monthly volatility</span>
          <span class="risk-value">${formatPercent(analytics.volatility * 100)}</span>
        </div>
        <div class="risk-metric">
          <span class="risk-label">Monthly variance</span>
          <span class="risk-value">${formatNumber(analytics.variance, 6)}</span>
        </div>
      `;
      riskRows.innerHTML = `
        <div class="risk-row risk-row-header">
          <span>Ticker</span>
          <span>Weight</span>
          <span>Risk share</span>
        </div>
        ${analytics.riskContributions.map((row) => `
        <div class="risk-row">
          <span class="risk-symbol">${row.symbol}</span>
          <span>${formatPercent(row.weight * 100)}</span>
          <span>${formatPercent(row.contribution * 100)}</span>
        </div>
      `).join('')}
      `;
    } else {
      riskEl.innerHTML = '<p class="distribution-placeholder">Load charts to compute risk analytics.</p>';
      riskRows.innerHTML = '';
    }
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
  try {
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
    if (series.length) setCachedSeries(symbol, range, series);
    return series;
  } catch (err) {
    const cached = getCachedSeries(symbol, range);
    if (cached?.length) return cached;
    throw err;
  }
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
  const quantityBySymbol = new Map();
  holdings.forEach((h) => {
    const qty = quantityBySymbol.get(h.symbol) || 0;
    quantityBySymbol.set(h.symbol, qty + h.quantity);
  });
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
  const symbols = Array.from(quantityBySymbol.keys());
  const valuesBySymbol = new Map(symbols.map((symbol) => [symbol, []]));
  dates.forEach((date) => {
    symbols.forEach((symbol) => {
      const price = getPrice(symbol, date);
      const qty = quantityBySymbol.get(symbol) || 0;
      const value = price != null && Number.isFinite(price) ? qty * price : 0;
      valuesBySymbol.get(symbol).push(value);
    });
  });
  const filteredSymbols = symbols.filter((symbol) => (valuesBySymbol.get(symbol) || []).some((v) => v > 0));
  const filteredValuesBySymbol = new Map(filteredSymbols.map((symbol) => [symbol, valuesBySymbol.get(symbol) || []]));
  return { dates, symbols: filteredSymbols, valuesBySymbol: filteredValuesBySymbol };
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
  if (!ctx || !pastSeries?.dates?.length) return;

  const { dates, symbols, valuesBySymbol } = pastSeries;
  const labels = dates.map((date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  });
  const palette = [
    { border: '#5b9cf4', fill: 'rgba(91, 156, 244, 0.25)' },
    { border: '#34c77b', fill: 'rgba(52, 199, 123, 0.25)' },
    { border: '#f4c542', fill: 'rgba(244, 197, 66, 0.25)' },
    { border: '#9b7cf6', fill: 'rgba(155, 124, 246, 0.25)' },
    { border: '#e85a5a', fill: 'rgba(232, 90, 90, 0.25)' },
    { border: '#4fd1c5', fill: 'rgba(79, 209, 197, 0.25)' },
  ];
  const datasets = symbols.map((symbol, idx) => {
    const colors = palette[idx % palette.length];
    return {
      label: symbol,
      data: valuesBySymbol.get(symbol) || [],
      borderColor: colors.border,
      backgroundColor: colors.fill,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 1.5,
      stack: 'total',
    };
  });
  const totalValues = dates.map((_, i) => {
    let sum = 0;
    symbols.forEach((symbol) => {
      sum += valuesBySymbol.get(symbol)?.[i] || 0;
    });
    return sum;
  });
  datasets.push({
    label: 'Total',
    data: totalValues,
    borderColor: '#e8ecf1',
    backgroundColor: 'rgba(232, 236, 241, 0.08)',
    fill: false,
    tension: 0.35,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2.5,
  });

  if (typeof Chart === 'undefined') return;
  chartPastInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#e8ecf1', padding: 16 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          ticks: { color: '#8896a6', maxTicksLimit: 8 },
        },
        y: {
          grid: { color: 'rgba(42, 51, 64, 0.6)' },
          stacked: true,
          beginAtZero: true,
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
  const threeMoOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 0.25);
  const sixMoOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 0.5);
  const nineMoOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 0.75);
  const oneYrOpt = projectAt(holdings, totalNow, percentilesBySymbol, 'opt', 1);
  const threeMoAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 0.25);
  const sixMoAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 0.5);
  const nineMoAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 0.75);
  const oneYrAvg = projectAt(holdings, totalNow, percentilesBySymbol, 'avg', 1);
  const threeMoPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 0.25);
  const sixMoPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 0.5);
  const nineMoPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 0.75);
  const oneYrPess = projectAt(holdings, totalNow, percentilesBySymbol, 'pess', 1);

  const labels = ['Today', '3 months', '6 months', '9 months', '1 year'];
  const toPct = (value) => (totalNow > 0 ? ((value / totalNow) - 1) * 100 : 0);

  if (typeof Chart === 'undefined') return;
  chartFutureInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Optimistic',
          data: [now, threeMoOpt, sixMoOpt, nineMoOpt, oneYrOpt],
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
          data: [now, threeMoAvg, sixMoAvg, nineMoAvg, oneYrAvg],
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
          data: [now, threeMoPess, sixMoPess, nineMoPess, oneYrPess],
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
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed.y;
              return `${ctx.dataset.label}: ${formatCurrency(value)} (${formatPercent(toPct(value))})`;
            },
          },
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
  const loadingWrap = document.getElementById('chartsLoading');
  const loadingItems = document.getElementById('chartsLoadingItems');
  const symbols = Array.from(new Set(holdings.map((h) => h.symbol)));
  const riskMarketSymbol = 'SPY';
  const loadingSymbols = [...symbols, riskMarketSymbol];
  const statusBySymbol = new Map(symbols.map((symbol) => [symbol, { oneYear: 'queued', long: 'queued' }]));
  statusBySymbol.set(riskMarketSymbol, { oneYear: '—', long: 'queued' });

  const renderLoading = () => {
    if (!loadingItems) return;
    loadingItems.innerHTML = loadingSymbols.map((symbol) => {
      const status = statusBySymbol.get(symbol);
      return `
        <div class="loading-item">
          <span class="loading-symbol">${symbol}</span>
          <span class="loading-meta">1y: ${status.oneYear} · 10y: ${status.long}</span>
        </div>
      `;
    }).join('');
  };

  if (loadingWrap) {
    loadingWrap.classList.remove('hidden');
    renderLoading();
  }
  btn.disabled = true;
  btn.textContent = 'Loading…';

  const series1yBySymbol = new Map();
  const percentilesBySymbol = new Map();
  const annualReturnsBySymbol = new Map();
  const monthlyReturnsBySymbol = new Map();
  const monthlyReturnMapsBySymbol = new Map();

  // 1) Fetch 1y daily for each symbol (reliable, fast) – used for past chart
  for (const symbol of symbols) {
    try {
      statusBySymbol.get(symbol).oneYear = 'loading';
      renderLoading();
      const series = await fetchHistorical(symbol, '1y');
      if (series.length) {
        series1yBySymbol.set(symbol, series);
        statusBySymbol.get(symbol).oneYear = 'done';
      } else {
        statusBySymbol.get(symbol).oneYear = 'no data';
      }
    } catch {
      statusBySymbol.get(symbol).oneYear = 'failed';
    }
    renderLoading();
  }

  const pastSeries = buildPastSeries(series1yBySymbol, holdings);
  let totalValue = 0;
  holdings.forEach((h) => { totalValue += h.quantity * h.currentPrice; });

  // Show chart area and draw past chart (1y data is reliable and fast)
  wrap.classList.add('visible');
  if (pastSeries?.dates?.length) {
    requestAnimationFrame(() => {
      drawPastChart('chartPast', pastSeries);
    });
  }

  // 2) Fetch 10y for annual returns (scenarios). Fallback to 5y then 2y if 10y fails
  for (const symbol of symbols) {
    let seriesLong = null;
    for (const range of ['10y', '5y', '2y']) {
      try {
        statusBySymbol.get(symbol).long = `loading ${range}`;
        renderLoading();
        seriesLong = await fetchHistorical(symbol, range);
        if (seriesLong.length >= 60) break; // need enough points for multiple years
      } catch {
        continue;
      }
    }
    if (seriesLong && seriesLong.length) {
      const monthlyReturns = computeMonthlyReturns(seriesLong);
      if (monthlyReturns.length) {
        monthlyReturnsBySymbol.set(symbol, monthlyReturns);
      }
      const monthlyMap = computeMonthlyReturnMap(seriesLong);
      if (monthlyMap.size) monthlyReturnMapsBySymbol.set(symbol, monthlyMap);
      const annualReturns = computeAnnualReturns(seriesLong);
      if (annualReturns.length) {
        annualReturnsBySymbol.set(symbol, annualReturns);
        const { p10, p50, p90 } = computeAnnualReturnPercentiles(annualReturns);
        percentilesBySymbol.set(symbol, { p10, p50, p90 });
      }
      statusBySymbol.get(symbol).long = 'done';
    } else {
      statusBySymbol.get(symbol).long = 'no data';
    }
    renderLoading();
  }

  // Market data for beta (SPY)
  let marketMonthlyMap = new Map();
  try {
    statusBySymbol.get(riskMarketSymbol).long = 'loading 10y';
    renderLoading();
    const marketSeries = await fetchHistorical(riskMarketSymbol, '10y');
    marketMonthlyMap = computeMonthlyReturnMap(marketSeries);
    statusBySymbol.get(riskMarketSymbol).long = marketMonthlyMap.size ? 'done' : 'no data';
  } catch {
    statusBySymbol.get(riskMarketSymbol).long = 'failed';
    marketMonthlyMap = new Map();
  }
  renderLoading();

  // Risk analytics
  let riskAnalytics = { ready: false, beta: null, variance: 0, volatility: 0, riskContributions: [] };
  if (monthlyReturnMapsBySymbol.size) {
    const weights = new Map();
    let portfolioValue = 0;
    holdings.forEach((h) => { portfolioValue += h.quantity * h.currentPrice; });
    holdings.forEach((h) => {
      const w = portfolioValue > 0 ? (h.quantity * h.currentPrice) / portfolioValue : 0;
      weights.set(h.symbol, w);
    });

    const { months } = alignReturnsByMonth(monthlyReturnMapsBySymbol);
    if (months.length) {
      const portfolioReturns = months.map((m) => {
        let sum = 0;
        monthlyReturnMapsBySymbol.forEach((map, symbol) => {
          const r = map.get(m);
          const w = weights.get(symbol) || 0;
          if (Number.isFinite(r)) sum += w * r;
        });
        return sum;
      });

      const portVar = variance(portfolioReturns);
      const portVol = Math.sqrt(portVar);

      const riskContributions = [];
      monthlyReturnMapsBySymbol.forEach((map, symbol) => {
        const series = months.map((m) => map.get(m)).filter((v) => Number.isFinite(v));
        if (!series.length) return;
        const cov = covariance(series, portfolioReturns);
        const weight = weights.get(symbol) || 0;
        const contribution = portVar > 0 ? (weight * cov) / portVar : 0;
        riskContributions.push({ symbol, weight, contribution });
      });

      riskContributions.sort((a, b) => b.contribution - a.contribution);

      let beta = null;
      if (marketMonthlyMap.size) {
        const mapsWithMarket = new Map(monthlyReturnMapsBySymbol);
        mapsWithMarket.set(riskMarketSymbol, marketMonthlyMap);
        const aligned = alignReturnsByMonth(mapsWithMarket);
        const marketSeries = aligned.seriesBySymbol.get(riskMarketSymbol) || [];
        if (aligned.months.length && marketSeries.length === aligned.months.length) {
          const marketVar = variance(marketSeries);
          beta = marketVar > 0 ? covariance(
            aligned.months.map((m) => {
              let sum = 0;
              monthlyReturnMapsBySymbol.forEach((map, symbol) => {
                const r = map.get(m);
                const w = weights.get(symbol) || 0;
                if (Number.isFinite(r)) sum += w * r;
              });
              return sum;
            }),
            marketSeries,
          ) / marketVar : 0;
        }
      }

      riskAnalytics = { ready: true, beta, variance: portVar, volatility: portVol, riskContributions };
    }
  }

  window.__chartData = { pastSeries, percentilesBySymbol, annualReturnsBySymbol, monthlyReturnsBySymbol, riskAnalytics };

  if (percentilesBySymbol.size) {
    requestAnimationFrame(() => {
      drawFutureChart('chartFuture', totalValue, holdings, percentilesBySymbol);
    });
  }

  btn.textContent = 'Refresh charts';
  btn.disabled = false;
  if (loadingWrap) loadingWrap.classList.add('hidden');
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
