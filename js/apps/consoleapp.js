import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 控制台 (Console) — system log browser, captured console output and JS diagnostics
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="5" fill="#f5f5f0" stroke="#8a8a8a" stroke-width="1.5"/><rect x="8" y="8" width="48" height="10" rx="5" fill="#c8ccd2" stroke="#8a8a8a"/><g font-family="Monaco,monospace" font-size="6" fill="#555"><text x="12" y="26">10:01 kernel: boot ok</text><text x="12" y="34">10:01 launchd: ready</text><text x="12" y="42">10:02 Dock: bounce</text><text x="12" y="50">10:02 Finder: hello</text></g></svg>`;
  const captured = [];
  const markers = [];
  let captureSequence = 0;

  const timeLabel = (date = new Date()) => `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
  const safeArgument = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`.trim();
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (key, item) => {
        if (typeof item === 'object' && item !== null) {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        return item;
      });
    } catch (error) {
      return String(value);
    }
  };
  const pushCaptured = (source, message, level = 'info') => {
    const now = new Date();
    captured.push({
      id:`captured-${++captureSequence}`, ts:timeLabel(now), time:now.getTime(),
      src:source, msg:String(message).slice(0, 2500), level, origin:'captured',
    });
    if (captured.length > 600) captured.shift();
    document.dispatchEvent(new CustomEvent('syslog'));
  };

  // Capture console and JavaScript failures once when the application bundle loads.
  ['log','info','warn','error'].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...argumentsList) => {
      try {
        pushCaptured(`console.${level}`, argumentsList.map(safeArgument).join(' '), level === 'log' ? 'info' : level);
      } catch (error) {}
      original(...argumentsList);
    };
  });
  window.addEventListener('error', (event) => {
    const file = (event.filename || '').split('/').pop();
    pushCaptured('JavaScript', `${event.message}${file ? ` @ ${file}:${event.lineno || 0}:${event.colno || 0}` : ''}`, 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    pushCaptured('Promise', t('app.con.unhandled', { reason: safeArgument(event.reason) }), 'error');
  });

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));
  const levelForSystem = (entry) => {
    const text = `${entry.src} ${entry.msg}`.toLocaleLowerCase('zh-CN');
    if (/error|failed|失败|crash|崩溃|fatal/i.test(text)) return 'error';
    if (/warn|注意|denied|拒绝|不可用/i.test(text)) return 'warn';
    return 'info';
  };

  function open() {
    const toolbar = el('div', 'console-toolbar');
    const logListButton = el('button', 'finder-toolbar-btn', t('ui.b547dc3bf074'));
    const inspectorButton = el('button', 'finder-toolbar-btn', t('app.con2.efc4a6e9e359'));
    const clearButton = el('button', 'finder-toolbar-btn', t('ui.f3ebcc28014b'));
    const markerButton = el('button', 'finder-toolbar-btn', t('app.con2.21f5a1d04068'));
    const followButton = el('button', 'finder-toolbar-btn', t('ui.130448bce675'));
    const toolbarSpacer = el('i');
    const levelSelect = el('select', 'console-level');
    levelSelect.setAttribute('aria-label', t('app.con2.79cb8b977e07'));
    levelSelect.innerHTML = `<option value="all">${t('app.con2.2097ad668505')}</option><option value="warn">${t('app.con2.fbb049aec27c')}</option><option value="error">${t('app.con2.7eec33106e60')}</option>`;
    const search = el('input', 'aqua-search console-search');
    search.type = 'search';
    search.placeholder = t('app.con2.7a322b4a2117');
    search.setAttribute('aria-label', t('app.con2.36f3ae834f9a'));
    toolbar.append(logListButton, inspectorButton, clearButton, markerButton, followButton, toolbarSpacer, levelSelect, search);

    const root = el('div', 'console-app');
    root.innerHTML = `<aside class="console-sources"><header>${t('app.con2.e63734ec6f61')}</header><div></div><footer><button data-console-source="all">${t('app.con2.491fa46d9e5b')}</button></footer></aside>
      <main class="console-main"><header class="console-columns"><span class="time">${t('app.con2.dc165c5c4a89')}</span><span class="sender">${t('app.con2.33ec79f8f03f')}</span><span class="level">${t('app.con2.25258ebc2944')}</span><span class="message">${t('app.con2.cfd514e55478')}</span></header><div class="console-rows" role="listbox" aria-label="${t('app.con2.f5806212620b')}" tabindex="0"></div><section class="console-inspector" hidden></section></main>`;
    const sourceList = root.querySelector('.console-sources>div');
    const rows = root.querySelector('.console-rows');
    const inspector = root.querySelector('.console-inspector');

    const sourceDefinitions = [
      { group:t('ui.ac58d773a059'), items:[
        { id:'all', icon:'▤', name:t('app.con2.2097ad668505'), filter:() => true },
        { id:'errors', icon:'!', name:t('ui.a0a5f683a8d5'), filter:(entry) => entry.level === 'warn' || entry.level === 'error' },
        { id:'console', icon:'›_', name:t('app.con2.7f5e455525d3'), filter:(entry) => entry.origin === 'captured' },
        { id:'system', icon:'⚙', name:t('ui.5995b612540c'), filter:(entry) => entry.origin === 'system' },
      ]},
      { group:t('ui.49deaf7da20d'), items:[
        { id:'systemlog', icon:'▧', name:'system.log', detail:'/var/log/system.log', filter:(entry) => entry.origin === 'system' },
        { id:'installlog', icon:'▧', name:'install.log', detail:'/var/log/install.log', filter:(entry) => /diskutil|fontbook|installer|安装|字体|权限/i.test(`${entry.src} ${entry.msg}`) },
        { id:'securelog', icon:'▧', name:'secure.log', detail:'/var/log/secure.log', filter:(entry) => /login|keychain|security|secure|认证|钥匙串/i.test(`${entry.src} ${entry.msg}`) },
        { id:'javascript', icon:'▧', name:'javascript.log', detail:'~/Library/Logs/JavaScript.log', filter:(entry) => entry.origin === 'captured' && /JavaScript|Promise|console\.(warn|error)/i.test(entry.src) },
      ]},
    ];

    let win = null;
    let selectedSource = 'all';
    let selectedEntryId = null;
    let showSources = true;
    let showInspector = false;
    let following = true;
    let query = '';
    let levelFilter = 'all';
    let hiddenBefore = 0;
    let renderId = 0;
    let currentEntries = [];

    const allEntries = () => {
      const now = Date.now();
      const systemLength = System.syslogBuf.length;
      const system = System.syslogBuf.map((entry,index) => ({
        id:`system-${index}-${entry.ts}-${entry.src}`,
        ts:entry.ts,
        time:Number(entry.time) || now - (systemLength-index) * 20,
        src:entry.src || 'kernel',
        msg:String(entry.msg ?? ''),
        level:levelForSystem(entry),
        origin:'system',
      }));
      return [...system, ...captured, ...markers].sort((left,right) => left.time - right.time || left.id.localeCompare(right.id));
    };
    const sourceDefinition = (id = selectedSource) =>
      sourceDefinitions.flatMap((group) => group.items).find((item) => item.id === id) || sourceDefinitions[0].items[0];
    const sourceExists = (id) =>
      sourceDefinitions.some((group) => group.items.some((item) => item.id === id));
    const filteredEntries = () => {
      const lowered = query.trim().toLocaleLowerCase('zh-CN');
      const source = sourceDefinition();
      return allEntries().filter((entry) =>
        entry.time > hiddenBefore
        && (entry.origin === 'marker' || source.filter(entry))
        && (entry.origin === 'marker' || levelFilter === 'all' || levelFilter === 'warn' && (entry.level === 'warn' || entry.level === 'error') || levelFilter === 'error' && entry.level === 'error')
        && (!lowered || `${entry.ts} ${entry.src} ${entry.level} ${entry.msg}`.toLocaleLowerCase('zh-CN').includes(lowered)));
    };
    const selectedEntry = () => currentEntries.find((entry) => entry.id === selectedEntryId) || null;

    const renderSources = () => {
      sourceList.innerHTML = '';
      const entries = allEntries();
      sourceDefinitions.forEach((group) => {
        sourceList.appendChild(el('h4', '', group.group));
        group.items.forEach((source) => {
          const button = el('button', source.id === selectedSource ? 'sel' : '');
          button.dataset.consoleSource = source.id;
          const count = entries.filter(source.filter).length;
          button.innerHTML = `<i>${escapeHtml(source.icon)}</i><span><b>${escapeHtml(source.name)}</b>${source.detail ? `<small>${escapeHtml(source.detail)}</small>` : ''}</span><em>${count}</em>`;
          sourceList.appendChild(button);
        });
      });
    };

    const renderInspector = () => {
      const entry = selectedEntry();
      inspector.hidden = !showInspector;
      if (!showInspector) return;
      if (!entry) {
        inspector.innerHTML = `<p class="console-inspector-empty">${t('app.con2.626eabd61cd2')}</p>`;
        return;
      }
      const date = new Date(entry.time);
      inspector.innerHTML = `<header><span class="${entry.level}">${entry.level === 'error' ? '!' : entry.level === 'warn' ? '⚠' : entry.level === 'marker' ? '◆' : 'i'}</span><div><b>${escapeHtml(entry.src)}</b><small>${date.toLocaleString('zh-CN')}</small></div><button class="aqua-btn" data-console-copy-detail>${t('app.con2.95f7bb53c94d')}</button></header><dl>
        <dt>${t('app.con.9e1fb299ed')}</dt><dd>${escapeHtml(entry.ts)}</dd><dt>${t('app.con2.33ec79f8f03f')}：</dt><dd>${escapeHtml(entry.src)}</dd>
        <dt>${t('app.con2.25258ebc2944')}：</dt><dd>${escapeHtml(entry.level)}</dd><dt>${t('app.con.sourceLbl')}</dt><dd>${entry.origin === 'system' ? t('ui.98dd7cbf8ddd') : entry.origin === 'marker' ? t('ui.e9f0b812c47f') : t('app.con2.8da73d77a0cf')}</dd>
        <dt>${t('app.con2.cfd514e55478')}：</dt><dd>${escapeHtml(entry.msg)}</dd><dt>${t('app.con.idLbl')}</dt><dd>${escapeHtml(entry.id)}</dd>
      </dl>`;
      inspector.querySelector('[data-console-copy-detail]').addEventListener('click', copySelected);
    };

    const updateWindowState = () => {
      if (!win) return;
      win.dataset.consoleSource = selectedSource;
      win.dataset.consoleSelection = selectedEntryId || '';
      win.dataset.consoleShowSources = String(showSources);
      win.dataset.consoleShowInspector = String(showInspector);
      win.dataset.consoleFollowing = String(following);
      win.dataset.consoleHasEntries = String(currentEntries.length > 0);
      win.dataset.consoleLevel = levelFilter;
      root.dispatchEvent(new CustomEvent('app-command-state-changed', { bubbles:true }));
    };

    const render = () => {
      renderId = 0;
      const previousScrollTop = rows.scrollTop;
      const distanceFromBottom = rows.scrollHeight - rows.scrollTop - rows.clientHeight;
      currentEntries = filteredEntries();
      if (selectedEntryId && !currentEntries.some((entry) => entry.id === selectedEntryId)) selectedEntryId = null;
      rows.innerHTML = '';
      currentEntries.slice(-1000).forEach((entry) => {
        if (entry.level === 'marker') {
          const marker = el('button', `console-marker${entry.id === selectedEntryId ? ' sel' : ''}`);
          marker.dataset.entryId = entry.id;
          marker.setAttribute('role','option');
          marker.innerHTML = `<span>${escapeHtml(entry.ts)}</span><b>—— ${escapeHtml(entry.msg)} ——</b>`;
          marker.addEventListener('click', () => selectEntry(entry.id));
          rows.appendChild(marker);
          return;
        }
        const row = el('button', `console-row ${entry.level}${entry.id === selectedEntryId ? ' sel' : ''}`);
        row.dataset.entryId = entry.id;
        row.type = 'button';
        row.setAttribute('role','option');
        row.setAttribute('aria-selected', String(entry.id === selectedEntryId));
        row.innerHTML = `<span class="time">${escapeHtml(entry.ts)}</span><span class="sender">${escapeHtml(entry.src)}</span><span class="level">${entry.level === 'error' ? t('ui.b859c7be7501') : entry.level === 'warn' ? t('ui.5521e368d87e') : t('app.con2.cfd514e55478')}</span><span class="message">${escapeHtml(entry.msg)}</span>`;
        row.addEventListener('click', () => selectEntry(entry.id));
        row.addEventListener('dblclick', () => {
          selectedEntryId = entry.id;
          showInspector = true;
          renderInspector();
          updateChrome();
        });
        row.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          selectedEntryId = entry.id;
          renderInspector();
          System.contextMenu(event, [
            { label:t('ui.57d9c367180d'), action:copySelected },
            { label:t('app.con2.e5260360f20d'), action:insertMarker },
            { sep:true },
            { label:t('app.con.filterOnly', { src: entry.src }), action:() => { query=entry.src; search.value=entry.src; scheduleRender(); } },
          ]);
        });
        rows.appendChild(row);
      });
      if (!currentEntries.length) rows.appendChild(el('p', 'console-empty', hiddenBefore ? t('ui.5d32fa4cdcf6') : t('ui.9d11cdabcbc4')));
      if (following || distanceFromBottom < 18) rows.scrollTop = rows.scrollHeight;
      else rows.scrollTop = previousScrollTop;
      renderSources();
      renderInspector();
      if (win) {
        const status = win.querySelector('.win-statusbar');
        if (status) status.textContent = t('app.con.status2', { name: sourceDefinition().name, n: currentEntries.length, follow: following ? t('app.con2.60965e118a69') : t('app.con2.fea317a70af3') });
      }
      updateChrome();
      updateWindowState();
    };

    const scheduleRender = () => {
      if (renderId) return;
      renderId = requestAnimationFrame(render);
    };

    const updateChrome = () => {
      root.classList.toggle('hide-sources', !showSources);
      root.classList.toggle('show-inspector', showInspector);
      logListButton.textContent = showSources ? t('ui.88c1207e34d0') : t('ui.b547dc3bf074');
      inspectorButton.classList.toggle('active', showInspector);
      followButton.textContent = following ? t('ui.130448bce675') : t('ui.1fc1afc5c55e');
      copyButtonState();
    };
    const copyButtonState = () => {
      inspectorButton.disabled = false;
      clearButton.disabled = !currentEntries.length;
    };
    const selectEntry = (id, focus = false) => {
      selectedEntryId = id;
      rows.querySelectorAll('[data-entry-id]').forEach((row) => {
        const selected = row.dataset.entryId === id;
        row.classList.toggle('sel', selected);
        row.setAttribute('aria-selected', String(selected));
      });
      renderInspector();
      updateWindowState();
      if (focus) [...rows.querySelectorAll('[data-entry-id]')]
        .find((row) => row.dataset.entryId === id)?.focus();
    };
    const selectSource = (id) => {
      if (!sourceExists(id)) return;
      selectedSource = id;
      selectedEntryId = null;
      hiddenBefore = 0;
      render();
    };
    const clearDisplay = () => {
      hiddenBefore = Date.now();
      selectedEntryId = null;
      render();
    };
    const reloadLog = () => {
      hiddenBefore = 0;
      render();
    };
    const insertMarker = () => {
      const now = new Date();
      const markerTime = Math.max(now.getTime(), hiddenBefore + 1);
      const marker = {
        id:`marker-${markerTime}-${markers.length}`, ts:timeLabel(new Date(markerTime)), time:markerTime,
        src:t('ui.5bd086d22a00'), msg:t('ui.e9f0b812c47f'), level:'marker', origin:'marker',
      };
      markers.push(marker);
      selectedEntryId = marker.id;
      following = true;
      render();
    };
    const toggleSources = () => {
      showSources = !showSources;
      updateChrome();
      updateWindowState();
    };
    const toggleInspector = () => {
      showInspector = !showInspector;
      renderInspector();
      updateChrome();
      updateWindowState();
    };
    const toggleFollow = () => {
      following = !following;
      if (following) rows.scrollTop = rows.scrollHeight;
      updateChrome();
      updateWindowState();
    };
    const entryText = (entry) => entry ? `${entry.ts}  ${entry.src}  ${entry.level.toUpperCase()}  ${entry.msg}` : '';
    async function copySelected() {
      const entry = selectedEntry();
      if (!entry) return System.beep();
      try {
        await navigator.clipboard.writeText(entryText(entry));
        Leopard.toast(t('ui.5bd086d22a00'), t('ui.fe88abb73bfe'));
      } catch (error) {
        System.beep();
      }
    }
    const exportLog = () => {
      const lines = currentEntries.map(entryText).join('\n') + '\n';
      const sourceName = sourceDefinition().name.replace(/[\\/:]/g,'-');
      System.savePanel({
        parent:win, title:t('ui.304dcfd122b8'), startPath:paths.documents,
        name:VFS.uniqueName(paths.documents, `${sourceName} ${new Date().toISOString().slice(0,10)}`, '.log'),
        extension:'log', typeLabel:t('ui.838015aadf1f'), allowOverwrite:true,
        onSave:(path) => {
          const saved = VFS.putNode(path, {
            type:'file', kind:'document', mime:'text/plain', content:lines,
            creator:'consoleapp', generated:true,
          });
          if (saved) {
            System.addRecentDocument?.(path, 'consoleapp');
            Leopard.toast(t('ui.5bd086d22a00'), `“${VFS.baseName(path)}”${t('app.con2.ea8cdd301922')}。`);
          }
          return saved;
        },
      });
    };

    const actions = {
      'export-log':exportLog,
      'copy-entry':copySelected,
      'focus-search':() => { search.focus(); search.select(); },
      'clear-display':clearDisplay,
      'reload-log':reloadLog,
      'insert-marker':insertMarker,
      'toggle-log-list':toggleSources,
      'toggle-log-inspector':toggleInspector,
      'toggle-log-follow':toggleFollow,
      'source-all':() => selectSource('all'),
      'source-errors':() => selectSource('errors'),
      'source-console':() => selectSource('console'),
      'source-system':() => selectSource('system'),
      'level-all':() => { levelFilter='all';levelSelect.value='all';render(); },
      'level-warn':() => { levelFilter='warn';levelSelect.value='warn';render(); },
      'level-error':() => { levelFilter='error';levelSelect.value='error';render(); },
    };

    win = System.createWindow({
      app:'consoleapp', title:t('ui.5bd086d22a00'), width:900, height:570,
      toolbar, content:root, statusbar:t('app.con.reading'),
      onClose:() => {
        document.removeEventListener('syslog', scheduleRender);
        if (renderId) cancelAnimationFrame(renderId);
        return true;
      },
    });

    sourceList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-console-source]');
      if (button) selectSource(button.dataset.consoleSource);
    });
    root.querySelector('.console-sources>footer').addEventListener('click', () => selectSource('all'));
    logListButton.addEventListener('click', toggleSources);
    inspectorButton.addEventListener('click', toggleInspector);
    clearButton.addEventListener('click', clearDisplay);
    markerButton.addEventListener('click', insertMarker);
    followButton.addEventListener('click', toggleFollow);
    levelSelect.addEventListener('change', () => {
      levelFilter = levelSelect.value;
      render();
    });
    search.addEventListener('input', () => {
      query = search.value;
      scheduleRender();
    });
    rows.addEventListener('scroll', () => {
      if (!following) return;
      const distance = rows.scrollHeight - rows.scrollTop - rows.clientHeight;
      if (distance > 35) {
        following = false;
        updateChrome();
        updateWindowState();
      }
    }, { passive:true });
    rows.addEventListener('keydown', (event) => {
      const available = [...rows.querySelectorAll('[data-entry-id]')];
      if (!available.length) return;
      let index = Math.max(0, available.findIndex((row) => row.dataset.entryId === selectedEntryId));
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        index = Math.max(0, Math.min(available.length-1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        selectEntry(available[index].dataset.entryId, true);
        available[index].scrollIntoView({ block:'nearest' });
      } else if (event.key === 'Enter' && selectedEntryId) {
        event.preventDefault();
        showInspector = true;
        renderInspector();
        updateChrome();
        updateWindowState();
      }
    });
    win.addEventListener('leopard-command', (event) => {
      const action = actions[event.detail?.command];
      if (action) {
        event.preventDefault();
        action();
      }
    });
    document.addEventListener('syslog', scheduleRender);

    render();
    return win;
  }

  System.registerApp({
    id:'consoleapp', name:t('ui.5bd086d22a00'), icon, open,
    about:t('ui.eb042d33f975'),
    keywords:t('ui.e12895632f40'),
  });
})();
