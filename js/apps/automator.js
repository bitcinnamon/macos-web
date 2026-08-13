// Automator — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
  // ---------- Automator ----------
  const automatorIcon=icon('auto','#d5d8dd','#737984','<path d="M19 14h27v36H19z" fill="#f3f3f3" stroke="#444" stroke-width="1.5"/><path d="M24 22h17M24 28h17M24 34h12" stroke="#777" stroke-width="2"/><circle cx="43" cy="43" r="9" fill="#68798d" stroke="#fff"/><path d="m39 43 3 3 6-8" fill="none" stroke="#fff" stroke-width="2.5"/>');
  const AUTOMATOR_RECOVERY_KEY='macweb.automator.workflow';
  const actions=[
    {id:'message',cat:t('app.ln.c0cdfbdb41'),name:t('ui.a328e1af02c9'),desc:t('ui.d406af23da0c'),defaultValue:t('ui.5669b335eb8c')},
    {id:'file',cat:t('ui.16c07a27796d'),name:t('ui.68797ab8e16e'),desc:t('ui.eee728d700ec'),defaultValue:t('ui.8d46aa72c135')},
    {id:'open',cat:t('ui.8a443802664a'),name:t('ui.f2632157a194'),desc:t('ui.299114375896'),defaultValue:'finder'},
    {id:'wallpaper',cat:t('ui.1a1f6dff7826'),name:t('ui.c915c6a3c06f'),desc:t('ui.16fe3e0f6aa1'),defaultValue:'aurora'},
    {id:'snapshot',cat:t('ui.1a1f6dff7826'),name:t('ui.7b8db47a09c0'),desc:t('ui.9a66bb43ef48'),defaultValue:''},
    {id:'pause',cat:t('app.ln.c0cdfbdb41'),name:t('ui.130448bce675'),desc:t('app.ln5.17511720c514'),defaultValue:'2'},
  ];
  const automatorDefaultValue=(id)=>actions.find(action=>action.id===id)?.defaultValue||'';
  const normalizeAutomatorWorkflow=(value)=>{
    const raw=Array.isArray(value)?value:[];
    return raw.map(step=>{
      const id=typeof step==='string'?step:String(step?.id||'');
      if(!actions.some(action=>action.id===id))return null;
      return {id,value:String(typeof step==='object'&&step?.value!=null?step.value:automatorDefaultValue(id))};
    }).filter(Boolean);
  };
  function openAutomator(arg){
    const initialPath=arg?.path?VFS.normalize(arg.path):null;
    const initialNode=initialPath?VFS.get(initialPath):null;
    let initialDocument=null;
    if(initialNode?.type==='file'){
      try{initialDocument=JSON.parse(initialNode.content||'');}catch(error){}
    }
    const recovery=jsonStore(AUTOMATOR_RECOVERY_KEY,{inputType:'none',steps:[]});
    let workflow=normalizeAutomatorWorkflow(initialDocument?.steps||(Array.isArray(recovery)?recovery:recovery.steps));
    let inputType=['none','files','text'].includes(initialDocument?.inputType)?initialDocument.inputType:
      (['none','files','text'].includes(recovery?.inputType)?recovery.inputType:'none');
    let currentPath=initialNode?.type==='file'?initialPath:null;
    let running=false,runToken=0,selectedStep=-1,searchQuery='',draggedStep=-1;
    let win=null,lastSaved='',closePrompt=null;

    const toolbar=el('div','automator-toolbar');
    const run=el('button','finder-toolbar-btn',t('app.ln5.a304418d10c7'));run.dataset.command='run-workflow';
    const stop=el('button','finder-toolbar-btn',t('ui.7138fba53475'));stop.dataset.command='stop-workflow';
    const saveBtn=el('button','finder-toolbar-btn',t('ui.091ca5213ef3'));saveBtn.dataset.command='save';
    const toolbarStatus=el('span','automator-toolbar-status',t('ui.b796f2d4ca85'));
    toolbar.append(run,stop,saveBtn,toolbarStatus);
    const root=el('div','automator-app');
    root.innerHTML=`<aside><header><b>${t('app.ln7.c77a4b588efb')}</b><small>${t('app.ln2.b930bee566ab')}</small></header>
      <input class="aqua-input aqua-search auto-search" type="search" placeholder= t('app.ln.1b941a42d3') aria-label="${t('app.ln.1b941a42d3')}">
      <div class="auto-actions" role="listbox" aria-label="${t('app.ln5.64e8fb9dd356')}"></div></aside>
      <main><header>${t('app.ln5.3924c53abaa9')}：
        <select class="aqua-select auto-input-type" aria-label="${t('app.ln5.3924c53abaa9')}"><option value="none">${t('app.ln5.959293f8f73d')}</option><option value="files">${t('app.ln5.6fbd6405bfee')}</option><option value="text">${t('app.ln7.0338013b0f72')}</option></select>
      </header><section class="auto-flow" aria-label="${t('app.ln6.981881ea9c22')}"></section>
      <footer><span>${t('app.ln7.37873a2d72ae')}</span><b class="auto-count"></b></footer></main>`;
    const list=root.querySelector('.auto-actions'),flow=root.querySelector('.auto-flow');
    const search=root.querySelector('.auto-search'),inputSelect=root.querySelector('.auto-input-type');
    const footerText=root.querySelector('main>footer>span'),count=root.querySelector('.auto-count');
    inputSelect.value=inputType;

    const serialized=()=>JSON.stringify({format:'com.apple.Automator.workflow',version:1,inputType,steps:workflow},null,2);
    const documentName=()=>currentPath?VFS.baseName(currentPath):t('app.ln2.18f70fe106e0');
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{
      detail:{appId:'automator',window:win,dirty:!!win?._documentDirty,path:currentPath,running},
    }));
    const updateWindowState=()=>{
      if(!win)return;
      win._path=currentPath;win.dataset.automatorRunning=String(running);
      win.dataset.automatorHasSteps=String(!!workflow.length);
      win.dataset.automatorSelection=String(selectedStep>=0&&selectedStep<workflow.length);
      win._title.textContent=`Automator — ${documentName()}`;
      win._status.textContent=`${workflow.length} ${t('app.ln9.be9d3bcc65aa')}${win._documentDirty?t('ui.83e8b2389032'):''}${running?t('app.ln6.52001648ab34'):''}`;
      run.disabled=running||!workflow.length;stop.disabled=!running;saveBtn.disabled=running;
      toolbarStatus.textContent=running?t('app.ln2.c713e6a8292f'):win._documentDirty?t('ui.c920e429e2df'):t('ui.b796f2d4ca85');
      count.textContent=`${workflow.length} ${t('app.ln9.be9d3bcc65aa')}`;
      notifyState();
    };
    const rememberRecovery=()=>save(AUTOMATOR_RECOVERY_KEY,{inputType,steps:workflow});
    const setDirty=(dirty=true)=>{
      if(!win)return;
      win._documentDirty=!!dirty;win.classList.toggle('document-dirty',!!dirty);
      rememberRecovery();updateWindowState();
    };
    const controlMarkup=(step,index)=>{
      if(step.id==='open')return `<label class="auto-parameter"><span>${t('app.ln6.7d1b08d2e582')}</span><select class="aqua-select" data-step-value="${index}">
        <option value="finder">Finder</option><option value="safari">Safari</option><option value="mail">Mail</option>
        <option value="preview">${t('app.ln6.07a0aca727e5')}</option><option value="sysprefs">${t('app.ln3.fbaacd1575f8')}</option><option value="ical">iCal</option></select></label>`;
      if(step.id==='wallpaper')return `<label class="auto-parameter"><span>${t('app.ln2.3e3ea5488264')}</span><select class="aqua-select" data-step-value="${index}">
        <option value="aurora">Aurora</option><option value="tiger">Aqua Blue</option><option value="purple">Purple Aurora</option><option value="graphite">Graphite</option></select></label>`;
      if(step.id==='snapshot')return `<div class="auto-no-parameter">${t('app.ln6.8974f5ee2c1e')}</div>`;
      if(step.id==='pause')return `<label class="auto-parameter"><span>${t('app.ln6.070d2c4bab3b')}</span><input class="aqua-input" data-step-value="${index}" type="number" min="1" max="30" value="${esc(step.value)}"><em>${t('app.ln6.954ac56202cb')}</em></label>`;
      const label=step.id==='file'?t('ui.f462d9fd49b2'):t('app.ln.f76d12f856');
      return `<label class="auto-parameter"><span>${label}</span><input class="aqua-input" data-step-value="${index}" value="${esc(step.value)}"></label>`;
    };
    const renderActions=()=>{
      const needle=searchQuery.trim().toLocaleLowerCase();
      const visible=actions.filter(action=>!needle||`${action.name} ${action.cat} ${action.desc}`.toLocaleLowerCase().includes(needle));
      list.innerHTML='';
      let lastCategory='';
      visible.forEach(action=>{
        if(action.cat!==lastCategory){list.appendChild(el('h4','',action.cat));lastCategory=action.cat;}
        const button=el('button','auto-action');
        button.dataset.id=action.id;button.draggable=true;button.setAttribute('role','option');
        button.innerHTML=`<i>＋</i><span><b>${esc(action.name)}</b><small>${esc(action.desc)}</small></span>`;
        list.appendChild(button);
      });
      if(!visible.length)list.appendChild(el('div','auto-library-empty',t('app.ln6.afe4c2644010')));
    };
    const renderFlow=()=>{
      flow.innerHTML='';
      if(!workflow.length){
        const empty=el('div','auto-empty');
        empty.innerHTML=`<i>⇢</i><b>${t('app.ln6.9d7546677dd3')}</b><span>${t('app.ln6.8989edbc89cb')}</span>`;
        flow.appendChild(empty);
      }else workflow.forEach((step,index)=>{
        const action=actions.find(item=>item.id===step.id);
        const article=el('article',index===selectedStep?'selected':'');
        article.dataset.i=index;article.draggable=!running;
        article.innerHTML=`<header><span>${index+1}</span><b>${esc(action?.name||step.id)}</b>
          <div><button data-move="-1" title= t('app.ln.267ec6d1fa') ${index===0||running?'disabled':''}>↑</button>
          <button data-move="1" title= t('app.ln.4b4dd27119') ${index===workflow.length-1||running?'disabled':''}>↓</button>
          <button data-remove title= t('app.ln.a22643e52a') ${running?'disabled':''}>×</button></div></header>
          <p>${esc(action?.desc||'')}</p>${controlMarkup(step,index)}<output class="auto-step-result"></output>`;
        flow.appendChild(article);
        const control=article.querySelector('[data-step-value]');
        if(control){
          control.value=step.value;
          control.addEventListener(control.tagName==='SELECT'?'change':'input',()=>{
            workflow[index].value=control.value;setDirty(true);
          });
        }
      });
      updateWindowState();
    };
    const addAction=(id,index=workflow.length)=>{
      if(running||!actions.some(action=>action.id===id))return;
      const step={id,value:automatorDefaultValue(id)};
      workflow.splice(Math.max(0,Math.min(workflow.length,index)),0,step);
      selectedStep=Math.max(0,Math.min(workflow.length-1,index));setDirty(true);renderFlow();
    };
    const removeStep=(index)=>{
      if(running||index<0||index>=workflow.length)return;
      workflow.splice(index,1);selectedStep=Math.min(index,workflow.length-1);setDirty(true);renderFlow();
    };
    const moveStep=(index,amount)=>{
      const next=index+amount;if(running||next<0||next>=workflow.length)return;
      const [step]=workflow.splice(index,1);workflow.splice(next,0,step);selectedStep=next;setDirty(true);renderFlow();
    };
    const markStep=(index,state,message='')=>{
      const article=flow.querySelector(`article[data-i="${index}"]`);if(!article)return;
      article.classList.remove('running','done','failed');if(state)article.classList.add(state);
      article.querySelector('.auto-step-result').textContent=message;
    };
    const waitCancelable=async(milliseconds,token)=>{
      let remaining=milliseconds;
      while(remaining>0&&running&&token===runToken){
        const slice=Math.min(100,remaining);await new Promise(resolve=>setTimeout(resolve,slice));remaining-=slice;
      }
      return running&&token===runToken;
    };
    const setWallpaper=(choice)=>{
      const choices={
        aurora:{id:'',name:'Aurora',css:'url("assets/aurora.svg")'},
        tiger:{id:'tiger',name:'Aqua Blue',css:'url("assets/tiger.svg")'},
        purple:{id:'purpleaurora',name:'Purple Aurora',css:'radial-gradient(ellipse at 66% 22%,#e89cff 0 4%,transparent 27%),radial-gradient(ellipse at 35% 65%,#387de4,transparent 44%),linear-gradient(135deg,#170d38,#7a218d 48%,#091b4d)'},
        graphite:{id:'graphite',name:'Graphite',css:'radial-gradient(ellipse at 50% 35%,#89939e,#23272d 74%)'},
      };
      const wallpaper=choices[choice]||choices.aurora;
      if(wallpaper.id)document.body.dataset.wallpaper=wallpaper.id;else delete document.body.dataset.wallpaper;
      const desktop=document.querySelector('#desktop');
      if(desktop)desktop.style.background=`${wallpaper.css} center / cover no-repeat`;
      localStorage.setItem('macweb.wallpaper',wallpaper.id);
      localStorage.setItem('macweb.wallpaper.css',wallpaper.css);
      localStorage.setItem('macweb.wallpaper.name',wallpaper.name);
    };
    const runWorkflow=async()=>{
      if(running||!workflow.length)return;
      running=true;const token=++runToken;selectedStep=-1;
      flow.querySelectorAll('article').forEach((article)=>article.classList.remove('running','done','failed'));
      footerText.textContent=t('app.ln6.06634f85667f');updateWindowState();
      let completed=0;
      try{
        for(let index=0;index<workflow.length;index++){
          if(!running||token!==runToken)break;
          const step=workflow[index],action=actions.find(item=>item.id===step.id);
          markStep(index,'running',t('app.ln2.c713e6a8292f'));toolbarStatus.textContent=`${index+1}/${workflow.length} ${action?.name||step.id}`;
          if(step.id==='message')System.alertBox('Automator',step.value||t('ui.4fb853cd6d80'));
          else if(step.id==='file'){
            const raw=(step.value||t('ui.8d46aa72c135')).replace(/[\\/]/g,'-');
            const dot=raw.lastIndexOf('.'),base=dot>0?raw.slice(0,dot):raw,extension=dot>0?raw.slice(dot):'.txt';
            const name=VFS.uniqueName(paths.documents,base||t('ui.49dcd0b30199'),extension);
            VFS.putNode(`${paths.documents}/${name}`,{type:'file',content:t('app.ln6.b0f7ee63fb95'),mime:'text/plain',creator:'automator',generated:true});
          }else if(step.id==='open')System.launch(System.apps[step.value]?step.value:'finder');
          else if(step.id==='wallpaper')setWallpaper(step.value);
          else if(step.id==='snapshot')Leopard.saveSnapshot('ui.0ff5434bb589');
          else if(step.id==='pause'){
            const seconds=Math.max(1,Math.min(30,Number(step.value)||1));
            if(!await waitCancelable(seconds*1000,token))break;
          }
          if(step.id!=='pause'&&!await waitCancelable(260,token))break;
          completed++;markStep(index,'done',t('ui.e3108f65dd4a'));
        }
      }catch(error){
        console.error('Automator workflow failed',error);
        const index=Math.max(0,completed);markStep(index,'failed',`${t('app.ln9.8e3fada9b30a')}${error.message||error}`);
      }
      const stopped=!running||token!==runToken;
      if(token===runToken)running=false;
      footerText.textContent=stopped?`${t('app.ln6.981881ea9c22')}${t('app.ln9.a9544d740cc4')}${completed}/${workflow.length}）。`:`${t('app.ln6.981881ea9c22')}${t('app.ln9.2be3acc7a64f')}${completed} ${t('app.ln9.be9d3bcc65aa')}）。`;
      updateWindowState();
      Leopard.toast('Automator',stopped?t('ui.0f5015e31616'):t('ui.238a44335a9d'));
    };
    const stopWorkflow=()=>{
      if(!running)return;
      running=false;runToken++;flow.querySelectorAll('article.running').forEach(article=>{
        article.classList.remove('running');article.querySelector('.auto-step-result').textContent=t('ui.75dddf524e4c');
      });
      footerText.textContent=t('ui.51ca9f4d40e8');updateWindowState();
    };
    const writeDocument=(path)=>{
      path=VFS.normalize(path);
      const ok=VFS.putNode(path,{type:'file',kind:'workflow',content:serialized(),mime:'application/x-automator-workflow',creator:'automator',generated:true});
      if(!ok){System.alertBox('Automator',t('ui.ccd5f7e542b3'));return false;}
      currentPath=path;lastSaved=serialized();setDirty(false);System.addRecentDocument?.(path,'automator');
      Leopard.toast('Automator', `${t('app.ln9.01924612618f')}${VFS.baseName(path)}`);return true;
    };
    const doSave=(saveAs=false,onSaved)=>{
      if(currentPath&&!saveAs){const ok=writeDocument(currentPath);if(ok)onSaved?.();return ok;}
      const directory=currentPath?VFS.parentOf(currentPath):paths.documents;
      System.savePanel({
        parent:win,title:t('ui.8e68a546ddf4'),startPath:directory,
        name:currentPath?VFS.baseName(currentPath):VFS.uniqueName(directory,t('app.ln2.18f70fe106e0'),'.workflow'),
        extension:'workflow',typeLabel:t('ui.0ff5434bb589'),allowOverwrite:true,
        onSave:(path)=>{const ok=writeDocument(path);if(ok)onSaved?.();return ok;},
      });
      return false;
    };
    const applyDocument=(path)=>{
      const node=VFS.get(path);if(node?.type!=='file')return false;
      try{
        const parsed=JSON.parse(node.content||'');
        workflow=normalizeAutomatorWorkflow(parsed.steps);inputType=['none','files','text'].includes(parsed.inputType)?parsed.inputType:'none';
        currentPath=path;inputSelect.value=inputType;selectedStep=-1;lastSaved=serialized();setDirty(false);renderFlow();
        System.addRecentDocument?.(path,'automator');return true;
      }catch(error){System.alertBox('Automator',t('ui.1420052ad28b'));return false;}
    };
    const openDocument=()=>System.openPanel({
      parent:win,title:t('ui.17111c903b38'),startPath:currentPath?VFS.parentOf(currentPath):paths.documents,
      types:['workflow'],allowUpload:true,onOpen:(path)=>{
        const load=()=>applyDocument(path);
        if(!win._documentDirty)load();
        else System.confirmSheet({parent:win,headline:t('app.ln2.f2f2110a265d'),message:t('ui.ce593f661590'),okLabel:t('app.ln2.17d9fa6447e0'),danger:true,onOK:load});
      },
    });
    const newDocument=()=>{
      const reset=()=>{workflow=[];inputType='none';inputSelect.value='none';currentPath=null;selectedStep=-1;lastSaved=serialized();setDirty(false);renderFlow();};
      if(!win._documentDirty)reset();
      else System.confirmSheet({parent:win,headline:t('app.ln2.f2f2110a265d'),message:t('ui.ce593f661590'),okLabel:t('app.ln2.17d9fa6447e0'),danger:true,onOK:reset});
    };

    win=System.createWindow({
      app:'automator',title:t('ui.a4dc4a7fc9ae'),width:920,height:610,toolbar,content:root,statusbar:'',
      onClose:(window,context)=>{
        stopWorkflow();
        if(context.force||!window._documentDirty)return true;
        if(closePrompt?.shield.isConnected)return false;
        const body=el('div','automator-save-warning');
        body.innerHTML=`<div>${automatorIcon}</div><section><h3>${t('app.ln9.a7922b54fa08')}${esc(documentName())}${t('app.ln9.477baae867c7')}</h3><p>${t('app.ln7.5e14801ecb2c')}</p></section>`;
        const finishClose=()=>setTimeout(()=>{if(window.isConnected)System.closeWindow(window);},170);
        closePrompt=System.showSheet({
          parent:window,content:body,className:'automator-save-warning-sheet',
          buttons:[
            {label:t('ui.4d0b4688c787'),cancel:true},
            {label:t('ui.de1b2ada2597'),danger:true,action:()=>{setDirty(false);finishClose();}},
            {label:t('ui.091ca5213ef3'),default:true,action:()=>setTimeout(()=>doSave(false,finishClose),170)},
          ],
          onClose:()=>{closePrompt=null;},
        });
        return false;
      },
    });
    lastSaved=serialized();win._documentDirty=false;
    renderActions();renderFlow();updateWindowState();
    if(currentPath)System.addRecentDocument?.(currentPath,'automator');

    search.addEventListener('input',()=>{searchQuery=search.value;renderActions();});
    inputSelect.addEventListener('change',()=>{inputType=inputSelect.value;setDirty(true);});
    list.addEventListener('dblclick',event=>{const button=event.target.closest('[data-id]');if(button)addAction(button.dataset.id);});
    list.addEventListener('dragstart',event=>{
      const button=event.target.closest('[data-id]');if(!button)return;
      event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-automator-action',button.dataset.id);
    });
    flow.addEventListener('click',event=>{
      const article=event.target.closest('article[data-i]');if(!article)return;
      const index=Number(article.dataset.i);selectedStep=index;
      const move=event.target.closest('[data-move]'),remove=event.target.closest('[data-remove]');
      if(move)moveStep(index,Number(move.dataset.move));
      else if(remove)removeStep(index);
      else{
        flow.querySelectorAll('article').forEach(candidate=>candidate.classList.toggle('selected',candidate===article));
        updateWindowState();
      }
    });
    flow.addEventListener('dragstart',event=>{
      const article=event.target.closest('article[data-i]');if(!article)return;
      draggedStep=Number(article.dataset.i);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-automator-step',String(draggedStep));
    });
    flow.addEventListener('dragover',event=>{event.preventDefault();flow.classList.add('dragging');});
    flow.addEventListener('dragleave',event=>{if(!flow.contains(event.relatedTarget))flow.classList.remove('dragging');});
    flow.addEventListener('drop',event=>{
      event.preventDefault();flow.classList.remove('dragging');
      const target=event.target.closest('article[data-i]'),index=target?Number(target.dataset.i):workflow.length;
      const actionId=event.dataTransfer.getData('application/x-automator-action');
      if(actionId)addAction(actionId,index);
      else{
        const from=Number(event.dataTransfer.getData('application/x-automator-step'));
        if(Number.isInteger(from)&&from>=0&&from<workflow.length){
          const [step]=workflow.splice(from,1);const adjusted=from<index?index-1:index;
          workflow.splice(Math.max(0,adjusted),0,step);selectedStep=Math.max(0,adjusted);setDirty(true);renderFlow();
        }
      }
      draggedStep=-1;
    });
    run.addEventListener('click',runWorkflow);stop.addEventListener('click',stopWorkflow);saveBtn.addEventListener('click',()=>doSave(false));
    win.addEventListener('leopard-command',event=>{
      const actionsByCommand={
        'new-workflow':newDocument,'open-document':openDocument,'save':()=>doSave(false),'save-as':()=>doSave(true),
        'run-workflow':runWorkflow,'stop-workflow':stopWorkflow,'remove-action':()=>removeStep(selectedStep),
        'focus-search':()=>{search.focus();search.select();},
      };
      const action=actionsByCommand[event.detail?.command];if(action){event.preventDefault();action();}
    });
  }
  System.registerApp({id:'automator',name:'Automator',icon:automatorIcon,open:openAutomator,multiWindow:true,about:t('ui.831ef5f7b3bd'),keywords:t('ui.ca290c5fa736')});
