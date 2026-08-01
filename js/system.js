// ===== Core system: app registry, window manager, menubar, dock, spotlight =====
const System = (() => {
  const apps = {};          // id -> app definition
  const windows = [];       // z-ordered list, last = frontmost
  let winSeq = 0;
  let activeApp = null;     // app id owning the menubar
  const bootTime = Date.now();
  const busyTickets = new Set();
  let busyTimer = 0;
  let busyHideTimer = 0;
  let busyShownAt = 0;
  let busyCursor = null;
  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;
  let pointerFrame = 0;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  // Finder preferences are shared by the desktop, drag controller and Finder
  // windows. Keep the schema here so every surface responds to the same state.
  const FINDER_PREFS_KEY = 'macweb.finder.preferences.v1';
  const finderPreferenceDefaults = () => ({
    desktop: {
      hardDisks: true,
      externalDisks: false,
      opticalDisks: false,
      connectedServers: false,
    },
    newWindowPath: '/用户/roll',
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
      { id:'red', name:'红色' },
      { id:'orange', name:'橙色' },
      { id:'yellow', name:'黄色' },
      { id:'green', name:'绿色' },
      { id:'blue', name:'蓝色' },
      { id:'purple', name:'紫色' },
      { id:'gray', name:'灰色' },
    ],
    showAllExtensions: false,
    warnExtensionChange: true,
    warnEmptyTrash: true,
    searchScope: 'mac',
  });

  function getFinderPreferences() {
    const defaults = finderPreferenceDefaults();
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(FINDER_PREFS_KEY)) || {}; } catch (e) {}
    const prefs = Object.assign(defaults, stored);
    prefs.desktop = Object.assign(finderPreferenceDefaults().desktop, stored.desktop || {});
    prefs.sidebar = Object.assign(finderPreferenceDefaults().sidebar, stored.sidebar || {});
    const savedLabels = Array.isArray(stored.labels) ? stored.labels : [];
    prefs.labels = finderPreferenceDefaults().labels.map((label) => {
      const saved = savedLabels.find((candidate) => candidate?.id === label.id);
      return { id:label.id, name:String(saved?.name || label.name).slice(0, 40) };
    });
    if (!VFS.isDir(prefs.newWindowPath)) prefs.newWindowPath = '/用户/roll';
    if (!['mac','current','previous'].includes(prefs.searchScope)) prefs.searchScope = 'mac';
    prefs.springDelay = Math.max(.12, Math.min(1.4, Number(prefs.springDelay) || .48));
    return prefs;
  }

  function updateFinderPreferences(patch) {
    const prefs = getFinderPreferences();
    if (patch?.desktop) prefs.desktop = Object.assign({}, prefs.desktop, patch.desktop);
    if (patch?.sidebar) prefs.sidebar = Object.assign({}, prefs.sidebar, patch.sidebar);
    Object.keys(patch || {}).forEach((key) => {
      if (key === 'desktop' || key === 'sidebar') return;
      prefs[key] = patch[key];
    });
    localStorage.setItem(FINDER_PREFS_KEY, JSON.stringify(prefs));
    document.dispatchEvent(new CustomEvent('finder-preferences-changed', { detail:prefs }));
    if (document.querySelector('#desktop-icons')) renderDesktopIcons();
    return prefs;
  }

  // Application preferences belong to the active application, not System
  // Preferences.  Profiles below describe Leopard-era panes while keeping one
  // shared persistence and rendering path.
  const APP_PREFS_KEY = 'macweb.application.preferences.v1';
  const APP_PREFERENCE_PROFILES = {
    safari: {
      tabs: [
        { id:'general', label:'通用', glyph:'⌂', sections:[
          { title:'启动', controls:[
            { key:'homepage', type:'text', label:'主页', default:'home:', placeholder:'home: 或 https://…' },
            { key:'newWindow', type:'select', label:'新窗口打开', default:'home', options:[['home','主页'],['empty','空白页'],['same','当前页面']] },
            { key:'newTab', type:'select', label:'新标签页打开', default:'home', options:[['home','主页'],['empty','空白页'],['same','当前页面']] },
            { key:'searchEngine', type:'select', label:'默认搜索引擎', default:'duckduckgo', options:[['duckduckgo','DuckDuckGo'],['google','Google'],['bing','Bing']] },
          ]},
          { title:'下载', controls:[
            { key:'downloadPath', type:'select', label:'存储下载项目到', default:'/用户/roll/下载', options:[['/用户/roll/下载','下载'],['/用户/roll/桌面','桌面'],['/用户/roll/文稿','文稿']] },
            { key:'removeDownloads', type:'select', label:'移除下载列表项目', default:'manual', options:[['manual','手动'],['success','下载成功时'],['quit','Safari 退出时']] },
          ]},
        ]},
        { id:'appearance', label:'外观', glyph:'Aa', sections:[
          { title:'网页字体', controls:[
            { key:'standardFont', type:'select', label:'标准字体', default:'Times New Roman', options:[['Times New Roman','Times New Roman'],['Helvetica','Helvetica'],['Georgia','Georgia'],['Lucida Grande','Lucida Grande']] },
            { key:'standardFontSize', type:'select', label:'大小', default:'16', options:[['12','12 点'],['14','14 点'],['16','16 点'],['18','18 点'],['20','20 点']] },
            { key:'minimumFontSize', type:'select', label:'最小字号', default:'9', options:[['0','不限制'],['9','9 点'],['11','11 点'],['13','13 点']] },
          ]},
          { controls:[
            { key:'smoothFonts', type:'checkbox', label:'使用 LCD 字体平滑', default:true },
            { key:'pageEncoding', type:'select', label:'默认编码', default:'utf-8', options:[['utf-8','Unicode (UTF-8)'],['gb18030','简体中文 (GB 18030)'],['shift_jis','日文 (Shift JIS)']] },
          ]},
        ]},
        { id:'tabs', label:'标签页', glyph:'▤', sections:[
          { title:'标签页浏览', controls:[
            { key:'openLinksInTabs', type:'checkbox', label:'在新标签页而不是新窗口中打开链接', default:true },
            { key:'commandClickTab', type:'checkbox', label:'⌘-点按在新标签页中打开链接', default:true },
            { key:'activateNewTabs', type:'checkbox', label:'新标签页或窗口打开时使其成为活跃标签页', default:true },
            { key:'confirmCloseTabs', type:'checkbox', label:'关闭多个标签页之前进行确认', default:true },
          ]},
        ]},
        { id:'security', label:'安全性', glyph:'▣', sections:[
          { title:'网页内容', controls:[
            { key:'warnFraud', type:'checkbox', label:'访问欺诈网站时发出警告', default:true },
            { key:'blockPopups', type:'checkbox', label:'阻止弹出式窗口', default:true },
            { key:'enableJavaScript', type:'checkbox', label:'启用 JavaScript', default:true },
            { key:'cookies', type:'select', label:'接受 Cookie', default:'visited', options:[['always','总是'],['visited','仅来自我访问的网站'],['never','永不']] },
          ]},
        ]},
        { id:'advanced', label:'高级', glyph:'⚙', sections:[
          { controls:[
            { key:'showDevelopMenu', type:'checkbox', label:'在菜单栏中显示“开发”菜单', default:false },
            { key:'showFullAddress', type:'checkbox', label:'在智能地址栏中显示完整网站地址', default:true },
            { key:'pressTabHighlights', type:'checkbox', label:'按下 Tab 键高亮显示网页上的每一项', default:false },
          ]},
        ]},
      ],
    },
    mail: {
      tabs: [
        { id:'general', label:'通用', glyph:'✉', sections:[
          { title:'接收邮件', controls:[
            { key:'checkInterval', type:'select', label:'检查新邮件', default:'manual', options:[['manual','手动'],['1','每分钟'],['5','每 5 分钟'],['15','每 15 分钟'],['30','每 30 分钟'],['60','每小时']] },
            { key:'newMailSound', type:'checkbox', label:'播放新邮件声音', default:true },
            { key:'sendSound', type:'checkbox', label:'播放发送邮件声音', default:true },
            { key:'dockUnread', type:'checkbox', label:'在 Dock 中显示未读邮件数', default:true },
          ]},
        ]},
        { id:'accounts', label:'帐户', glyph:'@', sections:[
          { title:'Leopard Web', controls:[
            { key:'accountName', type:'text', label:'描述', default:'Leopard Web' },
            { key:'emailAddress', type:'text', label:'电子邮件地址', default:'roll@example.com' },
            { key:'fullName', type:'text', label:'全名', default:'roll' },
            { key:'enabled', type:'checkbox', label:'启用此帐户', default:true },
          ]},
        ]},
        { id:'viewing', label:'显示', glyph:'◉', sections:[
          { controls:[
            { key:'threadMessages', type:'checkbox', label:'按主题整理邮件', default:true },
            { key:'showRemoteImages', type:'checkbox', label:'在 HTML 邮件中显示远程图像', default:false },
            { key:'markRead', type:'select', label:'标记为已读', default:'selection', options:[['selection','选择邮件时'],['delay','5 秒后'],['open','在单独窗口中打开时']] },
          ]},
        ]},
        { id:'composing', label:'编写', glyph:'✎', sections:[
          { title:'编写', controls:[
            { key:'messageFormat', type:'select', label:'邮件格式', default:'rich', options:[['rich','多信息文本'],['plain','纯文本']] },
            { key:'spellCheck', type:'select', label:'检查拼写', default:'typing', options:[['typing','键入时'],['send','发送时'],['never','永不']] },
            { key:'includeOriginal', type:'checkbox', label:'回复时引用原邮件文本', default:true },
            { key:'signature', type:'text', label:'签名', default:'', placeholder:'可选签名' },
            { key:'attachmentPath', type:'select', label:'附件开始位置', default:'/用户/roll/文稿', options:[['/用户/roll/文稿','文稿'],['/用户/roll/桌面','桌面'],['/用户/roll/下载','下载'],['/用户/roll/图片','图片']] },
          ]},
        ]},
        { id:'junk', label:'垃圾邮件', glyph:'✹', sections:[
          { controls:[
            { key:'junkFilter', type:'checkbox', label:'启用垃圾邮件过滤', default:true },
            { key:'trustContacts', type:'checkbox', label:'发件人在通讯录中时不标记为垃圾邮件', default:true },
            { key:'markJunkBrown', type:'checkbox', label:'将垃圾邮件文本显示为棕色', default:true },
          ]},
        ]},
      ],
    },
    textedit: {
      tabs: [
        { id:'new', label:'新文稿', glyph:'▤', sections:[
          { title:'格式', controls:[
            { key:'documentFormat', type:'select', label:'格式', default:'rich', options:[['rich','多信息文本'],['plain','纯文本']] },
            { key:'fontFamily', type:'select', label:'字体', default:'Helvetica', options:[['Helvetica','Helvetica'],['Lucida Grande','Lucida Grande'],['Times New Roman','Times New Roman'],['Monaco','Monaco']] },
            { key:'fontSize', type:'select', label:'大小', default:'13', options:[['11','11 点'],['12','12 点'],['13','13 点'],['14','14 点'],['16','16 点']] },
          ]},
          { controls:[
            { key:'wrapToPage', type:'checkbox', label:'换行以适合页面', default:false },
            { key:'showRuler', type:'checkbox', label:'新文稿显示标尺', default:true },
            { key:'smartQuotes', type:'checkbox', label:'使用智能引号', default:true },
          ]},
        ]},
        { id:'openSave', label:'打开和存储', glyph:'⇩', sections:[
          { controls:[
            { key:'addTxtExtension', type:'checkbox', label:'为纯文本文件添加“.txt”扩展名', default:true },
            { key:'encoding', type:'select', label:'纯文本编码', default:'utf-8', options:[['utf-8','Unicode (UTF-8)'],['utf-16','Unicode (UTF-16)'],['gb18030','简体中文 (GB 18030)']] },
            { key:'preserveRichFormatting', type:'checkbox', label:'打开 HTML 文件时忽略多信息文本命令', default:false },
          ]},
        ]},
      ],
    },
    preview: {
      tabs: [
        { id:'general', label:'通用', glyph:'◉', sections:[
          { controls:[
            { key:'openGroups', type:'select', label:'打开文件组', default:'window', options:[['window','在一个窗口中'],['separate','每个文件单独窗口']] },
            { key:'showSidebar', type:'checkbox', label:'打开文稿时显示缩略图边栏', default:true },
            { key:'backgroundColor', type:'color', label:'窗口背景', default:'#5b5b5b' },
          ]},
        ]},
        { id:'images', label:'图像', glyph:'▣', sections:[
          { controls:[
            { key:'imageScale', type:'select', label:'初始大小', default:'fit', options:[['fit','适合窗口'],['actual','实际大小'],['last','上次使用的大小']] },
            { key:'smoothImages', type:'checkbox', label:'缩放图像时进行平滑处理', default:true },
          ]},
        ]},
        { id:'pdf', label:'PDF', glyph:'PDF', sections:[
          { controls:[
            { key:'pdfScale', type:'select', label:'初始缩放', default:'fit', options:[['fit','适合页面'],['width','适合宽度'],['actual','实际大小']] },
            { key:'antiAliasText', type:'checkbox', label:'平滑文本和线条', default:true },
          ]},
        ]},
      ],
    },
    itunes: {
      tabs: [
        { id:'general', label:'通用', glyph:'♫', sections:[
          { controls:[
            { key:'sourceTextSize', type:'select', label:'来源文字', default:'small', options:[['small','小'],['large','大']] },
            { key:'showGenre', type:'checkbox', label:'浏览时显示“类型”', default:true },
            { key:'checkUpdates', type:'checkbox', label:'自动检查更新', default:false },
          ]},
        ]},
        { id:'playback', label:'播放', glyph:'▶', sections:[
          { controls:[
            { key:'crossfade', type:'checkbox', label:'交叉渐入渐出歌曲', default:false },
            { key:'soundEnhancer', type:'checkbox', label:'声音增强器', default:true },
            { key:'rememberPosition', type:'checkbox', label:'记住播放位置', default:true },
          ]},
        ]},
        { id:'advanced', label:'高级', glyph:'⚙', sections:[
          { controls:[
            { key:'libraryPath', type:'select', label:'iTunes Music 文件夹', default:'/用户/roll/音乐', options:[['/用户/roll/音乐','音乐'],['/用户/roll/文稿','文稿']] },
            { key:'keepOrganized', type:'checkbox', label:'保持 iTunes Music 文件夹有序', default:true },
            { key:'copyToLibrary', type:'checkbox', label:'添加到资料库时复制文件', default:true },
          ]},
        ]},
      ],
    },
    quicktime: {
      tabs: [
        { id:'general', label:'通用', glyph:'Q', sections:[
          { controls:[
            { key:'autoPlay', type:'checkbox', label:'打开影片时自动播放', default:false },
            { key:'fullScreenControls', type:'checkbox', label:'全屏时显示控制器', default:true },
            { key:'rememberRecent', type:'checkbox', label:'记住最近使用的影片', default:true },
          ]},
        ]},
        { id:'advanced', label:'高级', glyph:'⚙', sections:[
          { controls:[
            { key:'highQuality', type:'checkbox', label:'可用时使用高质量视频设置', default:true },
            { key:'hardwareAcceleration', type:'checkbox', label:'启用 WebGL2 硬件加速', default:true },
          ]},
        ]},
      ],
    },
    ichat: {
      tabs: [
        { id:'general', label:'通用', glyph:'●', sections:[
          { controls:[
            { key:'saveTranscripts', type:'checkbox', label:'存储聊天记录', default:true },
            { key:'showMenuStatus', type:'checkbox', label:'在菜单栏中显示状态', default:false },
            { key:'offlineMessages', type:'checkbox', label:'显示离线好友', default:false },
          ]},
        ]},
        { id:'messages', label:'信息', glyph:'✉', sections:[
          { controls:[
            { key:'messageFont', type:'select', label:'字体', default:'Helvetica', options:[['Helvetica','Helvetica'],['Lucida Grande','Lucida Grande'],['Geneva','Geneva']] },
            { key:'messageColor', type:'color', label:'我的信息颜色', default:'#d9ecff' },
            { key:'playSounds', type:'checkbox', label:'播放信息声音', default:true },
          ]},
        ]},
      ],
    },
    addressbook: {
      tabs: [
        { id:'general', label:'通用', glyph:'人', sections:[
          { controls:[
            { key:'nameOrder', type:'select', label:'显示名字', default:'lastFirst', options:[['firstLast','名字在前'],['lastFirst','姓氏在前']] },
            { key:'sortBy', type:'select', label:'排序方式', default:'last', options:[['first','名字'],['last','姓氏']] },
            { key:'showPhonetic', type:'checkbox', label:'显示拼音字段', default:false },
          ]},
        ]},
        { id:'vcard', label:'vCard', glyph:'vC', sections:[
          { controls:[
            { key:'vcardVersion', type:'select', label:'vCard 格式', default:'3.0', options:[['2.1','2.1'],['3.0','3.0']] },
            { key:'exportNotes', type:'checkbox', label:'导出名片中的备注', default:true },
          ]},
        ]},
      ],
    },
    ical: {
      tabs: [
        { id:'general', label:'通用', glyph:'31', sections:[
          { controls:[
            { key:'weekStarts', type:'select', label:'每周开始于', default:'monday', options:[['sunday','星期日'],['monday','星期一'],['saturday','星期六']] },
            { key:'dayStarts', type:'select', label:'一天开始于', default:'8', options:[['0','午夜'],['6','06:00'],['8','08:00'],['9','09:00']] },
            { key:'defaultAlarm', type:'select', label:'新事件默认提醒', default:'15', options:[['none','无'],['0','事件开始时'],['5','提前 5 分钟'],['15','提前 15 分钟'],['60','提前 1 小时'],['1440','提前 1 天']] },
            { key:'showWeekNumbers', type:'checkbox', label:'显示周数', default:false },
          ]},
        ]},
        { id:'advanced', label:'高级', glyph:'⚙', sections:[
          { controls:[
            { key:'timeZoneSupport', type:'checkbox', label:'启用时区支持', default:true },
            { key:'showBirthdays', type:'checkbox', label:'显示生日历', default:true },
          ]},
        ]},
      ],
    },
    photobooth: {
      tabs: [{ id:'general', label:'通用', glyph:'●', sections:[
        { controls:[
          { key:'countdown', type:'checkbox', label:'拍照前显示 3 秒倒数', default:true },
          { key:'screenFlash', type:'checkbox', label:'拍照时闪烁屏幕', default:true },
          { key:'mirrorPreview', type:'checkbox', label:'镜像摄像头预览', default:true },
          { key:'saveToDesktop', type:'checkbox', label:'同时将照片放到桌面', default:true },
        ]},
      ]}],
    },
    dictionary: {
      tabs: [{ id:'general', label:'通用', glyph:'A', sections:[
        { controls:[
          { key:'defaultSource', type:'select', label:'默认来源', default:'definition', options:[['definition','词典'],['thesaurus','同义词'],['apple','Apple'],['wikipedia','Wikipedia']] },
          { key:'fontSize', type:'select', label:'文字大小', default:'13', options:[['11','小'],['13','中'],['16','大']] },
          { key:'autoPronounce', type:'checkbox', label:'查词后自动播放发音', default:false },
        ]},
      ]}],
    },
    terminal: {
      tabs: [
        { id:'startup', label:'启动', glyph:'>_', sections:[
          { controls:[
            { key:'startupShell', type:'select', label:'启动 Shell', default:'bash', options:[['bash','bash'],['zsh','zsh'],['sh','sh']] },
            { key:'workingDirectory', type:'select', label:'新窗口打开', default:'/用户/roll', options:[['/用户/roll','个人文件夹'],['/用户/roll/桌面','桌面'],['/','Macintosh HD']] },
          ]},
        ]},
        { id:'settings', label:'设置', glyph:'Aa', sections:[
          { controls:[
            { key:'fontSize', type:'select', label:'字号', default:'13', options:[['11','11 点'],['13','13 点'],['15','15 点'],['18','18 点']] },
            { key:'cursorStyle', type:'select', label:'光标', default:'block', options:[['block','方块'],['underline','下划线'],['bar','竖线']] },
            { key:'cursorBlink', type:'checkbox', label:'闪烁光标', default:true },
            { key:'backgroundColor', type:'color', label:'背景颜色', default:'#101418' },
          ]},
        ]},
      ],
    },
  };

  function appPreferenceProfile(appId) {
    return APP_PREFERENCE_PROFILES[appId] || null;
  }

  function appPreferenceDefaults(appId) {
    const values = {};
    appPreferenceProfile(appId)?.tabs.forEach((tab) => tab.sections.forEach((section) =>
      section.controls.forEach((control) => { values[control.key] = control.default; })));
    return values;
  }

  function getAppPreferences(appId) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(APP_PREFS_KEY)) || {}; } catch (e) {}
    return Object.assign(appPreferenceDefaults(appId), all[appId] || {});
  }

  function updateAppPreferences(appId, patch) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(APP_PREFS_KEY)) || {}; } catch (e) {}
    const next = Object.assign(getAppPreferences(appId), patch || {});
    all[appId] = next;
    localStorage.setItem(APP_PREFS_KEY, JSON.stringify(all));
    document.dispatchEvent(new CustomEvent('app-preferences-changed', { detail:{ appId, preferences:next } }));
    return next;
  }

  function installCursorRuntime() {
    if (busyCursor) return;
    busyCursor = el('div');
    busyCursor.id = 'aqua-busy-cursor';
    busyCursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(busyCursor);
    const paintPointer = () => {
      pointerFrame = 0;
      busyCursor.style.transform = `translate3d(${Math.round(pointerX + 9)}px,${Math.round(pointerY + 9)}px,0)`;
    };
    document.addEventListener('pointermove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    }, { passive: true });
    paintPointer();
  }

  function beginBusy(delay = 260) {
    installCursorRuntime();
    const ticket = Symbol('busy');
    busyTickets.add(ticket);
    if (busyTickets.size === 1) {
      clearTimeout(busyHideTimer);
      clearTimeout(busyTimer);
      if (busyCursor?.classList.contains('visible')) {
        document.documentElement.classList.add('aqua-busy-active');
      } else {
        busyTimer = setTimeout(() => {
          if (busyTickets.size) {
            busyShownAt = performance.now();
            document.documentElement.classList.add('aqua-busy-active');
            busyCursor?.classList.add('visible');
          }
        }, Math.max(0, delay));
      }
    }
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      busyTickets.delete(ticket);
      if (!busyTickets.size) {
        clearTimeout(busyTimer);
        const hide = () => {
          if (busyTickets.size) return;
          document.documentElement.classList.remove('aqua-busy-active');
          busyCursor?.classList.remove('visible');
        };
        const visibleFor = busyShownAt ? performance.now() - busyShownAt : 950;
        clearTimeout(busyHideTimer);
        busyHideTimer = setTimeout(hide, Math.max(0, 950 - visibleFor));
      }
    };
  }

  // ---------- System log (used by 控制台) ----------
  const syslogBuf = [];
  function syslog(msg, src) {
    const t = new Date();
    const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
    syslogBuf.push({ ts, time:t.getTime(), src: src || 'kernel', msg });
    if (syslogBuf.length > 500) syslogBuf.shift();
    document.dispatchEvent(new CustomEvent('syslog'));
  }

  // ---------- Hardware info (real, via browser APIs) ----------
  const HW = (() => {
    const cores = Number(navigator.hardwareConcurrency) || 2;
    const reportedMemory = Number(navigator.deviceMemory);
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Web';
    const ua = navigator.userAgent || '';
    const isMacHost = /\bMac/i.test(platform) || /Mac OS X/i.test(ua);
    const reportedModel = navigator.userAgentData?.model || '';
    function appleChipName(renderer) {
      const match = String(renderer || '').match(/\bApple\s+M\d+(?:\s+(?:Pro|Max|Ultra))?\b/i);
      if (!match) return '';
      return match[0]
        .replace(/\s+/g, ' ')
        .replace(/^apple/i, 'Apple')
        .replace(/\bm(\d+)/i, 'M$1')
        .replace(/\b(pro|max|ultra)\b/gi, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
    }
    const info = {
      model: reportedModel || (isMacHost ? 'Mac' : `${platform} 电脑`),
      modelIdentifier: reportedModel || '浏览器未公开',
      cores,
      processorName: isMacHost ? 'Mac 处理器' : `${platform} 处理器`,
      processor: isMacHost ? `Mac 处理器（${cores} 核）` : `${platform} 处理器（${cores} 核）`,
      processorSource: 'Navigator.hardwareConcurrency / Navigator.platform',
      memory: Number.isFinite(reportedMemory) && reportedMemory > 0 ? `${reportedMemory} GB` : '浏览器未公开',
      memorySource: Number.isFinite(reportedMemory) && reportedMemory > 0
        ? 'Navigator.deviceMemory'
        : '当前浏览器未提供 Navigator.deviceMemory',
      screen: `${screen.width} × ${screen.height}`,
      depth: screen.colorDepth + ' 位',
      dpr: devicePixelRatio,
      lang: navigator.language,
      platform,
      ua,
      gpu: '未知显卡',
      webgl: false,
      webgl2: false,
      graphicsApi: '软件渲染',
      glVersion: '',
      glslVersion: '',
      serial: 'W8' + Math.abs(hashCode(navigator.userAgent)).toString(36).toUpperCase().slice(0, 8),
    };
    try {
      const c = document.createElement('canvas');
      const contextAttributes = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      };
      let gl = c.getContext('webgl2', contextAttributes);
      info.webgl2 = !!gl;
      if (!gl) gl = c.getContext('webgl', contextAttributes) || c.getContext('experimental-webgl', contextAttributes);
      if (gl) {
        info.webgl = true;
        info.graphicsApi = info.webgl2 ? 'WebGL 2.0' : 'WebGL 1.0';
        info.glVersion = gl.getParameter(gl.VERSION);
        info.glslVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        info.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || 'WebGL GPU');
      }
    } catch (e) {}
    const appleChip = appleChipName(info.gpu);
    if (appleChip) {
      info.processorName = appleChip;
      info.processor = `${appleChip}（${cores} 核）`;
      info.processorSource = 'WebGL 渲染器 / Navigator.hardwareConcurrency';
    } else if (isMacHost && /\bApple\b/i.test(info.gpu) && !/\b(?:Intel|AMD)\b/i.test(info.gpu)) {
      info.processorName = 'Apple 芯片';
      info.processor = `Apple 芯片（${cores} 核）`;
      info.processorSource = 'WebGL 渲染器 / Navigator.hardwareConcurrency';
    } else if (isMacHost && /\bIntel\b/i.test(info.gpu)) {
      info.processorName = 'Intel 处理器';
      info.processor = `Intel 处理器（${cores} 核）`;
      info.processorSource = 'WebGL 渲染器 / Navigator.hardwareConcurrency';
    }
    function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
    return info;
  })();

  function uptimeStr() {
    let s = Math.floor((Date.now() - bootTime) / 1000);
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return (h ? h + ' 小时 ' : '') + (m ? m + ' 分钟 ' : '') + s + ' 秒';
  }

  function canDownloadVfsFile(path) {
    const node = VFS.get(path);
    return !!(node && node.type === 'file' && (typeof node.src === 'string' || node.content != null));
  }

  function downloadVfsFile(path) {
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return false;
    const name = VFS.baseName(path);
    const extension = (name.split('.').pop() || '').toLowerCase();
    const mime = node.mime || ({
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      svg: 'image/svg+xml', pdf: 'application/pdf', html: 'text/html',
      htm: 'text/html', json: 'application/json', txt: 'text/plain',
    }[extension] || 'application/octet-stream');
    let href = typeof node.src === 'string' ? node.src : '';
    let revoke = false;
    if (!href && node.content != null) {
      href = URL.createObjectURL(new Blob([String(node.content)], { type: `${mime}${mime.startsWith('text/') ? ';charset=utf-8' : ''}` }));
      revoke = true;
    }
    if (!href) return false;
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 3000);
    syslog(`已下载虚拟文件: ${path}`, 'Finder');
    return true;
  }

  // ---------- Kernel extensions (kext) ----------
  const Kexts = (() => {
    const KEY = 'macweb.kexts.loaded';
    let loaded;
    try { loaded = new Set(JSON.parse(localStorage.getItem(KEY))); } catch (e) { loaded = null; }
    if (!loaded || !loaded.size) loaded = new Set(['System.kext', 'QuartzExtreme.kext', 'AppleHDA.kext', 'IONetworkingFamily.kext', 'AppleIntelGMA.kext', 'IOUSBFamily.kext']);
    function save() { localStorage.setItem(KEY, JSON.stringify([...loaded])); }
    function list() {
      return (VFS.list('/系统/扩展') || []).map((name) => {
        const n = VFS.get('/系统/扩展/' + name);
        return { name, desc: (n && n.desc) || '第三方内核扩展', ver: (n && n.ver) || '1.0', loaded: loaded.has(name) };
      });
    }
    function applyEffects() {
      document.body.classList.toggle('noqe', !loaded.has('QuartzExtreme.kext'));
    }
    function load(path) {
      const p = VFS.normalize(path.startsWith('/') ? path : '/系统/扩展/' + path);
      const name = VFS.baseName(p);
      if (!name.endsWith('.kext')) return { ok: false, msg: `${name}: 不是内核扩展 (需要 .kext)` };
      const node = VFS.get(p);
      if (!node) return { ok: false, msg: `${name}: 找不到该扩展` };
      if (!VFS.get('/系统/扩展/' + name)) {
        VFS.putNode('/系统/扩展/' + name, { type: 'kext', desc: node.desc || '第三方内核扩展 (用户安装)', ver: node.ver || '1.0' });
        syslog(`已安装扩展 ${name} 到 /系统/扩展`, 'kextd');
      }
      loaded.add(name); save(); applyEffects();
      syslog(`kext 已装载: ${name}`, 'kextd');
      return { ok: true, msg: `${name} 装载成功` };
    }
    function unload(name) {
      if (!name.endsWith('.kext')) name += '.kext';
      if (name === 'System.kext') return { ok: false, msg: 'System.kext: 系统核心扩展无法卸载' };
      if (!loaded.has(name)) return { ok: false, msg: `${name}: 未装载` };
      loaded.delete(name); save(); applyEffects();
      syslog(`kext 已卸载: ${name}`, 'kextd');
      return { ok: true, msg: `${name} 已卸载` };
    }
    return { list, load, unload, applyEffects, isLoaded: (n) => loaded.has(n) };
  })();

  // ---------- Recent applications and documents ----------
  const RECENTS_KEY = 'macweb.recents.v1';
  function recentLimits() {
    const limits = { apps:10, documents:10 };
    try {
      const appearance = JSON.parse(localStorage.getItem('macweb.pref.appearance')) || {};
      if (Number.isFinite(appearance.recentApps)) limits.apps = Math.max(0, appearance.recentApps);
      if (Number.isFinite(appearance.recentDocs)) limits.documents = Math.max(0, appearance.recentDocs);
    } catch (e) {}
    return limits;
  }
  function loadRecentItems() {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENTS_KEY));
      return {
        apps:Array.isArray(stored?.apps) ? stored.apps.filter((entry) => entry && typeof entry.id === 'string') : [],
        documents:Array.isArray(stored?.documents)
          ? stored.documents.filter((entry) => entry && typeof entry.path === 'string')
          : [],
      };
    } catch (e) {
      return { apps:[], documents:[] };
    }
  }
  function saveRecentItems(recents) {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
      document.dispatchEvent(new CustomEvent('system-recents-changed'));
      return true;
    } catch (e) {
      return false;
    }
  }
  function addRecentApp(id) {
    if (!id || id === 'finder' || !apps[id]) return;
    const recents = loadRecentItems();
    recents.apps = [{ id, at:Date.now() }, ...recents.apps.filter((entry) => entry.id !== id)].slice(0, 50);
    saveRecentItems(recents);
  }
  function addRecentDocument(path, appId) {
    path = VFS.normalize(path || '');
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return false;
    const recents = loadRecentItems();
    recents.documents = [
      { path, appId:apps[appId] ? appId : undefined, at:Date.now() },
      ...recents.documents.filter((entry) => VFS.normalize(entry.path) !== path),
    ].slice(0, 50);
    return saveRecentItems(recents);
  }
  function clearRecentItems() {
    const changed = saveRecentItems({ apps:[], documents:[] });
    if (changed) syslog('最近使用的项目已清除', 'SystemUIServer');
    return changed;
  }
  function getRecentItems() {
    const recents = loadRecentItems();
    const limits = recentLimits();
    return {
      apps:recents.apps.filter((entry) => apps[entry.id]).slice(0, limits.apps),
      documents:recents.documents.filter((entry) => VFS.get(entry.path)?.type === 'file').slice(0, limits.documents),
    };
  }
  function openRecentDocument(entry) {
    if (!entry || !VFS.get(entry.path)) return false;
    if (entry.appId && apps[entry.appId]) launch(entry.appId, { path:entry.path });
    else System.openVfsPath?.(entry.path);
    return true;
  }

  // ---------- App registry ----------
  function registerApp(app) {
    apps[app.id] = app;
    app.windows = [];
    app.hidden = false;
    app._launchTimer = null;
    app._launchPendingArg = undefined;
  }

  function launch(id, arg) {
    const app = apps[id];
    if (!app) return;
    const dockIcon = $(`#dock .dock-icon[data-app="${id}"]`);
    if (app.windows.some((win) => win._hiddenByApp)) {
      showApp(id, { focus: !arg });
      if (!arg) return;
    }
    if (!app.multiWindow && app._launchTimer != null) {
      // Preserve the most recent explicit launch target while the Dock bounce
      // animation is still pending (for example, a requested preference pane).
      if (arg !== undefined) app._launchPendingArg = arg;
      return;
    }
    if (app.windows.length && !arg && !app.multiWindow) {
      const target = app.windows[app.windows.length - 1];
      document.dispatchEvent(new CustomEvent('system-activate-window', { detail: { window: target } }));
      focusWindow(target);
      setActiveApp(id);
      return;
    }
    if (dockIcon && !app.windows.length) {
      dockIcon.classList.add('bouncing');
      setTimeout(() => dockIcon.classList.remove('bouncing'), 1700);
      const endBusy = beginBusy(320);
      if (!app.multiWindow) app._launchPendingArg = arg;
      const timer = setTimeout(() => {
        try {
          const pendingArg = app.multiWindow ? arg : app._launchPendingArg;
          if (app._launchTimer === timer) {
            app._launchTimer = null;
            app._launchPendingArg = undefined;
          }
          if (!app.multiWindow && app.windows.length) {
            focusWindow(app.windows[app.windows.length - 1]);
            setActiveApp(id);
            return;
          }
          reallyOpen(app, pendingArg);
        } finally {
          endBusy();
        }
      }, 500);
      if (!app.multiWindow) app._launchTimer = timer;
    } else {
      reallyOpen(app, arg);
    }
  }

  function reallyOpen(app, arg) {
    let opened = true;
    try { app.open(arg); } catch (e) { opened = false; console.error('app open failed:', app.id, e); }
    if (opened) addRecentApp(app.id);
    syslog(`应用已启动: ${app.name}`, 'launchd');
    updateDock();
    setActiveApp(app.id);
  }

  // ---------- Windows ----------
  // Leopard's preference and inspector windows are content-sized rather than
  // permanently padded workspaces.  Keep that policy in WindowServer so every
  // opt-in panel gets the same measurement, screen clamping and animation.
  function resizeWindow(win, requested) {
    if (!win || win._closed || !win.isConnected) return null;
    const options = requested || {};
    if (win._interactionCleanup) win._interactionCleanup(false);

    const rect = win.getBoundingClientRect();
    const computed = getComputedStyle(win);
    const currentWidth = parseFloat(win.style.width) || parseFloat(computed.width) || rect.width;
    const currentHeight = parseFloat(win.style.height) || parseFloat(computed.height) || rect.height;
    const minimumWidth = Math.max(160, Number(options.minWidth) || parseFloat(computed.minWidth) || 320);
    const minimumHeight = Math.max(90, Number(options.minHeight) || parseFloat(computed.minHeight) || 180);
    const dockAtBottom = (document.body.dataset.dockPosition || 'bottom') === 'bottom';
    const safeTop = Math.max(0, Number(options.safeTop) || 8);
    const safeBottom = Math.max(8, Number(options.safeBottom) || (dockAtBottom ? 72 : 12));
    const availableWidth = Math.max(minimumWidth, innerWidth - 16);
    const availableHeight = Math.max(minimumHeight, innerHeight - safeTop - safeBottom);
    const configuredMaxWidth = Number.isFinite(Number(options.maxWidth)) ? Number(options.maxWidth) : availableWidth;
    const configuredMaxHeight = Number.isFinite(Number(options.maxHeight)) ? Number(options.maxHeight) : availableHeight;
    const targetWidth = Math.min(availableWidth, configuredMaxWidth,
      Math.max(minimumWidth, Number.isFinite(Number(options.width)) ? Number(options.width) : currentWidth));
    const targetHeight = Math.min(availableHeight, configuredMaxHeight,
      Math.max(minimumHeight, Number.isFinite(Number(options.height)) ? Number(options.height) : currentHeight));

    let targetLeft = Number.parseFloat(win.style.left);
    let targetTop = Number.parseFloat(win.style.top);
    if (!Number.isFinite(targetLeft)) targetLeft = rect.left;
    if (!Number.isFinite(targetTop)) targetTop = rect.top;
    if (options.width != null && options.anchor !== 'top-left') targetLeft += (currentWidth - targetWidth) / 2;
    targetLeft = Math.min(innerWidth - 8 - targetWidth, Math.max(8, targetLeft));
    targetTop = Math.min(innerHeight - safeBottom - targetHeight, Math.max(safeTop, targetTop));

    const changed = Math.abs(currentWidth - targetWidth) > .5
      || Math.abs(currentHeight - targetHeight) > .5
      || Math.abs((Number.parseFloat(win.style.left) || rect.left) - targetLeft) > .5
      || Math.abs((Number.parseFloat(win.style.top) || rect.top) - targetTop) > .5;
    win._zoomed = null;
    const applySize = () => {
      win._contentResizeFrame = null;
      win.style.left = `${Math.round(targetLeft)}px`;
      win.style.top = `${Math.round(targetTop)}px`;
      win.style.width = `${Math.round(targetWidth)}px`;
      win.style.height = `${Math.round(targetHeight)}px`;
      if (win._onResize) win._onResize(win);
    };
    if (!changed) {
      applySize();
      if (win._contentResizeTimer == null && win._contentResizeFrame == null) {
        win.classList.remove('auto-resizing');
        win.style.removeProperty('--window-resize-duration');
      }
      return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
    }

    if (win._contentResizeFrame != null) {
      cancelAnimationFrame(win._contentResizeFrame);
      win._contentResizeFrame = null;
    }
    if (win._contentResizeTimer != null) {
      clearTimeout(win._contentResizeTimer);
      win._contentResizeTimer = null;
    }
    if (win._contentResizeNotifyFrame != null) {
      cancelAnimationFrame(win._contentResizeNotifyFrame);
      win._contentResizeNotifyFrame = null;
    }

    const animate = options.animate !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = Math.max(0, Number(options.duration) || 240);
    if (!animate) {
      win.classList.remove('auto-resizing');
      win.style.removeProperty('--window-resize-duration');
      applySize();
      return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
    }

    win.classList.add('auto-resizing');
    win.style.setProperty('--window-resize-duration', `${duration}ms`);
    win.dispatchEvent(new CustomEvent('window-resize-start', {
      detail:{ width:targetWidth, height:targetHeight, automatic:true },
    }));
    win._contentResizeFrame = requestAnimationFrame(applySize);
    const startedAt = performance.now();
    const notifyResize = (now) => {
      if (!win.isConnected || win._closed) return;
      if (win._onResize) win._onResize(win);
      if (now - startedAt < duration + 20) win._contentResizeNotifyFrame = requestAnimationFrame(notifyResize);
      else win._contentResizeNotifyFrame = null;
    };
    win._contentResizeNotifyFrame = requestAnimationFrame(notifyResize);
    win._contentResizeTimer = setTimeout(() => {
      win._contentResizeTimer = null;
      if (!win.isConnected) return;
      win.classList.remove('auto-resizing');
      win.style.removeProperty('--window-resize-duration');
      if (win._onResize) win._onResize(win);
      win.dispatchEvent(new CustomEvent('window-resize-end', {
        detail:{ width:targetWidth, height:targetHeight, automatic:true },
      }));
    }, duration + 34);
    return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
  }

  function fitWindowToContent(win, overrides) {
    if (!win || win._closed || !win.isConnected || !win._body) return null;
    const options = Object.assign({}, win._contentFitOptions || {}, overrides || {});
    let root = options.root;
    if (typeof root === 'string') root = win._body.querySelector(root);
    if (!root || !root.isConnected) root = win._body.firstElementChild;
    if (!root) return null;

    const previousScrollTop = win._body.scrollTop;
    win.classList.add('content-measuring');
    // Reading geometry flushes the temporary intrinsic-size rules. The class is
    // removed in this same task, so users never see the measuring state.
    const naturalBodyHeight = Math.max(
      win._body.scrollHeight,
      win._body.offsetHeight,
      root.scrollHeight,
      root.offsetHeight,
    );
    let chromeHeight = 0;
    Array.from(win.children).forEach((child) => {
      if (child === win._body || child.classList.contains('win-resize') || getComputedStyle(child).display === 'none') return;
      chromeHeight += child.offsetHeight;
    });
    win.classList.remove('content-measuring');
    win._body.scrollTop = previousScrollTop;

    const extraHeight = Number(options.extraHeight) || 0;
    const measuredHeight = Math.ceil(chromeHeight + naturalBodyHeight + extraHeight);
    return resizeWindow(win, Object.assign({}, options, { height:measuredHeight }));
  }

  function requestContentFit(win, overrides) {
    if (!win || win._closed) return;
    if (win._contentFitFrame != null) cancelAnimationFrame(win._contentFitFrame);
    win._contentFitFrame = requestAnimationFrame(() => {
      win._contentFitFrame = null;
      fitWindowToContent(win, overrides);
    });
  }

  function installContentFit(win, fitOptions) {
    // A small optical inset keeps ordinary content-sized panels from ending
    // directly on the resize edge. Full-bleed panes opt out with
    // `extraHeight: 0`.
    const options = Object.assign(
      { extraHeight: 8 },
      fitOptions === true ? {} : (fitOptions || {}),
    );
    win._contentFitOptions = options;
    win.classList.add('content-fit-window');
    win._requestContentFit = (overrides) => requestContentFit(win, overrides);
    const observedRoot = win._body.firstElementChild || win._body;
    const schedule = () => requestContentFit(win);
    win._contentFitLayoutHandler = schedule;
    win.addEventListener('panel-layout-changed', schedule);
    observedRoot.addEventListener('load', schedule, true);
    win._contentFitObservedRoot = observedRoot;
    win._contentFitObserver = new MutationObserver((mutations) => {
      const structuralChange = mutations.some((mutation) =>
        mutation.type === 'attributes' || mutation.target === observedRoot);
      if (structuralChange) schedule();
    });
    win._contentFitObserver.observe(observedRoot, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:['hidden', 'open'],
    });
    requestContentFit(win, { animate:options.animateInitial !== false });
  }

  function createWindow(opts) {
    // opts: {app, title, width, height, x, y, content(DOM), toolbar(DOM)?,
    // statusbar?, noResize?, autoFitContent?, bodyBg?, transparentTitle?}
    const app = apps[opts.app];
    const win = el('div', 'window opening');
    win.dataset.app = opts.app;
    win.dataset.wid = ++winSeq;
    const W = Math.min(opts.width || 500, innerWidth - 40);
    const H = Math.min(opts.height || 360, innerHeight - 120);
    win.style.width = W + 'px';
    win.style.height = H + 'px';
    const offset = (app.windows.length % 5) * 26;
    win.style.left = (opts.x != null ? opts.x : Math.max(10, (innerWidth - W) / 2 - 80 + offset)) + 'px';
    win.style.top = (opts.y != null ? opts.y : Math.max(30, (innerHeight - H) / 2 - 60 + offset)) + 'px';

    const tb = el('div', 'titlebar');
    const traffic = el('div', 'traffic');
    const btnClose = el('div', 'tl-btn tl-close');
    const btnMin = el('div', 'tl-btn tl-min');
    const btnZoom = el('div', 'tl-btn tl-zoom');
    traffic.append(btnClose, btnMin, btnZoom);
    const title = el('div', 'title', opts.title || app.name);
    tb.append(traffic, title);
    win.appendChild(tb);

    if (opts.toolbar) { const t = el('div', 'win-toolbar'); t.appendChild(opts.toolbar); win.appendChild(t); }
    const body = el('div', 'win-body');
    if (opts.bodyBg) body.style.background = opts.bodyBg;
    if (opts.content) body.appendChild(opts.content);
    win.appendChild(body);
    if (opts.statusbar != null) { const s = el('div', 'win-statusbar'); s.textContent = opts.statusbar; win.appendChild(s); win._status = s; }
    if (!opts.noResize) {
      const grip = el('div', 'win-resize');
      win.appendChild(grip);
      initResize(win, grip);
    }

    $('#windows').appendChild(win);
    setTimeout(() => win.classList.remove('opening'), 200);

    win._app = app;
    win._title = title;
    win._body = body;
    app.windows.push(win);
    windows.push(win);
    focusWindow(win);

    btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeWindow(win); });
    btnMin.addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(win); });
    btnZoom.addEventListener('click', (e) => {
      e.stopPropagation();
      if (win._zoomed) {
        Object.assign(win.style, win._zoomed);
        win._zoomed = null;
      } else {
        win._zoomed = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        Object.assign(win.style, { left: '8px', top: '8px', width: (innerWidth - 16) + 'px', height: (innerHeight - 110) + 'px' });
      }
      if (opts.onResize) opts.onResize(win);
    });
    win.addEventListener('mousedown', () => { focusWindow(win); setActiveApp(opts.app); });
    initDrag(win, tb);
    if (opts.onResize) win._onResize = opts.onResize;
    if (opts.onClose) win._onClose = opts.onClose;
    if (opts.autoFitContent) installContentFit(win, opts.autoFitContent);
    return win;
  }

  function focusWindow(win) {
    if (!win || win._closed) return;
    if (win._hiddenByApp) {
      win._hiddenByApp = false;
      win.classList.remove('app-hidden');
      win.style.display = '';
      if (win._app) win._app.hidden = win._app.windows.some((candidate) => candidate._hiddenByApp);
    }
    const focused = document.activeElement;
    if (focused && focused !== document.body && !win.contains(focused) && typeof focused.blur === 'function') focused.blur();
    const i = windows.indexOf(win);
    if (i >= 0) windows.splice(i, 1);
    windows.push(win);
    windows.forEach((w, idx) => {
      w.style.zIndex = 100 + idx;
      w.classList.toggle('inactive', w !== win);
    });
  }

  function topVisibleWindow() {
    for (let i = windows.length - 1; i >= 0; i--) {
      const win = windows[i];
      if (win.isConnected && win.style.display !== 'none' && !win._closing) return win;
    }
    return null;
  }

  function runWindowCloseHandler(win, force, reason) {
    if (win._onCloseDone) return true;
    let allowed = true;
    try {
      if (win._onClose) allowed = win._onClose(win, { reason: reason || 'close', force: !!force }) !== false;
    } catch (e) {
      console.error('window close cleanup failed:', win.dataset.app, e);
    }
    if (allowed || force) win._onCloseDone = true;
    return allowed || force;
  }

  function detachWindow(win) {
    if (!win || win._closed) return false;
    win._closed = true;
    if (win._interactionCleanup) {
      win._interactionCleanup(false);
      win._interactionCleanup = null;
    }
    if (win._closeTimer != null) {
      clearTimeout(win._closeTimer);
      win._closeTimer = null;
    }
    if (win._minTimer != null) {
      clearTimeout(win._minTimer);
      win._minTimer = null;
    }
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    if (win._contentFitFrame != null) {
      cancelAnimationFrame(win._contentFitFrame);
      win._contentFitFrame = null;
    }
    if (win._contentResizeFrame != null) {
      cancelAnimationFrame(win._contentResizeFrame);
      win._contentResizeFrame = null;
    }
    if (win._contentResizeNotifyFrame != null) {
      cancelAnimationFrame(win._contentResizeNotifyFrame);
      win._contentResizeNotifyFrame = null;
    }
    if (win._contentResizeTimer != null) {
      clearTimeout(win._contentResizeTimer);
      win._contentResizeTimer = null;
    }
    if (win._contentFitObserver) {
      win._contentFitObserver.disconnect();
      win._contentFitObserver = null;
    }
    if (win._contentFitLayoutHandler) {
      win.removeEventListener('panel-layout-changed', win._contentFitLayoutHandler);
      win._contentFitObservedRoot?.removeEventListener('load', win._contentFitLayoutHandler, true);
      win._contentFitLayoutHandler = null;
      win._contentFitObservedRoot = null;
    }
    if (win._minThumb) {
      win._minThumb.remove();
      win._minThumb = null;
      invalidateDockMagnify();
    }
    win.remove();
    const wi = windows.indexOf(win); if (wi >= 0) windows.splice(wi, 1);
    const ai = win._app.windows.indexOf(win); if (ai >= 0) win._app.windows.splice(ai, 1);
    return true;
  }

  function updateAfterWindowClose() {
    updateDock();
    const top = topVisibleWindow();
    if (top) { focusWindow(top); setActiveApp(top.dataset.app); }
    else setActiveApp('finder');
  }

  function closeWindow(win) {
    if (!win || win._closed || win._closing) return;
    if (win._interactionCleanup) win._interactionCleanup(false);
    win._closing = true;
    if (!runWindowCloseHandler(win, false, 'close')) {
      win._closing = false;
      return;
    }
    win.classList.add('closing');
    win._closeTimer = setTimeout(() => {
      if (!detachWindow(win)) return;
      updateAfterWindowClose();
    }, 180);
  }

  function minimizeWindow(win) {
    if (!win || win._closed || win._closing || win._minThumb || win._minTimer != null || win.style.display === 'none') return;
    if (win._interactionCleanup) win._interactionCleanup(false);
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    const dockRight = $('#dock-right');
    const thumb = el('div', 'dock-min');
    const thumbTitle = el('div', 'dm-title');
    const thumbLabel = el('div', 'dock-label');
    thumbTitle.textContent = win._title.textContent;
    thumbLabel.textContent = win._title.textContent;
    const iconSvg = win._app.icon;
    const thumbIcon = el('div');
    thumbIcon.style.cssText = 'position:absolute;inset:2px 2px 10px;opacity:.85';
    thumbIcon.innerHTML = iconSvg;
    thumb.append(thumbIcon, thumbTitle, thumbLabel);
    dockRight.appendChild(thumb);
    invalidateDockMagnify();
    // genie-ish: scale toward the dock
    const thumbRect = thumb.getBoundingClientRect();
    const r = thumbRect.width ? thumbRect : { left: innerWidth / 2 + 100, top: innerHeight - 40 };
    const wr = win.getBoundingClientRect();
    win.classList.add('minimizing');
    win.style.transformOrigin = '50% 50%';
    const dx = (r.left + 22) - (wr.left + wr.width / 2);
    const dy = (r.top + 22) - (wr.top + wr.height / 2);
    win.style.transform = `translate(${dx}px, ${dy}px) scale(.06)`;
    win.style.opacity = '0';
    win._minTimer = setTimeout(() => {
      win._minTimer = null;
      if (!win.isConnected || !win._minThumb) return;
      win.style.display = 'none';
      const top = topVisibleWindow();
      if (top) { focusWindow(top); setActiveApp(top.dataset.app); }
      else setActiveApp('finder');
    }, 300);
    win._minThumb = thumb;
    thumb.addEventListener('click', () => restoreWindow(win));
  }

  function restoreWindow(win) {
    if (!win || win._closed) return;
    win._hiddenByApp = false;
    win.classList.remove('app-hidden');
    if (win._app) win._app.hidden = false;
    if (win._minTimer != null) {
      clearTimeout(win._minTimer);
      win._minTimer = null;
    }
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    if (win._minThumb) {
      win._minThumb.remove();
      win._minThumb = null;
      invalidateDockMagnify();
    }
    win.style.display = '';
    requestAnimationFrame(() => {
      if (!win.isConnected || win._minThumb) return;
      win.style.transform = '';
      win.style.opacity = '';
      win._restoreTimer = setTimeout(() => {
        win._restoreTimer = null;
        if (!win._minThumb) win.classList.remove('minimizing');
      }, 320);
    });
    focusWindow(win);
    setActiveApp(win.dataset.app);
  }

  function hideApp(id) {
    const app = apps[id];
    if (!app) return false;
    let changed = false;
    app.windows.forEach((win) => {
      if (!win.isConnected || win._closed || win._closing || win._minThumb || win.style.display === 'none') return;
      win._hiddenByApp = true;
      win.classList.add('app-hidden');
      win.style.display = 'none';
      changed = true;
    });
    app.hidden = app.windows.some((win) => win._hiddenByApp);
    if (!changed) return false;
    const top = topVisibleWindow();
    if (top) {
      focusWindow(top);
      setActiveApp(top.dataset.app);
    } else {
      setActiveApp('finder');
    }
    document.dispatchEvent(new CustomEvent('application-visibility-changed', { detail:{ appId:id, hidden:true } }));
    return true;
  }

  function showApp(id, options) {
    const app = apps[id];
    if (!app) return false;
    let changed = false;
    app.windows.forEach((win) => {
      if (!win.isConnected || !win._hiddenByApp) return;
      win._hiddenByApp = false;
      win.classList.remove('app-hidden');
      win.style.display = '';
      changed = true;
    });
    app.hidden = false;
    const target = [...app.windows].reverse().find((win) =>
      win.isConnected && win.style.display !== 'none' && !win._closing);
    if (target && options?.focus !== false) {
      focusWindow(target);
      setActiveApp(id);
    }
    if (changed) {
      document.dispatchEvent(new CustomEvent('application-visibility-changed', { detail:{ appId:id, hidden:false } }));
    }
    return changed;
  }

  function hideOtherApps(keepId) {
    Object.keys(apps).forEach((id) => {
      if (id !== keepId) hideApp(id);
    });
    const front = topWindowOf(keepId);
    if (front) {
      focusWindow(front);
      setActiveApp(keepId);
    }
  }

  function showAllApps() {
    let changed = false;
    Object.keys(apps).forEach((id) => {
      if (apps[id].windows.some((win) => win._hiddenByApp)) {
        changed = showApp(id, { focus:false }) || changed;
      }
    });
    const front = topVisibleWindow();
    if (front) {
      focusWindow(front);
      setActiveApp(front.dataset.app);
    }
    return changed;
  }

  function initDrag(win, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.tl-btn') || exposeOn || win._closing || win.classList.contains('minimizing')) return;
      e.preventDefault();
      win.classList.remove('opening');
      const sx = e.clientX, sy = e.clientY;
      const rect = win.getBoundingClientRect();
      const ox = Number.parseFloat(win.style.left) || rect.left;
      const oy = Number.parseFloat(win.style.top) || rect.top;
      const minL = 60 - rect.width;
      let nextLeft = ox;
      let nextTop = oy;
      let frameId = 0;

      if (win._interactionCleanup) win._interactionCleanup(false);
      win.classList.add('dragging');
      document.documentElement.classList.add('window-interacting');

      function updatePosition(ev) {
        nextLeft = Math.min(innerWidth - 60, Math.max(minL, ox + (ev.clientX - sx)));
        nextTop = Math.min(innerHeight - 60, Math.max(0, oy + (ev.clientY - sy)));
      }
      function paint() {
        frameId = 0;
        win.style.transform = `translate3d(${nextLeft - ox}px, ${nextTop - oy}px, 0)`;
      }
      function mv(ev) {
        updatePosition(ev);
        if (!frameId) frameId = requestAnimationFrame(paint);
      }
      function cleanup(commit, ev) {
        removeEventListener('mousemove', mv);
        removeEventListener('mouseup', up);
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
        if (commit && ev) updatePosition(ev);
        if (commit) {
          win.style.left = nextLeft + 'px';
          win.style.top = nextTop + 'px';
        }
        win.style.transform = '';
        win.classList.remove('dragging');
        document.documentElement.classList.remove('window-interacting');
        if (win._interactionCleanup === cleanup) win._interactionCleanup = null;
      }
      function up(ev) { cleanup(true, ev); }
      win._interactionCleanup = cleanup;
      addEventListener('mousemove', mv);
      addEventListener('mouseup', up);
    });
  }

  function initResize(win, grip) {
    grip.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || win._closing || win.classList.contains('minimizing')) return;
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      const rect = win.getBoundingClientRect();
      const ow = rect.width, oh = rect.height;
      let nextWidth = ow;
      let nextHeight = oh;
      let frameId = 0;

      if (win._interactionCleanup) win._interactionCleanup(false);
      win.classList.add('resizing');
      document.documentElement.classList.add('window-interacting', 'window-resize-active');

      function updateSize(ev) {
        const computed = getComputedStyle(win);
        const minimumWidth = Math.max(160,parseFloat(computed.minWidth) || 320);
        const minimumHeight = Math.max(90,parseFloat(computed.minHeight) || 180);
        nextWidth = Math.max(minimumWidth, ow + (ev.clientX - sx));
        nextHeight = Math.max(minimumHeight, oh + (ev.clientY - sy));
      }
      function paint() {
        frameId = 0;
        win.style.width = nextWidth + 'px';
        win.style.height = nextHeight + 'px';
        if (win._onResize) win._onResize(win);
      }
      function mv(ev) {
        updateSize(ev);
        if (!frameId) frameId = requestAnimationFrame(paint);
      }
      function cleanup(commit, ev) {
        removeEventListener('mousemove', mv);
        removeEventListener('mouseup', up);
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
        if (commit && ev) updateSize(ev);
        if (commit) paint();
        win.classList.remove('resizing');
        document.documentElement.classList.remove('window-interacting', 'window-resize-active');
        if (win._interactionCleanup === cleanup) win._interactionCleanup = null;
      }
      function up(ev) { cleanup(true, ev); }
      win._interactionCleanup = cleanup;
      addEventListener('mousemove', mv);
      addEventListener('mouseup', up);
    });
  }

  function topWindowOf(appId) {
    for (let i = windows.length - 1; i >= 0; i--)
      if (windows[i].dataset.app === appId && windows[i].style.display !== 'none') return windows[i];
    return null;
  }

  // ---------- Application command routing ----------
  // Menus do not reach into an application's private implementation. They send
  // the same command event to its front document window that keyboard shortcuts
  // and toolbar buttons can use.
  function dispatchAppCommand(appId, command, detail) {
    const front = topWindowOf(appId);
    const win = apps[appId]?.commandTarget?.(command, front) || front;
    if (win) {
      const event = new CustomEvent('leopard-command', {
        bubbles: true, cancelable: true,
        detail: Object.assign({ command, appId }, detail || {}),
      });
      win.dispatchEvent(event);
      if (event.defaultPrevented) return true;
      const target = win.querySelector(`[data-command="${command}"]`);
      if (target && !target.disabled) {
        target.click();
        return true;
      }
    }
    switch (command) {
      case 'new-window': launch(appId, { forceNew: true }); return true;
      case 'open-document':
        if (!win) return false;
        openPanel({
          parent:win, title:'打开', startPath:'/用户/roll',
          onOpen:(path)=>{ System.openVfsPath?.(path); },
        });
        return true;
      case 'close-window': if (win) closeWindow(win); return !!win;
      case 'minimize': if (win) minimizeWindow(win); return !!win;
      case 'zoom': win?.querySelector('.tl-zoom')?.click(); return !!win;
      case 'undo': case 'redo': case 'cut': case 'copy': case 'paste':
      case 'delete': case 'selectAll':
        try { return document.execCommand(command); } catch (e) { return false; }
      default: return false;
    }
  }

  const cmd = (appId, label, command, shortcut, extra) => Object.assign({
    label, shortcut, action: () => dispatchAppCommand(appId, command),
  }, extra || {});

  function editMenu(appId) {
    return { title: '编辑', items: [
      cmd(appId, '撤销', 'undo', '⌘Z'), cmd(appId, '重做', 'redo', '⇧⌘Z'),
      { sep: true },
      cmd(appId, '剪切', 'cut', '⌘X'), cmd(appId, '拷贝', 'copy', '⌘C'),
      cmd(appId, '粘贴', 'paste', '⌘V'), cmd(appId, '删除', 'delete', '⌫'),
      { sep: true }, cmd(appId, '全选', 'selectAll', '⌘A'),
    ]};
  }

  function windowMenu(appId) {
    const appWindows = apps[appId]?.windows || [];
    const front = topWindowOf(appId);
    return { title: '窗口', items: [
      cmd(appId, '最小化', 'minimize', '⌘M'), cmd(appId, '缩放', 'zoom'),
      { sep: true },
      { label: 'Exposé：显示所有窗口', shortcut: 'F9', action: () => toggleExpose() },
      { label: '将所有窗口移到前面', action: () => apps[appId].windows.forEach((w) => focusWindow(w)) },
      ...(appWindows.length ? [
        { sep:true },
        ...appWindows.map((win) => ({
          label:win._title?.textContent || apps[appId].name,
          checked:win === front,
          action:() => { restoreWindow(win); focusWindow(win); setActiveApp(appId); },
        })),
      ] : []),
    ]};
  }

  const helpViewerIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="help-face" cx=".35" cy=".25"><stop stop-color="#dff7ff"/><stop offset=".45" stop-color="#65b7e8"/><stop offset="1" stop-color="#17659f"/></radialGradient><filter id="help-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".4"/></filter></defs><g filter="url(#help-shadow)"><circle cx="32" cy="32" r="27" fill="url(#help-face)" stroke="#355f7d" stroke-width="1.5"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-opacity=".58"/><path d="M23 24c.8-7 6.1-10 12-9.4 6.4.6 10.2 4.7 9.6 10.1-.5 4.8-3.6 7.1-7.1 9.3-3 1.9-4.6 3.6-4.6 7.3" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32.5" cy="49" r="3.5" fill="#fff"/></g></svg>`;
  const HELP_ARTICLES = [
    {
      id:'welcome', category:'开始使用', title:'欢迎使用 Mac 帮助',
      summary:'了解 Leopard 桌面、菜单栏、Dock、窗口和应用程序。',
      appIds:['finder'],
      html:`<p>Mac 帮助可以带您了解这台 Leopard Web Mac。使用左侧目录浏览主题，或在右上角搜索问题。</p>
        <h2>先从这些内容开始</h2><ul><li>菜单栏始终显示当前应用程序的菜单。</li><li>Dock 用于打开应用程序、恢复隐藏窗口和访问堆栈。</li><li>Finder 管理桌面、文件夹、共享卷和废纸篓。</li><li>大多数更改会保存在这台浏览器的虚拟磁盘中。</li></ul>`,
    },
    {
      id:'finder-basics', category:'Finder 与文件', title:'使用 Finder 管理文件',
      summary:'浏览四种视图、选择项目、拷贝、移动、制作替身以及撤销操作。',
      appIds:['finder'],
      html:`<p>Finder 提供图标、列表、分栏和 Cover Flow 四种视图。使用工具栏或按 ⌘1 到 ⌘4 切换。</p>
        <h2>选择与整理项目</h2><ol><li>点按项目进行选择；按住 Shift 选择连续项目，按住 Command 选择多个项目。</li><li>使用“编辑”菜单拷贝、剪切和粘贴。</li><li>按 ⌘D 复制，按 ⌘L 制作替身，按 Command-Delete 移到废纸篓。</li></ol>
        <h2>撤销</h2><p>Finder 文件操作支持撤销和重做。“编辑”菜单会显示将要撤销的操作名称。</p>`,
    },
    {
      id:'finder-navigation', category:'Finder 与文件', title:'前往文件夹和连接服务器',
      summary:'通过路径打开文件夹，并在 Finder 中装载共享卷。',
      appIds:['finder'],
      html:`<p>从“前往”菜单选择“前往文件夹…”，可以输入 /Users/roll、~/桌面或标准虚拟磁盘路径。</p>
        <h2>连接服务器</h2><p>选择“前往”→“连接服务器…”，输入 smb://、afp://、ftp:// 或 HTTP 地址。浏览器不能直接装载系统 SMB/AFP 卷，因此 Finder 会创建一个明确标示的虚拟共享卷；可在侧栏中右键断开。</p>`,
    },
    {
      id:'open-save', category:'Finder 与文件', title:'打开和存储文稿',
      summary:'使用 Aqua 文件面板搜索、筛选、导入和处理同名文稿。',
      appIds:['finder','textedit','preview','mail','quicktime'],
      html:`<p>打开和存储面板附属于当前文稿窗口。父窗口在面板关闭之前不能操作。</p>
        <ul><li>在侧栏中选择设备、位置或共享文件夹。</li><li>使用搜索框筛选当前文件夹。</li><li>“启用”菜单限制可打开的文件类型。</li><li>存储同名文稿时必须明确选择“替换”。</li><li>“从本机导入…”会将经过授权的文件复制到虚拟磁盘。</li></ul>`,
    },
    {
      id:'quick-look', category:'Finder 与文件', title:'使用快速查看',
      summary:'不启动完整应用即可预览图像、PDF、文本和媒体。',
      appIds:['finder','preview'],
      html:`<p>在 Finder 中选择一个项目并按空格键，或点按工具栏中的“快速查看”。再次按空格键即可关闭。</p><p>快速查看不会修改原文稿；点按“在 Finder 中显示”可返回项目所在文件夹。</p>`,
    },
    {
      id:'safari-browsing', category:'互联网', title:'使用 Safari 浏览网页',
      summary:'地址栏、标签页、历史记录、书签以及兼容浏览。',
      appIds:['safari'],
      html:`<p>在智能地址栏中输入网址或搜索词并按 Return。Safari 会在应用内部尝试载入页面；站内链接继续在 Safari 标签页中打开。</p>
        <h2>标签页快捷键</h2><ul><li>⌘T：新建标签页</li><li>⌘W：关闭当前标签页</li><li>⌘L：选择地址栏</li><li>⌘R：重新载入</li></ul>
        <p>网站可能使用禁止嵌入的安全策略。Safari 会尽可能提供兼容阅读视图，但不会把普通导航偷偷交给外部浏览器。</p>`,
    },
    {
      id:'mail-basics', category:'互联网', title:'阅读和发送邮件',
      summary:'管理邮箱、编写邮件、添加附件以及处理备忘录和待办事项。',
      appIds:['mail'],
      html:`<p>Mail 的来源列表包括收件箱、草稿、已发送、垃圾邮件、RSS、备忘录和待办事项。</p>
        <h2>添加附件</h2><ol><li>在新邮件窗口中点按“附加”。</li><li>从虚拟磁盘选择一个或多个文件，或从本机导入。</li><li>在附件栏中点按文件可打开，点按移除按钮可删除附件。</li></ol><p>发送仅发生在 Leopard Web 的本地邮箱中，不会向真实地址投递。</p>`,
    },
    {
      id:'system-preferences', category:'自定 Mac', title:'更改系统偏好设置',
      summary:'管理外观、Dock、网络、Bluetooth、声音、辅助功能和其他系统行为。',
      appIds:['sysprefs'],
      html:`<p>从 Apple 菜单选择“系统偏好设置…”。每个面板会立即保存更改。</p><p>涉及摄像头、麦克风、Bluetooth 或屏幕捕捉的设置只会在您主动操作时请求浏览器权限。</p>`,
    },
    {
      id:'app-preferences', category:'自定 Mac', title:'更改应用程序偏好设置',
      summary:'从当前应用程序菜单打开该应用自己的偏好设置。',
      appIds:['safari','mail','textedit','preview','itunes','quicktime','ichat','addressbook','ical','photobooth','dictionary','terminal'],
      html:`<p>选择菜单栏中的应用程序名称，然后选择“偏好设置…”，或按 Command-逗号。应用程序偏好设置与“系统偏好设置”彼此独立，更改会立即生效并保存在浏览器中。</p>`,
    },
    {
      id:'accessibility', category:'辅助功能', title:'使用 VoiceOver 和万能辅助',
      summary:'了解键盘导航、缩放、显示和语音辅助功能。',
      appIds:['sysprefs'],
      html:`<p>打开“系统偏好设置”→“万能辅助”管理 VoiceOver、缩放、显示、键盘和鼠标辅助功能。VoiceOver 实用工具提供详细的语音、导航、网页和声音设置。</p>`,
    },
    {
      id:'browser-permissions', category:'故障排除', title:'管理浏览器硬件权限',
      summary:'解决摄像头、麦克风、Bluetooth 和屏幕捕捉无法使用的问题。',
      appIds:['photobooth','sysprefs','grab'],
      html:`<p>硬件访问必须由明确的按钮点击触发。如果权限被拒绝，请在浏览器地址栏或站点设置中重新允许，然后再次点击对应按钮。</p><ul><li>Photo Booth：摄像头</li><li>声音输入：麦克风</li><li>Bluetooth：附近设备</li><li>抓图：屏幕共享</li></ul>`,
    },
  ];

  const helpEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));

  function appHelpArticle(appId) {
    const app = apps[appId];
    if (!app || appId === 'helpviewer') return null;
    const profile = appPreferenceProfile(appId);
    const preferenceText = profile
      ? `<h2>偏好设置</h2><p>按 Command-逗号打开 ${helpEscape(app.name)} 偏好设置。可用面板：${profile.tabs.map((tab) => helpEscape(tab.label)).join('、')}。</p>`
      : '';
    return {
      id:`app-${appId}`, category:'应用程序', title:`${app.name} 帮助`,
      summary:app.about || `了解如何使用 ${app.name}。`, appIds:[appId],
      html:`${preferenceText}<h2>常用操作</h2><p>从菜单栏的“文件”“编辑”“窗口”和“帮助”菜单访问完整命令。可用的快捷键显示在菜单项目右侧。</p>`,
    };
  }

  function openHelpViewer(arg) {
    arg = arg || {};
    const existing = apps.helpviewer?.windows.at(-1);
    if (existing?.isConnected && existing._openHelp) {
      existing._openHelp(arg);
      restoreWindow(existing);
      focusWindow(existing);
      setActiveApp('helpviewer');
      return existing;
    }
    const requestedAppId = apps[arg.appId] ? arg.appId : 'finder';
    const root = el('div', 'help-viewer');
    const toolbar = el('div', 'help-toolbar');
    const back = el('button', 'finder-toolbar-btn', '◀');
    back.title = '后退';
    const forward = el('button', 'finder-toolbar-btn', '▶');
    forward.title = '前进';
    const home = el('button', 'finder-toolbar-btn help-home-button', '⌂ 首页');
    const search = el('input', 'aqua-input aqua-search help-search');
    search.placeholder = '搜索 Mac 帮助';
    search.setAttribute('aria-label', '搜索 Mac 帮助');
    toolbar.append(back, forward, home, search);
    const sidebar = el('aside', 'help-sidebar');
    const content = el('main', 'help-content');
    root.append(sidebar, content);
    let history = [];
    let historyIndex = -1;
    let scopeAppId = requestedAppId;

    const articles = () => {
      const generated = appHelpArticle(scopeAppId);
      return generated ? [generated, ...HELP_ARTICLES] : HELP_ARTICLES.slice();
    };
    const articleById = (id) => articles().find((article) => article.id === id);
    const updateNav = () => {
      back.disabled = historyIndex <= 0;
      forward.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
    };
    const renderSidebar = (selectedId) => {
      const app = apps[scopeAppId] || apps.finder;
      const grouped = new Map();
      articles().forEach((article) => {
        if (!grouped.has(article.category)) grouped.set(article.category, []);
        grouped.get(article.category).push(article);
      });
      sidebar.innerHTML = `<header>${app.icon}<div><b>${helpEscape(app.name)} 帮助</b><small>Mac OS X 10.5</small></div></header>`;
      grouped.forEach((items, category) => {
        const heading = el('h3', '', helpEscape(category));
        sidebar.appendChild(heading);
        items.forEach((article) => {
          const button = el('button', article.id === selectedId ? 'sel' : '');
          button.dataset.helpArticle = article.id;
          button.textContent = article.title;
          sidebar.appendChild(button);
        });
      });
    };
    const pushState = (state) => {
      history = history.slice(0, historyIndex + 1);
      history.push(state);
      historyIndex = history.length - 1;
      updateNav();
    };
    const showHome = (push = true) => {
      if (push) pushState({ type:'home', appId:scopeAppId });
      const app = apps[scopeAppId] || apps.finder;
      renderSidebar('');
      const relevant = articles().filter((article) => article.appIds?.includes(scopeAppId) || article.id === 'welcome').slice(0, 8);
      content.innerHTML = `<article class="help-home"><header>${app.icon}<div><span>MAC 帮助</span><h1>${helpEscape(app.name)} 帮助</h1><p>${helpEscape(app.about || '查找答案、学习功能并解决问题。')}</p></div></header>
        <section class="help-topic-grid">${relevant.map((article) => `<button data-help-article="${article.id}"><b>${helpEscape(article.title)}</b><span>${helpEscape(article.summary)}</span></button>`).join('')}</section>
        <footer>提示：按 Command-? 可以随时打开当前应用程序的帮助。</footer></article>`;
      content.scrollTop = 0;
    };
    const showArticle = (id, push = true) => {
      const article = articleById(id) || articleById(`app-${scopeAppId}`) || HELP_ARTICLES[0];
      if (push) pushState({ type:'article', id:article.id, appId:scopeAppId });
      renderSidebar(article.id);
      content.innerHTML = `<article class="help-article"><nav>Mac 帮助 › ${helpEscape(article.category)}</nav><h1>${helpEscape(article.title)}</h1><p class="help-summary">${helpEscape(article.summary)}</p>${article.html}
        <footer><button class="aqua-btn" data-help-home>返回 ${helpEscape(apps[scopeAppId]?.name || 'Mac')} 帮助首页</button></footer></article>`;
      content.scrollTop = 0;
    };
    const showSearch = (query, push = true) => {
      const normalized = String(query || '').trim().toLocaleLowerCase('zh-CN');
      if (!normalized) return showHome(push);
      if (push) pushState({ type:'search', query, appId:scopeAppId });
      const matches = articles().filter((article) =>
        `${article.title} ${article.summary} ${article.category} ${article.html.replace(/<[^>]+>/g, ' ')}`
          .toLocaleLowerCase('zh-CN').includes(normalized));
      renderSidebar('');
      content.innerHTML = `<article class="help-results"><nav>Mac 帮助 › 搜索</nav><h1>“${helpEscape(query)}”的搜索结果</h1><p>找到 ${matches.length} 个主题。</p>
        <section>${matches.map((article) => `<button data-help-article="${article.id}"><b>${helpEscape(article.title)}</b><span>${helpEscape(article.summary)}</span><small>${helpEscape(article.category)}</small></button>`).join('') || '<div class="help-no-results">没有找到匹配的帮助主题。请尝试较短的关键词。</div>'}</section></article>`;
      content.scrollTop = 0;
    };
    const renderState = (state) => {
      if (!state) return;
      scopeAppId = apps[state.appId] ? state.appId : scopeAppId;
      if (state.type === 'article') showArticle(state.id, false);
      else if (state.type === 'search') showSearch(state.query, false);
      else showHome(false);
      updateNav();
    };

    sidebar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-help-article]');
      if (button) showArticle(button.dataset.helpArticle);
    });
    content.addEventListener('click', (event) => {
      const article = event.target.closest('[data-help-article]');
      if (article) showArticle(article.dataset.helpArticle);
      else if (event.target.closest('[data-help-home]')) showHome();
    });
    home.addEventListener('click', () => showHome());
    back.addEventListener('click', () => {
      if (historyIndex <= 0) return;
      historyIndex--;
      renderState(history[historyIndex]);
    });
    forward.addEventListener('click', () => {
      if (historyIndex >= history.length - 1) return;
      historyIndex++;
      renderState(history[historyIndex]);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') showSearch(search.value);
      else if (event.key === 'Escape' && search.value) {
        search.value = '';
        showHome();
      }
    });

    const win = createWindow({
      app:'helpviewer', title:'Mac 帮助', width:850, height:610,
      toolbar, content:root, bodyBg:'#fff',
    });
    win.classList.add('help-viewer-window');
    win._openHelp = (nextArg) => {
      scopeAppId = apps[nextArg?.appId] ? nextArg.appId : scopeAppId;
      search.value = '';
      if (nextArg?.query) {
        search.value = nextArg.query;
        showSearch(nextArg.query);
      } else if (nextArg?.topic === 'preferences') {
        showArticle('app-preferences');
      } else {
        const generated = appHelpArticle(scopeAppId);
        showArticle(generated?.id || 'welcome');
      }
      if (nextArg?.focusSearch) requestAnimationFrame(() => { search.focus(); search.select(); });
    };
    win.addEventListener('leopard-command', (event) => {
      const actions = {
        'back':() => back.click(),
        'forward':() => forward.click(),
        'help-home':() => home.click(),
        'help-search':() => { search.focus(); search.select(); },
      };
      const action = actions[event.detail?.command];
      if (action) {
        event.preventDefault();
        action();
      }
    });
    win._openHelp(arg);
    return win;
  }

  function installBuiltInApps() {
    if (!apps.helpviewer) {
      registerApp({
        id:'helpviewer', name:'Help Viewer', icon:helpViewerIcon,
        open:openHelpViewer, multiWindow:false,
        about:'Mac OS X Leopard 帮助查看器：应用帮助、目录、全文搜索以及前进和后退导航。',
        keywords:'help viewer mac 帮助 使用手册',
      });
    }
  }

  function helpMenu(appId) {
    const app = apps[appId];
    return { title: '帮助', items: [
      { label: `${app ? app.name : ''} 帮助`, shortcut:'⌘?', action: () => launch('helpviewer', { appId }) },
      { sep:true },
      { label:'搜索', action:() => launch('helpviewer', { appId, focusSearch:true }) },
    ]};
  }

  const extraMenu = (appId, title, entries) => ({
    title,
    items: entries.map((entry) => entry.sep ? entry : cmd(appId, entry.label, entry.command, entry.shortcut, entry)),
  });

  function profiledMenus(appId) {
    if (appId === 'helpviewer') return [
      { title:'文件', items:[
        cmd(appId,'关闭窗口','close-window','⌘W'),
      ]},
      editMenu(appId),
      extraMenu(appId,'前往',[
        { label:'后退', command:'back', shortcut:'⌘[' },
        { label:'前进', command:'forward', shortcut:'⌘]' },
        { sep:true },
        { label:'帮助首页', command:'help-home', shortcut:'⌘⇧H' },
        { label:'搜索 Mac 帮助', command:'help-search', shortcut:'⌘F' },
      ]),
      windowMenu(appId), helpMenu(appId),
    ];
    if (appId === 'safari') return [
      { title: '文件', items: [
        cmd(appId, '新建窗口', 'new-window', '⌘N'), cmd(appId, '新建标签页', 'new-tab', '⌘T'),
        cmd(appId, '打开位置…', 'open-location', '⌘L'), { sep: true },
        cmd(appId, '关闭标签页', 'close-tab', '⌘W'), cmd(appId, '关闭窗口', 'close-window', '⇧⌘W'),
      ]},
      editMenu(appId),
      extraMenu(appId, '显示', [
        { label:'停止', command:'stop', shortcut:'⌘.' }, { label:'重新载入页面', command:'reload', shortcut:'⌘R' },
        { sep:true }, { label:'放大', command:'zoom-in', shortcut:'⌘+' },
        { label:'缩小', command:'zoom-out', shortcut:'⌘-' }, { label:'实际大小', command:'actual-size', shortcut:'⌘0' },
      ]),
      extraMenu(appId, '历史记录', [
        { label:'后退', command:'back', shortcut:'⌘[' }, { label:'前进', command:'forward', shortcut:'⌘]' },
        { sep:true }, { label:'显示所有历史记录', command:'show-history' },
      ]),
      extraMenu(appId, '书签', [
        { label:'添加书签…', command:'add-bookmark', shortcut:'⌘D' },
        { label:'显示所有书签', command:'show-bookmarks', shortcut:'⌥⌘B' },
      ]),
      windowMenu(appId), helpMenu(appId),
    ];
    if (appId === 'textedit') {
      const documentWindow = topWindowOf('textedit');
      const recentDocuments = getRecentItems().documents.filter((entry) => !entry.appId || entry.appId === 'textedit');
      const richDocument = documentWindow?.dataset.texteditRich !== 'false';
      const spellcheck = documentWindow?.dataset.texteditSpellcheck !== 'false';
      return [
        { title:'文件', items:[
          cmd(appId,'新建','new-window','⌘N'), cmd(appId,'打开…','open-document','⌘O'),
          { label:'打开最近使用的文稿', submenu:recentDocuments.length
            ? recentDocuments.map((entry) => ({ label:VFS.baseName(entry.path), action:() => openRecentDocument(entry) }))
            : [{ label:'没有最近使用的文稿', disabled:true }] },
          { sep:true },
          cmd(appId,'存储','save','⌘S', { disabled:!documentWindow || (!documentWindow._documentDirty && !!documentWindow._path) }),
          cmd(appId,'存储为…','save-as','⇧⌘S', { disabled:!documentWindow }),
          cmd(appId,'复原到上次存储的版本…','revert-document',null, {
            disabled:!documentWindow?._path || !documentWindow?._documentDirty,
          }),
          { sep:true }, cmd(appId,'关闭窗口','close-window','⌘W', { disabled:!documentWindow }),
        ]},
        { title:'编辑', items:[
          cmd(appId,'撤销','undo','⌘Z'),cmd(appId,'重做','redo','⇧⌘Z'),
          { sep:true },
          cmd(appId,'剪切','cut','⌘X'),cmd(appId,'拷贝','copy','⌘C'),
          cmd(appId,'粘贴','paste','⌘V'),cmd(appId,'删除','delete','⌫'),
          { sep:true },cmd(appId,'全选','selectAll','⌘A'),
          { sep:true },cmd(appId,'查找与替换…','find-text','⌘F'),
        ]},
        { title:'格式', items:[
          { label:'字体', submenu:[
            cmd(appId,'显示字体','show-fonts','⌘T'),
            { sep:true },
            cmd(appId,'粗体','bold','⌘B'), cmd(appId,'斜体','italic','⌘I'),
            cmd(appId,'下划线','underline','⌘U'),cmd(appId,'删除线','strikeThrough','⇧⌘X'), { sep:true },
            cmd(appId,'放大字体','bigger','⌘+'), cmd(appId,'缩小字体','smaller','⌘-'),
          ]},
          { label:'文本', submenu:[
            cmd(appId,'左对齐','justifyLeft'),
            cmd(appId,'居中','justifyCenter'),
            cmd(appId,'右对齐','justifyRight'),
            { sep:true },
            cmd(appId,'项目列表','insertUnorderedList','⇧⌘L'),
            cmd(appId,'增加缩进','indent','⌘]'),
            cmd(appId,'减少缩进','outdent','⌘['),
          ]},
          cmd(appId,'添加链接…','insert-link','⌘K',{disabled:!richDocument}),
          { sep:true },
          cmd(appId,richDocument?'转换为纯文本':'转换为多信息文本',richDocument?'make-plain':'make-rich','⇧⌘T'),
          { sep:true },
          cmd(appId, documentWindow?.querySelector('.te-ruler')?.classList.contains('hidden') ? '显示标尺' : '隐藏标尺', 'toggle-ruler', '⌘R'),
          cmd(appId,'键入时检查拼写','toggle-spelling',null,{checked:spellcheck}),
        ]},
        windowMenu(appId), helpMenu(appId),
      ];
    }
    if (appId === 'preview') return [
      { title:'文件', items:[
        cmd(appId,'打开…','open-document','⌘O'), { sep:true },
        cmd(appId,'关闭窗口','close-window','⌘W'), cmd(appId,'存储为…','save-as','⇧⌘S'),
      ]},
      editMenu(appId),
      extraMenu(appId, '显示', [
        { label:'缩略图', command:'toggle-sidebar', shortcut:'⇧⌘D' },
        { sep:true }, { label:'放大', command:'zoom-in', shortcut:'⌘+' },
        { label:'缩小', command:'zoom-out', shortcut:'⌘-' }, { label:'实际大小', command:'actual-size', shortcut:'⌘0' },
        { label:'适合窗口', command:'zoom-fit', shortcut:'⌘9' },
      ]),
      extraMenu(appId, '前往', [{ label:'上一页', command:'previous-page' }, { label:'下一页', command:'next-page' }]),
      extraMenu(appId, '工具', [
        { label:'向左旋转', command:'rotate-left', shortcut:'⌘L' },
        { label:'向右旋转', command:'rotate-right', shortcut:'⌘R' },
        { label:'显示检查器', command:'show-inspector', shortcut:'⌘I' },
      ]),
      windowMenu(appId), helpMenu(appId),
    ];
    if (appId === 'ical') {
      const calendarWindow = topWindowOf('ical');
      const view = calendarWindow?.dataset.icalView || 'month';
      const todoVisible = calendarWindow?.dataset.icalTodoVisible === 'true';
      const eventSelected = calendarWindow?.dataset.icalEventSelected === 'true';
      const canDeleteCalendar = calendarWindow?.dataset.icalCanDeleteCalendar === 'true';
      const hasEvents = calendarWindow?.dataset.icalHasEvents === 'true';
      return [
        { title:'文件', items:[
          cmd(appId,'新建事件','new-event','⌘N'),
          cmd(appId,'新建待办事项','new-todo','⇧⌘N'),
          cmd(appId,'新建日历','new-calendar','⌥⌘N'),
          cmd(appId,'订阅…','subscribe-calendar','⌥⌘S'),
          { sep:true },
          cmd(appId,'导入…','import-ics','⇧⌘I'),
          cmd(appId,'导出…','export-ics','⇧⌘E',{disabled:!hasEvents}),
          { sep:true }, cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        extraMenu(appId, '显示', [
          { label:'日', command:'day-view', shortcut:'⌘1', checked:view === 'day' },
          { label:'周', command:'week-view', shortcut:'⌘2', checked:view === 'week' },
          { label:'月', command:'month-view', shortcut:'⌘3', checked:view === 'month' },
          { sep:true },
          { label:'前往今天', command:'today', shortcut:'⌘T' },
          { label:todoVisible ? '隐藏待办事项' : '显示待办事项', command:'toggle-todos', shortcut:'⌥⌘T', checked:todoVisible },
          { label:'搜索', command:'focus-search', shortcut:'⌘F' },
        ]),
        extraMenu(appId, '日历', [
          { label:'刷新全部', command:'refresh', shortcut:'⌘R' },
          { label:'订阅…', command:'subscribe-calendar' },
          { sep:true },
          { label:'导入…', command:'import-ics' },
          { label:'导出…', command:'export-ics', disabled:!hasEvents },
          { sep:true },
          { label:'删除日历', command:'delete-calendar', disabled:!canDeleteCalendar },
        ]),
        extraMenu(appId, '事件', [
          { label:'显示事件简介', command:'event-info', shortcut:'⌘I', disabled:!eventSelected },
          { label:'编辑事件…', command:'edit-event', shortcut:'⌘E', disabled:!eventSelected },
          { label:'复制事件', command:'duplicate-event', disabled:!eventSelected },
          { sep:true },
          { label:'添加附件…', command:'attach-event', disabled:!eventSelected },
          { label:'显示可用性…', command:'event-availability', disabled:!eventSelected },
          { sep:true },
          { label:'删除事件', command:'delete-event', shortcut:'⌫', disabled:!eventSelected },
        ]),
        windowMenu(appId), helpMenu(appId),
      ];
    }
    if (appId === 'mail') return [
      { title:'文件', items:[
        cmd(appId,'新邮件','new-message','⌘N'), cmd(appId,'打开…','open-document','⌘O'),
        { sep:true }, cmd(appId,'关闭窗口','close-window','⌘W'),
      ]},
      editMenu(appId),
      extraMenu(appId,'显示',[
        {label:'收取所有新邮件',command:'get-mail',shortcut:'⇧⌘N'},
      ]),
      extraMenu(appId,'邮箱',[
        {label:'收取新邮件',command:'get-mail',shortcut:'⌘K'},
      ]),
      extraMenu(appId,'邮件',[
        {label:'回复',command:'reply-message',shortcut:'⌘R'},
        {label:'转发',command:'forward-message',shortcut:'⇧⌘F'},
        {sep:true},{label:'移到废纸篓',command:'delete',shortcut:'⌫'},
      ]),
      extraMenu(appId,'格式',[
        {label:'显示字体',command:'show-fonts',shortcut:'⌘T',disabled:!topWindowOf('mail')?.querySelector('.mail-compose-body')},
        {sep:true},
        {label:'粗体',command:'bold',shortcut:'⌘B',disabled:!topWindowOf('mail')?.querySelector('.mail-compose-body')},
        {label:'斜体',command:'italic',shortcut:'⌘I',disabled:!topWindowOf('mail')?.querySelector('.mail-compose-body')},
      ]),
      windowMenu(appId),helpMenu(appId),
    ];
    if (appId === 'addressbook') return [
      { title:'文件', items:[
        cmd(appId,'新建名片','new-contact','⌘N'),
        {sep:true},cmd(appId,'关闭窗口','close-window','⌘W'),
      ]},
      editMenu(appId),
      extraMenu(appId,'显示',[{label:'显示名片',command:'show-card',shortcut:'⌘I'}]),
      extraMenu(appId,'名片',[
        {label:'新建名片',command:'new-contact',shortcut:'⌘N'},
        {label:'删除名片',command:'delete',shortcut:'⌫'},
      ]),
      extraMenu(appId,'群组',[
        {label:'新建群组',command:'new-group',shortcut:'⇧⌘N'},
        {label:'删除群组',command:'delete-group',disabled:!topWindowOf('addressbook')?.dataset.addressGroup?.startsWith('group-')},
      ]),
      windowMenu(appId),helpMenu(appId),
    ];

    if (appId === 'ichat') {
      const win = topWindowOf('ichat');
      return [
        { title:'文件', items:[
          cmd(appId,'新建聊天','new-chat','⌘N'), cmd(appId,'新建好友列表','new-window','⇧⌘N'),
          { sep:true }, cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        extraMenu(appId,'显示',[
          {label:'显示好友图片',command:'toggle-buddy-pictures',checked:win?.dataset.buddyPictures !== 'false'},
          {label:'显示离线好友',command:'toggle-offline-buddies',checked:win?.dataset.showOffline === 'true'},
        ]),
        extraMenu(appId,'好友',[
          {label:'添加好友…',command:'add-buddy',shortcut:'⌘B'},
          {label:'显示好友信息',command:'buddy-info',shortcut:'⌘I'},
        ]),
        extraMenu(appId,'视频',[
          {label:'开始视频聊天',command:'video-chat'},
          {label:'开始音频聊天',command:'audio-chat'},
          {label:'共享我的屏幕…',command:'screen-share'},
        ]),
        windowMenu(appId), helpMenu(appId),
      ];
    }
    if (appId === 'dictionary') {
      const win = topWindowOf('dictionary');
      const tab = win?.dataset.dictionaryTab || 'definition';
      const historyCount = Number(win?.dataset.dictionaryHistory || 0);
      return [
        { title:'文件', items:[
          cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'拷贝词条','copy','⌘C'),
          { sep:true },cmd(appId,'查找…','focus-search','⌘F'),
        ]},
        { title:'前往', items:[
          cmd(appId,'上一个查询','history-back','⌘[',{disabled:historyCount<2}),
          { sep:true },cmd(appId,'清除最近查询','clear-history',null,{disabled:historyCount===0}),
        ]},
        { title:'词典', items:[
          cmd(appId,'词典','source-dictionary',null,{checked:tab==='definition'}),
          cmd(appId,'同义词','source-thesaurus',null,{checked:tab==='thesaurus'}),
          cmd(appId,'Apple','source-apple',null,{checked:tab==='apple'}),
          cmd(appId,'Wikipedia','source-wikipedia',null,{checked:tab==='wikipedia'}),
          { sep:true },cmd(appId,'朗读词条','pronounce','⌘L'),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'photobooth') {
      const win = topWindowOf('photobooth');
      const cameraOn = win?.dataset.photoBoothCamera === 'true';
      const selected = win?.dataset.photoBoothSelection === 'true';
      const capturing = win?.dataset.photoBoothCapturing === 'true';
      const effect = win?.dataset.photoBoothEffect || '';
      const mirrored = win?.dataset.photoBoothMirrored !== 'false';
      return [
        { title:'文件', items:[
          cmd(appId,'打开所选照片','open-selected-photo','⌘O',{disabled:!selected}),
          cmd(appId,'在 Finder 中显示','reveal-selected-photo',null,{disabled:!selected}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'将所选照片移到废纸篓','delete-selected-photo','⌫',{disabled:!selected||capturing}),
        ]},
        { title:'显示', items:[
          cmd(appId,'镜像预览','toggle-mirror-preview',null,{checked:mirrored}),
        ]},
        { title:'摄像头', items:[
          cmd(appId,cameraOn?'关闭摄像头':'开启摄像头','toggle-camera',null,{disabled:capturing}),
          cmd(appId,'拍照','take-photo','Space',{disabled:!cameraOn||capturing}),
          { sep:true },
          cmd(appId,'显示效果…','show-effects'),
          cmd(appId,'正常','effect-normal',null,{checked:effect===''}),
          cmd(appId,'黑白','effect-mono',null,{checked:effect==='grayscale(1)'}),
          cmd(appId,'棕褐','effect-sepia',null,{checked:effect==='sepia(1)'}),
          cmd(appId,'彩色铅笔','effect-pencil',null,{checked:effect==='hue-rotate(120deg) saturate(1.7)'}),
          cmd(appId,'流行艺术','effect-pop',null,{checked:effect==='contrast(2) saturate(2)'}),
          cmd(appId,'X 射线','effect-xray',null,{checked:effect==='invert(1)'}),
        ]},
        { title:'照片', items:[
          cmd(appId,'在预览中打开','open-selected-photo',null,{disabled:!selected}),
          cmd(appId,'在 Finder 中显示','reveal-selected-photo',null,{disabled:!selected}),
          cmd(appId,'移到废纸篓','delete-selected-photo','⌫',{disabled:!selected||capturing}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'itunes') {
      const win = topWindowOf('itunes');
      return [
        { title:'文件', items:[
          cmd(appId,'新建播放列表…','new-playlist','⌘N'),
          cmd(appId,'删除播放列表','delete-playlist',null,{disabled:!win?.dataset.currentPlaylist}),
          {sep:true},cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        extraMenu(appId,'显示',[
          {label:win?.dataset.browserHidden === 'true' ? '显示浏览器' : '隐藏浏览器',command:'toggle-browser',shortcut:'⌘B'},
          {label:win?.dataset.sidebarHidden === 'true' ? '显示来源列表' : '隐藏来源列表',command:'toggle-source-list'},
        ]),
        extraMenu(appId,'控制',[
          {label:'播放/暂停',command:'play-pause',shortcut:'Space'},
          {label:'上一首',command:'previous-track',shortcut:'⌘←'},
          {label:'下一首',command:'next-track',shortcut:'⌘→'},
          {sep:true},
          {label:'随机播放',command:'toggle-shuffle',checked:win?.dataset.shuffle === 'true'},
          {label:'重复当前歌曲',command:'toggle-repeat-one',checked:win?.dataset.repeatOne === 'true'},
        ]),
        extraMenu(appId,'Store',[
          {label:'iTunes Store 主页',command:'store-home',shortcut:'⌘H'},
          {label:'检查可用的下载项目…',command:'check-downloads'},
        ]),
        extraMenu(appId,'高级',[
          {label:'打开均衡器…',command:'show-equalizer',shortcut:'⌘2'},
          {label:'获取专辑插图',command:'get-artwork'},
        ]),
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'automator') {
      const win = topWindowOf('automator');
      const running = win?.dataset.automatorRunning === 'true';
      const hasSteps = win?.dataset.automatorHasSteps === 'true';
      const hasSelection = win?.dataset.automatorSelection === 'true';
      return [
        { title:'文件', items:[
          cmd(appId,'新建工作流程','new-workflow','⌘N'),
          cmd(appId,'打开…','open-document','⌘O'),
          { sep:true },
          cmd(appId,'存储','save','⌘S',{disabled:running}),
          cmd(appId,'存储为…','save-as','⇧⌘S',{disabled:running}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'移除操作','remove-action','⌫',{disabled:running||!hasSelection}),
          { sep:true },cmd(appId,'搜索操作','focus-search','⌘F'),
        ]},
        { title:'工作流程', items:[
          cmd(appId,'运行','run-workflow','⌘R',{disabled:running||!hasSteps}),
          cmd(appId,'停止','stop-workflow','⌘.',{disabled:!running}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'calculator') {
      const win = topWindowOf('calculator');
      const mode = win?.dataset.calculatorMode || 'basic';
      const tapeVisible = win?.dataset.calculatorTape === 'true';
      const hasTape = win?.dataset.calculatorHasTape === 'true';
      const rpn = win?.dataset.calculatorRpn === 'true';
      const grouping = win?.dataset.calculatorGrouping !== 'false';
      const speechKeys = win?.dataset.calculatorSpeechKeys === 'true';
      const speechResults = win?.dataset.calculatorSpeechResults === 'true';
      const decimals = win?.dataset.calculatorDecimals || 'auto';
      return [
        { title:'文件', items:[
          cmd(appId,'存储纸带为…','save-paper-tape','⇧⌘S',{disabled:!hasTape}),
          cmd(appId,'打印纸带…','print-paper-tape','⌘P',{disabled:!hasTape}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'拷贝显示值','copy-result','⌘C'),
          cmd(appId,'粘贴数字','paste-number','⌘V'),
          { sep:true },cmd(appId,'清除','clear-calculator','⌘K'),
        ]},
        { title:'显示', items:[
          cmd(appId,'基本','mode-basic','⌘1',{checked:mode==='basic'}),
          cmd(appId,'科学型','mode-scientific','⌘2',{checked:mode==='scientific'}),
          cmd(appId,'程序员','mode-programmer','⌘3',{checked:mode==='programmer'}),
          { sep:true },
          cmd(appId,tapeVisible?'隐藏纸带':'显示纸带','toggle-paper-tape','⌘T'),
          cmd(appId,'RPN 模式','toggle-rpn','⌘R',{checked:rpn,disabled:mode==='programmer'}),
          cmd(appId,'显示千位分隔符','toggle-grouping',null,{checked:grouping}),
          { label:'小数位数', submenu:[
            cmd(appId,'自动','decimals-auto',null,{checked:decimals==='auto'}),
            cmd(appId,'0 位','decimals-0',null,{checked:decimals==='0'}),
            cmd(appId,'2 位','decimals-2',null,{checked:decimals==='2'}),
            cmd(appId,'5 位','decimals-5',null,{checked:decimals==='5'}),
            cmd(appId,'9 位','decimals-9',null,{checked:decimals==='9'}),
          ]},
        ]},
        { title:'换算', items:[
          cmd(appId,'长度…','convert-length',null),
          cmd(appId,'面积…','convert-area',null),
          cmd(appId,'体积…','convert-volume',null),
          cmd(appId,'质量…','convert-mass',null),
          cmd(appId,'温度…','convert-temperature',null),
          cmd(appId,'速度…','convert-speed',null),
          cmd(appId,'时间…','convert-time',null),
          cmd(appId,'能量…','convert-energy',null),
          cmd(appId,'功率…','convert-power',null),
          cmd(appId,'压力…','convert-pressure',null),
        ]},
        { title:'语音', items:[
          cmd(appId,'朗读按下的按钮','toggle-speak-keys',null,{checked:speechKeys}),
          cmd(appId,'朗读结果','toggle-speak-results',null,{checked:speechResults}),
          { sep:true },
          cmd(appId,'朗读显示值','speak-result',null),
          cmd(appId,'停止朗读','stop-speaking',null),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'stickies') {
      const win = topWindowOf('stickies');
      const color = win?.dataset.stickyColor || 'yellow';
      const floating = win?.dataset.stickyFloating === 'true';
      const translucent = win?.dataset.stickyTranslucent === 'true';
      const collapsed = win?.dataset.stickyCollapsed === 'true';
      const hasText = win?.dataset.stickyHasText === 'true';
      return [
        { title:'文件', items:[
          cmd(appId,'新便笺','new-sticky','⌘N'),
          cmd(appId,'导入文本…','import-sticky','⌘O'),
          { sep:true },
          cmd(appId,'导出文本…','export-sticky','⌘S',{disabled:!hasText}),
          cmd(appId,'导出所有便笺…','export-all-stickies',null),
          { sep:true },cmd(appId,'关闭便笺','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'撤销','undo','⌘Z'),cmd(appId,'重做','redo','⇧⌘Z'),
          { sep:true },
          cmd(appId,'剪切','cut','⌘X'),cmd(appId,'拷贝','copy','⌘C'),
          cmd(appId,'粘贴','paste','⌘V'),cmd(appId,'删除','delete','⌫'),
          { sep:true },cmd(appId,'全选','selectAll','⌘A'),
          { sep:true },cmd(appId,'查找…','focus-sticky-find','⌘F'),
        ]},
        { title:'便笺', items:[
          cmd(appId,'浮动窗口','toggle-sticky-floating','⌥⌘F',{checked:floating}),
          cmd(appId,'半透明窗口','toggle-sticky-translucent','⌥⌘T',{checked:translucent}),
          cmd(appId,collapsed?'展开':'收起','toggle-sticky-collapsed','⌘M'),
          cmd(appId,'缩放','zoom-sticky',null),
          { sep:true },cmd(appId,'将当前样式用作默认','use-sticky-default',null),
        ]},
        { title:'颜色', items:[
          cmd(appId,'黄色','sticky-color-yellow',null,{checked:color==='yellow'}),
          cmd(appId,'蓝色','sticky-color-blue',null,{checked:color==='blue'}),
          cmd(appId,'绿色','sticky-color-green',null,{checked:color==='green'}),
          cmd(appId,'粉红色','sticky-color-pink',null,{checked:color==='pink'}),
          cmd(appId,'紫色','sticky-color-purple',null,{checked:color==='purple'}),
          cmd(appId,'灰色','sticky-color-gray',null,{checked:color==='gray'}),
        ]},
        { title:'字体', items:[
          cmd(appId,'粗体','sticky-bold','⌘B'),
          cmd(appId,'斜体','sticky-italic','⌘I'),
          cmd(appId,'下划线','sticky-underline','⌘U'),
          cmd(appId,'删除线','sticky-strike','⇧⌘X'),
          cmd(appId,'项目列表','sticky-list','⇧⌘L'),
          { sep:true },
          { label:'字体', submenu:[
            cmd(appId,'Marker Felt','sticky-font-marker',null),
            cmd(appId,'Lucida Grande','sticky-font-lucida',null),
            cmd(appId,'Monaco','sticky-font-monaco',null),
            cmd(appId,'Georgia','sticky-font-georgia',null),
          ]},
          cmd(appId,'放大字体','sticky-font-bigger','⌘+'),
          cmd(appId,'缩小字体','sticky-font-smaller','⌘-'),
        ]},
        { title:'窗口', items:[
          { label:'排列方式', submenu:[
            cmd(appId,'屏幕上的位置','arrange-stickies-screen',null),
            cmd(appId,'颜色','arrange-stickies-color',null),
            cmd(appId,'内容','arrange-stickies-content',null),
            cmd(appId,'修改日期','arrange-stickies-date',null),
          ]},
          cmd(appId,'将所有便笺移到前面','bring-stickies-front',null),
          { sep:true },
          cmd(appId,'收起全部','collapse-all-stickies',null),
          cmd(appId,'展开全部','expand-all-stickies',null),
        ]},
        helpMenu(appId),
      ];
    }
    if (appId === 'activity') {
      const win = topWindowOf('activity');
      const hasSelection = win?.dataset.activityCanInspect === 'true';
      const canQuit = win?.dataset.activityCanQuit === 'true';
      const resource = win?.dataset.activityResource || 'cpu';
      const scope = win?.dataset.activityScope || 'all';
      const sort = win?.dataset.activitySort || 'cpu';
      const rate = Number(win?.dataset.activityUpdateRate || 1000);
      return [
        { title:'文件', items:[
          cmd(appId,'检查进程','inspect-process','⌘I',{disabled:!hasSelection}),
          cmd(appId,'对进程取样','sample-process','⌥⌘S',{disabled:!hasSelection}),
          cmd(appId,'退出进程…','quit-process',null,{disabled:!canQuit}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'查找…','focus-search','⌘F'),
        ]},
        { title:'显示', items:[
          { label:'进程', submenu:[
            cmd(appId,'所有进程','scope-all',null,{checked:scope==='all'}),
            cmd(appId,'我的进程','scope-my',null,{checked:scope==='my'}),
            cmd(appId,'活动进程','scope-active',null,{checked:scope==='active'}),
            cmd(appId,'窗口化进程','scope-windowed',null,{checked:scope==='windowed'}),
          ]},
          { label:'排序方式', submenu:[
            cmd(appId,'进程名称','sort-name',null,{checked:sort==='name'}),
            cmd(appId,'进程 ID','sort-pid',null,{checked:sort==='pid'}),
            cmd(appId,'CPU','sort-cpu',null,{checked:sort==='cpu'}),
            cmd(appId,'实际内存','sort-memory',null,{checked:sort==='memory'}),
          ]},
          { label:'更新频率', submenu:[
            cmd(appId,'非常频繁（0.5 秒）','update-very-often',null,{checked:rate===500}),
            cmd(appId,'频繁（1 秒）','update-often',null,{checked:rate===1000}),
            cmd(appId,'正常（2 秒）','update-normal',null,{checked:rate===2000}),
            cmd(appId,'较慢（5 秒）','update-slow',null,{checked:rate===5000}),
          ]},
          { sep:true },cmd(appId,'立即更新','refresh-now','⌘R'),
        ]},
        { title:'监视器', items:[
          cmd(appId,'CPU','show-cpu','⌘1',{checked:resource==='cpu'}),
          cmd(appId,'系统内存','show-memory','⌘2',{checked:resource==='memory'}),
          cmd(appId,'磁盘活动','show-disk-activity','⌘3',{checked:resource==='diskactivity'}),
          cmd(appId,'磁盘使用情况','show-disk-usage','⌘4',{checked:resource==='diskusage'}),
          cmd(appId,'网络','show-network','⌘5',{checked:resource==='network'}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'fontbook') {
      const win = topWindowOf('fontbook');
      const hasSelection = !!win?.dataset.fontbookSelection;
      const enabled = win?.dataset.fontbookEnabled === 'true';
      const favorite = win?.dataset.fontbookFavorite === 'true';
      const canRemove = win?.dataset.fontbookCanRemove === 'true';
      const canDeleteCollection = win?.dataset.fontbookCanDeleteCollection === 'true';
      const view = win?.dataset.fontbookView || 'sample';
      const collection = win?.dataset.fontbookCollection || 'all';
      return [
        { title:'文件', items:[
          cmd(appId,'添加字体…','install-font','⌘O'),
          cmd(appId,'扫描本机字体…','scan-local-fonts',null),
          { sep:true },
          cmd(appId,'新建收藏集','new-collection','⌘N'),
          cmd(appId,'删除收藏集','delete-collection',null,{disabled:!canDeleteCollection}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'查找…','focus-search','⌘F'),
        ]},
        { title:'显示', items:[
          cmd(appId,'样本','show-sample','⌘1',{checked:view==='sample'}),
          cmd(appId,'字形','show-repertoire','⌘2',{checked:view==='repertoire'}),
          cmd(appId,'自定','show-custom','⌘3',{checked:view==='custom'}),
          cmd(appId,'字体信息','show-font-info','⌘I',{checked:view==='info'}),
          { sep:true },
          cmd(appId,'放大预览','larger-preview','⌘+',{disabled:!hasSelection}),
          cmd(appId,'缩小预览','smaller-preview','⌘-',{disabled:!hasSelection}),
        ]},
        { title:'字体', items:[
          cmd(appId,'验证字体…','validate-font',null,{disabled:!hasSelection}),
          cmd(appId,enabled?'停用字体':'启用字体','toggle-font-enabled',null,{disabled:!hasSelection}),
          cmd(appId,favorite?'从收藏夹移除':'添加到收藏夹','toggle-font-favorite',null,{disabled:!hasSelection}),
          { sep:true },cmd(appId,'移除字体…','remove-font',null,{disabled:!canRemove}),
        ]},
        { title:'收藏集', items:[
          cmd(appId,'所有字体','show-all-fonts',null,{checked:collection==='all'}),
          cmd(appId,'收藏夹','show-favorites',null,{checked:collection==='favorites'}),
          cmd(appId,'电脑','show-computer-fonts',null,{checked:collection==='computer'}),
          cmd(appId,'用户','show-user-fonts',null,{checked:collection==='user'}),
          { sep:true },cmd(appId,'新建收藏集','new-collection','⌘N'),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'netutil') {
      const win = topWindowOf('netutil');
      const busy = win?.dataset.netutilBusy === 'true';
      const canRun = win?.dataset.netutilCanRun === 'true';
      const hasOutput = win?.dataset.netutilHasOutput === 'true';
      const tab = win?.dataset.netutilTab || 'info';
      return [
        { title:'文件', items:[
          cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'拷贝结果','copy-output','⌘C',{disabled:!hasOutput}),
        ]},
        { title:'显示', items:[
          cmd(appId,'信息','show-info','⌘1',{checked:tab==='info',disabled:busy}),
          cmd(appId,'Netstat','show-netstat','⌘2',{checked:tab==='netstat',disabled:busy}),
          cmd(appId,'AppleTalk','show-appletalk','⌘3',{checked:tab==='appletalk',disabled:busy}),
          cmd(appId,'Ping','show-ping','⌘4',{checked:tab==='ping',disabled:busy}),
          cmd(appId,'Lookup','show-lookup','⌘5',{checked:tab==='lookup',disabled:busy}),
          cmd(appId,'Traceroute','show-traceroute','⌘6',{checked:tab==='trace',disabled:busy}),
          cmd(appId,'Whois','show-whois','⌘7',{checked:tab==='whois',disabled:busy}),
          cmd(appId,'Finger','show-finger','⌘8',{checked:tab==='finger',disabled:busy}),
          cmd(appId,'端口扫描','show-portscan','⌘9',{checked:tab==='portscan',disabled:busy}),
        ]},
        { title:'网络工具', items:[
          cmd(appId,'开始','run-current','⌘↩',{disabled:busy||!canRun}),
          cmd(appId,'停止','stop-operation','⌘.',{disabled:!busy}),
          { sep:true },cmd(appId,'刷新接口信息','refresh-info','⌘R',{disabled:busy}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'consoleapp') {
      const win = topWindowOf('consoleapp');
      const selected = !!win?.dataset.consoleSelection;
      const showSources = win?.dataset.consoleShowSources !== 'false';
      const showInspector = win?.dataset.consoleShowInspector === 'true';
      const following = win?.dataset.consoleFollowing !== 'false';
      const hasEntries = win?.dataset.consoleHasEntries === 'true';
      const source = win?.dataset.consoleSource || 'all';
      const level = win?.dataset.consoleLevel || 'all';
      return [
        { title:'文件', items:[
          cmd(appId,'导出日志…','export-log','⌘S',{disabled:!hasEntries}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'拷贝所选信息','copy-entry','⌘C',{disabled:!selected}),
          { sep:true },cmd(appId,'查找…','focus-search','⌘F'),
        ]},
        { title:'显示', items:[
          cmd(appId,showSources?'隐藏日志列表':'显示日志列表','toggle-log-list','⌥⌘L'),
          cmd(appId,showInspector?'隐藏检查器':'显示检查器','toggle-log-inspector','⌘I'),
          cmd(appId,'跟随新信息','toggle-log-follow',null,{checked:following}),
          cmd(appId,'重新载入日志','reload-log','⌘R'),
          { sep:true },
          { label:'日志源', submenu:[
            cmd(appId,'所有信息','source-all',null,{checked:source==='all'}),
            cmd(appId,'所有错误与警告','source-errors',null,{checked:source==='errors'}),
            cmd(appId,'控制台信息','source-console',null,{checked:source==='console'}),
            cmd(appId,'系统信息','source-system',null,{checked:source==='system'}),
          ]},
          { label:'信息级别', submenu:[
            cmd(appId,'所有信息','level-all',null,{checked:level==='all'}),
            cmd(appId,'警告与错误','level-warn',null,{checked:level==='warn'}),
            cmd(appId,'仅错误','level-error',null,{checked:level==='error'}),
          ]},
        ]},
        { title:'操作', items:[
          cmd(appId,'插入标记','insert-marker','⇧⌘M'),
          cmd(appId,'清除显示','clear-display','⌘K',{disabled:!hasEntries}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'migration' || appId === 'bootcamp') {
      const win = topWindowOf(appId);
      const page = win?.dataset.assistantPage || 'welcome';
      const busy = win?.dataset.assistantBusy === 'true';
      const canBack = win?.dataset.assistantCanBack === 'true';
      const canContinue = win?.dataset.assistantCanContinue === 'true';
      const canCancel = win?.dataset.assistantCanCancel === 'true';
      const complete = win?.dataset.assistantComplete === 'true';
      const hasResult = win?.dataset.assistantHasResult === 'true';
      const committed = win?.dataset.assistantCommitted === 'true';
      const media = win?.dataset.bootcampMedia || 'dvd';
      const actionLabel = busy
        ? appId === 'migration' ? '继续传输' : '继续操作'
        : complete ? '完成' : '继续';
      const common = [
        { title:'文件', items:[
          cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'操作', items:[
          cmd(appId,'返回','assistant-back',null,{disabled:!canBack}),
          cmd(appId,actionLabel,'assistant-continue',null,{disabled:!canContinue}),
          cmd(appId,busy?(committed?'正在写入…':'停止'):'取消','assistant-cancel',null,{disabled:!canCancel}),
          ...(appId === 'migration' && complete
            ? [{sep:true},cmd(appId,'开始新的迁移','assistant-restart')]
            : []),
          ...(appId === 'bootcamp' && complete
            ? [{sep:true},cmd(appId,'重新启动并安装 Windows…','bootcamp-restart')]
            : []),
        ]},
      ];
      if (appId === 'bootcamp') common.push({
        title:'Boot Camp',
        items:[
          cmd(appId,'使用 Windows 安装 DVD','bootcamp-use-dvd',null,{checked:media==='dvd',disabled:page!=='media'||busy}),
          cmd(appId,'选择 ISO 映像…','bootcamp-choose-iso',null,{checked:media==='iso',disabled:page!=='media'||busy}),
          {sep:true},
          cmd(appId,'Windows 32 GB','bootcamp-32gb',null,{disabled:page!=='partition'||busy}),
          cmd(appId,'平均分配磁盘','bootcamp-equal',null,{disabled:page!=='partition'||busy}),
        ],
      });
      common.push(
        { title:'结果', items:[
          cmd(appId,'打开操作报告','assistant-open-report',null,{disabled:!hasResult}),
          cmd(appId,'在 Finder 中显示','assistant-reveal-result',null,{disabled:!hasResult}),
        ]},
        windowMenu(appId),helpMenu(appId),
      );
      return common;
    }
    if (appId === 'diskutil') {
      const win = topWindowOf('diskutil');
      const busy = win?.dataset.diskutilBusy === 'true';
      const tab = win?.dataset.diskutilTab || 'firstaid';
      const role = win?.dataset.diskutilRole || 'volume';
      const mounted = win?.dataset.diskutilMounted === 'true';
      const canErase = win?.dataset.diskutilCanErase === 'true';
      const canMount = role !== 'device' && win?.dataset.diskutilSelection !== 'macintosh';
      return [
        { title:'文件', items:[
          cmd(appId,'新建磁盘映像…','new-disk-image','⌘N',{disabled:busy}),
          { sep:true },
          cmd(appId,'显示简介','show-disk-info','⌘I'),
          cmd(appId,'刷新磁盘列表','refresh-storage','⌘R',{disabled:busy}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        { title:'映像', items:[
          cmd(appId,mounted?'推出所选宗卷':'装载所选宗卷','toggle-mount',null,{disabled:busy||!canMount}),
          cmd(appId,'新建空白映像…','new-disk-image',null,{disabled:busy}),
          { sep:true },
          cmd(appId,'显示恢复面板','show-restore',null,{checked:tab==='restore',disabled:busy}),
          cmd(appId,'从 Macintosh HD 建立映像…','restore-image',null,{disabled:busy}),
        ]},
        { title:'急救', items:[
          cmd(appId,'验证磁盘','verify-disk',null,{disabled:busy}),
          cmd(appId,'修复磁盘','repair-disk',null,{disabled:busy}),
          { sep:true },
          cmd(appId,'验证磁盘权限','verify-permissions',null,{disabled:busy}),
          cmd(appId,'修复磁盘权限','repair-permissions',null,{disabled:busy}),
        ]},
        { title:'显示', items:[
          cmd(appId,'急救','show-firstaid',null,{checked:tab==='firstaid',disabled:busy}),
          cmd(appId,'抹掉','show-erase',null,{checked:tab==='erase',disabled:busy}),
          cmd(appId,'分区','show-partition',null,{checked:tab==='partition',disabled:busy}),
          cmd(appId,'RAID','show-raid',null,{checked:tab==='raid',disabled:busy}),
          cmd(appId,'恢复','show-restore',null,{checked:tab==='restore',disabled:busy}),
          { sep:true },
          cmd(appId,'安全性选项…','security-options',null,{disabled:busy||!canErase}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'grab') {
      const win = topWindowOf('grab');
      const hasCapture = win?.dataset.grabHasCapture === 'true';
      const saved = win?.dataset.grabSaved === 'true';
      const busy = win?.dataset.grabBusy === 'true';
      const canCrop = win?.dataset.grabCanCrop === 'true';
      const mode = win?.dataset.grabMode || 'selection';
      return [
        { title:'文件', items:[
          cmd(appId,'存储…','save','⌘S',{disabled:!hasCapture||busy}),
          cmd(appId,'存储为…','save-as','⇧⌘S',{disabled:!hasCapture||busy}),
          { sep:true },
          cmd(appId,'在预览中打开','open-preview',null,{disabled:!hasCapture||busy}),
          cmd(appId,'在 Finder 中显示','reveal-capture',null,{disabled:!saved||busy}),
          cmd(appId,'下载到本地…','download-capture',null,{disabled:!saved||busy}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'复制图像','copy','⌘C',{disabled:!hasCapture||busy}),
        ]},
        { title:'捕捉', items:[
          cmd(appId,'选择区域','capture-selection','⇧⌘A',{disabled:busy,checked:mode==='selection'}),
          cmd(appId,'窗口','capture-window','⇧⌘W',{disabled:busy,checked:mode==='window'}),
          cmd(appId,'屏幕','capture-screen','⌘Z',{disabled:busy,checked:mode==='screen'}),
          cmd(appId,'定时屏幕','capture-timed','⇧⌘Z',{disabled:busy,checked:mode==='timed'}),
          ...(busy?[{sep:true},cmd(appId,'取消捕捉','cancel-capture','Esc')]:[]),
        ]},
        { title:'图像', items:[
          cmd(appId,'使用选择区域','apply-crop',null,{disabled:!canCrop||busy}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'keychain') {
      const win = topWindowOf('keychain');
      const hasSelection = win?.dataset.keychainSelection === 'true';
      const locked = win?.dataset.keychainLocked !== 'false';
      return [
        { title:'文件', items:[
          cmd(appId,'新建密码项目…','new-item','⌘N'),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'删除','delete','⌫',{disabled:!hasSelection}),
          { sep:true },cmd(appId,'查找','focus-search','⌘F'),
        ]},
        { title:'显示', items:[
          cmd(appId,'所有项目','show-all',null),
          cmd(appId,'密码','show-passwords',null),
          cmd(appId,'证书','show-certificates',null),
          { sep:true },cmd(appId,'显示项目简介','show-item-info','⌘I',{disabled:!hasSelection}),
        ]},
        { title:'钥匙串', items:[
          cmd(appId,locked?'解锁钥匙串':'锁定钥匙串','toggle-lock',null),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'imagecapture') {
      const win = topWindowOf('imagecapture');
      const selected = Number(win?.dataset.captureSelection || 0);
      const fileCount = Number(win?.dataset.captureFiles || 0);
      const hasImport = win?.dataset.captureLastImport === 'true';
      return [
        { title:'文件', items:[
          cmd(appId,'从 Finder 添加…','add-vfs-images','⌘O'),
          cmd(appId,'从本机选择…','choose-files','⇧⌘O'),
          { sep:true },
          cmd(appId,'导入所选项目','import-selection','⌘D',{disabled:!selected}),
          cmd(appId,'全部导入','import-all','⌥⌘D',{disabled:!fileCount}),
          { sep:true },cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        { title:'编辑', items:[
          cmd(appId,'全选','selectAll','⌘A',{disabled:!fileCount}),
          cmd(appId,'移除所选项目','delete','⌫',{disabled:!selected}),
        ]},
        { title:'图像', items:[
          cmd(appId,'预览','preview-selection','Space',{disabled:!selected}),
          { sep:true },
          cmd(appId,'向左旋转','rotate-left','⌘L',{disabled:!selected}),
          cmd(appId,'向右旋转','rotate-right','⌘R',{disabled:!selected}),
        ]},
        { title:'设备', items:[
          {label:'在 Photo Booth 中使用 iSight',action:()=>launch('photobooth')},
          cmd(appId,'在 Finder 中显示上次导入','reveal-imports',null,{disabled:!hasImport}),
        ]},
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'dvdplayer') {
      const win = topWindowOf('dvdplayer');
      const playing = win?.dataset.dvdPlaying === 'true';
      const menuVisible = win?.dataset.dvdMenu === 'true';
      const chapter = Number(win?.dataset.dvdChapter || 1);
      const subtitle = win?.dataset.dvdSubtitle || '简体中文';
      const audio = win?.dataset.dvdAudio || 'English — Dolby Digital 5.1';
      return [
        {title:'文件',items:[
          cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        extraMenu(appId,'控制',[
          {label:playing&&!menuVisible?'暂停':'播放',command:'play-pause',shortcut:'Space'},
          {label:menuVisible?'返回影片':'显示 DVD 菜单',command:'show-disc-menu',shortcut:'Esc'},
          {sep:true},
          {label:'上一章节',command:'previous-chapter',shortcut:'←'},
          {label:'下一章节',command:'next-chapter',shortcut:'→'},
        ]),
        extraMenu(appId,'前往',[
          {label:'第 1 章 — 序幕：星际启动',command:'chapter-1',checked:chapter===1},
          {label:'第 2 章 — Aqua 世界',command:'chapter-2',checked:chapter===2},
          {label:'第 3 章 — 重返 Leopard',command:'chapter-3',checked:chapter===3},
        ]),
        extraMenu(appId,'字幕',[
          {label:'关闭',command:'subtitles-off',checked:subtitle==='关闭'},
          {label:'简体中文',command:'subtitles-zh',checked:subtitle==='简体中文'},
          {label:'English',command:'subtitles-en',checked:subtitle==='English'},
        ]),
        extraMenu(appId,'音频',[
          {label:'English — Dolby Digital 5.1',command:'audio-en',checked:audio==='English — Dolby Digital 5.1'},
          {label:'日本語 — Dolby Digital 2.0',command:'audio-ja',checked:audio==='日本語 — Dolby Digital 2.0'},
          {label:'音乐与效果',command:'audio-effects',checked:audio==='音乐与效果'},
        ]),
        windowMenu(appId),helpMenu(appId),
      ];
    }
    if (appId === 'quicktime') {
      const win = topWindowOf('quicktime');
      const recentMovies = getRecentItems().documents.filter((entry) => !entry.appId || entry.appId === 'quicktime');
      return [
        {title:'文件',items:[
          cmd(appId,'打开文件…','open-document','⌘O'),
          { label:'打开最近使用的影片', submenu:recentMovies.length
            ? recentMovies.map((entry)=>({label:VFS.baseName(entry.path),action:()=>openRecentDocument(entry)}))
            : [{label:'没有最近使用的影片',disabled:true}] },
          cmd(appId,'新建播放器','new-window','⌘N'),
          {sep:true},cmd(appId,'关闭窗口','close-window','⌘W'),
        ]},
        editMenu(appId),
        extraMenu(appId,'显示',[
          {label:'一半大小',command:'half-size',shortcut:'⌘0'},
          {label:'实际大小',command:'actual-size',shortcut:'⌘1'},
          {label:'两倍大小',command:'double-size',shortcut:'⌘2'},
          {label:'适合窗口',command:'fit-screen',shortcut:'⌘3'},
        ]),
        extraMenu(appId,'影片',[
          {label:'播放/暂停',command:'play-pause',shortcut:'Space'},
          {label:'回到开头',command:'go-beginning'},
          {label:'前往结尾',command:'go-end'},
          {sep:true},
          {label:'循环播放',command:'toggle-loop',checked:win?.dataset.loop === 'true'},
          {label:'显示影片简介',command:'show-inspector',shortcut:'⌘I'},
        ]),
        windowMenu(appId),helpMenu(appId),
      ];
    }
    return null;
  }

  // ---------- Menu bar ----------
  const defaultMenus = (appId) => {
    const app = apps[appId];
    return [
      { title: '文件', items: [
        cmd(appId, '新建窗口', 'new-window', '⌘N'),
        cmd(appId, '打开…', 'open-document', '⌘O'),
        { sep: true }, cmd(appId, '关闭窗口', 'close-window', '⌘W'),
      ]},
      editMenu(appId), windowMenu(appId), helpMenu(appId),
    ];
  };

  let shortcutsInstalled = false;
  function installShortcutRuntime() {
    if (shortcutsInstalled) return;
    shortcutsInstalled = true;
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.isComposing || !activeApp) return;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      let command = null;
      if (activeApp === 'finder' && !modifier && key === ' ') command = 'quick-look';
      if (activeApp === 'finder' && !modifier && key === 'Backspace') command = 'delete';
      if (activeApp === 'automator' && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'remove-action';
      if ((activeApp === 'keychain' || activeApp === 'imagecapture') && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'delete';
      if ((activeApp === 'itunes' || activeApp === 'quicktime' || activeApp === 'dvdplayer') && !modifier && key === ' '
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'play-pause';
      if (activeApp === 'dvdplayer' && !modifier
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
        if (key === 'ArrowLeft') command = 'previous-chapter';
        else if (key === 'ArrowRight') command = 'next-chapter';
        else if (key === 'Escape') command = 'show-disc-menu';
      }
      if (activeApp === 'imagecapture' && !modifier && key === ' '
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'preview-selection';
      if (activeApp === 'grab' && !modifier && key === 'Escape') command = 'cancel-capture';
      if (activeApp === 'photobooth' && !modifier
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
        if (key === ' ') command = 'take-photo';
        else if (key === 'Backspace') command = 'delete-selected-photo';
      }
      if (activeApp === 'ical' && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'delete-event';
      if (modifier) {
        if (key === '?' || (event.shiftKey && key === '/')) {
          event.preventDefault();
          event.stopPropagation();
          launch('helpviewer', { appId:activeApp });
          return;
        }
        if (key === 'h') {
          if (activeApp === 'helpviewer' && event.shiftKey) command = 'help-home';
          else {
            event.preventDefault();
            event.stopPropagation();
            if (event.altKey) hideOtherApps(activeApp);
            else hideApp(activeApp);
            return;
          }
        }
        if (key === 'q' && activeApp !== 'finder') {
          event.preventDefault();
          event.stopPropagation();
          quitApp(activeApp);
          return;
        }
        if (key === ',') {
          event.preventDefault();
          event.stopPropagation();
          showApplicationPreferences(activeApp);
          return;
        }
        const common = {
          n:'new-window', o:'open-document', s:'save', w:'close-window', m:'minimize',
          z:event.shiftKey ? 'redo' : 'undo', x:'cut', c:'copy', v:'paste', a:'selectAll',
        };
        command = common[key] || command;
        if (event.shiftKey && key === 's') command = 'save-as';
        if (activeApp === 'finder') {
          if (event.shiftKey && key === 'n') command = 'new-folder';
          else if (event.shiftKey && key === 'g') command = 'go-to-folder';
          else if (event.shiftKey && key === 'd') command = 'go-desktop';
          else if (event.shiftKey && key === 'o') command = 'go-documents';
          else if (event.altKey && key === 'l') command = 'go-downloads';
          else if (key === 'k') command = 'connect-server';
          else if (key === 'd') command = 'duplicate';
          else if (key === 'l') command = 'make-alias';
          else if (key === '1') command = 'view-icons';
          else if (key === '2') command = 'view-list';
          else if (key === '3') command = 'view-columns';
          else if (key === '4') command = 'view-cover';
          else if (key === 'j') command = 'view-options';
          else if (key === 'o') command = 'open';
          else if (key === 'i') command = 'get-info';
          else if (key === 'Backspace') command = 'delete';
        } else if (activeApp === 'safari') {
          const safari = { t:'new-tab', l:'open-location', r:'reload', '[':'back', ']':'forward', '0':'actual-size', '+':'zoom-in', '=':'zoom-in', '-':'zoom-out' };
          command = safari[key] || command;
          if (key === 'w') command = event.shiftKey ? 'close-window' : 'close-tab';
        } else if (activeApp === 'helpviewer') {
          if (key === '[') command = 'back';
          else if (key === ']') command = 'forward';
          else if (key === 'f') command = 'help-search';
          else if (event.shiftKey && key === 'h') command = 'help-home';
        } else if (activeApp === 'preview') {
          const preview = { '+':'zoom-in', '=':'zoom-in', '-':'zoom-out', '0':'actual-size', '9':'zoom-fit', l:'rotate-left', r:'rotate-right', i:'show-inspector' };
          command = preview[key] || command;
        } else if (activeApp === 'textedit') {
          const textedit = { b:'bold', i:'italic', u:'underline', t:'show-fonts', r:'toggle-ruler', '+':'bigger', '=':'bigger', '-':'smaller' };
          command = textedit[key] || command;
          if (key === 'f') command = 'find-text';
          else if (key === 'k') command = 'insert-link';
          else if (event.shiftKey && key === 't') command = topWindowOf('textedit')?.dataset.texteditRich === 'false' ? 'make-rich' : 'make-plain';
          else if (event.shiftKey && key === 'x') command = 'strikeThrough';
          else if (event.shiftKey && key === 'l') command = 'insertUnorderedList';
          else if (key === ']') command = 'indent';
          else if (key === '[') command = 'outdent';
        } else if (activeApp === 'ical') {
          if (key === 'n') command = event.shiftKey ? 'new-todo' : (event.altKey ? 'new-calendar' : 'new-event');
          else if (key === '1') command = 'day-view';
          else if (key === '2') command = 'week-view';
          else if (key === '3') command = 'month-view';
          else if (key === 't') command = event.altKey ? 'toggle-todos' : 'today';
          else if (key === 'r') command = 'refresh';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = event.shiftKey ? 'import-ics' : 'event-info';
          else if (key === 'e') command = event.shiftKey ? 'export-ics' : 'edit-event';
        }
        else if (activeApp === 'mail') {
          if (key === 'n') command = 'new-message';
          else if (key === 't') command = 'show-fonts';
          else if (key === 'b') command = 'bold';
          else if (key === 'i') command = 'italic';
        } else if (activeApp === 'addressbook' && key === 'n') command = event.shiftKey ? 'new-group' : 'new-contact';
        else if (activeApp === 'ichat' && key === 'n') command = 'new-chat';
        else if (activeApp === 'dictionary') {
          if (key === 'f') command = 'focus-search';
          else if (key === 'l') command = 'pronounce';
          else if (key === '[') command = 'history-back';
        } else if (activeApp === 'photobooth' && key === 'o') command = 'open-selected-photo';
        else if (activeApp === 'itunes') {
          if (key === 'n') command = 'new-playlist';
          else if (key === 'ArrowLeft') command = 'previous-track';
          else if (key === 'ArrowRight') command = 'next-track';
          else if (key === '2') command = 'show-equalizer';
        } else if (activeApp === 'quicktime') {
          if (key === '0') command = 'half-size';
          else if (key === '1') command = 'actual-size';
          else if (key === '2') command = 'double-size';
          else if (key === '3') command = 'fit-screen';
          else if (key === 'i') command = 'show-inspector';
        } else if (activeApp === 'calculator') {
          if (key === '1') command = 'mode-basic';
          else if (key === '2') command = 'mode-scientific';
          else if (key === '3') command = 'mode-programmer';
          else if (key === 't') command = 'toggle-paper-tape';
          else if (key === 'r') command = 'toggle-rpn';
          else if (key === 'k') command = 'clear-calculator';
          else if (key === 'c') command = 'copy-result';
          else if (key === 'v') command = 'paste-number';
          else if (key === 'p') command = 'print-paper-tape';
          else if (event.shiftKey && key === 's') command = 'save-paper-tape';
        } else if (activeApp === 'stickies') {
          if (key === 'n') command = 'new-sticky';
          else if (key === 'o') command = 'import-sticky';
          else if (key === 's') command = 'export-sticky';
          else if (key === 'f' && event.altKey) command = 'toggle-sticky-floating';
          else if (key === 't' && event.altKey) command = 'toggle-sticky-translucent';
          else if (key === 'f') command = 'focus-sticky-find';
          else if (key === 'm') command = 'toggle-sticky-collapsed';
          else if (key === 'b') command = 'sticky-bold';
          else if (key === 'i') command = 'sticky-italic';
          else if (key === 'u') command = 'sticky-underline';
          else if (event.shiftKey && key === 'x') command = 'sticky-strike';
          else if (event.shiftKey && key === 'l') command = 'sticky-list';
          else if (key === '+' || key === '=') command = 'sticky-font-bigger';
          else if (key === '-') command = 'sticky-font-smaller';
        } else if (activeApp === 'activity') {
          if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'inspect-process';
          else if (event.altKey && key === 's') command = 'sample-process';
          else if (key === 'r') command = 'refresh-now';
          else if (key === '1') command = 'show-cpu';
          else if (key === '2') command = 'show-memory';
          else if (key === '3') command = 'show-disk-activity';
          else if (key === '4') command = 'show-disk-usage';
          else if (key === '5') command = 'show-network';
        } else if (activeApp === 'fontbook') {
          if (key === 'o') command = 'install-font';
          else if (key === 'n') command = 'new-collection';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'show-font-info';
          else if (key === '1') command = 'show-sample';
          else if (key === '2') command = 'show-repertoire';
          else if (key === '3') command = 'show-custom';
          else if (key === '+' || key === '=') command = 'larger-preview';
          else if (key === '-') command = 'smaller-preview';
        } else if (activeApp === 'netutil') {
          if (key === 'c') command = 'copy-output';
          else if (key === 'r') command = 'refresh-info';
          else if (key === 'Enter') command = 'run-current';
          else if (key === '.') command = 'stop-operation';
          else if (key === '1') command = 'show-info';
          else if (key === '2') command = 'show-netstat';
          else if (key === '3') command = 'show-appletalk';
          else if (key === '4') command = 'show-ping';
          else if (key === '5') command = 'show-lookup';
          else if (key === '6') command = 'show-traceroute';
          else if (key === '7') command = 'show-whois';
          else if (key === '8') command = 'show-finger';
          else if (key === '9') command = 'show-portscan';
        } else if (activeApp === 'consoleapp') {
          if (key === 's') command = 'export-log';
          else if (key === 'c') command = 'copy-entry';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'toggle-log-inspector';
          else if (key === 'r') command = 'reload-log';
          else if (key === 'k') command = 'clear-display';
          else if (event.shiftKey && key === 'm') command = 'insert-marker';
          else if (event.altKey && key === 'l') command = 'toggle-log-list';
        } else if (activeApp === 'diskutil') {
          if (key === 'n') command = 'new-disk-image';
          else if (key === 'i') command = 'show-disk-info';
          else if (key === 'r') command = 'refresh-storage';
        } else if (activeApp === 'automator') {
          if (key === 'n') command = 'new-workflow';
          else if (key === 'o') command = 'open-document';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'r') command = 'run-workflow';
          else if (key === '.') command = 'stop-workflow';
          else if (key === 'Backspace') command = 'remove-action';
        } else if (activeApp === 'keychain') {
          if (key === 'n') command = 'new-item';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'show-item-info';
          else if (key === 'Backspace') command = 'delete';
        } else if (activeApp === 'imagecapture') {
          if (key === 'o') command = event.shiftKey ? 'choose-files' : 'add-vfs-images';
          else if (key === 'd') command = event.altKey ? 'import-all' : 'import-selection';
          else if (key === 'l') command = 'rotate-left';
          else if (key === 'r') command = 'rotate-right';
          else if (key === 'Backspace') command = 'delete';
        } else if (activeApp === 'grab') {
          if (event.shiftKey && key === 'a') command = 'capture-selection';
          else if (event.shiftKey && key === 'w') command = 'capture-window';
          else if (event.shiftKey && key === 'z') command = 'capture-timed';
          else if (!event.shiftKey && key === 'z') command = 'capture-screen';
        }
      }
      if (!command) return;
      if (dispatchAppCommand(activeApp, command, { source:'keyboard', originalEvent:event })) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function setActiveApp(id) {
    if (!apps[id]) id = 'finder';
    activeApp = id;
    $('.mb-appname').textContent = apps[id].name;
    renderMenuTitles();
  }

  function renderMenuTitles() {
    const cont = $('#mb-menus');
    cont.innerHTML = '';
    const resolveMenus = () => (apps[activeApp].menus ? apps[activeApp].menus() : (profiledMenus(activeApp) || defaultMenus(activeApp)));
    const menus = resolveMenus();
    menus.forEach((m, index) => {
      const item = el('div', 'mb-item', m.title);
      item.setAttribute('aria-haspopup', 'menu');
      item.setAttribute('aria-expanded', 'false');
      item._menuItemsProvider = () => {
        const current = resolveMenus();
        return current[index]?.items || m.items;
      };
      item.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        toggleMenu(item, item._menuItemsProvider());
      });
      cont.appendChild(item);
    });
  }
  document.addEventListener('vfs-history-changed', () => {
    if (activeApp !== 'finder') return;
    closeMenus();
    renderMenuTitles();
  });
  document.addEventListener('document-state-changed', (event) => {
    if (event.detail?.appId !== activeApp) return;
    closeMenus();
    renderMenuTitles();
  });

  let openMenu = null;
  function closeMenus() {
    if (openMenu) {
      openMenu.dd.remove();
      if (openMenu.anchor) {
        openMenu.anchor.classList.remove('open');
        openMenu.anchor.setAttribute('aria-expanded', 'false');
      }
      openMenu = null;
    }
  }
  function focusMenuItem(item) {
    if (!openMenu || !item || item.classList.contains('disabled')) return;
    openMenu.dd.querySelectorAll('.mi.keyboard-focus').forEach((candidate) => candidate.classList.remove('keyboard-focus'));
    item.classList.add('keyboard-focus');
    openMenu.focused = item;
    item.focus({ preventScroll:true });
  }
  function directMenuItems(container) {
    return [...container.children].filter((item) => item.classList?.contains('mi') && !item.classList.contains('disabled'));
  }
  function switchMenuAnchor(delta) {
    if (!openMenu?.anchor) return;
    const anchors = [
      document.querySelector('.mb-apple'),
      document.querySelector('.mb-appname'),
      ...document.querySelectorAll('#mb-menus > .mb-item'),
    ].filter(Boolean);
    const index = anchors.indexOf(openMenu.anchor);
    if (index < 0) return;
    const next = anchors[(index + delta + anchors.length) % anchors.length];
    const items = next._menuItemsProvider?.();
    if (Array.isArray(items)) toggleMenu(next, items);
  }
  function buildDropdown(items, cls) {
    const dd = el('div', 'menu-dropdown' + (cls ? ' ' + cls : ''));
    dd.setAttribute('role', 'menu');
    items.forEach((it) => {
      if (it.sep) {
        const separator = el('div', 'msep');
        separator.setAttribute('role', 'separator');
        dd.appendChild(separator);
        return;
      }
      const submenuItems = typeof it.submenu === 'function' ? it.submenu() : it.submenu;
      const hasSubmenu = Array.isArray(submenuItems) && submenuItems.length > 0;
      const mi = el('div', 'mi' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') + (hasSubmenu ? ' has-submenu' : ''));
      mi.tabIndex = -1;
      mi.setAttribute('role', 'menuitem');
      mi.setAttribute('aria-disabled', String(!!it.disabled));
      if (it.checked != null) mi.setAttribute('aria-checked', String(!!it.checked));
      if (it.swatch) mi.dataset.menuSwatch = String(it.swatch);
      const checkmark = el('span', 'menu-check');
      const label = el('span', 'menu-label');
      checkmark.textContent = it.checked ? '✓' : '';
      label.textContent = String(it.label ?? '');
      mi.append(checkmark, label);
      if (it.shortcut || hasSubmenu) {
        const shortcut = el('span', 'shortcut');
        shortcut.textContent = hasSubmenu ? '▶' : String(it.shortcut);
        mi.appendChild(shortcut);
      }
      mi.addEventListener('pointerenter', () => {
        if (!it.disabled) focusMenuItem(mi);
        const parentMenu = mi.parentElement;
        parentMenu.querySelectorAll(':scope > .mi.submenu-open').forEach((item) => {
          if (item !== mi) item.classList.remove('submenu-open');
        });
      });
      if (hasSubmenu) {
        mi.appendChild(buildDropdown(submenuItems, 'submenu'));
        mi.addEventListener('click', (event) => {
          if (event.target.closest('.submenu')) return;
          event.stopPropagation();
          mi.parentElement.querySelectorAll(':scope > .mi.submenu-open').forEach((item) => {
            if (item !== mi) item.classList.remove('submenu-open');
          });
          mi.classList.toggle('submenu-open');
        });
      }
      else if (!it.disabled) mi.addEventListener('click', () => { closeMenus(); it.action && it.action(); });
      dd.appendChild(mi);
    });
    return dd;
  }
  function toggleMenu(anchor, items) {
    if (openMenu && openMenu.anchor === anchor) { closeMenus(); return; }
    closeMenus();
    const dd = buildDropdown(items);
    const r = anchor.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top = '22px';
    document.body.appendChild(dd);
    const maxLeft = Math.max(4, innerWidth - dd.getBoundingClientRect().width - 4);
    dd.style.left = Math.max(4, Math.min(r.left, maxLeft)) + 'px';
    anchor.classList.add('open');
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { anchor, dd, focused:null };
  }
  function contextMenu(e, items) {
    closeMenus();
    const dd = buildDropdown(items, 'ctx');
    dd.style.left = e.clientX + 'px';
    dd.style.top = e.clientY + 'px';
    document.body.appendChild(dd);
    const r = dd.getBoundingClientRect();
    if (r.right > innerWidth - 4) dd.style.left = Math.max(4, e.clientX - r.width) + 'px';
    if (r.bottom > innerHeight - 4) dd.style.top = Math.max(4, e.clientY - r.height) + 'px';
    openMenu = { anchor: null, dd };
  }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu-dropdown') && !e.target.closest('.mb-item')) closeMenus(); });
  document.addEventListener('keydown', (event) => {
    if (!openMenu?.dd?.isConnected) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenus();
      return;
    }
    const focused = openMenu.focused;
    const menu = focused?.parentElement || openMenu.dd;
    const items = directMenuItems(menu);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const current = items.indexOf(focused);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = current < 0
        ? (direction > 0 ? 0 : items.length - 1)
        : (current + direction + items.length) % items.length;
      if (items[index]) focusMenuItem(items[index]);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      const submenu = focused?.querySelector(':scope > .menu-dropdown.submenu');
      if (submenu) {
        focused.classList.add('submenu-open');
        const first = directMenuItems(submenu)[0];
        if (first) focusMenuItem(first);
      } else {
        switchMenuAnchor(1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      if (menu.classList.contains('submenu')) {
        const owner = menu.parentElement;
        owner.classList.remove('submenu-open');
        focusMenuItem(owner);
      } else {
        switchMenuAnchor(-1);
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && focused) {
      event.preventDefault();
      event.stopPropagation();
      focused.click();
    }
  }, true);

  function appleMenuItems() {
    return [
      { label: '关于本机', action: showAboutMac },
      { sep: true },
      { label: '软件更新…', action: () => launch('sysprefs', { pane: 'update' }) },
      { label: '系统偏好设置…', action: () => launch('sysprefs') },
      { label: 'Dock 偏好设置…', action: () => launch('sysprefs', { pane: 'dock' }) },
      { sep: true },
      { label: '最近使用的项目', submenu: recentMenuItems },
      { sep: true },
      { label: '强制退出…', shortcut: '⌥⌘⎋', action: forceQuitDialog },
      { sep: true },
      { label: '睡眠', action: () => sleepScreen() },
      { label: '重新启动…', action: () => confirmBox({
        title: '重新启动', text: '您确定要现在重新启动您的电脑吗？',
        okLabel: '重新启动', countdown: 60, countdownVerb: '重新启动',
        onOK: () => shutdownSequence(true),
      }) },
      { label: '关机…', action: () => confirmBox({
        title: '关机', text: '您确定要现在关闭您的电脑吗？',
        okLabel: '关机', countdown: 60, countdownVerb: '关机',
        onOK: () => shutdownSequence(false),
      }) },
      { sep: true },
      { label: '注销 roll…', shortcut: '⇧⌘Q', action: () => confirmBox({
        title: '注销 roll', text: '您确定要现在退出所有应用程序并注销吗？',
        okLabel: '注销', onOK: kernelPanicSequence,
      }) },
    ];
  }
  function recentMenuItems() {
    const recents = getRecentItems();
    const items = [{ label:'应用程序', disabled:true }];
    if (recents.apps.length) {
      recents.apps.forEach((entry) => items.push({
        label:apps[entry.id].name,
        action:() => launch(entry.id),
      }));
    } else items.push({ label:'没有最近使用的应用程序', disabled:true });
    items.push({ sep:true }, { label:'文稿', disabled:true });
    if (recents.documents.length) {
      recents.documents.forEach((entry) => items.push({
        label:VFS.baseName(entry.path),
        action:() => openRecentDocument(entry),
      }));
    } else items.push({ label:'没有最近使用的文稿', disabled:true });
    items.push({ sep:true }, {
      label:'清除菜单',
      disabled:!recents.apps.length && !recents.documents.length,
      action:clearRecentItems,
    });
    return items;
  }
  function appMenuItems() {
    const app = apps[activeApp];
    if (activeApp === 'finder') {
      return [
        { label: '关于 Finder', action: () => showAboutApp(app) },
        { label: 'Finder 偏好设置…', shortcut: '⌘,', action: () => apps.finder?.showPreferences?.() },
        { sep: true },
        { label: '清倒废纸篓…', shortcut: '⇧⌘⌫', action: emptyTrash, disabled: !trashCount() },
        { sep: true },
        { label: '隐藏 Finder', shortcut: '⌘H', action: () => hideApp('finder') },
        { label: '隐藏其他', shortcut: '⌥⌘H', action: () => hideOtherApps('finder') },
        { label: '显示全部', action: showAllApps },
      ];
    }
    const hasPreferences = !!app.showPreferences || !!appPreferenceProfile(activeApp);
    return [
      { label: `关于 ${app.name}`, action: () => showAboutApp(app) },
      ...(hasPreferences ? [{ label: '偏好设置…', shortcut: '⌘,', action: () => showApplicationPreferences(activeApp) }] : []),
      { sep: true },
      { label: `隐藏 ${app.name}`, shortcut: '⌘H', action: () => hideApp(activeApp) },
      { label: '隐藏其他', shortcut: '⌥⌘H', action: () => hideOtherApps(activeApp) },
      { label: '显示全部', action: showAllApps },
      { sep: true },
      { label: `退出 ${app.name}`, shortcut: '⌘Q', action: () => quitApp(activeApp) },
    ];
  }

  function showApplicationPreferences(appId, initialTab) {
    const app = apps[appId];
    if (!app) return null;
    if (app.showPreferences) return app.showPreferences(initialTab);
    const profile = appPreferenceProfile(appId);
    if (!profile) {
      beep('basso', .18);
      return null;
    }
    if (app._preferencesWindow?.isConnected) {
      focusWindow(app._preferencesWindow);
      setActiveApp(appId);
      const requested = app._preferencesWindow.querySelector(`[data-app-pref-tab="${CSS.escape(initialTab || '')}"]`);
      requested?.click();
      return app._preferencesWindow;
    }

    let values = getAppPreferences(appId);
    const root = el('div', 'app-preferences');
    const tabs = el('nav', 'app-preference-tabs');
    tabs.setAttribute('role', 'tablist');
    const panels = el('div', 'app-preference-panels');
    const controlsByKey = new Map();

    const controlElement = (definition) => {
      let control;
      if (definition.type === 'select') {
        control = el('select', 'aqua-select');
        (definition.options || []).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          control.appendChild(option);
        });
      } else if (definition.type === 'color') {
        control = el('input', 'app-preference-color');
        control.type = 'color';
      } else {
        control = el('input', 'aqua-input');
        control.type = definition.type === 'number' ? 'number' : 'text';
        if (definition.placeholder) control.placeholder = definition.placeholder;
        if (definition.min != null) control.min = definition.min;
        if (definition.max != null) control.max = definition.max;
      }
      control.dataset.appPreference = definition.key;
      control.setAttribute('aria-label', definition.label);
      return control;
    };

    const readControl = (definition, control) => {
      if (definition.type === 'checkbox') return control.checked;
      if (definition.type === 'number') return Number(control.value);
      return control.value;
    };
    const setControl = (definition, control) => {
      if (definition.type === 'checkbox') control.checked = !!values[definition.key];
      else control.value = String(values[definition.key] ?? definition.default ?? '');
    };

    profile.tabs.forEach((tabDefinition) => {
      const tab = el('button', 'app-preference-tab');
      tab.type = 'button';
      tab.dataset.appPrefTab = tabDefinition.id;
      tab.setAttribute('role', 'tab');
      tab.innerHTML = `<i aria-hidden="true">${tabDefinition.glyph || '⚙'}</i><span>${tabDefinition.label}</span>`;
      tabs.appendChild(tab);

      const panel = el('section', 'app-preference-panel');
      panel.dataset.appPrefPanel = tabDefinition.id;
      panel.setAttribute('role', 'tabpanel');
      tabDefinition.sections.forEach((sectionDefinition) => {
        const section = document.createElement('fieldset');
        if (sectionDefinition.title) {
          const legend = document.createElement('legend');
          legend.textContent = sectionDefinition.title;
          section.appendChild(legend);
        }
        sectionDefinition.controls.forEach((definition) => {
          let label;
          let control;
          if (definition.type === 'checkbox') {
            label = el('label', 'app-preference-check');
            control = document.createElement('input');
            control.type = 'checkbox';
            control.dataset.appPreference = definition.key;
            label.append(control, document.createTextNode(` ${definition.label}`));
          } else {
            label = el('label', 'app-preference-row');
            const caption = document.createElement('span');
            caption.textContent = definition.label;
            control = controlElement(definition);
            label.append(caption, control);
          }
          controlsByKey.set(definition.key, { definition, control });
          setControl(definition, control);
          const eventName = definition.type === 'text' || definition.type === 'color' ? 'input' : 'change';
          control.addEventListener(eventName, () => {
            values = updateAppPreferences(appId, { [definition.key]:readControl(definition, control) });
          });
          section.appendChild(label);
          if (definition.note) {
            const note = el('p', 'app-preference-note');
            note.textContent = definition.note;
            section.appendChild(note);
          }
        });
        panel.appendChild(section);
      });
      panels.appendChild(panel);
    });

    const footer = el('footer', 'app-preference-footer');
    const help = el('button', 'aqua-btn', '?');
    help.title = `${app.name} 帮助`;
    help.setAttribute('aria-label', `${app.name} 帮助`);
    const status = el('span', '', '更改会立即生效。');
    const restore = el('button', 'aqua-btn', '恢复默认设置…');
    footer.append(help, status, restore);
    root.append(tabs, panels, footer);

    const switchTab = (id) => {
      const fallback = profile.tabs[0]?.id;
      const selectedId = profile.tabs.some((tab) => tab.id === id) ? id : fallback;
      root.querySelectorAll('[data-app-pref-tab]').forEach((button) => {
        const selected = button.dataset.appPrefTab === selectedId;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      root.querySelectorAll('[data-app-pref-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.appPrefPanel !== selectedId;
      });
      root.dispatchEvent(new CustomEvent('panel-layout-changed', { bubbles:true }));
    };
    tabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-app-pref-tab]');
      if (tab) switchTab(tab.dataset.appPrefTab);
    });
    help.addEventListener('click', () => launch('helpviewer', { appId, topic:'preferences' }));
    restore.addEventListener('click', () => confirmSheet({
      parent:app._preferencesWindow,
      headline:`恢复 ${app.name} 的默认设置？`,
      message:'此应用程序的偏好设置将立即恢复为默认值。',
      okLabel:'恢复默认设置',
      onOK:() => {
        values = updateAppPreferences(appId, appPreferenceDefaults(appId));
        controlsByKey.forEach(({ definition, control }) => setControl(definition, control));
      },
    }));

    const win = createWindow({
      app:appId, title:`${app.name} 偏好设置`, width:640, height:500,
      content:root, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:320, maxHeight:560 },
      onClose:(closingWindow) => {
        if (app._preferencesWindow === closingWindow) app._preferencesWindow = null;
      },
    });
    win.classList.add('app-preferences-window');
    app._preferencesWindow = win;
    switchTab(initialTab || profile.tabs[0]?.id);
    return win;
  }
  function quitApp(id, force) {
    const app = apps[id];
    if (!app) return;
    if (app._launchTimer != null) {
      clearTimeout(app._launchTimer);
      app._launchTimer = null;
      app._launchPendingArg = undefined;
    }
    for (const w of app.windows.slice()) {
      if (!runWindowCloseHandler(w, !!force, force ? 'force' : 'quit')) return false;
      detachWindow(w);
    }
    updateAfterWindowClose();
    return true;
  }

  // ---------- Dock preferences ----------
  const dockCfg = {
    size: 48, magnify: true, magnifySize: 1.42, position: 'bottom',
    minimizeEffect: 'genie', animateOpen: true, autoHide: false, indicators: true,
  };
  let dockMagnifyController = null;
  try { Object.assign(dockCfg, JSON.parse(localStorage.getItem('macweb.dock')) || {}); } catch (e) {}
  function applyDockCfg() {
    const dock = $('#dock');
    // only pin an inline size when customized, so the narrow-screen media query keeps working
    if (dockCfg.size !== 48) dock.style.setProperty('--dock-size', dockCfg.size + 'px');
    else dock.style.removeProperty('--dock-size');
    document.body.dataset.dockPosition = dockCfg.position || 'bottom';
    document.body.classList.toggle('dock-auto-hide', !!dockCfg.autoHide);
    document.body.classList.toggle('dock-hide-indicators', dockCfg.indicators === false);
    localStorage.setItem('macweb.dock', JSON.stringify(dockCfg));
    if (dockMagnifyController) {
      dockMagnifyController.invalidate();
      if (!dockCfg.magnify) dockMagnifyController.reset();
    }
  }
  // ---------- Aqua document-modal sheets and Open / Save panels ----------
  function showSheet(opts) {
    opts = opts || {};
    const parent = opts.parent || topWindowOf(opts.app || activeApp) || topVisibleWindow();
    if (!parent) return null;
    if (parent._activeSheet?.close) parent._activeSheet.close('replace');

    const shield = el('div', 'aqua-sheet-shield');
    const sheet = el('section', `aqua-sheet${opts.className ? ` ${opts.className}` : ''}`);
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    if (opts.title) {
      const heading = el('h2', 'aqua-sheet-title');
      heading.textContent = opts.title;
      sheet.appendChild(heading);
      sheet.setAttribute('aria-label', opts.title);
    }
    const content = el('div', 'aqua-sheet-content');
    if (opts.content instanceof Node) content.appendChild(opts.content);
    else if (opts.content != null) content.textContent = String(opts.content);
    sheet.appendChild(content);

    const footer = el('div', 'aqua-sheet-buttons');
    let defaultButton = null;
    let cancelButton = null;
    const api = {
      parent, sheet, content, shield,
      close(reason) {
        if (!shield.isConnected) return;
        removeEventListener('keydown', keyHandler, true);
        shield.classList.remove('shown');
        parent.classList.remove('sheet-open');
        if (parent._activeSheet === api) parent._activeSheet = null;
        setTimeout(() => shield.remove(), 150);
        opts.onClose?.(reason || 'close');
      },
    };
    (opts.buttons || []).forEach((def) => {
      const button = el('button', `aqua-btn${def.default ? ' default' : ''}${def.danger ? ' danger' : ''}`);
      button.textContent = def.label;
      if (def.disabled) button.disabled = true;
      button.addEventListener('click', () => {
        const result = def.action?.(api);
        if (result !== false && def.closes !== false) api.close(def.cancel ? 'cancel' : 'accept');
      });
      if (def.default) defaultButton = button;
      if (def.cancel) cancelButton = button;
      footer.appendChild(button);
    });
    if (footer.childElementCount) sheet.appendChild(footer);
    shield.appendChild(sheet);
    parent.appendChild(shield);
    parent._activeSheet = api;
    parent.classList.add('sheet-open');
    shield.addEventListener('mousedown', (event) => event.stopPropagation());
    const keyHandler = (event) => {
      if (!shield.isConnected) return;
      if (event.key === 'Escape' && cancelButton) {
        event.preventDefault(); event.stopPropagation(); cancelButton.click();
      } else if (event.key === 'Enter' && defaultButton
          && !event.target.matches?.('textarea,button')
          && !event.target.closest?.('[data-sheet-enter="local"]')) {
        event.preventDefault(); event.stopPropagation(); defaultButton.click();
      }
    };
    addEventListener('keydown', keyHandler, true);
    requestAnimationFrame(() => {
      shield.classList.add('shown');
      (opts.initialFocus || defaultButton || sheet.querySelector('input,button,[tabindex]'))?.focus();
    });
    return api;
  }

  function promptSheet(opts) {
    opts = opts || {};
    const form = el('div', 'aqua-prompt');
    if (opts.message) {
      const message = el('p', 'aqua-sheet-message');
      message.textContent = opts.message;
      form.appendChild(message);
    }
    const input = el('input', 'aqua-input aqua-sheet-input');
    input.type = opts.type || 'text';
    input.value = opts.value || '';
    input.placeholder = opts.placeholder || '';
    form.appendChild(input);
    const error = el('div', 'aqua-sheet-error');
    form.appendChild(error);
    const accept = () => {
      const value = input.value.trim();
      const validation = opts.validate?.(value);
      if (!value || validation === false || typeof validation === 'string') {
        error.textContent = typeof validation === 'string' ? validation : (opts.errorText || '请输入有效的名称。');
        input.focus(); input.select();
        return false;
      }
      return opts.onOK?.(value) !== false;
    };
    const api = showSheet({
      parent: opts.parent, app: opts.app, title: opts.title || '',
      content: form, className: 'aqua-prompt-sheet', initialFocus: input,
      buttons: [
        { label: opts.cancelLabel || '取消', cancel: true },
        { label: opts.okLabel || '好', default: true, action: accept },
      ],
      onClose: opts.onClose,
    });
    requestAnimationFrame(() => input.select());
    return api;
  }

  function confirmSheet(opts) {
    opts = opts || {};
    const body = el('div', 'aqua-confirm-sheet-body');
    const icon = el('div', 'aqua-confirm-sheet-icon');
    icon.innerHTML = opts.icon || appleIconSvg('#9aa2ad');
    const copy = el('div');
    const headline = el('h3');
    headline.textContent = opts.headline || opts.title || '您确定吗？';
    const message = el('p');
    message.textContent = opts.message || opts.text || '';
    copy.append(headline, message);
    body.append(icon, copy);
    return showSheet({
      parent: opts.parent, app: opts.app, title: opts.sheetTitle || '',
      content: body, className: 'aqua-confirm-sheet',
      buttons: [
        { label: opts.cancelLabel || '取消', cancel: true },
        { label: opts.okLabel || '好', default: true, danger: !!opts.danger, action: opts.onOK },
      ],
      onClose: opts.onClose,
    });
  }

  function documentPanel(opts, mode) {
    opts = opts || {};
    const parent = opts.parent || topWindowOf(opts.app || activeApp) || topVisibleWindow();
    if (!parent) return null;
    const home = '/用户/roll';
    let current = VFS.isDir(opts.startPath) ? VFS.normalize(opts.startPath) : home;
    let selection = new Set();
    let anchor = null;
    const backStack = [];
    const forwardStack = [];
    const allowMultiple = mode === 'open' && !!(opts.allowMultiple || opts.multiple);
    const availableTypes = (opts.types || []).map((type) => String(type).replace(/^\./, '').toLowerCase()).filter(Boolean);
    let enabledTypes = availableTypes.slice();
    let query = '';
    let defaultActionButton = null;
    const panelBytes = (bytes) => {
      const value = Math.max(0, Number(bytes) || 0);
      if (value < 1024) return `${value.toLocaleString()} 字节`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
      return `${(value / 1024 / 1024).toFixed(value < 10485760 ? 1 : 0)} MB`;
    };
    const accepted = (path) => {
      const node = VFS.get(path);
      if (!node) return false;
      if (node.type === 'dir') return !!opts.allowFolders;
      if (!enabledTypes.length) return true;
      const ext = (VFS.baseName(path).split('.').pop() || '').toLowerCase();
      return enabledTypes.includes(ext);
    };

    const panel = el('div', 'aqua-file-panel');
    const top = el('div', 'aqua-file-panel-top');
    const nav = el('div', 'aqua-file-nav-group');
    const back = el('button', 'aqua-file-nav', '◀');
    const forward = el('button', 'aqua-file-nav', '▶');
    const up = el('button', 'aqua-file-nav', '↑');
    back.title = '后退';
    forward.title = '前进';
    up.title = '上层文件夹';
    nav.append(back, forward, up);
    const location = el('button', 'aqua-file-location');
    const search = el('input', 'aqua-input aqua-file-search');
    search.type = 'text';
    search.placeholder = '搜索';
    search.setAttribute('aria-label', '搜索当前文件夹');
    top.append(nav, location, search);
    const split = el('div', 'aqua-file-split');
    const sidebar = el('aside', 'aqua-file-sidebar');
    const list = el('div', 'aqua-file-list');
    list.tabIndex = 0;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', '文件列表');
    if (allowMultiple) list.setAttribute('aria-multiselectable', 'true');
    split.append(sidebar, list);
    const status = el('div', 'aqua-file-status');
    const lower = el('div', 'aqua-file-lower');
    panel.append(top, split, status, lower);

    const places = [
      ['/用户/roll', 'roll', '⌂'], ['/用户/roll/桌面', '桌面', '▧'],
      ['/用户/roll/文稿', '文稿', '▤'], ['/用户/roll/下载', '下载', '⇩'],
      ['/用户/roll/图片', '图片', '▣'], ['/用户/roll/音乐', '音乐', '♫'],
      ['/用户/roll/影片', '影片', '▶'], ['/应用程序', '应用程序', 'A'],
    ];
    const recentPlaces = [...new Set(getRecentItems().documents
      .map((entry) => VFS.parentOf(entry.path))
      .filter((path) => VFS.isDir(path) && !places.some((entry) => entry[0] === path)))]
      .slice(0, 3)
      .map((path) => [path, VFS.baseName(path), '◷']);
    const addPlaceSection = (title, entries) => {
      if (!entries.length) return;
      sidebar.appendChild(el('strong', '', title));
      entries.forEach(([path, label, glyph]) => {
        if (!VFS.isDir(path)) return;
        const item = el('button', 'aqua-file-place');
        item.dataset.path = path;
        item.innerHTML = `<i>${glyph}</i><span>${label}</span>`;
        item.addEventListener('click', () => navigate(path));
        sidebar.appendChild(item);
      });
    };
    addPlaceSection('设备', [['/', 'Macintosh HD', '◈']]);
    addPlaceSection('位置', places);
    addPlaceSection('共享', [['/用户/roll/公共', 'roll 的 Mac', '◫']]);
    addPlaceSection('最近使用', recentPlaces);

    let fileName = null;
    if (mode === 'save') {
      const label = el('label', 'aqua-save-name');
      label.append(document.createTextNode('存储为：'));
      fileName = el('input', 'aqua-input');
      fileName.value = opts.name || '未命名';
      label.appendChild(fileName);
      lower.appendChild(label);
    }
    const utilities = el('div', 'aqua-file-utilities');
    const newFolder = el('button', 'aqua-btn', '新建文件夹');
    newFolder.addEventListener('click', () => {
      if (utilities.querySelector('.aqua-new-folder-edit')) return;
      const editor = el('span', 'aqua-new-folder-edit');
      editor.dataset.sheetEnter = 'local';
      const input = el('input', 'aqua-input');
      input.value = VFS.uniqueName(current, '未命名文件夹', '');
      const create = el('button', 'aqua-btn default', '新建');
      const cancel = el('button', 'aqua-btn', '取消');
      editor.append(input, create, cancel);
      newFolder.hidden = true;
      utilities.prepend(editor);
      const closeEditor = () => { editor.remove(); newFolder.hidden = false; };
      const commitFolder = () => {
        const name = input.value.trim();
        const path = VFS.normalize(`${current}/${name}`);
        if (!name || name.includes('/') || name === '.' || name === '..' || VFS.get(path)) {
          input.classList.add('invalid');
          status.textContent = '这个文件夹名称不可用。';
          input.focus(); input.select();
          return;
        }
        if (VFS.mkdir(path)) {
          query = '';
          search.value = '';
          selection = new Set([path]);
          anchor = path;
          closeEditor();
          render();
        }
      };
      create.addEventListener('click', commitFolder);
      cancel.addEventListener('click', closeEditor);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); commitFolder(); }
        else if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
      });
      input.addEventListener('input', () => input.classList.remove('invalid'));
      requestAnimationFrame(() => { input.focus(); input.select(); });
    });
    utilities.appendChild(newFolder);
    if (mode === 'open' && opts.allowUpload !== false) {
      const importButton = el('button', 'aqua-btn', '从本机导入…');
      const input = el('input');
      input.type = 'file';
      input.hidden = true;
      input.multiple = allowMultiple;
      if (opts.types?.length) input.accept = opts.types.map((x) => `.${String(x).replace(/^\./,'')}`).join(',');
      importButton.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        const files = [...(input.files || [])];
        if (!files.length) return;
        const imported = [];
        let pending = files.length;
        files.forEach((file) => {
          if (file.size > 4 * 1024 * 1024) {
            status.textContent = `“${file.name}”大于 4 MB，无法存入虚拟磁盘。`;
            if (!--pending && imported.length) finishImport();
            return;
          }
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            const dot = file.name.lastIndexOf('.');
            const name = VFS.uniqueName(current, dot > 0 ? file.name.slice(0, dot) : file.name, dot > 0 ? file.name.slice(dot) : '');
            const path = VFS.normalize(`${current}/${name}`);
            const isImage = file.type.startsWith('image/');
            const node = { type:'file', mime:file.type || undefined };
            if (isImage) { node.kind = 'image'; node.src = reader.result; }
            else node.content = String(reader.result || '');
            if (VFS.putNode(path, node)) imported.push(path);
            else status.textContent = `无法导入“${file.name}”。`;
            if (!--pending) finishImport();
          });
          reader.addEventListener('error', () => {
            status.textContent = `无法读取“${file.name}”。`;
            if (!--pending && imported.length) finishImport();
          });
          if (file.type.startsWith('image/')) reader.readAsDataURL(file);
          else reader.readAsText(file);
        });
        function finishImport() {
          selection = new Set(allowMultiple ? imported : imported.slice(-1));
          anchor = imported.at(-1) || null;
          input.value = '';
          render();
        }
      });
      utilities.append(importButton, input);
    }
    lower.prepend(utilities);
    if (mode === 'open' && availableTypes.length) {
      const filter = el('label', 'aqua-file-filter');
      filter.append(document.createTextNode('启用：'));
      const select = el('select', 'aqua-select');
      const allOption = document.createElement('option');
      allOption.value = '*';
      allOption.textContent = opts.typeLabel || (availableTypes.length === 1
        ? `${availableTypes[0].toUpperCase()} 文稿`
        : '所有支持的文稿');
      select.appendChild(allOption);
      if (availableTypes.length > 1) {
        const typeNames = {
          jpg:'JPEG 图像', jpeg:'JPEG 图像', png:'PNG 图像', gif:'GIF 图像',
          svg:'SVG 图像', webp:'WebP 图像', pdf:'PDF 文稿', txt:'纯文本文稿',
          rtf:'RTF 文稿', html:'HTML 文稿', htm:'HTML 文稿', mp3:'MP3 音频',
          m4a:'MPEG-4 音频', wav:'WAVE 音频', mov:'QuickTime 影片', mp4:'MPEG-4 影片',
        };
        availableTypes.forEach((type) => {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = typeNames[type] || `${type.toUpperCase()} 文稿`;
          select.appendChild(option);
        });
      }
      select.addEventListener('change', () => {
        enabledTypes = select.value === '*' ? availableTypes.slice() : [select.value];
        selection.clear();
        anchor = null;
        render();
      });
      filter.appendChild(select);
      lower.appendChild(filter);
    } else if (mode === 'save' && opts.extension) {
      const format = el('div', 'aqua-file-format');
      format.textContent = `格式：${opts.typeLabel || `${String(opts.extension).replace(/^\./,'').toUpperCase()} 文稿`}`;
      lower.appendChild(format);
    }

    let sheetApi = null;
    let overwritePrompt = null;
    const clearOverwritePrompt = () => {
      overwritePrompt?.remove();
      overwritePrompt = null;
      updateAcceptState();
    };
    const performSave = (path, name) => opts.onSave?.(path, { directory:current, name }) !== false;
    const showOverwritePrompt = (path, name) => {
      clearOverwritePrompt();
      overwritePrompt = el('div', 'aqua-file-overwrite');
      const text = el('span');
      text.textContent = `“${name}”已经存在。要用当前文稿替换它吗？`;
      const cancel = el('button', 'aqua-btn', '取消');
      const replace = el('button', 'aqua-btn default', '替换');
      overwritePrompt.append(text, cancel, replace);
      panel.insertBefore(overwritePrompt, lower);
      updateAcceptState();
      cancel.addEventListener('click', () => { clearOverwritePrompt(); fileName.focus(); fileName.select(); });
      replace.addEventListener('click', () => {
        if (performSave(path, name)) sheetApi?.close('accept');
      });
      replace.focus();
    };
    const openSelected = () => {
      clearOverwritePrompt();
      if (mode === 'save') {
        let name = fileName.value.trim();
        if (!name || name.includes('/') || name === '.' || name === '..') {
          status.textContent = '请输入有效的文件名。';
          fileName.focus();
          return false;
        }
        const extension = opts.extension ? String(opts.extension).replace(/^\./, '') : '';
        if (extension && !name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) name += `.${extension}`;
        const path = VFS.normalize(`${current}/${name}`);
        if (VFS.isDir(path)) {
          navigate(path);
          return false;
        }
        if (VFS.get(path)) {
          if (!opts.allowOverwrite) {
            status.textContent = `“${name}”已经存在。请选择其他名称。`;
            fileName.focus(); fileName.select();
            return false;
          }
          showOverwritePrompt(path, name);
          return false;
        }
        return performSave(path, name);
      }
      const paths = [...selection].filter((path) => VFS.get(path));
      if (!paths.length) {
        status.textContent = opts.allowFolders ? '请选择文件或文件夹。' : '请选择一个文件。';
        return false;
      }
      if (paths.length === 1 && VFS.isDir(paths[0]) && !opts.allowFolders) {
        navigate(paths[0]);
        return false;
      }
      if (paths.some((path) => !accepted(path))) {
        status.textContent = '这个项目不能由当前应用打开。';
        return false;
      }
      return allowMultiple
        ? opts.onOpen?.(paths, paths.map((path) => VFS.get(path))) !== false
        : opts.onOpen?.(paths[0], VFS.get(paths[0])) !== false;
    };

    function navigate(path, push = true) {
      if (!VFS.isDir(path)) return;
      const normalized = VFS.normalize(path);
      if (normalized === current) return;
      if (push) {
        backStack.push(current);
        forwardStack.length = 0;
      }
      current = normalized;
      query = '';
      search.value = '';
      selection = new Set();
      anchor = null;
      clearOverwritePrompt();
      render();
    }
    function selectPath(path, event) {
      const rows = [...list.querySelectorAll('.aqua-file-row')].map((row) => row.dataset.path);
      if (allowMultiple && event?.shiftKey && anchor && rows.includes(anchor)) {
        const from = rows.indexOf(anchor);
        const to = rows.indexOf(path);
        selection = new Set(rows.slice(Math.min(from, to), Math.max(from, to) + 1));
      } else if (allowMultiple && (event?.metaKey || event?.ctrlKey)) {
        if (selection.has(path)) selection.delete(path);
        else selection.add(path);
        anchor = path;
      } else {
        selection = new Set([path]);
        anchor = path;
      }
      renderSelection();
      const node = VFS.get(path);
      const selectedSize = [...selection].reduce((sum, candidate) => sum + VFS.sizeOf(candidate), 0);
      status.textContent = selection.size > 1
        ? `已选择 ${selection.size} 个项目，${panelBytes(selectedSize)}`
        : node?.type === 'dir' ? `${(VFS.list(path) || []).length} 个项目` : `${VFS.baseName(path)}，${panelBytes(VFS.sizeOf(path))}`;
      if (mode === 'save' && node?.type !== 'dir') fileName.value = VFS.baseName(path);
      updateAcceptState();
    }
    function renderSelection() {
      list.querySelectorAll('.aqua-file-row').forEach((row) => {
        const chosen = selection.has(row.dataset.path);
        row.classList.toggle('selected', chosen);
        row.setAttribute('aria-selected', String(chosen));
      });
      updateAcceptState();
    }
    function updateAcceptState() {
      if (!defaultActionButton) return;
      if (mode === 'save') {
        const name = fileName?.value.trim() || '';
        defaultActionButton.disabled = !name || name.includes('/') || name === '.' || name === '..' || !!overwritePrompt;
        return;
      }
      const paths = [...selection].filter((path) => VFS.get(path));
      const navigableFolder = paths.length === 1 && VFS.isDir(paths[0]);
      defaultActionButton.disabled = !paths.length || (!navigableFolder && paths.some((path) => !accepted(path)));
    }
    function render() {
      location.textContent = current === '/' ? 'Macintosh HD' : VFS.baseName(current);
      location.title = current;
      back.disabled = !backStack.length;
      forward.disabled = !forwardStack.length;
      up.disabled = current === '/';
      sidebar.querySelectorAll('.aqua-file-place').forEach((item) =>
        item.classList.toggle('selected', item.dataset.path === current));
      list.innerHTML = '<div class="aqua-file-head"><span>名称</span><span>修改日期</span><span>种类</span></div>';
      const allNames = (VFS.list(current) || []).filter((name) => !name.startsWith('.'));
      const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
      const names = allNames.filter((name) => !normalizedQuery
        || name.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
        .sort((a, b) => {
          const ad = VFS.isDir(`${current}/${a}`), bd = VFS.isDir(`${current}/${b}`);
          return ad === bd ? a.localeCompare(b, 'zh-CN') : ad ? -1 : 1;
        });
      names.forEach((name) => {
        const path = VFS.normalize(`${current}/${name}`);
        const node = VFS.get(path);
        const row = el('button', 'aqua-file-row');
        row.dataset.path = path;
        row.setAttribute('role', 'option');
        const icon = System.fileIconFor?.(path) || (node.type === 'dir' ? ICONS.folder : ICONS.textfile);
        const modified = Number.isFinite(node.modifiedAt)
          ? new Date(node.modifiedAt).toLocaleDateString('zh-CN', { year:'numeric', month:'numeric', day:'numeric' })
          : '—';
        const kind = node.type === 'dir' ? '文件夹' : node.kind === 'image' ? '图像' : node.type === 'app' ? '应用程序' : '文稿';
        row.innerHTML = `<span class="aqua-file-name">${icon}<b></b></span><span>${modified}</span><span>${kind}</span>`;
        row.querySelector('b').textContent = name.replace(/\.app$/, '');
        if (!accepted(path) && node.type !== 'dir') row.classList.add('unavailable');
        row.addEventListener('click', (event) => selectPath(path, event));
        row.addEventListener('dblclick', () => {
          if (node.type === 'dir') navigate(path);
          else if (mode === 'open') sheetApi?.sheet.querySelector('.aqua-sheet-buttons .default')?.click();
        });
        list.appendChild(row);
      });
      selection = new Set([...selection].filter((path) => VFS.get(path) && VFS.parentOf(path) === current));
      renderSelection();
      status.textContent = normalizedQuery
        ? `找到 ${names.length} 个匹配项目（共 ${allNames.length} 个）`
        : `${names.length} 个项目`;
    }

    back.addEventListener('click', () => {
      const path = backStack.pop();
      if (!path) return;
      forwardStack.push(current);
      navigate(path, false);
    });
    forward.addEventListener('click', () => {
      const path = forwardStack.pop();
      if (!path) return;
      backStack.push(current);
      navigate(path, false);
    });
    up.addEventListener('click', () => navigate(VFS.parentOf(current)));
    location.addEventListener('click', (event) => {
      const ancestors = [];
      let path = current;
      while (true) {
        ancestors.push(path);
        if (path === '/') break;
        path = VFS.parentOf(path);
      }
      contextMenu(event, ancestors.map((item) => ({
        label:item === '/' ? 'Macintosh HD' : VFS.baseName(item),
        action:() => navigate(item),
      })));
    });
    search.addEventListener('input', () => {
      query = search.value;
      selection.clear();
      anchor = null;
      render();
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && search.value) {
        event.preventDefault();
        event.stopPropagation();
        search.value = '';
        query = '';
        render();
        list.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        list.focus();
        const first = list.querySelector('.aqua-file-row');
        if (first) selectPath(first.dataset.path);
      }
    });
    fileName?.addEventListener('input', () => {
      clearOverwritePrompt();
      updateAcceptState();
    });
    panel.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        event.stopPropagation();
        search.focus();
        search.select();
      }
    });
    list.addEventListener('keydown', (event) => {
      const rows = [...list.querySelectorAll('.aqua-file-row')];
      if (!rows.length) return;
      const paths = rows.map((row) => row.dataset.path);
      let index = Math.max(0, paths.indexOf(anchor));
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        index = Math.max(0, Math.min(paths.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        selectPath(paths[index], { shiftKey:event.shiftKey });
        rows[index].scrollIntoView({ block:'nearest' });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && allowMultiple) {
        event.preventDefault();
        selection = new Set(paths);
        anchor = paths[0];
        renderSelection();
        status.textContent = `已选择 ${selection.size} 个项目`;
      }
    });
    const buttons = [
      { label:'取消', cancel:true },
      {
        label: mode === 'save' ? (opts.okLabel || '存储') : (opts.okLabel || '打开'),
        default:true, disabled:mode === 'open', action:openSelected,
      },
    ];
    const onPanelVfs = () => {
      if (sheetApi?.shield.isConnected) render();
    };
    sheetApi = showSheet({
      parent, title: opts.title || (mode === 'save' ? '存储' : '打开'),
      content:panel, className:'aqua-document-panel',
      initialFocus: mode === 'save' ? fileName : list, buttons,
      onClose:(reason) => {
        document.removeEventListener('vfs-changed', onPanelVfs);
        opts.onClose?.(reason);
      },
    });
    document.addEventListener('vfs-changed', onPanelVfs);
    defaultActionButton = sheetApi.sheet.querySelector('.aqua-sheet-buttons .default');
    render();
    requestAnimationFrame(() => {
      if (!fileName) return;
      const value = fileName.value;
      const dot = value.lastIndexOf('.');
      fileName.focus();
      fileName.setSelectionRange(0, dot > 0 ? dot : value.length);
    });
    return sheetApi;
  }

  function openPanel(opts) { return documentPanel(opts, 'open'); }
  function savePanel(opts) { return documentPanel(opts, 'save'); }

  // ---------- Aqua confirm dialog (restart / shutdown / empty trash …) ----------
  function confirmBox(opts) {
    // opts: {title, text, okLabel, onOK, countdown(sec), countdownVerb}
    const box = el('div', 'cfm-wrap');
    const c = el('div', 'cfm');
    const ic = el('div', 'cfm-icon');
    ic.innerHTML = appleIconSvg('#98a0ac');
    const right = el('div', 'cfm-right');
    const txt = el('div', 'cfm-text', opts.text);
    const cd = el('div', 'cfm-count');
    right.append(txt, cd);
    c.append(ic, right);
    const btns = el('div', 'cfm-btns');
    const cancel = el('button', 'aqua-btn', '取消');
    const ok = el('button', 'aqua-btn default', opts.okLabel || '好');
    btns.append(cancel, ok);
    box.append(c, btns);
    let timer = null;
    const w = createWindow({
      app: activeApp, title: opts.title || '', width: 430, height: 195, content: box,
      noResize: true, bodyBg: '#ececec',
      onClose: () => { if (timer) { clearInterval(timer); timer = null; } },
    });
    const doOK = () => { closeWindow(w); opts.onOK && opts.onOK(); };
    ok.addEventListener('click', doOK);
    cancel.addEventListener('click', () => closeWindow(w));
    if (opts.countdown) {
      let n = opts.countdown;
      const verb = opts.countdownVerb || opts.okLabel || '继续';
      const upd = () => { cd.textContent = `如果您不做任何操作，电脑将在 ${n} 秒后自动${verb}。`; };
      upd();
      timer = setInterval(() => {
        n--;
        if (n <= 0) { clearInterval(timer); timer = null; doOK(); } else upd();
      }, 1000);
    }
    return w;
  }

  function shutdownSequence(restart) {
    syslog(restart ? '系统正在重新启动…' : '系统正在关机…', 'shutdown');
    const s = el('div', 'shutdown-screen');
    document.body.appendChild(s);
    requestAnimationFrame(() => s.classList.add('on'));
    setTimeout(() => {
      if (restart) {
        s.innerHTML = `<div class="sd-inner"><div class="boot-apple"></div><div class="boot-spinner"></div></div>`;
        setTimeout(() => location.reload(), 1500);
      } else {
        s.innerHTML = `<div class="sd-inner"><div class="sd-power">⏻</div><div class="sd-text">您现在可以安全地关闭电脑了。</div><div class="sd-hint">点按任意位置重新开机</div></div>`;
        s.addEventListener('click', () => location.reload());
      }
    }, 950);
  }

  function kernelPanicSequence() {
    if (document.querySelector('.kernel-panic-screen')) return;
    closeMenus();
    syslog('panic(cpu 0 caller 0x001A8C8A): simulated logout panic', 'kernel');
    const screen = el('div', 'kernel-panic-screen');
    screen.tabIndex = 0;
    screen.setAttribute('role', 'alert');
    screen.setAttribute('aria-label', '系统发生严重错误，需要重新启动电脑');
    screen.innerHTML = `
      <div class="kp-panel">
        <div class="kp-power" aria-hidden="true">⏻</div>
        <div class="kp-messages">
          <p lang="en">You need to restart your computer. Hold down the Power button for several seconds or press the Restart button.</p>
          <p lang="fr">Vous devez redémarrer votre ordinateur. Maintenez le bouton d’alimentation enfoncé pendant plusieurs secondes ou appuyez sur le bouton de redémarrage.</p>
          <p lang="de">Sie müssen Ihren Computer neu starten. Halten Sie den Ein-/Ausschalter mehrere Sekunden gedrückt oder drücken Sie die Neustart-Taste.</p>
          <p lang="ja">コンピュータを再起動する必要があります。パワーボタンを数秒間押し続けるか、リセットボタンを押してください。</p>
        </div>
      </div>
      <div class="kp-hint">点按任意位置或按任意键重新启动</div>`;
    document.body.appendChild(screen);
    requestAnimationFrame(() => screen.classList.add('on'));
    let armed = false;
    const restart = (event) => {
      if (!armed) return;
      event?.preventDefault?.();
      location.reload();
    };
    const onKeyDown = (event) => restart(event);
    screen.addEventListener('click', restart);
    addEventListener('keydown', onKeyDown, true);
    setTimeout(() => {
      armed = true;
      screen.classList.add('ready');
      screen.focus({ preventScroll:true });
    }, 1100);
  }

  // ---------- Force quit (⌥⌘⎋) ----------
  function forceQuitDialog() {
    const c = el('div');
    c.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;height:100%';
    const tip = el('div', '', '如果某个应用程序长时间没有响应，请选择其名称并点按「强制退出」。');
    tip.style.cssText = 'font-size:11px;color:#555;line-height:1.5';
    const list = el('div', 'fq-list');
    let sel = null;
    function refresh() {
      list.innerHTML = '';
      sel = null;
      Object.values(apps).filter((a) => a.windows.length).forEach((a) => {
        const row = el('div', 'fq-row');
        row.innerHTML = `${a.icon}<span>${a.name}</span>`;
        row.addEventListener('click', () => {
          list.querySelectorAll('.fq-row').forEach((x) => x.classList.remove('sel'));
          row.classList.add('sel');
          sel = a.id;
        });
        list.appendChild(row);
      });
      if (!list.children.length) list.appendChild(el('div', 'fq-empty', '（没有正在运行的应用程序）'));
    }
    refresh();
    const btnRow = el('div');
    btnRow.style.cssText = 'text-align:right;flex:none';
    const btn = el('button', 'aqua-btn default', '强制退出');
    btn.addEventListener('click', () => {
      if (!sel) return;
      const name = apps[sel].name;
      quitApp(sel, true);
      syslog(`强制退出: ${name}`, 'launchd');
      if (w.isConnected) refresh();
    });
    btnRow.appendChild(btn);
    c.append(tip, list, btnRow);
    const w = createWindow({ app: activeApp, title: '强制退出应用程序', width: 300, height: 330, content: c, noResize: true, bodyBg: '#ececec' });
  }

  function showAboutMac() {
    const c = el('div', 'about-mac');
    c.innerHTML = `
      <header><div class="about-mac-apple">${appleIconSvg('#a6abb2')}</div><h1>Mac OS X</h1><button class="about-mac-version">版本 10.5.8</button></header>
      <button class="aqua-btn about-mac-update">软件更新…</button>
      <dl class="about-mac-hardware">
        <dt>处理器</dt><dd data-about-hw="processor"></dd>
        <dt>内存</dt><dd data-about-hw="memory"></dd>
        <dt>启动磁盘</dt><dd>Macintosh HD</dd>
      </dl>
      <div class="about-mac-actions"></div>
      <footer><span>© 1983–2009 Apple Inc.<br>保留一切权利。</span></footer>`;
    const processor = c.querySelector('[data-about-hw="processor"]');
    const memory = c.querySelector('[data-about-hw="memory"]');
    processor.textContent = HW.processor;
    processor.title = `${HW.processor} · ${HW.processorSource}`;
    memory.textContent = HW.memory;
    memory.title = `${HW.memory} · ${HW.memorySource}`;
    const version = c.querySelector('.about-mac-version');
    const versionStates = ['版本 10.5.8','Build 9L31a-web',`序列号 ${HW.serial}`];
    let versionIndex = 0;
    version.addEventListener('click',()=>{versionIndex=(versionIndex+1)%versionStates.length;version.textContent=versionStates[versionIndex];});
    const btnReport = el('button', 'aqua-btn default', '更多信息…');
    btnReport.addEventListener('click', () => launch('sysprofiler'));
    c.querySelector('.about-mac-update').addEventListener('click', () => launch('sysprefs', { pane:'update' }));
    c.querySelector('.about-mac-actions').append(btnReport);
    createWindow({
      app:activeApp, title:'关于本机', width:390, height:420, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:360, maxHeight:420, width:390, extraHeight:0 },
    });
  }
  function showAboutApp(app) {
    const c = el('div', 'about-box');
    c.innerHTML = `<div class="di-img">${app.icon}</div><h2>${app.name}</h2><div class="ver">版本 1.0（Web）</div><p>${app.about || 'Mac OS X 网页版应用。'}</p>`;
    createWindow({
      app:app.id, title:`关于 ${app.name}`, width:280, height:260, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:220, maxHeight:420 },
    });
  }
  function alertBox(title, text) {
    const c = el('div', 'about-box');
    c.innerHTML = `<p style="font-size:13px;white-space:pre-wrap">${text}</p>`;
    const btn = el('button', 'aqua-btn default', '好');
    btn.style.marginTop = '14px';
    c.appendChild(btn);
    const w = createWindow({
      app:activeApp, title, width:320, height:180, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:160, maxHeight:430 },
    });
    btn.addEventListener('click', () => closeWindow(w));
  }

  function sleepScreen() {
    const s = el('div');
    Object.assign(s.style, { position: 'fixed', inset: 0, background: '#000', zIndex: 99999, opacity: 0, transition: 'opacity .8s' });
    document.body.appendChild(s);
    requestAnimationFrame(() => s.style.opacity = 1);
    s.addEventListener('click', () => { s.style.opacity = 0; setTimeout(() => s.remove(), 800); });
  }

  function appleIconSvg(color) {
    return `<svg viewBox="0 0 170 200" width="100%" height="100%"><path fill="${color}" d="M150.4 69.2c-1.1.8-19.7 11.3-19.7 34.7 0 27 23.7 36.6 24.4 36.8-.1.6-3.8 13.1-12.5 25.9-7.8 11.2-16 22.4-28.4 22.4s-15.6-7.2-29.9-7.2c-14 0-19 7.4-30.4 7.4S34.6 178.8 26 166.4C16.2 152.2 8 130.2 8 109.3c0-33.5 21.8-51.3 43.2-51.3 11.4 0 20.9 7.6 28.1 7.6 6.8 0 17.4-8 30.4-8 4.9 0 22.6.4 34.3 17zM104.5 39.6c5.7-6.7 9.7-16.1 9.7-25.4 0-1.3-.1-2.6-.3-3.7-9.2.3-20.2 6.1-26.8 13.8-5.2 5.9-10 15.2-10 24.7 0 1.4.2 2.8.3 3.3.6.1 1.5.2 2.5.2 8.2 0 18.6-5.5 24.6-12.9z"/></svg>`;
  }

  // ---------- Dock ----------
  function buildDock() {
    const cont = $('#dock-apps');
    cont.innerHTML = '';
    // Leopard-like default Dock. Custom games remain available in Applications
    // instead of displacing the era-defining system applications.
    const defaultOrder = ['finder', 'dashboard', 'mail', 'safari', 'ichat', 'addressbook', 'ical', 'itunes', 'photobooth', 'quicktime', 'sysprefs'];
    let order = defaultOrder;
    try {
      const savedOrder = JSON.parse(localStorage.getItem('macweb.dock.order'));
      if (Array.isArray(savedOrder) && savedOrder.length) order = savedOrder.filter((id) => apps[id]);
    } catch (e) {}
    order.forEach((id) => {
      const d = makeDockAppIcon(id);
      if (d) cont.appendChild(d);
    });
    // trash
    const right = $('#dock-right');
    right.innerHTML = '';
    const trash = el('div', 'dock-icon');
    trashEl = trash;
    updateTrashIcon();
    trash.addEventListener('click', openTrash);
    trash.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu(e, [
        { label: '打开', action: openTrash },
        { sep: true },
        { label: '清倒废纸篓…', action: emptyTrash, disabled: !trashCount() },
      ]);
    });
    right.appendChild(trash);
    initMagnify();
  }

  function makeDockAppIcon(id) {
    const app = apps[id];
    if (!app) return null;
    const d = el('div', 'dock-icon');
    d.dataset.app = id;
    d.innerHTML = `${app.icon}<div class="di-reflect">${app.icon}</div><div class="dock-label">${app.name}</div><div class="run-dot"></div>`;
    d.addEventListener('click', () => {
      if (app.windows.some((w) => w._hiddenByApp)) {
        showApp(id);
        return;
      }
      const minimized = app.windows.find((w) => w._minThumb);
      if (app.windows.length && app.windows.every((w) => w.style.display === 'none') && minimized) restoreWindow(minimized);
      else launch(id);
    });
    return d;
  }

  function persistDockOrder() {
    const order = Array.from(document.querySelectorAll('#dock-apps .dock-icon[data-app]'), (n) => n.dataset.app);
    localStorage.setItem('macweb.dock.order', JSON.stringify(order));
    return order;
  }

  function addToDock(id, before) {
    if (!apps[id]) return false;
    const existing = document.querySelector(`#dock-apps .dock-icon[data-app="${CSS.escape(id)}"]`);
    if (existing) return true;
    const icon = makeDockAppIcon(id);
    const cont = $('#dock-apps');
    cont.insertBefore(icon, before?.closest?.('#dock-apps .dock-icon') || null);
    persistDockOrder();
    initMagnify();
    updateDock();
    syslog(`${apps[id].name} 已添加到 Dock`, 'Dock');
    return true;
  }

  function removeFromDock(id) {
    if (id === 'finder') return false;
    const icon = document.querySelector(`#dock-apps .dock-icon[data-app="${CSS.escape(id)}"]`);
    if (!icon) return false;
    icon.classList.add('dock-poof');
    setTimeout(() => {
      icon.remove();
      persistDockOrder();
      initMagnify();
    }, 180);
    syslog(`${apps[id]?.name || id} 已从 Dock 移除`, 'Dock');
    return true;
  }

  // ---------- Trash ----------
  const TRASH = '/用户/roll/.废纸篓';
  let trashEl = null;
  function trashCount() { return (VFS.list(TRASH) || []).length; }
  function updateTrashIcon() {
    if (!trashEl) return;
    const ic = trashCount() ? ICONS.trashFull : ICONS.trash;
    trashEl.innerHTML = `${ic}<div class="di-reflect">${ic}</div><div class="dock-label">废纸篓</div>`;
  }
  function openTrash() { launch('finder', { path: TRASH }); }
  function emptyTrash() {
    const n = trashCount();
    if (!n) { alertBox('废纸篓', '废纸篓是空的。'); return; }
    const perform = () => {
      const paths = (VFS.list(TRASH) || []).map((name) => VFS.normalize(`${TRASH}/${name}`));
      VFS.transaction('清倒废纸篓',
        () => paths.forEach((path) => VFS.remove(path, { record:false })),
        { paths, record:false });
      syslog('废纸篓已清倒', 'Finder');
    };
    if (getFinderPreferences().warnEmptyTrash === false) {
      perform();
      return;
    }
    confirmBox({
      title: '', text: `确定要清倒废纸篓吗？其中的 ${n} 个项目将被永久删除。此操作无法撤销。`,
      okLabel: '清倒废纸篓',
      onOK: perform,
    });
  }
  // ---------- 拖放：Finder / 桌面 之间移动，应用生成别名 ----------
  // 拖动中的幽灵图标跟随光标；松手时按落点决定行为。
  function startItemDrag(e, path, iconHtml, label, paths) {
    if (e.button !== 0) return false;
    const dragPaths = [...new Set((Array.isArray(paths) && paths.length ? paths : [path]).map((p) => VFS.normalize(p)))]
      .filter((p) => VFS.get(p));
    if (!dragPaths.length) return false;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, moved = false;
    let springTarget = null;
    let springTimer = 0;
    const clearSpring = () => {
      clearTimeout(springTimer);
      springTimer = 0;
      springTarget = null;
    };
    const prepareSpring = (target) => {
      const prefs = getFinderPreferences();
      const path = target?.kind === 'dir' && target.el ? target.path : null;
      if (!prefs.springLoaded || !path || dragPaths.includes(path) || path === springTarget) return;
      clearSpring();
      springTarget = path;
      springTimer = setTimeout(() => {
        springTimer = 0;
        if (springTarget !== path || !VFS.isDir(path)) return;
        launch('finder', { path, forceNew:true, springLoaded:true });
        syslog(`弹簧载入文件夹: ${path}`, 'Finder');
      }, 220 + prefs.springDelay * 900);
    };
    function mv(ev) {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      if (!ghost) {
        ghost = el('div', 'drag-ghost');
        const img = el('div', 'dg-img');
        img.innerHTML = iconHtml;
        const caption = el('div', 'dg-label');
        caption.textContent = label;
        ghost.append(img, caption);
        if (dragPaths.length > 1) {
          const badge = el('span', 'dg-count', String(dragPaths.length));
          ghost.appendChild(badge);
        }
        document.body.appendChild(ghost);
        moved = true;
      }
      ghost.style.left = (ev.clientX - 26) + 'px';
      ghost.style.top = (ev.clientY - 26) + 'px';
      const t = dropTargetAt(ev, ghost);
      document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
      if (t && t.el) t.el.classList.add('drop-hot');
      if (t?.kind === 'dir' && t.el) prepareSpring(t);
      else clearSpring();
    }
    function up(ev) {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      clearSpring();
      document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
      if (!moved) { if (ghost) ghost.remove(); return; }
      const t = dropTargetAt(ev, ghost);
      if (ghost) ghost.remove();
      if (!t) return;
      if (t.kind === 'trash') dragPaths.forEach(moveToTrash);
      else if (t.kind === 'dir') dragPaths.forEach((source) => dropInto(source, t.path, ev));
      else if (t.kind === 'dock') {
        const node = VFS.get(dragPaths[0]);
        if (node?.type === 'app' && node.appId) addToDock(node.appId, t.before);
      }
    }
    addEventListener('mousemove', mv);
    addEventListener('mouseup', up);
    return true;
  }

  function dropTargetAt(ev, ghost) {
    if (ghost) ghost.style.display = 'none';
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    if (ghost) ghost.style.display = '';
    if (!under) return null;
    if (trashEl && (under === trashEl || trashEl.contains(under))) return { kind: 'trash', el: trashEl };
    const dockApps = under.closest('#dock-apps');
    if (dockApps) return { kind: 'dock', el: dockApps, before: under.closest('.dock-icon[data-app]') };
    const desk = under.closest('#desktop-icons, #desktop');
    if (desk && !under.closest('.window')) return { kind: 'dir', path: DESK, el: null };
    const folder = under.closest('[data-dir="1"][data-path]');
    if (folder) return { kind: 'dir', path: folder.dataset.path, el: folder };
    const fwin = under.closest('.window[data-app="finder"]');
    if (fwin && fwin._path) return { kind: 'dir', path: fwin._path, el: null };
    return null;
  }

  // 应用拖到别处 → 生成别名（原应用留在 /应用程序）；其余走移动
  function dropInto(src, dstDir, ev) {
    src = VFS.normalize(src); dstDir = VFS.normalize(dstDir);
    const node = VFS.get(src);
    if (!node) return;
    if (ev?.altKey && node.type !== 'app') {
      const copied = VFS.copy(src, dstDir);
      if (copied && dstDir === DESK) placeDeskIcon(VFS.baseName(copied), ev);
      return;
    }
    if (VFS.parentOf(src) === dstDir) { if (dstDir === DESK) placeDeskIcon(VFS.baseName(src), ev); return; }
    if (node.type === 'app') {
      const base = VFS.baseName(src).replace(/\.app$/, '');
      const name = VFS.uniqueName(dstDir, base + ' 别名', '.app');
      VFS.putNode(dstDir + '/' + name, { type: 'app', appId: node.appId, alias: true });
      syslog(`已创建别名: ${name}`, 'Finder');
      if (dstDir === DESK) placeDeskIcon(name, ev);
      return;
    }
    const r = VFS.move(src, dstDir);
    if (r && dstDir === DESK) placeDeskIcon(VFS.baseName(r), ev);
  }

  // 落到桌面时，图标停在鼠标位置
  function placeDeskIcon(name, ev) {
    if (!ev) return;
    const cont = $('#desktop-icons');
    const r = cont.getBoundingClientRect();
    deskPos[name] = {
      x: Math.max(0, Math.min(ev.clientX - r.left - 42, cont.clientWidth - 86)),
      y: Math.max(0, Math.min(ev.clientY - r.top - 26, cont.clientHeight - 92)),
    };
    localStorage.setItem('macweb.deskpos', JSON.stringify(deskPos));
    renderDesktopIcons();
  }

  function moveToTrash(path) {
    path = VFS.normalize(path);
    const node = VFS.get(path);
    if (!node || path === TRASH || path.startsWith(TRASH + '/')) return false;
    const r = VFS.move(path, TRASH, {
      sourcePatch: { from:path },
      label: `将“${VFS.baseName(path)}”移到废纸篓`,
    });
    if (r) syslog(`已移到废纸篓: ${VFS.baseName(path)}`, 'Finder');
    return !!r;
  }

  function updateDock() {
    document.querySelectorAll('#dock-apps .dock-icon').forEach((d) => {
      const app = apps[d.dataset.app];
      d.classList.toggle('running', !!(app && app.windows.length));
    });
  }

  function initMagnify() {
    const dock = $('#dock');
    if (dockMagnifyController) dockMagnifyController.destroy();
    const icons = () => Array.from(dock.querySelectorAll('.dock-icon'));
    let iconList = [];
    let centers = [];
    let pointerX = 0;
    let active = false;
    let dirty = true;
    let frameId = 0;
    let trackingOutside = false;
    let dockBounds = null;

    function measure() {
      iconList = icons();
      // Read every box before writing any transform so pointer movement cannot
      // alternate layout reads and style writes for each Dock icon.
      const rects = iconList.map((ic) => ic.getBoundingClientRect());
      const vertical = dockCfg.position === 'left' || dockCfg.position === 'right';
      centers = rects.map((r) => vertical ? r.top + r.height / 2 : r.left + r.width / 2);
      dockBounds = dock.getBoundingClientRect();
      dirty = false;
    }
    function paint() {
      frameId = 0;
      if (!active || !dockCfg.magnify) return;
      if (dirty) measure();
      iconList.forEach((ic, i) => {
        const d = Math.abs(pointerX - centers[i]);
        const t = Math.max(0, 1 - d / 130);
        const scale = 1 + (Math.max(1.1, +(dockCfg.magnifySize || 1.42)) - 1) * t * t;
        ic.style.transform = `scale(${scale.toFixed(3)})`;
        ic.style.zIndex = Math.round(t * 10);
      });
    }
    function schedule() {
      if (!frameId) frameId = requestAnimationFrame(paint);
    }
    function onMove(e) {
      if (!dockCfg.magnify) {
        reset();
        return;
      }
      pointerX = (dockCfg.position === 'left' || dockCfg.position === 'right') ? e.clientY : e.clientX;
      active = true;
      if (!trackingOutside) {
        trackingOutside = true;
        addEventListener('mousemove', onGlobalMove, { passive: true });
      }
      dock.classList.add('magnifying');
      schedule();
    }
    function onGlobalMove(e) {
      if (!active) return;
      const r = dockBounds || dock.getBoundingClientRect();
      dockBounds = r;
      const pad = 40;
      if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) reset();
    }
    function reset() {
      active = false;
      if (trackingOutside) {
        trackingOutside = false;
        removeEventListener('mousemove', onGlobalMove);
      }
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      dock.classList.remove('magnifying');
      icons().forEach((ic) => { ic.style.transform = ''; ic.style.zIndex = ''; });
    }
    function invalidate() {
      dirty = true;
      dockBounds = null;
      if (active) schedule();
    }
    function onResize() { invalidate(); }

    dock.addEventListener('mousemove', onMove);
    dock.addEventListener('mouseleave', reset);
    addEventListener('resize', onResize, { passive: true });
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(invalidate) : null;
    if (resizeObserver) resizeObserver.observe(dock);

    dockMagnifyController = {
      invalidate,
      reset,
      destroy() {
        reset();
        dock.removeEventListener('mousemove', onMove);
        dock.removeEventListener('mouseleave', reset);
        removeEventListener('resize', onResize);
        if (resizeObserver) resizeObserver.disconnect();
      },
    };
  }

  function invalidateDockMagnify() {
    if (dockMagnifyController) dockMagnifyController.invalidate();
  }

  // ---------- Desktop icons (rendered from VFS 桌面, draggable, right-click menu) ----------
  const DESK = '/用户/roll/桌面';
  let deskPos = {};
  try { deskPos = JSON.parse(localStorage.getItem('macweb.deskpos')) || {}; } catch (e) {}

  function renderDesktopIcons() {
    const cont = $('#desktop-icons');
    cont.innerHTML = '';
    const prefs = getFinderPreferences();
    const items = [];
    if (prefs.desktop.hardDisks) {
      items.push({ key:'Macintosh HD', label:'Macintosh HD', icon:ICONS.hd, path:null });
    }
    if (prefs.desktop.connectedServers) {
      items.push({ key:'roll 的 Mac', label:'roll 的 Mac', icon:ICONS.folder, path:'/用户/roll/公共' });
    }
    (VFS.list(DESK) || []).filter((n) => !n.startsWith('.')).forEach((n) => {
      const p = DESK + '/' + n;
      items.push({ key: n, label: n, icon: System.fileIconFor ? System.fileIconFor(p) : ICONS.textfile, path: p });
    });
    const cw = cont.clientWidth || innerWidth, chh = cont.clientHeight || (innerHeight - 22);
    items.forEach((it, i) => {
      const d = el('div', 'desk-icon');
      const img = el('div', 'di-img');
      img.innerHTML = it.icon;
      const caption = el('div', 'di-label');
      caption.textContent = it.label;
      d.append(img, caption);
      const pos = deskPos[it.key] || { x: cw - 96, y: 8 + i * 92 };
      d.style.left = Math.max(0, Math.min(pos.x, cw - 86)) + 'px';
      d.style.top = Math.max(0, Math.min(pos.y, chh - 92)) + 'px';
      const select = () => {
        document.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('selected'));
        d.classList.add('selected');
      };
      const doOpen = () => it.path ? System.openVfsPath(it.path) : launch('finder', { path: '/' });
      d.addEventListener('dblclick', doOpen);
      d.addEventListener('mousedown', (e) => {
        select();
        if (e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY;
        const ox = parseFloat(d.style.left), oy = parseFloat(d.style.top);
        let moved = false;
        function mv(ev) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
          if (!moved) return;
          d.style.left = Math.max(0, Math.min(ox + ev.clientX - sx, cont.clientWidth - 86)) + 'px';
          d.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, cont.clientHeight - 92)) + 'px';
          const target = it.path && dropTargetAt(ev, d);
          document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
          if (target && target.el) target.el.classList.add('drop-hot');
        }
        function up(ev) {
          removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
          document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
          if (!moved) return;
          // 拖到废纸篓、Finder 文件夹或 Finder 当前目录
          if (it.path) {
            const target = dropTargetAt(ev, d);
            if (target && target.kind === 'trash' && moveToTrash(it.path)) {
              delete deskPos[it.key];
              localStorage.setItem('macweb.deskpos', JSON.stringify(deskPos));
              return;
            }
            if (target && target.kind === 'dir' && target.path !== DESK && VFS.move(it.path, target.path)) {
              delete deskPos[it.key];
              localStorage.setItem('macweb.deskpos', JSON.stringify(deskPos));
              return;
            }
          }
          deskPos[it.key] = { x: parseFloat(d.style.left), y: parseFloat(d.style.top) };
          localStorage.setItem('macweb.deskpos', JSON.stringify(deskPos));
        }
        addEventListener('mousemove', mv);
        addEventListener('mouseup', up);
      });
      d.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        select();
        const menu = [{ label: '打开', action: doOpen }];
        if (it.path && canDownloadVfsFile(it.path)) menu.push({ label: '下载到本地…', action: () => downloadVfsFile(it.path) });
        if (it.path) menu.push({ sep: true }, { label: '移到废纸篓', action: () => moveToTrash(it.path) });
        contextMenu(e, menu);
      });
      cont.appendChild(d);
    });
  }

  function buildDesktop() {
    renderDesktopIcons();
    $('#desktop').addEventListener('mousedown', (e) => {
      if (e.target === $('#desktop') || e.target === $('#desktop-icons')) {
        document.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('selected'));
        setActiveApp('finder');
      }
    });
    $('#desktop').addEventListener('contextmenu', (e) => {
      if (e.target !== $('#desktop') && e.target !== $('#desktop-icons')) return;
      e.preventDefault();
      contextMenu(e, [
        { label: '新建文件夹', action: () => VFS.mkdir(DESK + '/' + VFS.uniqueName(DESK, '未命名文件夹', '')) },
        { sep: true },
        { label: '更改桌面背景…', action: () => launch('sysprefs') },
      ]);
    });
  }

  // ---------- Spotlight ----------
  function initSpotlight() {
    const panel = $('#spotlight'), input = $('#spot-input'), results = $('#spot-results');
    function toggle(show) {
      panel.classList.toggle('hidden', !show);
      input.setAttribute('aria-expanded', String(show));
      if (show) { input.value = ''; results.innerHTML = ''; input.focus(); }
      else if (document.activeElement === input) input.blur();
    }
    $('#mb-spotlight').addEventListener('click', () => toggle(panel.classList.contains('hidden')));
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') { e.preventDefault(); toggle(panel.classList.contains('hidden')); }
      if (e.key === 'Escape') toggle(false);
    });
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#spotlight') && !e.target.closest('#mb-spotlight')) toggle(false);
    });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) return;
      Object.values(apps)
        .filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q) || (a.keywords || '').includes(q))
        .slice(0, 6)
        .forEach((a, i) => {
          const item = el('div', 'spot-item' + (i === 0 ? ' sel' : ''));
          item.innerHTML = `${a.icon}<span>${a.name}</span>`;
          item.addEventListener('click', () => { toggle(false); launch(a.id); });
          results.appendChild(item);
        });
    });
    input.addEventListener('keydown', (e) => {
      const items = [...results.querySelectorAll('.spot-item')];
      if (!items.length) return;
      const selected = Math.max(0, items.findIndex((item) => item.classList.contains('sel')));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const next = (selected + direction + items.length) % items.length;
        items.forEach((item, index) => {
          const active = index === next;
          item.classList.toggle('sel', active);
          item.setAttribute('aria-selected', String(active));
        });
        input.setAttribute('aria-activedescendant', items[next].id || '');
        items[next].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[selected] || items[0]).click();
      }
    });
  }

  // ---------- Sound: system beep + menubar volume slider ----------
  const BEEP_FREQS = {
    glass: [880, 1320], basso: [110, 165], ping: [1500], funk: [220, 277, 330],
    hero: [523, 659, 784], pop: [660], purr: [140, 148], sosumi: [740, 554],
    submarine: [98, 196], tink: [1760, 2093], bottle: [390, 585], blow: [185, 247],
    frog: [165, 196, 147], morse: [660, 660, 440],
  };
  function getSound() {
    const s = { volume: 0.6, muted: false, beep: 'glass' };
    try { Object.assign(s, JSON.parse(localStorage.getItem('macweb.sound')) || {}); } catch (e) {}
    return s;
  }
  function beep(kind, volume) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.5 * volume), ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      g.connect(ctx.destination);
      (BEEP_FREQS[kind] || BEEP_FREQS.glass).forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = 0.5;
        o.connect(og); og.connect(g);
        o.start(); o.stop(ctx.currentTime + 0.7);
      });
      setTimeout(() => ctx.close(), 900);
    } catch (e) {}
  }
  function volumeIconSvg(s) {
    const lvl = s.muted ? 0 : s.volume;
    const waves = lvl <= 0 ? 0 : (lvl < 0.55 ? 1 : 2);
    return `<svg width="16" height="14" viewBox="0 0 16 14"><path d="M1 5h3l4-4v12L4 9H1z" fill="#333"/>` +
      (waves >= 1 ? `<path d="M10 4.5a4 4 0 010 5" stroke="#333" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : '') +
      (waves >= 2 ? `<path d="M12 2.5a7 7 0 010 9" stroke="#333" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : '') +
      (s.muted ? `<line x1="10" y1="2.5" x2="15" y2="11.5" stroke="#333" stroke-width="1.4" stroke-linecap="round"/>` : '') +
      `</svg>`;
  }
  function updateVolumeIcon() { $('#mb-volume').innerHTML = volumeIconSvg(getSound()); }

  function toggleVolumePopup(anchor) {
    if (openMenu && openMenu.anchor === anchor) { closeMenus(); return; }
    closeMenus();
    const dd = el('div', 'menu-dropdown vol-pop');
    const s = getSound();
    const wrap = el('div', 'vol-slider-wrap');
    const input = el('input');
    input.type = 'range'; input.min = 0; input.max = 100;
    input.value = Math.round((s.muted ? 0 : s.volume) * 100);
    wrap.appendChild(input);
    const mute = el('div', 'vol-mute');
    mute.title = '静音';
    const paintMute = () => { mute.innerHTML = volumeIconSvg(getSound()); };
    paintMute();
    dd.append(wrap, mute);
    input.addEventListener('input', () => {
      const s2 = getSound();
      s2.volume = input.value / 100;
      s2.muted = false;
      localStorage.setItem('macweb.sound', JSON.stringify(s2));
      updateVolumeIcon(); paintMute();
    });
    input.addEventListener('change', () => {
      const s2 = getSound();
      if (!s2.muted && s2.volume > 0) beep(s2.beep, s2.volume); // feedback pop on release
    });
    mute.addEventListener('click', () => {
      const s2 = getSound();
      s2.muted = !s2.muted;
      localStorage.setItem('macweb.sound', JSON.stringify(s2));
      input.value = s2.muted ? 0 : Math.round(s2.volume * 100);
      updateVolumeIcon(); paintMute();
    });
    const r = anchor.getBoundingClientRect();
    dd.style.left = Math.round(r.left + r.width / 2 - 20) + 'px';
    dd.style.top = '22px';
    document.body.appendChild(dd);
    anchor.classList.add('open');
    openMenu = { anchor, dd };
  }

  // ---------- Clock (menubar; format prefs live in 系统偏好设置 → 日期与时间) ----------
  let clockTick = null;
  function getClockPrefs() {
    const prefs = { h24: true, showDay: true, showDate: false, showSec: false };
    try { Object.assign(prefs, JSON.parse(localStorage.getItem('macweb.clock')) || {}); } catch (e) {}
    return prefs;
  }
  function updateClockPrefs(patch) {
    const prefs = Object.assign(getClockPrefs(), patch);
    localStorage.setItem('macweb.clock', JSON.stringify(prefs));
    if (clockTick) clockTick();
  }
  function clockMenuItems() {
    const prefs = getClockPrefs();
    const now = new Date();
    return [
      { label:now.toLocaleString('zh-CN', { dateStyle:'full', timeStyle:'medium' }), disabled:true },
      { sep:true },
      { label:`使用 24 小时制${prefs.h24 ? '  ✓' : ''}`, action:()=>updateClockPrefs({ h24:!prefs.h24 }) },
      { label:`显示星期${prefs.showDay ? '  ✓' : ''}`, action:()=>updateClockPrefs({ showDay:!prefs.showDay }) },
      { label:`显示日期${prefs.showDate ? '  ✓' : ''}`, action:()=>updateClockPrefs({ showDate:!prefs.showDate }) },
      { label:`显示秒${prefs.showSec ? '  ✓' : ''}`, action:()=>updateClockPrefs({ showSec:!prefs.showSec }) },
      { sep:true },
      { label:'打开 iCal', action:()=>launch('ical') },
      { label:'打开日期与时间偏好设置…', action:()=>launch('sysprefs', { pane:'datetime' }) },
    ];
  }
  function startClock() {
    const clock = $('#mb-clock');
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const pad = (n) => String(n).padStart(2, '0');
    function tick() {
      const p = getClockPrefs();
      const d = new Date();
      let hh = d.getHours(), ampm = '';
      if (!p.h24) { ampm = hh < 12 ? '上午' : '下午'; hh = hh % 12 || 12; }
      const parts = [];
      if (p.showDate) parts.push(`${d.getMonth() + 1}月${d.getDate()}日`);
      if (p.showDay) parts.push(days[d.getDay()]);
      parts.push(`${ampm}${hh}:${pad(d.getMinutes())}${p.showSec ? ':' + pad(d.getSeconds()) : ''}`);
      clock.textContent = parts.join(' ');
      clock.title = d.toLocaleString('zh-CN', { dateStyle:'full', timeStyle:'medium' });
    }
    tick();
    clockTick = tick;
    setInterval(tick, 1000);
  }

  // ---------- Display brightness & energy saver (prefs from 系统偏好设置) ----------
  function applyBrightness() {
    let b = 1;
    try { b = JSON.parse(localStorage.getItem('macweb.display'))?.brightness ?? 1; } catch (e) {}
    let ov = $('#brightness-ov');
    if (!ov) { ov = el('div'); ov.id = 'brightness-ov'; document.body.appendChild(ov); }
    ov.style.opacity = ((1 - b) * 0.75).toFixed(3);
  }
  let idleTimer = null;
  function initEnergySaver() {
    const reset = () => {
      if (idleTimer) clearTimeout(idleTimer);
      let mins = 0;
      try { mins = JSON.parse(localStorage.getItem('macweb.energy'))?.sleepMin || 0; } catch (e) {}
      if (mins > 0) idleTimer = setTimeout(() => sleepScreen(), mins * 60000);
    };
    ['mousemove', 'mousedown', 'keydown'].forEach((ev) => addEventListener(ev, reset, { passive: true }));
    reset();
  }

  // ---------- Exposé (F9) — GPU-composited window overview ----------
  let exposeOn = false;
  function toggleExpose() {
    const visible = windows.filter((w) => w.style.display !== 'none');
    if (!exposeOn && !visible.length) return;
    exposeOn = !exposeOn;
    document.body.classList.toggle('expose', exposeOn);
    if (exposeOn) {
      visible.forEach((w) => {
        if (w._interactionCleanup) w._interactionCleanup(false);
      });
      const n = visible.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = innerWidth / cols, ch = (innerHeight - 120) / rows;
      const rects = visible.map((w) => w.getBoundingClientRect());
      visible.forEach((w, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const wr = rects[i];
        const scale = Math.min(cw * 0.82 / wr.width, ch * 0.82 / wr.height, 0.9);
        const tx = c * cw + cw / 2 - (wr.left + wr.width / 2);
        const ty = r * ch + ch / 2 + 30 - (wr.top + wr.height / 2);
        w.style.transition = 'transform .3s cubic-bezier(.25,.6,.35,1)';
        w.style.transform = `translate(${tx}px, ${ty}px) scale(${scale.toFixed(3)})`;
        w.classList.add('exposed');
        w._exposeClick = () => { toggleExpose(); focusWindow(w); setActiveApp(w.dataset.app); };
        w.addEventListener('click', w._exposeClick, { capture: true, once: true });
      });
      syslog('Exposé 已激活 (Quartz Extreme 合成)', 'WindowServer');
    } else {
      windows.forEach((w) => {
        w.style.transform = '';
        w.classList.remove('exposed');
        if (w._exposeClick) { w.removeEventListener('click', w._exposeClick, { capture: true }); w._exposeClick = null; }
        setTimeout(() => { if (!exposeOn) w.style.transition = ''; }, 320);
      });
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F9' || e.key === 'F3') { e.preventDefault(); toggleExpose(); }
    else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'Escape') { e.preventDefault(); forceQuitDialog(); }
    else if (e.key === 'Escape' && exposeOn) toggleExpose();
  });

  // ---------- Boot ----------
  function startupChime() {
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

  function boot() {
    installCursorRuntime();
    installShortcutRuntime();
    installBuiltInApps();
    const wp = localStorage.getItem('macweb.wallpaper');
    if (wp) document.body.dataset.wallpaper = wp;
    const wpCss = localStorage.getItem('macweb.wallpaper.css');
    if (wpCss) $('#desktop').style.background = `${wpCss} center / cover no-repeat`;
    document.body.classList.toggle('translucent-menubar', localStorage.getItem('macweb.menubar.translucent') === '1');
    Kexts.applyEffects();
    if (localStorage.getItem('macweb.appearance') === 'graphite') document.body.dataset.appearance = 'graphite';
    applyBrightness();
    initEnergySaver();
    buildDock();
    applyDockCfg();
    buildDesktop();
    initSpotlight();
    startClock();
    document.addEventListener('vfs-changed', () => { renderDesktopIcons(); updateTrashIcon(); });
    $('.mb-apple')._menuItemsProvider = appleMenuItems;
    $('.mb-appname')._menuItemsProvider = appMenuItems;
    $('.mb-apple').addEventListener('mousedown', (e) => { e.stopPropagation(); toggleMenu(e.currentTarget, appleMenuItems()); });
    $('.mb-appname').addEventListener('mousedown', (e) => { e.stopPropagation(); toggleMenu(e.currentTarget, appMenuItems()); });
    $('#menubar').addEventListener('pointerover', (event) => {
      if (!openMenu?.anchor) return;
      const anchor = event.target.closest('.mb-apple,.mb-appname,#mb-menus > .mb-item');
      if (!anchor || anchor === openMenu.anchor) return;
      const items = anchor._menuItemsProvider?.();
      if (Array.isArray(items)) toggleMenu(anchor, items);
    });
    updateVolumeIcon();
    $('#mb-volume').addEventListener('mousedown', (e) => { e.stopPropagation(); toggleVolumePopup(e.currentTarget); });
    $('#mb-clock').addEventListener('mousedown', (e) => { e.stopPropagation(); toggleMenu(e.currentTarget, clockMenuItems()); });
    setActiveApp('finder');
    updateDock();
    startupChime();
    syslog('BSD root: disk0s2, major 14, minor 2');
    syslog('Mac OS X 版本 10.5 (Build 9A581-www)');
    syslog(`CPU: ${HW.cores} 核 · GPU: ${HW.gpu}`);
    syslog(`WindowServer 已启动，Quartz Extreme: ${HW.webgl ? `支持（${HW.graphicsApi}）` : '不支持'}`, 'WindowServer');
    // Leopard boot sequence: apple + spinner, then fade directly to desktop.
    sessionStorage.setItem('macweb.bootShownAt', String(Date.now()));
    setTimeout(() => {
      sessionStorage.setItem('macweb.bootDoneAt', String(Date.now()));
      $('#boot').classList.add('fade');
      syslog('登录窗口就绪，用户 roll 已自动登录', 'loginwindow');
      setTimeout(() => $('#boot').remove(), 700);
      // login items (系统偏好设置 → 账户)
      try {
        (JSON.parse(localStorage.getItem('macweb.loginitems')) || []).forEach((id, i) => {
          if (apps[id]) setTimeout(() => launch(id), 900 + i * 400);
        });
      } catch (e) {}
    }, 2800);
  }

  return { registerApp, launch, createWindow, resizeWindow, fitWindowToContent, closeWindow, minimizeWindow, focusWindow, boot, alertBox, quitApp, el, $, appleIconSvg,
           syslog, syslogBuf, HW, Kexts, uptimeStr, toggleExpose, topWindowOf,
           contextMenu, moveToTrash, emptyTrash, TRASH, forceQuitDialog, startItemDrag,
           confirmBox, showSheet, promptSheet, confirmSheet, openPanel, savePanel, dispatchAppCommand,
           shutdownSequence, kernelPanicSequence, dockCfg, applyDockCfg, applyBrightness,
           addToDock, removeFromDock, persistDockOrder,
           beep, updateVolumeIcon, getSound, beginBusy, canDownloadVfsFile, downloadVfsFile,
           getFinderPreferences, updateFinderPreferences,
           getAppPreferences, updateAppPreferences, showApplicationPreferences,
           addRecentDocument, getRecentItems, clearRecentItems,
           tickClock: () => clockTick && clockTick(),
           get apps() { return apps; }, get windows() { return windows; }, get bootTime() { return bootTime; } };
})();

// ===== Shared Aqua-style SVG icons =====
const ICONS = {
  hd: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="hd-top" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#fcfdff"/><stop offset=".3" stop-color="#d9dee6"/><stop offset=".7" stop-color="#a7afb9"/><stop offset="1" stop-color="#7d8793"/></linearGradient>
      <linearGradient id="hd-front" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#eef1f5"/><stop offset=".45" stop-color="#c5ccd4"/><stop offset=".5" stop-color="#9ea7b2"/><stop offset="1" stop-color="#737d89"/></linearGradient>
      <linearGradient id="hd-edge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#5e6874"/><stop offset=".18" stop-color="#b8c0ca"/><stop offset=".8" stop-color="#7c8793"/><stop offset="1" stop-color="#4d5661"/></linearGradient>
      <radialGradient id="hd-screw"><stop stop-color="#f7f8fa"/><stop offset=".45" stop-color="#9ba4af"/><stop offset="1" stop-color="#525c68"/></radialGradient>
      <filter id="hd-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.3"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#hd-shadow)">
      <path d="M8.5 15.5 14 9.5h36l5.5 6v31.8L50 54.5H14l-5.5-7.2z" fill="url(#hd-edge)" stroke="#4e5863" stroke-width="1"/>
      <path d="M10.5 17.2 15 11.8h34l4.5 5.4v27.5l-4.4 5.6H14.9l-4.4-5.6z" fill="url(#hd-top)" stroke="#7b8590"/>
      <path d="M10.5 35.5h43v9.2l-4.4 5.6H14.9l-4.4-5.6z" fill="url(#hd-front)" stroke="#6e7884" stroke-width=".8"/>
      <path d="M13 20h38M13 33.5h38" stroke="#fff" stroke-opacity=".62"/>
      <path d="M13 34.5h38" stroke="#59636f" stroke-opacity=".75"/>
      <rect x="17" y="39" width="25" height="5.7" rx="1" fill="#e9edf1" stroke="#87919c" stroke-width=".7"/>
      <g fill="#87919c"><rect x="19" y="40.4" width="15" height=".7"/><rect x="19" y="42" width="11" height=".7"/></g>
      <circle cx="47.5" cy="41.8" r="2.1" fill="#2d3842"/><circle cx="47.1" cy="41.3" r=".7" fill="#8ed9ff"/>
      <g fill="url(#hd-screw)" stroke="#4e5964" stroke-width=".45"><circle cx="14.5" cy="17.3" r="1.55"/><circle cx="49.5" cy="17.3" r="1.55"/><circle cx="14.5" cy="46" r="1.55"/><circle cx="49.5" cy="46" r="1.55"/></g>
      <path d="M18 14h28" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".75"/>
    </g>
  </svg>`,
  textfile: `<svg viewBox="0 0 64 64"><path d="M14 4h26l10 10v46H14z" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><path d="M40 4l10 10H40z" fill="#d8d8d8" stroke="#8a8a8a" stroke-width="1.5"/><g stroke="#9aa4c0" stroke-width="2"><line x1="20" y1="24" x2="44" y2="24"/><line x1="20" y1="31" x2="44" y2="31"/><line x1="20" y1="38" x2="44" y2="38"/><line x1="20" y1="45" x2="36" y2="45"/></g></svg>`,
  folder: `<svg viewBox="0 0 64 64"><defs><linearGradient id="fldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd1f7"/><stop offset="1" stop-color="#5aa0dd"/></linearGradient></defs><path d="M6 16 q0 -4 4 -4 h14 l6 6 h24 q4 0 4 4 v28 q0 4 -4 4 H10 q-4 0 -4 -4 z" fill="url(#fldg)" stroke="#3a6ea8" stroke-width="1.5"/><path d="M6 24 h52 v-2 q0 -4 -4 -4 H30 l-6 -6 H10 q-4 0 -4 4 z" fill="#fff" opacity=".28"/></svg>`,
  trash: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="tr-glass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#92a3b5" stop-opacity=".58"/><stop offset=".18" stop-color="#f8fbff" stop-opacity=".76"/><stop offset=".5" stop-color="#cbd6e2" stop-opacity=".45"/><stop offset=".82" stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#8393a5" stop-opacity=".62"/></linearGradient>
      <linearGradient id="tr-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fdfefe"/><stop offset=".45" stop-color="#aab7c4"/><stop offset=".55" stop-color="#748291"/><stop offset="1" stop-color="#dce4eb"/></linearGradient>
      <filter id="tr-shadow" x="-30%" y="-20%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".4"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="tr-clip"><path d="M15.5 17.5 20 57h24l4.5-39.5z"/></clipPath>
    </defs>
    <g filter="url(#tr-shadow)">
      <path d="M15.5 17.5 20 57h24l4.5-39.5z" fill="url(#tr-glass)" stroke="#677686" stroke-width="1.15"/>
      <g clip-path="url(#tr-clip)" fill="none" stroke="#748596" stroke-width=".75" opacity=".75">
        <path d="M20 14 25 60M28 14l1 46M36 14l-1 46M44 14l-5 46"/>
        <path d="M14 25h36M16 33h32M17 41h30M18 49h28"/>
      </g>
      <path d="M18.7 53.5h26.6L44 57H20z" fill="#8393a3" opacity=".72"/>
      <ellipse cx="32" cy="17.6" rx="17" ry="4.8" fill="url(#tr-rim)" stroke="#627180" stroke-width="1"/>
      <ellipse cx="32" cy="17.2" rx="14.3" ry="2.5" fill="#8190a0" opacity=".62"/>
      <path d="M18.8 16.3c4.4-2.3 22-2.9 26.5.2" fill="none" stroke="#fff" stroke-width="1" opacity=".8"/>
      <path d="M20.5 22.5 24 52M43.5 22.5 40 52" stroke="#fff" stroke-width=".8" opacity=".55"/>
    </g>
  </svg>`,
  trashFull: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="trf-glass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#899aac" stop-opacity=".7"/><stop offset=".18" stop-color="#f7fbff" stop-opacity=".82"/><stop offset=".52" stop-color="#bfccd9" stop-opacity=".58"/><stop offset=".82" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#7c8c9e" stop-opacity=".72"/></linearGradient>
      <linearGradient id="trf-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#a5b3c0"/><stop offset=".55" stop-color="#697887"/><stop offset="1" stop-color="#dfe6ed"/></linearGradient>
      <filter id="trf-shadow" x="-30%" y="-35%" width="160%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="trf-clip"><path d="M15.5 17.5 20 57h24l4.5-39.5z"/></clipPath>
    </defs>
    <g filter="url(#trf-shadow)">
      <g clip-path="url(#trf-clip)" stroke="#697786" stroke-width=".7">
        <path d="m17 25 5-8 8 5-3 10z" fill="#f3f1e9"/><path d="m26 25 9-7 7 8-8 8z" fill="#fffdf5"/>
        <path d="m38 25 8-6 5 10-10 5z" fill="#e8edf3"/><path d="m22 31 5-8 8 7-3 8z" fill="#dce7f4"/>
        <path d="m31 36 7-9 8 7-4 10z" fill="#eee7d8"/>
      </g>
      <path d="M15.5 17.5 20 57h24l4.5-39.5z" fill="url(#trf-glass)" stroke="#637282" stroke-width="1.15"/>
      <g clip-path="url(#trf-clip)" fill="none" stroke="#6f8193" stroke-width=".75" opacity=".8">
        <path d="M20 14 25 60M28 14l1 46M36 14l-1 46M44 14l-5 46"/>
        <path d="M14 25h36M16 33h32M17 41h30M18 49h28"/>
      </g>
      <path d="M18.7 53.5h26.6L44 57H20z" fill="#7c8d9e" opacity=".75"/>
      <ellipse cx="32" cy="17.6" rx="17" ry="4.8" fill="url(#trf-rim)" stroke="#5c6b7a" stroke-width="1"/>
      <ellipse cx="32" cy="17.2" rx="14.3" ry="2.5" fill="#778798" opacity=".67"/>
      <path d="M18.8 16.3c4.4-2.3 22-2.9 26.5.2" fill="none" stroke="#fff" stroke-width="1" opacity=".85"/>
      <path d="M20.5 22.5 24 52M43.5 22.5 40 52" stroke="#fff" stroke-width=".8" opacity=".58"/>
    </g>
  </svg>`,
};
