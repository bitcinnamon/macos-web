import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 字体册 (Font Book) — collections, validation, local-font access and live preview
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="52" rx="4" fill="#f8f4e8" stroke="#9a8a60" stroke-width="1.5"/><rect x="10" y="6" width="10" height="52" rx="4" fill="#8a5a30"/><text x="36" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#333">F</text></svg>`;
  const STATE_KEY = 'macweb.fontbook.state';
  const USER_FONT_DIRECTORY = `${paths.library}/Fonts`;
  const CANDIDATES = [
    'Lucida Grande', 'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman', 'Georgia',
    'Courier New', 'Monaco', 'Menlo', 'Geneva', 'Verdana', 'Trebuchet MS', 'Impact',
    'Comic Sans MS', 'Palatino', 'Optima', 'Futura', 'Gill Sans', 'Baskerville',
    'American Typewriter', 'Marker Felt', 'Papyrus', 'Brush Script MT', 'Copperplate',
    'PingFang SC', 'Hiragino Sans GB', 'Hiragino Kaku Gothic ProN', 'STHeiti',
    'STSong', 'STKaiti', 'SimSun', 'Songti SC', 'Kaiti SC', 'Heiti SC',
  ];
  const REPERTOIRE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßŒœŠšŸ汉字示例，。！？「」『』¥€£¢©®™✓★◆♠♥♦♣←↑→↓';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));
  const fontId = (family) => String(family).trim().toLocaleLowerCase('en-US').replace(/\s+/g, '-').replace(/[^a-z0-9\u3400-\u9fff-]/g, '');
  const isChineseFamily = (family) => /PingFang|Hiragino|Heiti|Songti|Kaiti|STHeiti|STSong|STKaiti|SimSun|黑体|宋体|楷体/i.test(family);
  const isFixedFamily = (family) => /Mono|Monaco|Menlo|Courier|Console|Code/i.test(family);
  const categoryFor = (family) => {
    if (isFixedFamily(family)) return t('app.fb2.cb6358f31816');
    if (isChineseFamily(family)) return t('app.fb2.ef46a6764130');
    if (/Times|Georgia|Palatino|Baskerville|Song|Kaiti|楷|宋/i.test(family)) return t('app.fb2.1669f8a3bf50');
    if (/Impact|Marker|Papyrus|Brush|Copperplate|Typewriter/i.test(family)) return t('app.fb2.0f4742481579');
    return t('ui.bb5a848bbec4');
  };

  function isAvailable(font) {
    try {
      const context = document.createElement('canvas').getContext('2d');
      const sample = t('ui.5012eef38fce');
      context.font = '32px monospace';
      const monoWidth = context.measureText(sample).width;
      context.font = `32px "${font}", monospace`;
      const fontWithMono = context.measureText(sample).width;
      context.font = '32px serif';
      const serifWidth = context.measureText(sample).width;
      context.font = `32px "${font}", serif`;
      const fontWithSerif = context.measureText(sample).width;
      return Math.abs(fontWithMono - monoWidth) > .1 || Math.abs(fontWithSerif - serifWidth) > .1;
    } catch (error) {
      return false;
    }
  }

  function loadState() {
    const fallback = { favorites:[], disabled:[], collections:[] };
    try {
      const parsed = JSON.parse(localStorage.getItem(STATE_KEY));
      if (!parsed || typeof parsed !== 'object') return fallback;
      return {
        favorites:Array.isArray(parsed.favorites) ? parsed.favorites : [],
        disabled:Array.isArray(parsed.disabled) ? parsed.disabled : [],
        collections:Array.isArray(parsed.collections) ? parsed.collections.filter((item) =>
          item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.fontIds)) : [],
      };
    } catch (error) {
      return fallback;
    }
  }

  function open() {
    const state = loadState();
    const loadedFaces = new Map();
    const fonts = CANDIDATES.filter(isAvailable).map((family) => ({
      id:fontId(family), family, fullName:family, source:t('ui.ec87a4b86709'), category:categoryFor(family),
      path:`/系统/资料库/Fonts/${family.replace(/\s+/g,'')}.dfont`,
    }));
    const persist = () => localStorage.setItem(STATE_KEY, JSON.stringify(state));
    const uniqueFontId = (family) => {
      const base = fontId(family) || 'font';
      let candidate = base;
      let suffix = 2;
      while (fonts.some((font) => font.id === candidate)) candidate = `${base}-${suffix++}`;
      return candidate;
    };

    const toolbar = el('div', 'fontbook-toolbar');
    const installButton = el('button', 'finder-toolbar-btn', t('ui.3e090b3d141e'));
    const scanButton = el('button', 'finder-toolbar-btn', t('ui.84f86fadca77'));
    const validateButton = el('button', 'finder-toolbar-btn', t('ui.3bcff67de8ba'));
    const enableButton = el('button', 'finder-toolbar-btn', t('ui.d989e55188c9'));
    const toolbarSpacer = el('i');
    const search = el('input', 'aqua-search fontbook-search');
    search.type = 'search';
    search.placeholder = t('ui.f04090805c6e');
    search.setAttribute('aria-label', t('ui.65a8477b2449'));
    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
    fileInput.multiple = true;
    fileInput.hidden = true;
    toolbar.append(installButton, scanButton, validateButton, enableButton, toolbarSpacer, search, fileInput);

    const root = el('div', 'fontbook-app');
    root.innerHTML = `<aside class="fontbook-collections"><header>${t('app.fb2.e980850be87c')}</header><div></div><footer><button data-collection-add title="${t('app.fb2.d5c540a3a25e')}${t('app.fb2.e980850be87c')}">＋</button><button data-collection-remove title="${t('app.fb2.d17f44ca5f8b')}">−</button><i></i></footer></aside>
      <section class="fontbook-families"><header><b>${t('app.fb2.675e31551eb2')}</b><span></span></header><div role="listbox" aria-label="${t('app.fb2.a49c0a3495ca')}"></div></section>
      <main class="fontbook-preview"><header><div><b></b><small></small></div><label>${t('app.fb2.7c78915c53fc')}<select class="fontbook-style"><option value="normal">${t('app.fb2.644d19e346d4')}</option><option value="bold">${t('app.fb2.65b9d46cc222')}</option><option value="italic">${t('app.fb2.48fe0915a04c')}</option><option value="bold-italic">${t('app.fb.boldItalic')}</option></select></label><nav><button data-font-view="sample">${t('app.fb2.c5654aff691b')}</button><button data-font-view="repertoire">${t('app.fb2.70edc7e50799')}</button><button data-font-view="custom">${t('app.fb.custom')}</button><button data-font-view="info">${t('app.fb2.398550947e0a')}</button></nav></header><section></section><footer><button class="aqua-btn fontbook-favorite">${t('app.fb2.baf6a68e1995')}</button><label>A <input class="fontbook-size" type="range" min="12" max="96" value="38"><output>38 pt</output> A</label></footer></main>`;
    const collectionList = root.querySelector('.fontbook-collections>div');
    const collectionRemove = root.querySelector('[data-collection-remove]');
    const familyHeaderCount = root.querySelector('.fontbook-families>header span');
    const familyList = root.querySelector('.fontbook-families>div');
    const preview = root.querySelector('.fontbook-preview');
    const previewBody = preview.querySelector(':scope>section');
    const styleSelect = preview.querySelector('.fontbook-style');
    const sizeSlider = preview.querySelector('.fontbook-size');
    const sizeOutput = preview.querySelector('output');
    const favoriteButton = preview.querySelector('.fontbook-favorite');

    let win = null;
    let selectedId = fonts[0]?.id || null;
    let selectedCollection = 'all';
    let view = 'sample';
    let previewSize = 38;
    let selectedStyle = 'normal';
    let customText = `${t('app.fb2.33f28f9efa75')} AaBbCc 123\nThe quick brown fox jumps over the lazy dog.`;
    let query = '';
    let localFontPermission = 'unknown';

    const selectedFont = () => fonts.find((font) => font.id === selectedId) || null;
    const isDisabled = (font) => !!font && state.disabled.includes(font.id);
    const isFavorite = (font) => !!font && state.favorites.includes(font.id);
    const customCollection = (id = selectedCollection) => state.collections.find((collection) => collection.id === id);
    const builtInCollections = () => [
      { id:'all', icon:'▤', name:t('ui.89672c77fb4f'), filter:() => true },
      { id:'favorites', icon:'★', name:t('app.fb2.39df4024fcde'), filter:(font) => isFavorite(font) },
      { id:'computer', icon:'▰', name:t('ui.ec87a4b86709'), filter:(font) => font.source !== t('ui.9ba763ea3423') },
      { id:'user', icon:'⌂', name:t('ui.9ba763ea3423'), filter:(font) => font.source === t('ui.9ba763ea3423') },
      { id:'chinese', icon:'文', name:t('app.fb2.ef46a6764130'), filter:(font) => isChineseFamily(font.family) },
      { id:'fixed', icon:'⌨', name:t('app.fb2.cb6358f31816'), filter:(font) => isFixedFamily(font.family) },
    ];
    const collectionMatches = (font, id = selectedCollection) => {
      const builtIn = builtInCollections().find((collection) => collection.id === id);
      if (builtIn) return builtIn.filter(font);
      return customCollection(id)?.fontIds.includes(font.id) || false;
    };
    const filteredFonts = () => {
      const lowered = query.trim().toLocaleLowerCase('zh-CN');
      return fonts.filter((font) => collectionMatches(font)
        && (!lowered || `${font.family} ${font.fullName} ${font.category} ${font.source}`.toLocaleLowerCase('zh-CN').includes(lowered)))
        .sort((left, right) => left.family.localeCompare(right.family, 'zh-CN', { numeric:true }));
    };

    const updateWindowState = () => {
      if (!win) return;
      const font = selectedFont();
      win.dataset.fontbookSelection = font?.id || '';
      win.dataset.fontbookEnabled = String(font ? !isDisabled(font) : false);
      win.dataset.fontbookFavorite = String(isFavorite(font));
      win.dataset.fontbookCanRemove = String(font?.source === t('ui.9ba763ea3423'));
      win.dataset.fontbookCanDeleteCollection = String(!!customCollection());
      win.dataset.fontbookView = view;
      win.dataset.fontbookCollection = selectedCollection;
      win.dataset.fontbookLocalPermission = localFontPermission;
      root.dispatchEvent(new CustomEvent('app-command-state-changed', { bubbles:true }));
    };

    const renderCollections = () => {
      collectionList.innerHTML = '';
      const makeHeading = (text) => collectionList.appendChild(el('h4', '', text));
      const makeButton = (collection) => {
        const count = fonts.filter((font) => {
          const builtIn = builtInCollections().find((item) => item.id === collection.id);
          return builtIn ? builtIn.filter(font) : collection.fontIds.includes(font.id);
        }).length;
        const button = el('button', collection.id === selectedCollection ? 'sel' : '');
        button.dataset.collection = collection.id;
        button.innerHTML = `<i>${escapeHtml(collection.icon || '▧')}</i><span>${escapeHtml(collection.name)}</span><b>${count}</b>`;
        collectionList.appendChild(button);
      };
      makeHeading(t('ui.b50d4d8352f5'));
      builtInCollections().slice(0, 4).forEach(makeButton);
      makeHeading(t('app.fb2.fe006e7b5e82'));
      builtInCollections().slice(4).forEach(makeButton);
      makeHeading(t('ui.47cac519cbb3'));
      state.collections.forEach((collection) => makeButton({ ...collection, icon:'▧' }));
      if (!state.collections.length) collectionList.appendChild(el('p', 'fontbook-no-collections', t('ui.190b01bf540b')));
      collectionRemove.disabled = !customCollection();
    };

    const renderFamilyList = () => {
      const visible = filteredFonts();
      if (!visible.some((font) => font.id === selectedId)) selectedId = visible[0]?.id || null;
      familyHeaderCount.textContent = t('app.fb.families', { n: visible.length });
      familyList.innerHTML = '';
      visible.forEach((font) => {
        const button = el('button', `fontbook-family-row${font.id === selectedId ? ' sel' : ''}${isDisabled(font) ? ' disabled-font' : ''}`);
        button.dataset.fontId = font.id;
        button.type = 'button';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(font.id === selectedId));
        const specimen = el('i', '', 'Aa');
        specimen.style.fontFamily = `"${font.family}", sans-serif`;
        const details = el('span');
        details.append(el('b', '', font.family), el('small', '', `${font.category} · ${font.source}`));
        const stateGlyph = el('em', '', isDisabled(font) ? '⊘' : isFavorite(font) ? '★' : '');
        button.append(specimen, details, stateGlyph);
        button.addEventListener('click', () => {
          selectedId = font.id;
          render();
        });
        button.addEventListener('dblclick', () => {
          selectedId = font.id;
          view = 'info';
          render();
        });
        button.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          selectedId = font.id;
          render();
          const collectionItems = state.collections.map((collection) => ({
            label:collection.name,
            checked:collection.fontIds.includes(font.id),
            action:() => toggleFontInCollection(collection.id, font.id),
          }));
          System.contextMenu(event, [
            { label:isFavorite(font) ? t('ui.03f0b0bbec09') : t('ui.df52d4a3dd2f'), action:toggleFavorite },
            { label:isDisabled(font) ? t('ui.1065b643fbbd') : t('ui.8c3e08f812a9'), action:toggleEnabled },
            { label:t('ui.4ccccf137e1f'), action:validateSelected },
            ...(collectionItems.length ? [{ sep:true }, { label:t('ui.b3bc279405b0'), submenu:collectionItems }] : []),
            ...(font.source === t('ui.9ba763ea3423') ? [{ sep:true }, { label:t('ui.78fec302a0e7'), action:removeSelectedFont }] : []),
          ]);
        });
        familyList.appendChild(button);
      });
      if (!visible.length) familyList.appendChild(el('p', 'fontbook-empty', t('ui.2d31c5248bfc')));
    };

    const applyPreviewTypeface = (element, font) => {
      element.style.fontFamily = isDisabled(font) ? 'serif' : `"${font.family}", serif`;
      element.style.fontWeight = selectedStyle.includes('bold') ? '700' : '400';
      element.style.fontStyle = selectedStyle.includes('italic') ? 'italic' : 'normal';
    };

    const renderPreview = () => {
      const font = selectedFont();
      preview.querySelector('header b').textContent = font?.family || t('ui.5e1c2bf206b1');
      preview.querySelector('header small').textContent = font
        ? `${font.fullName} · ${font.source}${isDisabled(font) ? t('ui.6e22179a9b28') : ''}`
        : t('ui.c25bf3969cbc');
      validateButton.disabled = !font;
      enableButton.disabled = !font;
      enableButton.textContent = font && isDisabled(font) ? t('ui.d4e9ca3dd494') : t('ui.d989e55188c9');
      favoriteButton.disabled = !font;
      favoriteButton.textContent = isFavorite(font) ? t('app.fb.favorited') : t('app.fb2.baf6a68e1995');
      styleSelect.value = selectedStyle;
      sizeSlider.value = String(previewSize);
      sizeOutput.textContent = `${previewSize} pt`;
      preview.querySelectorAll('[data-font-view]').forEach((button) => button.classList.toggle('sel', button.dataset.fontView === view));
      previewBody.innerHTML = '';
      if (!font) {
        previewBody.appendChild(el('div', 'fontbook-preview-empty', t('ui.aa085798caf8')));
        updateWindowState();
        return;
      }
      if (view === 'repertoire') {
        const grid = el('div', 'fontbook-repertoire');
        [...REPERTOIRE].forEach((character) => {
          const cell = el('span', '', character);
          cell.title = `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`;
          applyPreviewTypeface(cell, font);
          grid.appendChild(cell);
        });
        previewBody.appendChild(grid);
      } else if (view === 'custom') {
        const custom = el('div', 'fontbook-custom');
        const textarea = el('textarea');
        textarea.value = customText;
        textarea.setAttribute('aria-label', t('ui.60325f71fdae'));
        const sample = el('div');
        sample.style.fontSize = `${previewSize}px`;
        sample.textContent = customText;
        applyPreviewTypeface(sample, font);
        textarea.addEventListener('input', () => {
          customText = textarea.value;
          sample.textContent = customText || ' ';
        });
        custom.append(textarea, sample);
        previewBody.appendChild(custom);
      } else if (view === 'info') {
        const info = el('div', 'fontbook-info');
        const metricsCanvas = document.createElement('canvas');
        const context = metricsCanvas.getContext('2d');
        context.font = `${selectedStyle.includes('italic') ? 'italic ' : ''}${selectedStyle.includes('bold') ? '700 ' : ''}36px "${font.family}", serif`;
        const sampleWidth = context.measureText('ui.86f69e0fba2c').width;
        info.innerHTML = `<header><span>F</span><div><h2>${escapeHtml(font.family)}</h2><p>${escapeHtml(font.fullName)}</p></div></header><dl>
          <dt>${t('app.fb.ps')}</dt><dd>${escapeHtml(font.family.replace(/\s+/g,'-'))}</dd>
          <dt>${t('app.fb.kind')}</dt><dd>${escapeHtml(font.category)}${t('app.fb2.675e31551eb2')}</dd>
          <dt>${t('app.fb.loc')}</dt><dd>${escapeHtml(font.path || t('ui.0d84ffca2468'))}</dd>
          <dt>${t('app.fb.src')}</dt><dd>${escapeHtml(font.source)}</dd>
          <dt>${t('app.fb2.7cf04919ca9b')}</dt><dd class="${isDisabled(font) ? 'warning' : 'ok'}">${isDisabled(font) ? t('ui.6c7dcbb73a59') : t('ui.25d284315063')}</dd>
          <dt>${t('app.fb.metrics')}</dt><dd>${t('app.fb.sampleText', { w: sampleWidth.toFixed(1) })}</dd>
          <dt>${t('app.fb.stylesAvail')}</dt><dd>${t('app.fb.stylesList')}</dd>
          <dt>${t('app.fb.ident')}</dt><dd>${escapeHtml(font.id)}</dd>
        </dl>`;
        previewBody.appendChild(info);
      } else {
        const sample = el('article', 'fontbook-sample');
        sample.innerHTML = `<h1>${t('app.fb2.33f28f9efa75')}</h1><h2>AaBbCc 123</h2><p>The quick brown fox jumps over the lazy dog.</p><p>${t('app.fb.poem')}</p><p class="fontbook-waterfall">${[12,18,24,36,48,64].map((size) => `<span style="font-size:${size}px">Font Book ${t('app.fb2.4c38b61c6ddf')}</span>`).join('')}</p>`;
        sample.style.setProperty('--fontbook-size', `${previewSize}px`);
        applyPreviewTypeface(sample, font);
        previewBody.appendChild(sample);
      }
      updateWindowState();
    };

    const render = () => {
      renderCollections();
      renderFamilyList();
      renderPreview();
      const font = selectedFont();
      if (win) {
        const status = win.querySelector('.win-statusbar');
        if (status) status.textContent = font
          ? `${font.family} · ${font.category} · ${font.source} · ${isDisabled(font) ? t('ui.6c7dcbb73a59') : t('ui.e91365cf9ed9')}`
          : `${filteredFonts().length} ${t('app.fb2.a0ebadc48846')}`;
      }
    };

    function toggleFavorite() {
      const font = selectedFont();
      if (!font) return;
      if (isFavorite(font)) state.favorites = state.favorites.filter((id) => id !== font.id);
      else state.favorites.push(font.id);
      persist();
      render();
    }

    function toggleEnabled() {
      const font = selectedFont();
      if (!font) return;
      if (isDisabled(font)) state.disabled = state.disabled.filter((id) => id !== font.id);
      else state.disabled.push(font.id);
      persist();
      render();
      Leopard.toast(t('ui.0f549f2b28fc'), t('app.fb.toggled', { family: font.family, state: isDisabled(font) ? t('ui.d989e55188c9') : t('ui.d4e9ca3dd494') }));
    }

    function toggleFontInCollection(collectionId, id = selectedId) {
      const collection = customCollection(collectionId);
      if (!collection || !id) return;
      if (collection.fontIds.includes(id)) collection.fontIds = collection.fontIds.filter((fontIdValue) => fontIdValue !== id);
      else collection.fontIds.push(id);
      persist();
      renderCollections();
      if (selectedCollection === collectionId) renderFamilyList();
      updateWindowState();
    }

    function newCollection() {
      System.promptSheet({
        parent:win, title:t('ui.c236d99f6b5f'), message:t('ui.a09d8a22670b'), value:t('app.fb2.bc2bb5cff914'), okLabel:t('ui.fcbd0932929e'),
        validate:(name) => state.collections.some((collection) => collection.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN'))
          ? t('ui.02a035432628') : true,
        onOK:(name) => {
          const collection = { id:`collection-${Date.now()}`, name, fontIds:selectedId ? [selectedId] : [] };
          state.collections.push(collection);
          selectedCollection = collection.id;
          persist();
          render();
        },
      });
    }

    function deleteCollection() {
      const collection = customCollection();
      if (!collection) return;
      System.confirmSheet({
        parent:win, headline:`${t('app.fb2.d17f44ca5f8b')}“${collection.name}”？`,
        message:t('ui.d1a582ef3df0'),
        okLabel:t('ui.3755f56f2f83'), danger:true,
        onOK:() => {
          state.collections = state.collections.filter((item) => item.id !== collection.id);
          selectedCollection = 'all';
          persist();
          render();
        },
      });
    }

    async function validateSelected() {
      const font = selectedFont();
      if (!font) return;
      const endBusy = System.beginBusy(180);
      validateButton.disabled = true;
      try {
        const regularLoaded = await document.fonts.load(`36px "${font.family}"`, 'AaBbCc 123');
        const chineseLoaded = await document.fonts.load(`36px "${font.family}"`, t('ui.de6caa994d72'));
        const duplicateCount = fonts.filter((candidate) => candidate.family.toLocaleLowerCase('en-US') === font.family.toLocaleLowerCase('en-US')).length;
        const canRender = font.source === t('ui.9ba763ea3423') || isAvailable(font.family);
        const checks = [
          [t('ui.c6a16bf09567'), regularLoaded.length > 0 || canRender],
          [t('app.fb2.e1e83430488a'), canRender],
          [t('app.fb2.da9104ef6f17'), chineseLoaded.length > 0 || document.fonts.check(`36px "${font.family}"`, t('ui.de6caa994d72'))],
          [t('ui.e7344e6dc245'), duplicateCount === 1],
          [t('ui.e02777c4794e'), canRender],
        ];
        const content = el('div', 'fontbook-validation');
        content.innerHTML = `<header><span>✓</span><div><h3>${t('app.fb.validateTitle', { family: escapeHtml(font.family) })}</h3><p>${checks.every(([,ok]) => ok) ? t('ui.99438c360aef') : t('ui.bb9687909198')}</p></div></header><section>${checks.map(([label,ok]) => `<p class="${ok ? 'ok' : 'warning'}"><i>${ok ? '✓' : '!'}</i><span>${escapeHtml(label)}</span><b>${ok ? t('ui.dcc4233255ab') : t('ui.5521e368d87e')}</b></p>`).join('')}</section><small>${t('app.fb.validateNote')}</small>`;
        System.showSheet({ parent:win, title:t('ui.ff22c1753aaf'), content, buttons:[{ label:t('ui.6c14bd7f6f9e'), cancel:true }] });
      } catch (error) {
        System.alertBox(t('ui.ff22c1753aaf'), t('app.fb.cannotValidate', { msg: error.message || t('ui.5f76edc5de7b') }));
      } finally {
        endBusy();
        renderPreview();
      }
    }

    const ensureUserFontDirectory = () => {
      if (!VFS.get(paths.library)) VFS.mkdir(paths.library);
      if (!VFS.get(USER_FONT_DIRECTORY)) VFS.mkdir(USER_FONT_DIRECTORY);
      return VFS.isDir(USER_FONT_DIRECTORY);
    };

    const readAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.addEventListener('error', () => reject(reader.error || new Error(t('ui.898198535a8a'))));
      reader.readAsDataURL(file);
    });

    async function installFiles(fileList) {
      const filesToInstall = [...fileList].filter((file) => /\.(ttf|otf|woff2?)$/i.test(file.name));
      if (!filesToInstall.length) return System.alertBox(t('ui.0f549f2b28fc'), t('ui.69ed5e9ed797'));
      const endBusy = System.beginBusy(260);
      let installed = 0;
      let sessionOnly = 0;
      for (const file of filesToInstall) {
        try {
          const baseFamily = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() || t('ui.3360817ea424');
          let family = baseFamily;
          let suffix = 2;
          while (fonts.some((font) => font.family.toLocaleLowerCase('en-US') === family.toLocaleLowerCase('en-US'))) family = `${baseFamily} ${suffix++}`;
          const buffer = await file.arrayBuffer();
          const face = new FontFace(family, buffer);
          await face.load();
          document.fonts.add(face);
          const id = uniqueFontId(family);
          let path = '';
          if (file.size <= 2 * 1048576 && ensureUserFontDirectory()) {
            const dot = file.name.lastIndexOf('.');
            const extension = dot >= 0 ? file.name.slice(dot) : '';
            const baseName = dot >= 0 ? file.name.slice(0,dot) : file.name;
            const storedName = VFS.uniqueName(USER_FONT_DIRECTORY, baseName, extension);
            path = `${USER_FONT_DIRECTORY}/${storedName}`;
            const dataUrl = await readAsDataUrl(file);
            const saved = VFS.putNode(path, {
              type:'file', kind:'font', mime:file.type || 'font/ttf', src:dataUrl,
              family, originalName:file.name, creator:'fontbook', generated:false,
            });
            if (!saved) path = '';
          }
          if (!path) sessionOnly++;
          fonts.push({ id, family, fullName:family, source:t('ui.9ba763ea3423'), category:categoryFor(family), path, sessionOnly:!path });
          loadedFaces.set(id, face);
          selectedId = id;
          selectedCollection = 'user';
          installed++;
        } catch (error) {
          System.syslog(t('app.fb.installFail', { name: file.name, msg: error.message }), 'fontbook');
        }
      }
      endBusy();
      fileInput.value = '';
      render();
      if (installed) Leopard.toast(t('ui.0f549f2b28fc'), t('app.fb.installedN2', { n: installed, note: sessionOnly ? ` (${sessionOnly} session-only)` : '' }));
      else System.alertBox(t('ui.0f549f2b28fc'), t('ui.fa4f68479027'));
    }

    async function restoreUserFonts() {
      if (!VFS.isDir(USER_FONT_DIRECTORY)) return;
      for (const name of VFS.list(USER_FONT_DIRECTORY) || []) {
        const path = `${USER_FONT_DIRECTORY}/${name}`;
        const node = VFS.get(path);
        if (node?.kind !== 'font' || !node.src || !node.family) continue;
        try {
          const face = new FontFace(node.family, `url("${node.src}")`);
          await face.load();
          document.fonts.add(face);
          const id = uniqueFontId(node.family);
          fonts.push({ id, family:node.family, fullName:node.family, source:t('ui.9ba763ea3423'), category:categoryFor(node.family), path });
          loadedFaces.set(id, face);
        } catch (error) {
          System.syslog(t('app.fb.loadFail', { name, msg: error.message }), 'fontbook');
        }
      }
      if (win?.isConnected) render();
    }

    async function scanLocalFonts() {
      if (typeof window.queryLocalFonts !== 'function') {
        localFontPermission = 'unsupported';
        updateWindowState();
        return System.alertBox(t('ui.0f549f2b28fc'), t('ui.7cc62550bc4a'));
      }
      const endBusy = System.beginBusy(240);
      scanButton.disabled = true;
      try {
        const records = await window.queryLocalFonts();
        const existing = new Set(fonts.map((font) => font.family.toLocaleLowerCase('en-US')));
        let added = 0;
        records.forEach((record) => {
          const family = record.family || record.fullName;
          if (!family || existing.has(family.toLocaleLowerCase('en-US'))) return;
          existing.add(family.toLocaleLowerCase('en-US'));
          fonts.push({
            id:uniqueFontId(family), family, fullName:record.fullName || family,
            source:t('ui.ec87a4b86709'), category:categoryFor(family), path:t('ui.a2a7205cfa5e'),
          });
          added++;
        });
        localFontPermission = 'granted';
        render();
        Leopard.toast(t('ui.0f549f2b28fc'), t('app.fb.readLocal', { n: records.length, added }));
      } catch (error) {
        localFontPermission = error?.name === 'NotAllowedError' ? 'denied' : 'error';
        updateWindowState();
        System.alertBox(t('ui.0f549f2b28fc'), error?.name === 'NotAllowedError'
          ? t('ui.f0a5c862d185')
          : t('app.fb.readFail2', { msg: error.message || t('ui.5f76edc5de7b') }));
      } finally {
        scanButton.disabled = false;
        endBusy();
      }
    }

    function removeSelectedFont() {
      const font = selectedFont();
      if (!font || font.source !== t('ui.9ba763ea3423')) return;
      System.confirmSheet({
        parent:win, headline:t('app.fb.removeQ', { family: font.family }),
        message:font.path ? t('ui.0fa663a9dcf7') : t('ui.7f452b7c73cb'),
        okLabel:t('ui.2f752c005ec5'), danger:true,
        onOK:() => {
          const face = loadedFaces.get(font.id);
          if (face) document.fonts.delete(face);
          loadedFaces.delete(font.id);
          if (font.path && VFS.get(font.path)) System.moveToTrash(font.path);
          const index = fonts.findIndex((candidate) => candidate.id === font.id);
          if (index >= 0) fonts.splice(index, 1);
          state.favorites = state.favorites.filter((id) => id !== font.id);
          state.disabled = state.disabled.filter((id) => id !== font.id);
          state.collections.forEach((collection) => { collection.fontIds = collection.fontIds.filter((id) => id !== font.id); });
          selectedId = filteredFonts()[0]?.id || fonts[0]?.id || null;
          persist();
          render();
        },
      });
    }

    const showView = (nextView) => {
      if (!['sample','repertoire','custom','info'].includes(nextView)) return;
      view = nextView;
      renderPreview();
    };
    const selectCollection = (id) => {
      if (!builtInCollections().some((collection) => collection.id === id) && !customCollection(id)) return;
      selectedCollection = id;
      query = '';
      search.value = '';
      render();
    };
    const adjustSize = (delta) => {
      previewSize = Math.max(12, Math.min(96, previewSize + delta));
      renderPreview();
    };
    const actions = {
      'install-font':() => fileInput.click(),
      'scan-local-fonts':scanLocalFonts,
      'validate-font':validateSelected,
      'toggle-font-enabled':toggleEnabled,
      'toggle-font-favorite':toggleFavorite,
      'remove-font':removeSelectedFont,
      'new-collection':newCollection,
      'delete-collection':deleteCollection,
      'focus-search':() => { search.focus(); search.select(); },
      'show-sample':() => showView('sample'),
      'show-repertoire':() => showView('repertoire'),
      'show-custom':() => showView('custom'),
      'show-font-info':() => showView('info'),
      'show-all-fonts':() => selectCollection('all'),
      'show-favorites':() => selectCollection('favorites'),
      'show-computer-fonts':() => selectCollection('computer'),
      'show-user-fonts':() => selectCollection('user'),
      'larger-preview':() => adjustSize(2),
      'smaller-preview':() => adjustSize(-2),
    };

    win = System.createWindow({
      app:'fontbook', title:t('ui.0f549f2b28fc'), width:930, height:590,
      toolbar, content:root, statusbar:t('ui.615d4a553986'),
      onClose:() => true,
    });

    installButton.addEventListener('click', () => fileInput.click());
    scanButton.addEventListener('click', scanLocalFonts);
    validateButton.addEventListener('click', validateSelected);
    enableButton.addEventListener('click', toggleEnabled);
    fileInput.addEventListener('change', () => installFiles(fileInput.files || []));
    search.addEventListener('input', () => {
      query = search.value;
      renderFamilyList();
      renderPreview();
    });
    collectionList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-collection]');
      if (button) selectCollection(button.dataset.collection);
    });
    root.querySelector('[data-collection-add]').addEventListener('click', newCollection);
    collectionRemove.addEventListener('click', deleteCollection);
    preview.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-font-view]');
      if (viewButton) showView(viewButton.dataset.fontView);
    });
    favoriteButton.addEventListener('click', toggleFavorite);
    styleSelect.addEventListener('change', () => {
      selectedStyle = styleSelect.value;
      renderPreview();
    });
    sizeSlider.addEventListener('input', () => {
      previewSize = Number(sizeSlider.value);
      sizeOutput.textContent = `${previewSize} pt`;
      const sample = previewBody.querySelector('.fontbook-sample');
      if (sample) sample.style.setProperty('--fontbook-size', `${previewSize}px`);
      const custom = previewBody.querySelector('.fontbook-custom>div');
      if (custom) custom.style.fontSize = `${previewSize}px`;
    });
    win.addEventListener('leopard-command', (event) => {
      const action = actions[event.detail?.command];
      if (action) {
        event.preventDefault();
        action();
      }
    });

    render();
    restoreUserFonts();
    return win;
  }

  System.registerApp({
    id:'fontbook', name:t('ui.0f549f2b28fc'), icon, open,
    about:t('ui.b6cf052ad92b'),
    keywords:t('ui.51b1de9c2d4f'),
  });
})();
