// System subsystem: boot
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, paths } from '../config.js';
import { t } from '../i18n/index.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
// ---------- Boot ----------
  sys.startupChime = function startupChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') { ctx.close(); return; } // autoplay blocked — skip silently
      let snd = { volume: 0.6, muted: false };
      try { Object.assign(snd, JSON.parse(localStorage.getItem('macweb.sound')) || {}); } catch (e) {}
      if (snd.muted || snd.volume <= 0) { ctx.close(); return; }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.36 * snd.volume, ctx.currentTime + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.6);
      g.connect(ctx.destination);
      // the F# major startup chord
      [92.5, 185, 233.1, 277.2, 370, 466.2, 554.4].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = 0.16;
        o.connect(og); og.connect(g);
        o.start(); o.stop(ctx.currentTime + 2.6);
      });
      setTimeout(() => ctx.close(), 3000);
    } catch (e) {}
  }

  // Apps owned by the system layer (not side-effect imports under js/apps/).
  sys.installBuiltInApps = function installBuiltInApps() {
    if (!sys.apps.helpviewer) {
      sys.registerApp({
        id: 'helpviewer',
        name: t('u.948c608a0f'),
        icon: sys.helpViewerIcon,
        open: (arg) => sys.openHelpViewer(arg),
        multiWindow: false,
        about: t('help.ui.learnApp', { name: t('u.948c608a0f') }),
        keywords: 'help viewer mac',
      });
    }
  };

  sys.boot = function boot() {
    sys.installCursorRuntime();
    sys.installShortcutRuntime();
    sys.installViewportResizeRuntime?.();
    sys.installBuiltInApps();
    const wp = localStorage.getItem('macweb.wallpaper');
    if (wp) document.body.dataset.wallpaper = wp;
    const wpCss = localStorage.getItem('macweb.wallpaper.css');
    if (wpCss) sys.$('#desktop').style.background = `${wpCss} center / cover no-repeat`;
    document.body.classList.toggle('translucent-menubar', localStorage.getItem('macweb.menubar.translucent') === '1');
    sys.Kexts.applyEffects();
    if (localStorage.getItem('macweb.appearance') === 'graphite') document.body.dataset.appearance = 'graphite';
    sys.applyBrightness();
    sys.initEnergySaver();
    sys.buildDock();
    sys.applyDockCfg();
    sys.buildDesktop();
    sys.initSpotlight();
    sys.startClock();
    document.addEventListener('vfs-changed', () => { sys.renderDesktopIcons(); sys.updateTrashIcon(); });
    sys.$('.mb-apple')._menuItemsProvider = sys.appleMenuItems;
    sys.$('.mb-appname')._menuItemsProvider = sys.appMenuItems;
    sys.$('.mb-apple').addEventListener('mousedown', (e) => { e.stopPropagation(); sys.toggleMenu(e.currentTarget, sys.appleMenuItems()); });
    sys.$('.mb-appname').addEventListener('mousedown', (e) => { e.stopPropagation(); sys.toggleMenu(e.currentTarget, sys.appMenuItems()); });
    const keyboardActivate = (element, action) => element.addEventListener('keydown', (event) => {
      if (!['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      action(element);
      const first = sys.openMenu?.dd && sys.directMenuItems(sys.openMenu.dd)[0];
      if (first) sys.focusMenuItem(first);
    });
    keyboardActivate(sys.$('.mb-apple'), (element) => sys.toggleMenu(element, sys.appleMenuItems()));
    keyboardActivate(sys.$('.mb-appname'), (element) => sys.toggleMenu(element, sys.appMenuItems()));
    sys.$('#menubar').addEventListener('pointerover', (event) => {
      if (!sys.openMenu?.anchor) return;
      const anchor = event.target.closest('.mb-apple,.mb-appname,#mb-menus > .mb-item');
      if (!anchor || anchor === sys.openMenu.anchor) return;
      const items = anchor._menuItemsProvider?.();
      if (Array.isArray(items)) sys.toggleMenu(anchor, items);
    });
    sys.updateVolumeIcon();
    sys.$('#mb-volume').addEventListener('mousedown', (e) => { e.stopPropagation(); sys.toggleVolumePopup(e.currentTarget); });
    sys.$('#mb-clock').addEventListener('mousedown', (e) => { e.stopPropagation(); sys.toggleMenu(e.currentTarget, sys.clockMenuItems()); });
    keyboardActivate(sys.$('#mb-volume'), (element) => sys.toggleVolumePopup(element));
    keyboardActivate(sys.$('#mb-clock'), (element) => sys.toggleMenu(element, sys.clockMenuItems()));
    keyboardActivate(sys.$('#mb-spotlight'), (element) => element.click());
    sys.setActiveApp('finder');
    sys.updateDock();
    sys.startupChime();
    sys.syslog('BSD root: disk0s2, major 14, minor 2');
    sys.syslog(t('u.f7b5ef718d'));
    sys.syslog(`CPU: ${sys.HW.cores} ${t('u.2121a52d31')} · GPU: ${sys.HW.gpu}`);
    sys.syslog(`WindowServer started, Quartz Extreme: ${sys.HW.webgl ? `supported (${sys.HW.graphicsApi})` : 'unsupported'}`, 'WindowServer');
    // Keep the faithful first boot, but do not make every returning visit pay a
    // fixed multi-second delay. The boot screen can also be dismissed by an
    // explicit pointer/keyboard action and reduced-motion users enter quickly.
    const boot = sys.$('#boot');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let returning = false;
    try { returning = localStorage.getItem('macweb.boot.seen') === '1'; } catch (e) {}
    const bootDelay = reducedMotion ? 80 : returning ? 650 : 1800;
    const fadeDuration = reducedMotion ? 0 : returning ? 220 : 500;
    document.documentElement.style.setProperty('--boot-fade-duration', `${fadeDuration}ms`);
    sessionStorage.setItem('macweb.bootShownAt', String(Date.now()));
    let finished = false;
    let bootTimer = null;
    let handleBootKeydown = null;
    const finishBoot = (reason = 'timer') => {
      if (finished) return;
      finished = true;
      if (bootTimer != null) clearTimeout(bootTimer);
      if (handleBootKeydown) document.removeEventListener('keydown', handleBootKeydown);
      sessionStorage.setItem('macweb.bootDoneAt', String(Date.now()));
      try { localStorage.setItem('macweb.boot.seen', '1'); } catch (e) {}
      boot?.classList.add('fade');
      sys.syslog(`Login window ready (${reason})`, 'loginwindow');
      document.dispatchEvent(new CustomEvent('leopard-ready', {
        detail: { reason, returning, reducedMotion, bootDelay },
      }));
      setTimeout(() => boot?.remove(), fadeDuration + 40);
      // login items (系统偏好设置 → 账户)
      try {
        (JSON.parse(localStorage.getItem('macweb.loginitems')) || []).forEach((id, i) => {
          if (sys.apps[id]) setTimeout(() => sys.launch(id), 900 + i * 400);
        });
      } catch (e) {}
    };
    const skipBoot = () => finishBoot('user');
    boot?.addEventListener('pointerdown', skipBoot, { once:true });
    handleBootKeydown = (event) => {
      if (!finished && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) skipBoot();
    };
    document.addEventListener('keydown', handleBootKeydown);
    bootTimer = setTimeout(() => finishBoot('timer'), bootDelay);
  }


}
