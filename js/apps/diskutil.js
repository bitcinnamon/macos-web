// 磁盘工具 (Disk Utility) — real storage quota, verify & erase
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><radialGradient id="dug" cx=".4" cy=".35"><stop offset="0" stop-color="#f0f2f6"/><stop offset="1" stop-color="#9aa5b5"/></radialGradient></defs><circle cx="32" cy="32" r="25" fill="url(#dug)" stroke="#5a6270" stroke-width="1.5"/><circle cx="32" cy="32" r="15" fill="#c8ccd4" stroke="#7a8090"/><circle cx="32" cy="32" r="5" fill="#5a6270"/><path d="M50 46 l8 8" stroke="#c06030" stroke-width="5" stroke-linecap="round"/><rect x="42" y="36" width="12" height="12" rx="2" fill="#e8b048" stroke="#9a7020" stroke-width="1.5" transform="rotate(45 48 42)"/></svg>`;

  function open() {
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    }[character]));
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
      { id:'macintosh', role:'volume', name:'Macintosh HD', detail:'Mac OS Extended（日志式）', parent:'disk0', mounted:true, capacity:'74.5 GB' },
      { id:'scratch', role:'image', name:'Leopard Scratch.dmg', detail:'读/写磁盘映像', mounted:false, capacity:'2.0 GB' },
    ];
    const tabs = [
      ['firstaid','急救'],['erase','抹掉'],['partition','分区'],['raid','RAID'],['restore','恢复'],
    ];
    const toolbar = el('div', 'diskutil-toolbar');
    const infoButton = el('button', 'finder-toolbar-btn', 'ⓘ 简介');
    const mountButton = el('button', 'finder-toolbar-btn', '装载');
    const imageButton = el('button', 'finder-toolbar-btn', '新建映像');
    const refreshButton = el('button', 'finder-toolbar-btn', '刷新');
    toolbar.append(infoButton, mountButton, imageButton, el('i'), refreshButton);
    const root = el('div', 'diskutil-app');
    root.innerHTML = `<aside><header>磁盘与宗卷</header><div class="diskutil-devices"></div><footer><span>连接：SATA / 磁盘映像</span></footer></aside>
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
    let storage = { quota:5 * 1048576, usage:JSON.stringify(localStorage).length, files:0, folders:0, bytes:0 };
    const logs = {
      firstaid:'选择“验证磁盘”或“修复磁盘权限”以开始。\n',
      restore:'恢复会建立一份仅包含虚拟磁盘目录与元数据的映像清单。\n',
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
        button.innerHTML = `${deviceGlyph(device)}<span><b>${escapeHtml(device.name)}</b><small>${escapeHtml(device.detail)}${device.mounted ? '' : ' · 未装载'}</small></span>`;
        deviceList.appendChild(button);
      });
    };
    const renderSummary = () => {
      const device = selectedDevice();
      const pct = Math.max(.4, Math.min(100, storage.usage / Math.max(1, storage.quota) * 100));
      summary.innerHTML = `<div class="diskutil-summary-icon">${deviceGlyph(device)}</div><section><h2>${escapeHtml(device.name)}</h2><p>${escapeHtml(device.detail)} · ${escapeHtml(device.capacity)}</p>
        <div class="diskutil-usage"><i style="width:${pct.toFixed(2)}%"></i></div>
        <small>浏览器存储：已使用 ${humanBytes(storage.usage)}，配额 ${humanBytes(storage.quota)} · 虚拟磁盘 ${storage.files} 个文件 / ${storage.folders} 个文件夹</small></section>`;
      mountButton.textContent = device.mounted ? '推出' : '装载';
      mountButton.disabled = busy || device.id === 'macintosh' || device.role === 'device';
    };
    const panelMarkup = () => {
      const device = selectedDevice();
      if (tab === 'firstaid') return `<div class="diskutil-pane firstaid"><header><h3>急救</h3><p>验证或修复所选磁盘的目录结构与权限信息。</p></header>
        <div class="diskutil-action-grid"><section><b>磁盘权限</b><p>检查系统文件和虚拟用户目录的权限元数据。</p><footer><button class="aqua-btn" data-action="verify-permissions" ${busy?'disabled':''}>验证磁盘权限</button><button class="aqua-btn" data-action="repair-permissions" ${busy?'disabled':''}>修复磁盘权限</button></footer></section>
        <section><b>磁盘</b><p>检查目录树、文件计数、父路径和宗卷信息。</p><footer><button class="aqua-btn" data-action="verify-disk" ${busy?'disabled':''}>验证磁盘</button><button class="aqua-btn" data-action="repair-disk" ${busy?'disabled':''}>修复磁盘</button></footer></section></div>
        <pre class="diskutil-log">${escapeHtml(logs.firstaid)}</pre></div>`;
      if (tab === 'erase') return `<div class="diskutil-pane erase"><header><h3>抹掉“${escapeHtml(device.name)}”</h3><p>${device.id === 'scratch' ? '抹掉临时磁盘映像不会影响 Macintosh HD。' : '不能抹掉当前启动宗卷；请从安装 DVD 或其他宗卷启动后再操作。'}</p></header>
        <div class="diskutil-form"><label><span>宗卷格式：</span><select class="erase-format"><option>Mac OS Extended（日志式）</option><option>Mac OS Extended（区分大小写，日志式）</option><option>MS-DOS 文件系统</option></select></label>
        <label><span>名称：</span><input class="aqua-input erase-name" value="${escapeHtml(device.id === 'scratch' ? 'Leopard Scratch' : device.name)}" ${device.id === 'scratch'?'':'disabled'}></label></div>
        <div class="diskutil-warning">${device.id === 'scratch' ? '安全性选项只模拟 Leopard 磁盘映像设置；不会覆盖真实磁盘扇区。' : '启动宗卷受到保护。此网页版不会删除真实浏览器数据。'}</div>
        <footer><button class="aqua-btn" data-action="security-options" ${device.id === 'scratch'?'':'disabled'}>安全性选项…</button><button class="aqua-btn default" data-action="erase-image" ${device.id === 'scratch'&&!busy?'':'disabled'}>抹掉…</button></footer></div>`;
      if (tab === 'partition') return `<div class="diskutil-pane partition"><header><h3>宗卷方案</h3><p>调整图示中的分区大小，然后应用更改。</p></header>
        <div class="partition-layout"><div class="partition-map"><div style="height:${partitionSize}%"><b>Macintosh HD</b><span>${partitionSize.toFixed(0)}%</span></div><div><b>未分配空间</b><span>${(100-partitionSize).toFixed(0)}%</span></div></div>
        <section><label>宗卷方案：<select><option>1 个分区</option><option>2 个分区</option><option>当前</option></select></label><label>Macintosh HD 大小：<input class="partition-range" type="range" min="35" max="90" value="${partitionSize}"><output>${partitionSize}%</output></label><p>分区图仅作用于虚拟磁盘模型，不会调用真实磁盘管理 API。</p></section></div>
        <footer><button class="aqua-btn" data-action="partition-options">选项…</button><button class="aqua-btn default" data-action="apply-partition" ${busy?'disabled':''}>应用</button></footer></div>`;
      if (tab === 'raid') return `<div class="diskutil-pane raid"><header><h3>RAID</h3><p>组合磁盘映像以模拟 Leopard 的软件 RAID 管理。</p></header>
        <div class="raid-table"><header><span>RAID 集名称</span><span>类型</span><span>状态</span></header>${raidCreated?'<div><span>Leopard RAID Set</span><span>镜像 RAID 集</span><span class="ok">在线</span></div>':'<p>尚未建立 RAID 集。</p>'}</div>
        <section><label>RAID 类型：<select><option>镜像 RAID 集</option><option>条带 RAID 集</option><option>串联磁盘集</option></select></label><p>成员：Leopard Scratch.dmg、Recovery Member.dmg</p></section>
        <footer><button class="aqua-btn" data-action="delete-raid" ${raidCreated?'':'disabled'}>删除</button><button class="aqua-btn default" data-action="create-raid" ${raidCreated||busy?'disabled':''}>创建</button></footer></div>`;
      return `<div class="diskutil-pane restore"><header><h3>恢复</h3><p>从宗卷目录清单建立可下载的 Leopard 磁盘映像。</p></header>
        <div class="restore-flow"><label><span>来源：</span><select><option>Macintosh HD</option></select></label><b>⇣</b><label><span>目的磁盘：</span><select><option>新磁盘映像…</option></select></label></div>
        <pre class="diskutil-log">${escapeHtml(logs.restore)}</pre>
        <footer><button class="aqua-btn default" data-action="restore-image" ${busy?'disabled':''}>恢复…</button></footer></div>`;
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
      const heading = permissions ? '磁盘权限' : '磁盘';
      appendLog('firstaid', `正在${repair?'修复':'验证'}宗卷“${device.name}”的${heading}…`);
      const audit = auditVfs();
      const steps = permissions
        ? ['正在读取 BOM 清单。','检查“应用程序”与“系统”目录。','检查用户主文件夹 ACL。',repair?'已重新应用虚拟权限元数据。':'权限验证完成。']
        : ['检查 HFS Plus 宗卷。','检查扩展文件。','检查目录 B-树。',`已检查 ${audit.files} 个文件、${audit.folders} 个文件夹。`,'检查宗卷位图。','检查宗卷信息。'];
      for (const line of steps) {
        if (token !== operationToken) return;
        await wait(180);
        appendLog('firstaid', line);
      }
      appendLog('firstaid', audit.missingParents ? `发现 ${audit.missingParents} 个无效父路径。` : `宗卷“${device.name}”未出现问题。`);
      appendLog('firstaid', `文件数据：${humanBytes(audit.bytes)}。`);
      System.syslog(`磁盘工具: ${repair?'修复':'验证'} ${device.name} ${audit.missingParents?'需要关注':'通过'}`, 'diskutil');
      busy = false;
      render();
    };
    const imageManifest = (kind) => JSON.stringify({
      kind, createdAt:new Date().toISOString(), source:selectedDevice().name,
      format:'UDRW', fileCount:storage.files, folderCount:storage.folders, bytes:storage.bytes,
      paths:VFS.walk('/用户/roll').slice(0,500).map((path) => ({ path, type:VFS.get(path)?.type, size:VFS.sizeOf(path) })),
    }, null, 2);
    const saveImage = (kind = 'blank') => {
      const directory = '/用户/roll/下载';
      const suggested = kind === 'restore' ? 'Macintosh HD 备份.dmg' : '未命名.dmg';
      System.savePanel({
        parent:win, title:kind === 'restore' ? '存储恢复映像' : '新建磁盘映像',
        startPath:directory, name:VFS.uniqueName(directory, suggested.replace(/\.dmg$/,''), '.dmg'),
        extension:'dmg', typeLabel:'Apple 磁盘映像', allowOverwrite:true,
        onSave:(path) => {
          const ok = VFS.putNode(path, { type:'file', kind:'disk-image', mime:'application/x-apple-diskimage', content:imageManifest(kind), creator:'diskutil', generated:true });
          if (ok) {
            appendLog('restore', `已建立“${VFS.baseName(path)}”。`);
            System.addRecentDocument?.(path, 'diskutil');
            Leopard.toast('磁盘工具', `已建立“${VFS.baseName(path)}”。`);
          }
          return ok;
        },
      });
    };
    const showInfo = () => {
      const device = selectedDevice();
      const content = el('div', 'diskutil-info-sheet');
      content.innerHTML = `<header>${deviceGlyph(device)}<span><b>${escapeHtml(device.name)}</b><small>${escapeHtml(device.detail)}</small></span></header><dl>
        <dt>连接总线：</dt><dd>${device.role === 'image' ? '磁盘映像' : 'Serial ATA'}</dd>
        <dt>总容量：</dt><dd>${escapeHtml(device.capacity)}</dd><dt>可写：</dt><dd>${device.id === 'macintosh' || device.id === 'scratch' ? '是' : '否'}</dd>
        <dt>装载点：</dt><dd>${escapeHtml(device.mounted ? (device.id === 'macintosh' ? '/' : '/Volumes/' + device.name.replace(/\.dmg$/,'')) : '未装载')}</dd>
        <dt>S.M.A.R.T. 状态：</dt><dd class="ok">${device.role === 'image' ? '不支持' : '已验证'}</dd>
        <dt>分区图方案：</dt><dd>GUID 分区表</dd><dt>浏览器配额：</dt><dd>${humanBytes(storage.quota)}</dd>
      </dl>`;
      System.showSheet({ parent:win, content, buttons:[{label:'好',default:true}] });
    };
    const toggleMount = () => {
      const device = selectedDevice();
      if (device.id === 'macintosh') return System.alertBox('磁盘工具','不能推出当前启动宗卷。');
      if (device.role === 'device') return;
      device.mounted = !device.mounted;
      render();
      Leopard.toast('磁盘工具', `${device.name} 已${device.mounted?'装载':'推出'}。`);
    };
    const eraseImage = () => {
      const device = selectedDevice();
      if (device.id !== 'scratch') return System.alertBox('磁盘工具','不能抹掉当前启动宗卷。请从其他宗卷启动。');
      const requestedName = panel.querySelector('.erase-name')?.value.trim() || 'Leopard Scratch';
      const name = requestedName.replace(/[\u0000-\u001f\\/:]/g, '-').slice(0, 63).trim() || 'Leopard Scratch';
      const format = panel.querySelector('.erase-format')?.value || 'Mac OS Extended（日志式）';
      System.confirmSheet({
        parent:win, headline:`抹掉“${device.name}”？`, message:'这只会重置临时磁盘映像，不会删除 Macintosh HD 或浏览器中的用户文件。',
        okLabel:'抹掉', danger:true, onOK:()=>{
          device.name = `${name}.dmg`;device.detail = format;device.mounted = true;
          render();Leopard.toast('磁盘工具','临时磁盘映像已抹掉。');
        },
      });
    };
    const applyPartition = () => System.confirmSheet({
      parent:win, headline:'应用分区更改？', message:`Macintosh HD 将在虚拟分区图中调整为 ${partitionSize}% 。不会修改真实磁盘。`,
      okLabel:'分区', onOK:()=>Leopard.toast('磁盘工具','虚拟分区图已更新。'),
    });
    const createRaid = () => { raidCreated = true; render(); Leopard.toast('磁盘工具','Leopard RAID Set 已联机。'); };
    const deleteRaid = () => System.confirmSheet({ parent:win, headline:'删除 RAID 集？', message:'成员磁盘映像不会被删除。', okLabel:'删除', danger:true, onOK:()=>{raidCreated=false;render();} });
    const showSecurity = () => {
      const content = el('div', 'diskutil-security-sheet');
      content.innerHTML = '<h3>安全性选项</h3><label><input type="radio" name="disk-security" checked> 不抹掉数据</label><label><input type="radio" name="disk-security"> 将数据清零</label><label><input type="radio" name="disk-security"> 7 次抹掉</label><p>网页版不会写入真实磁盘扇区；该选择只作为映像元数据保存。</p>';
      System.showSheet({parent:win,content,buttons:[{label:'取消',cancel:true},{label:'好',default:true}]});
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
      'partition-options':()=>System.alertBox('分区选项','GUID 分区表已选中，可用于基于 Intel 的 Mac。'),
      'apply-partition':applyPartition,'create-raid':createRaid,'delete-raid':deleteRaid,
      'restore-image':()=>saveImage('restore'),'new-disk-image':()=>saveImage('blank'),
      'show-disk-info':showInfo,'toggle-mount':toggleMount,'refresh-storage':refreshStorage,
      'show-firstaid':()=>showTab('firstaid'),'show-erase':()=>showTab('erase'),
      'show-partition':()=>showTab('partition'),'show-raid':()=>showTab('raid'),
      'show-restore':()=>showTab('restore'),
    };

    win = System.createWindow({ app:'diskutil', title:'磁盘工具', width:850, height:590, toolbar, content:root, statusbar:'GUID 分区表 · S.M.A.R.T. 状态：已验证', onClose:()=>{
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
    id: 'diskutil', name: '磁盘工具', icon, open,
    about: '显示浏览器真实存储配额与用量，验证虚拟文件系统，抹掉磁盘（重置全部数据）。',
    keywords: 'disk 磁盘 存储 utility',
  });
})();
