// Detailed Leopard-era native applications.
(() => {
  const { el } = System;
  const jsonStore = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || JSON.parse(JSON.stringify(fallback)); }
    catch (e) { return JSON.parse(JSON.stringify(fallback)); }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const formatBytes = (bytes) => {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value} 字节`;
    if (value < 1048576) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
    return `${(value / 1048576).toFixed(value < 10485760 ? 1 : 0)} MB`;
  };
  const icon = (id, c1, c2, mark) => `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="${id}s"><feGaussianBlur in="SourceAlpha" stdDeviation="1.1"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect x="6" y="6" width="52" height="52" rx="11" fill="url(#${id}g)" stroke="rgba(0,0,0,.42)" stroke-width="1.5" filter="url(#${id}s)"/>
    <path d="M10 12h44" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
    <g fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${mark}</g></svg>`;

  // ---------- Mail ----------
  const MAIL_KEY = 'macweb.mail.v1';
  const defaultMail = {
    messages: [
      { id: 1, box: 'inbox', from: 'Apple', to: 'roll@example.com', subject: '欢迎使用 Mail', date: '今天 09:41', unread: true, body: '欢迎使用 Mac OS X Leopard Mail。\n\n使用工具栏收取邮件、撰写新邮件，或在侧栏中查看智能邮箱、RSS、备忘录和待办事项。' },
      { id: 2, box: 'inbox', from: 'Mac OS X Tips', to: 'roll@example.com', subject: '快速查看附件', date: '昨天 18:22', unread: true, body: '在 Finder 或 Mail 中选择附件并按空格键，即可使用 Quick Look 预览，而不必打开其他应用程序。' },
      { id: 3, box: 'inbox', from: 'iCal Server', to: 'roll@example.com', subject: '项目日历邀请', date: '周一 14:05', unread: false, body: '您被邀请参加“Leopard 完成度检查”。\n时间：本周五 10:00\n地点：视频会议' },
      { id: 4, box: 'sent', from: 'roll@example.com', to: 'team@example.com', subject: '设计稿已更新', date: '周日 20:10', unread: false, body: 'Finder、Dock 和菜单栏设计稿已经更新。' },
      { id: 5, box: 'rss', from: 'Apple Hot News', to: '', subject: 'Leopard 的 300 多项新功能', date: '2007-10-26', unread: false, body: 'Time Machine、Quick Look、Spaces、Stacks 和重新设计的 Finder 已经到来。' },
    ],
    notes: [{ id: 101, title: 'Leopard 待完善', body: '检查 Mail、iChat、Dashboard 和 Time Machine。', date: '今天' }],
    todos: [{ id: 201, title: '验证 Quick Look', done: false }, { id: 202, title: '整理下载堆栈', done: true }],
  };
  const mailData = () => {
    const stored = jsonStore(MAIL_KEY, defaultMail);
    const copyDefault = (key) => JSON.parse(JSON.stringify(defaultMail[key]));
    const normalized = {
      ...stored,
      messages: Array.isArray(stored?.messages) ? stored.messages : copyDefault('messages'),
      notes: Array.isArray(stored?.notes) ? stored.notes : copyDefault('notes'),
      todos: Array.isArray(stored?.todos) ? stored.todos : copyDefault('todos'),
    };
    // iCal can be opened before Mail.  Persist the completed structure so
    // either application may safely become the first writer.
    save(MAIL_KEY, normalized);
    return normalized;
  };
  const mailIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mail-sky" x2="0" y2="1"><stop stop-color="#bdeaff"/><stop offset=".55" stop-color="#4ba3df"/><stop offset="1" stop-color="#246aa9"/></linearGradient><linearGradient id="mail-paper" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dce5ec"/></linearGradient><filter id="mail-shadow"><feDropShadow dy="2" stdDeviation="1.3" flood-opacity=".4"/></filter></defs><g filter="url(#mail-shadow)"><rect x="6" y="5" width="52" height="54" rx="3" fill="url(#mail-sky)" stroke="#375e7d" stroke-width="1.5"/><path d="M8 13h48M8 51h48" stroke="#fff" stroke-width="2" stroke-dasharray="5 3" opacity=".85"/><path d="M13 20h38v29H13z" fill="url(#mail-paper)" stroke="#4a6e88"/><path d="m14 21 18 15 18-15M14 48l13-14M50 48 37 34" fill="none" stroke="#7295ad" stroke-width="1.8"/><circle cx="45" cy="14" r="6" fill="#fff8" stroke="#fff"/><path d="m42 14 2 2 4-5" fill="none" stroke="#397eb2" stroke-width="1.5"/></g></svg>`;

  function composeMail(replyTo) {
    const data = mailData();
    const preferences = System.getAppPreferences?.('mail') || {};
    const isForward = !!replyTo?.forward;
    const accountAddress = preferences.emailAddress || 'roll@example.com';
    const initialSubject = replyTo
      ? isForward
        ? `转发：${String(replyTo.subject || '').replace(/^转发：/,'')}`
        : `回复：${String(replyTo.subject || '').replace(/^回复：/,'')}`
      : '';
    const quotedBody = replyTo
      ? isForward
        ? `\n\n---------- 转发的邮件 ----------\n发件人：${replyTo.from}\n日期：${replyTo.date}\n主题：${replyTo.subject}\n\n${replyTo.body}`
        : preferences.includeOriginal === false
          ? ''
          : `\n\n在 ${replyTo.date}，${replyTo.from} 写道：\n> ${replyTo.body.replace(/\n/g,'\n> ')}`
      : '';
    const signature = String(preferences.signature || '').trim();
    const initialBody = `${quotedBody}${signature ? `${quotedBody ? '\n\n' : ''}-- \n${signature}` : ''}`;
    let attachments = [...new Set((replyTo?.forwardAttachments || [])
      .map((path) => VFS.normalize(path))
      .filter((path) => VFS.get(path)?.type === 'file'))];
    const wrap = el('div','mail-compose');
    wrap.innerHTML = `<div class="mail-compose-fields">
      <label>收件人：<input class="aqua-input to" value="${esc(isForward ? '' : replyTo?.from || '')}"></label>
      <label>抄送：<input class="aqua-input cc"></label>
      <label>主题：<input class="aqua-input subject" value="${esc(initialSubject)}"></label></div>
      <div class="mail-formatbar"><button>字体</button><button>B</button><button><i>I</i></button><button>颜色</button><span></span><select aria-label="邮件格式"><option value="plain">纯文本</option><option value="rich">多信息文本</option><option value="stationery">Apple Stationery</option></select></div>
      <div class="mail-attachment-strip" hidden></div>
      <textarea class="mail-compose-body">${esc(initialBody)}</textarea>`;
    const toolbar = el('div','mail-compose-toolbar');
    const send = el('button','finder-toolbar-btn','发送');
    const saveDraft = el('button','finder-toolbar-btn','存储为草稿');
    const attach = el('button','finder-toolbar-btn','附加');
    toolbar.append(send,saveDraft,attach);
    const win = System.createWindow({app:'mail',title:'新邮件',width:680,height:500,toolbar,content:wrap,statusbar:'未检查拼写'});
    const bodyEditor=wrap.querySelector('.mail-compose-body');
    const formatSelect=wrap.querySelector('.mail-formatbar select');
    const attachmentStrip=wrap.querySelector('.mail-attachment-strip');
    formatSelect.value=preferences.messageFormat === 'plain' ? 'plain' : 'rich';
    bodyEditor.spellcheck=preferences.spellCheck !== 'never';
    if(formatSelect.value==='plain')bodyEditor.classList.add('plain');
    formatSelect.addEventListener('change',()=>{
      bodyEditor.classList.toggle('plain',formatSelect.value==='plain');
      win._status.textContent=formatSelect.value==='plain'?'纯文本邮件':'多信息文本邮件';
    });
    const renderAttachments=()=>{
      attachments=attachments.filter((path)=>VFS.get(path)?.type==='file');
      attachmentStrip.innerHTML='';
      attachmentStrip.hidden=!attachments.length;
      if(!attachments.length)return;
      const heading=el('div','mail-attachment-heading');
      heading.innerHTML=`<b>${attachments.length} 个附件</b><span>${formatBytes(attachments.reduce((sum,path)=>sum+VFS.sizeOf(path),0))}</span>`;
      const cards=el('div','mail-attachment-cards');
      attachments.forEach((path)=>{
        const card=el('div','mail-attachment-card');
        const open=el('button','mail-attachment-open');
        const iconWrap=el('i');
        iconWrap.innerHTML=System.fileIconFor?.(path)||'<span aria-hidden="true">📄</span>';
        const label=el('span');
        label.append(el('b','',VFS.baseName(path)),el('small','',formatBytes(VFS.sizeOf(path))));
        open.append(iconWrap,label);
        open.title=`打开“${VFS.baseName(path)}”`;
        open.addEventListener('click',()=>System.openVfsPath?.(path));
        const remove=el('button','mail-attachment-remove','×');
        remove.title=`移除“${VFS.baseName(path)}”`;
        remove.setAttribute('aria-label',remove.title);
        remove.addEventListener('click',()=>{
          attachments=attachments.filter((candidate)=>candidate!==path);
          renderAttachments();
        });
        card.append(open,remove);
        cards.appendChild(card);
      });
      attachmentStrip.append(heading,cards);
    };
    renderAttachments();
    const formatButtons=[...wrap.querySelectorAll('.mail-formatbar button')];
    const toggleFormat=(property,onValue,offValue='')=>{
      bodyEditor.style[property]=bodyEditor.style[property]===onValue?offValue:onValue;
      bodyEditor.focus();
    };
    const showFonts=()=>{
      const panel=el('div','mail-font-panel');
      panel.innerHTML='<label>字体：<select class="aqua-input font"><option>Lucida Grande</option><option>Helvetica</option><option>Times New Roman</option><option>Georgia</option><option>Monaco</option></select></label><label>大小：<select class="aqua-input size"><option value="11">11 pt</option><option value="13">13 pt</option><option value="16">16 pt</option><option value="20">20 pt</option><option value="24">24 pt</option></select></label><label>颜色：<input class="color" type="color" value="#222222"></label><p>Leopard Mail 字体预览</p>';
      const family=panel.querySelector('.font'),size=panel.querySelector('.size'),color=panel.querySelector('.color'),preview=panel.querySelector('p');
      family.value=bodyEditor.style.fontFamily.replace(/["']/g,'')||'Lucida Grande';
      size.value=String(parseInt(bodyEditor.style.fontSize,10)||13);
      color.value=/^#[0-9a-f]{6}$/i.test(bodyEditor.style.color)?bodyEditor.style.color:'#222222';
      const update=()=>{preview.style.fontFamily=family.value;preview.style.fontSize=`${size.value}px`;preview.style.color=color.value;};
      [family,size,color].forEach(control=>control.addEventListener('input',update));update();
      System.showSheet({
        parent:win,title:'字体',content:panel,initialFocus:family,
        buttons:[
          {label:'取消',cancel:true},
          {label:'应用',default:true,action:()=>{
            bodyEditor.style.fontFamily=family.value;
            bodyEditor.style.fontSize=`${size.value}px`;
            bodyEditor.style.color=color.value;
            bodyEditor.focus();
          }},
        ],
      });
    };
    formatButtons[0]?.addEventListener('click',showFonts);
    formatButtons[1]?.addEventListener('click',()=>toggleFormat('fontWeight','bold'));
    formatButtons[2]?.addEventListener('click',()=>toggleFormat('fontStyle','italic'));
    formatButtons[3]?.addEventListener('click',showFonts);
    const collect = (box) => {
      const msg={id:Date.now(),box,from:accountAddress,to:wrap.querySelector('.to').value,cc:wrap.querySelector('.cc').value,subject:wrap.querySelector('.subject').value||'(无主题)',date:'现在',unread:false,body:wrap.querySelector('.mail-compose-body').value,format:formatSelect.value,attachments:attachments.slice()};
      data.messages.unshift(msg);save(MAIL_KEY,data);document.dispatchEvent(new CustomEvent('mail-changed'));return msg;
    };
    send.addEventListener('click',()=>{collect('sent');if(preferences.sendSound!==false)System.beep('ping',.25);System.closeWindow(win);Leopard.toast('Mail','邮件已放入“已发送”。');});
    saveDraft.addEventListener('click',()=>{collect('drafts');System.closeWindow(win);});
    attach.addEventListener('click',()=>System.openPanel({
      parent:win,title:'选择附件',
      startPath:VFS.isDir(preferences.attachmentPath)?preferences.attachmentPath:'/用户/roll/文稿',
      allowMultiple:true,allowUpload:true,
      onOpen:(paths)=>{
        attachments=[...new Set([...attachments,...paths.filter((path)=>VFS.get(path)?.type==='file')])];
        renderAttachments();
        return true;
      },
    }));
    win.addEventListener('leopard-command',event=>{
      const actions={
        'show-fonts':showFonts,
        'bold':()=>formatButtons[1]?.click(),
        'italic':()=>formatButtons[2]?.click(),
        'new-message':()=>composeMail(),
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
  }

  function openMail() {
    let data=mailData();
    let preferences=System.getAppPreferences?.('mail')||{};
    let box='inbox',selected=null,query='',win=null;
    let readTimer=0;
    const toolbar=el('div','mail-toolbar');
    const get=el('button','finder-toolbar-btn','收取邮件');
    const compose=el('button','finder-toolbar-btn','新邮件');
    const reply=el('button','finder-toolbar-btn','回复');
    const forward=el('button','finder-toolbar-btn','转发');
    const remove=el('button','finder-toolbar-btn','删除');
    const junk=el('button','finder-toolbar-btn','标记为垃圾邮件');
    const search=el('input','aqua-input aqua-search');search.placeholder='搜索邮件';
    toolbar.append(get,compose,reply,forward,remove,junk,search);
    const root=el('div','mail-app');
    root.innerHTML='<aside class="mail-sidebar"></aside><section class="mail-list"></section><article class="mail-reader"></article>';
    const side=root.querySelector('.mail-sidebar'),list=root.querySelector('.mail-list'),reader=root.querySelector('.mail-reader');
    const boxes=[['inbox','收件箱','📥'],['drafts','草稿','📝'],['sent','已发送','✈'],['trash','废纸篓','🗑'],['junk','垃圾邮件','⛔'],['rss','RSS','◉'],['notes','备忘录','📒'],['todos','待办事项','✓']];
    side.innerHTML='<h4>邮箱</h4>'+boxes.map(([id,name,ic])=>`<button data-box="${id}"><i>${ic}</i><span>${name}</span><b></b></button>`).join('');
    const renderReader=()=>{
      if(box==='notes'){
        const note=data.notes.find(n=>n.id===selected)||data.notes[0];
        reader.innerHTML=note?`<div class="mail-note-head"><input value="${esc(note.title)}"></div><textarea>${esc(note.body)}</textarea>`:'<div class="mail-empty">没有备忘录</div>';
        if(note){reader.querySelector('input').addEventListener('input',e=>{note.title=e.target.value;save(MAIL_KEY,data);});reader.querySelector('textarea').addEventListener('input',e=>{note.body=e.target.value;save(MAIL_KEY,data);});}
        return;
      }
      if(box==='todos'){
        reader.innerHTML=`<div class="mail-todos">${data.todos.map(t=>`<label><input type="checkbox" data-id="${t.id}" ${t.done?'checked':''}><span>${esc(t.title)}</span></label>`).join('')}<button class="aqua-btn add-todo">新建待办事项</button></div>`;
        reader.querySelectorAll('input').forEach(cb=>cb.addEventListener('change',()=>{
          const t=data.todos.find(x=>String(x.id)===String(cb.dataset.id));
          if(!t)return;
          t.done=cb.checked;save(MAIL_KEY,data);
          document.dispatchEvent(new CustomEvent('mail-data-changed',{detail:{source:'mail'}}));
          render();
        }));
        reader.querySelector('.add-todo')?.addEventListener('click',()=>System.promptSheet({
          parent:win,title:'新建待办事项',message:'待办事项：',okLabel:'添加',
          onOK:(title)=>{
            data.todos.push({id:String(Date.now()),title,done:false,due:'',calendarId:'home',priority:'none',notes:''});
            save(MAIL_KEY,data);
            document.dispatchEvent(new CustomEvent('mail-data-changed',{detail:{source:'mail'}}));
            render();
          },
        }));
        return;
      }
      const msg=data.messages.find(m=>m.id===selected);
      if(!msg){reader.innerHTML='<div class="mail-empty">未选择邮件</div>';return;}
      clearTimeout(readTimer);
      const markRead=()=>{
        if(!msg.unread)return;
        msg.unread=false;save(MAIL_KEY,data);
        reader.closest('.mail-app')?.querySelector(`.mail-row[data-id="${msg.id}"]`)?.classList.remove('unread');
      };
      if(preferences.markRead==='delay')readTimer=setTimeout(markRead,5000);
      else if(preferences.markRead!=='open')markRead();
      const attached=(msg.attachments||[]).filter(path=>VFS.get(path)?.type==='file');
      const attachmentMarkup=attached.length?`<section class="mail-reader-attachments"><header><b>${attached.length} 个附件</b><span>${formatBytes(attached.reduce((sum,path)=>sum+VFS.sizeOf(path),0))}</span></header><div>${attached.map(path=>`<button data-mail-attachment="${esc(path)}"><i>${System.fileIconFor?.(path)||'📄'}</i><span><b>${esc(VFS.baseName(path))}</b><small>${formatBytes(VFS.sizeOf(path))}</small></span></button>`).join('')}</div></section>`:'';
      reader.innerHTML=`<header><h2>${esc(msg.subject)}</h2><div><b>${esc(msg.from)}</b><span>发给 ${esc(msg.to||'我')} · ${esc(msg.date)}</span></div></header>
        <div class="mail-body">${esc(msg.body).replace(/\n/g,'<br>')}</div>
        ${attachmentMarkup}
        <footer><button class="aqua-btn data-contact">添加到通讯录</button><button class="aqua-btn data-event">添加到 iCal</button></footer>`;
      reader.querySelectorAll('[data-mail-attachment]').forEach(button=>button.addEventListener('click',()=>System.openVfsPath?.(button.dataset.mailAttachment)));
      reader.querySelector('.data-contact').addEventListener('click',()=>{localStorage.setItem('macweb.addressbook.pending',msg.from);System.launch('addressbook');});
      reader.querySelector('.data-event').addEventListener('click',()=>System.launch('ical'));
    };
    const render=()=>{
      side.querySelectorAll('button').forEach(b=>{const id=b.dataset.box;b.classList.toggle('sel',id===box);const count=id==='notes'?data.notes.length:id==='todos'?data.todos.filter(t=>!t.done).length:data.messages.filter(m=>m.box===id).length;b.querySelector('b').textContent=count||'';});
      list.innerHTML='';
      if(box==='notes'){data.notes.forEach(n=>{const row=el('button','mail-row');row.dataset.id=n.id;row.innerHTML=`<b>${esc(n.title)}</b><span>${esc(n.date)}</span><p>${esc(n.body.slice(0,65))}</p>`;row.classList.toggle('sel',n.id===selected);row.addEventListener('click',()=>{selected=n.id;render();});list.appendChild(row);});}
      else if(box==='todos'){list.innerHTML='<div class="mail-special-title">Mail 待办事项会与 iCal 同步</div>';}
      else data.messages.filter(m=>m.box===box&&(`${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(query))).forEach(m=>{const row=el('button','mail-row'+(m.unread?' unread':''));row.dataset.id=m.id;row.innerHTML=`<b>${esc(m.from)}</b><span>${esc(m.date)}</span><h3>${m.attachments?.length?'<i class="mail-paperclip" aria-label="包含附件">📎</i>':''}${esc(m.subject)}</h3><p>${esc(m.body.slice(0,70))}</p>`;row.classList.toggle('sel',m.id===selected);row.addEventListener('click',()=>{selected=m.id;render();});list.appendChild(row);});
      renderReader();
    };
    side.addEventListener('click',e=>{const b=e.target.closest('[data-box]');if(b){box=b.dataset.box;selected=null;render();}});
    compose.addEventListener('click',()=>composeMail());
    reply.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg)composeMail(msg);});
    forward.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg)composeMail({...msg,forward:true,forwardAttachments:msg.attachments||[]});});
    remove.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg){msg.box='trash';selected=null;save(MAIL_KEY,data);render();}});
    junk.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg){msg.box='junk';selected=null;save(MAIL_KEY,data);render();}});
    search.addEventListener('input',()=>{query=search.value.toLowerCase();render();});
    get.addEventListener('click',()=>{get.disabled=true;get.textContent='正在收取…';setTimeout(()=>{get.disabled=false;get.textContent='收取邮件';Leopard.toast('Mail','没有新邮件。');},900);});
    const mailChanged=()=>{
      data=mailData();
      if(selected&&!data.messages.some(message=>message.id===selected))selected=null;
      render();
    };
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='mail')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('mail')||{};
      if(win?._status)win._status.textContent=preferences.enabled===false?'帐户已停用':`已连接 · ${preferences.emailAddress||'roll@example.com'}`;
    };
    document.addEventListener('mail-changed',mailChanged);
    document.addEventListener('ical-data-changed',mailChanged);
    document.addEventListener('app-preferences-changed',preferencesChanged);
    render();
    win=System.createWindow({app:'mail',title:'Mail',width:960,height:600,toolbar,content:root,statusbar:preferences.enabled===false?'帐户已停用':`已连接 · ${preferences.emailAddress||'roll@example.com'}`,onClose:()=>{
      clearTimeout(readTimer);
      document.removeEventListener('mail-changed',mailChanged);
      document.removeEventListener('ical-data-changed',mailChanged);
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const actions={
        'new-message':()=>compose.click(),'new-window':()=>compose.click(),
        'reply-message':()=>reply.click(),'forward-message':()=>forward.click(),
        'delete':()=>remove.click(),'get-mail':()=>get.click(),
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
  }
  System.registerApp({id:'mail',name:'Mail',icon:mailIcon,open:openMail,about:'Leopard Mail：邮箱、RSS、备忘录、待办事项、撰写、回复、转发和数据检测器。',keywords:'mail 邮件 rss notes todos'});

  // ---------- Address Book ----------
  const AB_KEY='macweb.addressbook.v1';
  const AB_GROUPS_KEY='macweb.addressbook.groups.v1';
  const defaultGroups=[{id:'friends',name:'朋友'},{id:'work',name:'工作'}];
  const defaultContacts=[
    {id:1,first:'John',last:'Appleseed',company:'Apple',email:'john@apple.example',phone:'+1 408 555 0100',address:'1 Infinite Loop, Cupertino, CA',note:'Mac 用户',group:'friends'},
    {id:2,first:'李',last:'雷',company:'设计团队',email:'lilei@example.com',phone:'138 0000 0000',address:'上海市浦东新区',note:'Finder 项目',group:'work'},
    {id:3,first:'韩',last:'梅梅',company:'iCal Server',email:'hanmeimei@example.com',phone:'139 0000 0000',address:'北京市朝阳区',note:'',group:'friends'},
  ];
  const addressIcon=icon('ab','#c89158','#75421e','<path d="M17 12h32v40H17z" fill="#f2dfbd" stroke="#6c421e" stroke-width="1.5"/><path d="M17 18h32" stroke="#b89060" stroke-width="2"/><circle cx="33" cy="30" r="7" fill="#a16b3c"/><path d="M21 46q3-10 12-10t12 10" fill="#a16b3c"/><path d="M14 18h6M14 26h6M14 34h6M14 42h6" stroke="#503116" stroke-width="2"/>');
  function openAddressBook(){
    let preferences=System.getAppPreferences?.('addressbook')||{};
    const contacts=jsonStore(AB_KEY,defaultContacts);
    const groups=jsonStore(AB_GROUPS_KEY,defaultGroups);
    defaultGroups.forEach(defaultGroup=>{if(!groups.some(item=>item.id===defaultGroup.id))groups.push({...defaultGroup});});
    let migrated=false;
    contacts.forEach((contact,index)=>{
      if(!contact.group){contact.group=index===1?'work':'friends';migrated=true;}
      // Early demo data stored these two Chinese names as given-name/surname.
      // Migrate only those exact bundled records so user-created cards are untouched.
      if(contact.id===2&&contact.first==='李'&&contact.last==='雷'){
        contact.first='雷';contact.last='李';migrated=true;
      }else if(contact.id===3&&contact.first==='韩'&&contact.last==='梅梅'){
        contact.first='梅梅';contact.last='韩';migrated=true;
      }
    });
    if(migrated)save(AB_KEY,contacts);
    let selected=contacts[0]?.id||null,query='',group='all',win=null;
    const toolbar=el('div');const add=el('button','finder-toolbar-btn','＋');const del=el('button','finder-toolbar-btn','－');const card=el('button','finder-toolbar-btn','显示名片');const search=el('input','aqua-input aqua-search');search.placeholder='搜索';toolbar.append(add,del,card,search);
    const root=el('div','ab-app');root.innerHTML='<aside></aside><section class="ab-list"></section><article class="ab-card"></article>';
    const side=root.querySelector('aside'),list=root.querySelector('.ab-list'),detail=root.querySelector('.ab-card');
    const isCjkName=(contact)=>/^[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+$/.test(`${contact.first||''}${contact.last||''}`);
    const displayName=(contact)=>{
      const first=String(contact.first||'').trim(),last=String(contact.last||'').trim();
      if(!first)return last;if(!last)return first;
      if(isCjkName(contact))return preferences.nameOrder==='firstLast'?`${first}${last}`:`${last}${first}`;
      return preferences.nameOrder==='firstLast'?`${first} ${last}`:`${last}, ${first}`;
    };
    const initials=(contact)=>{
      const first=String(contact.first||'').trim(),last=String(contact.last||'').trim();
      return isCjkName(contact)?`${last[0]||''}${first[0]||''}`:`${first[0]||''}${last[0]||''}`;
    };
    const sortName=(contact)=>preferences.sortBy==='first'
      ? `${contact.first||''}${contact.last||''}` : `${contact.last||''}${contact.first||''}`;
    const groupName=(id)=>id==='all'?'所有联系人':groups.find(item=>item.id===id)?.name||'群组';
    const renderGroups=()=>{
      side.innerHTML='<h4>群组</h4>';
      const all=el('button',group==='all'?'sel':'');
      all.dataset.group='all';all.innerHTML=`<span>所有联系人</span><b>${contacts.length}</b>`;side.appendChild(all);
      groups.forEach(item=>{
        const button=el('button',group===item.id?'sel':'');
        button.dataset.group=item.id;
        button.innerHTML=`<span>${esc(item.name)}</span><b>${contacts.filter(contact=>contact.group===item.id).length}</b>`;
        side.appendChild(button);
      });
    };
    const visibleContacts=()=>contacts
      .filter(c=>(group==='all'||c.group===group)&&`${c.first}${c.last}${c.company}${c.email}${c.phonetic||''}`.toLowerCase().includes(query))
      .sort((a,b)=>sortName(a).localeCompare(sortName(b),'zh-CN'));
    const render=()=>{
      renderGroups();
      const visible=visibleContacts();
      if(!visible.some(c=>c.id===selected))selected=visible[0]?.id||null;
      list.innerHTML='';
      visible.forEach(c=>{const b=el('button','ab-row'+(c.id===selected?' sel':''));b.innerHTML=`<i>${esc(initials(c))}</i><span><b>${esc(displayName(c))}</b><small>${esc(c.company)}</small></span>`;b.addEventListener('click',()=>{selected=c.id;render();});list.appendChild(b);});
      if(!visible.length)list.innerHTML='<div class="ab-list-empty">此群组中没有匹配的联系人</div>';
      const c=contacts.find(c=>c.id===selected);
      const phoneticRow=preferences.showPhonetic?`<dt>拼音</dt><dd contenteditable="true" data-field="phonetic">${esc(c?.phonetic||'')}</dd>`:'';
      detail.innerHTML=c?`<div class="ab-photo">${esc(initials(c))}</div><h2>${esc(displayName(c))}</h2><p>${esc(c.company)}</p>
        <label class="ab-group-field">群组：<select>${groups.map(item=>`<option value="${esc(item.id)}" ${c.group===item.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
        <dl>${phoneticRow}<dt>手机</dt><dd contenteditable="true" data-field="phone">${esc(c.phone)}</dd><dt>电子邮件</dt><dd contenteditable="true" data-field="email">${esc(c.email)}</dd><dt>生日</dt><dd contenteditable="true" data-field="birthday" data-placeholder="YYYY-MM-DD">${esc(c.birthday||'')}</dd><dt>地址</dt><dd contenteditable="true" data-field="address">${esc(c.address)}</dd><dt>备注</dt><dd contenteditable="true" data-field="note">${esc(c.note)}</dd></dl>`:'<div class="ab-empty">此群组中没有联系人</div>';
      detail.querySelectorAll('[data-field]').forEach(n=>n.addEventListener('input',()=>{c[n.dataset.field]=n.textContent;save(AB_KEY,contacts);}));
      detail.querySelector('.ab-group-field select')?.addEventListener('change',event=>{c.group=event.target.value;save(AB_KEY,contacts);render();});
      if(win){
        win.dataset.addressGroup=group;
        win.querySelector('.win-statusbar').textContent=`${visible.length} 张名片 · ${groupName(group)}`;
      }
    };
    side.addEventListener('click',event=>{const button=event.target.closest('[data-group]');if(!button)return;group=button.dataset.group;query='';search.value='';selected=null;render();});
    add.addEventListener('click',()=>{const c={id:Date.now(),first:'新',last:'联系人',company:'',email:'',phone:'',address:'',note:'',group:group==='all'?(groups[0]?.id||'friends'):group};contacts.push(c);selected=c.id;save(AB_KEY,contacts);render();});
    del.addEventListener('click',()=>{
      const i=contacts.findIndex(c=>c.id===selected);if(i<0)return;
      System.confirmSheet({
        parent:win,title:'删除联系人',headline:'确定删除这个联系人吗？',
        message:'这张名片将从“通讯录”中移除。',okLabel:'删除',danger:true,
        onOK:()=>{contacts.splice(i,1);selected=null;save(AB_KEY,contacts);render();},
      });
    });
    search.addEventListener('input',()=>{query=search.value.toLowerCase();render();});
    const showCard=()=>{
      const contact=contacts.find(item=>item.id===selected);if(!contact)return;
      const pane=el('div','ab-vcard-preview');
      pane.innerHTML=`<div class="ab-vcard-paper"><header><div class="ab-vcard-avatar">${esc(initials(contact))}</div><div><h2>${esc(displayName(contact))}</h2><p>${esc(contact.company||'')}</p></div></header><dl><dt>电子邮件</dt><dd>${esc(contact.email||'—')}</dd><dt>电话</dt><dd>${esc(contact.phone||'—')}</dd><dt>地址</dt><dd>${esc(contact.address||'—')}</dd></dl></div><footer><span>vCard ${esc(preferences.vcardVersion||'3.0')}</span></footer>`;
      const exportButton=el('button','aqua-btn default','存储 vCard…');
      pane.querySelector('footer').appendChild(exportButton);
      const cardWindow=System.createWindow({
        app:'addressbook', title:`名片 — ${displayName(contact)}`, width:470, height:390,
        content:pane, noResize:true, bodyBg:'#ddd5c5',
        autoFitContent:{ minHeight:310, maxHeight:540 },
      });
      exportButton.addEventListener('click',()=>{
        const version=preferences.vcardVersion||'3.0';
        const lines=['BEGIN:VCARD',`VERSION:${version}`,`N:${contact.last||''};${contact.first||''};;;`,`FN:${displayName(contact)}`];
        if(contact.company)lines.push(`ORG:${contact.company}`);
        if(contact.email)lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`);
        if(contact.phone)lines.push(`TEL;TYPE=CELL:${contact.phone}`);
        if(contact.address)lines.push(`ADR;TYPE=HOME:;;${contact.address};;;;`);
        if(preferences.exportNotes!==false&&contact.note)lines.push(`NOTE:${String(contact.note).replace(/\n/g,'\\n')}`);
        lines.push('END:VCARD');
        System.savePanel({
          parent:cardWindow,title:'存储 vCard',startPath:'/用户/roll/下载',
          name:`${displayName(contact)||'联系人'}.vcf`,extension:'vcf',typeLabel:'vCard',
          allowOverwrite:true,onSave:path=>VFS.putNode(path,{type:'file',content:lines.join('\r\n'),mime:'text/vcard',creator:'addressbook',generated:true}),
        });
      });
    };
    card.addEventListener('click',showCard);
    const createGroup=()=>System.promptSheet({
      parent:win,title:'新建群组',message:'群组名称：',value:'未命名群组',okLabel:'创建',
      validate:name=>groups.some(item=>item.name.toLowerCase()===name.toLowerCase())?'已经存在同名群组。':true,
      onOK:name=>{
        const item={id:`group-${Date.now()}`,name};groups.push(item);save(AB_GROUPS_KEY,groups);
        group=item.id;selected=null;query='';search.value='';render();
      },
    });
    const deleteGroup=()=>{
      if(!group.startsWith('group-'))return;
      const item=groups.find(candidate=>candidate.id===group);if(!item)return;
      System.confirmSheet({
        parent:win,title:'删除群组',headline:`删除群组“${item.name}”？`,
        message:'群组中的名片会保留，并移到“朋友”群组。',okLabel:'删除',danger:true,
        onOK:()=>{
          contacts.forEach(contact=>{if(contact.group===item.id)contact.group='friends';});
          const index=groups.indexOf(item);if(index>=0)groups.splice(index,1);
          save(AB_KEY,contacts);save(AB_GROUPS_KEY,groups);group='all';selected=null;render();
        },
      });
    };
    const pending=localStorage.getItem('macweb.addressbook.pending');if(pending){contacts.push({id:Date.now(),first:pending.split('@')[0],last:'',company:'',email:pending.includes('@')?pending:'',phone:'',address:'',note:'从 Mail 添加',group:'friends'});localStorage.removeItem('macweb.addressbook.pending');save(AB_KEY,contacts);selected=contacts[contacts.length-1].id;}
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='addressbook')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('addressbook')||{};
      render();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    win=System.createWindow({app:'addressbook',title:'通讯录',width:800,height:520,toolbar,content:root,statusbar:`${contacts.length} 张名片`,onClose:()=>{
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const actions={'new-contact':()=>add.click(),'new-group':createGroup,'delete-group':deleteGroup,'delete':()=>del.click(),'show-card':showCard};
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'addressbook',name:'通讯录',icon:addressIcon,open:openAddressBook,about:'Leopard Address Book：群组、名片、搜索、编辑及 Mail 数据检测器联动。',keywords:'address book contacts 通讯录 联系人'});

  // ---------- iChat ----------
  const CHAT_KEY='macweb.ichat.v1';
  const CHAT_BUDDIES_KEY='macweb.ichat.buddies.v1';
  const buddies=[['alex','Alex','可用'],['mei','梅梅','正在使用 Leopard'],['design','设计团队','外出'],['bonjour','Bonjour 邻居','可用'],['oldmac','旧 Mac','离线']];
  const chatIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="ichat-bubble" cx=".34" cy=".25"><stop stop-color="#d9ffd5"/><stop offset=".38" stop-color="#76d86c"/><stop offset="1" stop-color="#23912c"/></radialGradient><filter id="ichat-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".4"/></filter></defs><g filter="url(#ichat-shadow)"><path d="M6 27C6 14 17 6 32 6s26 8 26 21-11 22-26 22c-3 0-6 0-9-1L11 57l4-14C9 39 6 34 6 27z" fill="url(#ichat-bubble)" stroke="#176c22" stroke-width="1.5"/><path d="M13 17q19-12 39 1" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/><circle cx="23" cy="27" r="4" fill="#fff"/><circle cx="41" cy="27" r="4" fill="#fff"/><circle cx="24" cy="28" r="2" fill="#2e7d35"/><circle cx="42" cy="28" r="2" fill="#2e7d35"/><path d="M22 37q10 7 20 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g></svg>`;
  function openChatWith(id,name){
    let preferences=System.getAppPreferences?.('ichat')||{};
    const histories=jsonStore(CHAT_KEY,{});histories[id]=histories[id]||[{from:name,text:'你好！这是一段本地 iChat 会话。',at:'刚刚'}];
    const root=el('div','chat-window');root.innerHTML='<div class="chat-transcript"></div><div class="chat-compose"><textarea aria-label="消息"></textarea><button class="aqua-btn default">发送</button></div>';
    const transcript=root.querySelector('.chat-transcript'),textarea=root.querySelector('textarea');
    let replyTimer=0;
    const applyPreferences=()=>{
      root.style.setProperty('--ichat-message-font',String(preferences.messageFont||'Helvetica'));
      root.style.setProperty('--ichat-message-color',String(preferences.messageColor||'#d9ecff'));
    };
    const persist=()=>{if(preferences.saveTranscripts!==false)save(CHAT_KEY,histories);};
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='ichat')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('ichat')||{};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    applyPreferences();
    const render=()=>{transcript.innerHTML=histories[id].map(m=>`<div class="${m.from==='我'?'mine':''}"><b>${esc(m.from)}</b><p>${esc(m.text)}</p><small>${esc(m.at)}</small></div>`).join('');transcript.scrollTop=transcript.scrollHeight;};
    const send=()=>{const text=textarea.value.trim();if(!text)return;histories[id].push({from:'我',text,at:'现在'});textarea.value='';persist();if(preferences.playSounds!==false)System.beep('pop',.12);render();replyTimer=setTimeout(()=>{histories[id].push({from:name,text:'收到。Leopard 的 iChat Theater 和屏幕共享入口也已经准备好了。',at:'现在'});persist();if(preferences.playSounds!==false)System.beep('ping',.1);render();},650);};
    root.querySelector('button').addEventListener('click',send);textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    const toolbar=el('div');const video=el('button','finder-toolbar-btn','视频聊天');const theater=el('button','finder-toolbar-btn','iChat Theater');const screen=el('button','finder-toolbar-btn','共享屏幕');toolbar.append(video,theater,screen);
    video.addEventListener('click',()=>System.launch('photobooth'));theater.addEventListener('click',()=>System.alertBox('iChat Theater','可在视频聊天中共享照片、演示文稿、影片和 Quick Look 文稿。'));screen.addEventListener('click',()=>System.alertBox('屏幕共享','网页无法接管另一台 Mac，但已保留完整的邀请和状态界面。'));
    render();System.createWindow({app:'ichat',title:`${name} — iChat`,width:560,height:480,toolbar,content:root,statusbar:preferences.saveTranscripts===false?'不会存储这段会话':'本地保存的演示会话',onClose:()=>{
      clearTimeout(replyTimer);
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
  }
  function openIChat(){
    let preferences=System.getAppPreferences?.('ichat')||{};
    const buddyList=jsonStore(CHAT_BUDDIES_KEY,buddies);
    let selected=buddyList.find(item=>item[2]!=='离线')?.[0]||buddyList[0]?.[0]||null;
    let showOffline=!!preferences.offlineMessages,showPictures=true,win=null;
    const root=el('div','ichat-buddies');root.innerHTML='<header><div class="ichat-avatar">R</div><div><b>roll</b><select><option>可用</option><option>离开</option><option>隐身</option></select><input class="aqua-input" value="正在使用 Mac OS X Leopard"></div></header><main></main><footer><button>＋</button><button>视频</button><button>音频</button><button>屏幕</button></footer>';
    const main=root.querySelector('main'),footerButtons=[...root.querySelectorAll('footer button')];
    const current=()=>buddyList.find(item=>item[0]===selected);
    const render=()=>{
      const visible=buddyList.filter(item=>showOffline||item[2]!=='离线');
      if(!visible.some(item=>item[0]===selected))selected=visible[0]?.[0]||null;
      main.innerHTML='<h4>AIM / Bonjour</h4>'+visible.map(([id,name,status])=>`<button data-id="${esc(id)}" data-name="${esc(name)}" class="${id===selected?'sel':''} ${status==='离线'?'offline':''}"><i>${esc(name.slice(0,1))}</i><span><b>${esc(name)}</b><small>${esc(status)}</small></span></button>`).join('');
      root.classList.toggle('hide-pictures',!showPictures);
      if(win){
        win.dataset.showOffline=String(showOffline);
        win.dataset.buddyPictures=String(showPictures);
        const online=buddyList.filter(item=>item[2]!=='离线').length;
        win.querySelector('.win-statusbar').textContent=`${online} 位好友在线 · ${buddyList.length} 位好友`;
      }
    };
    const openSelected=()=>{const item=current();if(item)openChatWith(item[0],item[1]);};
    const addBuddy=()=>System.promptSheet({
      parent:win,title:'添加好友',message:'AIM 或 Bonjour 名称：',placeholder:'好友名称',okLabel:'添加',
      validate:name=>buddyList.some(item=>item[1].toLowerCase()===name.toLowerCase())?'这位好友已经在列表中。':true,
      onOK:name=>{const id=`buddy-${Date.now()}`;buddyList.push([id,name,'可用']);save(CHAT_BUDDIES_KEY,buddyList);selected=id;render();},
    });
    const videoChat=()=>{const item=current();if(!item)return;Leopard.toast('iChat',`正在准备与 ${item[1]} 的视频聊天…`);System.launch('photobooth');};
    const audioChat=()=>{const item=current();if(item)openChatWith(item[0],item[1]);};
    const screenShare=()=>{const item=current();System.alertBox('屏幕共享',item?`已向 ${item[1]} 发送屏幕共享邀请。\n网页环境不会读取或控制真实桌面。`:'请先选择一位好友。');};
    main.addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(button){selected=button.dataset.id;render();}});
    main.addEventListener('dblclick',event=>{const button=event.target.closest('[data-id]');if(button){selected=button.dataset.id;openSelected();}});
    footerButtons[0].addEventListener('click',addBuddy);
    footerButtons[1].addEventListener('click',videoChat);
    footerButtons[2].addEventListener('click',audioChat);
    footerButtons[3].addEventListener('click',screenShare);
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='ichat')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('ichat')||{};
      showOffline=!!preferences.offlineMessages;
      render();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    win=System.createWindow({app:'ichat',title:'iChat',width:330,height:520,content:root,statusbar:'正在载入好友…',onClose:()=>{
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const actions={
        'new-chat':openSelected,'add-buddy':addBuddy,
        'buddy-info':()=>{const item=current();if(item)System.alertBox('好友信息',`${item[1]}\n状态：${item[2]}\n服务：AIM / Bonjour`);},
        'video-chat':videoChat,'audio-chat':audioChat,'screen-share':screenShare,
        'toggle-buddy-pictures':()=>{showPictures=!showPictures;render();},
        'toggle-offline-buddies':()=>System.updateAppPreferences?.('ichat',{offlineMessages:!showOffline}),
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'ichat',name:'iChat',icon:chatIcon,open:openIChat,multiWindow:true,about:'好友列表、聊天记录、视频效果、iChat Theater 与屏幕共享入口。',keywords:'ichat aim bonjour chat 聊天'});

  // ---------- Dictionary ----------
  const dictionaryIcon=icon('dict','#cf3e34','#78150f','<path d="M14 12h31q5 0 5 5v35H19q-5 0-5-5z" fill="#f7efe1" stroke="#70231d" stroke-width="1.5"/><path d="M20 12v40M25 22h19M25 28h16M25 34h18" stroke="#b45a50" stroke-width="2"/><text x="35" y="47" text-anchor="middle" font-size="12" fill="#8e2019" stroke="none">Aa</text>');
  const WORDS={
    leopard:{title:'leopard',phonetic:'/ˈlepərd/',type:'noun',definitions:['豹，一种有斑点的大型猫科动物。','Mac OS X 10.5 的代号。'],synonyms:['panther','big cat'],apple:'Mac OS X Leopard 是 Apple 于 2007 年发布的第六个 Mac OS X 主要版本，引入 Time Machine、Spaces、Quick Look、Stacks 与 Cover Flow Finder。'},
    finder:{title:'Finder',phonetic:'/ˈfaɪndər/',type:'proper noun',definitions:['Mac 的文件管理器和桌面环境。'],synonyms:['file browser','desktop shell'],apple:'Finder 在 Leopard 中加入 Cover Flow、Quick Look、重新设计的侧栏和局域网共享浏览。'},
    aqua:{title:'Aqua',phonetic:'/ˈɑːkwə/',type:'proper noun',definitions:['水；浅蓝绿色。','Mac OS X 的图形用户界面设计语言。'],synonyms:['water','aquamarine'],apple:'Aqua 使用半透明材质、凝胶式控件、拉丝金属和连续动画建立 Mac OS X 的视觉语言。'},
    dock:{title:'Dock',phonetic:'/dɒk/',type:'noun',definitions:['码头；供船停靠的平台。','屏幕边缘用于启动应用、切换窗口和存放项目的栏。'],synonyms:['pier','wharf'],apple:'Leopard Dock 使用反光的三维搁板，并加入 Stacks 文件夹堆栈。'},
    spotlight:{title:'Spotlight',phonetic:'/ˈspɒtlaɪt/',type:'noun',definitions:['聚光灯；公众注意的中心。','Mac OS X 的系统级元数据搜索功能。'],synonyms:['limelight','focus'],apple:'Spotlight 可搜索文件、邮件、联系人及应用，Leopard 中也能用于网络共享。'},
    dashboard:{title:'Dashboard',phonetic:'/ˈdæʃbɔːrd/',type:'noun',definitions:['仪表板；集中显示信息的面板。'],synonyms:['control panel','instrument panel'],apple:'Dashboard 是 Mac OS X 的 Widget 层，可通过快捷键覆盖显示天气、计算器、时钟等小组件。'},
    quartz:{title:'Quartz',phonetic:'/kwɔːrts/',type:'noun',definitions:['石英，一种二氧化硅矿物。'],synonyms:['silica','crystal'],apple:'Quartz 是 macOS 的二维绘图与窗口合成技术；Quartz Extreme 使用图形硬件加速合成。'},
    safari:{title:'Safari',phonetic:'/səˈfɑːri/',type:'noun',definitions:['以观察野生动物为目的的旅行。'],synonyms:['expedition','journey'],apple:'Safari 是 Apple 的网页浏览器。Leopard 随附 Safari 3，并基于 WebKit 排版引擎。'},
    preview:{title:'Preview',phonetic:'/ˈpriːvjuː/',type:'noun / verb',definitions:['预览；正式发布或展示前的查看。','预先查看某个文稿或图像。'],synonyms:['advance view','sample'],apple:'“预览”可阅读 PDF 与图像，提供缩放、旋转、检查和注释工具。'},
    voiceover:{title:'VoiceOver',phonetic:'/ˈvɔɪsˌəʊvə/',type:'noun',definitions:['画外音；不出现在画面中的旁白。'],synonyms:['narration','commentary'],apple:'VoiceOver 是 Mac OS X 内建的屏幕阅读器，通过语音和盲文描述界面内容。'},
    trash:{title:'trash',phonetic:'/træʃ/',type:'noun / verb',definitions:['废弃物；不再需要的东西。','丢弃或破坏某物。'],synonyms:['rubbish','waste','discard'],apple:'Finder 的“废纸篓”暂存已删除文件，可恢复项目或清倒以释放虚拟存储。'},
    window:{title:'window',phonetic:'/ˈwɪndəʊ/',type:'noun',definitions:['窗户。','计算机界面中显示应用或文稿内容的区域。'],synonyms:['opening','pane'],apple:'Mac OS X 窗口使用红、黄、绿交通灯按钮来关闭、最小化和缩放。'},
    file:{title:'file',phonetic:'/faɪl/',type:'noun / verb',definitions:['有名称的数据集合。','把资料归档或提交。'],synonyms:['document','record'],apple:'Finder 使用文件、文件夹、标签和元数据组织 Macintosh HD 上的内容。'},
    desktop:{title:'desktop',phonetic:'/ˈdesktɒp/',type:'noun',definitions:['书桌表面。','图形界面中位于窗口之后的主要工作区域。'],synonyms:['workspace','work surface'],apple:'Mac 桌面由 Finder 管理，可放置文件、磁盘和网络卷。'},
    network:{title:'network',phonetic:'/ˈnetwɜːk/',type:'noun / verb',definitions:['相互连接的人、设备或系统。','使设备建立通信连接。'],synonyms:['system','web','connect'],apple:'Leopard 的网络偏好设置管理 AirPort、以太网、Bluetooth 和位置配置。'},
    bluetooth:{title:'Bluetooth',phonetic:'/ˈbluːtuːθ/',type:'proper noun',definitions:['一种短距离无线通信标准。'],synonyms:['wireless link'],apple:'Mac OS X 使用 Bluetooth 设置助理配对键盘、鼠标、手机和其他兼容设备。'},
    microphone:{title:'microphone',phonetic:'/ˈmaɪkrəfəʊn/',type:'noun',definitions:['把声音转换成电信号或数字数据的设备。'],synonyms:['mic','transducer'],apple:'输入音量与电平可在“声音”偏好设置中查看；网页需要获得用户明确授权才能读取麦克风。'},
    hello:{title:'hello',phonetic:'/həˈləʊ/',type:'exclamation / noun',definitions:['用于问候、接电话或引起注意。'],synonyms:['hi','greetings'],apple:'Macintosh 因在屏幕上显示 “hello” 问候语而闻名。'},
    apple:{title:'apple',phonetic:'/ˈæpəl/',type:'noun',definitions:['苹果；蔷薇科苹果属植物的果实。'],synonyms:['fruit'],apple:'Apple Inc. 设计 Mac、iPhone 及其操作系统；Apple 菜单位于 Mac OS X 菜单栏最左侧。'},
    dictionary:{title:'dictionary',phonetic:'/ˈdɪkʃəneri/',type:'noun',definitions:['按字母或主题排列词语，并解释其含义、读音和用法的参考资料。'],synonyms:['lexicon','wordbook'],apple:'Dictionary.app 在 Leopard 中整合词典、同义词、Apple 术语与 Wikipedia 检索。'},
  };
  function openDictionary(){
    let preferences=System.getAppPreferences?.('dictionary')||{};
    let tab=['definition','thesaurus','apple','wikipedia'].includes(preferences.defaultSource)?preferences.defaultSource:'definition';
    let word='leopard',entry=WORDS.leopard,requestId=0,audioUrl='',win=null;
    let abort=null;
    const remoteCache=new Map();
    const HISTORY_KEY='macweb.dictionary.history.v2';
    let history=jsonStore(HISTORY_KEY,[]);
    const toolbar=el('div','dict-toolbar');
    const tabs=el('div','dict-tabs');
    [['definition','词典'],['thesaurus','同义词'],['apple','Apple'],['wikipedia','Wikipedia']].forEach(([id,n])=>{const b=el('button','finder-toolbar-btn',n);b.dataset.tab=id;tabs.appendChild(b);});
    const searchWrap=el('div','dict-search-wrap');
    const search=el('input','aqua-input aqua-search');search.value=word;search.placeholder='键入要查询的词';
    const searchButton=el('button','aqua-btn default','查询');
    searchWrap.append(search,searchButton);toolbar.append(tabs,searchWrap);
    const root=el('div','dict-app');const index=el('aside','dict-index'),article=el('article');root.append(index,article);
    const applyPreferences=()=>root.style.setProperty('--dict-font-size',`${Number(preferences.fontSize)||13}px`);
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='dictionary')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('dictionary')||{};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    applyPreferences();
    const normalize=(value)=>String(value||'').trim().toLowerCase();
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.dictionaryTab=tab;
      win.dataset.dictionaryWord=word;
      win.dataset.dictionaryHistory=String(history.length);
      root.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
    };
    const related=(query)=>Object.keys(WORDS).filter(key=>key.includes(query)||query.includes(key.slice(0,Math.max(2,key.length-2)))).slice(0,12);
    const addHistory=(query)=>{history=[query,...history.filter(item=>item!==query)].slice(0,12);save(HISTORY_KEY,history);};
    const heading=(name,text)=>{const h=el(name);h.textContent=text;article.appendChild(h);return h;};
    const paragraph=(text,cls='')=>{const p=el('p',cls);p.textContent=text;article.appendChild(p);return p;};
    const renderIndex=(query=normalize(search.value))=>{
      index.innerHTML='';
      const makeSection=(title,items)=>{
        if(!items.length)return;
        index.appendChild(el('h4','',title));
        items.forEach(key=>{
          const local=WORDS[key];
          const b=el('button',key===word?'sel':'');
          b.dataset.word=key;b.textContent=local?.title||key;index.appendChild(b);
        });
      };
      const direct=Object.keys(WORDS).filter(key=>!query||key.includes(query)).slice(0,16);
      makeSection(query?'匹配词条':'本地词典',direct.length?direct:related(query));
      makeSection('最近查询',history.filter(item=>!direct.includes(item)).slice(0,8));
    };
    const renderFooter=(source)=>{
      const footer=el('footer');
      footer.textContent=`来源：${source} · 联机失败时自动使用 Leopard Web 本地词库`;
      article.appendChild(footer);
    };
    const pronounce=()=>{
      if(audioUrl){
        try{new Audio(audioUrl).play().catch(()=>{});}catch(error){}
        return;
      }
      if(!window.speechSynthesis||!entry?.title)return;
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(entry.title);
      utterance.lang=/[\u3400-\u9fff]/.test(entry.title)?'zh-CN':'en-US';
      window.speechSynthesis.speak(utterance);
    };
    const pronounceIfPreferred=()=>{if(preferences.autoPronounce)setTimeout(pronounce,0);};
    const renderDefinition=()=>{
      article.innerHTML='';
      heading('h1',entry.title||word);
      const pronunciation=el('div','dict-pronunciation');
      pronunciation.appendChild(el('span','phonetic',entry.phonetic||''));
      if(entry?.title){
        const speak=el('button','dict-speak','🔊 发音');
        speak.addEventListener('click',pronounce);
        pronunciation.appendChild(speak);
      }
      article.appendChild(pronunciation);
      (entry.meanings||[{partOfSpeech:entry.type||'',definitions:(entry.definitions||[]).map(definition=>({definition}))}]).forEach(meaning=>{
        if(meaning.partOfSpeech)heading('h4',meaning.partOfSpeech);
        const ol=el('ol','dict-definitions');
        (meaning.definitions||[]).slice(0,8).forEach(item=>{
          const li=el('li');li.appendChild(document.createTextNode(item.definition||''));
          if(item.example){const example=el('p','dict-example');example.textContent=`“${item.example}”`;li.appendChild(example);}
          ol.appendChild(li);
        });
        article.appendChild(ol);
      });
      renderFooter(entry.source||'Leopard Web 本地词库');
    };
    const renderThesaurus=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');
      const synonyms=[...(entry.synonyms||[]),...(entry.meanings||[]).flatMap(item=>item.synonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      const antonyms=[...(entry.antonyms||[]),...(entry.meanings||[]).flatMap(item=>item.antonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      heading('h4','同义词');const syn=el('div','dict-word-cloud');
      (synonyms.length?synonyms:['没有找到同义词']).slice(0,24).forEach(text=>{const b=el('button','',text);if(synonyms.length)b.addEventListener('click',()=>lookup(text));else b.disabled=true;syn.appendChild(b);});article.appendChild(syn);
      heading('h4','反义词');paragraph(antonyms.length?antonyms.slice(0,16).join('、'):'没有找到反义词。');
      renderFooter(entry.source||'Leopard Web 本地词库');
    };
    const renderApple=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');heading('h4','Apple 术语');
      if(entry.apple)paragraph(entry.apple,'dict-apple-entry');
      else paragraph('Apple 术语词典中没有这个词条。可在左侧选择 Finder、Aqua、Dock、Spotlight、Dashboard、Quartz、Safari、VoiceOver 等本地术语。','dict-notice');
      const terms=Object.keys(WORDS).filter(key=>WORDS[key].apple).slice(0,14);const links=el('div','dict-word-cloud');
      terms.forEach(key=>{const b=el('button','',WORDS[key].title);b.addEventListener('click',()=>lookup(key));links.appendChild(b);});article.appendChild(links);
      renderFooter('Leopard Web Apple 术语词库');
    };
    const renderWikipedia=async()=>{
      const id=++requestId;abort?.abort();abort=new AbortController();
      article.innerHTML='';heading('h1',word);paragraph('正在从 Wikipedia 读取摘要…','dict-loading');
      const endBusy=System.beginBusy(180);
      try{
        const lang=/[\u3400-\u9fff]/.test(word)?'zh':'en';
        const response=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,{signal:abort.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error(response.status===404?'没有找到对应页面':`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        article.innerHTML='';heading('h1',data.title||word);
        if(data.thumbnail?.source){const img=el('img','dict-wiki-image');img.src=data.thumbnail.source;img.alt='';article.appendChild(img);}
        paragraph(data.description||'Wikipedia 摘要','phonetic');
        paragraph(data.extract||'该页面没有可用摘要。','dict-wiki-extract');
        if(data.content_urls?.desktop?.page){const a=el('a','dict-source-link','在真实浏览器中打开完整 Wikipedia 页面');a.href=data.content_urls.desktop.page;a.target='_blank';a.rel='noopener noreferrer';article.appendChild(a);}
        renderFooter(`${lang}.wikipedia.org 页面摘要`);
      }catch(error){
        if(error.name==='AbortError')return;
        article.innerHTML='';heading('h1',word);paragraph(`无法载入 Wikipedia：${error.message}。请检查网络后重试。`,'dict-notice');
        const retry=el('button','aqua-btn default','重试');retry.addEventListener('click',renderWikipedia);article.appendChild(retry);
        renderFooter('Wikipedia（当前不可用）');
      }finally{endBusy();}
    };
    const render=()=>{
      tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
      renderIndex();
      if(tab==='definition')renderDefinition();
      else if(tab==='thesaurus')renderThesaurus();
      else if(tab==='apple')renderApple();
      else renderWikipedia();
      updateWindowState();
    };
    async function lookup(raw){
      const query=normalize(raw||search.value);if(!query)return;
      search.value=query;word=query;addHistory(query);renderIndex(query);
      if(WORDS[query]){entry=WORDS[query];audioUrl='';render();pronounceIfPreferred();return;}
      if(!/^[a-z][a-z' -]*$/i.test(query)){
        entry={title:query,type:'',definitions:['本地词典暂未收录该词。可切换到 Wikipedia 查询中文或其他语言的百科摘要。'],synonyms:[],source:'Leopard Web 本地词库'};
        audioUrl='';render();pronounceIfPreferred();return;
      }
      if(remoteCache.has(query)){entry=remoteCache.get(query);audioUrl=entry.audio||'';render();pronounceIfPreferred();return;}
      const id=++requestId;abort?.abort();abort=new AbortController();
      entry={title:query,type:'',definitions:['正在查询联机英语词典…'],synonyms:[],source:'查询中'};audioUrl='';renderDefinition();
      const endBusy=System.beginBusy(180);
      try{
        const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,{signal:abort.signal});
        if(!response.ok)throw new Error(response.status===404?'没有找到这个单词':`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        const first=data[0]||{};
        entry={title:first.word||query,phonetic:first.phonetic||first.phonetics?.find(p=>p.text)?.text||'',meanings:first.meanings||[],synonyms:(first.meanings||[]).flatMap(m=>m.synonyms||[]),antonyms:(first.meanings||[]).flatMap(m=>m.antonyms||[]),audio:first.phonetics?.find(p=>p.audio)?.audio||'',source:'Free Dictionary API'};
        remoteCache.set(query,entry);audioUrl=entry.audio||'';render();pronounceIfPreferred();
      }catch(error){
        if(error.name==='AbortError')return;
        entry={title:query,type:'',definitions:[`${error.message}。当前显示离线结果；可检查网络后再次查询。`],synonyms:[],source:'离线提示'};audioUrl='';render();
      }finally{endBusy();}
    }
    const setSource=(source)=>{
      if(!['definition','thesaurus','apple','wikipedia'].includes(source))return;
      tab=source;render();
    };
    const copyEntry=async()=>{
      const selected=window.getSelection?.()?.toString()?.trim();
      const text=selected||article.innerText.trim();
      if(!text)return;
      try{
        await navigator.clipboard.writeText(text);
        Leopard.toast('Dictionary',selected?'所选文字已复制。':'当前词条已复制。');
      }catch(error){System.alertBox('Dictionary','浏览器没有授予剪贴板写入权限。');}
    };
    const previousEntry=()=>{if(history[1])lookup(history[1]);};
    const clearHistory=()=>{
      history=[];save(HISTORY_KEY,history);renderIndex();updateWindowState();
      Leopard.toast('Dictionary','最近查询记录已清除。');
    };
    tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();}});
    index.addEventListener('click',e=>{const b=e.target.closest('[data-word]');if(b)lookup(b.dataset.word);});
    search.addEventListener('input',()=>renderIndex());
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup();}});
    searchButton.addEventListener('click',()=>lookup());
    render();win=System.createWindow({app:'dictionary',title:'Dictionary',width:850,height:570,toolbar,content:root,statusbar:'本地 Apple 术语 · 联机英语词典 · Wikipedia 摘要',onClose:()=>{
      abort?.abort();
      window.speechSynthesis?.cancel();
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const commands={
        'focus-search':()=>{search.focus();search.select();},
        'copy':copyEntry,'copy-entry':copyEntry,'pronounce':pronounce,
        'history-back':previousEntry,'clear-history':clearHistory,
        'source-dictionary':()=>setSource('definition'),
        'source-thesaurus':()=>setSource('thesaurus'),
        'source-apple':()=>setSource('apple'),
        'source-wikipedia':()=>setSource('wikipedia'),
      };
      const action=commands[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    updateWindowState();
  }
  System.registerApp({id:'dictionary',name:'Dictionary',icon:dictionaryIcon,open:openDictionary,about:'可用的 Leopard 词典：本地 Apple 术语、联机英语释义/发音/例句、同反义词、历史记录和 Wikipedia 摘要。',keywords:'dictionary 字典 词典 wikipedia thesaurus'});

  // ---------- Photo Booth ----------
  const photoIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="pb-curtain" x2="0" y2="1"><stop stop-color="#f14f5b"/><stop offset=".5" stop-color="#a50f24"/><stop offset="1" stop-color="#4f0712"/></linearGradient><radialGradient id="pb-lens"><stop stop-color="#aee9ff"/><stop offset=".35" stop-color="#397fbd"/><stop offset=".7" stop-color="#152a52"/><stop offset="1" stop-color="#050814"/></radialGradient><filter id="pb-icon-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".45"/></filter></defs><g filter="url(#pb-icon-shadow)"><path d="M7 7h50v50H7z" fill="url(#pb-curtain)" stroke="#6c0c19"/><path d="M7 7q8 12 0 25t0 25M57 7q-8 12 0 25t0 25" fill="none" stroke="#ff7882" stroke-width="5" opacity=".7"/><rect x="15" y="16" width="34" height="32" rx="5" fill="#292a2e" stroke="#eef3f6" stroke-width="1.5"/><rect x="23" y="11" width="18" height="8" rx="3" fill="#e9edf0" stroke="#666"/><circle cx="32" cy="33" r="12" fill="url(#pb-lens)" stroke="#bce7ff" stroke-width="2"/><circle cx="32" cy="33" r="4" fill="#9ee4ff"/><circle cx="44" cy="24" r="2" fill="#ffda58"/></g></svg>`;
  function openPhotoBooth(){
    let preferences=System.getAppPreferences?.('photobooth')||{};
    const DESKTOP='/用户/roll/桌面';
    const PHOTO_DIR='/用户/roll/图片/Photo Booth';
    const effects=[
      {name:'正常',value:'',tone:'#627c90'},
      {name:'黑白',value:'grayscale(1)',tone:'#737373'},
      {name:'棕褐',value:'sepia(1)',tone:'#91744f'},
      {name:'彩色铅笔',value:'hue-rotate(120deg) saturate(1.7)',tone:'#568da2'},
      {name:'流行艺术',value:'contrast(2) saturate(2)',tone:'#c84678'},
      {name:'X 射线',value:'invert(1)',tone:'#17274b'},
      {name:'漫画书',value:'contrast(1.7) saturate(.5)',tone:'#b95640'},
      {name:'热成像',value:'hue-rotate(245deg) saturate(3)',tone:'#d54d25'},
      {name:'柔光',value:'brightness(1.18) saturate(.75)',tone:'#b8a8bd'},
    ];
    const emptyStripMarkup=()=>`<div class="pb-strip-empty"><div class="pb-empty-film" aria-hidden="true">${Array.from({length:6},()=>'<i></i>').join('')}</div><span>照片条为空 · 拍摄的照片会保存在虚拟桌面</span></div>`;
    if(!VFS.isDir(PHOTO_DIR))VFS.mkdir(PHOTO_DIR);
    const root=el('div','pb-app');
    root.innerHTML=`<div class="pb-stage"><video autoplay muted playsinline></video><div class="pb-placeholder"><i>${photoIcon}</i><b>Photo Booth</b><span>点按摄像头按钮并允许访问，即可开始实时预览。</span></div><div class="pb-camera-state">摄像头未开启</div><div class="pb-countdown"></div><div class="pb-flash"></div></div>
      <div class="pb-controls"><button class="camera" title="开启摄像头" aria-label="开启摄像头"><span></span></button><button class="shot" title="拍照" aria-label="拍照" disabled>●</button><button class="aqua-btn pb-effects">效果…</button><label class="pb-effect-picker">当前：<select class="pb-effect aqua-select" aria-label="当前效果">${effects.map(effect=>`<option value="${esc(effect.value)}">${esc(effect.name)}</option>`).join('')}</select></label><button class="aqua-btn pb-reveal" disabled>在 Finder 中显示</button></div>
      <div class="pb-strip">${emptyStripMarkup()}</div>`;
    const video=root.querySelector('video'),placeholder=root.querySelector('.pb-placeholder'),strip=root.querySelector('.pb-strip');
    const camera=root.querySelector('.camera'),shot=root.querySelector('.shot'),state=root.querySelector('.pb-camera-state'),reveal=root.querySelector('.pb-reveal');
    const effectSelect=root.querySelector('.pb-effect'),effectsButton=root.querySelector('.pb-effects');
    let win=null,stream=null,selectedPath='',capturing=false,disposed=false;
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
    const applyPreferences=()=>video.classList.toggle('unmirrored',preferences.mirrorPreview===false);
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.photoBoothCamera=String(Boolean(stream));
      win.dataset.photoBoothSelection=String(Boolean(selectedPath));
      win.dataset.photoBoothCapturing=String(capturing);
      win.dataset.photoBoothEffect=effectSelect.value;
      win.dataset.photoBoothMirrored=String(preferences.mirrorPreview!==false);
      root.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
    };
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='photobooth')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('photobooth')||{};
      applyPreferences();updateWindowState();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    applyPreferences();
    const photoPaths=()=>[DESKTOP,PHOTO_DIR].flatMap(directory=>(VFS.list(directory)||[]).map(name=>`${directory}/${name}`)).filter(path=>VFS.get(path)?.creator==='photobooth');
    const selectPhoto=(button,path)=>{
      strip.querySelectorAll('button').forEach(item=>item.classList.toggle('sel',item===button));
      selectedPath=path;reveal.disabled=false;
      updateWindowState();
    };
    const addPhoto=(path,prepend=false)=>{
      const node=VFS.get(path);if(!node?.src)return;
      strip.querySelector('.pb-strip-empty')?.remove();
      const button=el('button','pb-thumb');
      button.dataset.path=path;
      button.innerHTML='<img alt=""><span></span>';
      button.querySelector('img').src=node.src;
      button.querySelector('img').alt=VFS.baseName(path);
      button.querySelector('span').textContent=VFS.baseName(path);
      button.addEventListener('click',()=>selectPhoto(button,path));
      button.addEventListener('dblclick',()=>System.openVfsPath(path));
      if(prepend)strip.prepend(button);else strip.appendChild(button);
      selectPhoto(button,path);
    };
    photoPaths().forEach(path=>addPhoto(path));
    const stopCamera=()=>{
      stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;
      placeholder.style.display='grid';camera.classList.remove('on');camera.title='开启摄像头';shot.disabled=true;
      state.textContent='摄像头未开启';
      updateWindowState();
    };
    camera.addEventListener('click',async()=>{
      if(stream){stopCamera();return;}
      if(!navigator.mediaDevices?.getUserMedia){System.alertBox('Photo Booth','此浏览器不支持摄像头访问。');return;}
      const endBusy=System.beginBusy(160);
      camera.disabled=true;state.textContent='正在请求摄像头权限…';
      updateWindowState();
      try{
        const grantedStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
        if(disposed){
          grantedStream.getTracks().forEach(track=>track.stop());
          return;
        }
        stream=grantedStream;
        video.srcObject=stream;await video.play();
        placeholder.style.display='none';camera.classList.add('on');camera.title='关闭摄像头';shot.disabled=false;
        const track=stream.getVideoTracks()[0];
        state.textContent=`实时预览：${track?.label||'浏览器摄像头'}`;
        track?.addEventListener('ended',stopCamera,{once:true});
        updateWindowState();
      }catch(error){
        if(disposed)return;
        stopCamera();
        state.textContent=error?.name==='NotAllowedError'?'摄像头权限未授予':'无法开启摄像头';
        System.alertBox('Photo Booth',error?.name==='NotAllowedError'?'请在浏览器地址栏中允许摄像头权限，然后再次点按摄像头按钮。':'无法访问摄像头。请确认设备未被其他应用占用。');
      }finally{if(!disposed)camera.disabled=false;endBusy();updateWindowState();}
    });
    const setEffect=(value)=>{
      if(![...effectSelect.options].some(option=>option.value===value))value='';
      effectSelect.value=value;video.style.filter=value;updateWindowState();
    };
    effectSelect.addEventListener('change',event=>setEffect(event.target.value));
    const showEffects=()=>{
      const pane=el('div','pb-effects-browser');
      pane.innerHTML=`<header><b>选择效果</b><span>Leopard Photo Booth 效果预览</span></header><div>${effects.map(effect=>`<button data-effect="${esc(effect.value)}" class="${effect.value===effectSelect.value?'selected':''}"><i style="--pb-effect-tone:${effect.tone};filter:${esc(effect.value)||'none'}">${photoIcon}</i><span>${esc(effect.name)}</span></button>`).join('')}</div>`;
      let api=null;
      pane.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',()=>{
        setEffect(button.dataset.effect);
        api?.close('effect');
      }));
      api=System.showSheet({parent:win,title:'效果',content:pane,className:'pb-effects-sheet',buttons:[{label:'取消',cancel:true}]});
    };
    effectsButton.addEventListener('click',showEffects);
    shot.addEventListener('click',async()=>{
      if(!stream||capturing)return System.alertBox('Photo Booth','请先开启摄像头。');
      capturing=true;shot.disabled=true;updateWindowState();
      const countdown=root.querySelector('.pb-countdown');
      if(preferences.countdown!==false){
        for(const number of [3,2,1]){countdown.textContent=number;countdown.classList.add('on');await wait(700);countdown.classList.remove('on');await wait(95);}
      }
      const flash=root.querySelector('.pb-flash');
      if(preferences.screenFlash!==false){flash.classList.add('on');setTimeout(()=>flash.classList.remove('on'),180);}
      const sourceWidth=video.videoWidth||1280,sourceHeight=video.videoHeight||720,scale=Math.min(1,1024/sourceWidth,768/sourceHeight);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sourceWidth*scale));canvas.height=Math.max(1,Math.round(sourceHeight*scale));
      const context=canvas.getContext('2d');context.save();
      if(preferences.mirrorPreview!==false){context.translate(canvas.width,0);context.scale(-1,1);}
      context.filter=video.style.filter||'none';context.drawImage(video,0,0,canvas.width,canvas.height);context.restore();
      const src=canvas.toDataURL('image/jpeg',.82),now=new Date();
      const stamp=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}.${String(now.getMinutes()).padStart(2,'0')}.${String(now.getSeconds()).padStart(2,'0')}`;
      const destination=preferences.saveToDesktop===false?PHOTO_DIR:DESKTOP;
      const name=VFS.uniqueName(destination,`Photo Booth ${stamp}`,'.jpg'),path=`${destination}/${name}`;
      const saved=VFS.putNode(path,{type:'file',kind:'image',mime:'image/jpeg',src,creator:'photobooth',createdAt:now.toISOString(),generated:true});
      if(saved){addPhoto(path,true);state.textContent=`已将“${name}”保存到${destination===DESKTOP?'桌面':'图片'}`;Leopard.toast('Photo Booth',`“${name}”已保存到${destination===DESKTOP?'桌面':'图片'}。`);}
      else System.alertBox('Photo Booth','无法保存照片。浏览器的本地存储空间可能已满。');
      capturing=false;shot.disabled=!stream;updateWindowState();
    });
    const openSelected=()=>{if(selectedPath)System.openVfsPath(selectedPath);};
    const revealSelected=()=>System.launch('finder',{path:selectedPath?VFS.parentOf(selectedPath):DESKTOP});
    const deleteSelected=()=>{
      if(!selectedPath)return;
      const path=selectedPath;
      System.confirmSheet({
        parent:win,headline:`将“${VFS.baseName(path)}”移到废纸篓？`,
        message:'照片会从 Photo Booth 照片条中移除，可在 Finder 的废纸篓中恢复。',
        okLabel:'移到废纸篓',danger:true,onOK:()=>{
          System.moveToTrash(path);
          [...strip.querySelectorAll('.pb-thumb')].find(button=>button.dataset.path===path)?.remove();
          selectedPath='';reveal.disabled=true;
          if(!strip.querySelector('.pb-thumb'))strip.innerHTML=emptyStripMarkup();
          updateWindowState();
        },
      });
    };
    reveal.addEventListener('click',revealSelected);
    win=System.createWindow({app:'photobooth',title:'Photo Booth',width:720,height:580,content:root,onClose:()=>{
      disposed=true;
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      stopCamera();
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const commands={
        'toggle-camera':()=>camera.click(),'take-photo':()=>shot.click(),
        'show-effects':showEffects,
        'effect-normal':()=>setEffect(''),'effect-mono':()=>setEffect('grayscale(1)'),
        'effect-sepia':()=>setEffect('sepia(1)'),'effect-pencil':()=>setEffect('hue-rotate(120deg) saturate(1.7)'),
        'effect-pop':()=>setEffect('contrast(2) saturate(2)'),'effect-xray':()=>setEffect('invert(1)'),
        'toggle-mirror-preview':()=>System.updateAppPreferences?.('photobooth',{mirrorPreview:preferences.mirrorPreview===false}),
        'open-selected-photo':openSelected,'reveal-selected-photo':revealSelected,'delete-selected-photo':deleteSelected,
      };
      const action=commands[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    updateWindowState();
    return win;
  }
  System.registerApp({id:'photobooth',name:'Photo Booth',icon:photoIcon,open:openPhotoBooth,about:'摄像头预览、Leopard 风格效果、闪光和照片条。',keywords:'photo booth camera 摄像头 照片'});

  // ---------- QuickTime Player / DVD Player ----------
  const qtIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="qt-face" cx=".35" cy=".28"><stop stop-color="#e4f1ff"/><stop offset=".35" stop-color="#78a9e8"/><stop offset="1" stop-color="#263f8b"/></radialGradient><linearGradient id="qt-ring" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#9aa6b7"/><stop offset="1" stop-color="#e4e9ef"/></linearGradient><filter id="qt-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".45"/></filter></defs><g filter="url(#qt-shadow)"><circle cx="31" cy="31" r="28" fill="url(#qt-ring)" stroke="#5f6875"/><circle cx="31" cy="31" r="23" fill="url(#qt-face)" stroke="#e5f2ff"/><path d="M22 18h18v27H22zM14 25h34v13H14z" fill="#eef6ff" fill-rule="evenodd"/><path d="M38 38l15 15" stroke="#304883" stroke-width="8" stroke-linecap="round"/><path d="M39 39l14 14" stroke="#dce8fa" stroke-width="3" stroke-linecap="round"/></g></svg>`;
  function openQuickTime(arg){
    let preferences=System.getAppPreferences?.('quicktime')||{};
    const toolbar=el('div');
    const open=el('button','finder-toolbar-btn','打开…');
    const fromLocal=el('button','finder-toolbar-btn','从本机打开…');
    const info=el('button','finder-toolbar-btn','显示影片简介');
    toolbar.append(open,fromLocal,info);
    const root=el('div','qt-app');
    root.innerHTML='<div class="qt-screen"><video preload="metadata"></video><div class="qt-welcome"><b>QuickTime Player</b><span>打开影片或音频文件</span></div></div><footer><button title="后退 10 秒">◀◀</button><button class="qt-play" title="播放或暂停">▶</button><button title="前进 10 秒">▶▶</button><input class="qt-position" type="range" min="0" max="1000" value="0"><span>00:00 / 00:00</span><input class="qt-volume" type="range" min="0" max="100" value="80" title="音量"><input class="qt-file" type="file" accept="video/*,audio/*"></footer>';
    const video=root.querySelector('video'),welcome=root.querySelector('.qt-welcome'),file=root.querySelector('.qt-file');
    const footerButtons=[...root.querySelectorAll('footer button')],playButton=root.querySelector('.qt-play');
    const position=root.querySelector('.qt-position'),volume=root.querySelector('.qt-volume'),timeLabel=root.querySelector('footer span');
    let win=null,currentUrl='',currentMeta={name:'未打开影片',type:'',size:null,path:''},theaterMode=false;
    const mediaTypes=['mov','mp4','m4v','webm','ogv','mp3','m4a','aac','wav','ogg'];
    const time=(seconds)=>{
      seconds=Math.max(0,Math.floor(Number(seconds)||0));
      return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    };
    const updateTransport=()=>{
      position.value=video.duration?String(Math.round(video.currentTime/video.duration*1000)):'0';
      timeLabel.textContent=`${time(video.currentTime)} / ${time(video.duration)}`;
      playButton.textContent=!video.src||video.paused?'▶':'❚❚';
    };
    const playPause=()=>{
      if(!video.src){openVirtual();return;}
      if(video.paused)video.play().catch(()=>{});
      else video.pause();
    };
    const applyPreferences=()=>{
      video.style.imageRendering=preferences.highQuality===false?'pixelated':'auto';
      video.style.transform=preferences.hardwareAcceleration===false?'none':'translateZ(0)';
      root.classList.toggle('qt-theater-no-controls',theaterMode&&preferences.fullScreenControls===false);
    };
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='quicktime')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('quicktime')||{};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    applyPreferences();
    const loadSource=(source)=>{
      if(currentUrl&&currentUrl!==source.src&&currentUrl.startsWith('blob:'))URL.revokeObjectURL(currentUrl);
      currentUrl=source.revoke?source.src:'';
      currentMeta={name:source.name||'未命名影片',type:source.type||'',size:source.size??null,path:source.path||''};
      video.src=source.src;video.style.display='block';welcome.style.display='none';
      win._title.textContent=`QuickTime Player — ${currentMeta.name}`;
      if(source.path&&preferences.rememberRecent!==false)System.addRecentDocument?.(source.path,'quicktime');
      if(preferences.autoPlay!==false)video.play().catch(()=>{});
      updateTransport();
    };
    const loadVfsPath=(path)=>{
      const node=VFS.get(path);if(!node||node.type!=='file'||!node.src)return false;
      loadSource({src:node.src,name:VFS.baseName(path),type:node.mime||'',size:VFS.sizeOf(path),path});
      return true;
    };
    function openVirtual(){
      System.openPanel({
        parent:win,title:'打开影片',startPath:'/用户/roll/影片',types:mediaTypes,
        allowUpload:false,onOpen:(path)=>loadVfsPath(path),
      });
    }
    const showInspector=()=>{
      const pane=el('div','qt-inspector');
      const rows=[
        ['名称',currentMeta.name],
        ['格式',currentMeta.type||'—'],
        ['大小',currentMeta.size!=null?`${(currentMeta.size/1048576).toFixed(2)} MB`:'—'],
        ['位置',currentMeta.path||'本机临时文件'],
        ['尺寸',video.videoWidth?`${video.videoWidth} × ${video.videoHeight}`:'—'],
        ['时间长度',video.duration?time(video.duration):'—'],
        ['循环播放',video.loop?'是':'否'],
      ];
      pane.innerHTML='<header><b>影片简介</b><span>ⓘ</span></header><dl></dl>';
      const dl=pane.querySelector('dl');
      rows.forEach(([key,value])=>{dl.append(el('dt','',key),el('dd','',value));});
      System.createWindow({
        app:'quicktime', title:'影片简介', width:340, height:325, content:pane,
        noResize:true, bodyBg:'#ececec',
        autoFitContent:{ minHeight:250, maxHeight:470 },
      });
    };
    const resizePlayer=(scale)=>{
      const naturalWidth=video.videoWidth||640,naturalHeight=video.videoHeight||360;
      const availableWidth=Math.max(420,innerWidth-40),availableHeight=Math.max(300,innerHeight-110);
      const fitted=Math.min(1,(availableWidth-20)/naturalWidth,(availableHeight-145)/naturalHeight);
      const factor=scale==='fit'?fitted:scale;
      win.style.width=`${Math.min(availableWidth,Math.max(420,naturalWidth*factor+18))}px`;
      win.style.height=`${Math.min(availableHeight,Math.max(330,naturalHeight*factor+130))}px`;
    };
    open.addEventListener('click',openVirtual);
    fromLocal.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>{
      const selectedFile=file.files[0];if(!selectedFile)return;
      const url=URL.createObjectURL(selectedFile);
      loadSource({src:url,name:selectedFile.name,type:selectedFile.type,size:selectedFile.size,revoke:true});
      file.value='';
    });
    footerButtons[0].addEventListener('click',()=>{if(video.src)video.currentTime=Math.max(0,video.currentTime-10);});
    playButton.addEventListener('click',playPause);
    footerButtons[2].addEventListener('click',()=>{if(video.src)video.currentTime=Math.min(video.duration||video.currentTime+10,video.currentTime+10);});
    position.addEventListener('input',()=>{if(video.duration)video.currentTime=Number(position.value)/1000*video.duration;});
    volume.addEventListener('input',()=>{video.volume=Number(volume.value)/100;});
    ['timeupdate','play','pause','durationchange','ended'].forEach(type=>video.addEventListener(type,updateTransport));
    video.addEventListener('loadedmetadata',()=>{
      win.querySelector('.win-statusbar').textContent=`${video.videoWidth||'音频'}${video.videoWidth?` × ${video.videoHeight}`:''} · ${time(video.duration)}`;
      resizePlayer('fit');
    });
    video.addEventListener('dblclick',()=>{
      theaterMode=!theaterMode;
      win.querySelector('.tl-zoom')?.click();
      applyPreferences();
    });
    info.addEventListener('click',showInspector);
    win=System.createWindow({
      app:'quicktime',title:'QuickTime Player',width:720,height:500,toolbar,content:root,statusbar:'尚未打开影片',
      onClose:()=>{video.pause();if(currentUrl&&currentUrl.startsWith('blob:'))URL.revokeObjectURL(currentUrl);document.removeEventListener('app-preferences-changed',preferencesChanged);return true;},
    });
    win.dataset.loop='false';
    win.addEventListener('leopard-command',event=>{
      const actions={
        'open-document':openVirtual,'play-pause':playPause,
        'go-beginning':()=>{if(video.src)video.currentTime=0;},
        'go-end':()=>{if(video.duration)video.currentTime=video.duration;},
        'half-size':()=>resizePlayer(.5),'actual-size':()=>resizePlayer(1),
        'double-size':()=>resizePlayer(2),'fit-screen':()=>resizePlayer('fit'),
        'toggle-loop':()=>{video.loop=!video.loop;win.dataset.loop=String(video.loop);Leopard.toast('QuickTime Player',video.loop?'循环播放已开启。':'循环播放已关闭。');},
        'show-inspector':showInspector,
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    if(arg?.path)loadVfsPath(VFS.normalize(arg.path));
    else if(arg?.src)loadSource({src:arg.src,name:arg.name||'未命名影片',type:arg.mime||'',size:arg.size??null,path:arg.path||''});
  }
  System.registerApp({id:'quicktime',name:'QuickTime Player',icon:qtIcon,open:openQuickTime,about:'本地视频/音频打开、播放、时间线和影片简介。',keywords:'quicktime movie video player 影片'});

  const dvdIcon=icon('dvd','#323741','#0b0d12','<circle cx="32" cy="32" r="21" fill="#d8dde5" stroke="#fff" stroke-width="1.5"/><circle cx="32" cy="32" r="9" fill="#6d7480"/><circle cx="32" cy="32" r="3" fill="#15171c"/><path d="M32 11v12M50 22l-11 6M48 45l-10-7M16 44l10-7M14 21l12 7" stroke="#8d96a2" stroke-width="2"/>');
  function openDVD(){
    const chapters=[
      {title:'序幕：星际启动',duration:96,speed:.34,zh:'在黑暗中，一道新的光芒正在苏醒。',en:'In the darkness, a new light awakens.'},
      {title:'Aqua 世界',duration:82,speed:.55,zh:'水晶般的界面在星空中展开。',en:'The crystalline interface unfolds among the stars.'},
      {title:'重返 Leopard',duration:109,speed:.72,zh:'欢迎回到 Mac OS X Leopard。',en:'Welcome back to Mac OS X Leopard.'},
    ];
    const subtitleTracks=['关闭','简体中文','English'];
    const audioTracks=['English — Dolby Digital 5.1','日本語 — Dolby Digital 2.0','音乐与效果'];
    const root=el('div','dvd-app');
    root.tabIndex=0;
    root.innerHTML=`<section class="dvd-stage">
      <canvas aria-hidden="true"></canvas>
      <header class="dvd-hud"><span>DVD VIDEO</span><b></b><time></time></header>
      <div class="dvd-title"><small>DVD VIDEO</small><b>LEOPARD</b><span>AN AQUA EXPERIENCE</span><em></em></div>
      <div class="dvd-subtitle" aria-live="polite"></div>
      <div class="dvd-menu-overlay" hidden>
        <div><small>LEOPARD</small><h2>主菜单</h2><p>AN AQUA EXPERIENCE</p>
          <nav aria-label="DVD 主菜单">
            <button data-menu-action="resume">▶ 继续播放</button>
            ${chapters.map((chapter,index)=>`<button data-menu-chapter="${index}">${index+1}. ${chapter.title}</button>`).join('')}
          </nav>
        </div>
      </div>
      <div class="dvd-choice-panel" hidden></div>
      <div class="dvd-osd" aria-live="polite"></div>
    </section>
    <footer>
      <button class="dvd-menu" title="显示 DVD 菜单">菜单</button>
      <button class="dvd-previous" title="上一章节或回到章节开头">◀◀</button>
      <button class="dvd-play play" title="播放或暂停">❚❚</button>
      <button class="dvd-next" title="下一章节">▶▶</button>
      <button class="dvd-subtitles" title="选择字幕">字幕</button>
      <button class="dvd-audio" title="选择音轨">音频</button>
      <label>章节 <select class="dvd-chapter" aria-label="章节">${chapters.map((chapter,index)=>`<option value="${index}">第 ${index+1} 章</option>`).join('')}</select></label>
      <span class="dvd-status"></span>
    </footer>`;
    const canvas=root.querySelector('canvas');
    const titleChapter=root.querySelector('.dvd-title em');
    const hudChapter=root.querySelector('.dvd-hud b');
    const hudTime=root.querySelector('.dvd-hud time');
    const subtitle=root.querySelector('.dvd-subtitle');
    const menuOverlay=root.querySelector('.dvd-menu-overlay');
    const choicePanel=root.querySelector('.dvd-choice-panel');
    const osd=root.querySelector('.dvd-osd');
    const status=root.querySelector('.dvd-status');
    const playButton=root.querySelector('.dvd-play');
    const menuButton=root.querySelector('.dvd-menu');
    const chapterSelect=root.querySelector('.dvd-chapter');
    let win=null;
    let chapterIndex=0;
    let elapsed=0;
    let playing=true;
    let menuVisible=false;
    let resumeAfterMenu=true;
    let subtitleTrack='简体中文';
    let audioTrack=audioTracks[0];
    let rendererStop=null;
    let osdTimer=0;
    const formatTime=(seconds)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    const showOSD=(text)=>{
      osd.textContent=text;
      osd.classList.add('on');
      clearTimeout(osdTimer);
      osdTimer=setTimeout(()=>osd.classList.remove('on'),1300);
    };
    const restartRenderer=()=>{
      rendererStop?.();
      rendererStop=null;
      if(playing&&!menuVisible)rendererStop=Leopard.startStarfield(canvas,{teal:chapterIndex===1,speed:chapters[chapterIndex].speed});
    };
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.dvdPlaying=String(playing);
      win.dataset.dvdMenu=String(menuVisible);
      win.dataset.dvdChapter=String(chapterIndex+1);
      win.dataset.dvdSubtitle=subtitleTrack;
      win.dataset.dvdAudio=audioTrack;
      root.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
    };
    const render=()=>{
      const chapter=chapters[chapterIndex];
      titleChapter.textContent=`第 ${chapterIndex+1} 章 · ${chapter.title}`;
      hudChapter.textContent=`${chapterIndex+1}/${chapters.length}  ${chapter.title}`;
      hudTime.textContent=`${formatTime(elapsed)} / ${formatTime(chapter.duration)}`;
      status.textContent=`${formatTime(elapsed)}  ·  ${audioTrack.replace(/ — .*/, '')}`;
      subtitle.textContent=subtitleTrack==='简体中文'?chapter.zh:subtitleTrack==='English'?chapter.en:'';
      subtitle.hidden=subtitleTrack==='关闭'||menuVisible;
      playButton.textContent=playing&&!menuVisible?'❚❚':'▶';
      playButton.title=playing&&!menuVisible?'暂停':'播放';
      menuButton.classList.toggle('active',menuVisible);
      menuOverlay.hidden=!menuVisible;
      chapterSelect.value=String(chapterIndex);
      root.classList.toggle('paused',!playing);
      updateWindowState();
    };
    const setPlaying=(next)=>{
      if(next&&menuVisible)menuVisible=false;
      playing=Boolean(next);
      restartRenderer();
      render();
      showOSD(playing?'播放':'暂停');
    };
    const goChapter=(next,autoplay=true)=>{
      chapterIndex=(Number(next)+chapters.length)%chapters.length;
      elapsed=0;
      menuVisible=false;
      playing=autoplay;
      choicePanel.hidden=true;
      restartRenderer();
      render();
      showOSD(`第 ${chapterIndex+1} 章 · ${chapters[chapterIndex].title}`);
    };
    const previousChapter=()=>{
      if(elapsed>5){elapsed=0;render();showOSD('回到章节开头');}
      else goChapter(chapterIndex-1,playing);
    };
    const nextChapter=()=>goChapter(chapterIndex+1,true);
    const toggleMenu=()=>{
      choicePanel.hidden=true;
      if(menuVisible){
        menuVisible=false;
        playing=resumeAfterMenu;
      }else{
        resumeAfterMenu=playing;
        menuVisible=true;
        playing=false;
      }
      restartRenderer();
      render();
      if(menuVisible)requestAnimationFrame(()=>menuOverlay.querySelector('button')?.focus());
    };
    const chooseSubtitle=(value)=>{
      subtitleTrack=subtitleTracks.includes(value)?value:'关闭';
      choicePanel.hidden=true;
      render();
      showOSD(`字幕：${subtitleTrack}`);
    };
    const chooseAudio=(value)=>{
      audioTrack=audioTracks.includes(value)?value:audioTracks[0];
      choicePanel.hidden=true;
      render();
      showOSD(`音频：${audioTrack}`);
    };
    const showChoices=(kind)=>{
      const values=kind==='subtitle'?subtitleTracks:audioTracks;
      const current=kind==='subtitle'?subtitleTrack:audioTrack;
      choicePanel.innerHTML=`<header>${kind==='subtitle'?'字幕':'音频'}</header>${values.map(value=>`<button data-choice="${value}" data-kind="${kind}" class="${value===current?'selected':''}"><span>${value===current?'✓':''}</span>${value}</button>`).join('')}`;
      choicePanel.hidden=false;
      requestAnimationFrame(()=>choicePanel.querySelector('.selected')?.focus());
    };
    root.querySelector('.dvd-menu').addEventListener('click',toggleMenu);
    root.querySelector('.dvd-previous').addEventListener('click',previousChapter);
    playButton.addEventListener('click',()=>setPlaying(!playing||menuVisible));
    root.querySelector('.dvd-next').addEventListener('click',nextChapter);
    root.querySelector('.dvd-subtitles').addEventListener('click',()=>showChoices('subtitle'));
    root.querySelector('.dvd-audio').addEventListener('click',()=>showChoices('audio'));
    chapterSelect.addEventListener('change',()=>goChapter(Number(chapterSelect.value),true));
    menuOverlay.addEventListener('click',event=>{
      const chapter=event.target.closest('[data-menu-chapter]');
      if(chapter)goChapter(Number(chapter.dataset.menuChapter),true);
      else if(event.target.closest('[data-menu-action="resume"]')){
        menuVisible=false;playing=true;restartRenderer();render();
      }
    });
    choicePanel.addEventListener('click',event=>{
      const button=event.target.closest('[data-choice]');
      if(!button)return;
      if(button.dataset.kind==='subtitle')chooseSubtitle(button.dataset.choice);
      else chooseAudio(button.dataset.choice);
    });
    root.addEventListener('keydown',event=>{
      if(event.target.matches('select'))return;
      if(event.key===' '){event.preventDefault();setPlaying(!playing||menuVisible);}
      else if(event.key==='ArrowLeft'){event.preventDefault();previousChapter();}
      else if(event.key==='ArrowRight'){event.preventDefault();nextChapter();}
      else if(event.key==='Escape'){
        event.preventDefault();
        if(!choicePanel.hidden)choicePanel.hidden=true;
        else toggleMenu();
      }
    });
    root.addEventListener('app-command',event=>{
      const commands={
        'play-pause':()=>setPlaying(!playing||menuVisible),
        'show-disc-menu':toggleMenu,
        'previous-chapter':previousChapter,
        'next-chapter':nextChapter,
        'chapter-1':()=>goChapter(0,true),
        'chapter-2':()=>goChapter(1,true),
        'chapter-3':()=>goChapter(2,true),
        'subtitles-off':()=>chooseSubtitle('关闭'),
        'subtitles-zh':()=>chooseSubtitle('简体中文'),
        'subtitles-en':()=>chooseSubtitle('English'),
        'audio-en':()=>chooseAudio(audioTracks[0]),
        'audio-ja':()=>chooseAudio(audioTracks[1]),
        'audio-effects':()=>chooseAudio(audioTracks[2]),
      };
      const action=commands[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    const timer=setInterval(()=>{
      if(!playing||menuVisible)return;
      elapsed+=1;
      if(elapsed>=chapters[chapterIndex].duration)goChapter(chapterIndex+1,true);
      else render();
    },1000);
    win=System.createWindow({app:'dvdplayer',title:'DVD 播放器 — LEOPARD',width:760,height:520,content:root,onClose:()=>{
      clearInterval(timer);
      clearTimeout(osdTimer);
      rendererStop?.();
      return true;
    }});
    restartRenderer();
    render();
    requestAnimationFrame(()=>root.focus());
    return win;
  }
  System.registerApp({id:'dvdplayer',name:'DVD 播放器',icon:dvdIcon,open:openDVD,about:'DVD 菜单、章节、字幕、音轨和 WebGL2 影片舞台。',keywords:'dvd player 影片 光盘'});

  // ---------- Automator ----------
  const automatorIcon=icon('auto','#d5d8dd','#737984','<path d="M19 14h27v36H19z" fill="#f3f3f3" stroke="#444" stroke-width="1.5"/><path d="M24 22h17M24 28h17M24 34h12" stroke="#777" stroke-width="2"/><circle cx="43" cy="43" r="9" fill="#68798d" stroke="#fff"/><path d="m39 43 3 3 6-8" fill="none" stroke="#fff" stroke-width="2.5"/>');
  const AUTOMATOR_RECOVERY_KEY='macweb.automator.workflow';
  const actions=[
    {id:'message',cat:'实用工具',name:'显示信息',desc:'显示带有自定义文字的 Aqua 对话框。',defaultValue:'Automator 工作流程已完成'},
    {id:'file',cat:'文件与文件夹',name:'新建文本文件',desc:'在“文稿”文件夹中建立文本文件。',defaultValue:'Automator 输出.txt'},
    {id:'open',cat:'应用程序',name:'启动应用程序',desc:'启动所选的 Mac OS X 应用程序。',defaultValue:'finder'},
    {id:'wallpaper',cat:'系统',name:'设定桌面图片',desc:'将桌面切换到所选 Apple 桌面图片。',defaultValue:'aurora'},
    {id:'snapshot',cat:'系统',name:'建立 Time Machine 快照',desc:'备份当前虚拟文件系统。',defaultValue:''},
    {id:'pause',cat:'实用工具',name:'暂停',desc:'让工作流程等待指定的秒数。',defaultValue:'2'},
  ];
  const automatorDefaultValue=(id)=>actions.find(action=>action.id===id)?.defaultValue||'';
  const normalizeAutomatorWorkflow=(value)=>{
    const raw=Array.isArray(value)?value:[];
    return raw.map(step=>{
      const id=typeof step==='string'?step:String(step?.id||'');
      if(!actions.some(action=>action.id===id))return null;
      return {id,value:String(typeof step==='object'&&step?.value!=null?step.value:automatorDefaultValue(id))};
    }).filter(Boolean);
  };
  function openAutomator(arg){
    const initialPath=arg?.path?VFS.normalize(arg.path):null;
    const initialNode=initialPath?VFS.get(initialPath):null;
    let initialDocument=null;
    if(initialNode?.type==='file'){
      try{initialDocument=JSON.parse(initialNode.content||'');}catch(error){}
    }
    const recovery=jsonStore(AUTOMATOR_RECOVERY_KEY,{inputType:'none',steps:[]});
    let workflow=normalizeAutomatorWorkflow(initialDocument?.steps||(Array.isArray(recovery)?recovery:recovery.steps));
    let inputType=['none','files','text'].includes(initialDocument?.inputType)?initialDocument.inputType:
      (['none','files','text'].includes(recovery?.inputType)?recovery.inputType:'none');
    let currentPath=initialNode?.type==='file'?initialPath:null;
    let running=false,runToken=0,selectedStep=-1,searchQuery='',draggedStep=-1;
    let win=null,lastSaved='',closePrompt=null;

    const toolbar=el('div','automator-toolbar');
    const run=el('button','finder-toolbar-btn','▶ 运行');run.dataset.command='run-workflow';
    const stop=el('button','finder-toolbar-btn','■ 停止');stop.dataset.command='stop-workflow';
    const saveBtn=el('button','finder-toolbar-btn','存储');saveBtn.dataset.command='save';
    const toolbarStatus=el('span','automator-toolbar-status','就绪');
    toolbar.append(run,stop,saveBtn,toolbarStatus);
    const root=el('div','automator-app');
    root.innerHTML=`<aside><header><b>资源库</b><small>操作</small></header>
      <input class="aqua-input aqua-search auto-search" type="search" placeholder="搜索操作" aria-label="搜索操作">
      <div class="auto-actions" role="listbox" aria-label="操作资料库"></div></aside>
      <main><header>工作流程接收：
        <select class="aqua-select auto-input-type" aria-label="工作流程接收"><option value="none">无输入</option><option value="files">文件或文件夹</option><option value="text">文本</option></select>
      </header><section class="auto-flow" aria-label="工作流程"></section>
      <footer><span>将操作拖到右侧，或双击操作以添加。</span><b class="auto-count"></b></footer></main>`;
    const list=root.querySelector('.auto-actions'),flow=root.querySelector('.auto-flow');
    const search=root.querySelector('.auto-search'),inputSelect=root.querySelector('.auto-input-type');
    const footerText=root.querySelector('main>footer>span'),count=root.querySelector('.auto-count');
    inputSelect.value=inputType;

    const serialized=()=>JSON.stringify({format:'com.apple.Automator.workflow',version:1,inputType,steps:workflow},null,2);
    const documentName=()=>currentPath?VFS.baseName(currentPath):'未命名工作流程';
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{
      detail:{appId:'automator',window:win,dirty:!!win?._documentDirty,path:currentPath,running},
    }));
    const updateWindowState=()=>{
      if(!win)return;
      win._path=currentPath;win.dataset.automatorRunning=String(running);
      win.dataset.automatorHasSteps=String(!!workflow.length);
      win.dataset.automatorSelection=String(selectedStep>=0&&selectedStep<workflow.length);
      win._title.textContent=`Automator — ${documentName()}`;
      win._status.textContent=`${workflow.length} 个操作${win._documentDirty?' · 已修改':''}${running?' · 正在运行':''}`;
      run.disabled=running||!workflow.length;stop.disabled=!running;saveBtn.disabled=running;
      toolbarStatus.textContent=running?'正在运行…':win._documentDirty?'已修改':'就绪';
      count.textContent=`${workflow.length} 个操作`;
      notifyState();
    };
    const rememberRecovery=()=>save(AUTOMATOR_RECOVERY_KEY,{inputType,steps:workflow});
    const setDirty=(dirty=true)=>{
      if(!win)return;
      win._documentDirty=!!dirty;win.classList.toggle('document-dirty',!!dirty);
      rememberRecovery();updateWindowState();
    };
    const controlMarkup=(step,index)=>{
      if(step.id==='open')return `<label class="auto-parameter"><span>应用程序：</span><select class="aqua-select" data-step-value="${index}">
        <option value="finder">Finder</option><option value="safari">Safari</option><option value="mail">Mail</option>
        <option value="preview">预览</option><option value="sysprefs">系统偏好设置</option><option value="ical">iCal</option></select></label>`;
      if(step.id==='wallpaper')return `<label class="auto-parameter"><span>桌面图片：</span><select class="aqua-select" data-step-value="${index}">
        <option value="aurora">Aurora</option><option value="tiger">Aqua Blue</option><option value="purple">Purple Aurora</option><option value="graphite">Graphite</option></select></label>`;
      if(step.id==='snapshot')return '<div class="auto-no-parameter">运行时将建立一个可在 Time Machine 中浏览的本地快照。</div>';
      if(step.id==='pause')return `<label class="auto-parameter"><span>等待：</span><input class="aqua-input" data-step-value="${index}" type="number" min="1" max="30" value="${esc(step.value)}"><em>秒</em></label>`;
      const label=step.id==='file'?'文件名称：':'信息：';
      return `<label class="auto-parameter"><span>${label}</span><input class="aqua-input" data-step-value="${index}" value="${esc(step.value)}"></label>`;
    };
    const renderActions=()=>{
      const needle=searchQuery.trim().toLocaleLowerCase();
      const visible=actions.filter(action=>!needle||`${action.name} ${action.cat} ${action.desc}`.toLocaleLowerCase().includes(needle));
      list.innerHTML='';
      let lastCategory='';
      visible.forEach(action=>{
        if(action.cat!==lastCategory){list.appendChild(el('h4','',action.cat));lastCategory=action.cat;}
        const button=el('button','auto-action');
        button.dataset.id=action.id;button.draggable=true;button.setAttribute('role','option');
        button.innerHTML=`<i>＋</i><span><b>${esc(action.name)}</b><small>${esc(action.desc)}</small></span>`;
        list.appendChild(button);
      });
      if(!visible.length)list.appendChild(el('div','auto-library-empty','没有匹配的操作'));
    };
    const renderFlow=()=>{
      flow.innerHTML='';
      if(!workflow.length){
        const empty=el('div','auto-empty');
        empty.innerHTML='<i>⇢</i><b>将操作拖到这里以构建工作流程</b><span>也可以在资源库中双击一个操作。</span>';
        flow.appendChild(empty);
      }else workflow.forEach((step,index)=>{
        const action=actions.find(item=>item.id===step.id);
        const article=el('article',index===selectedStep?'selected':'');
        article.dataset.i=index;article.draggable=!running;
        article.innerHTML=`<header><span>${index+1}</span><b>${esc(action?.name||step.id)}</b>
          <div><button data-move="-1" title="上移" ${index===0||running?'disabled':''}>↑</button>
          <button data-move="1" title="下移" ${index===workflow.length-1||running?'disabled':''}>↓</button>
          <button data-remove title="移除" ${running?'disabled':''}>×</button></div></header>
          <p>${esc(action?.desc||'')}</p>${controlMarkup(step,index)}<output class="auto-step-result"></output>`;
        flow.appendChild(article);
        const control=article.querySelector('[data-step-value]');
        if(control){
          control.value=step.value;
          control.addEventListener(control.tagName==='SELECT'?'change':'input',()=>{
            workflow[index].value=control.value;setDirty(true);
          });
        }
      });
      updateWindowState();
    };
    const addAction=(id,index=workflow.length)=>{
      if(running||!actions.some(action=>action.id===id))return;
      const step={id,value:automatorDefaultValue(id)};
      workflow.splice(Math.max(0,Math.min(workflow.length,index)),0,step);
      selectedStep=Math.max(0,Math.min(workflow.length-1,index));setDirty(true);renderFlow();
    };
    const removeStep=(index)=>{
      if(running||index<0||index>=workflow.length)return;
      workflow.splice(index,1);selectedStep=Math.min(index,workflow.length-1);setDirty(true);renderFlow();
    };
    const moveStep=(index,amount)=>{
      const next=index+amount;if(running||next<0||next>=workflow.length)return;
      const [step]=workflow.splice(index,1);workflow.splice(next,0,step);selectedStep=next;setDirty(true);renderFlow();
    };
    const markStep=(index,state,message='')=>{
      const article=flow.querySelector(`article[data-i="${index}"]`);if(!article)return;
      article.classList.remove('running','done','failed');if(state)article.classList.add(state);
      article.querySelector('.auto-step-result').textContent=message;
    };
    const waitCancelable=async(milliseconds,token)=>{
      let remaining=milliseconds;
      while(remaining>0&&running&&token===runToken){
        const slice=Math.min(100,remaining);await new Promise(resolve=>setTimeout(resolve,slice));remaining-=slice;
      }
      return running&&token===runToken;
    };
    const setWallpaper=(choice)=>{
      const choices={
        aurora:{id:'',name:'Aurora',css:'url("assets/aurora.svg")'},
        tiger:{id:'tiger',name:'Aqua Blue',css:'url("assets/tiger.svg")'},
        purple:{id:'purpleaurora',name:'Purple Aurora',css:'radial-gradient(ellipse at 66% 22%,#e89cff 0 4%,transparent 27%),radial-gradient(ellipse at 35% 65%,#387de4,transparent 44%),linear-gradient(135deg,#170d38,#7a218d 48%,#091b4d)'},
        graphite:{id:'graphite',name:'Graphite',css:'radial-gradient(ellipse at 50% 35%,#89939e,#23272d 74%)'},
      };
      const wallpaper=choices[choice]||choices.aurora;
      if(wallpaper.id)document.body.dataset.wallpaper=wallpaper.id;else delete document.body.dataset.wallpaper;
      const desktop=document.querySelector('#desktop');
      if(desktop)desktop.style.background=`${wallpaper.css} center / cover no-repeat`;
      localStorage.setItem('macweb.wallpaper',wallpaper.id);
      localStorage.setItem('macweb.wallpaper.css',wallpaper.css);
      localStorage.setItem('macweb.wallpaper.name',wallpaper.name);
    };
    const runWorkflow=async()=>{
      if(running||!workflow.length)return;
      running=true;const token=++runToken;selectedStep=-1;
      flow.querySelectorAll('article').forEach((article)=>article.classList.remove('running','done','failed'));
      footerText.textContent='正在运行工作流程…';updateWindowState();
      let completed=0;
      try{
        for(let index=0;index<workflow.length;index++){
          if(!running||token!==runToken)break;
          const step=workflow[index],action=actions.find(item=>item.id===step.id);
          markStep(index,'running','正在运行…');toolbarStatus.textContent=`${index+1}/${workflow.length} ${action?.name||step.id}`;
          if(step.id==='message')System.alertBox('Automator',step.value||'工作流程已完成');
          else if(step.id==='file'){
            const raw=(step.value||'Automator 输出.txt').replace(/[\\/]/g,'-');
            const dot=raw.lastIndexOf('.'),base=dot>0?raw.slice(0,dot):raw,extension=dot>0?raw.slice(dot):'.txt';
            const name=VFS.uniqueName('/用户/roll/文稿',base||'Automator 输出',extension);
            VFS.putNode(`/用户/roll/文稿/${name}`,{type:'file',content:'由 Automator 工作流程创建。\n',mime:'text/plain',creator:'automator',generated:true});
          }else if(step.id==='open')System.launch(System.apps[step.value]?step.value:'finder');
          else if(step.id==='wallpaper')setWallpaper(step.value);
          else if(step.id==='snapshot')Leopard.saveSnapshot('Automator 工作流程');
          else if(step.id==='pause'){
            const seconds=Math.max(1,Math.min(30,Number(step.value)||1));
            if(!await waitCancelable(seconds*1000,token))break;
          }
          if(step.id!=='pause'&&!await waitCancelable(260,token))break;
          completed++;markStep(index,'done','✓ 完成');
        }
      }catch(error){
        console.error('Automator workflow failed',error);
        const index=Math.max(0,completed);markStep(index,'failed',`错误：${error.message||error}`);
      }
      const stopped=!running||token!==runToken;
      if(token===runToken)running=false;
      footerText.textContent=stopped?`工作流程已停止（完成 ${completed}/${workflow.length}）。`:`工作流程已完成（${completed} 个操作）。`;
      updateWindowState();
      Leopard.toast('Automator',stopped?'工作流程已停止。':'工作流程已完成。');
    };
    const stopWorkflow=()=>{
      if(!running)return;
      running=false;runToken++;flow.querySelectorAll('article.running').forEach(article=>{
        article.classList.remove('running');article.querySelector('.auto-step-result').textContent='已停止';
      });
      footerText.textContent='工作流程已由用户停止。';updateWindowState();
    };
    const writeDocument=(path)=>{
      path=VFS.normalize(path);
      const ok=VFS.putNode(path,{type:'file',kind:'workflow',content:serialized(),mime:'application/x-automator-workflow',creator:'automator',generated:true});
      if(!ok){System.alertBox('Automator','无法存储工作流程。');return false;}
      currentPath=path;lastSaved=serialized();setDirty(false);System.addRecentDocument?.(path,'automator');
      Leopard.toast('Automator',`已存储“${VFS.baseName(path)}”。`);return true;
    };
    const doSave=(saveAs=false,onSaved)=>{
      if(currentPath&&!saveAs){const ok=writeDocument(currentPath);if(ok)onSaved?.();return ok;}
      const directory=currentPath?VFS.parentOf(currentPath):'/用户/roll/文稿';
      System.savePanel({
        parent:win,title:'存储工作流程',startPath:directory,
        name:currentPath?VFS.baseName(currentPath):VFS.uniqueName(directory,'未命名工作流程','.workflow'),
        extension:'workflow',typeLabel:'Automator 工作流程',allowOverwrite:true,
        onSave:(path)=>{const ok=writeDocument(path);if(ok)onSaved?.();return ok;},
      });
      return false;
    };
    const applyDocument=(path)=>{
      const node=VFS.get(path);if(node?.type!=='file')return false;
      try{
        const parsed=JSON.parse(node.content||'');
        workflow=normalizeAutomatorWorkflow(parsed.steps);inputType=['none','files','text'].includes(parsed.inputType)?parsed.inputType:'none';
        currentPath=path;inputSelect.value=inputType;selectedStep=-1;lastSaved=serialized();setDirty(false);renderFlow();
        System.addRecentDocument?.(path,'automator');return true;
      }catch(error){System.alertBox('Automator','所选文件不是有效的 Automator 工作流程。');return false;}
    };
    const openDocument=()=>System.openPanel({
      parent:win,title:'打开工作流程',startPath:currentPath?VFS.parentOf(currentPath):'/用户/roll/文稿',
      types:['workflow'],allowUpload:true,onOpen:(path)=>{
        const load=()=>applyDocument(path);
        if(!win._documentDirty)load();
        else System.confirmSheet({parent:win,headline:'放弃当前工作流程的更改？',message:'未存储的更改将会丢失。',okLabel:'放弃更改',danger:true,onOK:load});
      },
    });
    const newDocument=()=>{
      const reset=()=>{workflow=[];inputType='none';inputSelect.value='none';currentPath=null;selectedStep=-1;lastSaved=serialized();setDirty(false);renderFlow();};
      if(!win._documentDirty)reset();
      else System.confirmSheet({parent:win,headline:'放弃当前工作流程的更改？',message:'未存储的更改将会丢失。',okLabel:'放弃更改',danger:true,onOK:reset});
    };

    win=System.createWindow({
      app:'automator',title:'Automator — 未命名工作流程',width:920,height:610,toolbar,content:root,statusbar:'',
      onClose:(window,context)=>{
        stopWorkflow();
        if(context.force||!window._documentDirty)return true;
        if(closePrompt?.shield.isConnected)return false;
        const body=el('div','automator-save-warning');
        body.innerHTML=`<div>${automatorIcon}</div><section><h3>要存储对“${esc(documentName())}”所做的更改吗？</h3><p>如果不存储，更改将会丢失。</p></section>`;
        const finishClose=()=>setTimeout(()=>{if(window.isConnected)System.closeWindow(window);},170);
        closePrompt=System.showSheet({
          parent:window,content:body,className:'automator-save-warning-sheet',
          buttons:[
            {label:'取消',cancel:true},
            {label:'不存储',danger:true,action:()=>{setDirty(false);finishClose();}},
            {label:'存储',default:true,action:()=>setTimeout(()=>doSave(false,finishClose),170)},
          ],
          onClose:()=>{closePrompt=null;},
        });
        return false;
      },
    });
    lastSaved=serialized();win._documentDirty=false;
    renderActions();renderFlow();updateWindowState();
    if(currentPath)System.addRecentDocument?.(currentPath,'automator');

    search.addEventListener('input',()=>{searchQuery=search.value;renderActions();});
    inputSelect.addEventListener('change',()=>{inputType=inputSelect.value;setDirty(true);});
    list.addEventListener('dblclick',event=>{const button=event.target.closest('[data-id]');if(button)addAction(button.dataset.id);});
    list.addEventListener('dragstart',event=>{
      const button=event.target.closest('[data-id]');if(!button)return;
      event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-automator-action',button.dataset.id);
    });
    flow.addEventListener('click',event=>{
      const article=event.target.closest('article[data-i]');if(!article)return;
      const index=Number(article.dataset.i);selectedStep=index;
      const move=event.target.closest('[data-move]'),remove=event.target.closest('[data-remove]');
      if(move)moveStep(index,Number(move.dataset.move));
      else if(remove)removeStep(index);
      else{
        flow.querySelectorAll('article').forEach(candidate=>candidate.classList.toggle('selected',candidate===article));
        updateWindowState();
      }
    });
    flow.addEventListener('dragstart',event=>{
      const article=event.target.closest('article[data-i]');if(!article)return;
      draggedStep=Number(article.dataset.i);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-automator-step',String(draggedStep));
    });
    flow.addEventListener('dragover',event=>{event.preventDefault();flow.classList.add('dragging');});
    flow.addEventListener('dragleave',event=>{if(!flow.contains(event.relatedTarget))flow.classList.remove('dragging');});
    flow.addEventListener('drop',event=>{
      event.preventDefault();flow.classList.remove('dragging');
      const target=event.target.closest('article[data-i]'),index=target?Number(target.dataset.i):workflow.length;
      const actionId=event.dataTransfer.getData('application/x-automator-action');
      if(actionId)addAction(actionId,index);
      else{
        const from=Number(event.dataTransfer.getData('application/x-automator-step'));
        if(Number.isInteger(from)&&from>=0&&from<workflow.length){
          const [step]=workflow.splice(from,1);const adjusted=from<index?index-1:index;
          workflow.splice(Math.max(0,adjusted),0,step);selectedStep=Math.max(0,adjusted);setDirty(true);renderFlow();
        }
      }
      draggedStep=-1;
    });
    run.addEventListener('click',runWorkflow);stop.addEventListener('click',stopWorkflow);saveBtn.addEventListener('click',()=>doSave(false));
    win.addEventListener('leopard-command',event=>{
      const actionsByCommand={
        'new-workflow':newDocument,'open-document':openDocument,'save':()=>doSave(false),'save-as':()=>doSave(true),
        'run-workflow':runWorkflow,'stop-workflow':stopWorkflow,'remove-action':()=>removeStep(selectedStep),
        'focus-search':()=>{search.focus();search.select();},
      };
      const action=actionsByCommand[event.detail?.command];if(action){event.preventDefault();action();}
    });
  }
  System.registerApp({id:'automator',name:'Automator',icon:automatorIcon,open:openAutomator,multiWindow:true,about:'操作资料库、可组合工作流程、Aqua 打开/存储面板、停止控制及 Finder 工作流程文稿。',keywords:'automator workflow 自动操作 工作流程'});

  // ---------- Image Capture ----------
  const captureIcon=icon('ic','#b9d1e9','#527da8','<rect x="13" y="14" width="38" height="36" rx="4" fill="#eff7ff" stroke="#315b85" stroke-width="1.5"/><rect x="19" y="9" width="26" height="9" rx="3" fill="#dbe8f4" stroke="#315b85"/><circle cx="32" cy="33" r="11" fill="#477fb1" stroke="#fff" stroke-width="2"/><circle cx="32" cy="33" r="5" fill="#9bddff"/>');
  function openImageCapture(){
    const toolbar=el('div','capture-toolbar');
    const chooseButton=el('button','finder-toolbar-btn','从本机…');
    chooseButton.dataset.command='choose-files';
    const finderButton=el('button','finder-toolbar-btn','从 Finder…');
    finderButton.dataset.command='add-vfs-images';
    const importButton=el('button','finder-toolbar-btn','导入');
    importButton.dataset.command='import-selection';
    const importAllButton=el('button','finder-toolbar-btn','全部导入');
    importAllButton.dataset.command='import-all';
    const removeButton=el('button','finder-toolbar-btn','移除');
    removeButton.dataset.command='delete';
    const rotateLeft=el('button','finder-toolbar-btn','↺');
    rotateLeft.title='向左旋转';rotateLeft.dataset.command='rotate-left';
    const rotateRight=el('button','finder-toolbar-btn','↻');
    rotateRight.title='向右旋转';rotateRight.dataset.command='rotate-right';
    const toolbarSpacer=el('i');
    const revealButton=el('button','finder-toolbar-btn','在 Finder 中显示');
    revealButton.dataset.command='reveal-imports';
    toolbar.append(chooseButton,finderButton,importButton,importAllButton,removeButton,rotateLeft,rotateRight,toolbarSpacer,revealButton);

    const root=el('div','imagecapture-app');
    root.innerHTML=`<aside><h4>设备</h4>
      <button data-device="browser"><span>📷</span><b>浏览器文件</b><small>选择本机图像</small></button>
      <button data-device="isight"><span>◉</span><b>内建 iSight</b><small>使用 Photo Booth</small></button>
      <button data-device="iphone" class="disconnected"><span>📱</span><b>iPhone</b><small>未连接</small></button>
    </aside><main>
      <div class="capture-drop" tabindex="0"><b>选择照片或将照片拖到这里</b><span>支持浏览器可读取的 JPEG、PNG、GIF、WebP 和 SVG</span><input type="file" accept="image/*" multiple aria-label="选择要导入的图像"></div>
      <div class="capture-grid" role="listbox" aria-label="待导入图像" aria-multiselectable="true"></div>
      <footer><label>导入到：<select class="aqua-select capture-destination"><option value="/用户/roll/图片">图片</option><option value="/用户/roll/桌面">桌面</option><option value="/用户/roll/下载">下载</option></select></label>
      <label class="spp-check"><input type="checkbox" class="capture-remove-after"> 导入后从列表移除</label></footer>
    </main>`;
    const input=root.querySelector('input[type="file"]'),drop=root.querySelector('.capture-drop');
    const grid=root.querySelector('.capture-grid'),destination=root.querySelector('.capture-destination');
    const removeAfter=root.querySelector('.capture-remove-after');
    let files=[],selected=new Set(),selectionAnchor=null,currentDevice='browser',importing=false,lastImportDirectory='';
    let win=null;
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{detail:{appId:'imagecapture'}}));
    const release=(entry)=>{if(entry?.file&&entry.url?.startsWith('blob:'))URL.revokeObjectURL(entry.url);};
    const selectedEntries=()=>files.filter(entry=>selected.has(entry.id));
    const addFiles=(fileList)=>{
      const accepted=[...fileList].filter(file=>file.type.startsWith('image/')||/\.(jpe?g|png|gif|webp|svg)$/i.test(file.name));
      accepted.forEach(file=>{
        files.push({
          id:`capture-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
          name:file.name||'未命名图像',file,url:URL.createObjectURL(file),size:file.size,mime:file.type,
          vfsPath:'',rotation:0,importedPath:'',
        });
      });
      selected=new Set(accepted.length?files.slice(-accepted.length).map(entry=>entry.id):[]);
      selectionAnchor=files.length-1;
      currentDevice='browser';
      render();
      if(fileList.length&&!accepted.length)System.alertBox('图像捕捉','所选文件中没有浏览器可以读取的图像。');
    };
    const addVfsPaths=(paths)=>{
      const requested=Array.isArray(paths)?paths:[paths];
      const accepted=requested.map(path=>VFS.normalize(path)).filter(path=>{
        const node=VFS.get(path);
        return node?.type==='file'&&node.src&&(node.kind==='image'||/\.(jpe?g|png|gif|webp|svg)$/i.test(path));
      });
      accepted.forEach(path=>{
        const node=VFS.get(path);
        files.push({
          id:`capture-vfs-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
          name:VFS.baseName(path),file:null,url:node.src,size:VFS.sizeOf(path),mime:node.mime||'image/*',
          vfsPath:path,rotation:0,importedPath:'',
        });
      });
      selected=new Set(accepted.length?files.slice(-accepted.length).map(entry=>entry.id):[]);
      selectionAnchor=files.length-1;currentDevice='browser';render();
      if(requested.length&&!accepted.length)System.alertBox('图像捕捉','所选 Finder 项目中没有可读取的图像。');
    };
    const chooseFromFinder=()=>System.openPanel({
      parent:win,title:'从 Finder 添加图像',startPath:'/用户/roll/图片',
      types:['jpg','jpeg','png','gif','webp','svg'],allowMultiple:true,allowUpload:false,
      onOpen:(paths)=>addVfsPaths(paths),
    });
    const render=()=>{
      root.querySelectorAll('[data-device]').forEach(button=>button.classList.toggle('sel',button.dataset.device===currentDevice));
      grid.innerHTML='';
      if(!files.length){
        const empty=el('div','capture-empty');
        empty.innerHTML='<i>▧</i><b>没有图像</b><span>从 Finder 或本机添加图像，也可以拖到上方区域。</span>';
        grid.appendChild(empty);
      }else files.forEach((entry,index)=>{
        const item=el('button','capture-item'+(selected.has(entry.id)?' sel':'')+(entry.importedPath?' imported':''));
        item.dataset.id=entry.id;item.dataset.index=index;item.setAttribute('role','option');
        item.setAttribute('aria-selected',String(selected.has(entry.id)));
        const thumb=el('span','capture-thumb');
        const image=new Image();image.alt='';image.src=entry.url;image.style.transform=`rotate(${entry.rotation}deg)`;
        thumb.appendChild(image);
        if(entry.importedPath)thumb.appendChild(el('i','capture-imported-badge','✓'));
        const name=el('b','',entry.name);
        const metaParts=[];
        if(entry.size)metaParts.push(formatBytes(entry.size));
        if(entry.vfsPath)metaParts.push('Finder');
        if(entry.rotation)metaParts.push(`${entry.rotation}°`);
        const meta=el('small','',metaParts.join(' · ')||'0 字节');
        item.append(thumb,name,meta);grid.appendChild(item);
      });
      const count=selected.size;
      importButton.disabled=importing||!count;
      importAllButton.disabled=importing||!files.length;
      removeButton.disabled=importing||!count;
      rotateLeft.disabled=importing||!count;rotateRight.disabled=importing||!count;
      chooseButton.disabled=importing;finderButton.disabled=importing;revealButton.disabled=!lastImportDirectory;
      win.dataset.captureSelection=String(count);
      win.dataset.captureFiles=String(files.length);
      win.dataset.captureLastImport=String(!!lastImportDirectory);
      win._status.textContent=importing?'正在导入图像…':`浏览器文件 · ${files.length} 张图像${count?` · 已选择 ${count} 张`:''}`;
      notifyState();
    };
    const selectIndex=(index,event)=>{
      const entry=files[index];if(!entry)return;
      if(event?.shiftKey&&selectionAnchor!=null){
        selected=new Set();
        const start=Math.min(selectionAnchor,index),end=Math.max(selectionAnchor,index);
        for(let i=start;i<=end;i++)selected.add(files[i].id);
      }else if(event?.metaKey||event?.ctrlKey){
        if(selected.has(entry.id))selected.delete(entry.id);else selected.add(entry.id);
        selectionAnchor=index;
      }else{
        selected=new Set([entry.id]);selectionAnchor=index;
      }
      render();
    };
    const fileData=(entry)=>{
      if(!entry.file)return Promise.resolve(entry.url);
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(entry.file);
      });
    };
    const transformedData=async(entry)=>{
      const rotation=((entry.rotation%360)+360)%360;
      if(!rotation)return fileData(entry);
      const image=new Image();image.src=entry.url;
      if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
      const swap=rotation===90||rotation===270;
      const canvas=document.createElement('canvas');
      canvas.width=swap?image.naturalHeight:image.naturalWidth;
      canvas.height=swap?image.naturalWidth:image.naturalHeight;
      const context=canvas.getContext('2d');
      context.translate(canvas.width/2,canvas.height/2);
      context.rotate(rotation*Math.PI/180);
      context.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);
      return canvas.toDataURL('image/png');
    };
    const importEntries=async(items)=>{
      if(importing||!items.length)return;
      importing=true;render();
      const dir=destination.value;
      let imported=0,failed=0;
      for(let index=0;index<items.length;index++){
        const entry=items[index];
        win._status.textContent=`正在导入 ${index+1}/${items.length}：${entry.name}`;
        try{
          const rotated=!!(((entry.rotation%360)+360)%360);
          const data=await transformedData(entry);
          const originalExt=entry.name.match(/\.[^.]+$/)?.[0]||'.jpg';
          const extension=rotated?'.png':originalExt;
          const base=entry.name.replace(/\.[^.]+$/,'')||'导入的图像';
          const name=VFS.uniqueName(dir,base,extension);
          const path=`${dir}/${name}`;
          VFS.putNode(path,{type:'file',kind:'image',src:data,mime:rotated?'image/png':entry.mime,
            creator:'imagecapture',generated:true,createdAt:Date.now()});
          entry.importedPath=path;imported++;lastImportDirectory=dir;
        }catch(error){console.error('Image Capture import failed',error);failed++;}
      }
      if(removeAfter.checked){
        const importedIds=new Set(items.filter(entry=>entry.importedPath).map(entry=>entry.id));
        files.forEach(entry=>{if(importedIds.has(entry.id))release(entry);});
        files=files.filter(entry=>!importedIds.has(entry.id));
        selected=new Set();selectionAnchor=null;
      }
      importing=false;render();
      Leopard.toast('图像捕捉',failed?`已导入 ${imported} 张图像，${failed} 张失败。`:`已导入 ${imported} 张图像到“${VFS.baseName(dir)}”。`);
    };
    const removeSelected=()=>{
      if(!selected.size)return;
      files.forEach(entry=>{if(selected.has(entry.id))release(entry);});
      files=files.filter(entry=>!selected.has(entry.id));selected=new Set();selectionAnchor=null;render();
    };
    const rotateSelected=(amount)=>{
      if(!selected.size)return;
      files.forEach(entry=>{if(selected.has(entry.id))entry.rotation=(entry.rotation+amount+360)%360;});
      render();
    };
    const previewSelected=async()=>{
      const entry=selectedEntries()[0];if(!entry)return;
      try{
        const data=await transformedData(entry);
        System.launch('preview',{src:data,name:entry.name,mime:entry.rotation?'image/png':entry.mime,size:entry.size});
      }catch(error){System.alertBox('图像捕捉','无法预览所选图像。');}
    };
    const revealImports=()=>{
      if(lastImportDirectory)System.launch('finder',{path:lastImportDirectory,forceNew:true});
    };

    win=System.createWindow({
      app:'imagecapture',title:'图像捕捉',width:820,height:560,toolbar,content:root,statusbar:'浏览器文件 · 0 张图像',
      onClose:()=>{files.forEach(release);return true;},
    });
    chooseButton.addEventListener('click',()=>input.click());
    finderButton.addEventListener('click',chooseFromFinder);
    input.addEventListener('change',()=>{addFiles(input.files);input.value='';});
    ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging');}));
    ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{
      event.preventDefault();drop.classList.remove('dragging');if(type==='drop'&&event.dataTransfer?.files)addFiles(event.dataTransfer.files);
    }));
    drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click();}});
    root.querySelector('aside').addEventListener('click',event=>{
      const button=event.target.closest('[data-device]');if(!button)return;
      currentDevice=button.dataset.device;render();
      if(currentDevice==='browser')input.click();
      else if(currentDevice==='isight')System.launch('photobooth');
      else System.alertBox('图像捕捉','没有检测到已连接的 iPhone。连接设备后，它会显示在此列表中。');
    });
    grid.addEventListener('click',event=>{const item=event.target.closest('[data-index]');if(item)selectIndex(Number(item.dataset.index),event);});
    grid.addEventListener('dblclick',event=>{if(event.target.closest('[data-index]'))previewSelected();});
    importButton.addEventListener('click',()=>importEntries(selectedEntries()));
    importAllButton.addEventListener('click',()=>importEntries(files.slice()));
    removeButton.addEventListener('click',removeSelected);
    rotateLeft.addEventListener('click',()=>rotateSelected(-90));rotateRight.addEventListener('click',()=>rotateSelected(90));
    revealButton.addEventListener('click',revealImports);
    win.addEventListener('leopard-command',event=>{
      const actions={
        'choose-files':()=>input.click(),'add-vfs-images':chooseFromFinder,'import-selection':()=>importEntries(selectedEntries()),
        'import-all':()=>importEntries(files.slice()),'delete':removeSelected,
        'selectAll':()=>{selected=new Set(files.map(entry=>entry.id));render();},
        'rotate-left':()=>rotateSelected(-90),'rotate-right':()=>rotateSelected(90),
        'preview-selection':previewSelected,'reveal-imports':revealImports,
      };
      const action=actions[event.detail?.command];if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'imagecapture',name:'图像捕捉',icon:captureIcon,open:openImageCapture,about:'从浏览器文件导入照片到 Finder 图片或桌面文件夹。',keywords:'image capture import camera 图像捕捉 导入'});

  // ---------- Front Row ----------
  const frontIcon=icon('fr','#1f222a','#020304','<path d="M14 18h36v28H14z" fill="#111" stroke="#fff" stroke-width="2"/><path d="m27 25 14 7-14 7z" fill="#fff" stroke="none"/><path d="M19 51h26" stroke="#aaa" stroke-width="3"/>');
  let frontLayer=null;
  let frontKeyHandler=null;
  function closeFrontRow(){
    if(frontKeyHandler){document.removeEventListener('keydown',frontKeyHandler,true);frontKeyHandler=null;}
    if(!frontLayer)return;
    const layer=frontLayer;
    frontLayer=null;
    layer.classList.remove('on');
    layer.setAttribute('aria-hidden','true');
    setTimeout(()=>layer.remove(),300);
  }
  function openFrontRow(){
    if(frontLayer){closeFrontRow();return;}
    const destinations=[
      {app:'itunes',glyph:'♫',label:'音乐',detail:'浏览 iTunes 资料库'},
      {app:'quicktime',glyph:'▶',label:'影片',detail:'播放 Finder 中的影片'},
      {app:'photobooth',glyph:'▣',label:'照片',detail:'打开 Photo Booth 照片'},
      {app:'dvdplayer',glyph:'DVD',label:'DVD',detail:'进入 DVD 菜单'},
    ];
    const root=el('div','frontrow-layer');
    root.tabIndex=-1;
    root.setAttribute('role','dialog');
    root.setAttribute('aria-label','Front Row');
    root.innerHTML=`<div class="frontrow-logo"> <b>Front Row</b></div><main>${destinations.map((item,index)=>`<button data-app="${item.app}" data-index="${index}" aria-label="${item.label}，${item.detail}"><i>${item.glyph}</i><span>${item.label}</span><small>${item.detail}</small></button>`).join('')}</main><footer><b class="frontrow-current"></b><span>方向键浏览 · Return 进入 · Esc 返回桌面</span></footer>`;
    const buttons=[...root.querySelectorAll('main button')];
    const current=root.querySelector('.frontrow-current');
    let selected=0;
    const select=(next,focus=false)=>{
      selected=(Number(next)+buttons.length)%buttons.length;
      buttons.forEach((button,index)=>{
        const active=index===selected;
        button.classList.toggle('selected',active);
        button.setAttribute('aria-selected',String(active));
        button.tabIndex=active?0:-1;
      });
      current.textContent=destinations[selected].detail;
      if(focus)buttons[selected].focus({preventScroll:true});
    };
    const launchSelected=()=>{
      const app=destinations[selected].app;
      closeFrontRow();
      System.launch(app);
    };
    root.addEventListener('click',event=>{
      const button=event.target.closest('[data-app]');
      if(!button)return;
      select(Number(button.dataset.index));
      launchSelected();
    });
    buttons.forEach((button,index)=>{
      button.addEventListener('mouseenter',()=>select(index));
      button.addEventListener('focus',()=>select(index));
    });
    frontKeyHandler=event=>{
      if(!frontLayer)return;
      if(['ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();select(selected-1,true);}
      else if(['ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();select(selected+1,true);}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();launchSelected();}
      else if(event.key==='Escape'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();closeFrontRow();}
      else if(event.key==='Home'){event.preventDefault();select(0,true);}
      else if(event.key==='End'){event.preventDefault();select(buttons.length-1,true);}
    };
    document.addEventListener('keydown',frontKeyHandler,true);
    document.body.appendChild(root);
    frontLayer=root;
    select(0);
    requestAnimationFrame(()=>{root.classList.add('on');buttons[0].focus({preventScroll:true});});
  }
  System.registerApp({id:'frontrow',name:'Front Row',icon:frontIcon,open:openFrontRow,about:'全屏 Apple Remote 风格媒体中心，连接音乐、影片、照片和 DVD。',keywords:'front row media center 媒体中心'});

  // ---------- Utilities ----------
  const keyIcon=icon('key','#d4d7dd','#797f89','<circle cx="25" cy="28" r="11" fill="none" stroke="#fff" stroke-width="5"/><path d="m33 36 15 15M41 44l5-5M45 48l5-5" fill="none" stroke="#fff" stroke-width="5"/>');
  const KEYCHAIN_ITEMS_KEY='macweb.keychain.items.v1';
  const DEFAULT_KEYCHAIN_ITEMS=[
    {id:'kc-safari',keychain:'login',name:'Safari 自动填充',kind:'应用程序密码',category:'password',account:'roll',where:'Safari',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-web',keychain:'login',name:'Leopard Web',kind:'互联网密码',category:'password',account:'roll',where:'https://leopard.local/',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-airport',keychain:'System',name:'Leopard Web',kind:'AirPort 网络密码',category:'password',account:'AirPort',where:'Leopard Web',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-apple-root',keychain:'System Roots',name:'Apple Root CA',kind:'证书',category:'certificate',account:'Apple Inc.',where:'系统信任根',created:'2006-04-25',modified:'2007-05-14'},
    {id:'kc-class3',keychain:'System Roots',name:'Apple Computer, Inc. Root Certificate Authority',kind:'证书',category:'certificate',account:'Apple Computer, Inc.',where:'系统信任根',created:'2006-04-25',modified:'2007-05-14'},
  ];
  function openKeychain(){
    let entries=jsonStore(KEYCHAIN_ITEMS_KEY,DEFAULT_KEYCHAIN_ITEMS)
      .filter(item=>item&&item.id&&item.name)
      .map(item=>({
        id:String(item.id),keychain:['login','System','System Roots'].includes(item.keychain)?item.keychain:'login',
        name:String(item.name),kind:String(item.kind||'应用程序密码'),
        category:item.category==='certificate'?'certificate':'password',
        account:String(item.account||''),where:String(item.where||''),
        created:String(item.created||'2007-10-26'),modified:String(item.modified||item.created||'2007-10-26'),
        userCreated:!!item.userCreated,
      }));
    let currentKeychain='login',currentCategory='all',selectedId=null,query='';
    let sortKey='name',sortAscending=true,locked=true,win=null;
    const toolbar=el('div','keychain-toolbar');
    const newItem=el('button','finder-toolbar-btn','＋ 新建项目');
    newItem.dataset.command='new-item';
    const lockButton=el('button','finder-toolbar-btn','解锁');
    lockButton.dataset.command='toggle-lock';
    const infoButton=el('button','finder-toolbar-btn','显示简介');
    infoButton.dataset.command='show-item-info';
    const deleteButton=el('button','finder-toolbar-btn','删除');
    deleteButton.dataset.command='delete';
    const toolbarSpacer=el('i');
    const search=el('input','aqua-input aqua-search');
    search.type='search';search.placeholder='搜索钥匙串';search.setAttribute('aria-label','搜索钥匙串');
    toolbar.append(newItem,lockButton,infoButton,deleteButton,toolbarSpacer,search);

    const root=el('div','keychain-app');
    root.innerHTML=`<aside>
      <h4>钥匙串</h4>
      <button data-keychain="login"><span>🔐</span> login</button>
      <button data-keychain="System"><span>🔒</span> System</button>
      <button data-keychain="System Roots"><span>📜</span> System Roots</button>
      <h4>类别</h4>
      <button data-category="all"><span>▦</span> 所有项目</button>
      <button data-category="password"><span>🔑</span> 密码</button>
      <button data-category="certificate"><span>✓</span> 证书</button>
    </aside><main>
      <header>
        <button data-sort="name">名称</button>
        <button data-sort="kind">种类</button>
        <button data-sort="keychain">钥匙串</button>
      </header>
      <div class="keychain-list" role="listbox" aria-label="钥匙串项目"></div>
      <article class="keychain-detail"></article>
    </main>`;
    const list=root.querySelector('.keychain-list'),detail=root.querySelector('.keychain-detail');
    const selectedEntry=()=>entries.find(item=>item.id===selectedId)||null;
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{detail:{appId:'keychain'}}));
    const visibleEntries=()=>{
      const needle=query.trim().toLocaleLowerCase();
      return entries.filter(item=>item.keychain===currentKeychain
        &&(currentCategory==='all'||item.category===currentCategory)
        &&(!needle||`${item.name} ${item.kind} ${item.account} ${item.where}`.toLocaleLowerCase().includes(needle)))
        .sort((a,b)=>{
          const result=String(a[sortKey]||'').localeCompare(String(b[sortKey]||''),'zh-CN',{sensitivity:'base'});
          return sortAscending?result:-result;
        });
    };
    const render=()=>{
      root.querySelectorAll('[data-keychain]').forEach(button=>button.classList.toggle('sel',button.dataset.keychain===currentKeychain));
      root.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('sel',button.dataset.category===currentCategory));
      root.querySelectorAll('[data-sort]').forEach(button=>{
        const active=button.dataset.sort===sortKey;
        button.classList.toggle('active',active);
        button.dataset.direction=active?(sortAscending?'ascending':'descending'):'';
      });
      const visible=visibleEntries();
      if(selectedId&&!visible.some(item=>item.id===selectedId))selectedId=null;
      list.innerHTML='';
      if(!visible.length){
        const empty=el('div','keychain-empty');
        empty.innerHTML='<b>没有项目</b><span>更改钥匙串、类别或搜索条件。</span>';
        list.appendChild(empty);
      }else visible.forEach(item=>{
        const row=el('button','keychain-row'+(item.id===selectedId?' sel':''));
        row.dataset.id=item.id;row.setAttribute('role','option');row.setAttribute('aria-selected',String(item.id===selectedId));
        row.innerHTML=`<span><i>${item.category==='certificate'?'📜':'🔑'}</i>${esc(item.name)}</span><span>${esc(item.kind)}</span><span>${esc(item.keychain)}</span>`;
        list.appendChild(row);
      });
      const item=selectedEntry();
      if(item){
        detail.innerHTML=`<div class="keychain-detail-icon">${item.category==='certificate'?'📜':'🔑'}</div>
          <div><b>${esc(item.name)}</b><p>${esc(item.kind)} · ${esc(item.keychain)}</p>
          <dl><dt>账户</dt><dd>${esc(item.account)||'—'}</dd><dt>位置</dt><dd>${esc(item.where)||'—'}</dd>
          <dt>修改日期</dt><dd>${esc(item.modified)}</dd><dt>访问</dt><dd>${locked?'钥匙串已锁定':'本次会话已解锁'}</dd></dl></div>`;
      }else{
        detail.innerHTML=`<div class="keychain-detail-icon">${locked?'🔒':'🔓'}</div><div><b>${esc(currentKeychain)}</b>
          <p>${locked?'钥匙串已锁定。双击项目可查看公开属性。':'钥匙串已在本次会话中解锁。'}</p>
          <small>这里仅保存 Leopard 模拟项目的名称和属性，不会读取浏览器、系统或网站中的真实密码。</small></div>`;
      }
      lockButton.textContent=locked?'解锁':'锁定';
      infoButton.disabled=!item;
      deleteButton.disabled=!item;
      win.dataset.keychainLocked=String(locked);
      win.dataset.keychainSelection=item?'true':'false';
      win._status.textContent=`${currentKeychain} · ${visible.length} 个项目 · ${locked?'已锁定':'已解锁'}`;
      notifyState();
    };
    const persist=()=>{
      save(KEYCHAIN_ITEMS_KEY,entries);
      render();
    };
    const toggleLock=()=>{
      if(!locked){
        locked=true;render();Leopard.toast('钥匙串访问',`${currentKeychain} 已锁定。`);return;
      }
      System.confirmSheet({
        parent:win,headline:`解锁“${currentKeychain}”钥匙串？`,
        message:'网页版不会要求或读取您的系统密码。此操作只会在当前会话中解锁模拟项目的详细视图。',
        okLabel:'解锁',onOK:()=>{locked=false;render();Leopard.toast('钥匙串访问',`${currentKeychain} 已解锁。`);},
      });
    };
    const showInfo=()=>{
      const item=selectedEntry();if(!item)return;
      const pane=el('div','keychain-info-sheet');
      pane.innerHTML=`<div class="keychain-info-heading"><i>${item.category==='certificate'?'📜':'🔑'}</i><div><b>${esc(item.name)}</b><span>${esc(item.kind)}</span></div></div>
        <dl><dt>钥匙串：</dt><dd>${esc(item.keychain)}</dd><dt>账户：</dt><dd>${esc(item.account)||'—'}</dd>
        <dt>位置：</dt><dd>${esc(item.where)||'—'}</dd><dt>创建日期：</dt><dd>${esc(item.created)}</dd>
        <dt>修改日期：</dt><dd>${esc(item.modified)}</dd></dl>
        ${item.category==='password'?`<label class="spp-check"><input type="checkbox" class="keychain-show-secret" ${locked?'disabled':''}> 显示密码</label>
        <output class="keychain-secret">${locked?'钥匙串已锁定':'••••••••••••'}</output>`:'<p class="keychain-certificate-state">✓ 此证书由系统信任根签发。</p>'}
        <p class="keychain-security-note">安全说明：模拟器从不读取或保存真实密码；解锁只影响此窗口的显示状态。</p>`;
      const reveal=pane.querySelector('.keychain-show-secret');
      reveal?.addEventListener('change',()=>{
        pane.querySelector('.keychain-secret').textContent=reveal.checked?'（模拟项目未保存真实密码）':'••••••••••••';
      });
      System.showSheet({
        parent:win,title:'项目简介',content:pane,className:'keychain-info-dialog',
        buttons:[{label:'好',default:true}],
      });
    };
    const addItem=()=>{
      const form=el('div','keychain-new-sheet');
      form.innerHTML=`<p>建立新的模拟钥匙串项目。请勿在此输入真实密码。</p>
        <label><span>名称：</span><input class="aqua-input item-name" autocomplete="off"></label>
        <label><span>账户：</span><input class="aqua-input item-account" autocomplete="off"></label>
        <label><span>位置：</span><input class="aqua-input item-where" autocomplete="off"></label>
        <label><span>种类：</span><select class="aqua-select item-kind"><option value="internet">互联网密码</option><option value="application">应用程序密码</option><option value="network">网络密码</option><option value="certificate">证书</option></select></label>
        <label><span>钥匙串：</span><select class="aqua-select item-keychain"><option>login</option><option>System</option><option>System Roots</option></select></label>
        <div class="aqua-sheet-error"></div>`;
      form.querySelector('.item-keychain').value=currentKeychain;
      const nameField=form.querySelector('.item-name');
      System.showSheet({
        parent:win,title:'新建钥匙串项目',content:form,className:'keychain-new-dialog',initialFocus:nameField,
        buttons:[
          {label:'取消',cancel:true},
          {label:'添加',default:true,action:()=>{
            const name=nameField.value.trim(),kindValue=form.querySelector('.item-kind').value;
            if(!name){form.querySelector('.aqua-sheet-error').textContent='请输入项目名称。';nameField.focus();return false;}
            const kinds={internet:'互联网密码',application:'应用程序密码',network:'网络密码',certificate:'证书'};
            const keychain=form.querySelector('.item-keychain').value;
            const now=new Date().toLocaleDateString('sv-SE');
            const item={id:`kc-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,keychain,name,
              kind:kinds[kindValue],category:kindValue==='certificate'?'certificate':'password',
              account:form.querySelector('.item-account').value.trim(),where:form.querySelector('.item-where').value.trim(),
              created:now,modified:now,userCreated:true};
            entries.push(item);currentKeychain=keychain;currentCategory='all';selectedId=item.id;persist();
          }},
        ],
      });
    };
    const removeItem=()=>{
      const item=selectedEntry();if(!item)return;
      System.confirmSheet({
        parent:win,headline:`删除“${item.name}”？`,
        message:'这只会删除模拟器中的项目属性，不会影响浏览器或 macOS 钥匙串。',
        okLabel:'删除',danger:true,onOK:()=>{entries=entries.filter(entry=>entry.id!==item.id);selectedId=null;persist();},
      });
    };

    win=System.createWindow({app:'keychain',title:'钥匙串访问',width:800,height:540,toolbar,content:root,statusbar:'正在载入钥匙串…'});
    root.querySelector('aside').addEventListener('click',event=>{
      const keychain=event.target.closest('[data-keychain]'),category=event.target.closest('[data-category]');
      if(keychain){currentKeychain=keychain.dataset.keychain;selectedId=null;render();}
      if(category){currentCategory=category.dataset.category;selectedId=null;render();}
    });
    root.querySelector('main>header').addEventListener('click',event=>{
      const button=event.target.closest('[data-sort]');if(!button)return;
      if(sortKey===button.dataset.sort)sortAscending=!sortAscending;
      else{sortKey=button.dataset.sort;sortAscending=true;}
      render();
    });
    list.addEventListener('click',event=>{const row=event.target.closest('[data-id]');if(row){selectedId=row.dataset.id;render();}});
    list.addEventListener('dblclick',event=>{if(event.target.closest('[data-id]'))showInfo();});
    search.addEventListener('input',()=>{query=search.value;selectedId=null;render();});
    newItem.addEventListener('click',addItem);lockButton.addEventListener('click',toggleLock);
    infoButton.addEventListener('click',showInfo);deleteButton.addEventListener('click',removeItem);
    win.addEventListener('leopard-command',event=>{
      const actions={
        'new-item':addItem,'toggle-lock':toggleLock,'show-item-info':showInfo,'delete':removeItem,
        'show-all':()=>{currentCategory='all';selectedId=null;render();},
        'show-passwords':()=>{currentCategory='password';selectedId=null;render();},
        'show-certificates':()=>{currentCategory='certificate';selectedId=null;render();},
        'focus-search':()=>{search.focus();search.select();},
      };
      const action=actions[event.detail?.command];if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'keychain',name:'钥匙串访问',icon:keyIcon,open:openKeychain,about:'钥匙串、证书和访问控制界面；不接触真实凭据。',keywords:'keychain password certificate 钥匙串 密码 证书'});

  const grabIcon=icon('grab','#7c8797','#333943','<path d="M16 15h32v34H16z" fill="#eaf2fa" stroke="#fff" stroke-width="1.5"/><path d="M24 24h16v16H24z" fill="#54769a"/><path d="M12 23v-9h9M52 23v-9h-9M12 41v9h9M52 41v9h-9" fill="none" stroke="#fff" stroke-width="2.5"/>');
  function openGrab(){
    const modes={
      selection:{icon:'⌗',name:'选择区域',action:'选择屏幕并捕捉',description:'先在浏览器面板中选择屏幕或窗口，再在图像上拖出需要保留的区域。'},
      window:{icon:'▣',name:'窗口',action:'选择窗口并捕捉',description:'浏览器的共享面板负责选择一个窗口；抓图只读取您明确授权的画面。'},
      screen:{icon:'▤',name:'屏幕',action:'选择屏幕并捕捉',description:'捕捉浏览器共享面板中选择的整个屏幕、窗口或标签页。'},
      timed:{icon:'◷',name:'定时屏幕',action:'开始 10 秒计时',description:'先授权共享来源，再等待 10 秒；计时结束时自动捕捉当前画面。'},
    };
    const root=el('div','grab-app');
    root.innerHTML=`<aside>
      <header><i>${grabIcon}</i><span><b>抓图</b><small>捕捉模式</small></span></header>
      <nav aria-label="捕捉模式">${Object.entries(modes).map(([id,item])=>`<button data-mode="${id}"><i>${item.icon}</i><span><b>${item.name}</b><small>${item.description}</small></span></button>`).join('')}</nav>
      <section><b>浏览器安全边界</b><p>每次捕捉都由浏览器显示系统授权面板；抓图无法绕过授权读取真实桌面。</p></section>
    </aside>
    <main>
      <header><span><b class="grab-document-title">尚未捕捉图像</b><small class="grab-document-meta">选择一种模式后开始捕捉</small></span><button class="aqua-btn grab-save" disabled>存储…</button></header>
      <div class="grab-stage" tabindex="0" aria-label="抓图预览">
        <div class="grab-placeholder"><i>${grabIcon}</i><b>准备抓图</b><span></span></div>
        <img class="grab-image" alt="抓图预览" hidden>
        <div class="grab-crop" hidden><span></span></div>
        <div class="grab-countdown" hidden><b></b><span>秒后捕捉</span></div>
      </div>
      <footer>
        <button class="aqua-btn default grab-capture"></button>
        <button class="aqua-btn grab-apply-crop" hidden disabled>使用选择区域</button>
        <span class="grab-status">就绪</span>
        <button class="aqua-btn grab-preview" disabled>在预览中打开</button>
        <button class="aqua-btn grab-reveal" disabled>在 Finder 中显示</button>
      </footer>
    </main>`;
    const modeButtons=[...root.querySelectorAll('[data-mode]')];
    const documentTitle=root.querySelector('.grab-document-title');
    const documentMeta=root.querySelector('.grab-document-meta');
    const saveButton=root.querySelector('.grab-save');
    const stage=root.querySelector('.grab-stage');
    const placeholder=root.querySelector('.grab-placeholder');
    const placeholderText=placeholder.querySelector('span');
    const image=root.querySelector('.grab-image');
    const cropBox=root.querySelector('.grab-crop');
    const countdown=root.querySelector('.grab-countdown');
    const countdownNumber=countdown.querySelector('b');
    const captureButton=root.querySelector('.grab-capture');
    const cropButton=root.querySelector('.grab-apply-crop');
    const previewButton=root.querySelector('.grab-preview');
    const revealButton=root.querySelector('.grab-reveal');
    const status=root.querySelector('.grab-status');
    let win=null;
    let mode='selection';
    let current=null;
    let pendingCrop=null;
    let dragStart=null;
    let busy=false;
    let captureToken=0;
    let stream=null;
    let closePrompt=null;
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
    const captureName=()=>{
      const now=new Date();
      const day=now.toLocaleDateString('sv-SE');
      const time=now.toLocaleTimeString('zh-CN',{hour12:false}).replace(/:/g,'.');
      return `屏幕快照 ${day} ${time}.png`;
    };
    const stopStream=()=>{
      stream?.getTracks?.().forEach(track=>track.stop());
      stream=null;
    };
    const setDirty=(value)=>{
      if(!win)return;
      win._documentDirty=Boolean(value);
      win.classList.toggle('document-dirty',win._documentDirty);
    };
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.grabHasCapture=String(Boolean(current));
      win.dataset.grabSaved=String(Boolean(current?.path));
      win.dataset.grabBusy=String(busy);
      win.dataset.grabMode=mode;
      win.dataset.grabCanCrop=String(Boolean(pendingCrop));
      root.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
    };
    const updateUI=()=>{
      const info=modes[mode];
      modeButtons.forEach(button=>button.classList.toggle('sel',button.dataset.mode===mode));
      placeholderText.textContent=info.description;
      captureButton.textContent=busy?'取消捕捉':`${info.action}…`;
      captureButton.classList.toggle('danger',busy);
      captureButton.disabled=false;
      saveButton.disabled=!current||busy;
      previewButton.disabled=!current||busy;
      revealButton.disabled=!current?.path||busy;
      cropButton.hidden=mode!=='selection'||!current;
      cropButton.disabled=!pendingCrop||busy;
      if(current){
        documentTitle.textContent=current.path?VFS.baseName(current.path):'未命名抓图';
        documentMeta.textContent=`${current.width} × ${current.height} 像素 · PNG${current.path?' · 已存储':' · 尚未存储'}`;
      }else{
        documentTitle.textContent='尚未捕捉图像';
        documentMeta.textContent=`${info.name} · ${info.description}`;
      }
      updateWindowState();
    };
    const displayRect=()=>{
      if(!current||image.hidden||!image.clientWidth||!image.clientHeight)return null;
      const box=image.getBoundingClientRect();
      const scale=Math.min(box.width/current.width,box.height/current.height);
      const width=current.width*scale,height=current.height*scale;
      return {left:box.left+(box.width-width)/2,top:box.top+(box.height-height)/2,width,height,scale};
    };
    const drawCrop=()=>{
      if(!pendingCrop){cropBox.hidden=true;return;}
      const shown=displayRect(),stageBox=stage.getBoundingClientRect();
      if(!shown)return;
      cropBox.hidden=false;
      cropBox.style.left=`${shown.left-stageBox.left+pendingCrop.x*shown.scale}px`;
      cropBox.style.top=`${shown.top-stageBox.top+pendingCrop.y*shown.scale}px`;
      cropBox.style.width=`${pendingCrop.width*shown.scale}px`;
      cropBox.style.height=`${pendingCrop.height*shown.scale}px`;
      cropBox.querySelector('span').textContent=`${Math.round(pendingCrop.width)} × ${Math.round(pendingCrop.height)}`;
    };
    const showCurrent=()=>{
      if(!current){
        image.hidden=true;placeholder.hidden=false;cropBox.hidden=true;updateUI();return;
      }
      placeholder.hidden=true;image.hidden=false;image.src=current.src;
      image.onload=()=>{drawCrop();updateUI();};
      updateUI();
    };
    const acceptCapture=(src,width,height)=>{
      current={src,width,height,path:null};
      pendingCrop=null;
      setDirty(true);
      status.textContent=mode==='selection'?'在预览中拖动以选择保留区域。':'捕捉完成；请存储图像。';
      showCurrent();
      if(mode==='selection')requestAnimationFrame(()=>stage.focus());
    };
    const cancelCapture=()=>{
      if(!busy)return;
      captureToken++;
      stopStream();
      countdown.hidden=true;
      busy=false;
      status.textContent='捕捉已取消。';
      updateUI();
    };
    const takeCapture=async()=>{
      if(busy){cancelCapture();return;}
      if(!navigator.mediaDevices?.getDisplayMedia){
        System.alertBox('抓图','此浏览器不支持屏幕捕捉 API。');
        return;
      }
      busy=true;
      const token=++captureToken;
      status.textContent='正在等待浏览器授权…';
      updateUI();
      const endBusy=System.beginBusy(180);
      const video=document.createElement('video');
      video.muted=true;video.playsInline=true;
      try{
        stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30}},audio:false});
        if(token!==captureToken){stopStream();return;}
        video.srcObject=stream;
        await video.play();
        for(let attempt=0;attempt<30&&!video.videoWidth;attempt++)await wait(50);
        if(!video.videoWidth||!video.videoHeight)throw new Error('共享画面没有可读取的尺寸');
        if(mode==='timed'){
          countdown.hidden=false;
          for(let seconds=10;seconds>0;seconds--){
            if(token!==captureToken)return;
            countdownNumber.textContent=String(seconds);
            status.textContent=`定时捕捉：${seconds} 秒`;
            await wait(1000);
          }
          countdown.hidden=true;
        }else await wait(180);
        if(token!==captureToken)return;
        const canvas=document.createElement('canvas');
        canvas.width=video.videoWidth;canvas.height=video.videoHeight;
        const context=canvas.getContext('2d',{alpha:false});
        context.drawImage(video,0,0,canvas.width,canvas.height);
        acceptCapture(canvas.toDataURL('image/png'),canvas.width,canvas.height);
        Leopard.toast('抓图','捕捉完成。可存储到虚拟磁盘。');
      }catch(error){
        if(token!==captureToken)return;
        status.textContent='未捕捉图像。';
        System.alertBox('抓图',error?.name==='NotAllowedError'?'屏幕捕捉已取消，或浏览器未授予权限。':`无法捕捉屏幕：${error?.message||'未知错误'}。`);
      }finally{
        stopStream();
        video.srcObject=null;
        countdown.hidden=true;
        if(token===captureToken)busy=false;
        endBusy();
        updateUI();
      }
    };
    const applyCrop=async()=>{
      if(!current||!pendingCrop)return;
      const crop=pendingCrop;
      const source=new Image();
      source.src=current.src;
      try{
        await source.decode();
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(crop.width));
        canvas.height=Math.max(1,Math.round(crop.height));
        canvas.getContext('2d',{alpha:false}).drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
        current={src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,path:null};
        pendingCrop=null;
        setDirty(true);
        status.textContent='已裁切到选择区域；请存储图像。';
        showCurrent();
      }catch(error){System.alertBox('抓图','无法裁切所选区域。');}
    };
    const writeCapture=(path)=>{
      if(!current)return false;
      path=VFS.normalize(path);
      const ok=VFS.putNode(path,{type:'file',kind:'image',src:current.src,mime:'image/png',creator:'grab',generated:true,width:current.width,height:current.height});
      if(!ok){System.alertBox('抓图','无法存储图像。浏览器存储空间可能已满。');return false;}
      current.path=path;
      setDirty(false);
      System.addRecentDocument?.(path,'preview');
      Leopard.toast('抓图',`已存储“${VFS.baseName(path)}”。`);
      updateUI();
      return true;
    };
    const saveCapture=(saveAs=false,onSaved)=>{
      if(!current)return false;
      if(current.path&&!saveAs){
        const ok=writeCapture(current.path);
        if(ok)onSaved?.();
        return ok;
      }
      const directory=current.path?VFS.parentOf(current.path):'/用户/roll/桌面';
      System.savePanel({
        parent:win,title:'存储抓图',startPath:directory,
        name:current.path?VFS.baseName(current.path):VFS.uniqueName(directory,captureName().replace(/\.png$/,''),'.png'),
        extension:'png',typeLabel:'PNG 图像',allowOverwrite:true,
        onSave:path=>{const ok=writeCapture(path);if(ok)onSaved?.();return ok;},
      });
      return false;
    };
    const openPreview=()=>{
      if(!current)return;
      if(current.path)System.openVfsPath(current.path);
      else System.launch('preview',{src:current.src,name:'未命名抓图.png',kind:'image'});
    };
    const reveal=()=>{if(current?.path)System.launch('finder',{path:VFS.parentOf(current.path)});};
    const download=()=>{if(current?.path)System.downloadVfsFile(current.path);};
    const copyImage=async()=>{
      if(!current)return;
      try{
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('此浏览器不支持图像剪贴板');
        const blob=await fetch(current.src).then(response=>response.blob());
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        Leopard.toast('抓图','图像已复制到真实剪贴板。');
      }catch(error){System.alertBox('抓图',`${error.message}。可先存储图像，再从 Finder 下载。`);}
    };
    const setMode=(next)=>{
      if(!modes[next]||busy)return;
      mode=next;
      pendingCrop=null;
      cropBox.hidden=true;
      status.textContent=`已选择“${modes[mode].name}”模式。`;
      updateUI();
    };
    const finishClose=()=>setTimeout(()=>{if(win?.isConnected)System.closeWindow(win);},170);
    const resizeHandler=()=>drawCrop();

    win=System.createWindow({
      app:'grab',title:'抓图',width:840,height:570,content:root,bodyBg:'#ececec',
      onClose:(targetWindow,context)=>{
        cancelCapture();
        if(context.force||!targetWindow._documentDirty){
          window.removeEventListener('resize',resizeHandler);
          return true;
        }
        if(closePrompt?.shield.isConnected)return false;
        const body=el('div','grab-save-warning');
        body.innerHTML=`<i>${grabIcon}</i><section><h3>要存储这幅抓图吗？</h3><p>如果不存储，捕捉的图像将会丢失。</p></section>`;
        closePrompt=System.showSheet({
          parent:targetWindow,content:body,className:'grab-save-warning-sheet',
          buttons:[
            {label:'取消',cancel:true},
            {label:'不存储',danger:true,action:()=>{setDirty(false);finishClose();}},
            {label:'存储',default:true,action:()=>setTimeout(()=>saveCapture(false,finishClose),170)},
          ],
          onClose:()=>{closePrompt=null;},
        });
        return false;
      },
    });
    win._documentDirty=false;
    updateUI();

    modeButtons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
    captureButton.addEventListener('click',takeCapture);
    saveButton.addEventListener('click',()=>saveCapture(false));
    cropButton.addEventListener('click',applyCrop);
    previewButton.addEventListener('click',openPreview);
    revealButton.addEventListener('click',reveal);
    stage.addEventListener('pointerdown',event=>{
      if(mode!=='selection'||!current||busy)return;
      const shown=displayRect();
      if(!shown)return;
      const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
      const x=clamp(event.clientX,shown.left,shown.left+shown.width);
      const y=clamp(event.clientY,shown.top,shown.top+shown.height);
      if(event.clientX<shown.left||event.clientX>shown.left+shown.width||event.clientY<shown.top||event.clientY>shown.top+shown.height)return;
      dragStart={x,y,shown,pointerId:event.pointerId};
      pendingCrop=null;cropBox.hidden=true;
      stage.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    stage.addEventListener('pointermove',event=>{
      if(!dragStart||event.pointerId!==dragStart.pointerId)return;
      const shown=dragStart.shown;
      const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
      const x=clamp(event.clientX,shown.left,shown.left+shown.width);
      const y=clamp(event.clientY,shown.top,shown.top+shown.height);
      const left=Math.min(dragStart.x,x),top=Math.min(dragStart.y,y);
      const width=Math.abs(x-dragStart.x),height=Math.abs(y-dragStart.y);
      pendingCrop={
        x:(left-shown.left)/shown.scale,y:(top-shown.top)/shown.scale,
        width:width/shown.scale,height:height/shown.scale,
      };
      drawCrop();updateUI();
    });
    const endCrop=event=>{
      if(!dragStart||event.pointerId!==dragStart.pointerId)return;
      stage.releasePointerCapture?.(event.pointerId);
      dragStart=null;
      if(!pendingCrop||pendingCrop.width<8||pendingCrop.height<8){pendingCrop=null;cropBox.hidden=true;}
      else status.textContent='选择区域已准备好；点按“使用选择区域”完成裁切。';
      updateUI();
    };
    stage.addEventListener('pointerup',endCrop);
    stage.addEventListener('pointercancel',endCrop);
    window.addEventListener('resize',resizeHandler);
    win.addEventListener('leopard-command',event=>{
      const commands={
        'capture-selection':()=>{setMode('selection');takeCapture();},
        'capture-window':()=>{setMode('window');takeCapture();},
        'capture-screen':()=>{setMode('screen');takeCapture();},
        'capture-timed':()=>{setMode('timed');takeCapture();},
        'capture':takeCapture,'cancel-capture':cancelCapture,
        'save':()=>saveCapture(false),'save-as':()=>saveCapture(true),
        'copy':copyImage,'apply-crop':applyCrop,'open-preview':openPreview,
        'reveal-capture':reveal,'download-capture':download,
      };
      const action=commands[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    return win;
  }
  System.registerApp({id:'grab',name:'抓图',icon:grabIcon,open:openGrab,about:'选择区域、窗口、屏幕与定时屏幕捕捉；支持裁切、预览、Aqua 存储面板、Finder 定位和真实下载。',keywords:'grab screenshot screen capture 抓图 截图'});

  // ---------- Migration Assistant and Boot Camp Assistant ----------
  const migrationIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs>
    <linearGradient id="migration-metal" x2="0" y2="1"><stop stop-color="#f8fbff"/><stop offset=".46" stop-color="#bfcad5"/><stop offset="1" stop-color="#778897"/></linearGradient>
    <linearGradient id="migration-screen" x2="0" y2="1"><stop stop-color="#80c7ef"/><stop offset="1" stop-color="#245c96"/></linearGradient>
    <filter id="migration-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".42"/></filter>
  </defs><g filter="url(#migration-shadow)">
    <path d="M5 10h37v30H5z" fill="url(#migration-metal)" stroke="#455563" stroke-width="1.5"/><path d="M8 13h31v23H8z" fill="url(#migration-screen)" stroke="#263b4f"/>
    <path d="M19 40h9l2 6H17z" fill="#aab6bf" stroke="#53616d"/><path d="M14 47h19" stroke="#4d5964" stroke-width="2"/>
    <path d="M35 23h24v27H35z" fill="url(#migration-metal)" stroke="#455563" stroke-width="1.5"/><path d="M38 26h18v17H38z" fill="url(#migration-screen)" stroke="#263b4f"/><circle cx="47" cy="47" r="1.5" fill="#5c6974"/>
    <path d="M24 26c5-7 12-7 18-2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="m38 18 6 7-9 3" fill="#fff"/>
  </g></svg>`;
  const bootCampIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs>
    <linearGradient id="bootcamp-diamond" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".38" stop-color="#dbe1e7"/><stop offset="1" stop-color="#778592"/></linearGradient>
    <linearGradient id="bootcamp-blue" x2="0" y2="1"><stop stop-color="#59b9ee"/><stop offset="1" stop-color="#1765a3"/></linearGradient>
    <filter id="bootcamp-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".45"/></filter>
  </defs><g filter="url(#bootcamp-shadow)">
    <path d="M32 4 59 32 32 60 5 32z" fill="url(#bootcamp-diamond)" stroke="#4b5965" stroke-width="1.5"/>
    <path d="M17 17h30v30H17z" fill="#f4f7f9" stroke="#71808d"/>
    <path d="m20 21 10-2v11H20zm12-2 12-2v13H32zM20 32h10v11l-10-2zm12 0h12v13l-12-2z" fill="url(#bootcamp-blue)"/>
    <path d="M13 12 51 51" stroke="#fff" stroke-opacity=".55"/>
  </g></svg>`;

  const assistantBytes=(gb)=>gb*1024*1024*1024;
  const assistantGB=(bytes)=>{
    const value=Math.max(0,Number(bytes)||0);
    if(value<1024*1024*1024)return `${(value/1024/1024).toFixed(value<10*1024*1024?'1':'0')} MB`;
    const valueGB=value/1024/1024/1024;
    return `${valueGB.toFixed(valueGB<100?'1':'0').replace(/\.0$/,'')} GB`;
  };
  const ensureAssistantDirectory=(path)=>{
    if(VFS.isDir(path))return true;
    const parent=VFS.parentOf(path);
    return VFS.isDir(parent)&&VFS.mkdir(path);
  };
  const uniqueAssistantDirectory=(parent,base)=>{
    const name=VFS.uniqueName(parent,base,'');
    const path=VFS.normalize(`${parent}/${name}`);
    return ensureAssistantDirectory(path)?path:null;
  };

  function createAssistantShell(appId,appName,appIcon){
    const root=el('div',`leopard-assistant ${appId}-assistant`);
    root.innerHTML=`<aside class="assistant-rail">
      <div class="assistant-app-icon">${appIcon}</div>
      <strong>${esc(appName)}</strong><small>Mac OS X Leopard</small>
      <ol class="assistant-steps"></ol>
      <div class="assistant-rail-note"><i></i><span>所有更改仅发生在<br>Leopard 虚拟磁盘中</span></div>
    </aside>
    <main class="assistant-main">
      <header><h1></h1><p></p></header>
      <section class="assistant-stage" aria-live="polite"></section>
      <footer class="assistant-footer">
        <span class="assistant-footnote"></span>
        <button class="aqua-btn assistant-cancel">取消</button>
        <button class="aqua-btn assistant-back">返回</button>
        <button class="aqua-btn default assistant-next">继续</button>
      </footer>
    </main>`;
    const title=root.querySelector('.assistant-main>header h1');
    const subtitle=root.querySelector('.assistant-main>header p');
    const stage=root.querySelector('.assistant-stage');
    const steps=root.querySelector('.assistant-steps');
    const footnote=root.querySelector('.assistant-footnote');
    const cancel=root.querySelector('.assistant-cancel');
    const back=root.querySelector('.assistant-back');
    const next=root.querySelector('.assistant-next');
    return {
      root,title,subtitle,stage,steps,footnote,cancel,back,next,
      heading(nextTitle,nextSubtitle){
        title.textContent=nextTitle||'';
        subtitle.textContent=nextSubtitle||'';
      },
      progress(labels,index){
        steps.innerHTML=labels.map((label,itemIndex)=>`<li class="${itemIndex<index?'done':itemIndex===index?'current':''}"><i>${itemIndex<index?'✓':itemIndex+1}</i><span>${esc(label)}</span></li>`).join('');
      },
      buttons(options={}){
        cancel.hidden=options.cancelHidden===true;
        cancel.disabled=options.cancelDisabled===true;
        cancel.textContent=options.cancelLabel||'取消';
        back.hidden=options.backHidden===true;
        back.disabled=options.backDisabled===true;
        back.textContent=options.backLabel||'返回';
        next.hidden=options.nextHidden===true;
        next.disabled=options.nextDisabled===true;
        next.textContent=options.nextLabel||'继续';
        footnote.textContent=options.note||'';
      },
    };
  }

  function openMigrationAssistant(){
    const steps=['介绍','传输来源','查找来源','选择信息','传输','完成'];
    const pageStep={welcome:0,source:1,search:2,verify:3,categories:3,progress:4,complete:5,error:4};
    const sources={
      snapshot:{name:'Time Machine 备份',detail:'Macintosh HD — 今天 08:30',glyph:'◷',description:'从最近的本地虚拟快照传输。'},
      mac:{name:'另一台 Mac',detail:'使用同一网络查找附近的 Mac',glyph:'⌘',description:'显示验证码后从“roll 的旧 Mac”传输。'},
      disk:{name:'另一个磁盘',detail:'Leopard Backup — 启动宗卷',glyph:'▣',description:'从已连接的启动磁盘传输。'},
      archive:{name:'迁移归档',detail:'从本机选择 .json 或 .migrationarchive',glyph:'⇧',description:'主动选择一个本机迁移清单。'},
    };
    const categories=[
      {id:'applications',name:'应用程序',size:assistantBytes(6.8),glyph:'A',detail:'34 个应用程序；不替换此 Mac 上较新的版本。'},
      {id:'users',name:'用户账户',size:assistantBytes(12.4),glyph:'⌂',detail:'roll（旧 Mac）；将安全地导入为 roll-old。'},
      {id:'files',name:'其他文件与文件夹',size:assistantBytes(3.2),glyph:'▤',detail:'共享文件、项目资料和磁盘顶层文稿。'},
      {id:'settings',name:'电脑和网络设置',size:assistantBytes(.0485),glyph:'⚙',detail:'桌面、网络、时区、打印机和其他系统偏好。'},
    ];
    const selected=new Set(categories.map(item=>item.id));
    const disclosed=new Set(['users']);
    let page='welcome';
    let source='snapshot';
    let scanning=false;
    let discovered=false;
    let verificationAccepted=false;
    let archive=null;
    let archiveError='';
    let transferProgress=0;
    let transferStage='';
    let busy=false;
    let operationTimer=null;
    let result=null;
    let quotaText='正在计算浏览器存储空间…';
    let win=null;
    const shell=createAssistantShell('migration','迁移助理',migrationIcon);

    const clearOperation=()=>{
      if(operationTimer){clearInterval(operationTimer);clearTimeout(operationTimer);operationTimer=null;}
      scanning=false;
    };
    const selectedSize=()=>categories.filter(item=>selected.has(item.id)).reduce((sum,item)=>sum+item.size,0);
    const currentSourceLabel=()=>archive?.machineName||archive?.name||({
      snapshot:'Time Machine — Macintosh HD（今天 08:30）',
      mac:'roll 的旧 Mac',
      disk:'Leopard Backup',
    }[source]||sources[source].detail);
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.assistantPage=page;
      win.dataset.assistantBusy=String(busy||scanning);
      win.dataset.assistantCanBack=String(!busy&&!scanning&&!['welcome','progress','complete','error'].includes(page));
      win.dataset.assistantCanContinue=String(!shell.next.disabled&&!shell.next.hidden);
      win.dataset.assistantCanCancel=String(!shell.cancel.disabled&&!shell.cancel.hidden);
      win.dataset.assistantComplete=String(page==='complete');
      win.dataset.assistantHasResult=String(!!result);
    };
    const setButtons=(options)=>{
      shell.buttons(options);
      updateWindowState();
    };
    const renderSourceCards=()=>Object.entries(sources).map(([id,item])=>`<label class="assistant-choice ${source===id?'selected':''}">
      <input type="radio" name="migration-source" value="${id}" ${source===id?'checked':''}>
      <i>${item.glyph}</i><span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small><em>${esc(item.description)}</em></span>
    </label>`).join('');
    const renderCategories=()=>categories.map(item=>`<article class="migration-category ${selected.has(item.id)?'selected':''}">
      <label><input type="checkbox" data-migration-category="${item.id}" ${selected.has(item.id)?'checked':''}>
        <i>${item.glyph}</i><span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></span><strong>${assistantGB(item.size)}</strong>
      </label>
      <button class="migration-disclosure ${disclosed.has(item.id)?'open':''}" data-disclose="${item.id}" aria-label="显示详细信息">▶</button>
      ${disclosed.has(item.id)?`<div class="migration-category-detail">${item.id==='users'
        ? '<p><b>账户“roll”已经存在。</b> 此助理不会覆盖当前账户；旧账户会重新命名为“roll-old”，其个人文件会放在迁移结果文件夹中。</p><label>冲突处理：<select class="aqua-select"><option>保留双方（导入为 roll-old）</option><option>只传输共享文件</option></select></label>'
        : `<p>${esc(item.detail)}</p><p>迁移时会保留创建日期、文件类型与原始来源信息。</p>`}</div>`:''}
    </article>`).join('');

    const render=()=>{
      shell.progress(steps,pageStep[page]??0);
      shell.root.classList.toggle('busy',busy||scanning);
      if(page==='welcome'){
        shell.heading('将信息传输到这台 Mac','从另一台 Mac、Time Machine 备份、启动磁盘或迁移归档拷贝账户、应用程序、文件和设置。');
        shell.stage.innerHTML=`<div class="assistant-welcome migration-welcome">
          <div class="assistant-hero">${migrationIcon}<div><h2>欢迎使用迁移助理</h2><p>传输完成前，当前账户与现有文件保持不变。发现同名账户或文件时，助理会先采用安全的重命名策略。</p></div></div>
          <section class="assistant-checklist"><h3>开始之前</h3><ul><li>连接电源并关闭其他应用程序。</li><li>如果从另一台 Mac 传输，请将两台电脑接入同一网络。</li><li>大量信息可能需要较长时间；传输期间仍可在写入前停止。</li></ul></section>
          <div class="assistant-privacy-note"><b>网页版本的安全边界</b><span>本助理只在虚拟 Macintosh HD 中建立迁移结果；不会读取真实 Mac 的账户、密码或整块磁盘。</span></div>
        </div>`;
        setButtons({cancelLabel:'退出',backHidden:true,nextLabel:'继续',note:'不会更改真实 Mac'});
      }else if(page==='source'){
        shell.heading('您想怎样传输信息？','请选择信息的来源。下一步会查找并验证所选来源。');
        shell.stage.innerHTML=`<div class="assistant-choice-list">${renderSourceCards()}</div>`;
        shell.stage.querySelectorAll('input[name="migration-source"]').forEach(input=>input.addEventListener('change',()=>{
          source=input.value;
          discovered=false;archiveError='';
          if(source!=='archive')archive=null;
          render();
        }));
        setButtons({cancelLabel:'取消',nextLabel:'继续',note:'传输到这台 Mac'});
      }else if(page==='search'){
        shell.heading(source==='archive'?'选择迁移归档':'正在查找传输来源',source==='archive'?'选择由另一台 Leopard Web Mac 导出的迁移清单。':'保持来源 Mac 或备份磁盘可用，直到它出现在列表中。');
        if(source==='archive'){
          shell.stage.innerHTML=`<div class="migration-archive-picker">
            <div class="assistant-source-glyph">⇧</div>
            <h2>${archive?esc(archive.name):'尚未选择迁移归档'}</h2>
            <p>${archive?`${formatBytes(archive.size)} · ${esc(archive.machineName||'本机归档')}`:'归档只用来读取迁移清单；助理不会上传文件。'}</p>
            <button class="aqua-btn default choose-migration-archive">${archive?'选择其他归档…':'选择归档…'}</button>
            <input type="file" accept=".json,.migrationarchive,application/json" hidden>
            ${archiveError?`<div class="assistant-inline-error">${esc(archiveError)}</div>`:''}
            <div class="assistant-info-box"><b>支持的格式</b><span>JSON 清单或 .migrationarchive。其他格式仍可作为只读迁移来源登记，但不会读取其内容。</span></div>
          </div>`;
          const input=shell.stage.querySelector('input[type="file"]');
          shell.stage.querySelector('.choose-migration-archive').addEventListener('click',()=>input.click());
          input.addEventListener('change',async()=>{
            const file=input.files?.[0];
            if(!file)return;
            archiveError='';
            archive={name:file.name,size:file.size,lastModified:file.lastModified,machineName:file.name.replace(/\.(json|migrationarchive)$/i,'')||'迁移归档'};
            if(file.size<=1024*1024&&/(\.json|\.migrationarchive)$/i.test(file.name)){
              try{
                const parsed=JSON.parse(await file.text());
                if(parsed&&typeof parsed==='object'){
                  archive.machineName=String(parsed.machineName||parsed.computerName||parsed.name||archive.machineName).slice(0,80);
                  archive.version=String(parsed.version||'1.0').slice(0,20);
                }
              }catch(error){archiveError='归档清单无法解析；仍可按文件名称继续登记。';}
            }
            discovered=true;render();
          });
          setButtons({cancelLabel:'取消',nextLabel:'继续',nextDisabled:!archive,note:'文件只在本机读取'});
        }else{
          const found=discovered;
          const item=source==='mac'
            ? {name:'roll 的旧 Mac',detail:'Mac OS X 10.5.8 · AirPort · 信号良好',glyph:'⌘'}
            : source==='disk'
              ? {name:'Leopard Backup',detail:'启动宗卷 · Mac OS 扩展（日志式） · 74.4 GB',glyph:'▣'}
              : {name:'Time Machine 备份',detail:'Macintosh HD · 今天 08:30 · 23.1 GB',glyph:'◷'};
          shell.stage.innerHTML=`<div class="migration-discovery">
            <div class="assistant-radar ${found?'found':'searching'}"><i></i><span>${found?'✓':'⌁'}</span></div>
            <h2>${found?'已找到传输来源':'正在搜索…'}</h2>
            <p>${found?'选择下面的来源，然后继续。':'这通常需要几秒钟。请确认备份磁盘已连接，或另一台 Mac 已打开迁移助理。'}</p>
            <div class="migration-found-source ${found?'visible':''}"><i>${item.glyph}</i><span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></span><em>可用</em></div>
            <button class="aqua-btn retry-search" ${found?'':'disabled'}>重新搜索</button>
          </div>`;
          shell.stage.querySelector('.retry-search').addEventListener('click',()=>{
            discovered=false;startDiscovery();
          });
          setButtons({cancelLabel:found?'取消':'停止',backDisabled:!found,nextLabel:'继续',nextDisabled:!found,note:found?'来源已验证':'正在查找来源…'});
          if(!scanning&&!discovered)startDiscovery();
        }
      }else if(page==='verify'){
        shell.heading('确认另一台 Mac','两台电脑上显示的数字必须完全相同，才能开始读取迁移信息。');
        shell.stage.innerHTML=`<div class="migration-verification">
          <div class="migration-code-label">另一台 Mac 上应显示：</div>
          <output>481–729</output>
          <div class="migration-machine-row"><i>⌘</i><span><b>roll 的旧 Mac</b><small>Mac OS X 10.5.8 · 通过 AirPort 连接</small></span><em>已配对</em></div>
          <label class="assistant-confirm-check"><input type="checkbox" ${verificationAccepted?'checked':''}> 我在另一台 Mac 上看到了相同的代码</label>
          <p class="assistant-muted">这是虚拟迁移会话验证码；不会要求真实账户密码。</p>
        </div>`;
        shell.stage.querySelector('input').addEventListener('change',event=>{
          verificationAccepted=event.target.checked;
          shell.next.disabled=!verificationAccepted;updateWindowState();
        });
        setButtons({cancelLabel:'取消',nextLabel:'继续',nextDisabled:!verificationAccepted,note:'验证码可防止连接到错误的 Mac'});
      }else if(page==='categories'){
        const total=selectedSize();
        shell.heading('选择要传输的信息',`来自“${currentSourceLabel()}”。取消选择不需要的类别，以缩短传输时间。`);
        shell.stage.innerHTML=`<div class="migration-selection">
          <div class="migration-selection-head"><b>要传输的信息</b><span>大小</span></div>
          <div class="migration-category-list">${renderCategories()}</div>
          <div class="migration-space-summary">
            <div><span>已选择</span><b>${assistantGB(total)}</b></div>
            <div><span>Macintosh HD 传输后可用</span><b>${assistantGB(assistantBytes(56.9)-total)}</b></div>
            <div><span>浏览器存储</span><b>${esc(quotaText)}</b></div>
          </div>
        </div>`;
        shell.stage.querySelectorAll('[data-migration-category]').forEach(input=>input.addEventListener('change',()=>{
          if(input.checked)selected.add(input.dataset.migrationCategory);
          else selected.delete(input.dataset.migrationCategory);
          render();
        }));
        shell.stage.querySelectorAll('[data-disclose]').forEach(button=>button.addEventListener('click',()=>{
          const id=button.dataset.disclose;
          if(disclosed.has(id))disclosed.delete(id);else disclosed.add(id);
          render();
        }));
        setButtons({cancelLabel:'取消',nextLabel:'传输',nextDisabled:!selected.size,note:`${selected.size} 个类别 · ${assistantGB(total)}`});
      }else if(page==='progress'){
        shell.heading('正在传输您的信息','请保持此窗口打开。写入虚拟 Macintosh HD 前，您可以停止传输。');
        shell.stage.innerHTML=`<div class="assistant-operation">
          <div class="assistant-operation-icon">${migrationIcon}</div>
          <h2 class="assistant-operation-stage">${esc(transferStage||'正在准备传输…')}</h2>
          <div class="assistant-progress-bar"><i style="width:${transferProgress}%"></i></div>
          <div class="assistant-progress-labels"><span>${Math.round(transferProgress)}%</span><span>${assistantGB(selectedSize())} 中的 ${assistantGB(selectedSize()*transferProgress/100)}</span></div>
          <ul class="assistant-operation-log">
            <li class="${transferProgress>=8?'done':'active'}">验证来源和可用空间</li>
            <li class="${transferProgress>=28?'done':transferProgress>=8?'active':''}">读取账户与应用程序清单</li>
            <li class="${transferProgress>=62?'done':transferProgress>=28?'active':''}">拷贝所选信息</li>
            <li class="${transferProgress>=92?'done':transferProgress>=62?'active':''}">调整所有权并建立迁移报告</li>
          </ul>
        </div>`;
        setButtons({cancelLabel:'停止',backHidden:true,nextHidden:true,note:'不会覆盖当前账户'});
      }else if(page==='complete'){
        shell.heading('迁移已完成','所选信息已经整理到虚拟 Macintosh HD；当前账户和现有文件没有被替换。');
        shell.stage.innerHTML=`<div class="assistant-complete">
          <div class="assistant-complete-mark">✓</div>
          <h2>已传输 ${selected.size} 个类别</h2>
          <p>来源：${esc(result?.source||currentSourceLabel())}<br>结果：${esc(result?.folder||'')}</p>
          <div class="assistant-result-actions">
            <button class="aqua-btn default" data-result-action="reveal">在 Finder 中显示</button>
            <button class="aqua-btn" data-result-action="open">打开迁移报告</button>
          </div>
          <section class="assistant-summary-card"><b>传输摘要</b><span>${categories.filter(item=>selected.has(item.id)).map(item=>esc(item.name)).join('、')}</span><small>报告保存在“文稿”中，也已加入最近使用的文稿。</small></section>
        </div>`;
        shell.stage.querySelector('[data-result-action="reveal"]').addEventListener('click',revealResult);
        shell.stage.querySelector('[data-result-action="open"]').addEventListener('click',openResult);
        setButtons({cancelLabel:'重新开始',backHidden:true,nextLabel:'完成',note:'传输报告已存储'});
      }else{
        shell.heading('无法完成迁移','虚拟磁盘没有接受迁移结果。现有信息没有被更改。');
        shell.stage.innerHTML=`<div class="assistant-error"><i>!</i><h2>未能写入迁移结果</h2><p>请确认“文稿”文件夹仍然可用，然后返回并重试。</p></div>`;
        setButtons({cancelLabel:'退出',backLabel:'返回',nextHidden:true,note:'没有写入不完整的迁移结果'});
      }
      updateWindowState();
    };

    function startDiscovery(){
      clearOperation();
      scanning=true;discovered=false;
      render();
      operationTimer=setTimeout(()=>{
        operationTimer=null;scanning=false;discovered=true;render();
      },1250);
    }
    function buildMigrationResult(){
      const base='/用户/roll/文稿';
      if(!VFS.isDir(base))return null;
      let folder=null;
      let reportPath=null;
      const now=new Date();
      const sourceName=currentSourceLabel();
      VFS.transaction('迁移所选信息',()=>{
        folder=uniqueAssistantDirectory(base,'迁移的项目');
        if(!folder)return;
        const lines=[
          '迁移助理传输摘要',
          '================',
          `完成时间：${now.toLocaleString('zh-CN')}`,
          `来源：${sourceName}`,
          `目的位置：${folder}`,
          `传输大小：${assistantGB(selectedSize())}`,
          '',
          '已传输的类别：',
          ...categories.filter(item=>selected.has(item.id)).map(item=>`• ${item.name} — ${assistantGB(item.size)}`),
          '',
          '账户冲突处理：现有账户 roll 保持不变；来源账户记录为 roll-old。',
          '安全说明：本次传输只在 Leopard Web 虚拟磁盘中建立代表性清单，没有读取或更改真实 Mac。',
        ];
        reportPath=`${folder}/迁移报告.txt`;
        VFS.putNode(reportPath,{type:'file',content:lines.join('\n'),mime:'text/plain',creator:'migration',generated:true,kind:'document'});
        if(selected.has('applications'))VFS.putNode(`${folder}/应用程序清单.txt`,{type:'file',content:'Safari\nMail\niCal\niTunes\nTextEdit\nPreview\nUtilities\n',mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('users'))VFS.putNode(`${folder}/roll-old 用户账户.txt`,{type:'file',content:'账户短名称：roll-old\n原始电脑：roll 的旧 Mac\n个人文件：已采用安全清单迁移\n',mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('files'))VFS.putNode(`${folder}/其他文件索引.txt`,{type:'file',content:'共享项目\n项目资料\n磁盘顶层文稿\n',mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('settings'))VFS.putNode(`${folder}/电脑和网络设置.plist`,{type:'file',content:JSON.stringify({desktop:'Aurora',network:'Leopard Web',timeZone:'Asia/Kuching',printers:['Leopard PDF Printer']},null,2),mime:'application/x-plist',creator:'migration',generated:true});
      },{paths:[base]});
      if(!folder||!reportPath||!VFS.get(reportPath)){
        if(folder&&VFS.get(folder))VFS.remove(folder,{record:false,label:'清理未完成的迁移结果'});
        return null;
      }
      System.addRecentDocument?.(reportPath,'textedit');
      System.syslog?.(`迁移助理已从“${sourceName}”传输 ${selected.size} 个类别`, 'Migration Assistant');
      const record={completedAt:Date.now(),source:sourceName,folder,reportPath,categories:[...selected],bytes:selectedSize()};
      const history=jsonStore('macweb.migration.history.v1',[]);
      save('macweb.migration.history.v1',[record,...(Array.isArray(history)?history:[])].slice(0,8));
      return record;
    }
    function updateTransfer(){
      const bar=shell.stage.querySelector('.assistant-progress-bar>i');
      const labels=shell.stage.querySelectorAll('.assistant-progress-labels span');
      const stage=shell.stage.querySelector('.assistant-operation-stage');
      if(bar)bar.style.width=`${transferProgress}%`;
      if(labels[0])labels[0].textContent=`${Math.round(transferProgress)}%`;
      if(labels[1])labels[1].textContent=`${assistantGB(selectedSize())} 中的 ${assistantGB(selectedSize()*transferProgress/100)}`;
      transferStage=transferProgress<12?'正在验证来源…':transferProgress<30?'正在读取信息清单…':transferProgress<65?'正在拷贝所选信息…':transferProgress<91?'正在调整文件所有权…':'正在建立迁移报告…';
      if(stage)stage.textContent=transferStage;
      shell.stage.querySelectorAll('.assistant-operation-log li').forEach((item,index)=>{
        const points=[8,28,62,92];
        item.className=transferProgress>=points[index]?'done':index===0||transferProgress>=points[index-1]?'active':'';
      });
    }
    function startTransfer(){
      clearOperation();
      busy=true;transferProgress=0;transferStage='正在准备传输…';
      page='progress';render();
      operationTimer=setInterval(()=>{
        transferProgress=Math.min(100,transferProgress+3+Math.random()*5);
        updateTransfer();
        if(transferProgress>=100){
          clearOperation();busy=false;
          result=buildMigrationResult();
          page=result?'complete':'error';
          render();
        }
      },135);
    }
    function stopTransfer(){
      if(scanning&&!busy){
        clearOperation();page='source';render();return;
      }
      if(!busy&&!scanning){page='source';render();return;}
      const body=el('div','assistant-stop-sheet');
      body.innerHTML='<h3>停止迁移？</h3><p>尚未完成的信息不会写入虚拟磁盘。您可以返回信息选择页面后重新开始。</p>';
      System.showSheet({
        parent:win,content:body,className:'assistant-stop-confirm',
        buttons:[
          {label:'继续迁移',cancel:true},
          {label:'停止',danger:true,default:true,action:()=>{
            clearOperation();busy=false;
            page=source==='mac'&&!verificationAccepted?'verify':'categories';
            render();
          }},
        ],
      });
    }
    function revealResult(){if(result?.folder)System.launch('finder',{path:result.folder});}
    function openResult(){if(result?.reportPath)System.openVfsPath?.(result.reportPath);}
    function restart(){
      clearOperation();page='welcome';source='snapshot';discovered=false;verificationAccepted=false;
      archive=null;archiveError='';transferProgress=0;busy=false;result=null;
      selected.clear();categories.forEach(item=>selected.add(item.id));
      render();
    }
    function continueFlow(){
      if(shell.next.disabled)return;
      if(page==='welcome'){page='source';render();}
      else if(page==='source'){page='search';discovered=false;render();}
      else if(page==='search'){
        page=source==='mac'?'verify':'categories';
        render();
      }else if(page==='verify'){page='categories';render();}
      else if(page==='categories')startTransfer();
      else if(page==='complete')System.closeWindow(win);
    }
    function backFlow(){
      if(busy||scanning)return;
      if(page==='source')page='welcome';
      else if(page==='search')page='source';
      else if(page==='verify')page='search';
      else if(page==='categories')page=source==='mac'?'verify':'search';
      else if(page==='error')page='categories';
      render();
    }
    function cancelFlow(){
      if(page==='complete'){restart();return;}
      if(busy||scanning){stopTransfer();return;}
      System.closeWindow(win);
    }

    shell.next.addEventListener('click',continueFlow);
    shell.back.addEventListener('click',backFlow);
    shell.cancel.addEventListener('click',cancelFlow);
    win=System.createWindow({
      app:'migration',title:'迁移助理',width:790,height:590,content:shell.root,bodyBg:'#ececec',noResize:true,
      onClose:(targetWindow,context)=>{
        if(context.force){clearOperation();return true;}
        if(!busy&&!scanning)return true;
        stopTransfer();return false;
      },
    });
    win.addEventListener('leopard-command',event=>{
      const actions={
        'assistant-continue':continueFlow,'assistant-back':backFlow,'assistant-cancel':cancelFlow,
        'assistant-restart':restart,'assistant-reveal-result':revealResult,'assistant-open-report':openResult,
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    navigator.storage?.estimate?.().then(estimate=>{
      if(!win?.isConnected)return;
      const quota=Math.max(0,(estimate.quota||0)-(estimate.usage||0));
      quotaText=quota?`${quota>=1024*1024*1024?assistantGB(quota):formatBytes(quota)} 可用`:'由浏览器管理';
      if(page==='categories')render();
    }).catch(()=>{quotaText='由浏览器管理';if(page==='categories')render();});
    render();
    return win;
  }

  const BOOTCAMP_KEY='macweb.bootcamp.partition.v1';
  function openBootCampAssistant(){
    const TOTAL_GB=80;
    const MAC_USED_GB=26.4;
    const existing=jsonStore(BOOTCAMP_KEY,null);
    let operation=existing?'remove':'install';
    let page='welcome';
    let media='dvd';
    let iso=null;
    let windowsGB=Math.min(44,Math.max(20,Number(existing?.windowsGB)||32));
    let progress=0;
    let progressStage='';
    let busy=false;
    let commitStarted=false;
    let operationTimer=null;
    let result=null;
    let win=null;
    const shell=createAssistantShell('bootcamp','Boot Camp 助理',bootCampIcon);
    const labels=()=>operation==='remove'
      ? ['介绍','确认分区','恢复磁盘','完成']
      : ['介绍','安装光盘','建立分区','确认','准备磁盘','完成'];
    const pageIndex=()=>{
      const map=operation==='remove'
        ? {welcome:0,review:1,progress:2,complete:3,error:2,installer:3}
        : {welcome:0,media:1,partition:2,review:3,progress:4,complete:5,error:4,installer:5};
      return map[page]??0;
    };
    const clearOperation=()=>{
      if(operationTimer){clearInterval(operationTimer);clearTimeout(operationTimer);operationTimer=null;}
    };
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.assistantPage=page;
      win.dataset.assistantBusy=String(busy);
      win.dataset.assistantCanBack=String(!busy&&!['welcome','progress','complete','installer'].includes(page));
      win.dataset.assistantCanContinue=String(!shell.next.disabled&&!shell.next.hidden);
      win.dataset.assistantCanCancel=String(!shell.cancel.disabled&&!shell.cancel.hidden);
      win.dataset.assistantCommitted=String(commitStarted);
      win.dataset.assistantComplete=String(page==='complete');
      win.dataset.assistantHasResult=String(!!result);
      win.dataset.bootcampOperation=operation;
      win.dataset.bootcampMedia=media;
    };
    const setButtons=options=>{shell.buttons(options);updateWindowState();};
    const macFreeAfter=()=>TOTAL_GB-windowsGB-MAC_USED_GB;
    const sourceLabel=()=>media==='iso'?(iso?.name||'未选择 ISO 映像'):'Windows 7 安装 DVD';
    const renderPartitionGraphic=()=>`<div class="bootcamp-volume-map">
      <section class="mac-volume" style="flex-basis:${TOTAL_GB-windowsGB}%"><i>⌘</i><b>Mac OS X</b><strong>${(TOTAL_GB-windowsGB).toFixed(0)} GB</strong><small>${macFreeAfter().toFixed(1)} GB 可用</small></section>
      <div class="bootcamp-divider" aria-hidden="true"><i></i></div>
      <section class="windows-volume" style="flex-basis:${windowsGB}%"><i>⊞</i><b>WINDOWS</b><strong>${windowsGB.toFixed(0)} GB</strong><small>BOOTCAMP</small></section>
    </div>`;

    const render=()=>{
      shell.progress(labels(),pageIndex());
      shell.root.classList.toggle('busy',busy);
      if(page==='welcome'){
        shell.heading(existing?'移去 Windows 分区':'在 Mac 上安装 Windows',existing?'Boot Camp 助理检测到一个虚拟 BOOTCAMP 分区，可以将它移去并恢复为单一 Mac OS X 宗卷。':'Boot Camp 助理会检查启动磁盘、准备 Windows 安装光盘，并建立一个独立分区。');
        shell.stage.innerHTML=`<div class="assistant-welcome bootcamp-welcome">
          <div class="assistant-hero">${bootCampIcon}<div><h2>${existing?'恢复启动磁盘':'欢迎使用 Boot Camp 助理'}</h2><p>${existing
            ? `当前 BOOTCAMP 分区为 ${Number(existing.windowsGB||32).toFixed(0)} GB。恢复操作只会移除网页中的虚拟分区记录。`
            : '此流程还原 Leopard 的分区与驱动程序准备步骤；不会对真实硬盘分区，也不会重新启动真实电脑。'}</p></div></div>
          ${existing?`<div class="bootcamp-existing-card">${renderPartitionGraphic()}<label class="assistant-confirm-check"><input type="radio" checked> 将磁盘恢复为单一 Mac OS X 分区</label></div>`:''}
          <section class="bootcamp-prerequisites"><h3>系统检查</h3>
            <ul><li class="ok"><i>✓</i><span><b>Intel 处理器</b><small>虚拟 Intel Core 2 Duo</small></span></li>
            <li class="ok"><i>✓</i><span><b>管理员账户</b><small>roll 可以更改虚拟磁盘</small></span></li>
            <li class="ok"><i>✓</i><span><b>启动磁盘空间</b><small>${(TOTAL_GB-MAC_USED_GB).toFixed(1)} GB 可用于分区</small></span></li>
            <li class="ok"><i>✓</i><span><b>电源与备份</b><small>网页会保留当前文件；仍建议先检查重要文稿</small></span></li></ul>
          </section>
          <div class="assistant-privacy-note"><b>重要</b><span>这是一台浏览器内的虚拟 Mac。Boot Camp 只写入虚拟分区状态与一份报告，不会接触真实磁盘分区表。</span></div>
        </div>`;
        setButtons({cancelLabel:'退出',backHidden:true,nextLabel:existing?'继续':'继续',note:existing?'已检测到 BOOTCAMP':'全部检查已通过'});
      }else if(page==='media'){
        shell.heading('选择 Windows 安装光盘','插入 Windows 安装 DVD，或主动选择本机上的 ISO 映像。只会保留文件名称和大小。');
        shell.stage.innerHTML=`<div class="bootcamp-media">
          <label class="assistant-choice ${media==='dvd'?'selected':''}"><input type="radio" name="bootcamp-media" value="dvd" ${media==='dvd'?'checked':''}>
            <i>◎</i><span><b>Windows 安装 DVD</b><small>Windows 7 安装 DVD · 已插入</small><em>使用 Leopard Web 提供的虚拟安装光盘。</em></span>
          </label>
          <label class="assistant-choice ${media==='iso'?'selected':''}"><input type="radio" name="bootcamp-media" value="iso" ${media==='iso'?'checked':''}>
            <i>▱</i><span><b>ISO 磁盘映像</b><small>${iso?`${esc(iso.name)} · ${formatBytes(iso.size)}`:'尚未选择映像'}</small><em>点按下方按钮，从真实本机选择一个 .iso 文件。</em></span>
          </label>
          <div class="bootcamp-media-actions"><button class="aqua-btn choose-bootcamp-iso">${iso?'选择其他 ISO…':'选择 ISO…'}</button><input type="file" accept=".iso,application/x-iso9660-image" hidden><span>${iso?'已读取文件元数据；映像内容不会存进浏览器。':'选择 ISO 必须由您主动点按。'}</span></div>
          <div class="assistant-info-box"><b>兼容性检查</b><span>${media==='dvd'||iso?'安装介质可读；Boot Camp 驱动程序包已准备好。':'选择映像后才可继续。'}</span></div>
        </div>`;
        shell.stage.querySelectorAll('input[name="bootcamp-media"]').forEach(input=>input.addEventListener('change',()=>{
          media=input.value;render();
        }));
        const fileInput=shell.stage.querySelector('input[type="file"]');
        shell.stage.querySelector('.choose-bootcamp-iso').addEventListener('click',()=>fileInput.click());
        fileInput.addEventListener('change',()=>{
          const file=fileInput.files?.[0];
          if(!file)return;
          iso={name:file.name,size:file.size,lastModified:file.lastModified};
          media='iso';render();
        });
        setButtons({cancelLabel:'取消',nextLabel:'继续',nextDisabled:media==='iso'&&!iso,note:sourceLabel()});
      }else if(page==='partition'){
        shell.heading('为 Windows 创建分区','拖动大小滑块或使用预设。创建后，Windows 分区的大小不能在安装过程中更改。');
        shell.stage.innerHTML=`<div class="bootcamp-partition">
          ${renderPartitionGraphic()}
          <div class="bootcamp-size-control">
            <label><span>Windows 分区大小</span><input type="range" min="20" max="44" step="1" value="${windowsGB}" data-bootcamp-size><output>${windowsGB.toFixed(0)} GB</output></label>
            <div><button class="aqua-btn" data-partition-preset="32">使用 32 GB</button><button class="aqua-btn" data-partition-preset="40">平均分配</button></div>
          </div>
          <dl class="bootcamp-capacity">
            <dt>Macintosh HD 当前已用</dt><dd>${MAC_USED_GB.toFixed(1)} GB</dd>
            <dt>分区后 Mac OS X 可用</dt><dd>${macFreeAfter().toFixed(1)} GB</dd>
            <dt>Windows 格式</dt><dd>${windowsGB<=32?'MS-DOS（FAT32）':'NTFS（由 Windows 安装程序格式化）'}</dd>
          </dl>
          <div class="assistant-warning-box"><b>请先备份重要信息。</b><span>真实 Boot Camp 分区会改写磁盘；此网页流程只记录虚拟分区布局。</span></div>
        </div>`;
        const range=shell.stage.querySelector('[data-bootcamp-size]');
        const updatePartition=()=>{
          shell.stage.querySelector('.bootcamp-volume-map').outerHTML=renderPartitionGraphic();
          shell.stage.querySelector('.bootcamp-size-control output').textContent=`${windowsGB.toFixed(0)} GB`;
          const values=shell.stage.querySelectorAll('.bootcamp-capacity dd');
          if(values[1])values[1].textContent=`${macFreeAfter().toFixed(1)} GB`;
          if(values[2])values[2].textContent=windowsGB<=32?'MS-DOS（FAT32）':'NTFS（由 Windows 安装程序格式化）';
          shell.footnote.textContent=`Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · Windows ${windowsGB.toFixed(0)} GB`;
        };
        range.addEventListener('input',()=>{
          windowsGB=Number(range.value);updatePartition();updateWindowState();
        });
        shell.stage.querySelectorAll('[data-partition-preset]').forEach(button=>button.addEventListener('click',()=>{
          windowsGB=Number(button.dataset.partitionPreset);range.value=String(windowsGB);updatePartition();
        }));
        setButtons({cancelLabel:'取消',nextLabel:'继续',note:`Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · Windows ${windowsGB.toFixed(0)} GB`});
      }else if(page==='review'){
        const removing=operation==='remove';
        shell.heading(removing?'确认恢复磁盘':'准备建立 BOOTCAMP 分区',removing?'Boot Camp 将移去虚拟 Windows 分区，并恢复 Macintosh HD 的完整容量。':'检查安装介质和分区大小，然后开始准备启动磁盘。');
        shell.stage.innerHTML=`<div class="bootcamp-review">
          <div class="bootcamp-review-disk">${renderPartitionGraphic()}</div>
          <dl><dt>操作</dt><dd>${removing?'移去 BOOTCAMP 并恢复单一分区':'建立 Windows 分区并准备安装'}</dd>
            ${removing?'':`<dt>安装介质</dt><dd>${esc(sourceLabel())}</dd><dt>Windows 分区</dt><dd>${windowsGB.toFixed(0)} GB · ${windowsGB<=32?'FAT32':'待 Windows 格式化为 NTFS'}</dd>`}
            <dt>真实硬盘</dt><dd class="ok">不会更改</dd><dt>虚拟磁盘</dt><dd>将写入分区状态和操作报告</dd></dl>
          <label class="assistant-confirm-check"><input type="checkbox" data-bootcamp-confirm> 我已阅读以上摘要，并理解这是虚拟 Boot Camp 操作</label>
          <div class="assistant-warning-box"><b>${removing?'Windows 分区中的虚拟状态会被移去。':'开始后，在写入虚拟分区记录之前仍可取消。'}</b><span>${removing?'已有报告不会删除；助理会另存一份恢复报告。':'写入开始后请等待完成，避免产生不一致状态。'}</span></div>
        </div>`;
        const confirm=shell.stage.querySelector('[data-bootcamp-confirm]');
        confirm.addEventListener('change',()=>{shell.next.disabled=!confirm.checked;updateWindowState();});
        setButtons({cancelLabel:'取消',nextLabel:removing?'恢复':'分区',nextDisabled:true,note:removing?'恢复后 Macintosh HD 为 80 GB':`将建立 ${windowsGB.toFixed(0)} GB BOOTCAMP`});
      }else if(page==='progress'){
        const removing=operation==='remove';
        shell.heading(removing?'正在恢复磁盘':'正在准备 Windows 分区',commitStarted?'正在写入虚拟分区记录；请等待操作完成。':'助理正在验证宗卷。在开始写入之前可以停止。');
        shell.stage.innerHTML=`<div class="assistant-operation bootcamp-operation">
          <div class="assistant-operation-icon">${bootCampIcon}</div>
          <h2 class="assistant-operation-stage">${esc(progressStage||'正在检查启动磁盘…')}</h2>
          <div class="assistant-progress-bar"><i style="width:${progress}%"></i></div>
          <div class="assistant-progress-labels"><span>${Math.round(progress)}%</span><span>${commitStarted?'正在写入虚拟磁盘':'可以安全停止'}</span></div>
          <ul class="assistant-operation-log">
            <li class="${progress>=12?'done':'active'}">检查 Macintosh HD</li>
            <li class="${progress>=42?'done':progress>=12?'active':''}">${removing?'检查 BOOTCAMP 文件系统':'验证 Windows 安装介质'}</li>
            <li class="${progress>=72?'done':progress>=42?'active':''}">${removing?'恢复单一 Mac OS X 宗卷':'建立 BOOTCAMP 分区'}</li>
            <li class="${progress>=94?'done':progress>=72?'active':''}">${removing?'更新启动磁盘信息':'复制 Boot Camp 驱动程序与启动信息'}</li>
          </ul>
        </div>`;
        setButtons({cancelLabel:commitStarted?'正在写入…':'停止',cancelDisabled:commitStarted,backHidden:true,nextHidden:true,note:commitStarted?'请勿关闭助理':'尚未改动虚拟分区表'});
      }else if(page==='complete'){
        const removing=operation==='remove';
        shell.heading(removing?'磁盘已经恢复':'Windows 分区已准备好',removing?'Macintosh HD 已恢复为单一 80 GB 虚拟宗卷。':'BOOTCAMP 已建立，安装介质与驱动程序信息已经记录。');
        shell.stage.innerHTML=`<div class="assistant-complete bootcamp-complete">
          <div class="assistant-complete-mark">✓</div><h2>${removing?'已移去 BOOTCAMP':'可以安装 Windows'}</h2>
          <p>${removing?'虚拟启动磁盘现在只包含 Macintosh HD。':`BOOTCAMP：${windowsGB.toFixed(0)} GB<br>安装介质：${esc(sourceLabel())}`}</p>
          <div class="assistant-result-actions">
            <button class="aqua-btn" data-bootcamp-result="report">打开操作报告</button>
            ${removing?'':'<button class="aqua-btn default" data-bootcamp-result="restart">重新启动并安装 Windows…</button>'}
          </div>
          <section class="assistant-summary-card"><b>${removing?'恢复摘要':'分区摘要'}</b><span>${esc(result?.summary||'操作已完成。')}</span><small>真实 Mac 与真实硬盘没有发生任何更改。</small></section>
        </div>`;
        shell.stage.querySelector('[data-bootcamp-result="report"]').addEventListener('click',openReport);
        shell.stage.querySelector('[data-bootcamp-result="restart"]')?.addEventListener('click',showRestartConfirmation);
        setButtons({cancelHidden:true,backHidden:true,nextLabel:'完成',note:'操作报告已存储'});
      }else if(page==='installer'){
        shell.heading('Windows 安装程序（虚拟）','这是 Boot Camp 的虚拟重新启动画面；不会离开网页或启动真实电脑。');
        shell.stage.innerHTML=`<div class="bootcamp-installer-screen" tabindex="0">
          <div class="bootcamp-bios">Apple Computer<br>Boot Camp BIOS Compatibility Module</div>
          <div class="bootcamp-press-key">Press any key to boot from CD or DVD<span class="bootcamp-cursor">_</span></div>
          <div class="bootcamp-setup-title">Windows is loading files…</div>
          <div class="bootcamp-setup-progress"><i></i></div>
          <small>虚拟安装预览 · 不会读取 ISO 内容</small>
        </div>`;
        setButtons({cancelHidden:true,backHidden:true,nextLabel:'返回 Mac OS X',note:'虚拟重新启动'});
      }else{
        shell.heading('Boot Camp 无法完成操作','虚拟分区状态未能安全写入。真实硬盘和已有文稿没有变化。');
        shell.stage.innerHTML='<div class="assistant-error"><i>!</i><h2>无法更新虚拟分区状态</h2><p>请返回并重试，或检查浏览器是否允许此站点使用本地存储。</p></div>';
        setButtons({cancelLabel:'退出',backLabel:'返回',nextHidden:true,note:'没有留下不完整分区'});
      }
      updateWindowState();
    };

    function performBootCampOperation(){
      const base='/用户/roll/文稿';
      if(!VFS.isDir(base))return null;
      const now=new Date();
      const removing=operation==='remove';
      const record=removing?null:{
        version:1,createdAt:Date.now(),windowsGB,macGB:TOTAL_GB-windowsGB,
        media:{type:media,name:sourceLabel(),size:iso?.size||0},
        label:'BOOTCAMP',format:windowsGB<=32?'FAT32':'NTFS pending',
      };
      try{
        if(removing)localStorage.removeItem(BOOTCAMP_KEY);
        else if(!save(BOOTCAMP_KEY,record))return null;
      }catch(error){return null;}
      let folder=null;
      let reportPath=null;
      VFS.transaction(removing?'恢复 Boot Camp 磁盘':'建立 Boot Camp 分区',()=>{
        folder=uniqueAssistantDirectory(base,removing?'Boot Camp 恢复报告':'Boot Camp 助理');
        if(!folder)return;
        const lines=[
          removing?'Boot Camp 恢复摘要':'Boot Camp 分区摘要',
          '====================',
          `完成时间：${now.toLocaleString('zh-CN')}`,
          `操作：${removing?'移去 BOOTCAMP 并恢复 Macintosh HD':'建立 BOOTCAMP 分区'}`,
          `Macintosh HD：${removing?TOTAL_GB:TOTAL_GB-windowsGB} GB`,
          ...(removing?[]:[`BOOTCAMP：${windowsGB} GB`,`安装介质：${sourceLabel()}`,`格式：${windowsGB<=32?'FAT32':'由 Windows 安装程序格式化为 NTFS'}`]),
          '',
          '此报告来自 Leopard Web。真实硬盘分区表、启动磁盘与本机文件均未被修改。',
        ];
        reportPath=`${folder}/${removing?'Boot Camp 恢复报告':'Boot Camp 分区信息'}.txt`;
        VFS.putNode(reportPath,{type:'file',content:lines.join('\n'),mime:'text/plain',creator:'bootcamp',generated:true,kind:'document'});
        if(!removing)VFS.putNode(`${folder}/Windows 驱动程序说明.txt`,{type:'file',content:'Boot Camp 驱动程序（虚拟清单）\nApple Keyboard\nApple Trackpad\niSight Camera\nApple HFS Driver\nRealtek Audio\nIntel Chipset\n',mime:'text/plain',creator:'bootcamp',generated:true});
      },{paths:[base]});
      if(!folder||!reportPath||!VFS.get(reportPath)){
        if(folder&&VFS.get(folder))VFS.remove(folder,{record:false,label:'清理未完成的 Boot Camp 结果'});
        try{
          if(removing&&existing)save(BOOTCAMP_KEY,existing);
          else if(!removing)localStorage.removeItem(BOOTCAMP_KEY);
        }catch(error){}
        return null;
      }
      System.addRecentDocument?.(reportPath,'textedit');
      System.syslog?.(removing?'BOOTCAMP 已移去；Macintosh HD 已恢复':'BOOTCAMP 虚拟分区已建立', 'Boot Camp Assistant');
      return {
        folder,reportPath,record,
        summary:removing
          ? 'BOOTCAMP 已移去；Macintosh HD 恢复为 80 GB。'
          : `Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · BOOTCAMP ${windowsGB.toFixed(0)} GB`,
      };
    }
    function updateProgress(){
      const bar=shell.stage.querySelector('.assistant-progress-bar>i');
      const labels=shell.stage.querySelectorAll('.assistant-progress-labels span');
      const stage=shell.stage.querySelector('.assistant-operation-stage');
      if(bar)bar.style.width=`${progress}%`;
      if(labels[0])labels[0].textContent=`${Math.round(progress)}%`;
      if(labels[1])labels[1].textContent=commitStarted?'正在写入虚拟磁盘':'可以安全停止';
      const removing=operation==='remove';
      progressStage=progress<14?'正在检查启动磁盘…':progress<43
        ? removing?'正在检查 BOOTCAMP 文件系统…':'正在验证 Windows 安装介质…'
        :progress<73?removing?'正在恢复 Macintosh HD…':'正在建立 BOOTCAMP 分区…'
        :progress<94?removing?'正在更新启动磁盘信息…':'正在复制驱动程序和启动信息…'
        :'正在建立操作报告…';
      if(stage)stage.textContent=progressStage;
      shell.heading(removing?'正在恢复磁盘':'正在准备 Windows 分区',commitStarted?'正在写入虚拟分区记录；请等待操作完成。':'助理正在验证宗卷。在开始写入之前可以停止。');
      shell.cancel.disabled=commitStarted;
      shell.cancel.textContent=commitStarted?'正在写入…':'停止';
      shell.footnote.textContent=commitStarted?'请勿关闭助理':'尚未改动虚拟分区表';
      shell.stage.querySelectorAll('.assistant-operation-log li').forEach((item,index)=>{
        const points=[12,42,72,94];
        item.className=progress>=points[index]?'done':index===0||progress>=points[index-1]?'active':'';
      });
      updateWindowState();
    }
    function startOperation(){
      clearOperation();busy=true;commitStarted=false;progress=0;progressStage='正在检查启动磁盘…';
      page='progress';render();
      operationTimer=setInterval(()=>{
        progress=Math.min(100,progress+2.5+Math.random()*4.5);
        if(progress>=49&&!commitStarted){
          commitStarted=true;
          result=performBootCampOperation();
          if(!result){
            clearOperation();busy=false;commitStarted=false;page='error';render();return;
          }
        }
        updateProgress();
        if(progress>=100){
          clearOperation();busy=false;page='complete';render();
        }
      },145);
    }
    function stopOperation(){
      if(!busy){System.closeWindow(win);return;}
      if(commitStarted){
        const content=el('div','assistant-stop-sheet');
        content.innerHTML='<h3>正在更新虚拟分区</h3><p>请等待当前写入步骤完成。此过程通常只需几秒钟。</p>';
        System.showSheet({parent:win,content,className:'assistant-stop-confirm',buttons:[{label:'好',default:true}]});
        return;
      }
      const content=el('div','assistant-stop-sheet');
      content.innerHTML='<h3>停止 Boot Camp 操作？</h3><p>尚未写入虚拟分区记录。停止后会返回确认页面。</p>';
      System.showSheet({
        parent:win,content,className:'assistant-stop-confirm',
        buttons:[
          {label:'继续操作',cancel:true},
          {label:'停止',danger:true,default:true,action:()=>{
            clearOperation();busy=false;commitStarted=false;page='review';render();
          }},
        ],
      });
    }
    function openReport(){if(result?.reportPath)System.openVfsPath?.(result.reportPath);}
    function revealResult(){if(result?.folder)System.launch('finder',{path:result.folder});}
    function showRestartConfirmation(){
      const content=el('div','bootcamp-restart-sheet');
      content.innerHTML=`${bootCampIcon}<div><h3>重新启动到 Windows 安装程序？</h3><p>网页只会显示一段虚拟启动预览；真实 Mac 不会重新启动。</p></div>`;
      System.showSheet({
        parent:win,content,className:'bootcamp-restart-confirm',
        buttons:[
          {label:'稍后',cancel:true},
          {label:'重新启动',default:true,action:()=>setTimeout(()=>{page='installer';render();},170)},
        ],
      });
    }
    function continueFlow(){
      if(shell.next.disabled)return;
      if(page==='welcome'){page=operation==='remove'?'review':'media';render();}
      else if(page==='media'){page='partition';render();}
      else if(page==='partition'){page='review';render();}
      else if(page==='review')startOperation();
      else if(page==='complete')System.closeWindow(win);
      else if(page==='installer'){page='complete';render();}
    }
    function backFlow(){
      if(busy)return;
      if(page==='media')page='welcome';
      else if(page==='partition')page='media';
      else if(page==='review')page=operation==='remove'?'welcome':'partition';
      else if(page==='error')page='review';
      render();
    }
    function cancelFlow(){
      if(busy){stopOperation();return;}
      System.closeWindow(win);
    }

    shell.next.addEventListener('click',continueFlow);
    shell.back.addEventListener('click',backFlow);
    shell.cancel.addEventListener('click',cancelFlow);
    win=System.createWindow({
      app:'bootcamp',title:'Boot Camp 助理',width:810,height:610,content:shell.root,bodyBg:'#ececec',noResize:true,
      onClose:(targetWindow,context)=>{
        if(context.force){clearOperation();return true;}
        if(!busy)return true;
        stopOperation();return false;
      },
    });
    win.addEventListener('leopard-command',event=>{
      const actions={
        'assistant-continue':continueFlow,'assistant-back':backFlow,'assistant-cancel':cancelFlow,
        'assistant-open-report':openReport,'assistant-reveal-result':revealResult,
        'bootcamp-choose-iso':()=>shell.stage.querySelector('.choose-bootcamp-iso')?.click(),
        'bootcamp-use-dvd':()=>{if(page==='media'){media='dvd';render();}},
        'bootcamp-32gb':()=>{if(page==='partition'){windowsGB=32;render();}},
        'bootcamp-equal':()=>{if(page==='partition'){windowsGB=40;render();}},
        'bootcamp-restart':showRestartConfirmation,
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    render();
    return win;
  }

  System.registerApp({
    id:'migration',name:'迁移助理',icon:migrationIcon,open:openMigrationAssistant,multiWindow:false,
    about:'Mac OS X Leopard 迁移助理：查找并验证来源、选择账户/应用程序/文件/设置、处理账户冲突、传输并生成可打开的报告。',
    keywords:'migration assistant transfer time machine 迁移 助理 账户 备份',
  });
  System.registerApp({
    id:'bootcamp',name:'Boot Camp 助理',icon:bootCampIcon,open:openBootCampAssistant,multiWindow:false,
    about:'Mac OS X Leopard Boot Camp 助理：检查系统、选择 Windows 介质、调整分区、建立或移去可持续识别的虚拟 BOOTCAMP。',
    keywords:'boot camp assistant windows partition 分区 安装 助理',
  });
})();
