import { HOME_USER, paths } from './config.js';
import { t } from './i18n/index.js';

// Finder keeps stable, language-neutral VFS identities even though this demo's
// original disk image used Chinese path segments. These labels are a display
// layer only: callers must continue to use the physical path for VFS actions.
const WELL_KNOWN_PATH_LABELS = new Map([
  ['/', () => t('finder.pathMacintoshHD')],
  ['/应用程序', () => t('finder.pathApplications')],
  ['/应用程序/实用工具', () => t('finder.pathUtilities')],
  ['/资料库', () => t('finder.pathLibrary')],
  ['/系统', () => t('finder.pathSystem')],
  ['/系统/扩展', () => t('finder.pathExtensions')],
  [paths.users, () => t('finder.pathUsers')],
  [paths.desktop, () => t('finder.pathDesktop')],
  [paths.documents, () => t('finder.pathDocuments')],
  [paths.downloads, () => t('finder.pathDownloads')],
  [paths.pictures, () => t('finder.pathPictures')],
  [paths.movies, () => t('finder.pathMovies')],
  [paths.music, () => t('finder.pathMusic')],
  [paths.public, () => t('finder.pathPublic')],
  [paths.sites, () => t('finder.pathSites')],
  [paths.library, () => t('finder.pathLibrary')],
  [paths.trash, () => t('finder.pathTrash')],
]);

function normalizePath(path) {
  const value = String(path || '/').replace(/\/{2,}/g, '/');
  if (value === '/') return value;
  return value.replace(/\/$/, '') || '/';
}

function baseName(path) {
  const normalized = normalizePath(path);
  return normalized === '/' ? '/' : normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function finderWellKnownName(path) {
  const label = WELL_KNOWN_PATH_LABELS.get(normalizePath(path));
  return label ? label() : null;
}

/** Resolve the visible Finder label without changing the backing VFS name. */
export function finderDisplayName(path, node, resolveAppName = () => '') {
  const normalized = normalizePath(path);
  if (node?.type === 'app') {
    const appName = node.appId ? resolveAppName(node.appId) : '';
    if (appName) return String(appName);
    return baseName(normalized).replace(/\.app$/i, '');
  }
  return finderWellKnownName(normalized) || baseName(normalized);
}

/** Human-readable POSIX-style breadcrumb. Every physical segment stays intact. */
export function finderDisplayPath(path) {
  const normalized = normalizePath(path);
  if (normalized === '/') return finderWellKnownName('/') || 'Macintosh HD';
  const segments = normalized.slice(1).split('/');
  let physical = '';
  const visible = segments.map((segment) => {
    physical += `/${segment}`;
    if (physical === paths.home) return HOME_USER;
    return finderWellKnownName(physical) || segment;
  });
  return `/${visible.join('/')}`;
}

/**
 * Project physical directory children into Finder rows without mutating VFS.
 * The Home view exposes a read-only Applications alias and keeps Public in the
 * SHARED sidebar. Managed app duplicates are collapsed by appId only; ordinary
 * files, even same-named ones, are never deduplicated.
 */
export function finderVisibleChildren(parentPath, candidates, getNode = () => null) {
  const parent = normalizePath(parentPath);
  let rows = Array.from(candidates || [], normalizePath);
  if (parent === paths.home) {
    rows = rows.filter((path) => path !== paths.public);
    if (!rows.includes('/应用程序')) rows.unshift('/应用程序');
  }

  const seenAppIds = new Set();
  return rows.filter((path) => {
    const node = getNode(path);
    if (node?.type !== 'app' || !node.appId) return true;
    if (seenAppIds.has(node.appId)) return false;
    seenAppIds.add(node.appId);
    return true;
  });
}

/** Choose one sidebar identity for a physical VFS path (never by label text). */
export function finderSidebarRoute(path) {
  const normalized = normalizePath(path);
  const atOrBelow = (root) => normalized === root || normalized.startsWith(`${root}/`);
  if (atOrBelow('/应用程序')) return 'place:applications';
  if (atOrBelow(paths.desktop)) return 'place:desktop';
  if (atOrBelow(paths.documents)) return 'place:documents';
  if (atOrBelow(paths.downloads)) return 'place:downloads';
  if (atOrBelow(paths.movies)) return 'place:movies';
  if (atOrBelow(paths.pictures)) return 'place:pictures';
  if (atOrBelow(paths.music)) return 'place:music';
  // Public is a normal physical folder. Only an explicit SHARED-row click may
  // select the local-share or Bonjour logical route.
  if (atOrBelow(paths.public)) return '';
  if (atOrBelow(paths.home)) return 'place:home';
  return 'device:hard-disk';
}
