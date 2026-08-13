// Image Capture — Leopard-era native application (split from leopard-native.js).
import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';
import { html as esc } from '../escape.js';
import { jsonStore, save, formatBytes, icon } from './leopard-native-common.js';

const { el } = System;
  // ---------- Image Capture ----------
  const captureIcon=icon('ic','#b9d1e9','#527da8','<rect x="13" y="14" width="38" height="36" rx="4" fill="#eff7ff" stroke="#315b85" stroke-width="1.5"/><rect x="19" y="9" width="26" height="9" rx="3" fill="#dbe8f4" stroke="#315b85"/><circle cx="32" cy="33" r="11" fill="#477fb1" stroke="#fff" stroke-width="2"/><circle cx="32" cy="33" r="5" fill="#9bddff"/>');
  function openImageCapture(){
    const toolbar=el('div','capture-toolbar');
    const chooseButton=el('button','finder-toolbar-btn',t('app.ln6.1f95f093b73e'));
    chooseButton.dataset.command='choose-files';
    const finderButton=el('button','finder-toolbar-btn',t('ui.65527b960e56'));
    finderButton.dataset.command='add-vfs-images';
    const importButton=el('button','finder-toolbar-btn',t('app.ln6.e91d1b0ba027'));
    importButton.dataset.command='import-selection';
    const importAllButton=el('button','finder-toolbar-btn',t('ui.d5e350e5145b'));
    importAllButton.dataset.command='import-all';
    const removeButton=el('button','finder-toolbar-btn',t('ui.2f752c005ec5'));
    removeButton.dataset.command='delete';
    const rotateLeft=el('button','finder-toolbar-btn','↺');
    rotateLeft.title = t('app.ln6.41b23d1632d5');rotateLeft.dataset.command='rotate-left';
    const rotateRight=el('button','finder-toolbar-btn','↻');
    rotateRight.title = t('app.ln6.6fe271ca4c89');rotateRight.dataset.command='rotate-right';
    const toolbarSpacer=el('i');
    const revealButton=el('button','finder-toolbar-btn',t('ui.6df2aa0a1ceb'));
    revealButton.dataset.command='reveal-imports';
    toolbar.append(chooseButton,finderButton,importButton,importAllButton,removeButton,rotateLeft,rotateRight,toolbarSpacer,revealButton);

    const root=el('div','imagecapture-app');
    root.innerHTML=`<aside><h4>${t('app.ln7.2600dec90202')}</h4>
      <button data-device="browser"><span>📷</span><b>${t('app.ln7.5405f07addce')}</b><small>${t('app.ln7.8cc877cffae1')}</small></button>
      <button data-device="isight"><span>◉</span><b>${t('app.ln7.87bfc193c0de')}</b><small>${t('app.ln7.46f73a798197')}</small></button>
      <button data-device="iphone" class="disconnected"><span>📱</span><b>iPhone</b><small>${t('app.ln.6ea4b89984')}</small></button>
    </aside><main>
      <div class="capture-drop" tabindex="0"><b>${t('app.ln6.9b5d2466003c')}</b><span>${t('app.ln6.7895b3f8d4e8')}</span><input type="file" accept="image/*" multiple aria-label="${t('app.ln6.77dd4bc22b14')}"></div>
      <div class="capture-grid" role="listbox" aria-label="${t('app.ln6.5da3f07572ac')}" aria-multiselectable="true"></div>
      <footer><label>${t('app.ln7.d54f7e061f73')}<select class="aqua-select capture-destination"><option value="${paths.pictures}">${t('app.ln7.0c7e2869dc88')}</option><option value="${paths.desktop}">${t('app.ln6.22048855f9be')}</option><option value="${paths.downloads}">${t('app.ln6.93e3c156ebce')}</option></select></label>
      <label class="spp-check"><input type="checkbox" class="capture-remove-after"> ${t('app.ln7.80ad96ff0427')}</label></footer>
    </main>`;
    const input=root.querySelector('input[type="file"]'),drop=root.querySelector('.capture-drop');
    const grid=root.querySelector('.capture-grid'),destination=root.querySelector('.capture-destination');
    const removeAfter=root.querySelector('.capture-remove-after');
    let files=[],selected=new Set(),selectionAnchor=null,currentDevice='browser',importing=false,lastImportDirectory='';
    let win=null;
    const notifyState=()=>document.dispatchEvent(new CustomEvent('document-state-changed',{detail:{appId:'imagecapture'}}));
    const release=(entry)=>{if(entry?.file&&entry.url?.startsWith('blob:'))URL.revokeObjectURL(entry.url);};
    const selectedEntries=()=>files.filter(entry=>selected.has(entry.id));
    const addFiles=(fileList)=>{
      const accepted=[...fileList].filter(file=>file.type.startsWith('image/')||/\.(jpe?g|png|gif|webp|svg)$/i.test(file.name));
      accepted.forEach(file=>{
        files.push({
          id:`capture-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
          name:file.name||t('ui.ba36cbd089ed'),file,url:URL.createObjectURL(file),size:file.size,mime:file.type,
          vfsPath:'',rotation:0,importedPath:'',
        });
      });
      selected=new Set(accepted.length?files.slice(-accepted.length).map(entry=>entry.id):[]);
      selectionAnchor=files.length-1;
      currentDevice='browser';
      render();
      if(fileList.length&&!accepted.length)System.alertBox(t('ui.283462c3dde5'),t('ui.0cea9ee0cbbf'));
    };
    const addVfsPaths=(paths)=>{
      const requested=Array.isArray(paths)?paths:[paths];
      const accepted=requested.map(path=>VFS.normalize(path)).filter(path=>{
        const node=VFS.get(path);
        return node?.type==='file'&&node.src&&(node.kind==='image'||/\.(jpe?g|png|gif|webp|svg)$/i.test(path));
      });
      accepted.forEach(path=>{
        const node=VFS.get(path);
        files.push({
          id:`capture-vfs-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
          name:VFS.baseName(path),file:null,url:node.src,size:VFS.sizeOf(path),mime:node.mime||'image/*',
          vfsPath:path,rotation:0,importedPath:'',
        });
      });
      selected=new Set(accepted.length?files.slice(-accepted.length).map(entry=>entry.id):[]);
      selectionAnchor=files.length-1;currentDevice='browser';render();
      if(requested.length&&!accepted.length)System.alertBox(t('ui.283462c3dde5'),t('ui.c34126291632'));
    };
    const chooseFromFinder=()=>System.openPanel({
      parent:win,title:t('ui.d72bb6ab6468'),startPath:paths.pictures,
      types:['jpg','jpeg','png','gif','webp','svg'],allowMultiple:true,allowUpload:false,
      onOpen:(paths)=>addVfsPaths(paths),
    });
    const render=()=>{
      root.querySelectorAll('[data-device]').forEach(button=>button.classList.toggle('sel',button.dataset.device===currentDevice));
      grid.innerHTML='';
      if(!files.length){
        const empty=el('div','capture-empty');
        empty.innerHTML=`<i>▧</i><b>${t('app.ln6.c6de90916e8d')}</b><span>${t('app.ln6.0ce944c09577')}</span>`;
        grid.appendChild(empty);
      }else files.forEach((entry,index)=>{
        const item=el('button','capture-item'+(selected.has(entry.id)?' sel':'')+(entry.importedPath?' imported':''));
        item.dataset.id=entry.id;item.dataset.index=index;item.setAttribute('role','option');
        item.setAttribute('aria-selected',String(selected.has(entry.id)));
        const thumb=el('span','capture-thumb');
        const image=new Image();image.alt='';image.src=entry.url;image.style.transform=`rotate(${entry.rotation}deg)`;
        thumb.appendChild(image);
        if(entry.importedPath)thumb.appendChild(el('i','capture-imported-badge','✓'));
        const name=el('b','',entry.name);
        const metaParts=[];
        if(entry.size)metaParts.push(formatBytes(entry.size));
        if(entry.vfsPath)metaParts.push('Finder');
        if(entry.rotation)metaParts.push(`${entry.rotation}°`);
        const meta=el('small','',metaParts.join(' · ')||t('ui.90beff858d5c'));
        item.append(thumb,name,meta);grid.appendChild(item);
      });
      const count=selected.size;
      importButton.disabled=importing||!count;
      importAllButton.disabled=importing||!files.length;
      removeButton.disabled=importing||!count;
      rotateLeft.disabled=importing||!count;rotateRight.disabled=importing||!count;
      chooseButton.disabled=importing;finderButton.disabled=importing;revealButton.disabled=!lastImportDirectory;
      win.dataset.captureSelection=String(count);
      win.dataset.captureFiles=String(files.length);
      win.dataset.captureLastImport=String(!!lastImportDirectory);
      win._status.textContent=importing?t('ui.cfbfadc28dba'):`${t('app.ln7.5405f07addce')} · ${files.length} ${t('app.ln9.0b7256c3c2cd')}${count?` · ${t('app.ln8.fc958ab9bfca')} ${count} ${t('common.sheets')}`:''}`;
      notifyState();
    };
    const selectIndex=(index,event)=>{
      const entry=files[index];if(!entry)return;
      if(event?.shiftKey&&selectionAnchor!=null){
        selected=new Set();
        const start=Math.min(selectionAnchor,index),end=Math.max(selectionAnchor,index);
        for(let i=start;i<=end;i++)selected.add(files[i].id);
      }else if(event?.metaKey||event?.ctrlKey){
        if(selected.has(entry.id))selected.delete(entry.id);else selected.add(entry.id);
        selectionAnchor=index;
      }else{
        selected=new Set([entry.id]);selectionAnchor=index;
      }
      render();
    };
    const fileData=(entry)=>{
      if(!entry.file)return Promise.resolve(entry.url);
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(entry.file);
      });
    };
    const transformedData=async(entry)=>{
      const rotation=((entry.rotation%360)+360)%360;
      if(!rotation)return fileData(entry);
      const image=new Image();image.src=entry.url;
      if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
      const swap=rotation===90||rotation===270;
      const canvas=document.createElement('canvas');
      canvas.width=swap?image.naturalHeight:image.naturalWidth;
      canvas.height=swap?image.naturalWidth:image.naturalHeight;
      const context=canvas.getContext('2d');
      context.translate(canvas.width/2,canvas.height/2);
      context.rotate(rotation*Math.PI/180);
      context.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);
      return canvas.toDataURL('image/png');
    };
    const importEntries=async(items)=>{
      if(importing||!items.length)return;
      importing=true;render();
      const dir=destination.value;
      let imported=0,failed=0;
      for(let index=0;index<items.length;index++){
        const entry=items[index];
        win._status.textContent=`${t('app.ln9.66a8e9d1356e')}${index+1}/${items.length}：${entry.name}`;
        try{
          const rotated=!!(((entry.rotation%360)+360)%360);
          const data=await transformedData(entry);
          const originalExt=entry.name.match(/\.[^.]+$/)?.[0]||'.jpg';
          const extension=rotated?'.png':originalExt;
          const base=entry.name.replace(/\.[^.]+$/,'')||t('ui.7c3c705c51ca');
          const name=VFS.uniqueName(dir,base,extension);
          const path=`${dir}/${name}`;
          VFS.putNode(path,{type:'file',kind:'image',src:data,mime:rotated?'image/png':entry.mime,
            creator:'imagecapture',generated:true,createdAt:Date.now()});
          entry.importedPath=path;imported++;lastImportDirectory=dir;
        }catch(error){console.error('Image Capture import failed',error);failed++;}
      }
      if(removeAfter.checked){
        const importedIds=new Set(items.filter(entry=>entry.importedPath).map(entry=>entry.id));
        files.forEach(entry=>{if(importedIds.has(entry.id))release(entry);});
        files=files.filter(entry=>!importedIds.has(entry.id));
        selected=new Set();selectionAnchor=null;
      }
      importing=false;render();
      Leopard.toast(t('ui.283462c3dde5'),failed?`${t('app.ln9.122bde04cef1')}${imported}${t('app.ln9.7628cf0f068b')}${failed}${t('app.ln9.2a3c12ffc918')}`:`${t('app.ln9.122bde04cef1')}${imported}${t('app.ln9.bfa165b6077e')}${VFS.baseName(dir)}”。`);
    };
    const removeSelected=()=>{
      if(!selected.size)return;
      files.forEach(entry=>{if(selected.has(entry.id))release(entry);});
      files=files.filter(entry=>!selected.has(entry.id));selected=new Set();selectionAnchor=null;render();
    };
    const rotateSelected=(amount)=>{
      if(!selected.size)return;
      files.forEach(entry=>{if(selected.has(entry.id))entry.rotation=(entry.rotation+amount+360)%360;});
      render();
    };
    const previewSelected=async()=>{
      const entry=selectedEntries()[0];if(!entry)return;
      try{
        const data=await transformedData(entry);
        System.launch('preview',{src:data,name:entry.name,mime:entry.rotation?'image/png':entry.mime,size:entry.size});
      }catch(error){System.alertBox(t('ui.283462c3dde5'),t('ui.35ce30bcf3ea'));}
    };
    const revealImports=()=>{
      if(lastImportDirectory)System.launch('finder',{path:lastImportDirectory,forceNew:true});
    };

    win=System.createWindow({
      app:'imagecapture',title:t('ui.283462c3dde5'),width:820,height:560,toolbar,content:root,statusbar:t('ui.dd7a28c6e58d'),
      onClose:()=>{files.forEach(release);return true;},
    });
    chooseButton.addEventListener('click',()=>input.click());
    finderButton.addEventListener('click',chooseFromFinder);
    input.addEventListener('change',()=>{addFiles(input.files);input.value='';});
    ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging');}));
    ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{
      event.preventDefault();drop.classList.remove('dragging');if(type==='drop'&&event.dataTransfer?.files)addFiles(event.dataTransfer.files);
    }));
    drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click();}});
    root.querySelector('aside').addEventListener('click',event=>{
      const button=event.target.closest('[data-device]');if(!button)return;
      currentDevice=button.dataset.device;render();
      if(currentDevice==='browser')input.click();
      else if(currentDevice==='isight')System.launch('photobooth');
      else System.alertBox(t('ui.283462c3dde5'),t('ui.ebd24aa9e858'));
    });
    grid.addEventListener('click',event=>{const item=event.target.closest('[data-index]');if(item)selectIndex(Number(item.dataset.index),event);});
    grid.addEventListener('dblclick',event=>{if(event.target.closest('[data-index]'))previewSelected();});
    importButton.addEventListener('click',()=>importEntries(selectedEntries()));
    importAllButton.addEventListener('click',()=>importEntries(files.slice()));
    removeButton.addEventListener('click',removeSelected);
    rotateLeft.addEventListener('click',()=>rotateSelected(-90));rotateRight.addEventListener('click',()=>rotateSelected(90));
    revealButton.addEventListener('click',revealImports);
    win.addEventListener('leopard-command',event=>{
      const actions={
        'choose-files':()=>input.click(),'add-vfs-images':chooseFromFinder,'import-selection':()=>importEntries(selectedEntries()),
        'import-all':()=>importEntries(files.slice()),'delete':removeSelected,
        'selectAll':()=>{selected=new Set(files.map(entry=>entry.id));render();},
        'rotate-left':()=>rotateSelected(-90),'rotate-right':()=>rotateSelected(90),
        'preview-selection':previewSelected,'reveal-imports':revealImports,
      };
      const action=actions[event.detail?.command];if(action){event.preventDefault();action();}
    });
    render();
  }
  System.registerApp({id:'imagecapture',name:t('ui.283462c3dde5'),icon:captureIcon,open:openImageCapture,about:t('ui.a12529cd7591'),keywords:t('ui.f3db36b6d6f8')});
