// System subsystem: prefs
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, paths } from '../config.js';
import { t } from '../i18n/index.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {

  sys.apps = {};          // id -> app definition
  sys.windows = [];       // z-ordered list, last = frontmost
  sys.winSeq = 0;
  sys.activeApp = null;     // app id owning the menubar
  sys.bootTime = Date.now();
  sys.busyTickets = new Set();
  sys.busyTimer = 0;
  sys.busyHideTimer = 0;
  sys.busyShownAt = 0;
  sys.busyCursor = null;
  sys.pointerX = innerWidth / 2;
  sys.pointerY = innerHeight / 2;
  sys.pointerFrame = 0;

  sys.$ = (sel, root) => (root || document).querySelector(sel);
  sys.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  // Prefer this helper whenever content can originate from a user file,
  // browser API, remote response, or editable field. `sys.el(..., html)` is
  // retained for trusted, internal Aqua templates while legacy call sites are
  // migrated incrementally.
  sys.textEl = (tag, cls, value) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value != null) e.textContent = String(value);
    return e;
  };

  // Finder preferences are shared by the desktop, drag controller and Finder
  // windows. Keep the schema here so every surface responds to the same state.
  sys.FINDER_PREFS_KEY = 'macweb.finder.preferences.v1';
  sys.finderPreferenceDefaults = () => ({
    desktop: {
      hardDisks: true,
      externalDisks: false,
      opticalDisks: false,
      connectedServers: false,
    },
    newWindowPath: paths.home,
    openFoldersNewWindow: false,
    springLoaded: true,
    springDelay: 0.48,
    sidebar: {
      computer: false,
      hardDisks: true,
      externalDisks: false,
      opticalDisks: false,
      connectedServers: true,
      bonjour: false,
      home: true,
      desktop: true,
      applications: true,
      documents: true,
      downloads: true,
      movies: true,
      pictures: true,
      music: true,
      today: true,
      yesterday: true,
      pastWeek: true,
      allImages: true,
      allMovies: true,
      allDocuments: true,
    },
    labels: [
      { id:'red', name:t('u.4e68d49452') },
      { id:'orange', name:t('u.2902c2feff') },
      { id:'yellow', name:t('u.c33860af15') },
      { id:'green', name:t('u.81dd83dcbe') },
      { id:'blue', name:t('u.43f2550e7e') },
      { id:'purple', name:t('u.df52498f50') },
      { id:'gray', name:t('u.5996c71fae') },
    ],
    showAllExtensions: false,
    warnExtensionChange: true,
    warnEmptyTrash: true,
    searchScope: 'mac',
  });

  sys.getFinderPreferences = function getFinderPreferences() {
    const defaults = sys.finderPreferenceDefaults();
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(sys.FINDER_PREFS_KEY)) || {}; } catch (e) {}
    const prefs = Object.assign(defaults, stored);
    prefs.desktop = Object.assign(sys.finderPreferenceDefaults().desktop, stored.desktop || {});
    prefs.sidebar = Object.assign(sys.finderPreferenceDefaults().sidebar, stored.sidebar || {});
    const savedLabels = Array.isArray(stored.labels) ? stored.labels : [];
    prefs.labels = sys.finderPreferenceDefaults().labels.map((label) => {
      const saved = savedLabels.find((candidate) => candidate?.id === label.id);
      return { id:label.id, name:String(saved?.name || label.name).slice(0, 40) };
    });
    if (!VFS.isDir(prefs.newWindowPath)) prefs.newWindowPath = paths.home;
    if (!['mac','current','previous'].includes(prefs.searchScope)) prefs.searchScope = 'mac';
    prefs.springDelay = Math.max(.12, Math.min(1.4, Number(prefs.springDelay) || .48));
    return prefs;
  }

  sys.updateFinderPreferences = function updateFinderPreferences(patch) {
    const prefs = sys.getFinderPreferences();
    if (patch?.desktop) prefs.desktop = Object.assign({}, prefs.desktop, patch.desktop);
    if (patch?.sidebar) prefs.sidebar = Object.assign({}, prefs.sidebar, patch.sidebar);
    Object.keys(patch || {}).forEach((key) => {
      if (key === 'desktop' || key === 'sidebar') return;
      prefs[key] = patch[key];
    });
    localStorage.setItem(sys.FINDER_PREFS_KEY, JSON.stringify(prefs));
    document.dispatchEvent(new CustomEvent('finder-preferences-changed', { detail:prefs }));
    if (document.querySelector('#desktop-icons')) sys.renderDesktopIcons();
    return prefs;
  }

  // Application preferences belong to the active application, not System
  // Preferences.  Profiles below describe Leopard-era panes while keeping one
  // shared persistence and rendering path.
  sys.APP_PREFS_KEY = 'macweb.application.preferences.v1';
  sys.APP_PREFERENCE_PROFILES = {
    safari: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'⌂', sections:[
          { title:t('u.ebd26da421'), controls:[
            { key:'homepage', type:'text', label:t('u.25c408b30e'), default:'home:', placeholder:t('u.ffed23e3f4') },
            { key:'newWindow', type:'select', label:t('u.9b850cb9c6'), default:'home', options:[['home',t('u.25c408b30e')],['empty',t('u.52da344b32')],['same',t('u.b2e2340397')]] },
            { key:'newTab', type:'select', label:t('u.86669b1e7a'), default:'home', options:[['home',t('u.25c408b30e')],['empty',t('u.52da344b32')],['same',t('u.b2e2340397')]] },
            { key:'searchEngine', type:'select', label:t('u.b3c64386cd'), default:'duckduckgo', options:[['duckduckgo','DuckDuckGo'],['google','Google'],['bing','Bing']] },
          ]},
          { title:t('u.2b9d013177'), controls:[
            { key:'downloadPath', type:'select', label:t('u.18c3a442f1'), default:paths.downloads, options:[[paths.downloads,t('u.2b9d013177')],[paths.desktop,t('u.65fdeb927b')],[paths.documents,t('u.908a913cf1')]] },
            { key:'removeDownloads', type:'select', label:t('u.6127273866'), default:'manual', options:[['manual',t('u.2a4a4de806')],['success',t('u.1642b853cc')],['quit',t('u.13c6963491')]] },
          ]},
        ]},
        { id:'appearance', label:t('u.09b58aa342'), glyph:'Aa', sections:[
          { title:t('u.d743acf9fa'), controls:[
            { key:'standardFont', type:'select', label:t('u.e9a5aebbac'), default:'Times New Roman', options:[['Times New Roman','Times New Roman'],['Helvetica','Helvetica'],['Georgia','Georgia'],['Lucida Grande','Lucida Grande']] },
            { key:'standardFontSize', type:'select', label:t('u.fd20702c73'), default:'16', options:[['12',t('u.67b5434153')],['14',t('u.be0d33845a')],['16',t('u.b9dd8ad573')],['18',t('u.2043717cc5')],['20',t('u.c95d44ade9')]] },
            { key:'minimumFontSize', type:'select', label:t('u.6e12292fde'), default:'9', options:[['0',t('u.204f25ffa1')],['9',t('u.0d957749c1')],['11',t('u.3cccbb7549')],['13',t('u.56e36ad5e5')]] },
          ]},
          { controls:[
            { key:'smoothFonts', type:'checkbox', label:t('u.0545ceb0e0'), default:true },
            { key:'pageEncoding', type:'select', label:t('u.4b98944a61'), default:'utf-8', options:[['utf-8','Unicode (UTF-8)'],['gb18030',t('u.63f4afb4b0')],['shift_jis',t('u.b9cb217351')]] },
          ]},
        ]},
        { id:'tabs', label:t('u.c213e3898e'), glyph:'▤', sections:[
          { title:t('u.f9bc57f8ff'), controls:[
            { key:'openLinksInTabs', type:'checkbox', label:t('u.a3d48fa650'), default:true },
            { key:'commandClickTab', type:'checkbox', label:t('u.c18c2f2b38'), default:true },
            { key:'activateNewTabs', type:'checkbox', label:t('u.0e0bf5b571'), default:true },
            { key:'confirmCloseTabs', type:'checkbox', label:t('u.944ac9749b'), default:true },
          ]},
        ]},
        { id:'security', label:t('u.5373c1f19f'), glyph:'▣', sections:[
          { title:t('u.974e268ee6'), controls:[
            { key:'warnFraud', type:'checkbox', label:t('u.3fa16c7170'), default:true },
            { key:'blockPopups', type:'checkbox', label:t('u.5b22caeb54'), default:true },
            { key:'enableJavaScript', type:'checkbox', label:t('u.093881ffd6'), default:true },
            { key:'cookies', type:'select', label:t('u.1999f1fead'), default:'visited', options:[['always',t('u.11089071d8')],['visited',t('u.43f3d98912')],['never',t('u.292eea5849')]] },
          ]},
        ]},
        { id:'advanced', label:t('u.c009d0ab82'), glyph:'⚙', sections:[
          { controls:[
            { key:'showDevelopMenu', type:'checkbox', label:t('u.27706c6f4a'), default:false },
            { key:'showFullAddress', type:'checkbox', label:t('u.2b98010a92'), default:true },
            { key:'pressTabHighlights', type:'checkbox', label:t('u.d4818640c9'), default:false },
          ]},
        ]},
      ],
    },
    mail: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'✉', sections:[
          { title:t('u.04435b893f'), controls:[
            { key:'checkInterval', type:'select', label:t('u.0abd772270'), default:'manual', options:[['manual',t('u.2a4a4de806')],['1',t('u.af87469810')],['5',t('u.51afcd881e')],['15',t('u.3e0c2a0adf')],['30',t('u.b1fea251e5')],['60',t('u.73f8f537d7')]] },
            { key:'newMailSound', type:'checkbox', label:t('u.1f25d32e76'), default:true },
            { key:'sendSound', type:'checkbox', label:t('u.49a972bbee'), default:true },
            { key:'dockUnread', type:'checkbox', label:t('u.b2d0b396b7'), default:true },
          ]},
        ]},
        { id:'accounts', label:t('u.6186f17f38'), glyph:'@', sections:[
          { title:'Leopard Web', controls:[
            { key:'accountName', type:'text', label:t('u.412f54dc38'), default:'Leopard Web' },
            { key:'emailAddress', type:'text', label:t('u.b0c3fcee02'), default:'roll@example.com' },
            { key:'fullName', type:'text', label:t('u.0e7d37b25a'), default:'roll' },
            { key:'enabled', type:'checkbox', label:t('u.997a83670b'), default:true },
          ]},
        ]},
        { id:'viewing', label:t('u.71b6771bc7'), glyph:'◉', sections:[
          { controls:[
            { key:'threadMessages', type:'checkbox', label:t('u.500452642a'), default:true },
            { key:'showRemoteImages', type:'checkbox', label:t('u.8fd9ae4cc7'), default:false },
            { key:'markRead', type:'select', label:t('u.6cc55eb91b'), default:'selection', options:[['selection',t('u.58a74b480f')],['delay',t('u.618301d9c4')],['open',t('u.34ed0abcb1')]] },
          ]},
        ]},
        { id:'composing', label:t('u.637b71a954'), glyph:'✎', sections:[
          { title:t('u.637b71a954'), controls:[
            { key:'messageFormat', type:'select', label:t('u.7ed1f905b1'), default:'rich', options:[['rich',t('u.813b45de0c')],['plain',t('u.6478298bd4')]] },
            { key:'spellCheck', type:'select', label:t('u.80501b356e'), default:'typing', options:[['typing',t('u.5db337f6d6')],['send',t('u.fd50d8a039')],['never',t('u.292eea5849')]] },
            { key:'includeOriginal', type:'checkbox', label:t('u.5ae3596305'), default:true },
            { key:'signature', type:'text', label:t('u.8ba46c43fe'), default:'', placeholder:t('u.bc7d134303') },
            { key:'attachmentPath', type:'select', label:t('u.901cec30ec'), default:paths.documents, options:[[paths.documents,t('u.908a913cf1')],[paths.desktop,t('u.65fdeb927b')],[paths.downloads,t('u.2b9d013177')],[paths.pictures,t('u.be8da62ea1')]] },
          ]},
        ]},
        { id:'junk', label:t('u.a3093448fd'), glyph:'✹', sections:[
          { controls:[
            { key:'junkFilter', type:'checkbox', label:t('u.fc99ba2708'), default:true },
            { key:'trustContacts', type:'checkbox', label:t('u.7fd8d4213d'), default:true },
            { key:'markJunkBrown', type:'checkbox', label:t('u.8004a926b6'), default:true },
          ]},
        ]},
      ],
    },
    textedit: {
      tabs: [
        { id:'new', label:t('u.b2ff0c6297'), glyph:'▤', sections:[
          { title:t('u.9d2601c843'), controls:[
            { key:'documentFormat', type:'select', label:t('u.9d2601c843'), default:'rich', options:[['rich',t('u.813b45de0c')],['plain',t('u.6478298bd4')]] },
            { key:'fontFamily', type:'select', label:t('u.b50d4d8352'), default:'Helvetica', options:[['Helvetica','Helvetica'],['Lucida Grande','Lucida Grande'],['Times New Roman','Times New Roman'],['Monaco','Monaco']] },
            { key:'fontSize', type:'select', label:t('u.fd20702c73'), default:'13', options:[['11',t('u.3cccbb7549')],['12',t('u.67b5434153')],['13',t('u.56e36ad5e5')],['14',t('u.be0d33845a')],['16',t('u.b9dd8ad573')]] },
          ]},
          { controls:[
            { key:'wrapToPage', type:'checkbox', label:t('u.4092e5f605'), default:false },
            { key:'showRuler', type:'checkbox', label:t('u.a4e554f528'), default:true },
            { key:'smartQuotes', type:'checkbox', label:t('u.d7e9475dcc'), default:true },
          ]},
        ]},
        { id:'openSave', label:t('u.b8df2aeb3d'), glyph:'⇩', sections:[
          { controls:[
            { key:'addTxtExtension', type:'checkbox', label:t('u.450bd53e3d'), default:true },
            { key:'encoding', type:'select', label:t('u.61d686ab5e'), default:'utf-8', options:[['utf-8','Unicode (UTF-8)'],['utf-16','Unicode (UTF-16)'],['gb18030',t('u.63f4afb4b0')]] },
            { key:'preserveRichFormatting', type:'checkbox', label:t('u.3aed75b1ab'), default:false },
          ]},
        ]},
      ],
    },
    preview: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'◉', sections:[
          { controls:[
            { key:'openGroups', type:'select', label:t('u.cb33273472'), default:'window', options:[['window',t('u.3bfed63a0f')],['separate',t('u.8bba51ca05')]] },
            { key:'showSidebar', type:'checkbox', label:t('u.a83c4fa842'), default:true },
            { key:'backgroundColor', type:'color', label:t('u.9a70fbd2cc'), default:'#5b5b5b' },
          ]},
        ]},
        { id:'images', label:t('u.0a0ce84dde'), glyph:'▣', sections:[
          { controls:[
            { key:'imageScale', type:'select', label:t('u.8665d651be'), default:'fit', options:[['fit',t('u.2d1e40e077')],['actual',t('u.6ef49ec0be')],['last',t('u.60fab6aa37')]] },
            { key:'smoothImages', type:'checkbox', label:t('u.8380f23947'), default:true },
          ]},
        ]},
        { id:'pdf', label:'PDF', glyph:'PDF', sections:[
          { controls:[
            { key:'pdfScale', type:'select', label:t('u.3c7f47a6c7'), default:'fit', options:[['fit',t('u.86aa7abc90')],['width',t('u.329a5937fd')],['actual',t('u.6ef49ec0be')]] },
            { key:'antiAliasText', type:'checkbox', label:t('u.4471d0c95c'), default:true },
          ]},
        ]},
      ],
    },
    itunes: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'♫', sections:[
          { controls:[
            { key:'sourceTextSize', type:'select', label:t('u.17a1a3d763'), default:'small', options:[['small',t('u.922517cc73')],['large',t('u.0889c34972')]] },
            { key:'showGenre', type:'checkbox', label:t('u.114b030ca2'), default:true },
            { key:'checkUpdates', type:'checkbox', label:t('u.f54e16b861'), default:false },
          ]},
        ]},
        { id:'playback', label:t('u.21925350de'), glyph:'▶', sections:[
          { controls:[
            { key:'crossfade', type:'checkbox', label:t('u.b891fe936c'), default:false },
            { key:'soundEnhancer', type:'checkbox', label:t('u.e6b7654496'), default:true },
            { key:'rememberPosition', type:'checkbox', label:t('u.6771c07861'), default:true },
          ]},
        ]},
        { id:'advanced', label:t('u.c009d0ab82'), glyph:'⚙', sections:[
          { controls:[
            { key:'libraryPath', type:'select', label:t('u.aea5a5d1dc'), default:paths.music, options:[[paths.music,t('u.afb3c40c39')],[paths.documents,t('u.908a913cf1')]] },
            { key:'keepOrganized', type:'checkbox', label:t('u.6153a7fa33'), default:true },
            { key:'copyToLibrary', type:'checkbox', label:t('u.c233a4310c'), default:true },
          ]},
        ]},
      ],
    },
    quicktime: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'Q', sections:[
          { controls:[
            { key:'autoPlay', type:'checkbox', label:t('u.3f329cada9'), default:false },
            { key:'fullScreenControls', type:'checkbox', label:t('u.62ae054058'), default:true },
            { key:'rememberRecent', type:'checkbox', label:t('u.fba0ffdc74'), default:true },
          ]},
        ]},
        { id:'advanced', label:t('u.c009d0ab82'), glyph:'⚙', sections:[
          { controls:[
            { key:'highQuality', type:'checkbox', label:t('u.1504411a2b'), default:true },
            { key:'hardwareAcceleration', type:'checkbox', label:t('u.b206b61321'), default:true },
          ]},
        ]},
      ],
    },
    ichat: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'●', sections:[
          { controls:[
            { key:'saveTranscripts', type:'checkbox', label:t('u.f97d830c69'), default:true },
            { key:'showMenuStatus', type:'checkbox', label:t('u.7ab217043c'), default:false },
            { key:'offlineMessages', type:'checkbox', label:t('u.eeb9f2a13b'), default:false },
          ]},
        ]},
        { id:'messages', label:t('u.2da40f4073'), glyph:'✉', sections:[
          { controls:[
            { key:'messageFont', type:'select', label:t('u.b50d4d8352'), default:'Helvetica', options:[['Helvetica','Helvetica'],['Lucida Grande','Lucida Grande'],['Geneva','Geneva']] },
            { key:'messageColor', type:'color', label:t('u.3610609fc3'), default:'#d9ecff' },
            { key:'playSounds', type:'checkbox', label:t('u.b354015d9b'), default:true },
          ]},
        ]},
      ],
    },
    addressbook: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:t('u.4912771a42'), sections:[
          { controls:[
            { key:'nameOrder', type:'select', label:t('u.e1845ac556'), default:'lastFirst', options:[['firstLast',t('u.9eec458af5')],['lastFirst',t('u.f057a559ba')]] },
            { key:'sortBy', type:'select', label:t('u.3bf3689a69'), default:'last', options:[['first',t('u.364bd1bf05')],['last',t('u.8833895832')]] },
            { key:'showPhonetic', type:'checkbox', label:t('u.09dc03a530'), default:false },
          ]},
        ]},
        { id:'vcard', label:'vCard', glyph:'vC', sections:[
          { controls:[
            { key:'vcardVersion', type:'select', label:t('u.2b026299d5'), default:'3.0', options:[['2.1','2.1'],['3.0','3.0']] },
            { key:'exportNotes', type:'checkbox', label:t('u.137b61b9e5'), default:true },
          ]},
        ]},
      ],
    },
    ical: {
      tabs: [
        { id:'general', label:t('u.1a0fdce8f8'), glyph:'31', sections:[
          { controls:[
            { key:'weekStarts', type:'select', label:t('u.da58df29dc'), default:'monday', options:[['sunday',t('u.d9636d4a90')],['monday',t('u.dded7a4890')],['saturday',t('u.77bef63c55')]] },
            { key:'dayStarts', type:'select', label:t('u.a2e2cbd4d6'), default:'8', options:[['0',t('u.79c60900e3')],['6','06:00'],['8','08:00'],['9','09:00']] },
            { key:'defaultAlarm', type:'select', label:t('u.a3f789b26f'), default:'15', options:[['none',t('u.72077749f7')],['0',t('u.d461902288')],['5',t('u.f67bc2f123')],['15',t('u.52cafb5481')],['60',t('u.f3e5c5a498')],['1440',t('u.72251ad9e9')]] },
            { key:'showWeekNumbers', type:'checkbox', label:t('u.d81915fea9'), default:false },
          ]},
        ]},
        { id:'advanced', label:t('u.c009d0ab82'), glyph:'⚙', sections:[
          { controls:[
            { key:'timeZoneSupport', type:'checkbox', label:t('u.0594c64e51'), default:true },
            { key:'showBirthdays', type:'checkbox', label:t('u.5298c1b37f'), default:true },
          ]},
        ]},
      ],
    },
    photobooth: {
      tabs: [{ id:'general', label:t('u.1a0fdce8f8'), glyph:'●', sections:[
        { controls:[
          { key:'countdown', type:'checkbox', label:t('u.bc4caac3d2'), default:true },
          { key:'screenFlash', type:'checkbox', label:t('u.5cc716a4e0'), default:true },
          { key:'mirrorPreview', type:'checkbox', label:t('u.2eff6072ac'), default:true },
          { key:'saveToDesktop', type:'checkbox', label:t('u.19423c80de'), default:true },
        ]},
      ]}],
    },
    dictionary: {
      tabs: [{ id:'general', label:t('u.1a0fdce8f8'), glyph:'A', sections:[
        { controls:[
          { key:'defaultSource', type:'select', label:t('u.254d5eb39b'), default:'definition', options:[['definition',t('u.51bdb46bc2')],['thesaurus',t('u.6a10b8d58e')],['apple','Apple'],['wikipedia','Wikipedia']] },
          { key:'fontSize', type:'select', label:t('u.4be9ea01da'), default:'13', options:[['11',t('u.922517cc73')],['13',t('u.0869071c92')],['16',t('u.0889c34972')]] },
          { key:'autoPronounce', type:'checkbox', label:t('u.1adce9137c'), default:false },
        ]},
      ]}],
    },
    terminal: {
      tabs: [
        { id:'startup', label:t('u.ebd26da421'), glyph:'>_', sections:[
          { controls:[
            { key:'startupShell', type:'select', label:t('u.1d9189290a'), default:'bash', options:[['bash','bash'],['zsh','zsh'],['sh','sh']] },
            { key:'workingDirectory', type:'select', label:t('u.9b850cb9c6'), default:paths.home, options:[[paths.home,t('u.080582978f')],[paths.desktop,t('u.65fdeb927b')],['/','Macintosh HD']] },
          ]},
        ]},
        { id:'settings', label:t('u.7debf9cb03'), glyph:'Aa', sections:[
          { controls:[
            { key:'fontSize', type:'select', label:t('u.576ccdb1f1'), default:'13', options:[['11',t('u.3cccbb7549')],['13',t('u.56e36ad5e5')],['15',t('u.02ab37a446')],['18',t('u.2043717cc5')]] },
            { key:'cursorStyle', type:'select', label:t('u.f825080c0b'), default:'block', options:[['block',t('u.48ae409d7d')],['underline',t('u.9bc18ae51e')],['bar',t('u.8fc6e77231')]] },
            { key:'cursorBlink', type:'checkbox', label:t('u.6ad9f93769'), default:true },
            { key:'backgroundColor', type:'color', label:t('u.4a2d8a284c'), default:'#101418' },
          ]},
        ]},
      ],
    },
  };

  sys.appPreferenceProfile = function appPreferenceProfile(appId) {
    return sys.APP_PREFERENCE_PROFILES[appId] || null;
  }

  sys.appPreferenceDefaults = function appPreferenceDefaults(appId) {
    const values = {};
    sys.appPreferenceProfile(appId)?.tabs.forEach((tab) => tab.sections.forEach((section) =>
      section.controls.forEach((control) => { values[control.key] = control.default; })));
    return values;
  }

  sys.getAppPreferences = function getAppPreferences(appId) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(sys.APP_PREFS_KEY)) || {}; } catch (e) {}
    return Object.assign(sys.appPreferenceDefaults(appId), all[appId] || {});
  }

  sys.updateAppPreferences = function updateAppPreferences(appId, patch) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(sys.APP_PREFS_KEY)) || {}; } catch (e) {}
    const next = Object.assign(sys.getAppPreferences(appId), patch || {});
    all[appId] = next;
    localStorage.setItem(sys.APP_PREFS_KEY, JSON.stringify(all));
    document.dispatchEvent(new CustomEvent('app-preferences-changed', { detail:{ appId, preferences:next } }));
    return next;
  }

  sys.installCursorRuntime = function installCursorRuntime() {
    if (sys.busyCursor) return;
    sys.busyCursor = sys.el('div');
    sys.busyCursor.id = 'aqua-busy-cursor';
    sys.busyCursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sys.busyCursor);
    const paintPointer = () => {
      sys.pointerFrame = 0;
      sys.busyCursor.style.transform = `translate3d(${Math.round(sys.pointerX + 9)}px,${Math.round(sys.pointerY + 9)}px,0)`;
    };
    document.addEventListener('pointermove', (event) => {
      sys.pointerX = event.clientX;
      sys.pointerY = event.clientY;
      if (!sys.pointerFrame) sys.pointerFrame = requestAnimationFrame(paintPointer);
    }, { passive: true });
    paintPointer();
  }

  sys.beginBusy = function beginBusy(delay = 260) {
    sys.installCursorRuntime();
    const ticket = Symbol('busy');
    sys.busyTickets.add(ticket);
    if (sys.busyTickets.size === 1) {
      clearTimeout(sys.busyHideTimer);
      clearTimeout(sys.busyTimer);
      if (sys.busyCursor?.classList.contains('visible')) {
        document.documentElement.classList.add('aqua-busy-active');
      } else {
        sys.busyTimer = setTimeout(() => {
          if (sys.busyTickets.size) {
            sys.busyShownAt = performance.now();
            document.documentElement.classList.add('aqua-busy-active');
            sys.busyCursor?.classList.add('visible');
          }
        }, Math.max(0, delay));
      }
    }
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      sys.busyTickets.delete(ticket);
      if (!sys.busyTickets.size) {
        clearTimeout(sys.busyTimer);
        const hide = () => {
          if (sys.busyTickets.size) return;
          document.documentElement.classList.remove('aqua-busy-active');
          sys.busyCursor?.classList.remove('visible');
        };
        const visibleFor = sys.busyShownAt ? performance.now() - sys.busyShownAt : 950;
        clearTimeout(sys.busyHideTimer);
        sys.busyHideTimer = setTimeout(hide, Math.max(0, 950 - visibleFor));
      }
    };
  }

}
