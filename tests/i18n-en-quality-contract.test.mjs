import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../js/i18n/locales/en.js';
import zh from '../js/i18n/locales/zh-CN.js';
import { ensureLocale, setLocale, t } from '../js/i18n/index.js';

/**
 * Gate for residual bulk-MT English salad on USED keys.
 * Targets Useselect / Allitems / Migrateitems / Play PLACES / OnMovies /
 * AllError&Warning / File&Folder / andNetworkSettings / FileAdd".txt"Extension
 * without flagging Selection, Opening, Offline, Expand All, Memory.
 */

const ALLOWLIST = new Set([
  'iChat', 'iTunes', 'iCal', 'iDisk', 'iPhone', 'iSight',
  'JavaScript', 'WebAudio', 'WebGL', 'WebGL2', 'PostScript', 'ColorSync',
  'CalDAV', 'CardDAV', 'Bonjour', 'AirPort', 'FireWire', 'Bluetooth',
  'QuickTime', 'PhotoBooth', 'FrontRow', 'TimeMachine', 'BootCamp', 'BOOTCAMP',
  'OpenType', 'TrueType', 'Finder', 'Safari', 'Mail', 'Preview', 'Terminal',
  'Dashboard', 'Spotlight', 'Exposé', 'TextEdit', 'Photo Booth',
  'AppleTalk', 'VoiceOver', 'MP3', 'IPv4', 'IPv6', 'WebKit', 'localStorage',
  'Inspector', 'Offline', 'Online', 'Selection', 'Selected', 'Playlists',
  'Sender', 'Printers', 'Address', 'Mailboxes', 'Backup', 'Forward', 'Opening',
  'Gold', 'Importing', 'Imported', 'Important', 'Playlists', 'Background',
  'Restore', 'Favorite', 'Favorites', 'Favorited', 'Work', 'Workgroup',
  'Formats', 'Printing', 'Shortcut', 'Ignore', 'Connected', 'Disconnected',
  'Standard', 'Password', 'History', 'Network', 'Memory', 'Normal', 'Calories',
  'Kilocalories', 'Horsepower', 'Category', 'Support', 'Filter', 'Transform',
]);

function isAllowlisted(value) {
  const bare = value.replace(/(?:…|\.\.\.)$/, '').trim();
  if (ALLOWLIST.has(bare)) return true;
  if (/^\.Mac\b/.test(value)) return true;
  if (/^[A-Z]{2,6}$/.test(bare)) return true;
  // short unit fragments
  if (/^(?:kWh|mmHg|Mbps|GB|MB|KB|CPU|GPU|RAM|USB|PDF|RSS|XML|HTML|JSON|BOM\.?)$/i.test(bare)) return true;
  return false;
}

export function isBadEnglish(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (isAllowlisted(v)) return false;
  // Font Book sample glyph string
  if (/^m{5,}lliWWW/i.test(v)) return false;

  // --- Class A: glued items / Use* / All* single tokens ---
  if (/(?:Migrate|All|New|Use|Show|List|Remove)items/i.test(v)) return true;
  if (/^\+?\s*Newitems$/i.test(v.replace(/…$/, ''))) return true;
  if (/^Useselect$/i.test(v.replace(/…$/, ''))) return true;
  if (/^itemsList$/i.test(v.replace(/…$/, ''))) return true;
  if (/itemsGet Info/i.test(v)) return true;

  // --- Class B: ampersand without spaces (not HTML entities &lt; &gt; &amp;) ---
  const noEntities = v.replace(/&(?:lt|gt|amp|quot|nbsp|#\d+|#x[0-9a-fA-F]+);/gi, ' ');
  if (/[A-Za-z0-9]&[A-Za-z]/.test(noEntities)) return true;

  // --- Class C: glued and/or (no space): Checkand. PlayorPause Diskand ---
  if (/[a-z]and[A-Z.]/.test(v)) return true;
  if (/[a-z]or[A-Z]/.test(v)) return true;
  if (/[a-z](?:and|or|items)[A-Z]/.test(v)) return true;
  if (/itemsor|Checkand|Speechand/i.test(v)) return true;

  // --- Class D: OnMovies / OffWindow / OnFile / OffTab (On/Off + Capital run) ---
  if (/\b(?:On|Off)[A-Z][a-zA-Z]{2,}/.test(v)) return true;

  // --- Class E: bare PLACES residue / On + CAPS / Play PLACES ---
  // All-caps PLACES is bulk-MT for 位置, never a finished English control label.
  if (/\bPLACES\b/.test(v)) return true;
  // On HTML…, On PLACES, On Documents… (space after On + 2+ capitals / Title Case)
  if (/\bOn\s+[A-Z]{2,}/.test(v)) return true;
  if (/\bPlay\s+PLACES\b/i.test(v)) return true;

  // --- Class F: FileAdd".txt"Extension / Volume& "Sound" letter&quote glue ---
  if (/FileAdd|Add["'“”].{0,8}Extension/i.test(v)) return true;
  if (/[A-Za-z]&[\s]*["'“”]/.test(v)) return true;
  // leading amp junk: " & Dock"
  if (/^\s*&\s+\S/.test(v)) return true;

  // --- Class G: Browser.Leopard / mac OS &Window ---
  if (/[A-Za-z]\.[A-Z][a-z]/.test(v) && !/\.Mac\b/.test(v) && !/\.(txt|json|png|jpg|html|js|css|app|dmg|spx|ics)\b/i.test(v)) {
    return true;
  }
  if (/mac OS\s*&/i.test(v) || /&Window/i.test(v)) return true;

  // --- Class H: jammed multi-hump TitleCase token (no spaces), ≥2 humps ---
  // SearchCurrentFolder, RepairDiskPermissions, NewDiskImage, AutomaticPlay
  const bare = v.replace(/(?:…|\.\.\.)$/, '').replace(/^\+\s*/, '');
  if (!/\s/.test(bare) && /^[A-Z][a-z]+(?:[A-Z][a-zA-Z0-9]+)+$/.test(bare)) {
    if (!isAllowlisted(v) && !isAllowlisted(bare)) return true;
  }

  // lowerCamel single token: andNetworkSettings, itemsList (not "localStorage usage")
  if (!/\s/.test(bare) && /^[a-z]{2,}[A-Z][a-zA-Z]+$/.test(bare) && !isAllowlisted(v) && bare !== 'localStorage') {
    return true;
  }

  // --- Class I: lead punctuation junk about (not .Mac, not .txt) ---
  if (/^[,.;:]+[\s]*[A-Za-z]/.test(v) && !/^\.Mac\b/.test(v)) return true;
  if (/^[,.\s/;:…·\-—]{3,}$/.test(v)) return true;

  // --- Class J: known salad fragments from MT ---
  if (/\bAllStickies\b|\bAllProcess\b|\bAllFont\b|\bAllMessage\b|\bAllImport\b|\bAllCheck\b|\bAllError\b/i.test(v)) {
    return true;
  }
  if (/\bNewOK\b|\bOffWindow\b|\bOnPLACES\b|\bOnEqualizer\b|\bOnMovies\b|\bOnDocuments\b|\bOnFile\b/i.test(v)) {
    return true;
  }
  if (/\bUntitledTomorrow\b|\buntitledMovies\b|\buntitledGrab\b/i.test(v)) return true;
  if (/\bMoreMessage\b|\bSystemRestart\b|\bWindowOn\b|\bDocumentsShow\b|\bDownloadsSuccess\b/i.test(v)) return true;
  if (/\bUseitems\b|\bClearShow\b|\bCopyShow\b|\bGrabPreview\b|\bBrowserCamera\b/i.test(v)) return true;

  return false;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'locales' && name !== 'node_modules') walk(path, out);
    } else if (path.endsWith('.js')) out.push(path);
  }
  return out;
}

const used = new Set();
for (const file of walk(join(process.cwd(), 'js'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z][a-zA-Z0-9_.]*)'\s*\)/g)) {
    used.add(match[1]);
  }
}

await ensureLocale('en');
setLocale('en', { persist: false, force: true });

const failures = [];
for (const key of used) {
  const resolved = t(key);
  const value = typeof resolved === 'string' ? resolved : en[key];
  if (typeof value !== 'string') continue;
  if (isBadEnglish(value)) {
    failures.push({ key, value, zh: typeof zh[key] === 'string' ? zh[key] : '' });
  }
}

const dumpPath = process.env.EN_SALAD_DUMP;
if (dumpPath) {
  writeFileSync(dumpPath, JSON.stringify({ count: failures.length, failures }, null, 2));
}

const named = {
  'u.901cec30ec': /attachment|location|start|folder/i,
  'u.88c34452cc': /Places|Location|Favorites/i,
  'finder.sidebar.places': /Places|Favorites/i,
  'u.3aed75b1ab': /HTML|rich text|ignore|command/i,
  'u.2d5f64f22e': /AirPort|Bluetooth|network|location/i,
  'u.c322e803a5': /volume|Sound|microphone|input/i,
  'u.cc7f7e27b2': /Dictionary|Wikipedia|thesaurus|Apple/i,
  'u.31d3a927d3': /capture|screen|window|Grab|selection/i,
  'u.4d0ad84a73': /buddy|chat|iChat|screen share/i,
  'u.a7d08ea535': /Leopard Web|partition|startup|disk/i,
  'prefs.ui8.0a462765374a': /Dock/i,
  'u.b6ed06b056': /select|selection|region|area/i,
  'u.32c3ad426d': /all items|items/i,
  'u.6771c07861': /playback|position|remember/i,
  'u.3f329cada9': /auto|play|movie|open/i,
  'u.b9cedab337': /Quartz|composit|hardware/i,
  'u.be891c85f2': /Safari|WebKit|browser/i,
  'u.f56a82fe9b': /migrat/i,
  'u.da09644e87': /new item/i,
  'u.a0a5f683a8': /error|warn/i,
  'u.189cd35c8c': /warn|error/i,
  'u.450bd53e3d': /\.txt|extension|plain/i,
  'u.3ca3566410': /list|item/i,
  'u.16c07a2779': /file|folder/i,
  'u.047e7be736': /file|folder|other/i,
  'u.83f9d39315': /network|computer|setting/i,
  'u.658747003b': /Boot Camp|driver|startup/i,
  'u.e35d33f3f5': /Preview|PDF|zoom|rotate|annotat/i,
  'u.473fbd1aa2': /Trash|delete|empty|storage/i,
  'u.2d73072c89': /Repair|permission/i,
  'u.23af30a4fd': /disk image|Disk Image/i,
  'u.c233a4310c': /library|copy|file/i,
  'u.042fe553f3': /Search|folder|current/i,
  'u.4e68014350': /Get Info/i,
  'u.b8df2aeb3d': /Open and Save/i,
  'u.0e0bf5b571': /tab/i,
  'u.6127273866': /download/i,
  'ui.7e04d3e1c8d5': /CPU|process/i,
  'ui.8e9389a797e2': /chess|board|player/i,
  'ui.743ef0fced0e': /note|local storage/i,
  'ui.eb042d33f975': /log|JavaScript/i,
};
for (const [key, re] of Object.entries(named)) {
  const value = t(key);
  assert.equal(typeof value, 'string', `missing string for ${key}`);
  assert.ok(!isBadEnglish(value), `named key still salad: ${key}=${JSON.stringify(value)}`);
  assert.ok(re.test(value), `named key weak English: ${key}=${JSON.stringify(value)}`);
  if (value.length > 18 && !/\s/.test(value) && !isAllowlisted(value)) {
    assert.fail(`named multiword label lacks spaces: ${key}=${JSON.stringify(value)}`);
  }
}

assert.equal(
  failures.length,
  0,
  `Bad English in ${failures.length} used keys (sample): ${JSON.stringify(failures.slice(0, 30))}`,
);

console.log(`i18n-en-quality-contract: OK (checked ${used.size} used keys)`);
