// QuickTime Player — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
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
