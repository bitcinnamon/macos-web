// Migration & Boot Camp Assistants — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
