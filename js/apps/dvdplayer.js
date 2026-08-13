// DVD Player — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;

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
            ${chapters.map((chapter,index)=>`<button data-menu-chapter="${index}">${index+1}. ${esc(chapter.title)}</button>`).join('')}
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
