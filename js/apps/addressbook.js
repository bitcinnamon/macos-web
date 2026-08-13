// Address Book — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
