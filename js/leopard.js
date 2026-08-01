// Leopard system extensions: keyboard routing, Spaces, Dashboard, Time Machine,
// Dock Stacks, Quick Look, and full-content Spotlight.
const Leopard = (() => {
  const { el } = System;
  const STORE = {
    keyboard: 'macweb.keyboard.v2',
    spaces: 'macweb.spaces.v1',
    snapshots: 'macweb.timemachine.v1',
    dashboard: 'macweb.dashboard.v1',
  };
  const state = {
    currentSpace: Math.max(1, Math.min(4, +(localStorage.getItem(STORE.spaces) || 1))),
    stackPopup: null,
    dashboard: null,
    spacesOverlay: null,
    timeMachine: null,
    starfieldStop: null,
    spacesDrag: null,
    backupTimer: 0,
    capture: false,
    initialized: false,
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const glyph = (kind, size = 64) => {
    const common = `viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"`;
    const map = {
      dashboard: `<svg ${common}><defs><radialGradient id="ldbd" cx=".35" cy=".25"><stop stop-color="#252a33"/><stop offset="1" stop-color="#08090c"/></radialGradient></defs><circle cx="32" cy="32" r="28" fill="url(#ldbd)" stroke="#454b58" stroke-width="2"/><path d="M32 11a21 21 0 1 1-20 27" fill="none" stroke="#dfe4eb" stroke-width="3"/><path d="M32 32 48 20" stroke="#e64035" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#f3f3f3"/><g fill="#dfe4eb">${[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>`<circle cx="${32+22*Math.sin(a*Math.PI/180)}" cy="${32-22*Math.cos(a*Math.PI/180)}" r="1.3"/>`).join('')}</g></svg>`,
      timemachine: `<svg ${common}><defs><radialGradient id="ldtm" cx=".35" cy=".28"><stop stop-color="#62d0bd"/><stop offset=".68" stop-color="#14766f"/><stop offset="1" stop-color="#074843"/></radialGradient></defs><circle cx="32" cy="32" r="27" fill="url(#ldtm)" stroke="#d7fff6" stroke-width="1.5"/><path d="M19 18a20 20 0 1 1-5 17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="m11 18 9 1-2-9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 19v14l10 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="33" r="2.5" fill="#fff"/></svg>`,
      spaces: `<svg ${common}><defs><linearGradient id="ldsp" x2="0" y2="1"><stop stop-color="#bde5ff"/><stop offset="1" stop-color="#3d78bd"/></linearGradient></defs><rect x="6" y="8" width="52" height="48" rx="5" fill="#26364d" stroke="#e9f6ff" stroke-width="1.5"/><g fill="url(#ldsp)" stroke="#203b65"><rect x="10" y="12" width="20" height="18" rx="2"/><rect x="34" y="12" width="20" height="18" rx="2"/><rect x="10" y="34" width="20" height="18" rx="2"/><rect x="34" y="34" width="20" height="18" rx="2"/></g><text x="20" y="25" text-anchor="middle" font-size="9" fill="#fff">1</text><text x="44" y="25" text-anchor="middle" font-size="9" fill="#fff">2</text><text x="20" y="47" text-anchor="middle" font-size="9" fill="#fff">3</text><text x="44" y="47" text-anchor="middle" font-size="9" fill="#fff">4</text></svg>`,
      folder: `<svg ${common}><defs><linearGradient id="ldfl" x2="0" y2="1"><stop stop-color="#b8e3ff"/><stop offset=".45" stop-color="#68b2e8"/><stop offset="1" stop-color="#2d78b8"/></linearGradient></defs><path d="M5 17q0-5 5-5h15l6 6h23q5 0 5 5v28q0 5-5 5H10q-5 0-5-5z" fill="url(#ldfl)" stroke="#245b8d" stroke-width="1.4"/><path d="M6 26h52v-4q0-4-5-4H31l-6-6H10q-4 0-4 5z" fill="#d9f1ff" opacity=".58"/></svg>`,
      airport: `<svg ${common}><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M8 26a34 34 0 0 1 48 0" stroke-width="5"/><path d="M16 35a23 23 0 0 1 32 0" stroke-width="5"/><path d="M25 44a10 10 0 0 1 14 0" stroke-width="5"/></g><circle cx="32" cy="52" r="3.5" fill="currentColor"/></svg>`,
    };
    return map[kind] || ICONS.folder;
  };

  function settings() {
    const base = { safeModifiers: true, safeProfile: 'ctrlShift', originalWhenCaptured: true, showHints: true };
    try { return Object.assign(base, JSON.parse(localStorage.getItem(STORE.keyboard)) || {}); } catch (e) { return base; }
  }

  function saveSettings(next) {
    localStorage.setItem(STORE.keyboard, JSON.stringify(Object.assign(settings(), next)));
    document.dispatchEvent(new CustomEvent('leopard-settings'));
  }

  function isEditableTarget(target) {
    return !!target?.closest?.('input,textarea,select,[contenteditable="true"]');
  }

  function safeChord(e, key) {
    const profile = settings().safeProfile;
    const modifiers = profile === 'ctrlAlt'
      ? e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey
      : e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
    return modifiers && String(e.key).toLowerCase() === key.toLowerCase();
  }

  function safeLabel() {
    return settings().safeProfile === 'ctrlAlt' ? '⌃⌥' : '⌃⇧';
  }

  function safeShortcut(e, key) {
    return settings().safeModifiers && safeChord(e, key);
  }

  function originalChord(e, key) {
    return e.metaKey && !e.ctrlKey && String(e.key).toLowerCase() === key.toLowerCase();
  }

  function shortcutMatches(e, key) {
    const cfg = settings();
    return (cfg.safeModifiers && safeChord(e, key))
      || (cfg.originalWhenCaptured && state.capture && originalChord(e, key));
  }

  function closeTransient() {
    if (state.stackPopup) { state.stackPopup.remove(); state.stackPopup = null; }
  }

  function activeAppId() {
    const name = document.querySelector('.mb-appname')?.textContent || '';
    return Object.values(System.apps).find((a) => a.name === name)?.id || 'finder';
  }

  function activeWindow() {
    const appId = activeAppId();
    return System.topWindowOf(appId);
  }

  async function setKeyboardCapture(on) {
    if (on) {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (e) {
        System.alertBox('键盘捕获', `浏览器拒绝进入全屏。仍可使用较少与 macOS 冲突的 ${safeLabel()} 替代快捷键。`);
        return false;
      }
      try {
        if (navigator.keyboard?.lock) await navigator.keyboard.lock();
      } catch (e) {}
      state.capture = true;
      document.body.classList.add('keyboard-captured');
      updateCaptureStatus();
      toast('Leopard 键盘捕获已开启', '原版快捷键会在浏览器允许时生效；⌘Tab、⌘Space 等系统保留组合仍可能由 macOS 接管。');
      return true;
    }
    try { navigator.keyboard?.unlock?.(); } catch (e) {}
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (e) {}
    }
    state.capture = false;
    document.body.classList.remove('keyboard-captured');
    updateCaptureStatus();
    return true;
  }

  function updateCaptureStatus() {
    const item = document.querySelector('#mb-keyboard-capture');
    if (!item) return;
    item.classList.toggle('active', state.capture);
    item.title = state.capture ? '键盘捕获：开启' : '键盘捕获：关闭';
    item.querySelector('span').textContent = state.capture ? '⌘' : safeLabel();
  }

  function installKeyboardRouter() {
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.capture) {
        state.capture = false;
        document.body.classList.remove('keyboard-captured');
        try { navigator.keyboard?.unlock?.(); } catch (e) {}
        updateCaptureStatus();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const quickLookWindow = [...document.querySelectorAll('.quicklook-window')]
          .filter((win) => win.style.display !== 'none' && !win._closing)
          .sort((a, b) => +(a.style.zIndex || 0) - +(b.style.zIndex || 0))
          .pop();
        if (quickLookWindow) {
          System.closeWindow(quickLookWindow);
          e.preventDefault();
          return;
        }
        closeTransient();
        if (state.dashboard) { closeDashboard(); e.preventDefault(); }
        if (state.spacesOverlay) { closeSpaces(); e.preventDefault(); }
        if (state.timeMachine) { closeTimeMachine(); e.preventDefault(); }
        return;
      }
      if (safeChord(e, 'Enter')) {
        e.preventDefault();
        setKeyboardCapture(!state.capture);
        return;
      }
      if (safeShortcut(e, ' ')) {
        e.preventDefault();
        document.querySelector('#mb-spotlight')?.click();
        return;
      }
      if (safeShortcut(e, 'd') || (state.capture && e.key === 'F12')) {
        e.preventDefault(); openDashboard(); return;
      }
      if (safeShortcut(e, 's') || (state.capture && e.key === 'F8')) {
        e.preventDefault(); showSpaces(); return;
      }
      if (safeShortcut(e, 't')) {
        e.preventDefault(); openTimeMachine(); return;
      }
      if (safeShortcut(e, 'ArrowLeft')) {
        e.preventDefault(); switchSpace(state.currentSpace === 1 ? 4 : state.currentSpace - 1); return;
      }
      if (safeShortcut(e, 'ArrowRight')) {
        e.preventDefault(); switchSpace(state.currentSpace === 4 ? 1 : state.currentSpace + 1); return;
      }
      if (shortcutMatches(e, 'q')) {
        const appId = activeAppId();
        if (appId !== 'finder') { e.preventDefault(); System.quitApp(appId); }
        return;
      }
      if (shortcutMatches(e, 'w')) {
        const w = activeWindow();
        if (w) { e.preventDefault(); System.closeWindow(w); }
        return;
      }
      if (shortcutMatches(e, 'm')) {
        const w = activeWindow();
        if (w) { e.preventDefault(); System.minimizeWindow(w); }
        return;
      }
      if (shortcutMatches(e, 'n') && !isEditableTarget(e.target)) {
        e.preventDefault(); System.launch(activeAppId(), { forceNew: true }); return;
      }
      if ((e.key === ' ' || e.code === 'Space') && !isEditableTarget(e.target) && activeAppId() === 'finder') {
        const selected = document.querySelector('.window[data-app="finder"]:not([style*="display: none"]) [data-path].sel');
        if (selected?.dataset.path) { e.preventDefault(); quickLook(selected.dataset.path); }
      }
    }, true);
  }

  function syncMenuExtras() {
    const right = document.querySelector('.mb-right');
    if (!right) return;
    let bluetoothPref = {};
    let timeMachinePref = {};
    let applicationPrefs = {};
    try { bluetoothPref = JSON.parse(localStorage.getItem('macweb.pref.bluetooth') || '{}'); } catch (e) {}
    try { timeMachinePref = JSON.parse(localStorage.getItem('macweb.pref.timemachine') || '{}'); } catch (e) {}
    try { applicationPrefs = JSON.parse(localStorage.getItem('macweb.application.preferences.v1') || '{}'); } catch (e) {}
    const ensure = (id, enabled, html, title, onOpen, menuItems) => {
      let item = document.querySelector(`#${id}`);
      if (!enabled) { item?.remove(); return; }
      if (item) return;
      item = el('div', 'mb-item mb-status');
      item.id = id;
      item.title = title;
      item.innerHTML = html;
      item.addEventListener('click', onOpen);
      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        System.contextMenu(event, menuItems());
      });
      right.insertBefore(item, document.querySelector('#mb-volume'));
    };
    ensure('mb-bluetooth', bluetoothPref.menu !== false,
      '<svg width="13" height="16" viewBox="0 0 13 18"><path d="M6 1l5 5-4 3 4 4-5 4V1ZM1 5l10 8M1 13l10-7" fill="none" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'Bluetooth：打开', () => System.launch('sysprefs', { pane:'bluetooth' }),
      () => [{ label:'Bluetooth：打开' }, { label:'可被发现' }, { sep:true }, { label:'打开 Bluetooth 偏好设置…', action:()=>System.launch('sysprefs', { pane:'bluetooth' }) }]);
    ensure('mb-timemachine', timeMachinePref.menu !== false,
      '<svg width="17" height="17" viewBox="0 0 20 20"><path d="M6 5a7 7 0 1 1-2 5" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round"/><path d="M2.5 4.5 6 5 5.3 1.7M10 5.5V10l3.2 2" fill="none" stroke="#333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'Time Machine', openTimeMachine,
      () => [{ label:'立即备份', action:()=>{ saveSnapshot('菜单栏备份'); toast('Time Machine','备份已完成。'); } }, { label:'进入 Time Machine', action:openTimeMachine }, { sep:true }, { label:'打开 Time Machine 偏好设置…', action:()=>System.launch('sysprefs', { pane:'timemachine' }) }]);
    ensure('mb-ichat', applicationPrefs.ichat?.showMenuStatus === true,
      '<svg width="16" height="16" viewBox="0 0 20 20"><path d="M2 8.7C2 4.8 5.5 2 10 2s8 2.8 8 6.7-3.5 6.7-8 6.7c-.9 0-1.8-.1-2.6-.3L3.3 18l1.2-4.1C2.9 12.6 2 10.8 2 8.7Z" fill="#5fae52" stroke="#2e6f29"/><circle cx="7" cy="8" r="1.2" fill="#fff"/><circle cx="13" cy="8" r="1.2" fill="#fff"/><path d="M6.8 11q3.2 2.3 6.4 0" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>',
      'iChat：可用', () => System.launch('ichat'),
      () => [
        { label:'可用', checked:true, disabled:true },
        { label:'正在使用 Mac OS X Leopard', disabled:true },
        { sep:true },
        { label:'新建聊天…', action:()=>System.launch('ichat') },
        { label:'显示好友列表', action:()=>System.launch('ichat') },
        { sep:true },
        { label:'打开 iChat 偏好设置…', action:()=>System.showApplicationPreferences?.('ichat') },
      ]);
  }

  function airportSettings() {
    const base = { airportOn:true, askNetworks:true, location:'automatic' };
    try { return Object.assign(base, JSON.parse(localStorage.getItem('macweb.pref.network')) || {}); }
    catch (e) { return base; }
  }

  function paintAirportStatus() {
    const airport = document.querySelector('#mb-airport');
    if (!airport) return;
    const on = airportSettings().airportOn !== false;
    airport.classList.toggle('airport-off', !on);
    airport.title = on ? 'AirPort：已连接到 Leopard Web' : 'AirPort：关闭';
    airport.setAttribute('aria-label', airport.title);
  }

  function setAirportEnabled(on) {
    const cfg = airportSettings();
    cfg.airportOn = !!on;
    localStorage.setItem('macweb.pref.network', JSON.stringify(cfg));
    paintAirportStatus();
    document.dispatchEvent(new CustomEvent('leopard-network-changed', { detail:{ airportOn:!!on } }));
    toast('AirPort', on ? '已打开并连接到 Leopard Web。' : 'AirPort 已关闭。');
  }

  function openAirportMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const airport = event.currentTarget;
    const cfg = airportSettings();
    const on = cfg.airportOn !== false;
    const rect = airport.getBoundingClientRect();
    System.contextMenu({ clientX:Math.round(rect.left), clientY:22 }, [
      { label:on ? 'AirPort：打开' : 'AirPort：关闭', disabled:true },
      { label:on ? '关闭 AirPort' : '打开 AirPort', action:()=>setAirportEnabled(!on) },
      { sep:true },
      { label:`Leopard Web${on ? '  ✓' : ''}`, disabled:!on, action:()=>setAirportEnabled(true) },
      { label:'加入其他网络…', disabled:!on, action:()=>System.alertBox('加入其他网络','网络名称：Leopard Web\n安全性：WPA2 个人级\n此网页版只保留一个可用的虚拟网络。') },
      { label:'创建网络…', disabled:!on, action:()=>System.alertBox('创建网络','已准备好电脑到电脑网络向导。浏览器不会创建真实无线网络。') },
      { sep:true },
      { label:'打开网络偏好设置…', action:()=>System.launch('sysprefs', { pane:'network' }) },
    ]);
  }

  function installMenuExtras() {
    const right = document.querySelector('.mb-right');
    if (!right) return;
    if (document.querySelector('#mb-spaces')) { syncMenuExtras(); return; }
    const capture = el('div', 'mb-item mb-status mb-capture');
    capture.id = 'mb-keyboard-capture';
    capture.innerHTML = `<span>${safeLabel()}</span>`;
    capture.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const cfg = settings();
      System.contextMenu(e, [
        { label: state.capture ? '退出键盘捕获' : '进入全屏键盘捕获', action: () => setKeyboardCapture(!state.capture) },
        { sep: true },
        { label: `安全替代快捷键（${safeLabel()}）：${cfg.safeModifiers ? '开' : '关'}`, action: () => saveSettings({ safeModifiers: !settings().safeModifiers }) },
        { label: `使用 ⌃⇧（推荐）${cfg.safeProfile === 'ctrlShift' ? ' ✓' : ''}`, action: () => saveSettings({ safeProfile: 'ctrlShift' }) },
        { label: `使用 ⌃⌥（VoiceOver 用户勿选）${cfg.safeProfile === 'ctrlAlt' ? ' ✓' : ''}`, action: () => saveSettings({ safeProfile: 'ctrlAlt' }) },
        { label: `捕获时启用原版 ⌘ 键：${cfg.originalWhenCaptured ? '开' : '关'}`, action: () => saveSettings({ originalWhenCaptured: !settings().originalWhenCaptured }) },
        { sep: true },
        { label: '快捷键速查…', action: showShortcutHelp },
      ]);
    });
    const spaces = el('div', 'mb-item mb-status');
    spaces.id = 'mb-spaces';
    spaces.innerHTML = `<span>${state.currentSpace}</span>`;
    spaces.title = 'Spaces';
    spaces.addEventListener('click', showSpaces);
    const airport = el('div', 'mb-item mb-status mb-airport', glyph('airport', 16));
    airport.id = 'mb-airport';
    airport.addEventListener('mousedown', openAirportMenu);
    right.insertBefore(capture, right.firstChild);
    right.insertBefore(spaces, right.firstChild);
    right.insertBefore(airport, right.firstChild);
    document.addEventListener('leopard-settings', updateCaptureStatus);
    document.addEventListener('leopard-network-changed', paintAirportStatus);
    document.addEventListener('app-preferences-changed', (event) => {
      if (event.detail?.appId === 'ichat') syncMenuExtras();
    });
    updateCaptureStatus();
    paintAirportStatus();
    syncMenuExtras();
  }

  function showShortcutHelp() {
    const safe = safeLabel();
    const c = el('div', 'shortcut-help');
    c.innerHTML = `
      <h2>Leopard 快捷键</h2>
      <p>macOS 会优先截获部分系统组合，所以普通模式使用 <b>${safe}</b> 作为安全替代修饰键。默认的 ⌃⇧ 不占用 VoiceOver 的 ⌃⌥ 修饰键。</p>
      <table>
        <tr><th>功能</th><th>网页安全组合</th><th>捕获模式</th></tr>
        <tr><td>Spotlight</td><td>${safe}Space</td><td>⌘Space（若浏览器收到）</td></tr>
        <tr><td>Dashboard</td><td>${safe}D</td><td>F12</td></tr>
        <tr><td>Spaces 总览</td><td>${safe}S</td><td>F8</td></tr>
        <tr><td>切换空间</td><td>${safe}← / →</td><td>同左</td></tr>
        <tr><td>Time Machine</td><td>${safe}T</td><td>同左</td></tr>
        <tr><td>关闭/最小化/退出</td><td>${safe}W / M / Q</td><td>⌘W / M / Q</td></tr>
        <tr><td>切换捕获</td><td>${safe}Enter</td><td>${safe}Enter</td></tr>
      </table>`;
    System.createWindow({
      app:'sysprefs', title:'键盘快捷键', width:560, height:350, content:c,
      bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:300, maxHeight:520 },
    });
  }

  function wrapWindowFactory() {
    if (System.createWindow._leopardWrapped) return;
    const original = System.createWindow;
    const wrapped = function createLeopardWindow(opts) {
      const win = original(opts);
      const requested = opts?.space || state.currentSpace;
      win.dataset.space = String(Math.max(1, Math.min(4, requested)));
      if (+win.dataset.space !== state.currentSpace) {
        win._spaceHidden = true;
        win.style.display = 'none';
      }
      const app = System.apps[opts.app];
      if (app && !app._leopardWindowMenu) app._leopardWindowMenu = [];
      return win;
    };
    wrapped._leopardWrapped = true;
    System.createWindow = wrapped;
  }

  function switchSpace(space) {
    space = Math.max(1, Math.min(4, +space || 1));
    if (space === state.currentSpace && !state.spacesOverlay) return;
    const direction = space > state.currentSpace ? 1 : -1;
    const desktop = document.querySelector('#desktop');
    desktop.classList.remove('space-slide-left', 'space-slide-right');
    void desktop.offsetWidth;
    desktop.classList.add(direction > 0 ? 'space-slide-left' : 'space-slide-right');
    System.windows.forEach((w) => {
      const belongs = +(w.dataset.space || 1) === space;
      if (belongs && w._spaceHidden) {
        w.style.display = '';
        w._spaceHidden = false;
      } else if (!belongs && w.style.display !== 'none') {
        w.style.display = 'none';
        w._spaceHidden = true;
      }
    });
    state.currentSpace = space;
    localStorage.setItem(STORE.spaces, String(space));
    const item = document.querySelector('#mb-spaces span');
    if (item) item.textContent = String(space);
    closeSpaces();
    const badge = el('div', 'space-switch-badge', String(space));
    document.body.appendChild(badge);
    requestAnimationFrame(() => badge.classList.add('show'));
    setTimeout(() => badge.remove(), 700);
    System.syslog(`切换到 Space ${space}`, 'Dock');
  }

  function showSpaces() {
    if (state.spacesOverlay) { closeSpaces(); return; }
    const overlay = el('div', 'spaces-overlay');
    const head = el('div', 'spaces-head', '<b>Spaces</b><span>选择桌面空间；窗口标题下显示所属应用</span>');
    const grid = el('div', 'spaces-grid');
    for (let i = 1; i <= 4; i++) {
      const tile = el('div', 'space-tile' + (i === state.currentSpace ? ' active' : ''));
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      const preview = el('div', 'space-preview');
      preview.appendChild(el('i'));
      const windowList = el('div', 'space-window-list');
      const wins = System.windows.filter((w) => +(w.dataset.space || 1) === i);
      if (!wins.length) windowList.textContent = '空桌面';
      wins.slice(0, 6).forEach((win) => {
        const chip = el('button', 'space-window-chip');
        chip.draggable = true;
        chip.innerHTML = `<b>${esc(System.apps[win.dataset.app]?.name || win.dataset.app)}</b><small>${esc(win._title?.textContent || '')}</small>`;
        chip.addEventListener('click', (e) => { e.stopPropagation(); switchSpace(i); System.focusWindow(win); });
        chip.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          state.spacesDrag = win;
          chip.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', win.dataset.app || 'window');
        });
        chip.addEventListener('dragend', () => { chip.classList.remove('dragging'); state.spacesDrag = null; });
        windowList.appendChild(chip);
      });
      preview.appendChild(windowList);
      tile.append(el('span', 'space-number', String(i)), preview);
      tile.addEventListener('click', () => switchSpace(i));
      tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') switchSpace(i); });
      tile.addEventListener('dragover', (e) => { if (state.spacesDrag) { e.preventDefault(); tile.classList.add('drop-target'); } });
      tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        tile.classList.remove('drop-target');
        const win = state.spacesDrag;
        if (!win) return;
        win.dataset.space = String(i);
        win._spaceHidden = i !== state.currentSpace;
        win.style.display = i === state.currentSpace ? '' : 'none';
        state.spacesDrag = null;
        closeSpaces();
        setTimeout(showSpaces, 240);
      });
      grid.appendChild(tile);
    }
    const footer = el('div', 'spaces-foot', `${safeLabel()}← / → 切换 · 可拖动窗口到其他空间 · Esc 退出`);
    overlay.append(head, grid, footer);
    document.body.appendChild(overlay);
    state.spacesOverlay = overlay;
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeSpaces() {
    if (!state.spacesOverlay) return;
    const node = state.spacesOverlay;
    state.spacesOverlay = null;
    node.classList.remove('on');
    setTimeout(() => node.remove(), 220);
  }

  function dashboardWidget(type) {
    if (type === 'clock') {
      const w = el('section', 'dash-widget dash-clock');
      w.innerHTML = '<div class="clock-face"><i class="hour"></i><i class="minute"></i><i class="second"></i><b></b></div><label>本地时间</label>';
      const tick = () => {
        if (!w.isConnected) return;
        const d = new Date();
        w.querySelector('.hour').style.transform = `rotate(${d.getHours() * 30 + d.getMinutes() / 2}deg)`;
        w.querySelector('.minute').style.transform = `rotate(${d.getMinutes() * 6}deg)`;
        w.querySelector('.second').style.transform = `rotate(${d.getSeconds() * 6}deg)`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return w;
    }
    if (type === 'calendar') {
      const d = new Date();
      const w = el('section', 'dash-widget dash-calendar');
      w.innerHTML = `<header>${d.toLocaleDateString('zh-CN', { month: 'long' })}</header><b>${d.getDate()}</b><span>${d.toLocaleDateString('zh-CN', { weekday: 'long' })}</span>`;
      return w;
    }
    if (type === 'weather') {
      const w = el('section', 'dash-widget dash-weather');
      w.innerHTML = `<header>古晋</header><div><b>☀</b><strong>29°</strong></div><p>晴间多云<br>湿度 78%</p>`;
      return w;
    }
    if (type === 'calculator') {
      const w = el('section', 'dash-widget dash-calculator');
      w.innerHTML = `<input value="0" readonly><div>${['C','±','÷','×','7','8','9','−','4','5','6','+','1','2','3','=','0','.'].map(k=>`<button>${k}</button>`).join('')}</div>`;
      let expr = '';
      w.addEventListener('click', (e) => {
        const k = e.target.closest('button')?.textContent;
        if (!k) return;
        if (k === 'C') expr = '';
        else if (k === '=') {
          try { expr = String(Function(`"use strict";return (${expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')})`)()); } catch (err) { expr = '错误'; }
        } else if (k === '±') expr = expr.startsWith('-') ? expr.slice(1) : '-' + expr;
        else expr += k;
        w.querySelector('input').value = expr || '0';
      });
      return w;
    }
    const w = el('section', 'dash-widget dash-note');
    w.innerHTML = '<textarea aria-label="Dashboard 便笺" spellcheck="false"></textarea>';
    const text = localStorage.getItem(STORE.dashboard) || `欢迎使用 Dashboard。\n\n按 F12 或 ${safeLabel()}D 返回桌面。`;
    w.querySelector('textarea').value = text;
    w.querySelector('textarea').addEventListener('input', (e) => localStorage.setItem(STORE.dashboard, e.target.value));
    return w;
  }

  function openDashboard() {
    if (state.dashboard) { closeDashboard(); return; }
    closeTransient();
    const overlay = el('div', 'dashboard-layer');
    const canvas = el('canvas', 'dashboard-gpu');
    const widgets = el('div', 'dashboard-widgets');
    ['clock', 'calendar', 'weather', 'calculator', 'note'].forEach((type) => widgets.appendChild(dashboardWidget(type)));
    const bar = el('div', 'dashboard-bar', `<span>＋</span><b>Dashboard</b><small>F12 / ${safeLabel()}D 关闭</small>`);
    overlay.append(canvas, widgets, bar);
    document.body.appendChild(overlay);
    state.dashboard = overlay;
    state.starfieldStop = startStarfield(canvas, { teal: false, speed: 0.12 });
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeDashboard() {
    if (!state.dashboard) return;
    const node = state.dashboard;
    state.dashboard = null;
    state.starfieldStop?.();
    state.starfieldStop = null;
    node.classList.remove('on');
    setTimeout(() => node.remove(), 260);
  }

  function loadSnapshots() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE.snapshots));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return [];
  }

  function saveSnapshot(label) {
    const list = loadSnapshots();
    list.unshift({ id: Date.now(), at: new Date().toISOString(), label: label || '自动备份', tree: VFS.exportTree() });
    let saved = list.slice(0, 12);
    try {
      localStorage.setItem(STORE.snapshots, JSON.stringify(saved));
    } catch (error) {
      // Camera imports can contain multi-megabyte data URLs. Keep the file
      // metadata and recent history when the browser's localStorage is tight.
      saved = saved.slice(0, 5).map((shot) => {
        const compact = JSON.parse(JSON.stringify(shot));
        Object.values(compact.tree || {}).forEach((node) => {
          if (typeof node?.src === 'string' && node.src.startsWith('data:') && node.src.length > 32768) {
            node.src = '';
            node.backupNote = '大型图像预览因浏览器存储空间限制未纳入快照';
          }
        });
        return compact;
      });
      try { localStorage.setItem(STORE.snapshots, JSON.stringify(saved)); }
      catch (secondError) { return loadSnapshots(); }
    }
    return saved;
  }

  function ensureSnapshots() {
    let list = loadSnapshots();
    if (!list.length) {
      const now = Date.now();
      list = [0, 1, 2, 3].map((n) => ({
        id: now - n * 3600000,
        at: new Date(now - n * 3600000).toISOString(),
        label: n === 0 ? '现在' : `${n} 小时前`,
        tree: VFS.exportTree(),
      }));
      try { localStorage.setItem(STORE.snapshots, JSON.stringify(list)); } catch (e) {}
    }
    return list;
  }

  function openTimeMachine() {
    if (state.timeMachine) return;
    closeDashboard();
    const snapshots = ensureSnapshots();
    let selected = 0;
    const overlay = el('div', 'tm-layer');
    const canvas = el('canvas', 'tm-gpu');
    const cards = el('div', 'tm-cards');
    const timeline = el('div', 'tm-timeline');
    const controls = el('div', 'tm-controls');
    const cancel = el('button', 'aqua-btn', '取消');
    const backup = el('button', 'aqua-btn', '立即备份');
    const restore = el('button', 'aqua-btn default', '恢复');
    controls.append(cancel, backup, restore);
    const render = () => {
      cards.innerHTML = '';
      snapshots.slice(0, 7).forEach((shot, i) => {
        const card = el('button', 'tm-card' + (i === selected ? ' selected' : ''));
        card.style.setProperty('--tm-depth', String(i));
        const desktop = shot.tree?.['/用户/roll/桌面'];
        const items = desktop?.children || [];
        card.innerHTML = `<header><span>Finder</span><time>${new Date(shot.at).toLocaleString('zh-CN')}</time></header>
          <main><aside>设备<br><b>Macintosh HD</b><br><br>位置<br>桌面<br>文稿<br>图片</aside>
          <section>${items.slice(0, 10).map((name) => `<i>${ICONS.textfile}<small>${esc(name)}</small></i>`).join('') || '<em>空文件夹</em>'}</section></main>`;
        card.addEventListener('click', () => { selected = i; render(); });
        cards.appendChild(card);
      });
      timeline.innerHTML = snapshots.slice(0, 12).map((shot, i) =>
        `<button class="${i === selected ? 'active' : ''}" data-i="${i}"><i></i><span>${i === 0 ? '现在' : new Date(shot.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span></button>`
      ).join('');
    };
    timeline.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      selected = +b.dataset.i;
      render();
    });
    cancel.addEventListener('click', closeTimeMachine);
    backup.addEventListener('click', () => {
      snapshots.splice(0, snapshots.length, ...saveSnapshot('手动备份'));
      selected = 0; render(); toast('Time Machine', '已经完成新的本地快照。');
    });
    restore.addEventListener('click', () => {
      const shot = snapshots[selected];
      if (!shot) return;
      System.confirmBox({
        title: 'Time Machine',
        text: `要将文件恢复到 ${new Date(shot.at).toLocaleString('zh-CN')} 的状态吗？`,
        okLabel: '恢复',
        onOK: () => {
          if (VFS.importTree(shot.tree)) {
            toast('Time Machine', '文件已经恢复。');
            closeTimeMachine();
          } else System.alertBox('Time Machine', '无法恢复这个快照。');
        },
      });
    });
    overlay.append(canvas, cards, timeline, controls);
    document.body.appendChild(overlay);
    state.timeMachine = overlay;
    state.starfieldStop = startStarfield(canvas, { teal: true, speed: 0.34 });
    render();
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeTimeMachine() {
    if (!state.timeMachine) return;
    const node = state.timeMachine;
    state.timeMachine = null;
    state.starfieldStop?.();
    state.starfieldStop = null;
    node.classList.remove('on');
    setTimeout(() => node.remove(), 300);
  }

  function startStarfield(canvas, options) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) {
      canvas.classList.add('gpu-fallback');
      return () => {};
    }
    const vert = `#version 300 es
      in vec2 p; out vec2 uv;
      void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
    const frag = `#version 300 es
      precision highp float; in vec2 uv; out vec4 outColor;
      uniform vec2 r; uniform float t; uniform float teal;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      void main(){
        vec2 q=(gl_FragCoord.xy-.5*r)/r.y;
        vec3 col=mix(vec3(.018,.008,.055),vec3(.005,.055,.052),teal);
        for(int layer=0;layer<4;layer++){
          float z=fract(float(layer)*.233+t*(.025+float(layer)*.008));
          float scale=mix(8.,42.,z);
          vec2 cell=floor(q*scale);
          vec2 f=fract(q*scale)-.5;
          float rnd=h(cell+float(layer)*41.7);
          float star=smoothstep(.055,.0,length(f))*step(.91,rnd);
          float glow=smoothstep(.22,.0,length(f))*.18*step(.965,rnd);
          col+=(star+glow)*mix(vec3(.55,.65,1.),vec3(.55,1.,.88),teal)*(1.-z);
        }
        float neb=sin(q.x*4.+t*.08)*sin(q.y*3.-t*.05)*.025;
        col+=mix(vec3(.12,.03,.2),vec3(.01,.16,.13),teal)*(neb+.03);
        outColor=vec4(col,1.);
      }`;
    const compile = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (e) {
      canvas.classList.add('gpu-fallback');
      return () => {};
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const rloc = gl.getUniformLocation(program, 'r');
    const tloc = gl.getUniformLocation(program, 't');
    const tealLoc = gl.getUniformLocation(program, 'teal');
    let raf = 0, stopped = false;
    const start = performance.now();
    const draw = (now) => {
      if (stopped || !canvas.isConnected) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const maxPixels = 3200000;
      const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
      const scale = Math.min(dpr, Math.sqrt(maxPixels / (cssW * cssH)));
      const w = Math.max(1, Math.floor(cssW * scale)), h = Math.max(1, Math.floor(cssH * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(rloc, w, h);
      gl.uniform1f(tloc, (now - start) / 1000 * (options.speed || 1));
      gl.uniform1f(tealLoc, options.teal ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); try { gl.deleteProgram(program); gl.deleteBuffer(buffer); } catch (e) {} };
  }

  function formatBytes(bytes) {
    bytes = Math.max(0, Number(bytes) || 0);
    if (bytes < 1024) return `${bytes} 字节`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  }

  function displayPath(path) {
    if (path === '/用户/roll') return '~';
    if (path.startsWith('/用户/roll/')) return `~${path.slice('/用户/roll'.length)}`;
    return path;
  }

  function kindLabel(node, path) {
    if (!node) return '项目';
    if (node.type === 'dir') return '文件夹';
    if (node.type === 'app') return '应用程序';
    if (node.type === 'kext') return '内核扩展';
    if (node.kind === 'pdf' || node.mime === 'application/pdf') return 'PDF 文稿';
    if (node.kind === 'image' || node.mime?.startsWith('image/')) return '图像';
    if (node.mime?.startsWith('audio/')) return '音频';
    if (node.mime?.startsWith('video/')) return '影片';
    const ext = (VFS.baseName(path).split('.').pop() || '').toLowerCase();
    return ({
      html:'HTML 文稿', htm:'HTML 文稿', rtf:'RTF 文稿', txt:'纯文本文稿',
      md:'Markdown 文稿', json:'JSON 文稿', js:'JavaScript 文稿', css:'样式表',
    })[ext] || '文稿';
  }

  function nodeSource(node, path) {
    if (typeof node?.src === 'string' && node.src) return node.src;
    if (node?.content == null) return '';
    const ext = (VFS.baseName(path).split('.').pop() || '').toLowerCase();
    const mime = node.mime || ({
      pdf:'application/pdf', svg:'image/svg+xml', png:'image/png',
      jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
      html:'text/html', htm:'text/html',
    })[ext] || 'text/plain';
    return `data:${mime};charset=utf-8,${encodeURIComponent(String(node.content))}`;
  }

  function quickLook(path) {
    path = VFS.normalize(path);
    const node = VFS.get(path);
    if (!node) return;
    const openWindows = [...document.querySelectorAll('.quicklook-window')];
    const sameWindow = openWindows.find((win) => win.dataset.quicklookPath === path && !win._closing);
    openWindows.forEach((win) => System.closeWindow(win));
    if (sameWindow) return;

    const wrap = el('div', 'quicklook');
    const preview = el('div', 'quicklook-preview');
    const info = el('footer', 'quicklook-info');
    const name = VFS.baseName(path);
    const source = nodeSource(node, path);
    const kind = kindLabel(node, path);

    if ((node.kind === 'image' || node.mime?.startsWith('image/')) && source) {
      const image = el('img');
      image.src = source;
      image.alt = name;
      preview.appendChild(image);
    } else if ((node.kind === 'pdf' || node.mime === 'application/pdf') && source) {
      const frame = el('iframe', 'ql-pdf');
      frame.title = name;
      frame.src = source;
      preview.appendChild(frame);
    } else if (node.mime?.startsWith('audio/') && source) {
      const media = el('div', 'ql-media');
      media.innerHTML = `${System.fileIconFor?.(path) || ICONS.textfile}<h2>${esc(name)}</h2>`;
      const audio = el('audio');
      audio.controls = true;
      audio.src = source;
      media.appendChild(audio);
      preview.appendChild(media);
    } else if (node.mime?.startsWith('video/') && source) {
      const video = el('video');
      video.controls = true;
      video.src = source;
      preview.appendChild(video);
    } else if (node.type === 'file') {
      const text = String(node.content || '');
      if (node.richText || (/^\s*</.test(text) && /\.html?$/i.test(name))) {
        const frame = el('iframe', 'ql-richtext');
        frame.title = name;
        frame.setAttribute('sandbox', '');
        frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>html{background:#fff;color:#111;font:13px/1.5 "Lucida Grande",Arial,sans-serif}body{max-width:720px;margin:0 auto;padding:32px;overflow-wrap:anywhere}img{max-width:100%}</style><body>${node.richText || text}</body>`;
        preview.appendChild(frame);
      } else {
        const pre = el('pre');
        pre.textContent = text || '空文件';
        preview.appendChild(pre);
      }
    } else if (node.type === 'dir') {
      const children = VFS.list(path) || [];
      preview.innerHTML = `<div class="ql-folder">${glyph('folder', 110)}<h2>${esc(name)}</h2><p>${children.length} 个项目</p><ul>${children.slice(0,12).map((child)=>`<li>${esc(child)}</li>`).join('')}</ul></div>`;
    } else if (node.type === 'app') {
      const app = System.apps[node.appId];
      preview.innerHTML = `<div class="ql-app">${app?.icon || ICONS.folder}<h2>${esc(app?.name || name)}</h2><p>${esc(app?.about || 'Mac OS X 应用程序')}</p></div>`;
    } else {
      preview.innerHTML = `<div class="ql-folder">${System.fileIconFor?.(path) || ICONS.textfile}<h2>${esc(name)}</h2></div>`;
    }

    const meta = el('div', 'ql-meta');
    const modified = Number.isFinite(node.modifiedAt)
      ? new Date(node.modifiedAt).toLocaleString('zh-CN', { dateStyle:'medium', timeStyle:'short' })
      : '未知修改时间';
    const measuredSize = VFS.sizeOf(path);
    const quantity = node.type === 'dir'
      ? `${(VFS.list(path) || []).length} 个项目`
      : (!measuredSize && typeof node.src === 'string' && !node.src.startsWith('data:') && node.content == null)
        ? '大小未知' : formatBytes(measuredSize);
    meta.innerHTML = `<b>${esc(name.replace(/\.app$/, ''))}</b><small>${esc(kind)} · ${esc(quantity)} · ${esc(modified)}</small><span>${esc(displayPath(path))}</span>`;
    const actions = el('div', 'ql-actions');
    const reveal = el('button', 'aqua-btn', node.type === 'dir' ? '显示上层文件夹' : '在 Finder 中显示');
    const open = el('button', 'aqua-btn default',
      node.type === 'app' ? '打开应用程序'
        : node.type === 'dir' ? '打开文件夹'
          : (node.kind === 'image' || node.kind === 'pdf' || node.mime?.startsWith('image/') || node.mime === 'application/pdf')
            ? '用“预览”打开' : '打开');
    actions.append(reveal, open);
    info.append(meta, actions);
    wrap.append(preview, info);

    let win;
    const closeAnd = (action) => {
      if (win) System.closeWindow(win);
      action();
    };
    reveal.addEventListener('click', () => closeAnd(() => System.launch('finder', { path:VFS.parentOf(path) })));
    open.addEventListener('click', () => closeAnd(() => {
      if (node.type === 'app') System.launch(node.appId);
      else if (node.type === 'dir') System.launch('finder', { path });
      else System.openVfsPath?.(path);
    }));

    win = System.createWindow({ app: 'finder', title: `快速查看 — ${name}`, width: 680, height: 500, content: wrap, bodyBg: '#171717' });
    win.classList.add('quicklook-window');
    win.dataset.quicklookPath = path;
  }

  function renderSpotlight(query) {
    const results = document.querySelector('#spot-results');
    const input = document.querySelector('#spot-input');
    if (!results) return;
    const q = query.trim().toLocaleLowerCase();
    results.innerHTML = '';
    input?.removeAttribute('aria-activedescendant');
    if (!q) return;
    const tokens = q.split(/\s+/).filter(Boolean);
    const textContent = (node) => [
      node?.content || '',
      String(node?.richText || '').replace(/<[^>]*>/g, ' '),
      node?.comment || '',
      Array.isArray(node?.tags) ? node.tags.join(' ') : '',
    ].join(' ').toLocaleLowerCase();
    const matchScore = (name, metadata, content = '') => {
      name = name.toLocaleLowerCase();
      metadata = metadata.toLocaleLowerCase();
      if (!tokens.every((token) => name.includes(token) || metadata.includes(token) || content.includes(token))) return -1;
      return tokens.reduce((score, token) => score
        + (name === token ? 120 : name.startsWith(token) ? 90 : name.includes(token) ? 65 : metadata.includes(token) ? 35 : 16), 0);
    };
    const apps = Object.values(System.apps)
      .map((app) => ({ app, score:matchScore(app.name, `${app.id} ${app.keywords || ''} ${app.about || ''}`) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name, 'zh-CN'))
      .slice(0, 5)
      .map(({ app }) => ({
        group: '应用程序', name: app.name, detail: app.about || 'Mac OS X 应用程序',
        icon: app.icon, action: () => System.launch(app.id),
      }));
    const indexed = VFS.walk('/')
      .filter((path) => path !== '/' && !path.includes('/.废纸篓')
        && !path.split('/').some((part) => part.startsWith('.')))
      .map((path) => ({ path, node: VFS.get(path) }))
      .filter(({ node }) => node && node.type !== 'app')
      .map(({ path, node }) => {
        const name = VFS.baseName(path);
        const kind = kindLabel(node, path);
        return {
          path, node, name, kind,
          score:matchScore(name, `${path} ${kind}`, node.type === 'file' ? textContent(node) : ''),
        };
      })
      .filter((entry) => entry.score >= 0);
    const toResult = ({ path, node, name, kind }) => ({
      group: node.type === 'dir' ? '文件夹' : '文稿',
      name,
      detail: node.type === 'dir'
        ? `${(VFS.list(path) || []).length} 个项目 · ${displayPath(path)}`
        : `${kind} · ${displayPath(VFS.parentOf(path))}`,
      icon: System.fileIconFor?.(path) || (node.type === 'dir' ? ICONS.folder : ICONS.textfile),
      path,
      action: () => System.openVfsPath?.(path),
    });
    const documents = indexed.filter(({ node }) => node.type !== 'dir')
      .sort((a, b) => b.score - a.score || (b.node.modifiedAt || 0) - (a.node.modifiedAt || 0))
      .slice(0, 10).map(toResult);
    const folders = indexed.filter(({ node }) => node.type === 'dir')
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, 6).map(toResult);
    const entries = [...apps, ...documents, ...folders];
    results.setAttribute('role', 'listbox');
    results.setAttribute('aria-label', 'Spotlight 搜索结果');
    let lastGroup = '';
    entries.forEach((item, i) => {
      if (item.group !== lastGroup) {
        const heading = el('div', 'spot-group', item.group);
        heading.setAttribute('role', 'presentation');
        results.appendChild(heading);
        lastGroup = item.group;
      }
      const row = el('div', 'spot-item' + (i === 0 ? ' sel' : ''));
      row.id = `spot-result-${i}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === 0));
      row.tabIndex = -1;
      if (item.path) row.dataset.path = item.path;
      row.innerHTML = `${item.icon}<span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></span>`;
      row.addEventListener('mousemove', () => {
        results.querySelectorAll('.spot-item').forEach((candidate) => {
          const active = candidate === row;
          candidate.classList.toggle('sel', active);
          candidate.setAttribute('aria-selected', String(active));
        });
        input?.setAttribute('aria-activedescendant', row.id);
      });
      row.addEventListener('click', () => {
        document.querySelector('#spotlight')?.classList.add('hidden');
        input?.blur();
        item.action();
      });
      results.appendChild(row);
    });
    if (entries.length) input?.setAttribute('aria-activedescendant', 'spot-result-0');
    if (!entries.length) results.appendChild(el('div', 'spot-empty', '没有找到匹配项目'));
  }

  function enhanceSpotlight() {
    const input = document.querySelector('#spot-input');
    if (!input || input.dataset.leopard) return;
    input.dataset.leopard = '1';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'spot-results');
    input.setAttribute('aria-expanded', 'true');
    input.addEventListener('input', () => {
      delete input.dataset.spotNavigating;
      queueMicrotask(() => renderSpotlight(input.value));
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        input.dataset.spotNavigating = '1';
        return;
      }
      if ((event.key !== ' ' && event.code !== 'Space') || input.dataset.spotNavigating !== '1'
        || event.metaKey || event.ctrlKey || event.altKey) return;
      const selected = document.querySelector('#spot-results .spot-item.sel[data-path]');
      if (!selected?.dataset.path) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelector('#spotlight')?.classList.add('hidden');
      quickLook(selected.dataset.path);
    });
    document.addEventListener('vfs-changed', () => {
      if (input.value.trim() && !document.querySelector('#spotlight')?.classList.contains('hidden')) {
        queueMicrotask(() => renderSpotlight(input.value));
      }
    });
  }

  function stackItems(path) {
    return (VFS.list(path) || []).filter((n) => !n.startsWith('.')).map((name) => {
      const p = VFS.normalize(path + '/' + name);
      const node = VFS.get(p);
      const icon = System.fileIconFor ? System.fileIconFor(p) : (node?.type === 'dir' ? ICONS.folder : ICONS.textfile);
      return { name, path: p, node, icon };
    });
  }

  function openStack(anchor, path, mode) {
    closeTransient();
    const items = stackItems(path);
    const dockPosition = document.body.dataset.dockPosition || 'bottom';
    const effectiveMode = mode === 'fan' && dockPosition !== 'bottom' ? 'list' : mode;
    const popup = el('div', `dock-stack stack-${effectiveMode}`);
    const visibleItems = effectiveMode === 'fan'
      ? items.slice(-9).reverse()
      : items.slice(0, 28);
    if (effectiveMode === 'fan') {
      popup.style.setProperty('--fan-count', Math.max(1, visibleItems.length));
      popup.innerHTML = `<main></main><button class="stack-open-finder"><span>${glyph('folder')}</span><b>在 Finder 中打开</b></button>`;
    } else {
      popup.innerHTML = `<header>${esc(VFS.baseName(path))}</header><main></main><footer>在 Finder 中打开</footer>`;
    }
    const main = popup.querySelector('main');
    visibleItems.forEach((item, index) => {
      const row = el('button', 'stack-item');
      row.style.setProperty('--stack-i', index);
      if (effectiveMode === 'fan') {
        const curve = Math.round(8 + Math.sin(((index + 1) / (visibleItems.length + 1)) * Math.PI / 2) * 43);
        row.style.setProperty('--fan-offset', `${curve}px`);
      }
      row.innerHTML = `<span>${item.icon}</span><b>${esc(item.name.replace(/\.app$/, ''))}</b>`;
      row.addEventListener('click', () => {
        closeTransient();
        if (item.node?.type === 'dir') System.launch('finder', { path: item.path });
        else if (item.node?.type === 'app') System.launch(item.node.appId);
        else System.openVfsPath?.(item.path);
      });
      main.appendChild(row);
    });
    if (!visibleItems.length && effectiveMode === 'fan') {
      main.appendChild(el('div', 'stack-fan-empty', '没有项目'));
    }
    const finderButton = popup.querySelector(effectiveMode === 'fan' ? '.stack-open-finder' : 'footer');
    finderButton.addEventListener('click', () => { closeTransient(); System.launch('finder', { path }); });
    document.body.appendChild(popup);
    const ar = anchor.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();
    const idealLeft = effectiveMode === 'fan'
      ? ar.left + ar.width / 2 - pr.width + 26
      : ar.left + ar.width / 2 - pr.width / 2;
    popup.style.left = Math.max(8, Math.min(innerWidth - pr.width - 8, idealLeft)) + 'px';
    popup.style.bottom = Math.max(62, innerHeight - ar.top + 6) + 'px';
    state.stackPopup = popup;
    requestAnimationFrame(() => popup.classList.add('on'));
  }

  function makeStack(path, label, mode) {
    const stack = el('div', 'dock-icon dock-stack-icon');
    stack.dataset.stackPath = path;
    const preview = stackItems(path).slice(-3);
    stack.innerHTML = `${glyph('folder')}<div class="stack-preview">${preview.map((it)=>`<i>${it.icon}</i>`).join('')}</div><div class="dock-label">${esc(label)}</div>`;
    stack.addEventListener('click', (e) => { e.stopPropagation(); openStack(stack, path, mode); });
    stack.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const current = stack.dataset.mode || mode;
      System.contextMenu(e, [
        { label: '扇状', action: () => { stack.dataset.mode = 'fan'; openStack(stack, path, 'fan'); } },
        { label: '网格', action: () => { stack.dataset.mode = 'grid'; openStack(stack, path, 'grid'); } },
        { label: '列表', action: () => { stack.dataset.mode = 'list'; openStack(stack, path, 'list'); } },
        { sep: true },
        { label: '在 Finder 中打开', action: () => System.launch('finder', { path }) },
        { label: `当前显示：${current}`, disabled: true },
      ]);
    });
    return stack;
  }

  function enhanceDock() {
    const right = document.querySelector('#dock-right');
    if (!right || right.dataset.leopard) return;
    right.dataset.leopard = '1';
    const trash = right.querySelector('.dock-icon');
    const apps = makeStack('/应用程序', '应用程序', 'grid');
    const downloads = makeStack('/用户/roll/下载', '下载', 'fan');
    right.insertBefore(apps, trash || null);
    right.insertBefore(downloads, trash || null);
    document.addEventListener('vfs-changed', () => {
      [apps, downloads].forEach((stack) => {
        const preview = stackItems(stack.dataset.stackPath).slice(-3);
        const target = stack.querySelector('.stack-preview');
        if (target) target.innerHTML = preview.map((it)=>`<i>${it.icon}</i>`).join('');
      });
    });
    document.addEventListener('mousedown', (e) => {
      if (state.stackPopup && !e.target.closest('.dock-stack') && !e.target.closest('.dock-stack-icon')) closeTransient();
    });
    const dockApps = document.querySelector('#dock-apps');
    dockApps.querySelectorAll('.dock-icon[data-app]').forEach((icon) => { icon.draggable = true; });
    dockApps.addEventListener('contextmenu', (e) => {
      const icon = e.target.closest('.dock-icon[data-app]');
      if (!icon) return;
      e.preventDefault();
      const id = icon.dataset.app;
      const app = System.apps[id];
      System.contextMenu(e, [
        { label: app.windows.length ? '显示所有窗口' : '打开', action: () => System.launch(id) },
        { label: '在 Finder 中显示', action: () => System.launch('finder', { path: '/应用程序' }) },
        { sep: true },
        { label: '登录时打开', action: () => {
          let list = [];
          try { list = JSON.parse(localStorage.getItem('macweb.loginitems')) || []; } catch (err) {}
          if (list.includes(id)) list = list.filter((x) => x !== id); else list.push(id);
          localStorage.setItem('macweb.loginitems', JSON.stringify(list));
        } },
        { label: '从 Dock 中移除', disabled: id === 'finder', action: () => System.removeFromDock(id) },
        { sep: true },
        { label: '退出', disabled: id === 'finder' || !app.windows.length, action: () => System.quitApp(id) },
      ]);
    });
    let dragged = null;
    dockApps.addEventListener('dragstart', (e) => {
      const icon = e.target.closest('.dock-icon[data-app]');
      if (!icon) return;
      dragged = icon;
      icon.classList.add('dock-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', icon.dataset.app);
    });
    dockApps.addEventListener('dragover', (e) => {
      if (!dragged) return;
      e.preventDefault();
      const over = e.target.closest('.dock-icon[data-app]');
      if (!over || over === dragged) return;
      const r = over.getBoundingClientRect();
      dockApps.insertBefore(dragged, e.clientX < r.left + r.width / 2 ? over : over.nextSibling);
    });
    dockApps.addEventListener('drop', (e) => {
      if (!dragged) return;
      e.preventDefault();
      System.persistDockOrder();
    });
    dockApps.addEventListener('dragend', () => {
      if (dragged) dragged.classList.remove('dock-dragging');
      dragged = null;
      System.persistDockOrder();
    });
    new MutationObserver((records) => {
      records.flatMap((r) => Array.from(r.addedNodes)).forEach((node) => {
        if (node instanceof HTMLElement && node.matches('.dock-icon[data-app]')) node.draggable = true;
      });
    }).observe(dockApps, { childList: true });
  }

  function toast(title, message) {
    const n = el('div', 'leopard-toast');
    n.innerHTML = `<b>${esc(title)}</b><span>${esc(message)}</span>`;
    document.body.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 220); }, 3200);
  }

  function registerSystemApps() {
    System.registerApp({
      id: 'dashboard', name: 'Dashboard', icon: glyph('dashboard'), open: openDashboard,
      about: 'Leopard 的小组件层，包含时钟、日历、天气、计算器和便笺。',
      keywords: 'dashboard widgets 小组件 仪表盘',
    });
    System.registerApp({
      id: 'timemachine', name: 'Time Machine', icon: glyph('timemachine'), open: openTimeMachine,
      about: '使用浏览器本地快照备份和恢复虚拟文件系统。',
      keywords: 'time machine backup restore 备份 恢复',
    });
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    wrapWindowFactory();
    installKeyboardRouter();
    installMenuExtras();
    enhanceDock();
    enhanceSpotlight();
    document.addEventListener('system-activate-window', (event) => {
      const win = event.detail?.window;
      const space = +(win?.dataset?.space || state.currentSpace);
      if (space !== state.currentSpace) switchSpace(space);
    });
    try {
      const pref = JSON.parse(localStorage.getItem('macweb.pref.timemachine') || '{}');
      if (pref.enabled !== false) state.backupTimer = setInterval(() => saveSnapshot('每小时备份'), 3600000);
    } catch (e) {
      state.backupTimer = setInterval(() => saveSnapshot('每小时备份'), 3600000);
    }
    sampleDisplayRefreshRate();
    System.syslog('Leopard 扩展服务已启动：Spaces / Dashboard / Time Machine / Quick Look / Stacks', 'launchd');
  }

  function sampleDisplayRefreshRate() {
    const samples = [];
    let previous = 0;
    const sample = (now) => {
      if (previous) {
        const delta = now - previous;
        if (delta > 2 && delta < 50) samples.push(delta);
      }
      previous = now;
      if (samples.length < 90) return requestAnimationFrame(sample);
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)] || 16.667;
      const hz = Math.max(30, Math.min(240, Math.round(1000 / median)));
      document.documentElement.style.setProperty('--display-hz', String(hz));
      document.documentElement.dataset.refreshRate = String(hz);
      System.syslog(`显示刷新率采样约 ${hz} Hz；动画使用 requestAnimationFrame 同步`, 'WindowServer');
    };
    requestAnimationFrame(sample);
  }

  registerSystemApps();

  return {
    init, glyph, quickLook, openDashboard, closeDashboard, showSpaces, switchSpace,
    openTimeMachine, closeTimeMachine, setKeyboardCapture, settings, saveSettings,
    saveSnapshot, toast, startStarfield, showShortcutHelp, syncMenuExtras,
    get currentSpace() { return state.currentSpace; },
    get captured() { return state.capture; },
  };
})();
