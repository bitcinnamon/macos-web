import assert from 'node:assert/strict';
import { HOME_USER, HOME_DISPLAY_NAME, paths, systemPaths, underHome, homePath } from '../js/config.js';

assert.equal(HOME_USER, 'macosx');
assert.equal(HOME_DISPLAY_NAME, 'Mac OS X');
assert.equal(paths.home, `/用户/${HOME_USER}`);
assert.equal(paths.desktop, `${paths.home}/桌面`);
assert.equal(paths.trash, `${paths.home}/.废纸篓`);
assert.equal(systemPaths.applications, '/应用程序');
assert.equal(systemPaths.extensions, '/系统/扩展');
assert.equal(underHome(paths.documents), true);
assert.equal(underHome('/应用程序'), false);
assert.equal(homePath('文稿', '笔记.txt'), `${paths.documents}/笔记.txt`);

console.log('paths-config assertions passed');
