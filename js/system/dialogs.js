// System subsystem: dialogs
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, HOME_DISPLAY_NAME, paths, systemPaths } from '../config.js';
import { t } from '../i18n/index.js';
import { html } from '../escape.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
  sys.showSheet = function showSheet(opts) {
    opts = opts || {};
    const parent = opts.parent || sys.topWindowOf(opts.app || activeApp) || sys.topVisibleWindow();
    if (!parent) return null;
    if (parent._activeSheet?.close) parent._activeSheet.close('replace');

    const shield = sys.el('div', 'aqua-sheet-shield');
    const sheet = sys.el('section', `aqua-sheet${opts.className ? ` ${opts.className}` : ''}`);
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    if (opts.title) {
      const heading = sys.el('h2', 'aqua-sheet-title');
      heading.textContent = opts.title;
      sheet.appendChild(heading);
      sheet.setAttribute('aria-label', opts.title);
    }
    const content = sys.el('div', 'aqua-sheet-content');
    if (opts.content instanceof Node) content.appendChild(opts.content);
    else if (opts.content != null) content.textContent = String(opts.content);
    sheet.appendChild(content);

    const footer = sys.el('div', 'aqua-sheet-buttons');
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
      const button = sys.el('button', `aqua-btn${def.default ? ' default' : ''}${def.danger ? ' danger' : ''}`);
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

  sys.promptSheet = function promptSheet(opts) {
    opts = opts || {};
    const form = sys.el('div', 'aqua-prompt');
    if (opts.message) {
      const message = sys.el('p', 'aqua-sheet-message');
      message.textContent = opts.message;
      form.appendChild(message);
    }
    const input = sys.el('input', 'aqua-input aqua-sheet-input');
    input.type = opts.type || 'text';
    input.value = opts.value || '';
    input.placeholder = opts.placeholder || '';
    form.appendChild(input);
    const error = sys.el('div', 'aqua-sheet-error');
    form.appendChild(error);
    const accept = () => {
      const value = input.value.trim();
      const validation = opts.validate?.(value);
      if (!value || validation === false || typeof validation === 'string') {
        error.textContent = typeof validation === 'string' ? validation : (opts.errorText || t('u.83e7d8ecc7'));
        input.focus(); input.select();
        return false;
      }
      return opts.onOK?.(value) !== false;
    };
    const api = sys.showSheet({
      parent: opts.parent, app: opts.app, title: opts.title || '',
      content: form, className: 'aqua-prompt-sheet', initialFocus: input,
      buttons: [
        { label: opts.cancelLabel || t('u.4d0b4688c7'), cancel: true },
        { label: opts.okLabel || t('u.27e4fe4c3f'), default: true, action: accept },
      ],
      onClose: opts.onClose,
    });
    requestAnimationFrame(() => input.select());
    return api;
  }

  sys.confirmSheet = function confirmSheet(opts) {
    opts = opts || {};
    const body = sys.el('div', 'aqua-confirm-sheet-body');
    const icon = sys.el('div', 'aqua-confirm-sheet-icon');
    icon.innerHTML = opts.icon || sys.appleIconSvg('#9aa2ad');
    const copy = sys.el('div');
    const headline = sys.el('h3');
    headline.textContent = opts.headline || opts.title || t('u.ebee52226e');
    const message = sys.el('p');
    message.textContent = opts.message || opts.text || '';
    copy.append(headline, message);
    body.append(icon, copy);
    return sys.showSheet({
      parent: opts.parent, app: opts.app, title: opts.sheetTitle || '',
      content: body, className: 'aqua-confirm-sheet',
      buttons: [
        { label: opts.cancelLabel || t('u.4d0b4688c7'), cancel: true },
        { label: opts.okLabel || t('u.27e4fe4c3f'), default: true, danger: !!opts.danger, action: opts.onOK },
      ],
      onClose: opts.onClose,
    });
  }

  sys.documentPanel = function documentPanel(opts, mode) {
    opts = opts || {};
    const parent = opts.parent || sys.topWindowOf(opts.app || activeApp) || sys.topVisibleWindow();
    if (!parent) return null;
    const home = paths.home;
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
      if (value < 1024) return `${value.toLocaleString()} ${t('u.c114f750cf')}`;
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

    const panel = sys.el('div', 'aqua-file-panel');
    const top = sys.el('div', 'aqua-file-panel-top');
    const nav = sys.el('div', 'aqua-file-nav-group');
    const back = sys.el('button', 'aqua-file-nav', '◀');
    const forward = sys.el('button', 'aqua-file-nav', '▶');
    const up = sys.el('button', 'aqua-file-nav', '↑');
    back.title = t('u.4cf4c11a1b');
    forward.title = t('u.320ffeefca');
    up.title = t('u.6e70574648');
    nav.append(back, forward, up);
    const location = sys.el('button', 'aqua-file-location');
    const search = sys.el('input', 'aqua-input aqua-file-search');
    search.type = 'text';
    search.placeholder = t('u.f04090805c');
    search.setAttribute('aria-label', t('u.042fe553f3'));
    top.append(nav, location, search);
    const split = sys.el('div', 'aqua-file-split');
    const sidebar = sys.el('aside', 'aqua-file-sidebar');
    const list = sys.el('div', 'aqua-file-list');
    list.tabIndex = 0;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', t('u.cf750851bf'));
    if (allowMultiple) list.setAttribute('aria-multiselectable', 'true');
    split.append(sidebar, list);
    const status = sys.el('div', 'aqua-file-status');
    const lower = sys.el('div', 'aqua-file-lower');
    panel.append(top, split, status, lower);

    const places = [
      [paths.home, HOME_USER, '⌂'], [paths.desktop, t('u.65fdeb927b'), '▧'],
      [paths.documents, t('u.908a913cf1'), '▤'], [paths.downloads, t('u.2b9d013177'), '⇩'],
      [paths.pictures, t('u.be8da62ea1'), '▣'], [paths.music, t('u.afb3c40c39'), '♫'],
      [paths.movies, t('u.8d85cec270'), '▶'], [systemPaths.applications, t('u.8a44380266'), 'A'],
    ];
    const recentPlaces = [...new Set(sys.getRecentItems().documents
      .map((entry) => VFS.parentOf(entry.path))
      .filter((path) => VFS.isDir(path) && !places.some((entry) => entry[0] === path)))]
      .slice(0, 3)
      .map((path) => [path, VFS.baseName(path), '◷']);
    const addPlaceSection = (title, entries) => {
      if (!entries.length) return;
      sidebar.appendChild(sys.el('strong', '', title));
      entries.forEach(([path, label, glyph]) => {
        if (!VFS.isDir(path)) return;
        const item = sys.el('button', 'aqua-file-place');
        item.dataset.path = path;
        item.innerHTML = `<i>${glyph}</i><span>${label}</span>`;
        item.addEventListener('click', () => navigate(path));
        sidebar.appendChild(item);
      });
    };
    addPlaceSection(t('u.01f2c16cda'), [['/', 'Macintosh HD', '◈']]);
    addPlaceSection(t('u.88c34452cc'), places);
    addPlaceSection(t('u.9a236964e8'), [[paths.public, t('prefs.share.usersMac', { name: HOME_DISPLAY_NAME }), '◫']]);
    addPlaceSection(t('u.71265fc4cb'), recentPlaces);

    let fileName = null;
    if (mode === 'save') {
      const label = sys.el('label', 'aqua-save-name');
      label.append(document.createTextNode(t('u.9a77af699b')));
      fileName = sys.el('input', 'aqua-input');
      fileName.value = opts.name || t('u.35563060dc');
      label.appendChild(fileName);
      lower.appendChild(label);
    }
    const utilities = sys.el('div', 'aqua-file-utilities');
    const newFolder = sys.el('button', 'aqua-btn', t('u.95cf3cd421'));
    newFolder.addEventListener('click', () => {
      if (utilities.querySelector('.aqua-new-folder-edit')) return;
      const editor = sys.el('span', 'aqua-new-folder-edit');
      editor.dataset.sheetEnter = 'local';
      const input = sys.el('input', 'aqua-input');
      input.value = VFS.uniqueName(current, t('u.4e2204bec6'), '');
      const create = sys.el('button', 'aqua-btn default', t('u.0cda8d1c71'));
      const cancel = sys.el('button', 'aqua-btn', t('u.4d0b4688c7'));
      editor.append(input, create, cancel);
      newFolder.hidden = true;
      utilities.prepend(editor);
      const closeEditor = () => { editor.remove(); newFolder.hidden = false; };
      const commitFolder = () => {
        const name = input.value.trim();
        const path = VFS.normalize(`${current}/${name}`);
        if (!name || name.includes('/') || name === '.' || name === '..' || VFS.get(path)) {
          input.classList.add('invalid');
          status.textContent = t('u.5baabda09a');
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
      const importButton = sys.el('button', 'aqua-btn', t('u.862b3ba996'));
      const input = sys.el('input');
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
            status.textContent = `“${file.name}” is larger than 4 MB and cannot be stored on the virtual disk.`;
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
            else status.textContent = `Unable to import “${file.name}”.`;
            if (!--pending) finishImport();
          });
          reader.addEventListener('error', () => {
            status.textContent = `Unable to read “${file.name}”.`;
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
      const filter = sys.el('label', 'aqua-file-filter');
      filter.append(document.createTextNode(t('u.666d12f9dd')));
      const select = sys.el('select', 'aqua-select');
      const allOption = document.createElement('option');
      allOption.value = '*';
      allOption.textContent = opts.typeLabel || (availableTypes.length === 1
        ? `${availableTypes[0].toUpperCase()} document`
        : t('u.955b70544e'));
      select.appendChild(allOption);
      if (availableTypes.length > 1) {
        const typeNames = {
          jpg:t('u.86bb1a8dfc'), jpeg:t('u.86bb1a8dfc'), png:t('u.18f1270700'), gif:t('u.e227c0762f'),
          svg:t('u.06a3da9665'), webp:t('u.6c478b39cb'), pdf:t('u.0d68043ba5'), txt:t('u.0373f454fa'),
          rtf:t('u.2cf0a2d4ec'), html:t('u.dbca608853'), htm:t('u.dbca608853'), mp3:t('u.bf0eb1c500'),
          m4a:t('u.fd3b67fc92'), wav:t('u.e853afa951'), mov:t('u.e02aaa4839'), mp4:t('u.19ac1273f6'),
        };
        availableTypes.forEach((type) => {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = typeNames[type] || `${type.toUpperCase()} document`;
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
      const format = sys.el('div', 'aqua-file-format');
      format.textContent = `Format: ${opts.typeLabel || `${String(opts.extension).replace(/^\./,'').toUpperCase()} document`}`;
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
      overwritePrompt = sys.el('div', 'aqua-file-overwrite');
      const text = sys.el('span');
      text.textContent = `“${name}” already exists. Do you want to replace it with the current document?`;
      const cancel = sys.el('button', 'aqua-btn', t('u.4d0b4688c7'));
      const replace = sys.el('button', 'aqua-btn default', t('u.855241c285'));
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
          status.textContent = t('u.c7a5a60a8e');
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
            status.textContent = `“${name}” already exists. Choose a different name.`;
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
        status.textContent = opts.allowFolders ? t('u.31d249afc6') : t('u.9dabf37864');
        return false;
      }
      if (paths.length === 1 && VFS.isDir(paths[0]) && !opts.allowFolders) {
        navigate(paths[0]);
        return false;
      }
      if (paths.some((path) => !accepted(path))) {
        status.textContent = t('u.955f7470fd');
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
        ? `${selection.size} items selected, ${panelBytes(selectedSize)}`
        : node?.type === 'dir' ? `${(VFS.list(path) || []).length} items` : `${VFS.baseName(path)}, ${panelBytes(VFS.sizeOf(path))}`;
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
      list.innerHTML = `<div class="aqua-file-head"><span>${t('common.name')}</span><span>${t('u.f1ec63ea51')}</span><span>${t('u.2da1825912')}</span></div>`;
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
        const row = sys.el('button', 'aqua-file-row');
        row.dataset.path = path;
        row.setAttribute('role', 'option');
        const icon = System.fileIconFor?.(path) || (node.type === 'dir' ? ICONS.folder : ICONS.textfile);
        const modified = Number.isFinite(node.modifiedAt)
          ? new Date(node.modifiedAt).toLocaleDateString('zh-CN', { year:'numeric', month:'numeric', day:'numeric' })
          : '—';
        const kind = node.type === 'dir' ? t('u.46ecac2910') : node.kind === 'image' ? t('u.0a0ce84dde') : node.type === 'app' ? t('u.8a44380266') : t('u.908a913cf1');
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
        ? `${names.length} matches (${allNames.length} total)`
        : `${names.length} items`;
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
        status.textContent = `${selection.size} items selected`;
      }
    });
    const buttons = [
      { label:t('u.4d0b4688c7'), cancel:true },
      {
        label: mode === 'save' ? (opts.okLabel || t('u.091ca5213e')) : (opts.okLabel || t('u.65fc81e161')),
        default:true, disabled:mode === 'open', action:openSelected,
      },
    ];
    const onPanelVfs = () => {
      if (sheetApi?.shield.isConnected) render();
    };
    sheetApi = sys.showSheet({
      parent, title: opts.title || (mode === 'save' ? t('u.091ca5213e') : t('u.65fc81e161')),
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

  sys.openPanel = function openPanel(opts) { return sys.documentPanel(opts, 'open'); }
  sys.savePanel = function savePanel(opts) { return sys.documentPanel(opts, 'save'); }

  // ---------- Aqua confirm dialog (restart / shutdown / empty trash …) ----------
  sys.confirmBox = function confirmBox(opts) {
    // opts: {title, text, okLabel, onOK, countdown(sec), countdownVerb}
    const box = sys.el('div', 'cfm-wrap');
    const c = sys.el('div', 'cfm');
    const ic = sys.el('div', 'cfm-icon');
    ic.innerHTML = sys.appleIconSvg('#98a0ac');
    const right = sys.el('div', 'cfm-right');
    const txt = sys.el('div', 'cfm-text', opts.text);
    const cd = sys.el('div', 'cfm-count');
    right.append(txt, cd);
    c.append(ic, right);
    const btns = sys.el('div', 'cfm-btns');
    const cancel = sys.el('button', 'aqua-btn', t('u.4d0b4688c7'));
    const ok = sys.el('button', 'aqua-btn default', opts.okLabel || t('u.27e4fe4c3f'));
    btns.append(cancel, ok);
    box.append(c, btns);
    let timer = null;
    const w = sys.createWindow({
      app: sys.activeApp, title: opts.title || '', width: 430, height: 195, content: box,
      noResize: true, bodyBg: '#ececec',
      onClose: () => { if (timer) { clearInterval(timer); timer = null; } },
    });
    const doOK = () => { sys.closeWindow(w); opts.onOK && opts.onOK(); };
    ok.addEventListener('click', doOK);
    cancel.addEventListener('click', () => sys.closeWindow(w));
    if (opts.countdown) {
      let n = opts.countdown;
      const verb = opts.countdownVerb || opts.okLabel || t('u.1fc1afc5c5');
      const upd = () => { cd.textContent = `If you do nothing, the computer will ${verb} automatically in ${n} seconds.`; };
      upd();
      timer = setInterval(() => {
        n--;
        if (n <= 0) { clearInterval(timer); timer = null; doOK(); } else upd();
      }, 1000);
    }
    return w;
  }

  sys.shutdownSequence = function shutdownSequence(restart) {
    sys.syslog(restart ? t('u.fb93086cc3') : t('u.adfd2ab472'), 'shutdown');
    const s = sys.el('div', 'shutdown-screen');
    document.body.appendChild(s);
    requestAnimationFrame(() => s.classList.add('on'));
    setTimeout(() => {
      if (restart) {
        s.innerHTML = `<div class="sd-inner"><div class="boot-apple"></div><div class="boot-spinner"></div></div>`;
        setTimeout(() => location.reload(), 1500);
      } else {
        s.innerHTML = `<div class="sd-inner"><div class="sd-power">⏻</div><div class="sd-text">${t('u.5fb0e0c805')}</div><div class="sd-hint">${t('u.4f90f5a2ea')}</div></div>`;
        s.addEventListener('click', () => location.reload());
      }
    }, 950);
  }

  sys.kernelPanicSequence = function kernelPanicSequence() {
    if (document.querySelector('.kernel-panic-screen')) return;
    sys.closeMenus?.();
    sys.syslog('panic(cpu 0 caller 0x001A8C8A): simulated logout panic', 'kernel');
    const screen = sys.el('div', 'kernel-panic-screen');
    screen.tabIndex = 0;
    screen.setAttribute('role', 'alert');
    screen.setAttribute('aria-label', t('u.d1162e4116'));
    screen.innerHTML = `
      <div class="kp-panel">
        <div class="kp-power" aria-hidden="true">⏻</div>
        <div class="kp-messages">
          <p lang="en">You need to restart your computer. Hold down the Power button for several seconds or press the Restart button.</p>
          <p lang="fr">Vous devez redémarrer votre ordinateur. Maintenez le bouton d’alimentation enfoncé pendant plusieurs secondes ou appuyez sur le bouton de redémarrage.</p>
          <p lang="de">Sie müssen Ihren Computer neu starten. Halten Sie den Ein-/Ausschalter mehrere Sekunden gedrückt oder drücken Sie die Neustart-Taste.</p>
          <p lang="ja">コンピュータを${t('u.d56630e93f')}してください。</p>
        </div>
      </div>
      <div class="kp-hint">${t('u.efe05ee939')}</div>`;
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

  // Force Quit lives in services.js (sys.forceQuitDialog). Dock lives in shell.js.

  sys.appleIconSvg = function appleIconSvg(color) {
    return `<svg viewBox="0 0 170 200" width="100%" height="100%"><path fill="${color}" d="M150.4 69.2c-1.1.8-19.7 11.3-19.7 34.7 0 27 23.7 36.6 24.4 36.8-.1.6-3.8 13.1-12.5 25.9-7.8 11.2-16 22.4-28.4 22.4s-15.6-7.2-29.9-7.2c-14 0-19 7.4-30.4 7.4S34.6 178.8 26 166.4C16.2 152.2 8 130.2 8 109.3c0-33.5 21.8-51.3 43.2-51.3 11.4 0 20.9 7.6 28.1 7.6 6.8 0 17.4-8 30.4-8 4.9 0 22.6.4 34.3 17zM104.5 39.6c5.7-6.7 9.7-16.1 9.7-25.4 0-1.3-.1-2.6-.3-3.7-9.2.3-20.2 6.1-26.8 13.8-5.2 5.9-10 15.2-10 24.7 0 1.4.2 2.8.3 3.3.6.1 1.5.2 2.5.2 8.2 0 18.6-5.5 24.6-12.9z"/></svg>`;
  };

  sys.showAboutMac = function showAboutMac() {
    const c = sys.el('div', 'about-mac');
    c.innerHTML = `
      <header><div class="about-mac-apple">${sys.appleIconSvg('#a6abb2')}</div><h1>Mac OS X</h1><button class="about-mac-version">${t('u.c465546f7f')}</button></header>
      <button class="aqua-btn about-mac-update">${t('u.27d0331ff0')}</button>
      <dl class="about-mac-hardware">
        <dt>${t('u.b4366749c4')}</dt><dd data-about-hw="processor"></dd>
        <dt>${t('u.d014ab7703')}</dt><dd data-about-hw="memory"></dd>
        <dt>${t('u.005b8f07b1')}</dt><dd>Macintosh HD</dd>
      </dl>
      <div class="about-mac-actions"></div>
      <footer><span>© 1983–2009 Apple Inc.<br>${t('u.9022cf363e')}</span></footer>`;
    const processor = c.querySelector('[data-about-hw="processor"]');
    const memory = c.querySelector('[data-about-hw="memory"]');
    processor.textContent = sys.HW.processor;
    processor.title = `${sys.HW.processor} · ${sys.HW.processorSource}`;
    memory.textContent = sys.HW.memory;
    memory.title = `${sys.HW.memory} · ${sys.HW.memorySource}`;
    const version = c.querySelector('.about-mac-version');
    const versionStates = [t('u.c465546f7f'),'Build 9L31a-web',`Serial ${sys.HW.serial}`];
    let versionIndex = 0;
    version.addEventListener('click',()=>{versionIndex=(versionIndex+1)%versionStates.length;version.textContent=versionStates[versionIndex];});
    const btnReport = sys.el('button', 'aqua-btn default', t('u.0c3d091dca'));
    btnReport.addEventListener('click', () => sys.launch('sysprofiler'));
    c.querySelector('.about-mac-update').addEventListener('click', () => sys.launch('sysprefs', { pane:'update' }));
    c.querySelector('.about-mac-actions').append(btnReport);
    sys.createWindow({
      app:sys.activeApp, title:t('u.06719185cb'), width:390, height:420, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:360, maxHeight:420, width:390, extraHeight:0 },
    });
  };

  sys.showAboutApp = function showAboutApp(app) {
    if (!app) return;
    const c = sys.el('div', 'about-box');
    c.innerHTML = `<div class="di-img">${app.icon}</div><h2>${html(app.name)}</h2><div class="ver">${t('u.4b1c64b12d')}</div><p>${html(app.about || t('u.5cf76f3a30'))}</p>`;
    sys.createWindow({
      app:app.id, title:`About ${app.name}`, width:280, height:260, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:220, maxHeight:420 },
    });
  };

  sys.alertBox = function alertBox(title, text) {
    const c = sys.el('div', 'about-box');
    const message = sys.textEl('p', '', text == null ? '' : text);
    message.style.cssText = 'font-size:13px;white-space:pre-wrap';
    c.appendChild(message);
    const btn = sys.el('button', 'aqua-btn default', t('u.27e4fe4c3f'));
    btn.style.marginTop = '14px';
    c.appendChild(btn);
    const w = sys.createWindow({
      app:sys.activeApp, title, width:320, height:180, content:c,
      noResize:true, bodyBg:'#ececec',
      autoFitContent:{ minHeight:160, maxHeight:430 },
    });
    btn.addEventListener('click', () => sys.closeWindow(w));
  };

  sys.sleepScreen = function sleepScreen() {
    const s = sys.el('div');
    Object.assign(s.style, { position: 'fixed', inset: 0, background: '#000', zIndex: 99999, opacity: 0, transition: 'opacity .8s' });
    document.body.appendChild(s);
    requestAnimationFrame(() => s.style.opacity = 1);
    s.addEventListener('click', () => { s.style.opacity = 0; setTimeout(() => s.remove(), 800); });
  };

  // i18n defaults for common chrome buttons
  const _confirmBox = sys.confirmBox;
  sys.confirmBox = function confirmBox(opts) {
    opts = opts || {};
    if (!opts.okLabel) opts.okLabel = t('dialog.ok');
    if (!opts.cancelLabel) opts.cancelLabel = t('dialog.cancel');
    return _confirmBox.call(sys, opts);
  };

}
