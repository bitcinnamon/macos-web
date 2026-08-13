// Grab — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;

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
      <nav aria-label="${t('app.ln2.c97cf7b42beb')}">${Object.entries(modes).map(([id,item])=>`<button data-mode="${id}"><i>${item.icon}</i><span><b>${esc(item.name)}</b><small>${esc(item.description)}</small></span></button>`).join('')}</nav>
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
