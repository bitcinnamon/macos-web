// Stickies — Leopard floating rich-text notes with import, export, search and arrangement.
(() => {
  const { el } = System;
  const storageKey = 'macweb.stickies.v2';
  const legacyKey = 'macweb.stickies.v1';
  const templateKey = 'macweb.stickies.template';
  const colors = {
    yellow:{name:'黄色',paper:'#fff7a8',edge:'#c6b54e',ink:'#302b16'},
    blue:{name:'蓝色',paper:'#cfe9ff',edge:'#79a8ca',ink:'#173247'},
    green:{name:'绿色',paper:'#d8f5c7',edge:'#83b86c',ink:'#20351a'},
    pink:{name:'粉红色',paper:'#ffd6e5',edge:'#c98aa2',ink:'#47202f'},
    purple:{name:'紫色',paper:'#e5d6ff',edge:'#9b84c5',ink:'#302444'},
    gray:{name:'灰色',paper:'#e4e4e4',edge:'#9c9c9c',ink:'#292929'},
  };
  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="stb" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e4f3ff"/><stop offset="1" stop-color="#98c9ec"/></linearGradient><linearGradient id="sty" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffbd0"/><stop offset="1" stop-color="#f2df69"/></linearGradient></defs><rect x="7" y="16" width="41" height="40" rx="2" fill="url(#sty)" stroke="#b5a33f" stroke-width="1.5" transform="rotate(-5 27 36)"/><rect x="17" y="9" width="41" height="41" rx="2" fill="url(#stb)" stroke="#6f9cc3" stroke-width="1.5" transform="rotate(3 38 29)"/><g transform="rotate(3 38 29)" stroke="#7da7ca" stroke-width="1.4"><path d="M23 21h29M23 29h29M23 37h23"/></g></svg>`;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,(character) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[character]));
  const textToHtml = (value) => escapeHtml(value).replace(/\n/g,'<br>');
  const safeHtml = (value) => {
    const template = document.createElement('template');
    template.innerHTML = String(value || '');
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','UL','OL','LI','FONT','SPAN','IMG','A']);
    [...template.content.querySelectorAll('*')].forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.textContent || ''));
        return;
      }
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const valueText = attribute.value;
        const allowedFont = node.tagName === 'FONT' && ['size','color','face'].includes(name);
        const allowedImage = node.tagName === 'IMG' && name === 'src' && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(valueText);
        const allowedLink = node.tagName === 'A' && name === 'href' && /^(https?:|mailto:)/i.test(valueText);
        if (!allowedFont && !allowedImage && !allowedLink) node.removeAttribute(attribute.name);
      });
      if (node.tagName === 'IMG') {
        node.alt = '便笺图像';
        node.draggable = false;
      }
      if (node.tagName === 'A') node.target = '_blank';
    });
    return template.innerHTML;
  };
  const plainText = (html) => {
    const container = document.createElement('div');
    const markup = safeHtml(html)
      .replace(/<br\s*\/?>/gi,'\n')
      .replace(/<\/(?:div|p|li)>/gi,'\n')
      .replace(/<li(?:\s[^>]*)?>/gi,'• ');
    container.innerHTML = markup;
    return (container.textContent || '').replace(/\n{3,}/g,'\n\n').trimEnd();
  };
  const firstLine = (note) => (plainText(note.html).split('\n').find((line) => line.trim()) || '新便笺').trim().slice(0,48);
  const timestampLabel = (value) => new Date(value || Date.now()).toLocaleString('zh-CN');

  let notes = null;
  const openNotes = new Map();
  let findState = { query:'', matches:[], index:-1, scope:'all' };

  const loadTemplate = () => {
    try { return {...JSON.parse(localStorage.getItem(templateKey))}; }
    catch (error) { return {}; }
  };
  const saveTemplate = (note) => {
    const value = {
      color:note.color,float:!!note.float,translucent:!!note.translucent,
      fontFamily:note.fontFamily || 'Marker Felt',fontSize:note.fontSize || 15,
      w:note.w || 250,h:note.h || 190,
    };
    localStorage.setItem(templateKey,JSON.stringify(value));
    Leopard.toast('便笺','当前便笺样式已设为默认。');
  };
  const normalizeNote = (note,index = 0) => ({
    id:Number(note.id) || Date.now()+index,
    html:safeHtml(note.html ?? textToHtml(note.text || '')),
    color:colors[note.color] ? note.color : 'yellow',
    x:Number(note.x) || 80 + index*28,
    y:Number(note.y) || 75 + index*25,
    w:Math.max(175,Number(note.w) || 250),
    h:Math.max(120,Number(note.h) || 190),
    created:Number(note.created) || Date.now(),
    modified:Number(note.modified) || Date.now(),
    float:!!note.float,translucent:!!note.translucent,collapsed:!!note.collapsed,
    fontFamily:note.fontFamily || 'Marker Felt',fontSize:Number(note.fontSize) || 15,
  });
  const load = () => {
    for (const key of [storageKey,legacyKey]) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(value) && value.length) return value.map(normalizeNote);
      } catch (error) {}
    }
    const now = Date.now();
    return [
      normalizeNote({id:1,color:'green',x:68,y:70,w:278,h:210,created:now,modified:now,html:'<b>欢迎使用便笺</b><br><br>便笺可以保存提醒、列表和常用文字。内容会自动存储。'}),
      normalizeNote({id:2,color:'yellow',x:325,y:118,w:265,h:205,created:now,modified:now,html:'<b>Leopard 小技巧</b><br><br>双击标题栏可收起；也可以设为浮动窗口或半透明。<br><br>按 ⌘N 新建便笺。'}),
      normalizeNote({id:3,color:'pink',x:545,y:78,w:245,h:180,created:now,modified:now,html:'<b>支持的内容</b><br><br>• 富文本样式<br>• 项目列表<br>• 拖入图像<br>• 查找与导入导出'}),
    ];
  };
  const save = () => {
    if (!notes) return;
    localStorage.setItem(storageKey,JSON.stringify(notes.map((note) => {
      const copy = {...note};
      delete copy.deleting;
      delete copy.zoomGeometry;
      return copy;
    })));
  };
  const activeRecord = () => {
    const window = System.topWindowOf('stickies');
    return openNotes.get(Number(window?.dataset.stickyId)) || [...openNotes.values()].at(-1) || null;
  };
  const recordFor = (note) => openNotes.get(note.id);

  const persistGeometry = (record) => {
    if (!record?.win?.isConnected || record.note.collapsed || record.note.zoomed) return;
    record.note.x = parseFloat(record.win.style.left) || record.note.x;
    record.note.y = parseFloat(record.win.style.top) || record.note.y;
    record.note.w = record.win.offsetWidth;
    record.note.h = record.win.offsetHeight;
    save();
  };
  const updateTitle = (record) => {
    const title = firstLine(record.note);
    record.win._title.textContent = title;
    record.win.querySelector('.titlebar').title = `创建：${timestampLabel(record.note.created)}\n修改：${timestampLabel(record.note.modified)}`;
  };
  const updateWindowState = (record) => {
    const { win,note,editor } = record;
    win.dataset.stickyId = String(note.id);
    win.dataset.stickyColor = note.color;
    win.dataset.stickyFloating = String(!!note.float);
    win.dataset.stickyTranslucent = String(!!note.translucent);
    win.dataset.stickyCollapsed = String(!!note.collapsed);
    win.dataset.stickyHasText = String(!!editor.innerText.trim());
    win.classList.toggle('sticky-floating',!!note.float);
    win.classList.toggle('sticky-translucent',!!note.translucent);
    win.classList.toggle('sticky-collapsed',!!note.collapsed);
    const palette = colors[note.color];
    win.style.setProperty('--sticky-paper',palette.paper);
    win.style.setProperty('--sticky-edge',palette.edge);
    win.style.setProperty('--sticky-ink',palette.ink);
    editor.style.fontFamily = `"${note.fontFamily}", "Lucida Grande", sans-serif`;
    editor.style.fontSize = `${note.fontSize}px`;
    updateTitle(record);
    win.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
  };
  const applyColor = (color) => {
    const record = activeRecord();
    if (!record || !colors[color]) return;
    record.note.color = color;
    record.note.modified = Date.now();
    updateWindowState(record);
    save();
  };
  const toggleCollapsed = (record = activeRecord(), force) => {
    if (!record) return;
    const next = force == null ? !record.note.collapsed : !!force;
    if (next === record.note.collapsed) return;
    if (next) {
      persistGeometry(record);
      record.note.expandedHeight = record.note.h;
      record.note.collapsed = true;
      record.win.style.height = '23px';
    } else {
      record.note.collapsed = false;
      record.win.style.height = `${Math.max(120,record.note.expandedHeight || record.note.h || 190)}px`;
    }
    updateWindowState(record);
    save();
  };
  const toggleZoom = (record = activeRecord()) => {
    if (!record) return;
    const { win,note } = record;
    if (!note.zoomed) {
      persistGeometry(record);
      note.zoomGeometry = {x:note.x,y:note.y,w:note.w,h:note.h};
      note.zoomed = true;
      note.collapsed = false;
      Object.assign(win.style,{left:'8px',top:'28px',width:`${innerWidth-16}px`,height:`${innerHeight-100}px`});
    } else {
      const geometry = note.zoomGeometry || note;
      note.zoomed = false;
      Object.assign(win.style,{left:`${geometry.x}px`,top:`${geometry.y}px`,width:`${geometry.w}px`,height:`${geometry.h}px`});
      delete note.zoomGeometry;
    }
    updateWindowState(record);
    save();
  };
  const toggleFloating = () => {
    const record = activeRecord();
    if (!record) return;
    record.note.float = !record.note.float;
    updateWindowState(record);
    save();
  };
  const toggleTranslucent = () => {
    const record = activeRecord();
    if (!record) return;
    record.note.translucent = !record.note.translucent;
    updateWindowState(record);
    save();
  };

  const selectOccurrence = (editor,start,length) => {
    const walker = document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
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
      const targetEnd = start + length;
      if (startNode && targetEnd >= offset && targetEnd <= next) {
        endNode = node;
        endOffset = Math.min(node.data.length,targetEnd-offset);
        break;
      }
      offset = next;
    }
    if (!startNode || !endNode) return false;
    const range = document.createRange();
    range.setStart(startNode,startOffset);
    range.setEnd(endNode,endOffset);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.focus();
    return true;
  };
  const rebuildFindMatches = (query,scope) => {
    const lowered = query.toLocaleLowerCase('zh-CN');
    const records = scope === 'current' ? [activeRecord()].filter(Boolean) : [...openNotes.values()];
    const matches = [];
    records.forEach((record) => {
      const text = record.editor.innerText;
      const searchable = text.toLocaleLowerCase('zh-CN');
      let offset = 0;
      while (lowered && (offset = searchable.indexOf(lowered,offset)) >= 0) {
        matches.push({record,start:offset,length:query.length});
        offset += Math.max(1,query.length);
      }
    });
    findState = {query,matches,index:-1,scope};
  };
  const findNext = (direction = 1,status,ownerWindow) => {
    if (!findState.matches.length) {
      if (status) status.textContent = '没有找到匹配文字。';
      return System.beep();
    }
    findState.index = (findState.index + direction + findState.matches.length) % findState.matches.length;
    const match = findState.matches[findState.index];
    System.focusWindow(match.record.win);
    if (match.record.note.collapsed) toggleCollapsed(match.record,false);
    selectOccurrence(match.record.editor,match.start,match.length);
    if (ownerWindow?.isConnected && ownerWindow !== match.record.win) System.focusWindow(ownerWindow);
    if (status) status.textContent = `第 ${findState.index+1} 项，共 ${findState.matches.length} 项`;
  };
  const showFind = () => {
    const record = activeRecord();
    if (!record) return;
    const pane = el('div','stickies-find');
    pane.innerHTML = `<label><span>查找：</span><input class="aqua-input stickies-find-query"></label><label><span>范围：</span><select class="spp-select stickies-find-scope"><option value="all">所有便笺</option><option value="current">当前便笺</option></select></label><p>输入文字后使用“上一个”或“下一个”浏览结果。</p><output></output>`;
    const query = pane.querySelector('.stickies-find-query');
    const scope = pane.querySelector('.stickies-find-scope');
    const status = pane.querySelector('output');
    query.value = findState.query;
    const update = () => {
      rebuildFindMatches(query.value,scope.value);
      status.textContent = query.value ? `找到 ${findState.matches.length} 项` : '请输入要查找的文字。';
    };
    query.addEventListener('input',update);
    scope.addEventListener('change',update);
    update();
    System.showSheet({
      parent:record.win,title:'查找',content:pane,className:'stickies-find-sheet',initialFocus:query,
      buttons:[
        {label:'关闭',cancel:true},
        {label:'上一个',closes:false,action:() => { if(query.value!==findState.query)update();findNext(-1,status,record.win);return false; }},
        {label:'下一个',default:true,closes:false,action:() => { if(query.value!==findState.query)update();findNext(1,status,record.win);return false; }},
      ],
    });
  };

  const runFormat = (command,value) => {
    const record = activeRecord();
    if (!record) return;
    if (record.note.collapsed) toggleCollapsed(record,false);
    record.editor.focus();
    document.execCommand(command,false,value);
    record.note.html = safeHtml(record.editor.innerHTML);
    record.note.modified = Date.now();
    updateWindowState(record);
    save();
  };
  const setFontFamily = (family) => {
    const record = activeRecord();
    if (!record) return;
    record.note.fontFamily = family;
    runFormat('fontName',family);
  };
  const changeFontSize = (delta) => {
    const record = activeRecord();
    if (!record) return;
    record.note.fontSize = Math.max(9,Math.min(36,record.note.fontSize + delta));
    updateWindowState(record);
    save();
  };

  const importText = () => {
    const record = activeRecord();
    System.openPanel({
      parent:record?.win,title:'导入文本',startPath:'/用户/roll/文稿',
      types:['txt','text','md','rtf','html','htm'],allowUpload:true,
      onOpen:async(path) => {
        const node = VFS.get(path);
        let text = typeof node?.content === 'string' ? node.content : '';
        if (!text && node?.src) {
          try { text = await (await fetch(node.src)).text(); } catch (error) {}
        }
        const html = /\.(?:html?|rtf)$/i.test(path) ? textToHtml(text.replace(/<[^>]+>/g,' ')) : textToHtml(text);
        newSticky('yellow',html,firstLine({html}) || VFS.baseName(path));
      },
    });
  };
  const exportNote = () => {
    const record = activeRecord();
    if (!record) return;
    const name = firstLine(record.note).replace(/[\\/:*?"<>|]/g,'-') || '便笺';
    System.savePanel({
      parent:record.win,title:'导出文本',startPath:'/用户/roll/文稿',
      name:VFS.uniqueName('/用户/roll/文稿',name,'.txt'),extension:'txt',typeLabel:'纯文本文稿',allowOverwrite:true,
      onSave:(path) => {
        const savedNode = VFS.putNode(path,{type:'file',kind:'document',mime:'text/plain',content:`${record.editor.innerText}\n`,creator:'stickies',generated:true});
        if (savedNode) {
          System.addRecentDocument?.(path,'stickies');
          Leopard.toast('便笺',`“${VFS.baseName(path)}”已导出。`);
        }
        return savedNode;
      },
    });
  };
  const exportAll = () => {
    const record = activeRecord();
    const content = notes.map((note,index) => `===== 便笺 ${index+1} · ${firstLine(note)} =====\n${plainText(note.html)}\n`).join('\n');
    System.savePanel({
      parent:record?.win,title:'导出所有便笺',startPath:'/用户/roll/文稿',
      name:VFS.uniqueName('/用户/roll/文稿','所有便笺','.txt'),extension:'txt',typeLabel:'纯文本文稿',allowOverwrite:true,
      onSave:(path) => VFS.putNode(path,{type:'file',kind:'document',mime:'text/plain',content,creator:'stickies',generated:true}),
    });
  };

  const arrange = (mode = 'screen') => {
    let records = [...openNotes.values()];
    if (mode === 'color') records.sort((left,right) => Object.keys(colors).indexOf(left.note.color)-Object.keys(colors).indexOf(right.note.color));
    else if (mode === 'content') records.sort((left,right) => firstLine(left.note).localeCompare(firstLine(right.note),'zh-CN'));
    else if (mode === 'date') records.sort((left,right) => right.note.modified-left.note.modified);
    else records.sort((left,right) => left.note.y-right.note.y || left.note.x-right.note.x);
    const availableWidth = Math.max(230,innerWidth-40);
    const cellWidth = 246;
    const cellHeight = 196;
    const columns = Math.max(1,Math.floor(availableWidth/cellWidth));
    records.forEach((record,index) => {
      if (record.note.collapsed) toggleCollapsed(record,false);
      record.note.zoomed = false;
      const column = index % columns;
      const row = Math.floor(index/columns);
      record.note.x = 18 + column*cellWidth;
      record.note.y = 38 + row*cellHeight;
      record.note.w = Math.min(230,availableWidth);
      record.note.h = 176;
      Object.assign(record.win.style,{left:`${record.note.x}px`,top:`${record.note.y}px`,width:`${record.note.w}px`,height:`${record.note.h}px`});
    });
    save();
  };
  const bringAllToFront = () => [...openNotes.values()].forEach((record) => System.focusWindow(record.win));

  const deleteNote = (record) => {
    if (!record) return;
    System.confirmSheet({
      parent:record.win,headline:`删除便笺“${firstLine(record.note)}”？`,
      message:'这会删除便笺内容。已导出的文本文件不会受到影响。',
      okLabel:'删除便笺',danger:true,onOK:() => {
        record.note.deleting = true;
        System.closeWindow(record.win);
      },
    });
  };

  function spawn(note) {
    const body = el('div','sticky-note');
    const editor = el('div','sticky-editor');
    editor.contentEditable = 'true';
    editor.setAttribute('role','textbox');
    editor.setAttribute('aria-multiline','true');
    editor.setAttribute('aria-label','便笺内容');
    editor.spellcheck = true;
    editor.innerHTML = safeHtml(note.html);
    body.appendChild(editor);
    let win = null;
    win = System.createWindow({
      app:'stickies',title:firstLine(note),width:note.w,height:note.collapsed?23:note.h,x:note.x,y:note.y,
      content:body,bodyBg:colors[note.color].paper,
      onClose:(_window,context) => {
        persistGeometry(recordFor(note));
        if (note.deleting) {
          openNotes.delete(note.id);
          notes = notes.filter((candidate) => candidate.id !== note.id);
          save();
          return true;
        }
        if (context?.reason !== 'close') {
          openNotes.delete(note.id);
          save();
          return true;
        }
        deleteNote(recordFor(note));
        return false;
      },
    });
    win.classList.add('sticky-window');
    win.style.minWidth = '175px';
    win.style.minHeight = '23px';
    const titlebar = win.querySelector('.titlebar');
    const collapseButton = el('button','sticky-title-control collapse','—');
    collapseButton.title = '收起/展开便笺';
    const zoomButton = el('button','sticky-title-control zoom','◇');
    zoomButton.title = '缩放便笺';
    titlebar.append(collapseButton,zoomButton);
    const record = {note,win,editor};
    openNotes.set(note.id,record);
    win.dataset.stickyId = String(note.id);
    updateWindowState(record);
    if (note.collapsed) win.classList.add('sticky-collapsed');

    const commit = () => {
      note.html = safeHtml(editor.innerHTML);
      note.modified = Date.now();
      updateWindowState(record);
      save();
    };
    editor.addEventListener('input',commit);
    editor.addEventListener('paste',(event) => {
      const text = event.clipboardData?.getData('text/plain');
      if (text == null) return;
      event.preventDefault();
      document.execCommand('insertText',false,text);
    });
    editor.addEventListener('keydown',(event) => {
      if (event.key === 'Tab' && event.altKey) {
        event.preventDefault();
        document.execCommand('insertText',false,'• ');
      }
    });
    editor.addEventListener('dragover',(event) => {
      if ([...event.dataTransfer.items].some((item) => item.kind === 'file')) {
        event.preventDefault();
        body.classList.add('drop-target');
      }
    });
    editor.addEventListener('dragleave',() => body.classList.remove('drop-target'));
    editor.addEventListener('drop',(event) => {
      body.classList.remove('drop-target');
      const file = [...event.dataTransfer.files].find((candidate) => candidate.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      if (file.size > 1.5*1024*1024) {
        System.alertBox('图像太大','便笺中的图像必须小于 1.5 MB。');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        editor.focus();
        document.execCommand('insertImage',false,reader.result);
        commit();
      };
      reader.readAsDataURL(file);
    });
    win.addEventListener('mouseup',() => persistGeometry(record));
    titlebar.addEventListener('dblclick',(event) => {
      if (event.target.closest('.sticky-title-control')) return;
      toggleCollapsed(record);
    });
    collapseButton.addEventListener('click',(event) => { event.stopPropagation();toggleCollapsed(record); });
    zoomButton.addEventListener('click',(event) => { event.stopPropagation();toggleZoom(record); });
    win.addEventListener('leopard-command',handleCommand);
    return win;
  }

  function newSticky(color,html = '',title = '') {
    if (!notes) notes = load();
    const template = loadTemplate();
    const id = Math.max(0,...notes.map((note) => Number(note.id)||0))+1;
    const note = normalizeNote({
      ...template,id,color:colors[color]?color:(template.color || 'yellow'),
      html:html || (title ? `<b>${escapeHtml(title)}</b><br>` : ''),
      x:80+(id%6)*31,y:68+(id%6)*27,created:Date.now(),modified:Date.now(),collapsed:false,
    });
    notes.push(note);
    save();
    const win = spawn(note);
    const record = recordFor(note);
    if (!html) {
      record.editor.focus();
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(record.editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return win;
  }

  const commandActions = {
    'new-sticky':() => newSticky(),
    'import-sticky':importText,
    'export-sticky':exportNote,
    'export-all-stickies':exportAll,
    'delete-sticky':() => deleteNote(activeRecord()),
    'focus-sticky-find':showFind,
    'toggle-sticky-floating':toggleFloating,
    'toggle-sticky-translucent':toggleTranslucent,
    'toggle-sticky-collapsed':() => toggleCollapsed(),
    'zoom-sticky':() => toggleZoom(),
    'sticky-color-yellow':() => applyColor('yellow'),
    'sticky-color-blue':() => applyColor('blue'),
    'sticky-color-green':() => applyColor('green'),
    'sticky-color-pink':() => applyColor('pink'),
    'sticky-color-purple':() => applyColor('purple'),
    'sticky-color-gray':() => applyColor('gray'),
    'sticky-bold':() => runFormat('bold'),
    'sticky-italic':() => runFormat('italic'),
    'sticky-underline':() => runFormat('underline'),
    'sticky-strike':() => runFormat('strikeThrough'),
    'sticky-list':() => runFormat('insertUnorderedList'),
    'sticky-font-lucida':() => setFontFamily('Lucida Grande'),
    'sticky-font-marker':() => setFontFamily('Marker Felt'),
    'sticky-font-monaco':() => setFontFamily('Monaco'),
    'sticky-font-georgia':() => setFontFamily('Georgia'),
    'sticky-font-bigger':() => changeFontSize(1),
    'sticky-font-smaller':() => changeFontSize(-1),
    'arrange-stickies-screen':() => arrange('screen'),
    'arrange-stickies-color':() => arrange('color'),
    'arrange-stickies-content':() => arrange('content'),
    'arrange-stickies-date':() => arrange('date'),
    'bring-stickies-front':bringAllToFront,
    'collapse-all-stickies':() => [...openNotes.values()].forEach((record) => toggleCollapsed(record,true)),
    'expand-all-stickies':() => [...openNotes.values()].forEach((record) => toggleCollapsed(record,false)),
    'use-sticky-default':() => { const record=activeRecord();if(record)saveTemplate(record.note); },
  };
  function handleCommand(event) {
    const action = commandActions[event.detail?.command];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function open() {
    if (!notes) notes = load();
    if (System.apps.stickies.windows.length) return;
    if (!notes.length) newSticky();
    else notes.forEach(spawn);
  }

  System.registerApp({
    id:'stickies',name:'便笺',icon,open,multiWindow:false,
    about:'Leopard 风格便笺：富文本、图像、查找、导入导出、颜色、浮动、半透明、收起与排列。',
    keywords:'stickies 便笺 贴纸 note reminder',
  });
})();
