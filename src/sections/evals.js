// Figure 2: the "Evaluations" bar chart (AGI-1 vs. your ex), its table view and tooltips.
// Built from evals-data.js with textContent only. Chart rules follow CLAUDE.md → "Design" → charts:
// thin bars with rounded ends, values at the bar tips, legend, hairline grid, one axis (0–100),
// hover/focus tooltips that only repeat what's already visible, and a table view.
import { SERIES, BENCHMARKS, fmtScore } from './evals-data.js';

const TICKS = [0, 25, 50, 75, 100];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function buildChart(chart) {
  const rows = BENCHMARKS.map((b) => {
    const row = el('div', 'row');
    row.tabIndex = 0;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `${b.name}: ${SERIES.map((s) => `${s.label} ${fmtScore(b[s.key])}`).join(', ')}`);

    const name = el('div', 'row-name');
    name.setAttribute('aria-hidden', 'true');
    name.append(el('b', '', b.name), el('span', '', b.what));

    const plot = el('div', 'plot');
    plot.setAttribute('aria-hidden', 'true');
    for (const s of SERIES) {
      const lane = el('div', `lane lane-${s.key}`);
      lane.dataset.series = s.key;
      lane.style.setProperty('--v', String(b[s.key] / 100));
      lane.append(el('i', 'bar'), el('span', 'val', fmtScore(b[s.key])));
      plot.append(lane);
    }
    row.append(name, plot);
    row.bench = b;
    return row;
  });

  const axis = el('div', 'row row-axis');
  axis.setAttribute('aria-hidden', 'true');
  const ticks = el('div', 'plot ticks');
  for (const t of TICKS) {
    const tick = el('span', 'tick', String(t));
    tick.style.setProperty('--v', String(t / 100));
    ticks.append(tick);
  }
  axis.append(el('div', 'row-name'), ticks);

  const tip = el('div', 'tip');
  tip.setAttribute('aria-hidden', 'true');
  chart.append(...rows, axis, tip);
  return { rows, tip };
}

// One tooltip: the benchmark and both scores (value first, name second), the hovered series highlighted.
function showTip(chart, tip, row, seriesKey, x, y) {
  const b = row.bench;
  tip.replaceChildren(el('div', 'tip-title', b.name));
  for (const s of SERIES) {
    const line = el('div', `tip-row${seriesKey && seriesKey !== s.key ? ' is-dim' : ''}`);
    line.append(el('i', `key key-${s.key}`), el('b', '', fmtScore(b[s.key])), el('span', '', s.label));
    tip.append(line);
  }
  tip.classList.add('show');
  const box = chart.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const left = Math.min(Math.max(x - box.left - w / 2, 0), box.width - w);
  const top = Math.max(y - box.top - h - 14, 0);
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function buildTable(box) {
  const table = el('table', 'data-table');
  table.append(el('caption', '', 'Figure 2 as a table. Scores 0–100, higher is better.'));
  const head = el('thead');
  const hr = el('tr');
  for (const h of ['Benchmark', 'What it measures', ...SERIES.map((s) => s.label)]) {
    const th = el('th', '', h);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = el('tbody');
  for (const b of BENCHMARKS) {
    const tr = el('tr');
    const th = el('th', '', b.name);
    th.scope = 'row';
    tr.append(th, el('td', '', b.what), ...SERIES.map((s) => el('td', 'num', fmtScore(b[s.key]))));
    body.append(tr);
  }
  table.append(head, body);
  box.append(table);
}

export function startEvals(fig) {
  if (!fig) return;
  const chart = fig.querySelector('[data-chart]');
  const tableBox = fig.querySelector('[data-table]');
  const toggle = fig.querySelector('[data-view-toggle]');
  const { rows, tip } = buildChart(chart);
  buildTable(tableBox);

  // hover (per bar) and keyboard focus (per row)
  const hide = () => tip.classList.remove('show');
  for (const row of rows) {
    row.addEventListener('pointermove', (e) => {
      const lane = e.target.closest('.lane');
      showTip(chart, tip, row, lane?.dataset.series, e.clientX, e.clientY);
    });
    row.addEventListener('pointerleave', hide);
    row.addEventListener('focus', () => {
      const r = row.querySelector('.plot').getBoundingClientRect();
      showTip(chart, tip, row, null, r.left + r.width * 0.75, r.top);
    });
    row.addEventListener('blur', hide);
  }

  // chart ↔ table
  toggle.addEventListener('click', () => {
    const showTable = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(showTable));
    toggle.textContent = showTable ? 'Show chart' : 'Show table';
    chart.hidden = showTable;
    tableBox.hidden = !showTable;
    hide();
  });

  // bars grow in the first time the chart scrolls into view
  if (!('IntersectionObserver' in window)) { chart.classList.add('in'); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { chart.classList.add('in'); io.disconnect(); }
  }, { threshold: 0.2 });
  io.observe(chart);
}
