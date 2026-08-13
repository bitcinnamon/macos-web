import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import {
  t, getLocale, setLocale, loadInternationalPrefs, saveInternationalPrefs,
  resolveLanguageOrder, localeDisplayName, SUPPORTED_LOCALES,
} from '../i18n/index.js';
import { html } from '../escape.js';

// 系统偏好设置 (System Preferences) — icon grid + functional panes
(() => {
  const { el } = System;

  // Use the same shared SVG before and after the lazy module loads so Finder
  // and the Dock never flash between two subtly different gear drawings.
  const icon = ICONS.sysprefs;

  // ---------- storage helpers ----------
  const store = (key, def) => {
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem(key)) || {}); } catch (e) { return Object.assign({}, def); }
  };
  const save = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));

  // ---------- wallpapers ----------
  const WALLS = [
    { id: '', cat: t('prefs.wall.cat.apple'), name: 'Aurora', css: 'url("assets/aurora.svg")' },
    { id: 'tiger', cat: t('prefs.wall.cat.apple'), name: 'Aqua Blue', css: 'url("assets/tiger.svg")' },
    { id: 'purpleaurora', cat: t('prefs.wall.cat.apple'), name: 'Purple Aurora', css: 'radial-gradient(ellipse at 66% 22%,#e89cff 0 4%,transparent 27%),radial-gradient(ellipse at 35% 65%,#387de4,transparent 44%),linear-gradient(135deg,#170d38,#7a218d 48%,#091b4d)' },
    { id: 'goldenpalace', cat: t('prefs.wall.cat.apple'), name: 'Golden Palace', css: 'radial-gradient(circle at 50% 32%,#fff6b0 0 2%,#f6c84d 3% 8%,transparent 25%),linear-gradient(155deg,#281514,#9d4b26 48%,#e5a741 70%,#241414)' },
    { id: 'lake', cat: t('prefs.wall.cat.nature'), name: 'Mountain Lake', css: 'linear-gradient(165deg,transparent 49%,rgba(255,255,255,.3) 50% 51%,transparent 52%),linear-gradient(155deg,#77b9df 0 43%,#405d69 44% 51%,#2e6f83 52% 67%,#172f36 68%)' },
    { id: 'forest', cat: t('prefs.wall.cat.nature'), name: 'Forest', css: 'radial-gradient(ellipse at 30% 85%,#83a44b,transparent 42%),linear-gradient(105deg,#10251c,#335e35 45%,#7c9a50 75%,#18261b)' },
    { id: 'grass', cat: t('prefs.wall.cat.nature'), name: 'Grass Blades', css: 'linear-gradient(175deg,#8bc7ed 0 41%,#afd9ef 42%,#4f9a3d 43%,#1f5d27 100%)' },
    { id: 'ocean', cat: t('prefs.wall.cat.nature'), name: 'Rolling Waves', css: 'radial-gradient(ellipse at 55% 56%,rgba(255,255,255,.52),transparent 9%),repeating-radial-gradient(ellipse at 55% 60%,#b6edf1 0 5%,#347c9f 7% 13%,#063852 15% 23%)' },
    { id: 'ice', cat: t('prefs.wall.cat.nature'), name: 'Blue Ice', css: 'linear-gradient(125deg,#e8fbff,#8ecfe4 23%,#d4f3fa 25%,#4d9fbd 47%,#c6edf5 49%,#236a8c 78%,#dff9ff)' },
    { id: 'space', cat: t('prefs.wall.cat.nature'), name: 'Deep Space', css: 'radial-gradient(circle at 23% 28%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 18%,#9ed2ff 0 1px,transparent 2px),radial-gradient(ellipse at 30% 20%,#2a3a6e,#05060f 63%)' },
    { id: 'spectrum', cat: t('prefs.wall.cat.abstract'), name: 'Spectrum', css: 'conic-gradient(from 220deg at 52% 55%,#19245a,#5d1c83,#d1387b,#e69645,#54a769,#2a7fc1,#19245a)' },
    { id: 'ink', cat: t('prefs.wall.cat.abstract'), name: 'Ink', css: 'radial-gradient(circle at 30% 40%,rgba(35,126,189,.9),transparent 24%),radial-gradient(circle at 67% 62%,rgba(170,37,139,.86),transparent 28%),linear-gradient(140deg,#eef6f7,#9fc7cc)' },
    { id: 'sunrise', cat: t('prefs.wall.cat.abstract'), name: 'Sunrise', css: 'linear-gradient(180deg,#2b2e55 0%,#7a4a78 45%,#e88a5a 78%,#f7c96e 100%)' },
    { id: 'graphite', cat: t('prefs.wall.cat.bw'), name: 'Graphite', css: 'radial-gradient(ellipse at 50% 35%,#89939e,#23272d 74%)' },
    { id: 'paper', cat: t('prefs.wall.cat.bw'), name: 'Rice Paper', css: 'repeating-linear-gradient(45deg,#eee 0 2px,#e6e6e3 2px 4px)' },
    { id: 'solidblue', cat: t('prefs.wall.cat.solid'), name: 'Aqua Blue', css: 'linear-gradient(#5087bc,#5087bc)' },
    { id: 'solidgreen', cat: t('prefs.wall.cat.solid'), name: 'Forest Green', css: 'linear-gradient(#3f7254,#3f7254)' },
    { id: 'solidgray', cat: t('prefs.wall.cat.solid'), name: 'Neutral Gray', css: 'linear-gradient(#777,#777)' },
  ];
  let wallpaperTimer = 0;
  let soundInputStream = null;
  let soundInputFrame = 0;
  let soundInputContext = null;
  let soundInputGain = null;
  let soundInputRun = 0;
  let soundInputPending = false;
  let voiceOverUtilityWin = null;
  let universalOptionsWin = null;
  let screenSaverOptionsWin = null;
  let hotCornersWindow = null;
  const SCREEN_SAVER_KEY = 'macweb.screensaver.v1';
  const SCREEN_SAVERS = ['Flurry', 'Computer Name', 'Arabesque', 'iTunes Artwork', 'RSS Visualizer', 'Shell', 'Spectrum', 'Word of the Day', 'Pictures Folder'];
  let screenSaverOverlay = null;
  let screenSaverClockTimer = 0;
  let energyScheduleWin = null;
  let networkServiceOrderWin = null;
  let bluetoothTransferWin = null;
  let bluetoothBrowserWin = null;
  let bluetoothAdvancedWin = null;

  function screenSaverConfig() {
    const defaults = {
      selected:'Flurry',
      random:false,
      clock:false,
      delay:3,
      particles:4,
      speed:100,
      color:'aurora',
      corners:['none','dashboard','desktop','screensaver'],
    };
    const cfg = store(SCREEN_SAVER_KEY, defaults);
    if (!SCREEN_SAVERS.includes(cfg.selected)) cfg.selected = 'Flurry';
    cfg.delay = [0,1,3,5,10,15].includes(Number(cfg.delay)) ? Number(cfg.delay) : 3;
    cfg.particles = Math.max(2, Math.min(10, Number(cfg.particles) || 4));
    cfg.speed = Math.max(55, Math.min(190, Number(cfg.speed) || 100));
    cfg.color = ['aurora','blue','green','gold','mono'].includes(cfg.color) ? cfg.color : 'aurora';
    cfg.corners = Array.isArray(cfg.corners) ? cfg.corners.slice(0, 4) : defaults.corners.slice();
    while (cfg.corners.length < 4) cfg.corners.push('none');
    return cfg;
  }

  function saveScreenSaverConfig(cfg) {
    save(SCREEN_SAVER_KEY, cfg);
    document.dispatchEvent(new CustomEvent('screensaver-preferences-changed', { detail:cfg }));
  }

  function saverEffect(name, cfg, className = '') {
    const particles = Array.from({ length:cfg.particles }, (_, index) =>
      `<i style="animation-delay:${(-index * .72).toFixed(2)}s;animation-duration:${(3.6 / (cfg.speed / 100)).toFixed(2)}s"></i>`).join('');
    const label = name === 'Computer Name' ? `<strong>${t('prefs.ui2.b67d82ffbedd')}</strong>`
      : name === 'iTunes Artwork' ? `<strong>${t('prefs.ui2.94ba182fd4ca')}</strong>`
      : name === 'RSS Visualizer' ? `<strong>${t('prefs.ui2.d3236e50e639')}</strong>`
      : name === 'Word of the Day' ? `<strong>serendipity</strong><em>${t('prefs.ui2.9851ea28ae82')}</em>`
      : name === 'Pictures Folder' ? `<strong>${t('prefs.msg.818d0ab93e')}</strong>`
      : '';
    return `<div class="saver-runtime ${className}" data-saver="${name}" data-color="${cfg.color}">
      <div class="saver-flurry">${particles}</div>${label}</div>`;
  }

  function closeScreenSaver() {
    if (!screenSaverOverlay) return;
    const overlay = screenSaverOverlay;
    screenSaverOverlay = null;
    overlay._screenSaverCleanup?.();
    clearInterval(screenSaverClockTimer);
    screenSaverClockTimer = 0;
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 180);
    document.dispatchEvent(new CustomEvent('screensaver-preferences-changed'));
  }

  function startScreenSaver(options = {}) {
    if (screenSaverOverlay) return screenSaverOverlay;
    const cfg = screenSaverConfig();
    const chosen = options.name || (cfg.random
      ? SCREEN_SAVERS[Math.floor(Math.random() * SCREEN_SAVERS.length)]
      : cfg.selected);
    const overlay = el('div', 'screensaver-test');
    overlay.innerHTML = `${saverEffect(chosen, cfg, 'fullscreen')}<b class="screensaver-name">${chosen}</b>
      ${cfg.clock ? '<time class="screensaver-clock"></time>' : ''}<small>${t('prefs.msg.f00e934f40')}</small>`;
    screenSaverOverlay = overlay;
    const updateClock = () => {
      const clock = overlay.querySelector('.screensaver-clock');
      if (clock) clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    };
    updateClock();
    if (cfg.clock) screenSaverClockTimer = setInterval(updateClock, 1000);
    const close = () => closeScreenSaver();
    const cleanup = () => removeEventListener('keydown', close);
    overlay._screenSaverCleanup = cleanup;
    addEventListener('keydown', close);
    overlay.addEventListener('pointermove', close, { once:true });
    overlay.addEventListener('mousedown', close, { once:true });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('shown'));
    return overlay;
  }

  function showScreenSaverOptions(onChange) {
    if (screenSaverOptionsWin?.isConnected) {
      System.focusWindow(screenSaverOptionsWin);
      return;
    }
    const cfg = screenSaverConfig();
    const content = el('div', 'spp-pane saver-options-window');
    content.innerHTML = `<div class="saver-options-preview"></div>
      <label><span>${t('prefs.msg.45c5284e90')}</span><input class="saver-particle-range" type="range" min="2" max="10" value="${cfg.particles}"><output>${cfg.particles}</output></label>
      <label><span>${t('prefs.msg.3adf182b6b')}</span><input class="saver-speed-range" type="range" min="55" max="190" value="${cfg.speed}"><output>${cfg.speed}%</output></label>
      <label><span>${t('prefs.msg.e4e05e7d53')}</span><select class="saver-color-select">
        <option value="aurora">${t('prefs.ui2.2600f792977e')}</option><option value="blue">${t('prefs.ui2.b1e639861099')}</option><option value="green">${t('prefs.ui2.5cc9ce502df5')}</option>
        <option value="gold">${t('prefs.ui2.140913b42c5f')}</option><option value="mono">${t('prefs.ui5.984eaeda0ef0')}</option>
      </select></label>
      <p>${t('prefs.msg.18f641c867')}</p>
      <footer><button class="aqua-btn default">${t('common.done')}</button></footer>`;
    const preview = content.querySelector('.saver-options-preview');
    const particle = content.querySelector('.saver-particle-range');
    const speed = content.querySelector('.saver-speed-range');
    const color = content.querySelector('.saver-color-select');
    color.value = cfg.color;
    const redraw = () => {
      preview.innerHTML = saverEffect(cfg.selected, cfg, 'options');
      particle.nextElementSibling.textContent = String(cfg.particles);
      speed.nextElementSibling.textContent = `${cfg.speed}%`;
      saveScreenSaverConfig(cfg);
      onChange?.(cfg);
    };
    particle.addEventListener('input', () => { cfg.particles = Number(particle.value); redraw(); });
    speed.addEventListener('input', () => { cfg.speed = Number(speed.value); redraw(); });
    color.addEventListener('change', () => { cfg.color = color.value; redraw(); });
    screenSaverOptionsWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.7bd4fa5067'), width:470, height:390,
      content, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:340, maxHeight:480 },
      onClose:() => { screenSaverOptionsWin = null; },
    });
    content.querySelector('footer button').addEventListener('click', () => System.closeWindow(screenSaverOptionsWin));
    redraw();
  }

  function showHotCornersEditor() {
    if (hotCornersWindow?.isConnected) {
      System.focusWindow(hotCornersWindow);
      return;
    }
    const cfg = screenSaverConfig();
    const actions = [
      ['none','—'], ['all-windows',t('prefs.msg.cb4d8c526d')], ['application-windows',t('prefs.msg.37de153661')],
      ['desktop',t('prefs.msg.2828b79cbd')], ['dashboard',t('prefs.msg.2938c7f7e5')], ['screensaver',t('prefs.desktop.action.screensaver')],
      ['disable-screensaver',t('prefs.msg.6e79c84c54')],
    ];
    const positions = [['tl',t('prefs.msg.df68a5dc8f')],['tr',t('prefs.msg.e717b4ae48')],['bl',t('prefs.msg.2a97dfb2d2')],['br',t('prefs.msg.1c9bc9dab3')]];
    const content = el('div', 'spp-pane hot-corner-editor');
    content.innerHTML = `<p>${t('prefs.ui5.f1a5219ccb3d')}</p>
      <div class="hot-corner-monitor"><span>Mac OS X</span>${positions.map(([cls,label], index) => `
        <label class="${cls}"><b>${label}</b><select data-corner="${index}">${actions.map(([value,name]) =>
          `<option value="${value}">${name}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="hot-corner-hint">${t('prefs.msg.54494319b7')}</p>
      <footer><button class="aqua-btn default">${t('common.done')}</button></footer>`;
    content.querySelectorAll('[data-corner]').forEach((select) => {
      const index = Number(select.dataset.corner);
      select.value = cfg.corners[index] || 'none';
      select.addEventListener('change', () => {
        cfg.corners[index] = select.value;
        saveScreenSaverConfig(cfg);
      });
    });
    hotCornersWindow = System.createWindow({
      app:'sysprefs', title: t('prefs.expose.hotCorners'), width:650, height:430,
      content, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:390, maxHeight:520 },
      onClose:() => { hotCornersWindow = null; },
    });
    content.querySelector('footer button').addEventListener('click', () => System.closeWindow(hotCornersWindow));
  }

  function applyWallpaper(w) {
    if (!w) return;
    if (w.id) document.body.dataset.wallpaper = w.id;
    else delete document.body.dataset.wallpaper;
    const desktop = document.querySelector('#desktop');
    if (desktop) {
      desktop.style.background = `${w.css} center / cover no-repeat`;
      desktop.style.backgroundPosition = 'center';
    }
    localStorage.setItem('macweb.wallpaper', w.id);
    localStorage.setItem('macweb.wallpaper.css', w.css);
    localStorage.setItem('macweb.wallpaper.name', w.name);
  }

  function bindTabs(root) {
    const tabs = Array.from(root.querySelectorAll('.spp-tabs [data-tab]'));
    const panels = Array.from(root.querySelectorAll('.spp-tab-panel[data-panel]'));
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
      root.dispatchEvent(new CustomEvent('panel-layout-changed', { bubbles:true }));
    }));
  }

  // ---------- pane icons (mini Aqua SVGs) ----------
  const PI = {
    appearance: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><path d="M32 8 a24 24 0 0 1 0 48 z" fill="#4f9ad8"/><path d="M32 8 a24 24 0 0 0 0 48 z" fill="#9aa2ae"/><circle cx="32" cy="32" r="7" fill="#ececec" stroke="#777" stroke-width="1.2"/></svg>`,
    desktop: `<svg viewBox="0 0 64 64"><rect x="6" y="12" width="52" height="36" rx="4" fill="#1a1040" stroke="#5a6270" stroke-width="1.5"/><path d="M6 40 Q22 18 34 32 T58 24 V44 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4z" fill="#6a4ae0" opacity=".8"/><path d="M6 30 Q20 40 34 24 T58 36" stroke="#b8a2f0" stroke-width="3" fill="none" opacity=".7"/><rect x="24" y="52" width="16" height="4" rx="2" fill="#9aa2b0"/></svg>`,
    dock: `<svg viewBox="0 0 64 64"><rect x="4" y="38" width="56" height="14" rx="3" fill="#cfd4dc" stroke="#8a909a" stroke-width="1.5"/><circle cx="16" cy="45" r="5" fill="#4f9ad8"/><circle cx="32" cy="45" r="5" fill="#f5b53c"/><circle cx="48" cy="45" r="5" fill="#67c045"/><rect x="10" y="18" width="12" height="12" rx="3" fill="#4f9ad8" opacity=".5"/><rect x="26" y="14" width="14" height="14" rx="3" fill="#f5b53c" opacity=".5"/><rect x="44" y="18" width="12" height="12" rx="3" fill="#67c045" opacity=".5"/></svg>`,
    display: `<svg viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="34" rx="3" fill="#2a2f38" stroke="#5a6270" stroke-width="1.5"/><rect x="11" y="13" width="42" height="28" fill="#7ec0ea"/><circle cx="24" cy="24" r="6" fill="#ffd76e"/><path d="M11 36 l12 -9 8 6 9 -11 13 12 v7 H11z" fill="#3f7f3f"/><path d="M24 44 h16 l3 8 H21z" fill="#b8bec8" stroke="#5a6270" stroke-width="1.5"/><rect x="16" y="52" width="32" height="4" rx="2" fill="#9aa2b0"/></svg>`,
    sound: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#e8ecf2" stroke="#8a909a" stroke-width="1.5"/><path d="M16 26 h8 l10 -9 v30 l-10 -9 h-8z" fill="#4a5568"/><path d="M40 24 a10 10 0 0 1 0 16 M45 19 a17 17 0 0 1 0 26" stroke="#4a5568" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
    energy: `<svg viewBox="0 0 64 64"><circle cx="32" cy="26" r="16" fill="#ffe9a8" stroke="#c8a83c" stroke-width="1.5"/><path d="M32 4 v6 M10 26 h-6 M60 26 h-6 M17 11 l4 4 M47 11 l-4 4" stroke="#c8a83c" stroke-width="2.5" stroke-linecap="round"/><rect x="26" y="42" width="12" height="8" fill="#b8bec8" stroke="#7a8090" stroke-width="1.5"/><rect x="27" y="50" width="10" height="4" rx="1" fill="#8a909a"/></svg>`,
    accounts: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#cfe3fb" stroke="#4573b5" stroke-width="1.5"/><circle cx="32" cy="25" r="9" fill="#4573b5"/><path d="M14 50 q4 -14 18 -14 t18 14" fill="#4573b5"/></svg>`,
    datetime: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#fff" stroke="#8a909a" stroke-width="2"/><circle cx="32" cy="32" r="2.5" fill="#333"/><path d="M32 32 L32 14" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><path d="M32 32 L44 40" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><path d="M32 32 L20 46" stroke="#e05a4a" stroke-width="1.5" stroke-linecap="round"/><g fill="#666"><circle cx="32" cy="9" r="1.5"/><circle cx="55" cy="32" r="1.5"/><circle cx="32" cy="55" r="1.5"/><circle cx="9" cy="32" r="1.5"/></g></svg>`,
    update: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#cfe8cf" stroke="#4a8f4a" stroke-width="1.5"/><path d="M32 14 v22 M22 28 l10 10 10 -10" stroke="#2e7d32" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 46 h28" stroke="#2e7d32" stroke-width="4" stroke-linecap="round"/></svg>`,
    reset: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#f5d5cf" stroke="#b05a4a" stroke-width="1.5"/><path d="M42 20 a15 15 0 1 0 5 12" stroke="#a03a2a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M42 12 v10 h-10" stroke="#a03a2a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  const paneIcon = (id, color, mark) => `<svg viewBox="0 0 64 64"><defs><radialGradient id="${id}pi" cx=".35" cy=".28"><stop stop-color="#fff"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="#586474"/></radialGradient></defs><circle cx="32" cy="32" r="26" fill="url(#${id}pi)" stroke="#566270" stroke-width="1.4"/><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${mark}</g></svg>`;
  Object.assign(PI, {
    exposespaces: paneIcon('exsp','#6998d2','<rect x="17" y="17" width="13" height="13"/><rect x="34" y="17" width="13" height="13"/><rect x="17" y="34" width="13" height="13"/><rect x="34" y="34" width="13" height="13"/>'),
    security: paneIcon('secu','#d3aa54','<path d="M21 29v-7a11 11 0 0 1 22 0v7"/><rect x="17" y="28" width="30" height="23" rx="4"/><circle cx="32" cy="39" r="3"/><path d="M32 42v5"/>'),
    spotlight: paneIcon('spot','#678fca','<circle cx="28" cy="28" r="12"/><path d="m37 37 11 11"/>'),
    international: paneIcon('intl','#66a56f','<circle cx="32" cy="32" r="20"/><path d="M12 32h40M32 12c-8 9-8 31 0 40M32 12c8 9 8 31 0 40"/>'),
    keyboard: paneIcon('keyb','#8e98a8','<rect x="12" y="19" width="40" height="27" rx="4"/><path d="M18 26h3m5 0h3m5 0h3m5 0h3M18 33h4m4 0h4m4 0h4m4 0h4M20 40h24"/>'),
    cd: paneIcon('disc','#9fa8b5','<circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="5"/><path d="M32 14v13M49 26l-12 4M43 46l-8-10M21 47l8-11M15 25l12 5"/>'),
    printfax: paneIcon('prnt','#8299b5','<rect x="19" y="10" width="26" height="17"/><rect x="12" y="24" width="40" height="22" rx="4"/><rect x="19" y="38" width="26" height="16"/><path d="M43 31h2"/>'),
    network: paneIcon('netw','#5794d1','<circle cx="32" cy="32" r="20"/><path d="M12 32h40M32 12c-7 9-7 31 0 40M32 12c7 9 7 31 0 40"/>'),
    bluetooth: paneIcon('btth','#527fc5','<path d="m30 12 13 12-13 10 13 10-13 10V12ZM18 23l25 21M18 44l25-21"/>'),
    sharing: paneIcon('shar','#7a9cce','<circle cx="20" cy="20" r="6"/><circle cx="44" cy="20" r="6"/><circle cx="32" cy="45" r="6"/><path d="m25 23 7 16 7-16M26 20h12"/>'),
    dotmac: paneIcon('dotm','#8da8d8','<path d="M18 40c-8-12 4-25 15-17 7-10 22-3 18 9 9 4 5 16-4 16H20c-8 0-10-8-2-8z"/>'),
    parental: paneIcon('prntc','#cf9862','<circle cx="32" cy="25" r="9"/><path d="M16 50q3-16 16-16t16 16"/><path d="M12 16h40"/>'),
    timemachine: paneIcon('tmpr','#4aa391','<path d="M21 18a19 19 0 1 1-5 16"/><path d="m14 18 8 1-2-8M32 20v13l9 5"/>'),
    startup: paneIcon('strt','#8994a4','<path d="M15 20h34v25H15z"/><path d="M20 26h24M22 51h20"/>'),
    speech: paneIcon('spch','#9b74ba','<path d="M14 31h9l11-10v22L23 33h-9zM41 26a9 9 0 0 1 0 12M46 21a16 16 0 0 1 0 22"/>'),
    universal: paneIcon('univ','#558ac6','<circle cx="32" cy="16" r="5"/><path d="M14 25h36M32 25v27M20 52l12-15 12 15"/>'),
  });

  // ---------- panes ----------
  const PANES = [
    { id: 'appearance', group: 'personal', build: buildAppearance },
    { id: 'desktop', group: 'personal', fitWidth:760, fitMinHeight:520, fitInset:0, build: buildDesktopPane },
    { id: 'dock', group: 'personal', fitMaxHeight:440, build: buildDockPane },
    { id: 'exposespaces', group: 'personal', build: () => buildExtraPane('exposespaces') },
    { id: 'security', group: 'personal', build: () => buildExtraPane('security') },
    { id: 'spotlight', group: 'personal', build: () => buildExtraPane('spotlight') },
    { id: 'international', group: 'personal', build: () => buildExtraPane('international') },
    { id: 'display', group: 'hardware', build: buildDisplay },
    { id: 'sound', group: 'hardware', build: buildSound },
    { id: 'energy', group: 'hardware', build: buildEnergy },
    { id: 'keyboard', group: 'hardware', build: () => buildExtraPane('keyboard') },
    { id: 'cd', group: 'hardware', build: () => buildExtraPane('cd') },
    { id: 'printfax', group: 'hardware', fitInset:0, build: () => buildExtraPane('printfax') },
    { id: 'dotmac', group: 'internet', build: () => buildExtraPane('dotmac') },
    { id: 'network', group: 'internet', fitInset:0, build: () => buildExtraPane('network') },
    { id: 'bluetooth', group: 'internet', fitInset:0, build: () => buildExtraPane('bluetooth') },
    { id: 'sharing', group: 'internet', fitInset:0, build: () => buildExtraPane('sharing') },
    { id: 'accounts', group: 'system', build: buildAccounts },
    { id: 'datetime', group: 'system', build: buildDateTime },
    { id: 'parental', group: 'system', fitInset:0, build: () => buildExtraPane('parental') },
    { id: 'update', group: 'system', build: buildUpdate },
    { id: 'speech', group: 'system', build: () => buildExtraPane('speech') },
    { id: 'startup', group: 'system', build: () => buildExtraPane('startup') },
    { id: 'timemachine', group: 'system', build: () => buildExtraPane('timemachine') },
    { id: 'universal', group: 'system', build: () => buildExtraPane('universal') },
    { id: 'reset', group: 'system', build: buildReset },
  ];
  const paneLabel = (id) => t(`prefs.pane.${id}`);
  const groupLabel = (g) => t(`prefs.group.${g}`);
  void 'prefs.pane.exposespaces prefs.pane.security prefs.pane.spotlight prefs.pane.network prefs.pane.bluetooth prefs.pane.universal';

  function row(labelText, control, hint) {
    const r = el('div', 'spp-row');
    const lb = el('span', 'spp-label', labelText);
    r.append(lb, control);
    if (hint) { const h = el('div', 'spp-hint', hint); const w = el('div'); w.append(r, h); return w; }
    return r;
  }

  // -- 外观 --
  function buildAppearance() {
    const c = el('div', 'spp-pane appearance-pane');
    const cfg = store('macweb.pref.appearance', {
      appearance: localStorage.getItem('macweb.appearance') || 'blue', highlight: 'blue',
      arrows: 'together', track: 'next', smooth: true, titlebar: true,
      recentApps: 10, recentDocs: 10, recentServers: 10, smoothing: t('prefs.ui.fontAuto'), fontCutoff: 4,
    });
    c.innerHTML = `
      <div class="appearance-preview"><div class="mini-window"><header><i></i><i></i><i></i><b>${t('prefs.ui.preview')}</b></header><nav><button class="sel">${t('prefs.ui.favorites')}</button><button>${t('prefs.ui.devices')}</button></nav><main><button class="aqua-btn default">${t('prefs.ui.ok')}</button><select><option>Leopard</option></select></main></div></div>
      <div class="appearance-options">
        <label><span>${t('prefs.ui.appearance')}</span><select class="spp-select appearance-choice"><option value="blue">${t('prefs.ui.blue')}</option><option value="graphite">${t('prefs.ui.graphite')}</option></select></label>
        <label><span>${t('prefs.ui.highlight')}</span><select class="spp-select highlight-choice"><option value="blue">${t('prefs.ui.blue')}</option><option value="graphite">${t('prefs.ui.graphite')}</option><option value="gold">${t('prefs.ui.gold')}</option><option value="green">${t('prefs.ui.green')}</option><option value="orange">${t('prefs.ui.orange')}</option><option value="purple">${t('prefs.ui.purple')}</option><option value="red">${t('prefs.ui.red')}</option></select></label>
        <fieldset><legend>${t('prefs.ui.scrollArrows')}</legend><label><input type="radio" name="arrows" value="together"> ${t('prefs.ui.arrowsTogether')}</label><label><input type="radio" name="arrows" value="ends"> ${t('prefs.ui.arrowsEnds')}</label></fieldset>
        <fieldset><legend>${t('prefs.ui.clickScroll')}</legend><label><input type="radio" name="track" value="next"> ${t('prefs.ui.nextPage')}</label><label><input type="radio" name="track" value="spot"> ${t('prefs.ui.clickSpot')}</label></fieldset>
        <label class="spp-check"><input class="appearance-smooth" type="checkbox"> ${t('prefs.ui.smoothScroll')}</label>
        <label class="spp-check"><input class="appearance-titlebar" type="checkbox"> ${t('prefs.ui.dblTitleMin')}</label>
      </div>
      <section class="appearance-recents">
        <h3>${t('prefs.ui.recentCount')}</h3>
        <label>${t('prefs.ui.applications')}<select class="spp-select recent-apps">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select></label>
        <label>${t('prefs.ui.documents')}<select class="spp-select recent-docs">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select></label>
        <label>${t('prefs.ui.servers')}<select class="spp-select recent-servers">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select>
        <button class="aqua-btn clear-recents">${t('prefs.ui.clearRecents')}</button></label>
      </section>
      <section class="appearance-fonts">
        <label>${t('prefs.ui.fontSmoothing')}<select class="spp-select smoothing-choice"><option>${t('prefs.ui.fontAuto')}</option><option>${t('prefs.ui.fontStandard')}</option><option>${t('prefs.ui.fontLight')}</option><option>${t('prefs.ui.fontMedium')}</option><option>${t('prefs.ui.fontStrong')}</option></select></label>
        <label>${t('prefs.ui.fontCutoff')}<select class="spp-select cutoff-choice">${[4,6,8,9,10,12].map(n=>`<option value="${n}">${t('prefs.ui.andBelow', { n })}</option>`).join('')}</select></label>
      </section>`;
    const saveCfg = () => save('macweb.pref.appearance', cfg);
    const appearance = c.querySelector('.appearance-choice');
    appearance.value = cfg.appearance;
    appearance.addEventListener('change', () => {
      cfg.appearance = appearance.value;
      document.body.toggleAttribute('data-appearance', false);
      if (cfg.appearance === 'graphite') document.body.dataset.appearance = 'graphite';
      else delete document.body.dataset.appearance;
      if (cfg.appearance === 'graphite') localStorage.setItem('macweb.appearance', 'graphite');
      else localStorage.removeItem('macweb.appearance');
      saveCfg();
    });
    const highlight = c.querySelector('.highlight-choice');
    highlight.value = cfg.highlight;
    const highlightColors = { blue:'#3875d7', graphite:'#777f89', gold:'#c79a32', green:'#4b9b52', orange:'#d97b2d', purple:'#8864b5', red:'#cc5650' };
    highlight.addEventListener('change', () => {
      cfg.highlight = highlight.value;
      document.documentElement.style.setProperty('--leopard-blue', highlightColors[cfg.highlight]);
      saveCfg();
    });
    c.querySelectorAll('[name="arrows"]').forEach((radio) => { radio.checked = radio.value === cfg.arrows; radio.addEventListener('change', () => { cfg.arrows = radio.value; saveCfg(); }); });
    c.querySelectorAll('[name="track"]').forEach((radio) => { radio.checked = radio.value === cfg.track; radio.addEventListener('change', () => { cfg.track = radio.value; saveCfg(); }); });
    [['.appearance-smooth','smooth'],['.appearance-titlebar','titlebar']].forEach(([selector,key]) => {
      const control = c.querySelector(selector); control.checked = cfg[key]; control.addEventListener('change', () => { cfg[key] = control.checked; saveCfg(); });
    });
    [['.recent-apps','recentApps'],['.recent-docs','recentDocs'],['.recent-servers','recentServers'],['.smoothing-choice','smoothing'],['.cutoff-choice','fontCutoff']].forEach(([selector,key]) => {
      const control = c.querySelector(selector); control.value = String(cfg[key]); control.addEventListener('change', () => { cfg[key] = control.tagName === 'SELECT' && /^\d+$/.test(control.value) ? +control.value : control.value; saveCfg(); });
    });
    c.querySelector('.clear-recents').addEventListener('click', () => {
      System.clearRecentItems?.();
      Leopard.toast(t('prefs.pane.appearance'), t('prefs.appearance.cleared'));
    });
    return c;
  }

  // -- 桌面背景 --
  function buildDesktopPane() {
    const c = el('div', 'spp-pane desktop-saver-pane');
    c.innerHTML = `
      <div class="spp-tabs">
        <button class="active" data-tab="desktop">${t('prefs.desktop.tabDesktop')}</button>
        <button data-tab="saver">${t('prefs.desktop.tabSaver')}</button>
      </div>
      <section class="spp-tab-panel desktop-panel" data-panel="desktop">
        <aside class="wallpaper-sources"></aside>
        <main>
          <header class="wallpaper-current"><div></div><span><b></b><small>Apple Desktop Pictures</small></span></header>
          <div class="wallpaper-grid"></div>
          <footer>
            <label class="spp-check"><input class="wall-rotate" type="checkbox"> ${t('prefs.wall.changePicture')}</label>
            <select class="spp-select wall-interval"><option value="5">${t('prefs.wall.every5')}</option><option value="15">${t('prefs.wall.every15')}</option><option value="30" selected>${t('prefs.wall.every30')}</option><option value="60">${t('prefs.wall.hourly')}</option><option value="1440">${t('prefs.wall.daily')}</option></select>
            <label class="spp-check"><input class="wall-random" type="checkbox"> ${t('prefs.wall.random')}</label>
            <label class="spp-check"><input class="wall-translucent" type="checkbox"> ${t('prefs.wall.translucent')}</label>
          </footer>
        </main>
        <input class="wallpaper-upload" type="file" accept="image/*" multiple hidden>
      </section>
      <section class="spp-tab-panel saver-panel" data-panel="saver" hidden>
        <aside class="saver-list"></aside>
        <main>
          <div class="saver-preview"><div class="saver-flurry"><i></i><i></i><i></i><i></i></div><b>Flurry</b></div>
          <div class="saver-actions"><button class="aqua-btn saver-options">${t('common.options')}</button><button class="aqua-btn default saver-test">${t('common.test')}</button></div>
          <label class="spp-check"><input class="saver-random" type="checkbox"> ${t('prefs.desktop.randomSaver')}</label>
          <label class="spp-check"><input class="saver-clock" type="checkbox"> ${t('prefs.desktop.showClock')}</label>
          <div class="saver-delay"><span>${t('prefs.desktop.startAfter')}</span><input class="saver-delay-range" type="range" min="0" max="5" value="2"><small class="saver-delay-value">3</small><small>${t('common.never')}</small></div>
          <button class="aqua-btn saver-corners">${t('prefs.desktop.hotCorners')}</button>
        </main>
      </section>`;
    bindTabs(c);

    const folderWalls = () => (VFS.list(paths.pictures) || []).map((name) => {
      const node = VFS.get(`${paths.pictures}/${name}`);
      return node?.kind === 'image' && node.src
        ? { id: `user:${name}`, cat: t('prefs.wall.cat.pictures'), name, css: `url(${node.src})` }
        : null;
    }).filter(Boolean);
    const allWalls = () => [...WALLS, ...folderWalls()];
    const categories = [...new Set(allWalls().map((w) => w.cat))];
    const sources = c.querySelector('.wallpaper-sources');
    const grid = c.querySelector('.wallpaper-grid');
    const current = c.querySelector('.wallpaper-current');
    const selectedId = localStorage.getItem('macweb.wallpaper') || '';
    let currentWall = allWalls().find((w) => w.id === selectedId) || WALLS[0];
    const showCurrent = () => {
      current.querySelector('div').style.background = `${currentWall.css} center / cover`;
      current.querySelector('b').textContent = currentWall.name;
      current.querySelector('small').textContent = currentWall.cat;
    };
    const renderCategory = (cat) => {
      sources.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.cat === cat));
      grid.innerHTML = '';
      allWalls().filter((w) => w.cat === cat).forEach((w) => {
        const tile = el('button', 'wallpaper-tile' + (w.id === currentWall.id ? ' sel' : ''));
        tile.append(el('i'), el('span', '', w.name));
        tile.querySelector('i').style.background = `${w.css} center / cover`;
        tile.addEventListener('click', () => {
          currentWall = w;
          applyWallpaper(w);
          grid.querySelectorAll('.wallpaper-tile').forEach((n) => n.classList.toggle('sel', n === tile));
          showCurrent();
        });
        grid.appendChild(tile);
      });
    };
    categories.forEach((cat, index) => {
      const b = el('button', index === 0 ? 'sel' : '');
      b.dataset.cat = cat;
      b.innerHTML = `<i>${cat === t('prefs.wall.cat.solid') ? '▦' : cat === t('prefs.wall.cat.nature') ? '♣' : cat === t('prefs.wall.cat.bw') ? '◐' : '◆'}</i><span>${cat}</span>`;
      b.addEventListener('click', () => renderCategory(cat));
      sources.appendChild(b);
    });
    sources.insertAdjacentHTML('beforeend', `<hr><button class="wallpaper-import"><i>＋</i><span>${t('prefs.wall.chooseFolder')}</span></button>`);
    const upload = c.querySelector('.wallpaper-upload');
    c.querySelector('.wallpaper-import').addEventListener('click', () => upload.click());
    upload.addEventListener('change', async () => {
      const files = Array.from(upload.files || []).filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      for (const file of files) {
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const ext = file.name.match(/\.[^.]+$/)?.[0] || '.jpg';
        const base = file.name.replace(/\.[^.]+$/, '') || t('prefs.ui2.3b79197d11c2');
        const savedName = VFS.uniqueName(paths.pictures, base, ext);
        VFS.putNode(`${paths.pictures}/${savedName}`, { type: 'file', kind: 'image', src });
      }
      const folder = sources.querySelector(`[data-cat="${t('prefs.msg.818d0ab93e')}"]`);
      if (folder) folder.click();
      else {
        const button = el('button', 'sel');
        button.dataset.cat = t('prefs.wall.cat.pictures');
        button.innerHTML = `<i>▧</i><span>${t('prefs.wall.cat.pictures')}</span>`;
        button.addEventListener('click', () => renderCategory(t('prefs.wall.cat.pictures')));
        sources.insertBefore(button, sources.querySelector('hr'));
        renderCategory(t('prefs.wall.cat.pictures'));
      }
      currentWall = allWalls().filter((wall) => wall.cat === t('prefs.wall.cat.pictures')).at(-1) || currentWall;
      applyWallpaper(currentWall);
      showCurrent();
      renderCategory(t('prefs.wall.cat.pictures'));
      upload.value = '';
    });
    showCurrent();
    renderCategory(currentWall.cat);

    const rotate = c.querySelector('.wall-rotate');
    const interval = c.querySelector('.wall-interval');
    const random = c.querySelector('.wall-random');
    const translucent = c.querySelector('.wall-translucent');
    rotate.checked = localStorage.getItem('macweb.wallpaper.rotate') === '1';
    random.checked = localStorage.getItem('macweb.wallpaper.random') === '1';
    translucent.checked = localStorage.getItem('macweb.menubar.translucent') === '1';
    interval.value = localStorage.getItem('macweb.wallpaper.interval') || '30';
    const schedule = () => {
      clearInterval(wallpaperTimer);
      if (!rotate.checked) return;
      wallpaperTimer = setInterval(() => {
        const list = allWalls().filter((w) => w.cat === currentWall.cat);
        const index = list.indexOf(currentWall);
        currentWall = random.checked ? list[Math.floor(Math.random() * list.length)] : list[(index + 1) % list.length];
        applyWallpaper(currentWall);
        showCurrent();
        renderCategory(currentWall.cat);
      }, +interval.value * 60000);
    };
    rotate.addEventListener('change', () => { localStorage.setItem('macweb.wallpaper.rotate', rotate.checked ? '1' : '0'); schedule(); });
    interval.addEventListener('change', () => { localStorage.setItem('macweb.wallpaper.interval', interval.value); schedule(); });
    random.addEventListener('change', () => localStorage.setItem('macweb.wallpaper.random', random.checked ? '1' : '0'));
    translucent.addEventListener('change', () => {
      localStorage.setItem('macweb.menubar.translucent', translucent.checked ? '1' : '0');
      document.body.classList.toggle('translucent-menubar', translucent.checked);
    });
    schedule();

    const saverCfg = screenSaverConfig();
    const savers = SCREEN_SAVERS.filter((name) => name !== 'Pictures Folder');
    const saverList = c.querySelector('.saver-list');
    const saverPreview = c.querySelector('.saver-preview');
    const renderSaverPreview = () => {
      saverPreview.innerHTML = `${saverEffect(saverCfg.selected, saverCfg, 'preview')}<b>${saverCfg.selected}</b>`;
    };
    saverList.innerHTML = '<h4>APPLE</h4>' + savers.map((name, index) =>
      `<button data-saver="${name}" class="${name === saverCfg.selected ? 'sel' : ''}"><i>${index % 2 ? '◉' : '✦'}</i>${name}</button>`).join('')
      + `<h4>${t('prefs.desktop.pictures')}</h4><button data-saver="Pictures Folder" class="${saverCfg.selected === 'Pictures Folder' ? 'sel' : ''}"><i>▧</i>Pictures Folder</button>`;
    saverList.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      saverList.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === button));
      saverCfg.selected = button.dataset.saver;
      saveScreenSaverConfig(saverCfg);
      renderSaverPreview();
    });
    c.querySelector('.saver-options').addEventListener('click', () => showScreenSaverOptions((next) => {
      Object.assign(saverCfg, next);
      renderSaverPreview();
    }));
    c.querySelector('.saver-test').addEventListener('click', () => startScreenSaver());
    const randomSaver = c.querySelector('.saver-random');
    const saverClock = c.querySelector('.saver-clock');
    const saverDelay = c.querySelector('.saver-delay-range');
    const saverDelayValue = c.querySelector('.saver-delay-value');
    const delays = [1,3,5,10,15,0];
    const delayLabel = (minutes) => minutes ? t('common.minutes', { n: minutes }) : t('common.never');
    randomSaver.checked = !!saverCfg.random;
    saverClock.checked = !!saverCfg.clock;
    saverDelay.value = String(Math.max(0, delays.indexOf(saverCfg.delay)));
    saverDelayValue.textContent = delayLabel(saverCfg.delay);
    randomSaver.addEventListener('change', () => {
      saverCfg.random = randomSaver.checked;
      saveScreenSaverConfig(saverCfg);
    });
    saverClock.addEventListener('change', () => {
      saverCfg.clock = saverClock.checked;
      saveScreenSaverConfig(saverCfg);
    });
    saverDelay.addEventListener('input', () => {
      saverCfg.delay = delays[Number(saverDelay.value)] ?? 3;
      saverDelayValue.textContent = delayLabel(saverCfg.delay);
      saveScreenSaverConfig(saverCfg);
    });
    c.querySelector('.saver-corners').addEventListener('click', showHotCornersEditor);
    renderSaverPreview();
    return c;
  }

  // -- Dock --
  function buildDockPane() {
    const cfg = System.dockCfg || {
      size: 48, magnify: true, magnifySize: 1.42, position: 'bottom',
      minimizeEffect: 'genie', animateOpen: true, autoHide: false, indicators: true,
    };
    if (!System.dockCfg) System.dockCfg = cfg;
    const c = el('div', 'spp-pane dock-pref-pane');
    c.innerHTML = `
      <div class="dock-preview"><div class="dock-preview-shelf">${['finder','mail','safari','ichat','ical','itunes','sysprefs'].map(id=>`<i>${System.apps[id]?.icon||''}</i>`).join('')}</div></div>
      <div class="dock-control-grid">
        <label><span>${t('prefs.ui.size')}</span><small>${t('common.short')}</small><input class="dock-size-range" type="range" min="32" max="64" value="${cfg.size||48}"><small>${t('common.long')}</small></label>
        <label class="dock-mag-row"><span><input class="dock-mag-check" type="checkbox" ${cfg.magnify?'checked':''}> ${t('prefs.ui.magnification')}:</span><small>${t('common.short')}</small><input class="dock-mag-range" type="range" min="110" max="190" value="${Math.round((cfg.magnifySize||1.42)*100)}"><small>${t('common.long')}</small></label>
        <fieldset><legend>${t('prefs.ui.position')}</legend>${[['left',t('prefs.ui.left')],['bottom',t('prefs.ui.bottom')],['right',t('prefs.ui.right')]].map(([value,label])=>`<label><input type="radio" name="dock-position" value="${value}" ${(cfg.position||'bottom')===value?'checked':''}> ${label}</label>`).join('')}</fieldset>
        <label class="dock-select-row"><span>${t('prefs.ui.minimizeEffect')}</span><select class="spp-select dock-effect"><option value="genie">${t('prefs.ui.genie')}</option><option value="scale">${t('prefs.ui.scale')}</option></select></label>
        <label class="spp-check"><input class="dock-open-animate" type="checkbox" ${cfg.animateOpen!==false?'checked':''}> ${t('prefs.ui.animateOpen')}</label>
        <label class="spp-check"><input class="dock-autohide" type="checkbox" ${cfg.autoHide?'checked':''}> ${t('prefs.ui.autoHide')}</label>
        <label class="spp-check"><input class="dock-indicators" type="checkbox" ${cfg.indicators!==false?'checked':''}> ${t('prefs.ui.indicators')}</label>
      </div>`;
    const apply = () => System.applyDockCfg();
    c.querySelector('.dock-size-range').addEventListener('input', (event) => { cfg.size = +event.target.value; apply(); });
    c.querySelector('.dock-mag-check').addEventListener('change', (event) => {
      cfg.magnify = event.target.checked; c.querySelector('.dock-mag-range').disabled = !cfg.magnify; apply();
      if (!cfg.magnify) document.querySelectorAll('#dock .dock-icon').forEach((ic) => { ic.style.transform = ''; ic.style.zIndex = ''; });
    });
    c.querySelector('.dock-mag-range').disabled = !cfg.magnify;
    c.querySelector('.dock-mag-range').addEventListener('input', (event) => { cfg.magnifySize = +event.target.value / 100; apply(); });
    c.querySelectorAll('[name="dock-position"]').forEach((radio) => radio.addEventListener('change', () => { cfg.position = radio.value; apply(); }));
    const effect = c.querySelector('.dock-effect'); effect.value = cfg.minimizeEffect || 'genie'; effect.addEventListener('change', () => { cfg.minimizeEffect = effect.value; apply(); });
    [['.dock-open-animate','animateOpen'],['.dock-autohide','autoHide'],['.dock-indicators','indicators']].forEach(([selector,key]) => c.querySelector(selector).addEventListener('change', (event) => { cfg[key] = event.target.checked; apply(); }));
    return c;
  }

  function openCalibrationAssistant(cfg) {
    const c = el('div', 'calibration-assistant');
    const steps = [
      { title: t('prefs.msg.217fd684f4'), text: t('prefs.msg.9a36f35816'), art: '<div class="calibration-display"><i></i></div>' },
      { title: t('prefs.ui2.c363be40731f'), text: t('prefs.ui2.c52575ccb3f0'), art: '<div class="gamma-target"><i></i></div><label>Gamma：<input class="gamma-range" type="range" min="10" max="30" value="22"><b>2.2</b></label>' },
      { title: t('prefs.msg.2ed879658a'), text: t('prefs.ui2.874353655089'), art: `<div class="whitepoint-options"><label><input type="radio" name="whitepoint" value="5000"> ${t('prefs.msg.750c6c2cac')}</label><label><input type="radio" name="whitepoint" value="6500" checked> ${t('prefs.msg.389cff3512')}</label><label><input type="radio" name="whitepoint" value="9300"> ${t('prefs.msg.b4c61a95ed')}</label></div>` },
      { title: t('prefs.msg.bc541af572'), text: t('prefs.msg.e9b33fc2b2'), art: `<label class="profile-name">${t('prefs.msg.72801ad6ca')}<input class="aqua-input" value="Calibrated Color LCD"></label><div class="calibration-check">✓</div>` },
    ];
    let index = 0;
    c.innerHTML = `<aside><div class="colorsync-orb">◉</div><b>ColorSync</b></aside><main><h2></h2><p></p><section></section><footer><button class="aqua-btn calibration-cancel">${t('dialog.cancel')}</button><i></i><button class="aqua-btn calibration-back">${t('prefs.msg.5f411223ca')}</button><button class="aqua-btn default calibration-next">${t('common.continue')}</button></footer></main>`;
    const win = System.createWindow({ app:'sysprefs', title:t('prefs.msg.217fd684f4'), width:680, height:480, content:c, bodyBg:'#ececec', noResize:true });
    const render = () => {
      const step = steps[index];
      c.querySelector('h2').textContent = step.title;
      c.querySelector('main>p').textContent = step.text;
      c.querySelector('main>section').innerHTML = step.art;
      c.querySelector('.calibration-back').disabled = index === 0;
      c.querySelector('.calibration-next').textContent = index === steps.length - 1 ? t('prefs.msg2.b8b1e2afb5') : t('prefs.msg2.6b1fa67d7d');
      c.querySelector('.gamma-range')?.addEventListener('input', (event) => { c.querySelector('.gamma-range+b').textContent = (+event.target.value / 10).toFixed(1); });
    };
    c.querySelector('.calibration-cancel').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.calibration-back').addEventListener('click', () => { if (index) { index--; render(); } });
    c.querySelector('.calibration-next').addEventListener('click', () => {
      if (index < steps.length - 1) { index++; render(); return; }
      const name = c.querySelector('.profile-name input')?.value.trim() || 'Calibrated Color LCD';
      cfg.profile = name;
      cfg.calibrated = true;
      save('macweb.display', cfg);
      System.closeWindow(win);
      Leopard.toast('ColorSync', t('prefs.msg.e71c3dd238', { name }));
    });
    render();
  }

  // -- 显示器 --
  function buildDisplay() {
    const c = el('div', 'spp-pane display-pane');
    const cfg = store('macweb.display', { brightness: 1, profile: 'Color LCD', showMenu: false });
    const monitor = `<svg viewBox="0 0 180 142" aria-hidden="true"><defs><linearGradient id="display-frame" x2="0" y2="1"><stop stop-color="#f7f8fa"/><stop offset=".5" stop-color="#aab0b9"/><stop offset=".53" stop-color="#6f7680"/><stop offset="1" stop-color="#d5d8dd"/></linearGradient><radialGradient id="display-screen" cx=".35" cy=".25"><stop stop-color="#8ed0ff"/><stop offset=".5" stop-color="#416eb4"/><stop offset="1" stop-color="#171f4d"/></radialGradient></defs><rect x="8" y="7" width="164" height="105" rx="9" fill="url(#display-frame)" stroke="#5c626b" stroke-width="2"/><rect x="14" y="13" width="152" height="91" rx="4" fill="url(#display-screen)"/><path d="M14 78Q55 35 89 67t77-30v67H14z" fill="#7045b5" opacity=".55"/><circle cx="90" cy="108" r="2" fill="#4f555d"/><path d="M73 112h34l6 18H67z" fill="url(#display-frame)" stroke="#777"/><rect x="57" y="130" width="66" height="6" rx="3" fill="#8b929b"/></svg>`;
    c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="display">${t('prefs.display.tabDisplay')}</button><button data-tab="color">${t('prefs.display.tabColor')}</button></div>
      <section class="spp-tab-panel display-main" data-panel="display">
        <div class="display-monitor">${monitor}<b>Color LCD</b><small>${screen.width} × ${screen.height} · ${devicePixelRatio.toFixed(1)}x</small></div>
        <div class="display-controls">
          <label><span>${t('prefs.display.resolution')}</span><select class="spp-select display-resolution"><option>${screen.width} × ${screen.height}</option><option>1680 × 1050</option><option>1440 × 900</option><option>1280 × 800</option><option>1024 × 768</option></select></label>
          <label><span>${t('prefs.display.colors')}</span><select class="spp-select"><option>${t('prefs.display.millions')}</option><option>${t('prefs.display.thousands')}</option></select></label>
          <label><span>${t('prefs.display.refresh')}</span><select class="spp-select"><option>${document.documentElement.dataset.refreshRate || 60} Hz</option><option>60 Hz</option></select></label>
          <label class="spp-check"><input type="checkbox" checked> ${t('prefs.display.showModes')}</label>
        </div>
        <div class="display-brightness"><span>☀</span><input type="range" min="30" max="100" value="${Math.round(cfg.brightness * 100)}"><span class="large">☀</span></div>
        <label class="spp-check display-menu-check"><input type="checkbox" ${cfg.showMenu ? 'checked' : ''}> ${t('prefs.display.showInMenu')}</label>
        <button class="aqua-btn display-detect">${t('prefs.display.detect')}</button>
      </section>
      <section class="spp-tab-panel display-color" data-panel="color" hidden>
        <div class="color-profile-list"><header>${t('prefs.display.profiles')}</header>${['Color LCD','Adobe RGB (1998)','Generic RGB Profile','sRGB IEC61966-2.1'].map((name, i) => `<button class="${name === cfg.profile ? 'sel' : ''}">${i ? '◉' : '🌈'} <span>${name}</span></button>`).join('')}</div>
        <label class="spp-check"><input type="checkbox"> ${t('prefs.display.thisOnly')}</label>
        <div class="color-profile-info"><b>${cfg.profile}</b><p>${t('prefs.display.profileHelp')}</p></div>
        <button class="aqua-btn color-calibrate">${t('prefs.display.calibrate')}</button><button class="aqua-btn color-open">${t('prefs.display.openProfile')}</button>
      </section>`;
    bindTabs(c);
    c.querySelector('.display-brightness input').addEventListener('input', (event) => {
      cfg.brightness = +event.target.value / 100;
      save('macweb.display', cfg);
      System.applyBrightness();
    });
    c.querySelector('.display-menu-check input').addEventListener('change', (event) => {
      cfg.showMenu = event.target.checked;
      save('macweb.display', cfg);
    });
    c.querySelector('.display-detect').addEventListener('click', () => System.alertBox(t('prefs.ui2.08dd3e29aa88'), t('prefs.display.detected',{w:screen.width,h:screen.height,depth:screen.colorDepth})));
    c.querySelector('.display-resolution').addEventListener('change', (event) => {
      if (!event.target.value.startsWith(String(screen.width))) System.alertBox(t('prefs.ui2.08dd3e29aa88'), t('prefs.ui2.9e7863fd8ba6'));
    });
    c.querySelector('.color-profile-list').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      c.querySelectorAll('.color-profile-list button').forEach((item) => item.classList.toggle('sel', item === button));
      cfg.profile = button.querySelector('span').textContent;
      c.querySelector('.color-profile-info b').textContent = cfg.profile;
      save('macweb.display', cfg);
    });
    c.querySelector('.color-calibrate').addEventListener('click', () => openCalibrationAssistant(cfg));
    c.querySelector('.color-open').addEventListener('click', () => System.alertBox(cfg.profile, t('prefs.display.gamut',{gamut:matchMedia('(color-gamut: p3)').matches ? 'Display P3' : 'sRGB', depth:screen.colorDepth})));
    return c;
  }

  // -- 声音 --（发声走 System.beep，与菜单栏音量滑块共用配置）
  const BEEPS = {
    basso: 'Basso', blow: 'Blow', bottle: 'Bottle', frog: 'Frog', funk: 'Funk',
    glass: 'Glass', hero: 'Hero', morse: 'Morse', ping: 'Ping', pop: 'Pop',
    purr: 'Purr', sosumi: 'Sosumi', submarine: 'Submarine', tink: 'Tink',
  };
  const speakerSvg = (waves = 2) => `<svg class="aqua-speaker" viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="speaker-case" x2="0" y2="1"><stop stop-color="#fbfcfd"/><stop offset=".48" stop-color="#b9c0c9"/><stop offset=".52" stop-color="#7b838e"/><stop offset="1" stop-color="#dce0e4"/></linearGradient><radialGradient id="speaker-cone"><stop stop-color="#9aa5b0"/><stop offset=".28" stop-color="#252c34"/><stop offset=".72" stop-color="#080a0d"/><stop offset="1" stop-color="#77828d"/></radialGradient></defs><rect x="18" y="7" width="60" height="82" rx="10" fill="url(#speaker-case)" stroke="#626b75" stroke-width="2"/><circle cx="48" cy="60" r="23" fill="url(#speaker-cone)" stroke="#3d444c" stroke-width="2"/><circle cx="48" cy="60" r="8" fill="#5e6873" stroke="#aeb8c2"/><circle cx="48" cy="25" r="9" fill="url(#speaker-cone)"/><path d="M26 12h44" stroke="#fff" stroke-width="2" opacity=".8"/>${waves > 0 ? '<path d="M81 47q10 13 0 26" fill="none" stroke="#477bb7" stroke-width="3" stroke-linecap="round"/>' : ''}${waves > 1 ? '<path d="M86 39q18 21 0 42" fill="none" stroke="#477bb7" stroke-width="3" stroke-linecap="round"/>' : ''}</svg>`;
  const outputDeviceSvg = `<svg class="sound-output-art" viewBox="0 0 150 120" aria-hidden="true"><defs><linearGradient id="satcase" x2="0" y2="1"><stop stop-color="#fdfefe"/><stop offset=".46" stop-color="#cbd1d8"/><stop offset=".53" stop-color="#7e8791"/><stop offset="1" stop-color="#e4e8ec"/></linearGradient><radialGradient id="satcone"><stop stop-color="#9ca8b3"/><stop offset=".3" stop-color="#1e252d"/><stop offset=".78" stop-color="#05070a"/><stop offset="1" stop-color="#798590"/></radialGradient></defs><ellipse cx="75" cy="108" rx="58" ry="7" fill="#5a6470" opacity=".25"/><g filter="drop-shadow(0 3px 3px #667)"><path d="M20 23q0-7 7-7h37q7 0 7 7v75H20z" fill="url(#satcase)" stroke="#626c76"/><path d="M79 23q0-7 7-7h37q7 0 7 7v75H79z" fill="url(#satcase)" stroke="#626c76"/><g fill="url(#satcone)" stroke="#454d56"><circle cx="46" cy="67" r="21"/><circle cx="104" cy="67" r="21"/><circle cx="46" cy="31" r="7"/><circle cx="104" cy="31" r="7"/></g><g fill="#66727e" stroke="#aeb7c1"><circle cx="46" cy="67" r="6"/><circle cx="104" cy="67" r="6"/></g><path d="M27 20h37M86 20h37" stroke="#fff" stroke-width="2" opacity=".8"/></g></svg>`;
  const microphoneSvg = `<svg class="sound-mic-art" viewBox="0 0 130 130" aria-hidden="true"><defs><linearGradient id="micbody" x2="1"><stop stop-color="#555e68"/><stop offset=".22" stop-color="#e8edf1"/><stop offset=".48" stop-color="#9aa4ae"/><stop offset=".7" stop-color="#f8fafb"/><stop offset="1" stop-color="#4b535d"/></linearGradient><linearGradient id="micstand" x2="0" y2="1"><stop stop-color="#f7f8fa"/><stop offset=".5" stop-color="#8c949e"/><stop offset="1" stop-color="#d8dde2"/></linearGradient></defs><ellipse cx="65" cy="119" rx="39" ry="6" fill="#56616b" opacity=".28"/><g filter="drop-shadow(0 3px 3px #667)"><rect x="45" y="8" width="40" height="79" rx="20" fill="url(#micbody)" stroke="#505963"/><g stroke="#626c76">${[20,28,36,44,52].map(y=>`<path d="M52 ${y}h26"/>`).join('')}</g><path d="M36 60v10q0 29 29 29t29-29V60" fill="none" stroke="url(#micstand)" stroke-width="8"/><path d="M65 99v15M47 116h36" stroke="#69737d" stroke-width="6" stroke-linecap="round"/></g></svg>`;
  const playBeep = (kind, volume) => System.beep(kind, volume);
  function buildSound() {
    const c = el('div', 'spp-pane sound-pane');
    const cfg = store('macweb.sound', { volume: 0.6, muted: false, beep: 'glass', balance: 50, input: 55 });
    c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="effects">${t('prefs.sound.effects')}</button><button data-tab="output">${t('prefs.sound.output')}</button><button data-tab="input">${t('prefs.sound.input')}</button></div>
      <section class="spp-tab-panel sound-effects" data-panel="effects">
        <div class="sound-device-art">${speakerSvg(1)}<b>${t('prefs.sound.alertSound')}</b></div>
        <div class="sound-effect-list">${Object.entries(BEEPS).map(([id,name])=>`<button data-sound="${id}" class="${cfg.beep===id?'sel':''}"><i>◉</i>${name}</button>`).join('')}</div>
        <label>${t('prefs.sound.playThrough')}<select class="spp-select"><option>${t('prefs.sound.builtInOut')}</option><option>Color LCD</option></select></label>
        <label class="sound-slider"><span>${t('prefs.sound.alertVolume')}</span><i>${speakerSvg(0)}</i><input class="alert-volume" type="range" min="0" max="100" value="${Math.round(cfg.volume*100)}"><i>${speakerSvg(2)}</i></label>
        <label class="spp-check"><input type="checkbox" checked> ${t('prefs.sound.uiSounds')}</label>
        <label class="spp-check"><input type="checkbox" checked> ${t('prefs.sound.feedback')}</label>
      </section>
      <section class="spp-tab-panel sound-output" data-panel="output" hidden>
        <div class="sound-device-art">${outputDeviceSvg}<b>${t('prefs.sound.chooseOutput')}</b></div>
        <div class="sound-device-list"><header><span>${t('common.name')}</span><span>${t('common.type')}</span></header><button data-device="built-in" class="${(cfg.output||'built-in')==='built-in'?'sel':''}"><span>${t('prefs.sound.builtInSpeakers')}</span><span>${t('prefs.sound.builtInOut')}</span></button><button data-device="display" class="${cfg.output==='display'?'sel':''}"><span>Color LCD</span><span>DisplayPort</span></button></div>
        <label class="sound-slider"><span>${t('prefs.sound.balance')}</span><b>${t('common.left')}</b><input class="sound-balance" type="range" min="0" max="100" value="${cfg.balance}"><b>${t('common.right')}</b></label>
        <label class="sound-slider"><span>${t('prefs.sound.outputVolume')}</span><i>${speakerSvg(0)}</i><input class="output-volume" type="range" min="0" max="100" value="${Math.round(cfg.volume*100)}"><i>${speakerSvg(2)}</i></label>
        <label class="spp-check"><input class="sound-mute" type="checkbox" ${cfg.muted?'checked':''}> ${t('prefs.sound.mute')}</label>
      </section>
      <section class="spp-tab-panel sound-input" data-panel="input" hidden>
        <div class="sound-device-art sound-mic">${microphoneSvg}<b>${t('prefs.sound.chooseInput')}</b></div>
        <div class="sound-device-list"><header><span>${t('common.name')}</span><span>${t('common.type')}</span></header><button class="sel input-device"><span>${t('prefs.sound.browserMic')}</span><span>${t('prefs.sound.builtIn')}</span></button></div>
        <label class="sound-slider"><span>${t('prefs.sound.inputVolume')}</span><input class="input-volume" type="range" min="0" max="100" value="${cfg.input}"></label>
        <div class="input-level"><span>${t('prefs.sound.inputLevel')}</span><div class="input-meter"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><output class="input-db">−∞ dB</output></div>
        <div class="sound-input-control"><button class="aqua-btn default input-monitor-toggle">${t('prefs.sound.startListen')}</button><p class="sound-input-status">${t('prefs.sound.listenHelp')}</p></div>
      </section>`;
    bindTabs(c);
    c.querySelector('.sound-effect-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-sound]');
      if (!button) return;
      cfg.beep = button.dataset.sound;
      save('macweb.sound', cfg);
      c.querySelectorAll('.sound-effect-list button').forEach((item) => item.classList.toggle('sel', item === button));
      if (!cfg.muted) playBeep(cfg.beep, cfg.volume);
    });
    const updateVolume = (event) => {
      cfg.volume = +event.target.value / 100;
      c.querySelectorAll('.alert-volume,.output-volume').forEach((input) => { if (input !== event.target) input.value = event.target.value; });
      save('macweb.sound', cfg);
      System.updateVolumeIcon();
    };
    c.querySelectorAll('.alert-volume,.output-volume').forEach((input) => {
      input.addEventListener('input', updateVolume);
      input.addEventListener('change', () => { if (!cfg.muted) playBeep(cfg.beep, cfg.volume); });
    });
    c.querySelector('.sound-balance').addEventListener('input', (event) => { cfg.balance = +event.target.value; save('macweb.sound', cfg); });
    c.querySelector('.input-volume').addEventListener('input', (event) => {
      cfg.input = +event.target.value;
      if (soundInputGain && soundInputContext) {
        soundInputGain.gain.setTargetAtTime(Math.max(.01, cfg.input / 55), soundInputContext.currentTime, .015);
      }
      save('macweb.sound', cfg);
    });
    c.querySelector('.sound-mute').addEventListener('change', (event) => { cfg.muted = event.target.checked; save('macweb.sound', cfg); System.updateVolumeIcon(); });
    c.querySelector('.sound-output .sound-device-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-device]');
      if (!button) return;
      c.querySelectorAll('.sound-output .sound-device-list button').forEach((item) => item.classList.toggle('sel', item === button));
      cfg.output = button.dataset.device;
      save('macweb.sound', cfg);
    });
    const stopInput = (message = t('prefs.ui2.3ea43a9defc8')) => {
      soundInputRun += 1;
      soundInputPending = false;
      cancelAnimationFrame(soundInputFrame);
      soundInputFrame = 0;
      soundInputStream?.getTracks().forEach((track) => track.stop());
      soundInputStream = null;
      soundInputGain = null;
      const context = soundInputContext;
      soundInputContext = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
      c.querySelectorAll('.input-meter i').forEach((bar) => bar.classList.remove('on', 'peak'));
      const db = c.querySelector('.input-db');
      const button = c.querySelector('.input-monitor-toggle');
      const status = c.querySelector('.sound-input-status');
      if (db) db.textContent = '−∞ dB';
      if (button) { button.disabled = false; button.textContent = t('prefs.sound.startListen'); }
      if (status && message) status.textContent = message;
    };
    const startInput = async () => {
      const status = c.querySelector('.sound-input-status');
      const button = c.querySelector('.input-monitor-toggle');
      if (soundInputStream) { stopInput(); return; }
      if (soundInputPending) return;
      if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
        status.textContent = t('prefs.ui2.a9ccc8ac9f45');
        return;
      }
      const run = ++soundInputRun;
      soundInputPending = true;
      button.disabled = true;
      button.textContent = t('prefs.msg2.252e3d4421');
      status.textContent = t('prefs.msg.98c0b235fa');
      const endBusy = System.beginBusy?.(180) || (() => {});
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
        if (run !== soundInputRun || !c.isConnected) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        soundInputStream = stream;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass({ latencyHint: 'interactive' });
        soundInputContext = context;
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const gain = context.createGain();
        soundInputGain = gain;
        gain.gain.value = Math.max(.01, cfg.input / 55);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = .72;
        const silentMonitor = context.createGain();
        silentMonitor.gain.value = 0;
        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(silentMonitor);
        silentMonitor.connect(context.destination);
        const values = new Float32Array(analyser.fftSize);
        const bars = Array.from(c.querySelectorAll('.input-meter i'));
        const dbOutput = c.querySelector('.input-db');
        const track = stream.getAudioTracks()[0];
        button.disabled = false;
        button.textContent = t('prefs.ui2.f0bc0bb71ac7');
        status.textContent = `${t('prefs.msg.0b669e8c13')}“${track?.label || t('prefs.msg.542c5948eb')}”；${t('prefs.msg.25461d7a39')}`;
        track?.addEventListener('mute', () => { if (run === soundInputRun) status.textContent = t('prefs.msg.176f6aee6e'); });
        track?.addEventListener('unmute', () => { if (run === soundInputRun) status.textContent = `${t('prefs.msg.0b669e8c13')}“${track.label || t('prefs.msg.542c5948eb')}”；${t('prefs.msg.25461d7a39')}`; });
        track?.addEventListener('ended', () => { if (run === soundInputRun) stopInput('prefs.ui2.f6f57ebcfb78'); });
        const paint = () => {
          if (!c.isConnected || run !== soundInputRun || !soundInputStream) {
            if (!c.isConnected && run === soundInputRun) stopInput('');
            return;
          }
          analyser.getFloatTimeDomainData(values);
          let sum = 0;
          let peak = 0;
          values.forEach((sample) => {
            sum += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
          });
          const rms = Math.sqrt(sum / values.length);
          const dbfs = 20 * Math.log10(Math.max(rms, 0.000001));
          const level = Math.max(0, Math.min(1, (dbfs + 60) / 54));
          const peakLevel = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(peak, 0.000001)) + 60) / 54));
          const active = Math.round(level * bars.length);
          const peakIndex = Math.min(bars.length - 1, Math.max(0, Math.round(peakLevel * bars.length) - 1));
          bars.forEach((bar, index) => {
            bar.classList.toggle('on', index < active);
            bar.classList.toggle('peak', peak > .00001 && index === peakIndex);
          });
          dbOutput.textContent = dbfs <= -59.9 ? '−∞ dB' : `${dbfs.toFixed(1)} dB`;
          soundInputFrame = requestAnimationFrame(paint);
        };
        paint();
      } catch (error) {
        if (run === soundInputRun) {
          stopInput(error?.name === 'NotAllowedError'
            ? t('prefs.sound.micDenied2')
            : `${t('prefs.msg.816588f9b8')}${error?.message ? `：${error.message}` : '。'}`);
        }
      } finally {
        soundInputPending = false;
        endBusy();
      }
    };
    c.querySelector('.spp-tabs [data-tab="input"]').addEventListener('click', startInput);
    c.querySelector('.input-monitor-toggle').addEventListener('click', startInput);
    c.querySelector('.input-device').addEventListener('click', startInput);
    c.querySelectorAll('.spp-tabs [data-tab="effects"],.spp-tabs [data-tab="output"]').forEach((button) => button.addEventListener('click', () => stopInput()));
    return c;
  }

  // -- 节能器 --
  const ENERGY_SCHEDULE_DEFAULTS = Object.freeze({
    wakeEnabled: false,
    wakeAction: t('prefs.msg.c52a762b96'),
    wakeDays: t('prefs.energy.weekdays'),
    wakeTime: '08:00',
    sleepEnabled: false,
    sleepAction: t('prefs.msg.6d5211bfde'),
    sleepDays: t('prefs.msg.78623eaefc'),
    sleepTime: '23:00',
  });

  function normalizeEnergySchedule(cfg) {
    cfg.schedule = Object.assign({}, ENERGY_SCHEDULE_DEFAULTS, cfg.schedule || {});
    return cfg.schedule;
  }

  function energyDayMatches(mode, date) {
    const day = date.getDay();
    if (mode === t('prefs.msg.78623eaefc')) return true;
    if (mode === t('prefs.energy.weekdays') || mode === 'Weekdays' || mode === 'Weekdays') return day >= 1 && day <= 5;
    if (mode === t('prefs.msg.c17375d125')) return day === 0 || day === 6;
    const names = [t('prefs.msg2.82b8c82fa0'),t('prefs.msg2.4de4c7515a'),t('prefs.msg2.23d3a68bd0'),t('prefs.msg2.32ea021667'),t('prefs.msg2.bb6be6a443'),t('prefs.msg2.ed8e921212'),t('prefs.msg2.b49f614c4b')];
    return mode === names[day];
  }

  function nextEnergyDate(entry, now = new Date()) {
    if (!entry.enabled || !/^\d{2}:\d{2}$/.test(entry.time || '')) return null;
    const [hour, minute] = entry.time.split(':').map(Number);
    if (hour > 23 || minute > 59) return null;
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate <= now || !energyDayMatches(entry.days, candidate)) continue;
      return candidate;
    }
    return null;
  }

  function energyScheduleEntries(schedule) {
    return [
      { id:'wake', enabled:schedule.wakeEnabled, action:schedule.wakeAction, days:schedule.wakeDays, time:schedule.wakeTime },
      { id:'sleep', enabled:schedule.sleepEnabled, action:schedule.sleepAction, days:schedule.sleepDays, time:schedule.sleepTime },
    ];
  }

  function energyScheduleSummary(schedule) {
    const enabled = energyScheduleEntries(schedule).filter((entry) => entry.enabled);
    return enabled.length
      ? enabled.map((entry) => `${entry.action}：${entry.days} ${entry.time}`).join('；')
      : t('prefs.msg.453207a09a');
  }

  function openEnergySchedule(cfg, onChange) {
    if (energyScheduleWin?.isConnected) {
      System.focusWindow(energyScheduleWin);
      return;
    }
    const draft = Object.assign({}, normalizeEnergySchedule(cfg));
    const c = el('div', 'energy-schedule-dialog');
    const dayOptions = [t('prefs.msg.78623eaefc'),t('prefs.energy.weekdays'),t('prefs.msg.c17375d125'),t('prefs.msg2.82b8c82fa0'),t('prefs.msg2.4de4c7515a'),t('prefs.msg2.23d3a68bd0'),t('prefs.msg2.32ea021667'),t('prefs.msg2.bb6be6a443'),t('prefs.msg2.ed8e921212'),t('prefs.msg2.b49f614c4b')];
    const optionList = (items, selected) => items.map((item) => `<option ${item === selected ? 'selected' : ''}>${item}</option>`).join('');
    c.innerHTML = `
      <header><div class="energy-clock-art"><i></i><b></b></div><div><h2>${t('prefs.msg.72ebfe28b0')}</h2><p>${t('prefs.msg.a1bd37a53c')}</p></div></header>
      <main>
        <div class="energy-schedule-head"><span></span><span>${t('prefs.msg.2b6bc0f293')}</span><span>${t('prefs.msg.4ff1e74e43')}</span><span>${t('prefs.msg.19fcb9eb25')}</span></div>
        <label class="energy-schedule-row" data-row="wake">
          <input class="schedule-enabled" type="checkbox" ${draft.wakeEnabled ? 'checked' : ''}>
          <select class="spp-select schedule-action">${optionList([t('prefs.msg.c52a762b96'),t('prefs.msg.8e54ddfe24'),t('prefs.msg.560a964d88')], draft.wakeAction)}</select>
          <select class="spp-select schedule-days">${optionList(dayOptions, draft.wakeDays)}</select>
          <input class="aqua-input schedule-time" type="time" value="${draft.wakeTime}">
        </label>
        <label class="energy-schedule-row" data-row="sleep">
          <input class="schedule-enabled" type="checkbox" ${draft.sleepEnabled ? 'checked' : ''}>
          <select class="spp-select schedule-action">${optionList([t('prefs.msg.6d5211bfde'),t('prefs.msg.9ebc9e1316'),t('prefs.msg.f2eebd82ce')], draft.sleepAction)}</select>
          <select class="spp-select schedule-days">${optionList(dayOptions, draft.sleepDays)}</select>
          <input class="aqua-input schedule-time" type="time" value="${draft.sleepTime}">
        </label>
        <div class="energy-next-event"></div>
        <p class="energy-schedule-note">${t('prefs.msg.d6b702f87a')}</p>
      </main>
      <footer><button class="aqua-btn energy-schedule-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default energy-schedule-save">${t('prefs.msg.f7ee22b8d4')}</button></footer>`;
    const readRows = () => {
      ['wake','sleep'].forEach((id) => {
        const row = c.querySelector(`[data-row="${id}"]`);
        draft[`${id}Enabled`] = row.querySelector('.schedule-enabled').checked;
        draft[`${id}Action`] = row.querySelector('.schedule-action').value;
        draft[`${id}Days`] = row.querySelector('.schedule-days').value;
        draft[`${id}Time`] = row.querySelector('.schedule-time').value;
        row.classList.toggle('disabled', !draft[`${id}Enabled`]);
      });
      const next = energyScheduleEntries(draft)
        .map((entry) => ({ entry, date:nextEnergyDate(entry) }))
        .filter((item) => item.date)
        .sort((a, b) => a.date - b.date)[0];
      c.querySelector('.energy-next-event').innerHTML = next
        ? `<b>${t('prefs.ui2.8985cf27ed34')}</b>${next.entry.action} — ${next.date.toLocaleString('zh-CN', { weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}`
        : `<b>${t('prefs.ui2.8985cf27ed34')}</b>${t('prefs.energy.noneScheduled')}`;
    };
    c.querySelectorAll('input,select').forEach((control) => control.addEventListener('change', readRows));
    readRows();
    energyScheduleWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.72ebfe28b0'), width:660, height:430, content:c, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:390, maxHeight:500 },
      onClose:() => { energyScheduleWin = null; },
    });
    c.querySelector('.energy-schedule-cancel').addEventListener('click', () => System.closeWindow(energyScheduleWin));
    c.querySelector('.energy-schedule-save').addEventListener('click', () => {
      readRows();
      cfg.schedule = Object.assign({}, draft);
      save('macweb.energy', cfg);
      document.dispatchEvent(new CustomEvent('energy-schedule-changed', { detail:cfg.schedule }));
      onChange?.(cfg.schedule);
      System.closeWindow(energyScheduleWin);
    });
  }

  function buildEnergy() {
    const c = el('div', 'spp-pane energy-pane');
    const cfg = store('macweb.energy', { sleepMin: 0, computerSleep: 0, diskSleep: true, wakeNetwork: true, dim: true, showMenu: false });
    const schedule = normalizeEnergySchedule(cfg);
    const options = [[0,t('common.never')],[1,t('common.minute1')],[5,t('common.minutes',{n:5})],[15,t('common.minutes',{n:15})],[30,t('common.minutes',{n:30})],[60,t('common.hour1')],[120,t('common.hours',{n:2})]];
    c.innerHTML = `
      <div class="energy-bulb"><span></span><b>${t('prefs.energy.title')}</b></div>
      <section class="spp-pref-card">
        <label>${t('prefs.energy.computerSleep')}<select class="spp-select computer-sleep">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
        <label>${t('prefs.energy.displaySleep')}<select class="spp-select display-sleep">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
        <label class="spp-check"><input class="disk-sleep" type="checkbox"> ${t('prefs.energy.diskSleep')}</label>
        <label class="spp-check"><input class="wake-network" type="checkbox"> ${t('prefs.energy.wakeNetwork')}</label>
        <label class="spp-check"><input class="dim-display" type="checkbox"> ${t('prefs.energy.dim')}</label>
      </section>
      <div class="energy-actions"><div><button class="aqua-btn energy-schedule">${t('prefs.energy.schedule')}</button><small class="energy-schedule-summary">${energyScheduleSummary(schedule)}</small></div><label class="spp-check"><input class="energy-menu" type="checkbox"> ${t('prefs.energy.showMenu')}</label></div>`;
    const computer = c.querySelector('.computer-sleep'), display = c.querySelector('.display-sleep');
    computer.value = String(cfg.computerSleep); display.value = String(cfg.sleepMin);
    computer.addEventListener('change', () => { cfg.computerSleep = +computer.value; save('macweb.energy', cfg); });
    display.addEventListener('change', () => { cfg.sleepMin = +display.value; save('macweb.energy', cfg); });
    [['.disk-sleep','diskSleep'],['.wake-network','wakeNetwork'],['.dim-display','dim'],['.energy-menu','showMenu']].forEach(([selector,key]) => {
      const control = c.querySelector(selector); control.checked = cfg[key]; control.addEventListener('change', () => { cfg[key] = control.checked; save('macweb.energy', cfg); });
    });
    c.querySelector('.energy-schedule').addEventListener('click', () => openEnergySchedule(cfg, (nextSchedule) => {
      c.querySelector('.energy-schedule-summary').textContent = energyScheduleSummary(nextSchedule);
    }));
    return c;
  }

  // -- 账户 --
  function buildAccounts() {
    const c = el('div', 'spp-pane');
    const head = el('div', 'spp-account');
    head.innerHTML = `<div class="spp-avatar">R</div><div><b>macosx</b><div class="spp-hint" style="margin:2px 0 0">${t('prefs.accounts.adminAuto')}</div></div>`;
    c.appendChild(head);
    c.appendChild(el('div', 'spp-sep'));
    let loginIds = [];
    try { loginIds = JSON.parse(localStorage.getItem('macweb.loginitems')) || []; } catch (e) {}
    const list = el('div', 'spp-loginitems');
    Object.values(System.apps).filter((a) => a.id !== 'finder' && a.id !== 'sysprefs').forEach((a) => {
      const lb = el('label', 'spp-check spp-loginitem');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = loginIds.includes(a.id);
      cb.addEventListener('change', () => {
        if (cb.checked) loginIds.push(a.id);
        else loginIds = loginIds.filter((x) => x !== a.id);
        localStorage.setItem('macweb.loginitems', JSON.stringify(loginIds));
      });
      lb.append(cb);
      lb.insertAdjacentHTML('beforeend', `<span class="spp-li-icon">${a.icon}</span> ${html(a.name)}`);
      list.appendChild(lb);
    });
    c.appendChild(row(t('prefs.accounts.loginItems'), list, t('prefs.accounts.loginHelp')));
    return c;
  }

  // -- ${t('prefs.ui5.8421f040bd92')} --
  function buildDateTime() {
    const c = el('div', 'spp-pane datetime-pane');
    const cfg = store('macweb.clock', { h24: true, showDay: true, showDate: false, showSec: false });
    const now = new Date();
    const days = [t('prefs.ui2.147effea4400'),t('prefs.ui2.d5977f8e3e83'),t('prefs.ui2.6fa8f5d85bd5'),t('prefs.ui2.081fa94ca167'),t('prefs.ui2.807ace06f79e'),t('prefs.ui2.2d1732c51d15'),t('prefs.ui2.c8536d731247')];
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const calendar = Array(first.getDay()).fill('').concat(Array.from({length:count},(_,i)=>i+1));
    while (calendar.length % 7) calendar.push('');
    c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="date">${t('prefs.datetime.tabDate')}</button><button data-tab="zone">${t('prefs.datetime.tabZone')}</button><button data-tab="clock">${t('prefs.datetime.tabClock')}</button></div>
      <section class="spp-tab-panel datetime-main" data-panel="date">
        <label class="spp-check datetime-auto"><input type="checkbox" checked> ${t('prefs.datetime.autoSet')}<select class="spp-select"><option>${t('prefs.datetime.serverAsia')}</option><option>${t('prefs.datetime.serverUS')}</option><option>${t('prefs.datetime.serverEU')}</option></select></label>
        <div class="date-calendar"><header><button>‹</button><b>${t('prefs.datetime.yearMonth',{y:now.getFullYear(),m:now.getMonth()+1})}</b><button>›</button></header><div class="calendar-grid">${days.map(d=>`<strong>${d}</strong>`).join('')}${calendar.map(d=>`<i class="${d===now.getDate()?'today':''}">${d}</i>`).join('')}</div></div>
        <div class="analog-clock"><i class="hour"></i><i class="minute"></i><i class="second"></i><b></b></div>
        <div class="digital-time"><input value="${String(now.getHours()).padStart(2,'0')}"><b>:</b><input value="${String(now.getMinutes()).padStart(2,'0')}"><b>:</b><input value="${String(now.getSeconds()).padStart(2,'0')}"></div>
      </section>
      <section class="spp-tab-panel timezone-panel" data-panel="zone" hidden>
        <div class="timezone-map"><span class="timezone-pin"></span></div>
        <label>${t('prefs.datetime.nearestCity')}<select class="spp-select timezone-city"><option value="Asia/Shanghai">${t('prefs.ui2.d28f532c140a')}</option><option value="Asia/Kuching">${t('prefs.ui2.831bd7a15da6')}</option><option value="Asia/Tokyo">${t('prefs.ui2.85ed39b5bb68')}</option><option value="America/Los_Angeles">${t('prefs.ui2.552a99cfb59d')}</option><option value="Europe/London">${t('prefs.ui5.6a8a15553436')}</option></select></label>
        <p>${t('prefs.datetime.currentZone')}<b>${Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'}</b></p>
      </section>
      <section class="spp-tab-panel clock-panel" data-panel="clock" hidden>
        <fieldset><legend>${t('prefs.ui5.52e9fa49db86')}</legend>
          <label class="spp-check"><input data-clock="h24" type="checkbox"> ${t('clock.use24h')}</label>
          <label class="spp-check"><input data-clock="showDay" type="checkbox"> ${t('clock.showDay')}</label>
          <label class="spp-check"><input data-clock="showDate" type="checkbox"> ${t('clock.showDate')}</label>
          <label class="spp-check"><input data-clock="showSec" type="checkbox"> ${t('clock.showSec')}</label>
        </fieldset>
        <fieldset><legend>${t('prefs.ui5.cb1f014a7d15')}</legend><label class="spp-check"><input type="checkbox"> ${t('prefs.ui2.bb0a4f87a152')}</label><label>${t('prefs.ui2.687ea789152d')}<select class="spp-select"><option>Alex</option><option>${t('prefs.msg.6bfeac3dc6')}</option></select></label></fieldset>
      </section>`;
    bindTabs(c);
    c.querySelectorAll('[data-clock]').forEach((control) => {
      control.checked = cfg[control.dataset.clock];
      control.addEventListener('change', () => { cfg[control.dataset.clock] = control.checked; save('macweb.clock', cfg); System.tickClock(); });
    });
    const paintClock = () => {
      if (!c.isConnected) return;
      const date = new Date();
      const hour = (date.getHours()%12)*30+date.getMinutes()*.5;
      const hourHand = c.querySelector('.analog-clock .hour');
      const minuteHand = c.querySelector('.analog-clock .minute');
      const secondHand = c.querySelector('.analog-clock .second');
      if (hourHand?.style) hourHand.style.transform = `translateX(-50%) rotate(${hour}deg)`;
      if (minuteHand?.style) minuteHand.style.transform = `translateX(-50%) rotate(${date.getMinutes()*6}deg)`;
      if (secondHand?.style) secondHand.style.transform = `translateX(-50%) rotate(${date.getSeconds()*6}deg)`;
      const inputs = [...(c.querySelectorAll('.digital-time input') || [])];
      [date.getHours(),date.getMinutes(),date.getSeconds()].forEach((value,index)=>{
        if (inputs[index]) inputs[index].value = String(value).padStart(2,'0');
      });
      setTimeout(paintClock, 1000);
    };
    paintClock();
    const city = c.querySelector('.timezone-city');
    city.value = cfg.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Kuching') ? 'Asia/Kuching' : 'Asia/Shanghai');
    city.addEventListener('change', () => {
      cfg.timezone = city.value; save('macweb.clock', cfg);
      c.querySelector('.timezone-panel p b').textContent = city.value;
      c.querySelector('.timezone-pin').style.left = `${22 + city.selectedIndex * 13}%`;
    });
    return c;
  }

  // -- 软件更新 --
  function buildUpdate() {
    const c = el('div', 'spp-pane');
    const p = el('p', 'spp-hint', t('prefs.update.lastCheck',{date:new Date().toLocaleDateString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}));
    p.style.marginBottom = '12px';
    const btn = el('button', 'aqua-btn default', t('prefs.update.checkNow'));
    btn.addEventListener('click', () => {
      btn.disabled = true; btn.textContent = t('prefs.msg.6dc4b1e442');
      setTimeout(() => {
        btn.disabled = false; btn.textContent = t('prefs.update.checkNow');
        System.alertBox(t('prefs.msg.7de248eac5'), t('prefs.ui2.ad9d2dcea17b'));
      }, 1200);
    });
    c.append(p, btn);
    return c;
  }

  // -- 还原 --
  function buildReset() {
    const c = el('div', 'spp-pane');
    c.appendChild(el('p', 'spp-hint', t('prefs.reset.help')));
    const btn = el('button', 'aqua-btn', t('prefs.reset.button'));
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => {
      System.confirmBox({
        title: t('prefs.reset.title'), text: t('prefs.reset.confirm'),
        okLabel: t('prefs.reset.ok'),
        onOK: () => {
          Object.keys(localStorage).filter((k) => k.startsWith('macweb.')).forEach((k) => localStorage.removeItem(k));
          System.shutdownSequence(true);
        },
      });
    });
    c.appendChild(btn);
    const about = el('p', 'spp-hint', t('prefs.reset.about'));
    about.style.marginTop = '18px';
    c.appendChild(about);
    return c;
  }

  const NETWORK_SERVICE_DEFAULTS = Object.freeze([
    { id:'airport', name:t('prefs.msg.bb6703dbf1'), detail:`Leopard Web · ${t('common.connected')}`, icon:'◉' },
    { id:'ethernet', name: t('prefs.net.ethernet'), detail: t('common.disconnected'), icon:'↔' },
    { id:'bluetooth', name:'Bluetooth PAN', detail: t('common.disconnected'), icon:'ᛒ' },
    { id:'firewire', name:t('prefs.msg.b332b80702'), detail: t('common.disconnected'), icon:'⌁' },
  ]);

  function networkServices(cfg) {
    const custom = Array.isArray(cfg.customServices) ? cfg.customServices : [];
    const removed = new Set(Array.isArray(cfg.removedServices) ? cfg.removedServices : []);
    return [
      ...NETWORK_SERVICE_DEFAULTS.filter((service) => service.id === 'airport' || !removed.has(service.id)),
      ...custom.map((service) => ({
        id:String(service.id || `custom-${service.name}`),
        name:String(service.name || t('prefs.ui2.195b38b1915c')),
        detail:t('prefs.msg.ad5ccca37f'),
        icon:'＋',
      })),
    ];
  }

  function normalizedServiceOrder(cfg) {
    const ids = networkServices(cfg).map((service) => service.id);
    const saved = Array.isArray(cfg.serviceOrder) ? cfg.serviceOrder.filter((id) => ids.includes(id)) : [];
    return [...new Set([...saved, ...ids])];
  }

  function openNetworkServiceOrder(cfg, onApply) {
    if (networkServiceOrderWin?.isConnected) {
      System.focusWindow(networkServiceOrderWin);
      return;
    }
    const services = networkServices(cfg);
    const byId = new Map(services.map((service) => [service.id, service]));
    const order = normalizedServiceOrder(cfg);
    const c = el('div', 'network-service-order-dialog');
    c.innerHTML = `
      <header><div class="network-order-orb">↕</div><div><h2>${t('prefs.msg.ab664a027d')}</h2><p>${t('prefs.msg.dbe8dfbae3')}</p></div></header>
      <main><div class="network-order-list" role="listbox"></div><div class="network-order-actions"><button class="aqua-btn order-up" title="${t('prefs.msg.3822376916')}">▲</button><button class="aqua-btn order-down" title="${t('prefs.msg.5556fc25b9')}">▼</button></div>
      <p class="network-order-note">${t('prefs.msg.87ee18679f')}</p></main>
      <footer><button class="aqua-btn order-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default order-apply">${t('prefs.msg.f7ee22b8d4')}</button></footer>`;
    let selected = 0;
    const list = c.querySelector('.network-order-list');
    const render = () => {
      list.innerHTML = '';
      order.forEach((id, index) => {
        const service = byId.get(id);
        if (!service) return;
        const row = el('button', index === selected ? 'sel' : '');
        row.dataset.service = id;
        row.innerHTML = '<i></i><span><b></b><small></small></span><em></em>';
        row.querySelector('i').textContent = service.icon;
        row.querySelector('b').textContent = service.name;
        row.querySelector('small').textContent = service.detail;
        row.querySelector('em').textContent = String(index + 1);
        row.addEventListener('click', () => { selected = index; render(); });
        list.appendChild(row);
      });
      c.querySelector('.order-up').disabled = selected <= 0;
      c.querySelector('.order-down').disabled = selected >= order.length - 1;
    };
    const move = (delta) => {
      const next = selected + delta;
      if (next < 0 || next >= order.length) return;
      [order[selected], order[next]] = [order[next], order[selected]];
      selected = next;
      render();
    };
    c.querySelector('.order-up').addEventListener('click', () => move(-1));
    c.querySelector('.order-down').addEventListener('click', () => move(1));
    networkServiceOrderWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.ff689b59a9'), width:580, height:470, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { networkServiceOrderWin = null; },
    });
    c.querySelector('.order-cancel').addEventListener('click', () => System.closeWindow(networkServiceOrderWin));
    c.querySelector('.order-apply').addEventListener('click', () => {
      cfg.serviceOrder = order.slice();
      save('macweb.pref.network', cfg);
      onApply?.(cfg.serviceOrder);
      System.closeWindow(networkServiceOrderWin);
      Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.msg.bf9d932e86'));
    });
    render();
  }

  function normalizedPreferredNetworks(cfg) {
    const saved = Array.isArray(cfg.preferredNetworks) ? cfg.preferredNetworks : [];
    const normalized = saved.map((network) => typeof network === 'string'
      ? { name:network, security:t('prefs.msg.5ddb529ad7'), autoJoin:true }
      : {
          name:String(network?.name || '').trim(),
          security:String(network?.security || t('prefs.msg.5ddb529ad7')),
          autoJoin:network?.autoJoin !== false,
        }).filter((network) => network.name);
    return normalized.length ? normalized : [{ name:'Leopard Web', security:t('prefs.msg.5ddb529ad7'), autoJoin:true }];
  }

  function openPreferredNetworkSheet(parent, network, onCommit) {
    const form = el('div', 'preferred-network-sheet');
    form.innerHTML = `
      <label><span>${t('prefs.net.networkName')}</span><input class="aqua-input preferred-name" value=""></label>
      <label><span>${t('prefs.ui5.12f187c8eccd')}</span><select class="spp-select preferred-security"><option>${t('prefs.msg.5ddb529ad7')}</option><option>${t('prefs.net.wpaPersonal')}</option><option>WEP</option><option>${t('prefs.msg.baafe899de')}</option></select></label>
      <label class="spp-check"><input class="preferred-auto" type="checkbox" checked> ${t('prefs.ui5.32c7c253b4ea')}</label>
      <label class="preferred-password-row"><span>${t('prefs.msg.9b55a266cc')}</span><input class="aqua-input" type="password" placeholder="${t('prefs.ui2.9a2250278442')}"></label>
      <p class="aqua-sheet-error"></p>`;
    form.querySelector('.preferred-name').value = network?.name || '';
    form.querySelector('.preferred-security').value = network?.security || t('prefs.msg.5ddb529ad7');
    form.querySelector('.preferred-auto').checked = network?.autoJoin !== false;
    System.showSheet({
      parent,
      title:network ? t('prefs.msg.f7cae7e85c') : t('prefs.msg.8e01938719'),
      content:form,
      className:'preferred-network-aqua-sheet',
      initialFocus:form.querySelector('.preferred-name'),
      buttons:[
        { label:t('prefs.msg.625fb26b4b'), cancel:true },
        { label:network ? t('prefs.msg.f7ee22b8d4') : t('prefs.msg2.c193562caf'), default:true, action:() => {
          const name = form.querySelector('.preferred-name').value.trim();
          if (!name) {
            form.querySelector('.aqua-sheet-error').textContent = t('prefs.msg.20c0238647');
            return false;
          }
          return onCommit?.({
            name,
            security:form.querySelector('.preferred-security').value,
            autoJoin:form.querySelector('.preferred-auto').checked,
          });
        } },
      ],
    });
  }

  function openNetworkAdvanced(cfg) {
    const c = el('div', 'network-advanced-dialog');
    const advanced = Object.assign({
      ipv4: t('prefs.msg.0fd164e07b'), ip: '192.168.1.105', mask: '255.255.255.0', router: '192.168.1.1',
      dns: ['192.168.1.1', '1.1.1.1'], search: ['local'], mtu: t('prefs.msg.c85c2ebea7'),
    }, cfg.advanced || {});
    const preferred = normalizedPreferredNetworks(cfg).map((network) => ({ ...network }));
    c.innerHTML = `
      <div class="spp-tabs network-advanced-tabs">
        <button class="active" data-tab="airport">${t('prefs.msg.bb6703dbf1')}</button><button data-tab="tcpip">${t('prefs.msg.76cd28f634')}</button>
        <button data-tab="dns">${t('prefs.msg.32b67efbb0')}</button><button data-tab="wins">${t('prefs.msg.5d93c23df6')}</button>
        <button data-tab="appletalk">${t('prefs.msg.9430df25e4')}</button><button data-tab="proxies">${t('prefs.msg.1b20751e4e')}</button><button data-tab="ethernet">${t('prefs.net.ethernet')}</button>
      </div>
      <section class="spp-tab-panel" data-panel="airport">
        <h3>${t('prefs.ui5.5479a74f27fa')}</h3><div class="network-table preferred-networks"><header><span>${t('prefs.ui5.1e7f418fb8ae')}</span><span>${t('prefs.ui2.553df34ca1a2')}</span></header>
        </div>
        <div class="table-controls preferred-controls"><button class="aqua-btn network-add">＋</button><button class="aqua-btn network-remove">－</button><button class="aqua-btn network-edit">✎</button><i></i><button class="aqua-btn preferred-up">▲</button><button class="aqua-btn preferred-down">▼</button></div>
        <label class="spp-check"><input class="remember-networks" type="checkbox" ${cfg.rememberNetworks === false ? '' : 'checked'}> ${t('prefs.ui5.3b35d9108879')}</label>
        <label class="spp-check"><input class="admin-disconnect" type="checkbox" ${cfg.adminDisconnect ? 'checked' : ''}> ${t('prefs.ui5.8f430cdae30f')}</label>
      </section>
      <section class="spp-tab-panel tcpip-panel" data-panel="tcpip" hidden>
        <label>${t('prefs.ui6.e3c900d9a647')}<select class="spp-select net-ipv4"><option>${t('prefs.msg.0fd164e07b')}</option><option>${t('prefs.net.dhcpManualAddr')}</option><option>${t('prefs.msg.2a3e7f5c38')}</option><option>${t('prefs.msg.b15d91274e')}</option></select></label>
        <label>IPv4 ${t('prefs.ui6.28122a3c5d48')}<input class="aqua-input net-ip" value=""></label>
        <label>${t('prefs.msg.69b504b68e')}<input class="aqua-input net-mask" value=""></label>
        <label>${t('prefs.msg.5409f37a29')}<input class="aqua-input net-router" value=""></label>
        <label>${t('prefs.msg.ce4b991906')}<select class="spp-select"><option>${t('prefs.net.automatic')}</option><option>${t('prefs.msg.2a3e7f5c38')}</option><option>${t('prefs.msg.b15d91274e')}</option></select></label>
        <button class="aqua-btn dhcp-renew">${t('prefs.msg.0939113095')}</button>
      </section>
      <section class="spp-tab-panel" data-panel="dns" hidden>
        <div class="network-columns"><div><h3>${t('prefs.ui2.c8c10c7deb5f')}</h3><div class="network-edit-list dns-list"></div><div class="table-controls"><button class="aqua-btn list-add">＋</button><button class="aqua-btn list-remove">－</button></div></div>
        <div><h3>${t('prefs.msg.cb5d40e15c')}</h3><div class="network-edit-list search-list"></div><div class="table-controls"><button class="aqua-btn domain-add">＋</button><button class="aqua-btn domain-remove">－</button></div></div></div>
      </section>
      <section class="spp-tab-panel wins-panel" data-panel="wins" hidden>
        <label>NetBIOS ${t('prefs.ui3.0d8d8e098de5')}<input class="aqua-input" value="ROLL-MAC"></label><label>${t('prefs.ui2.24b00bd8f573')}<input class="aqua-input" value="WORKGROUP"></label>
        <h3>${t('prefs.net.winsServers')}</h3><div class="network-edit-list"><button>192.168.1.1</button></div>
      </section>
      <section class="spp-tab-panel" data-panel="appletalk" hidden><label class="spp-check"><input type="checkbox"> ${t('prefs.msg.4cc36c26bf')}</label><p>${t('prefs.net.appletalkHelp')}</p></section>
      <section class="spp-tab-panel proxies-panel" data-panel="proxies" hidden>
        <div>${[t('prefs.net.autoProxyDiscovery'),`${t('prefs.ui2.15676c9d1306')}`,t('prefs.msg.ecd98128ff'),t('prefs.msg.f3746bf064'),t('prefs.msg.1020dfdddf'),t('prefs.msg.c9ee3f2d34'),t('prefs.msg.a5b10d8fe4'),t('prefs.msg.0fb32532f9')].map((name)=>`<label class="spp-check"><input type="checkbox"> ${name}</label>`).join('')}</div>
        <label>${t('prefs.net.bypassProxy')}:<textarea class="aqua-input">*.local, 169.254/16</textarea></label>
      </section>
      <section class="spp-tab-panel ethernet-panel" data-panel="ethernet" hidden>
        <label>${t('prefs.msg.7973feeec1')}<select class="spp-select"><option>${t('prefs.net.automatic')}</option><option>${t('prefs.net.manual')}</option></select></label><label>${t('prefs.msg.14eef0b159')}<select class="spp-select"><option>${t('prefs.ui6.a2245255b941')}</option><option>1000baseT</option><option>100baseTX</option></select></label>
        <label>${t('prefs.msg.6c5bfb4a39')}<select class="spp-select"><option>${t('prefs.msg.813c586a95')}</option><option>${t('prefs.msg.e12adb2d59')}</option></select></label><label>MTU：<select class="spp-select net-mtu"><option>${t('prefs.msg.c85c2ebea7')}</option><option>${t('prefs.msg.aa12629b80')}</option><option>${t('prefs.msg.53da919637')}</option></select></label>
      </section>
      <footer><button class="aqua-btn network-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default network-ok">${t('prefs.msg.f7ee22b8d4')}</button></footer>`;
    c.querySelector('.net-ip').value = String(advanced.ip ?? '');
    c.querySelector('.net-mask').value = String(advanced.mask ?? '');
    c.querySelector('.net-router').value = String(advanced.router ?? '');
    const appendNetworkValues = (selector, values) => {
      const list = c.querySelector(selector);
      (Array.isArray(values) ? values : []).forEach((value) => list.appendChild(el('button', '', String(value))));
    };
    appendNetworkValues('.dns-list', advanced.dns);
    appendNetworkValues('.search-list', advanced.search);
    c.querySelector('.net-ipv4').value = advanced.ipv4;
    c.querySelector('.net-mtu').value = advanced.mtu;
    bindTabs(c);
    const selectRow = (list, event) => {
      const button = event.target.closest('button');
      if (!button) return;
      list.querySelectorAll('button').forEach((item) => item.classList.toggle('sel', item === button));
    };
    c.querySelectorAll('.network-edit-list').forEach((list) => list.addEventListener('click', (event) => selectRow(list, event)));
    let selectedPreferred = 0;
    const renderPreferred = () => {
      c.querySelectorAll('.preferred-networks>div').forEach((row) => row.remove());
      preferred.forEach((network, index) => {
        const row = el('div', index === selectedPreferred ? 'sel' : '');
        row.dataset.index = String(index);
        const name = el('span', '', network.name);
        if (!network.autoJoin) name.appendChild(el('small', '', t('prefs.msg.3dac66a83c')));
        row.append(name, el('span', '', network.security));
        row.addEventListener('click', () => { selectedPreferred = index; renderPreferred(); });
        row.addEventListener('dblclick', () => c.querySelector('.network-edit').click());
        c.querySelector('.preferred-networks').appendChild(row);
      });
      selectedPreferred = Math.max(0, Math.min(selectedPreferred, preferred.length - 1));
      c.querySelector('.network-remove').disabled = preferred.length <= 1 || preferred[selectedPreferred]?.name === 'Leopard Web';
      c.querySelector('.network-edit').disabled = !preferred.length;
      c.querySelector('.preferred-up').disabled = selectedPreferred <= 0;
      c.querySelector('.preferred-down').disabled = selectedPreferred >= preferred.length - 1;
    };
    const addListItem = (selector, label) => {
      System.promptSheet({
        parent:win, title:t('prefs.msg.d51bedc8a8'), message:label, okLabel:t('prefs.msg2.c193562caf'),
        onOK:(value)=>c.querySelector(selector).appendChild(el('button','',value)),
      });
    };
    c.querySelector('.list-add').addEventListener('click', () => addListItem('.dns-list', t('prefs.msg.492b81ff02')));
    c.querySelector('.domain-add').addEventListener('click', () => addListItem('.search-list', t('prefs.msg.cb5d40e15c')));
    c.querySelector('.list-remove').addEventListener('click', () => c.querySelector('.dns-list .sel')?.remove());
    c.querySelector('.domain-remove').addEventListener('click', () => c.querySelector('.search-list .sel')?.remove());
    c.querySelector('.network-add').addEventListener('click', () => openPreferredNetworkSheet(win, null, (network) => {
      if (preferred.some((item) => item.name.toLowerCase() === network.name.toLowerCase())) {
        Leopard.toast(t('prefs.msg.bb6703dbf1'), t('prefs.msg.54159dadc0'));
        return false;
      }
      preferred.push(network);
      selectedPreferred = preferred.length - 1;
      renderPreferred();
      return true;
    }));
    c.querySelector('.network-edit').addEventListener('click', () => {
      const current = preferred[selectedPreferred];
      if (!current) return;
      openPreferredNetworkSheet(win, current, (network) => {
        preferred[selectedPreferred] = network;
        renderPreferred();
        return true;
      });
    });
    c.querySelector('.network-remove').addEventListener('click', () => {
      if (preferred[selectedPreferred]?.name === 'Leopard Web') {
        Leopard.toast(t('prefs.msg.bb6703dbf1'), t('prefs.msg.4af6c6a77f'));
        return;
      }
      preferred.splice(selectedPreferred, 1);
      selectedPreferred = Math.max(0, selectedPreferred - 1);
      renderPreferred();
    });
    const movePreferred = (delta) => {
      const next = selectedPreferred + delta;
      if (next < 0 || next >= preferred.length) return;
      [preferred[selectedPreferred], preferred[next]] = [preferred[next], preferred[selectedPreferred]];
      selectedPreferred = next;
      renderPreferred();
    };
    c.querySelector('.preferred-up').addEventListener('click', () => movePreferred(-1));
    c.querySelector('.preferred-down').addEventListener('click', () => movePreferred(1));
    c.querySelector('.dhcp-renew').addEventListener('click', () => Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.msg.21a7182a87')));
    const win = System.createWindow({ app: 'sysprefs', title: t('prefs.msg.6c6381e6ef'), width: 690, height: 520, content: c, bodyBg: '#ececec', noResize: true });
    renderPreferred();
    c.querySelector('.network-cancel').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.network-ok').addEventListener('click', () => {
      cfg.advanced = {
        ipv4: c.querySelector('.net-ipv4').value,
        ip: c.querySelector('.net-ip').value,
        mask: c.querySelector('.net-mask').value,
        router: c.querySelector('.net-router').value,
        dns: Array.from(c.querySelectorAll('.dns-list button'), (item) => item.textContent),
        search: Array.from(c.querySelectorAll('.search-list button'), (item) => item.textContent),
        mtu: c.querySelector('.net-mtu').value,
      };
      cfg.preferredNetworks = preferred.map((network) => ({ ...network }));
      cfg.rememberNetworks = c.querySelector('.remember-networks').checked;
      cfg.adminDisconnect = c.querySelector('.admin-disconnect').checked;
      save('macweb.pref.network', cfg);
      System.closeWindow(win);
      Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.msg.9944006949'));
    });
  }

  const printerSvg = `<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="printer-body" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#cbd0d6"/><stop offset=".52" stop-color="#858c95"/><stop offset="1" stop-color="#e4e7ea"/></linearGradient></defs><path d="M29 9h38v27H29z" fill="#f7fbff" stroke="#737b84"/><path d="M18 31h60q8 0 8 8v31H10V39q0-8 8-8z" fill="url(#printer-body)" stroke="#626a73" stroke-width="2"/><rect x="20" y="54" width="56" height="31" rx="2" fill="#fbfdff" stroke="#78818b"/><path d="M27 63h42M27 70h35M27 77h39" stroke="#92a7b8" stroke-width="2"/><circle cx="72" cy="43" r="3" fill="#57b94b"/><path d="M24 36h48" stroke="#fff" stroke-width="2" opacity=".8"/></svg>`;

  function openPrintQueue() {
    const c = el('div', 'print-queue-window');
    c.innerHTML = `<header><div>${printerSvg}<span><b>Web PDF Printer</b><small>${t('prefs.ui6.f15b9954f465')}</small></span></div><button class="aqua-btn queue-pause">${t('prefs.msg.a729d5e129')}</button></header>
      <div class="print-job-table"><div class="head"><span>${t('prefs.ui5.303a2a6da069')}</span><span>${t('prefs.msg.d7ec2d3fea')}</span><span>${t('prefs.ui5.e44478830bd6')}</span><span>${t('prefs.ui6.f62ef64d265e')}</span><span>${t('prefs.ui6.32490d33f54c')}</span></div><div class="empty">${t('prefs.msg.5fd0a03767')}</div></div>
      <footer><button class="aqua-btn queue-delete" disabled>${t('prefs.msg.2d006fa832')}</button><button class="aqua-btn queue-hold" disabled>${t('prefs.ui2.5c71f5cf4c5d')}</button><span></span><button class="aqua-btn queue-test">${t('prefs.ui6.8b48092c5b21')}</button></footer>`;
    const queue = c.querySelector('.print-job-table');
    c.querySelector('.queue-pause').addEventListener('click', (event) => {
      event.currentTarget.classList.toggle('paused');
      event.currentTarget.textContent = event.currentTarget.classList.contains('paused') ? t('prefs.ui2.ae819277ed07') : t('prefs.msg.a729d5e129');
    });
    c.querySelector('.queue-test').addEventListener('click', () => {
      queue.querySelector('.empty')?.remove();
      const job = el('button', 'print-job');
      job.innerHTML = `<span>${t('prefs.ui6.bf60bb3c2f6d')}</span><span>${t('prefs.print.testPageName')}</span><span>roll</span><span>${new Date().toLocaleTimeString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}</span><span>1</span>`;
      queue.appendChild(job);
      setTimeout(() => {
        if (!job.isConnected) return;
        const name = VFS.uniqueName(paths.downloads, t('prefs.ui2.ac8549b84b6b'), '.pdf');
        const src = makeTestPdf();
        VFS.putNode(`${paths.downloads}/${name}`, { type:'file', kind:'pdf', src, content:'Mac OS X Leopard Web Printer Test Page' });
        const binary = atob(src.split(',')[1]);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const downloadUrl = URL.createObjectURL(new Blob([bytes], { type:'application/pdf' }));
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
        job.querySelector('span').textContent = t('prefs.ui2.0a2d10613a87');
        job.querySelectorAll('span')[1].textContent = name;
        Leopard.toast(t('prefs.ui2.ba3c80d999f5'), `“${name}”${t('prefs.ui8.8dc9d3e3a154')}${t('prefs.ui7.7a4a897cf122')}。`);
      }, 1200);
    });
    System.createWindow({ app: 'sysprefs', title: 'Web PDF Printer', width: 760, height: 470, content: c, bodyBg: '#ececec' });
  }

  function openPrinterBrowser() {
    const c = el('div', 'printer-browser');
    c.innerHTML = `<div class="spp-tabs"><button class="active" data-tab="default">${t('prefs.ui3.c44391dfe399')}</button><button data-tab="fax">${t('prefs.ui3.a18bd537a886')}</button><button data-tab="ip">IP</button><button data-tab="windows">Windows</button></div>
      <section class="spp-tab-panel" data-panel="default"><div class="printer-discovery"><header><span>${t('prefs.ui6.066a37edae83')}</span><span>${t('prefs.msg.289a7e7694')}</span></header><button class="sel"><span>Web PDF Printer</span><span>${t('prefs.ui6.06ddbc5ff2bb')}</span></button><button><span>AirPrint Demo</span><span>Bonjour</span></button></div><p>${t('prefs.ui6.4df1bd2b752d')}</p></section>
      <section class="spp-tab-panel" data-panel="fax" hidden><p>${t('prefs.ui6.b740d5e59069')}</p></section>
      <section class="spp-tab-panel printer-ip" data-panel="ip" hidden><label>${t('prefs.ui3.01047d99d523')}<select class="spp-select"><option>${t('prefs.ui6.25ce01c681d4')}</option><option>${t('prefs.ui8.6f68ed4e5e5c')}</option><option>HP Jetdirect - Socket</option></select></label><label>${t('prefs.ui6.28122a3c5d48')}<input class="aqua-input"></label><label>${t('prefs.ui3.06428fa6d84a')}<input class="aqua-input"></label><label>${t('prefs.ui3.0d8d8e098de5')}<input class="aqua-input"></label></section>
      <section class="spp-tab-panel" data-panel="windows" hidden><p>${t('prefs.ui3.1f7999c767e4')}</p><div class="printer-discovery"><button>WORKGROUP</button></div></section>
      <footer><button class="aqua-btn printer-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default printer-add-confirm">${t('prefs.msg2.c193562caf')}</button></footer>`;
    bindTabs(c);
    const win = System.createWindow({ app: 'sysprefs', title: t('prefs.ui3.cac495ccf597'), width: 650, height: 470, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.printer-cancel').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.printer-add-confirm').addEventListener('click', () => { System.closeWindow(win); Leopard.toast(t('prefs.ui2.4538e76e38dc'), t('prefs.ui3.3952d6de74e7')); });
  }

  function openBluetoothAssistant(cfg, onDevice) {
    const c = el('div', 'bluetooth-assistant');
    c.innerHTML = `<aside><div class="bt-orb">ᛒ</div></aside><main><h2>${t('prefs.ui3.b84a894369f9')}</h2><p>${t('prefs.ui8.5a0e4cc0c9f5')}${t('prefs.ui2.c449106091a6')}${t('prefs.ui8.d7618f466678')}${t('prefs.ui6.8f46dc84302f')}${t('prefs.ui8.adc54f141104')}</p>
      <div class="bluetooth-scan-state"><i></i><span>${t('prefs.ui8.650f0f0b4da8')}${t('prefs.ui2.b66fe4e53991')}</span></div>
      <footer><button class="aqua-btn bt-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default bt-scan">${t('common.continue')}</button></footer></main>`;
    const win = System.createWindow({ app: 'sysprefs', title: t('prefs.ui3.b84a894369f9'), width: 650, height: 430, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.bt-cancel').addEventListener('click', () => System.closeWindow(win));
    const scanButton = c.querySelector('.bt-scan');
    let done = false;
    scanButton.addEventListener('click', async () => {
      if (done) {
        System.closeWindow(win);
        return;
      }
      const status = c.querySelector('.bluetooth-scan-state');
      status.classList.add('scanning');
      status.querySelector('span').textContent = t('prefs.ui3.3e9d5dc07459');
      if (!navigator.bluetooth?.requestDevice) {
        status.classList.remove('scanning');
        status.querySelector('span').textContent = t('prefs.ui3.47cc0aa30cd8');
        return;
      }
      try {
        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
        const name = device.name || t('prefs.msg.ac70923108');
        cfg.devices = Array.from(new Set([...(cfg.devices || []), name]));
        save('macweb.pref.bluetooth', cfg);
        status.classList.remove('scanning');
        status.innerHTML = '<b>✓</b><span></span>';
        status.querySelector('span').textContent = `${t('prefs.ui8.9c2373e64da0')}${name}”`;
        onDevice?.(name);
        done = true;
        scanButton.textContent = t('prefs.msg2.b8b1e2afb5');
      } catch (error) {
        status.classList.remove('scanning');
        status.querySelector('span').textContent = error?.name === 'NotFoundError' ? t('prefs.msg.1fbb2aec5e') : t('prefs.msg.c1d68b9eff');
      }
    });
  }

  function bluetoothPairedDevices(cfg) {
    return [...new Set(['Apple Wireless Keyboard', 'Mighty Mouse', ...(cfg.devices || [])])];
  }

  function bluetoothSizeLabel(bytes) {
    if (bytes < 1024) return `${bytes} ${t('prefs.ui8.29e789611acf')}`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function openBluetoothTransfer(cfg, path, node, preferredDevice) {
    if (bluetoothTransferWin?.isConnected) {
      System.focusWindow(bluetoothTransferWin);
      Leopard.toast(t('prefs.msg.1c4986f495'), t('prefs.msg.6906b54be1'));
      return;
    }
    const devices = bluetoothPairedDevices(cfg);
    const name = VFS.baseName(path);
    const size = VFS.sizeOf(path);
    const c = el('div', 'bluetooth-transfer-dialog');
    c.innerHTML = `
      <header><div class="bt-transfer-icon">ᛒ</div><div><h2>${t('prefs.msg.1c4986f495')}</h2><p>${t('prefs.ui6.5845f8248089')}</p></div></header>
      <main>
        <div class="bt-transfer-file"><div class="bt-file-glyph">▤</div><span><b></b><small></small></span></div>
        <label><span>${t('prefs.ui6.e331b7afa598')}</span><select class="spp-select bt-transfer-device"></select></label>
        <div class="bt-transfer-progress"><i></i></div>
        <p class="bt-transfer-status">${t('prefs.ui6.60d80287f2fb')}</p>
        <details><summary>${t('prefs.ui8.b1cbfd4cad14')}${t('prefs.ui5.9dd2c0110665')}</summary><dl><dt>${t('prefs.ui6.f5c072b8d0f7')}</dt><dd></dd><dt>${t('prefs.ui6.1667a2c97f56')}</dt><dd>${t('prefs.ui8.186bfb5289f1')}</dd><dt>${t('prefs.ui2.553df34ca1a2')}</dt><dd>${t('prefs.ui6.f84ab119b8e6')}</dd></dl></details>
        <p class="bt-transfer-disclosure">${t('prefs.ui8.60b0ce327dbb')}${t('prefs.ui5.e08af2704651')}。</p>
      </main>
      <footer><button class="aqua-btn bt-transfer-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default bt-transfer-start">${t('prefs.ui3.1a2429e720d3')}</button></footer>`;
    c.querySelector('.bt-transfer-file b').textContent = name;
    c.querySelector('.bt-transfer-file small').textContent = `${bluetoothSizeLabel(size)} · ${node?.kind === 'image' ? t('prefs.ui2.e0135ad1d444') : t('prefs.ui2.43f9de7ca886')}`;
    c.querySelector('details dd').textContent = path;
    const deviceSelect = c.querySelector('.bt-transfer-device');
    devices.forEach((device) => deviceSelect.appendChild(el('option', '', device)));
    if (preferredDevice && devices.includes(preferredDevice)) deviceSelect.value = preferredDevice;
    let timer = 0;
    let progress = 0;
    let complete = false;
    const stopTimer = () => { clearInterval(timer); timer = 0; };
    bluetoothTransferWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.1c4986f495'), width:590, height:500, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { stopTimer(); bluetoothTransferWin = null; },
    });
    c.querySelector('.bt-transfer-cancel').addEventListener('click', () => System.closeWindow(bluetoothTransferWin));
    c.querySelector('.bt-transfer-start').addEventListener('click', () => {
      if (complete) {
        System.closeWindow(bluetoothTransferWin);
        return;
      }
      const start = c.querySelector('.bt-transfer-start');
      const cancel = c.querySelector('.bt-transfer-cancel');
      const status = c.querySelector('.bt-transfer-status');
      const bar = c.querySelector('.bt-transfer-progress i');
      const target = deviceSelect.value;
      start.disabled = true;
      cancel.textContent = t('prefs.msg.095e938e2a');
      deviceSelect.disabled = true;
      status.textContent = `${t('prefs.ui8.efe65727ded0')}${target}”…`;
      const step = Math.max(2.5, Math.min(9, 650000 / Math.max(1, size)));
      timer = setInterval(() => {
        progress = Math.min(100, progress + step + Math.random() * 2.4);
        bar.style.width = `${progress}%`;
        status.textContent = progress < 12 ? `${t('prefs.ui8.efe65727ded0')}${target}”…`
          : progress < 96 ? `${t('prefs.ui8.77cd3733d403')}${name}”… ${Math.floor(progress)}%`
          : t('prefs.ui3.e18c2b96b042');
        if (progress < 100) return;
        stopTimer();
        complete = true;
        cfg.transfers = [{
          name, path, device:target, size, status:t('prefs.msg2.da67d1a5ce'), time:Date.now(),
        }, ...(cfg.transfers || [])].slice(0, 20);
        cfg.connectedDevices = [...new Set([...(cfg.connectedDevices || []), target])];
        save('macweb.pref.bluetooth', cfg);
        document.dispatchEvent(new CustomEvent('leopard-bluetooth-devices-changed'));
        status.replaceChildren(
          el('b', '', t('prefs.ui6.19708ba71aad')),
          el('br'),
          document.createTextNode(`“${target}${t('prefs.ui8.39eca07f3643')}${name}”。`),
        );
        start.disabled = false;
        start.textContent = t('prefs.msg2.b8b1e2afb5');
        cancel.hidden = true;
        Leopard.toast(t('prefs.msg.1c4986f495'), `“${name}${t('prefs.ui8.313a2de72bb1')}${target}”。`);
      }, 90);
    });
  }

  function openBluetoothFilePanel(cfg, preferredDevice) {
    if (cfg.enabled === false) {
      System.alertBox(t('prefs.msg.1c4986f495'), t('prefs.bt.turnOnFirst'));
      return;
    }
    System.openPanel({
      parent:winRef,
      title:t('prefs.ui3.1dfa2369df5c'),
      startPath:paths.home,
      allowUpload:true,
      onOpen:(path, node) => {
        openBluetoothTransfer(cfg, path, node, preferredDevice);
        return true;
      },
    });
  }

  function openBluetoothDeviceBrowser(cfg) {
    if (bluetoothBrowserWin?.isConnected) {
      System.focusWindow(bluetoothBrowserWin);
      return;
    }
    const c = el('div', 'bluetooth-browser-dialog');
    c.innerHTML = `
      <header><div class="bt-orb">ᛒ</div><div><h2>${t('prefs.ui8.160ad8834540')}${t('prefs.ui2.b66fe4e53991')}</h2><p>${t('prefs.ui6.4983189c22d8')}</p></div></header>
      <main><aside><div class="bt-browser-list"></div><footer><button class="aqua-btn bt-browser-refresh">${t('prefs.msg2.293b36487c')}</button></footer></aside>
      <section><div class="bt-browser-empty">${t('prefs.ui3.5250514bf849')}</div><div class="bt-browser-detail" hidden>
        <h3></h3><p class="bt-browser-state"></p>
        <dl><dt>${t('prefs.ui6.2899cb6d9de5')}</dt><dd class="bt-browser-kind"></dd><dt>${t('prefs.ui3.173dcd84e665')}</dt><dd class="bt-browser-services"></dd><dt>${t('prefs.ui2.0674e27b2d99')}</dt><dd>${t('prefs.ui6.053425f81c0f')}</dd></dl>
        <div class="bt-browser-inbox"><h4>${t('prefs.ui6.d49892047ce7')}</h4><div></div></div>
        <footer><button class="aqua-btn bt-browser-connect"></button><button class="aqua-btn default bt-browser-send">${t('prefs.bt.sendFile')}</button></footer>
      </div></section></main>
      <footer><span>${t('prefs.ui6.c3c9fc17981c')}</span><button class="aqua-btn default bt-browser-close">${t('prefs.msg.b15d91274e')}</button></footer>`;
    let selected = '';
    const connected = new Set(cfg.connectedDevices || []);
    const list = c.querySelector('.bt-browser-list');
    const renderDetail = () => {
      const detail = c.querySelector('.bt-browser-detail');
      c.querySelector('.bt-browser-empty').hidden = Boolean(selected);
      detail.hidden = !selected;
      if (!selected) return;
      const lower = selected.toLowerCase();
      const kind = lower.includes('keyboard') ? t('prefs.ui2.a6b63de04239') : lower.includes('mouse') ? t('prefs.ui2.aef4cec52308') : t('prefs.msg.ac70923108');
      const services = kind === t('prefs.ui2.a6b63de04239') || kind === t('prefs.ui2.aef4cec52308') ? t('prefs.ui3.5d51c1bb5c32') : t('prefs.ui3.7ddfb41e3da4');
      detail.querySelector('h3').textContent = selected;
      detail.querySelector('.bt-browser-state').textContent = connected.has(selected) ? `${t('common.connected')}${t('prefs.ui8.76c74f4e7204')}` : `${t('prefs.ui8.9d8665704b86')}${t('common.disconnected')}`;
      detail.querySelector('.bt-browser-kind').textContent = kind;
      detail.querySelector('.bt-browser-services').textContent = services;
      detail.querySelector('.bt-browser-connect').textContent = connected.has(selected) ? t('prefs.ui3.99431c332fb9') : t('prefs.ui3.f3b82c3c436f');
      const history = (cfg.transfers || []).filter((entry) => entry.device === selected);
      const inbox = detail.querySelector('.bt-browser-inbox>div');
      inbox.innerHTML = '';
      if (!history.length) inbox.appendChild(el('p', '', t('prefs.ui3.de78d6c70985')));
      history.slice(0, 6).forEach((entry) => {
        const row = el('p');
        row.append(el('b', '', entry.name), el('span', '', new Date(entry.time).toLocaleString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')), el('em', '', entry.status));
        inbox.appendChild(row);
      });
    };
    const renderList = () => {
      list.innerHTML = '';
      bluetoothPairedDevices(cfg).forEach((device) => {
        const row = el('button', device === selected ? 'sel' : '');
        row.innerHTML = '<i>ᛒ</i><span><b></b><small></small></span>';
        row.querySelector('b').textContent = device;
        row.querySelector('small').textContent = connected.has(device) ? t('common.connected') : t('prefs.msg.51b5912f68');
        row.addEventListener('click', () => { selected = device; renderList(); renderDetail(); });
        list.appendChild(row);
      });
    };
    bluetoothBrowserWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.1c4986f495'), width:720, height:520, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { bluetoothBrowserWin = null; },
    });
    c.querySelector('.bt-browser-close').addEventListener('click', () => System.closeWindow(bluetoothBrowserWin));
    c.querySelector('.bt-browser-connect').addEventListener('click', () => {
      if (!selected) return;
      if (connected.has(selected)) connected.delete(selected); else connected.add(selected);
      cfg.connectedDevices = [...connected];
      save('macweb.pref.bluetooth', cfg);
      document.dispatchEvent(new CustomEvent('leopard-bluetooth-devices-changed'));
      renderList();
      renderDetail();
    });
    c.querySelector('.bt-browser-send').addEventListener('click', () => selected && openBluetoothFilePanel(cfg, selected));
    c.querySelector('.bt-browser-refresh').addEventListener('click', async () => {
      const button = c.querySelector('.bt-browser-refresh');
      if (!navigator.bluetooth?.getDevices) {
        Leopard.toast('Bluetooth', t('prefs.msg.0b442a1fa3'));
        return;
      }
      button.disabled = true;
      button.textContent = t('prefs.ui3.3ab6714448fc');
      try {
        const devices = await navigator.bluetooth.getDevices();
        const names = devices.map((device) => device.name).filter(Boolean);
        cfg.devices = [...new Set([...(cfg.devices || []), ...names])];
        save('macweb.pref.bluetooth', cfg);
        renderList();
        Leopard.toast('Bluetooth', names.length ? `${t('prefs.ui8.fbd4c9d43f86')}${names.length}${t('prefs.ui8.1f9436d73a1c')}` : t('prefs.msg.614652647b'));
      } catch (error) {
        Leopard.toast('Bluetooth', t('prefs.msg.c508f1af35'));
      } finally {
        button.disabled = false;
        button.textContent = t('prefs.msg2.293b36487c');
      }
    });
    renderList();
    renderDetail();
  }

  function openBluetoothAdvanced(cfg) {
    if (bluetoothAdvancedWin?.isConnected) {
      System.focusWindow(bluetoothAdvancedWin);
      return;
    }
    const advanced = Object.assign({
      keyboardAssistant:true,
      mouseAssistant:true,
      allowWake:true,
      securePairing:true,
      confirmTransfers:true,
      shareFolder:paths.public,
    }, cfg.advanced || {});
    const c = el('div', 'bluetooth-advanced-dialog');
    c.innerHTML = `
      <header><div class="bt-orb">ᛒ</div><div><h2>${t('prefs.msg.52d3e8687c')}</h2><p>${t('prefs.ui6.0220816dda7e')}</p></div></header>
      <main>
        <fieldset><legend>${t('prefs.ui3.b84a894369f9')}</legend>
          <label class="spp-check"><input data-setting="keyboardAssistant" type="checkbox"> ${t('prefs.ui6.8471534944cf')}</label>
          <label class="spp-check"><input data-setting="mouseAssistant" type="checkbox"> ${t('prefs.ui6.a864f271be0b')}</label>
        </fieldset>
        <fieldset><legend>${t('prefs.ui6.d00721a69e72')}</legend>
          <label class="spp-check"><input data-setting="allowWake" type="checkbox"> ${t('prefs.ui8.0e557975cc9f')}${t('prefs.ui2.b66fe4e53991')}${t('prefs.ui8.1ee69db48231')}</label>
          <label class="spp-check"><input data-setting="securePairing" type="checkbox"> ${t('prefs.ui6.d01196c5bb5a')}</label>
          <label class="spp-check"><input data-setting="confirmTransfers" type="checkbox"> ${t('prefs.ui6.788ab8634345')}</label>
        </fieldset>
        <fieldset class="bt-share-folder"><legend>${t('prefs.ui2.f52a44e1570e')}</legend><label><span>${t('prefs.ui6.5f572ac87301')}</span><input class="aqua-input" readonly><button class="aqua-btn">${t('prefs.ui6.2e64d5e63531')}</button></label></fieldset>
        <p>${t('prefs.ui6.6e5ef66ada08')}</p>
      </main>
      <footer><button class="aqua-btn bt-advanced-cancel">${t('dialog.cancel')}</button><button class="aqua-btn default bt-advanced-save">${t('prefs.msg.f7ee22b8d4')}</button></footer>`;
    c.querySelectorAll('[data-setting]').forEach((control) => { control.checked = Boolean(advanced[control.dataset.setting]); });
    const folder = c.querySelector('.bt-share-folder input');
    folder.value = advanced.shareFolder;
    bluetoothAdvancedWin = System.createWindow({
      app:'sysprefs', title:t('prefs.msg.52d3e8687c'), width:650, height:520, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { bluetoothAdvancedWin = null; },
    });
    c.querySelector('.bt-share-folder button').addEventListener('click', () => System.openPanel({
      parent:bluetoothAdvancedWin,
      title:t('prefs.ui3.a3501a8075dd'),
      startPath:advanced.shareFolder,
      allowFolders:true,
      allowUpload:false,
      onOpen:(path) => {
        if (!VFS.isDir(path)) return false;
        advanced.shareFolder = path;
        folder.value = path;
        return true;
      },
    }));
    c.querySelector('.bt-advanced-cancel').addEventListener('click', () => System.closeWindow(bluetoothAdvancedWin));
    c.querySelector('.bt-advanced-save').addEventListener('click', () => {
      c.querySelectorAll('[data-setting]').forEach((control) => { advanced[control.dataset.setting] = control.checked; });
      cfg.advanced = { ...advanced };
      save('macweb.pref.bluetooth', cfg);
      System.closeWindow(bluetoothAdvancedWin);
      Leopard.toast('Bluetooth', t('prefs.msg.e53f7e8a6f'));
    });
  }

  function openFileVaultAssistant(cfg, onFinish) {
    const c = el('div', 'filevault-assistant aqua-assistant');
    let step = 0;
    const pages = [
      [t('prefs.ui2.6c64d1be06a8'), t('prefs.ui3.a67715377961')],
      [t('prefs.ui3.7b250c30e430'), t('prefs.ui3.b1c21819f415')],
      [t('prefs.ui3.3d598c199ba0'), t('prefs.ui3.d4df09d680c1')],
    ];
    const paint = () => {
      const [title, copy] = pages[step];
      c.innerHTML = `<aside><div class="filevault-lock"><i></i></div></aside><main><h2>${title}</h2><p>${copy}</p>
        ${step === 1 ? `<label>${t('prefs.ui3.0c5445022c2d')}<input class="aqua-input filevault-hint" value="${t('prefs.ui3.03908344f3db')}"></label>` : ''}
        <div class="assistant-summary">${step === 2 ? `<b>${t('prefs.ui6.9c2fa1f2a533')}</b> ${paths.home}<br><b>${t('prefs.print.status')}</b> ${t('prefs.ui7.d13f3b1c8e99')}` : `AES-128 · ${t('prefs.ui7.112e26e6aaf0')} · ${t('prefs.ui7.75a1bcda9662')}`}</div>
        <footer><button class="aqua-btn fv-cancel">${t('dialog.cancel')}</button><i></i><button class="aqua-btn fv-back" ${step ? '' : 'disabled'}>${t('prefs.msg.5f411223ca')}</button><button class="aqua-btn default fv-next">${step === pages.length - 1 ? t('prefs.ui2.6c64d1be06a8') : t('prefs.msg2.6b1fa67d7d')}</button></footer></main>`;
      c.querySelector('.fv-cancel').addEventListener('click', () => System.closeWindow(win));
      c.querySelector('.fv-back').addEventListener('click', () => { step--; paint(); });
      c.querySelector('.fv-next').addEventListener('click', () => {
        if (step < pages.length - 1) { step++; paint(); return; }
        cfg.fileVault = true;
        save('macweb.pref.security', cfg);
        System.closeWindow(win);
        onFinish?.();
        Leopard.toast('FileVault', t('prefs.ui2.a78f9fba154c'));
      });
    };
    const win = System.createWindow({ app: 'sysprefs', title: 'FileVault', width: 650, height: 430, content: c, bodyBg: '#ececec', noResize: true });
    paint();
  }

  function openNetworkDiagnostics() {
    const c = el('div', 'network-diagnostics');
    const tests = [
      [t('prefs.msg.bb6703dbf1'), t('prefs.ui3.18f411f4907a')],
      [t('prefs.ui3.8b962b3d64f6'), t('prefs.ui3.29dc48aab74a')],
      [t('prefs.ui3.d4ea3871cff1'), t('prefs.ui3.669270cd9618')],
      ['ISP', t('prefs.ui3.48eab39c6dba')],
      ['Internet', t('prefs.ui3.e849ac9552c1')],
      [t('prefs.ui3.e7d130454269'), t('prefs.ui3.ec5c31e81663')],
    ];
    c.innerHTML = `<header><div class="diagnostic-orb">◉</div><div><h2>${t('prefs.msg.a5744c0d2f')}</h2><p>${t('prefs.ui6.bfb15b32d3fc')}</p></div></header>
      <main><ol>${tests.map(([name, hint]) => `<li><i></i><span><b>${name}</b><small>${hint}</small></span><em>${t('prefs.ui2.fccc85325fb4')}</em></li>`).join('')}</ol>
      <aside><h3>${t('prefs.msg.7ae644e46c')}</h3><p>${t('prefs.net.location')}${t('prefs.net.automatic')}<br>${t('prefs.ui6.2202f6651760')}<br>${t('prefs.ui6.8f230d029dea')}</p></aside></main>
      <footer><button class="aqua-btn diagnostics-close">${t('prefs.msg.b15d91274e')}</button><i></i><button class="aqua-btn default diagnostics-run">${t('prefs.ui6.5d6f73259893')}</button></footer>`;
    const win = System.createWindow({ app: 'netutil', title: t('prefs.msg.a5744c0d2f'), width: 690, height: 480, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.diagnostics-close').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.diagnostics-run').addEventListener('click', () => {
      const button = c.querySelector('.diagnostics-run');
      button.disabled = true;
      const rows = Array.from(c.querySelectorAll('li'));
      rows.forEach((row) => { row.className = ''; row.querySelector('em').textContent = t('prefs.ui2.fccc85325fb4'); });
      let index = 0;
      const next = () => {
        if (!c.isConnected) return;
        if (index >= rows.length) {
          button.disabled = false;
          button.textContent = t('prefs.ui3.4946e484ae49');
          c.querySelector('header p').textContent = `${t('prefs.ui2.f33710ea4fb8')}`;
          Leopard.toast(t('prefs.msg.a5744c0d2f'), t('prefs.msg.c7bb401814'));
          return;
        }
        const row = rows[index++];
        row.className = 'testing';
        row.querySelector('em').textContent = t('prefs.ui3.49687274af78');
        setTimeout(() => {
          row.className = 'passed';
          row.querySelector('em').textContent = t('prefs.ui3.8bd7e916bc86');
          next();
        }, 260);
      };
      next();
    });
  }

  function openNetworkServiceAssistant(onAdd) {
    const c = el('div', 'network-service-assistant aqua-assistant');
    c.innerHTML = `<aside><div class="network-service-orb">＋</div></aside><main><h2>${t('prefs.ui6.f6327af19fa8')}</h2><p>${t('prefs.net.addServiceHelp')}</p>
      <label>${t('prefs.ui6.75358c61b97b')}<select class="spp-select service-interface"><option>${t('prefs.net.ethernet')}</option><option>Bluetooth</option><option>${t('prefs.msg.b332b80702')}</option><option>VPN</option></select></label>
      <label>${t('prefs.ui6.3e35f5241d1a')}<input class="aqua-input service-name" value="${t('prefs.net.ethernet')}"></label>
      <footer><button class="aqua-btn service-cancel">${t('dialog.cancel')}</button><i></i><button class="aqua-btn default service-create">${t('prefs.ui6.e6e12694ea45')}</button></footer></main>`;
    const select = c.querySelector('.service-interface');
    select.addEventListener('change', () => { c.querySelector('.service-name').value = select.value; });
    const win = System.createWindow({ app: 'sysprefs', title: `${t('prefs.ui8.33b787bf482a')}${t('prefs.ui2.195b38b1915c')}`, width: 610, height: 390, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.service-cancel').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.service-create').addEventListener('click', () => {
      onAdd?.(c.querySelector('.service-name').value || select.value);
      System.closeWindow(win);
    });
  }

  function makeTestPdf() {
    const stream = 'BT /F1 24 Tf 72 720 Td (Mac OS X Leopard Web) Tj 0 -42 Td /F1 13 Tf (Printer Test Page) Tj 0 -28 Td (Web PDF Printer - A4 - 1 page) Tj ET';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return `data:application/pdf;base64,${btoa(pdf)}`;
  }

  function buildExtraPaneLegacy(id) {
    const c = el('div', 'spp-pane spp-extra-pane');
    const cfg = store(`macweb.pref.${id}`, {});
    const checked = (key, def = false) => (key in cfg ? cfg[key] : def) ? 'checked' : '';
    const range = (key, value, min = 0, max = 100) => `<input type="range" data-key="${key}" min="${min}" max="${max}" value="${key in cfg ? cfg[key] : value}">`;
    const check = (key, label, def = false) => `<label class="spp-check"><input type="checkbox" data-key="${key}" ${checked(key, def)}> ${label}</label>`;
    if (id === 'exposespaces') c.innerHTML = `
      <div class="spp-tabs"><button class="active">Exposé</button><button>Spaces</button></div>
      <div class="spp-pref-card"><h3>${t('prefs.expose.hotCorners')}</h3><div class="hot-corners"><select><option>${t('prefs.msg.cb4d8c526d')}</option></select><select><option>${t('prefs.msg.2938c7f7e5')}</option></select><select><option>${t('prefs.msg.2828b79cbd')}</option></select><select><option>${t('prefs.msg.83d6b9dfca')}</option></select></div></div>
      <div class="spp-pref-card"><h3>Spaces</h3><p>${t('prefs.ui6.1be292340f93')}</p>
      ${check('spacesEnabled',t('prefs.spaces.enable'),true)} ${check('menuSpaces',t('prefs.spaces.showMenu'),true)}
      <button class="aqua-btn show-spaces">${t('prefs.msg.2aae2fd796')}</button></div>`;
    else if (id === 'security') c.innerHTML = `
      <div class="spp-tabs"><button class="active">${t('prefs.msg.aa05fd09a6')}</button><button>FileVault</button><button>${t('prefs.msg.8606f66d0b')}</button></div>
      <div class="spp-pref-card">${check('passwordWake',t('prefs.security.passwordWake'),true)}
      ${check('disableAutoLogin',t('prefs.security.disableAutoLogin'))} ${check('secureVirtualMemory',t('prefs.security.secureVM'),true)}
      <label>${t('prefs.ui8.1223855829bc')}${range('logoutMin',60,5,120)} ${t('prefs.msg.3a17b7352e')}</label></div>
      <div class="spp-pref-card"><h3>FileVault</h3><p>${t('prefs.ui3.37581407b6e0')}</p><button class="aqua-btn">${t('prefs.ui2.1f072ec73b84')}</button></div>`;
    else if (id === 'spotlight') c.innerHTML = `
      <div class="spp-tabs"><button class="active">${t('prefs.spotlight.results')}</button><button>${t('prefs.spotlight.privacy')}</button></div>
      <div class="spp-pref-card spp-category-list">${[t('prefs.msg2.5befd5bba8'),t('prefs.ui3.ea1f6bd3f1c7'),t('prefs.ui2.43f9de7ca886'),t('prefs.ui2.4a7bb21f311a'),t('prefs.ui3.642692d528b0'),t('prefs.msg.183abe8311'),t('prefs.ui2.e0135ad1d444'),t('prefs.ui3.5ff878cb6fac'),t('prefs.ui3.d8019d2781e8'),t('prefs.ui3.5dc26d64b419'),t('prefs.ui3.769de8023094')].map((n,i)=>check(`cat${i}`,n,true)).join('')}</div>
      <p class="spp-hint">${t('prefs.ui6.9db4bdfb3fe9')}</p>`;
    else if (id === 'international') c.innerHTML = `
      <div class="spp-tabs"><button class="active">${t('prefs.ui5.f4b62034e508')}</button><button>${t('prefs.ui5.1c9286dfa460')}</button><button>${t('prefs.ui6.856dfcaddedf')}</button></div>
      <div class="spp-pref-card"><h3>${t('prefs.ui3.403cef9df9c0')}</h3><ol class="language-list"><li>${t('prefs.ui2.84be6aff86af')}</li><li>English</li><li>${t('prefs.ui6.05830e15ecf3')}</li></ol>
      <label>${t('prefs.ui6.c45a78a64195')}<select class="spp-select"><option>${t('prefs.ui5.e251a69cd37a')}</option><option>${t('prefs.ui5.8479fdf4e482')}</option><option>${t('prefs.ui5.26aa97cd4659')}</option><option>${t('prefs.ui5.c1b9e74184d4')}</option></select></label>
      ${check('inputMenu',t('prefs.ui3.1159a029b1b6'),true)}</div>`;
    else if (id === 'keyboard') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="keyboard">${t('prefs.keyboard.tabKeyboard')}</button><button data-tab="mouse">${t('prefs.keyboard.tabMouse')}</button><button data-tab="shortcuts">${t('prefs.keyboard.tabShortcuts')}</button></div>
      <section class="spp-tab-panel keyboard-panel" data-panel="keyboard">
        <div class="keyboard-visual" aria-hidden="true">${Array.from({ length: 55 }, (_, i) => `<i class="${[13,27,41,54].includes(i) ? 'wide' : ''}"></i>`).join('')}</div>
        <div class="spp-pref-card keyboard-settings">
          <label><span>${t('prefs.keyboard.repeat')}</span><small>${t('common.slow')}</small>${range('repeat',70)}<small>${t('common.fast')}</small></label>
          <label><span>${t('prefs.keyboard.delay')}</span><small>${t('common.long')}</small>${range('delay',55)}<small>${t('common.short')}</small></label>
          ${check('fkeys',t('prefs.keyboard.fkeys'))}
          <label>${t('prefs.keyboard.testLabel')}<input class="aqua-input keyboard-test" autocomplete="off"></label>
        </div>
      </section>
      <section class="spp-tab-panel mouse-panel" data-panel="mouse" hidden>
        <div class="mighty-mouse" aria-hidden="true"><i></i><span>●</span></div>
        <div class="mouse-controls">
          <label><span>${t('prefs.keyboard.tracking')}</span><small>${t('common.slow')}</small>${range('tracking',62)}<small>${t('common.fast')}</small></label>
          <label><span>${t('prefs.keyboard.doubleClick')}</span><small>${t('common.slow')}</small>${range('doubleClick',58)}<small>${t('common.fast')}</small></label>
          <label><span>${t('prefs.keyboard.scrolling')}</span><small>${t('common.slow')}</small>${range('scrolling',65)}<small>${t('common.fast')}</small></label>
          <label>${t('prefs.keyboard.primaryBtn')}<select class="spp-select"><option>${t('prefs.msg.d2aff14178')}</option><option>${t('prefs.msg.4d9c32c23d')}</option></select></label>
          ${check('mouseZoom',t('prefs.keyboard.ctrlScrollZoom'))}
        </div>
      </section>
      <section class="spp-tab-panel shortcut-panel" data-panel="shortcuts" hidden>
        <div class="shortcut-layout">
          <aside><button class="sel">${t('prefs.msg.2938c7f7e5')} & ${t('prefs.ui8.0a462765374a')}</button><button>${t('prefs.ui2.08dd3e29aa88')}</button><button>${t('prefs.ui2.462c86176c2f')}</button><button>${t('prefs.ui2.39c082835ffa')}</button><button>Spotlight</button><button>${t('prefs.ui2.1f587027e30a')}</button></aside>
          <main>
            <header><span>${t('prefs.msg.2b6bc0f293')}</span><span>${t('prefs.msg.f7d2996639')}</span></header>
            <label><span><input type="checkbox" checked> ${t('prefs.msg.9546525be6')}</span><kbd>⌃⇧D</kbd></label>
            <label><span><input type="checkbox" checked> ${t('prefs.msg.10323d6230')}</span><kbd>⌃⇧K</kbd></label>
            <label><span><input type="checkbox" checked> ${t('prefs.msg.2aae2fd796')}</span><kbd>⌃⇧S</kbd></label>
            <label><span><input type="checkbox" checked> ${t('prefs.msg.c3f30b0d26')}</span><kbd>Space</kbd></label>
          </main>
        </div>
        <div class="shortcut-footer">
          <label>${t('prefs.keyboard.safeMods')}<select class="spp-select safe-profile"><option value="ctrlShift">${t('prefs.ui2.cf70c7ab07b7')}</option><option value="ctrlAlt">${t('prefs.ui2.897f699409aa')}</option></select></label>
          <button class="aqua-btn keyboard-capture">${t('prefs.keyboard.capture')}</button><button class="aqua-btn keyboard-help">${t('prefs.keyboard.help')}</button>
        </div>
      </section>`;
    else if (id === 'cd') c.innerHTML = `
      <div class="spp-pref-card"><h3>${t('prefs.cd.whenInsert')}</h3>
      ${[t('prefs.cd.blankCD'),t('prefs.cd.blankDVD'),t('prefs.cd.musicCD'),t('prefs.cd.pictureCD'),t('prefs.cd.videoDVD')].map((n)=>`<label>${n}：<select class="spp-select"><option>${t('prefs.cd.ask')}</option><option>${t('prefs.cd.openFinder')}</option><option>${t('prefs.cd.openItunes')}</option><option>${t('prefs.cd.openDvd')}</option><option>${t('prefs.cd.ignore')}</option></select></label>`).join('')}</div>`;
    else if (id === 'printfax') c.innerHTML = `
      <div class="print-fax-pane">
        <aside>
          <header>${t('prefs.ui2.ba3c80d999f5')}</header>
          <div class="printer-sidebar-list"><button class="sel"><i>${printerSvg}</i><span>Web PDF Printer<small>${t('prefs.print.idleDefault')}</small></span></button></div>
          <footer><button class="printer-add" title="${t('prefs.print.add')}">＋</button><button class="printer-remove" title="${t('prefs.print.remove')}">－</button><i></i><button title="${t('prefs.msg.2b6bc0f293')}">⚙</button></footer>
        </aside>
        <main>
          <section class="printer-summary">
            <div class="printer-large">${printerSvg}</div>
            <div><h3>Web PDF Printer</h3><dl><dt>${t('prefs.print.status')}</dt><dd class="ready">${t('prefs.print.idle')}</dd><dt>${t('prefs.print.kind')}</dt><dd>${t('prefs.print.kindVal')}</dd><dt>${t('prefs.net.location')}</dt><dd>${t('prefs.ui6.8f46dc84302f')}</dd></dl></div>
          </section>
          <div class="printer-actions"><button class="aqua-btn default print-open-queue">${t('prefs.print.openQueue')}</button><button class="aqua-btn printer-options">${t('prefs.print.options')}</button></div>
          <label class="spp-check"><input type="checkbox" data-key="sharePrinter" ${checked('sharePrinter')}> ${t('prefs.ui2.7aae2a15cf56')}</label>
        </main>
        <footer class="print-defaults">
          <label>${t('prefs.print.defaultPrinter')}<select class="spp-select"><option>Web PDF Printer</option><option>${t('prefs.print.lastUsed')}</option></select></label>
          <label>${t('prefs.print.paperSize')}<select class="spp-select"><option>A4</option><option>US Letter</option><option>A5</option></select></label>
        </footer>
      </div>`;
    else if (id === 'network') c.innerHTML = `
      <div class="network-pref">
        <header><label>${t('prefs.net.location')}<select class="spp-select"><option>${t('prefs.net.automatic')}</option><option>${t('prefs.net.home')}</option><option>${t('prefs.net.work')}</option><option>${t('prefs.msg.771d371e2a')}</option></select></label></header>
        <aside>
          <div class="network-service-list">
            <button class="sel"><i class="status-dot green"></i><span>${t('prefs.msg.bb6703dbf1')}<small>${t('common.connected')}</small></span></button>
            <button><i class="status-dot red"></i><span>${t('prefs.net.ethernet')}<small>${t('common.disconnected')}</small></span></button>
            <button><i class="status-dot red"></i><span>Bluetooth<small>${t('common.disconnected')}</small></span></button>
            <button><i class="status-dot gray"></i><span>${t('prefs.msg.b332b80702')}<small>${t('common.disconnected')}</small></span></button>
          </div>
          <footer><button>＋</button><button>－</button><i></i><button>⚙</button></footer>
        </aside>
        <main>
          <section class="airport-summary"><div class="airport-rings"><i></i><i></i><i></i></div><div><h3>AirPort <b>${t('common.connected')}</b></h3><p>${t('prefs.net.airportConnected')}</p></div></section>
          <label class="spp-check"><input type="checkbox" data-key="airportOn" ${checked('airportOn',true)}> ${t('prefs.msg.8bbc2bb46d')}</label>
          <label><span>${t('prefs.net.networkName')}</span><select class="spp-select"><option>Leopard Web</option><option>${t('prefs.ui6.3f9f3ae2bb5d')}</option><option>${t('prefs.ui6.84085330871e')}</option></select></label>
          <label class="spp-check"><input type="checkbox" data-key="askNetworks" ${checked('askNetworks',true)}> ${t('prefs.msg.d3e3ff2286')}</label>
          <div class="network-buttons"><button class="aqua-btn network-assist">${t('prefs.net.assist')}</button><button class="aqua-btn network-advanced">${t('common.advanced')}</button></div>
          <p class="network-status"><i></i><span>${t('prefs.print.status')}<b>${t('common.connected')}</b><br>AirPort ${t('prefs.ui8.c9598fe2421f')}</span></p>
        </main>
        <footer class="network-footer"><button class="aqua-btn network-diagnose">${t('prefs.net.diagnose')}</button><i></i><button class="aqua-btn network-revert" disabled>${t('prefs.msg.69de8d7f40')}</button><button class="aqua-btn default network-apply">${t('common.apply')}</button></footer>
      </div>`;
    else if (id === 'bluetooth') c.innerHTML = `
      <div class="bluetooth-pref">
        <header><div class="bt-orb">ᛒ</div><div><h2>Bluetooth</h2><p>${t('prefs.bt.help')}</p></div></header>
        <div class="bluetooth-body">
          <aside>
            <label class="spp-check"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}> ${t('prefs.ui2.5dbd0b56016f')}</label>
            <label class="spp-check"><input type="checkbox" data-key="discoverable" ${checked('discoverable',true)}> ${t('prefs.ui2.c449106091a6')}</label>
            <p>${t('prefs.ui2.370c8b98ce1d')}<br><b>“${t('prefs.ui2.396ce169ad14')}”</b></p>
          </aside>
          <main>
            <h3>${t('prefs.ui2.b66fe4e53991')}：</h3>
            <div class="bluetooth-device-list"></div>
            <div class="bluetooth-device-actions"><button class="aqua-btn bluetooth-remove" disabled>－</button><button class="aqua-btn default bluetooth-setup">${t('prefs.bt.setup')}</button></div>
            <label class="spp-check"><input type="checkbox" checked> ${t('prefs.ui8.ec0a4f43be45')}${t('prefs.ui5.303a2a6da069')}</label>
          </main>
        </div>
        <footer><button class="aqua-btn bluetooth-file">${t('prefs.bt.sendFile')}</button><button class="aqua-btn bluetooth-browse">${t('prefs.bt.browse')}</button><i></i><button class="aqua-btn bluetooth-advanced">${t('common.advanced')}</button></footer>
      </div>`;
    else if (id === 'sharing') c.innerHTML = `
      <div class="spp-split sharing-pane"><aside>${[t('prefs.ui2.efd12e83b9a9'),t('prefs.share.screen'),t('prefs.share.file'),t('prefs.share.printer'),t('prefs.ui2.19fe97c77942'),t('prefs.share.remoteLogin'),t('prefs.ui2.91153101ae14'),t('prefs.ui2.942ecfa15d7c'),t('prefs.ui2.f52a44e1570e')].map((n,i)=>`<label><input type="checkbox" data-key="service${i}" ${checked(`service${i}`)}> ${n}</label>`).join('')}</aside>
      <main><h3>${t('prefs.share.file')}${t('prefs.ui8.e908dc3321e0')}</h3><p>${t('prefs.ui6.e2a2be6d1f1e')}</p><div class="sharing-box">${t('prefs.ui6.b603d14c9d04')}<br><b>${t('prefs.ui2.124061b3c216')}</b></div><label>${t('prefs.share.computerName')}<input class="aqua-input" value=t('prefs.ui2.396ce169ad14')></label></main></div>`;
    else if (id === 'dotmac') c.innerHTML = `
      <div class="dotmac-logo"><b>.Mac</b><span>${t('prefs.ui6.573e8b52a26a')}</span></div>
      <div class="spp-pref-card"><label>${t('prefs.msg.21b9c0e866')}<input class="aqua-input" placeholder="name"></label><label>${t('prefs.msg.9b55a266cc')}<input class="aqua-input" type="password" placeholder="${t('prefs.msg.5185448868')}"></label>
      <button class="aqua-btn">${t('prefs.msg.402d19e50f')}</button><p class="spp-hint">${t('prefs.ui6.44173a24b8ec')}</p></div>`;
    else if (id === 'parental') c.innerHTML = `
      <div class="spp-split"><aside><button class="sel"><i class="spp-avatar">R</i> roll</button></aside><main><h3>${t('prefs.ui6.92be3c3e5c8e')}</h3>
      ${check('simpleFinder',t('prefs.parental.simpleFinder'))} ${check('limitApps',t('prefs.ui4.8fd92cebd73d'))} ${check('limitWeb',t('prefs.parental.limitWeb'))}
      <label>${t('prefs.ui2.1d4e24d85ab4')}<select class="spp-select"><option>${t('prefs.msg.bc436447f5')}</option><option>1 ${t('prefs.msg.2de0d491d0')}</option><option>2 ${t('prefs.msg.2de0d491d0')}</option></select></label>
      <label>${t('prefs.msg.1eb2b676b7')}<input type="time" value="22:00">${t('prefs.ui8.29a5c271546a')}<input type="time" value="07:00"></label></main></div>`;
    else if (id === 'speech') c.innerHTML = `
      <div class="spp-tabs"><button class="active">${t('prefs.speech.tts')}</button><button>${t('prefs.speech.recognition')}</button></div>
      <div class="spp-pref-card"><label>${t('prefs.speech.systemVoice')}<select class="spp-select speech-voice"></select></label>
      <label>${t('prefs.speech.rate')}${range('rate',50)}</label><textarea class="aqua-input speech-text">${t('prefs.speech.sample')}</textarea>
      <button class="aqua-btn speech-play">${t('prefs.speech.play')}</button> ${check('announceAlerts',t('prefs.speech.announceAlerts'))}</div>`;
    else if (id === 'startup') c.innerHTML = `
      <div class="startup-disks"><button class="sel">${ICONS.hd}<b>Mac OS X, 10.5</b><span>Macintosh HD</span></button><button>${ICONS.folder}<b>Network Startup</b><span>${t('prefs.startup.network')}</span></button></div>
      <p>${t('prefs.startup.help')}</p><button class="aqua-btn">${t('prefs.startup.target')}</button><button class="aqua-btn default restart-pref">${t('prefs.msg.d48e760864')}</button>`;
    else if (id === 'timemachine') c.innerHTML = `
      <div class="tm-pref"><div>${Leopard.glyph('timemachine',120)}</div><section><h3>Time Machine</h3><label class="tm-switch"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}><i></i><span>${t('prefs.msg.8493205602')}</span></label>
      <p>${t('prefs.tm.oldest')}<br>${t('prefs.tm.latest', { time: new Date().toLocaleTimeString(getLocale()==='zh-CN'?'zh-CN':'en-US') })}${new Date().toLocaleTimeString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}<br>${t('prefs.tm.next')}</p>
      ${check('menu',t('prefs.tm.showMenu'),true)}
      <button class="aqua-btn tm-backup">${t('prefs.tm.backupNow')}</button><button class="aqua-btn tm-enter">${t('prefs.tm.enter')}</button></section></div>`;
    else if (id === 'universal') c.innerHTML = `
      <div class="spp-tabs"><button class="active">${t('prefs.ua.seeing')}</button><button>${t('prefs.ui6.55ba188d4cde')}</button><button>${t('prefs.ui2.a6b63de04239')}</button><button>${t('prefs.ui2.aef4cec52308')}</button></div>
      <div class="spp-pref-card">${check('voiceOver',t('prefs.ua.voiceOver'))} ${check('zoom',t('prefs.ua.zoom'))}
      <label>${t('prefs.ui8.96a244ba2b40')}${range('contrast',0,0,80)}</label>${check('flashScreen',t('prefs.ua.flash'))}
      ${check('stickyKeys',t('prefs.ua.sticky'))} ${check('mouseKeys',t('prefs.ua.mouseKeys'))}</div>`;
    else c.innerHTML = `<p>${t('prefs.loaded')}</p>`;

    c.querySelectorAll('[data-key]').forEach((control) => {
      const update = () => {
        cfg[control.dataset.key] = control.type === 'checkbox' ? control.checked : +control.value;
        save(`macweb.pref.${id}`, cfg);
        if (id === 'universal' && control.dataset.key === 'contrast') {
          document.documentElement.style.filter = +control.value ? `contrast(${1 + +control.value / 100})` : '';
        }
      };
      control.addEventListener(control.type === 'range' ? 'input' : 'change', update);
    });
    bindTabs(c);
    c.querySelector('.show-spaces')?.addEventListener('click', Leopard.showSpaces);
    const safeProfile = c.querySelector('.safe-profile');
    if (safeProfile) {
      safeProfile.value = Leopard.settings().safeProfile || 'ctrlShift';
      safeProfile.addEventListener('change', () => Leopard.saveSettings({ safeProfile: safeProfile.value }));
    }
    c.querySelector('.keyboard-capture')?.addEventListener('click', () => Leopard.setKeyboardCapture(!Leopard.captured));
    c.querySelector('.keyboard-help')?.addEventListener('click', Leopard.showShortcutHelp);
    c.querySelector('.network-diagnose')?.addEventListener('click', () => System.launch('netutil'));
    c.querySelector('.network-assist')?.addEventListener('click', () => System.launch('netutil'));
    c.querySelector('.network-advanced')?.addEventListener('click', () => openNetworkAdvanced(cfg));
    c.querySelector('.network-apply')?.addEventListener('click', () => Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.ui2.3c4abeb0fe3c')));
    c.querySelector('.print-open-queue')?.addEventListener('click', openPrintQueue);
    c.querySelector('.printer-add')?.addEventListener('click', openPrinterBrowser);
    c.querySelector('.printer-options')?.addEventListener('click', () => System.alertBox(t('prefs.ui2.4464034e75d4'), t('prefs.print.optionsBody')));
    const bluetoothList = c.querySelector('.bluetooth-device-list');
    const appendBluetoothDevice = (name, connected = false) => {
      if (!bluetoothList || Array.from(bluetoothList.querySelectorAll('.device-row span')).some((span) => span.textContent === name)) return;
      const device = el('button', 'device-row');
      device.innerHTML = '<i>ᛒ</i><span></span><b></b>';
      device.querySelector('span').textContent = name;
      device.querySelector('b').textContent = connected ? t('prefs.msg.51b5912f68') : t('common.disconnected');
      device.addEventListener('click', () => {
        bluetoothList.querySelectorAll('.device-row').forEach((item) => item.classList.toggle('sel', item === device));
        c.querySelector('.bluetooth-remove').disabled = false;
      });
      bluetoothList.appendChild(device);
    };
    if (bluetoothList) {
      const connectedDevices = new Set(cfg.connectedDevices || []);
      appendBluetoothDevice('Apple Wireless Keyboard', connectedDevices.has('Apple Wireless Keyboard'));
      appendBluetoothDevice('Mighty Mouse', connectedDevices.has('Mighty Mouse'));
      (cfg.devices || []).forEach((name) => appendBluetoothDevice(name, connectedDevices.has(name)));
    }
    c.querySelector('.bluetooth-setup')?.addEventListener('click', () => openBluetoothAssistant(cfg, (name) => appendBluetoothDevice(name, true)));
    c.querySelector('.bluetooth-remove')?.addEventListener('click', () => {
      const selected = bluetoothList?.querySelector('.device-row.sel');
      if (!selected) return;
      cfg.devices = (cfg.devices || []).filter((name) => name !== selected.querySelector('span').textContent);
      save('macweb.pref.bluetooth', cfg);
      selected.remove();
      c.querySelector('.bluetooth-remove').disabled = true;
    });
    c.querySelector('.bluetooth-file')?.addEventListener('click', () => System.alertBox(t('prefs.msg.1c4986f495'), `${t('prefs.ui8.f30aa6edc153')}${t('prefs.bt.setup')}${t('prefs.ui8.edd96ae0402b')}`));
    c.querySelector('.bluetooth-browse')?.addEventListener('click', () => System.alertBox(t('prefs.ui4.b07c37c859d8'), `${t('prefs.ui8.133f4eaafe3e')}${t('prefs.ui2.b66fe4e53991')}。`));
    c.querySelector('.bluetooth-advanced')?.addEventListener('click', () => System.alertBox(t('prefs.msg.52d3e8687c'), t('prefs.ui4.c807acf0c678')));
    c.querySelector('.restart-pref')?.addEventListener('click', () => System.shutdownSequence(true));
    c.querySelector('.tm-backup')?.addEventListener('click', () => {
      Leopard.saveSnapshot('prefs.ui2.ccbec984d608'); Leopard.toast('Time Machine', t('prefs.ui2.6703fd77b535'));
    });
    c.querySelector('.tm-enter')?.addEventListener('click', Leopard.openTimeMachine);
    if (id === 'speech' && 'speechSynthesis' in window) {
      const select = c.querySelector('.speech-voice');
      const fillVoices = () => {
        const voices = speechSynthesis.getVoices();
        select.innerHTML = voices.map((v, i) => `<option value="${i}">${html(v.name)} — ${html(v.lang)}</option>`).join('') || `<option>${t('prefs.msg.6bfeac3dc6')}</option>`;
      };
      fillVoices(); speechSynthesis.addEventListener?.('voiceschanged', fillVoices, { once: true });
      c.querySelector('.speech-play').addEventListener('click', () => {
        const u = new SpeechSynthesisUtterance(c.querySelector('.speech-text').value);
        const voices = speechSynthesis.getVoices(); u.voice = voices[+select.value] || null;
        u.rate = .5 + +(cfg.rate || 50) / 50; speechSynthesis.cancel(); speechSynthesis.speak(u);
      });
    }
    return c;
  }

  function openVoiceOverUtility() {
    if (voiceOverUtilityWin?.isConnected) {
      System.focusWindow(voiceOverUtilityWin);
      return;
    }
    const cfg = store('macweb.voiceover.utility', {
      welcome: true, modifier: 'Control-Option', verbosity: t('prefs.ui2.73873272e6dd'), punctuation: t('prefs.ui2.e1ccfc4b9962'),
      rate: 52, pitch: 48, volume: 70, intonation: 55, mouseTracking: true,
      keyboardFocus: true, webSummary: true, audioDucking: true, soundCues: true,
      captionPanel: false, cursorRing: true, brailleStatus: t('prefs.msg.aa05fd09a6'),
    });
    const content = el('div', 'voiceover-utility');
    const categories = [
      ['general', t('prefs.msg.aa05fd09a6'), '◉'], ['verbosity', t('prefs.ui2.6729b8d0ff73'), '≡'], ['speech', t('prefs.ui2.ae9b10e11a3a'), '◖'],
      ['navigation', t('prefs.ui2.cb3abfaaff1d'), '⌖'], ['web', 'Web', '◎'], ['sound', t('prefs.ui2.d0541736ec0b'), '♪'],
      ['visuals', t('prefs.ui2.895f75f4c2c3'), '◐'], ['braille', 'Braille', '⠿'],
    ];
    content.innerHTML = `
      <aside><header><span class="vo-badge">VO</span><b>VoiceOver ${t('prefs.msg.f8dae63e1c')}</b></header>
        <nav>${categories.map(([key, name, glyph], index) => `<button data-vo-category="${key}" class="${index === 0 ? 'sel' : ''}"><i>${glyph}</i><span>${name}</span></button>`).join('')}</nav>
      </aside>
      <main><header><h2></h2><p></p></header><section class="voiceover-settings"></section><footer><button class="aqua-btn vo-help">${t('prefs.ui2.f9594800aba9')}</button><i></i><button class="aqua-btn vo-reset">${t('prefs.ui6.ebc05530190f')}</button></footer></main>`;
    const checked = (key) => cfg[key] ? 'checked' : '';
    const panelFor = (key) => {
      const panels = {
        general: [t('prefs.msg.aa05fd09a6'), t('prefs.ui4.bbda6c40093b'), `
          <fieldset><legend>${t('prefs.msg.8e54ddfe24')}</legend><label class="spp-check"><input type="checkbox" data-vo-key="welcome" ${checked('welcome')}> ${t('prefs.ui8.94f334be298e')}</label><label class="spp-check"><input type="checkbox" data-vo-key="portable"> ${t('prefs.ui6.ed2d6989de78')}</label></fieldset>
          <label class="vo-row"><span>${t('prefs.ui4.579c893badd8')}</span><select class="spp-select" data-vo-key="modifier"><option>Control-Option</option><option>Caps Lock</option></select></label>
          <p class="spp-hint">${t('prefs.ua.voHelpHint')}</p>`],
        verbosity: [t('prefs.ui2.6729b8d0ff73'), t('prefs.ui4.027a658e1e75'), `
          <label class="vo-row"><span>${t('prefs.ui4.fe06fc3d9744')}</span><select class="spp-select" data-vo-key="verbosity"><option>${t('prefs.msg.c3148eaa94')}</option><option>${t('prefs.ui2.73873272e6dd')}</option><option>${t('prefs.msg.e61f7776bf')}</option><option>${t('prefs.msg.1accb3bb23')}</option></select></label>
          <label class="vo-row"><span>${t('prefs.ui4.45c1369de68d')}</span><select class="spp-select" data-vo-key="punctuation"><option>${t('prefs.msg.baafe899de')}</option><option>${t('prefs.ui2.e1ccfc4b9962')}</option><option>${t('prefs.ui4.d1c7c949b72b')}</option></select></label>
          <fieldset><legend>${t('prefs.ui6.6497e2423f2f')}</legend><label class="spp-check"><input type="checkbox" data-vo-key="statusChanges" checked> ${t('prefs.ui4.ea48f14019d3')}</label><label class="spp-check"><input type="checkbox" data-vo-key="helpTags" checked> ${t('prefs.ui4.6f3d43218c57')}</label><label class="spp-check"><input type="checkbox" data-vo-key="repeatedText"> ${t('prefs.ui6.d57eb058d89b')}</label></fieldset>`],
        speech: [t('prefs.ui2.ae9b10e11a3a'), t('prefs.ui4.57231548ae91'), `
          <label class="vo-row"><span>${t('prefs.ui5.526348f1411b')}</span><select class="spp-select voiceover-voice"><option>${t('prefs.msg.6bfeac3dc6')}</option></select></label>
          <label class="vo-slider"><span>${t('prefs.ui6.333dff64bf5b')}</span><b>${t('prefs.msg.e0b665f23b')}</b><input type="range" data-vo-key="rate" min="0" max="100" value="${cfg.rate}"><b>${t('prefs.msg.8fcedbfdde')}</b></label>
          <label class="vo-slider"><span>${t('prefs.ui6.2a11c3763e39')}</span><b>${t('prefs.msg.c3148eaa94')}</b><input type="range" data-vo-key="pitch" min="0" max="100" value="${cfg.pitch}"><b>${t('prefs.msg.e61f7776bf')}</b></label>
          <label class="vo-slider"><span>${t('prefs.ui6.05542aca9e21')}</span><b>${t('prefs.msg.13e75c5f44')}</b><input type="range" data-vo-key="volume" min="0" max="100" value="${cfg.volume}"><b>${t('prefs.msg.2388856042')}</b></label>
          <label class="vo-slider"><span>${t('prefs.ui5.1f9093101f80')}</span><b>${t('prefs.ui5.1125c006b1cc')}</b><input type="range" data-vo-key="intonation" min="0" max="100" value="${cfg.intonation}"><b>${t('prefs.ui6.defc7cfc9158')}</b></label>
          <button class="aqua-btn default voiceover-sample">${t('prefs.speech.play')}${t('prefs.ui8.17e8ff9b2b60')}</button>`],
        navigation: [t('prefs.ui2.cb3abfaaff1d'), t('prefs.ui5.b6690ad1422b'), `
          <fieldset><legend>${t('prefs.ui8.9ff9d0573731')}</legend><label class="spp-check"><input type="checkbox" data-vo-key="keyboardFocus" ${checked('keyboardFocus')}> ${t('prefs.ui6.a8da0f1447a8')}</label><label class="spp-check"><input type="checkbox" data-vo-key="mouseTracking" ${checked('mouseTracking')}> ${t('prefs.ui7.1be247b8b709')}</label></fieldset>
          <label class="vo-row"><span>${t('prefs.ui8.a7425a24a29f')}${t('prefs.net.location')}</span><select class="spp-select"><option>${t('prefs.ui7.13051cc86f76')}</option><option>${t('prefs.ui7.3a090a4d547b')}</option><option>${t('prefs.ui7.f1735d704706')}</option></select></label>
          <label class="vo-row"><span>${t('prefs.ui5.7df474832679')}</span><select class="spp-select"><option>${t('prefs.ui2.73873272e6dd')}</option><option>${t('prefs.ui7.881298710137')}</option><option>${t('prefs.ua.speakGroup')}</option></select></label>`],
        web: ['Web', t('prefs.ui5.d6dd2444f02d'), `
          <label class="spp-check"><input type="checkbox" data-vo-key="webSummary" ${checked('webSummary')}> ${t('prefs.ui7.09d6d9e2a743')}</label><label class="spp-check"><input type="checkbox" data-vo-key="webTables" checked> ${t('prefs.ui7.44a33462ff69')}</label>
          <fieldset><legend>${t('prefs.ui7.73e1302c8422')}</legend>${[t('prefs.ui5.60a375c2ba1b'),t('prefs.ui5.c9ba4e98308e'),t('prefs.ui5.fc95fcd4bff5'),t('prefs.ui5.8bae7140ecb7'),t('prefs.ui5.be38cd71a841'),t('prefs.ui5.fdbda7d590a3')].map((name) => `<label class="spp-check"><input type="checkbox" checked> ${name}</label>`).join('')}</fieldset>
          <label class="vo-row"><span>${t('prefs.ui5.f1f4bd997b1b')}</span><select class="spp-select"><option>${t('prefs.ui7.665b4587e4ee')}</option><option>${t('prefs.ui7.0e754eaadbbf')}</option></select></label>`],
        sound: [t('prefs.ui2.d0541736ec0b'), t('prefs.ui5.f5c039ad7f3a'), `
          <label class="spp-check"><input type="checkbox" data-vo-key="soundCues" ${checked('soundCues')}> ${t('prefs.ui2.4b4e7a485390')}${t('prefs.ui8.b574b485acac')}</label><label class="spp-check"><input type="checkbox" data-vo-key="audioDucking" ${checked('audioDucking')}> ${t('prefs.ui7.07ed4bb9683c')}</label><label class="spp-check"><input type="checkbox" data-vo-key="positionalAudio"> ${t('prefs.ui7.a6dcecf04c80')}</label>
          <label class="vo-slider"><span>${t('prefs.ui8.c3df5abb42e6')}${t('prefs.ui6.05542aca9e21')}</span><b>${t('prefs.msg.13e75c5f44')}</b><input type="range" min="0" max="100" value="65"><b>${t('prefs.msg.2388856042')}</b></label><button class="aqua-btn vo-sound-test">${t('prefs.ua.playEffects')}</button>`],
        visuals: [t('prefs.ui2.895f75f4c2c3'), t('prefs.ui5.c3eec2bbde28'), `
          <fieldset><legend>${t('prefs.ui7.2f69067bee51')}</legend><label class="spp-check"><input type="checkbox" data-vo-key="captionPanel" ${checked('captionPanel')}> ${t('prefs.ui7.d82d771dc5bc')}</label><label class="spp-check"><input type="checkbox" data-vo-key="braillePanel"> ${t('prefs.ui7.c8208661edd5')}</label></fieldset>
          <label class="spp-check"><input type="checkbox" data-vo-key="cursorRing" ${checked('cursorRing')}> ${t('prefs.ui7.a8badb67d5ca')}</label><label class="vo-slider"><span>${t('prefs.ui7.4f57f8c34dba')}</span><b>${t('prefs.msg.13e75c5f44')}</b><input type="range" min="0" max="100" value="38"><b>${t('prefs.msg.2388856042')}</b></label>
          <div class="voiceover-cursor-preview"><i></i><span>${t('prefs.ui8.fac3837ae7d2')}</span></div>`],
        braille: ['Braille', t('prefs.ui5.c9a3e0e773b8'), `
          <p class="voiceover-device-state"><i></i><span><b>${t('common.disconnected')} Braille ${t('prefs.ui2.08dd3e29aa88')}</b><small>${t('prefs.ua.brailleHint')}</small></span></p>
          <label class="vo-row"><span>${t('prefs.ui5.ad940e20ba1c')}</span><select class="spp-select"><option>${t('prefs.ui7.603035afd1c4')}</option><option>${t('prefs.ui7.1fc8a226d3de')}</option><option>${t('prefs.ui7.4fd1f4c5a707')}</option></select></label>
          <label class="vo-row"><span>${t('prefs.ui5.77fe7bffee50')}</span><select class="spp-select" data-vo-key="brailleStatus"><option>${t('prefs.msg.aa05fd09a6')}</option><option>${t('prefs.ui6.fc695b390d76')}</option><option>${t('prefs.ui7.bb22b144e3ae')}</option></select></label>
          <label class="spp-check"><input type="checkbox" checked> ${t('prefs.ui8.fd966b6a8995')}${t('prefs.ui2.08dd3e29aa88')}</label>`],
      };
      return panels[key] || panels.general;
    };
    const paint = (key) => {
      const [title, copy, html] = panelFor(key);
      content.querySelector('main>header h2').textContent = title;
      content.querySelector('main>header p').textContent = copy;
      const settings = content.querySelector('.voiceover-settings');
      settings.innerHTML = html;
      settings.querySelectorAll('[data-vo-key]').forEach((control) => {
        const keyName = control.dataset.voKey;
        if (control.tagName === 'SELECT' && cfg[keyName] != null) control.value = cfg[keyName];
        const update = () => {
          cfg[keyName] = control.type === 'checkbox' ? control.checked : control.type === 'range' ? +control.value : control.value;
          save('macweb.voiceover.utility', cfg);
        };
        control.addEventListener(control.type === 'range' ? 'input' : 'change', update);
      });
      const voiceSelect = settings.querySelector('.voiceover-voice');
      if (voiceSelect && 'speechSynthesis' in window) {
        const fill = () => {
          const voices = speechSynthesis.getVoices();
          voiceSelect.innerHTML = `<option value="">${t('prefs.msg.6bfeac3dc6')}</option>` + voices.map((voice, index) => `<option value="${index}">${html(voice.name)} — ${html(voice.lang)}</option>`).join('');
        };
        fill();
        speechSynthesis.addEventListener?.('voiceschanged', fill, { once: true });
      }
      settings.querySelector('.voiceover-sample')?.addEventListener('click', () => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(t('prefs.ui5.b29a71fed467'));
        const selectedVoice = settings.querySelector('.voiceover-voice');
        utterance.voice = speechSynthesis.getVoices()[+selectedVoice?.value] || null;
        utterance.rate = .45 + cfg.rate / 70;
        utterance.pitch = .55 + cfg.pitch / 110;
        utterance.volume = Math.max(.05, cfg.volume / 100);
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      });
      settings.querySelector('.vo-sound-test')?.addEventListener('click', () => System.beep('tink', .55));
    };
    content.querySelectorAll('[data-vo-category]').forEach((button) => button.addEventListener('click', () => {
      content.querySelectorAll('[data-vo-category]').forEach((item) => item.classList.toggle('sel', item === button));
      paint(button.dataset.voCategory);
    }));
    content.querySelector('.vo-help').addEventListener('click', () => System.alertBox(t('prefs.ui5.bd353adac3de'), t('prefs.ui5.d2683fecd19e')));
    content.querySelector('.vo-reset').addEventListener('click', () => {
      localStorage.removeItem('macweb.voiceover.utility');
      System.alertBox(t('prefs.ui2.ad74de98dbba'), t('prefs.ui5.699e1b3fefbb'));
    });
    paint('general');
    voiceOverUtilityWin = System.createWindow({
      app: 'sysprefs', title: t('prefs.ui2.ad74de98dbba'), width: 760, height: 520,
      content, bodyBg: '#ececec', onClose: () => { voiceOverUtilityWin = null; },
    });
  }

  function openUniversalOptions(prefCfg) {
    if (universalOptionsWin?.isConnected) {
      System.focusWindow(universalOptionsWin);
      return;
    }
    const cfg = store('macweb.universal.options', {
      zoomFollowFocus: true, zoomSmooth: true, cursorSize: 22,
      voiceOverCursor: true, keyboardFocus: true, announceNotifications: true,
    });
    const content = el('div', 'universal-options');
    const checked = (key) => cfg[key] ? 'checked' : '';
    content.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="zoom">${t('prefs.ui5.8ecfb624ca5b')}</button><button data-tab="voiceover">VoiceOver</button><button data-tab="display">${t('prefs.ui2.08dd3e29aa88')}</button></div>
      <section class="spp-tab-panel" data-panel="zoom"><h3>${t('prefs.ui5.4eea23f527ff')}</h3><label class="spp-check"><input type="checkbox" data-option-key="zoomFollowFocus" ${checked('zoomFollowFocus')}> ${t('prefs.ui7.4e885195bce2')}</label><label class="spp-check"><input type="checkbox" data-option-key="zoomSmooth" ${checked('zoomSmooth')}> ${t('prefs.ui7.e066b30cceb5')}</label><label class="vo-row"><span>${t('prefs.ui5.eba5587f521f')}</span><select class="spp-select"><option>${t('prefs.ui5.5350c59f018f')}</option><option>${t('prefs.ui5.02c4b3ab4245')}</option></select></label><label class="vo-slider"><span>${t('prefs.ui5.0a5651148986')}</span><b>2×</b><input type="range" min="2" max="20" value="8"><b>20×</b></label></section>
      <section class="spp-tab-panel" data-panel="voiceover" hidden><h3>${t('prefs.ui5.3c624c38ab96')}</h3><label class="spp-check"><input type="checkbox" data-option-key="voiceOverCursor" ${checked('voiceOverCursor')}> ${t('prefs.ui7.2e9925893b24')}</label><label class="spp-check"><input type="checkbox" data-option-key="keyboardFocus" ${checked('keyboardFocus')}> ${t('prefs.ui7.588d7f5bf4a4')}</label><label class="spp-check"><input type="checkbox" data-option-key="announceNotifications" ${checked('announceNotifications')}> ${t('prefs.ui7.b7134fac82a9')}</label><button class="aqua-btn options-open-utility">${t('prefs.ua.openVO')}</button></section>
      <section class="spp-tab-panel" data-panel="display" hidden><h3>${t('prefs.ui5.7e6172694db4')}</h3><label class="vo-slider"><span>${t('prefs.ui8.96c4507e0620')}${t('prefs.ui6.0f1d56aed8e2')}</span><b>${t('prefs.msg.13e75c5f44')}</b><input type="range" data-option-key="cursorSize" min="16" max="48" value="${cfg.cursorSize}"><b>${t('prefs.msg.2388856042')}</b></label><div class="cursor-size-preview">↖</div><label class="spp-check"><input type="checkbox"> ${t('prefs.ui5.2b54602f1013')}</label><label class="spp-check"><input type="checkbox"> ${t('prefs.ui7.9515d437d5b3')}</label></section>
      <footer><button class="aqua-btn universal-options-help">${t('prefs.ui2.f9594800aba9')}</button><i></i><button class="aqua-btn default universal-options-done">${t('common.done')}</button></footer>`;
    bindTabs(content);
    content.querySelectorAll('[data-option-key]').forEach((control) => {
      const update = () => {
        cfg[control.dataset.optionKey] = control.type === 'checkbox' ? control.checked : +control.value;
        save('macweb.universal.options', cfg);
        if (control.dataset.optionKey === 'cursorSize') content.querySelector('.cursor-size-preview').style.fontSize = `${control.value}px`;
      };
      control.addEventListener(control.type === 'range' ? 'input' : 'change', update);
    });
    content.querySelector('.cursor-size-preview').style.fontSize = `${cfg.cursorSize}px`;
    content.querySelector('.options-open-utility').addEventListener('click', openVoiceOverUtility);
    content.querySelector('.universal-options-help').addEventListener('click', () => System.alertBox(t('prefs.ui2.484f617c6817'), t('prefs.ui5.936c96e70eb8')));
    content.querySelector('.universal-options-done').addEventListener('click', () => System.closeWindow(universalOptionsWin));
    universalOptionsWin = System.createWindow({
      app: 'sysprefs', title: t('prefs.ui2.484f617c6817'), width: 560, height: 430,
      content, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:330, maxHeight:500 },
      onClose:() => { universalOptionsWin = null; },
    });
    if (prefCfg.voiceOver) content.querySelector('[data-panel="voiceover"] .spp-check input').checked = true;
  }

  function buildExtraPane(id) {
    const c = el('div', `spp-pane spp-extra-pane ${id}-pane`);
    const cfg = store(`macweb.pref.${id}`, {});
    const checked = (key, def = false) => (key in cfg ? cfg[key] : def) ? 'checked' : '';
    const range = (key, value, min = 0, max = 100) => `<input type="range" data-key="${key}" min="${min}" max="${max}" value="${key in cfg ? cfg[key] : value}">`;
    const check = (key, label, def = false) => `<label class="spp-check"><input type="checkbox" data-key="${key}" ${checked(key, def)}> ${label}</label>`;
    const keyboardRows = [
      [['Escape','esc','esc'],['F1','f1','F1'],['F2','f2','F2'],['F3','f3','F3'],['F4','f4','F4'],['F5','f5','F5'],['F6','f6','F6'],['F7','f7','F7'],['F8','f8','F8'],['F9','f9','F9'],['F10','f10','F10'],['F11','f11','F11'],['F12','f12','F12']],
      [['Backquote','`','`'],['Digit1','1','1'],['Digit2','2','2'],['Digit3','3','3'],['Digit4','4','4'],['Digit5','5','5'],['Digit6','6','6'],['Digit7','7','7'],['Digit8','8','8'],['Digit9','9','9'],['Digit0','0','0'],['Minus','-','-'],['Equal','=','＝'],['Backspace','delete','delete']],
      [['Tab','tab','tab'],['KeyQ','q','Q'],['KeyW','w','W'],['KeyE','e','E'],['KeyR','r','R'],['KeyT','t','T'],['KeyY','y','Y'],['KeyU','u','U'],['KeyI','i','I'],['KeyO','o','O'],['KeyP','p','P'],['BracketLeft','[','['],['BracketRight',']',']'],['Backslash','\\','\\']],
      [['CapsLock','caps','caps lock'],['KeyA','a','A'],['KeyS','s','S'],['KeyD','d','D'],['KeyF','f','F'],['KeyG','g','G'],['KeyH','h','H'],['KeyJ','j','J'],['KeyK','k','K'],['KeyL','l','L'],['Semicolon',';',';'],['Quote',"'",'\''],['Enter','return','return']],
      [['ShiftLeft','shift','shift'],['KeyZ','z','Z'],['KeyX','x','X'],['KeyC','c','C'],['KeyV','v','V'],['KeyB','b','B'],['KeyN','n','N'],['KeyM','m','M'],['Comma',',',','],['Period','.','.'],['Slash','/','/'],['ShiftRight','shift','shift']],
      [['ControlLeft','control','control'],['AltLeft','option','⌥ option'],['MetaLeft','command','⌘ command'],['Space','space',''],['MetaRight','command','⌘'],['AltRight','option','⌥'],['ArrowLeft','arrow','◀'],['ArrowUp','arrow','▲'],['ArrowDown','arrow','▼'],['ArrowRight','arrow','▶']],
    ];
    const keyboardMarkup = keyboardRows.map((row) => `<div>${row.map(([code, cls, label]) => `<i data-code="${code}" class="${cls}">${label}</i>`).join('')}</div>`).join('');

    if (id === 'exposespaces') c.innerHTML = `<span hidden>${t('prefs.pane.exposespaces')}</span>
      <div class="spp-tabs"><button class="active" data-tab="expose">Exposé</button><button data-tab="spaces">Spaces</button></div>
      <section class="spp-tab-panel expose-panel" data-panel="expose">
        <div class="monitor-preview"><div class="hot-corner tl">↖</div><div class="hot-corner tr">↗</div><div class="hot-corner bl">↙</div><div class="hot-corner br">↘</div><span>Mac OS X</span></div>
        <div class="spp-pref-card"><h3>${t('prefs.expose.hotCorners')}</h3><div class="hot-corners">
          ${[t('prefs.desktop.corner.tl'),t('prefs.desktop.corner.tr'),t('prefs.desktop.corner.bl'),t('prefs.desktop.corner.br')].map((name, index) => `<label>${name}<select class="spp-select"><option>${[t('prefs.desktop.action.allWindows'),t('prefs.msg.2938c7f7e5'),t('prefs.desktop.action.desktop'),t('prefs.desktop.action.screensaver')][index]}</option><option>${t('prefs.desktop.action.allWindows')}</option><option>${t('prefs.desktop.action.appWindows')}</option><option>${t('prefs.desktop.action.desktop')}</option><option>${t('prefs.msg.2938c7f7e5')}</option><option>${t('prefs.desktop.action.screensaver')}</option><option>${t('prefs.desktop.action.disableSaver')}</option><option>${t('prefs.desktop.action.none')}</option></select></label>`).join('')}
        </div></div>
        <div class="expose-shortcuts"><label>${t('prefs.expose.allWindows')}<select class="spp-select"><option>F9</option><option>F3</option><option>—</option></select></label><label>${t('prefs.expose.appWindows')}<select class="spp-select"><option>F10</option><option>F4</option></select></label><label>${t('prefs.expose.desktop')}<select class="spp-select"><option>F11</option><option>⌘F3</option></select></label></div>
      </section>
      <section class="spp-tab-panel spaces-panel" data-panel="spaces" hidden>
        ${check('spacesEnabled',t('prefs.spaces.enable'),true)}
        <div class="spaces-setup"><div><h3>${t('prefs.spaces.title')}</h3><div class="spaces-pref-grid">${[1,2,3,4].map((n) => `<button data-space="${n}" class="${n === 1 ? 'sel' : ''}"><b>${n}</b><span>${n === 1 ? 'Finder' : n === 2 ? 'Safari' : ''}</span></button>`).join('')}</div><div class="spaces-dimensions"><button class="aqua-btn spaces-minus">－</button><span>${t('prefs.spaces.grid')}</span><button class="aqua-btn spaces-plus">＋</button></div></div>
        <aside><h3>${t('prefs.spaces.assign')}</h3><div class="spaces-app-list"><p>Finder <b>${t('prefs.spaces.allSpaces')}</b></p><p>Safari <b>Space 2</b></p></div><div class="table-controls"><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></div></aside></div>
        ${check('menuSpaces',t('prefs.spaces.showMenu'),true)}
        <label>${t('prefs.spaces.switch')}<select class="spp-select"><option>${t('prefs.spaces.ctrlArrows')}</option><option>${t('prefs.spaces.optArrows')}</option><option>${t('prefs.spaces.cmdArrows')}</option></select></label>
        <button class="aqua-btn default show-spaces">${t('prefs.spaces.showSpaces')}</button>
      </section>`;
    else if (id === 'security') c.innerHTML = `<span hidden>${t('prefs.pane.security')}</span>
      <div class="spp-tabs"><button class="active" data-tab="general">${t('common.general')}</button><button data-tab="filevault">FileVault</button><button data-tab="firewall">${t('prefs.security.firewall')}</button></div>
      <section class="spp-tab-panel security-general" data-panel="general">
        <div class="security-banner"><div class="security-lock"><i></i></div><p><b>${t('prefs.security.banner')}</b><br>${t('prefs.security.bannerHelp')}</p></div>
        <div class="spp-pref-card">${check('passwordWake',t('prefs.security.passwordWake'),true)}
          <label class="security-inline">${t('prefs.security.afterSleep')} <select class="spp-select"><option>${t('prefs.security.immediately')}</option><option>${t('prefs.security.sec5')}</option><option>${t('prefs.security.min1')}</option><option>${t('prefs.security.min5')}</option></select> ${t('prefs.security.requirePw')}</label>
          ${check('disableAutoLogin',t('prefs.security.disableAutoLogin'))} ${check('secureVirtualMemory',t('prefs.security.secureVM'),true)}
          <label>${t('prefs.security.logOutAfter')} <select class="spp-select"><option>${t('prefs.security.min30')}</option><option>${t('prefs.security.min60')}</option><option>${t('prefs.security.hr2')}</option></select> ${t('prefs.security.ofInactivity')}</label></div>
      </section>
      <section class="spp-tab-panel filevault-panel" data-panel="filevault" hidden>
        <div class="filevault-hero"><div class="filevault-lock"><i></i></div><div><h2>${t('prefs.security.fvTitle')}</h2><p>${t('prefs.security.fvHelp')}</p><b class="filevault-status">${cfg.fileVault ? t('prefs.security.fvOn') : t('prefs.security.fvOff')}</b></div></div>
        <div class="spp-pref-card"><p>${t('prefs.security.fvNote')}</p><button class="aqua-btn default filevault-toggle">${cfg.fileVault ? t('prefs.security.fvTurnOff') : t('prefs.security.fvTurnOn')}</button></div>
      </section>
      <section class="spp-tab-panel firewall-panel" data-panel="firewall" hidden>
        <div class="security-banner firewall-banner"><div class="firewall-shield">✓</div><p><b>${t('prefs.security.firewall')}</b><br>${t('prefs.security.firewallHelp')}</p></div>
        <div class="spp-pref-card firewall-options">
          <label><input type="radio" name="firewall" value="all"> ${t('prefs.security.allowAll')}</label>
          <label><input type="radio" name="firewall" value="essential"> ${t('prefs.security.essential')}</label>
          <label><input type="radio" name="firewall" value="specific" checked> ${t('prefs.security.specific')}</label>
          <div class="firewall-table"><p><span>${t('prefs.share.screen')}</span><b>${t('prefs.security.allowIncoming')}</b></p><p><span>${t('prefs.share.file')}</span><b>${t('prefs.security.allowIncoming')}</b></p></div>
          <button class="aqua-btn firewall-advanced">${t('common.advanced')}</button>
        </div>
      </section>`;
    else if (id === 'spotlight') c.innerHTML = `<span hidden>${t('prefs.pane.spotlight')}</span>
      <div class="spp-tabs"><button class="active" data-tab="results">${t('prefs.spotlight.results')}</button><button data-tab="privacy">${t('prefs.spotlight.privacy')}</button></div>
      <section class="spp-tab-panel spotlight-results" data-panel="results">
        <p>${t('prefs.spotlight.order')}</p>
        <div class="spp-pref-card spp-category-list">${[t('prefs.spotlight.cat.apps'),t('prefs.spotlight.cat.prefs'),t('prefs.spotlight.cat.docs'),t('prefs.spotlight.cat.folders'),t('prefs.spotlight.cat.mail'),t('prefs.spotlight.cat.chat'),t('prefs.spotlight.cat.contacts'),t('prefs.spotlight.cat.images'),t('prefs.spotlight.cat.music'),t('prefs.spotlight.cat.movies'),t('prefs.spotlight.cat.fonts'),t('prefs.spotlight.cat.presentations'),t('prefs.spotlight.cat.web'),t('prefs.spotlight.cat.pdf')].map((name,index) => check(`cat${index}`,name,true)).join('')}</div>
        <div class="spotlight-shortcuts"><label>${t('prefs.spotlight.menuShortcut')}<select class="spp-select safe-profile"><option value="ctrlShift">${t('prefs.spotlight.safe')}</option><option value="ctrlAlt">⌃⌥Space</option></select></label><label>${t('prefs.spotlight.windowShortcut')}<select class="spp-select"><option>⌃⇧⌘Space</option><option>—</option></select></label></div>
      </section>
      <section class="spp-tab-panel spotlight-privacy" data-panel="privacy" hidden>
        <p>${t('prefs.spotlight.wontSearch')}</p>
        <div class="privacy-list"><header><span>${t('prefs.spotlight.locations')}</span><span>${t('prefs.spotlight.kind')}</span></header><button class="privacy-row"><span>${t('prefs.spotlight.private')}</span><span>${t('common.folder')}</span></button></div>
        <div class="table-controls"><button class="aqua-btn privacy-add">＋</button><button class="aqua-btn privacy-remove">－</button></div>
        <p class="spp-hint">${t('prefs.spotlight.privacyHelp')}</p>
      </section>`;
    else if (id === 'international') c.innerHTML = (() => {
      const prefs = loadInternationalPrefs();
      const order = resolveLanguageOrder(prefs);
      const langButtons = order.map((code, index) =>
        `<li data-code="${code}"><button class="${index === 0 ? 'sel' : ''}" data-language="${code}">${localeDisplayName(code)}</button></li>`
      ).join('');
      return `
      <div class="spp-tabs"><button class="active" data-tab="language">${t('prefs.international.language')}</button><button data-tab="formats">${t('prefs.international.formats')}</button></div>
      <section class="spp-tab-panel language-panel" data-panel="language">
        <p>${t('prefs.international.languageHelp')}</p>
        <div class="international-columns"><div><ol class="language-list">${langButtons}</ol><div class="language-actions"><button class="aqua-btn language-up">${t('prefs.international.moveUp')}</button><button class="aqua-btn language-down">${t('prefs.international.moveDown')}</button><button class="aqua-btn language-edit">${t('prefs.international.editList')}</button></div></div>
        <aside><p>${t('prefs.international.orderHelp')}</p></aside></div>
      </section>
      <section class="spp-tab-panel formats-panel" data-panel="formats" hidden>
        <label class="region-label">${t('prefs.international.region')}<select class="spp-select international-region"><option value="china">${t('prefs.international.region.china')}</option><option value="us">${t('prefs.international.region.us')}</option><option value="uk">${t('prefs.international.region.uk')}</option><option value="japan">${t('prefs.international.region.japan')}</option></select></label>
        <div class="format-preview"><dl><dt>${t('prefs.international.date')}</dt><dd class="format-date"></dd><dt>${t('prefs.international.time')}</dt><dd class="format-time"></dd><dt>${t('prefs.international.numbers')}</dt><dd class="format-number"></dd><dt>${t('prefs.international.currency')}</dt><dd class="format-currency"></dd></dl></div>
      </section>`;
    })()
    else if (id === 'keyboard') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="keyboard">${t('prefs.keyboard.tabKeyboard')}</button><button data-tab="mouse">${t('prefs.keyboard.tabMouse')}</button><button data-tab="shortcuts">${t('prefs.keyboard.tabShortcuts')}</button></div>
      <section class="spp-tab-panel keyboard-panel" data-panel="keyboard">
        <div class="keyboard-visual" aria-label="${t('prefs.keyboard.aria')}">${keyboardMarkup}</div>
        <div class="spp-pref-card keyboard-settings">
          <label><span>${t('prefs.keyboard.repeat')}</span><small>${t('common.slow')}</small>${range('repeat',70)}<small>${t('common.fast')}</small></label>
          <label><span>${t('prefs.keyboard.delay')}</span><small>${t('common.long')}</small>${range('delay',55)}<small>${t('common.short')}</small></label>
          ${check('fkeys',t('prefs.keyboard.fkeys'))}
          <label>${t('prefs.keyboard.testLabel')}<input class="aqua-input keyboard-test" autocomplete="off" placeholder="${t('prefs.keyboard.testPh')}"></label>
        </div>
      </section>
      <section class="spp-tab-panel mouse-panel" data-panel="mouse" hidden>
        <div class="mighty-mouse" aria-hidden="true"><i></i><span>●</span></div>
        <div class="mouse-controls"><label><span>${t('prefs.keyboard.tracking')}</span><small>${t('common.slow')}</small>${range('tracking',62)}<small>${t('common.fast')}</small></label><label><span>${t('prefs.keyboard.doubleClick')}</span><small>${t('common.slow')}</small>${range('doubleClick',58)}<small>${t('common.fast')}</small></label><label><span>${t('prefs.keyboard.scrolling')}</span><small>${t('common.slow')}</small>${range('scrolling',65)}<small>${t('common.fast')}</small></label><label>${t('prefs.keyboard.primaryBtn')}<select class="spp-select"><option>${t('prefs.msg.d2aff14178')}</option><option>${t('prefs.msg.4d9c32c23d')}</option></select></label>${check('mouseZoom',t('prefs.keyboard.ctrlScrollZoom'))}</div>
      </section>
      <section class="spp-tab-panel shortcut-panel" data-panel="shortcuts" hidden>
        <div class="shortcut-layout"><aside>${[`${t('prefs.msg.2938c7f7e5')} & ${t('prefs.ui8.0a462765374a')}`,t('prefs.ui2.08dd3e29aa88'),t('prefs.ui2.462c86176c2f'),t('prefs.ui2.39c082835ffa'),'Spotlight',t('prefs.ui2.1f587027e30a')].map((name,index)=>`<button data-shortcat="${index}" class="${index === 0 ? 'sel' : ''}">${name}</button>`).join('')}</aside><main class="shortcut-rows"></main></div>
        <div class="shortcut-footer"><label>${t('prefs.keyboard.safeMods')}<select class="spp-select safe-profile"><option value="ctrlShift">${t('prefs.ui2.cf70c7ab07b7')}</option><option value="ctrlAlt">${t('prefs.ui2.897f699409aa')}</option></select></label><button class="aqua-btn keyboard-capture">${t('prefs.keyboard.capture')}</button><button class="aqua-btn keyboard-help">${t('prefs.keyboard.help')}</button></div>
      </section>`;
    else if (id === 'cd') c.innerHTML = `
      <div class="cd-disc-art"><div><i></i></div><p><b>${t('prefs.cd.whenInsert')}</b><br>${t('prefs.cd.help')}</p></div>
      <div class="spp-pref-card cd-actions">${[t('prefs.cd.blankCD'),t('prefs.cd.blankDVD'),t('prefs.cd.musicCD'),t('prefs.cd.pictureCD'),t('prefs.cd.videoDVD')].map((name)=>`<label><span>${name}：</span><select class="spp-select"><option>${t('prefs.cd.ask')}</option><option>${t('prefs.cd.openFinder')}</option><option>${t('prefs.cd.openItunes')}</option><option>${t('prefs.cd.openDvd')}</option><option>${t('prefs.cd.ignore')}</option></select></label>`).join('')}</div>`;
    else if (id === 'printfax') c.innerHTML = `
      <div class="print-fax-pane"><aside><header>${t('prefs.ui2.ba3c80d999f5')}</header><div class="printer-sidebar-list"><button class="sel"><i>${printerSvg}</i><span>Web PDF Printer<small>${t('prefs.print.idleDefault')}</small></span></button></div><footer><button class="printer-add" title="${t('prefs.print.add')}">＋</button><button class="printer-remove" title="${t('prefs.print.remove')}">－</button><i></i><button class="printer-gear" title="${t('prefs.msg.2b6bc0f293')}">⚙</button></footer></aside>
      <main><section class="printer-summary"><div class="printer-large">${printerSvg}</div><div><h3>Web PDF Printer</h3><dl><dt>${t('prefs.print.status')}</dt><dd class="ready">${t('prefs.print.idle')}</dd><dt>${t('prefs.print.kind')}</dt><dd>${t('prefs.print.kindVal')}</dd><dt>${t('prefs.net.location')}</dt><dd>${t('prefs.ui7.7a4a897cf122')}</dd></dl></div></section><div class="printer-actions"><button class="aqua-btn default print-open-queue">${t('prefs.print.openQueue')}</button><button class="aqua-btn printer-options">${t('prefs.print.options')}</button></div><label class="spp-check"><input type="checkbox" data-key="sharePrinter" ${checked('sharePrinter')}> ${t('prefs.ui2.7aae2a15cf56')}</label></main>
      <footer class="print-defaults"><label>${t('prefs.print.defaultPrinter')}<select class="spp-select"><option>Web PDF Printer</option><option>${t('prefs.print.lastUsed')}</option></select></label><label>${t('prefs.print.paperSize')}<select class="spp-select"><option>A4</option><option>US Letter</option><option>A5</option></select></label></footer></div>`;
    else if (id === 'network') c.innerHTML = `
      <div class="network-pref"><header><label>${t('prefs.net.location')}<select class="spp-select network-location"><option value="automatic">${t('prefs.net.automatic')}</option><option value="home">${t('prefs.net.home')}</option><option value="work">${t('prefs.net.work')}</option></select></label></header>
      <aside><div class="network-service-list"><button data-service="airport" class="sel"><i class="status-dot green"></i><span>${t('prefs.msg.bb6703dbf1')}<small>${t('common.connected')}</small></span></button><button data-service="ethernet"><i class="status-dot red"></i><span>${t('prefs.net.ethernet')}<small>${t('common.disconnected')}</small></span></button><button data-service="bluetooth"><i class="status-dot red"></i><span>Bluetooth<small>${t('common.disconnected')}</small></span></button><button data-service="firewire"><i class="status-dot gray"></i><span>${t('prefs.msg.b332b80702')}<small>${t('common.disconnected')}</small></span></button></div><footer><button class="network-add-service">＋</button><button class="network-remove-service">－</button><i></i><button class="network-service-gear">⚙</button></footer></aside>
      <main><section class="airport-summary"><div class="airport-rings"><i></i><i></i><i></i></div><div><h3 class="network-service-title">AirPort <b>${t('common.connected')}</b></h3><p class="network-service-copy">${t('prefs.net.airportConnected')}</p></div></section>
      <label class="spp-check network-power"><input type="checkbox" data-key="airportOn" ${checked('airportOn',true)}> ${t('prefs.msg.8bbc2bb46d')}</label><label class="network-name-row"><span>${t('prefs.net.networkName')}</span><select class="spp-select network-name"><option>Leopard Web</option></select></label>${check('askNetworks',t('prefs.net.askJoin'),true)}
      <div class="network-buttons"><button class="aqua-btn network-assist">${t('prefs.net.assist')}</button><button class="aqua-btn network-advanced">${t('common.advanced')}</button></div><p class="network-status"><i></i><span>${t('prefs.print.status')}<b>${t('common.connected')}</b><br>${t('prefs.msg.90b396babe')}</span></p></main>
      <footer class="network-footer"><button class="aqua-btn network-diagnose">${t('prefs.net.diagnose')}</button><i></i><button class="aqua-btn network-revert" disabled>${t('prefs.msg.69de8d7f40')}</button><button class="aqua-btn default network-apply">${t('common.apply')}</button></footer></div>`;
    else if (id === 'bluetooth') c.innerHTML = `
      <div class="bluetooth-pref"><header><div class="bt-orb">ᛒ</div><div><h2>Bluetooth</h2><p>${t('prefs.bt.help')}</p></div></header>
      <div class="bluetooth-body"><aside><label class="spp-check"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}> ${t('prefs.ui2.5dbd0b56016f')}</label><label class="spp-check"><input type="checkbox" data-key="discoverable" ${checked('discoverable',true)}> ${t('prefs.ui2.c449106091a6')}</label><p>${t('prefs.ui2.370c8b98ce1d')}<br><b>“${t('prefs.ui2.396ce169ad14')}”</b></p></aside>
      <main><h3>${t('prefs.ui2.b66fe4e53991')}：</h3><div class="bluetooth-device-list"></div><div class="bluetooth-device-actions"><button class="aqua-btn bluetooth-remove" disabled>－</button><button class="aqua-btn default bluetooth-setup">${t('prefs.bt.setup')}</button></div>${check('menu',t('prefs.bt.showMenu'),true)}</main></div>
      <footer><button class="aqua-btn bluetooth-file">${t('prefs.bt.sendFile')}</button><button class="aqua-btn bluetooth-browse">${t('prefs.bt.browse')}</button><i></i><button class="aqua-btn bluetooth-advanced">${t('common.advanced')}</button></footer></div>`;
    else if (id === 'sharing') c.innerHTML = `
      <div class="spp-split sharing-pane"><aside><header>${t('prefs.msg.47d68cd0f4')}</header>${[t('prefs.ui2.efd12e83b9a9'),t('prefs.share.screen'),t('prefs.share.file'),t('prefs.share.printer'),t('prefs.ui2.19fe97c77942'),t('prefs.share.remoteLogin'),t('prefs.ui2.91153101ae14'),t('prefs.ui2.942ecfa15d7c'),t('prefs.ui2.f52a44e1570e')].map((name,index)=>`<label data-service-index="${index}" class="${index === 2 ? 'sel' : ''}"><input type="checkbox" data-key="service${index}" ${checked(`service${index}`)}> <span>${name}</span></label>`).join('')}</aside>
      <main><header><i class="sharing-status-light"></i><div><h3>${t('prefs.share.file')}${t('prefs.ui8.e908dc3321e0')}</h3><p>${t('prefs.share.fileHelp')}</p></div></header><div class="sharing-columns"><section><h4>${t('prefs.share.sharedFolders')}</h4><div class="sharing-list"><button class="sel">${t('prefs.ui2.124061b3c216')}</button><button>${t('prefs.msg.236ed6c03b')}</button></div><div class="table-controls"><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></div></section><section><h4>${t('prefs.share.users')}</h4><div class="sharing-list"><p><span>roll</span><b>${t('prefs.share.rw')}</b></p><p><span>${t('prefs.share.everyone')}</span><b>${t('prefs.share.ro')}</b></p></div></section></div><label class="computer-name">${t('prefs.share.computerName')}<input class="aqua-input" value=t('prefs.ui2.396ce169ad14')></label><p class="sharing-address">${t('prefs.ui7.509990edb8f0')} <b>afp://rolls-mac.local/</b> ${t('prefs.ui7.2ad11f7fdbcf')}</p></main></div>`;
    else if (id === `dotmac`) c.innerHTML = `
      <div class="dotmac-header"><div class="dotmac-cloud"><b>.Mac</b></div><div><h2>.Mac</h2><p>${t('prefs.dotmac.help')}</p></div></div>
      <div class="spp-tabs"><button class="active" data-tab="account">${t('prefs.msg.50df6ac972')}</button><button data-tab="idisk">iDisk</button><button data-tab="sync">${t('prefs.ui5.f154ce095c39')}</button><button data-tab="back">Back to My Mac</button></div>
      <section class="spp-tab-panel dotmac-account" data-panel="account"><div class="spp-pref-card"><label><span>.Mac ${t('prefs.ui2.b1459450474b')}</span><input class="aqua-input dotmac-name" placeholder="name"></label><label><span>${t('prefs.msg.9b55a266cc')}</span><input class="aqua-input" type="password" placeholder="${t('prefs.msg.5185448868')}"></label><div><button class="aqua-btn dotmac-login">${t('prefs.msg.402d19e50f')}</button><button class="aqua-btn">${t('prefs.msg.8048909f5c')}</button></div><p class="spp-hint">${t('prefs.msg.b85ed729ae')}</p></div></section>
      <section class="spp-tab-panel" data-panel="idisk" hidden><div class="idisk-meter"><i style="width:28%"></i></div><p>${t('prefs.ui8.9d9ee8b15574')}</p>${check('idiskSync',t('prefs.dotmac.idiskSync'))}</section>
      <section class="spp-tab-panel" data-panel="sync" hidden><h3>${t('prefs.msg.ede10b697a')}</h3>${[t('prefs.msg.46779389fd'),t('prefs.msg.f8c3feb48c'),t('prefs.msg.183abe8311'),t('prefs.ui2.8bb41ef47689'),`${t('prefs.msg.2938c7f7e5')} Widget`,t('prefs.msg.67d36d06c4')].map((name,index)=>check(`sync${index}`,name,index < 3)).join('')}<button class="aqua-btn dotmac-sync">${t('prefs.msg.5f71b2b2d6')}</button></section>
      <section class="spp-tab-panel" data-panel="back" hidden><h3>Back to My Mac</h3><p>${t('prefs.msg.1966f3da05')}</p>${check('backToMac',t('prefs.dotmac.btmmOn'))}<div class="dotmac-computers">${t('prefs.msg.10f300f8c5')}</div></section>`;
    else if (id === 'parental') c.innerHTML = `
      <div class="parental-pref"><aside><header>${t('prefs.msg.50df6ac972')}</header><button class="sel"><i class="spp-avatar">R</i><span>roll<small>${t('prefs.msg.b1dae9bc5c')}</small></span></button><footer><button>＋</button><button>－</button><i></i><button>⚙</button></footer></aside>
      <main><div class="parental-title"><i class="spp-avatar large">R</i><div><h2>${t('prefs.ui8.4e650bb4310a')}</h2><p>${t('prefs.ui7.38d5e91aa020')}</p></div></div>
      <div class="spp-tabs"><button class="active" data-tab="system">${t('prefs.msg.8a8b895fcc')}</button><button data-tab="content">${t('prefs.msg.2d711b09bd')}</button><button data-tab="mailchat">${t('prefs.ui2.a6b6bd260a12')}</button><button data-tab="time">${t('prefs.msg.6dbf1804b3')}</button><button data-tab="logs">${t('prefs.msg.456d29ef8b')}</button></div>
      <section class="spp-tab-panel" data-panel="system">${check('simpleFinder',t('prefs.parental.simpleFinder'))}${check('limitApps',t('prefs.parental.limitApps'))}<div class="parental-apps"><label><input type="checkbox" checked> Finder</label><label><input type="checkbox" checked> Safari</label><label><input type="checkbox"> Terminal</label></div></section>
      <section class="spp-tab-panel" data-panel="content" hidden>${check('hideProfanity',t('prefs.parental.hideProfanity'),true)}${check('limitWeb',t('prefs.parental.limitWeb'))}<button class="aqua-btn">${t('prefs.msg.1accb3bb23')}</button></section>
      <section class="spp-tab-panel" data-panel="mailchat" hidden>${check('limitMail',t('prefs.parental.limitMail'))}${check('limitChat',t('prefs.parental.limitChat'))}<div class="parental-contacts">${t('prefs.ui2.9315fbf6c6fd')}</div><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></section>
      <section class="spp-tab-panel parental-time" data-panel="time" hidden><label>${t('prefs.ui2.1d4e24d85ab4')}<select class="spp-select"><option>${t('prefs.msg.bc436447f5')}</option><option>1 ${t('prefs.msg.2de0d491d0')}</option><option>2 ${t('prefs.msg.2de0d491d0')}</option><option>4 ${t('prefs.msg.2de0d491d0')}</option></select></label><label>${t('prefs.ui2.3c932e2ff244')}<select class="spp-select"><option>${t('prefs.msg.bc436447f5')}</option><option>2 ${t('prefs.msg.2de0d491d0')}</option><option>4 ${t('prefs.msg.2de0d491d0')}</option></select></label><label>${t('prefs.msg.1eb2b676b7')}<input type="time" value="22:00">${t('prefs.ui8.29a5c271546a')}<input type="time" value="07:00"></label></section>
      <section class="spp-tab-panel" data-panel="logs" hidden><div class="parental-log"><header><span>${t('prefs.msg.4ff1e74e43')}</span><span>${t('prefs.ui5.fc9fc2fb8372')}${t('prefs.ui8.150d956e0592')}</span></header><p><span>${t('prefs.msg.800dfdd902')}</span><span>Safari — Leopard Web</span></p></div><button class="aqua-btn">${t('prefs.msg.1a6b374515')}</button></section></main></div>`;
    else if (id === 'speech') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="tts">${t('prefs.speech.tts')}</button><button data-tab="recognition">${t('prefs.speech.recognition')}</button></div>
      <section class="spp-tab-panel speech-tts" data-panel="tts"><div class="speech-avatar">◖))</div><div class="spp-pref-card"><label>${t('prefs.speech.systemVoice')}<select class="spp-select speech-voice"></select></label><label>${t('prefs.speech.rate')}${range('rate',50)}</label><textarea class="aqua-input speech-text">${t('prefs.speech.sample')}</textarea><button class="aqua-btn speech-play">${t('prefs.speech.play')}</button>${check('announceAlerts',t('prefs.speech.announceAlerts'))}</div></section>
      <section class="spp-tab-panel speech-recognition" data-panel="recognition" hidden><div class="speech-mic-art">${microphoneSvg}</div><div><h3>${t('prefs.speech.speakable')}</h3><label class="spp-check"><input type="checkbox" data-key="recognition" ${checked('recognition')}> ${t('prefs.speech.speakable')}</label><label>${t('prefs.speech.listenKey')}<select class="spp-select"><option>Esc</option><option>Control</option><option>Command</option></select></label><label>${t('prefs.speech.keyword')}<input class="aqua-input speech-keyword" value="Computer"></label><button class="aqua-btn default speech-listen">${t('prefs.speech.startListen')}</button><p class="speech-recognition-status">${t('prefs.speech.micHelp')}</p><div class="speech-transcript">${t('prefs.speech.transcript')}</div></div></section>`;
    else if (id === 'startup') c.innerHTML = `
      <div class="startup-disks"><button class="sel">${ICONS.hd}<b>Mac OS X, 10.5</b><span>Macintosh HD</span></button><button>${ICONS.folder}<b>Network Startup</b><span>${t('prefs.startup.network')}</span></button></div><p>${t('prefs.startup.help')}</p><button class="aqua-btn">${t('prefs.startup.target')}</button><button class="aqua-btn default restart-pref">${t('prefs.msg.d48e760864')}</button>`;
    else if (id === 'timemachine') c.innerHTML = `
      <div class="tm-pref"><div>${Leopard.glyph('timemachine',120)}</div><section><h3>Time Machine</h3><label class="tm-switch"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}><i></i><span>${t('prefs.msg.8493205602')}</span></label><p>${t('prefs.tm.oldest')}<br>${t('prefs.tm.latest', { time: new Date().toLocaleTimeString(getLocale()==='zh-CN'?'zh-CN':'en-US') })}${new Date().toLocaleTimeString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}<br>${t('prefs.tm.next')}</p>${check('menu',t('prefs.tm.showMenu'),true)}<button class="aqua-btn tm-backup">${t('prefs.tm.backupNow')}</button><button class="aqua-btn tm-enter">${t('prefs.tm.enter')}</button></section></div>`;
    else if (id === 'universal') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="seeing">${t('prefs.ua.seeing')}</button><button data-tab="hearing">${t('prefs.ua.hearing')}</button><button data-tab="keyboard">${t('prefs.keyboard.tabKeyboard')}</button><button data-tab="mouse">${t('prefs.keyboard.tabMouse')}</button></div>
      <section class="spp-tab-panel universal-section" data-panel="seeing"><div class="accessibility-symbol">●</div><div><h3>${t('prefs.ua.seeing')}</h3>${check('voiceOver',t('prefs.ua.voiceOver'))}${check('zoom',t('prefs.ua.zoom'))}<label>${t('prefs.ua.contrast')}${range('contrast',0,0,80)}</label><div><button class="aqua-btn voiceover-utility-open">${t('prefs.ua.openVO')}</button><button class="aqua-btn universal-options-open">${t('common.options')}</button></div></div></section>
      <section class="spp-tab-panel universal-section" data-panel="hearing" hidden><div class="accessibility-symbol">◖</div><div><h3>${t('prefs.ua.hearing')}</h3>${check('flashScreen',t('prefs.ua.flash'))}${check('stereoMono',t('prefs.ua.mono'))}<button class="aqua-btn flash-test">${t('prefs.ua.flashTest')}</button></div></section>
      <section class="spp-tab-panel universal-section" data-panel="keyboard" hidden><div class="accessibility-symbol">⌨</div><div><h3>${t('prefs.ua.keyboard')}</h3>${check('stickyKeys',t('prefs.ua.sticky'))}${check('slowKeys',t('prefs.ua.slowKeys'))}<label>${t('prefs.ua.acceptDelay')}${range('acceptDelay',45)}</label></div></section>
      <section class="spp-tab-panel universal-section" data-panel="mouse" hidden><div class="accessibility-symbol">↖</div><div><h3>${t('prefs.ua.mouse')}</h3>${check('mouseKeys',t('prefs.ua.mouseKeys'))}<label>${t('prefs.ua.initialDelay')}${range('mouseDelay',40)}</label><label>${t('prefs.ua.maxSpeed')}${range('mouseSpeed',65)}</label></div></section>`;
    else c.innerHTML = `<p>${t('prefs.loaded')}</p>`;

    c.querySelectorAll('[data-key]').forEach((control) => {
      const update = () => {
        cfg[control.dataset.key] = control.type === 'checkbox' ? control.checked : control.type === 'range' ? +control.value : control.value;
        save(`macweb.pref.${id}`, cfg);
        if (id === 'universal' && control.dataset.key === 'contrast') {
          document.documentElement.style.filter = +control.value ? `contrast(${1 + +control.value / 100})` : '';
        }
        if ((id === 'bluetooth' || id === 'timemachine') && control.dataset.key === 'menu') Leopard.syncMenuExtras?.();
      };
      control.addEventListener(control.type === 'range' ? 'input' : 'change', update);
    });
    bindTabs(c);

    if (id === 'exposespaces') {
      c.querySelectorAll('[data-space]').forEach((space) => space.addEventListener('click', () => {
        c.querySelectorAll('[data-space]').forEach((item) => item.classList.toggle('sel', item === space));
        Leopard.switchSpace?.(+space.dataset.space);
      }));
      c.querySelector('.show-spaces')?.addEventListener('click', Leopard.showSpaces);
      c.querySelector('.spaces-minus')?.addEventListener('click', () => Leopard.toast('Spaces', t('prefs.ui2.6badc1553485')));
      c.querySelector('.spaces-plus')?.addEventListener('click', () => Leopard.toast('Spaces', t('prefs.ui2.acf184294693')));
    }
    if (id === 'security') {
      c.querySelectorAll('[name="firewall"]').forEach((radio) => {
        radio.checked = radio.value === (cfg.firewall || 'specific');
        radio.addEventListener('change', () => { cfg.firewall = radio.value; save('macweb.pref.security', cfg); });
      });
      c.querySelector('.filevault-toggle')?.addEventListener('click', () => {
        if (cfg.fileVault) {
          cfg.fileVault = false; save('macweb.pref.security', cfg);
          c.querySelector('.filevault-status').textContent = t('prefs.security.fvOff');
          c.querySelector('.filevault-toggle').textContent = t('prefs.security.fvTurnOn');
        } else openFileVaultAssistant(cfg, () => {
          c.querySelector('.filevault-status').textContent = t('prefs.security.fvOn');
          c.querySelector('.filevault-toggle').textContent = t('prefs.security.fvTurnOff');
        });
      });
      c.querySelector('.firewall-advanced')?.addEventListener('click', () => System.alertBox(t('prefs.security.fwAdvanced'), t('prefs.security.fwAdvancedBody')));
    }
    if (id === 'spotlight') {
      const safeProfile = c.querySelector('.safe-profile');
      safeProfile.value = Leopard.settings().safeProfile || 'ctrlShift';
      safeProfile.addEventListener('change', () => Leopard.saveSettings({ safeProfile: safeProfile.value }));
      const privacyList = c.querySelector('.privacy-list');
      privacyList.addEventListener('click', (event) => {
        const row = event.target.closest('.privacy-row');
        if (row) privacyList.querySelectorAll('.privacy-row').forEach((item) => item.classList.toggle('sel', item === row));
      });
      c.querySelector('.privacy-add').addEventListener('click', () => {
        System.promptSheet({
          parent:winRef, title:t('prefs.spotlight.privacyTitle'), message:t('prefs.spotlight.excludeMsg'),
          value:t('prefs.spotlight.private'), okLabel:t('prefs.spotlight.exclude'),
          onOK:(name)=>{
            const button = el('button', 'privacy-row');
            button.innerHTML = `<span></span><span>${t('prefs.ui2.4a7bb21f311a')}</span>`;
            button.firstElementChild.textContent = name;
            privacyList.appendChild(button);
          },
        });
      });
      c.querySelector('.privacy-remove').addEventListener('click', () => privacyList.querySelector('.privacy-row.sel')?.remove());
    }
    if (id === 'international') {
      const list = c.querySelector('.language-list');
      const applyLanguageOrder = () => {
        const languages = [...list.querySelectorAll('li')].map((li) => li.dataset.code).filter(Boolean);
        saveInternationalPrefs({ languages });
        if (languages[0]) setLocale(languages[0], { persist: true, force: true });
      };
      list.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button) list.querySelectorAll('button').forEach((item) => item.classList.toggle('sel', item === button));
      });
      const moveLanguage = (direction) => {
        const selected = list.querySelector('button.sel')?.closest('li');
        const sibling = direction < 0 ? selected?.previousElementSibling : selected?.nextElementSibling;
        if (selected && sibling) {
          list.insertBefore(direction < 0 ? selected : sibling, direction < 0 ? sibling : selected);
          applyLanguageOrder();
        }
      };
      c.querySelector('.language-up')?.addEventListener('click', () => moveLanguage(-1));
      c.querySelector('.language-down')?.addEventListener('click', () => moveLanguage(1));
      c.querySelector('.language-edit')?.addEventListener('click', () => System.alertBox(t('prefs.international.editList'), t('prefs.international.editListMsg')));
      const regionMap = { china: 'zh-CN', us: 'en-US', uk: 'en-GB', japan: 'ja-JP' };
      const currencyMap = { china: 'CNY', us: 'USD', uk: 'GBP', japan: 'JPY' };
      const region = c.querySelector('.international-region');
      const intlPrefs = loadInternationalPrefs();
      if (region) {
        region.value = intlPrefs.region || (getLocale() === 'zh-CN' ? 'china' : 'us');
        const paintFormats = () => {
          const locale = regionMap[region.value] || 'en-US';
          const currency = currencyMap[region.value] || 'USD';
          const now = new Date();
          const fd = c.querySelector('.format-date');
          if (!fd) return;
          fd.textContent = new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(now);
          c.querySelector('.format-time').textContent = new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(now);
          c.querySelector('.format-number').textContent = new Intl.NumberFormat(locale).format(1234567.89);
          c.querySelector('.format-currency').textContent = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(1234.56);
        };
        region.addEventListener('change', () => {
          saveInternationalPrefs({ region: region.value });
          paintFormats();
        });
        paintFormats();
      }
    }
    if (id === 'keyboard') {
      const test = c.querySelector('.keyboard-test');
      const keyFor = (event) => c.querySelector(`.keyboard-visual [data-code="${event.code}"]`) || c.querySelector(`.keyboard-visual [data-code="${event.code.replace(/Right$/, 'Left')}"]`);
      test.addEventListener('keydown', (event) => {
        keyFor(event)?.classList.add('pressed');
        if (event.key === 'Tab') event.preventDefault();
      });
      test.addEventListener('keyup', (event) => keyFor(event)?.classList.remove('pressed'));
      test.addEventListener('blur', () => c.querySelectorAll('.keyboard-visual .pressed').forEach((key) => key.classList.remove('pressed')));
      const shortcutSets = [
        [[t('prefs.msg.9546525be6'),'⌃⇧D'],[t('prefs.msg.10323d6230'),'⌃⇧K'],[t('prefs.msg.2aae2fd796'),'⌃⇧S']],
        [[t('prefs.ui2.943786bab28f'),'F1'],[t('prefs.ui2.70f150814e4d'),'F2'],[t('prefs.msg.c0ccf74e5f'),'⌃F2']],
        [[t('prefs.ui2.9b42aed0267d'),'⌃F2'],[t('prefs.ui2.393edf387d80'),'⌃F3'],[t('prefs.msg.c3f30b0d26'),'Space']],
        [[t('prefs.ui2.fd0ddef78c2e'),'⌃⇧3'],[t('prefs.ui2.ec8035010e05'),'⌃⇧4']],
        [[t('prefs.ui2.c756a59c2420'),'⌃⇧Space'],[t('prefs.ui2.4e17c23121ed'),'⌃⇧⌘Space']],
        [[t('prefs.ui2.db9b123ef9df'),'⌃⇧V'],[t('prefs.ui2.3d415901c0f5'),'⌃⇧Z']],
      ];
      const renderShortcuts = (index) => {
        const main = c.querySelector('.shortcut-rows');
        main.innerHTML = `<header><span>${t('prefs.msg.2b6bc0f293')}</span><span>${t('prefs.msg.f7d2996639')}</span></header>${shortcutSets[index].map(([name,key])=>`<label><span><input type="checkbox" checked> ${name}</span><kbd>${key}</kbd></label>`).join('')}`;
      };
      c.querySelectorAll('[data-shortcat]').forEach((button) => button.addEventListener('click', () => {
        c.querySelectorAll('[data-shortcat]').forEach((item) => item.classList.toggle('sel', item === button));
        renderShortcuts(+button.dataset.shortcat);
      }));
      renderShortcuts(0);
      const safeProfile = c.querySelector('.safe-profile');
      safeProfile.value = Leopard.settings().safeProfile || 'ctrlShift';
      safeProfile.addEventListener('change', () => Leopard.saveSettings({ safeProfile: safeProfile.value }));
      c.querySelector('.keyboard-capture').addEventListener('click', () => Leopard.setKeyboardCapture(!Leopard.captured));
      c.querySelector('.keyboard-help').addEventListener('click', Leopard.showShortcutHelp);
    }
    if (id === 'printfax') {
      c.querySelector('.print-open-queue').addEventListener('click', openPrintQueue);
      c.querySelector('.printer-add').addEventListener('click', openPrinterBrowser);
      c.querySelector('.printer-remove').addEventListener('click', () => Leopard.toast(t('prefs.ui2.4538e76e38dc'), t('prefs.ui5.6cd7ec0c0afc')));
      c.querySelector('.printer-gear').addEventListener('click', (event) => System.contextMenu(event, [{ label:t('prefs.ui5.763c38538a2a'), action:()=>Leopard.toast(t('prefs.ui2.ba3c80d999f5'),t('prefs.ui5.58a2065272e5')) }, { label:t('prefs.ui5.2bfbee69fc06'), action:()=>System.alertBox(t('prefs.ui5.b74c4437fc09'),t('prefs.ui5.c5aaf8f0f870')) }]));
      c.querySelector('.printer-options').addEventListener('click', () => System.alertBox(t('prefs.ui2.4464034e75d4'), t('prefs.print.optionsBody')));
    }
    if (id === 'network') {
      const airportConnected = () => cfg.airportOn !== false;
      const serviceList = c.querySelector('.network-service-list');
      const serviceInfo = {
        airport: [t('prefs.msg.bb6703dbf1'), airportConnected(), airportConnected() ? `${t('prefs.net.airportConnected')}` : `${t('prefs.net.airportOffHint')}'prefs.ui2.472c7edb05c4')}。`],
        ethernet: [t('prefs.net.ethernet'), false, `${t('prefs.ui8.0f004e2cdb82')}${t('common.disconnected')}${t('prefs.ui8.a97953d07ef7')}${t('prefs.net.ethernet')}${t('prefs.ui8.3fd894967e94')}`],
        bluetooth: ['Bluetooth PAN', false, t('prefs.ui5.8fa8206ceee4')],
        firewire: [t('prefs.msg.b332b80702'), false, `FireWire${t('prefs.ui8.c638984b2f10')}${t('common.disconnected')}。`],
      };
      const chooseService = (button) => {
        c.querySelectorAll('[data-service]').forEach((item) => item.classList.toggle('sel', item === button));
        const disabled = (cfg.disabledServices || []).includes(button.dataset.service);
        const [baseName, baseConnected, baseCopy] = serviceInfo[button.dataset.service] || [button.textContent.trim(), false, `${t('prefs.ui8.84ded8815205')}${t('common.disconnected')}。`];
        const name = baseName;
        const connected = disabled ? false : baseConnected;
        const copy = disabled ? t('prefs.net.serviceDisabled') : baseCopy;
        const titleEl = c.querySelector('.network-service-title');
        const copyEl = c.querySelector('.network-service-copy');
        const powerEl = c.querySelector('.network-power');
        const nameRow = c.querySelector('.network-name-row');
        const statusEl = c.querySelector('.network-status');
        if (titleEl) titleEl.innerHTML = `${name} <b>${connected ? t('common.connected') : t('common.disconnected')}</b>`;
        if (copyEl) copyEl.innerHTML = copy;
        if (powerEl) {
          // Prefer a dedicated label node; fall back to last element child.
          const powerLabel = powerEl.querySelector('span') || powerEl.lastElementChild || powerEl.lastChild;
          if (powerLabel && 'textContent' in powerLabel) {
            powerLabel.textContent = `${t('prefs.ui8.a002e10b97f4')}${name}`;
          }
        }
        if (nameRow) nameRow.hidden = button.dataset.service !== 'airport';
        statusEl?.classList.toggle('offline', !connected);
        const statusSpan = statusEl?.querySelector('span');
        if (statusSpan) {
          statusSpan.innerHTML = `${t('prefs.print.status')}<b>${connected ? t('common.connected') : t('common.disconnected')}</b><br>${connected ? `${t('prefs.ui2.6604031ac2c3')}` : t('prefs.msg.88fdf2396f')}`;
        }
      };
      const bindServiceButton = (button) => button.addEventListener('click', () => chooseService(button));
      const appendCustomService = (service, select = false) => {
        if (!service?.id || c.querySelector(`[data-service="${service.id}"]`)) return null;
        const button = el('button');
        button.dataset.service = service.id;
        button.innerHTML = '<i class="status-dot red"></i><span></span>';
        button.querySelector('span').append(document.createTextNode(service.name), Object.assign(document.createElement('small'), { textContent: t('common.disconnected') }));
        serviceInfo[service.id] = [service.name, false, t('prefs.msg.18304294e7')];
        bindServiceButton(button);
        serviceList.appendChild(button);
        if (select) chooseService(button);
        return button;
      };
      const reorderServiceButtons = (order = normalizedServiceOrder(cfg)) => {
        order.forEach((serviceId) => {
          const button = serviceList.querySelector(`[data-service="${serviceId}"]`);
          if (button) serviceList.appendChild(button);
        });
      };
      (cfg.removedServices || []).forEach((serviceId) => {
        if (serviceId !== 'airport') serviceList.querySelector(`[data-service="${serviceId}"]`)?.remove();
      });
      c.querySelectorAll('[data-service]').forEach(bindServiceButton);
      (cfg.customServices || []).forEach((service) => appendCustomService(service));
      reorderServiceButtons();
      (cfg.disabledServices || []).forEach((serviceId) => {
        const button = serviceList.querySelector(`[data-service="${serviceId}"]`);
        const dot = button?.querySelector('.status-dot');
        if (!button || !dot) return;
        dot.classList.remove('green','red');
        dot.classList.add('gray');
        button.querySelector('small').textContent = t('prefs.ui2.27cdeff15edc');
      });
      const airportButton = c.querySelector('[data-service="airport"]');
      const airportPower = c.querySelector('.network-power input');
      const syncAirportState = () => {
        const latest = store('macweb.pref.network', {});
        cfg.airportOn = latest.airportOn !== false;
        const connected = cfg.airportOn;
        serviceInfo.airport = [t('prefs.msg.bb6703dbf1'), connected, connected ? `${t('prefs.net.airportConnected')}` : `${t('prefs.net.airportOffHint')}'prefs.ui2.472c7edb05c4')}。`];
        airportPower.checked = connected;
        const dot = airportButton.querySelector('.status-dot');
        dot.classList.toggle('green', connected); dot.classList.toggle('red', !connected);
        airportButton.querySelector('small').textContent = connected ? t('common.connected') : t('prefs.msg.b15d91274e');
        if (airportButton.classList.contains('sel')) chooseService(airportButton);
      };
      const onMenuAirportChange = () => {
        if (!c.isConnected) { document.removeEventListener('leopard-network-changed', onMenuAirportChange); return; }
        syncAirportState();
      };
      document.addEventListener('leopard-network-changed', onMenuAirportChange);
      airportPower.addEventListener('change', () => {
        cfg.airportOn = airportPower.checked;
        save('macweb.pref.network', cfg);
        document.dispatchEvent(new CustomEvent('leopard-network-changed', { detail:{ airportOn:cfg.airportOn } }));
        syncAirportState();
      });
      syncAirportState();
      const location = c.querySelector('.network-location');
      location.value = cfg.location || 'automatic';
      location.addEventListener('change', () => {
        cfg.location = location.value; save('macweb.pref.network', cfg);
        const messages = { automatic:`${t('prefs.ui2.3be0c47293bb')}`, home:`${t('prefs.ui2.7f730c508978')}`, work:`${t('prefs.ui2.cae1959c6fcd')}` };
        c.querySelector('.network-status span').innerHTML = `${t('prefs.print.status')}<b>${t('common.connected')}</b><br>${messages[location.value]}`;
      });
      c.querySelector('.network-add-service').addEventListener('click', () => openNetworkServiceAssistant((name) => {
        const service = { id:`custom${Date.now()}`, name };
        cfg.customServices = [...(cfg.customServices || []), service];
        cfg.serviceOrder = normalizedServiceOrder(cfg);
        save('macweb.pref.network', cfg);
        appendCustomService(service, true);
        reorderServiceButtons(cfg.serviceOrder);
      }));
      c.querySelector('.network-remove-service').addEventListener('click', () => {
        const selected = c.querySelector('[data-service].sel');
        if (!selected || selected.dataset.service === 'airport') { Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.ui5.ae9d6d19e538')); return; }
        cfg.customServices = (cfg.customServices || []).filter((service) => service.id !== selected.dataset.service);
        if (!selected.dataset.service.startsWith('custom')) {
          cfg.removedServices = [...new Set([...(cfg.removedServices || []), selected.dataset.service])];
        }
        cfg.serviceOrder = normalizedServiceOrder(cfg).filter((serviceId) => serviceId !== selected.dataset.service);
        cfg.disabledServices = (cfg.disabledServices || []).filter((serviceId) => serviceId !== selected.dataset.service);
        save('macweb.pref.network', cfg);
        selected.remove(); chooseService(c.querySelector('[data-service="airport"]'));
      });
      c.querySelector('.network-service-gear').addEventListener('click', (event) => {
        const selected = c.querySelector('[data-service].sel') || airportButton;
        const serviceId = selected.dataset.service;
        const disabled = (cfg.disabledServices || []).includes(serviceId);
        System.contextMenu(event, [
          { label:t('prefs.ui5.912c58840b1b'), action:() => {
            const sourceName = serviceInfo[serviceId]?.[0] || t('prefs.ui2.195b38b1915c');
            const service = { id:`custom${Date.now()}`, name:`${sourceName}${t('prefs.ui8.90946ce9ac9e')}` };
            cfg.customServices = [...(cfg.customServices || []), service];
            cfg.serviceOrder = normalizedServiceOrder(cfg);
            save('macweb.pref.network', cfg);
            appendCustomService(service, true);
            reorderServiceButtons(cfg.serviceOrder);
          } },
          { label:disabled ? t('prefs.ui5.f714c4b0aa31') : t('prefs.ui5.a53e1b63333b'), action:() => {
            const current = new Set(cfg.disabledServices || []);
            if (disabled) current.delete(serviceId); else current.add(serviceId);
            cfg.disabledServices = [...current];
            save('macweb.pref.network', cfg);
            const dot = selected.querySelector('.status-dot');
            if (dot && disabled) {
              dot.classList.remove('gray');
              dot.classList.add(serviceId === 'airport' && airportConnected() ? 'green' : 'red');
            } else if (dot) {
              dot.classList.remove('green','red');
              dot.classList.add('gray');
            }
            selected.querySelector('small').textContent = disabled ? (serviceId === 'airport' ? t('common.connected') : t('common.disconnected')) : t('prefs.ui2.27cdeff15edc');
            chooseService(selected);
          } },
          { sep:true },
          { label:`${t('prefs.ui2.0a7901a2612b')}…`, action:()=>openNetworkServiceOrder(cfg, reorderServiceButtons) },
        ]);
      });
      c.querySelector('.network-diagnose').addEventListener('click', openNetworkDiagnostics);
      c.querySelector('.network-assist').addEventListener('click', () => openNetworkServiceAssistant());
      c.querySelector('.network-advanced').addEventListener('click', () => openNetworkAdvanced(cfg));
      c.querySelector('.network-apply').addEventListener('click', () => Leopard.toast(t('prefs.msg.3884be05f1'), t('prefs.ui2.3c4abeb0fe3c')));
    }
    if (id === 'bluetooth') {
      const bluetoothList = c.querySelector('.bluetooth-device-list');
      const appendBluetoothDevice = (name, state = t('common.disconnected')) => {
        const existing = Array.from(bluetoothList.querySelectorAll('.device-row')).find((row) => row.querySelector('span').textContent === name);
        if (existing) {
          existing.querySelector('b').textContent = state;
          return existing;
        }
        const device = el('button', 'device-row');
        device.innerHTML = '<i>ᛒ</i><span></span><b></b>';
        device.querySelector('span').textContent = name;
        device.querySelector('b').textContent = state;
        device.addEventListener('click', () => {
          bluetoothList.querySelectorAll('.device-row').forEach((item) => item.classList.toggle('sel', item === device));
          c.querySelector('.bluetooth-remove').disabled = false;
        });
        bluetoothList.appendChild(device);
        return device;
      };
      let bluetoothPaneMounted = false;
      const syncBluetoothDeviceState = () => {
        if (bluetoothPaneMounted && !c.isConnected) {
          document.removeEventListener('leopard-bluetooth-devices-changed', syncBluetoothDeviceState);
          return;
        }
        const latest = store('macweb.pref.bluetooth', {});
        const connectedNow = new Set(latest.connectedDevices || []);
        appendBluetoothDevice('Apple Wireless Keyboard', connectedNow.has('Apple Wireless Keyboard') ? t('common.connected') : t('common.disconnected'));
        appendBluetoothDevice('Mighty Mouse', connectedNow.has('Mighty Mouse') ? t('common.connected') : t('common.disconnected'));
        (latest.devices || []).forEach((name) => appendBluetoothDevice(name, connectedNow.has(name) ? t('common.connected') : t('prefs.msg.51b5912f68')));
      };
      syncBluetoothDeviceState();
      document.addEventListener('leopard-bluetooth-devices-changed', syncBluetoothDeviceState);
      queueMicrotask(() => { bluetoothPaneMounted = true; });
      c.querySelector('.bluetooth-setup').addEventListener('click', () => openBluetoothAssistant(cfg, (name) => {
        appendBluetoothDevice(name, t('prefs.msg.51b5912f68'));
        document.dispatchEvent(new CustomEvent('leopard-bluetooth-devices-changed'));
      }));
      c.querySelector('.bluetooth-remove').addEventListener('click', () => {
        const selected = bluetoothList.querySelector('.device-row.sel');
        if (!selected) return;
        const selectedName = selected.querySelector('span').textContent;
        cfg.devices = (cfg.devices || []).filter((name) => name !== selectedName);
        cfg.connectedDevices = (cfg.connectedDevices || []).filter((name) => name !== selectedName);
        save('macweb.pref.bluetooth', cfg); selected.remove(); c.querySelector('.bluetooth-remove').disabled = true;
      });
      c.querySelector('.bluetooth-file').addEventListener('click', () => openBluetoothFilePanel(cfg));
      c.querySelector('.bluetooth-browse').addEventListener('click', () => openBluetoothDeviceBrowser(cfg));
      c.querySelector('.bluetooth-advanced').addEventListener('click', () => openBluetoothAdvanced(cfg));
    }
    if (id === 'sharing') {
      const services = [t('prefs.ui2.efd12e83b9a9'),t('prefs.share.screen'),t('prefs.share.file'),t('prefs.share.printer'),t('prefs.ui2.19fe97c77942'),t('prefs.share.remoteLogin'),t('prefs.ui2.91153101ae14'),t('prefs.ui2.942ecfa15d7c'),t('prefs.ui2.f52a44e1570e')];
      c.querySelectorAll('[data-service-index]').forEach((label) => label.addEventListener('click', () => {
        c.querySelectorAll('[data-service-index]').forEach((item) => item.classList.toggle('sel', item === label));
        const input = label.querySelector('input');
        c.querySelector('.sharing-pane main h3').textContent = `${services[+label.dataset.serviceIndex]}：${input.checked ? t('prefs.msg2.86a6bbc85e') : t('prefs.msg.b15d91274e')}`;
        c.querySelector('.sharing-status-light').classList.toggle('on', input.checked);
      }));
    }
    if (id === 'dotmac') {
      c.querySelector('.dotmac-login').addEventListener('click', () => {
        const name = c.querySelector('.dotmac-name').value.trim();
        System.alertBox('.Mac', name ? t('prefs.dotmac.cantConnect',{name}) : t('prefs.ui8.a34321cef8dc'));
      });
      c.querySelector('.dotmac-sync').addEventListener('click', () => Leopard.toast('.Mac', t('prefs.ui5.b781e4de5892')));
    }
    if (id === 'speech') {
      if ('speechSynthesis' in window) {
        const select = c.querySelector('.speech-voice');
        const fillVoices = () => {
          const voices = speechSynthesis.getVoices();
          select.innerHTML = voices.map((voice,index) => `<option value="${index}">${html(voice.name)} — ${html(voice.lang)}</option>`).join('') || `<option>${t('prefs.msg.6bfeac3dc6')}</option>`;
        };
        fillVoices(); speechSynthesis.addEventListener?.('voiceschanged', fillVoices, { once:true });
        c.querySelector('.speech-play').addEventListener('click', () => {
          const utterance = new SpeechSynthesisUtterance(c.querySelector('.speech-text').value);
          utterance.voice = speechSynthesis.getVoices()[+select.value] || null;
          utterance.rate = .5 + +(cfg.rate || 50) / 50;
          speechSynthesis.cancel(); speechSynthesis.speak(utterance);
        });
      }
      c.querySelector('.speech-listen').addEventListener('click', () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const status = c.querySelector('.speech-recognition-status');
        if (!Recognition) { status.textContent = t('prefs.ui5.2c37a0d689b8'); return; }
        const recognition = new Recognition();
        recognition.lang = 'zh-CN'; recognition.interimResults = true;
        recognition.onstart = () => { status.textContent = t('prefs.ui5.5f85fbab099a'); c.querySelector('.speech-listen').textContent = t('prefs.msg.095e938e2a'); };
        recognition.onresult = (event) => { c.querySelector('.speech-transcript').textContent = Array.from(event.results, (result) => result[0].transcript).join(''); };
        recognition.onerror = (event) => { status.textContent = `${t('prefs.ui8.cbfe0813a6d3')}${event.error}`; };
        recognition.onend = () => { status.textContent = t('prefs.ui5.b26b72d4847b'); c.querySelector('.speech-listen').textContent = t('prefs.speech.startListen'); };
        recognition.start();
      });
    }
    if (id === 'startup') c.querySelector('.restart-pref')?.addEventListener('click', () => System.shutdownSequence(true));
    if (id === 'timemachine') {
      c.querySelector('.tm-backup').addEventListener('click', () => { Leopard.saveSnapshot('prefs.ui2.ccbec984d608'); Leopard.toast('Time Machine', t('prefs.ui2.6703fd77b535')); });
      c.querySelector('.tm-enter').addEventListener('click', Leopard.openTimeMachine);
    }
    if (id === 'universal') {
      c.querySelector('.flash-test').addEventListener('click', () => {
        document.body.classList.add('accessibility-flash');
        setTimeout(() => document.body.classList.remove('accessibility-flash'), 180);
      });
      c.querySelector('.voiceover-utility-open').addEventListener('click', openVoiceOverUtility);
      c.querySelector('.universal-options-open').addEventListener('click', () => openUniversalOptions(cfg));
    }
    return c;
  }

  // ---------- window & navigation ----------
  let winRef = null;
  /** null = show-all grid; otherwise current pane id (for locale re-render). */
  let currentPaneId = null;

  function showAll() {
    if (!winRef?._spBody) return;
    currentPaneId = null;
    const body = winRef._spBody;
    body.classList.remove('showing-pane');
    body.innerHTML = '';
    ['personal', 'hardware', 'internet', 'system'].forEach((g) => {
      body.appendChild(el('div', 'spp-group-label', groupLabel(g)));
      const grid = el('div', 'spp-grid');
      PANES.filter((p) => p.group === g).forEach((p) => {
        const tile = el('div', 'spp-tile');
        tile.innerHTML = `<div class="spp-tile-icon">${PI[p.id]}</div><div>${paneLabel(p.id)}</div>`;
        tile.addEventListener('click', () => showPane(p.id));
        grid.appendChild(tile);
      });
      body.appendChild(grid);
    });
    winRef._title.textContent = t('app.sysprefs');
    if (winRef._spBack) {
      winRef._spBack.textContent = t('prefs.showAllBtn');
      winRef._spBack.disabled = true;
    }
    if (winRef._contentFitOptions) {
      Object.assign(winRef._contentFitOptions, {
        width:690,
        minHeight:300,
        maxHeight:570,
        extraHeight:0,
      });
    }
    winRef._requestContentFit?.();
  }

  function showPane(id) {
    const p = PANES.find((x) => x.id === id);
    if (!p) return showAll();
    if (!winRef?._spBody) return;
    currentPaneId = id;
    const body = winRef._spBody;
    body.classList.add('showing-pane');
    body.innerHTML = '';
    body.appendChild(p.build());
    winRef._title.textContent = paneLabel(p.id);
    if (winRef._spBack) {
      winRef._spBack.textContent = t('prefs.showAllBtn');
      winRef._spBack.disabled = false;
    }
    if (winRef._contentFitOptions) {
      Object.assign(winRef._contentFitOptions, {
        width:p.fitWidth || 690,
        minHeight:p.fitMinHeight || 300,
        maxHeight:p.fitMaxHeight || 570,
        extraHeight:p.fitInset ?? 8,
      });
    }
    winRef._requestContentFit?.();
  }

  function refreshForLocale() {
    if (!winRef?.isConnected) return;
    if (System.apps?.sysprefs) System.apps.sysprefs.name = t('app.sysprefs');
    if (currentPaneId) showPane(currentPaneId);
    else showAll();
  }

  function open(arg) {
    if (winRef && winRef.isConnected) {
      if (arg && arg.pane) showPane(arg.pane); else showAll();
      System.focusWindow(winRef);
      return;
    }
    const toolbar = el('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%';
    const back = el('button', 'finder-toolbar-btn', t('prefs.showAllBtn'));
    const spot = el('span', 'finder-path', '');
    toolbar.append(back, spot);

    const body = el('div', 'spp-body');
    winRef = System.createWindow({
      app:'sysprefs', title:t('app.sysprefs'), width:690, height:570,
      toolbar, content:body, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:300, maxHeight:570, width:690, extraHeight:0 },
      onClose: () => { currentPaneId = null; winRef = null; return true; },
    });
    winRef._spBody = body;
    winRef._spBack = back;
    back.addEventListener('click', showAll);
    if (arg && arg.pane) showPane(arg.pane); else showAll();
  }

  document.addEventListener('locale-ui-refresh', refreshForLocale);

  System.registerApp({
    id: 'sysprefs', name: t('app.sysprefs'), icon, open,
    about: t('prefs.about'),
    keywords: t('prefs.ui8.c50116437a74'),
  });
})();
