import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';

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
    if (value < 1024) return `${value} ${t('app.ln9.5218c2a17058')}`;
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
      { id: 1, box: 'inbox', from: 'Apple', to: 'roll@example.com', subject: t('ui.75a30966cfec'), date: t('ui.5463bf6dd4d9'), unread: true, body: t('app.ln2.0a80a6030c34') },
      { id: 2, box: 'inbox', from: 'Mac OS X Tips', to: 'roll@example.com', subject: t('app.ln2.73d4d6eb2999'), date: t('ui.3bb4453b12fe'), unread: true, body: t('ui.ff63fc66ab24') },
      { id: 3, box: 'inbox', from: 'iCal Server', to: 'roll@example.com', subject: t('ui.3c81a002cc4f'), date: t('ui.5c73101aa980'), unread: false, body: t('app.ln2.ca4e7af17966') },
      { id: 4, box: 'sent', from: 'roll@example.com', to: 'team@example.com', subject: t('app.ln2.36ac94852116'), date: t('ui.e56e580bae59'), unread: false, body: t('ui.0050057d9501') },
      { id: 5, box: 'rss', from: 'Apple Hot News', to: '', subject: t('ui.0d36da0048ef'), date: '2007-10-26', unread: false, body: t('ui.ecdd9ccf2fb5') },
    ],
    notes: [{ id: 101, title: t('ui.c0f007dd6b83'), body: t('ui.c677f12057ab'), date: t('ui.17e83cc25e22') }],
    todos: [{ id: 201, title: t('ui.6c3dd504b9e9'), done: false }, { id: 202, title: t('ui.64c0da1d6afc'), done: true }],
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
        ? `${t('mail.fwdPrefix')}${String(replyTo.subject || '').replace(/^(转发：|Fwd:\s*)/i,'')}`
        : `${t('mail.rePrefix')}${String(replyTo.subject || '').replace(/^(回复：|Re:\s*)/i,'')}`
      : '';
    const quotedBody = replyTo
      ? isForward
        ? `\n\n---------- ${t('app.ln9.f5acee1acdc3')} ----------\n${t('app.ln2.0b4de439447f')}${replyTo.from}\n${t('app.ln9.47dd268e25fd')}${replyTo.date}\n${t('app.ln9.3003e6beb56a')}${replyTo.subject}\n\n${replyTo.body}`
        : preferences.includeOriginal === false
          ? ''
          : `\n\n${t('app.ln9.b2977d67a8fa')}${replyTo.date}，${replyTo.from}${t('app.ln9.9b120c928aef')}\n> ${replyTo.body.replace(/\n/g,'\n> ')}`
      : '';
    const signature = String(preferences.signature || '').trim();
    const initialBody = `${quotedBody}${signature ? `${quotedBody ? '\n\n' : ''}-- \n${signature}` : ''}`;
    let attachments = [...new Set((replyTo?.forwardAttachments || [])
      .map((path) => VFS.normalize(path))
      .filter((path) => VFS.get(path)?.type === 'file'))];
    const wrap = el('div','mail-compose');
    wrap.innerHTML = `<div class="mail-compose-fields">
      <label>${t('app.ln.9f05b23bef')}<input class="aqua-input to" value="${esc(isForward ? '' : replyTo?.from || '')}"></label>
      <label>${t('app.ln7.56dd629cba90')}<input class="aqua-input cc"></label>
      <label>${t('app.ln.d8962fff82')}<input class="aqua-input subject" value="${esc(initialSubject)}"></label></div>
      <div class="mail-formatbar"><button>${t('app.ln2.1f39f25acf34')}</button><button>B</button><button><i>I</i></button><button>${t('app.ln2.57cfbb4fe5b7')}</button><span></span><select aria-label="${t('mail.format')}"><option value="plain">${t('app.ln2.ba6063b2eab9')}</option><option value="rich">${t('app.ln2.af79f395e377')}</option><option value="stationery">Apple Stationery</option></select></div>
      <div class="mail-attachment-strip" hidden></div>
      <textarea class="mail-compose-body">${esc(initialBody)}</textarea>`;
    const toolbar = el('div','mail-compose-toolbar');
    const send = el('button','finder-toolbar-btn',t('ui.1214d633a448'));
    const saveDraft = el('button','finder-toolbar-btn',t('ui.fa17976c7721'));
    const attach = el('button','finder-toolbar-btn',t('ui.6f5160294870'));
    toolbar.append(send,saveDraft,attach);
    const win = System.createWindow({app:'mail',title:t('ui.865e6292bb61'),width:680,height:500,toolbar,content:wrap,statusbar:t('app.ln.14751635fe')});
    const bodyEditor=wrap.querySelector('.mail-compose-body');
    const formatSelect=wrap.querySelector('.mail-formatbar select');
    const attachmentStrip=wrap.querySelector('.mail-attachment-strip');
    formatSelect.value=preferences.messageFormat === 'plain' ? 'plain' : 'rich';
    bodyEditor.spellcheck=preferences.spellCheck !== 'never';
    if(formatSelect.value==='plain')bodyEditor.classList.add('plain');
    formatSelect.addEventListener('change',()=>{
      bodyEditor.classList.toggle('plain',formatSelect.value==='plain');
      win._status.textContent=formatSelect.value==='plain'?t('app.ln.5aa41b228e'):t('app.ln.47b1356f67');
    });
    const renderAttachments=()=>{
      attachments=attachments.filter((path)=>VFS.get(path)?.type==='file');
      attachmentStrip.innerHTML='';
      attachmentStrip.hidden=!attachments.length;
      if(!attachments.length)return;
      const heading=el('div','mail-attachment-heading');
      heading.innerHTML=`<b>${attachments.length} ${t('app.ln9.1be5f555279e')}</b><span>${formatBytes(attachments.reduce((sum,path)=>sum+VFS.sizeOf(path),0))}</span>`;
      const cards=el('div','mail-attachment-cards');
      attachments.forEach((path)=>{
        const card=el('div','mail-attachment-card');
        const open=el('button','mail-attachment-open');
        const iconWrap=el('i');
        iconWrap.innerHTML=System.fileIconFor?.(path)||'<span aria-hidden="true">📄</span>';
        const label=el('span');
        label.append(el('b','',VFS.baseName(path)),el('small','',formatBytes(VFS.sizeOf(path))));
        open.append(iconWrap,label);
        open.title=`${t('app.ln9.548cb363ae9d')}${VFS.baseName(path)}”`;
        open.addEventListener('click',()=>System.openVfsPath?.(path));
        const remove=el('button','mail-attachment-remove','×');
        remove.title=`${t('app.ln9.867a79ad8ea1')}${VFS.baseName(path)}”`;
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
      panel.innerHTML=`<label>${t('app.ln7.232ab9233cfb')}<select class="aqua-input font"><option>Lucida Grande</option><option>Helvetica</option><option>Times New Roman</option><option>Georgia</option><option>Monaco</option></select></label><label>${t('app.ln7.4228f6f0efac')}<select class="aqua-input size"><option value="11">11 pt</option><option value="13">13 pt</option><option value="16">16 pt</option><option value="20">20 pt</option><option value="24">24 pt</option></select></label><label>${t('app.ln7.e1752b6c2a52')}<input class="color" type="color" value="#222222"></label><p>${t('mail.fontPreview')}</p>`;
      const family=panel.querySelector('.font'),size=panel.querySelector('.size'),color=panel.querySelector('.color'),preview=panel.querySelector('p');
      family.value=bodyEditor.style.fontFamily.replace(/["']/g,'')||'Lucida Grande';
      size.value=String(parseInt(bodyEditor.style.fontSize,10)||13);
      color.value=/^#[0-9a-f]{6}$/i.test(bodyEditor.style.color)?bodyEditor.style.color:'#222222';
      const update=()=>{preview.style.fontFamily=family.value;preview.style.fontSize=`${size.value}px`;preview.style.color=color.value;};
      [family,size,color].forEach(control=>control.addEventListener('input',update));update();
      System.showSheet({
        parent:win,title:t('ui.b50d4d8352f5'),content:panel,initialFocus:family,
        buttons:[
          {label:t('ui.4d0b4688c787'),cancel:true},
          {label:t('ui.4562024ddec7'),default:true,action:()=>{
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
      const msg={id:Date.now(),box,from:accountAddress,to:wrap.querySelector('.to').value,cc:wrap.querySelector('.cc').value,subject:wrap.querySelector('.subject').value||t('app.ln2.e7adb970b1e1'),date:t('app.ln2.99bb920d1103'),unread:false,body:wrap.querySelector('.mail-compose-body').value,format:formatSelect.value,attachments:attachments.slice()};
      data.messages.unshift(msg);save(MAIL_KEY,data);document.dispatchEvent(new CustomEvent('mail-changed'));return msg;
    };
    send.addEventListener('click',()=>{collect('sent');if(preferences.sendSound!==false)System.beep('ping',.25);System.closeWindow(win);Leopard.toast('Mail',t('app.ln2.2e0a6f7c597a'));});
    saveDraft.addEventListener('click',()=>{collect('drafts');System.closeWindow(win);});
    attach.addEventListener('click',()=>System.openPanel({
      parent:win,title:t('app.ln2.4fddced6c713'),
      startPath:VFS.isDir(preferences.attachmentPath)?preferences.attachmentPath:paths.documents,
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
    const get=el('button','finder-toolbar-btn',t('app.ln.73d6eb4cd7'));
    const compose=el('button','finder-toolbar-btn',t('ui.865e6292bb61'));
    const reply=el('button','finder-toolbar-btn',t('ui.ffc7850925e7'));
    const forward=el('button','finder-toolbar-btn',t('ui.0d5a8ac36fa3'));
    const remove=el('button','finder-toolbar-btn',t('ui.3755f56f2f83'));
    const junk=el('button','finder-toolbar-btn',t('app.ln2.102b7abca253'));
    const search=el('input','aqua-input aqua-search');search.placeholder = t('app.ln2.bd235d509fc6');
    toolbar.append(get,compose,reply,forward,remove,junk,search);
    const root=el('div','mail-app');
    root.innerHTML='<aside class="mail-sidebar"></aside><section class="mail-list"></section><article class="mail-reader"></article>';
    const side=root.querySelector('.mail-sidebar'),list=root.querySelector('.mail-list'),reader=root.querySelector('.mail-reader');
    const boxes=[['inbox',t('ui.cd83e6e100dd'),'📥'],['drafts',t('ui.0f436818c0b4'),'📝'],['sent',t('ui.afb62932a778'),'✈'],['trash',t('ui.cc4c713c4cc5'),'🗑'],['junk',t('ui.a3093448fddb'),'⛔'],['rss','RSS','◉'],['notes',t('ui.c7ab01c9dfc7'),'📒'],['todos',t('ui.23f017bf5795'),'✓']];
    side.innerHTML=`<h4>${t('app.ln2.ab656b9c29c3')}</h4>`+boxes.map(([id,name,ic])=>`<button data-box="${id}"><i>${ic}</i><span>${name}</span><b></b></button>`).join('');
    const renderReader=()=>{
      if(box==='notes'){
        const note=data.notes.find(n=>n.id===selected)||data.notes[0];
        reader.innerHTML=note?`<div class="mail-note-head"><input value="${esc(note.title)}"></div><textarea>${esc(note.body)}</textarea>`:`<div class="mail-empty">${t('app.ln2.e0a16f2f3244')}</div>`;
        if(note){reader.querySelector('input').addEventListener('input',e=>{note.title=e.target.value;save(MAIL_KEY,data);});reader.querySelector('textarea').addEventListener('input',e=>{note.body=e.target.value;save(MAIL_KEY,data);});}
        return;
      }
      if(box==='todos'){
        reader.innerHTML=`<div class="mail-todos">${data.todos.map(t=>`<label><input type="checkbox" data-id="${t.id}" ${t.done?'checked':''}><span>${esc(t.title)}</span></label>`).join('')}<button class="aqua-btn add-todo">${t('app.ln.c7404e1af8')}</button></div>`;
        reader.querySelectorAll('input').forEach(cb=>cb.addEventListener('change',()=>{
          const t=data.todos.find(x=>String(x.id)===String(cb.dataset.id));
          if(!t)return;
          t.done=cb.checked;save(MAIL_KEY,data);
          document.dispatchEvent(new CustomEvent('mail-data-changed',{detail:{source:'mail'}}));
          render();
        }));
        reader.querySelector('.add-todo')?.addEventListener('click',()=>System.promptSheet({
          parent:win,title:t('ui.b34d1ee208a4'),message:t('app.ln.5cb58368d1'),okLabel:t('ui.94191ce210d3'),
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
      if(!msg){reader.innerHTML=`<div class="mail-empty">${t('app.ln.fe84dd6eb3')}</div>`;return;}
      clearTimeout(readTimer);
      const markRead=()=>{
        if(!msg.unread)return;
        msg.unread=false;save(MAIL_KEY,data);
        reader.closest('.mail-app')?.querySelector(`.mail-row[data-id="${msg.id}"]`)?.classList.remove('unread');
      };
      if(preferences.markRead==='delay')readTimer=setTimeout(markRead,5000);
      else if(preferences.markRead!=='open')markRead();
      const attached=(msg.attachments||[]).filter(path=>VFS.get(path)?.type==='file');
      const attachmentMarkup=attached.length?`<section class="mail-reader-attachments"><header><b>${attached.length} ${t('app.ln9.1be5f555279e')}</b><span>${formatBytes(attached.reduce((sum,path)=>sum+VFS.sizeOf(path),0))}</span></header><div>${attached.map(path=>`<button data-mail-attachment="${esc(path)}"><i>${System.fileIconFor?.(path)||'📄'}</i><span><b>${esc(VFS.baseName(path))}</b><small>${formatBytes(VFS.sizeOf(path))}</small></span></button>`).join('')}</div></section>`:'';
      reader.innerHTML=`<header><h2>${esc(msg.subject)}</h2><div><b>${esc(msg.from)}</b><span>${t('app.ln9.b7cba28753e3')}${esc(msg.to||t('app.ln4.3d70bb9626a6'))} · ${esc(msg.date)}</span></div></header>
        <div class="mail-body">${esc(msg.body).replace(/\n/g,'<br>')}</div>
        ${attachmentMarkup}
        <footer><button class="aqua-btn data-contact">${t('app.ln2.2e87dc65688b')}</button><button class="aqua-btn data-event">${t('app.ln7.5bde7741c67b')}</button></footer>`;
      reader.querySelectorAll('[data-mail-attachment]').forEach(button=>button.addEventListener('click',()=>System.openVfsPath?.(button.dataset.mailAttachment)));
      reader.querySelector('.data-contact').addEventListener('click',()=>{localStorage.setItem('macweb.addressbook.pending',msg.from);System.launch('addressbook');});
      reader.querySelector('.data-event').addEventListener('click',()=>System.launch('ical'));
    };
    const render=()=>{
      side.querySelectorAll('button').forEach(b=>{const id=b.dataset.box;b.classList.toggle('sel',id===box);const count=id==='notes'?data.notes.length:id==='todos'?data.todos.filter(t=>!t.done).length:data.messages.filter(m=>m.box===id).length;b.querySelector('b').textContent=count||'';});
      list.innerHTML='';
      if(box==='notes'){data.notes.forEach(n=>{const row=el('button','mail-row');row.dataset.id=n.id;row.innerHTML=`<b>${esc(n.title)}</b><span>${esc(n.date)}</span><p>${esc(n.body.slice(0,65))}</p>`;row.classList.toggle('sel',n.id===selected);row.addEventListener('click',()=>{selected=n.id;render();});list.appendChild(row);});}
      else if(box==='todos'){list.innerHTML=`<div class="mail-special-title">${t('app.ln2.4eb118fcc6db')}</div>`;}
      else data.messages.filter(m=>m.box===box&&(`${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(query))).forEach(m=>{const row=el('button','mail-row'+(m.unread?' unread':''));row.dataset.id=m.id;row.innerHTML=`<b>${esc(m.from)}</b><span>${esc(m.date)}</span><h3>${m.attachments?.length?`<i class="mail-paperclip" aria-label="${t('app.ln2.d9cf47d3a15c')}">📎</i>`:''}${esc(m.subject)}</h3><p>${esc(m.body.slice(0,70))}</p>`;row.classList.toggle('sel',m.id===selected);row.addEventListener('click',()=>{selected=m.id;render();});list.appendChild(row);});
      renderReader();
    };
    side.addEventListener('click',e=>{const b=e.target.closest('[data-box]');if(b){box=b.dataset.box;selected=null;render();}});
    compose.addEventListener('click',()=>composeMail());
    reply.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg)composeMail(msg);});
    forward.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg)composeMail({...msg,forward:true,forwardAttachments:msg.attachments||[]});});
    remove.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg){msg.box='trash';selected=null;save(MAIL_KEY,data);render();}});
    junk.addEventListener('click',()=>{const msg=data.messages.find(m=>m.id===selected);if(msg){msg.box='junk';selected=null;save(MAIL_KEY,data);render();}});
    search.addEventListener('input',()=>{query=search.value.toLowerCase();render();});
    get.addEventListener('click',()=>{get.disabled=true;get.textContent=t('app.ln.b12acd1af9');setTimeout(()=>{get.disabled=false;get.textContent=t('app.ln.73d6eb4cd7');Leopard.toast('Mail',t('app.ln.a476dd5ab1'));},900);});
    const mailChanged=()=>{
      data=mailData();
      if(selected&&!data.messages.some(message=>message.id===selected))selected=null;
      render();
    };
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='mail')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('mail')||{};
      if(win?._status)win._status.textContent=preferences.enabled===false?t('mail.accountDisabled'):`${t('ui.e64894dec5cf')} · ${preferences.emailAddress||'roll@example.com'}`;
    };
    document.addEventListener('mail-changed',mailChanged);
    document.addEventListener('ical-data-changed',mailChanged);
    document.addEventListener('app-preferences-changed',preferencesChanged);
    render();
    win=System.createWindow({app:'mail',title:'Mail',width:960,height:600,toolbar,content:root,statusbar:preferences.enabled===false?t('mail.accountDisabled'):`${t('ui.e64894dec5cf')} · ${preferences.emailAddress||'roll@example.com'}`,onClose:()=>{
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
  System.registerApp({id:'mail',name:'Mail',icon:mailIcon,open:openMail,about:t('app.ln.cd18457d6e'),keywords:t('app.ln5.204a9837ba14')});

  // ---------- Address Book ----------
  const AB_KEY='macweb.addressbook.v1';
  const AB_GROUPS_KEY='macweb.addressbook.groups.v1';
  const defaultGroups=[{id:'friends',name:t('app.ln.7dbd91b27f')},{id:'work',name:t('app.ln.bc0140eb2c')}];
  const defaultContacts=[
    {id:1,first:'John',last:'Appleseed',company:'Apple',email:'john@apple.example',phone:'+1 408 555 0100',address:'1 Infinite Loop, Cupertino, CA',note:t('app.ln.f744ff5c6d'),group:'friends'},
    {id:2,first:t('app.ln6.5bfaa9789603'),last:t('app.ln6.b06b69df5c25'),company:t('app.ln.7490040b37'),email:'lilei@example.com',phone:'138 0000 0000',address:t('app.ln.a4cef05dab'),note:t('ui.22b25dfa8ad7'),group:'work'},
    {id:3,first:t('app.ln6.0c95c5ca67e5'),last:t('app.ln.45993277c0'),company:'iCal Server',email:'hanmeimei@example.com',phone:'139 0000 0000',address:t('app.ln.d6aba7f0c6'),note:'',group:'friends'},
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
      if(contact.id===2&&contact.first===t('app.ln6.5bfaa9789603')&&contact.last===t('app.ln6.b06b69df5c25')){
        contact.first=t('app.ln6.b06b69df5c25');contact.last=t('app.ln6.5bfaa9789603');migrated=true;
      }else if(contact.id===3&&contact.first===t('app.ln6.0c95c5ca67e5')&&contact.last===t('app.ln.45993277c0')){
        contact.first=t('app.ln.45993277c0');contact.last=t('app.ln6.0c95c5ca67e5');migrated=true;
      }
    });
    if(migrated)save(AB_KEY,contacts);
    let selected=contacts[0]?.id||null,query='',group='all',win=null;
    const toolbar=el('div');const add=el('button','finder-toolbar-btn','＋');const del=el('button','finder-toolbar-btn','－');const card=el('button','finder-toolbar-btn',t('app.ln2.141dcf08b6d9'));const search=el('input','aqua-input aqua-search');search.placeholder = t('ui.f04090805c6e');toolbar.append(add,del,card,search);
    const root=el('div','ab-app');root.innerHTML='<aside></aside><section class="ab-list"></section><article class="ab-card"></article>';
    const side=root.querySelector('aside'),list=root.querySelector('.ab-list'),detail=root.querySelector('.ab-card');
    const isCjkName=(contact)=>/^[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+$/.test(String(contact.first||'')+String(contact.last||''));
    const displayName=(contact)=>{
      const first=String(contact.first||'').trim(),last=String(contact.last||'').trim();
      if(!first)return last;if(!last)return first;
      if(isCjkName(contact))return preferences.nameOrder==='firstLast'?(first+last):(last+first);
      return preferences.nameOrder==='firstLast'?(first+' '+last):(last+', '+first);
    };
    const initials=(contact)=>{
      const first=String(contact.first||'').trim(),last=String(contact.last||'').trim();
      return isCjkName(contact)?((last[0]||'')+(first[0]||'')):((first[0]||'')+(last[0]||''));
    };
    const sortName=(contact)=>preferences.sortBy==='first'
      ? (String(contact.first||'')+String(contact.last||'')) : (String(contact.last||'')+String(contact.first||''));
    const groupName=(id)=>id==='all'?t('app.ln2.7c9732c646a1'):groups.find(item=>item.id===id)?.name||t('app.ln2.280c1f255b67');
    const renderGroups=()=>{
      side.innerHTML=`<h4>${t('app.ln2.280c1f255b67')}</h4>`;
      const all=el('button',group==='all'?'sel':'');
      all.dataset.group='all';all.innerHTML=`<span>${t('app.ln2.7c9732c646a1')}</span><b>${contacts.length}</b>`;side.appendChild(all);
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
      if(!visible.length)list.innerHTML=`<div class="ab-list-empty">${t('app.ln2.7b800577ae8a')}</div>`;
      const c=contacts.find(c=>c.id===selected);
      const phoneticRow=preferences.showPhonetic?`<dt>${t('app.ln7.bd676a08c99e')}</dt><dd contenteditable="true" data-field="phonetic">${esc(c?.phonetic||'')}</dd>`:'';
      detail.innerHTML=c?`<div class="ab-photo">${esc(initials(c))}</div><h2>${esc(displayName(c))}</h2><p>${esc(c.company)}</p>
        <label class="ab-group-field">${t('app.ln7.782cd05cbf07')}<select>${groups.map(item=>`<option value="${esc(item.id)}" ${c.group===item.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
        <dl>${phoneticRow}<dt>${t('app.ln7.a54f36d60855')}</dt><dd contenteditable="true" data-field="phone">${esc(c.phone)}</dd><dt>${t('app.ln2.0cd6267c9810')}</dt><dd contenteditable="true" data-field="email">${esc(c.email)}</dd><dt>${t('app.ln7.4e06c717796a')}</dt><dd contenteditable="true" data-field="birthday" data-placeholder="YYYY-MM-DD">${esc(c.birthday||'')}</dd><dt>${t('app.ln2.2a009b32d770')}</dt><dd contenteditable="true" data-field="address">${esc(c.address)}</dd><dt>${t('app.ln6.1d4db79cebfe')}</dt><dd contenteditable="true" data-field="note">${esc(c.note)}</dd></dl>`:`<div class="ab-empty">${t('app.ln.2c1e9b8b35')}</div>`;
      detail.querySelectorAll('[data-field]').forEach(n=>n.addEventListener('input',()=>{c[n.dataset.field]=n.textContent;save(AB_KEY,contacts);}));
      detail.querySelector('.ab-group-field select')?.addEventListener('change',event=>{c.group=event.target.value;save(AB_KEY,contacts);render();});
      if(win){
        win.dataset.addressGroup=group;
        win.querySelector('.win-statusbar').textContent=`${visible.length} ${t('app.ln9.a963d1b13dc0')} · ${groupName(group)}`;
      }
    };
    side.addEventListener('click',event=>{const button=event.target.closest('[data-group]');if(!button)return;group=button.dataset.group;query='';search.value='';selected=null;render();});
    add.addEventListener('click',()=>{const c={id:Date.now(),first:t('app.ln2.cd30945d117c'),last:t('app.ln.a5c71f3603'),company:'',email:'',phone:'',address:'',note:'',group:group==='all'?(groups[0]?.id||'friends'):group};contacts.push(c);selected=c.id;save(AB_KEY,contacts);render();});
    del.addEventListener('click',()=>{
      const i=contacts.findIndex(c=>c.id===selected);if(i<0)return;
      System.confirmSheet({
        parent:win,title:t('app.ln.d07e53114d'),headline:t('app.ln.22fd015c06'),
        message:t('app.ln.283f55fc17'),okLabel:t('ui.3755f56f2f83'),danger:true,
        onOK:()=>{contacts.splice(i,1);selected=null;save(AB_KEY,contacts);render();},
      });
    });
    search.addEventListener('input',()=>{query=search.value.toLowerCase();render();});
    const showCard=()=>{
      const contact=contacts.find(item=>item.id===selected);if(!contact)return;
      const pane=el('div','ab-vcard-preview');
      pane.innerHTML=`<div class="ab-vcard-paper"><header><div class="ab-vcard-avatar">${esc(initials(contact))}</div><div><h2>${esc(displayName(contact))}</h2><p>${esc(contact.company||'')}</p></div></header><dl><dt>${t('app.ln2.0cd6267c9810')}</dt><dd>${esc(contact.email||'—')}</dd><dt>${t('app.ln7.4adf5a2d0268')}</dt><dd>${esc(contact.phone||'—')}</dd><dt>${t('app.ln2.2a009b32d770')}</dt><dd>${esc(contact.address||'—')}</dd></dl></div><footer><span>vCard ${esc(preferences.vcardVersion||'3.0')}</span></footer>`;
      const exportButton=el('button','aqua-btn default',t('app.ln.8e2ef4560e'));
      pane.querySelector('footer').appendChild(exportButton);
      const cardWindow=System.createWindow({
        app:'addressbook', title:`${t('app.ln9.d840385557bc')}${displayName(contact)}`, width:470, height:390,
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
          parent:cardWindow,title:t('app.ln2.df68e8e8f347'),startPath:paths.downloads,
          name:`${displayName(contact)||t('app.ln.a5c71f3603')}.vcf`,extension:'vcf',typeLabel:'vCard',
          allowOverwrite:true,onSave:path=>VFS.putNode(path,{type:'file',content:lines.join('\r\n'),mime:'text/vcard',creator:'addressbook',generated:true}),
        });
      });
    };
    card.addEventListener('click',showCard);
    const createGroup=()=>System.promptSheet({
      parent:win,title:t('app.ln2.7410e281e7f9'),message:t('app.ln2.47147fad4c86'),value:t('app.ln2.34305a0ff365'),okLabel:t('ui.fcbd0932929e'),
      validate:name=>groups.some(item=>item.name.toLowerCase()===name.toLowerCase())?t('app.ln2.97ed8599e2c5'):true,
      onOK:name=>{
        const item={id:`group-${Date.now()}`,name};groups.push(item);save(AB_GROUPS_KEY,groups);
        group=item.id;selected=null;query='';search.value='';render();
      },
    });
    const deleteGroup=()=>{
      if(!group.startsWith('group-'))return;
      const item=groups.find(candidate=>candidate.id===group);if(!item)return;
      System.confirmSheet({
        parent:win,title:`${t('app.ln2.4ae5d44c35cf')}${t('ui.ffa09b4cc0e5')}${t('app.ln3.44beedc303bf')}`,okLabel:t('ui.3755f56f2f83'),danger:true,
        onOK:()=>{
          contacts.forEach(contact=>{if(contact.group===item.id)contact.group='friends';});
          const index=groups.indexOf(item);if(index>=0)groups.splice(index,1);
          save(AB_KEY,contacts);save(AB_GROUPS_KEY,groups);group='all';selected=null;render();
        },
      });
    };
    const pending=localStorage.getItem('macweb.addressbook.pending');if(pending){contacts.push({id:Date.now(),first:pending.split('@')[0],last:'',company:'',email:pending.includes('@')?pending:'',phone:'',address:'',note:t('app.ln2.3a76fe8a1ca2'),group:'friends'});localStorage.removeItem('macweb.addressbook.pending');save(AB_KEY,contacts);selected=contacts[contacts.length-1].id;}
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='addressbook')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('addressbook')||{};
      render();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    win=System.createWindow({app:'addressbook',title:t('ui.9070cb0eb695'),width:800,height:520,toolbar,content:root,statusbar:`${contacts.length} ${t('app.ln9.a963d1b13dc0')}`,onClose:()=>{
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
  System.registerApp({id:'addressbook',name:t('ui.9070cb0eb695'),icon:addressIcon,open:openAddressBook,about:t('app.ln2.3d8a3b02887c'),keywords:t('app.ln5.0e2cd8780c90')});

  // ---------- iChat ----------
  const CHAT_KEY='macweb.ichat.v1';
  const CHAT_BUDDIES_KEY='macweb.ichat.buddies.v1';
  const buddies=[['alex','Alex',t('ui.e91365cf9ed9')],['mei',t('app.ln.45993277c0'),t('app.ln2.989c9d802d8e')],['design',t('app.ln.7490040b37'),t('app.ln2.895e291c34f5')],['bonjour',t('app.ln2.712ded4cc118'),t('ui.e91365cf9ed9')],['oldmac',t('app.ln2.1fb11ee071ef'),t('ui.211357d22f4d')]];
  const chatIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="ichat-bubble" cx=".34" cy=".25"><stop stop-color="#d9ffd5"/><stop offset=".38" stop-color="#76d86c"/><stop offset="1" stop-color="#23912c"/></radialGradient><filter id="ichat-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".4"/></filter></defs><g filter="url(#ichat-shadow)"><path d="M6 27C6 14 17 6 32 6s26 8 26 21-11 22-26 22c-3 0-6 0-9-1L11 57l4-14C9 39 6 34 6 27z" fill="url(#ichat-bubble)" stroke="#176c22" stroke-width="1.5"/><path d="M13 17q19-12 39 1" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/><circle cx="23" cy="27" r="4" fill="#fff"/><circle cx="41" cy="27" r="4" fill="#fff"/><circle cx="24" cy="28" r="2" fill="#2e7d35"/><circle cx="42" cy="28" r="2" fill="#2e7d35"/><path d="M22 37q10 7 20 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g></svg>`;
  function openChatWith(id,name){
    let preferences=System.getAppPreferences?.('ichat')||{};
    const histories=jsonStore(CHAT_KEY,{});histories[id]=histories[id]||[{from:name,text:t('app.ln3.6025af86ea48'),at:t('app.ln3.a19440fb09f1')}];
    const root=el('div','chat-window');root.innerHTML=`<div class="chat-transcript"></div><div class="chat-compose"><textarea aria-label="${t('app.ln.0138091209')}"></textarea><button class="aqua-btn default">${t('app.ln3.d35413f85cf9')}</button></div>`;
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
    const render=()=>{transcript.innerHTML=histories[id].map(m=>`<div class="${m.from===t('app.ln4.3d70bb9626a6')?'mine':''}"><b>${esc(m.from)}</b><p>${esc(m.text)}</p><small>${esc(m.at)}</small></div>`).join('');transcript.scrollTop=transcript.scrollHeight;};
    const send=()=>{const text=textarea.value.trim();if(!text)return;histories[id].push({from:t('app.ln4.3d70bb9626a6'),text,at:t('app.ln2.99bb920d1103')});textarea.value='';persist();if(preferences.playSounds!==false)System.beep('pop',.12);render();replyTimer=setTimeout(()=>{histories[id].push({from:name,text:t('ichat.autoReply'),at:t('app.ln2.99bb920d1103')});persist();if(preferences.playSounds!==false)System.beep('ping',.1);render();},650);};
    root.querySelector('button').addEventListener('click',send);textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    const toolbar=el('div');const video=el('button','finder-toolbar-btn',t('app.ln3.355ac5219792'));const theater=el('button','finder-toolbar-btn','iChat Theater');const screen=el('button','finder-toolbar-btn',t('app.ln3.b5053eccf232'));toolbar.append(video,theater,screen);
    video.addEventListener('click',()=>System.launch('photobooth'));theater.addEventListener('click',()=>System.alertBox('iChat Theater',t('app.ln3.bc14a0242b5d')));screen.addEventListener('click',()=>System.alertBox(t('ui.ce88afb741bc'),t('app.ln3.092ffe19a1b8')));
    render();System.createWindow({app:'ichat',title:`${name} — iChat`,width:560,height:480,toolbar,content:root,statusbar:preferences.saveTranscripts===false?t('app.ln3.d77c028de373'):t('app.ln3.71d44ac49fe4'),onClose:()=>{
      clearTimeout(replyTimer);
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
  }
  function openIChat(){
    let preferences=System.getAppPreferences?.('ichat')||{};
    const buddyList=jsonStore(CHAT_BUDDIES_KEY,buddies);
    let selected=buddyList.find(item=>item[2]!==t('ui.211357d22f4d'))?.[0]||buddyList[0]?.[0]||null;
    let showOffline=!!preferences.offlineMessages,showPictures=true,win=null;
    const root=el('div','ichat-buddies');root.innerHTML=`<header><div class="ichat-avatar">R</div><div><b>roll</b><select><option>${t('app.ln.a48c934a0a')}</option><option>${t('app.ln.dac1b3c65d')}</option><option>${t('app.ln.f9876980e8')}</option></select><input class="aqua-input" value="${esc(t('app.ln.2d5abb806d'))}"></div></header><main></main><footer><button type="button">＋</button><button type="button">${t('app.ln7.bae7eab09df9')}</button><button type="button">${t('app.ln2.5f97afa1261f')}</button><button type="button">${t('app.ln2.541a4a985ed1')}</button></footer>`;
    const main=root.querySelector('main'),footerButtons=[...root.querySelectorAll('footer button')];
    while (footerButtons.length < 4) footerButtons.push(el('button'));
    const current=()=>buddyList.find(item=>item[0]===selected);
    const render=()=>{
      const visible=buddyList.filter(item=>showOffline||item[2]!==t('ui.211357d22f4d'));
      if(!visible.some(item=>item[0]===selected))selected=visible[0]?.[0]||null;
      main.innerHTML='<h4>AIM / Bonjour</h4>'+visible.map(([id,name,status])=>`<button data-id="${esc(id)}" data-name="${esc(name)}" class="${id===selected?'sel':''} ${status===t('ui.211357d22f4d')?'offline':''}"><i>${esc(name.slice(0,1))}</i><span><b>${esc(name)}</b><small>${esc(status)}</small></span></button>`).join('');
      root.classList.toggle('hide-pictures',!showPictures);
      if(win){
        win.dataset.showOffline=String(showOffline);
        win.dataset.buddyPictures=String(showPictures);
        const online=buddyList.filter(item=>item[2]!==t('ui.211357d22f4d')).length;
        win.querySelector('.win-statusbar').textContent=`${online} ${t('app.ln9.98975ab8591c')} · ${buddyList.length} ${t('app.ln9.4f3939b44dc9')}`;
      }
    };
    const openSelected=()=>{const item=current();if(item)openChatWith(item[0],item[1]);};
    const addBuddy=()=>System.promptSheet({
      parent:win,title:t('app.ln3.12aca7dcfe3e'),message:t('app.ln3.ab1c12cd6598'),placeholder:t('app.ln3.74b2f8d7ff1f'),okLabel:t('ui.94191ce210d3'),
      validate:name=>buddyList.some(item=>item[1].toLowerCase()===name.toLowerCase())?t('app.ln3.dfc718cbd674'):true,
      onOK:name=>{const id=`buddy-${Date.now()}`;buddyList.push([id,name,t('ui.e91365cf9ed9')]);save(CHAT_BUDDIES_KEY,buddyList);selected=id;render();},
    });
    const videoChat=()=>{const item=current();if(!item)return;Leopard.toast('iChat', t('ui.15be32cd5ad7')); System.launch('photobooth');};
    const audioChat=()=>{const item=current();if(item)openChatWith(item[0],item[1]);};
    const screenShare=()=>{const item=current();System.alertBox(t('ui.ce88afb741bc'),item?t('ichat.shareInvite',{name:item[1]}):t('app.ln6.2389d9b9fb39'));};
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
    win=System.createWindow({app:'ichat',title:'iChat',width:330,height:520,content:root,statusbar:t('app.ln3.fe4a464fa299'),onClose:()=>{
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const actions={
        'new-chat':openSelected,'add-buddy':addBuddy,
        'buddy-info':()=>{const item=current();if(item)System.alertBox(t('app.ln3.2b49690caaf2'),`${item[1]}\n${t('app.ln9.49f34738ee5f')}${item[2]}\n${t('app.ln9.8299062f37d8')}AIM / Bonjour`);},
        'video-chat':videoChat,'audio-chat':audioChat,'screen-share':screenShare,
        'toggle-buddy-pictures':()=>{showPictures=!showPictures;render();},
        'toggle-offline-buddies':()=>System.updateAppPreferences?.('ichat',{offlineMessages:!showOffline}),
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'ichat',name:'iChat',icon:chatIcon,open:openIChat,multiWindow:true,about:t('ichat.about'),keywords:t('ichat.keywords')});

  // ---------- Dictionary ----------
  const dictionaryIcon=icon('dict','#cf3e34','#78150f','<path d="M14 12h31q5 0 5 5v35H19q-5 0-5-5z" fill="#f7efe1" stroke="#70231d" stroke-width="1.5"/><path d="M20 12v40M25 22h19M25 28h16M25 34h18" stroke="#b45a50" stroke-width="2"/><text x="35" y="47" text-anchor="middle" font-size="12" fill="#8e2019" stroke="none">Aa</text>');
  const WORDS={
    leopard:{title:'leopard',phonetic:'/ˈlepərd/',type:'noun',definitions:[t('app.ln3.2510aad0d63f'),t('app.ln3.8479ce7298ce')],synonyms:['panther','big cat'],apple:t('dict.leopard.apple')},
    finder:{title:'Finder',phonetic:'/ˈfaɪndər/',type:'proper noun',definitions:[t('app.ln3.fa3be7d10024')],synonyms:['file browser','desktop shell'],apple:t('app.ln3.8fcc33f5f280')},
    aqua:{title:'Aqua',phonetic:'/ˈɑːkwə/',type:'proper noun',definitions:[t('app.ln3.b2589d17bcf1'),t('app.ln3.64b2ec23a9d9')],synonyms:['water','aquamarine'],apple:t('app.ln3.c8468a159d79')},
    dock:{title:'Dock',phonetic:'/dɒk/',type:'noun',definitions:[t('app.ln3.37f734e7157c'),t('app.ln3.ba21304fb20f')],synonyms:['pier','wharf'],apple:t('app.ln3.71175ed133a7')},
    spotlight:{title:'Spotlight',phonetic:'/ˈspɒtlaɪt/',type:'noun',definitions:[t('app.ln3.515394a6089e'),t('app.ln3.b2c9b796c9a5')],synonyms:['limelight','focus'],apple:t('app.ln3.b072ea0a86d6')},
    dashboard:{title:'Dashboard',phonetic:'/ˈdæʃbɔːrd/',type:'noun',definitions:[t('app.ln3.573fa65d52c9')],synonyms:['control panel','instrument panel'],apple:t('app.ln3.38c7ff950bcd')},
    quartz:{title:'Quartz',phonetic:'/kwɔːrts/',type:'noun',definitions:[t('app.ln3.546f73b3979b')],synonyms:['silica','crystal'],apple:t('app.ln3.7ffd2079caca')},
    safari:{title:'Safari',phonetic:'/səˈfɑːri/',type:'noun',definitions:[t('app.ln3.16238f6a10b9')],synonyms:['expedition','journey'],apple:t('app.ln3.2901304ad2a8')},
    preview:{title:'Preview',phonetic:'/ˈpriːvjuː/',type:'noun / verb',definitions:[t('app.ln3.acc9929071df'),t('app.ln3.f035480d77ec')],synonyms:['advance view','sample'],apple:t('app.ln3.e75720898bce')},
    voiceover:{title:'VoiceOver',phonetic:'/ˈvɔɪsˌəʊvə/',type:'noun',definitions:[t('app.ln3.ef5f9c2c0165')],synonyms:['narration','commentary'],apple:t('app.ln3.e4a6fa224098')},
    trash:{title:'trash',phonetic:'/træʃ/',type:'noun / verb',definitions:[t('app.ln3.ac33bbee1f30'),t('app.ln3.0044f55b8854')],synonyms:['rubbish','waste','discard'],apple:t('app.ln3.1de0b7b0d534')},
    window:{title:'window',phonetic:'/ˈwɪndəʊ/',type:'noun',definitions:[t('app.ln4.c79872c1e69c'),t('app.ln4.9e813579a2b7')],synonyms:['opening','pane'],apple:t('app.ln5.a318f32fa19a')},
    file:{title:'file',phonetic:'/faɪl/',type:'noun / verb',definitions:[t('app.ln5.7fc02c82f1d0'),t('app.ln5.1f46e531e7de')],synonyms:['document','record'],apple:t('app.ln5.7d371f966657')},
    desktop:{title:'desktop',phonetic:'/ˈdesktɒp/',type:'noun',definitions:[t('app.ln5.8487213cea69'),t('app.ln5.26311d83ba2d')],synonyms:['workspace','work surface'],apple:t('app.ln5.74530a06799a')},
    network:{title:'network',phonetic:'/ˈnetwɜːk/',type:'noun / verb',definitions:[t('app.ln5.3d0c545f22fa'),t('app.ln5.b723d43e6c04')],synonyms:['system','web','connect'],apple:t('app.ln5.f4d316bce86a')},
    bluetooth:{title:'Bluetooth',phonetic:'/ˈbluːtuːθ/',type:'proper noun',definitions:[t('app.ln5.4e2383b54689')],synonyms:['wireless link'],apple:t('dict.bluetooth.apple')},
    microphone:{title:'microphone',phonetic:'/ˈmaɪkrəfəʊn/',type:'noun',definitions:[t('app.ln5.b3337989dd92')],synonyms:['mic','transducer'],apple:t('app.ln5.dcd69c663ade')},
    hello:{title:'hello',phonetic:'/həˈləʊ/',type:'exclamation / noun',definitions:[t('app.ln5.3241d184b70f')],synonyms:['hi','greetings'],apple:t('app.ln5.1bfcfafb313a')},
    apple:{title:'apple',phonetic:'/ˈæpəl/',type:'noun',definitions:[t('app.ln5.76cc439321d8')],synonyms:['fruit'],apple:t('app.ln5.176469323382')},
    dictionary:{title:'dictionary',phonetic:'/ˈdɪkʃəneri/',type:'noun',definitions:[t('app.ln5.e57b260650b5')],synonyms:['lexicon','wordbook'],apple:t('app.ln5.6c1e9973742d')},
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
    [['definition',t('app.ln5.7755f75dc53c')],['thesaurus',t('app.ln2.e6d9b18df34f')],['apple','Apple'],['wikipedia','Wikipedia']].forEach(([id,n])=>{const b=el('button','finder-toolbar-btn',n);b.dataset.tab=id;tabs.appendChild(b);});
    const searchWrap=el('div','dict-search-wrap');
    const search=el('input','aqua-input aqua-search');search.value=word;search.placeholder = t('app.ln5.109355f12601');
    const searchButton=el('button','aqua-btn default',t('app.ln5.07bfbf387d65'));
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
      makeSection(query?t('app.ln5.0270d590e4fa'):t('app.ln5.5e98e33bee87'),direct.length?direct:related(query));
      makeSection(t('app.ln5.351139df2d8d'),history.filter(item=>!direct.includes(item)).slice(0,8));
    };
    const renderFooter=(source)=>{
      const footer=el('footer');
      footer.textContent=`${t('app.ln9.b6f7e5ebb2f8')}${source} · ${t('app.ln9.da252992230d')}`;
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
        const speak=el('button','dict-speak',t('app.ln5.4bfe47631acd'));
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
      renderFooter(entry.source||t('ui.06b836c24537'));
    };
    const renderThesaurus=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');
      const synonyms=[...(entry.synonyms||[]),...(entry.meanings||[]).flatMap(item=>item.synonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      const antonyms=[...(entry.antonyms||[]),...(entry.meanings||[]).flatMap(item=>item.antonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      heading('h4',t('app.ln2.e6d9b18df34f'));const syn=el('div','dict-word-cloud');
      (synonyms.length?synonyms:[t('app.ln5.34993e4cc516')]).slice(0,24).forEach(text=>{const b=el('button','',text);if(synonyms.length)b.addEventListener('click',()=>lookup(text));else b.disabled=true;syn.appendChild(b);});article.appendChild(syn);
      heading('h4',t('app.ln5.24f9cf636e2c'));paragraph(antonyms.length?antonyms.slice(0,16).join('、'):t('app.ln5.5e8070292d0c'));
      renderFooter(entry.source||t('ui.06b836c24537'));
    };
    const renderApple=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');heading('h4',t('app.ln5.8e6ddd5f893e'));
      if(entry.apple)paragraph(entry.apple,'dict-apple-entry');
      else paragraph(t('app.ln5.7d3a175887a3'),'dict-notice');
      const terms=Object.keys(WORDS).filter(key=>WORDS[key].apple).slice(0,14);const links=el('div','dict-word-cloud');
      terms.forEach(key=>{const b=el('button','',WORDS[key].title);b.addEventListener('click',()=>lookup(key));links.appendChild(b);});article.appendChild(links);
      renderFooter(t('app.ln5.7b1e4e7bde5e'));
    };
    const renderWikipedia=async()=>{
      const id=++requestId;abort?.abort();abort=new AbortController();
      article.innerHTML='';heading('h1',word);paragraph(t('app.ln5.3cc52945e0db'),'dict-loading');
      const endBusy=System.beginBusy(180);
      try{
        const lang=/[\u3400-\u9fff]/.test(word)?'zh':'en';
        const response=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,{signal:abort.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error(response.status===404?t('app.ln5.626df9ece586'):`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        article.innerHTML='';heading('h1',data.title||word);
        if(data.thumbnail?.source){const img=el('img','dict-wiki-image');img.src=data.thumbnail.source;img.alt='';article.appendChild(img);}
        paragraph(data.description||t('app.ln5.7168edc33424'),'phonetic');
        paragraph(data.extract||t('app.ln5.6a7d0f63aeb8'),'dict-wiki-extract');
        if(data.content_urls?.desktop?.page){const a=el('a','dict-source-link',t('app.ln5.e6de7a83e094'));a.href=data.content_urls.desktop.page;a.target='_blank';a.rel=`noopener noreferrer`;article.appendChild(a);}
        renderFooter(`${lang}.wikipedia.org${t('app.ln9.1393ac09d204')}`);
      }catch(error){
        if(error.name==='AbortError')return;
        article.innerHTML='';heading('h1',word);paragraph(t('ui.feb7658ff0ff'),'dict-notice');
        const retry=el('button','aqua-btn default',t('app.ln5.2d64b3ce122b'));retry.addEventListener('click',renderWikipedia);article.appendChild(retry);
        renderFooter(t('app.ln5.10f33e8264cb'));
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
        entry={title:query,type:'',definitions:[t('ui.fa1505ff80be')],synonyms:[],source:t('ui.06b836c24537')};
        audioUrl='';render();pronounceIfPreferred();return;
      }
      if(remoteCache.has(query)){entry=remoteCache.get(query);audioUrl=entry.audio||'';render();pronounceIfPreferred();return;}
      const id=++requestId;abort?.abort();abort=new AbortController();
      entry={title:query,type:'',definitions:[t('app.ln5.f8d3234cd0ef')],synonyms:[],source:t('app.ln5.7ca9cdfb7da8')};audioUrl='';renderDefinition();
      const endBusy=System.beginBusy(180);
      try{
        const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,{signal:abort.signal});
        if(!response.ok)throw new Error(response.status===404?t('app.ln5.225b7b138486'):`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        const first=data[0]||{};
        entry={title:first.word||query,phonetic:first.phonetic||first.phonetics?.find(p=>p.text)?.text||'',meanings:first.meanings||[],synonyms:(first.meanings||[]).flatMap(m=>m.synonyms||[]),antonyms:(first.meanings||[]).flatMap(m=>m.antonyms||[]),audio:first.phonetics?.find(p=>p.audio)?.audio||'',source:'Free Dictionary API'};
        remoteCache.set(query,entry);audioUrl=entry.audio||'';render();pronounceIfPreferred();
      }catch(error){
        if(error.name==='AbortError')return;
        entry={title:query,type:'',definitions:[`${error.message}. ${t('app.ln9.2da0cee168fd')}`],synonyms:[],source:t('ui.1acb10384f91')};audioUrl='';render();
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
        Leopard.toast('Dictionary',selected?t('ui.7f3acd8aab15'):t('ui.a09eeb432c0f'));
      }catch(error){System.alertBox('Dictionary',t('ui.46bb25e07540'));}
    };
    const previousEntry=()=>{if(history[1])lookup(history[1]);};
    const clearHistory=()=>{
      history=[];save(HISTORY_KEY,history);renderIndex();updateWindowState();
      Leopard.toast('Dictionary',t('app.ln5.68ef6fc034b9'));
    };
    tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();}});
    index.addEventListener('click',e=>{const b=e.target.closest('[data-word]');if(b)lookup(b.dataset.word);});
    search.addEventListener('input',()=>renderIndex());
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup();}});
    searchButton.addEventListener('click',()=>lookup());
    render();win=System.createWindow({app:'dictionary',title:'Dictionary',width:850,height:570,toolbar,content:root,statusbar:t('ui.b8076eb2792c'),onClose:()=>{
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
  System.registerApp({id:'dictionary',name:'Dictionary',icon:dictionaryIcon,open:openDictionary,about:t('ui.d4d8317f8bb1'),keywords:t('ui.82a409c4a7c9')});

  // ---------- Photo Booth ----------
  const photoIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="pb-curtain" x2="0" y2="1"><stop stop-color="#f14f5b"/><stop offset=".5" stop-color="#a50f24"/><stop offset="1" stop-color="#4f0712"/></linearGradient><radialGradient id="pb-lens"><stop stop-color="#aee9ff"/><stop offset=".35" stop-color="#397fbd"/><stop offset=".7" stop-color="#152a52"/><stop offset="1" stop-color="#050814"/></radialGradient><filter id="pb-icon-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".45"/></filter></defs><g filter="url(#pb-icon-shadow)"><path d="M7 7h50v50H7z" fill="url(#pb-curtain)" stroke="#6c0c19"/><path d="M7 7q8 12 0 25t0 25M57 7q-8 12 0 25t0 25" fill="none" stroke="#ff7882" stroke-width="5" opacity=".7"/><rect x="15" y="16" width="34" height="32" rx="5" fill="#292a2e" stroke="#eef3f6" stroke-width="1.5"/><rect x="23" y="11" width="18" height="8" rx="3" fill="#e9edf0" stroke="#666"/><circle cx="32" cy="33" r="12" fill="url(#pb-lens)" stroke="#bce7ff" stroke-width="2"/><circle cx="32" cy="33" r="4" fill="#9ee4ff"/><circle cx="44" cy="24" r="2" fill="#ffda58"/></g></svg>`;
  function openPhotoBooth(){
    let preferences=System.getAppPreferences?.('photobooth')||{};
    const DESKTOP=paths.desktop;
    const PHOTO_DIR=`${paths.pictures}/Photo Booth`;
    const effects=[
      {name:t('app.ln5.5894757bc9b0'),value:'',tone:'#627c90'},
      {name:t('ui.dd742f472f6d'),value:'grayscale(1)',tone:'#737373'},
      {name:t('app.ln5.f539d3c41223'),value:'sepia(1)',tone:'#91744f'},
      {name:t('app.ln5.73c3923ba5a4'),value:'hue-rotate(120deg) saturate(1.7)',tone:'#568da2'},
      {name:t('app.ln5.018d6b292517'),value:'contrast(2) saturate(2)',tone:'#c84678'},
      {name:t('app.ln5.35367281646f'),value:'invert(1)',tone:'#17274b'},
      {name:t('app.ln5.7d959a2cf572'),value:'contrast(1.7) saturate(.5)',tone:'#b95640'},
      {name:t('app.ln5.c5f5ae39a923'),value:'hue-rotate(245deg) saturate(3)',tone:'#d54d25'},
      {name:t('ui.e749c6f746d7'),value:'brightness(1.18) saturate(.75)',tone:'#b8a8bd'},
    ];
    const emptyStripMarkup=()=>`<div class="pb-strip-empty"><div class="pb-empty-film" aria-hidden="true">${Array.from({length:6},()=>'<i></i>').join('')}</div><span>${t('app.ln7.88bca801f9dd')}</span></div>`;
    if(!VFS.isDir(PHOTO_DIR))VFS.mkdir(PHOTO_DIR);
    const root=el('div','pb-app');
    root.innerHTML=`<div class="pb-stage"><video autoplay muted playsinline></video><div class="pb-placeholder"><i>${photoIcon}</i><b>Photo Booth</b><span>${t('app.ln7.cbac543089d0')}</span></div><div class="pb-camera-state">${t('app.ln.f761be3855')}</div><div class="pb-countdown"></div><div class="pb-flash"></div></div>
      <div class="pb-controls"><button class="camera" title= t('app.ln.9827da851a') aria-label="${t('app.ln.9827da851a')}"><span></span></button><button class="shot" title= t('app.ln.2e8b8b6419') aria-label="${t('app.ln.2e8b8b6419')}" disabled>●</button><button class="aqua-btn pb-effects">${t('app.ln.47cf52b158')}</button><label class="pb-effect-picker">${t('app.ln2.8fb9ab14aa79')}<select class="pb-effect aqua-select" aria-label="${t('app.ln.43f3ccbada')}">${effects.map(effect=>`<option value="${esc(effect.value)}">${esc(effect.name)}</option>`).join('')}</select></label><button class="aqua-btn pb-reveal" disabled>${t('app.ln2.8dac46de1e85')}</button></div>
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
      placeholder.style.display='grid';camera.classList.remove('on');camera.title = t('app.ln.9827da851a');shot.disabled=true;
      state.textContent=t('app.ln.f761be3855');
      updateWindowState();
    };
    camera.addEventListener('click',async()=>{
      if(stream){stopCamera();return;}
      if(!navigator.mediaDevices?.getUserMedia){System.alertBox('Photo Booth',t('ui.0a480c851ecd'));return;}
      const endBusy=System.beginBusy(160);
      camera.disabled=true;state.textContent=t('app.ln5.d87e1a0f1626');
      updateWindowState();
      try{
        const grantedStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
        if(disposed){
          grantedStream.getTracks().forEach(track=>track.stop());
          return;
        }
        stream=grantedStream;
        video.srcObject=stream;await video.play();
        placeholder.style.display='none';camera.classList.add('on');camera.title = t('ui.c442d022b3b1');shot.disabled=false;
        const track=stream.getVideoTracks()[0];
        state.textContent=`${t('app.ln9.812401a05a64')}${track?.label||t('app.ln.470679e713')}`;
        track?.addEventListener('ended',stopCamera,{once:true});
        updateWindowState();
      }catch(error){
        if(disposed)return;
        stopCamera();
        state.textContent=error?.name==='NotAllowedError'?t('app.ln5.8fbae761180e'):t('ui.b88f4b197548');
        System.alertBox('Photo Booth',error?.name==='NotAllowedError'?t('app.ln5.2fcfac72d729'):t('ui.df68981f16dd'));
      }finally{if(!disposed)camera.disabled=false;endBusy();updateWindowState();}
    });
    const setEffect=(value)=>{
      if(![...effectSelect.options].some(option=>option.value===value))value='';
      effectSelect.value=value;video.style.filter=value;updateWindowState();
    };
    effectSelect.addEventListener('change',event=>setEffect(event.target.value));
    const showEffects=()=>{
      const pane=el('div','pb-effects-browser');
      pane.innerHTML=`<header><b>${t('app.ln7.2855daf28647')}</b><span>${t('app.ln9.739572b1fd6b')}</span></header><div>${effects.map(effect=>`<button data-effect="${esc(effect.value)}" class="${effect.value===effectSelect.value?'selected':''}"><i style="--pb-effect-tone:${effect.tone};filter:${esc(effect.value)||'none'}">${photoIcon}</i><span>${esc(effect.name)}</span></button>`).join('')}</div>`;
      let api=null;
      pane.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',()=>{
        setEffect(button.dataset.effect);
        api?.close('effect');
      }));
      api=System.showSheet({parent:win,title:t('ui.151ddd4f1f9f'),content:pane,className:'pb-effects-sheet',buttons:[{label:t('ui.4d0b4688c787'),cancel:true}]});
    };
    effectsButton.addEventListener('click',showEffects);
    shot.addEventListener('click',async()=>{
      if(!stream||capturing)return System.alertBox('Photo Booth', t('app.ln9.b95fb4bc0f9f') + t('app.ln2.cc0e02b3b2eb'));
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
      if(saved){addPhoto(path,true);state.textContent=`${t('app.ln9.54f580081ec2')}${name}${t('app.ln9.991e4b0a977b')}${destination===DESKTOP?t('ui.65fdeb927bb9'):t('ui.be8da62ea113')}`;Leopard.toast('Photo Booth', t('photobooth.savedToast', { name, place: destination===DESKTOP?t('ui.65fdeb927bb9'):t('ui.be8da62ea113') }));}
      else System.alertBox('Photo Booth',t('ui.c5b13f1b52ac'));
      capturing=false;shot.disabled=!stream;updateWindowState();
    });
    const openSelected=()=>{if(selectedPath)System.openVfsPath(selectedPath);};
    const revealSelected=()=>System.launch('finder',{path:selectedPath?VFS.parentOf(selectedPath):DESKTOP});
    const deleteSelected=()=>{
      if(!selectedPath)return;
      const path=selectedPath;
      System.confirmSheet({
        parent:win,headline:t('photobooth.moveToTrash',{name:VFS.baseName(path)}),
        message:t('ui.2145b8ebb202'),
        okLabel:t('ui.e25762f172c1'),danger:true,onOK:()=>{
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
  System.registerApp({id:'photobooth',name:'Photo Booth',icon:photoIcon,open:openPhotoBooth,about:t('ui.79b97faee18e'),keywords:t('ui.d18c18160ecf')});

  // ---------- QuickTime Player / DVD Player ----------
  const qtIcon=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="qt-face" cx=".35" cy=".28"><stop stop-color="#e4f1ff"/><stop offset=".35" stop-color="#78a9e8"/><stop offset="1" stop-color="#263f8b"/></radialGradient><linearGradient id="qt-ring" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#9aa6b7"/><stop offset="1" stop-color="#e4e9ef"/></linearGradient><filter id="qt-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".45"/></filter></defs><g filter="url(#qt-shadow)"><circle cx="31" cy="31" r="28" fill="url(#qt-ring)" stroke="#5f6875"/><circle cx="31" cy="31" r="23" fill="url(#qt-face)" stroke="#e5f2ff"/><path d="M22 18h18v27H22zM14 25h34v13H14z" fill="#eef6ff" fill-rule="evenodd"/><path d="M38 38l15 15" stroke="#304883" stroke-width="8" stroke-linecap="round"/><path d="M39 39l14 14" stroke="#dce8fa" stroke-width="3" stroke-linecap="round"/></g></svg>`;
  function openQuickTime(arg){
    let preferences=System.getAppPreferences?.('quicktime')||{};
    const toolbar=el('div');
    const open=el('button','finder-toolbar-btn',t('ui.7e736d9399d0'));
    const fromLocal=el('button','finder-toolbar-btn',t('ui.0db9276c75dc'));
    const info=el('button','finder-toolbar-btn',t('ui.be9b82df8e7a'));
    toolbar.append(open,fromLocal,info);
    const root=el('div','qt-app');
    root.innerHTML=`<div class="qt-screen"><video preload="metadata"></video><div class="qt-welcome"><b>QuickTime Player</b><span>${t('app.ln7.63fe2da4343b')}</span></div></div><footer><button type="button" title="${esc(t('qt.skipBack'))}">◀◀</button><button type="button" class="qt-play" title="${esc(t('app.ln5.88e7d033ffa1'))}">▶</button><button type="button" title="${esc(t('app.ln8.2a1b4b5a8311'))}">▶▶</button><input class="qt-position" type="range" min="0" max="1000" value="0"><span>00:00 / 00:00</span><input class="qt-volume" type="range" min="0" max="100" value="80" title="${esc(t('ui.1aa999a5963f'))}"><input class="qt-file" type="file" accept="video/*,audio/*"></footer>`;
    const video=root.querySelector('video'),welcome=root.querySelector('.qt-welcome'),file=root.querySelector('.qt-file');
    const footerButtons=[...root.querySelectorAll('footer button')],playButton=root.querySelector('.qt-play')||footerButtons[1];
    const position=root.querySelector('.qt-position'),volume=root.querySelector('.qt-volume'),timeLabel=root.querySelector('footer span');
    while (footerButtons.length < 3) footerButtons.push(el('button'));
    let win=null,currentUrl='',currentMeta={name:t('ui.b70a6789bf10'),type:'',size:null,path:''},theaterMode=false;
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
      currentMeta={name:source.name||t('ui.3dfa0b08a9ad'),type:source.type||'',size:source.size??null,path:source.path||''};
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
        parent:win,title:t('ui.c98652ecd0c9'),startPath:paths.movies,types:mediaTypes,
        allowUpload:false,onOpen:(path)=>loadVfsPath(path),
      });
    }
    const showInspector=()=>{
      const pane=el('div','qt-inspector');
      const rows=[
        [t('ui.1be7ae4fc257'),currentMeta.name],
        [t('app.ln5.b2cb9370d85a'),currentMeta.type||'—'],
        [t('ui.fd20702c73d1'),currentMeta.size!=null?`${(currentMeta.size/1048576).toFixed(2)} MB`:'—'],
        [t('ui.88c34452cc46'),currentMeta.path||t('ui.8f78200477a6')],
        [t('app.ln.15d9dca28b'),video.videoWidth?`${video.videoWidth} × ${video.videoHeight}`:'—'],
        [t('app.ln5.6af67e9637ec'),video.duration?time(video.duration):'—'],
        [t('ui.40d9cb2d8e5a'),video.loop?t('app.ln4.580c90008806'):t('app.ln4.328c5b579d1c')],
      ];
      pane.innerHTML=`<header><b>${t('app.ln5.d6da4e7d160e')}</b><span>ⓘ</span></header><dl></dl>`;
      const dl=pane.querySelector('dl');
      rows.forEach(([key,value])=>{dl.append(el('dt','',key),el('dd','',value));});
      System.createWindow({
        app:'quicktime', title:t('ui.a22d2cea98a7'), width:340, height:325, content:pane,
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
      win.querySelector('.win-statusbar').textContent=`${video.videoWidth||t('app.ln2.5f97afa1261f')}${video.videoWidth?` × ${video.videoHeight}`:''} · ${time(video.duration)}`;
      resizePlayer('fit');
    });
    video.addEventListener('dblclick',()=>{
      theaterMode=!theaterMode;
      win.querySelector('.tl-zoom')?.click();
      applyPreferences();
    });
    info.addEventListener('click',showInspector);
    win=System.createWindow({
      app:'quicktime',title:'QuickTime Player',width:720,height:500,toolbar,content:root,statusbar:t('ui.0710d61dc4ab'),
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
        'toggle-loop':()=>{video.loop=!video.loop;win.dataset.loop=String(video.loop);Leopard.toast('QuickTime Player',video.loop?t('ui.f7cb5dffed7b'):t('ui.c15b10792701'));},
        'show-inspector':showInspector,
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    if(arg?.path)loadVfsPath(VFS.normalize(arg.path));
    else if(arg?.src)loadSource({src:arg.src,name:arg.name||t('ui.3dfa0b08a9ad'),type:arg.mime||'',size:arg.size??null,path:arg.path||''});
  }
  System.registerApp({id:'quicktime',name:'QuickTime Player',icon:qtIcon,open:openQuickTime,about:t('ui.1210e3ef0765'),keywords:t('ui.f95db9fa36db')});

  const dvdIcon=icon('dvd','#323741','#0b0d12','<circle cx="32" cy="32" r="21" fill="#d8dde5" stroke="#fff" stroke-width="1.5"/><circle cx="32" cy="32" r="9" fill="#6d7480"/><circle cx="32" cy="32" r="3" fill="#15171c"/><path d="M32 11v12M50 22l-11 6M48 45l-10-7M16 44l10-7M14 21l12 7" stroke="#8d96a2" stroke-width="2"/>');
  function openDVD(){
    const chapters=[
      {title:t('app.ln5.a91e791e474e'),duration:96,speed:.34,zh:t('app.ln5.e044ef41f13e'),en:'In the darkness, a new light awakens.'},
      {title:t('ui.f42c3fef0f31'),duration:82,speed:.55,zh:t('app.ln5.f3762efa55c7'),en:'The crystalline interface unfolds among the stars.'},
      {title:t('ui.76fc7a86c711'),duration:109,speed:.72,zh:t('ui.a454ae009d0f'),en:'Welcome back to Mac OS X Leopard.'},
    ];
    const subtitleTracks=[t('ui.6c14bd7f6f9e'),t('app.ln2.8d98e03c7869'),'English'];
    const audioTracks=['English — Dolby Digital 5.1',t('ui.9bfa94d0692a'),t('ui.3d42db42c219')];
    const root=el('div','dvd-app');
    root.tabIndex=0;
    root.innerHTML=`<section class="dvd-stage">
      <canvas aria-hidden="true"></canvas>
      <header class="dvd-hud"><span>DVD VIDEO</span><b></b><time></time></header>
      <div class="dvd-title"><small>DVD VIDEO</small><b>LEOPARD</b><span>AN AQUA EXPERIENCE</span><em></em></div>
      <div class="dvd-subtitle" aria-live="polite"></div>
      <div class="dvd-menu-overlay" hidden>
        <div><small>LEOPARD</small><h2>${t('app.ln7.4788f757d41f')}</h2><p>AN AQUA EXPERIENCE</p>
          <nav aria-label="${t('app.ln5.b3e1cadb222b')}">
            <button data-menu-action="resume">${t('app.ln7.e09c6bee51f3')}</button>
            ${chapters.map((chapter,index)=>`<button data-menu-chapter="${index}">${index+1}. ${chapter.title}</button>`).join('')}
          </nav>
        </div>
      </div>
      <div class="dvd-choice-panel" hidden></div>
      <div class="dvd-osd" aria-live="polite"></div>
    </section>
    <footer>
      <button class="dvd-menu" title= t('app.ln5.2ca17dce6cd0')>${t('app.ln7.e218d80f57c8')}</button>
      <button class="dvd-previous" title= t('app.ln5.a0132469aab7')>◀◀</button>
      <button class="dvd-play play" title= t('app.ln5.88e7d033ffa1')>❚❚</button>
      <button class="dvd-next" title= t('app.ln5.759139a1976a')>▶▶</button>
      <button class="dvd-subtitles" title= t('app.ln5.280a7469e861')>${t('app.ln2.36ebe2bf31ce')}</button>
      <button class="dvd-audio" title= t('app.ln5.c7cc2614b684')>${t('app.ln2.5f97afa1261f')}</button>
      <label>${t('app.ln2.d12e170cfa01')} <select class="dvd-chapter" aria-label="${t('app.ln2.d12e170cfa01')}">${chapters.map((chapter,index)=>`<option value="${index}">${t('app.ln9.637d0845bb09')}${index+1}${t('app.ln9.53cfc6b79416')}</option>`).join('')}</select></label>
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
    let subtitleTrack=t('app.ln2.8d98e03c7869');
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
      titleChapter.textContent=`${t('app.ln9.637d0845bb09')}${chapterIndex+1}${t('app.ln9.8974dd42f0e1')}${chapter.title}`;
      hudChapter.textContent=`${chapterIndex+1}/${chapters.length}  ${chapter.title}`;
      hudTime.textContent=`${formatTime(elapsed)} / ${formatTime(chapter.duration)}`;
      status.textContent=`${formatTime(elapsed)}  ·  ${audioTrack.replace(/ — .*/, '')}`;
      subtitle.textContent=subtitleTrack===t('app.ln2.8d98e03c7869')?chapter.zh:subtitleTrack==='English'?chapter.en:'';
      subtitle.hidden=subtitleTrack===t('ui.6c14bd7f6f9e')||menuVisible;
      playButton.textContent=playing&&!menuVisible?'❚❚':'▶';
      playButton.title=playing&&!menuVisible?t('ui.130448bce675'):t('ui.21925350deba');
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
      showOSD(playing?t('ui.21925350deba'):t('ui.130448bce675'));
    };
    const goChapter=(next,autoplay=true)=>{
      chapterIndex=(Number(next)+chapters.length)%chapters.length;
      elapsed=0;
      menuVisible=false;
      playing=autoplay;
      choicePanel.hidden=true;
      restartRenderer();
      render();
      showOSD(`${t('app.ln9.637d0845bb09')}${chapterIndex+1}${t('app.ln9.8974dd42f0e1')}${chapters[chapterIndex].title}`);
    };
    const previousChapter=()=>{
      if(elapsed>5){elapsed=0;render();showOSD(t('app.ln5.f669446301b7'));}
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
      subtitleTrack=subtitleTracks.includes(value)?value:t('ui.6c14bd7f6f9e');
      choicePanel.hidden=true;
      render();
      showOSD(`${t('app.ln9.2fe7a6d143f7')}${subtitleTrack}`);
    };
    const chooseAudio=(value)=>{
      audioTrack=audioTracks.includes(value)?value:audioTracks[0];
      choicePanel.hidden=true;
      render();
      showOSD(`${t('app.ln9.3de2cfa64e90')}${audioTrack}`);
    };
    const showChoices=(kind)=>{
      const values=kind==='subtitle'?subtitleTracks:audioTracks;
      const current=kind==='subtitle'?subtitleTrack:audioTrack;
      choicePanel.innerHTML=`<header>${kind==='subtitle'?t('app.ln2.36ebe2bf31ce'):t('app.ln2.5f97afa1261f')}</header>${values.map(value=>`<button data-choice="${value}" data-kind="${kind}" class="${value===current?'selected':''}"><span>${value===current?'✓':''}</span>${value}</button>`).join('')}`;
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
        'subtitles-off':()=>chooseSubtitle(t('ui.6c14bd7f6f9e')),
        'subtitles-zh':()=>chooseSubtitle(t('app.ln2.8d98e03c7869')),
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
    win=System.createWindow({app:'dvdplayer',title:t('ui.788bf03a8d72'),width:760,height:520,content:root,onClose:()=>{
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
  System.registerApp({id:'dvdplayer',name:t('ui.869027be3da4'),icon:dvdIcon,open:openDVD,about:t('ui.bffaca47b142'),keywords:t('ui.bcfdbc9b2d17')});

  // ---------- Automator ----------
  const automatorIcon=icon('auto','#d5d8dd','#737984','<path d="M19 14h27v36H19z" fill="#f3f3f3" stroke="#444" stroke-width="1.5"/><path d="M24 22h17M24 28h17M24 34h12" stroke="#777" stroke-width="2"/><circle cx="43" cy="43" r="9" fill="#68798d" stroke="#fff"/><path d="m39 43 3 3 6-8" fill="none" stroke="#fff" stroke-width="2.5"/>');
  const AUTOMATOR_RECOVERY_KEY='macweb.automator.workflow';
  const actions=[
    {id:'message',cat:t('app.ln.c0cdfbdb41'),name:t('ui.a328e1af02c9'),desc:t('ui.d406af23da0c'),defaultValue:t('ui.5669b335eb8c')},
    {id:'file',cat:t('ui.16c07a27796d'),name:t('ui.68797ab8e16e'),desc:t('ui.eee728d700ec'),defaultValue:t('ui.8d46aa72c135')},
    {id:'open',cat:t('ui.8a443802664a'),name:t('ui.f2632157a194'),desc:t('ui.299114375896'),defaultValue:'finder'},
    {id:'wallpaper',cat:t('ui.1a1f6dff7826'),name:t('ui.c915c6a3c06f'),desc:t('ui.16fe3e0f6aa1'),defaultValue:'aurora'},
    {id:'snapshot',cat:t('ui.1a1f6dff7826'),name:t('ui.7b8db47a09c0'),desc:t('ui.9a66bb43ef48'),defaultValue:''},
    {id:'pause',cat:t('app.ln.c0cdfbdb41'),name:t('ui.130448bce675'),desc:t('app.ln5.17511720c514'),defaultValue:'2'},
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
    const run=el('button','finder-toolbar-btn',t('app.ln5.a304418d10c7'));run.dataset.command='run-workflow';
    const stop=el('button','finder-toolbar-btn',t('ui.7138fba53475'));stop.dataset.command='stop-workflow';
    const saveBtn=el('button','finder-toolbar-btn',t('ui.091ca5213ef3'));saveBtn.dataset.command='save';
    const toolbarStatus=el('span','automator-toolbar-status',t('ui.b796f2d4ca85'));
    toolbar.append(run,stop,saveBtn,toolbarStatus);
    const root=el('div','automator-app');
    root.innerHTML=`<aside><header><b>${t('app.ln7.c77a4b588efb')}</b><small>${t('app.ln2.b930bee566ab')}</small></header>
      <input class="aqua-input aqua-search auto-search" type="search" placeholder= t('app.ln.1b941a42d3') aria-label="${t('app.ln.1b941a42d3')}">
      <div class="auto-actions" role="listbox" aria-label="${t('app.ln5.64e8fb9dd356')}"></div></aside>
      <main><header>${t('app.ln5.3924c53abaa9')}：
        <select class="aqua-select auto-input-type" aria-label="${t('app.ln5.3924c53abaa9')}"><option value="none">${t('app.ln5.959293f8f73d')}</option><option value="files">${t('app.ln5.6fbd6405bfee')}</option><option value="text">${t('app.ln7.0338013b0f72')}</option></select>
      </header><section class="auto-flow" aria-label="${t('app.ln6.981881ea9c22')}"></section>
      <footer><span>${t('app.ln7.37873a2d72ae')}</span><b class="auto-count"></b></footer></main>`;
    const list=root.querySelector('.auto-actions'),flow=root.querySelector('.auto-flow');
    const search=root.querySelector('.auto-search'),inputSelect=root.querySelector('.auto-input-type');
    const footerText=root.querySelector('main>footer>span'),count=root.querySelector('.auto-count');
    inputSelect.value=inputType;

    const serialized=()=>JSON.stringify({format:'com.apple.Automator.workflow',version:1,inputType,steps:workflow},null,2);
    const documentName=()=>currentPath?VFS.baseName(currentPath):t('app.ln2.18f70fe106e0');
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{
      detail:{appId:'automator',window:win,dirty:!!win?._documentDirty,path:currentPath,running},
    }));
    const updateWindowState=()=>{
      if(!win)return;
      win._path=currentPath;win.dataset.automatorRunning=String(running);
      win.dataset.automatorHasSteps=String(!!workflow.length);
      win.dataset.automatorSelection=String(selectedStep>=0&&selectedStep<workflow.length);
      win._title.textContent=`Automator — ${documentName()}`;
      win._status.textContent=`${workflow.length} ${t('app.ln9.be9d3bcc65aa')}${win._documentDirty?t('ui.83e8b2389032'):''}${running?t('app.ln6.52001648ab34'):''}`;
      run.disabled=running||!workflow.length;stop.disabled=!running;saveBtn.disabled=running;
      toolbarStatus.textContent=running?t('app.ln2.c713e6a8292f'):win._documentDirty?t('ui.c920e429e2df'):t('ui.b796f2d4ca85');
      count.textContent=`${workflow.length} ${t('app.ln9.be9d3bcc65aa')}`;
      notifyState();
    };
    const rememberRecovery=()=>save(AUTOMATOR_RECOVERY_KEY,{inputType,steps:workflow});
    const setDirty=(dirty=true)=>{
      if(!win)return;
      win._documentDirty=!!dirty;win.classList.toggle('document-dirty',!!dirty);
      rememberRecovery();updateWindowState();
    };
    const controlMarkup=(step,index)=>{
      if(step.id==='open')return `<label class="auto-parameter"><span>${t('app.ln6.7d1b08d2e582')}</span><select class="aqua-select" data-step-value="${index}">
        <option value="finder">Finder</option><option value="safari">Safari</option><option value="mail">Mail</option>
        <option value="preview">${t('app.ln6.07a0aca727e5')}</option><option value="sysprefs">${t('app.ln3.fbaacd1575f8')}</option><option value="ical">iCal</option></select></label>`;
      if(step.id==='wallpaper')return `<label class="auto-parameter"><span>${t('app.ln2.3e3ea5488264')}</span><select class="aqua-select" data-step-value="${index}">
        <option value="aurora">Aurora</option><option value="tiger">Aqua Blue</option><option value="purple">Purple Aurora</option><option value="graphite">Graphite</option></select></label>`;
      if(step.id==='snapshot')return `<div class="auto-no-parameter">${t('app.ln6.8974f5ee2c1e')}</div>`;
      if(step.id==='pause')return `<label class="auto-parameter"><span>${t('app.ln6.070d2c4bab3b')}</span><input class="aqua-input" data-step-value="${index}" type="number" min="1" max="30" value="${esc(step.value)}"><em>${t('app.ln6.954ac56202cb')}</em></label>`;
      const label=step.id==='file'?t('ui.f462d9fd49b2'):t('app.ln.f76d12f856');
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
      if(!visible.length)list.appendChild(el('div','auto-library-empty',t('app.ln6.afe4c2644010')));
    };
    const renderFlow=()=>{
      flow.innerHTML='';
      if(!workflow.length){
        const empty=el('div','auto-empty');
        empty.innerHTML=`<i>⇢</i><b>${t('app.ln6.9d7546677dd3')}</b><span>${t('app.ln6.8989edbc89cb')}</span>`;
        flow.appendChild(empty);
      }else workflow.forEach((step,index)=>{
        const action=actions.find(item=>item.id===step.id);
        const article=el('article',index===selectedStep?'selected':'');
        article.dataset.i=index;article.draggable=!running;
        article.innerHTML=`<header><span>${index+1}</span><b>${esc(action?.name||step.id)}</b>
          <div><button data-move="-1" title= t('app.ln.267ec6d1fa') ${index===0||running?'disabled':''}>↑</button>
          <button data-move="1" title= t('app.ln.4b4dd27119') ${index===workflow.length-1||running?'disabled':''}>↓</button>
          <button data-remove title= t('app.ln.a22643e52a') ${running?'disabled':''}>×</button></div></header>
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
      footerText.textContent=t('app.ln6.06634f85667f');updateWindowState();
      let completed=0;
      try{
        for(let index=0;index<workflow.length;index++){
          if(!running||token!==runToken)break;
          const step=workflow[index],action=actions.find(item=>item.id===step.id);
          markStep(index,'running',t('app.ln2.c713e6a8292f'));toolbarStatus.textContent=`${index+1}/${workflow.length} ${action?.name||step.id}`;
          if(step.id==='message')System.alertBox('Automator',step.value||t('ui.4fb853cd6d80'));
          else if(step.id==='file'){
            const raw=(step.value||t('ui.8d46aa72c135')).replace(/[\\/]/g,'-');
            const dot=raw.lastIndexOf('.'),base=dot>0?raw.slice(0,dot):raw,extension=dot>0?raw.slice(dot):'.txt';
            const name=VFS.uniqueName(paths.documents,base||t('ui.49dcd0b30199'),extension);
            VFS.putNode(`${paths.documents}/${name}`,{type:'file',content:t('app.ln6.b0f7ee63fb95'),mime:'text/plain',creator:'automator',generated:true});
          }else if(step.id==='open')System.launch(System.apps[step.value]?step.value:'finder');
          else if(step.id==='wallpaper')setWallpaper(step.value);
          else if(step.id==='snapshot')Leopard.saveSnapshot('ui.0ff5434bb589');
          else if(step.id==='pause'){
            const seconds=Math.max(1,Math.min(30,Number(step.value)||1));
            if(!await waitCancelable(seconds*1000,token))break;
          }
          if(step.id!=='pause'&&!await waitCancelable(260,token))break;
          completed++;markStep(index,'done',t('ui.e3108f65dd4a'));
        }
      }catch(error){
        console.error('Automator workflow failed',error);
        const index=Math.max(0,completed);markStep(index,'failed',`${t('app.ln9.8e3fada9b30a')}${error.message||error}`);
      }
      const stopped=!running||token!==runToken;
      if(token===runToken)running=false;
      footerText.textContent=stopped?`${t('app.ln6.981881ea9c22')}${t('app.ln9.a9544d740cc4')}${completed}/${workflow.length}）。`:`${t('app.ln6.981881ea9c22')}${t('app.ln9.2be3acc7a64f')}${completed} ${t('app.ln9.be9d3bcc65aa')}）。`;
      updateWindowState();
      Leopard.toast('Automator',stopped?t('ui.0f5015e31616'):t('ui.238a44335a9d'));
    };
    const stopWorkflow=()=>{
      if(!running)return;
      running=false;runToken++;flow.querySelectorAll('article.running').forEach(article=>{
        article.classList.remove('running');article.querySelector('.auto-step-result').textContent=t('ui.75dddf524e4c');
      });
      footerText.textContent=t('ui.51ca9f4d40e8');updateWindowState();
    };
    const writeDocument=(path)=>{
      path=VFS.normalize(path);
      const ok=VFS.putNode(path,{type:'file',kind:'workflow',content:serialized(),mime:'application/x-automator-workflow',creator:'automator',generated:true});
      if(!ok){System.alertBox('Automator',t('ui.ccd5f7e542b3'));return false;}
      currentPath=path;lastSaved=serialized();setDirty(false);System.addRecentDocument?.(path,'automator');
      Leopard.toast('Automator', `${t('app.ln9.01924612618f')}${VFS.baseName(path)}`);return true;
    };
    const doSave=(saveAs=false,onSaved)=>{
      if(currentPath&&!saveAs){const ok=writeDocument(currentPath);if(ok)onSaved?.();return ok;}
      const directory=currentPath?VFS.parentOf(currentPath):paths.documents;
      System.savePanel({
        parent:win,title:t('ui.8e68a546ddf4'),startPath:directory,
        name:currentPath?VFS.baseName(currentPath):VFS.uniqueName(directory,t('app.ln2.18f70fe106e0'),'.workflow'),
        extension:'workflow',typeLabel:t('ui.0ff5434bb589'),allowOverwrite:true,
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
      }catch(error){System.alertBox('Automator',t('ui.1420052ad28b'));return false;}
    };
    const openDocument=()=>System.openPanel({
      parent:win,title:t('ui.17111c903b38'),startPath:currentPath?VFS.parentOf(currentPath):paths.documents,
      types:['workflow'],allowUpload:true,onOpen:(path)=>{
        const load=()=>applyDocument(path);
        if(!win._documentDirty)load();
        else System.confirmSheet({parent:win,headline:t('app.ln2.f2f2110a265d'),message:t('ui.ce593f661590'),okLabel:t('app.ln2.17d9fa6447e0'),danger:true,onOK:load});
      },
    });
    const newDocument=()=>{
      const reset=()=>{workflow=[];inputType='none';inputSelect.value='none';currentPath=null;selectedStep=-1;lastSaved=serialized();setDirty(false);renderFlow();};
      if(!win._documentDirty)reset();
      else System.confirmSheet({parent:win,headline:t('app.ln2.f2f2110a265d'),message:t('ui.ce593f661590'),okLabel:t('app.ln2.17d9fa6447e0'),danger:true,onOK:reset});
    };

    win=System.createWindow({
      app:'automator',title:t('ui.a4dc4a7fc9ae'),width:920,height:610,toolbar,content:root,statusbar:'',
      onClose:(window,context)=>{
        stopWorkflow();
        if(context.force||!window._documentDirty)return true;
        if(closePrompt?.shield.isConnected)return false;
        const body=el('div','automator-save-warning');
        body.innerHTML=`<div>${automatorIcon}</div><section><h3>${t('app.ln9.a7922b54fa08')}${esc(documentName())}${t('app.ln9.477baae867c7')}</h3><p>${t('app.ln7.5e14801ecb2c')}</p></section>`;
        const finishClose=()=>setTimeout(()=>{if(window.isConnected)System.closeWindow(window);},170);
        closePrompt=System.showSheet({
          parent:window,content:body,className:'automator-save-warning-sheet',
          buttons:[
            {label:t('ui.4d0b4688c787'),cancel:true},
            {label:t('ui.de1b2ada2597'),danger:true,action:()=>{setDirty(false);finishClose();}},
            {label:t('ui.091ca5213ef3'),default:true,action:()=>setTimeout(()=>doSave(false,finishClose),170)},
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
  System.registerApp({id:'automator',name:'Automator',icon:automatorIcon,open:openAutomator,multiWindow:true,about:t('ui.831ef5f7b3bd'),keywords:t('ui.ca290c5fa736')});

  // ---------- Image Capture ----------
  const captureIcon=icon('ic','#b9d1e9','#527da8','<rect x="13" y="14" width="38" height="36" rx="4" fill="#eff7ff" stroke="#315b85" stroke-width="1.5"/><rect x="19" y="9" width="26" height="9" rx="3" fill="#dbe8f4" stroke="#315b85"/><circle cx="32" cy="33" r="11" fill="#477fb1" stroke="#fff" stroke-width="2"/><circle cx="32" cy="33" r="5" fill="#9bddff"/>');
  function openImageCapture(){
    const toolbar=el('div','capture-toolbar');
    const chooseButton=el('button','finder-toolbar-btn',t('app.ln6.1f95f093b73e'));
    chooseButton.dataset.command='choose-files';
    const finderButton=el('button','finder-toolbar-btn',t('ui.65527b960e56'));
    finderButton.dataset.command='add-vfs-images';
    const importButton=el('button','finder-toolbar-btn',t('app.ln6.e91d1b0ba027'));
    importButton.dataset.command='import-selection';
    const importAllButton=el('button','finder-toolbar-btn',t('ui.d5e350e5145b'));
    importAllButton.dataset.command='import-all';
    const removeButton=el('button','finder-toolbar-btn',t('ui.2f752c005ec5'));
    removeButton.dataset.command='delete';
    const rotateLeft=el('button','finder-toolbar-btn','↺');
    rotateLeft.title = t('app.ln6.41b23d1632d5');rotateLeft.dataset.command='rotate-left';
    const rotateRight=el('button','finder-toolbar-btn','↻');
    rotateRight.title = t('app.ln6.6fe271ca4c89');rotateRight.dataset.command='rotate-right';
    const toolbarSpacer=el('i');
    const revealButton=el('button','finder-toolbar-btn',t('ui.6df2aa0a1ceb'));
    revealButton.dataset.command='reveal-imports';
    toolbar.append(chooseButton,finderButton,importButton,importAllButton,removeButton,rotateLeft,rotateRight,toolbarSpacer,revealButton);

    const root=el('div','imagecapture-app');
    root.innerHTML=`<aside><h4>${t('app.ln7.2600dec90202')}</h4>
      <button data-device="browser"><span>📷</span><b>${t('app.ln7.5405f07addce')}</b><small>${t('app.ln7.8cc877cffae1')}</small></button>
      <button data-device="isight"><span>◉</span><b>${t('app.ln7.87bfc193c0de')}</b><small>${t('app.ln7.46f73a798197')}</small></button>
      <button data-device="iphone" class="disconnected"><span>📱</span><b>iPhone</b><small>${t('app.ln.6ea4b89984')}</small></button>
    </aside><main>
      <div class="capture-drop" tabindex="0"><b>${t('app.ln6.9b5d2466003c')}</b><span>${t('app.ln6.7895b3f8d4e8')}</span><input type="file" accept="image/*" multiple aria-label="${t('app.ln6.77dd4bc22b14')}"></div>
      <div class="capture-grid" role="listbox" aria-label="${t('app.ln6.5da3f07572ac')}" aria-multiselectable="true"></div>
      <footer><label>${t('app.ln7.d54f7e061f73')}<select class="aqua-select capture-destination"><option value="${paths.pictures}">${t('app.ln7.0c7e2869dc88')}</option><option value="${paths.desktop}">${t('app.ln6.22048855f9be')}</option><option value="${paths.downloads}">${t('app.ln6.93e3c156ebce')}</option></select></label>
      <label class="spp-check"><input type="checkbox" class="capture-remove-after"> ${t('app.ln7.80ad96ff0427')}</label></footer>
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
          name:file.name||t('ui.ba36cbd089ed'),file,url:URL.createObjectURL(file),size:file.size,mime:file.type,
          vfsPath:'',rotation:0,importedPath:'',
        });
      });
      selected=new Set(accepted.length?files.slice(-accepted.length).map(entry=>entry.id):[]);
      selectionAnchor=files.length-1;
      currentDevice='browser';
      render();
      if(fileList.length&&!accepted.length)System.alertBox(t('ui.283462c3dde5'),t('ui.0cea9ee0cbbf'));
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
      if(requested.length&&!accepted.length)System.alertBox(t('ui.283462c3dde5'),t('ui.c34126291632'));
    };
    const chooseFromFinder=()=>System.openPanel({
      parent:win,title:t('ui.d72bb6ab6468'),startPath:paths.pictures,
      types:['jpg','jpeg','png','gif','webp','svg'],allowMultiple:true,allowUpload:false,
      onOpen:(paths)=>addVfsPaths(paths),
    });
    const render=()=>{
      root.querySelectorAll('[data-device]').forEach(button=>button.classList.toggle('sel',button.dataset.device===currentDevice));
      grid.innerHTML='';
      if(!files.length){
        const empty=el('div','capture-empty');
        empty.innerHTML=`<i>▧</i><b>${t('app.ln6.c6de90916e8d')}</b><span>${t('app.ln6.0ce944c09577')}</span>`;
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
        const meta=el('small','',metaParts.join(' · ')||t('ui.90beff858d5c'));
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
      win._status.textContent=importing?t('ui.cfbfadc28dba'):`${t('app.ln7.5405f07addce')} · ${files.length} ${t('app.ln9.0b7256c3c2cd')}${count?` · ${t('app.ln8.fc958ab9bfca')} ${count} ${t('common.sheets')}`:''}`;
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
        win._status.textContent=`${t('app.ln9.66a8e9d1356e')}${index+1}/${items.length}：${entry.name}`;
        try{
          const rotated=!!(((entry.rotation%360)+360)%360);
          const data=await transformedData(entry);
          const originalExt=entry.name.match(/\.[^.]+$/)?.[0]||'.jpg';
          const extension=rotated?'.png':originalExt;
          const base=entry.name.replace(/\.[^.]+$/,'')||t('ui.7c3c705c51ca');
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
      Leopard.toast(t('ui.283462c3dde5'),failed?`${t('app.ln9.122bde04cef1')}${imported}${t('app.ln9.7628cf0f068b')}${failed}${t('app.ln9.2a3c12ffc918')}`:`${t('app.ln9.122bde04cef1')}${imported}${t('app.ln9.bfa165b6077e')}${VFS.baseName(dir)}”。`);
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
      }catch(error){System.alertBox(t('ui.283462c3dde5'),t('ui.35ce30bcf3ea'));}
    };
    const revealImports=()=>{
      if(lastImportDirectory)System.launch('finder',{path:lastImportDirectory,forceNew:true});
    };

    win=System.createWindow({
      app:'imagecapture',title:t('ui.283462c3dde5'),width:820,height:560,toolbar,content:root,statusbar:t('ui.dd7a28c6e58d'),
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
      else System.alertBox(t('ui.283462c3dde5'),t('ui.ebd24aa9e858'));
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
  System.registerApp({id:'imagecapture',name:t('ui.283462c3dde5'),icon:captureIcon,open:openImageCapture,about:t('ui.a12529cd7591'),keywords:t('ui.f3db36b6d6f8')});

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
      {app:'itunes',glyph:'♫',label:t('ui.afb3c40c3929'),detail:t('ui.60c8ad773f33')},
      {app:'quicktime',glyph:'▶',label:t('ui.8d85cec2707c'),detail:t('ui.20adecf199bf')},
      {app:'photobooth',glyph:'▣',label:t('app.ln6.871f4e23218e'),detail:t('ui.c6b184e622a0')},
      {app:'dvdplayer',glyph:'DVD',label:'DVD',detail:t('ui.1a5e7e780137')},
    ];
    const root=el('div','frontrow-layer');
    root.tabIndex=-1;
    root.setAttribute('role','dialog');
    root.setAttribute('aria-label','Front Row');
    root.innerHTML=`<div class="frontrow-logo"> <b>Front Row</b></div><main>${destinations.map((item,index)=>`<button data-app="${item.app}" data-index="${index}" aria-label="${item.label}，${item.detail}"><i>${item.glyph}</i><span>${item.label}</span><small>${item.detail}</small></button>`).join('')}</main><footer><b class="frontrow-current"></b><span>${t('app.ln7.1e9d444e4459')}</span></footer>`;
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
  System.registerApp({id:'frontrow',name:'Front Row',icon:frontIcon,open:openFrontRow,about:t('ui.abe9588f4e45'),keywords:t('ui.7328547c2ed6')});

  // ---------- Utilities ----------
  const keyIcon=icon('key','#d4d7dd','#797f89','<circle cx="25" cy="28" r="11" fill="none" stroke="#fff" stroke-width="5"/><path d="m33 36 15 15M41 44l5-5M45 48l5-5" fill="none" stroke="#fff" stroke-width="5"/>');
  const KEYCHAIN_ITEMS_KEY='macweb.keychain.items.v1';
  const DEFAULT_KEYCHAIN_ITEMS=[
    {id:'kc-safari',keychain:'login',name:t('ui.7faa0151b0ea'),kind:t('ui.75a7c4b3592a'),category:'password',account:'roll',where:'Safari',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-web',keychain:'login',name:'Leopard Web',kind:t('ui.2e997ec564bb'),category:'password',account:'roll',where:'https://leopard.local/',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-airport',keychain:'System',name:'Leopard Web',kind:t('ui.6d6c8921f649'),category:'password',account:t('app.ln.cbba7a2c6f'),where:'Leopard Web',created:'2007-10-26',modified:'2007-10-26'},
    {id:'kc-apple-root',keychain:'System Roots',name:'Apple Root CA',kind:t('app.ln2.7886c8eb5b7c'),category:'certificate',account:'Apple Inc.',where:t('ui.b820a80ec0f5'),created:'2006-04-25',modified:'2007-05-14'},
    {id:'kc-class3',keychain:'System Roots',name:'Apple Computer, Inc. Root Certificate Authority',kind:t('app.ln2.7886c8eb5b7c'),category:'certificate',account:'Apple Computer, Inc.',where:t('ui.b820a80ec0f5'),created:'2006-04-25',modified:'2007-05-14'},
  ];
  function openKeychain(){
    let entries=jsonStore(KEYCHAIN_ITEMS_KEY,DEFAULT_KEYCHAIN_ITEMS)
      .filter(item=>item&&item.id&&item.name)
      .map(item=>({
        id:String(item.id),keychain:['login','System','System Roots'].includes(item.keychain)?item.keychain:'login',
        name:String(item.name),kind:String(item.kind||t('ui.75a7c4b3592a')),
        category:item.category==='certificate'?'certificate':'password',
        account:String(item.account||''),where:String(item.where||''),
        created:String(item.created||'2007-10-26'),modified:String(item.modified||item.created||'2007-10-26'),
        userCreated:!!item.userCreated,
      }));
    let currentKeychain='login',currentCategory='all',selectedId=null,query='';
    let sortKey='name',sortAscending=true,locked=true,win=null;
    const toolbar=el('div','keychain-toolbar');
    const newItem=el('button','finder-toolbar-btn',t('ui.da09644e870e'));
    newItem.dataset.command='new-item';
    const lockButton=el('button','finder-toolbar-btn',t('app.ln2.051f92ec4048'));
    lockButton.dataset.command='toggle-lock';
    const infoButton=el('button','finder-toolbar-btn',t('ui.d3eda18f01f6'));
    infoButton.dataset.command='show-item-info';
    const deleteButton=el('button','finder-toolbar-btn',t('ui.3755f56f2f83'));
    deleteButton.dataset.command='delete';
    const toolbarSpacer=el('i');
    const search=el('input','aqua-input aqua-search');
    search.type='search';search.placeholder = t('ui.155304f0c0f1');search.setAttribute('aria-label',t('ui.155304f0c0f1'));
    toolbar.append(newItem,lockButton,infoButton,deleteButton,toolbarSpacer,search);

    const root=el('div','keychain-app');
    root.innerHTML=`<aside>
      <h4>${t('app.ln2.543da9a593f2')}</h4>
      <button data-keychain="login"><span>🔐</span> login</button>
      <button data-keychain="System"><span>🔒</span> System</button>
      <button data-keychain="System Roots"><span>📜</span> System Roots</button>
      <h4>${t('app.ln7.760df1a6b8ae')}</h4>
      <button data-category="all"><span>▦</span> ${t('app.ln7.ad83fb213771')}</button>
      <button data-category="password"><span>🔑</span> ${t('app.ln6.e87b8fcc3950')}</button>
      <button data-category="certificate"><span>✓</span> ${t('app.ln2.7886c8eb5b7c')}</button>
    </aside><main>
      <header>
        <button data-sort="name">${t('app.ln.8985b91f9b')}</button>
        <button data-sort="kind">${t('app.ln.ec44b0c9ce')}</button>
        <button data-sort="keychain">${t('app.ln2.543da9a593f2')}</button>
      </header>
      <div class="keychain-list" role="listbox" aria-label="${t('app.ln6.6d03fd64dea0')}"></div>
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
        empty.innerHTML=`<b>${t('app.ln6.33444d214ef2')}</b><span>${t('app.ln6.40b9408ebaf3')}</span>`;
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
          <dl><dt>${t('app.ln7.6a4c8f9a374a')}</dt><dd>${esc(item.account)||'—'}</dd><dt>${t('app.ln6.78356c0247d3')}</dt><dd>${esc(item.where)||'—'}</dd>
          <dt>${t('app.ln7.286e846078e7')}</dt><dd>${esc(item.modified)}</dd><dt>${t('app.ln7.5a1da8f33fcf')}</dt><dd>${locked?t('app.ln6.2221c9da4f88'):t('app.ln6.ba3f037b6c2c')}</dd></dl></div>`;
      }else{
        detail.innerHTML=`<div class="keychain-detail-icon">${locked?'🔒':'🔓'}</div><div><b>${esc(currentKeychain)}</b>
          <p>${locked?t('ui.82d337a5fdd0'):t('app.ln6.b955d566d3cb')}</p>
          <small>${t('app.ln7.08f06759eba2')}</small></div>`;
      }
      lockButton.textContent=locked?t('app.ln2.051f92ec4048'):t('app.ln6.e013fdf68e9e');
      infoButton.disabled=!item;
      deleteButton.disabled=!item;
      win.dataset.keychainLocked=String(locked);
      win.dataset.keychainSelection=item?'true':'false';
      win._status.textContent=`${currentKeychain} · ${visible.length} ${t('app.ln9.687d9deb14ec')} · ${locked?t('app.ln6.1d7d0c096b7f'):t('app.ln6.51541a43bf61')}`;
      notifyState();
    };
    const persist=()=>{
      save(KEYCHAIN_ITEMS_KEY,entries);
      render();
    };
    const toggleLock=()=>{
      if(!locked){
        locked=true;render();Leopard.toast(t('app.ln2.3625efd416fa'),`${currentKeychain}${t('app.ln9.a3a004eaeace')}`);return;
      }
      System.confirmSheet({
        parent:win,headline:`${t('app.ln9.1b4664752851')}${currentKeychain}${t('app.ln9.e56df747aac4')}`,
        message:t('ui.8bdc538cb29d'),
        okLabel:t('app.ln2.051f92ec4048'),onOK:()=>{locked=false;render();Leopard.toast(t('app.ln2.3625efd416fa'),`${currentKeychain}${t('app.ln9.7a078364ba58')}`);},
      });
    };
    const showInfo=()=>{
      const item=selectedEntry();if(!item)return;
      const pane=el('div','keychain-info-sheet');
      pane.innerHTML=`<div class="keychain-info-heading"><i>${item.category==='certificate'?'📜':'🔑'}</i><div><b>${esc(item.name)}</b><span>${esc(item.kind)}</span></div></div>
        <dl><dt>${t('app.ln2.0dfccb603b86')}</dt><dd>${esc(item.keychain)}</dd><dt>${t('app.ln2.d14304c2d2eb')}</dt><dd>${esc(item.account)||'—'}</dd>
        <dt>${t('app.ln2.b098e3f36c57')}</dt><dd>${esc(item.where)||'—'}</dd><dt>${t('app.ln8.996063802bb3')}</dt><dd>${esc(item.created)}</dd>
        <dt>${t('app.ln7.286e846078e7')}：</dt><dd>${esc(item.modified)}</dd></dl>
        ${item.category==='password'?`<label class="spp-check"><input type="checkbox" class="keychain-show-secret" ${locked?'disabled':''}> ${t('app.ln8.ca1a78ada4ed')}</label>
        <output class="keychain-secret">${locked?t('app.ln6.2221c9da4f88'):'••••••••••••'}</output>`:`<p class="keychain-certificate-state">✓ ${t('app.ln7.72beab9b1f72')}</p>`}
        <p class="keychain-security-note">${t('app.ln8.639ae798be5e')}</p>`;
      const reveal=pane.querySelector('.keychain-show-secret');
      reveal?.addEventListener('change',()=>{
        pane.querySelector('.keychain-secret').textContent=reveal.checked?t('ui.ec8c104711e8'):'••••••••••••';
      });
      System.showSheet({
        parent:win,title:t('ui.b623d3d4f0a8'),content:pane,className:'keychain-info-dialog',
        buttons:[{label:t('ui.27e4fe4c3fe2'),default:true}],
      });
    };
    const addItem=()=>{
      const form=el('div','keychain-new-sheet');
      form.innerHTML=`<p>${t('app.ln9.27a32086f2e9')}${t('app.ln6.6d03fd64dea0')}。${t('app.ln9.dfd2553b040c')}</p>
        <label><span>${t('app.ln3.4d70b98884b9')}</span><input class="aqua-input item-name" autocomplete="off"></label>
        <label><span>${t('app.ln2.d14304c2d2eb')}</span><input class="aqua-input item-account" autocomplete="off"></label>
        <label><span>${t('app.ln2.b098e3f36c57')}</span><input class="aqua-input item-where" autocomplete="off"></label>
        <label><span>${t('app.ln8.db37d4953625')}</span><select class="aqua-select item-kind"><option value="internet">${t('app.ln6.f1781a2afd93')}</option><option value="application">${t('app.ln6.7e3875525ad0')}</option><option value="network">${t('app.ln6.9d72c5d11417')}</option><option value="certificate">${t('app.ln2.7886c8eb5b7c')}</option></select></label>
        <label><span>${t('app.ln2.0dfccb603b86')}</span><select class="aqua-select item-keychain"><option>login</option><option>System</option><option>System Roots</option></select></label>
        <div class="aqua-sheet-error"></div>`;
      form.querySelector('.item-keychain').value=currentKeychain;
      const nameField=form.querySelector('.item-name');
      System.showSheet({
        parent:win,title:t('ui.20c2d5f7e03f'),content:form,className:'keychain-new-dialog',initialFocus:nameField,
        buttons:[
          {label:t('ui.4d0b4688c787'),cancel:true},
          {label:t('ui.94191ce210d3'),default:true,action:()=>{
            const name=nameField.value.trim(),kindValue=form.querySelector('.item-kind').value;
            if(!name){form.querySelector('.aqua-sheet-error').textContent=t('ui.2fc8010dacf1');nameField.focus();return false;}
            const kinds={internet:t('ui.2e997ec564bb'),application:t('ui.75a7c4b3592a'),network:t('ui.c14122267d58'),certificate:t('app.ln2.7886c8eb5b7c')};
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
        parent:win,headline:`${t('app.ln9.2fc1c09cd335')}${item.name}”?`,
        message:t('ui.438baf0ccf88'),
        okLabel:t('ui.3755f56f2f83'),danger:true,onOK:()=>{entries=entries.filter(entry=>entry.id!==item.id);selectedId=null;persist();},
      });
    };

    win=System.createWindow({app:'keychain',title:t('app.ln2.3625efd416fa'),width:800,height:540,toolbar,content:root,statusbar:t('app.ln6.df233ffb0bcd')});
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
  System.registerApp({id:'keychain',name:t('app.ln2.3625efd416fa'),icon:keyIcon,open:openKeychain,about:t('ui.2296cb1d0b52'),keywords:t('ui.a7f732b06a85')});

  const grabIcon=icon('grab','#7c8797','#333943','<path d="M16 15h32v34H16z" fill="#eaf2fa" stroke="#fff" stroke-width="1.5"/><path d="M24 24h16v16H24z" fill="#54769a"/><path d="M12 23v-9h9M52 23v-9h-9M12 41v9h9M52 41v9h-9" fill="none" stroke="#fff" stroke-width="2.5"/>');
  function openGrab(){
    const modes={
      selection:{icon:'⌗',name:t('app.ln6.03667d3c5490'),action:t('app.ln2.8482c443cb3b'),description:t('ui.4d84e57431c7')},
      window:{icon:'▣',name:t('ui.a70a15135c37'),action:t('app.ln6.59fc97b055a0'),description:t('ui.559ccde5cfe7')},
      screen:{icon:'▤',name:t('app.ln2.541a4a985ed1'),action:t('app.ln2.8482c443cb3b'),description:t('ui.aa6f32ef8490')},
      timed:{icon:'◷',name:t('app.ln6.1e9fd36ea4df'),action:t('app.ln6.3186e0e2b921'),description:t('ui.5c188661c824')},
    };
    const root=el('div','grab-app');
    root.innerHTML=`<aside>
      <header><i>${grabIcon}</i><span><b>${t('app.ln8.d356a694b3e9')}</b><small>${t('app.ln2.c97cf7b42beb')}</small></span></header>
      <nav aria-label="${t('app.ln2.c97cf7b42beb')}">${Object.entries(modes).map(([id,item])=>`<button data-mode="${id}"><i>${item.icon}</i><span><b>${item.name}</b><small>${item.description}</small></span></button>`).join('')}</nav>
      <section><b>${t('grab.browserBoundary')}</b><p>${t('grab.captureAuth')}</p></section>
    </aside>
    <main>
      <header><span><b class="grab-document-title">${t('app.ln6.19775c7a206b')}</b><small class="grab-document-meta">${t('app.ln6.f240f75aeec8')}</small></span><button class="aqua-btn grab-save" disabled>${t('app.ln8.7b3959cd8ca7')}</button></header>
      <div class="grab-stage" tabindex="0" aria-label="${t('app.ln.978b51f84a')}">
        <div class="grab-placeholder"><i>${grabIcon}</i><b>${t('app.ln8.360edc51c176')}</b><span></span></div>
        <img class="grab-image" alt=t('app.ln.978b51f84a') hidden>
        <div class="grab-crop" hidden><span></span></div>
        <div class="grab-countdown" hidden><b></b><span>${t('app.ln8.a1e41899ab9e')}</span></div>
      </div>
      <footer>
        <button class="aqua-btn default grab-capture"></button>
        <button class="aqua-btn grab-apply-crop" hidden disabled>${t('app.ln9.46f698a599a5')}${t('app.ln6.03667d3c5490')}</button>
        <span class="grab-status">${t('app.ln6.b8cdd2bbb25d')}</span>
        <button class="aqua-btn grab-preview" disabled>${t('app.ln8.43ccc8dd5bdb')}</button>
        <button class="aqua-btn grab-reveal" disabled>${t('app.ln2.8dac46de1e85')}</button>
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
      return `${t('app.ln2.0245199c0acb')} ${day} ${time}.png`;
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
      captureButton.textContent=busy?t('ui.72aec357a169'):`${info.action}…`;
      captureButton.classList.toggle('danger',busy);
      captureButton.disabled=false;
      saveButton.disabled=!current||busy;
      previewButton.disabled=!current||busy;
      revealButton.disabled=!current?.path||busy;
      cropButton.hidden=mode!=='selection'||!current;
      cropButton.disabled=!pendingCrop||busy;
      if(current){
        documentTitle.textContent=current.path?VFS.baseName(current.path):t('app.ln6.205ab38fa803');
        documentMeta.textContent=`${current.width} × ${current.height}${t('app.ln9.066064cac4e4')}${current.path?t('ui.737d0928762e'):t('ui.71d3c9dec6ba')}`;
      }else{
        documentTitle.textContent=t('ui.5f5b1863fec7');
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
      status.textContent=mode==='selection'?t('ui.0eaab688d47c'):t('ui.f68e475e49c9');
      showCurrent();
      if(mode==='selection')requestAnimationFrame(()=>stage.focus());
    };
    const cancelCapture=()=>{
      if(!busy)return;
      captureToken++;
      stopStream();
      countdown.hidden=true;
      busy=false;
      status.textContent=t('ui.a1c4e7efcbdb');
      updateUI();
    };
    const takeCapture=async()=>{
      if(busy){cancelCapture();return;}
      if(!navigator.mediaDevices?.getDisplayMedia){
        System.alertBox(t('ui.f208834f7365'),t('ui.317829f7af54'));
        return;
      }
      busy=true;
      const token=++captureToken;
      status.textContent=t('app.ln6.2c73c380f0b9');
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
        if(!video.videoWidth||!video.videoHeight)throw new Error(t('ui.12c2f29a7d6a'));
        if(mode==='timed'){
          countdown.hidden=false;
          for(let seconds=10;seconds>0;seconds--){
            if(token!==captureToken)return;
            countdownNumber.textContent=String(seconds);
            status.textContent=`${t('app.ln9.572ae50152c2')}${seconds}${t('app.ln9.2032a85525e6')}`;
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
        Leopard.toast(t('ui.f208834f7365'),t('ui.f03000bc5730'));
      }catch(error){
        if(token!==captureToken)return;
        status.textContent=t('ui.5808acb63977');
        System.alertBox(t('ui.f208834f7365'),error?.name==='NotAllowedError'?t('ui.efb2519a3630'):`${t('app.ln9.c62f8cc9db9d')}${error?.message||t('ui.5f76edc5de7b')}。`);
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
        status.textContent=t('ui.4acd4a9c2ae5');
        showCurrent();
      }catch(error){System.alertBox(t('ui.f208834f7365'),t('ui.53fc307a4962'));}
    };
    const writeCapture=(path)=>{
      if(!current)return false;
      path=VFS.normalize(path);
      const ok=VFS.putNode(path,{type:'file',kind:'image',src:current.src,mime:'image/png',creator:'grab',generated:true,width:current.width,height:current.height});
      if(!ok){System.alertBox(t('ui.f208834f7365'),t('ui.4a461951754f'));return false;}
      current.path=path;
      setDirty(false);
      System.addRecentDocument?.(path,'preview');
      Leopard.toast(t('ui.f208834f7365'),`${t('app.ln9.01924612618f')}${VFS.baseName(path)}”。`);
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
      const directory=current.path?VFS.parentOf(current.path):paths.desktop;
      System.savePanel({
        parent:win,title:t('ui.a29603c1d562'),startPath:directory,
        name:current.path?VFS.baseName(current.path):VFS.uniqueName(directory,captureName().replace(/\.png$/,''),'.png'),
        extension:'png',typeLabel:t('ui.18f12707009c'),allowOverwrite:true,
        onSave:path=>{const ok=writeCapture(path);if(ok)onSaved?.();return ok;},
      });
      return false;
    };
    const openPreview=()=>{
      if(!current)return;
      if(current.path)System.openVfsPath(current.path);
      else System.launch('preview',{src:current.src,name:t('ui.85d48f216b04'),kind:'image'});
    };
    const reveal=()=>{if(current?.path)System.launch('finder',{path:VFS.parentOf(current.path)});};
    const download=()=>{if(current?.path)System.downloadVfsFile(current.path);};
    const copyImage=async()=>{
      if(!current)return;
      try{
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error(t('ui.06c899789b5e'));
        const blob=await fetch(current.src).then(response=>response.blob());
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        Leopard.toast(t('ui.f208834f7365'),t('ui.e46a574a7bda'));
      }catch(error){System.alertBox(t('ui.f208834f7365'),`${error.message}。${t('app.ln9.580f4181e240')}`);}
    };
    const setMode=(next)=>{
      if(!modes[next]||busy)return;
      mode=next;
      pendingCrop=null;
      cropBox.hidden=true;
      status.textContent=`${t('grab.modeReady',{name:modes[mode].name})}`;
      updateUI();
    };
    const finishClose=()=>setTimeout(()=>{if(win?.isConnected)System.closeWindow(win);},170);
    const resizeHandler=()=>drawCrop();

    win=System.createWindow({
      app:'grab',title:t('ui.f208834f7365'),width:840,height:570,content:root,bodyBg:'#ececec',
      onClose:(targetWindow,context)=>{
        cancelCapture();
        if(context.force||!targetWindow._documentDirty){
          window.removeEventListener('resize',resizeHandler);
          return true;
        }
        if(closePrompt?.shield.isConnected)return false;
        const body=el('div','grab-save-warning');
        body.innerHTML=`<i>${grabIcon}</i><section><h3>${t('app.ln8.4e362c9e34c8')}</h3><p>${t('app.ln8.ba5c15abe0a7')}</p></section>`;
        closePrompt=System.showSheet({
          parent:targetWindow,content:body,className:'grab-save-warning-sheet',
          buttons:[
            {label:t('ui.4d0b4688c787'),cancel:true},
            {label:t('ui.de1b2ada2597'),danger:true,action:()=>{setDirty(false);finishClose();}},
            {label:t('ui.091ca5213ef3'),default:true,action:()=>setTimeout(()=>saveCapture(false,finishClose),170)},
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
      else status.textContent=t('ui.46907cbd6d02');
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
  System.registerApp({id:'grab',name:t('ui.f208834f7365'),icon:grabIcon,open:openGrab,about:t('ui.31d3a927d37a'),keywords:t('ui.106342f30777')});

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
      <div class="assistant-rail-note"><i></i><span>${t('app.ln8.6ddcc4642dea')}<br>${t('migration.railNote')}</span></div>
    </aside>
    <main class="assistant-main">
      <header><h1></h1><p></p></header>
      <section class="assistant-stage" aria-live="polite"></section>
      <footer class="assistant-footer">
        <span class="assistant-footnote"></span>
        <button class="aqua-btn assistant-cancel">${t('app.ln6.c42f85b1a505')}</button>
        <button class="aqua-btn assistant-back">${t('app.ln6.a397d8eeed15')}</button>
        <button class="aqua-btn default assistant-next">${t('app.ln6.1c3e152a5e0f')}</button>
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
        cancel.textContent=options.cancelLabel||t('ui.4d0b4688c787');
        back.hidden=options.backHidden===true;
        back.disabled=options.backDisabled===true;
        back.textContent=options.backLabel||t('ui.11d024154013');
        next.hidden=options.nextHidden===true;
        next.disabled=options.nextDisabled===true;
        next.textContent=options.nextLabel||t('ui.1fc1afc5c55e');
        footnote.textContent=options.note||'';
      },
    };
  }

  function openMigrationAssistant(){
    const steps=[t('app.ln2.2bba6efa4075'),t('app.ln6.e4ac56a0b4e9'),t('ui.e7256237f4f3'),t('app.ln6.9697b5c63c94'),t('app.ln2.ac8efd2b0cd9'),t('ui.33246f6a5e5b')];
    const pageStep={welcome:0,source:1,search:2,verify:3,categories:3,progress:4,complete:5,error:4};
    const sources={
      snapshot:{name:t('ui.3b3de892ef9f'),detail:t('ui.e2591bd58ec2'),glyph:'◷',description:t('app.ln6.e2524524f9e1')},
      mac:{name:t('ui.ca4e2880fc01'),detail:t('ui.0ee8eb61feed'),glyph:'⌘',description:t('ui.9ed69ba7b8ea')},
      disk:{name:t('app.ln6.c1e227dbbdf7'),detail:t('ui.27d81d93ddd6'),glyph:'▣',description:t('ui.2871df498029')},
      archive:{name:t('app.ln2.ed01c7a92ec8'),detail:t('ui.8b85339ab380'),glyph:'⇧',description:t('app.ln6.51fad4605704')},
    };
    const categories=[
      {id:'applications',name:t('ui.8a443802664a'),size:assistantBytes(6.8),glyph:'A',detail:t('ui.97c5a92f3b81')},
      {id:'users',name:t('ui.ca12ec1c88f6'),size:assistantBytes(12.4),glyph:'⌂',detail:t('ui.8fcd855b3db3')},
      {id:'files',name:t('ui.047e7be736d8'),size:assistantBytes(3.2),glyph:'▤',detail:t('ui.1b7e067c1e26')},
      {id:'settings',name:t('ui.83f9d39315aa'),size:assistantBytes(.0485),glyph:'⚙',detail:t('ui.56f68a1214aa')},
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
    let quotaText=t('ui.d53c3be0129a');
    let win=null;
    const shell=createAssistantShell('migration',t('app.ln2.73836a60d8ea'),migrationIcon);

    const clearOperation=()=>{
      if(operationTimer){clearInterval(operationTimer);clearTimeout(operationTimer);operationTimer=null;}
      scanning=false;
    };
    const selectedSize=()=>categories.filter(item=>selected.has(item.id)).reduce((sum,item)=>sum+item.size,0);
    const currentSourceLabel=()=>archive?.machineName||archive?.name||({
      snapshot:t('ui.6cf7bdf11124'),
      mac:t('ui.2de264e1d81b'),
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
      <button class="migration-disclosure ${disclosed.has(item.id)?'open':''}" data-disclose="${item.id}" aria-label="${t('app.ln6.419e57d05647')}">▶</button>
      ${disclosed.has(item.id)?`<div class="migration-category-detail">${item.id==='users'
        ? `<p><b>${t('app.ln8.448fd9187b08')}</b> ${t('app.ln8.38a74c866253')}</p><label>${t('app.ln8.2044526ce50b')}<select class="aqua-select"><option>${t('app.ln8.f127290ed3ad')}</option><option>${t('app.ln8.bc107b56f783')}</option></select></label>`
        : `<p>${esc(item.detail)}</p><p>${t('app.ln8.fbe8ac5f926f')}</p>`}</div>`:''}
    </article>`).join('');

    const render=()=>{
      shell.progress(steps,pageStep[page]??0);
      shell.root.classList.toggle('busy',busy||scanning);
      if(page==='welcome'){
        shell.heading(t('ui.29f50d7d9a27'),t('ui.0172115f4dbb'));
        shell.stage.innerHTML=`<div class="assistant-welcome migration-welcome">
          <div class="assistant-hero">${migrationIcon}<div><h2>${t('app.ln9.31804ebc0697')}${t('app.ln2.73836a60d8ea')}</h2><p>${t('app.ln8.bb58052af976')}</p></div></div>
          <section class="assistant-checklist"><h3>${t('app.ln8.73ccbcc09cd4')}</h3><ul><li>${t('app.ln9.4efbac457de5')}${t('app.ln6.e0b650bb5b33')}。</li><li>${t('app.ln8.e8dbf0bc17af')}</li><li>${t('app.ln8.7a29c6fe4c74')}</li></ul></section>
          <div class="assistant-privacy-note"><b>${t('app.ln8.6694b653661e')}</b><span>${t('app.ln8.6d6a17c66c6d')}</span></div>
        </div>`;
        setButtons({cancelLabel:t('ui.feecb1e6adec'),backHidden:true,nextLabel:t('ui.1fc1afc5c55e'),note:t('ui.2bda46da7007')});
      }else if(page==='source'){
        shell.heading(t('app.ln6.6189159e688d'),t('ui.f6a50d722c83'));
        shell.stage.innerHTML=`<div class="assistant-choice-list">${renderSourceCards()}</div>`;
        shell.stage.querySelectorAll('input[name="migration-source"]').forEach(input=>input.addEventListener('change',()=>{
          source=input.value;
          discovered=false;archiveError='';
          if(source!=='archive')archive=null;
          render();
        }));
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('ui.1fc1afc5c55e'),note:t('ui.b0f9e07eb254')});
      }else if(page==='search'){
        shell.heading(source==='archive'?`${t('app.ln9.acc442097f0c')}${t('app.ln2.ed01c7a92ec8')}`:t('ui.ac2966f77a53'),source==='archive'?t('ui.18032c2032cf'):t('ui.957d72129fd9'));
        if(source==='archive'){
          shell.stage.innerHTML=`<div class="migration-archive-picker">
            <div class="assistant-source-glyph">⇧</div>
            <h2>${archive?esc(archive.name):`${t('app.ln9.c4e6142c4e4a')}${t('app.ln2.ed01c7a92ec8')}`}</h2>
            <p>${archive?`${formatBytes(archive.size)} · ${esc(archive.machineName||t('app.ln6.6ac6fcc54148'))}`:t('ui.c02e656db29f')}</p>
            <button class="aqua-btn default choose-migration-archive">${archive?t('ui.e54a3aa92533'):t('app.ln6.6846276a834a')}</button>
            <input type="file" accept=".json,.migrationarchive,application/json" hidden>
            ${archiveError?`<div class="assistant-inline-error">${esc(archiveError)}</div>`:''}
            <div class="assistant-info-box"><b>${t('app.ln8.516c06670854')}</b><span>${t('app.ln9.622cd9da8743')}</span></div>
          </div>`;
          const input=shell.stage.querySelector('input[type="file"]');
          shell.stage.querySelector('.choose-migration-archive').addEventListener('click',()=>input.click());
          input.addEventListener('change',async()=>{
            const file=input.files?.[0];
            if(!file)return;
            archiveError='';
            archive={name:file.name,size:file.size,lastModified:file.lastModified,machineName:file.name.replace(/\.(json|migrationarchive)$/i,'')||t('app.ln2.ed01c7a92ec8')};
            if(file.size<=1024*1024&&/(\.json|\.migrationarchive)$/i.test(file.name)){
              try{
                const parsed=JSON.parse(await file.text());
                if(parsed&&typeof parsed==='object'){
                  archive.machineName=String(parsed.machineName||parsed.computerName||parsed.name||archive.machineName).slice(0,80);
                  archive.version=String(parsed.version||'1.0').slice(0,20);
                }
              }catch(error){archiveError=t('ui.771df9334ce7');}
            }
            discovered=true;render();
          });
          setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('ui.1fc1afc5c55e'),nextDisabled:!archive,note:t('ui.69f0e1fbbaec')});
        }else{
          const found=discovered;
          const item=source==='mac'
            ? {name:t('ui.2de264e1d81b'),detail:t('ui.4b1149f1d74e'),glyph:'⌘'}
            : source==='disk'
              ? {name:'Leopard Backup',detail:t('ui.cb3d96dd7559'),glyph:'▣'}
              : {name:t('ui.3b3de892ef9f'),detail:t('ui.ff4f14c6331a'),glyph:'◷'};
          shell.stage.innerHTML=`<div class="migration-discovery">
            <div class="assistant-radar ${found?'found':'searching'}"><i></i><span>${found?'✓':'⌁'}</span></div>
            <h2>${found?t('app.ln6.7b9b9fff8c66'):t('ui.455d8705421a')}</h2>
            <p>${found?t('ui.d8e012a9db2b'):t('ui.3ddcc566c369')}</p>
            <div class="migration-found-source ${found?'visible':''}"><i>${item.glyph}</i><span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></span><em>${t('app.ln.a48c934a0a')}</em></div>
            <button class="aqua-btn retry-search" ${found?'':'disabled'}>${t('app.ln8.ffafdccdf300')}</button>
          </div>`;
          shell.stage.querySelector('.retry-search').addEventListener('click',()=>{
            discovered=false;startDiscovery();
          });
          setButtons({cancelLabel:found?t('ui.4d0b4688c787'):t('ui.a17f70a8d3d6'),backDisabled:!found,nextLabel:t('ui.1fc1afc5c55e'),nextDisabled:!found,note:found?t('ui.0d312e434cb7'):t('ui.268d79701327')});
          if(!scanning&&!discovered)startDiscovery();
        }
      }else if(page==='verify'){
        shell.heading(t('ui.6e1c2d886b15'),t('ui.f45bdfd80210'));
        shell.stage.innerHTML=`<div class="migration-verification">
          <div class="migration-code-label">${t('app.ln8.b9ab15b0b0b5')}</div>
          <output>481–729</output>
          <div class="migration-machine-row"><i>⌘</i><span><b>${t('app.ln9.548408db66c7')}${t('app.ln2.1fb11ee071ef')}</b><small>Mac OS X 10.5.8 · ${t('app.ln9.5664bea351b5')}${t('app.ln3.4972f15b7fe4')}</small></span><em>${t('app.ln2.7bd39f0e2c35')}</em></div>
          <label class="assistant-confirm-check"><input type="checkbox" ${verificationAccepted?'checked':''}> ${t('app.ln8.e5644c1945b1')}</label>
          <p class="assistant-muted">${t('app.ln8.371b46daa7f1')}</p>
        </div>`;
        shell.stage.querySelector('input').addEventListener('change',event=>{
          verificationAccepted=event.target.checked;
          shell.next.disabled=!verificationAccepted;updateWindowState();
        });
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('ui.1fc1afc5c55e'),nextDisabled:!verificationAccepted,note:t('ui.6e655be786be')});
      }else if(page==='categories'){
        const total=selectedSize();
        shell.heading(t('app.ln6.2efec530c2eb'),`${t('app.ln9.8e4a4ac4b0b6')}${currentSourceLabel()}${t('app.ln9.320384d97635')}`);
        shell.stage.innerHTML=`<div class="migration-selection">
          <div class="migration-selection-head"><b>${t('app.ln8.8ab50b3c3551')}</b><span>${t('app.ln.aa9a2238c2')}</span></div>
          <div class="migration-category-list">${renderCategories()}</div>
          <div class="migration-space-summary">
            <div><span>${t('app.ln8.fc958ab9bfca')}</span><b>${assistantGB(total)}</b></div>
            <div><span>${t('app.ln9.06b5651af8b1')}</span><b>${assistantGB(assistantBytes(56.9)-total)}</b></div>
            <div><span>${t('migration.storageLabel')}</span><b>${esc(quotaText)}</b></div>
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
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('app.ln2.ac8efd2b0cd9'),nextDisabled:!selected.size,note:`${t('migration.categories',{n:selected.size})} · ${assistantGB(total)}`});
      }else if(page==='progress'){
        shell.heading(t('app.ln6.5509402c5078'),t('ui.9d4250154b65'));
        shell.stage.innerHTML=`<div class="assistant-operation">
          <div class="assistant-operation-icon">${migrationIcon}</div>
          <h2 class="assistant-operation-stage">${esc(transferStage||t('app.ln2.5d2b000b585f'))}</h2>
          <div class="assistant-progress-bar"><i style="width:${transferProgress}%"></i></div>
          <div class="assistant-progress-labels"><span>${Math.round(transferProgress)}%</span><span>${t('migration.ofProgress',{done:assistantGB(selectedSize()*transferProgress/100),total:assistantGB(selectedSize())})}</span></div>
          <ul class="assistant-operation-log">
            <li class="${transferProgress>=8?'done':'active'}">${t('app.ln8.28294c7274d8')}</li>
            <li class="${transferProgress>=28?'done':transferProgress>=8?'active':''}">${t('migration.readAccounts')}</li>
            <li class="${transferProgress>=62?'done':transferProgress>=28?'active':''}">${t('app.ln8.df053763f8df')}</li>
            <li class="${transferProgress>=92?'done':transferProgress>=62?'active':''}">${t('app.ln8.a7caeb815071')}</li>
          </ul>
        </div>`;
        setButtons({cancelLabel:t('ui.a17f70a8d3d6'),backHidden:true,nextHidden:true,note:t('ui.0ee4297e5794')});
      }else if(page==='complete'){
        shell.heading(t('ui.3810a87c7215'),t('ui.bb77420d187e'));
        shell.stage.innerHTML=`<div class="assistant-complete">
          <div class="assistant-complete-mark">✓</div>
          <h2>${t('migration.doneCategories',{n:selected.size})}</h2>
          <p>${t('app.ln9.b6f7e5ebb2f8')}${esc(result?.source||currentSourceLabel())}<br>${t('migration.resultLabel')}${esc(result?.folder||'')}</p>
          <div class="assistant-result-actions">
            <button class="aqua-btn default" data-result-action="reveal">${t('app.ln2.8dac46de1e85')}</button>
            <button class="aqua-btn" data-result-action="open">${t('app.ln8.de771ce2283a')}</button>
          </div>
          <section class="assistant-summary-card"><b>${t('app.ln8.a4316f24ee8f')}</b><span>${categories.filter(item=>selected.has(item.id)).map(item=>esc(item.name)).join('、')}</span><small>${t('app.ln8.5582dd7bb806')}</small></section>
        </div>`;
        shell.stage.querySelector('[data-result-action="reveal"]').addEventListener('click',revealResult);
        shell.stage.querySelector('[data-result-action="open"]').addEventListener('click',openResult);
        setButtons({cancelLabel:t('app.ln6.ae4b424da9db'),backHidden:true,nextLabel:t('ui.33246f6a5e5b'),note:t('ui.3111ac8bd675')});
      }else{
        shell.heading(t('ui.7494433cf415'),t('ui.a2fe6518a767'));
        shell.stage.innerHTML=`<div class="assistant-error"><i>!</i><h2>${t('app.ln8.8467f4e8a456')}</h2><p>${t('app.ln8.ec20514db415')}</p></div>`;
        setButtons({cancelLabel:t('ui.feecb1e6adec'),backLabel:t('ui.11d024154013'),nextHidden:true,note:t('app.ln7.88ea166ede64')});
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
      const base=paths.documents;
      if(!VFS.isDir(base))return null;
      let folder=null;
      let reportPath=null;
      const now=new Date();
      const sourceName=currentSourceLabel();
      VFS.transaction(t('app.ln7.96c3636c2083'),()=>{
        folder=uniqueAssistantDirectory(base,t('ui.f56a82fe9b99'));
        if(!folder)return;
        const lines=[
          `${t('app.ln2.73836a60d8ea')}${t('app.ln8.a4316f24ee8f')}`,
          '================',
          `${t('migration.completedAt')}${now.toLocaleString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}`,
          `${t('app.ln9.b6f7e5ebb2f8')}${sourceName}`,
          `${t('migration.destination')}${folder}`,
          `${t('app.ln9.22cfc2c0f0ac')}${t('app.ln7.4228f6f0efac')}${assistantGB(selectedSize())}`,
          '',
          t('app.ln7.1f1ef23a6a91'),
          ...categories.filter(item=>selected.has(item.id)).map(item=>`• ${item.name} — ${assistantGB(item.size)}`),
          '',
          t('ui.e1f5da370afa'),
          t('ui.86e145921b2d'),
        ];
        reportPath=`${folder}/${t('migration.reportFile')}`;
        VFS.putNode(reportPath,{type:'file',content:lines.join('\n'),mime:'text/plain',creator:'migration',generated:true,kind:'document'});
        if(selected.has('applications'))VFS.putNode(`${folder}/${t('migration.appsListFile')}`,{type:'file',content:'Safari\nMail\niCal\niTunes\nTextEdit\nPreview\nUtilities\n',mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('users'))VFS.putNode(`${folder}/${t('migration.userAccountFile')}`,{type:'file',content:`${t('migration.accountShort')}\n${t('migration.originalComputer')}${t('app.ln9.548408db66c7')}${t('app.ln2.1fb11ee071ef')}\n${t('app.ln7.f26ae2105215')}\n`,mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('files'))VFS.putNode(`${folder}/${t('migration.otherFilesFile')}`,{type:'file',content:t('app.ln7.c0fa3b3ed08f'),mime:'text/plain',creator:'migration',generated:true});
        if(selected.has('settings'))VFS.putNode(`${folder}/${t('migration.settingsFile')}`,{type:'file',content:JSON.stringify({desktop:'Aurora',network:'Leopard Web',timeZone:'Asia/Kuching',printers:['Leopard PDF Printer']},null,2),mime:'application/x-plist',creator:'migration',generated:true});
      },{paths:[base]});
      if(!folder||!reportPath||!VFS.get(reportPath)){
        if(folder&&VFS.get(folder))VFS.remove(folder,{record:false,label:t('ui.edcd350b425e')});
        return null;
      }
      System.addRecentDocument?.(reportPath,'textedit');
      System.syslog?.(t('migration.syslog',{source:sourceName,n:selected.size}), 'Migration Assistant');
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
      if(labels[1])labels[1].textContent=`${assistantGB(selectedSize()*transferProgress/100)} ${t('migration.of')} ${assistantGB(selectedSize())}`;
      transferStage=transferProgress<12?t('ui.d2e5a795090d'):transferProgress<30?t('app.ln7.5d2bb02c8b7d'):transferProgress<65?t('ui.5ba99e1c1813'):transferProgress<91?t('ui.afe28f2b8e90'):t('app.ln7.09fb80321828');
      if(stage)stage.textContent=transferStage;
      shell.stage.querySelectorAll('.assistant-operation-log li').forEach((item,index)=>{
        const points=[8,28,62,92];
        item.className=transferProgress>=points[index]?'done':index===0||transferProgress>=points[index-1]?'active':'';
      });
    }
    function startTransfer(){
      clearOperation();
      busy=true;transferProgress=0;transferStage=t('app.ln2.5d2b000b585f');
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
      body.innerHTML=`<h3>${t('app.ln8.0209bb3fb9d6')}</h3><p>${t('migration.incompleteNote')}</p>`;
      System.showSheet({
        parent:win,content:body,className:'assistant-stop-confirm',
        buttons:[
          {label:t('ui.099c19037f16'),cancel:true},
          {label:t('ui.a17f70a8d3d6'),danger:true,default:true,action:()=>{
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
      app:'migration',title:t('app.ln2.73836a60d8ea'),width:790,height:590,content:shell.root,bodyBg:'#ececec',noResize:true,
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
      quotaText=quota?`${quota>=1024*1024*1024?assistantGB(quota):formatBytes(quota)} ${t('migration.available')}`:t('app.ln2.5731a87065ea');
      if(page==='categories')render();
    }).catch(()=>{quotaText=t('app.ln2.5731a87065ea');if(page==='categories')render();});
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
    const shell=createAssistantShell('bootcamp',t('ui.93fefd1a2d2f'),bootCampIcon);
    const labels=()=>operation==='remove'
      ? [t('app.ln2.2bba6efa4075'),t('app.ln7.e52f3cb3e7ed'),t('app.ln7.6232f907a3a7'),t('ui.33246f6a5e5b')]
      : [t('app.ln2.2bba6efa4075'),t('app.ln7.d4bc010d5711'),t('app.ln7.c2553ecf40a3'),t('app.ln7.6a4f3274327f'),t('app.ln7.0d9884783d9c'),t('ui.33246f6a5e5b')];
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
    const sourceLabel=()=>media==='iso'?(iso?.name||t('ui.c89e3de93470')):t('ui.18b60b6754bf');
    const renderPartitionGraphic=()=>`<div class="bootcamp-volume-map">
      <section class="mac-volume" style="flex-basis:${TOTAL_GB-windowsGB}%"><i>⌘</i><b>Mac OS X</b><strong>${(TOTAL_GB-windowsGB).toFixed(0)} GB</strong><small>${macFreeAfter().toFixed(1)} GB ${t('app.ln.a48c934a0a')}</small></section>
      <div class="bootcamp-divider" aria-hidden="true"><i></i></div>
      <section class="windows-volume" style="flex-basis:${windowsGB}%"><i>⊞</i><b>WINDOWS</b><strong>${windowsGB.toFixed(0)} GB</strong><small>BOOTCAMP</small></section>
    </div>`;

    const render=()=>{
      shell.progress(labels(),pageIndex());
      shell.root.classList.toggle('busy',busy);
      if(page==='welcome'){
        shell.heading(existing?t('ui.f0d5d9f25b9e'):t('ui.53a78f9414a2'),existing?t('ui.a8db974ed254'):t('ui.6f17071af9d2'));
        shell.stage.innerHTML=`<div class="assistant-welcome bootcamp-welcome">
          <div class="assistant-hero">${bootCampIcon}<div><h2>${existing?t('app.ln7.da25becd6c30'):t('ui.47df17cc1518')}</h2><p>${existing
            ? t('bootcamp.existingNote',{gb:Number(existing.windowsGB||32).toFixed(0)})
            : t('ui.b2fce7ccd3fc')}</p></div></div>
          ${existing?`<div class="bootcamp-existing-card">${renderPartitionGraphic()}<label class="assistant-confirm-check"><input type="radio" checked> ${t('bootcamp.restoreSingle')}</label></div>`:''}
          <section class="bootcamp-prerequisites"><h3>${t('app.ln8.4a013185d976')}</h3>
            <ul><li class="ok"><i>✓</i><span><b>Intel ${t('app.ln.2ccf063c49')}</b><small>${t('app.ln8.20d4c85c5634')}</small></span></li>
            <li class="ok"><i>✓</i><span><b>${t('app.ln8.8f10a8b64ee6')}</b><small>${t('bootcamp.adminCanChange')}</small></span></li>
            <li class="ok"><i>✓</i><span><b>${t('app.ln8.5999e31632d4')}</b><small>${t('bootcamp.spaceForPartition',{gb:(TOTAL_GB-MAC_USED_GB).toFixed(1)})}</small></span></li>
            <li class="ok"><i>✓</i><span><b>${t('app.ln8.beaad5447aea')}</b><small>${t('app.ln8.58e76ecb0308')}</small></span></li></ul>
          </section>
          <div class="assistant-privacy-note"><b>${t('app.ln8.d73cc27578dd')}</b><span>${t('bootcamp.virtualOnly')}</span></div>
        </div>`;
        setButtons({cancelLabel:t('ui.feecb1e6adec'),backHidden:true,nextLabel:existing?t('ui.1fc1afc5c55e'):t('ui.1fc1afc5c55e'),note:existing?t('ui.b2d99a35f7c3'):t('ui.c99ed051f875')});
      }else if(page==='media'){
        shell.heading(t('ui.7a343742d32e'),t('ui.e66d781cf069'));
        shell.stage.innerHTML=`<div class="bootcamp-media">
          <label class="assistant-choice ${media==='dvd'?'selected':''}"><input type="radio" name="bootcamp-media" value="dvd" ${media==='dvd'?'checked':''}>
            <i>◎</i><span><b>${t('bootcamp.windowsInstallDvd')}</b><small>${t('bootcamp.windowsDvd')}</small><em>${t('bootcamp.virtualMedia')}</em></span>
          </label>
          <label class="assistant-choice ${media==='iso'?'selected':''}"><input type="radio" name="bootcamp-media" value="iso" ${media==='iso'?'checked':''}>
            <i>▱</i><span><b>${t('app.ln8.c1f4ff23c7fa')}</b><small>${iso?`${esc(iso.name)} · ${formatBytes(iso.size)}`:t('app.ln7.8c824d80dab5')}</small><em>${t('app.ln8.0e30c73c30c9')}</em></span>
          </label>
          <div class="bootcamp-media-actions"><button class="aqua-btn choose-bootcamp-iso">${iso?t('ui.1dc607b1790d'):t('ui.91e1a7693bf8')}</button><input type="file" accept=".iso,application/x-iso9660-image" hidden><span>${iso?t('ui.30950b63ce13'):t('ui.17622d2d7788')}</span></div>
          <div class="assistant-info-box"><b>${t('app.ln9.88d18ef9cbeb')}</b><span>${media==='dvd'||iso?t('ui.a658df50c703'):t('ui.70db852dd585')}</span></div>
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
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('ui.1fc1afc5c55e'),nextDisabled:media==='iso'&&!iso,note:sourceLabel()});
      }else if(page==='partition'){
        shell.heading(t('ui.8acd1c582f0c'),t('ui.c881d0fce08a'));
        shell.stage.innerHTML=`<div class="bootcamp-partition">
          ${renderPartitionGraphic()}
          <div class="bootcamp-size-control">
            <label><span>${t('bootcamp.partitionSize')}</span><input type="range" min="20" max="44" step="1" value="${windowsGB}" data-bootcamp-size><output>${windowsGB.toFixed(0)} GB</output></label>
            <div><button class="aqua-btn" data-partition-preset="32">${t('app.ln7.43b9e04f719c')}</button><button class="aqua-btn" data-partition-preset="40">${t('app.ln9.af6c27c71b9b')}</button></div>
          </div>
          <dl class="bootcamp-capacity">
            <dt>${t('bootcamp.macUsed')}</dt><dd>${MAC_USED_GB.toFixed(1)} GB</dd>
            <dt>${t('bootcamp.macAfter')}</dt><dd>${macFreeAfter().toFixed(1)} GB</dd>
            <dt>Windows ${t('app.ln5.b2cb9370d85a')}</dt><dd>${windowsGB<=32?'MS-DOS（FAT32）':t('ui.f3a53faa2c59')}</dd>
          </dl>
          <div class="assistant-warning-box"><b>${t('app.ln9.a616925ce436')}</b><span>${t('app.ln9.0a6c00cd1d11')}</span></div>
        </div>`;
        const range=shell.stage.querySelector('[data-bootcamp-size]');
        const updatePartition=()=>{
          shell.stage.querySelector('.bootcamp-volume-map').outerHTML=renderPartitionGraphic();
          shell.stage.querySelector('.bootcamp-size-control output').textContent=`${windowsGB.toFixed(0)} GB`;
          const values=shell.stage.querySelectorAll('.bootcamp-capacity dd');
          if(values[1])values[1].textContent=`${macFreeAfter().toFixed(1)} GB`;
          if(values[2])values[2].textContent=windowsGB<=32?'MS-DOS（FAT32）':t('ui.f3a53faa2c59');
          shell.footnote.textContent=`Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · Windows ${windowsGB.toFixed(0)} GB`;
        };
        range.addEventListener('input',()=>{
          windowsGB=Number(range.value);updatePartition();updateWindowState();
        });
        shell.stage.querySelectorAll('[data-partition-preset]').forEach(button=>button.addEventListener('click',()=>{
          windowsGB=Number(button.dataset.partitionPreset);range.value=String(windowsGB);updatePartition();
        }));
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:t('ui.1fc1afc5c55e'),note:`Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · Windows ${windowsGB.toFixed(0)} GB`});
      }else if(page==='review'){
        const removing=operation==='remove';
        shell.heading(removing?t('app.ln7.6f2450aae516'):t('ui.e8efcf634063'),removing?t('ui.53fe0caf9cde'):t('ui.ac070f1670b5'));
        shell.stage.innerHTML=`<div class="bootcamp-review">
          <div class="bootcamp-review-disk">${renderPartitionGraphic()}</div>
          <dl><dt>${t('app.ln2.b930bee566ab')}</dt><dd>${removing?t('ui.82f6794f1ba5'):t('ui.a941e3529f22')}</dd>
            ${removing?'':`<dt>${t('app.ln9.7f719e9e654b')}</dt><dd>${esc(sourceLabel())}</dd><dt>Windows ${t('app.ln7.37032d513a92')}</dt><dd>${windowsGB.toFixed(0)} GB · ${windowsGB<=32?'FAT32':t('ui.9df02bb9844a')}</dd>`}
            <dt>${t('app.ln9.ec5e17f1a855')}</dt><dd class="ok">${t('app.ln9.b196761453d5')}</dd><dt>${t('app.ln9.c34031cf77fe')}</dt><dd>${t('app.ln9.bf77e250dcc2')}</dd></dl>
          <label class="assistant-confirm-check"><input type="checkbox" data-bootcamp-confirm> ${t('bootcamp.confirmRead')}</label>
          <div class="assistant-warning-box"><b>${removing?t('ui.bdfaf1bf94ef'):t('ui.e20e8bf7571b')}</b><span>${removing?t('ui.f1e7b0e6f26f'):t('ui.e37e31f703d9')}</span></div>
        </div>`;
        const confirm=shell.stage.querySelector('[data-bootcamp-confirm]');
        confirm.addEventListener('change',()=>{shell.next.disabled=!confirm.checked;updateWindowState();});
        setButtons({cancelLabel:t('ui.4d0b4688c787'),nextLabel:removing?t('app.ln7.e008564f4746'):t('app.ln7.37032d513a92'),nextDisabled:true,note:removing?t('ui.040a4f8a9d4d'):t('bootcamp.willCreate',{gb:windowsGB.toFixed(0)})});
      }else if(page==='progress'){
        const removing=operation==='remove';
        shell.heading(removing?t('app.ln2.aa09b4581677'):t('ui.73726b6ae417'),commitStarted?t('ui.f1231fc491f3'):t('ui.88357e2a5b4b'));
        shell.stage.innerHTML=`<div class="assistant-operation bootcamp-operation">
          <div class="assistant-operation-icon">${bootCampIcon}</div>
          <h2 class="assistant-operation-stage">${esc(progressStage||t('app.ln2.d026c7d62819'))}</h2>
          <div class="assistant-progress-bar"><i style="width:${progress}%"></i></div>
          <div class="assistant-progress-labels"><span>${Math.round(progress)}%</span><span>${commitStarted?t('app.ln2.35d84b26633c'):t('ui.2589da6a3d77')}</span></div>
          <ul class="assistant-operation-log">
            <li class="${progress>=12?'done':'active'}">${t('app.ln9.23599a59278a')}</li>
            <li class="${progress>=42?'done':progress>=12?'active':''}">${removing?t('ui.da4846b2e5fd'):t('ui.52b10f35e270')}</li>
            <li class="${progress>=72?'done':progress>=42?'active':''}">${removing?t('ui.d3167a21f770'):t('ui.f3a0bc1c4800')}</li>
            <li class="${progress>=94?'done':progress>=72?'active':''}">${removing?t('app.ln7.b2daaae42be7'):t('ui.658747003bc2')}</li>
          </ul>
        </div>`;
        setButtons({cancelLabel:commitStarted?t('app.ln2.b199084baca7'):t('ui.a17f70a8d3d6'),cancelDisabled:commitStarted,backHidden:true,nextHidden:true,note:commitStarted?t('ui.0c719abf2fb1'):t('app.ln2.bba83a268174')});
      }else if(page==='complete'){
        const removing=operation==='remove';
        shell.heading(removing?t('ui.f8cb29213941'):t('ui.0266dafac03c'),removing?t('ui.eaebae038cb1'):t('ui.8170e1be2d6d'));
        shell.stage.innerHTML=`<div class="assistant-complete bootcamp-complete">
          <div class="assistant-complete-mark">✓</div><h2>${removing?t('ui.e68a1da38782'):t('ui.0bc925641882')}</h2>
          <p>${removing?t('ui.c6d201ab4828'):`BOOTCAMP：${windowsGB.toFixed(0)} GB<br>${t('app.ln9.7f719e9e654b')}：${esc(sourceLabel())}`}</p>
          <div class="assistant-result-actions">
            <button class="aqua-btn" data-bootcamp-result="report">${t('app.ln9.021c34c2095f')}</button>
            ${removing?'':`<button class="aqua-btn default" data-bootcamp-result="restart">${t('bootcamp.restartInstall')}</button>`}
          </div>
          <section class="assistant-summary-card"><b>${removing?t('app.ln7.8cdc52721ee1'):t('app.ln7.4f18e58deb20')}</b><span>${esc(result?.summary||t('ui.abb235feac98'))}</span><small>${t('app.ln9.9d036c571f59')}</small></section>
        </div>`;
        shell.stage.querySelector('[data-bootcamp-result="report"]').addEventListener('click',openReport);
        shell.stage.querySelector('[data-bootcamp-result="restart"]')?.addEventListener('click',showRestartConfirmation);
        setButtons({cancelHidden:true,backHidden:true,nextLabel:t('ui.33246f6a5e5b'),note:t('ui.1e2f0645b67e')});
      }else if(page==='installer'){
        shell.heading(t('ui.be76073e604b'),t('ui.9c17606edf8c'));
        shell.stage.innerHTML=`<div class="bootcamp-installer-screen" tabindex="0">
          <div class="bootcamp-bios">Apple Computer<br>Boot Camp BIOS Compatibility Module</div>
          <div class="bootcamp-press-key">Press any key to boot from CD or DVD<span class="bootcamp-cursor">_</span></div>
          <div class="bootcamp-setup-title">Windows is loading files…</div>
          <div class="bootcamp-setup-progress"><i></i></div>
          <small>${t('bootcamp.virtualInstallPreview')}</small>
        </div>`;
        setButtons({cancelHidden:true,backHidden:true,nextLabel:t('ui.b3177a688d48'),note:t('bootcamp.virtualRestart')});
      }else{
        shell.heading(t('ui.66a6fccce29b'),t('ui.0630be777b6c'));
        shell.stage.innerHTML=`<div class="assistant-error"><i>!</i><h2>${t('app.ln7.cfe09042aea7')}</h2><p>${t('app.ln7.d1aff642355e')}</p></div>`;
        setButtons({cancelLabel:t('ui.feecb1e6adec'),backLabel:t('ui.11d024154013'),nextHidden:true,note:t('app.ln7.e44fbe0c4ae3')});
      }
      updateWindowState();
    };

    function performBootCampOperation(){
      const base=paths.documents;
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
      VFS.transaction(removing?t('ui.775fb8aaaa4a'):t('ui.4902650b418d'),()=>{
        folder=uniqueAssistantDirectory(base,removing?t('ui.f4929d3cdd1e'):t('ui.93fefd1a2d2f'));
        if(!folder)return;
        const lines=[
          removing?t('ui.1f5c32c4dbe1'):t('ui.c9d04b996ef4'),
          '====================',
          `${t('migration.completedAt')}${now.toLocaleString(document.documentElement.lang==='zh-CN'?'zh-CN':'en-US')}`,
          `Macintosh HD：${removing?TOTAL_GB:TOTAL_GB-windowsGB} GB`,
          ...(removing?[]:[`BOOTCAMP：${windowsGB} GB`,`${t('app.ln9.7f719e9e654b')}：${sourceLabel()}`,`${t('bootcamp.formatLabel')}${windowsGB<=32?'FAT32':t('ui.2a043a8d5dee')}`]),
          '',
          t('ui.a7d08ea5355e'),
        ];
        reportPath=`${folder}/${removing?t('ui.f4929d3cdd1e'):t('ui.887a4341de1c')}.txt`;
        VFS.putNode(reportPath,{type:'file',content:lines.join('\n'),mime:'text/plain',creator:'bootcamp',generated:true,kind:'document'});
        if(!removing)VFS.putNode(`${folder}/${t('bootcamp.driversFile')}`,{type:'file',content:t('bootcamp.driversContent'),mime:'text/plain',creator:'bootcamp',generated:true});
      },{paths:[base]});
      if(!folder||!reportPath||!VFS.get(reportPath)){
        if(folder&&VFS.get(folder))VFS.remove(folder,{record:false,label:t('ui.08fe69237f9c')});
        try{
          if(removing&&existing)save(BOOTCAMP_KEY,existing);
          else if(!removing)localStorage.removeItem(BOOTCAMP_KEY);
        }catch(error){}
        return null;
      }
      System.addRecentDocument?.(reportPath,'textedit');
      System.syslog?.(removing?t('ui.53a979992274'):t('ui.f6ffc04860f4'), 'Boot Camp Assistant');
      return {
        folder,reportPath,record,
        summary:removing
          ? t('ui.c39a343b4535')
          : `Mac OS X ${(TOTAL_GB-windowsGB).toFixed(0)} GB · BOOTCAMP ${windowsGB.toFixed(0)} GB`,
      };
    }
    function updateProgress(){
      const bar=shell.stage.querySelector('.assistant-progress-bar>i');
      const labels=shell.stage.querySelectorAll('.assistant-progress-labels span');
      const stage=shell.stage.querySelector('.assistant-operation-stage');
      if(bar)bar.style.width=`${progress}%`;
      if(labels[0])labels[0].textContent=`${Math.round(progress)}%`;
      if(labels[1])labels[1].textContent=commitStarted?t('app.ln2.35d84b26633c'):t('ui.2589da6a3d77');
      const removing=operation==='remove';
      progressStage=progress<14?t('app.ln2.d026c7d62819'):progress<43
        ? removing?t('ui.fc2a9371c148'):t('ui.65ec223d9739')
        :progress<73?removing?t('ui.7595db0268f5'):t('ui.82ede75fbfb9')
        :progress<94?removing?t('app.ln7.b5f1cc9d366f'):t('ui.6c1085d5a3b7')
        :t('app.ln7.45f23c4bd76d');
      if(stage)stage.textContent=progressStage;
      shell.heading(removing?t('app.ln2.aa09b4581677'):t('ui.73726b6ae417'),commitStarted?t('ui.f1231fc491f3'):t('ui.88357e2a5b4b'));
      shell.cancel.disabled=commitStarted;
      shell.cancel.textContent=commitStarted?t('app.ln2.b199084baca7'):t('ui.a17f70a8d3d6');
      shell.footnote.textContent=commitStarted?t('ui.0c719abf2fb1'):t('app.ln2.bba83a268174');
      shell.stage.querySelectorAll('.assistant-operation-log li').forEach((item,index)=>{
        const points=[12,42,72,94];
        item.className=progress>=points[index]?'done':index===0||progress>=points[index-1]?'active':'';
      });
      updateWindowState();
    }
    function startOperation(){
      clearOperation();busy=true;commitStarted=false;progress=0;progressStage=t('app.ln2.d026c7d62819');
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
        content.innerHTML=`<h3>${t('app.ln7.2605b1616947')}</h3><p>${t('app.ln7.672ba77cd6d4')}</p>`;
        System.showSheet({parent:win,content,className:'assistant-stop-confirm',buttons:[{label:t('ui.27e4fe4c3fe2'),default:true}]});
        return;
      }
      const content=el('div','assistant-stop-sheet');
      content.innerHTML=`<h3>${t('bootcamp.stopOp')}</h3><p>${t('app.ln9.40256d0b600c')}</p>`;
      System.showSheet({
        parent:win,content,className:'assistant-stop-confirm',
        buttons:[
          {label:t('ui.5e59842d581a'),cancel:true},
          {label:t('ui.a17f70a8d3d6'),danger:true,default:true,action:()=>{
            clearOperation();busy=false;commitStarted=false;page='review';render();
          }},
        ],
      });
    }
    function openReport(){if(result?.reportPath)System.openVfsPath?.(result.reportPath);}
    function revealResult(){if(result?.folder)System.launch('finder',{path:result.folder});}
    function showRestartConfirmation(){
      const content=el('div','bootcamp-restart-sheet');
      content.innerHTML=`${bootCampIcon}<div><h3>${t('bootcamp.restartToWindows')}</h3><p>${t('bootcamp.virtualPreviewOnly')}</p></div>`;
      System.showSheet({
        parent:win,content,className:'bootcamp-restart-confirm',
        buttons:[
          {label:t('app.ln6.63dcaf5ea178'),cancel:true},
          {label:t('app.ln2.0919666e5aae'),default:true,action:()=>setTimeout(()=>{page='installer';render();},170)},
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
      app:'bootcamp',title:t('ui.93fefd1a2d2f'),width:810,height:610,content:shell.root,bodyBg:'#ececec',noResize:true,
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
    id:'migration',name:t('app.ln2.73836a60d8ea'),icon:migrationIcon,open:openMigrationAssistant,multiWindow:false,
    about:t('ui.2c3da8d8f754'),
    keywords:t('ui.0c6e1d7c7879'),
  });
  System.registerApp({
    id:'bootcamp',name:t('ui.93fefd1a2d2f'),icon:bootCampIcon,open:openBootCampAssistant,multiWindow:false,
    about:t('ui.4438319e4113'),
    keywords:t('ui.8c39af2aa016'),
  });
})();
