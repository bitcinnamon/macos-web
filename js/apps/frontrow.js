// Front Row — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
    root.innerHTML=`<div class="frontrow-logo"> <b>Front Row</b></div><main>${destinations.map((item,index)=>`<button data-app="${item.app}" data-index="${index}" aria-label="${esc(item.label)}，${esc(item.detail)}"><i>${item.glyph}</i><span>${esc(item.label)}</span><small>${esc(item.detail)}</small></button>`).join('')}</main><footer><b class="frontrow-current"></b><span>${t('app.ln7.1e9d444e4459')}</span></footer>`;
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
