// 系统偏好设置 (System Preferences) — icon grid + functional panes
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="sp-case" x2="0" y2="1"><stop stop-color="#f9fafb"/><stop offset=".48" stop-color="#c5cbd1"/><stop offset=".54" stop-color="#7d858e"/><stop offset="1" stop-color="#e4e7ea"/></linearGradient><radialGradient id="sp-gear"><stop stop-color="#eef1f4"/><stop offset=".55" stop-color="#89939d"/><stop offset="1" stop-color="#515a64"/></radialGradient><filter id="sp-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".42"/></filter></defs><g filter="url(#sp-shadow)"><rect x="5" y="5" width="54" height="54" rx="8" fill="url(#sp-case)" stroke="#59616a" stroke-width="1.5"/><path d="M9 11h46" stroke="#fff" stroke-width="2" opacity=".8"/><g transform="translate(33 34)">${[0,45,90,135,180,225,270,315].map(a => `<rect x="-3.5" y="-23" width="7" height="12" rx="2" fill="#626c76" transform="rotate(${a})"/>`).join('')}<circle r="17" fill="url(#sp-gear)" stroke="#535d67" stroke-width="2"/><circle r="8" fill="#e5e9ec" stroke="#68727c" stroke-width="2"/></g><g transform="translate(16 17) scale(.45)">${[0,60,120,180,240,300].map(a => `<rect x="-3" y="-19" width="6" height="9" rx="2" fill="#77828c" transform="rotate(${a})"/>`).join('')}<circle r="14" fill="#aeb6be" stroke="#68727c" stroke-width="2"/><circle r="5" fill="#eef1f4"/></g></g></svg>`;

  // ---------- storage helpers ----------
  const store = (key, def) => {
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem(key)) || {}); } catch (e) { return Object.assign({}, def); }
  };
  const save = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));

  // ---------- wallpapers ----------
  const WALLS = [
    { id: '', cat: 'Apple 图像', name: 'Aurora', css: 'url("assets/aurora.svg")' },
    { id: 'tiger', cat: 'Apple 图像', name: 'Aqua Blue', css: 'url("assets/tiger.svg")' },
    { id: 'purpleaurora', cat: 'Apple 图像', name: 'Purple Aurora', css: 'radial-gradient(ellipse at 66% 22%,#e89cff 0 4%,transparent 27%),radial-gradient(ellipse at 35% 65%,#387de4,transparent 44%),linear-gradient(135deg,#170d38,#7a218d 48%,#091b4d)' },
    { id: 'goldenpalace', cat: 'Apple 图像', name: 'Golden Palace', css: 'radial-gradient(circle at 50% 32%,#fff6b0 0 2%,#f6c84d 3% 8%,transparent 25%),linear-gradient(155deg,#281514,#9d4b26 48%,#e5a741 70%,#241414)' },
    { id: 'lake', cat: '自然', name: 'Mountain Lake', css: 'linear-gradient(165deg,transparent 49%,rgba(255,255,255,.3) 50% 51%,transparent 52%),linear-gradient(155deg,#77b9df 0 43%,#405d69 44% 51%,#2e6f83 52% 67%,#172f36 68%)' },
    { id: 'forest', cat: '自然', name: 'Forest', css: 'radial-gradient(ellipse at 30% 85%,#83a44b,transparent 42%),linear-gradient(105deg,#10251c,#335e35 45%,#7c9a50 75%,#18261b)' },
    { id: 'grass', cat: '自然', name: 'Grass Blades', css: 'linear-gradient(175deg,#8bc7ed 0 41%,#afd9ef 42%,#4f9a3d 43%,#1f5d27 100%)' },
    { id: 'ocean', cat: '自然', name: 'Rolling Waves', css: 'radial-gradient(ellipse at 55% 56%,rgba(255,255,255,.52),transparent 9%),repeating-radial-gradient(ellipse at 55% 60%,#b6edf1 0 5%,#347c9f 7% 13%,#063852 15% 23%)' },
    { id: 'ice', cat: '自然', name: 'Blue Ice', css: 'linear-gradient(125deg,#e8fbff,#8ecfe4 23%,#d4f3fa 25%,#4d9fbd 47%,#c6edf5 49%,#236a8c 78%,#dff9ff)' },
    { id: 'space', cat: '自然', name: 'Deep Space', css: 'radial-gradient(circle at 23% 28%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 18%,#9ed2ff 0 1px,transparent 2px),radial-gradient(ellipse at 30% 20%,#2a3a6e,#05060f 63%)' },
    { id: 'spectrum', cat: '抽象', name: 'Spectrum', css: 'conic-gradient(from 220deg at 52% 55%,#19245a,#5d1c83,#d1387b,#e69645,#54a769,#2a7fc1,#19245a)' },
    { id: 'ink', cat: '抽象', name: 'Ink', css: 'radial-gradient(circle at 30% 40%,rgba(35,126,189,.9),transparent 24%),radial-gradient(circle at 67% 62%,rgba(170,37,139,.86),transparent 28%),linear-gradient(140deg,#eef6f7,#9fc7cc)' },
    { id: 'sunrise', cat: '抽象', name: 'Sunrise', css: 'linear-gradient(180deg,#2b2e55 0%,#7a4a78 45%,#e88a5a 78%,#f7c96e 100%)' },
    { id: 'graphite', cat: '黑白', name: 'Graphite', css: 'radial-gradient(ellipse at 50% 35%,#89939e,#23272d 74%)' },
    { id: 'paper', cat: '黑白', name: 'Rice Paper', css: 'repeating-linear-gradient(45deg,#eee 0 2px,#e6e6e3 2px 4px)' },
    { id: 'solidblue', cat: '纯色', name: 'Aqua Blue', css: 'linear-gradient(#5087bc,#5087bc)' },
    { id: 'solidgreen', cat: '纯色', name: 'Forest Green', css: 'linear-gradient(#3f7254,#3f7254)' },
    { id: 'solidgray', cat: '纯色', name: 'Neutral Gray', css: 'linear-gradient(#777,#777)' },
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
  let screenSaverIdleTimer = 0;
  let screenSaverClockTimer = 0;
  let hotCornerTimer = 0;
  let hotCornerActive = '';
  let lastScreenSaverActivity = 0;
  let energyScheduleWin = null;
  let energyScheduleTimer = 0;
  let energySleepOverlay = null;
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
    scheduleScreenSaver();
    document.dispatchEvent(new CustomEvent('screensaver-preferences-changed', { detail:cfg }));
  }

  function saverEffect(name, cfg, className = '') {
    const particles = Array.from({ length:cfg.particles }, (_, index) =>
      `<i style="animation-delay:${(-index * .72).toFixed(2)}s;animation-duration:${(3.6 / (cfg.speed / 100)).toFixed(2)}s"></i>`).join('');
    const label = name === 'Computer Name' ? '<strong>roll 的 MacBook Pro</strong>'
      : name === 'iTunes Artwork' ? '<strong>♫ Leopard Web 原创音乐库</strong>'
      : name === 'RSS Visualizer' ? '<strong>Mac OS X Leopard · 今日摘要</strong>'
      : name === 'Word of the Day' ? '<strong>serendipity</strong><em>意外发现美好事物</em>'
      : name === 'Pictures Folder' ? '<strong>图片文件夹</strong>'
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
    scheduleScreenSaver();
  }

  function startScreenSaver(options = {}) {
    if (screenSaverOverlay) return screenSaverOverlay;
    const cfg = screenSaverConfig();
    const chosen = options.name || (cfg.random
      ? SCREEN_SAVERS[Math.floor(Math.random() * SCREEN_SAVERS.length)]
      : cfg.selected);
    const overlay = el('div', 'screensaver-test');
    overlay.innerHTML = `${saverEffect(chosen, cfg, 'fullscreen')}<b class="screensaver-name">${chosen}</b>
      ${cfg.clock ? '<time class="screensaver-clock"></time>' : ''}<small>移动鼠标、点按或按任意键退出</small>`;
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

  function scheduleScreenSaver() {
    clearTimeout(screenSaverIdleTimer);
    screenSaverIdleTimer = 0;
    const cfg = screenSaverConfig();
    if (!cfg.delay || screenSaverOverlay || hotCornerActive === 'disable-screensaver') return;
    screenSaverIdleTimer = setTimeout(() => startScreenSaver(), cfg.delay * 60000);
  }

  function performHotCorner(action) {
    if (!action || action === 'none' || action === 'disable-screensaver') return;
    if (action === 'screensaver') startScreenSaver();
    else if (action === 'dashboard') System.launch('dashboard');
    else if (action === 'desktop') System.windows
      .filter((win) => win.style.display !== 'none')
      .forEach((win) => System.minimizeWindow(win));
    else if (action === 'all-windows' || action === 'application-windows') System.toggleExpose();
  }

  function installScreenSaverRuntime() {
    if (!document.querySelector('.hot-corner-zone')) {
      ['tl','tr','bl','br'].forEach((corner) => {
        const zone = el('i', `hot-corner-zone ${corner}`);
        zone.setAttribute('aria-hidden', 'true');
        document.body.appendChild(zone);
      });
    }
    const resetIdle = () => {
      const now = performance.now();
      if (now - lastScreenSaverActivity < 750) return;
      lastScreenSaverActivity = now;
      if (!screenSaverOverlay) scheduleScreenSaver();
    };
    ['pointerdown','keydown','wheel'].forEach((type) =>
      addEventListener(type, resetIdle, { passive:true }));
    addEventListener('pointermove', (event) => {
      const edge = 5;
      const index = event.clientX <= edge && event.clientY <= edge ? 0
        : event.clientX >= innerWidth - edge && event.clientY <= edge ? 1
        : event.clientX <= edge && event.clientY >= innerHeight - edge ? 2
        : event.clientX >= innerWidth - edge && event.clientY >= innerHeight - edge ? 3
        : -1;
      if (index < 0) {
        clearTimeout(hotCornerTimer);
        hotCornerTimer = 0;
        hotCornerActive = '';
        resetIdle();
        return;
      }
      const action = screenSaverConfig().corners[index] || 'none';
      if (action === hotCornerActive) return;
      clearTimeout(hotCornerTimer);
      hotCornerActive = action;
      if (action === 'disable-screensaver') {
        clearTimeout(screenSaverIdleTimer);
        return;
      }
      hotCornerTimer = setTimeout(() => {
        hotCornerTimer = 0;
        performHotCorner(action);
      }, 650);
    }, { passive:true });
    scheduleScreenSaver();
  }

  function showScreenSaverOptions(onChange) {
    if (screenSaverOptionsWin?.isConnected) {
      System.focusWindow(screenSaverOptionsWin);
      return;
    }
    const cfg = screenSaverConfig();
    const content = el('div', 'spp-pane saver-options-window');
    content.innerHTML = `<div class="saver-options-preview"></div>
      <label><span>光带数量：</span><input class="saver-particle-range" type="range" min="2" max="10" value="${cfg.particles}"><output>${cfg.particles}</output></label>
      <label><span>运动速度：</span><input class="saver-speed-range" type="range" min="55" max="190" value="${cfg.speed}"><output>${cfg.speed}%</output></label>
      <label><span>颜色：</span><select class="saver-color-select">
        <option value="aurora">极光</option><option value="blue">蓝色</option><option value="green">绿色</option>
        <option value="gold">金色</option><option value="mono">石墨色</option>
      </select></label>
      <p>这些设置会立即应用到预览、测试和自动启动的屏幕保护程序。</p>
      <footer><button class="aqua-btn default">完成</button></footer>`;
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
      app:'sysprefs', title:'屏幕保护程序选项', width:470, height:390,
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
      ['none','—'], ['all-windows','所有窗口'], ['application-windows','应用程序窗口'],
      ['desktop','桌面'], ['dashboard','Dashboard'], ['screensaver','启动屏幕保护程序'],
      ['disable-screensaver','停用屏幕保护程序'],
    ];
    const positions = [['tl','左上角'],['tr','右上角'],['bl','左下角'],['br','右下角']];
    const content = el('div', 'spp-pane hot-corner-editor');
    content.innerHTML = `<p>将指针移到屏幕角落并停留片刻，即可执行所选操作。</p>
      <div class="hot-corner-monitor"><span>Mac OS X</span>${positions.map(([cls,label], index) => `
        <label class="${cls}"><b>${label}</b><select data-corner="${index}">${actions.map(([value,name]) =>
          `<option value="${value}">${name}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="hot-corner-hint">触发角在整个 Leopard 桌面中生效。选择“停用屏幕保护程序”可在指针停留该角落时阻止自动启动。</p>
      <footer><button class="aqua-btn default">完成</button></footer>`;
    content.querySelectorAll('[data-corner]').forEach((select) => {
      const index = Number(select.dataset.corner);
      select.value = cfg.corners[index] || 'none';
      select.addEventListener('change', () => {
        cfg.corners[index] = select.value;
        saveScreenSaverConfig(cfg);
      });
    });
    hotCornersWindow = System.createWindow({
      app:'sysprefs', title:'活动的屏幕角', width:650, height:430,
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
    { id: 'appearance', name: '外观', group: '个人', build: buildAppearance },
    { id: 'desktop', name: '桌面与屏幕保护程序', group: '个人', fitWidth:760, fitMinHeight:520, fitInset:0, build: buildDesktopPane },
    { id: 'dock', name: 'Dock', group: '个人', fitMaxHeight:440, build: buildDockPane },
    { id: 'exposespaces', name: 'Exposé 与 Spaces', group: '个人', build: () => buildExtraPane('exposespaces') },
    { id: 'security', name: '安全性', group: '个人', build: () => buildExtraPane('security') },
    { id: 'spotlight', name: 'Spotlight', group: '个人', build: () => buildExtraPane('spotlight') },
    { id: 'international', name: '多语言环境', group: '个人', build: () => buildExtraPane('international') },
    { id: 'display', name: '显示器', group: '硬件', build: buildDisplay },
    { id: 'sound', name: '声音', group: '硬件', build: buildSound },
    { id: 'energy', name: '节能器', group: '硬件', build: buildEnergy },
    { id: 'keyboard', name: '键盘与鼠标', group: '硬件', build: () => buildExtraPane('keyboard') },
    { id: 'cd', name: 'CD 与 DVD', group: '硬件', build: () => buildExtraPane('cd') },
    { id: 'printfax', name: '打印与传真', group: '硬件', fitInset:0, build: () => buildExtraPane('printfax') },
    { id: 'dotmac', name: '.Mac', group: '互联网与无线', build: () => buildExtraPane('dotmac') },
    { id: 'network', name: '网络', group: '互联网与无线', fitInset:0, build: () => buildExtraPane('network') },
    { id: 'bluetooth', name: 'Bluetooth', group: '互联网与无线', fitInset:0, build: () => buildExtraPane('bluetooth') },
    { id: 'sharing', name: '共享', group: '互联网与无线', fitInset:0, build: () => buildExtraPane('sharing') },
    { id: 'accounts', name: '账户', group: '系统', build: buildAccounts },
    { id: 'datetime', name: '日期与时间', group: '系统', build: buildDateTime },
    { id: 'parental', name: '家长控制', group: '系统', fitInset:0, build: () => buildExtraPane('parental') },
    { id: 'update', name: '软件更新', group: '系统', build: buildUpdate },
    { id: 'speech', name: '语音', group: '系统', build: () => buildExtraPane('speech') },
    { id: 'startup', name: '启动磁盘', group: '系统', build: () => buildExtraPane('startup') },
    { id: 'timemachine', name: 'Time Machine', group: '系统', build: () => buildExtraPane('timemachine') },
    { id: 'universal', name: '万能辅助', group: '系统', build: () => buildExtraPane('universal') },
    { id: 'reset', name: '还原', group: '系统', build: buildReset },
  ];

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
      recentApps: 10, recentDocs: 10, recentServers: 10, smoothing: '自动 - 最适合主显示器', fontCutoff: 4,
    });
    c.innerHTML = `
      <div class="appearance-preview"><div class="mini-window"><header><i></i><i></i><i></i><b>预览</b></header><nav><button class="sel">个人收藏</button><button>设备</button></nav><main><button class="aqua-btn default">好</button><select><option>Leopard</option></select></main></div></div>
      <div class="appearance-options">
        <label><span>外观：</span><select class="spp-select appearance-choice"><option value="blue">蓝色</option><option value="graphite">石墨</option></select></label>
        <label><span>高亮颜色：</span><select class="spp-select highlight-choice"><option value="blue">蓝色</option><option value="graphite">石墨</option><option value="gold">金色</option><option value="green">绿色</option><option value="orange">橙色</option><option value="purple">紫色</option><option value="red">红色</option></select></label>
        <fieldset><legend>滚动箭头的位置</legend><label><input type="radio" name="arrows" value="together"> 一起位于底部</label><label><input type="radio" name="arrows" value="ends"> 位于顶端和底端</label></fieldset>
        <fieldset><legend>点按滚动条时</legend><label><input type="radio" name="track" value="next"> 跳到下一页</label><label><input type="radio" name="track" value="spot"> 跳到点按的位置</label></fieldset>
        <label class="spp-check"><input class="appearance-smooth" type="checkbox"> 使用平滑滚动</label>
        <label class="spp-check"><input class="appearance-titlebar" type="checkbox"> 连按窗口标题栏时最小化窗口</label>
      </div>
      <section class="appearance-recents">
        <h3>最近使用的项目数：</h3>
        <label>应用程序：<select class="spp-select recent-apps">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select></label>
        <label>文稿：<select class="spp-select recent-docs">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select></label>
        <label>服务器：<select class="spp-select recent-servers">${[0,5,10,15,20,30,50].map(n=>`<option>${n}</option>`).join('')}</select>
        <button class="aqua-btn clear-recents">清除最近使用的项目</button></label>
      </section>
      <section class="appearance-fonts">
        <label>字体平滑样式：<select class="spp-select smoothing-choice"><option>自动 - 最适合主显示器</option><option>标准 - 最适合 CRT</option><option>浅</option><option>中</option><option>强</option></select></label>
        <label>关闭字体平滑的字体大小：<select class="spp-select cutoff-choice">${[4,6,8,9,10,12].map(n=>`<option value="${n}">${n} 及以下</option>`).join('')}</select></label>
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
      Leopard.toast('外观', '最近使用的项目已经清除。');
    });
    return c;
  }

  // -- 桌面背景 --
  function buildDesktopPane() {
    const c = el('div', 'spp-pane desktop-saver-pane');
    c.innerHTML = `
      <div class="spp-tabs">
        <button class="active" data-tab="desktop">桌面</button>
        <button data-tab="saver">屏幕保护程序</button>
      </div>
      <section class="spp-tab-panel desktop-panel" data-panel="desktop">
        <aside class="wallpaper-sources"></aside>
        <main>
          <header class="wallpaper-current"><div></div><span><b></b><small>Apple Desktop Pictures</small></span></header>
          <div class="wallpaper-grid"></div>
          <footer>
            <label class="spp-check"><input class="wall-rotate" type="checkbox"> 更换图片：</label>
            <select class="spp-select wall-interval"><option value="5">每 5 分钟</option><option value="15">每 15 分钟</option><option value="30" selected>每 30 分钟</option><option value="60">每小时</option><option value="1440">每天</option></select>
            <label class="spp-check"><input class="wall-random" type="checkbox"> 随机顺序</label>
            <label class="spp-check"><input class="wall-translucent" type="checkbox"> 半透明菜单栏</label>
          </footer>
        </main>
        <input class="wallpaper-upload" type="file" accept="image/*" multiple hidden>
      </section>
      <section class="spp-tab-panel saver-panel" data-panel="saver" hidden>
        <aside class="saver-list"></aside>
        <main>
          <div class="saver-preview"><div class="saver-flurry"><i></i><i></i><i></i><i></i></div><b>Flurry</b></div>
          <div class="saver-actions"><button class="aqua-btn saver-options">选项…</button><button class="aqua-btn default saver-test">测试</button></div>
          <label class="spp-check"><input class="saver-random" type="checkbox"> 使用随机屏幕保护程序</label>
          <label class="spp-check"><input class="saver-clock" type="checkbox"> 与时钟一起显示</label>
          <div class="saver-delay"><span>启动屏幕保护程序：</span><input class="saver-delay-range" type="range" min="0" max="5" value="2"><small class="saver-delay-value">3 分钟</small><small>永不</small></div>
          <button class="aqua-btn saver-corners">触发角…</button>
        </main>
      </section>`;
    bindTabs(c);

    const folderWalls = () => (VFS.list('/用户/roll/图片') || []).map((name) => {
      const node = VFS.get(`/用户/roll/图片/${name}`);
      return node?.kind === 'image' && node.src
        ? { id: `user:${name}`, cat: '图片文件夹', name, css: `url(${node.src})` }
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
        tile.innerHTML = `<i></i><span>${w.name}</span>`;
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
      b.innerHTML = `<i>${cat === '纯色' ? '▦' : cat === '自然' ? '♣' : cat === '黑白' ? '◐' : '◆'}</i><span>${cat}</span>`;
      b.addEventListener('click', () => renderCategory(cat));
      sources.appendChild(b);
    });
    sources.insertAdjacentHTML('beforeend', '<hr><button class="wallpaper-import"><i>＋</i><span>选取文件夹…</span></button>');
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
        const base = file.name.replace(/\.[^.]+$/, '') || '桌面图片';
        const savedName = VFS.uniqueName('/用户/roll/图片', base, ext);
        VFS.putNode(`/用户/roll/图片/${savedName}`, { type: 'file', kind: 'image', src });
      }
      const folder = sources.querySelector('[data-cat="图片文件夹"]');
      if (folder) folder.click();
      else {
        const button = el('button', 'sel');
        button.dataset.cat = '图片文件夹';
        button.innerHTML = '<i>▧</i><span>图片文件夹</span>';
        button.addEventListener('click', () => renderCategory('图片文件夹'));
        sources.insertBefore(button, sources.querySelector('hr'));
        renderCategory('图片文件夹');
      }
      currentWall = allWalls().filter((wall) => wall.cat === '图片文件夹').at(-1) || currentWall;
      applyWallpaper(currentWall);
      showCurrent();
      renderCategory('图片文件夹');
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
      + `<h4>图片</h4><button data-saver="Pictures Folder" class="${saverCfg.selected === 'Pictures Folder' ? 'sel' : ''}"><i>▧</i>Pictures Folder</button>`;
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
    const delayLabel = (minutes) => minutes ? `${minutes} 分钟` : '永不';
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
    const cfg = System.dockCfg;
    const c = el('div', 'spp-pane dock-pref-pane');
    c.innerHTML = `
      <div class="dock-preview"><div class="dock-preview-shelf">${['finder','mail','safari','ichat','ical','itunes','sysprefs'].map(id=>`<i>${System.apps[id]?.icon||''}</i>`).join('')}</div></div>
      <div class="dock-control-grid">
        <label><span>大小：</span><small>小</small><input class="dock-size-range" type="range" min="32" max="64" value="${cfg.size}"><small>大</small></label>
        <label class="dock-mag-row"><span><input class="dock-mag-check" type="checkbox" ${cfg.magnify?'checked':''}> 放大：</span><small>最小</small><input class="dock-mag-range" type="range" min="110" max="190" value="${Math.round((cfg.magnifySize||1.42)*100)}"><small>最大</small></label>
        <fieldset><legend>屏幕上的位置</legend>${[['left','左边'],['bottom','底部'],['right','右边']].map(([value,label])=>`<label><input type="radio" name="dock-position" value="${value}" ${(cfg.position||'bottom')===value?'checked':''}> ${label}</label>`).join('')}</fieldset>
        <label class="dock-select-row"><span>最小化窗口时使用：</span><select class="spp-select dock-effect"><option value="genie">神奇效果</option><option value="scale">缩放效果</option></select></label>
        <label class="spp-check"><input class="dock-open-animate" type="checkbox" ${cfg.animateOpen!==false?'checked':''}> 打开应用程序时让图标跳动</label>
        <label class="spp-check"><input class="dock-autohide" type="checkbox" ${cfg.autoHide?'checked':''}> 自动隐藏和显示 Dock</label>
        <label class="spp-check"><input class="dock-indicators" type="checkbox" ${cfg.indicators!==false?'checked':''}> 为已打开的应用程序显示指示灯</label>
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
      { title: '显示器校准助理', text: '此助理将创建一个 ColorSync 显示描述文件。请让显示器预热，并关闭会改变屏幕颜色的功能。', art: '<div class="calibration-display"><i></i></div>' },
      { title: '调整原生 Gamma', text: '移动滑杆，使中央 Apple 图案尽量融入条纹背景。', art: '<div class="gamma-target"><i></i></div><label>Gamma：<input class="gamma-range" type="range" min="10" max="30" value="22"><b>2.2</b></label>' },
      { title: '选择目标白点', text: 'D65 是大多数 LCD 和网页内容的标准白点。', art: '<div class="whitepoint-options"><label><input type="radio" name="whitepoint" value="5000"> D50（暖）</label><label><input type="radio" name="whitepoint" value="6500" checked> D65（标准）</label><label><input type="radio" name="whitepoint" value="9300"> 9300K（冷）</label></div>' },
      { title: '为描述文件命名', text: '校准完成。输入名称以保存新的显示描述文件。', art: '<label class="profile-name">描述文件名称：<input class="aqua-input" value="Calibrated Color LCD"></label><div class="calibration-check">✓</div>' },
    ];
    let index = 0;
    c.innerHTML = '<aside><div class="colorsync-orb">◉</div><b>ColorSync</b></aside><main><h2></h2><p></p><section></section><footer><button class="aqua-btn calibration-cancel">取消</button><i></i><button class="aqua-btn calibration-back">返回</button><button class="aqua-btn default calibration-next">继续</button></footer></main>';
    const win = System.createWindow({ app:'sysprefs', title:'显示器校准助理', width:680, height:480, content:c, bodyBg:'#ececec', noResize:true });
    const render = () => {
      const step = steps[index];
      c.querySelector('h2').textContent = step.title;
      c.querySelector('main>p').textContent = step.text;
      c.querySelector('main>section').innerHTML = step.art;
      c.querySelector('.calibration-back').disabled = index === 0;
      c.querySelector('.calibration-next').textContent = index === steps.length - 1 ? '完成' : '继续';
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
      Leopard.toast('ColorSync', `已创建描述文件“${name}”。`);
    });
    render();
  }

  // -- 显示器 --
  function buildDisplay() {
    const c = el('div', 'spp-pane display-pane');
    const cfg = store('macweb.display', { brightness: 1, profile: 'Color LCD', showMenu: false });
    const monitor = `<svg viewBox="0 0 180 142" aria-hidden="true"><defs><linearGradient id="display-frame" x2="0" y2="1"><stop stop-color="#f7f8fa"/><stop offset=".5" stop-color="#aab0b9"/><stop offset=".53" stop-color="#6f7680"/><stop offset="1" stop-color="#d5d8dd"/></linearGradient><radialGradient id="display-screen" cx=".35" cy=".25"><stop stop-color="#8ed0ff"/><stop offset=".5" stop-color="#416eb4"/><stop offset="1" stop-color="#171f4d"/></radialGradient></defs><rect x="8" y="7" width="164" height="105" rx="9" fill="url(#display-frame)" stroke="#5c626b" stroke-width="2"/><rect x="14" y="13" width="152" height="91" rx="4" fill="url(#display-screen)"/><path d="M14 78Q55 35 89 67t77-30v67H14z" fill="#7045b5" opacity=".55"/><circle cx="90" cy="108" r="2" fill="#4f555d"/><path d="M73 112h34l6 18H67z" fill="url(#display-frame)" stroke="#777"/><rect x="57" y="130" width="66" height="6" rx="3" fill="#8b929b"/></svg>`;
    c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="display">显示器</button><button data-tab="color">颜色</button></div>
      <section class="spp-tab-panel display-main" data-panel="display">
        <div class="display-monitor">${monitor}<b>Color LCD</b><small>${screen.width} × ${screen.height} · ${devicePixelRatio.toFixed(1)}x</small></div>
        <div class="display-controls">
          <label><span>分辨率：</span><select class="spp-select display-resolution"><option>${screen.width} × ${screen.height}</option><option>1680 × 1050</option><option>1440 × 900</option><option>1280 × 800</option><option>1024 × 768</option></select></label>
          <label><span>颜色：</span><select class="spp-select"><option>百万种</option><option>数千种</option></select></label>
          <label><span>刷新率：</span><select class="spp-select"><option>${document.documentElement.dataset.refreshRate || 60} Hz</option><option>60 Hz</option></select></label>
          <label class="spp-check"><input type="checkbox" checked> 显示此显示器支持的模式</label>
        </div>
        <div class="display-brightness"><span>☀</span><input type="range" min="30" max="100" value="${Math.round(cfg.brightness * 100)}"><span class="large">☀</span></div>
        <label class="spp-check display-menu-check"><input type="checkbox" ${cfg.showMenu ? 'checked' : ''}> 在菜单栏中显示显示器</label>
        <button class="aqua-btn display-detect">检测显示器</button>
      </section>
      <section class="spp-tab-panel display-color" data-panel="color" hidden>
        <div class="color-profile-list"><header>显示描述文件</header>${['Color LCD','Adobe RGB (1998)','Generic RGB Profile','sRGB IEC61966-2.1'].map((name, i) => `<button class="${name === cfg.profile ? 'sel' : ''}">${i ? '◉' : '🌈'} <span>${name}</span></button>`).join('')}</div>
        <label class="spp-check"><input type="checkbox"> 仅显示此显示器的描述文件</label>
        <div class="color-profile-info"><b>${cfg.profile}</b><p>描述显示器的色彩响应。ColorSync 使用此描述文件让图像和文稿保持一致。</p></div>
        <button class="aqua-btn color-calibrate">校准…</button><button class="aqua-btn color-open">显示当前描述文件</button>
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
    c.querySelector('.display-detect').addEventListener('click', () => System.alertBox('显示器', `检测到 Color LCD\n${screen.width} × ${screen.height} · ${screen.colorDepth} 位颜色`));
    c.querySelector('.display-resolution').addEventListener('change', (event) => {
      if (!event.target.value.startsWith(String(screen.width))) System.alertBox('显示器', '网页版无法改变物理显示模式；已保留真实显示器分辨率。');
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
    c.querySelector('.color-open').addEventListener('click', () => System.alertBox(cfg.profile, `色域：${matchMedia('(color-gamut: p3)').matches ? 'Display P3' : 'sRGB'}\n颜色深度：${screen.colorDepth} 位`));
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
      <div class="spp-tabs"><button class="active" data-tab="effects">声音效果</button><button data-tab="output">输出</button><button data-tab="input">输入</button></div>
      <section class="spp-tab-panel sound-effects" data-panel="effects">
        <div class="sound-device-art">${speakerSvg(1)}<b>系统提示音</b></div>
        <div class="sound-effect-list">${Object.entries(BEEPS).map(([id,name])=>`<button data-sound="${id}" class="${cfg.beep===id?'sel':''}"><i>◉</i>${name}</button>`).join('')}</div>
        <label>通过以下设备播放声音效果：<select class="spp-select"><option>内置输出</option><option>Color LCD</option></select></label>
        <label class="sound-slider"><span>提示音音量：</span><i>${speakerSvg(0)}</i><input class="alert-volume" type="range" min="0" max="100" value="${Math.round(cfg.volume*100)}"><i>${speakerSvg(2)}</i></label>
        <label class="spp-check"><input type="checkbox" checked> 播放用户界面声音效果</label>
        <label class="spp-check"><input type="checkbox" checked> 更改音量时播放反馈</label>
      </section>
      <section class="spp-tab-panel sound-output" data-panel="output" hidden>
        <div class="sound-device-art">${outputDeviceSvg}<b>选择声音输出设备</b></div>
        <div class="sound-device-list"><header><span>名称</span><span>类型</span></header><button data-device="built-in" class="${(cfg.output||'built-in')==='built-in'?'sel':''}"><span>内置扬声器</span><span>内置输出</span></button><button data-device="display" class="${cfg.output==='display'?'sel':''}"><span>Color LCD</span><span>DisplayPort</span></button></div>
        <label class="sound-slider"><span>平衡：</span><b>左</b><input class="sound-balance" type="range" min="0" max="100" value="${cfg.balance}"><b>右</b></label>
        <label class="sound-slider"><span>输出音量：</span><i>${speakerSvg(0)}</i><input class="output-volume" type="range" min="0" max="100" value="${Math.round(cfg.volume*100)}"><i>${speakerSvg(2)}</i></label>
        <label class="spp-check"><input class="sound-mute" type="checkbox" ${cfg.muted?'checked':''}> 静音</label>
      </section>
      <section class="spp-tab-panel sound-input" data-panel="input" hidden>
        <div class="sound-device-art sound-mic">${microphoneSvg}<b>选择声音输入设备</b></div>
        <div class="sound-device-list"><header><span>名称</span><span>类型</span></header><button class="sel input-device"><span>浏览器麦克风</span><span>内置</span></button></div>
        <label class="sound-slider"><span>输入音量：</span><input class="input-volume" type="range" min="0" max="100" value="${cfg.input}"></label>
        <div class="input-level"><span>输入电平：</span><div class="input-meter"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><output class="input-db">−∞ dB</output></div>
        <div class="sound-input-control"><button class="aqua-btn default input-monitor-toggle">开始监听</button><p class="sound-input-status">点按“开始监听”将请求麦克风权限并显示真实输入电平。</p></div>
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
    const stopInput = (message = '监听已停止。') => {
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
      if (button) { button.disabled = false; button.textContent = '开始监听'; }
      if (status && message) status.textContent = message;
    };
    const startInput = async () => {
      const status = c.querySelector('.sound-input-status');
      const button = c.querySelector('.input-monitor-toggle');
      if (soundInputStream) { stopInput(); return; }
      if (soundInputPending) return;
      if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
        status.textContent = '此浏览器不支持实时麦克风输入。';
        return;
      }
      const run = ++soundInputRun;
      soundInputPending = true;
      button.disabled = true;
      button.textContent = '正在连接…';
      status.textContent = '正在请求麦克风权限…';
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
        button.textContent = '停止监听';
        status.textContent = `正在监听“${track?.label || '浏览器麦克风'}”；电平来自实时输入。`;
        track?.addEventListener('mute', () => { if (run === soundInputRun) status.textContent = '麦克风输入暂时静音。'; });
        track?.addEventListener('unmute', () => { if (run === soundInputRun) status.textContent = `正在监听“${track.label || '浏览器麦克风'}”；电平来自实时输入。`; });
        track?.addEventListener('ended', () => { if (run === soundInputRun) stopInput('麦克风设备已断开。'); });
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
            ? '麦克风权限未授予。请在浏览器地址栏中允许后点按“开始监听”。'
            : `无法打开麦克风${error?.message ? `：${error.message}` : '。'}`);
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
    wakeAction: '启动或唤醒',
    wakeDays: '工作日',
    wakeTime: '08:00',
    sleepEnabled: false,
    sleepAction: '睡眠',
    sleepDays: '每天',
    sleepTime: '23:00',
  });

  function normalizeEnergySchedule(cfg) {
    cfg.schedule = Object.assign({}, ENERGY_SCHEDULE_DEFAULTS, cfg.schedule || {});
    return cfg.schedule;
  }

  function energyDayMatches(mode, date) {
    const day = date.getDay();
    if (mode === '每天') return true;
    if (mode === '工作日') return day >= 1 && day <= 5;
    if (mode === '周末') return day === 0 || day === 6;
    const names = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
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
      : '没有启用的定时事件';
  }

  function closeEnergySleepOverlay() {
    if (!energySleepOverlay) return;
    const overlay = energySleepOverlay;
    energySleepOverlay = null;
    overlay._cleanup?.();
    overlay.classList.add('waking');
    setTimeout(() => overlay.remove(), 260);
  }

  function showEnergySleepOverlay() {
    if (energySleepOverlay) return;
    const overlay = el('div', 'energy-sleep-overlay');
    overlay.innerHTML = `<div class="energy-sleep-pulse"></div><p>Mac 已按定时进入睡眠</p><small>点按或按任意键唤醒</small>`;
    const wake = () => {
      closeEnergySleepOverlay();
      Leopard.toast('节能器', '已从睡眠中唤醒。');
    };
    const cleanup = () => removeEventListener('keydown', wake);
    overlay._cleanup = cleanup;
    addEventListener('keydown', wake);
    overlay.addEventListener('pointerdown', wake, { once:true });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('shown'));
    energySleepOverlay = overlay;
  }

  function runEnergyScheduleAction(entry) {
    if (entry.id === 'wake') {
      closeEnergySleepOverlay();
      Leopard.toast('节能器', `已按定时${entry.action}。`);
      return;
    }
    if (entry.action === '睡眠') {
      showEnergySleepOverlay();
      return;
    }
    const restart = entry.action === '重新启动';
    System.confirmBox({
      title: entry.action,
      text: `电脑已到达定时${entry.action}时间。`,
      okLabel: entry.action,
      countdown: 60,
      countdownVerb: entry.action,
      onOK: () => System.shutdownSequence(restart),
    });
  }

  function checkEnergySchedule() {
    const cfg = store('macweb.energy', {});
    const now = new Date();
    const schedule = normalizeEnergySchedule(cfg);
    energyScheduleEntries(schedule).forEach((entry) => {
      if (!entry.enabled || !energyDayMatches(entry.days, now)) return;
      const current = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      if (entry.time !== current) return;
      const marker = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${current}-${entry.action}`;
      const key = `macweb.energy.last.${entry.id}`;
      if (sessionStorage.getItem(key) === marker) return;
      sessionStorage.setItem(key, marker);
      runEnergyScheduleAction(entry);
    });
  }

  function installEnergyScheduleRuntime() {
    clearInterval(energyScheduleTimer);
    checkEnergySchedule();
    energyScheduleTimer = setInterval(checkEnergySchedule, 15000);
  }

  function openEnergySchedule(cfg, onChange) {
    if (energyScheduleWin?.isConnected) {
      System.focusWindow(energyScheduleWin);
      return;
    }
    const draft = Object.assign({}, normalizeEnergySchedule(cfg));
    const c = el('div', 'energy-schedule-dialog');
    const dayOptions = ['每天','工作日','周末','星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
    const optionList = (items, selected) => items.map((item) => `<option ${item === selected ? 'selected' : ''}>${item}</option>`).join('');
    c.innerHTML = `
      <header><div class="energy-clock-art"><i></i><b></b></div><div><h2>定时</h2><p>设定这台 Mac 自动启动、唤醒、睡眠、重新启动或关机的时间。</p></div></header>
      <main>
        <div class="energy-schedule-head"><span></span><span>操作</span><span>日期</span><span>时间</span></div>
        <label class="energy-schedule-row" data-row="wake">
          <input class="schedule-enabled" type="checkbox" ${draft.wakeEnabled ? 'checked' : ''}>
          <select class="spp-select schedule-action">${optionList(['启动或唤醒','启动','唤醒'], draft.wakeAction)}</select>
          <select class="spp-select schedule-days">${optionList(dayOptions, draft.wakeDays)}</select>
          <input class="aqua-input schedule-time" type="time" value="${draft.wakeTime}">
        </label>
        <label class="energy-schedule-row" data-row="sleep">
          <input class="schedule-enabled" type="checkbox" ${draft.sleepEnabled ? 'checked' : ''}>
          <select class="spp-select schedule-action">${optionList(['睡眠','重新启动','关机'], draft.sleepAction)}</select>
          <select class="spp-select schedule-days">${optionList(dayOptions, draft.sleepDays)}</select>
          <input class="aqua-input schedule-time" type="time" value="${draft.sleepTime}">
        </label>
        <div class="energy-next-event"></div>
        <p class="energy-schedule-note">定时操作只影响这个 Leopard 虚拟桌面；关机或重新启动前会显示 60 秒提醒。</p>
      </main>
      <footer><button class="aqua-btn energy-schedule-cancel">取消</button><button class="aqua-btn default energy-schedule-save">好</button></footer>`;
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
        ? `<b>下一个事件：</b>${next.entry.action} — ${next.date.toLocaleString('zh-CN', { weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}`
        : '<b>下一个事件：</b>未安排';
    };
    c.querySelectorAll('input,select').forEach((control) => control.addEventListener('change', readRows));
    readRows();
    energyScheduleWin = System.createWindow({
      app:'sysprefs', title:'定时', width:660, height:430, content:c, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:390, maxHeight:500 },
      onClose:() => { energyScheduleWin = null; },
    });
    c.querySelector('.energy-schedule-cancel').addEventListener('click', () => System.closeWindow(energyScheduleWin));
    c.querySelector('.energy-schedule-save').addEventListener('click', () => {
      readRows();
      cfg.schedule = Object.assign({}, draft);
      save('macweb.energy', cfg);
      installEnergyScheduleRuntime();
      onChange?.(cfg.schedule);
      System.closeWindow(energyScheduleWin);
    });
  }

  function buildEnergy() {
    const c = el('div', 'spp-pane energy-pane');
    const cfg = store('macweb.energy', { sleepMin: 0, computerSleep: 0, diskSleep: true, wakeNetwork: true, dim: true, showMenu: false });
    const schedule = normalizeEnergySchedule(cfg);
    const options = [[0,'永不'],[1,'1 分钟'],[5,'5 分钟'],[15,'15 分钟'],[30,'30 分钟'],[60,'1 小时'],[120,'2 小时']];
    c.innerHTML = `
      <div class="energy-bulb"><span></span><b>节能器</b></div>
      <section class="spp-pref-card">
        <label>电脑睡眠：<select class="spp-select computer-sleep">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
        <label>显示器睡眠：<select class="spp-select display-sleep">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
        <label class="spp-check"><input class="disk-sleep" type="checkbox"> 尽可能使硬盘进入睡眠</label>
        <label class="spp-check"><input class="wake-network" type="checkbox"> 唤醒以供网络访问</label>
        <label class="spp-check"><input class="dim-display" type="checkbox"> 显示器睡眠前自动降低亮度</label>
      </section>
      <div class="energy-actions"><div><button class="aqua-btn energy-schedule">定时…</button><small class="energy-schedule-summary">${energyScheduleSummary(schedule)}</small></div><label class="spp-check"><input class="energy-menu" type="checkbox"> 在菜单栏中显示节能器状态</label></div>`;
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
    head.innerHTML = `<div class="spp-avatar">R</div><div><b>roll</b><div class="spp-hint" style="margin:2px 0 0">管理员 · 自动登录已开启</div></div>`;
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
      lb.insertAdjacentHTML('beforeend', `<span class="spp-li-icon">${a.icon}</span> ${a.name}`);
      list.appendChild(lb);
    });
    c.appendChild(row('登录项:', list, '勾选的应用会在开机（刷新页面）后自动打开。'));
    return c;
  }

  // -- 日期与时间 --
  function buildDateTime() {
    const c = el('div', 'spp-pane datetime-pane');
    const cfg = store('macweb.clock', { h24: true, showDay: true, showDate: false, showSec: false });
    const now = new Date();
    const days = ['日','一','二','三','四','五','六'];
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const calendar = Array(first.getDay()).fill('').concat(Array.from({length:count},(_,i)=>i+1));
    while (calendar.length % 7) calendar.push('');
    c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="date">日期与时间</button><button data-tab="zone">时区</button><button data-tab="clock">时钟</button></div>
      <section class="spp-tab-panel datetime-main" data-panel="date">
        <label class="spp-check datetime-auto"><input type="checkbox" checked> 自动设置日期与时间：<select class="spp-select"><option>Apple 亚洲 (time.asia.apple.com)</option><option>Apple 美国 (time.apple.com)</option><option>Apple 欧洲 (time.euro.apple.com)</option></select></label>
        <div class="date-calendar"><header><button>‹</button><b>${now.getFullYear()} 年 ${now.getMonth()+1} 月</b><button>›</button></header><div class="calendar-grid">${days.map(d=>`<strong>${d}</strong>`).join('')}${calendar.map(d=>`<i class="${d===now.getDate()?'today':''}">${d}</i>`).join('')}</div></div>
        <div class="analog-clock"><i class="hour"></i><i class="minute"></i><i class="second"></i><b></b></div>
        <div class="digital-time"><input value="${String(now.getHours()).padStart(2,'0')}"><b>:</b><input value="${String(now.getMinutes()).padStart(2,'0')}"><b>:</b><input value="${String(now.getSeconds()).padStart(2,'0')}"></div>
      </section>
      <section class="spp-tab-panel timezone-panel" data-panel="zone" hidden>
        <div class="timezone-map"><span class="timezone-pin"></span></div>
        <label>最近的城市：<select class="spp-select timezone-city"><option value="Asia/Shanghai">上海 - 中国</option><option value="Asia/Kuching">古晋 - 马来西亚</option><option value="Asia/Tokyo">东京 - 日本</option><option value="America/Los_Angeles">库比蒂诺 - 美国</option><option value="Europe/London">伦敦 - 英国</option></select></label>
        <p>当前时区：<b>${Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'}</b></p>
      </section>
      <section class="spp-tab-panel clock-panel" data-panel="clock" hidden>
        <fieldset><legend>日期与时间格式</legend>
          <label class="spp-check"><input data-clock="h24" type="checkbox"> 使用 24 小时制</label>
          <label class="spp-check"><input data-clock="showDay" type="checkbox"> 显示星期</label>
          <label class="spp-check"><input data-clock="showDate" type="checkbox"> 显示日期</label>
          <label class="spp-check"><input data-clock="showSec" type="checkbox"> 显示秒</label>
        </fieldset>
        <fieldset><legend>语音报时</legend><label class="spp-check"><input type="checkbox"> 整点报时</label><label>自定语音：<select class="spp-select"><option>Alex</option><option>系统默认语音</option></select></label></fieldset>
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
      c.querySelector('.analog-clock .hour').style.transform = `translateX(-50%) rotate(${hour}deg)`;
      c.querySelector('.analog-clock .minute').style.transform = `translateX(-50%) rotate(${date.getMinutes()*6}deg)`;
      c.querySelector('.analog-clock .second').style.transform = `translateX(-50%) rotate(${date.getSeconds()*6}deg)`;
      const inputs = c.querySelectorAll('.digital-time input');
      [date.getHours(),date.getMinutes(),date.getSeconds()].forEach((value,index)=>{ inputs[index].value=String(value).padStart(2,'0'); });
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
    const p = el('p', 'spp-hint', `上次检查：${new Date().toLocaleDateString('zh-CN')} — 您的软件已是最新版本。`);
    p.style.marginBottom = '12px';
    const btn = el('button', 'aqua-btn default', '立即检查');
    btn.addEventListener('click', () => {
      btn.disabled = true; btn.textContent = '正在检查…';
      setTimeout(() => {
        btn.disabled = false; btn.textContent = '立即检查';
        System.alertBox('软件更新', 'Mac OS X 10.5 Web — 没有可用的更新。\n您的软件已是最新版本。');
      }, 1200);
    });
    c.append(p, btn);
    return c;
  }

  // -- 还原 --
  function buildReset() {
    const c = el('div', 'spp-pane');
    c.appendChild(el('p', 'spp-hint', '将备忘录、便笺、文件、日历、壁纸、Dock 等全部本地数据恢复为出厂状态。'));
    const btn = el('button', 'aqua-btn', '重置所有数据…');
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => {
      System.confirmBox({
        title: '还原', text: '确定要清除全部本地数据并重新启动吗？此操作无法撤销。',
        okLabel: '重置并重启',
        onOK: () => {
          Object.keys(localStorage).filter((k) => k.startsWith('macweb.')).forEach((k) => localStorage.removeItem(k));
          System.shutdownSequence(true);
        },
      });
    });
    c.appendChild(btn);
    const about = el('p', 'spp-hint', 'Mac OS X 10.5 Leopard · Web Edition — 纯前端实现（HTML + CSS + Vanilla JS，零依赖），数据存储于浏览器 localStorage。');
    about.style.marginTop = '18px';
    c.appendChild(about);
    return c;
  }

  const NETWORK_SERVICE_DEFAULTS = Object.freeze([
    { id:'airport', name:'AirPort', detail:'Leopard Web · 已连接', icon:'◉' },
    { id:'ethernet', name:'以太网', detail:'未连接', icon:'↔' },
    { id:'bluetooth', name:'Bluetooth PAN', detail:'未连接', icon:'ᛒ' },
    { id:'firewire', name:'FireWire', detail:'未连接', icon:'⌁' },
  ]);

  function networkServices(cfg) {
    const custom = Array.isArray(cfg.customServices) ? cfg.customServices : [];
    const removed = new Set(Array.isArray(cfg.removedServices) ? cfg.removedServices : []);
    return [
      ...NETWORK_SERVICE_DEFAULTS.filter((service) => service.id === 'airport' || !removed.has(service.id)),
      ...custom.map((service) => ({
        id:String(service.id || `custom-${service.name}`),
        name:String(service.name || '网络服务'),
        detail:'未配置',
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
      <header><div class="network-order-orb">↕</div><div><h2>设定服务顺序</h2><p>按连接优先级排列网络服务。Mac OS X 会从列表顶部开始尝试。</p></div></header>
      <main><div class="network-order-list" role="listbox"></div><div class="network-order-actions"><button class="aqua-btn order-up" title="上移">▲</button><button class="aqua-btn order-down" title="下移">▼</button></div>
      <p class="network-order-note">AirPort 当前连接到 Leopard Web。拖动的网页等效操作由右侧箭头完成。</p></main>
      <footer><button class="aqua-btn order-cancel">取消</button><button class="aqua-btn default order-apply">好</button></footer>`;
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
      app:'sysprefs', title:'服务顺序', width:580, height:470, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { networkServiceOrderWin = null; },
    });
    c.querySelector('.order-cancel').addEventListener('click', () => System.closeWindow(networkServiceOrderWin));
    c.querySelector('.order-apply').addEventListener('click', () => {
      cfg.serviceOrder = order.slice();
      save('macweb.pref.network', cfg);
      onApply?.(cfg.serviceOrder);
      System.closeWindow(networkServiceOrderWin);
      Leopard.toast('网络', '网络服务顺序已经更新。');
    });
    render();
  }

  function normalizedPreferredNetworks(cfg) {
    const saved = Array.isArray(cfg.preferredNetworks) ? cfg.preferredNetworks : [];
    const normalized = saved.map((network) => typeof network === 'string'
      ? { name:network, security:'WPA2 个人级', autoJoin:true }
      : {
          name:String(network?.name || '').trim(),
          security:String(network?.security || 'WPA2 个人级'),
          autoJoin:network?.autoJoin !== false,
        }).filter((network) => network.name);
    return normalized.length ? normalized : [{ name:'Leopard Web', security:'WPA2 个人级', autoJoin:true }];
  }

  function openPreferredNetworkSheet(parent, network, onCommit) {
    const form = el('div', 'preferred-network-sheet');
    form.innerHTML = `
      <label><span>网络名称：</span><input class="aqua-input preferred-name" value=""></label>
      <label><span>无线安全性：</span><select class="spp-select preferred-security"><option>WPA2 个人级</option><option>WPA/WPA2 个人级</option><option>WEP</option><option>无</option></select></label>
      <label class="spp-check"><input class="preferred-auto" type="checkbox" checked> 自动加入此网络</label>
      <label class="preferred-password-row"><span>密码：</span><input class="aqua-input" type="password" placeholder="已安全存储"></label>
      <p class="aqua-sheet-error"></p>`;
    form.querySelector('.preferred-name').value = network?.name || '';
    form.querySelector('.preferred-security').value = network?.security || 'WPA2 个人级';
    form.querySelector('.preferred-auto').checked = network?.autoJoin !== false;
    System.showSheet({
      parent,
      title:network ? '编辑首选网络' : '加入首选网络',
      content:form,
      className:'preferred-network-aqua-sheet',
      initialFocus:form.querySelector('.preferred-name'),
      buttons:[
        { label:'取消', cancel:true },
        { label:network ? '好' : '添加', default:true, action:() => {
          const name = form.querySelector('.preferred-name').value.trim();
          if (!name) {
            form.querySelector('.aqua-sheet-error').textContent = '请输入网络名称。';
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
      ipv4: '使用 DHCP', ip: '192.168.1.105', mask: '255.255.255.0', router: '192.168.1.1',
      dns: ['192.168.1.1', '1.1.1.1'], search: ['local'], mtu: '标准 (1500)',
    }, cfg.advanced || {});
    const preferred = normalizedPreferredNetworks(cfg).map((network) => ({ ...network }));
    c.innerHTML = `
      <div class="spp-tabs network-advanced-tabs">
        <button class="active" data-tab="airport">AirPort</button><button data-tab="tcpip">TCP/IP</button>
        <button data-tab="dns">DNS</button><button data-tab="wins">WINS</button>
        <button data-tab="appletalk">AppleTalk</button><button data-tab="proxies">代理</button><button data-tab="ethernet">以太网</button>
      </div>
      <section class="spp-tab-panel" data-panel="airport">
        <h3>首选网络：</h3><div class="network-table preferred-networks"><header><span>网络名称</span><span>安全性</span></header>
        </div>
        <div class="table-controls preferred-controls"><button class="aqua-btn network-add">＋</button><button class="aqua-btn network-remove">－</button><button class="aqua-btn network-edit">✎</button><i></i><button class="aqua-btn preferred-up">▲</button><button class="aqua-btn preferred-down">▼</button></div>
        <label class="spp-check"><input class="remember-networks" type="checkbox" ${cfg.rememberNetworks === false ? '' : 'checked'}> 记住这台电脑加入过的网络</label>
        <label class="spp-check"><input class="admin-disconnect" type="checkbox" ${cfg.adminDisconnect ? 'checked' : ''}> 断开无线网络连接时需要管理员密码</label>
      </section>
      <section class="spp-tab-panel tcpip-panel" data-panel="tcpip" hidden>
        <label>配置 IPv4：<select class="spp-select net-ipv4"><option>使用 DHCP</option><option>使用 DHCP（手动地址）</option><option>手动</option><option>关闭</option></select></label>
        <label>IPv4 地址：<input class="aqua-input net-ip" value="${advanced.ip}"></label>
        <label>子网掩码：<input class="aqua-input net-mask" value="${advanced.mask}"></label>
        <label>路由器：<input class="aqua-input net-router" value="${advanced.router}"></label>
        <label>配置 IPv6：<select class="spp-select"><option>自动</option><option>手动</option><option>关闭</option></select></label>
        <button class="aqua-btn dhcp-renew">续租 DHCP 租约</button>
      </section>
      <section class="spp-tab-panel" data-panel="dns" hidden>
        <div class="network-columns"><div><h3>DNS 服务器：</h3><div class="network-edit-list dns-list">${advanced.dns.map((item)=>`<button>${item}</button>`).join('')}</div><div class="table-controls"><button class="aqua-btn list-add">＋</button><button class="aqua-btn list-remove">－</button></div></div>
        <div><h3>搜索域：</h3><div class="network-edit-list search-list">${advanced.search.map((item)=>`<button>${item}</button>`).join('')}</div><div class="table-controls"><button class="aqua-btn domain-add">＋</button><button class="aqua-btn domain-remove">－</button></div></div></div>
      </section>
      <section class="spp-tab-panel wins-panel" data-panel="wins" hidden>
        <label>NetBIOS 名称：<input class="aqua-input" value="ROLL-MAC"></label><label>工作组：<input class="aqua-input" value="WORKGROUP"></label>
        <h3>WINS 服务器：</h3><div class="network-edit-list"><button>192.168.1.1</button></div>
      </section>
      <section class="spp-tab-panel" data-panel="appletalk" hidden><label class="spp-check"><input type="checkbox"> 启用 AppleTalk</label><p>AppleTalk 会在本地网络上自动发现旧式 Mac 和打印机。</p></section>
      <section class="spp-tab-panel proxies-panel" data-panel="proxies" hidden>
        <div>${['自动代理发现','自动代理配置','网页代理 (HTTP)','安全网页代理 (HTTPS)','FTP 代理','SOCKS 代理','流代理 (RTSP)','Gopher 代理'].map((name)=>`<label class="spp-check"><input type="checkbox"> ${name}</label>`).join('')}</div>
        <label>忽略这些主机与域的代理设置：<textarea class="aqua-input">*.local, 169.254/16</textarea></label>
      </section>
      <section class="spp-tab-panel ethernet-panel" data-panel="ethernet" hidden>
        <label>配置：<select class="spp-select"><option>自动</option><option>手动</option></select></label><label>速度：<select class="spp-select"><option>自动选择</option><option>1000baseT</option><option>100baseTX</option></select></label>
        <label>双工：<select class="spp-select"><option>全双工、流控制</option><option>全双工</option></select></label><label>MTU：<select class="spp-select net-mtu"><option>标准 (1500)</option><option>巨帧 (9000)</option><option>自定</option></select></label>
      </section>
      <footer><button class="aqua-btn network-cancel">取消</button><button class="aqua-btn default network-ok">好</button></footer>`;
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
        if (!network.autoJoin) name.appendChild(el('small', '', '（手动加入）'));
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
        parent:win, title:'添加项目', message:label, okLabel:'添加',
        onOK:(value)=>c.querySelector(selector).appendChild(el('button','',value)),
      });
    };
    c.querySelector('.list-add').addEventListener('click', () => addListItem('.dns-list', 'DNS 服务器地址：'));
    c.querySelector('.domain-add').addEventListener('click', () => addListItem('.search-list', '搜索域：'));
    c.querySelector('.list-remove').addEventListener('click', () => c.querySelector('.dns-list .sel')?.remove());
    c.querySelector('.domain-remove').addEventListener('click', () => c.querySelector('.search-list .sel')?.remove());
    c.querySelector('.network-add').addEventListener('click', () => openPreferredNetworkSheet(win, null, (network) => {
      if (preferred.some((item) => item.name.toLowerCase() === network.name.toLowerCase())) {
        Leopard.toast('AirPort', '这个网络已经在首选列表中。');
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
        Leopard.toast('AirPort', '当前连接的 Leopard Web 不能从首选列表移除。');
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
    c.querySelector('.dhcp-renew').addEventListener('click', () => Leopard.toast('网络', 'DHCP 租约已经续租。'));
    const win = System.createWindow({ app: 'sysprefs', title: 'AirPort 高级设置', width: 690, height: 520, content: c, bodyBg: '#ececec', noResize: true });
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
      Leopard.toast('网络', '高级网络设置已经应用。');
    });
  }

  const printerSvg = `<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="printer-body" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#cbd0d6"/><stop offset=".52" stop-color="#858c95"/><stop offset="1" stop-color="#e4e7ea"/></linearGradient></defs><path d="M29 9h38v27H29z" fill="#f7fbff" stroke="#737b84"/><path d="M18 31h60q8 0 8 8v31H10V39q0-8 8-8z" fill="url(#printer-body)" stroke="#626a73" stroke-width="2"/><rect x="20" y="54" width="56" height="31" rx="2" fill="#fbfdff" stroke="#78818b"/><path d="M27 63h42M27 70h35M27 77h39" stroke="#92a7b8" stroke-width="2"/><circle cx="72" cy="43" r="3" fill="#57b94b"/><path d="M24 36h48" stroke="#fff" stroke-width="2" opacity=".8"/></svg>`;

  function openPrintQueue() {
    const c = el('div', 'print-queue-window');
    c.innerHTML = `<header><div>${printerSvg}<span><b>Web PDF Printer</b><small>打印机已就绪</small></span></div><button class="aqua-btn queue-pause">暂停打印机</button></header>
      <div class="print-job-table"><div class="head"><span>状态</span><span>名称</span><span>用户</span><span>已提交</span><span>页数</span></div><div class="empty">没有正在打印的作业</div></div>
      <footer><button class="aqua-btn queue-delete" disabled>删除</button><button class="aqua-btn queue-hold" disabled>保留</button><span></span><button class="aqua-btn queue-test">打印测试页</button></footer>`;
    const queue = c.querySelector('.print-job-table');
    c.querySelector('.queue-pause').addEventListener('click', (event) => {
      event.currentTarget.classList.toggle('paused');
      event.currentTarget.textContent = event.currentTarget.classList.contains('paused') ? '继续打印机' : '暂停打印机';
    });
    c.querySelector('.queue-test').addEventListener('click', () => {
      queue.querySelector('.empty')?.remove();
      const job = el('button', 'print-job');
      job.innerHTML = `<span>打印中</span><span>Mac OS X 测试页</span><span>roll</span><span>${new Date().toLocaleTimeString('zh-CN')}</span><span>1</span>`;
      queue.appendChild(job);
      setTimeout(() => {
        if (!job.isConnected) return;
        const name = VFS.uniqueName('/用户/roll/下载', 'Mac OS X 打印机测试页', '.pdf');
        const src = makeTestPdf();
        VFS.putNode(`/用户/roll/下载/${name}`, { type:'file', kind:'pdf', src, content:'Mac OS X Leopard Web Printer Test Page' });
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
        job.querySelector('span').textContent = '已完成';
        job.querySelectorAll('span')[1].textContent = name;
        Leopard.toast('打印机', `“${name}”已保存到下载文件夹。`);
      }, 1200);
    });
    System.createWindow({ app: 'sysprefs', title: 'Web PDF Printer', width: 760, height: 470, content: c, bodyBg: '#ececec' });
  }

  function openPrinterBrowser() {
    const c = el('div', 'printer-browser');
    c.innerHTML = `<div class="spp-tabs"><button class="active" data-tab="default">默认</button><button data-tab="fax">传真</button><button data-tab="ip">IP</button><button data-tab="windows">Windows</button></div>
      <section class="spp-tab-panel" data-panel="default"><div class="printer-discovery"><header><span>打印机名称</span><span>种类</span></header><button class="sel"><span>Web PDF Printer</span><span>虚拟 PostScript</span></button><button><span>AirPrint Demo</span><span>Bonjour</span></button></div><p>正在搜索新的打印机…</p></section>
      <section class="spp-tab-panel" data-panel="fax" hidden><p>没有检测到调制解调器。您仍可添加网络传真设备。</p></section>
      <section class="spp-tab-panel printer-ip" data-panel="ip" hidden><label>协议：<select class="spp-select"><option>行式打印机守护程序 - LPD</option><option>Internet 打印协议 - IPP</option><option>HP Jetdirect - Socket</option></select></label><label>地址：<input class="aqua-input"></label><label>队列：<input class="aqua-input"></label><label>名称：<input class="aqua-input"></label></section>
      <section class="spp-tab-panel" data-panel="windows" hidden><p>选择一个 Windows 工作组以浏览共享打印机。</p><div class="printer-discovery"><button>WORKGROUP</button></div></section>
      <footer><button class="aqua-btn printer-cancel">取消</button><button class="aqua-btn default printer-add-confirm">添加</button></footer>`;
    bindTabs(c);
    const win = System.createWindow({ app: 'sysprefs', title: '打印机浏览器', width: 650, height: 470, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.printer-cancel').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.printer-add-confirm').addEventListener('click', () => { System.closeWindow(win); Leopard.toast('打印与传真', '打印机已经添加。'); });
  }

  function openBluetoothAssistant(cfg, onDevice) {
    const c = el('div', 'bluetooth-assistant');
    c.innerHTML = `<aside><div class="bt-orb">ᛒ</div></aside><main><h2>Bluetooth 设置助理</h2><p>让设备进入可被发现模式，然后点按“继续”。浏览器只会在您确认后连接所选设备。</p>
      <div class="bluetooth-scan-state"><i></i><span>准备搜索附近的 Bluetooth 设备</span></div>
      <footer><button class="aqua-btn bt-cancel">取消</button><button class="aqua-btn default bt-scan">继续</button></footer></main>`;
    const win = System.createWindow({ app: 'sysprefs', title: 'Bluetooth 设置助理', width: 650, height: 430, content: c, bodyBg: '#ececec', noResize: true });
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
      status.querySelector('span').textContent = '正在搜索设备…';
      if (!navigator.bluetooth?.requestDevice) {
        status.classList.remove('scanning');
        status.querySelector('span').textContent = '此浏览器未提供 Web Bluetooth；请使用 Chromium 并通过安全来源打开。';
        return;
      }
      try {
        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
        const name = device.name || 'Bluetooth 设备';
        cfg.devices = Array.from(new Set([...(cfg.devices || []), name]));
        save('macweb.pref.bluetooth', cfg);
        status.classList.remove('scanning');
        status.innerHTML = '<b>✓</b><span></span>';
        status.querySelector('span').textContent = `已找到“${name}”`;
        onDevice?.(name);
        done = true;
        scanButton.textContent = '完成';
      } catch (error) {
        status.classList.remove('scanning');
        status.querySelector('span').textContent = error?.name === 'NotFoundError' ? '没有选择设备。您可以再次尝试。' : 'Bluetooth 授权失败或设备不可用。';
      }
    });
  }

  function bluetoothPairedDevices(cfg) {
    return [...new Set(['Apple Wireless Keyboard', 'Mighty Mouse', ...(cfg.devices || [])])];
  }

  function bluetoothSizeLabel(bytes) {
    if (bytes < 1024) return `${bytes} 字节`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function openBluetoothTransfer(cfg, path, node, preferredDevice) {
    if (bluetoothTransferWin?.isConnected) {
      System.focusWindow(bluetoothTransferWin);
      Leopard.toast('Bluetooth 文件交换', '请先完成或取消当前传输。');
      return;
    }
    const devices = bluetoothPairedDevices(cfg);
    const name = VFS.baseName(path);
    const size = VFS.sizeOf(path);
    const c = el('div', 'bluetooth-transfer-dialog');
    c.innerHTML = `
      <header><div class="bt-transfer-icon">ᛒ</div><div><h2>Bluetooth 文件交换</h2><p>将一个文件发送到附近的已配对设备。</p></div></header>
      <main>
        <div class="bt-transfer-file"><div class="bt-file-glyph">▤</div><span><b></b><small></small></span></div>
        <label><span>发送到：</span><select class="spp-select bt-transfer-device"></select></label>
        <div class="bt-transfer-progress"><i></i></div>
        <p class="bt-transfer-status">准备发送</p>
        <details><summary>传输详细信息</summary><dl><dt>来源</dt><dd></dd><dt>方法</dt><dd>Bluetooth 对象交换（虚拟）</dd><dt>安全性</dt><dd>需要已配对设备确认</dd></dl></details>
        <p class="bt-transfer-disclosure">Web Bluetooth 不提供系统级 OBEX 文件写入；此窗口真实读取虚拟磁盘文件，并在 Leopard 桌面中模拟对象交换与历史记录。</p>
      </main>
      <footer><button class="aqua-btn bt-transfer-cancel">取消</button><button class="aqua-btn default bt-transfer-start">发送</button></footer>`;
    c.querySelector('.bt-transfer-file b').textContent = name;
    c.querySelector('.bt-transfer-file small').textContent = `${bluetoothSizeLabel(size)} · ${node?.kind === 'image' ? '图像' : '文稿'}`;
    c.querySelector('details dd').textContent = path;
    const deviceSelect = c.querySelector('.bt-transfer-device');
    devices.forEach((device) => deviceSelect.appendChild(el('option', '', device)));
    if (preferredDevice && devices.includes(preferredDevice)) deviceSelect.value = preferredDevice;
    let timer = 0;
    let progress = 0;
    let complete = false;
    const stopTimer = () => { clearInterval(timer); timer = 0; };
    bluetoothTransferWin = System.createWindow({
      app:'sysprefs', title:'Bluetooth 文件交换', width:590, height:500, content:c, bodyBg:'#ececec', noResize:true,
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
      cancel.textContent = '停止';
      deviceSelect.disabled = true;
      status.textContent = `正在连接“${target}”…`;
      const step = Math.max(2.5, Math.min(9, 650000 / Math.max(1, size)));
      timer = setInterval(() => {
        progress = Math.min(100, progress + step + Math.random() * 2.4);
        bar.style.width = `${progress}%`;
        status.textContent = progress < 12 ? `正在连接“${target}”…`
          : progress < 96 ? `正在发送“${name}”… ${Math.floor(progress)}%`
          : '正在等待设备确认…';
        if (progress < 100) return;
        stopTimer();
        complete = true;
        cfg.transfers = [{
          name, path, device:target, size, status:'已发送', time:Date.now(),
        }, ...(cfg.transfers || [])].slice(0, 20);
        cfg.connectedDevices = [...new Set([...(cfg.connectedDevices || []), target])];
        save('macweb.pref.bluetooth', cfg);
        document.dispatchEvent(new CustomEvent('leopard-bluetooth-devices-changed'));
        status.innerHTML = `<b>✓ 已发送</b><br>“${target}”已接受“${name}”。`;
        start.disabled = false;
        start.textContent = '完成';
        cancel.hidden = true;
        Leopard.toast('Bluetooth 文件交换', `“${name}”已发送到“${target}”。`);
      }, 90);
    });
  }

  function openBluetoothFilePanel(cfg, preferredDevice) {
    if (cfg.enabled === false) {
      System.alertBox('Bluetooth 文件交换', 'Bluetooth 已关闭。请先在系统偏好设置中打开 Bluetooth。');
      return;
    }
    System.openPanel({
      parent:winRef,
      title:'选择要通过 Bluetooth 发送的文件',
      startPath:'/用户/roll',
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
      <header><div class="bt-orb">ᛒ</div><div><h2>浏览 Bluetooth 设备</h2><p>查看已配对设备、可用服务和最近的对象交换。</p></div></header>
      <main><aside><div class="bt-browser-list"></div><footer><button class="aqua-btn bt-browser-refresh">刷新</button></footer></aside>
      <section><div class="bt-browser-empty">选择一台设备以查看详细信息。</div><div class="bt-browser-detail" hidden>
        <h3></h3><p class="bt-browser-state"></p>
        <dl><dt>设备类型</dt><dd class="bt-browser-kind"></dd><dt>可用服务</dt><dd class="bt-browser-services"></dd><dt>地址</dt><dd>由浏览器隐私保护</dd></dl>
        <div class="bt-browser-inbox"><h4>对象交换记录</h4><div></div></div>
        <footer><button class="aqua-btn bt-browser-connect"></button><button class="aqua-btn default bt-browser-send">发送文件…</button></footer>
      </div></section></main>
      <footer><span>附近设备仅在您主动授权后才会显示。</span><button class="aqua-btn default bt-browser-close">关闭</button></footer>`;
    let selected = '';
    const connected = new Set(cfg.connectedDevices || []);
    const list = c.querySelector('.bt-browser-list');
    const renderDetail = () => {
      const detail = c.querySelector('.bt-browser-detail');
      c.querySelector('.bt-browser-empty').hidden = Boolean(selected);
      detail.hidden = !selected;
      if (!selected) return;
      const lower = selected.toLowerCase();
      const kind = lower.includes('keyboard') ? '键盘' : lower.includes('mouse') ? '鼠标' : 'Bluetooth 设备';
      const services = kind === '键盘' || kind === '鼠标' ? '人机接口设备 (HID)' : '设备信息、对象交换';
      detail.querySelector('h3').textContent = selected;
      detail.querySelector('.bt-browser-state').textContent = connected.has(selected) ? '已连接并已配对' : '已配对，当前未连接';
      detail.querySelector('.bt-browser-kind').textContent = kind;
      detail.querySelector('.bt-browser-services').textContent = services;
      detail.querySelector('.bt-browser-connect').textContent = connected.has(selected) ? '断开连接' : '连接';
      const history = (cfg.transfers || []).filter((entry) => entry.device === selected);
      const inbox = detail.querySelector('.bt-browser-inbox>div');
      inbox.innerHTML = '';
      if (!history.length) inbox.appendChild(el('p', '', '尚无传输记录。'));
      history.slice(0, 6).forEach((entry) => {
        const row = el('p');
        row.append(el('b', '', entry.name), el('span', '', new Date(entry.time).toLocaleString('zh-CN')), el('em', '', entry.status));
        inbox.appendChild(row);
      });
    };
    const renderList = () => {
      list.innerHTML = '';
      bluetoothPairedDevices(cfg).forEach((device) => {
        const row = el('button', device === selected ? 'sel' : '');
        row.innerHTML = '<i>ᛒ</i><span><b></b><small></small></span>';
        row.querySelector('b').textContent = device;
        row.querySelector('small').textContent = connected.has(device) ? '已连接' : '已配对';
        row.addEventListener('click', () => { selected = device; renderList(); renderDetail(); });
        list.appendChild(row);
      });
    };
    bluetoothBrowserWin = System.createWindow({
      app:'sysprefs', title:'Bluetooth 文件交换', width:720, height:520, content:c, bodyBg:'#ececec', noResize:true,
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
        Leopard.toast('Bluetooth', '此浏览器不支持读取已授权设备。');
        return;
      }
      button.disabled = true;
      button.textContent = '正在查找…';
      try {
        const devices = await navigator.bluetooth.getDevices();
        const names = devices.map((device) => device.name).filter(Boolean);
        cfg.devices = [...new Set([...(cfg.devices || []), ...names])];
        save('macweb.pref.bluetooth', cfg);
        renderList();
        Leopard.toast('Bluetooth', names.length ? `找到 ${names.length} 台已授权设备。` : '没有新的已授权设备。');
      } catch (error) {
        Leopard.toast('Bluetooth', '无法读取已授权设备。');
      } finally {
        button.disabled = false;
        button.textContent = '刷新';
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
      shareFolder:'/用户/roll/公共',
    }, cfg.advanced || {});
    const c = el('div', 'bluetooth-advanced-dialog');
    c.innerHTML = `
      <header><div class="bt-orb">ᛒ</div><div><h2>Bluetooth 高级设置</h2><p>控制设置助理、唤醒、安全配对和文件交换。</p></div></header>
      <main>
        <fieldset><legend>Bluetooth 设置助理</legend>
          <label class="spp-check"><input data-setting="keyboardAssistant" type="checkbox"> 如果启动时没有检测到键盘，则打开设置助理</label>
          <label class="spp-check"><input data-setting="mouseAssistant" type="checkbox"> 如果启动时没有检测到鼠标或触控板，则打开设置助理</label>
        </fieldset>
        <fieldset><legend>连接与安全性</legend>
          <label class="spp-check"><input data-setting="allowWake" type="checkbox"> 允许 Bluetooth 设备唤醒这台电脑</label>
          <label class="spp-check"><input data-setting="securePairing" type="checkbox"> 使用安全简单配对</label>
          <label class="spp-check"><input data-setting="confirmTransfers" type="checkbox"> 接收文件前要求确认</label>
        </fieldset>
        <fieldset class="bt-share-folder"><legend>Bluetooth 共享</legend><label><span>接收的项目：</span><input class="aqua-input" readonly><button class="aqua-btn">选择…</button></label></fieldset>
        <p>浏览器不会在后台扫描设备；所有授权、连接与导入都必须由您点按开始。</p>
      </main>
      <footer><button class="aqua-btn bt-advanced-cancel">取消</button><button class="aqua-btn default bt-advanced-save">好</button></footer>`;
    c.querySelectorAll('[data-setting]').forEach((control) => { control.checked = Boolean(advanced[control.dataset.setting]); });
    const folder = c.querySelector('.bt-share-folder input');
    folder.value = advanced.shareFolder;
    bluetoothAdvancedWin = System.createWindow({
      app:'sysprefs', title:'Bluetooth 高级设置', width:650, height:520, content:c, bodyBg:'#ececec', noResize:true,
      onClose:() => { bluetoothAdvancedWin = null; },
    });
    c.querySelector('.bt-share-folder button').addEventListener('click', () => System.openPanel({
      parent:bluetoothAdvancedWin,
      title:'选择接收项目的文件夹',
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
      Leopard.toast('Bluetooth', '高级设置已经保存。');
    });
  }

  function openFileVaultAssistant(cfg, onFinish) {
    const c = el('div', 'filevault-assistant aqua-assistant');
    let step = 0;
    const pages = [
      ['打开 FileVault', 'FileVault 会保护此网页版 Mac 中个人文件夹的模拟内容。它不会更改或加密您真实 Mac 上的任何文件。'],
      ['恢复主密码', '请记下恢复提示。如果忘记登录密码，可以用恢复提示辨认这份模拟保险库。'],
      ['准备加密', '退出登录后才会开始保护个人文件夹。模拟加密会立即完成，并可随时关闭。'],
    ];
    const paint = () => {
      const [title, copy] = pages[step];
      c.innerHTML = `<aside><div class="filevault-lock"><i></i></div></aside><main><h2>${title}</h2><p>${copy}</p>
        ${step === 1 ? '<label>恢复提示：<input class="aqua-input filevault-hint" value="我的第一台 Mac"></label>' : ''}
        <div class="assistant-summary">${step === 2 ? '<b>个人文件夹：</b> /用户/roll<br><b>状态：</b> 可以开始' : 'AES-128 · 登录密码保护 · 自动恢复检查'}</div>
        <footer><button class="aqua-btn fv-cancel">取消</button><i></i><button class="aqua-btn fv-back" ${step ? '' : 'disabled'}>返回</button><button class="aqua-btn default fv-next">${step === pages.length - 1 ? '打开 FileVault' : '继续'}</button></footer></main>`;
      c.querySelector('.fv-cancel').addEventListener('click', () => System.closeWindow(win));
      c.querySelector('.fv-back').addEventListener('click', () => { step--; paint(); });
      c.querySelector('.fv-next').addEventListener('click', () => {
        if (step < pages.length - 1) { step++; paint(); return; }
        cfg.fileVault = true;
        save('macweb.pref.security', cfg);
        System.closeWindow(win);
        onFinish?.();
        Leopard.toast('FileVault', '个人文件夹保护已打开。');
      });
    };
    const win = System.createWindow({ app: 'sysprefs', title: 'FileVault', width: 650, height: 430, content: c, bodyBg: '#ececec', noResize: true });
    paint();
  }

  function openNetworkDiagnostics() {
    const c = el('div', 'network-diagnostics');
    const tests = [
      ['AirPort', '检查无线接口和信号'],
      ['AirPort 设置', '检查网络名称和密码'],
      ['网络设置', '检查 DHCP、路由器和 DNS'],
      ['ISP', '检查互联网服务提供商'],
      ['Internet', '检查互联网连接'],
      ['服务器', '检查网页与名称解析'],
    ];
    c.innerHTML = `<header><div class="diagnostic-orb">◉</div><div><h2>网络诊断</h2><p>逐项检查从 AirPort 到互联网服务器的连接。</p></div></header>
      <main><ol>${tests.map(([name, hint]) => `<li><i></i><span><b>${name}</b><small>${hint}</small></span><em>等待</em></li>`).join('')}</ol>
      <aside><h3>网络状态</h3><p>位置：自动<br>网络：Leopard Web<br>地址：192.168.1.105</p></aside></main>
      <footer><button class="aqua-btn diagnostics-close">关闭</button><i></i><button class="aqua-btn default diagnostics-run">运行诊断</button></footer>`;
    const win = System.createWindow({ app: 'netutil', title: '网络诊断', width: 690, height: 480, content: c, bodyBg: '#ececec', noResize: true });
    c.querySelector('.diagnostics-close').addEventListener('click', () => System.closeWindow(win));
    c.querySelector('.diagnostics-run').addEventListener('click', () => {
      const button = c.querySelector('.diagnostics-run');
      button.disabled = true;
      const rows = Array.from(c.querySelectorAll('li'));
      rows.forEach((row) => { row.className = ''; row.querySelector('em').textContent = '等待'; });
      let index = 0;
      const next = () => {
        if (!c.isConnected) return;
        if (index >= rows.length) {
          button.disabled = false;
          button.textContent = '再次运行';
          c.querySelector('header p').textContent = '您的 Internet 连接看来工作正常。';
          Leopard.toast('网络诊断', '所有连接测试均已通过。');
          return;
        }
        const row = rows[index++];
        row.className = 'testing';
        row.querySelector('em').textContent = '检查中…';
        setTimeout(() => {
          row.className = 'passed';
          row.querySelector('em').textContent = '通过';
          next();
        }, 260);
      };
      next();
    });
  }

  function openNetworkServiceAssistant(onAdd) {
    const c = el('div', 'network-service-assistant aqua-assistant');
    c.innerHTML = `<aside><div class="network-service-orb">＋</div></aside><main><h2>选择接口</h2><p>为这台 Mac 添加新的网络服务。浏览器环境中会创建一项模拟服务。</p>
      <label>接口：<select class="spp-select service-interface"><option>以太网</option><option>Bluetooth</option><option>FireWire</option><option>VPN</option></select></label>
      <label>服务名称：<input class="aqua-input service-name" value="以太网"></label>
      <footer><button class="aqua-btn service-cancel">取消</button><i></i><button class="aqua-btn default service-create">创建</button></footer></main>`;
    const select = c.querySelector('.service-interface');
    select.addEventListener('change', () => { c.querySelector('.service-name').value = select.value; });
    const win = System.createWindow({ app: 'sysprefs', title: '新建网络服务', width: 610, height: 390, content: c, bodyBg: '#ececec', noResize: true });
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
      <div class="spp-pref-card"><h3>活动的屏幕角</h3><div class="hot-corners"><select><option>所有窗口</option></select><select><option>Dashboard</option></select><select><option>桌面</option></select><select><option>屏幕保护程序</option></select></div></div>
      <div class="spp-pref-card"><h3>Spaces</h3><p>已启用四个桌面空间。菜单栏中的数字表示当前空间。</p>
      ${check('spacesEnabled','启用 Spaces',true)} ${check('menuSpaces','在菜单栏中显示 Spaces',true)}
      <button class="aqua-btn show-spaces">显示 Spaces</button></div>`;
    else if (id === 'security') c.innerHTML = `
      <div class="spp-tabs"><button class="active">通用</button><button>FileVault</button><button>防火墙</button></div>
      <div class="spp-pref-card">${check('passwordWake','从睡眠或屏幕保护程序唤醒时需要密码',true)}
      ${check('disableAutoLogin','停用自动登录')} ${check('secureVirtualMemory','使用安全虚拟内存',true)}
      <label>退出登录前闲置 ${range('logoutMin',60,5,120)} 分钟</label></div>
      <div class="spp-pref-card"><h3>FileVault</h3><p>FileVault 使用您的登录密码保护个人文件夹。网页版不会加密真实文件。</p><button class="aqua-btn">打开 FileVault…</button></div>`;
    else if (id === 'spotlight') c.innerHTML = `
      <div class="spp-tabs"><button class="active">搜索结果</button><button>隐私</button></div>
      <div class="spp-pref-card spp-category-list">${['应用程序','系统偏好设置','文稿','文件夹','Mail 邮件','通讯录','图像','音乐','影片','网页','PDF 文稿'].map((n,i)=>check(`cat${i}`,n,true)).join('')}</div>
      <p class="spp-hint">拖动类别可更改 Spotlight 结果顺序。⌃⌥Space 是不会与 macOS 冲突的网页组合。</p>`;
    else if (id === 'international') c.innerHTML = `
      <div class="spp-tabs"><button class="active">语言</button><button>格式</button><button>输入法菜单</button></div>
      <div class="spp-pref-card"><h3>首选语言</h3><ol class="language-list"><li>简体中文</li><li>English</li><li>日本語</li></ol>
      <label>地区：<select class="spp-select"><option>中国</option><option>马来西亚</option><option>美国</option><option>日本</option></select></label>
      ${check('inputMenu','在菜单栏中显示输入法菜单',true)}</div>`;
    else if (id === 'keyboard') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="keyboard">键盘</button><button data-tab="mouse">鼠标</button><button data-tab="shortcuts">键盘快捷键</button></div>
      <section class="spp-tab-panel keyboard-panel" data-panel="keyboard">
        <div class="keyboard-visual" aria-hidden="true">${Array.from({ length: 55 }, (_, i) => `<i class="${[13,27,41,54].includes(i) ? 'wide' : ''}"></i>`).join('')}</div>
        <div class="spp-pref-card keyboard-settings">
          <label><span>按键重复速率：</span><small>慢</small>${range('repeat',70)}<small>快</small></label>
          <label><span>重复前延迟：</span><small>长</small>${range('delay',55)}<small>短</small></label>
          ${check('fkeys','将 F1、F2 等键用作标准功能键')}
          <label>在此处键入以测试设置：<input class="aqua-input keyboard-test" autocomplete="off"></label>
        </div>
      </section>
      <section class="spp-tab-panel mouse-panel" data-panel="mouse" hidden>
        <div class="mighty-mouse" aria-hidden="true"><i></i><span>●</span></div>
        <div class="mouse-controls">
          <label><span>跟踪速度</span><small>慢</small>${range('tracking',62)}<small>快</small></label>
          <label><span>连按速度</span><small>慢</small>${range('doubleClick',58)}<small>快</small></label>
          <label><span>滚动速度</span><small>慢</small>${range('scrolling',65)}<small>快</small></label>
          <label>主鼠标按钮：<select class="spp-select"><option>左</option><option>右</option></select></label>
          ${check('mouseZoom','按住 Control 键并滚动来缩放')}
        </div>
      </section>
      <section class="spp-tab-panel shortcut-panel" data-panel="shortcuts" hidden>
        <div class="shortcut-layout">
          <aside><button class="sel">Dashboard 与 Dock</button><button>显示器</button><button>键盘与文本输入</button><button>屏幕快照</button><button>Spotlight</button><button>万能辅助</button></aside>
          <main>
            <header><span>操作</span><span>快捷键</span></header>
            <label><span><input type="checkbox" checked> 显示 Dashboard</span><kbd>⌃⇧D</kbd></label>
            <label><span><input type="checkbox" checked> 显示 Dock</span><kbd>⌃⇧K</kbd></label>
            <label><span><input type="checkbox" checked> 显示 Spaces</span><kbd>⌃⇧S</kbd></label>
            <label><span><input type="checkbox" checked> 快速查看</span><kbd>Space</kbd></label>
          </main>
        </div>
        <div class="shortcut-footer">
          <label>网页安全修饰键：<select class="spp-select safe-profile"><option value="ctrlShift">⌃⇧（推荐）</option><option value="ctrlAlt">⌃⌥（传统）</option></select></label>
          <button class="aqua-btn keyboard-capture">进入全屏键盘捕获</button><button class="aqua-btn keyboard-help">快捷键速查</button>
        </div>
      </section>`;
    else if (id === 'cd') c.innerHTML = `
      <div class="spp-pref-card"><h3>插入光盘时</h3>
      ${['空白 CD','空白 DVD','音乐 CD','图片 CD','视频 DVD'].map((n)=>`<label>${n}：<select class="spp-select"><option>询问要执行的操作</option><option>打开 Finder</option><option>打开 iTunes</option><option>打开 DVD 播放器</option><option>忽略</option></select></label>`).join('')}</div>`;
    else if (id === 'printfax') c.innerHTML = `
      <div class="print-fax-pane">
        <aside>
          <header>打印机</header>
          <div class="printer-sidebar-list"><button class="sel"><i>${printerSvg}</i><span>Web PDF Printer<small>空闲，默认</small></span></button></div>
          <footer><button class="printer-add" title="添加打印机">＋</button><button class="printer-remove" title="移除打印机">－</button><i></i><button title="操作">⚙</button></footer>
        </aside>
        <main>
          <section class="printer-summary">
            <div class="printer-large">${printerSvg}</div>
            <div><h3>Web PDF Printer</h3><dl><dt>状态：</dt><dd class="ready">空闲</dd><dt>种类：</dt><dd>虚拟 PostScript 打印机</dd><dt>位置：</dt><dd>浏览器</dd></dl></div>
          </section>
          <div class="printer-actions"><button class="aqua-btn default print-open-queue">打开打印队列…</button><button class="aqua-btn printer-options">选项与耗材…</button></div>
          <label class="spp-check"><input type="checkbox" data-key="sharePrinter" ${checked('sharePrinter')}> 共享此打印机</label>
        </main>
        <footer class="print-defaults">
          <label>默认打印机：<select class="spp-select"><option>Web PDF Printer</option><option>上次使用的打印机</option></select></label>
          <label>默认纸张大小：<select class="spp-select"><option>A4</option><option>US Letter</option><option>A5</option></select></label>
        </footer>
      </div>`;
    else if (id === 'network') c.innerHTML = `
      <div class="network-pref">
        <header><label>位置：<select class="spp-select"><option>自动</option><option>家庭</option><option>工作</option><option>编辑位置…</option></select></label></header>
        <aside>
          <div class="network-service-list">
            <button class="sel"><i class="status-dot green"></i><span>AirPort<small>已连接</small></span></button>
            <button><i class="status-dot red"></i><span>以太网<small>未连接</small></span></button>
            <button><i class="status-dot red"></i><span>Bluetooth<small>未连接</small></span></button>
            <button><i class="status-dot gray"></i><span>FireWire<small>未连接</small></span></button>
          </div>
          <footer><button>＋</button><button>－</button><i></i><button>⚙</button></footer>
        </aside>
        <main>
          <section class="airport-summary"><div class="airport-rings"><i></i><i></i><i></i></div><div><h3>AirPort <b>已连接</b></h3><p>AirPort 已连接到 <strong>Leopard Web</strong>，并且 IP 地址为 192.168.1.105。</p></div></section>
          <label class="spp-check"><input type="checkbox" data-key="airportOn" ${checked('airportOn',true)}> 打开 AirPort</label>
          <label><span>网络名称：</span><select class="spp-select"><option>Leopard Web</option><option>加入其他网络…</option><option>创建网络…</option></select></label>
          <label class="spp-check"><input type="checkbox" data-key="askNetworks" ${checked('askNetworks',true)}> 加入新网络前询问</label>
          <div class="network-buttons"><button class="aqua-btn network-assist">向导…</button><button class="aqua-btn network-advanced">高级…</button></div>
          <p class="network-status"><i></i><span>状态：<b>已连接</b><br>AirPort 具有自分配的网络地址。</span></p>
        </main>
        <footer class="network-footer"><button class="aqua-btn network-diagnose">诊断…</button><i></i><button class="aqua-btn network-revert" disabled>还原</button><button class="aqua-btn default network-apply">应用</button></footer>
      </div>`;
    else if (id === 'bluetooth') c.innerHTML = `
      <div class="bluetooth-pref">
        <header><div class="bt-orb">ᛒ</div><div><h2>Bluetooth</h2><p>使用 Bluetooth 无线技术连接键盘、鼠标、电话及其他设备。</p></div></header>
        <div class="bluetooth-body">
          <aside>
            <label class="spp-check"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}> 打开 Bluetooth</label>
            <label class="spp-check"><input type="checkbox" data-key="discoverable" ${checked('discoverable',true)}> 可被发现</label>
            <p>这台电脑将显示为：<br><b>“roll 的 Mac”</b></p>
          </aside>
          <main>
            <h3>Bluetooth 设备：</h3>
            <div class="bluetooth-device-list"></div>
            <div class="bluetooth-device-actions"><button class="aqua-btn bluetooth-remove" disabled>－</button><button class="aqua-btn default bluetooth-setup">设置新设备…</button></div>
            <label class="spp-check"><input type="checkbox" checked> 在菜单栏中显示 Bluetooth 状态</label>
          </main>
        </div>
        <footer><button class="aqua-btn bluetooth-file">发送文件…</button><button class="aqua-btn bluetooth-browse">浏览设备…</button><i></i><button class="aqua-btn bluetooth-advanced">高级…</button></footer>
      </div>`;
    else if (id === 'sharing') c.innerHTML = `
      <div class="spp-split sharing-pane"><aside>${['DVD 或 CD 共享','屏幕共享','文件共享','打印机共享','Web 共享','远程登录','远程 Apple Events','Internet 共享','Bluetooth 共享'].map((n,i)=>`<label><input type="checkbox" data-key="service${i}" ${checked(`service${i}`)}> ${n}</label>`).join('')}</aside>
      <main><h3>文件共享：关闭</h3><p>其他用户可以访问这台电脑上的“公共”文件夹。</p><div class="sharing-box">共享的文件夹<br><b>roll 的公共文件夹</b></div><label>电脑名称：<input class="aqua-input" value="roll 的 Mac"></label></main></div>`;
    else if (id === 'dotmac') c.innerHTML = `
      <div class="dotmac-logo"><b>.Mac</b><span>随处访问您的 Mac</span></div>
      <div class="spp-pref-card"><label>会员名称：<input class="aqua-input" placeholder="name"></label><label>密码：<input class="aqua-input" type="password" placeholder="不会保存真实密码"></label>
      <button class="aqua-btn">登录</button><p class="spp-hint">支持 iDisk、同步、Back to My Mac 和帐户信息界面；网页版不会发送凭据。</p></div>`;
    else if (id === 'parental') c.innerHTML = `
      <div class="spp-split"><aside><button class="sel"><i class="spp-avatar">R</i> roll</button></aside><main><h3>家长控制</h3>
      ${check('simpleFinder','使用简单 Finder')} ${check('limitApps','限制可以使用的应用程序')} ${check('limitWeb','尝试自动限制成人网站')}
      <label>工作日每天：<select class="spp-select"><option>无限制</option><option>1 小时</option><option>2 小时</option></select></label>
      <label>就寝时间：<input type="time" value="22:00"> 至 <input type="time" value="07:00"></label></main></div>`;
    else if (id === 'speech') c.innerHTML = `
      <div class="spp-tabs"><button class="active">文本转语音</button><button>语音识别</button></div>
      <div class="spp-pref-card"><label>系统语音：<select class="spp-select speech-voice"></select></label>
      <label>语速：${range('rate',50)}</label><textarea class="aqua-input speech-text">欢迎使用 Mac OS X Leopard。</textarea>
      <button class="aqua-btn speech-play">播放</button> ${check('announceAlerts','发出警告时朗读用户界面文本')}</div>`;
    else if (id === 'startup') c.innerHTML = `
      <div class="startup-disks"><button class="sel">${ICONS.hd}<b>Mac OS X, 10.5</b><span>Macintosh HD</span></button><button>${ICONS.folder}<b>Network Startup</b><span>网络服务器</span></button></div>
      <p>选择要用于启动电脑的系统，然后点按“重新启动”。</p><button class="aqua-btn">目标磁盘模式…</button><button class="aqua-btn default restart-pref">重新启动…</button>`;
    else if (id === 'timemachine') c.innerHTML = `
      <div class="tm-pref"><div>${Leopard.glyph('timemachine',120)}</div><section><h3>Time Machine</h3><label class="tm-switch"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}><i></i><span>开</span></label>
      <p>最早的备份：今天<br>最新的备份：${new Date().toLocaleTimeString('zh-CN')}<br>下一次备份：约一小时后</p>
      ${check('menu','在菜单栏中显示 Time Machine 状态',true)}
      <button class="aqua-btn tm-backup">立即备份</button><button class="aqua-btn tm-enter">进入 Time Machine</button></section></div>`;
    else if (id === 'universal') c.innerHTML = `
      <div class="spp-tabs"><button class="active">视觉</button><button>听觉</button><button>键盘</button><button>鼠标</button></div>
      <div class="spp-pref-card">${check('voiceOver','启用 VoiceOver')} ${check('zoom','启用缩放')}
      <label>显示器对比度 ${range('contrast',0,0,80)}</label>${check('flashScreen','发出警告声音时闪烁屏幕')}
      ${check('stickyKeys','启用粘滞键')} ${check('mouseKeys','启用鼠标键')}</div>`;
    else c.innerHTML = '<p>此偏好设置面板已载入。</p>';

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
    c.querySelector('.network-apply')?.addEventListener('click', () => Leopard.toast('网络', '网络设置已经应用。'));
    c.querySelector('.print-open-queue')?.addEventListener('click', openPrintQueue);
    c.querySelector('.printer-add')?.addEventListener('click', openPrinterBrowser);
    c.querySelector('.printer-options')?.addEventListener('click', () => System.alertBox('选项与耗材', '驱动程序：Generic PostScript Printer\n纸张来源：自动选择\n耗材：虚拟打印机不需要耗材。'));
    const bluetoothList = c.querySelector('.bluetooth-device-list');
    const appendBluetoothDevice = (name, connected = false) => {
      if (!bluetoothList || Array.from(bluetoothList.querySelectorAll('.device-row span')).some((span) => span.textContent === name)) return;
      const device = el('button', 'device-row');
      device.innerHTML = '<i>ᛒ</i><span></span><b></b>';
      device.querySelector('span').textContent = name;
      device.querySelector('b').textContent = connected ? '已配对' : '未连接';
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
    c.querySelector('.bluetooth-file')?.addEventListener('click', () => System.alertBox('Bluetooth 文件交换', '先使用“设置新设备…”配对设备，然后即可选择要发送的文件。'));
    c.querySelector('.bluetooth-browse')?.addEventListener('click', () => System.alertBox('浏览设备', '选择已配对并支持对象交换的 Bluetooth 设备。'));
    c.querySelector('.bluetooth-advanced')?.addEventListener('click', () => System.alertBox('Bluetooth 高级设置', '已启用设置助理、键盘与鼠标唤醒，以及安全配对。'));
    c.querySelector('.restart-pref')?.addEventListener('click', () => System.shutdownSequence(true));
    c.querySelector('.tm-backup')?.addEventListener('click', () => {
      Leopard.saveSnapshot('手动备份'); Leopard.toast('Time Machine', '备份已完成。');
    });
    c.querySelector('.tm-enter')?.addEventListener('click', Leopard.openTimeMachine);
    if (id === 'speech' && 'speechSynthesis' in window) {
      const select = c.querySelector('.speech-voice');
      const fillVoices = () => {
        const voices = speechSynthesis.getVoices();
        select.innerHTML = voices.map((v, i) => `<option value="${i}">${v.name} — ${v.lang}</option>`).join('') || '<option>系统默认语音</option>';
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
      welcome: true, modifier: 'Control-Option', verbosity: '标准', punctuation: '部分',
      rate: 52, pitch: 48, volume: 70, intonation: 55, mouseTracking: true,
      keyboardFocus: true, webSummary: true, audioDucking: true, soundCues: true,
      captionPanel: false, cursorRing: true, brailleStatus: '通用',
    });
    const content = el('div', 'voiceover-utility');
    const categories = [
      ['general', '通用', '◉'], ['verbosity', '详细度', '≡'], ['speech', '语音', '◖'],
      ['navigation', '导航', '⌖'], ['web', 'Web', '◎'], ['sound', '声音', '♪'],
      ['visuals', '视觉', '◐'], ['braille', 'Braille', '⠿'],
    ];
    content.innerHTML = `
      <aside><header><span class="vo-badge">VO</span><b>VoiceOver 实用工具</b></header>
        <nav>${categories.map(([key, name, glyph], index) => `<button data-vo-category="${key}" class="${index === 0 ? 'sel' : ''}"><i>${glyph}</i><span>${name}</span></button>`).join('')}</nav>
      </aside>
      <main><header><h2></h2><p></p></header><section class="voiceover-settings"></section><footer><button class="aqua-btn vo-help">帮助</button><i></i><button class="aqua-btn vo-reset">还原默认值</button></footer></main>`;
    const checked = (key) => cfg[key] ? 'checked' : '';
    const panelFor = (key) => {
      const panels = {
        general: ['通用', '设置 VoiceOver 启动、修饰键和初始行为。', `
          <fieldset><legend>启动</legend><label class="spp-check"><input type="checkbox" data-vo-key="welcome" ${checked('welcome')}> VoiceOver 启动时显示欢迎对话框</label><label class="spp-check"><input type="checkbox" data-vo-key="portable"> 使用便携式偏好设置</label></fieldset>
          <label class="vo-row"><span>VoiceOver 修饰键：</span><select class="spp-select" data-vo-key="modifier"><option>Control-Option</option><option>Caps Lock</option></select></label>
          <p class="spp-hint">按 Control-Option-F8 可打开本实用工具；网页模式会使用安全修饰键避免与宿主 Mac 冲突。</p>`],
        verbosity: ['详细度', '选择 VoiceOver 对控件、文本和状态变化的描述程度。', `
          <label class="vo-row"><span>语音详细度：</span><select class="spp-select" data-vo-key="verbosity"><option>低</option><option>标准</option><option>高</option><option>自定…</option></select></label>
          <label class="vo-row"><span>标点：</span><select class="spp-select" data-vo-key="punctuation"><option>无</option><option>部分</option><option>全部</option></select></label>
          <fieldset><legend>提示</legend><label class="spp-check"><input type="checkbox" data-vo-key="statusChanges" checked> 朗读状态变化</label><label class="spp-check"><input type="checkbox" data-vo-key="helpTags" checked> 延迟后朗读帮助标签</label><label class="spp-check"><input type="checkbox" data-vo-key="repeatedText"> 朗读重复文本</label></fieldset>`],
        speech: ['语音', '调整 VoiceOver 的语音、速率、音调和语调。', `
          <label class="vo-row"><span>声音：</span><select class="spp-select voiceover-voice"><option>系统默认语音</option></select></label>
          <label class="vo-slider"><span>速率：</span><b>慢</b><input type="range" data-vo-key="rate" min="0" max="100" value="${cfg.rate}"><b>快</b></label>
          <label class="vo-slider"><span>音调：</span><b>低</b><input type="range" data-vo-key="pitch" min="0" max="100" value="${cfg.pitch}"><b>高</b></label>
          <label class="vo-slider"><span>音量：</span><b>小</b><input type="range" data-vo-key="volume" min="0" max="100" value="${cfg.volume}"><b>大</b></label>
          <label class="vo-slider"><span>语调：</span><b>平</b><input type="range" data-vo-key="intonation" min="0" max="100" value="${cfg.intonation}"><b>强</b></label>
          <button class="aqua-btn default voiceover-sample">播放样本</button>`],
        navigation: ['导航', '控制 VoiceOver 光标与键盘焦点、鼠标指针的跟随方式。', `
          <fieldset><legend>VoiceOver 光标</legend><label class="spp-check"><input type="checkbox" data-vo-key="keyboardFocus" ${checked('keyboardFocus')}> 同步键盘焦点与 VoiceOver 光标</label><label class="spp-check"><input type="checkbox" data-vo-key="mouseTracking" ${checked('mouseTracking')}> 鼠标指针跟随 VoiceOver 光标</label></fieldset>
          <label class="vo-row"><span>初始位置：</span><select class="spp-select"><option>第一个项目</option><option>键盘焦点项目</option><option>上次位置</option></select></label>
          <label class="vo-row"><span>分组行为：</span><select class="spp-select"><option>标准</option><option>先朗读组</option><option>忽略组</option></select></label>`],
        web: ['Web', '设置浏览网页时的摘要、网页转子和表格导航。', `
          <label class="spp-check"><input type="checkbox" data-vo-key="webSummary" ${checked('webSummary')}> 自动朗读网页摘要</label><label class="spp-check"><input type="checkbox" data-vo-key="webTables" checked> 朗读表格标题与坐标</label>
          <fieldset><legend>网页转子项目</legend>${['链接','标题','表格','表单控制','地标','访问过的链接'].map((name) => `<label class="spp-check"><input type="checkbox" checked> ${name}</label>`).join('')}</fieldset>
          <label class="vo-row"><span>网页导航：</span><select class="spp-select"><option>按 DOM 顺序</option><option>按视觉顺序</option></select></label>`],
        sound: ['声音', '设置声音提示和其他音频在 VoiceOver 朗读时的音量。', `
          <label class="spp-check"><input type="checkbox" data-vo-key="soundCues" ${checked('soundCues')}> 启用 VoiceOver 声音效果</label><label class="spp-check"><input type="checkbox" data-vo-key="audioDucking" ${checked('audioDucking')}> 朗读时调低其他音频</label><label class="spp-check"><input type="checkbox" data-vo-key="positionalAudio"> 使用位置音频</label>
          <label class="vo-slider"><span>声音效果音量：</span><b>小</b><input type="range" min="0" max="100" value="65"><b>大</b></label><button class="aqua-btn vo-sound-test">播放效果</button>`],
        visuals: ['视觉', '设置 VoiceOver 光标、字幕面板和 Braille 面板。', `
          <fieldset><legend>面板</legend><label class="spp-check"><input type="checkbox" data-vo-key="captionPanel" ${checked('captionPanel')}> 显示字幕面板</label><label class="spp-check"><input type="checkbox" data-vo-key="braillePanel"> 显示 Braille 面板</label></fieldset>
          <label class="spp-check"><input type="checkbox" data-vo-key="cursorRing" ${checked('cursorRing')}> 显示 VoiceOver 光标放大框</label><label class="vo-slider"><span>光标放大：</span><b>小</b><input type="range" min="0" max="100" value="38"><b>大</b></label>
          <div class="voiceover-cursor-preview"><i></i><span>VoiceOver 光标预览</span></div>`],
        braille: ['Braille', '配置可刷新 Braille 显示器、翻译和状态单元格。', `
          <p class="voiceover-device-state"><i></i><span><b>未连接 Braille 显示器</b><small>连接兼容的 USB 或 Bluetooth 设备后会自动显示。</small></span></p>
          <label class="vo-row"><span>翻译：</span><select class="spp-select"><option>统一英语 Braille</option><option>中文现行盲文</option><option>电脑 Braille</option></select></label>
          <label class="vo-row"><span>状态单元格：</span><select class="spp-select" data-vo-key="brailleStatus"><option>通用</option><option>文本</option><option>不显示</option></select></label>
          <label class="spp-check"><input type="checkbox" checked> 自动平移 Braille 显示器</label>`],
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
          voiceSelect.innerHTML = '<option value="">系统默认语音</option>' + voices.map((voice, index) => `<option value="${index}">${voice.name} — ${voice.lang}</option>`).join('');
        };
        fill();
        speechSynthesis.addEventListener?.('voiceschanged', fill, { once: true });
      }
      settings.querySelector('.voiceover-sample')?.addEventListener('click', () => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance('VoiceOver 已打开。这里是语音设置样本。');
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
    content.querySelector('.vo-help').addEventListener('click', () => System.alertBox('VoiceOver 帮助', '使用 Control-Option 与方向键浏览项目；按 Control-Option-空格键执行所选项目。'));
    content.querySelector('.vo-reset').addEventListener('click', () => {
      localStorage.removeItem('macweb.voiceover.utility');
      System.alertBox('VoiceOver 实用工具', '偏好设置已恢复为默认值；重新打开实用工具后生效。');
    });
    paint('general');
    voiceOverUtilityWin = System.createWindow({
      app: 'sysprefs', title: 'VoiceOver 实用工具', width: 760, height: 520,
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
      <div class="spp-tabs"><button class="active" data-tab="zoom">缩放</button><button data-tab="voiceover">VoiceOver</button><button data-tab="display">显示器</button></div>
      <section class="spp-tab-panel" data-panel="zoom"><h3>缩放选项</h3><label class="spp-check"><input type="checkbox" data-option-key="zoomFollowFocus" ${checked('zoomFollowFocus')}> 缩放视图跟随键盘焦点</label><label class="spp-check"><input type="checkbox" data-option-key="zoomSmooth" ${checked('zoomSmooth')}> 平滑图像</label><label class="vo-row"><span>缩放样式：</span><select class="spp-select"><option>全屏</option><option>画中画</option></select></label><label class="vo-slider"><span>最大缩放：</span><b>2×</b><input type="range" min="2" max="20" value="8"><b>20×</b></label></section>
      <section class="spp-tab-panel" data-panel="voiceover" hidden><h3>VoiceOver 选项</h3><label class="spp-check"><input type="checkbox" data-option-key="voiceOverCursor" ${checked('voiceOverCursor')}> 显示 VoiceOver 光标</label><label class="spp-check"><input type="checkbox" data-option-key="keyboardFocus" ${checked('keyboardFocus')}> 同步键盘焦点</label><label class="spp-check"><input type="checkbox" data-option-key="announceNotifications" ${checked('announceNotifications')}> 朗读通知与警告</label><button class="aqua-btn options-open-utility">打开 VoiceOver 实用工具…</button></section>
      <section class="spp-tab-panel" data-panel="display" hidden><h3>鼠标指针与显示</h3><label class="vo-slider"><span>鼠标指针大小：</span><b>小</b><input type="range" data-option-key="cursorSize" min="16" max="48" value="${cfg.cursorSize}"><b>大</b></label><div class="cursor-size-preview">↖</div><label class="spp-check"><input type="checkbox"> 反转黑白显示</label><label class="spp-check"><input type="checkbox"> 使用灰度</label></section>
      <footer><button class="aqua-btn universal-options-help">帮助</button><i></i><button class="aqua-btn default universal-options-done">完成</button></footer>`;
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
    content.querySelector('.universal-options-help').addEventListener('click', () => System.alertBox('万能辅助选项', '这些设置模拟 Leopard 的缩放、VoiceOver 光标和显示辅助功能。'));
    content.querySelector('.universal-options-done').addEventListener('click', () => System.closeWindow(universalOptionsWin));
    universalOptionsWin = System.createWindow({
      app: 'sysprefs', title: '万能辅助选项', width: 560, height: 430,
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

    if (id === 'exposespaces') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="expose">Exposé</button><button data-tab="spaces">Spaces</button></div>
      <section class="spp-tab-panel expose-panel" data-panel="expose">
        <div class="monitor-preview"><div class="hot-corner tl">↖</div><div class="hot-corner tr">↗</div><div class="hot-corner bl">↙</div><div class="hot-corner br">↘</div><span>Mac OS X</span></div>
        <div class="spp-pref-card"><h3>活动的屏幕角</h3><div class="hot-corners">
          ${['左上角','右上角','左下角','右下角'].map((name, index) => `<label>${name}<select class="spp-select"><option>${['所有窗口','Dashboard','桌面','屏幕保护程序'][index]}</option><option>所有窗口</option><option>应用程序窗口</option><option>桌面</option><option>Dashboard</option><option>屏幕保护程序</option><option>停用屏幕保护程序</option><option>—</option></select></label>`).join('')}
        </div></div>
        <div class="expose-shortcuts"><label>所有窗口：<select class="spp-select"><option>F9</option><option>F3</option><option>—</option></select></label><label>应用程序窗口：<select class="spp-select"><option>F10</option><option>F4</option></select></label><label>桌面：<select class="spp-select"><option>F11</option><option>⌘F3</option></select></label></div>
      </section>
      <section class="spp-tab-panel spaces-panel" data-panel="spaces" hidden>
        ${check('spacesEnabled','启用 Spaces',true)}
        <div class="spaces-setup"><div><h3>Spaces：</h3><div class="spaces-pref-grid">${[1,2,3,4].map((n) => `<button data-space="${n}" class="${n === 1 ? 'sel' : ''}"><b>${n}</b><span>${n === 1 ? 'Finder' : n === 2 ? 'Safari' : ''}</span></button>`).join('')}</div><div class="spaces-dimensions"><button class="aqua-btn spaces-minus">－</button><span>2 行 × 2 列</span><button class="aqua-btn spaces-plus">＋</button></div></div>
        <aside><h3>应用程序指定：</h3><div class="spaces-app-list"><p>Finder <b>所有 Spaces</b></p><p>Safari <b>Space 2</b></p></div><div class="table-controls"><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></div></aside></div>
        ${check('menuSpaces','在菜单栏中显示 Spaces',true)}
        <label>在 Spaces 之间切换：<select class="spp-select"><option>Control + 箭头键</option><option>Option + 箭头键</option><option>Command + 箭头键</option></select></label>
        <button class="aqua-btn default show-spaces">显示 Spaces</button>
      </section>`;
    else if (id === 'security') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="general">通用</button><button data-tab="filevault">FileVault</button><button data-tab="firewall">防火墙</button></div>
      <section class="spp-tab-panel security-general" data-panel="general">
        <div class="security-banner"><div class="security-lock"><i></i></div><p><b>安全性</b><br>控制登录、密码和应用程序下载设置。</p></div>
        <div class="spp-pref-card">${check('passwordWake','从睡眠或屏幕保护程序唤醒时需要密码',true)}
          <label class="security-inline">开始睡眠或屏幕保护程序后 <select class="spp-select"><option>立即</option><option>5 秒钟</option><option>1 分钟</option><option>5 分钟</option></select> 要求输入密码</label>
          ${check('disableAutoLogin','停用自动登录')} ${check('secureVirtualMemory','使用安全虚拟内存',true)}
          <label>闲置 <select class="spp-select"><option>30 分钟</option><option>60 分钟</option><option>2 小时</option></select> 后退出登录</label></div>
      </section>
      <section class="spp-tab-panel filevault-panel" data-panel="filevault" hidden>
        <div class="filevault-hero"><div class="filevault-lock"><i></i></div><div><h2>FileVault 保护</h2><p>FileVault 使用登录密码保护个人文件夹中的信息。</p><b class="filevault-status">${cfg.fileVault ? 'FileVault 已为此帐户打开。' : 'FileVault 已为此帐户关闭。'}</b></div></div>
        <div class="spp-pref-card"><p>打开后，系统会在您退出登录时保护个人文件夹。此网页仅模拟 Leopard 的流程，不会读取或加密本机文件。</p><button class="aqua-btn default filevault-toggle">${cfg.fileVault ? '关闭 FileVault…' : '打开 FileVault…'}</button></div>
      </section>
      <section class="spp-tab-panel firewall-panel" data-panel="firewall" hidden>
        <div class="security-banner firewall-banner"><div class="firewall-shield">✓</div><p><b>防火墙</b><br>控制其他电脑可以连接的服务和应用程序。</p></div>
        <div class="spp-pref-card firewall-options">
          <label><input type="radio" name="firewall" value="all"> 允许所有传入连接</label>
          <label><input type="radio" name="firewall" value="essential"> 仅允许基本服务</label>
          <label><input type="radio" name="firewall" value="specific" checked> 设定特定服务和应用程序的访问</label>
          <div class="firewall-table"><p><span>屏幕共享</span><b>允许传入连接</b></p><p><span>文件共享</span><b>允许传入连接</b></p></div>
          <button class="aqua-btn firewall-advanced">高级…</button>
        </div>
      </section>`;
    else if (id === 'spotlight') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="results">搜索结果</button><button data-tab="privacy">隐私</button></div>
      <section class="spp-tab-panel spotlight-results" data-panel="results">
        <p>Spotlight 将按以下顺序显示搜索结果：</p>
        <div class="spp-pref-card spp-category-list">${['应用程序','系统偏好设置','文稿','文件夹','Mail 邮件','信息与聊天','通讯录','图像','音乐','影片','字体','演示文稿','网页','PDF 文稿'].map((name,index) => check(`cat${index}`,name,true)).join('')}</div>
        <div class="spotlight-shortcuts"><label>Spotlight 菜单快捷键：<select class="spp-select safe-profile"><option value="ctrlShift">⌃⇧Space（网页安全）</option><option value="ctrlAlt">⌃⌥Space</option></select></label><label>Spotlight 窗口快捷键：<select class="spp-select"><option>⌃⇧⌘Space</option><option>—</option></select></label></div>
      </section>
      <section class="spp-tab-panel spotlight-privacy" data-panel="privacy" hidden>
        <p>Spotlight 将不会搜索下面的位置：</p>
        <div class="privacy-list"><header><span>位置</span><span>种类</span></header><button class="privacy-row"><span>私人资料</span><span>文件夹</span></button></div>
        <div class="table-controls"><button class="aqua-btn privacy-add">＋</button><button class="aqua-btn privacy-remove">－</button></div>
        <p class="spp-hint">添加到这里的虚拟文件夹会从网页 Spotlight 搜索结果中排除。</p>
      </section>`;
    else if (id === 'international') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="language">语言</button><button data-tab="formats">格式</button><button data-tab="input">输入法菜单</button></div>
      <section class="spp-tab-panel language-panel" data-panel="language">
        <p>将您希望在菜单和对话框中使用的语言拖到列表顶部：</p>
        <div class="international-columns"><div><ol class="language-list">${['简体中文','English','日本語','Français','Deutsch'].map((name,index)=>`<li><button class="${index === 0 ? 'sel' : ''}" data-language="${name}">${name}</button></li>`).join('')}</ol><div class="language-actions"><button class="aqua-btn language-up">上移</button><button class="aqua-btn language-down">下移</button><button class="aqua-btn language-edit">编辑列表…</button></div></div>
        <aside><label>排序列表的顺序：<select class="spp-select"><option>简体中文</option><option>English</option><option>通用</option></select></label><p>若要让语言更改应用到已经打开的应用程序，请重新打开应用程序。</p></aside></div>
      </section>
      <section class="spp-tab-panel formats-panel" data-panel="formats" hidden>
        <label class="region-label">地区：<select class="spp-select international-region"><option>中国</option><option>马来西亚</option><option>美国</option><option>日本</option><option>英国</option></select></label>
        <div class="format-preview"><dl><dt>日期：</dt><dd class="format-date"></dd><dt>时间：</dt><dd class="format-time"></dd><dt>数字：</dt><dd class="format-number"></dd><dt>货币：</dt><dd class="format-currency"></dd></dl></div>
        <div class="format-controls"><label>日历：<select class="spp-select"><option>公历</option><option>佛历</option><option>日本历</option></select></label><label>度量单位：<select class="spp-select measurement"><option>公制</option><option>美国</option><option>英国</option></select></label><label>每周的第一天：<select class="spp-select"><option>星期一</option><option>星期日</option></select></label></div>
      </section>
      <section class="spp-tab-panel input-menu-panel" data-panel="input" hidden>
        <p>选择要在输入法菜单中使用的输入源：</p>
        <div class="input-source-list">${[['拼音 - 简体中文','简'],['ABC','A'],['日文 - 罗马字','あ'],['Unicode 十六进制输入','U+']].map(([name,mark],index)=>`<label><input type="checkbox" ${index < 2 ? 'checked' : ''}><i>${mark}</i><span>${name}</span></label>`).join('')}</div>
        ${check('inputMenu','在菜单栏中显示输入法菜单',true)}
        ${check('documentInput','允许每个文稿使用不同的输入源')}
        <button class="aqua-btn input-shortcuts">键盘快捷键…</button>
      </section>`;
    else if (id === 'keyboard') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="keyboard">键盘</button><button data-tab="mouse">鼠标</button><button data-tab="shortcuts">键盘快捷键</button></div>
      <section class="spp-tab-panel keyboard-panel" data-panel="keyboard">
        <div class="keyboard-visual" aria-label="键盘测试图">${keyboardMarkup}</div>
        <div class="spp-pref-card keyboard-settings">
          <label><span>按键重复速率：</span><small>慢</small>${range('repeat',70)}<small>快</small></label>
          <label><span>重复前延迟：</span><small>长</small>${range('delay',55)}<small>短</small></label>
          ${check('fkeys','将 F1、F2 等键用作标准功能键')}
          <label>在此处键入以测试设置：<input class="aqua-input keyboard-test" autocomplete="off" placeholder="按下按键，上方对应键会亮起"></label>
        </div>
      </section>
      <section class="spp-tab-panel mouse-panel" data-panel="mouse" hidden>
        <div class="mighty-mouse" aria-hidden="true"><i></i><span>●</span></div>
        <div class="mouse-controls"><label><span>跟踪速度</span><small>慢</small>${range('tracking',62)}<small>快</small></label><label><span>连按速度</span><small>慢</small>${range('doubleClick',58)}<small>快</small></label><label><span>滚动速度</span><small>慢</small>${range('scrolling',65)}<small>快</small></label><label>主鼠标按钮：<select class="spp-select"><option>左</option><option>右</option></select></label>${check('mouseZoom','按住 Control 键并滚动来缩放')}</div>
      </section>
      <section class="spp-tab-panel shortcut-panel" data-panel="shortcuts" hidden>
        <div class="shortcut-layout"><aside>${['Dashboard 与 Dock','显示器','键盘与文本输入','屏幕快照','Spotlight','万能辅助'].map((name,index)=>`<button data-shortcat="${index}" class="${index === 0 ? 'sel' : ''}">${name}</button>`).join('')}</aside><main class="shortcut-rows"></main></div>
        <div class="shortcut-footer"><label>网页安全修饰键：<select class="spp-select safe-profile"><option value="ctrlShift">⌃⇧（推荐）</option><option value="ctrlAlt">⌃⌥（传统）</option></select></label><button class="aqua-btn keyboard-capture">进入全屏键盘捕获</button><button class="aqua-btn keyboard-help">快捷键速查</button></div>
      </section>`;
    else if (id === 'cd') c.innerHTML = `
      <div class="cd-disc-art"><div><i></i></div><p><b>插入光盘时</b><br>为每一种光盘选择自动执行的操作。</p></div>
      <div class="spp-pref-card cd-actions">${['空白 CD','空白 DVD','音乐 CD','图片 CD','视频 DVD'].map((name)=>`<label><span>${name}：</span><select class="spp-select"><option>询问要执行的操作</option><option>打开 Finder</option><option>打开 iTunes</option><option>打开 DVD 播放器</option><option>忽略</option></select></label>`).join('')}</div>`;
    else if (id === 'printfax') c.innerHTML = `
      <div class="print-fax-pane"><aside><header>打印机</header><div class="printer-sidebar-list"><button class="sel"><i>${printerSvg}</i><span>Web PDF Printer<small>空闲，默认</small></span></button></div><footer><button class="printer-add" title="添加打印机">＋</button><button class="printer-remove" title="移除打印机">－</button><i></i><button class="printer-gear" title="操作">⚙</button></footer></aside>
      <main><section class="printer-summary"><div class="printer-large">${printerSvg}</div><div><h3>Web PDF Printer</h3><dl><dt>状态：</dt><dd class="ready">空闲</dd><dt>种类：</dt><dd>虚拟 PostScript 打印机</dd><dt>位置：</dt><dd>下载文件夹</dd></dl></div></section><div class="printer-actions"><button class="aqua-btn default print-open-queue">打开打印队列…</button><button class="aqua-btn printer-options">选项与耗材…</button></div><label class="spp-check"><input type="checkbox" data-key="sharePrinter" ${checked('sharePrinter')}> 共享此打印机</label></main>
      <footer class="print-defaults"><label>默认打印机：<select class="spp-select"><option>Web PDF Printer</option><option>上次使用的打印机</option></select></label><label>默认纸张大小：<select class="spp-select"><option>A4</option><option>US Letter</option><option>A5</option></select></label></footer></div>`;
    else if (id === 'network') c.innerHTML = `
      <div class="network-pref"><header><label>位置：<select class="spp-select network-location"><option value="automatic">自动</option><option value="home">家庭</option><option value="work">工作</option></select></label></header>
      <aside><div class="network-service-list"><button data-service="airport" class="sel"><i class="status-dot green"></i><span>AirPort<small>已连接</small></span></button><button data-service="ethernet"><i class="status-dot red"></i><span>以太网<small>未连接</small></span></button><button data-service="bluetooth"><i class="status-dot red"></i><span>Bluetooth<small>未连接</small></span></button><button data-service="firewire"><i class="status-dot gray"></i><span>FireWire<small>未连接</small></span></button></div><footer><button class="network-add-service">＋</button><button class="network-remove-service">－</button><i></i><button class="network-service-gear">⚙</button></footer></aside>
      <main><section class="airport-summary"><div class="airport-rings"><i></i><i></i><i></i></div><div><h3 class="network-service-title">AirPort <b>已连接</b></h3><p class="network-service-copy">AirPort 已连接到 <strong>Leopard Web</strong>，并且 IP 地址为 192.168.1.105。</p></div></section>
      <label class="spp-check network-power"><input type="checkbox" data-key="airportOn" ${checked('airportOn',true)}> 打开 AirPort</label><label class="network-name-row"><span>网络名称：</span><select class="spp-select network-name"><option>Leopard Web</option></select></label>${check('askNetworks','加入新网络前询问',true)}
      <div class="network-buttons"><button class="aqua-btn network-assist">向导…</button><button class="aqua-btn network-advanced">高级…</button></div><p class="network-status"><i></i><span>状态：<b>已连接</b><br>AirPort 已取得网络地址。</span></p></main>
      <footer class="network-footer"><button class="aqua-btn network-diagnose">诊断…</button><i></i><button class="aqua-btn network-revert" disabled>还原</button><button class="aqua-btn default network-apply">应用</button></footer></div>`;
    else if (id === 'bluetooth') c.innerHTML = `
      <div class="bluetooth-pref"><header><div class="bt-orb">ᛒ</div><div><h2>Bluetooth</h2><p>使用 Bluetooth 无线技术连接键盘、鼠标、电话及其他设备。</p></div></header>
      <div class="bluetooth-body"><aside><label class="spp-check"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}> 打开 Bluetooth</label><label class="spp-check"><input type="checkbox" data-key="discoverable" ${checked('discoverable',true)}> 可被发现</label><p>这台电脑将显示为：<br><b>“roll 的 Mac”</b></p></aside>
      <main><h3>Bluetooth 设备：</h3><div class="bluetooth-device-list"></div><div class="bluetooth-device-actions"><button class="aqua-btn bluetooth-remove" disabled>－</button><button class="aqua-btn default bluetooth-setup">设置新设备…</button></div>${check('menu','在菜单栏中显示 Bluetooth 状态',true)}</main></div>
      <footer><button class="aqua-btn bluetooth-file">发送文件…</button><button class="aqua-btn bluetooth-browse">浏览设备…</button><i></i><button class="aqua-btn bluetooth-advanced">高级…</button></footer></div>`;
    else if (id === 'sharing') c.innerHTML = `
      <div class="spp-split sharing-pane"><aside><header>服务</header>${['DVD 或 CD 共享','屏幕共享','文件共享','打印机共享','Web 共享','远程登录','远程 Apple Events','Internet 共享','Bluetooth 共享'].map((name,index)=>`<label data-service-index="${index}" class="${index === 2 ? 'sel' : ''}"><input type="checkbox" data-key="service${index}" ${checked(`service${index}`)}> <span>${name}</span></label>`).join('')}</aside>
      <main><header><i class="sharing-status-light"></i><div><h3>文件共享：关闭</h3><p>其他用户可以访问这台电脑上的共享文件夹。</p></div></header><div class="sharing-columns"><section><h4>共享的文件夹：</h4><div class="sharing-list"><button class="sel">roll 的公共文件夹</button><button>站点</button></div><div class="table-controls"><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></div></section><section><h4>用户：</h4><div class="sharing-list"><p><span>roll</span><b>读与写</b></p><p><span>所有人</span><b>只读</b></p></div></section></div><label class="computer-name">电脑名称：<input class="aqua-input" value="roll 的 Mac"></label><p class="sharing-address">其他电脑可通过 <b>afp://rolls-mac.local/</b> 访问。</p></main></div>`;
    else if (id === 'dotmac') c.innerHTML = `
      <div class="dotmac-header"><div class="dotmac-cloud"><b>.Mac</b></div><div><h2>.Mac</h2><p>将邮件、书签、日历和文件同步到其他 Mac。</p></div></div>
      <div class="spp-tabs"><button class="active" data-tab="account">帐户</button><button data-tab="idisk">iDisk</button><button data-tab="sync">同步</button><button data-tab="back">Back to My Mac</button></div>
      <section class="spp-tab-panel dotmac-account" data-panel="account"><div class="spp-pref-card"><label><span>.Mac 会员名称：</span><input class="aqua-input dotmac-name" placeholder="name"></label><label><span>密码：</span><input class="aqua-input" type="password" placeholder="不会保存真实密码"></label><div><button class="aqua-btn dotmac-login">登录</button><button class="aqua-btn">忘记密码？</button></div><p class="spp-hint">网页版不会发送或保存凭据。</p></div></section>
      <section class="spp-tab-panel" data-panel="idisk" hidden><div class="idisk-meter"><i style="width:28%"></i></div><p>iDisk 储存空间：已使用 2.8 GB，共 10 GB</p>${check('idiskSync','启用 iDisk 同步')}</section>
      <section class="spp-tab-panel" data-panel="sync" hidden><h3>同步以下项目：</h3>${['书签','日历','通讯录','Mail 帐户','Dashboard Widget','钥匙串'].map((name,index)=>check(`sync${index}`,name,index < 3)).join('')}<button class="aqua-btn dotmac-sync">立即同步</button></section>
      <section class="spp-tab-panel" data-panel="back" hidden><h3>Back to My Mac</h3><p>通过 Internet 安全地访问其他 Mac 上的文件和屏幕。</p>${check('backToMac','打开 Back to My Mac')}<div class="dotmac-computers">没有可用的其他 Mac。</div></section>`;
    else if (id === 'parental') c.innerHTML = `
      <div class="parental-pref"><aside><header>帐户</header><button class="sel"><i class="spp-avatar">R</i><span>roll<small>管理员</small></span></button><footer><button>＋</button><button>－</button><i></i><button>⚙</button></footer></aside>
      <main><div class="parental-title"><i class="spp-avatar large">R</i><div><h2>roll 的控制</h2><p>为此帐户设置可以使用的项目和时间。</p></div></div>
      <div class="spp-tabs"><button class="active" data-tab="system">系统</button><button data-tab="content">内容</button><button data-tab="mailchat">Mail 与 iChat</button><button data-tab="time">时间限制</button><button data-tab="logs">日志</button></div>
      <section class="spp-tab-panel" data-panel="system">${check('simpleFinder','使用简单 Finder')}${check('limitApps','仅允许所选应用程序')}<div class="parental-apps"><label><input type="checkbox" checked> Finder</label><label><input type="checkbox" checked> Safari</label><label><input type="checkbox"> Terminal</label></div></section>
      <section class="spp-tab-panel" data-panel="content" hidden>${check('hideProfanity','隐藏字典中的不雅用语',true)}${check('limitWeb','尝试自动限制成人网站')}<button class="aqua-btn">自定…</button></section>
      <section class="spp-tab-panel" data-panel="mailchat" hidden>${check('limitMail','限制 Mail 联系人')}${check('limitChat','限制 iChat 联系人')}<div class="parental-contacts">尚未添加允许的联系人。</div><button class="aqua-btn">＋</button><button class="aqua-btn">－</button></section>
      <section class="spp-tab-panel parental-time" data-panel="time" hidden><label>工作日每天：<select class="spp-select"><option>无限制</option><option>1 小时</option><option>2 小时</option><option>4 小时</option></select></label><label>周末每天：<select class="spp-select"><option>无限制</option><option>2 小时</option><option>4 小时</option></select></label><label>就寝时间：<input type="time" value="22:00"> 至 <input type="time" value="07:00"></label></section>
      <section class="spp-tab-panel" data-panel="logs" hidden><div class="parental-log"><header><span>日期</span><span>应用程序或网站</span></header><p><span>今天</span><span>Safari — Leopard Web</span></p></div><button class="aqua-btn">清除日志…</button></section></main></div>`;
    else if (id === 'speech') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="tts">文本转语音</button><button data-tab="recognition">语音识别</button></div>
      <section class="spp-tab-panel speech-tts" data-panel="tts"><div class="speech-avatar">◖))</div><div class="spp-pref-card"><label>系统语音：<select class="spp-select speech-voice"></select></label><label>语速：${range('rate',50)}</label><textarea class="aqua-input speech-text">欢迎使用 Mac OS X Leopard。</textarea><button class="aqua-btn speech-play">播放</button>${check('announceAlerts','发出警告时朗读用户界面文本')}</div></section>
      <section class="spp-tab-panel speech-recognition" data-panel="recognition" hidden><div class="speech-mic-art">${microphoneSvg}</div><div><h3>可听命令</h3><label class="spp-check"><input type="checkbox" data-key="recognition" ${checked('recognition')}> 打开可听命令</label><label>听取键：<select class="spp-select"><option>Esc</option><option>Control</option><option>Command</option></select></label><label>关键字：<input class="aqua-input speech-keyword" value="Computer"></label><button class="aqua-btn default speech-listen">开始听取</button><p class="speech-recognition-status">浏览器会在开始时请求麦克风权限。</p><div class="speech-transcript">识别到的文字会显示在这里。</div></div></section>`;
    else if (id === 'startup') c.innerHTML = `
      <div class="startup-disks"><button class="sel">${ICONS.hd}<b>Mac OS X, 10.5</b><span>Macintosh HD</span></button><button>${ICONS.folder}<b>Network Startup</b><span>网络服务器</span></button></div><p>选择要用于启动电脑的系统，然后点按“重新启动”。</p><button class="aqua-btn">目标磁盘模式…</button><button class="aqua-btn default restart-pref">重新启动…</button>`;
    else if (id === 'timemachine') c.innerHTML = `
      <div class="tm-pref"><div>${Leopard.glyph('timemachine',120)}</div><section><h3>Time Machine</h3><label class="tm-switch"><input type="checkbox" data-key="enabled" ${checked('enabled',true)}><i></i><span>开</span></label><p>最早的备份：今天<br>最新的备份：${new Date().toLocaleTimeString('zh-CN')}<br>下一次备份：约一小时后</p>${check('menu','在菜单栏中显示 Time Machine 状态',true)}<button class="aqua-btn tm-backup">立即备份</button><button class="aqua-btn tm-enter">进入 Time Machine</button></section></div>`;
    else if (id === 'universal') c.innerHTML = `
      <div class="spp-tabs"><button class="active" data-tab="seeing">视觉</button><button data-tab="hearing">听觉</button><button data-tab="keyboard">键盘</button><button data-tab="mouse">鼠标</button></div>
      <section class="spp-tab-panel universal-section" data-panel="seeing"><div class="accessibility-symbol">●</div><div><h3>视觉</h3>${check('voiceOver','启用 VoiceOver')}${check('zoom','启用缩放')}<label>显示器对比度：${range('contrast',0,0,80)}</label><div><button class="aqua-btn voiceover-utility-open">打开 VoiceOver 实用工具…</button><button class="aqua-btn universal-options-open">选项…</button></div></div></section>
      <section class="spp-tab-panel universal-section" data-panel="hearing" hidden><div class="accessibility-symbol">◖</div><div><h3>听觉</h3>${check('flashScreen','发出警告声音时闪烁屏幕')}${check('stereoMono','将立体声音频作为单声道播放')}<button class="aqua-btn flash-test">闪烁屏幕</button></div></section>
      <section class="spp-tab-panel universal-section" data-panel="keyboard" hidden><div class="accessibility-symbol">⌨</div><div><h3>键盘</h3>${check('stickyKeys','启用粘滞键')}${check('slowKeys','启用慢速键')}<label>接受延迟：${range('acceptDelay',45)}</label></div></section>
      <section class="spp-tab-panel universal-section" data-panel="mouse" hidden><div class="accessibility-symbol">↖</div><div><h3>鼠标</h3>${check('mouseKeys','启用鼠标键')}<label>初始延迟：${range('mouseDelay',40)}</label><label>最高速度：${range('mouseSpeed',65)}</label></div></section>`;
    else c.innerHTML = '<p>此偏好设置面板已载入。</p>';

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
      c.querySelector('.spaces-minus')?.addEventListener('click', () => Leopard.toast('Spaces', '至少保留一个 Space。'));
      c.querySelector('.spaces-plus')?.addEventListener('click', () => Leopard.toast('Spaces', '已添加一个 Space。'));
    }
    if (id === 'security') {
      c.querySelectorAll('[name="firewall"]').forEach((radio) => {
        radio.checked = radio.value === (cfg.firewall || 'specific');
        radio.addEventListener('change', () => { cfg.firewall = radio.value; save('macweb.pref.security', cfg); });
      });
      c.querySelector('.filevault-toggle')?.addEventListener('click', () => {
        if (cfg.fileVault) {
          cfg.fileVault = false; save('macweb.pref.security', cfg);
          c.querySelector('.filevault-status').textContent = 'FileVault 已为此帐户关闭。';
          c.querySelector('.filevault-toggle').textContent = '打开 FileVault…';
        } else openFileVaultAssistant(cfg, () => {
          c.querySelector('.filevault-status').textContent = 'FileVault 已为此帐户打开。';
          c.querySelector('.filevault-toggle').textContent = '关闭 FileVault…';
        });
      });
      c.querySelector('.firewall-advanced')?.addEventListener('click', () => System.alertBox('防火墙高级设置', '隐身模式：关闭\n自动允许已签名的软件接收传入连接：打开\n日志记录：打开'));
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
          parent:winRef, title:'Spotlight 隐私', message:'要排除的虚拟文件夹名称：',
          value:'私人资料', okLabel:'排除',
          onOK:(name)=>{
            const button = el('button', 'privacy-row');
            button.innerHTML = '<span></span><span>文件夹</span>';
            button.firstElementChild.textContent = name;
            privacyList.appendChild(button);
          },
        });
      });
      c.querySelector('.privacy-remove').addEventListener('click', () => privacyList.querySelector('.privacy-row.sel')?.remove());
    }
    if (id === 'international') {
      const list = c.querySelector('.language-list');
      list.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button) list.querySelectorAll('button').forEach((item) => item.classList.toggle('sel', item === button));
      });
      const moveLanguage = (direction) => {
        const selected = list.querySelector('button.sel')?.closest('li');
        const sibling = direction < 0 ? selected?.previousElementSibling : selected?.nextElementSibling;
        if (selected && sibling) list.insertBefore(direction < 0 ? selected : sibling, direction < 0 ? sibling : selected);
      };
      c.querySelector('.language-up').addEventListener('click', () => moveLanguage(-1));
      c.querySelector('.language-down').addEventListener('click', () => moveLanguage(1));
      c.querySelector('.language-edit').addEventListener('click', () => System.alertBox('编辑语言列表', 'Leopard Web 已提供简体中文、English、日本語、Français 和 Deutsch。选择一种语言后可上移或下移。'));
      const localeMap = { 中国:'zh-CN', 马来西亚:'ms-MY', 美国:'en-US', 日本:'ja-JP', 英国:'en-GB' };
      const region = c.querySelector('.international-region');
      region.value = cfg.region || '中国';
      const paintFormats = () => {
        const locale = localeMap[region.value] || 'zh-CN';
        const currency = { 中国:'CNY', 马来西亚:'MYR', 美国:'USD', 日本:'JPY', 英国:'GBP' }[region.value];
        const now = new Date();
        c.querySelector('.format-date').textContent = new Intl.DateTimeFormat(locale, { dateStyle:'full' }).format(now);
        c.querySelector('.format-time').textContent = new Intl.DateTimeFormat(locale, { timeStyle:'medium' }).format(now);
        c.querySelector('.format-number').textContent = new Intl.NumberFormat(locale).format(1234567.89);
        c.querySelector('.format-currency').textContent = new Intl.NumberFormat(locale, { style:'currency', currency }).format(1234.56);
        c.querySelector('.measurement').value = ['美国'].includes(region.value) ? '美国' : region.value === '英国' ? '英国' : '公制';
      };
      region.addEventListener('change', () => { cfg.region = region.value; save('macweb.pref.international', cfg); paintFormats(); });
      paintFormats();
      c.querySelector('.input-shortcuts').addEventListener('click', Leopard.showShortcutHelp);
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
        [['显示 Dashboard','⌃⇧D'],['显示 Dock','⌃⇧K'],['显示 Spaces','⌃⇧S']],
        [['降低显示器亮度','F1'],['提高显示器亮度','F2'],['检测显示器','⌃F2']],
        [['将焦点移到菜单栏','⌃F2'],['将焦点移到 Dock','⌃F3'],['快速查看','Space']],
        [['将屏幕图片存储为文件','⌃⇧3'],['将所选区域存储为文件','⌃⇧4']],
        [['显示 Spotlight 搜索栏','⌃⇧Space'],['显示 Spotlight 窗口','⌃⇧⌘Space']],
        [['打开 VoiceOver','⌃⇧V'],['打开缩放','⌃⇧Z']],
      ];
      const renderShortcuts = (index) => {
        const main = c.querySelector('.shortcut-rows');
        main.innerHTML = `<header><span>操作</span><span>快捷键</span></header>${shortcutSets[index].map(([name,key])=>`<label><span><input type="checkbox" checked> ${name}</span><kbd>${key}</kbd></label>`).join('')}`;
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
      c.querySelector('.printer-remove').addEventListener('click', () => Leopard.toast('打印与传真', '默认 PDF 打印机不能移除。'));
      c.querySelector('.printer-gear').addEventListener('click', (event) => System.contextMenu(event, [{ label:'设为默认打印机', action:()=>Leopard.toast('打印机','Web PDF Printer 已设为默认打印机。') }, { label:'重置打印系统…', action:()=>System.alertBox('重置打印系统','网页版打印系统不需要重置。') }]));
      c.querySelector('.printer-options').addEventListener('click', () => System.alertBox('选项与耗材', '驱动程序：Generic PostScript Printer\n纸张来源：自动选择\n输出：PDF 文件，保存在下载文件夹'));
    }
    if (id === 'network') {
      const airportConnected = () => cfg.airportOn !== false;
      const serviceList = c.querySelector('.network-service-list');
      const serviceInfo = {
        airport: ['AirPort', airportConnected(), airportConnected() ? 'AirPort 已连接到 <strong>Leopard Web</strong>，并且 IP 地址为 192.168.1.105。' : 'AirPort 已关闭。请从菜单栏或此面板打开 AirPort。'],
        ethernet: ['以太网', false, '网线未连接。连接以太网线后，此服务会自动尝试取得地址。'],
        bluetooth: ['Bluetooth PAN', false, '没有可用的 Bluetooth 个人区域网络设备。'],
        firewire: ['FireWire', false, 'FireWire 网络接口未连接。'],
      };
      const chooseService = (button) => {
        c.querySelectorAll('[data-service]').forEach((item) => item.classList.toggle('sel', item === button));
        const disabled = (cfg.disabledServices || []).includes(button.dataset.service);
        const [baseName, baseConnected, baseCopy] = serviceInfo[button.dataset.service] || [button.textContent.trim(), false, '此服务尚未连接。'];
        const name = baseName;
        const connected = disabled ? false : baseConnected;
        const copy = disabled ? '此网络服务已停用。请从齿轮菜单重新启用。' : baseCopy;
        c.querySelector('.network-service-title').innerHTML = `${name} <b>${connected ? '已连接' : '未连接'}</b>`;
        c.querySelector('.network-service-copy').innerHTML = copy;
        c.querySelector('.network-power').lastChild.textContent = ` 打开 ${name}`;
        c.querySelector('.network-name-row').hidden = button.dataset.service !== 'airport';
        c.querySelector('.network-status').classList.toggle('offline', !connected);
        c.querySelector('.network-status span').innerHTML = `状态：<b>${connected ? '已连接' : '未连接'}</b><br>${connected ? '服务工作正常。' : '没有检测到有效连接。'}`;
      };
      const bindServiceButton = (button) => button.addEventListener('click', () => chooseService(button));
      const appendCustomService = (service, select = false) => {
        if (!service?.id || c.querySelector(`[data-service="${service.id}"]`)) return null;
        const button = el('button');
        button.dataset.service = service.id;
        button.innerHTML = '<i class="status-dot red"></i><span></span>';
        button.querySelector('span').append(document.createTextNode(service.name), Object.assign(document.createElement('small'), { textContent:'未连接' }));
        serviceInfo[service.id] = [service.name, false, '新建服务尚未配置。'];
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
        button.querySelector('small').textContent = '已停用';
      });
      const airportButton = c.querySelector('[data-service="airport"]');
      const airportPower = c.querySelector('.network-power input');
      const syncAirportState = () => {
        const latest = store('macweb.pref.network', {});
        cfg.airportOn = latest.airportOn !== false;
        const connected = cfg.airportOn;
        serviceInfo.airport = ['AirPort', connected, connected ? 'AirPort 已连接到 <strong>Leopard Web</strong>，并且 IP 地址为 192.168.1.105。' : 'AirPort 已关闭。请从菜单栏或此面板打开 AirPort。'];
        airportPower.checked = connected;
        const dot = airportButton.querySelector('.status-dot');
        dot.classList.toggle('green', connected); dot.classList.toggle('red', !connected);
        airportButton.querySelector('small').textContent = connected ? '已连接' : '关闭';
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
        const messages = { automatic:'自动位置会使用第一个可用的服务。', home:'家庭位置优先使用 Leopard Web。', work:'工作位置要求手动代理设置。' };
        c.querySelector('.network-status span').innerHTML = `状态：<b>已连接</b><br>${messages[location.value]}`;
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
        if (!selected || selected.dataset.service === 'airport') { Leopard.toast('网络', 'AirPort 是当前活动服务，不能移除。'); return; }
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
          { label:'复制服务', action:() => {
            const sourceName = serviceInfo[serviceId]?.[0] || '网络服务';
            const service = { id:`custom${Date.now()}`, name:`${sourceName} 副本` };
            cfg.customServices = [...(cfg.customServices || []), service];
            cfg.serviceOrder = normalizedServiceOrder(cfg);
            save('macweb.pref.network', cfg);
            appendCustomService(service, true);
            reorderServiceButtons(cfg.serviceOrder);
          } },
          { label:disabled ? '启用服务' : '停用服务', action:() => {
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
            selected.querySelector('small').textContent = disabled ? (serviceId === 'airport' ? '已连接' : '未连接') : '已停用';
            chooseService(selected);
          } },
          { sep:true },
          { label:'设定服务顺序…', action:()=>openNetworkServiceOrder(cfg, reorderServiceButtons) },
        ]);
      });
      c.querySelector('.network-diagnose').addEventListener('click', openNetworkDiagnostics);
      c.querySelector('.network-assist').addEventListener('click', () => openNetworkServiceAssistant());
      c.querySelector('.network-advanced').addEventListener('click', () => openNetworkAdvanced(cfg));
      c.querySelector('.network-apply').addEventListener('click', () => Leopard.toast('网络', '网络设置已经应用。'));
    }
    if (id === 'bluetooth') {
      const bluetoothList = c.querySelector('.bluetooth-device-list');
      const appendBluetoothDevice = (name, state = '未连接') => {
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
        appendBluetoothDevice('Apple Wireless Keyboard', connectedNow.has('Apple Wireless Keyboard') ? '已连接' : '未连接');
        appendBluetoothDevice('Mighty Mouse', connectedNow.has('Mighty Mouse') ? '已连接' : '未连接');
        (latest.devices || []).forEach((name) => appendBluetoothDevice(name, connectedNow.has(name) ? '已连接' : '已配对'));
      };
      syncBluetoothDeviceState();
      document.addEventListener('leopard-bluetooth-devices-changed', syncBluetoothDeviceState);
      queueMicrotask(() => { bluetoothPaneMounted = true; });
      c.querySelector('.bluetooth-setup').addEventListener('click', () => openBluetoothAssistant(cfg, (name) => {
        appendBluetoothDevice(name, '已配对');
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
      const services = ['DVD 或 CD 共享','屏幕共享','文件共享','打印机共享','Web 共享','远程登录','远程 Apple Events','Internet 共享','Bluetooth 共享'];
      c.querySelectorAll('[data-service-index]').forEach((label) => label.addEventListener('click', () => {
        c.querySelectorAll('[data-service-index]').forEach((item) => item.classList.toggle('sel', item === label));
        const input = label.querySelector('input');
        c.querySelector('.sharing-pane main h3').textContent = `${services[+label.dataset.serviceIndex]}：${input.checked ? '打开' : '关闭'}`;
        c.querySelector('.sharing-status-light').classList.toggle('on', input.checked);
      }));
    }
    if (id === 'dotmac') {
      c.querySelector('.dotmac-login').addEventListener('click', () => {
        const name = c.querySelector('.dotmac-name').value.trim();
        System.alertBox('.Mac', name ? `无法连接到旧版 .Mac 服务。\n已保留“${name}”的本地演示设置。` : '请输入 .Mac 会员名称。');
      });
      c.querySelector('.dotmac-sync').addEventListener('click', () => Leopard.toast('.Mac', '本地演示数据已经同步。'));
    }
    if (id === 'speech') {
      if ('speechSynthesis' in window) {
        const select = c.querySelector('.speech-voice');
        const fillVoices = () => {
          const voices = speechSynthesis.getVoices();
          select.innerHTML = voices.map((voice,index) => `<option value="${index}">${voice.name} — ${voice.lang}</option>`).join('') || '<option>系统默认语音</option>';
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
        if (!Recognition) { status.textContent = '此浏览器不支持 Web Speech Recognition。'; return; }
        const recognition = new Recognition();
        recognition.lang = 'zh-CN'; recognition.interimResults = true;
        recognition.onstart = () => { status.textContent = '正在听取…'; c.querySelector('.speech-listen').textContent = '停止'; };
        recognition.onresult = (event) => { c.querySelector('.speech-transcript').textContent = Array.from(event.results, (result) => result[0].transcript).join(''); };
        recognition.onerror = (event) => { status.textContent = `无法识别：${event.error}`; };
        recognition.onend = () => { status.textContent = '听取已结束。'; c.querySelector('.speech-listen').textContent = '开始听取'; };
        recognition.start();
      });
    }
    if (id === 'startup') c.querySelector('.restart-pref')?.addEventListener('click', () => System.shutdownSequence(true));
    if (id === 'timemachine') {
      c.querySelector('.tm-backup').addEventListener('click', () => { Leopard.saveSnapshot('手动备份'); Leopard.toast('Time Machine', '备份已完成。'); });
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

  function showAll() {
    const body = winRef._spBody;
    body.classList.remove('showing-pane');
    body.innerHTML = '';
    ['个人', '硬件', '互联网与无线', '系统'].forEach((g) => {
      body.appendChild(el('div', 'spp-group-label', g));
      const grid = el('div', 'spp-grid');
      PANES.filter((p) => p.group === g).forEach((p) => {
        const t = el('div', 'spp-tile');
        t.innerHTML = `<div class="spp-tile-icon">${PI[p.id]}</div><div>${p.name}</div>`;
        t.addEventListener('click', () => showPane(p.id));
        grid.appendChild(t);
      });
      body.appendChild(grid);
    });
    winRef._title.textContent = '系统偏好设置';
    winRef._spBack.disabled = true;
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
    const body = winRef._spBody;
    body.classList.add('showing-pane');
    body.innerHTML = '';
    body.appendChild(p.build());
    winRef._title.textContent = p.name;
    winRef._spBack.disabled = false;
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

  function open(arg) {
    if (winRef && winRef.isConnected) {
      if (arg && arg.pane) showPane(arg.pane); else showAll();
      System.focusWindow(winRef);
      return;
    }
    const toolbar = el('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%';
    const back = el('button', 'finder-toolbar-btn', '◀ 显示全部');
    const spot = el('span', 'finder-path', '');
    toolbar.append(back, spot);

    const body = el('div', 'spp-body');
    winRef = System.createWindow({
      app:'sysprefs', title:'系统偏好设置', width:690, height:570,
      toolbar, content:body, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:300, maxHeight:570, width:690, extraHeight:0 },
    });
    winRef._spBody = body;
    winRef._spBack = back;
    back.addEventListener('click', showAll);
    if (arg && arg.pane) showPane(arg.pane); else showAll();
  }

  installScreenSaverRuntime();
  installEnergyScheduleRuntime();

  System.registerApp({
    id: 'sysprefs', name: '系统偏好设置', icon, open,
    about: '完整的 Leopard 偏好面板：外观、桌面与屏保、Dock、Exposé 与 Spaces、键盘、网络、共享、Time Machine、万能辅助等。',
    keywords: 'preferences settings 设置 偏好 壁纸 外观 声音 dock spaces time machine network',
  });
})();
