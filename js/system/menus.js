// System subsystem: menus
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, HOME_DISPLAY_NAME, paths } from '../config.js';
import { t } from '../i18n/index.js';
import { html } from '../escape.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
// ---------- Application command routing ----------

  // Copy/cut prefer the async Clipboard API and fall back to execCommand, since
  // Clipboard API needs a secure context, a user gesture, and (inside a
  // cross-origin iframe) a clipboard-write permission policy.
  function selectedText() {
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
      const start = typeof active.selectionStart === 'number' ? active.selectionStart : 0;
      const end = typeof active.selectionEnd === 'number' ? active.selectionEnd : 0;
      return String(active.value ?? '').slice(start, end);
    }
    try { return window.getSelection?.()?.toString() || ''; } catch (e) { return ''; }
  }

  function writeClipboard(text) {
    if (!navigator.clipboard?.writeText) return Promise.reject(new Error('Clipboard API unavailable'));
    return navigator.clipboard.writeText(text);
  }

  function copySelection() {
    const text = selectedText();
    const legacy = () => { try { return document.execCommand('copy'); } catch (e) { return false; } };
    if (!text) return legacy();
    return writeClipboard(text).then(() => true, legacy);
  }

  function cutSelection() {
    const text = selectedText();
    if (!text) return false;
    const removeSelection = () => {
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        try {
          const start = typeof active.selectionStart === 'number' ? active.selectionStart : 0;
          const end = typeof active.selectionEnd === 'number' ? active.selectionEnd : String(active.value ?? '').length;
          const value = String(active.value ?? '');
          active.value = value.slice(0, start) + value.slice(end);
          active.setSelectionRange(start, start);
        } catch (e) {}
      } else {
        try {
          const selection = window.getSelection?.();
          if (selection && !selection.isCollapsed) selection.deleteFromDocument();
        } catch (e) {}
      }
    };
    const legacy = () => { try { return document.execCommand('cut'); } catch (e) { return false; } };
    return writeClipboard(text).then(() => { removeSelection(); return true; }, legacy);
  }

  sys.dispatchAppCommand = function dispatchAppCommand(appId, command, detail) {
    const front = sys.topWindowOf(appId);
    const win = sys.apps[appId]?.commandTarget?.(command, front) || front;
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
      case 'new-window': sys.launch(appId, { forceNew: true }); return true;
      case 'open-document':
        if (!win) return false;
        sys.openPanel({
          parent:win, title:t('dialog.open'), startPath:paths.home,
          onOpen:(path)=>{ System.openVfsPath?.(path); },
        });
        return true;
      case 'close-window': if (win) sys.closeWindow(win); return !!win;
      case 'minimize': if (win) sys.minimizeWindow(win); return !!win;
      case 'zoom': win?.querySelector('.tl-zoom')?.click(); return !!win;
      case 'copy': return copySelection();
      case 'cut': return cutSelection();
      // paste / undo / redo / delete / selectAll still use execCommand: paste
      // needs clipboard-read permission and cursor insertion, undo/redo have no
      // Clipboard API equivalent, and delete/selectAll are editing operations.
      case 'paste': case 'undo': case 'redo': case 'delete': case 'selectAll':
        try { return document.execCommand(command); } catch (e) { return false; }
      default: return false;
    }
  }

  sys.cmd = (appId, label, command, shortcut, extra) => Object.assign({
    label, shortcut, action: () => sys.dispatchAppCommand(appId, command),
  }, extra || {});

  sys.editMenu = function editMenu(appId) {
    return { title: t('menu.edit'), items: [
      sys.cmd(appId, t('edit.undo'), 'undo', '⌘Z'), sys.cmd(appId, t('edit.redo'), 'redo', '⇧⌘Z'),
      { sep: true },
      sys.cmd(appId, t('edit.cut'), 'cut', '⌘X'), sys.cmd(appId, t('edit.copy'), 'copy', '⌘C'),
      sys.cmd(appId, t('edit.paste'), 'paste', '⌘V'), sys.cmd(appId, t('edit.delete'), 'delete', '⌫'),
      { sep: true }, sys.cmd(appId, t('edit.selectAll'), 'selectAll', '⌘A'),
    ]};
  };

  sys.windowMenu = function windowMenu(appId) {
    const appWindows = sys.apps[appId]?.windows || [];
    const front = sys.topWindowOf(appId);
    return { title: t('menu.window'), items: [
      sys.cmd(appId, t('window.minimize'), 'minimize', '⌘M'), sys.cmd(appId, t('window.zoom'), 'zoom'),
      { sep: true },
      { label: t('window.expose'), shortcut: 'F9', action: () => sys.toggleExpose() },
      { label: t('window.bringAllToFront'), action: () => sys.apps[appId].windows.forEach((w) => sys.focusWindow(w)) },
      ...(appWindows.length ? [
        { sep:true },
        ...appWindows.map((win) => ({
          label: win._title?.textContent || sys.apps[appId].name,
          checked: win === front,
          action: () => { sys.restoreWindow(win); sys.focusWindow(win); sys.setActiveApp(appId); },
        })),
      ] : []),
    ]};
  };


  sys.helpViewerIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="help-face" cx=".35" cy=".25"><stop stop-color="#dff7ff"/><stop offset=".45" stop-color="#65b7e8"/><stop offset="1" stop-color="#17659f"/></radialGradient><filter id="help-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".4"/></filter></defs><g filter="url(#help-shadow)"><circle cx="32" cy="32" r="27" fill="url(#help-face)" stroke="#355f7d" stroke-width="1.5"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-opacity=".58"/><path d="M23 24c.8-7 6.1-10 12-9.4 6.4.6 10.2 4.7 9.6 10.1-.5 4.8-3.6 7.1-7.1 9.3-3 1.9-4.6 3.6-4.6 7.3" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32.5" cy="49" r="3.5" fill="#fff"/></g></svg>`;

  sys.HELP_ARTICLE_IDS = [
    { id: 'welcome', appIds: ['finder'] },
    { id: 'finder-basics', appIds: ['finder'] },
    { id: 'finder-navigation', appIds: ['finder'] },
    { id: 'open-save', appIds: ['finder', 'textedit', 'preview'] },
    { id: 'quick-look', appIds: ['finder', 'preview'] },
    { id: 'safari-browsing', appIds: ['safari'] },
    { id: 'mail-basics', appIds: ['mail'] },
    { id: 'system-preferences', appIds: ['sysprefs', 'finder'] },
    { id: 'app-preferences', appIds: ['finder'] },
    { id: 'accessibility', appIds: ['sysprefs'] },
    { id: 'browser-permissions', appIds: ['sysprefs', 'photobooth', 'ichat'] },
  ];

  sys.helpArticlesResolved = function helpArticlesResolved() {
    return sys.HELP_ARTICLE_IDS.map((meta) => ({
      id: meta.id,
      appIds: meta.appIds,
      category: t(`help.${meta.id}.category`),
      title: t(`help.${meta.id}.title`),
      summary: t(`help.${meta.id}.summary`),
      html: t(`help.${meta.id}.html`),
    }));
  };
  // Back-compat alias used throughout this module
  Object.defineProperty(sys, 'HELP_ARTICLES', {
    get() { return sys.helpArticlesResolved(); },
    configurable: true,
  });

  sys.helpEscape = html;

  sys.appHelpArticle = function appHelpArticle(appId) {
    const app = sys.apps[appId];
    if (!app || appId === 'helpviewer') return null;
    const profile = sys.appPreferenceProfile?.(appId);
    const preferenceText = profile
      ? `<h2>${t('help.ui.preferences')}</h2><p>${sys.helpEscape(profile.summary || '')}</p>`
      : '';
    return {
      id: `app-${appId}`,
      category: t('help.ui.appCategory'),
      title: t('help.ui.appHelp', { name: app.name }),
      summary: app.about || t('help.ui.learnApp', { name: app.name }),
      appIds: [appId],
      html: `${preferenceText}<h2>${t('help.ui.commonTasks')}</h2><p>${t('help.ui.learnApp', { name: app.name })}</p>`,
    };
  };

  sys.openHelpViewer = function openHelpViewer(arg) {
    arg = arg || {};
    const existing = sys.apps.helpviewer?.windows?.at?.(-1);
    if (existing?.isConnected && existing._openHelp) {
      existing._openHelp(arg);
      sys.restoreWindow(existing);
      sys.focusWindow(existing);
      sys.setActiveApp('helpviewer');
      return existing;
    }
    const requestedAppId = sys.apps[arg.appId] ? arg.appId : 'finder';
    const root = sys.el('div', 'help-viewer');
    const toolbar = sys.el('div', 'help-toolbar');
    const back = sys.el('button', 'finder-toolbar-btn', '◀');
    back.title = t('help.ui.back');
    const forward = sys.el('button', 'finder-toolbar-btn', '▶');
    forward.title = t('help.ui.forward');
    const home = sys.el('button', 'finder-toolbar-btn help-home-button', `⌂ ${t('help.ui.home')}`);
    const search = sys.el('input', 'aqua-input aqua-search help-search');
    search.placeholder = t('help.ui.search');
    search.setAttribute('aria-label', t('help.ui.search'));
    toolbar.append(back, forward, home, search);
    const sidebar = sys.el('aside', 'help-sidebar');
    const content = sys.el('main', 'help-content');
    root.append(sidebar, content);
    let history = [];
    let historyIndex = -1;
    let scopeAppId = requestedAppId;

    const articles = () => {
      const generated = sys.appHelpArticle(scopeAppId);
      const base = sys.helpArticlesResolved();
      return generated ? [generated, ...base] : base.slice();
    };
    const articleById = (id) => articles().find((article) => article.id === id);
    const updateNav = () => {
      back.disabled = historyIndex <= 0;
      forward.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
    };
    const renderSidebar = (selectedId) => {
      const app = sys.apps[scopeAppId] || sys.apps.finder;
      const grouped = new Map();
      articles().forEach((article) => {
        if (!grouped.has(article.category)) grouped.set(article.category, []);
        grouped.get(article.category).push(article);
      });
      sidebar.innerHTML = '';
      const head = sys.el('div', 'help-sidebar-head');
      head.innerHTML = `${app.icon || ''}<div><b>${sys.helpEscape(app.name)}</b><small>Mac Help</small></div>`;
      sidebar.appendChild(head);
      grouped.forEach((list, category) => {
        sidebar.appendChild(sys.el('strong', '', category));
        list.forEach((article) => {
          const button = sys.el('button', selectedId === article.id ? 'sel' : '');
          button.dataset.helpArticle = article.id;
          button.innerHTML = `<b>${sys.helpEscape(article.title)}</b><span>${sys.helpEscape(article.summary)}</span>`;
          sidebar.appendChild(button);
        });
      });
    };
    const renderState = (state) => {
      if (state.kind === 'article') {
        const article = articleById(state.id) || sys.helpArticlesResolved()[0];
        content.innerHTML = `<article class="help-article"><header><h1>${sys.helpEscape(article.title)}</h1><p>${sys.helpEscape(article.summary)}</p></header>${article.html}</article>`;
        renderSidebar(article.id);
      } else if (state.kind === 'search') {
        const q = state.query.toLowerCase();
        const matches = articles().filter((a) =>
          `${a.title} ${a.summary} ${a.html}`.toLowerCase().includes(q));
        content.innerHTML = `<header><h1>${sys.helpEscape(state.query)}</h1></header><section>${matches.map((article) =>
          `<button data-help-article="${article.id}"><b>${sys.helpEscape(article.title)}</b><span>${sys.helpEscape(article.summary)}</span></button>`).join('') || `<p>—</p>`}</section>`;
        renderSidebar('');
      } else {
        const relevant = articles().slice(0, 8);
        content.innerHTML = `<header><h1>Mac Help</h1></header><section class="help-topic-grid">${relevant.map((article) =>
          `<button data-help-article="${article.id}"><b>${sys.helpEscape(article.title)}</b><span>${sys.helpEscape(article.summary)}</span></button>`).join('')}</section>`;
        renderSidebar('');
      }
      updateNav();
    };
    const pushState = (state) => {
      history = history.slice(0, historyIndex + 1);
      history.push(state);
      historyIndex = history.length - 1;
      renderState(state);
    };
    const showArticle = (id) => pushState({ kind: 'article', id });
    const showHome = () => pushState({ kind: 'home' });
    const showSearch = (query) => pushState({ kind: 'search', query: query.trim() });

    sidebar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-help-article]');
      if (button) showArticle(button.dataset.helpArticle);
    });
    content.addEventListener('click', (event) => {
      const article = event.target.closest('[data-help-article]');
      if (article) showArticle(article.dataset.helpArticle);
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

    if (!sys.apps.helpviewer) {
      sys.registerApp({
        id: 'helpviewer',
        name: 'Mac Help',
        icon: sys.helpViewerIcon,
        open: () => sys.openHelpViewer(),
        multiWindow: false,
      });
    }
    const win = sys.createWindow({
      app: 'helpviewer', title: 'Mac Help', width: 820, height: 560,
      toolbar, content: root, bodyBg: '#ececec',
    });
    win._openHelp = (next) => {
      scopeAppId = sys.apps[next?.appId] ? next.appId : scopeAppId;
      if (next?.articleId) showArticle(next.articleId);
      else if (next?.query) { search.value = next.query; showSearch(next.query); }
      else if (next?.focusSearch) { showHome(); search.focus(); }
      else showHome();
    };
    win._openHelp(arg);
    return win;
  };

  sys.helpMenu = function helpMenu(appId) {
    const app = sys.apps[appId];
    return { title: t('menu.help'), items: [
      { label: t('help.ui.appHelp', { name: app ? app.name : '' }), shortcut: '⌘?', action: () => sys.launch('helpviewer', { appId }) },
      { sep: true },
      { label: t('common.search'), action: () => sys.launch('helpviewer', { appId, focusSearch: true }) },
    ]};
  };

  sys.extraMenu = (appId, title, entries) => ({
    title,
    items: entries.map((entry) => entry.sep ? entry : sys.cmd(appId, entry.label, entry.command, entry.shortcut, entry)),
  });

  sys.profiledMenus = function profiledMenus(appId) {
    if (appId === 'helpviewer') return [
      { title:t('u.49deaf7da2'), items:[
        sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
      ]},
      sys.editMenu(appId),
      sys.extraMenu(appId,t('u.23926d6146'),[
        { label:t('u.4cf4c11a1b'), command:'back', shortcut:'⌘[' },
        { label:t('u.320ffeefca'), command:'forward', shortcut:'⌘]' },
        { sep:true },
        { label:t('u.b243c8abf4'), command:'help-home', shortcut:'⌘⇧H' },
        { label:t('u.7ba4942953'), command:'help-search', shortcut:'⌘F' },
      ]),
      sys.windowMenu(appId), sys.helpMenu(appId),
    ];
    if (appId === 'safari') return [
      { title: t('u.49deaf7da2'), items: [
        sys.cmd(appId, t('u.7dd1b16c1a'), 'new-window', '⌘N'), sys.cmd(appId, t('u.7b451ecb8c'), 'new-tab', '⌘T'),
        sys.cmd(appId, t('u.b5520cd65f'), 'open-location', '⌘L'), { sep: true },
        sys.cmd(appId, t('u.70eebdd597'), 'close-tab', '⌘W'), sys.cmd(appId, t('u.51daeffe47'), 'close-window', '⇧⌘W'),
      ]},
      sys.editMenu(appId),
      sys.extraMenu(appId, t('u.71b6771bc7'), [
        { label:t('u.a17f70a8d3'), command:'stop', shortcut:'⌘.' }, { label:t('u.3418966129'), command:'reload', shortcut:'⌘R' },
        { sep:true }, { label:t('u.d7f48a059c'), command:'zoom-in', shortcut:'⌘+' },
        { label:t('u.11f8516f82'), command:'zoom-out', shortcut:'⌘-' }, { label:t('u.6ef49ec0be'), command:'actual-size', shortcut:'⌘0' },
      ]),
      sys.extraMenu(appId, t('u.19e0e3f3df'), [
        { label:t('u.4cf4c11a1b'), command:'back', shortcut:'⌘[' }, { label:t('u.320ffeefca'), command:'forward', shortcut:'⌘]' },
        { sep:true }, { label:t('u.c564b74ab7'), command:'show-history' },
      ]),
      sys.extraMenu(appId, t('u.820f5b6440'), [
        { label:t('u.b0e255a1da'), command:'add-bookmark', shortcut:'⌘D' },
        { label:t('u.e3e4e97b80'), command:'show-bookmarks', shortcut:'⌥⌘B' },
      ]),
      sys.windowMenu(appId), sys.helpMenu(appId),
    ];
    if (appId === 'textedit') {
      const documentWindow = sys.topWindowOf('textedit');
      const recentDocuments = sys.getRecentItems().documents.filter((entry) => !entry.appId || entry.appId === 'textedit');
      const richDocument = documentWindow?.dataset.texteditRich !== 'false';
      const spellcheck = documentWindow?.dataset.texteditSpellcheck !== 'false';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.0cda8d1c71'),'new-window','⌘N'), sys.cmd(appId,t('u.7e736d9399'),'open-document','⌘O'),
          { label:t('u.0a680a6645'), submenu:recentDocuments.length
            ? recentDocuments.map((entry) => ({ label:VFS.baseName(entry.path), action:() => sys.openRecentDocument(entry) }))
            : [{ label:t('u.f4180a803b'), disabled:true }] },
          { sep:true },
          sys.cmd(appId,t('u.091ca5213e'),'save','⌘S', { disabled:!documentWindow || (!documentWindow._documentDirty && !!documentWindow._path) }),
          sys.cmd(appId,t('u.513ae8367b'),'save-as','⇧⌘S', { disabled:!documentWindow }),
          sys.cmd(appId,t('u.e65d312ec9'),'revert-document',null, {
            disabled:!documentWindow?._path || !documentWindow?._documentDirty,
          }),
          { sep:true }, sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W', { disabled:!documentWindow }),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.9fcefd8dc8'),'undo','⌘Z'),sys.cmd(appId,t('u.1238f0d363'),'redo','⇧⌘Z'),
          { sep:true },
          sys.cmd(appId,t('u.29b653b40e'),'cut','⌘X'),sys.cmd(appId,t('u.bc6d0279b6'),'copy','⌘C'),
          sys.cmd(appId,t('u.de7fb7d3cf'),'paste','⌘V'),sys.cmd(appId,t('u.3755f56f2f'),'delete','⌫'),
          { sep:true },sys.cmd(appId,t('u.3e44b2a933'),'selectAll','⌘A'),
          { sep:true },sys.cmd(appId,t('u.edc8af92d5'),'find-text','⌘F'),
        ]},
        { title:t('u.9d2601c843'), items:[
          { label:t('u.b50d4d8352'), submenu:[
            sys.cmd(appId,t('u.757e74a74b'),'show-fonts','⌘T'),
            { sep:true },
            sys.cmd(appId,t('u.67c6b77f89'),'bold','⌘B'), sys.cmd(appId,t('u.af5a2c8bff'),'italic','⌘I'),
            sys.cmd(appId,t('u.9bc18ae51e'),'underline','⌘U'),sys.cmd(appId,t('u.c85de9e58a'),'strikeThrough','⇧⌘X'), { sep:true },
            sys.cmd(appId,t('u.8945fd7afe'),'bigger','⌘+'), sys.cmd(appId,t('u.60826abde5'),'smaller','⌘-'),
          ]},
          { label:t('u.f1926e9b33'), submenu:[
            sys.cmd(appId,t('u.413f8db65f'),'justifyLeft'),
            sys.cmd(appId,t('u.5009324782'),'justifyCenter'),
            sys.cmd(appId,t('u.70fe40dec2'),'justifyRight'),
            { sep:true },
            sys.cmd(appId,t('u.3ca3566410'),'insertUnorderedList','⇧⌘L'),
            sys.cmd(appId,t('u.a56b2365de'),'indent','⌘]'),
            sys.cmd(appId,t('u.31e50e4e44'),'outdent','⌘['),
          ]},
          sys.cmd(appId,t('u.d6e7dba5e8'),'insert-link','⌘K',{disabled:!richDocument}),
          { sep:true },
          sys.cmd(appId,richDocument?t('u.345f14818a'):t('u.4830c9f634'),richDocument?'make-plain':'make-rich','⇧⌘T'),
          { sep:true },
          sys.cmd(appId, documentWindow?.querySelector('.te-ruler')?.classList.contains('hidden') ? t('u.1e3603bf7a') : t('u.7662cc69d3'), 'toggle-ruler', '⌘R'),
          sys.cmd(appId,t('u.3f164839d6'),'toggle-spelling',null,{checked:spellcheck}),
        ]},
        sys.windowMenu(appId), sys.helpMenu(appId),
      ];
    }
    if (appId === 'preview') return [
      { title:t('u.49deaf7da2'), items:[
        sys.cmd(appId,t('u.7e736d9399'),'open-document','⌘O'), { sep:true },
        sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'), sys.cmd(appId,t('u.513ae8367b'),'save-as','⇧⌘S'),
      ]},
      sys.editMenu(appId),
      sys.extraMenu(appId, t('u.71b6771bc7'), [
        { label:t('u.a4287e8a74'), command:'toggle-sidebar', shortcut:'⇧⌘D' },
        { sep:true }, { label:t('u.d7f48a059c'), command:'zoom-in', shortcut:'⌘+' },
        { label:t('u.11f8516f82'), command:'zoom-out', shortcut:'⌘-' }, { label:t('u.6ef49ec0be'), command:'actual-size', shortcut:'⌘0' },
        { label:t('u.2d1e40e077'), command:'zoom-fit', shortcut:'⌘9' },
      ]),
      sys.extraMenu(appId, t('u.23926d6146'), [{ label:t('u.b41561d807'), command:'previous-page' }, { label:t('u.67a246a344'), command:'next-page' }]),
      sys.extraMenu(appId, t('u.a72ef18d9a'), [
        { label:t('u.7522db8625'), command:'rotate-left', shortcut:'⌘L' },
        { label:t('u.97f4eaae3c'), command:'rotate-right', shortcut:'⌘R' },
        { label:t('u.3d6178edd1'), command:'show-inspector', shortcut:'⌘I' },
      ]),
      sys.windowMenu(appId), sys.helpMenu(appId),
    ];
    if (appId === 'ical') {
      const calendarWindow = sys.topWindowOf('ical');
      const view = calendarWindow?.dataset.icalView || 'month';
      const todoVisible = calendarWindow?.dataset.icalTodoVisible === 'true';
      const eventSelected = calendarWindow?.dataset.icalEventSelected === 'true';
      const canDeleteCalendar = calendarWindow?.dataset.icalCanDeleteCalendar === 'true';
      const hasEvents = calendarWindow?.dataset.icalHasEvents === 'true';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.e9bf9a0598'),'new-event','⌘N'),
          sys.cmd(appId,t('u.b34d1ee208'),'new-todo','⇧⌘N'),
          sys.cmd(appId,t('u.1f2d050269'),'new-calendar','⌥⌘N'),
          sys.cmd(appId,t('u.d24db20d4f'),'subscribe-calendar','⌥⌘S'),
          { sep:true },
          sys.cmd(appId,t('u.d4b4b049ac'),'import-ics','⇧⌘I'),
          sys.cmd(appId,t('u.aa093cf6ec'),'export-ics','⇧⌘E',{disabled:!hasEvents}),
          { sep:true }, sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        sys.extraMenu(appId, t('u.71b6771bc7'), [
          { label:t('u.15917f3b32'), command:'day-view', shortcut:'⌘1', checked:view === 'day' },
          { label:t('u.451b86707b'), command:'week-view', shortcut:'⌘2', checked:view === 'week' },
          { label:t('u.d9b59879f3'), command:'month-view', shortcut:'⌘3', checked:view === 'month' },
          { sep:true },
          { label:t('u.1aa1659adc'), command:'today', shortcut:'⌘T' },
          { label:todoVisible ? t('u.8488fe6270') : t('u.90db1ac6be'), command:'toggle-todos', shortcut:'⌥⌘T', checked:todoVisible },
          { label:t('u.f04090805c'), command:'focus-search', shortcut:'⌘F' },
        ]),
        sys.extraMenu(appId, t('u.2ecbc11608'), [
          { label:t('u.8e732e1f3d'), command:'refresh', shortcut:'⌘R' },
          { label:t('u.d24db20d4f'), command:'subscribe-calendar' },
          { sep:true },
          { label:t('u.d4b4b049ac'), command:'import-ics' },
          { label:t('u.aa093cf6ec'), command:'export-ics', disabled:!hasEvents },
          { sep:true },
          { label:t('u.68800f7485'), command:'delete-calendar', disabled:!canDeleteCalendar },
        ]),
        sys.extraMenu(appId, t('u.550e328062'), [
          { label:t('u.57578d3702'), command:'event-info', shortcut:'⌘I', disabled:!eventSelected },
          { label:t('u.23c8fc8b41'), command:'edit-event', shortcut:'⌘E', disabled:!eventSelected },
          { label:t('u.e4b862fdd7'), command:'duplicate-event', disabled:!eventSelected },
          { sep:true },
          { label:t('u.bb6671fba5'), command:'attach-event', disabled:!eventSelected },
          { label:t('u.1b9d53532f'), command:'event-availability', disabled:!eventSelected },
          { sep:true },
          { label:t('u.f10087a871'), command:'delete-event', shortcut:'⌫', disabled:!eventSelected },
        ]),
        sys.windowMenu(appId), sys.helpMenu(appId),
      ];
    }
    if (appId === 'mail') return [
      { title:t('u.49deaf7da2'), items:[
        sys.cmd(appId,t('u.865e6292bb'),'new-message','⌘N'), sys.cmd(appId,t('u.7e736d9399'),'open-document','⌘O'),
        { sep:true }, sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
      ]},
      sys.editMenu(appId),
      sys.extraMenu(appId,t('u.71b6771bc7'),[
        {label:t('u.0f7a81d50f'),command:'get-mail',shortcut:'⇧⌘N'},
      ]),
      sys.extraMenu(appId,t('u.9ed627bcf6'),[
        {label:t('u.c1f384067c'),command:'get-mail',shortcut:'⌘K'},
      ]),
      sys.extraMenu(appId,t('u.1c8e464184'),[
        {label:t('u.ffc7850925'),command:'reply-message',shortcut:'⌘R'},
        {label:t('u.0d5a8ac36f'),command:'forward-message',shortcut:'⇧⌘F'},
        {sep:true},{label:t('u.e25762f172'),command:'delete',shortcut:'⌫'},
      ]),
      sys.extraMenu(appId,t('u.9d2601c843'),[
        {label:t('u.757e74a74b'),command:'show-fonts',shortcut:'⌘T',disabled:!sys.topWindowOf('mail')?.querySelector('.mail-compose-body')},
        {sep:true},
        {label:t('u.67c6b77f89'),command:'bold',shortcut:'⌘B',disabled:!sys.topWindowOf('mail')?.querySelector('.mail-compose-body')},
        {label:t('u.af5a2c8bff'),command:'italic',shortcut:'⌘I',disabled:!sys.topWindowOf('mail')?.querySelector('.mail-compose-body')},
      ]),
      sys.windowMenu(appId),sys.helpMenu(appId),
    ];
    if (appId === 'addressbook') return [
      { title:t('u.49deaf7da2'), items:[
        sys.cmd(appId,t('u.a1b1d1f19e'),'new-contact','⌘N'),
        {sep:true},sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
      ]},
      sys.editMenu(appId),
      sys.extraMenu(appId,t('u.71b6771bc7'),[{label:t('u.f3d5d902e0'),command:'show-card',shortcut:'⌘I'}]),
      sys.extraMenu(appId,t('u.43b438d9af'),[
        {label:t('u.a1b1d1f19e'),command:'new-contact',shortcut:'⌘N'},
        {label:t('u.36f6c32a90'),command:'delete',shortcut:'⌫'},
      ]),
      sys.extraMenu(appId,t('u.4260caf1c9'),[
        {label:t('u.07285a4e83'),command:'new-group',shortcut:'⇧⌘N'},
        {label:t('u.98ccb96830'),command:'delete-group',disabled:!sys.topWindowOf('addressbook')?.dataset.addressGroup?.startsWith('group-')},
      ]),
      sys.windowMenu(appId),sys.helpMenu(appId),
    ];

    if (appId === 'ichat') {
      const win = sys.topWindowOf('ichat');
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.3059f3ba9d'),'new-chat','⌘N'), sys.cmd(appId,t('u.5a0a27ae07'),'new-window','⇧⌘N'),
          { sep:true }, sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        sys.extraMenu(appId,t('u.71b6771bc7'),[
          {label:t('u.26e5bdcfb3'),command:'toggle-buddy-pictures',checked:win?.dataset.buddyPictures !== 'false'},
          {label:t('u.eeb9f2a13b'),command:'toggle-offline-buddies',checked:win?.dataset.showOffline === 'true'},
        ]),
        sys.extraMenu(appId,t('u.e84c3ae935'),[
          {label:t('u.e7f49f976a'),command:'add-buddy',shortcut:'⌘B'},
          {label:t('u.9e255bd7c6'),command:'buddy-info',shortcut:'⌘I'},
        ]),
        sys.extraMenu(appId,t('u.fa4e33b698'),[
          {label:t('u.3b0745464c'),command:'video-chat'},
          {label:t('u.73b28e588a'),command:'audio-chat'},
          {label:t('u.ad55b97a46'),command:'screen-share'},
        ]),
        sys.windowMenu(appId), sys.helpMenu(appId),
      ];
    }
    if (appId === 'dictionary') {
      const win = sys.topWindowOf('dictionary');
      const tab = win?.dataset.dictionaryTab || 'definition';
      const historyCount = Number(win?.dataset.dictionaryHistory || 0);
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.5468339645'),'copy','⌘C'),
          { sep:true },sys.cmd(appId,t('u.87f23cc1dd'),'focus-search','⌘F'),
        ]},
        { title:t('u.23926d6146'), items:[
          sys.cmd(appId,t('u.091d53c118'),'history-back','⌘[',{disabled:historyCount<2}),
          { sep:true },sys.cmd(appId,t('u.1bc9655929'),'clear-history',null,{disabled:historyCount===0}),
        ]},
        { title:t('u.51bdb46bc2'), items:[
          sys.cmd(appId,t('u.51bdb46bc2'),'source-dictionary',null,{checked:tab==='definition'}),
          sys.cmd(appId,t('u.6a10b8d58e'),'source-thesaurus',null,{checked:tab==='thesaurus'}),
          sys.cmd(appId,'Apple','source-apple',null,{checked:tab==='apple'}),
          sys.cmd(appId,'Wikipedia','source-wikipedia',null,{checked:tab==='wikipedia'}),
          { sep:true },sys.cmd(appId,t('u.04541e4f6d'),'pronounce','⌘L'),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'photobooth') {
      const win = sys.topWindowOf('photobooth');
      const cameraOn = win?.dataset.photoBoothCamera === 'true';
      const selected = win?.dataset.photoBoothSelection === 'true';
      const capturing = win?.dataset.photoBoothCapturing === 'true';
      const effect = win?.dataset.photoBoothEffect || '';
      const mirrored = win?.dataset.photoBoothMirrored !== 'false';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.00884d8f53'),'open-selected-photo','⌘O',{disabled:!selected}),
          sys.cmd(appId,t('u.6df2aa0a1c'),'reveal-selected-photo',null,{disabled:!selected}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.b8c0614f5b'),'delete-selected-photo','⌫',{disabled:!selected||capturing}),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.b5247faf8d'),'toggle-mirror-preview',null,{checked:mirrored}),
        ]},
        { title:t('u.6f67e21080'), items:[
          sys.cmd(appId,cameraOn?t('u.c442d022b3'):t('u.48793c9f0e'),'toggle-camera',null,{disabled:capturing}),
          sys.cmd(appId,t('u.3da4b3651a'),'take-photo','Space',{disabled:!cameraOn||capturing}),
          { sep:true },
          sys.cmd(appId,t('u.97f8242ca9'),'show-effects'),
          sys.cmd(appId,t('u.f78d037abc'),'effect-normal',null,{checked:effect===''}),
          sys.cmd(appId,t('u.dd742f472f'),'effect-mono',null,{checked:effect==='grayscale(1)'}),
          sys.cmd(appId,t('u.f9e309affd'),'effect-sepia',null,{checked:effect==='sepia(1)'}),
          sys.cmd(appId,t('u.803cd0e10d'),'effect-pencil',null,{checked:effect==='hue-rotate(120deg) saturate(1.7)'}),
          sys.cmd(appId,t('u.0afaca049b'),'effect-pop',null,{checked:effect==='contrast(2) saturate(2)'}),
          sys.cmd(appId,t('u.99b67f5ff9'),'effect-xray',null,{checked:effect==='invert(1)'}),
        ]},
        { title:t('u.48e9e53252'), items:[
          sys.cmd(appId,t('u.3d68e5ccba'),'open-selected-photo',null,{disabled:!selected}),
          sys.cmd(appId,t('u.6df2aa0a1c'),'reveal-selected-photo',null,{disabled:!selected}),
          sys.cmd(appId,t('u.e25762f172'),'delete-selected-photo','⌫',{disabled:!selected||capturing}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'itunes') {
      const win = sys.topWindowOf('itunes');
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.e2512a2db6'),'new-playlist','⌘N'),
          sys.cmd(appId,t('u.08a69fc6d9'),'delete-playlist',null,{disabled:!win?.dataset.currentPlaylist}),
          {sep:true},sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        sys.extraMenu(appId,t('u.71b6771bc7'),[
          {label:win?.dataset.browserHidden === 'true' ? t('u.e089d5dbb8') : t('u.4b02d8846c'),command:'toggle-browser',shortcut:'⌘B'},
          {label:win?.dataset.sidebarHidden === 'true' ? t('u.ddb08321f5') : t('u.2a6a58e659'),command:'toggle-source-list'},
        ]),
        sys.extraMenu(appId,t('u.22382630ef'),[
          {label:t('u.d3cc62c36d'),command:'play-pause',shortcut:'Space'},
          {label:t('u.e8fa515afe'),command:'previous-track',shortcut:'⌘←'},
          {label:t('u.bacea782a7'),command:'next-track',shortcut:'⌘→'},
          {sep:true},
          {label:t('u.eca2a5188f'),command:'toggle-shuffle',checked:win?.dataset.shuffle === 'true'},
          {label:t('u.49dd557480'),command:'toggle-repeat-one',checked:win?.dataset.repeatOne === 'true'},
        ]),
        sys.extraMenu(appId,'Store',[
          {label:t('u.27323cc933'),command:'store-home',shortcut:'⌘H'},
          {label:t('u.d43fc01dcf'),command:'check-downloads'},
        ]),
        sys.extraMenu(appId,t('u.c009d0ab82'),[
          {label:t('u.52e22d24de'),command:'show-equalizer',shortcut:'⌘2'},
          {label:t('u.3a6cb48361'),command:'get-artwork'},
        ]),
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'automator') {
      const win = sys.topWindowOf('automator');
      const running = win?.dataset.automatorRunning === 'true';
      const hasSteps = win?.dataset.automatorHasSteps === 'true';
      const hasSelection = win?.dataset.automatorSelection === 'true';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.ed8bf7aff6'),'new-workflow','⌘N'),
          sys.cmd(appId,t('u.7e736d9399'),'open-document','⌘O'),
          { sep:true },
          sys.cmd(appId,t('u.091ca5213e'),'save','⌘S',{disabled:running}),
          sys.cmd(appId,t('u.513ae8367b'),'save-as','⇧⌘S',{disabled:running}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.a2d2ec5976'),'remove-action','⌫',{disabled:running||!hasSelection}),
          { sep:true },sys.cmd(appId,t('u.038a3bb7be'),'focus-search','⌘F'),
        ]},
        { title:t('u.5f059df046'), items:[
          sys.cmd(appId,t('u.0c3acd446f'),'run-workflow','⌘R',{disabled:running||!hasSteps}),
          sys.cmd(appId,t('u.a17f70a8d3'),'stop-workflow','⌘.',{disabled:!running}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'calculator') {
      const win = sys.topWindowOf('calculator');
      const mode = win?.dataset.calculatorMode || 'basic';
      const tapeVisible = win?.dataset.calculatorTape === 'true';
      const hasTape = win?.dataset.calculatorHasTape === 'true';
      const rpn = win?.dataset.calculatorRpn === 'true';
      const grouping = win?.dataset.calculatorGrouping !== 'false';
      const speechKeys = win?.dataset.calculatorSpeechKeys === 'true';
      const speechResults = win?.dataset.calculatorSpeechResults === 'true';
      const decimals = win?.dataset.calculatorDecimals || 'auto';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.761d981352'),'save-paper-tape','⇧⌘S',{disabled:!hasTape}),
          sys.cmd(appId,t('u.67534ea2a6'),'print-paper-tape','⌘P',{disabled:!hasTape}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.a0be4d5541'),'copy-result','⌘C'),
          sys.cmd(appId,t('u.a95d12872a'),'paste-number','⌘V'),
          { sep:true },sys.cmd(appId,t('u.7b15e5e8e7'),'clear-calculator','⌘K'),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.9dc5c00373'),'mode-basic','⌘1',{checked:mode==='basic'}),
          sys.cmd(appId,t('u.59be646548'),'mode-scientific','⌘2',{checked:mode==='scientific'}),
          sys.cmd(appId,t('u.ea4d6e039e'),'mode-programmer','⌘3',{checked:mode==='programmer'}),
          { sep:true },
          sys.cmd(appId,tapeVisible?t('u.58b0b8ee7c'):t('u.6a1b748772'),'toggle-paper-tape','⌘T'),
          sys.cmd(appId,t('u.f7e3b19e15'),'toggle-rpn','⌘R',{checked:rpn,disabled:mode==='programmer'}),
          sys.cmd(appId,t('u.ceeef7eb78'),'toggle-grouping',null,{checked:grouping}),
          { label:t('u.ff82703332'), submenu:[
            sys.cmd(appId,t('u.4afad87755'),'decimals-auto',null,{checked:decimals==='auto'}),
            sys.cmd(appId,t('u.4a0a8a8d60'),'decimals-0',null,{checked:decimals==='0'}),
            sys.cmd(appId,t('u.547bcd73ac'),'decimals-2',null,{checked:decimals==='2'}),
            sys.cmd(appId,t('u.1e03fc8477'),'decimals-5',null,{checked:decimals==='5'}),
            sys.cmd(appId,t('u.785fd662e3'),'decimals-9',null,{checked:decimals==='9'}),
          ]},
        ]},
        { title:t('u.942742d797'), items:[
          sys.cmd(appId,t('u.5a92c1294b'),'convert-length',null),
          sys.cmd(appId,t('u.9ae5b4979e'),'convert-area',null),
          sys.cmd(appId,t('u.e6e5ab73ae'),'convert-volume',null),
          sys.cmd(appId,t('u.5a45a5ea8c'),'convert-mass',null),
          sys.cmd(appId,t('u.d01dc58b76'),'convert-temperature',null),
          sys.cmd(appId,t('u.e52ea0d711'),'convert-speed',null),
          sys.cmd(appId,t('u.8986ff81f5'),'convert-time',null),
          sys.cmd(appId,t('u.e4a31103cc'),'convert-energy',null),
          sys.cmd(appId,t('u.d7d90a0df3'),'convert-power',null),
          sys.cmd(appId,t('u.90412a89e1'),'convert-pressure',null),
        ]},
        { title:t('u.7a73e125c1'), items:[
          sys.cmd(appId,t('u.084160067e'),'toggle-speak-keys',null,{checked:speechKeys}),
          sys.cmd(appId,t('u.ea3dbc2ec5'),'toggle-speak-results',null,{checked:speechResults}),
          { sep:true },
          sys.cmd(appId,t('u.338bec0da3'),'speak-result',null),
          sys.cmd(appId,t('u.e1217385e5'),'stop-speaking',null),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'stickies') {
      const win = sys.topWindowOf('stickies');
      const color = win?.dataset.stickyColor || 'yellow';
      const floating = win?.dataset.stickyFloating === 'true';
      const translucent = win?.dataset.stickyTranslucent === 'true';
      const collapsed = win?.dataset.stickyCollapsed === 'true';
      const hasText = win?.dataset.stickyHasText === 'true';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.25c4289553'),'new-sticky','⌘N'),
          sys.cmd(appId,t('u.0b91ed22bb'),'import-sticky','⌘O'),
          { sep:true },
          sys.cmd(appId,t('u.8f65105166'),'export-sticky','⌘S',{disabled:!hasText}),
          sys.cmd(appId,t('u.0bcb0d77e8'),'export-all-stickies',null),
          { sep:true },sys.cmd(appId,t('u.20cd61260a'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.9fcefd8dc8'),'undo','⌘Z'),sys.cmd(appId,t('u.1238f0d363'),'redo','⇧⌘Z'),
          { sep:true },
          sys.cmd(appId,t('u.29b653b40e'),'cut','⌘X'),sys.cmd(appId,t('u.bc6d0279b6'),'copy','⌘C'),
          sys.cmd(appId,t('u.de7fb7d3cf'),'paste','⌘V'),sys.cmd(appId,t('u.3755f56f2f'),'delete','⌫'),
          { sep:true },sys.cmd(appId,t('u.3e44b2a933'),'selectAll','⌘A'),
          { sep:true },sys.cmd(appId,t('u.87f23cc1dd'),'focus-sticky-find','⌘F'),
        ]},
        { title:t('u.7e4831a8a3'), items:[
          sys.cmd(appId,t('u.603853b2cc'),'toggle-sticky-floating','⌥⌘F',{checked:floating}),
          sys.cmd(appId,t('u.678cc67d75'),'toggle-sticky-translucent','⌥⌘T',{checked:translucent}),
          sys.cmd(appId,collapsed?t('u.b0e24833f7'):t('u.5d5815647c'),'toggle-sticky-collapsed','⌘M'),
          sys.cmd(appId,t('u.12e2ed4d50'),'zoom-sticky',null),
          { sep:true },sys.cmd(appId,t('u.09d7b87d52'),'use-sticky-default',null),
        ]},
        { title:t('u.8ef4886033'), items:[
          sys.cmd(appId,t('u.c33860af15'),'sticky-color-yellow',null,{checked:color==='yellow'}),
          sys.cmd(appId,t('u.43f2550e7e'),'sticky-color-blue',null,{checked:color==='blue'}),
          sys.cmd(appId,t('u.81dd83dcbe'),'sticky-color-green',null,{checked:color==='green'}),
          sys.cmd(appId,t('u.c0f8347c65'),'sticky-color-pink',null,{checked:color==='pink'}),
          sys.cmd(appId,t('u.df52498f50'),'sticky-color-purple',null,{checked:color==='purple'}),
          sys.cmd(appId,t('u.5996c71fae'),'sticky-color-gray',null,{checked:color==='gray'}),
        ]},
        { title:t('u.b50d4d8352'), items:[
          sys.cmd(appId,t('u.67c6b77f89'),'sticky-bold','⌘B'),
          sys.cmd(appId,t('u.af5a2c8bff'),'sticky-italic','⌘I'),
          sys.cmd(appId,t('u.9bc18ae51e'),'sticky-underline','⌘U'),
          sys.cmd(appId,t('u.c85de9e58a'),'sticky-strike','⇧⌘X'),
          sys.cmd(appId,t('u.3ca3566410'),'sticky-list','⇧⌘L'),
          { sep:true },
          { label:t('u.b50d4d8352'), submenu:[
            sys.cmd(appId,'Marker Felt','sticky-font-marker',null),
            sys.cmd(appId,'Lucida Grande','sticky-font-lucida',null),
            sys.cmd(appId,'Monaco','sticky-font-monaco',null),
            sys.cmd(appId,'Georgia','sticky-font-georgia',null),
          ]},
          sys.cmd(appId,t('u.8945fd7afe'),'sticky-font-bigger','⌘+'),
          sys.cmd(appId,t('u.60826abde5'),'sticky-font-smaller','⌘-'),
        ]},
        { title:t('u.a70a15135c'), items:[
          { label:t('u.a921e1a31a'), submenu:[
            sys.cmd(appId,t('u.dfc43a45e9'),'arrange-stickies-screen',null),
            sys.cmd(appId,t('u.8ef4886033'),'arrange-stickies-color',null),
            sys.cmd(appId,t('u.163aec9194'),'arrange-stickies-content',null),
            sys.cmd(appId,t('u.f1ec63ea51'),'arrange-stickies-date',null),
          ]},
          sys.cmd(appId,t('u.d36a0a0dd0'),'bring-stickies-front',null),
          { sep:true },
          sys.cmd(appId,t('u.7305410922'),'collapse-all-stickies',null),
          sys.cmd(appId,t('u.64edd632fb'),'expand-all-stickies',null),
        ]},
        sys.helpMenu(appId),
      ];
    }
    if (appId === 'activity') {
      const win = sys.topWindowOf('activity');
      const hasSelection = win?.dataset.activityCanInspect === 'true';
      const canQuit = win?.dataset.activityCanQuit === 'true';
      const resource = win?.dataset.activityResource || 'cpu';
      const scope = win?.dataset.activityScope || 'all';
      const sort = win?.dataset.activitySort || 'cpu';
      const rate = Number(win?.dataset.activityUpdateRate || 1000);
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.dd54d2a6ac'),'inspect-process','⌘I',{disabled:!hasSelection}),
          sys.cmd(appId,t('u.f916c019c7'),'sample-process','⌥⌘S',{disabled:!hasSelection}),
          sys.cmd(appId,t('u.d7463fcdb2'),'quit-process',null,{disabled:!canQuit}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.87f23cc1dd'),'focus-search','⌘F'),
        ]},
        { title:t('u.71b6771bc7'), items:[
          { label:t('u.4eb4768d27'), submenu:[
            sys.cmd(appId,t('u.a88e6fbdbd'),'scope-all',null,{checked:scope==='all'}),
            sys.cmd(appId,t('u.35f641c466'),'scope-my',null,{checked:scope==='my'}),
            sys.cmd(appId,t('u.637ede5d1e'),'scope-active',null,{checked:scope==='active'}),
            sys.cmd(appId,t('u.0b2029c6b3'),'scope-windowed',null,{checked:scope==='windowed'}),
          ]},
          { label:t('u.3bf3689a69'), submenu:[
            sys.cmd(appId,t('u.4296e838c0'),'sort-name',null,{checked:sort==='name'}),
            sys.cmd(appId,t('u.736ef3a9e2'),'sort-pid',null,{checked:sort==='pid'}),
            sys.cmd(appId,'CPU','sort-cpu',null,{checked:sort==='cpu'}),
            sys.cmd(appId,t('u.ba9471f120'),'sort-memory',null,{checked:sort==='memory'}),
          ]},
          { label:t('u.45eee632b5'), submenu:[
            sys.cmd(appId,t('u.9f46cc1482'),'update-very-often',null,{checked:rate===500}),
            sys.cmd(appId,t('u.7559c92aef'),'update-often',null,{checked:rate===1000}),
            sys.cmd(appId,t('u.14413f8899'),'update-normal',null,{checked:rate===2000}),
            sys.cmd(appId,t('u.1bd7c4644f'),'update-slow',null,{checked:rate===5000}),
          ]},
          { sep:true },sys.cmd(appId,t('u.c0417a25dd'),'refresh-now','⌘R'),
        ]},
        { title:t('u.9f4c0917f0'), items:[
          sys.cmd(appId,'CPU','show-cpu','⌘1',{checked:resource==='cpu'}),
          sys.cmd(appId,t('u.5022cccb3e'),'show-memory','⌘2',{checked:resource==='memory'}),
          sys.cmd(appId,t('u.179be6ae1f'),'show-disk-activity','⌘3',{checked:resource==='diskactivity'}),
          sys.cmd(appId,t('u.c3cec3620c'),'show-disk-usage','⌘4',{checked:resource==='diskusage'}),
          sys.cmd(appId,t('u.0cbda6b524'),'show-network','⌘5',{checked:resource==='network'}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'fontbook') {
      const win = sys.topWindowOf('fontbook');
      const hasSelection = !!win?.dataset.fontbookSelection;
      const enabled = win?.dataset.fontbookEnabled === 'true';
      const favorite = win?.dataset.fontbookFavorite === 'true';
      const canRemove = win?.dataset.fontbookCanRemove === 'true';
      const canDeleteCollection = win?.dataset.fontbookCanDeleteCollection === 'true';
      const view = win?.dataset.fontbookView || 'sample';
      const collection = win?.dataset.fontbookCollection || 'all';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.7054619de6'),'install-font','⌘O'),
          sys.cmd(appId,t('u.aa76d85650'),'scan-local-fonts',null),
          { sep:true },
          sys.cmd(appId,t('u.e0517f5b9d'),'new-collection','⌘N'),
          sys.cmd(appId,t('u.dc87cd17db'),'delete-collection',null,{disabled:!canDeleteCollection}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.87f23cc1dd'),'focus-search','⌘F'),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.610da878ac'),'show-sample','⌘1',{checked:view==='sample'}),
          sys.cmd(appId,t('u.f67a7a0253'),'show-repertoire','⌘2',{checked:view==='repertoire'}),
          sys.cmd(appId,t('u.eecd0d1b1c'),'show-custom','⌘3',{checked:view==='custom'}),
          sys.cmd(appId,t('u.3d10787961'),'show-font-info','⌘I',{checked:view==='info'}),
          { sep:true },
          sys.cmd(appId,t('u.d06b61b609'),'larger-preview','⌘+',{disabled:!hasSelection}),
          sys.cmd(appId,t('u.1e18de1f14'),'smaller-preview','⌘-',{disabled:!hasSelection}),
        ]},
        { title:t('u.b50d4d8352'), items:[
          sys.cmd(appId,t('u.4ccccf137e'),'validate-font',null,{disabled:!hasSelection}),
          sys.cmd(appId,enabled?t('u.8c3e08f812'):t('u.1065b643fb'),'toggle-font-enabled',null,{disabled:!hasSelection}),
          sys.cmd(appId,favorite?t('u.03f0b0bbec'):t('u.df52d4a3dd'),'toggle-font-favorite',null,{disabled:!hasSelection}),
          { sep:true },sys.cmd(appId,t('u.78fec302a0'),'remove-font',null,{disabled:!canRemove}),
        ]},
        { title:t('u.63719041b6'), items:[
          sys.cmd(appId,t('u.89672c77fb'),'show-all-fonts',null,{checked:collection==='all'}),
          sys.cmd(appId,t('u.e6f497d8b4'),'show-favorites',null,{checked:collection==='favorites'}),
          sys.cmd(appId,t('u.ec87a4b867'),'show-computer-fonts',null,{checked:collection==='computer'}),
          sys.cmd(appId,t('u.9ba763ea34'),'show-user-fonts',null,{checked:collection==='user'}),
          { sep:true },sys.cmd(appId,t('u.e0517f5b9d'),'new-collection','⌘N'),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'netutil') {
      const win = sys.topWindowOf('netutil');
      const busy = win?.dataset.netutilBusy === 'true';
      const canRun = win?.dataset.netutilCanRun === 'true';
      const hasOutput = win?.dataset.netutilHasOutput === 'true';
      const tab = win?.dataset.netutilTab || 'info';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.e72b3b6fd3'),'copy-output','⌘C',{disabled:!hasOutput}),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.2da40f4073'),'show-info','⌘1',{checked:tab==='info',disabled:busy}),
          sys.cmd(appId,'Netstat','show-netstat','⌘2',{checked:tab==='netstat',disabled:busy}),
          sys.cmd(appId,'AppleTalk','show-appletalk','⌘3',{checked:tab==='appletalk',disabled:busy}),
          sys.cmd(appId,'Ping','show-ping','⌘4',{checked:tab==='ping',disabled:busy}),
          sys.cmd(appId,'Lookup','show-lookup','⌘5',{checked:tab==='lookup',disabled:busy}),
          sys.cmd(appId,'Traceroute','show-traceroute','⌘6',{checked:tab==='trace',disabled:busy}),
          sys.cmd(appId,'Whois','show-whois','⌘7',{checked:tab==='whois',disabled:busy}),
          sys.cmd(appId,'Finger','show-finger','⌘8',{checked:tab==='finger',disabled:busy}),
          sys.cmd(appId,t('u.355922e844'),'show-portscan','⌘9',{checked:tab==='portscan',disabled:busy}),
        ]},
        { title:t('u.5b04bca2ea'), items:[
          sys.cmd(appId,t('u.79cc871ca9'),'run-current','⌘↩',{disabled:busy||!canRun}),
          sys.cmd(appId,t('u.a17f70a8d3'),'stop-operation','⌘.',{disabled:!busy}),
          { sep:true },sys.cmd(appId,t('u.756e9a94c4'),'refresh-info','⌘R',{disabled:busy}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'consoleapp') {
      const win = sys.topWindowOf('consoleapp');
      const selected = !!win?.dataset.consoleSelection;
      const showSources = win?.dataset.consoleShowSources !== 'false';
      const showInspector = win?.dataset.consoleShowInspector === 'true';
      const following = win?.dataset.consoleFollowing !== 'false';
      const hasEntries = win?.dataset.consoleHasEntries === 'true';
      const source = win?.dataset.consoleSource || 'all';
      const level = win?.dataset.consoleLevel || 'all';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.207b2587d2'),'export-log','⌘S',{disabled:!hasEntries}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.815215ca76'),'copy-entry','⌘C',{disabled:!selected}),
          { sep:true },sys.cmd(appId,t('u.87f23cc1dd'),'focus-search','⌘F'),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,showSources?t('u.88c1207e34'):t('u.b547dc3bf0'),'toggle-log-list','⌥⌘L'),
          sys.cmd(appId,showInspector?t('u.018e593289'):t('u.3d6178edd1'),'toggle-log-inspector','⌘I'),
          sys.cmd(appId,t('u.ad7a03ca54'),'toggle-log-follow',null,{checked:following}),
          sys.cmd(appId,t('u.d963e17038'),'reload-log','⌘R'),
          { sep:true },
          { label:t('u.a76c7c0bc7'), submenu:[
            sys.cmd(appId,t('u.ee143bacbe'),'source-all',null,{checked:source==='all'}),
            sys.cmd(appId,t('u.a0a5f683a8'),'source-errors',null,{checked:source==='errors'}),
            sys.cmd(appId,t('u.af1341fbea'),'source-console',null,{checked:source==='console'}),
            sys.cmd(appId,t('u.5995b61254'),'source-system',null,{checked:source==='system'}),
          ]},
          { label:t('u.0ada7b0dfd'), submenu:[
            sys.cmd(appId,t('u.ee143bacbe'),'level-all',null,{checked:level==='all'}),
            sys.cmd(appId,t('u.189cd35c8c'),'level-warn',null,{checked:level==='warn'}),
            sys.cmd(appId,t('u.9e9bf2c972'),'level-error',null,{checked:level==='error'}),
          ]},
        ]},
        { title:t('u.f3ea6d345e'), items:[
          sys.cmd(appId,t('u.895204af90'),'insert-marker','⇧⌘M'),
          sys.cmd(appId,t('u.f3ebcc2801'),'clear-display','⌘K',{disabled:!hasEntries}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'migration' || appId === 'bootcamp') {
      const win = sys.topWindowOf(appId);
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
        ? appId === 'migration' ? t('u.b4c8e41020') : t('u.5e59842d58')
        : complete ? t('u.33246f6a5e') : t('u.1fc1afc5c5');
      const common = [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.f3ea6d345e'), items:[
          sys.cmd(appId,t('u.11d0241540'),'assistant-back',null,{disabled:!canBack}),
          sys.cmd(appId,actionLabel,'assistant-continue',null,{disabled:!canContinue}),
          sys.cmd(appId,busy?(committed?t('u.e730d3ed03'):t('u.a17f70a8d3')):t('u.4d0b4688c7'),'assistant-cancel',null,{disabled:!canCancel}),
          ...(appId === 'migration' && complete
            ? [{sep:true},sys.cmd(appId,t('u.b3f66c1cf4'),'assistant-restart')]
            : []),
          ...(appId === 'bootcamp' && complete
            ? [{sep:true},sys.cmd(appId,t('u.5fc7bc3af0'),'bootcamp-restart')]
            : []),
        ]},
      ];
      if (appId === 'bootcamp') common.push({
        title:'Boot Camp',
        items:[
          sys.cmd(appId,t('u.ed333ff742'),'bootcamp-use-dvd',null,{checked:media==='dvd',disabled:page!=='media'||busy}),
          sys.cmd(appId,t('u.c45234b071'),'bootcamp-choose-iso',null,{checked:media==='iso',disabled:page!=='media'||busy}),
          {sep:true},
          sys.cmd(appId,'Windows 32 GB','bootcamp-32gb',null,{disabled:page!=='partition'||busy}),
          sys.cmd(appId,t('u.8918de45bd'),'bootcamp-equal',null,{disabled:page!=='partition'||busy}),
        ],
      });
      common.push(
        { title:t('u.0a2c91cec6'), items:[
          sys.cmd(appId,t('u.69387d95b4'),'assistant-open-report',null,{disabled:!hasResult}),
          sys.cmd(appId,t('u.6df2aa0a1c'),'assistant-reveal-result',null,{disabled:!hasResult}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      );
      return common;
    }
    if (appId === 'diskutil') {
      const win = sys.topWindowOf('diskutil');
      const busy = win?.dataset.diskutilBusy === 'true';
      const tab = win?.dataset.diskutilTab || 'firstaid';
      const role = win?.dataset.diskutilRole || 'volume';
      const mounted = win?.dataset.diskutilMounted === 'true';
      const canErase = win?.dataset.diskutilCanErase === 'true';
      const canMount = role !== 'device' && win?.dataset.diskutilSelection !== 'macintosh';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.23af30a4fd'),'new-disk-image','⌘N',{disabled:busy}),
          { sep:true },
          sys.cmd(appId,t('u.d3eda18f01'),'show-disk-info','⌘I'),
          sys.cmd(appId,t('u.7b072ce064'),'refresh-storage','⌘R',{disabled:busy}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        { title:t('u.679afa276c'), items:[
          sys.cmd(appId,mounted?t('u.0fc909b78a'):t('u.d1da93ddeb'),'toggle-mount',null,{disabled:busy||!canMount}),
          sys.cmd(appId,t('u.36a4b64205'),'new-disk-image',null,{disabled:busy}),
          { sep:true },
          sys.cmd(appId,t('u.f106947601'),'show-restore',null,{checked:tab==='restore',disabled:busy}),
          sys.cmd(appId,t('u.b955ce99ce'),'restore-image',null,{disabled:busy}),
        ]},
        { title:t('u.25d5f98120'), items:[
          sys.cmd(appId,t('u.4fe5469889'),'verify-disk',null,{disabled:busy}),
          sys.cmd(appId,t('u.6685c808af'),'repair-disk',null,{disabled:busy}),
          { sep:true },
          sys.cmd(appId,t('u.c435f259db'),'verify-permissions',null,{disabled:busy}),
          sys.cmd(appId,t('u.2d73072c89'),'repair-permissions',null,{disabled:busy}),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.25d5f98120'),'show-firstaid',null,{checked:tab==='firstaid',disabled:busy}),
          sys.cmd(appId,t('u.d163c91357'),'show-erase',null,{checked:tab==='erase',disabled:busy}),
          sys.cmd(appId,t('u.223f914032'),'show-partition',null,{checked:tab==='partition',disabled:busy}),
          sys.cmd(appId,'RAID','show-raid',null,{checked:tab==='raid',disabled:busy}),
          sys.cmd(appId,t('u.79748ca1c6'),'show-restore',null,{checked:tab==='restore',disabled:busy}),
          { sep:true },
          sys.cmd(appId,t('u.96956eac13'),'security-options',null,{disabled:busy||!canErase}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'grab') {
      const win = sys.topWindowOf('grab');
      const hasCapture = win?.dataset.grabHasCapture === 'true';
      const saved = win?.dataset.grabSaved === 'true';
      const busy = win?.dataset.grabBusy === 'true';
      const canCrop = win?.dataset.grabCanCrop === 'true';
      const mode = win?.dataset.grabMode || 'selection';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.359721eae5'),'save','⌘S',{disabled:!hasCapture||busy}),
          sys.cmd(appId,t('u.513ae8367b'),'save-as','⇧⌘S',{disabled:!hasCapture||busy}),
          { sep:true },
          sys.cmd(appId,t('u.3d68e5ccba'),'open-preview',null,{disabled:!hasCapture||busy}),
          sys.cmd(appId,t('u.6df2aa0a1c'),'reveal-capture',null,{disabled:!saved||busy}),
          sys.cmd(appId,t('u.6584b4c39b'),'download-capture',null,{disabled:!saved||busy}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.71c44bd311'),'copy','⌘C',{disabled:!hasCapture||busy}),
        ]},
        { title:t('u.875b5fe326'), items:[
          sys.cmd(appId,t('u.c85117a9a4'),'capture-selection','⇧⌘A',{disabled:busy,checked:mode==='selection'}),
          sys.cmd(appId,t('u.a70a15135c'),'capture-window','⇧⌘W',{disabled:busy,checked:mode==='window'}),
          sys.cmd(appId,t('u.c68cb70ece'),'capture-screen','⌘Z',{disabled:busy,checked:mode==='screen'}),
          sys.cmd(appId,t('u.9919aef547'),'capture-timed','⇧⌘Z',{disabled:busy,checked:mode==='timed'}),
          ...(busy?[{sep:true},sys.cmd(appId,t('u.72aec357a1'),'cancel-capture','Esc')]:[]),
        ]},
        { title:t('u.0a0ce84dde'), items:[
          sys.cmd(appId,t('u.b6ed06b056'),'apply-crop',null,{disabled:!canCrop||busy}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'keychain') {
      const win = sys.topWindowOf('keychain');
      const hasSelection = win?.dataset.keychainSelection === 'true';
      const locked = win?.dataset.keychainLocked !== 'false';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.edda631c2e'),'new-item','⌘N'),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.3755f56f2f'),'delete','⌫',{disabled:!hasSelection}),
          { sep:true },sys.cmd(appId,t('u.6cb005a629'),'focus-search','⌘F'),
        ]},
        { title:t('u.71b6771bc7'), items:[
          sys.cmd(appId,t('u.32c3ad426d'),'show-all',null),
          sys.cmd(appId,t('u.c839a8ff17'),'show-passwords',null),
          sys.cmd(appId,t('u.4cb58d725f'),'show-certificates',null),
          { sep:true },sys.cmd(appId,t('u.4e68014350'),'show-item-info','⌘I',{disabled:!hasSelection}),
        ]},
        { title:t('u.8209f13866'), items:[
          sys.cmd(appId,locked?t('u.48f8bb65be'):t('u.008a88975e'),'toggle-lock',null),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'imagecapture') {
      const win = sys.topWindowOf('imagecapture');
      const selected = Number(win?.dataset.captureSelection || 0);
      const fileCount = Number(win?.dataset.captureFiles || 0);
      const hasImport = win?.dataset.captureLastImport === 'true';
      return [
        { title:t('u.49deaf7da2'), items:[
          sys.cmd(appId,t('u.6ce3378b27'),'add-vfs-images','⌘O'),
          sys.cmd(appId,t('u.d810e9de40'),'choose-files','⇧⌘O'),
          { sep:true },
          sys.cmd(appId,t('u.58d59cd5cc'),'import-selection','⌘D',{disabled:!selected}),
          sys.cmd(appId,t('u.d5e350e514'),'import-all','⌥⌘D',{disabled:!fileCount}),
          { sep:true },sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        { title:t('u.a7f814c0a4'), items:[
          sys.cmd(appId,t('u.3e44b2a933'),'selectAll','⌘A',{disabled:!fileCount}),
          sys.cmd(appId,t('u.8be8d0633d'),'delete','⌫',{disabled:!selected}),
        ]},
        { title:t('u.0a0ce84dde'), items:[
          sys.cmd(appId,t('u.de61aa8e1c'),'preview-selection','Space',{disabled:!selected}),
          { sep:true },
          sys.cmd(appId,t('u.7522db8625'),'rotate-left','⌘L',{disabled:!selected}),
          sys.cmd(appId,t('u.97f4eaae3c'),'rotate-right','⌘R',{disabled:!selected}),
        ]},
        { title:t('u.01f2c16cda'), items:[
          {label:t('u.5888f5ab74'),action:()=>sys.launch('photobooth')},
          sys.cmd(appId,t('u.e519a6482b'),'reveal-imports',null,{disabled:!hasImport}),
        ]},
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'dvdplayer') {
      const win = sys.topWindowOf('dvdplayer');
      const playing = win?.dataset.dvdPlaying === 'true';
      const menuVisible = win?.dataset.dvdMenu === 'true';
      const chapter = Number(win?.dataset.dvdChapter || 1);
      const subtitle = win?.dataset.dvdSubtitle || t('u.93659150d0');
      const audio = win?.dataset.dvdAudio || 'English — Dolby Digital 5.1';
      return [
        {title:t('u.49deaf7da2'),items:[
          sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        sys.extraMenu(appId,t('u.22382630ef'),[
          {label:playing&&!menuVisible?t('u.130448bce6'):t('u.21925350de'),command:'play-pause',shortcut:'Space'},
          {label:menuVisible?t('u.dae7afd663'):t('u.d60ae28dc7'),command:'show-disc-menu',shortcut:'Esc'},
          {sep:true},
          {label:t('u.853acd9249'),command:'previous-chapter',shortcut:'←'},
          {label:t('u.ab55dc7f07'),command:'next-chapter',shortcut:'→'},
        ]),
        sys.extraMenu(appId,t('u.23926d6146'),[
          {label:t('u.8621ac78c6'),command:'chapter-1',checked:chapter===1},
          {label:t('u.c513732ab7'),command:'chapter-2',checked:chapter===2},
          {label:t('u.bdddbffe49'),command:'chapter-3',checked:chapter===3},
        ]),
        sys.extraMenu(appId,t('u.aaa5f2e9f0'),[
          {label:t('u.6c14bd7f6f'),command:'subtitles-off',checked:subtitle===t('u.6c14bd7f6f')},
          {label:'Chinese (Simplified)',command:'subtitles-zh',checked:subtitle==='Chinese (Simplified)'},
          {label:'English',command:'subtitles-en',checked:subtitle==='English'},
        ]),
        sys.extraMenu(appId,t('u.461189f186'),[
          {label:'English — Dolby Digital 5.1',command:'audio-en',checked:audio==='English — Dolby Digital 5.1'},
          {label:'Japanese — Dolby Digital 2.0',command:'audio-ja',checked:audio==='Japanese — Dolby Digital 2.0'},
          {label:'Music and Effects',command:'audio-effects',checked:audio==='Music and Effects'},
        ]),
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    if (appId === 'quicktime') {
      const win = sys.topWindowOf('quicktime');
      const recentMovies = sys.getRecentItems().documents.filter((entry) => !entry.appId || entry.appId === 'quicktime');
      return [
        {title:t('u.49deaf7da2'),items:[
          sys.cmd(appId,t('u.7d7b5211df'),'open-document','⌘O'),
          { label:t('u.2045e366f4'), submenu:recentMovies.length
            ? recentMovies.map((entry)=>({label:VFS.baseName(entry.path),action:()=>sys.openRecentDocument(entry)}))
            : [{label:t('u.f456c1d1c9'),disabled:true}] },
          sys.cmd(appId,t('u.6c47acf799'),'new-window','⌘N'),
          {sep:true},sys.cmd(appId,t('u.51daeffe47'),'close-window','⌘W'),
        ]},
        sys.editMenu(appId),
        sys.extraMenu(appId,t('u.71b6771bc7'),[
          {label:t('u.07734ee92f'),command:'half-size',shortcut:'⌘0'},
          {label:t('u.6ef49ec0be'),command:'actual-size',shortcut:'⌘1'},
          {label:t('u.760a39ee7a'),command:'double-size',shortcut:'⌘2'},
          {label:t('u.2d1e40e077'),command:'fit-screen',shortcut:'⌘3'},
        ]),
        sys.extraMenu(appId,t('u.8d85cec270'),[
          {label:t('u.d3cc62c36d'),command:'play-pause',shortcut:'Space'},
          {label:t('u.6cc8448147'),command:'go-beginning'},
          {label:t('u.128b65b0f7'),command:'go-end'},
          {sep:true},
          {label:t('u.40d9cb2d8e'),command:'toggle-loop',checked:win?.dataset.loop === 'true'},
          {label:t('u.be9b82df8e'),command:'show-inspector',shortcut:'⌘I'},
        ]),
        sys.windowMenu(appId),sys.helpMenu(appId),
      ];
    }
    return null;
  }

  // ---------- Menu bar ----------
  sys.defaultMenus = (appId) => {
    const app = sys.apps[appId];
    return [
      { title: t('u.49deaf7da2'), items: [
        sys.cmd(appId, t('u.7dd1b16c1a'), 'new-window', '⌘N'),
        sys.cmd(appId, t('u.7e736d9399'), 'open-document', '⌘O'),
        { sep: true }, sys.cmd(appId, t('u.51daeffe47'), 'close-window', '⌘W'),
      ]},
      sys.editMenu(appId), sys.windowMenu(appId), sys.helpMenu(appId),
    ];
  };

  sys.shortcutsInstalled = false;
  sys.installShortcutRuntime = function installShortcutRuntime() {
    if (sys.shortcutsInstalled) return;
    sys.shortcutsInstalled = true;
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.isComposing || !sys.activeApp) return;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      let command = null;
      if (sys.activeApp === 'finder' && !modifier && key === ' ') command = 'quick-look';
      if (sys.activeApp === 'finder' && !modifier && key === 'Backspace') command = 'delete';
      if (sys.activeApp === 'automator' && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'remove-action';
      if ((sys.activeApp === 'keychain' || sys.activeApp === 'imagecapture') && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'delete';
      if ((sys.activeApp === 'itunes' || sys.activeApp === 'quicktime' || sys.activeApp === 'dvdplayer') && !modifier && key === ' '
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'play-pause';
      if (sys.activeApp === 'dvdplayer' && !modifier
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
        if (key === 'ArrowLeft') command = 'previous-chapter';
        else if (key === 'ArrowRight') command = 'next-chapter';
        else if (key === 'Escape') command = 'show-disc-menu';
      }
      if (sys.activeApp === 'imagecapture' && !modifier && key === ' '
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'preview-selection';
      if (sys.activeApp === 'grab' && !modifier && key === 'Escape') command = 'cancel-capture';
      if (sys.activeApp === 'photobooth' && !modifier
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
        if (key === ' ') command = 'take-photo';
        else if (key === 'Backspace') command = 'delete-selected-photo';
      }
      if (sys.activeApp === 'ical' && !modifier && key === 'Backspace'
          && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) command = 'delete-event';
      if (modifier) {
        if (key === '?' || (event.shiftKey && key === '/')) {
          event.preventDefault();
          event.stopPropagation();
          sys.launch('helpviewer', { appId:sys.activeApp });
          return;
        }
        if (key === 'h') {
          if (sys.activeApp === 'helpviewer' && event.shiftKey) command = 'help-home';
          else {
            event.preventDefault();
            event.stopPropagation();
            if (event.altKey) sys.hideOtherApps(sys.activeApp);
            else sys.hideApp(sys.activeApp);
            return;
          }
        }
        if (key === 'q' && sys.activeApp !== 'finder') {
          event.preventDefault();
          event.stopPropagation();
          sys.quitApp(sys.activeApp);
          return;
        }
        if (key === ',') {
          event.preventDefault();
          event.stopPropagation();
          sys.showApplicationPreferences(sys.activeApp);
          return;
        }
        const common = {
          n:'new-window', o:'open-document', s:'save', w:'close-window', m:'minimize',
          z:event.shiftKey ? 'redo' : 'undo', x:'cut', c:'copy', v:'paste', a:'selectAll',
        };
        command = common[key] || command;
        if (event.shiftKey && key === 's') command = 'save-as';
        if (sys.activeApp === 'finder') {
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
        } else if (sys.activeApp === 'safari') {
          const safari = { t:'new-tab', l:'open-location', r:'reload', '[':'back', ']':'forward', '0':'actual-size', '+':'zoom-in', '=':'zoom-in', '-':'zoom-out' };
          command = safari[key] || command;
          if (key === 'w') command = event.shiftKey ? 'close-window' : 'close-tab';
        } else if (sys.activeApp === 'helpviewer') {
          if (key === '[') command = 'back';
          else if (key === ']') command = 'forward';
          else if (key === 'f') command = 'help-search';
          else if (event.shiftKey && key === 'h') command = 'help-home';
        } else if (sys.activeApp === 'preview') {
          const preview = { '+':'zoom-in', '=':'zoom-in', '-':'zoom-out', '0':'actual-size', '9':'zoom-fit', l:'rotate-left', r:'rotate-right', i:'show-inspector' };
          command = preview[key] || command;
        } else if (sys.activeApp === 'textedit') {
          const textedit = { b:'bold', i:'italic', u:'underline', t:'show-fonts', r:'toggle-ruler', '+':'bigger', '=':'bigger', '-':'smaller' };
          command = textedit[key] || command;
          if (key === 'f') command = 'find-text';
          else if (key === 'k') command = 'insert-link';
          else if (event.shiftKey && key === 't') command = sys.topWindowOf('textedit')?.dataset.texteditRich === 'false' ? 'make-rich' : 'make-plain';
          else if (event.shiftKey && key === 'x') command = 'strikeThrough';
          else if (event.shiftKey && key === 'l') command = 'insertUnorderedList';
          else if (key === ']') command = 'indent';
          else if (key === '[') command = 'outdent';
        } else if (sys.activeApp === 'ical') {
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
        else if (sys.activeApp === 'mail') {
          if (key === 'n') command = 'new-message';
          else if (key === 't') command = 'show-fonts';
          else if (key === 'b') command = 'bold';
          else if (key === 'i') command = 'italic';
        } else if (sys.activeApp === 'addressbook' && key === 'n') command = event.shiftKey ? 'new-group' : 'new-contact';
        else if (sys.activeApp === 'ichat' && key === 'n') command = 'new-chat';
        else if (sys.activeApp === 'dictionary') {
          if (key === 'f') command = 'focus-search';
          else if (key === 'l') command = 'pronounce';
          else if (key === '[') command = 'history-back';
        } else if (sys.activeApp === 'photobooth' && key === 'o') command = 'open-selected-photo';
        else if (sys.activeApp === 'itunes') {
          if (key === 'n') command = 'new-playlist';
          else if (key === 'ArrowLeft') command = 'previous-track';
          else if (key === 'ArrowRight') command = 'next-track';
          else if (key === '2') command = 'show-equalizer';
        } else if (sys.activeApp === 'quicktime') {
          if (key === '0') command = 'half-size';
          else if (key === '1') command = 'actual-size';
          else if (key === '2') command = 'double-size';
          else if (key === '3') command = 'fit-screen';
          else if (key === 'i') command = 'show-inspector';
        } else if (sys.activeApp === 'calculator') {
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
        } else if (sys.activeApp === 'stickies') {
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
        } else if (sys.activeApp === 'activity') {
          if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'inspect-process';
          else if (event.altKey && key === 's') command = 'sample-process';
          else if (key === 'r') command = 'refresh-now';
          else if (key === '1') command = 'show-cpu';
          else if (key === '2') command = 'show-memory';
          else if (key === '3') command = 'show-disk-activity';
          else if (key === '4') command = 'show-disk-usage';
          else if (key === '5') command = 'show-network';
        } else if (sys.activeApp === 'fontbook') {
          if (key === 'o') command = 'install-font';
          else if (key === 'n') command = 'new-collection';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'show-font-info';
          else if (key === '1') command = 'show-sample';
          else if (key === '2') command = 'show-repertoire';
          else if (key === '3') command = 'show-custom';
          else if (key === '+' || key === '=') command = 'larger-preview';
          else if (key === '-') command = 'smaller-preview';
        } else if (sys.activeApp === 'netutil') {
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
        } else if (sys.activeApp === 'consoleapp') {
          if (key === 's') command = 'export-log';
          else if (key === 'c') command = 'copy-entry';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'toggle-log-inspector';
          else if (key === 'r') command = 'reload-log';
          else if (key === 'k') command = 'clear-display';
          else if (event.shiftKey && key === 'm') command = 'insert-marker';
          else if (event.altKey && key === 'l') command = 'toggle-log-list';
        } else if (sys.activeApp === 'diskutil') {
          if (key === 'n') command = 'new-disk-image';
          else if (key === 'i') command = 'show-disk-info';
          else if (key === 'r') command = 'refresh-storage';
        } else if (sys.activeApp === 'automator') {
          if (key === 'n') command = 'new-workflow';
          else if (key === 'o') command = 'open-document';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'r') command = 'run-workflow';
          else if (key === '.') command = 'stop-workflow';
          else if (key === 'Backspace') command = 'remove-action';
        } else if (sys.activeApp === 'keychain') {
          if (key === 'n') command = 'new-item';
          else if (key === 'f') command = 'focus-search';
          else if (key === 'i') command = 'show-item-info';
          else if (key === 'Backspace') command = 'delete';
        } else if (sys.activeApp === 'imagecapture') {
          if (key === 'o') command = event.shiftKey ? 'choose-files' : 'add-vfs-images';
          else if (key === 'd') command = event.altKey ? 'import-all' : 'import-selection';
          else if (key === 'l') command = 'rotate-left';
          else if (key === 'r') command = 'rotate-right';
          else if (key === 'Backspace') command = 'delete';
        } else if (sys.activeApp === 'grab') {
          if (event.shiftKey && key === 'a') command = 'capture-selection';
          else if (event.shiftKey && key === 'w') command = 'capture-window';
          else if (event.shiftKey && key === 'z') command = 'capture-timed';
          else if (!event.shiftKey && key === 'z') command = 'capture-screen';
        }
      }
      if (!command) return;
      if (sys.dispatchAppCommand(sys.activeApp, command, { source:'keyboard', originalEvent:event })) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  sys.setActiveApp = function setActiveApp(id) {
    if (!sys.apps[id]) id = 'finder';
    sys.activeApp = id;
    sys.$('.mb-appname').textContent = sys.apps[id].name;
    sys.renderMenuTitles();
  }

  sys.renderMenuTitles = function renderMenuTitles() {
    const cont = sys.$('#mb-menus');
    cont.innerHTML = '';
    const resolveMenus = () => (sys.apps[sys.activeApp].menus ? sys.apps[sys.activeApp].menus() : (sys.profiledMenus(sys.activeApp) || sys.defaultMenus(sys.activeApp)));
    const menus = resolveMenus();
    menus.forEach((m, index) => {
      const item = sys.el('div', 'mb-item', m.title);
      item.setAttribute('role', 'menuitem');
      item.tabIndex = 0;
      item.setAttribute('aria-haspopup', 'menu');
      item.setAttribute('aria-expanded', 'false');
      item._menuItemsProvider = () => {
        const current = resolveMenus();
        return current[index]?.items || m.items;
      };
      item.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        sys.toggleMenu(item, item._menuItemsProvider());
      });
      item.addEventListener('keydown', (event) => {
        if (!['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        sys.toggleMenu(item, item._menuItemsProvider());
        const first = sys.openMenu?.dd && sys.directMenuItems(sys.openMenu.dd)[0];
        if (first) sys.focusMenuItem(first);
      });
      cont.appendChild(item);
    });
  }
  document.addEventListener('vfs-history-changed', () => {
    if (sys.activeApp !== 'finder') return;
    sys.closeMenus();
    sys.renderMenuTitles();
  });
  document.addEventListener('document-state-changed', (event) => {
    if (event.detail?.appId !== sys.activeApp) return;
    sys.closeMenus();
    sys.renderMenuTitles();
  });

  sys.openMenu = null;
  sys.closeMenus = function closeMenus() {
    if (sys.openMenu) {
      sys.openMenu.dd.remove();
      if (sys.openMenu.anchor) {
        sys.openMenu.anchor.classList.remove('open');
        sys.openMenu.anchor.setAttribute('aria-expanded', 'false');
        sys.openMenu.anchor.removeAttribute('aria-controls');
      }
      sys.openMenu = null;
    }
  }
  sys.focusMenuItem = function focusMenuItem(item) {
    if (!sys.openMenu || !item || item.classList.contains('disabled')) return;
    sys.openMenu.dd.querySelectorAll('.mi.keyboard-focus').forEach((candidate) => candidate.classList.remove('keyboard-focus'));
    item.classList.add('keyboard-focus');
    sys.openMenu.focused = item;
    item.focus({ preventScroll:true });
  }
  sys.directMenuItems = function directMenuItems(container) {
    return [...container.children].filter((item) => item.classList?.contains('mi') && !item.classList.contains('disabled'));
  }
  sys.switchMenuAnchor = function switchMenuAnchor(delta) {
    if (!sys.openMenu?.anchor) return;
    const anchors = [
      document.querySelector('.mb-apple'),
      document.querySelector('.mb-appname'),
      ...document.querySelectorAll('#mb-menus > .mb-item'),
    ].filter(Boolean);
    const index = anchors.indexOf(sys.openMenu.anchor);
    if (index < 0) return;
    const next = anchors[(index + delta + anchors.length) % anchors.length];
    const items = next._menuItemsProvider?.();
    if (Array.isArray(items)) sys.toggleMenu(next, items);
  }
  sys.buildDropdown = function buildDropdown(items, cls) {
    const dd = sys.el('div', 'menu-dropdown' + (cls ? ' ' + cls : ''));
    dd.setAttribute('role', 'menu');
    items.forEach((it) => {
      if (it.sep) {
        const separator = sys.el('div', 'msep');
        separator.setAttribute('role', 'separator');
        dd.appendChild(separator);
        return;
      }
      const submenuItems = typeof it.submenu === 'function' ? it.submenu() : it.submenu;
      const hasSubmenu = Array.isArray(submenuItems) && submenuItems.length > 0;
      const mi = sys.el('div', 'mi' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') + (hasSubmenu ? ' has-submenu' : ''));
      mi.tabIndex = -1;
      mi.setAttribute('role', it.checked != null ? 'menuitemcheckbox' : 'menuitem');
      mi.setAttribute('aria-disabled', String(!!it.disabled));
      if (it.checked != null) mi.setAttribute('aria-checked', String(!!it.checked));
      if (hasSubmenu) {
        mi.setAttribute('aria-haspopup', 'menu');
        mi.setAttribute('aria-expanded', 'false');
      }
      if (it.swatch) mi.dataset.menuSwatch = String(it.swatch);
      const checkmark = sys.el('span', 'menu-check');
      const label = sys.el('span', 'menu-label');
      checkmark.textContent = it.checked ? '✓' : '';
      label.textContent = String(it.label ?? '');
      mi.append(checkmark, label);
      if (it.shortcut || hasSubmenu) {
        const shortcut = sys.el('span', 'shortcut');
        shortcut.textContent = hasSubmenu ? '▶' : String(it.shortcut);
        mi.appendChild(shortcut);
      }
      mi.addEventListener('pointerenter', () => {
        if (!it.disabled) sys.focusMenuItem(mi);
        const parentMenu = mi.parentElement;
        parentMenu.querySelectorAll(':scope > .mi.submenu-open').forEach((item) => {
          if (item !== mi) item.classList.remove('submenu-open');
        });
      });
      if (hasSubmenu) {
        mi.appendChild(sys.buildDropdown(submenuItems, 'submenu'));
        mi.addEventListener('click', (event) => {
          if (event.target.closest('.submenu')) return;
          event.stopPropagation();
          mi.parentElement.querySelectorAll(':scope > .mi.submenu-open').forEach((item) => {
            if (item !== mi) item.classList.remove('submenu-open');
          });
          mi.classList.toggle('submenu-open');
          mi.setAttribute('aria-expanded', String(mi.classList.contains('submenu-open')));
        });
      }
      else if (!it.disabled) mi.addEventListener('click', () => { sys.closeMenus(); it.action && it.action(); });
      dd.appendChild(mi);
    });
    return dd;
  }
  sys.toggleMenu = function toggleMenu(anchor, items) {
    if (sys.openMenu && sys.openMenu.anchor === anchor) { sys.closeMenus(); return; }
    sys.closeMenus();
    const dd = sys.buildDropdown(items);
    const r = anchor.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top = '22px';
    document.body.appendChild(dd);
    const maxLeft = Math.max(4, innerWidth - dd.getBoundingClientRect().width - 4);
    dd.style.left = Math.max(4, Math.min(r.left, maxLeft)) + 'px';
    anchor.classList.add('open');
    anchor.setAttribute('aria-expanded', 'true');
    if (!dd.id) dd.id = `system-menu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    anchor.setAttribute('aria-controls', dd.id);
    sys.openMenu = { anchor, dd, focused:null };
  }
  sys.contextMenu = function contextMenu(e, items) {
    sys.closeMenus();
    const dd = sys.buildDropdown(items, 'ctx');
    dd.style.left = e.clientX + 'px';
    dd.style.top = e.clientY + 'px';
    document.body.appendChild(dd);
    const r = dd.getBoundingClientRect();
    if (r.right > innerWidth - 4) dd.style.left = Math.max(4, e.clientX - r.width) + 'px';
    if (r.bottom > innerHeight - 4) dd.style.top = Math.max(4, e.clientY - r.height) + 'px';
    sys.openMenu = { anchor: null, dd };
  }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu-dropdown') && !e.target.closest('.mb-item')) sys.closeMenus(); });
  document.addEventListener('keydown', (event) => {
    if (!sys.openMenu?.dd?.isConnected) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      sys.closeMenus();
      return;
    }
    const focused = sys.openMenu.focused;
    const menu = focused?.parentElement || sys.openMenu.dd;
    const items = sys.directMenuItems(menu);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const current = items.indexOf(focused);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = current < 0
        ? (direction > 0 ? 0 : items.length - 1)
        : (current + direction + items.length) % items.length;
      if (items[index]) sys.focusMenuItem(items[index]);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      const submenu = focused?.querySelector(':scope > .menu-dropdown.submenu');
      if (submenu) {
        focused.classList.add('submenu-open');
        const first = sys.directMenuItems(submenu)[0];
        if (first) sys.focusMenuItem(first);
      } else {
        sys.switchMenuAnchor(1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      if (menu.classList.contains('submenu')) {
        const owner = menu.parentElement;
        owner.classList.remove('submenu-open');
        sys.focusMenuItem(owner);
      } else {
        sys.switchMenuAnchor(-1);
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && focused) {
      event.preventDefault();
      event.stopPropagation();
      focused.click();
    }
  }, true);

  sys.appleMenuItems = function appleMenuItems() {
    const display = HOME_DISPLAY_NAME;
    return [
      { label: t('menu.aboutThisMac'), action: sys.showAboutMac },
      { sep: true },
      { label: t('menu.softwareUpdate'), action: () => sys.launch('sysprefs', { pane: 'update' }) },
      { label: t('menu.sysprefs'), action: () => sys.launch('sysprefs') },
      { label: t('menu.dock'), action: () => sys.launch('sysprefs', { pane: 'dock' }) },
      { sep: true },
      { label: t('menu.recentItems'), submenu: sys.recentMenuItems },
      { sep: true },
      { label: t('menu.forceQuit'), shortcut: '⌥⌘⎋', action: sys.forceQuitDialog },
      { sep: true },
      { label: t('menu.sleep'), action: () => sys.sleepScreen() },
      { label: t('menu.restart'), action: () => sys.confirmBox({
        title: t('menu.restartVerb'), text: t('menu.restartConfirm'),
        okLabel: t('menu.restartVerb'), countdown: 60, countdownVerb: t('menu.restartVerb'),
        onOK: () => sys.shutdownSequence(true),
      }) },
      { label: t('menu.shutDown'), action: () => sys.confirmBox({
        title: t('menu.shutDownVerb'), text: t('menu.shutDownConfirm'),
        okLabel: t('menu.shutDownVerb'), countdown: 60, countdownVerb: t('menu.shutDownVerb'),
        onOK: () => sys.shutdownSequence(false),
      }) },
      { sep: true },
      { label: t('menu.logOut', { name: display }), shortcut: '⇧⌘Q', action: () => sys.confirmBox({
        title: t('menu.logOutTitle', { name: display }), text: t('menu.logOutText'),
        okLabel: t('menu.logOutOk'), onOK: sys.kernelPanicSequence,
      }) },
    ];
  }
  sys.recentMenuItems = function recentMenuItems() {
    const recents = sys.getRecentItems();
    const items = [{ label: t('menu.recentApps'), disabled: true }];
    if (recents.apps.length) {
      recents.apps.forEach((entry) => items.push({
        label:sys.apps[entry.id].name,
        action:() => sys.launch(entry.id),
      }));
    } else items.push({ label: t('menu.noRecentApps'), disabled: true });
    items.push({ sep:true }, { label: t('menu.recentDocs'), disabled: true });
    if (recents.documents.length) {
      recents.documents.forEach((entry) => items.push({
        label:VFS.baseName(entry.path),
        action:() => sys.openRecentDocument(entry),
      }));
    } else items.push({ label: t('menu.noRecentDocs'), disabled: true });
    items.push({ sep:true }, {
      label: t('menu.clearMenu'),
      disabled:!recents.apps.length && !recents.documents.length,
      action:sys.clearRecentItems,
    });
    return items;
  }
  sys.appMenuItems = function appMenuItems() {
    const app = sys.apps[sys.activeApp];
    if (sys.activeApp === 'finder') {
      return [
        { label: t('menu.aboutApp', { name: t('app.finder') }), action: () => sys.showAboutApp(app) },
        { label: t('menu.finderPreferences'), shortcut: '⌘,', action: () => sys.apps.finder?.showPreferences?.() },
        { sep: true },
        { label: t('menu.emptyTrash'), shortcut: '⇧⌘⌫', action: sys.emptyTrash, disabled: !sys.trashCount() },
        { sep: true },
        { label: t('menu.hideApp', { name: t('app.finder') }), shortcut: '⌘H', action: () => sys.hideApp('finder') },
        { label: t('menu.hideOthers'), shortcut: '⌥⌘H', action: () => sys.hideOtherApps('finder') },
        { label: t('menu.showAll'), action: sys.showAllApps },
      ];
    }
    const hasPreferences = !!app.showPreferences || !!sys.appPreferenceProfile(sys.activeApp);
    return [
      { label: t('menu.aboutApp', { name: app.name }), action: () => sys.showAboutApp(app) },
      ...(hasPreferences ? [{ label: t('menu.preferences'), shortcut: '⌘,', action: () => sys.showApplicationPreferences(sys.activeApp) }] : []),
      { sep: true },
      { label: t('menu.hideApp', { name: app.name }), shortcut: '⌘H', action: () => sys.hideApp(sys.activeApp) },
      { label: t('menu.hideOthers'), shortcut: '⌥⌘H', action: () => sys.hideOtherApps(sys.activeApp) },
      { label: t('menu.showAll'), action: sys.showAllApps },
      { sep: true },
      { label: t('menu.quitApp', { name: app.name }), shortcut: '⌘Q', action: () => sys.quitApp(sys.activeApp) },
    ];
  }

  sys.showApplicationPreferences = function showApplicationPreferences(appId, initialTab) {
    const app = sys.apps[appId];
    if (!app) return null;
    if (app.showPreferences) return app.showPreferences(initialTab);
    const profile = sys.appPreferenceProfile(appId);
    if (!profile) {
      sys.beep('basso', .18);
      return null;
    }
    if (app._preferencesWindow?.isConnected) {
      sys.focusWindow(app._preferencesWindow);
      sys.setActiveApp(appId);
      const requested = app._preferencesWindow.querySelector(`[data-app-pref-tab="${CSS.escape(initialTab || '')}"]`);
      requested?.click();
      return app._preferencesWindow;
    }

    let values = sys.getAppPreferences(appId);
    const root = sys.el('div', 'app-preferences');
    const tabs = sys.el('nav', 'app-preference-tabs');
    tabs.setAttribute('role', 'tablist');
    const panels = sys.el('div', 'app-preference-panels');
    const controlsByKey = new Map();

    const controlElement = (definition) => {
      let control;
      if (definition.type === 'select') {
        control = sys.el('select', 'aqua-select');
        (definition.options || []).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          control.appendChild(option);
        });
      } else if (definition.type === 'color') {
        control = sys.el('input', 'app-preference-color');
        control.type = 'color';
      } else {
        control = sys.el('input', 'aqua-input');
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
      const tab = sys.el('button', 'app-preference-tab');
      tab.type = 'button';
      tab.dataset.appPrefTab = tabDefinition.id;
      tab.setAttribute('role', 'tab');
      tab.innerHTML = `<i aria-hidden="true">${tabDefinition.glyph || '⚙'}</i><span>${html(tabDefinition.label)}</span>`;
      tabs.appendChild(tab);

      const panel = sys.el('section', 'app-preference-panel');
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
            label = sys.el('label', 'app-preference-check');
            control = document.createElement('input');
            control.type = 'checkbox';
            control.dataset.appPreference = definition.key;
            label.append(control, document.createTextNode(` ${definition.label}`));
          } else {
            label = sys.el('label', 'app-preference-row');
            const caption = document.createElement('span');
            caption.textContent = definition.label;
            control = controlElement(definition);
            label.append(caption, control);
          }
          controlsByKey.set(definition.key, { definition, control });
          setControl(definition, control);
          const eventName = definition.type === 'text' || definition.type === 'color' ? 'input' : 'change';
          control.addEventListener(eventName, () => {
            values = sys.updateAppPreferences(appId, { [definition.key]:readControl(definition, control) });
          });
          section.appendChild(label);
          if (definition.note) {
            const note = sys.el('p', 'app-preference-note');
            note.textContent = definition.note;
            section.appendChild(note);
          }
        });
        panel.appendChild(section);
      });
      panels.appendChild(panel);
    });

    const footer = sys.el('footer', 'app-preference-footer');
    const help = sys.el('button', 'aqua-btn', '?');
    help.title = `${app.name} ${t('u.adf465ebf0')}`;
    help.setAttribute('aria-label', `${app.name} ${t('u.adf465ebf0')}`);
    const status = sys.el('span', '', t('u.7341cc03fd'));
    const restore = sys.el('button', 'aqua-btn', t('u.d4acd4b3e0'));
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
    help.addEventListener('click', () => sys.launch('helpviewer', { appId, topic:'preferences' }));
    restore.addEventListener('click', () => sys.confirmSheet({
      parent:app._preferencesWindow,
      headline: t('prefs.reset.confirmApp', { name: app.name }),
      message: t('prefs.reset.appMessage'),
      okLabel: t('prefs.reset.restoreDefaults'),
      onOK:() => {
        values = sys.updateAppPreferences(appId, sys.appPreferenceDefaults(appId));
        controlsByKey.forEach(({ definition, control }) => setControl(definition, control));
      },
    }));

    const win = sys.createWindow({
      app:appId, title: t('prefs.appTitle', { name: app.name }), width:640, height:500,
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
  sys.quitApp = function quitApp(id, force) {
    const app = sys.apps[id];
    if (!app) return;
    if (app._launchTimer != null) {
      clearTimeout(app._launchTimer);
      app._launchTimer = null;
      app._launchPendingArg = undefined;
    }
    for (const w of app.windows.slice()) {
      if (!sys.runWindowCloseHandler(w, !!force, force ? 'force' : 'quit')) return false;
      sys.detachWindow(w);
    }
    sys.updateAfterWindowClose();
    return true;
  }

}
