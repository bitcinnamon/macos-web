// 备忘录 (Notes) — localStorage-backed notes with list + editor
(() => {
  const { el } = System;
  const KEY = 'macweb.notes.v1';

  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="ntg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9d6"/><stop offset="1" stop-color="#f5e58f"/></linearGradient></defs><rect x="10" y="6" width="44" height="52" rx="4" fill="url(#ntg)" stroke="#b8a244" stroke-width="1.5"/><rect x="10" y="6" width="44" height="10" rx="4" fill="#e8c94f" stroke="#b8a244" stroke-width="1.5"/><g stroke="#c9b96a" stroke-width="1.5"><line x1="16" y1="26" x2="48" y2="26"/><line x1="16" y1="34" x2="48" y2="34"/><line x1="16" y1="42" x2="48" y2="42"/><line x1="16" y1="50" x2="38" y2="50"/></g></svg>`;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v) && v.length) return v;
    } catch (e) {}
    return [{ id: 1, text: '欢迎使用备忘录！\n\n- 左侧是备忘录列表\n- 内容自动保存到浏览器\n- 点「＋ 新建」再记一条', ts: Date.now() }];
  }
  function save(notes) { localStorage.setItem(KEY, JSON.stringify(notes)); }
  function firstLine(t) { return (t.trim().split('\n')[0] || '新备忘录').slice(0, 20); }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function open() {
    let notes = load();
    let cur = notes[0].id;

    const outer = el('div');
    outer.style.cssText = 'display:flex;flex-direction:column;height:100%';
    const head = el('div', 'notes-head');
    const btnNew = el('button', 'notes-btn', '＋ 新建');
    const btnDel = el('button', 'notes-btn', '删除');
    head.append(btnNew, btnDel);

    const layout = el('div', 'notes-layout');
    const list = el('div', 'notes-list');
    const editor = el('textarea', 'notes-editor');
    editor.spellcheck = false;
    layout.append(list, editor);
    outer.append(head, layout);

    function renderList() {
      list.innerHTML = '';
      notes.slice().sort((a, b) => b.ts - a.ts).forEach((n) => {
        const item = el('div', 'notes-item' + (n.id === cur ? ' sel' : ''));
        const itemTitle = el('div', 'ni-title');
        const itemDate = el('div', 'ni-date');
        itemTitle.textContent = firstLine(n.text);
        itemDate.textContent = fmtDate(n.ts);
        item.append(itemTitle, itemDate);
        item.addEventListener('click', () => { cur = n.id; renderList(); renderEditor(); });
        list.appendChild(item);
      });
    }
    function current() { return notes.find((n) => n.id === cur); }
    function renderEditor() { const n = current(); editor.value = n ? n.text : ''; }

    editor.addEventListener('input', () => {
      const n = current();
      if (!n) return;
      n.text = editor.value;
      n.ts = Date.now();
      save(notes);
      renderList();
    });
    btnNew.addEventListener('click', () => {
      const id = Math.max(0, ...notes.map((n) => n.id)) + 1;
      notes.push({ id, text: '', ts: Date.now() });
      cur = id;
      save(notes);
      renderList(); renderEditor();
      editor.focus();
    });
    btnDel.addEventListener('click', () => {
      if (notes.length <= 1) { System.alertBox('备忘录', '至少保留一条备忘录。'); return; }
      notes = notes.filter((n) => n.id !== cur);
      cur = notes[0].id;
      save(notes);
      renderList(); renderEditor();
    });

    renderList(); renderEditor();
    System.createWindow({ app: 'notes', title: '备忘录', width: 560, height: 400, content: outer });
  }

  System.registerApp({
    id: 'notes', name: '备忘录', icon, open,
    about: '黄色横格纸风格的备忘录，内容自动保存到 localStorage。',
    keywords: 'notes 备忘录 记事',
  });
})();
