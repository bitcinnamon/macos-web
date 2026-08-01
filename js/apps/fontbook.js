// 字体册 (Font Book) — collections, validation, local-font access and live preview
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="52" rx="4" fill="#f8f4e8" stroke="#9a8a60" stroke-width="1.5"/><rect x="10" y="6" width="10" height="52" rx="4" fill="#8a5a30"/><text x="36" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#333">F</text></svg>`;
  const STATE_KEY = 'macweb.fontbook.state';
  const USER_FONT_DIRECTORY = '/用户/roll/资源库/Fonts';
  const CANDIDATES = [
    'Lucida Grande', 'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman', 'Georgia',
    'Courier New', 'Monaco', 'Menlo', 'Geneva', 'Verdana', 'Trebuchet MS', 'Impact',
    'Comic Sans MS', 'Palatino', 'Optima', 'Futura', 'Gill Sans', 'Baskerville',
    'American Typewriter', 'Marker Felt', 'Papyrus', 'Brush Script MT', 'Copperplate',
    'PingFang SC', 'Hiragino Sans GB', 'Hiragino Kaku Gothic ProN', 'STHeiti',
    'STSong', 'STKaiti', 'SimSun', 'Songti SC', 'Kaiti SC', 'Heiti SC',
  ];
  const REPERTOIRE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßŒœŠšŸ中文字体示例，。！？「」『』￥€£¢©®™✓★◆♠♥♦♣←↑→↓⌘⌥⌃⇧';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));
  const fontId = (family) => String(family).trim().toLocaleLowerCase('en-US').replace(/\s+/g, '-').replace(/[^a-z0-9\u3400-\u9fff-]/g, '');
  const isChineseFamily = (family) => /PingFang|Hiragino|Heiti|Songti|Kaiti|STHeiti|STSong|STKaiti|SimSun|黑体|宋体|楷体/i.test(family);
  const isFixedFamily = (family) => /Mono|Monaco|Menlo|Courier|Console|Code/i.test(family);
  const categoryFor = (family) => {
    if (isFixedFamily(family)) return '等宽';
    if (isChineseFamily(family)) return '中文';
    if (/Times|Georgia|Palatino|Baskerville|Song|Kaiti|楷|宋/i.test(family)) return '衬线';
    if (/Impact|Marker|Papyrus|Brush|Copperplate|Typewriter/i.test(family)) return '装饰';
    return '无衬线';
  };

  function isAvailable(font) {
    try {
      const context = document.createElement('canvas').getContext('2d');
      const sample = 'mmmmmmmmmmlliWWW字体0123';
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
      id:fontId(family), family, fullName:family, source:'电脑', category:categoryFor(family),
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
    const installButton = el('button', 'finder-toolbar-btn', '＋ 添加字体');
    const scanButton = el('button', 'finder-toolbar-btn', '⌖ 扫描本机');
    const validateButton = el('button', 'finder-toolbar-btn', '✓ 验证字体');
    const enableButton = el('button', 'finder-toolbar-btn', '停用');
    const toolbarSpacer = el('i');
    const search = el('input', 'aqua-search fontbook-search');
    search.type = 'search';
    search.placeholder = '搜索';
    search.setAttribute('aria-label', '搜索字体');
    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
    fileInput.multiple = true;
    fileInput.hidden = true;
    toolbar.append(installButton, scanButton, validateButton, enableButton, toolbarSpacer, search, fileInput);

    const root = el('div', 'fontbook-app');
    root.innerHTML = `<aside class="fontbook-collections"><header>收藏集</header><div></div><footer><button data-collection-add title="新建收藏集">＋</button><button data-collection-remove title="删除收藏集">−</button><i></i></footer></aside>
      <section class="fontbook-families"><header><b>字体</b><span></span></header><div role="listbox" aria-label="字体家族"></div></section>
      <main class="fontbook-preview"><header><div><b></b><small></small></div><label>字体样式：<select class="fontbook-style"><option value="normal">常规体</option><option value="bold">粗体</option><option value="italic">斜体</option><option value="bold-italic">粗斜体</option></select></label><nav><button data-font-view="sample">样本</button><button data-font-view="repertoire">字形</button><button data-font-view="custom">自定</button><button data-font-view="info">信息</button></nav></header><section></section><footer><button class="aqua-btn fontbook-favorite">☆ 收藏</button><label>A <input class="fontbook-size" type="range" min="12" max="96" value="38"><output>38 pt</output> A</label></footer></main>`;
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
    let customText = '春眠不觉晓 AaBbCc 123\nThe quick brown fox jumps over the lazy dog.';
    let query = '';
    let localFontPermission = 'unknown';

    const selectedFont = () => fonts.find((font) => font.id === selectedId) || null;
    const isDisabled = (font) => !!font && state.disabled.includes(font.id);
    const isFavorite = (font) => !!font && state.favorites.includes(font.id);
    const customCollection = (id = selectedCollection) => state.collections.find((collection) => collection.id === id);
    const builtInCollections = () => [
      { id:'all', icon:'▤', name:'所有字体', filter:() => true },
      { id:'favorites', icon:'★', name:'收藏夹', filter:(font) => isFavorite(font) },
      { id:'computer', icon:'▰', name:'电脑', filter:(font) => font.source !== '用户' },
      { id:'user', icon:'⌂', name:'用户', filter:(font) => font.source === '用户' },
      { id:'chinese', icon:'文', name:'中文', filter:(font) => isChineseFamily(font.family) },
      { id:'fixed', icon:'⌨', name:'等宽', filter:(font) => isFixedFamily(font.family) },
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
      win.dataset.fontbookCanRemove = String(font?.source === '用户');
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
      makeHeading('字体');
      builtInCollections().slice(0, 4).forEach(makeButton);
      makeHeading('智能收藏集');
      builtInCollections().slice(4).forEach(makeButton);
      makeHeading('用户收藏集');
      state.collections.forEach((collection) => makeButton({ ...collection, icon:'▧' }));
      if (!state.collections.length) collectionList.appendChild(el('p', 'fontbook-no-collections', '点按“＋”建立收藏集。'));
      collectionRemove.disabled = !customCollection();
    };

    const renderFamilyList = () => {
      const visible = filteredFonts();
      if (!visible.some((font) => font.id === selectedId)) selectedId = visible[0]?.id || null;
      familyHeaderCount.textContent = `${visible.length} 个家族`;
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
            { label:isFavorite(font) ? '从收藏夹移除' : '添加到收藏夹', action:toggleFavorite },
            { label:isDisabled(font) ? '启用字体' : '停用字体', action:toggleEnabled },
            { label:'验证字体…', action:validateSelected },
            ...(collectionItems.length ? [{ sep:true }, { label:'添加到收藏集', submenu:collectionItems }] : []),
            ...(font.source === '用户' ? [{ sep:true }, { label:'移除字体…', action:removeSelectedFont }] : []),
          ]);
        });
        familyList.appendChild(button);
      });
      if (!visible.length) familyList.appendChild(el('p', 'fontbook-empty', '此收藏集中没有匹配的字体。'));
    };

    const applyPreviewTypeface = (element, font) => {
      element.style.fontFamily = isDisabled(font) ? 'serif' : `"${font.family}", serif`;
      element.style.fontWeight = selectedStyle.includes('bold') ? '700' : '400';
      element.style.fontStyle = selectedStyle.includes('italic') ? 'italic' : 'normal';
    };

    const renderPreview = () => {
      const font = selectedFont();
      preview.querySelector('header b').textContent = font?.family || '未选择字体';
      preview.querySelector('header small').textContent = font
        ? `${font.fullName} · ${font.source}${isDisabled(font) ? ' · 已停用' : ''}`
        : '请选择一个字体家族';
      validateButton.disabled = !font;
      enableButton.disabled = !font;
      enableButton.textContent = font && isDisabled(font) ? '启用' : '停用';
      favoriteButton.disabled = !font;
      favoriteButton.textContent = isFavorite(font) ? '★ 已收藏' : '☆ 收藏';
      styleSelect.value = selectedStyle;
      sizeSlider.value = String(previewSize);
      sizeOutput.textContent = `${previewSize} pt`;
      preview.querySelectorAll('[data-font-view]').forEach((button) => button.classList.toggle('sel', button.dataset.fontView === view));
      previewBody.innerHTML = '';
      if (!font) {
        previewBody.appendChild(el('div', 'fontbook-preview-empty', '请选择一个字体以查看预览。'));
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
        textarea.setAttribute('aria-label', '自定预览文字');
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
        const sampleWidth = context.measureText('AaBbCc 123 中文').width;
        info.innerHTML = `<header><span>F</span><div><h2>${escapeHtml(font.family)}</h2><p>${escapeHtml(font.fullName)}</p></div></header><dl>
          <dt>PostScript 名称：</dt><dd>${escapeHtml(font.family.replace(/\s+/g,'-'))}</dd>
          <dt>种类：</dt><dd>${escapeHtml(font.category)}字体</dd>
          <dt>位置：</dt><dd>${escapeHtml(font.path || '本机字体服务')}</dd>
          <dt>来源：</dt><dd>${escapeHtml(font.source)}</dd>
          <dt>状态：</dt><dd class="${isDisabled(font) ? 'warning' : 'ok'}">${isDisabled(font) ? '已停用' : '已启用'}</dd>
          <dt>字体度量：</dt><dd>样本文字 ${sampleWidth.toFixed(1)} px</dd>
          <dt>支持的样式：</dt><dd>常规体、粗体、斜体、粗斜体（浏览器合成可用）</dd>
          <dt>标识符：</dt><dd>${escapeHtml(font.id)}</dd>
        </dl>`;
        previewBody.appendChild(info);
      } else {
        const sample = el('article', 'fontbook-sample');
        sample.innerHTML = `<h1>春眠不觉晓</h1><h2>AaBbCc 123</h2><p>The quick brown fox jumps over the lazy dog.</p><p>处处闻啼鸟。夜来风雨声，花落知多少。</p><p class="fontbook-waterfall">${[12,18,24,36,48,64].map((size) => `<span style="font-size:${size}px">Font Book 字体册</span>`).join('')}</p>`;
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
          ? `${font.family} · ${font.category} · ${font.source} · ${isDisabled(font) ? '已停用' : '可用'}`
          : `${filteredFonts().length} 个字体家族`;
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
      Leopard.toast('字体册', `${font.family} 已${isDisabled(font) ? '停用' : '启用'}。`);
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
        parent:win, title:'新建字体收藏集', message:'收藏集名称：', value:'未命名收藏集', okLabel:'创建',
        validate:(name) => state.collections.some((collection) => collection.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN'))
          ? '已经存在同名收藏集。' : true,
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
        parent:win, headline:`删除收藏集“${collection.name}”？`,
        message:'收藏集中的字体不会被移除。',
        okLabel:'删除', danger:true,
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
        const chineseLoaded = await document.fonts.load(`36px "${font.family}"`, '中文字体');
        const duplicateCount = fonts.filter((candidate) => candidate.family.toLocaleLowerCase('en-US') === font.family.toLocaleLowerCase('en-US')).length;
        const canRender = font.source === '用户' || isAvailable(font.family);
        const checks = [
          ['字体可由浏览器载入', regularLoaded.length > 0 || canRender],
          ['拉丁字符渲染', canRender],
          ['中文回退链', chineseLoaded.length > 0 || document.fonts.check(`36px "${font.family}"`, '中文字体')],
          ['字体名称唯一', duplicateCount === 1],
          ['预览渲染', canRender],
        ];
        const content = el('div', 'fontbook-validation');
        content.innerHTML = `<header><span>✓</span><div><h3>验证“${escapeHtml(font.family)}”</h3><p>${checks.every(([,ok]) => ok) ? '未发现严重字体错误。' : '发现需要注意的字体项目。'}</p></div></header><section>${checks.map(([label,ok]) => `<p class="${ok ? 'ok' : 'warning'}"><i>${ok ? '✓' : '!'}</i><span>${escapeHtml(label)}</span><b>${ok ? '通过' : '警告'}</b></p>`).join('')}</section><small>验证基于 CSS Font Loading API、字形映射和字体册数据库；网页无法读取原始 OpenType 校验和。</small>`;
        System.showSheet({ parent:win, title:'字体验证', content, buttons:[{ label:'关闭', cancel:true }] });
      } catch (error) {
        System.alertBox('字体验证', `无法验证这个字体：${error.message || '未知错误'}`);
      } finally {
        endBusy();
        renderPreview();
      }
    }

    const ensureUserFontDirectory = () => {
      if (!VFS.get('/用户/roll/资源库')) VFS.mkdir('/用户/roll/资源库');
      if (!VFS.get(USER_FONT_DIRECTORY)) VFS.mkdir(USER_FONT_DIRECTORY);
      return VFS.isDir(USER_FONT_DIRECTORY);
    };

    const readAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.addEventListener('error', () => reject(reader.error || new Error('无法读取字体文件')));
      reader.readAsDataURL(file);
    });

    async function installFiles(fileList) {
      const filesToInstall = [...fileList].filter((file) => /\.(ttf|otf|woff2?)$/i.test(file.name));
      if (!filesToInstall.length) return System.alertBox('字体册', '请选择 TrueType、OpenType、WOFF 或 WOFF2 字体文件。');
      const endBusy = System.beginBusy(260);
      let installed = 0;
      let sessionOnly = 0;
      for (const file of filesToInstall) {
        try {
          const baseFamily = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() || '用户字体';
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
          fonts.push({ id, family, fullName:family, source:'用户', category:categoryFor(family), path, sessionOnly:!path });
          loadedFaces.set(id, face);
          selectedId = id;
          selectedCollection = 'user';
          installed++;
        } catch (error) {
          System.syslog(`字体册: 无法安装 ${file.name}: ${error.message}`, 'fontbook');
        }
      }
      endBusy();
      fileInput.value = '';
      render();
      if (installed) Leopard.toast('字体册', `已安装 ${installed} 个字体${sessionOnly ? `（${sessionOnly} 个仅用于本次会话）` : ''}。`);
      else System.alertBox('字体册', '未能安装所选字体，文件可能已损坏或不受浏览器支持。');
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
          fonts.push({ id, family:node.family, fullName:node.family, source:'用户', category:categoryFor(node.family), path });
          loadedFaces.set(id, face);
        } catch (error) {
          System.syslog(`字体册: 无法恢复 ${name}: ${error.message}`, 'fontbook');
        }
      }
      if (win?.isConnected) render();
    }

    async function scanLocalFonts() {
      if (typeof window.queryLocalFonts !== 'function') {
        localFontPermission = 'unsupported';
        updateWindowState();
        return System.alertBox('字体册', '此浏览器不支持“本地字体访问”权限；仍可通过“添加字体”选择字体文件。');
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
            source:'电脑', category:categoryFor(family), path:'由本地字体访问 API 提供',
          });
          added++;
        });
        localFontPermission = 'granted';
        render();
        Leopard.toast('字体册', `已读取 ${records.length} 个字体字面，新增 ${added} 个字体家族。`);
      } catch (error) {
        localFontPermission = error?.name === 'NotAllowedError' ? 'denied' : 'error';
        updateWindowState();
        System.alertBox('字体册', error?.name === 'NotAllowedError'
          ? '未获得读取本机字体的权限。你仍可使用当前列表或手动添加字体。'
          : `无法读取本机字体：${error.message || '未知错误'}`);
      } finally {
        scanButton.disabled = false;
        endBusy();
      }
    }

    function removeSelectedFont() {
      const font = selectedFont();
      if (!font || font.source !== '用户') return;
      System.confirmSheet({
        parent:win, headline:`移除字体“${font.family}”？`,
        message:font.path ? '字体将从用户字体文件夹移到废纸篓。' : '这个会话字体将从字体册移除。',
        okLabel:'移除', danger:true,
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
      app:'fontbook', title:'字体册', width:930, height:590,
      toolbar, content:root, statusbar:'正在检测可用字体…',
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
    id:'fontbook', name:'字体册', icon, open,
    about:'管理字体收藏集，预览与验证字体，并可在获得授权后读取本机字体或安装字体文件。',
    keywords:'font 字体 fontbook collection validate local fonts',
  });
})();
