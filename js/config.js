// Central configuration for Leopard Web (zero-build, shared by VFS / System / apps).

/** VFS path segment under /用户 (no spaces). */
export const HOME_USER = 'macosx';

/** Human-visible account / short-name display. */
export const HOME_DISPLAY_NAME = 'Mac OS X';

/** localStorage key for the virtual filesystem tree. */
export const VFS_KEY = 'macweb.vfs.v1';

/**
 * Pre-configuration home used by early Leopard Web builds.  Keep this value
 * isolated here so the loader can migrate existing disks without letting app
 * code depend on the retired account name.
 */
export const VFS_LEGACY_HOME = '/用户/roll';

/** The first pre-migration disk image is retained under this key. */
export const VFS_HOME_MIGRATION_BACKUP_KEY = `${VFS_KEY}.backup.pre-home-migration`;

/**
 * Bump when shipping breaking JS/CSS that browsers might cache.
 * index.html should reference main.js and CSS with this query (or match manually).
 */
export const CACHE_VERSION = 73;

/** Users parent directory in the virtual filesystem (localized Leopard layout). */
export const USERS_ROOT = '/用户';

function joinPath(parent, name) {
  if (!name) return parent;
  if (parent === '/') return `/${name}`;
  return `${parent}/${name}`;
}

/** Well-known VFS paths derived from HOME_USER. */
export const paths = {
  users: USERS_ROOT,
  home: joinPath(USERS_ROOT, HOME_USER),
  desktop: null,
  documents: null,
  downloads: null,
  movies: null,
  pictures: null,
  music: null,
  public: null,
  sites: null,
  trash: null,
  library: null,
};

paths.desktop = joinPath(paths.home, '桌面');
paths.documents = joinPath(paths.home, '文稿');
paths.downloads = joinPath(paths.home, '下载');
paths.movies = joinPath(paths.home, '影片');
paths.pictures = joinPath(paths.home, '图片');
paths.music = joinPath(paths.home, '音乐');
paths.public = joinPath(paths.home, '公共');
paths.sites = joinPath(paths.home, '站点');
paths.trash = joinPath(paths.home, '.废纸篓');
paths.library = joinPath(paths.home, '资料库');

export const systemPaths = {
  applications: '/应用程序',
  utilities: '/应用程序/实用工具',
  library: '/资料库',
  system: '/系统',
  extensions: '/系统/扩展',
};

export function underHome(path) {
  const home = paths.home;
  return path === home || (typeof path === 'string' && path.startsWith(home + '/'));
}

export function homePath(...parts) {
  return parts.reduce((acc, part) => joinPath(acc, part), paths.home);
}
