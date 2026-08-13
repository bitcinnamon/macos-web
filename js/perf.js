// Opt-in Core Web Vitals + boot-phase reporting (zero dependencies).
//
// Enable with `?perf=1` (or `#perf`), or
// `localStorage.setItem('macweb.perf', '1')` before reloading. The default page
// never imports this module and installs no observers, so it pays nothing.
//
// Boot-phase marks are recorded unconditionally in main.js via
// performance.mark(); this module just reads them back and reports the deltas
// from navigation start, alongside browser-native FCP / LCP / CLS / INP / TTFB.

const BOOT_PHASES = [
  ['boot:i18n', 'leopard:i18n-done'],
  ['boot:modules', 'leopard:modules-done'],
  ['boot:vfs', 'leopard:vfs-ready'],
  ['boot:apps', 'leopard:apps-done'],
  ['boot:dom-ready', 'leopard:dom-ready'],
];

function report(store, key, value, unit = 'ms') {
  store[key] = Number.isFinite(value) ? Math.round(value) : null;
  console.info(`[Leopard Web perf] ${key}: ${store[key] ?? 'n/a'}${unit}`);
}

export function installPerf() {
  if (typeof PerformanceObserver === 'undefined' || typeof performance === 'undefined') return;
  const store = (globalThis.__leopardPerf ||= {});
  try {
    const navStart = performance.getEntriesByType('navigation')[0]?.startTime || 0;

    BOOT_PHASES.forEach(([key, mark]) => {
      const entry = performance.getEntriesByName(mark)[0];
      if (entry) report(store, key, entry.startTime - navStart);
    });

    // TTFB
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav?.responseStart != null) report(store, 'ttfb', nav.responseStart);

    // FCP (also records LCP opportunistically on older engines)
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry?.entryType === 'first-contentful-paint') report(store, 'fcp', entry.startTime);
      }).observe({ type: 'paint', buffered: true });
    } catch (error) { /* paint observer unsupported */ }

    // LCP
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry) report(store, 'lcp', entry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) { /* lcp observer unsupported */ }

    // CLS (cumulative layout shift)
    try {
      let cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) cls += entry.value;
        store.cls = Number(cls.toFixed(4));
        console.info(`[Leopard Web perf] CLS: ${store.cls}`);
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (error) { /* layout-shift observer unsupported */ }

    // INP (interaction to next paint)
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry) report(store, 'inp', entry.duration);
      }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    } catch (error) { /* event-timing observer unsupported */ }

    console.info('[Leopard Web perf] results exposed on window.__leopardPerf');
  } catch (error) {
    console.warn('[Leopard Web perf] measurement failed', error);
  }
}
