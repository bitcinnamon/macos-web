import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';
import { html as escapeHtml } from '../escape.js';

// 磁盘工具 (Disk Utility) — real storage quota, verify & erase
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><radialGradient id="dug" cx=".4" cy=".35"><stop offset="0" stop-color="#f0f2f6"/><stop offset="1" stop-color="#9aa5b5"/></radialGradient></defs><circle cx="32" cy="32" r="25" fill="url(#dug)" stroke="#5a6270" stroke-width="1.5"/><circle cx="32" cy="32" r="15" fill="#c8ccd4" stroke="#7a8090"/><circle cx="32" cy="32" r="5" fill="#5a6270"/><path d="M50 46 l8 8" stroke="#c06030" stroke-width="5" stroke-linecap="round"/><rect x="42" y="36" width="12" height="12" rx="2" fill="#e8b048" stroke="#9a7020" stroke-width="1.5" transform="rotate(45 48 42)"/></svg>`;

  function open() {
    const humanBytes = (value) => {
      const bytes = Math.max(0, Number(value) || 0);
      if (bytes < 1024) return `${bytes.toFixed(0)} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
      return `${(bytes / 1073741824).toFixed(2)} GB`;
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const devices = [
      { id:'disk0', role:'device', name:'74.5 GB APPLE HDD', detail:'HTS541680J9SA00 · SATA', mounted:true, capacity:'74.5 GB' },
      { id:'macintosh', role:'volume', name:'Macintosh HD', detail:t('ui.37c6d2b3d9e4'), parent:'disk0', mounted:true, capacity:'74.5 GB' },
      { id:'scratch', role:'image', name:'Leopard Scratch.dmg', detail:t('app.du2.57a9570b15f5'), mounted:false, capacity:'2.0 GB' },
    ];
    const tabs = [
      ['firstaid',t('ui.25d5f9812064')],['erase',t('ui.d163c9135794')],['partition',t('app.du2.f1640bde967f')],['raid','RAID'],['restore',t('app.du2.590f20a76993')],
    ];
    const toolbar = el('div', 'diskutil-toolbar');
    const infoButton = el('button', 'finder-toolbar-btn', `ⓘ ${t('app.du2.11a132c3c6a4')}`);
    const mountButton = el('button', 'finder-toolbar-btn', t('ui.b9a13be2f987'));
    const imageButton = el('button', 'finder-toolbar-btn', t('ui.75de151bf264'));
    const refreshButton = el('button', 'finder-toolbar-btn', t('ui.38108eaa1d32'));
    toolbar.append(infoButton, mountButton, imageButton, el('i'), refreshButton);
    const root = el('div', 'diskutil-app');
    root.innerHTML = `<aside><header>${t('app.du2.ffcf66ce7499')}</header><div class="diskutil-devices"></div><footer><span>${t('app.du2.478a02846719')}</span></footer></aside>
      <main><header class="diskutil-summary"></header><nav class="diskutil-tabs">${tabs.map(([id,label])=>`<button data-tab="${id}">${label}</button>`).join('')}</nav><section class="diskutil-panel"></section></main>`;
    const deviceList = root.querySelector('.diskutil-devices');
    const summary = root.querySelector('.diskutil-summary');
    const panel = root.querySelector('.diskutil-panel');
    let win = null;
    let selectedId = 'macintosh';
    let tab = 'firstaid';
    let busy = false;
    let operationToken = 0;
    let partitionSize = 60;
    let raidCreated = false;
    const initialStorageState = VFS.storageStatus?.() || {};
    let storage = { quota:5 * 1048576, usage:initialStorageState.estimatedBytes || 0, files:0, folders:0, bytes:0 };
    const logs = {
      firstaid: t('app.diskutil.logStart'),
      restore: t('app.diskutil.restoreLog'),
    };
    const selectedDevice = () => devices.find((device) => device.id === selectedId) || devices[1];
    const auditVfs = () => {
      const paths = VFS.walk('/');
      let files = 0, folders = 0, bytes = 0, missingParents = 0;
      paths.forEach((path) => {
        const node = VFS.get(path);
        if (!node) return;
        if (path !== '/' && !VFS.get(VFS.parentOf(path))) missingParents++;
        if (node.type === 'dir') folders++;
        else { files++; bytes += VFS.sizeOf(path); }
      });
      return { files, folders, bytes, missingParents };
    };
    const refreshStorage = async () => {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) storage.quota = estimate.quota;
        if (estimate.usage != null) storage.usage = estimate.usage;
      } catch (error) {}
      Object.assign(storage, auditVfs());
      render();
    };
    const updateWindowState = () => {
      if (!win) return;
      const device = selectedDevice();
      win.dataset.diskutilSelection = device.id;
      win.dataset.diskutilRole = device.role;
      win.dataset.diskutilTab = tab;
      win.dataset.diskutilBusy = String(busy);
      win.dataset.diskutilMounted = String(device.mounted);
      win.dataset.diskutilCanErase = String(device.id === 'scratch');
      root.dispatchEvent(new CustomEvent('app-command-state-changed', { bubbles:true }));
    };
    const deviceGlyph = (device) => {
      if (device.role === 'device') return '<span class="diskutil-device-glyph">▰</span>';
      if (device.role === 'image') return '<span class="diskutil-device-glyph image">◉</span>';
      return `<span class="diskutil-device-glyph volume">${ICONS.hd}</span>`;
    };
    const renderDevices = () => {
      deviceList.innerHTML = '';
      devices.forEach((device) => {
        const button = el('button', `${device.id === selectedId ? 'sel ' : ''}${device.parent ? 'child ' : ''}${device.mounted ? '' : 'unmounted'}`);
        button.dataset.device = device.id;
        button.innerHTML = `${deviceGlyph(device)}<span><b>${escapeHtml(device.name)}</b><small>${escapeHtml(device.detail)}${device.mounted ? '' : t('ui.af38230eb0a6')}</small></span>`;
        deviceList.appendChild(button);
      });
    };
    const renderSummary = () => {
      const device = selectedDevice();
      const pct = Math.max(.4, Math.min(100, storage.usage / Math.max(1, storage.quota) * 100));
      summary.innerHTML = `<div class="diskutil-summary-icon">${deviceGlyph(device)}</div><section><h2>${escapeHtml(device.name)}</h2><p>${escapeHtml(device.detail)} · ${escapeHtml(device.capacity)}</p>
        <div class="diskutil-usage"><i style="width:${pct.toFixed(2)}%"></i></div>
        <small>${t('app.diskutil.browserStorage', { used: humanBytes(storage.usage), quota: humanBytes(storage.quota), files: storage.files, folders: storage.folders })}</small></section>`;
      mountButton.textContent = device.mounted ? t('ui.4cc322c8d0b2') : t('ui.b9a13be2f987');
      mountButton.disabled = busy || device.id === 'macintosh' || device.role === 'device';
    };
    const panelMarkup = () => {
      const device = selectedDevice();
      if (tab === 'firstaid') return `<div class="diskutil-pane firstaid"><header><h3>${t('app.diskutil.firstAid')}</h3><p>${t('app.diskutil.firstAidDesc')}</p></header>
        <div class="diskutil-action-grid"><section><b>${t('app.du2.924b360c1ed3')}</b><p>${t('app.diskutil.permDesc')}</p><footer><button class="aqua-btn" data-action="verify-permissions" ${busy?'disabled':''}>${t('app.du2.d775f73b1e61')}</button><button class="aqua-btn" data-action="repair-permissions" ${busy?'disabled':''}>${t('app.du2.2bcb00fb634f')}</button></footer></section>
        <section><b>${t('app.du2.88f907dfb2eb')}</b><p>${t('app.diskutil.diskDesc')}</p><footer><button class="aqua-btn" data-action="verify-disk" ${busy?'disabled':''}>${t('app.du2.d7ba90580675')}</button><button class="aqua-btn" data-action="repair-disk" ${busy?'disabled':''}>${t('app.du2.4d9d30b4b58f')}</button></footer></section></div>
        <pre class="diskutil-log">${escapeHtml(logs.firstaid)}</pre></div>`;
      if (tab === 'erase') return `<div class="diskutil-pane erase"><header><h3>${t('app.du2.392945e9dd55')}“${escapeHtml(device.name)}”</h3><p>${device.id === 'scratch' ? t('ui.f8d9223693b2') : t('ui.d45bdb16892b')}</p></header>
        <div class="diskutil-form"><label><span>${t('app.diskutil.volFormat')}</span><select class="erase-format"><option>${t('app.diskutil.journaledFmt')}</option><option>${t('app.diskutil.caseJournaled')}</option><option>${t('app.diskutil.msdos')}</option></select></label>
        <label><span>${t('app.diskutil.name')}</span><input class="aqua-input erase-name" value="${escapeHtml(device.id === 'scratch' ? 'Leopard Scratch' : device.name)}" ${device.id === 'scratch'?'':'disabled'}></label></div>
        <div class="diskutil-warning">${device.id === 'scratch' ? t('ui.c027bfc3b0a2') : t('ui.04c83424afbb')}</div>
        <footer><button class="aqua-btn" data-action="security-options" ${device.id === 'scratch'?'':'disabled'}>${t('app.du2.8de7a989ccea')}…</button><button class="aqua-btn default" data-action="erase-image" ${device.id === 'scratch'&&!busy?'':'disabled'}>${t('app.du2.392945e9dd55')}…</button></footer></div>`;
      if (tab === 'partition') return `<div class="diskutil-pane partition"><header><h3>${t('app.diskutil.volScheme')}</h3><p>${t('app.diskutil.partitionHint')}</p></header>
        <div class="partition-layout"><div class="partition-map"><div style="height:${partitionSize}%"><b>Macintosh HD</b><span>${partitionSize.toFixed(0)}%</span></div><div><b>${t('app.du2.859ef6f98aea')}</b><span>${(100-partitionSize).toFixed(0)}%</span></div></div>
        <section><label>${t('app.diskutil.schemeLabel')}<select><option>${t('app.diskutil.onePart')}</option><option>${t('app.diskutil.twoPart')}</option><option>${t('app.du.4cf1cbd846')}</option></select></label><label>${t('app.diskutil.macSize')}<input class="partition-range" type="range" min="35" max="90" value="${partitionSize}"><output>${partitionSize}%</output></label><p>${t('app.diskutil.partModel')}</p></section></div>
        <footer><button class="aqua-btn" data-action="partition-options">${t('app.diskutil.options')}</button><button class="aqua-btn default" data-action="apply-partition" ${busy?'disabled':''}>${t('app.du2.9c84d98be5c8')}</button></footer></div>`;
      if (tab === 'raid') return `<div class="diskutil-pane raid"><header><h3>RAID</h3><p>${t('app.diskutil.raidDesc')}</p></header>
        <div class="raid-table"><header><span>${t('app.diskutil.raidName')}</span><span>${t('app.diskutil.type')}</span><span>${t('app.du2.180eb81c4faa')}</span></header>${raidCreated?`<div><span>Leopard RAID Set</span><span>${t('app.du2.b5a50987ad29')}</span><span class="ok">${t('app.diskutil.online')}</span></div>`:`<p>${t('app.diskutil.noRaid')}</p>`}</div>
        <section><label>${t('app.diskutil.raidType')}<select><option>${t('app.du2.b5a50987ad29')}</option><option>${t('app.diskutil.striped')}</option><option>${t('app.diskutil.concat')}</option></select></label><p>${t('app.diskutil.members')}</p></section>
        <footer><button class="aqua-btn" data-action="delete-raid" ${raidCreated?'':'disabled'}>${t('app.du.474a507061')}</button><button class="aqua-btn default" data-action="create-raid" ${raidCreated||busy?'disabled':''}>${t('app.du2.9658597ef44c')}</button></footer></div>`;
      return `<div class="diskutil-pane restore"><header><h3>${t('app.du2.590f20a76993')}</h3><p>${t('app.diskutil.restoreDesc')}</p></header>
        <div class="restore-flow"><label><span>${t('app.diskutil.source')}</span><select><option>Macintosh HD</option></select></label><b>⇣</b><label><span>${t('app.diskutil.destDisk')}</span><select><option>${t('app.diskutil.newImage')}</option></select></label></div>
        <pre class="diskutil-log">${escapeHtml(logs.restore)}</pre>
        <footer><button class="aqua-btn default" data-action="restore-image" ${busy?'disabled':''}>${t('app.du2.590f20a76993')}…</button></footer></div>`;
    };
    const render = () => {
      renderDevices();
      renderSummary();
      root.querySelectorAll('.diskutil-tabs button').forEach((button) => button.classList.toggle('sel', button.dataset.tab === tab));
      panel.innerHTML = panelMarkup();
      updateWindowState();
    };
    const appendLog = (name, line) => {
      logs[name] += `${line}\n`;
      const log = panel.querySelector('.diskutil-log');
      if (log) { log.textContent = logs[name]; log.scrollTop = log.scrollHeight; }
    };
    const runFirstAid = async (kind) => {
      if (busy) return;
      busy = true;
      const token = ++operationToken;
      logs.firstaid = '';
      render();
      const device = selectedDevice();
      const permissions = kind.includes('permissions');
      const repair = kind.startsWith('repair');
      const heading = permissions ? t('app.du2.924b360c1ed3') : t('app.du2.88f907dfb2eb');
      appendLog('firstaid', t('app.diskutil.running', { action: repair?t('ui.590253af48cc'):t('ui.80144e2e73b1'), name: device.name, heading }));
      const audit = auditVfs();
      const steps = permissions
        ? [t('ui.83c31e2eba28'),t('ui.a7d38cb497aa'),t('ui.4b2eb7c3128b'),repair?t('ui.21dd19cd45bc'):t('ui.38906dbc5b4e')]
        : [t('ui.4c9ff9549264'),t('ui.a2495262c890'),t('ui.eaf014cc23fc'),t('app.diskutil.checked',{files:audit.files,folders:audit.folders}),t('app.diskutil.checkBitmap'),t('app.diskutil.checkInfo')];
      for (const line of steps) {
        if (token !== operationToken) return;
        await wait(180);
        appendLog('firstaid', line);
      }
      appendLog('firstaid', audit.missingParents ? t('app.diskutil.badParents', { n: audit.missingParents }) : t('app.diskutil.noProblems', { name: device.name }));
      appendLog('firstaid', t('app.diskutil.fileData', { bytes: humanBytes(audit.bytes) }));
      System.syslog(`${t('app.du2.26d3ce53d949')}: ${repair?t('ui.590253af48cc'):t('ui.80144e2e73b1')} ${device.name} ${audit.missingParents?t('app.du2.463598e8dbbb'):t('ui.dcc4233255ab')}`, 'diskutil');
      busy = false;
      render();
    };
    const imageManifest = (kind) => JSON.stringify({
      kind, createdAt:new Date().toISOString(), source:selectedDevice().name,
      format:'UDRW', fileCount:storage.files, folderCount:storage.folders, bytes:storage.bytes,
      paths:VFS.walk(paths.home).slice(0,500).map((path) => ({ path, type:VFS.get(path)?.type, size:VFS.sizeOf(path) })),
    }, null, 2);
    const saveImage = (kind = 'blank') => {
      const directory = paths.downloads;
      const suggested = kind === 'restore' ? t('ui.f9c7dbe997f3') : t('ui.5a277c4846ee');
      System.savePanel({
        parent:win, title:kind === 'restore' ? t('ui.befab6ae8b92') : t('ui.81180577e4aa'),
        startPath:directory, name:VFS.uniqueName(directory, suggested.replace(/\.dmg$/,''), '.dmg'),
        extension:'dmg', typeLabel:t('ui.177c0ba502e8'), allowOverwrite:true,
        onSave:(path) => {
          const ok = VFS.putNode(path, { type:'file', kind:'disk-image', mime:'application/x-apple-diskimage', content:imageManifest(kind), creator:'diskutil', generated:true });
          if (ok) {
            appendLog('restore', t('app.diskutil.created', { name: VFS.baseName(path) }));
            System.addRecentDocument?.(path, 'diskutil');
            Leopard.toast(t('ui.2c7b32bc8d20'), t('app.diskutil.created', { name: VFS.baseName(path) }));
          }
          return ok;
        },
      });
    };
    const showInfo = () => {
      const device = selectedDevice();
      const content = el('div', 'diskutil-info-sheet');
      content.innerHTML = `<header>${deviceGlyph(device)}<span><b>${escapeHtml(device.name)}</b><small>${escapeHtml(device.detail)}</small></span></header><dl>
        <dt>${t('app.diskutil.bus')}</dt><dd>${device.role === 'image' ? t('app.du2.2a763060e16e') : 'Serial ATA'}</dd>
        <dt>${t('app.diskutil.capacity')}</dt><dd>${escapeHtml(device.capacity)}</dd><dt>${t('app.diskutil.writable')}</dt><dd>${device.id === 'macintosh' || device.id === 'scratch' ? t('app.du2.a24128ace01c') : t('app.du2.4630431ac1d1')}</dd>
        <dt>${t('app.diskutil.mountPoint')}</dt><dd>${escapeHtml(device.mounted ? (device.id === 'macintosh' ? '/' : '/Volumes/' + device.name.replace(/\.dmg$/,'')) : t('ui.520433b873c5'))}</dd>
        <dt>S.M.A.R.T. ${t('app.du2.4ab5d017432c')}</dt><dd class="ok">${device.role === 'image' ? t('ui.ef8274b96890') : t('ui.b2a8bb0e10d2')}</dd>
        <dt>${t('app.diskutil.partMap')}</dt><dd>${t('app.diskutil.guidTable')}</dd><dt>${t('app.diskutil.browserQuota')}</dt><dd>${humanBytes(storage.quota)}</dd>
      </dl>`;
      System.showSheet({ parent:win, content, buttons:[{label:t('ui.27e4fe4c3fe2'),default:true}] });
    };
    const toggleMount = () => {
      const device = selectedDevice();
      if (device.id === 'macintosh') return System.alertBox(t('ui.2c7b32bc8d20'),t('ui.c77de18395ec'));
      if (device.role === 'device') return;
      device.mounted = !device.mounted;
      render();
      Leopard.toast(t('ui.2c7b32bc8d20'), t('app.diskutil.mountedToast', { name: device.name, state: device.mounted?t('ui.b9a13be2f987'):t('ui.4cc322c8d0b2') }));
    };
    const eraseImage = () => {
      const device = selectedDevice();
      if (device.id !== 'scratch') return System.alertBox(t('ui.2c7b32bc8d20'),t('ui.3ce40d96b568'));
      const requestedName = panel.querySelector('.erase-name')?.value.trim() || 'Leopard Scratch';
      const name = requestedName.replace(/[\u0000-\u001f\\/:]/g, '-').slice(0, 63).trim() || 'Leopard Scratch';
      const format = panel.querySelector('.erase-format')?.value || t('ui.37c6d2b3d9e4');
      System.confirmSheet({
        parent:win, headline:`${t('app.du2.392945e9dd55')}“${device.name}”？`, message:t('ui.899040b327cf'),
        okLabel:t('ui.d163c9135794'), danger:true, onOK:()=>{
          device.name = `${name}.dmg`;device.detail = format;device.mounted = true;
          render();Leopard.toast(t('ui.2c7b32bc8d20'),t('ui.a8d26c2f598d'));
        },
      });
    };
    const applyPartition = () => System.confirmSheet({
      parent:win, headline:t('ui.3c24bd9655fc'), message: t('app.diskutil.partMsg', { pct: partitionSize }),
      okLabel:t('app.du2.f1640bde967f'), onOK:()=>Leopard.toast(t('ui.2c7b32bc8d20'), t('app.diskutil.partUpdated')),
    });
    const createRaid = () => { raidCreated = true; render(); Leopard.toast(t('ui.2c7b32bc8d20'),t('ui.9df6e7ec9916')); };
    const deleteRaid = () => System.confirmSheet({ parent:win, headline:t('ui.9d0bb9306cfb'), message:t('ui.10db5d9239dd'), okLabel:t('ui.3755f56f2f83'), danger:true, onOK:()=>{raidCreated=false;render();} });
    const showSecurity = () => {
      const content = el('div', 'diskutil-security-sheet');
      content.innerHTML = `<h3>${t('app.du2.8de7a989ccea')}</h3><label><input type="radio" name="disk-security" checked> ${t('app.du2.0ad74def9073')}</label><label><input type="radio" name="disk-security"> ${t('app.du2.2cceba953dc2')}</label><label><input type="radio" name="disk-security"> ${t('app.diskutil.secPasses')}</label><p>${t('app.diskutil.secNote')}</p>`;
      System.showSheet({parent:win,content,buttons:[{label:t('ui.4d0b4688c787'),cancel:true},{label:t('ui.27e4fe4c3fe2'),default:true}]});
    };
    const showTab = (nextTab) => {
      if (busy || !tabs.some(([id]) => id === nextTab)) return;
      tab = nextTab;
      render();
    };
    const actions = {
      'verify-disk':()=>runFirstAid('verify-disk'),'repair-disk':()=>runFirstAid('repair-disk'),
      'verify-permissions':()=>runFirstAid('verify-permissions'),'repair-permissions':()=>runFirstAid('repair-permissions'),
      'erase-image':eraseImage,'security-options':showSecurity,
      'partition-options':()=>System.alertBox(t('ui.c23a6040190a'),t('ui.941a90bd019b')),
      'apply-partition':applyPartition,'create-raid':createRaid,'delete-raid':deleteRaid,
      'restore-image':()=>saveImage('restore'),'new-disk-image':()=>saveImage('blank'),
      'show-disk-info':showInfo,'toggle-mount':toggleMount,'refresh-storage':refreshStorage,
      'show-firstaid':()=>showTab('firstaid'),'show-erase':()=>showTab('erase'),
      'show-partition':()=>showTab('partition'),'show-raid':()=>showTab('raid'),
      'show-restore':()=>showTab('restore'),
    };

    win = System.createWindow({ app:'diskutil', title:t('ui.2c7b32bc8d20'), width:850, height:590, toolbar, content:root, statusbar:t('ui.61ab637f3353'), onClose:()=>{
      operationToken++;
      return true;
    }});
    render();
    refreshStorage();
    root.addEventListener('click', (event) => {
      const deviceButton = event.target.closest('[data-device]');
      const tabButton = event.target.closest('[data-tab]');
      const actionButton = event.target.closest('[data-action]');
      if (deviceButton && !busy) { selectedId = deviceButton.dataset.device; render(); }
      else if (tabButton && !busy) { tab = tabButton.dataset.tab; render(); }
      else if (actionButton) actions[actionButton.dataset.action]?.();
    });
    root.addEventListener('input', (event) => {
      if (event.target.matches('.partition-range')) {
        partitionSize = Number(event.target.value);
        event.target.nextElementSibling.textContent = `${partitionSize}%`;
        const map = panel.querySelector('.partition-map>div:first-child');
        if (map) { map.style.height = `${partitionSize}%`; map.querySelector('span').textContent = `${partitionSize}%`; map.nextElementSibling.querySelector('span').textContent = `${100-partitionSize}%`; }
      }
    });
    infoButton.addEventListener('click', showInfo);
    mountButton.addEventListener('click', toggleMount);
    imageButton.addEventListener('click', () => saveImage('blank'));
    refreshButton.addEventListener('click', refreshStorage);
    win.addEventListener('leopard-command', (event) => {
      const action = actions[event.detail?.command];
      if (action) { event.preventDefault(); action(); }
    });
    return win;
  }

  System.registerApp({
    id: 'diskutil', name: t('ui.2c7b32bc8d20'), icon, open,
    about: t('ui.44cb94d87310'),
    keywords: t('ui.307eb1145a8b'),
  });
})();
