// 文本编辑 (TextEdit) — Leopard-style rich-text documents with VFS persistence.
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="10" y="4" width="44" height="56" rx="3" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><g stroke="#b0b8c8" stroke-width="1.6"><line x1="16" y1="16" x2="48" y2="16"/><line x1="16" y1="23" x2="48" y2="23"/><line x1="16" y1="30" x2="48" y2="30"/><line x1="16" y1="37" x2="40" y2="37"/></g><path d="M46 34 L54 42 L38 58 L30 60 L32 50 Z" fill="#d8935a" stroke="#8a5a30" stroke-width="1.5"/><path d="M46 34 L54 42 L50 46 L42 38 Z" fill="#c8c8c8" stroke="#8a5a30" stroke-width="1.5"/></svg>`;

  function sanitizeRichText(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on') || (['href','src'].includes(name) && /^\s*javascript:/i.test(attribute.value))) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return template.innerHTML;
  }

  function open(arg) {
    let preferences = System.getAppPreferences?.('textedit') || {};
    const path = arg?.path ? VFS.normalize(arg.path) : null;
    const node = path ? VFS.get(path) : null;
    const extension = path ? (VFS.baseName(path).split('.').pop() || '').toLowerCase() : '';
    const textNode = node?.type === 'file' && (
      typeof node.richText === 'string'
      || typeof node.content === 'string'
      || /^text\//i.test(node.mime || '')
      || ['txt','text','rtf','md','html','htm','log','csv'].includes(extension)
    );
    const toolbar = el('div', 'te-toolbar');
    const wrap = el('div', 'te-document');
    const ruler = el('div', 'te-ruler');
    ruler.setAttribute('aria-label', '标尺');
    const rulerMarks = el('div', 'te-ruler-marks');
    rulerMarks.innerHTML = Array.from({ length:12 }, (_, index) => `<i><span>${index + 1}</span></i>`).join('');
    ruler.appendChild(rulerMarks);
    const page = el('div', 'te-page');
    page.contentEditable = 'true';
    page.spellcheck = true;
    page.setAttribute('role', 'textbox');
    page.setAttribute('aria-multiline', 'true');
    page.setAttribute('aria-label', '文稿内容');
    const scroll = el('div', 'te-scroll');
    scroll.appendChild(page);
    wrap.append(ruler, scroll);
    let richDocument = typeof node?.richText === 'string' || (!path && preferences.documentFormat !== 'plain');
    if (!path && preferences.showRuler === false) ruler.classList.add('hidden');

    if (textNode) {
      if (typeof node.richText === 'string') page.innerHTML = sanitizeRichText(node.richText);
      else page.innerText = node.content || '';
    }

    let win = null;
    let lastSavedMarkup = page.innerHTML;
    let closePrompt = null;
    let saveFeedbackTimer = 0;
    let findState = { query:'', matches:[], index:-1, ignoreCase:true };
    const applyPreferences = () => {
      page.style.fontFamily = String(preferences.fontFamily || 'Helvetica');
      page.style.fontSize = `${Number(preferences.fontSize) || 13}px`;
      page.spellcheck = preferences.checkSpelling !== false;
      wrap.classList.toggle('wrap-to-page', !!preferences.wrapToPage);
      wrap.classList.toggle('plain-document', !richDocument);
      toolbar.classList.toggle('plain-document', !richDocument);
      page.dataset.smartQuotes = preferences.smartQuotes === false ? 'false' : 'true';
    };
    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'textedit') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('textedit') || {};
      applyPreferences();
      emitDocumentState();
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);
    const documentName = () => win?._path ? VFS.baseName(win._path) : '未命名';
    const updateStatus = () => {
      if (!win?._status) return;
      const text = page.innerText.replace(/\n$/, '');
      const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
      win._status.textContent = `${text.length.toLocaleString()} 个字符 · ${words.toLocaleString()} 个词${win._documentDirty ? ' · 已修改' : ''}`;
    };
    const emitDocumentState = () => {
      if (win) {
        win.dataset.texteditRich = String(richDocument);
        win.dataset.texteditSpellcheck = String(page.spellcheck);
        win.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
      }
      document.dispatchEvent(new CustomEvent('document-state-changed', {
        detail:{ appId:'textedit', window:win, dirty:!!win?._documentDirty, path:win?._path || null },
      }));
    };
    const setDirty = (dirty) => {
      if (!win) return;
      const next = !!dirty;
      if (win._documentDirty === next) {
        updateStatus();
        return;
      }
      win._documentDirty = next;
      win.classList.toggle('document-dirty', next);
      win._title.textContent = documentName();
      updateStatus();
      emitDocumentState();
    };
    const checkDirty = () => setDirty(page.innerHTML !== lastSavedMarkup);
    const loadSavedDocument = () => {
      const saved = win?._path ? VFS.get(win._path) : null;
      if (saved?.type === 'file') {
        if (typeof saved.richText === 'string') page.innerHTML = sanitizeRichText(saved.richText);
        else page.innerText = saved.content || '';
      } else page.innerHTML = '';
      lastSavedMarkup = page.innerHTML;
      setDirty(false);
      page.focus();
    };

    const runFormat = (command, value) => {
      page.focus();
      document.execCommand(command, false, value);
      checkDirty();
    };
    const capturedRange = () => {
      const selection = getSelection();
      if (!selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      return page.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    };
    const restoreRange = (range) => {
      if (!range) return;
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      page.focus();
    };
    const selectOccurrence = (start,length) => {
      const walker = document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
      let offset = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const next = offset + node.data.length;
        if (!startNode && start >= offset && start <= next) {
          startNode = node;
          startOffset = Math.min(node.data.length,start-offset);
        }
        const end = start + length;
        if (startNode && end >= offset && end <= next) {
          endNode = node;
          endOffset = Math.min(node.data.length,end-offset);
          break;
        }
        offset = next;
      }
      if (!startNode || !endNode) return false;
      const range = document.createRange();
      range.setStart(startNode,startOffset);
      range.setEnd(endNode,endOffset);
      restoreRange(range);
      return true;
    };
    const rebuildMatches = (query,ignoreCase) => {
      const text = page.innerText;
      const source = ignoreCase ? text.toLocaleLowerCase('zh-CN') : text;
      const needle = ignoreCase ? query.toLocaleLowerCase('zh-CN') : query;
      const matches = [];
      let offset = 0;
      while (needle && (offset=source.indexOf(needle,offset)) >= 0) {
        matches.push({start:offset,length:query.length});
        offset += Math.max(1,query.length);
      }
      findState = {query,matches,index:-1,ignoreCase};
    };
    const showFindPanel = () => {
      const pane = el('div','textedit-find');
      pane.innerHTML = `<label><span>查找：</span><input class="aqua-input te-find-query"></label><label><span>替换为：</span><input class="aqua-input te-replace-query"></label><label class="spp-check te-find-case"><input type="checkbox" checked> 忽略大小写</label><output></output><div class="te-find-actions"><button class="aqua-btn te-find-previous">上一个</button><button class="aqua-btn te-find-next default">下一个</button><button class="aqua-btn te-replace-one">替换</button><button class="aqua-btn te-replace-all">全部替换</button></div>`;
      const query = pane.querySelector('.te-find-query');
      const replacement = pane.querySelector('.te-replace-query');
      const ignoreCase = pane.querySelector('.te-find-case input');
      const status = pane.querySelector('output');
      query.value = findState.query;
      const update = () => {
        rebuildMatches(query.value,ignoreCase.checked);
        status.textContent = query.value ? `找到 ${findState.matches.length} 项` : '请输入要查找的文字。';
      };
      const move = (direction) => {
        if (query.value !== findState.query || ignoreCase.checked !== findState.ignoreCase) update();
        if (!findState.matches.length) {
          status.textContent = '没有找到匹配文字。';
          return System.beep();
        }
        findState.index = (findState.index+direction+findState.matches.length)%findState.matches.length;
        const match = findState.matches[findState.index];
        selectOccurrence(match.start,match.length);
        status.textContent = `第 ${findState.index+1} 项，共 ${findState.matches.length} 项`;
      };
      query.addEventListener('input',update);
      ignoreCase.addEventListener('change',update);
      pane.querySelector('.te-find-previous').addEventListener('click',() => move(-1));
      pane.querySelector('.te-find-next').addEventListener('click',() => move(1));
      pane.querySelector('.te-replace-one').addEventListener('click',() => {
        const selected = getSelection()?.toString() || '';
        const equal = ignoreCase.checked
          ? selected.toLocaleLowerCase('zh-CN') === query.value.toLocaleLowerCase('zh-CN')
          : selected === query.value;
        if (!equal) return move(1);
        document.execCommand('insertText',false,replacement.value);
        checkDirty();
        update();
        move(1);
      });
      pane.querySelector('.te-replace-all').addEventListener('click',() => {
        const needle = query.value;
        if (!needle) return;
        let replacements = 0;
        const walker = document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const expression = new RegExp(escaped,ignoreCase.checked?'gi':'g');
        nodes.forEach((node) => {
          node.data = node.data.replace(expression,() => {replacements++;return replacement.value;});
        });
        checkDirty();
        update();
        status.textContent = `已替换 ${replacements} 项`;
      });
      update();
      System.showSheet({
        parent:win,title:'查找与替换',content:pane,className:'textedit-find-sheet',initialFocus:query,
        buttons:[{label:'完成',cancel:true}],
      });
    };
    const showFontPanel = () => {
      const selectionRange = capturedRange();
      const pane = el('div','textedit-font-panel');
      pane.innerHTML = `<label><span>字体：</span><select class="spp-select te-font-family"><option>Helvetica</option><option>Lucida Grande</option><option>Georgia</option><option>Times New Roman</option><option>Monaco</option></select></label><label><span>字号：</span><select class="spp-select te-font-size"><option value="2">10</option><option value="3">13</option><option value="4">16</option><option value="5">20</option><option value="6">26</option><option value="7">36</option></select></label><label><span>文字颜色：</span><select class="spp-select te-font-color"><option value="#111111">黑色</option><option value="#234f7b">深蓝色</option><option value="#982c25">红色</option><option value="#2d742f">绿色</option><option value="#6b3f87">紫色</option></select></label><p class="te-font-preview">Aa 字体预览 123</p>`;
      const family = pane.querySelector('.te-font-family');
      const size = pane.querySelector('.te-font-size');
      const color = pane.querySelector('.te-font-color');
      family.value = preferences.fontFamily || 'Helvetica';
      const update = () => {
        const preview = pane.querySelector('.te-font-preview');
        preview.style.fontFamily = family.value;
        preview.style.fontSize = `${({2:10,3:13,4:16,5:20,6:26,7:36})[size.value]}px`;
        preview.style.color = color.value;
      };
      family.addEventListener('change',update);size.addEventListener('change',update);color.addEventListener('change',update);update();
      System.showSheet({
        parent:win,title:'字体',content:pane,className:'textedit-font-sheet',initialFocus:family,
        buttons:[
          {label:'取消',cancel:true},
          {label:'应用',default:true,action:() => {
            restoreRange(selectionRange);
            document.execCommand('fontName',false,family.value);
            document.execCommand('fontSize',false,size.value);
            document.execCommand('foreColor',false,color.value);
            checkDirty();
          }},
        ],
      });
    };
    const insertLink = () => {
      const selectionRange = capturedRange();
      System.promptSheet({
        parent:win,title:'添加链接',message:'网页地址：',placeholder:'https://example.com',okLabel:'添加',
        onOK:(value) => {
          let address = String(value || '').trim();
          if (!address) return false;
          if (!/^(https?:|mailto:)/i.test(address)) address = `https://${address}`;
          restoreRange(selectionRange);
          document.execCommand('createLink',false,address);
          checkDirty();
        },
      });
    };
    const convertDocument = (toRich) => {
      if (toRich === richDocument) return;
      const apply = () => {
        if (!toRich) page.textContent = page.innerText;
        richDocument = toRich;
        applyPreferences();
        setDirty(true);
        emitDocumentState();
      };
      if (!toRich && /<(?:b|strong|i|em|u|font|a|ul|ol|img)\b/i.test(page.innerHTML)) {
        System.confirmSheet({
          parent:win,headline:'转换为纯文本？',
          message:'字体、颜色、链接、列表和图像等富文本格式将被移除。',
          okLabel:'转换',danger:true,onOK:apply,
        });
      } else apply();
    };
    const makeButton = (label, command, title) => {
      const button = el('button', 'te-btn', label);
      button.type = 'button';
      button.title = title;
      button.dataset.command = command;
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => runFormat(command));
      return button;
    };
    const bold = makeButton('<b>B</b>', 'bold', '粗体');
    const italic = makeButton('<i>I</i>', 'italic', '斜体');
    const underline = makeButton('<u>U</u>', 'underline', '下划线');
    const alignLeft = makeButton('≡', 'justifyLeft', '左对齐');
    const alignCenter = makeButton('≡', 'justifyCenter', '居中');
    alignCenter.classList.add('te-align-center');
    const alignRight = makeButton('≡', 'justifyRight', '右对齐');
    alignRight.classList.add('te-align-right');
    const sizeSelect = el('select', 'aqua-input te-size');
    sizeSelect.setAttribute('aria-label', '字号');
    [['2','小'],['3','常规'],['4','较大'],['5','大'],['6','特大']].forEach(([value, label]) => {
      const option = el('option', '', label);
      option.value = value;
      if (value === '3') option.selected = true;
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener('change', () => runFormat('fontSize', sizeSelect.value));
    const saveButton = el('button', 'te-btn te-save', '存储');
    saveButton.type = 'button';
    saveButton.title = '存储 (⌘S)';
    saveButton.dataset.command = 'save';
    toolbar.append(bold, italic, underline, el('span', 'te-tool-separator'), alignLeft, alignCenter, alignRight, sizeSelect, el('span', 'te-toolbar-space'), saveButton);
    applyPreferences();

    win = System.createWindow({
      app:'textedit', title:documentName(), width:620, height:500,
      toolbar, content:wrap, statusbar:'',
      onClose:(window, context) => {
        if (context.force || !window._documentDirty) {
          document.removeEventListener('app-preferences-changed', preferencesChanged);
          return true;
        }
        if (closePrompt?.shield.isConnected) return false;
        const body = el('div', 'te-save-warning');
        const warningIcon = el('div', 'te-save-warning-icon');
        warningIcon.innerHTML = icon;
        const copy = el('div');
        copy.innerHTML = `<h3>要存储对文稿“${documentName()}”所做的更改吗？</h3><p>如果不存储，您的更改将丢失。</p>`;
        body.append(warningIcon, copy);
        const finishClose = () => setTimeout(() => {
          if (window.isConnected) System.closeWindow(window);
        }, 170);
        closePrompt = System.showSheet({
          parent:window, title:'', content:body, className:'te-save-warning-sheet',
          buttons:[
            { label:'取消', cancel:true },
            { label:'不存储', danger:true, action:() => { setDirty(false); finishClose(); } },
            { label:'存储', default:true, action:() => setTimeout(() => doSave(false, finishClose), 170) },
          ],
          onClose:() => { closePrompt = null; },
        });
        return false;
      },
    });
    win._path = path && textNode ? path : null;
    win._title.textContent = documentName();
    win._documentDirty = false;
    updateStatus();
    emitDocumentState();
    if (win._path) System.addRecentDocument?.(win._path, 'textedit');

    function writeTo(targetPath) {
      targetPath = VFS.normalize(targetPath);
      let saved = false;
      try {
        const nextNode = {
          type:'file',
          content:page.innerText,
          mime:richDocument ? 'text/rtf' : 'text/plain',
        };
        if (richDocument) nextNode.richText = sanitizeRichText(page.innerHTML);
        saved = VFS.putNode(targetPath, nextNode);
      } catch (error) {
        console.error('TextEdit save failed:', error);
      }
      if (!saved) {
        System.alertBox('文本编辑', '无法存储文件。请确认目标文件夹仍然存在，并重试。');
        return false;
      }
      win._path = targetPath;
      lastSavedMarkup = page.innerHTML;
      setDirty(false);
      System.addRecentDocument?.(targetPath, 'textedit');
      clearTimeout(saveFeedbackTimer);
      win._title.textContent = `${documentName()} — 已存储`;
      saveFeedbackTimer = setTimeout(() => {
        if (win.isConnected) win._title.textContent = documentName();
      }, 900);
      return true;
    }

    function doSave(saveAs = false, onSaved) {
      if (win._path && !saveAs) {
        const saved = writeTo(win._path);
        if (saved) onSaved?.();
        return saved;
      }
      const directory = win._path ? VFS.parentOf(win._path) : '/用户/roll/文稿';
      const extension = richDocument ? 'rtf' : preferences.addTxtExtension === false ? '' : 'txt';
      const suggested = win._path ? VFS.baseName(win._path) : VFS.uniqueName(directory, '未命名', extension ? `.${extension}` : '');
      System.savePanel({
        parent:win, title:'存储文稿', startPath:directory,
        name:suggested, extension:extension || undefined,
        typeLabel:richDocument ? '多信息文本文稿' : '纯文本文稿', allowOverwrite:true,
        onSave:(targetPath) => {
          const saved = writeTo(targetPath);
          if (saved) onSaved?.();
          return saved;
        },
      });
      return false;
    }

    function revertDocument() {
      if (!win._path || !win._documentDirty) return;
      System.confirmSheet({
        parent:win, title:'复原文稿',
        headline:`要复原到上次存储的“${documentName()}”吗？`,
        message:'自上次存储以来所做的更改将会丢失。',
        okLabel:'复原', danger:true, onOK:loadSavedDocument,
      });
    }

    saveButton.addEventListener('click', () => doSave(false));
    page.addEventListener('input', checkDirty);
    page.addEventListener('keyup', updateStatus);
    page.addEventListener('mouseup', updateStatus);
    page.addEventListener('keydown', (event) => {
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault();
        runFormat('insertUnorderedList');
        return;
      }
      if (preferences.smartQuotes === false || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '"' && event.key !== "'") return;
      event.preventDefault();
      const selection = getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const prefix = range?.startContainer?.nodeType === Node.TEXT_NODE
        ? range.startContainer.data.slice(0,range.startOffset)
        : '';
      const opening = !prefix || /[\s([{—–-]$/.test(prefix);
      document.execCommand('insertText',false,event.key === '"' ? (opening?'“':'”') : (opening?'‘':'’'));
      checkDirty();
    });
    win.addEventListener('leopard-command', (event) => {
      const command = event.detail?.command;
      if (!command) return;
      if (command === 'open-document') {
        event.preventDefault();
        System.openPanel({
          parent:win, title:'打开文稿', startPath:win._path ? VFS.parentOf(win._path) : '/用户/roll/文稿',
          types:['txt','text','rtf','md','html','htm'], allowUpload:true,
          onOpen:(nextPath) => {
            System.addRecentDocument?.(nextPath, 'textedit');
            System.launch('textedit', { path:nextPath });
          },
        });
      } else if (command === 'save' || command === 'save-as') {
        event.preventDefault();
        doSave(command === 'save-as');
      } else if (command === 'revert-document') {
        event.preventDefault();
        revertDocument();
      } else if (command === 'toggle-ruler') {
        event.preventDefault();
        ruler.classList.toggle('hidden');
        emitDocumentState();
      } else if (command === 'show-fonts') {
        event.preventDefault();
        showFontPanel();
      } else if (command === 'find-text') {
        event.preventDefault();
        showFindPanel();
      } else if (command === 'insert-link') {
        event.preventDefault();
        insertLink();
      } else if (command === 'make-plain') {
        event.preventDefault();
        convertDocument(false);
      } else if (command === 'make-rich') {
        event.preventDefault();
        convertDocument(true);
      } else if (command === 'toggle-spelling') {
        event.preventDefault();
        preferences = System.updateAppPreferences?.('textedit',{checkSpelling:!page.spellcheck}) || {...preferences,checkSpelling:!page.spellcheck};
        page.spellcheck = preferences.checkSpelling !== false;
        emitDocumentState();
      } else if (command === 'bigger') {
        event.preventDefault();
        sizeSelect.value = String(Math.min(6, (+sizeSelect.value || 3) + 1));
        runFormat('fontSize', sizeSelect.value);
      } else if (command === 'smaller') {
        event.preventDefault();
        sizeSelect.value = String(Math.max(2, (+sizeSelect.value || 3) - 1));
        runFormat('fontSize', sizeSelect.value);
      } else if (['bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight','insertUnorderedList','indent','outdent'].includes(command)) {
        event.preventDefault();
        runFormat(command);
      }
    });
    page.focus();
  }

  System.registerApp({
    id:'textedit', name:'文本编辑', icon, open, multiWindow:true,
    about:'Leopard 文本编辑：富文本格式、标尺、字符统计、文稿撤销，以及关闭前的存储确认。',
    keywords:'textedit 编辑 写作 富文本 文稿',
  });
})();
