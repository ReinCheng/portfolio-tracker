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

function render() {
  renderSummary();
  renderHoldings();
}

// Yahoo Finance - fetch previous close via CORS proxy
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
