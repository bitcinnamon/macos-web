// Small eager runtime for preferences that must remain active even when the
// System Preferences UI module is deferred. It owns the idle screen saver,
// Hot Corners, and scheduled Energy Saver actions for the whole login session.
import { System } from '../system/index.js';
import { Leopard } from '../leopard.js';
import { t } from '../i18n/index.js';

const SCREEN_SAVER_KEY = 'macweb.screensaver.v1';
const SCREEN_SAVERS = ['Flurry', 'Computer Name', 'Arabesque', 'iTunes Artwork', 'RSS Visualizer', 'Shell', 'Spectrum', 'Word of the Day', 'Pictures Folder'];
let installed = false;
let screenSaverOverlay = null;
let screenSaverIdleTimer = 0;
let screenSaverClockTimer = 0;
let hotCornerTimer = 0;
let hotCornerActive = '';
let lastScreenSaverActivity = 0;
let energyScheduleTimer = 0;
let energySleepOverlay = null;

function readObject(key, defaults) {
  try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(key)) || {}); }
  catch (error) { return Object.assign({}, defaults); }
}

function screenSaverConfig() {
  const defaults = {
    selected:'Flurry', random:false, clock:false, delay:3,
    particles:4, speed:100, color:'aurora',
    corners:['none','dashboard','desktop','screensaver'],
  };
  const cfg = readObject(SCREEN_SAVER_KEY, defaults);
  if (!SCREEN_SAVERS.includes(cfg.selected)) cfg.selected = 'Flurry';
  cfg.delay = [0,1,3,5,10,15].includes(Number(cfg.delay)) ? Number(cfg.delay) : 3;
  cfg.particles = Math.max(2, Math.min(10, Number(cfg.particles) || 4));
  cfg.speed = Math.max(55, Math.min(190, Number(cfg.speed) || 100));
  cfg.color = ['aurora','blue','green','gold','mono'].includes(cfg.color) ? cfg.color : 'aurora';
  cfg.corners = Array.isArray(cfg.corners) ? cfg.corners.slice(0, 4) : defaults.corners.slice();
  while (cfg.corners.length < 4) cfg.corners.push('none');
  return cfg;
}

function saverEffect(name, cfg) {
  const particles = Array.from({ length:cfg.particles }, (_, index) =>
    `<i style="animation-delay:${(-index * .72).toFixed(2)}s;animation-duration:${(3.6 / (cfg.speed / 100)).toFixed(2)}s"></i>`).join('');
  const label = name === 'Computer Name' ? `<strong>${t('prefs.ui2.b67d82ffbedd')}</strong>`
    : name === 'iTunes Artwork' ? `<strong>${t('prefs.ui2.94ba182fd4ca')}</strong>`
    : name === 'RSS Visualizer' ? `<strong>${t('prefs.ui2.d3236e50e639')}</strong>`
    : name === 'Word of the Day' ? `<strong>serendipity</strong><em>${t('prefs.ui2.9851ea28ae82')}</em>`
    : name === 'Pictures Folder' ? `<strong>${t('prefs.msg.818d0ab93e')}</strong>`
    : '';
  return `<div class="saver-runtime fullscreen" data-saver="${name}" data-color="${cfg.color}">
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

function startScreenSaver() {
  if (screenSaverOverlay) return screenSaverOverlay;
  const cfg = screenSaverConfig();
  const chosen = cfg.random
    ? SCREEN_SAVERS[Math.floor(Math.random() * SCREEN_SAVERS.length)]
    : cfg.selected;
  const overlay = document.createElement('div');
  overlay.className = 'screensaver-test';
  overlay.innerHTML = `${saverEffect(chosen, cfg)}<b class="screensaver-name">${chosen}</b>
    ${cfg.clock ? '<time class="screensaver-clock"></time>' : ''}<small>${t('prefs.msg.f00e934f40')}</small>`;
  screenSaverOverlay = overlay;
  const updateClock = () => {
    const clock = overlay.querySelector('.screensaver-clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  updateClock();
  if (cfg.clock) screenSaverClockTimer = setInterval(updateClock, 1000);
  const close = () => closeScreenSaver();
  overlay._screenSaverCleanup = () => window.removeEventListener('keydown', close);
  window.addEventListener('keydown', close);
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
  screenSaverIdleTimer = setTimeout(startScreenSaver, cfg.delay * 60000);
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

const energyDefaults = () => ({
  wakeEnabled:false,
  wakeAction:t('prefs.msg.c52a762b96'),
  wakeDays:t('prefs.energy.weekdays'),
  wakeTime:'08:00',
  sleepEnabled:false,
  sleepAction:t('prefs.msg.6d5211bfde'),
  sleepDays:t('prefs.msg.78623eaefc'),
  sleepTime:'23:00',
});

function energyDayMatches(mode, date) {
  const day = date.getDay();
  if (mode === t('prefs.msg.78623eaefc')) return true;
  if (mode === t('prefs.energy.weekdays') || mode === 'Weekdays') return day >= 1 && day <= 5;
  if (mode === t('prefs.msg.c17375d125')) return day === 0 || day === 6;
  const names = [
    t('prefs.msg2.82b8c82fa0'), t('prefs.msg2.4de4c7515a'), t('prefs.msg2.23d3a68bd0'),
    t('prefs.msg2.32ea021667'), t('prefs.msg2.bb6be6a443'), t('prefs.msg2.ed8e921212'),
    t('prefs.msg2.b49f614c4b'),
  ];
  return mode === names[day];
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
  const overlay = document.createElement('div');
  overlay.className = 'energy-sleep-overlay';
  overlay.innerHTML = `<div class="energy-sleep-pulse"></div><p>${t('prefs.msg.10e10bcd7d')}</p><small>${t('prefs.msg.d59c042b59')}</small>`;
  const wake = () => {
    closeEnergySleepOverlay();
    Leopard.toast(t('prefs.msg.aafc5f406f'), t('prefs.msg.79b161d1e7'));
  };
  overlay._cleanup = () => window.removeEventListener('keydown', wake);
  window.addEventListener('keydown', wake);
  overlay.addEventListener('pointerdown', wake, { once:true });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('shown'));
  energySleepOverlay = overlay;
}

function runEnergyScheduleAction(entry) {
  if (entry.id === 'wake') {
    closeEnergySleepOverlay();
    Leopard.toast(t('prefs.msg.aafc5f406f'), t('prefs.energy.didAction2', { action:entry.action }));
  } else if (entry.action === t('prefs.msg.6d5211bfde')) {
    showEnergySleepOverlay();
  } else {
    const restart = entry.action === t('prefs.msg.9ebc9e1316');
    System.confirmBox({
      title:entry.action,
      text:t('prefs.energy.actionTime2', { action:entry.action }),
      okLabel:entry.action,
      countdown:60,
      countdownVerb:entry.action,
      onOK:() => System.shutdownSequence(restart),
    });
  }
}

function checkEnergySchedule() {
  const cfg = readObject('macweb.energy', {});
  const schedule = Object.assign(energyDefaults(), cfg.schedule || {});
  const entries = [
    { id:'wake', enabled:schedule.wakeEnabled, action:schedule.wakeAction, days:schedule.wakeDays, time:schedule.wakeTime },
    { id:'sleep', enabled:schedule.sleepEnabled, action:schedule.sleepAction, days:schedule.sleepDays, time:schedule.sleepTime },
  ];
  const now = new Date();
  entries.forEach((entry) => {
    if (!entry.enabled || !energyDayMatches(entry.days, now)) return;
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (entry.time !== current) return;
    const marker = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${current}-${entry.action}`;
    const key = `macweb.energy.last.${entry.id}`;
    if (sessionStorage.getItem(key) === marker) return;
    sessionStorage.setItem(key, marker);
    runEnergyScheduleAction(entry);
  });
}

export function refreshPreferencesRuntime() {
  scheduleScreenSaver();
  checkEnergySchedule();
}

export function installPreferencesRuntime() {
  if (installed) return;
  installed = true;
  if (!document.querySelector('.hot-corner-zone')) {
    ['tl','tr','bl','br'].forEach((corner) => {
      const zone = document.createElement('i');
      zone.className = `hot-corner-zone ${corner}`;
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
    window.addEventListener(type, resetIdle, { passive:true }));
  window.addEventListener('pointermove', (event) => {
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
  document.addEventListener('screensaver-preferences-changed', scheduleScreenSaver);
  document.addEventListener('energy-schedule-changed', checkEnergySchedule);
  scheduleScreenSaver();
  checkEnergySchedule();
  clearInterval(energyScheduleTimer);
  energyScheduleTimer = setInterval(checkEnergySchedule, 15000);
}
