// Token Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's
// own inputs and the protocol's farm plan, and the live-token set the board sets aside.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = typeof window !== 'undefined' ? window.RADAR : null;
  if (!DATA) return;

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var m = DATA.model;
    var growthPct = Math.min(m.growth_cap, Math.max(m.growth_floor, typeof row.change_7d === 'number' ? row.change_7d : 0));
    var growthMult = 1 + (growthPct / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturityMult = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chainMult = 1 + Math.min(row.chains.length, m.chain_max) * m.chain_step;
    var implied = Math.max(1, Math.min(1e14, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturityMult * chainMult)));
    return { implied: implied, growthPct: growthPct, growthMult: growthMult, maturityMult: maturityMult, chainMult: chainMult };
  }

  var watchSet = {};
  (DATA.watchlist || []).forEach(function (s) { watchSet[s] = true; });
  function isWatchlistRow(row) { return !!watchSet[row.slug]; }

  var state = { q: '', category: '', sort: 'rank', watchlistOnly: false, tab: 'board', selected: null };

  function $(id) { return document.getElementById(id); }

  function renderStats() {
    $('stats').innerHTML =
      stat(DATA.board_size, 'ranked rows') +
      stat(DATA.watchlist_size, 'on watchlist') +
      stat(DATA.early_size, 'early finds') +
      stat(DATA.live_size, 'live, set aside');
    function stat(n, label) {
      return '<div class="stat"><b>' + n + '</b><span>' + esc(label) + '</span></div>';
    }
    $('foot-source').textContent = 'Source: ' + DATA.source + ' · snapshot ' + DATA.as_of + ' · watchlist floor ' + fmtUsd(DATA.floor_usd);
    $('global-mult').textContent = DATA.calibration.global_multiple.toFixed(3) + '×';
    var cats = Object.keys(DATA.calibration.categories).sort(function (a, b) {
      return DATA.calibration.categories[b] - DATA.calibration.categories[a];
    });
    $('calibration-rows').innerHTML = cats.map(function (c) {
      return '<tr><td>' + esc(c) + '</td><td class="num">' + DATA.calibration.categories[c].toFixed(3) + '×</td></tr>';
    }).join('');
    var catSel = $('category');
    cats.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      catSel.appendChild(opt);
    });
  }

  function filteredRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !isWatchlistRow(r)) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var sorted = rows.slice();
    if (state.sort === 'implied') sorted.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; });
    else if (state.sort === 'tvl') sorted.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (state.sort === 'growth') sorted.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); });
    else sorted.sort(function (a, b) { return a.rank - b.rank; });
    return sorted;
  }

  function renderBoard() {
    var rows = filteredRows();
    $('count').textContent = rows.length + ' of ' + DATA.board_size + ' rows' +
      (state.watchlistOnly ? ' · watchlist only' : '') +
      (state.category ? ' · ' + state.category : '') +
      (state.q ? ' · matching "' + state.q + '"' : '');
    $('rows').innerHTML = rows.map(function (r) {
      var pct = fmtPct(r.change_7d);
      var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (isWatchlistRow(r) ? '<span class="watch">WATCHLIST</span>' : '') + '</td>' +
        '<td><span class="pill">' + esc(r.category || 'Other') + '</span></td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct + '</td>' +
        '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong></td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td></tr>';
    }).join('');
  }

  function renderLive() {
    $('live-rows').innerHTML = DATA.live.map(function (p) {
      var pct = fmtPct(p.change_7d);
      var cls = p.change_7d === null ? '' : (p.change_7d >= 0 ? 'pos' : 'neg');
      return '<tr><td><strong>' + esc(p.name) + '</strong></td>' +
        '<td><span class="pill">' + esc(p.category || 'Other') + '</span></td>' +
        '<td>' + esc(p.chains.slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td>' +
        '<td class="num"><strong>' + fmtUsd(p.mcap_usd) + '</strong></td>' +
        '<td class="num ' + cls + '">' + pct + '</td></tr>';
    }).join('');
  }

  function renderDetail() {
    var el = $('detail');
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) { row = DATA.rows[i]; break; }
    if (!row) { el.hidden = true; el.innerHTML = ''; return; }
    var v = impliedOf(row);
    var match = v.implied === row.implied_value_usd ? 'matches the board' : 'differs from the board by ' + fmtUsd(Math.abs(v.implied - row.implied_value_usd));
    el.hidden = false;
    el.innerHTML =
      '<h2>#' + row.rank + ' · ' + esc(row.name) + '</h2>' +
      '<p class="meta">' + esc(row.category || 'Other') + ' · ' + esc(row.chains.join(', ') || 'no chain listed') +
      ' · listed ' + esc(row.listed_at || 'unknown') + ' · ' + fmtAge(row.age_days) + ' old' +
      (isWatchlistRow(row) ? ' · <span class="watch">WATCHLIST</span>' : '') + '</p>' +
      '<div class="kv">' +
      '<div><b>' + fmtUsd(row.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div><b>' + fmtUsd(row.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>' + fmtPct(row.change_7d) + '</b><span>7-day change</span></div>' +
      '<div><b>' + row.category_multiple.toFixed(3) + '×</b><span>category multiple</span></div>' +
      '<div><b>' + v.growthMult.toFixed(3) + '×</b><span>growth multiplier</span></div>' +
      '<div><b>' + v.maturityMult.toFixed(3) + '×</b><span>maturity multiplier</span></div>' +
      '<div><b>' + v.chainMult.toFixed(3) + '×</b><span>chain multiplier</span></div>' +
      '</div>' +
      '<p class="muted">The page recomputes the value from the same figures — TVL × ' + row.category_multiple.toFixed(3) +
      ' × ' + v.growthMult.toFixed(3) + ' × ' + v.maturityMult.toFixed(3) + ' × ' + v.chainMult.toFixed(3) +
      ' = ' + fmtUsd(v.implied) + ' — and it ' + match + '.</p>' +
      '<h3>Farm plan — 7 steps</h3>' +
      '<ol class="steps">' + row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
  }

  // A direct link to one protocol opens focused on that protocol: the board stays one tab away.
  function setTab(tab) {
    state.tab = tab;
    state.detailOnly = false;
    $('tab-board').classList.toggle('active', tab === 'board');
    $('tab-live').classList.toggle('active', tab === 'live');
    $('tab-model').classList.toggle('active', tab === 'model');
    $('tab-board').setAttribute('aria-selected', tab === 'board' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', tab === 'live' ? 'true' : 'false');
    $('tab-model').setAttribute('aria-selected', tab === 'model' ? 'true' : 'false');
    $('view-board').hidden = tab !== 'board';
    $('view-live').hidden = tab !== 'live';
    $('view-model').hidden = tab !== 'model';
    if (tab === 'live') renderLive();
  }

  function selectRow(slug) {
    state.selected = slug;
    renderBoard();
    renderDetail();
    if (slug) {
      var el = $('detail');
      if (el && !el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    hash.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'detail' && v) state.selected = v;
      if (k === 'category' && v) state.category = v;
      if (k === 'tab' && (v === 'live' || v === 'model' || v === 'board')) state.tab = v;
      if (k === 'sort' && (v === 'rank' || v === 'implied' || v === 'tvl' || v === 'growth')) state.sort = v;
      if (k === 'watchlist' && v === '1') state.watchlistOnly = true;
      if (k === 'q' && v) state.q = v;
    });
  }

  function init() {
    renderStats();
    readHash();
    $('search').value = state.q;
    $('category').value = state.category;
    $('sort').value = state.sort;
    $('watchlist-only').checked = state.watchlistOnly;
    setTab(state.tab);
    renderBoard();
    renderDetail();
    if (state.selected) {
      // A direct link to one protocol opens focused on it, so the detail is the page, not a
      // section buried under a 226-row table.
      state.detailOnly = true;
      $('view-board').hidden = true;
    }
    $('search').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
    $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
    $('watchlist-only').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; renderBoard(); });
    $('tab-board').addEventListener('click', function () { setTab('board'); });
    $('tab-live').addEventListener('click', function () { setTab('live'); });
    $('tab-model').addEventListener('click', function () { setTab('model'); });
    $('rows').addEventListener('click', function (e) {
      var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
      if (tr) selectRow(tr.getAttribute('data-slug'));
    });
  }

  if (typeof document !== 'undefined' && document.getElementById('rows')) init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { impliedOf: impliedOf, fmtUsd: fmtUsd, fmtPct: fmtPct, fmtAge: fmtAge };
  }
})();
