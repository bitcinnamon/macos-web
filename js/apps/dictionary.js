// Dictionary — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
  // ---------- Dictionary ----------
  const dictionaryIcon=icon('dict','#cf3e34','#78150f','<path d="M14 12h31q5 0 5 5v35H19q-5 0-5-5z" fill="#f7efe1" stroke="#70231d" stroke-width="1.5"/><path d="M20 12v40M25 22h19M25 28h16M25 34h18" stroke="#b45a50" stroke-width="2"/><text x="35" y="47" text-anchor="middle" font-size="12" fill="#8e2019" stroke="none">Aa</text>');
  const WORDS={
    leopard:{title:'leopard',phonetic:'/ˈlepərd/',type:'noun',definitions:[t('app.ln3.2510aad0d63f'),t('app.ln3.8479ce7298ce')],synonyms:['panther','big cat'],apple:t('dict.leopard.apple')},
    finder:{title:'Finder',phonetic:'/ˈfaɪndər/',type:'proper noun',definitions:[t('app.ln3.fa3be7d10024')],synonyms:['file browser','desktop shell'],apple:t('app.ln3.8fcc33f5f280')},
    aqua:{title:'Aqua',phonetic:'/ˈɑːkwə/',type:'proper noun',definitions:[t('app.ln3.b2589d17bcf1'),t('app.ln3.64b2ec23a9d9')],synonyms:['water','aquamarine'],apple:t('app.ln3.c8468a159d79')},
    dock:{title:'Dock',phonetic:'/dɒk/',type:'noun',definitions:[t('app.ln3.37f734e7157c'),t('app.ln3.ba21304fb20f')],synonyms:['pier','wharf'],apple:t('app.ln3.71175ed133a7')},
    spotlight:{title:'Spotlight',phonetic:'/ˈspɒtlaɪt/',type:'noun',definitions:[t('app.ln3.515394a6089e'),t('app.ln3.b2c9b796c9a5')],synonyms:['limelight','focus'],apple:t('app.ln3.b072ea0a86d6')},
    dashboard:{title:'Dashboard',phonetic:'/ˈdæʃbɔːrd/',type:'noun',definitions:[t('app.ln3.573fa65d52c9')],synonyms:['control panel','instrument panel'],apple:t('app.ln3.38c7ff950bcd')},
    quartz:{title:'Quartz',phonetic:'/kwɔːrts/',type:'noun',definitions:[t('app.ln3.546f73b3979b')],synonyms:['silica','crystal'],apple:t('app.ln3.7ffd2079caca')},
    safari:{title:'Safari',phonetic:'/səˈfɑːri/',type:'noun',definitions:[t('app.ln3.16238f6a10b9')],synonyms:['expedition','journey'],apple:t('app.ln3.2901304ad2a8')},
    preview:{title:'Preview',phonetic:'/ˈpriːvjuː/',type:'noun / verb',definitions:[t('app.ln3.acc9929071df'),t('app.ln3.f035480d77ec')],synonyms:['advance view','sample'],apple:t('app.ln3.e75720898bce')},
    voiceover:{title:'VoiceOver',phonetic:'/ˈvɔɪsˌəʊvə/',type:'noun',definitions:[t('app.ln3.ef5f9c2c0165')],synonyms:['narration','commentary'],apple:t('app.ln3.e4a6fa224098')},
    trash:{title:'trash',phonetic:'/træʃ/',type:'noun / verb',definitions:[t('app.ln3.ac33bbee1f30'),t('app.ln3.0044f55b8854')],synonyms:['rubbish','waste','discard'],apple:t('app.ln3.1de0b7b0d534')},
    window:{title:'window',phonetic:'/ˈwɪndəʊ/',type:'noun',definitions:[t('app.ln4.c79872c1e69c'),t('app.ln4.9e813579a2b7')],synonyms:['opening','pane'],apple:t('app.ln5.a318f32fa19a')},
    file:{title:'file',phonetic:'/faɪl/',type:'noun / verb',definitions:[t('app.ln5.7fc02c82f1d0'),t('app.ln5.1f46e531e7de')],synonyms:['document','record'],apple:t('app.ln5.7d371f966657')},
    desktop:{title:'desktop',phonetic:'/ˈdesktɒp/',type:'noun',definitions:[t('app.ln5.8487213cea69'),t('app.ln5.26311d83ba2d')],synonyms:['workspace','work surface'],apple:t('app.ln5.74530a06799a')},
    network:{title:'network',phonetic:'/ˈnetwɜːk/',type:'noun / verb',definitions:[t('app.ln5.3d0c545f22fa'),t('app.ln5.b723d43e6c04')],synonyms:['system','web','connect'],apple:t('app.ln5.f4d316bce86a')},
    bluetooth:{title:'Bluetooth',phonetic:'/ˈbluːtuːθ/',type:'proper noun',definitions:[t('app.ln5.4e2383b54689')],synonyms:['wireless link'],apple:t('dict.bluetooth.apple')},
    microphone:{title:'microphone',phonetic:'/ˈmaɪkrəfəʊn/',type:'noun',definitions:[t('app.ln5.b3337989dd92')],synonyms:['mic','transducer'],apple:t('app.ln5.dcd69c663ade')},
    hello:{title:'hello',phonetic:'/həˈləʊ/',type:'exclamation / noun',definitions:[t('app.ln5.3241d184b70f')],synonyms:['hi','greetings'],apple:t('app.ln5.1bfcfafb313a')},
    apple:{title:'apple',phonetic:'/ˈæpəl/',type:'noun',definitions:[t('app.ln5.76cc439321d8')],synonyms:['fruit'],apple:t('app.ln5.176469323382')},
    dictionary:{title:'dictionary',phonetic:'/ˈdɪkʃəneri/',type:'noun',definitions:[t('app.ln5.e57b260650b5')],synonyms:['lexicon','wordbook'],apple:t('app.ln5.6c1e9973742d')},
  };
  function openDictionary(){
    let preferences=System.getAppPreferences?.('dictionary')||{};
    let tab=['definition','thesaurus','apple','wikipedia'].includes(preferences.defaultSource)?preferences.defaultSource:'definition';
    let word='leopard',entry=WORDS.leopard,requestId=0,audioUrl='',win=null;
    let abort=null;
    const remoteCache=new Map();
    const HISTORY_KEY='macweb.dictionary.history.v2';
    let history=jsonStore(HISTORY_KEY,[]);
    const toolbar=el('div','dict-toolbar');
    const tabs=el('div','dict-tabs');
    [['definition',t('app.ln5.7755f75dc53c')],['thesaurus',t('app.ln2.e6d9b18df34f')],['apple','Apple'],['wikipedia','Wikipedia']].forEach(([id,n])=>{const b=el('button','finder-toolbar-btn',n);b.dataset.tab=id;tabs.appendChild(b);});
    const searchWrap=el('div','dict-search-wrap');
    const search=el('input','aqua-input aqua-search');search.value=word;search.placeholder = t('app.ln5.109355f12601');
    const searchButton=el('button','aqua-btn default',t('app.ln5.07bfbf387d65'));
    searchWrap.append(search,searchButton);toolbar.append(tabs,searchWrap);
    const root=el('div','dict-app');const index=el('aside','dict-index'),article=el('article');root.append(index,article);
    const applyPreferences=()=>root.style.setProperty('--dict-font-size',`${Number(preferences.fontSize)||13}px`);
    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='dictionary')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('dictionary')||{};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    applyPreferences();
    const normalize=(value)=>String(value||'').trim().toLowerCase();
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.dictionaryTab=tab;
      win.dataset.dictionaryWord=word;
      win.dataset.dictionaryHistory=String(history.length);
      root.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
    };
    const related=(query)=>Object.keys(WORDS).filter(key=>key.includes(query)||query.includes(key.slice(0,Math.max(2,key.length-2)))).slice(0,12);
    const addHistory=(query)=>{history=[query,...history.filter(item=>item!==query)].slice(0,12);save(HISTORY_KEY,history);};
    const heading=(name,text)=>{const h=el(name);h.textContent=text;article.appendChild(h);return h;};
    const paragraph=(text,cls='')=>{const p=el('p',cls);p.textContent=text;article.appendChild(p);return p;};
    const renderIndex=(query=normalize(search.value))=>{
      index.innerHTML='';
      const makeSection=(title,items)=>{
        if(!items.length)return;
        index.appendChild(el('h4','',title));
        items.forEach(key=>{
          const local=WORDS[key];
          const b=el('button',key===word?'sel':'');
          b.dataset.word=key;b.textContent=local?.title||key;index.appendChild(b);
        });
      };
      const direct=Object.keys(WORDS).filter(key=>!query||key.includes(query)).slice(0,16);
      makeSection(query?t('app.ln5.0270d590e4fa'):t('app.ln5.5e98e33bee87'),direct.length?direct:related(query));
      makeSection(t('app.ln5.351139df2d8d'),history.filter(item=>!direct.includes(item)).slice(0,8));
    };
    const renderFooter=(source)=>{
      const footer=el('footer');
      footer.textContent=`${t('app.ln9.b6f7e5ebb2f8')}${source} · ${t('app.ln9.da252992230d')}`;
      article.appendChild(footer);
    };
    const pronounce=()=>{
      if(audioUrl){
        try{new Audio(audioUrl).play().catch(()=>{});}catch(error){}
        return;
      }
      if(!window.speechSynthesis||!entry?.title)return;
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(entry.title);
      utterance.lang=/[\u3400-\u9fff]/.test(entry.title)?'zh-CN':'en-US';
      window.speechSynthesis.speak(utterance);
    };
    const pronounceIfPreferred=()=>{if(preferences.autoPronounce)setTimeout(pronounce,0);};
    const renderDefinition=()=>{
      article.innerHTML='';
      heading('h1',entry.title||word);
      const pronunciation=el('div','dict-pronunciation');
      pronunciation.appendChild(el('span','phonetic',entry.phonetic||''));
      if(entry?.title){
        const speak=el('button','dict-speak',t('app.ln5.4bfe47631acd'));
        speak.addEventListener('click',pronounce);
        pronunciation.appendChild(speak);
      }
      article.appendChild(pronunciation);
      (entry.meanings||[{partOfSpeech:entry.type||'',definitions:(entry.definitions||[]).map(definition=>({definition}))}]).forEach(meaning=>{
        if(meaning.partOfSpeech)heading('h4',meaning.partOfSpeech);
        const ol=el('ol','dict-definitions');
        (meaning.definitions||[]).slice(0,8).forEach(item=>{
          const li=el('li');li.appendChild(document.createTextNode(item.definition||''));
          if(item.example){const example=el('p','dict-example');example.textContent=`“${item.example}”`;li.appendChild(example);}
          ol.appendChild(li);
        });
        article.appendChild(ol);
      });
      renderFooter(entry.source||t('ui.06b836c24537'));
    };
    const renderThesaurus=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');
      const synonyms=[...(entry.synonyms||[]),...(entry.meanings||[]).flatMap(item=>item.synonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      const antonyms=[...(entry.antonyms||[]),...(entry.meanings||[]).flatMap(item=>item.antonyms||[])].filter((item,pos,all)=>item&&all.indexOf(item)===pos);
      heading('h4',t('app.ln2.e6d9b18df34f'));const syn=el('div','dict-word-cloud');
      (synonyms.length?synonyms:[t('app.ln5.34993e4cc516')]).slice(0,24).forEach(text=>{const b=el('button','',text);if(synonyms.length)b.addEventListener('click',()=>lookup(text));else b.disabled=true;syn.appendChild(b);});article.appendChild(syn);
      heading('h4',t('app.ln5.24f9cf636e2c'));paragraph(antonyms.length?antonyms.slice(0,16).join('、'):t('app.ln5.5e8070292d0c'));
      renderFooter(entry.source||t('ui.06b836c24537'));
    };
    const renderApple=()=>{
      article.innerHTML='';heading('h1',entry.title||word);paragraph(entry.phonetic||'','phonetic');heading('h4',t('app.ln5.8e6ddd5f893e'));
      if(entry.apple)paragraph(entry.apple,'dict-apple-entry');
      else paragraph(t('app.ln5.7d3a175887a3'),'dict-notice');
      const terms=Object.keys(WORDS).filter(key=>WORDS[key].apple).slice(0,14);const links=el('div','dict-word-cloud');
      terms.forEach(key=>{const b=el('button','',WORDS[key].title);b.addEventListener('click',()=>lookup(key));links.appendChild(b);});article.appendChild(links);
      renderFooter(t('app.ln5.7b1e4e7bde5e'));
    };
    const renderWikipedia=async()=>{
      const id=++requestId;abort?.abort();abort=new AbortController();
      article.innerHTML='';heading('h1',word);paragraph(t('app.ln5.3cc52945e0db'),'dict-loading');
      const endBusy=System.beginBusy(180);
      try{
        const lang=/[\u3400-\u9fff]/.test(word)?'zh':'en';
        const response=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,{signal:abort.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error(response.status===404?t('app.ln5.626df9ece586'):`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        article.innerHTML='';heading('h1',data.title||word);
        if(data.thumbnail?.source){const img=el('img','dict-wiki-image');img.src=data.thumbnail.source;img.alt='';article.appendChild(img);}
        paragraph(data.description||t('app.ln5.7168edc33424'),'phonetic');
        paragraph(data.extract||t('app.ln5.6a7d0f63aeb8'),'dict-wiki-extract');
        if(data.content_urls?.desktop?.page){const a=el('a','dict-source-link',t('app.ln5.e6de7a83e094'));a.href=data.content_urls.desktop.page;a.target='_blank';a.rel=`noopener noreferrer`;article.appendChild(a);}
        renderFooter(`${lang}.wikipedia.org${t('app.ln9.1393ac09d204')}`);
      }catch(error){
        if(error.name==='AbortError')return;
        article.innerHTML='';heading('h1',word);paragraph(t('ui.feb7658ff0ff'),'dict-notice');
        const retry=el('button','aqua-btn default',t('app.ln5.2d64b3ce122b'));retry.addEventListener('click',renderWikipedia);article.appendChild(retry);
        renderFooter(t('app.ln5.10f33e8264cb'));
      }finally{endBusy();}
    };
    const render=()=>{
      tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
      renderIndex();
      if(tab==='definition')renderDefinition();
      else if(tab==='thesaurus')renderThesaurus();
      else if(tab==='apple')renderApple();
      else renderWikipedia();
      updateWindowState();
    };
    async function lookup(raw){
      const query=normalize(raw||search.value);if(!query)return;
      search.value=query;word=query;addHistory(query);renderIndex(query);
      if(WORDS[query]){entry=WORDS[query];audioUrl='';render();pronounceIfPreferred();return;}
      if(!/^[a-z][a-z' -]*$/i.test(query)){
        entry={title:query,type:'',definitions:[t('ui.fa1505ff80be')],synonyms:[],source:t('ui.06b836c24537')};
        audioUrl='';render();pronounceIfPreferred();return;
      }
      if(remoteCache.has(query)){entry=remoteCache.get(query);audioUrl=entry.audio||'';render();pronounceIfPreferred();return;}
      const id=++requestId;abort?.abort();abort=new AbortController();
      entry={title:query,type:'',definitions:[t('app.ln5.f8d3234cd0ef')],synonyms:[],source:t('app.ln5.7ca9cdfb7da8')};audioUrl='';renderDefinition();
      const endBusy=System.beginBusy(180);
      try{
        const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,{signal:abort.signal});
        if(!response.ok)throw new Error(response.status===404?t('app.ln5.225b7b138486'):`HTTP ${response.status}`);
        const data=await response.json();if(id!==requestId)return;
        const first=data[0]||{};
        entry={title:first.word||query,phonetic:first.phonetic||first.phonetics?.find(p=>p.text)?.text||'',meanings:first.meanings||[],synonyms:(first.meanings||[]).flatMap(m=>m.synonyms||[]),antonyms:(first.meanings||[]).flatMap(m=>m.antonyms||[]),audio:first.phonetics?.find(p=>p.audio)?.audio||'',source:'Free Dictionary API'};
        remoteCache.set(query,entry);audioUrl=entry.audio||'';render();pronounceIfPreferred();
      }catch(error){
        if(error.name==='AbortError')return;
        entry={title:query,type:'',definitions:[`${error.message}. ${t('app.ln9.2da0cee168fd')}`],synonyms:[],source:t('ui.1acb10384f91')};audioUrl='';render();
      }finally{endBusy();}
    }
    const setSource=(source)=>{
      if(!['definition','thesaurus','apple','wikipedia'].includes(source))return;
      tab=source;render();
    };
    const copyEntry=async()=>{
      const selected=window.getSelection?.()?.toString()?.trim();
      const text=selected||article.innerText.trim();
      if(!text)return;
      try{
        await navigator.clipboard.writeText(text);
        Leopard.toast('Dictionary',selected?t('ui.7f3acd8aab15'):t('ui.a09eeb432c0f'));
      }catch(error){System.alertBox('Dictionary',t('ui.46bb25e07540'));}
    };
    const previousEntry=()=>{if(history[1])lookup(history[1]);};
    const clearHistory=()=>{
      history=[];save(HISTORY_KEY,history);renderIndex();updateWindowState();
      Leopard.toast('Dictionary',t('app.ln5.68ef6fc034b9'));
    };
    tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();}});
    index.addEventListener('click',e=>{const b=e.target.closest('[data-word]');if(b)lookup(b.dataset.word);});
    search.addEventListener('input',()=>renderIndex());
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup();}});
    searchButton.addEventListener('click',()=>lookup());
    render();win=System.createWindow({app:'dictionary',title:'Dictionary',width:850,height:570,toolbar,content:root,statusbar:t('ui.b8076eb2792c'),onClose:()=>{
      abort?.abort();
      window.speechSynthesis?.cancel();
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command',event=>{
      const commands={
        'focus-search':()=>{search.focus();search.select();},
        'copy':copyEntry,'copy-entry':copyEntry,'pronounce':pronounce,
        'history-back':previousEntry,'clear-history':clearHistory,
        'source-dictionary':()=>setSource('definition'),
        'source-thesaurus':()=>setSource('thesaurus'),
        'source-apple':()=>setSource('apple'),
        'source-wikipedia':()=>setSource('wikipedia'),
      };
      const action=commands[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    updateWindowState();
  }
  System.registerApp({id:'dictionary',name:'Dictionary',icon:dictionaryIcon,open:openDictionary,about:t('ui.d4d8317f8bb1'),keywords:t('ui.82a409c4a7c9')});
