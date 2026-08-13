import { System } from '../system/index.js';
import { Leopard } from '../leopard.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';

// Safari — keeps browsing inside the simulated browser, with compatibility
// readers for sites whose scripted popups cannot be intercepted cross-origin.
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="safari-face" cx=".36" cy=".28"><stop stop-color="#c6edff"/><stop offset=".42" stop-color="#64b6e9"/><stop offset="1" stop-color="#186aa9"/></radialGradient><linearGradient id="safari-ring" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".42" stop-color="#aeb8c2"/><stop offset=".52" stop-color="#646e79"/><stop offset="1" stop-color="#e6ebef"/></linearGradient><filter id="safari-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".4"/></filter></defs><g filter="url(#safari-shadow)"><circle cx="32" cy="32" r="29" fill="url(#safari-ring)" stroke="#58616b"/><circle cx="32" cy="32" r="24" fill="url(#safari-face)" stroke="#d8f1ff" stroke-width="1.5"/><g stroke="#eef9ff" stroke-linecap="round">${Array.from({length:24},(_,i)=>`<path d="M32 10v${i%3===0?4:2}" transform="rotate(${i*15} 32 32)" stroke-width="${i%3===0?1.5:.7}"/>`).join('')}</g><path d="m45 18-10 18-16 11 10-19z" fill="#fff" stroke="#324b63"/><path d="m45 18-10 18-6-8z" fill="#e63737"/><circle cx="32" cy="32" r="2.5" fill="#344d65"/><path d="M32 10v4M32 50v4M10 32h4M50 32h4" stroke="#fff" stroke-width="1.7"/></g></svg>`;

  const BOOKMARKS = [
    { name: t('app.saf.0042465b7788'), url: 'home:' },
    { name: t('ui.c19f2d8a0412'), url: 'video:' },
    { name: t('ui.567ce6938ef3'), url: 'html5:' },
    { name: 'YouTube', url: 'https://www.youtube.com/embed/aqz-KE-bpKQ' },
    { name: 'Bilibili', url: 'https://www.bilibili.com/' },
    { name: 'Example', url: 'https://example.com' },
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html?bbox=116.29,39.85,116.50,39.99' },
    { name: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/Mac_OS_X_v10.5' },
  ];
  let lastSafariLocation = 'home:';

  const VIDEOS = [
    ['Big Buck Bunny (10s)', 'https://test-videos.co.uk/vids/bigbuckbunny/webm/vp8/360/Big_Buck_Bunny_360_10s_1MB.webm'],
    ['Sintel (10s)', 'https://test-videos.co.uk/vids/sintel/webm/vp8/360/Sintel_360_10s_1MB.webm'],
    ['Jellyfish (10s)', 'https://test-videos.co.uk/vids/jellyfish/webm/vp8/360/Jellyfish_360_10s_1MB.webm'],
    [t('ui.1a9f9e49b0f0'), 'https://dl11.webmfiles.org/big-buck-bunny_trailer.webm'],
    ['Elephants Dream', 'https://dl11.webmfiles.org/elephants-dream.webm'],
  ];

  function homeHTML() {
    return `<div class="saf-home">
      <h1>Safari</h1>
      <p>Leopard Web ${t('app.saf3.b073b4856aa7')}</p>
      <div class="saf-tiles">
        <div class="saf-tile" data-url="video:"><div class="st-emoji">🎬</div>${t('app.saf.c0b5fec5bfcc')}<br>(HTML5)</div>
        <div class="saf-tile" data-url="https://www.youtube.com/embed/aqz-KE-bpKQ"><div class="st-emoji">▶️</div>YouTube</div>
        <div class="saf-tile" data-url="https://www.bilibili.com/"><div class="st-emoji">📺</div>Bilibili</div>
        <div class="saf-tile" data-url="html5:"><div class="st-emoji">🧪</div>HTML5 ${t('app.saf3.7f55e97c2efc')}</div>
        <div class="saf-tile" data-url="https://example.com"><div class="st-emoji">🌐</div>Example.com</div>
        <div class="saf-tile" data-url="https://zh.wikipedia.org/wiki/Mac_OS_X_v10.5"><div class="st-emoji">📖</div>Wikipedia</div>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#777">Safari ${t('app.saf3.edb82d52902c')}。</p>
    </div>`;
  }

  function videoHTML() {
    return `<div class="saf-video">
      <h2>${t('app.saf3.255aa3edee4d')}</h2>
      <video controls preload="metadata" src="${VIDEOS[0][1]}"></video>
      <div class="v-list">${VIDEOS.map(([n, u], i) => `<button class="aqua-btn v-pick" data-src="${u}">${n}</button>`).join('')}</div>
      <p style="margin-top:10px;font-size:11px;color:#888">${t('app.saf3.58c683da52ef')}</p>
    </div>`;
  }

  function html5HTML() {
    const checks = [
      ['HTML5 Video', !!document.createElement('video').canPlayType],
      ['H.264 / MP4', !!document.createElement('video').canPlayType && document.createElement('video').canPlayType('video/mp4') !== ''],
      ['HTML5 Audio', !!window.Audio],
      ['Canvas 2D', !!document.createElement('canvas').getContext],
      [t('ui.fd7c2316510e'), System.HW.webgl],
      [t('ui.d0760fc130e0'), System.HW.webgl2],
      ['Web Audio API', !!(window.AudioContext || window.webkitAudioContext)],
      ['localStorage', !!window.localStorage],
      ['Fetch / XHR2', !!window.fetch],
      ['CSS3 Transform', 'transform' in document.body.style],
      ['requestAnimationFrame', !!window.requestAnimationFrame],
      ['Web Fonts API', !!document.fonts],
      [t('ui.ec047a3e3910'), !!window.speechSynthesis],
    ];
    return `<div style="padding:16px 20px 0"><h2 style="font-size:18px">HTML5 ${t('app.saf3.4b4e0b7346e3')}</h2>
      <p style="font-size:12px;color:#777;margin-top:4px">${t('app.saf3.df88f53bb2db')}：${checks.filter((c) => c[1]).length} / ${checks.length}</p></div>
      <div class="h5-grid">${checks.map(([n, ok]) => `<div class="h5-item"><b>${n}</b><span class="${ok ? 'h5-ok' : 'h5-no'}">${ok ? t('ui.792419b1fb48') : t('ui.cc784547ef88')}</span></div>`).join('')}</div>`;
  }

  const biliReaderCache = new Map();
  const BILI_NAV = [
    [t('app.saf.0042465b7788'), 'https://www.bilibili.com/'],
    [t('app.saf.046b845824fe'), 'https://www.bilibili.com/v/popular/all'],
    [t('app.saf.37f9286b29c0'), 'https://www.bilibili.com/anime/'],
    [t('app.saf.68644d52c409'), 'https://www.bilibili.com/c/douga/'],
    [t('app.saf.5c0567d169c4'), 'https://www.bilibili.com/c/game/'],
    [t('ui.afb3c40c3929'), 'https://www.bilibili.com/c/music/'],
    [t('app.saf.03f362e73d86'), 'https://www.bilibili.com/c/knowledge/'],
    [t('app.saf.1e20352a27c5'), 'https://www.bilibili.com/c/tech/'],
  ];

  function normalizedHttpUrl(value, base = 'https://www.bilibili.com/') {
    try {
      const parsed = new URL(value, base);
      if (!/^https?:$/.test(parsed.protocol)) return '';
      return parsed.href.replace(/^http:/, 'https:');
    } catch (error) {
      return '';
    }
  }

  function bilibiliRoute(target) {
    try {
      const parsed = new URL(target);
      if (!/(^|\.)bilibili\.com$/i.test(parsed.hostname)) return null;
      if (parsed.hostname === 'player.bilibili.com') return null;
      const video = parsed.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
      return { kind:video ? 'video' : 'listing', bvid:video?.[1] || '', url:parsed.href };
    } catch (error) {
      return null;
    }
  }

  async function fetchBilibiliReader(target) {
    if (biliReaderCache.has(target)) return biliReaderCache.get(target);
    const source = target.replace(/^https?:\/\//i, '');
    const request = fetch(`https://r.jina.ai/http://${source}`, {
      headers:{ Accept:'text/plain' },
      signal:AbortSignal.timeout ? AbortSignal.timeout(14000) : undefined,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });
    biliReaderCache.set(target, request);
    try { return await request; }
    catch (error) { biliReaderCache.delete(target); throw error; }
  }

  function extractBilibiliPage(markdown, target) {
    const title = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || t('app.saf.8723df8205bc');
    const entries = new Map();
    markdown.split(/\r?\n/).forEach((line) => {
      const endLink = line.match(/\]\((https?:\/\/(?:[^/]+\.)?bilibili\.com\/[^)\s]+)\)\s*$/i);
      if (!endLink) return;
      const href = normalizedHttpUrl(endLink[1], target);
      if (!href || !bilibiliRoute(href)) return;
      const image = line.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
      const imageTitle = line.match(/!\[Image\s+\d+:\s*([^\]]+)\]/i)?.[1]?.trim();
      const headingTitle = line.match(/^#{1,4}\s+\[([^\]]+)\]/)?.[1]?.trim();
      let plain = imageTitle || headingTitle || line
        .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
        .replace(/\[|\]/g, ' ')
        .replace(/^#{1,4}\s*/, '')
        .replace(/添加至稍后再看/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      plain = plain.replace(/\s+\d+(?:\.\d+)?万\s+\d+\s+\d{1,2}:\d{2}.*$/, '').trim();
      if (!plain || plain.length > 100) plain = imageTitle || headingTitle || t('ui.4b90d9ff5964');
      const item = entries.get(href) || { href, title:plain, image:'' };
      if ((!item.title || item.title === t('ui.4b90d9ff5964')) && plain) item.title = plain;
      if (image && !item.image) item.image = normalizedHttpUrl(image[1], target);
      entries.set(href, item);
    });
    const all = [...entries.values()];
    const videos = all.filter((item) => /\/video\/BV/i.test(item.href));
    const other = all.filter((item) => !/\/video\/BV/i.test(item.href));
    return { title, videos:videos.slice(0, 30), other:other.slice(0, 18) };
  }

  function biliHeader(target, title) {
    return `<header class="bili-head">
      <button class="bili-logo" data-saf-url="https://www.bilibili.com/" title="${t('app.saf.f43f37b2bac0')}">bilibili</button>
      <nav>${BILI_NAV.map(([name, href]) => `<button data-saf-url="${esc(href)}">${esc(name)}</button>`).join('')}</nav>
      <label class="bili-search"><input type="search" placeholder="${t('app.saf.b70ecd2c2a56')}" aria-label="${t('app.saf.b70ecd2c2a56')}"><button data-bili-search>${t('app.saf3.46cef675aaca')}</button></label>
    </header>
    <div class="bili-compat"><b>Safari ${t('app.saf3.b2f4500539a5')}</b><span>${esc(title)}</span><small>${t('app.saf3.2e4c8a557e81')}${t('app.saf.06c51df1bc11')}</small></div>`;
  }

  function biliLoadingHTML() {
    return `<div class="bili-reader"><div class="bili-reader-loading"><i></i><b>${t('app.saf3.cea1fe3a4734')}</b><span>${t('app.saf3.d16524d27edb')}</span></div></div>`;
  }

  function biliCards(items) {
    if (!items.length) return `<div class="bili-empty">${t('app.saf.753b23f9c068')}</div>`;
    return `<div class="bili-grid">${items.map((item) => `
      <button class="bili-card" data-saf-url="${esc(item.href)}" title="${t('app.saf.06c51df1bc11')}">
        <span class="bili-thumb">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<i>▶</i>'}<em>▶</em></span>
        <strong>${esc(item.title)}</strong>
        <small>${esc(new URL(item.href).pathname.replace(/\/$/, ''))}</small>
      </button>`).join('')}</div>`;
  }

  function biliListingHTML(page, target) {
    return `<div class="bili-reader">
      ${biliHeader(target, page.title)}
      <main class="bili-page">
        <section class="bili-hero"><div><span>LEOPARD SAFARI</span><h1>${esc(page.title)}</h1><p>${t('app.saf3.ea25134829a2')}</p></div><b>${t('app.saf.8723df8205bc')}<br>${t('app.saf3.b724af0a35c0')}</b></section>
        <div class="bili-section-title"><h2>${t('app.saf3.9635f64efd50')}</h2><span>${t('app.saf.navVideos', { n: page.videos.length })}</span></div>
        ${biliCards(page.videos)}
        ${page.other.length ? `<div class="bili-section-title"><h2>${t('app.saf.99c1fe7c0068')}</h2></div><div class="bili-chips">${page.other.map((item) => `<button data-saf-url="${esc(item.href)}">${esc(item.title)}</button>`).join('')}</div>` : ''}
      </main>
    </div>`;
  }

  function biliVideoHTML(page, target, route) {
    const related = page.videos.filter((item) => !item.href.includes(route.bvid));
    return `<div class="bili-reader">
      ${biliHeader(target, page.title)}
      <main class="bili-page bili-video-page">
        <div class="bili-video-title"><span>${t('app.saf3.abd252c0405c')}</span><h1>${esc(page.title.replace(/_哔哩哔哩_bilibili$/i, ''))}</h1><small>${esc(route.bvid)}</small></div>
        <div class="bili-player-shell"><iframe src="https://player.bilibili.com/player.html?bvid=${encodeURIComponent(route.bvid)}&autoplay=0" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe></div>
        <div class="bili-section-title"><h2>${t('app.saf3.3d5c3e1adf40')}</h2><span>${t('app.saf3.4ffcc1cfffd3')}</span></div>
        ${biliCards(related.slice(0, 18))}
      </main>
    </div>`;
  }

  function open() {
    let preferences = System.getAppPreferences?.('safari') || {};
    const toolbar = el('div', 'saf-toolbar');
    const back = el('button', 'saf-nav back', '◀');
    back.title = t('ui.4cf4c11a1b0b');
    const fwd = el('button', 'saf-nav fwd', '▶');
    fwd.title = t('ui.320ffeefca2c');
    const reload = el('button', 'saf-nav reload', '↻');
    reload.title = t('app.saf.31432641e635');
    const security = el('span', 'saf-security', '🔒');
    const url = el('input', 'aqua-input saf-url');
    url.placeholder = t('ui.dca49ae4f355');
    url.spellcheck = false;
    const spinner = el('span', 'saf-spin');
    const go = el('button', 'finder-toolbar-btn', t('ui.23926d61468c'));
    toolbar.append(back, fwd, reload, security, url, spinner, go);

    const wrap = el('div', 'safari-browser');
    const tabBar = el('div', 'saf-tabbar');
    const tabList = el('div', 'saf-tabs');
    const addTab = el('button', 'saf-tab-new', '＋');
    addTab.title = t('ui.7b451ecb8c54');
    tabBar.append(tabList, addTab);
    const bmBar = el('div', 'saf-bookmarks');
    BOOKMARKS.forEach((b) => {
      const bm = el('div', 'saf-bm', b.name);
      bm.tabIndex = 0;
      bm.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) linkedTab(b.url);
        else nav(b.url);
      });
      bm.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        System.contextMenu(event, [
          { label:t('ui.65fc81e16119'), action:()=>nav(b.url) },
          { label:t('ui.0b4d2de47b9e'), action:()=>linkedTab(b.url) },
        ]);
      });
      bmBar.appendChild(bm);
    });
    const views = el('div', 'saf-views');
    wrap.append(tabBar, bmBar, views);

    const tabs = [];
    let active = null;
    let tabSerial = 0;
    let win = null;
    let closeConfirmationOpen = false;

    const homepageTarget = () => {
      const target = String(preferences.homepage || 'home:').trim();
      return !target || target === 'home:' ? 'home:' : normalizedUrl(target);
    };
    const preferenceTarget = (key) => {
      const setting = preferences[key] || 'home';
      if (setting === 'empty') return 'blank:';
      if (setting === 'same') return active?.current || lastSafariLocation || 'home:';
      return homepageTarget();
    };
    const linkedTab = (target) => createTab(target, preferences.activateNewTabs !== false);
    const iframeSandbox = () => [
      'allow-forms',
      preferences.enableJavaScript === false ? '' : 'allow-scripts',
      'allow-same-origin','allow-downloads','allow-modals','allow-presentation',
    ].filter(Boolean).join(' ');
    const applyPreferences = () => {
      const family = String(preferences.standardFont || 'Times New Roman').replace(/["']/g,'');
      wrap.style.setProperty('--safari-standard-font', `"${family}"`);
      wrap.style.setProperty('--safari-standard-size', `${Number(preferences.standardFontSize) || 16}px`);
      wrap.style.setProperty('--safari-minimum-size', `${Number(preferences.minimumFontSize) || 0}px`);
      wrap.classList.toggle('saf-font-smoothing', preferences.smoothFonts !== false);
      tabs.forEach((tab) => tab.iframe.setAttribute('sandbox', iframeSandbox()));
    };

    function normalizedUrl(value) {
      let target = String(value || '').trim();
      if (!target) return homepageTarget();
      if (!/^https?:|^about:/.test(target) && (/\s/.test(target) || !target.includes('.'))) {
        const searchRoots = {
          duckduckgo:'https://duckduckgo.com/?q=',
          google:'https://www.google.com/search?q=',
          bing:'https://www.bing.com/search?q=',
        };
        target = (searchRoots[preferences.searchEngine] || searchRoots.duckduckgo) + encodeURIComponent(target);
      }
      else if (!/^https?:|^about:|^[a-z]+:$/i.test(target)) target = 'https://' + target;
      return target;
    }

    function pageTitle(target) {
      if (target === 'home:') return t('app.saf.0042465b7788');
      if (target === 'blank:') return t('app.saf.692bd5eb7207');
      if (target === 'video:') return t('app.saf.c0b5fec5bfcc');
      if (target === 'html5:') return t('ui.567ce6938ef3');
      try { return new URL(target).hostname.replace(/^www\./, '') || t('app.saf.2545a815c856'); }
      catch (error) { return String(target).slice(0, 35) || t('app.saf.2545a815c856'); }
    }

    function addressFor(target) {
      if (target === 'home:') return '';
      if (target === 'blank:') return '';
      if (target === 'video:') return 'safari://videos';
      if (target === 'html5:') return 'safari://html5test';
      return target;
    }

    function renderTabs() {
      tabs.forEach((tab) => {
        tab.button.classList.toggle('active', tab === active);
        tab.view.classList.toggle('active', tab === active);
        tab.button.querySelector('.saf-tab-title').textContent = tab.title;
        tab.button.title = tab.current;
      });
    }

    function updateChrome() {
      if (!active) return;
      url.value = addressFor(active.current);
      back.disabled = active.index <= 0;
      fwd.disabled = active.index >= active.history.length - 1;
      reload.textContent = active.loading ? '×' : '↻';
      reload.title = active.loading ? t('app.saf.02f977736479') : t('app.saf.31432641e635');
      spinner.classList.toggle('on', active.loading);
      security.hidden = !/^https:/.test(active.current);
      if (win?._title) win._title.textContent = ['home:','blank:'].includes(active.current) ? 'Safari' : `Safari — ${active.title}`;
      if (win?._status) win._status.textContent = active.loading
        ? t('app.saf.loading', { url: active.current.replace(/^https?:\/\//,'').slice(0,70) })
        : active.current === 'home:' ? t('app.saf.e2a0d77458d1') : active.current === 'blank:' ? t('app.saf.692bd5eb7207') : active.current;
      renderTabs();
    }

    function showInternal(tab, html) {
      tab.internal.hidden = false;
      tab.iframe.hidden = true;
      tab.internal.innerHTML = html;
      tab.internal.querySelectorAll('.v-pick').forEach((button) => button.addEventListener('click', () => {
        const video = tab.internal.querySelector('video');
        video.src = button.dataset.src; video.play().catch(() => {});
      }));
    }

    async function showBilibili(tab, target, route) {
      tab.loading = true;
      showInternal(tab, biliLoadingHTML());
      updateChrome();
      try {
        const markdown = await fetchBilibiliReader(target);
        if (tab.current !== target) return;
        const page = extractBilibiliPage(markdown, target);
        tab.title = (route.kind === 'video' ? (page.title || t('ui.c1c405af607d')) : t('app.saf.8723df8205bc')).slice(0, 42);
        showInternal(tab, route.kind === 'video'
          ? biliVideoHTML(page, target, route)
          : biliListingHTML(page, target));
      } catch (error) {
        if (tab.current !== target) return;
        showInternal(tab, `<div class="bili-reader">
          ${biliHeader(target, t('app.saf.7b97a791131c'))}
          <div class="bili-reader-error"><b>${t('app.saf.5bca8850689d')}</b><p>${t('app.saf.eaaacbfe3790')}</p><button class="aqua-btn" data-saf-retry="${esc(target)}">${t('app.saf3.16b581d055bb')}</button></div>
        </div>`);
      } finally {
        if (tab.current === target) {
          tab.loading = false;
          if (tab === active) updateChrome(); else renderTabs();
        }
      }
    }

    function bridgeReadableLinks(tab) {
      try {
        const doc = tab.iframe.contentDocument;
        if (!doc || doc.documentElement.dataset.safariBridged) return;
        doc.documentElement.dataset.safariBridged = '1';
        const discoveredTitle = doc.title?.trim();
        if (discoveredTitle) tab.title = discoveredTitle.slice(0,42);
        doc.addEventListener('click', (event) => {
          const link = event.target.closest?.('a[href]');
          if (!link || link.href.startsWith('javascript:') || link.href.startsWith('#')) return;
          event.preventDefault();
          event.stopPropagation();
          linkedTab(link.href);
        }, true);
      } catch (error) {
        // Cross-origin documents remain isolated; their own in-frame navigation still works.
      }
    }

    function nav(raw, skipHistory = false, tab = active) {
      if (!tab) return;
      let target = raw;
      if (target === 'safari://videos') target = 'video:';
      else if (target === 'safari://html5test') target = 'html5:';
      else if (!['home:','blank:','video:','html5:'].includes(target)) target = normalizedUrl(target);
      tab.current = target;
      lastSafariLocation = target;
      tab.title = pageTitle(target);
      tab.loading = false;
      const bili = bilibiliRoute(target);
      if (target === 'home:') showInternal(tab, homeHTML());
      else if (target === 'blank:') showInternal(tab, `<div class="saf-blank-page" aria-label="${t('app.saf.692bd5eb7207')}"></div>`);
      else if (target === 'video:') showInternal(tab, videoHTML());
      else if (target === 'html5:') showInternal(tab, html5HTML());
      else if (bili) showBilibili(tab, target, bili);
      else {
        tab.internal.hidden = true;
        tab.iframe.hidden = false;
        tab.loading = true;
        tab.iframe.src = target;
      }
      if (!skipHistory) {
        tab.history.splice(tab.index + 1);
        tab.history.push(target);
        tab.index = tab.history.length - 1;
      }
      updateChrome();
    }

    function activateTab(tab) {
      active = tab;
      updateChrome();
      requestAnimationFrame(() => url.focus());
    }

    function closeTab(tab) {
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      tab.iframe.src = 'about:blank';
      tab.button.remove(); tab.view.remove(); tabs.splice(index,1);
      if (!tabs.length) return createTab(preferenceTarget('newTab'), true);
      if (active === tab) active = tabs[Math.min(index,tabs.length-1)];
      updateChrome();
    }

    function createTab(target = 'home:', activate = true) {
      const tab = {
        id:++tabSerial, current:'home:', title:t('app.saf.0042465b7788'), history:[], index:-1, loading:false, zoom:1,
      };
      tab.button = el('button','saf-tab');
      tab.button.innerHTML = `<i>◉</i><span class="saf-tab-title">${t('app.saf.0042465b7788')}</span><span class="saf-tab-close" title="${t('ui.70eebdd59754')}">×</span>`;
      tab.button.addEventListener('click',(event)=>{
        if(event.target.closest('.saf-tab-close')){event.stopPropagation();closeTab(tab);return;}
        activateTab(tab);
      });
      tab.view = el('div','saf-tab-view');
      tab.internal = el('div','saf-internal');
      tab.iframe = el('iframe','saf-frame');
      tab.iframe.hidden = true;
      tab.iframe.name = `leopard-safari-tab-${tab.id}`;
      tab.iframe.setAttribute('sandbox',iframeSandbox());
      tab.iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
      tab.iframe.setAttribute('allowfullscreen','');
      tab.iframe.addEventListener('load',()=>{
        if (!tab.internal.hidden) return;
        tab.loading=false;
        bridgeReadableLinks(tab);
        if(tab===active)updateChrome();else renderTabs();
      });
      tab.internal.addEventListener('click',(event)=>{
        const safLink = event.target.closest('[data-saf-url]');
        if (safLink) {
          event.preventDefault();
          linkedTab(safLink.dataset.safUrl);
          return;
        }
        const retry = event.target.closest('[data-saf-retry]');
        if (retry) {
          event.preventDefault();
          biliReaderCache.delete(retry.dataset.safRetry);
          nav(retry.dataset.safRetry, true, tab);
          return;
        }
        const search = event.target.closest('[data-bili-search]');
        if (search) {
          event.preventDefault();
          const input = search.closest('.bili-search')?.querySelector('input');
          const query = input?.value.trim();
          if (query) linkedTab(`https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`);
          return;
        }
        const tile=event.target.closest('.saf-tile');
        if(!tile)return;
        if(event.metaKey||event.ctrlKey||event.shiftKey)linkedTab(tile.dataset.url);
        else nav(tile.dataset.url,false,tab);
      });
      tab.internal.addEventListener('keydown',(event)=>{
        if(event.key!=='Enter'||!event.target.matches('.bili-search input'))return;
        event.preventDefault();
        const query=event.target.value.trim();
        if(query)linkedTab(`https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`);
      });
      tab.view.append(tab.internal,tab.iframe);
      tabs.push(tab);tabList.appendChild(tab.button);views.appendChild(tab.view);
      if(activate)active=tab;
      nav(target,false,tab);
      return tab;
    }

    addTab.addEventListener('click',()=>createTab(preferenceTarget('newTab'),true));
    tabBar.addEventListener('dblclick',(event)=>{if(event.target===tabBar||event.target===tabList)createTab(preferenceTarget('newTab'),true);});
    url.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();nav(url.value);}});
    go.addEventListener('click',()=>nav(url.value));
    back.addEventListener('click',()=>{
      if(!active||active.index<=0)return;
      active.index--;nav(active.history[active.index],true,active);
    });
    fwd.addEventListener('click',()=>{
      if(!active||active.index>=active.history.length-1)return;
      active.index++;nav(active.history[active.index],true,active);
    });
    reload.addEventListener('click',()=>{
      if(!active)return;
      if(active.loading){
        try{active.iframe.contentWindow.stop();}catch(error){}
        active.loading=false;updateChrome();return;
      }
      nav(active.current,true,active);
    });

    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'safari') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('safari') || {};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);
    win = System.createWindow({
      app:'safari',title:'Safari',width:860,height:600,toolbar,content:wrap,statusbar:t('app.saf.e2a0d77458d1'),
      onClose:(window,context)=>{
        if (!context.force && !window._confirmedClose && tabs.length > 1 && preferences.confirmCloseTabs !== false) {
          if (!closeConfirmationOpen) {
            closeConfirmationOpen = true;
            System.confirmSheet({
              parent:window,headline:t('app.saf.closeWin', { n: tabs.length }),
              message:t('app.saf.411db69c5b14'),
              okLabel:t('ui.70eebdd59754'),
              onOK:()=>{
                closeConfirmationOpen=false;
                window._confirmedClose=true;
                setTimeout(()=>System.closeWindow(window),170);
              },
              onClose:()=>{if(!window._confirmedClose)closeConfirmationOpen=false;},
            });
          }
          return false;
        }
        document.removeEventListener('app-preferences-changed', preferencesChanged);
        tabs.forEach(tab=>{tab.iframe.src='about:blank';});
        return true;
      },
    });
    applyPreferences();
    win.addEventListener('leopard-command',(event)=>{
      const command=event.detail?.command;
      const actions={
        'new-tab':()=>createTab(preferenceTarget('newTab'),true),
        'close-tab':()=>active&&closeTab(active),
        'open-location':()=>{url.focus();url.select();},
        'reload':()=>reload.click(),
        'stop':()=>{if(active?.loading)reload.click();},
        'back':()=>back.click(),
        'forward':()=>fwd.click(),
        'actual-size':()=>setPageZoom(1),
        'zoom-in':()=>setPageZoom((active?.zoom||1)+.1),
        'zoom-out':()=>setPageZoom((active?.zoom||1)-.1),
        'show-bookmarks':()=>createTab('home:',true),
        'show-history':()=>{
          if(!active)return;
          const rows=active.history.map((item,index)=>`<button class="saf-history-row" data-saf-url="${esc(item)}"><b>${index+1}</b><span>${esc(addressFor(item)||t('app.saf.0042465b7788'))}</span></button>`).join('');
          const tab=createTab('home:',true);
          tab.title=t('ui.19e0e3f3df89');
          showInternal(tab,`<div class="saf-history"><h1>${t('app.saf3.491d680b0202')}</h1>${rows||`<p>${t('app.saf.0b7e3ff10b3a')}</p>`}</div>`);
          updateChrome();
        },
        'add-bookmark':()=>{
          if(win._status)win._status.textContent=t('app.saf.addBm', { title: active?.title || t('app.saf3.256f1bacaeed') });
        },
      };
      function setPageZoom(value){
        if(!active)return;
        active.zoom=Math.max(.5,Math.min(2,Math.round(value*10)/10));
        active.internal.style.zoom=active.zoom;
        if(win._status)win._status.textContent=t('app.saf.zoom', { pct: Math.round(active.zoom*100) });
      }
      const action=actions[command];
      if(action){event.preventDefault();action();}
    });
    createTab(preferenceTarget('newWindow'),true);
  }

  System.registerApp({
    id: 'safari', name: 'Safari', icon, open, multiWindow: true,
    about: t('app.saf.5d667b6120e8'),
    keywords: t('app.saf3.e062ac18e926'),
  });
})();
