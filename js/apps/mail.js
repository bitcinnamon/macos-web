// Mail — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
