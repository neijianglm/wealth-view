/* ============================================================
  个人财富管理工具 · 前端脚本
  ============================================================ */

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 刷新数据 (侧栏与手机抽屉里的按钮共用 .js-refresh) ---------- */
(function () {
  const btns = document.querySelectorAll('.js-refresh');
  if (!btns.length) return;
  btns.forEach(btn => btn.addEventListener('click', async () => {
    const label = btn.querySelector('span');
    const orig = label ? label.textContent : '';
    if (label) label.textContent = '刷新中…';
    btns.forEach(b => b.disabled = true);
    try {
      const res = await fetch('/refresh', { method: 'POST' });
      const data = await res.json();
      showToast(data.ok ? '✅ 数据已刷新' : ('⚠️ ' + (data.message || '刷新失败')));
      if (data.ok) setTimeout(() => location.reload(), 900);
    } catch (e) {
      showToast('⚠️ 刷新失败，请稍后重试');
    } finally {
      if (label) label.textContent = orig;
      btns.forEach(b => b.disabled = false);
    }
  }));
})();

/* ---------- 更新行情 (基金净值 + 金价; .js-price 可多处) ---------- */
(function () {
  const btns = document.querySelectorAll('.js-price');
  if (!btns.length) return;
  let poll = null;
  let pollStart = 0;
  const MAX_WAIT_MS = 240 * 1000;   // 4 分钟超时兜底

  btns.forEach(btn => btn.addEventListener('click', async () => {
    const label = btn.querySelector('span');
    const orig = label ? label.textContent : '';
    const reset = () => {
      if (label) label.textContent = orig;
      btns.forEach(b => b.disabled = false);
    };
    if (label) label.textContent = '更新中…';
    btns.forEach(b => b.disabled = true);
    try {
      const res = await fetch('/refresh-prices', { method: 'POST' });
      const data = await res.json();
      if (res.status === 409) {
        showToast('⚠️ ' + (data.message || '行情更新正在进行中'));
        reset();
        return;
      }
      showToast('⏳ 正在更新基金净值 + 金价…');
      pollStart = Date.now();
      poll = setInterval(async () => {
        try {
          const r = await fetch('/refresh-prices/status');
          const s = await r.json();
          if (s.running) {
            if (Date.now() - pollStart > MAX_WAIT_MS) {
              clearInterval(poll);
              showToast('⚠️ 更新超时，请稍后在页面查看');
              reset();
            }
            return;
          }
          clearInterval(poll);
          const failTxt = s.failed && s.failed.length ? `，失败 ${s.failed.length} 个` : '';
          const goldTxt = s.gold ? ` · ${s.gold}` : '';
          const qmTxt = s.qieman ? ` · ${s.qieman}` : '';
          const errTxt = s.error ? ` · 异常: ${s.error}` : '';
          showToast(`✅ 更新完成：成功 ${s.ok} 个 / 无行情 ${s.nodata} 个${failTxt}${goldTxt}${qmTxt}${errTxt}`);
          setTimeout(() => location.reload(), 1200);
        } catch (e) { /* 轮询瞬时失败则下轮重试 */ }
      }, 2000);
    } catch (e) {
      showToast('⚠️ 更新请求失败，请稍后重试');
      reset();
    }
  }));
})();

/* ---------- 手机端「更多」抽屉 ---------- */
(function () {
  const opener = document.getElementById('mMoreBtn');
  const sheet = document.getElementById('mSheet');
  const backdrop = document.getElementById('mBackdrop');
  if (!opener || !sheet || !backdrop) return;
  // hidden 属性必须显式摘除: 快照版文档是 JS 原地重建的,
  // 该上下文里 CSS display 对 [hidden] 的覆盖不可靠(实测 UA 规则获胜)
  const close = () => {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    sheet.hidden = true; backdrop.hidden = true;
  };
  opener.addEventListener('click', () => {
    sheet.hidden = false; backdrop.hidden = false;
    // 强制回流一次, 让 visibility/transform 过渡有机会生效
    void sheet.offsetHeight;
    sheet.classList.add('open'); backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', close);
  sheet.querySelectorAll('.m-sheet-item').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ---------- PWA: Service Worker 注册(仅快照版) ----------
   在线版(Flask + Basic Auth)不注册 SW: 静态缓存会与 ?v= 版本号/认证交互,
   曾导致旧 CSS/JS 命中不替换、每次点击都要强刷(base.html 的退役脚本负责善后)。
   快照版(公网静态站)无认证且需要离线兜底, 继续注册。 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;           // http://IP 的在线版不支持, 静默跳过
  if (window.__WEALTH_ONLINE__) return;          // 在线版: base.html 已设标记并注销
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 注册失败不影响页面 */ });
  });
})();

/* ---------- AI 分析锁定卡片 ---------- */
document.querySelectorAll('.advisor-card.locked').forEach(card => {
  card.addEventListener('click', () => {
    showToast('该功能将在 W5 阶段开放');
  });
});

/* ---------- 执行标记(诊断用: 快照版脚本重建是否完成, DOM 可见) ---------- */
document.documentElement.setAttribute('data-mainjs', 'v20260905');

/* ---------- Chart.js 工具 ---------- */
/* 首色与 UI 主色 --accent(#2D6BCF) 同族, 图表与界面一个视觉身份 */
const CHART_PALETTE = [
  '#2D6BCF', '#8BBA8E', '#D4A574', '#B8A0C8',
  '#7BB4C4', '#C8A8A8', '#A8B8C8', '#9FCAA8',
];

function chartDefaults() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#94A3B8';
  Chart.defaults.borderColor = 'rgba(148,163,184,0.15)';
}

/* 资产配置环形图 */
function renderAllocChart(canvasId, allocData) {
  if (window.allocChart) window.allocChart.destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartDefaults();
  const items = allocData.filter(d => d.amount > 0);
  if (!items.length) return;
  const total = items.reduce((s, d) => s + d.amount, 0);
  window.allocChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map(d => d.label),
      datasets: [{
        data: items.map(d => d.amount),
        backgroundColor: CHART_PALETTE,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 18, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const pct = ((c.parsed / total) * 100).toFixed(1);
              return ` ${c.label}: ¥${c.parsed.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/* 月度收支趋势折线图 */
function renderTrendChart(canvasId, monthly) {
  if (window.trendChart) window.trendChart.destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartDefaults();
  window.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthly.map(m => m.month),
      datasets: [
        {
          label: '收入',
          data: monthly.map(m => m.income),
          borderColor: '#6BAE8E',
          backgroundColor: 'rgba(107,174,142,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: '支出',
          data: monthly.map(m => m.expense),
          borderColor: '#D08A8A',
          backgroundColor: 'rgba(208,138,138,0.06)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ¥${c.parsed.y.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(148,163,184,0.15)' },
          ticks: { callback: (v) => '¥' + v.toLocaleString('zh-CN') },
        },
      },
    },
  });
}

/* 收支结构环形图 (收入/支出 breakdown) */
function renderBreakdownChart(canvasId, items, title) {
  if (window[canvasId + '_chart']) window[canvasId + '_chart'].destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartDefaults();
  const filtered = items.filter(d => d.amount > 0);
  if (!filtered.length) return;
  window[canvasId + '_chart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: filtered.map(d => d.label_cn),
      datasets: [{
        data: filtered.map(d => d.amount),
        backgroundColor: CHART_PALETTE,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = filtered.reduce((s, d) => s + d.amount, 0);
              const pct = ((c.parsed / total) * 100).toFixed(1);
              return ` ${c.label}: ¥${c.parsed.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}
