// Keychain Access — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
