// Photo Booth — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
