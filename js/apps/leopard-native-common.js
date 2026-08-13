// Shared helpers for the split Leopard-era native applications (Mail, Address
// Book, iChat, Dictionary, Photo Booth, QuickTime, DVD Player, Automator, Image
// Capture, Front Row, Keychain, Grab, and the Migration/Boot Camp assistants).
import { t } from '../i18n/index.js';

export const jsonStore = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || JSON.parse(JSON.stringify(fallback)); }
  catch (e) { return JSON.parse(JSON.stringify(fallback)); }
};

export const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
};

export const formatBytes = (bytes) => {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} ${t('app.ln9.5218c2a17058')}`;
  if (value < 1048576) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / 1048576).toFixed(value < 10485760 ? 1 : 0)} MB`;
};

export const icon = (id, c1, c2, mark) => `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
  <filter id="${id}s"><feGaussianBlur in="SourceAlpha" stdDeviation="1.1"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect x="6" y="6" width="52" height="52" rx="11" fill="url(#${id}g)" stroke="rgba(0,0,0,.42)" stroke-width="1.5" filter="url(#${id}s)"/>
  <path d="M10 12h44" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
  <g fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${mark}</g></svg>`;
