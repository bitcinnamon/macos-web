// iChat — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
