import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 活动监视器 (Activity Monitor) — live processes and browser-observable resources
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="amg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4048"/><stop offset="1" stop-color="#1a1e24"/></linearGradient></defs><rect x="6" y="10" width="52" height="44" rx="6" fill="url(#amg)" stroke="#0a0c10" stroke-width="1.5"/><polyline points="10,44 18,40 24,28 30,36 36,18 42,32 48,24 54,30" fill="none" stroke="#5df05a" stroke-width="2.5" stroke-linejoin="round"/><polyline points="10,48 20,46 28,42 38,45 46,40 54,43" fill="none" stroke="#f5b53c" stroke-width="2"/></svg>`;

  const SYSTEM_PROCESSES = [
    { name:'kernel_task', pid:0, user:'root', threads:64, memory:92, cpu:.7, parent:'kernel_task', path:'/mach_kernel' },
    { name:'launchd', pid:1, user:'root', threads:3, memory:2.8, cpu:.08, parent:'kernel_task', path:'/sbin/launchd' },
    { name:'kextd', pid:11, user:'root', threads:4, memory:5.5, cpu:.05, parent:'launchd', path:'/usr/libexec/kextd' },
    { name:'syslogd', pid:14, user:'root', threads:4, memory:4.2, cpu:.08, parent:'launchd', path:'/usr/sbin/syslogd' },
    { name:'configd', pid:22, user:'root', threads:7, memory:7.8, cpu:.12, parent:'launchd', path:'/usr/libexec/configd' },
    { name:'mDNSResponder', pid:28, user:'_mdnsresponder', threads:5, memory:6.4, cpu:.1, parent:'launchd', path:'/usr/sbin/mDNSResponder' },
    { name:'mds', pid:39, user:'root', threads:13, memory:21.4, cpu:.25, parent:'launchd', path:'/System/Library/Frameworks/CoreServices.framework/mds' },
    { name:'WindowServer', pid:88, user:'_windowserver', threads:14, memory:58, cpu:1.2, parent:'launchd', path:'/System/Library/Frameworks/ApplicationServices.framework/WindowServer' },
    { name:'loginwindow', pid:101, user:'roll', threads:4, memory:12.6, cpu:.06, parent:'launchd', path:'/System/Library/CoreServices/loginwindow.app' },
    { name:'Dock', pid:128, user:'roll', threads:6, memory:18.5, cpu:.2, parent:'launchd', path:'/System/Library/CoreServices/Dock.app' },
    { name:'SystemUIServer', pid:130, user:'roll', threads:5, memory:14.2, cpu:.14, parent:'launchd', path:'/System/Library/CoreServices/SystemUIServer.app' },
    { name:'Finder', pid:132, user:'roll', threads:8, memory:31.5, cpu:.18, parent:'launchd', path:'/System/Library/CoreServices/Finder.app' },
    { name:'mdworker', pid:156, user:'roll', threads:5, memory:15.7, cpu:.15, parent:'launchd', path:'/System/Library/Frameworks/CoreServices.framework/mdworker' },
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));
  const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };
  const formatRate = (value) => t('app.am.perSec', { v: formatBytes(value) });

  function open() {
    const toolbar = el('div', 'activity-toolbar');
    const inspectButton = el('button', 'finder-toolbar-btn activity-inspect', t('app.am2.a16166bda870'));
    const quitButton = el('button', 'finder-toolbar-btn activity-quit', t('ui.a2a801c9d86f'));
    const sampleButton = el('button', 'finder-toolbar-btn activity-sample', t('app.am2.743d504e45a7'));
    const toolbarSpacer = el('i');
    const scope = el('select', 'activity-scope');
    scope.setAttribute('aria-label', t('ui.0909a4387fc0'));
    scope.innerHTML = `<option value="all">${t('app.am2.a473cb2df452')}</option><option value="my">${t('app.am2.fc05c641cbcd')}</option><option value="active">${t('app.am2.c38dbad2993f')}</option><option value="windowed">${t('app.am2.803cc5a9f752')}</option>`;
    const search = el('input', 'aqua-search activity-search');
    search.type = 'search';
    search.placeholder = t('app.am2.71b73f8317bb');
    search.setAttribute('aria-label', t('app.am2.d2a2feaa472f'));
    toolbar.append(quitButton, inspectButton, sampleButton, toolbarSpacer, scope, search);

    const root = el('div', 'activity-app');
    root.innerHTML = `<section class="activity-process-table">
      <header class="activity-columns" role="row">
        <button data-sort="pid" class="c-pid">PID</button>
        <button data-sort="name" class="c-name">${t('app.am2.04d5749828b9')}</button>
        <button data-sort="user" class="c-user">${t('app.am2.c243a88c43c0')}</button>
        <button data-sort="cpu" class="c-cpu">% CPU</button>
        <button data-sort="threads" class="c-threads">${t('app.am2.488d6314600a')}</button>
        <button data-sort="memory" class="c-memory">${t('app.am2.a76d2e48c015')}</button>
        <button data-sort="kind" class="c-kind">${t('app.am.5db6a8cad0')}</button>
      </header>
      <div class="activity-process-body" role="listbox" aria-label="${t('app.am2.ee2ea34ae574')}" tabindex="0"></div>
    </section>
    <footer class="activity-resources">
      <nav class="activity-resource-tabs" aria-label="${t('app.am2.ac49c781217a')}">
        <button data-resource="cpu">CPU</button>
        <button data-resource="memory">${t('app.am2.25a1d81cf26e')}</button>
        <button data-resource="diskactivity">${t('app.am2.5f5787cf514a')}</button>
        <button data-resource="diskusage">${t('app.am2.b576a604588e')}</button>
        <button data-resource="network">${t('app.am.63bfa69d42')}</button>
      </nav>
      <section class="activity-resource-panel">
        <div class="activity-resource-stats"></div>
        <div class="activity-chart-wrap"><canvas class="activity-chart" aria-label="${t('app.am2.0341d804ee0c')}"></canvas></div>
      </section>
    </footer>`;
    const processBody = root.querySelector('.activity-process-body');
    const stats = root.querySelector('.activity-resource-stats');
    const canvas = root.querySelector('.activity-chart');

    let win = null;
    let selectedPid = null;
    let query = '';
    let scopeMode = 'all';
    let resource = 'cpu';
    let sortKey = 'cpu';
    let sortDirection = -1;
    let currentProcesses = [];
    let visibleProcesses = [];
    let closed = false;
    let timer = null;
    let intervalMs = 1000;
    let resizeObserver = null;
    let longTaskObserver = null;
    let rafId = 0;
    let drawId = 0;
    let lastFrameAt = performance.now();
    let frameElapsed = 0;
    let frameOverage = 0;
    let frameCount = 0;
    let longTaskTime = 0;
    let lastSampleAt = performance.now();
    const initialResources = performance.getEntriesByType?.('resource') || [];
    let lastResourceBytes = initialResources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
    let lastResourceCount = initialResources.length;
    let lastVfsBytes = 0;
    let diskBytesRead = 0;
    let diskBytesWritten = 0;
    let networkBytesReceived = lastResourceBytes;
    let networkBytesSent = lastResourceCount * 680;
    let storageEstimateTick = 0;
    let storageUsage = 0;
    let storageQuota = 10 * 1073741824;
    const historyLength = 90;
    const makeHistory = () => Array.from({ length:historyLength }, () => ({ a:0, b:0 }));
    const histories = {
      cpu:makeHistory(), memory:makeHistory(), diskactivity:makeHistory(),
      diskusage:makeHistory(), network:makeHistory(),
    };
    const metrics = {
      cpuUser:0, cpuSystem:0, heapUsed:0, heapLimit:512 * 1048576,
      diskReadRate:0, diskWriteRate:0, vfsBytes:0, files:0, folders:0,
      networkInRate:0, networkOutRate:0, frameRate:60,
    };

    const scanVfs = () => {
      let files = 0;
      let folders = 0;
      let bytes = 0;
      try {
        VFS.walk('/').forEach((path) => {
          const node = VFS.get(path);
          if (!node) return;
          if (node.type === 'dir') folders++;
          else {
            files++;
            bytes += VFS.sizeOf(path);
          }
        });
      } catch (error) {}
      return { files, folders, bytes };
    };

    const refreshStorageEstimate = async () => {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage != null) storageUsage = estimate.usage;
        if (estimate.quota) storageQuota = estimate.quota;
        if (!closed && resource === 'diskusage') {
          renderResourceStats();
          scheduleDraw();
        }
      } catch (error) {}
    };

    const frameProbe = (now) => {
      const elapsed = clamp(now - lastFrameAt, 0, 250);
      if (elapsed > 0) {
        frameElapsed += elapsed;
        frameOverage += Math.max(0, elapsed - 16.7);
        frameCount++;
      }
      lastFrameAt = now;
      rafId = requestAnimationFrame(frameProbe);
    };

    try {
      if ('PerformanceObserver' in window) {
        longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => { longTaskTime += entry.duration; });
        });
        longTaskObserver.observe({ entryTypes:['longtask'] });
      }
    } catch (error) {
      longTaskObserver = null;
    }

    const collectProcesses = () => {
      const now = performance.now() / 1000;
      const frontWindow = [...System.windows].reverse().find((candidate) =>
        candidate.isConnected && candidate.style.display !== 'none' && !candidate._closing);
      const systemRows = SYSTEM_PROCESSES.map((process, index) => {
        let cpu = process.cpu + (.5 + .5 * Math.sin(now / 2.7 + index * 1.19)) * .18;
        if (process.name === 'WindowServer') cpu += (metrics.cpuUser + metrics.cpuSystem) * .32 + System.windows.length * .12;
        if (process.name === 'kernel_task') cpu += metrics.cpuSystem * .16;
        if (process.name === 'Finder' && frontWindow?.dataset.app === 'finder') cpu += .9;
        return {
          ...process,
          cpu:clamp(cpu, 0, 100),
          memoryBytes:process.memory * 1048576,
          kind:t('ui.7d2ce3d54d36'),
          system:true,
          protected:true,
          front:process.name === 'Finder' && frontWindow?.dataset.app === 'finder',
          windowCount:process.name === 'Finder' ? 1 : 0,
        };
      });
      const runningApps = Object.values(System.apps).filter((app) =>
        app.id !== 'finder' && app.windows.some((candidate) => candidate.isConnected && !candidate._closing));
      const heapShare = metrics.heapUsed / Math.max(1, runningApps.length);
      const appRows = runningApps.map((app, index) => {
        const windows = app.windows.filter((candidate) => candidate.isConnected && !candidate._closing);
        const visibleWindows = windows.filter((candidate) => candidate.style.display !== 'none' && !candidate._hiddenByApp);
        const isFront = frontWindow?.dataset.app === app.id;
        const domNodes = windows.reduce((sum, candidate) => sum + candidate.getElementsByTagName('*').length, 0);
        const activity = (.5 + .5 * Math.sin(now / 1.8 + index * 1.47));
        const cpu = .08 + windows.length * .09 + activity * .34 + (isFront ? .85 : 0)
          + (app.id === 'activity' ? (metrics.cpuUser + metrics.cpuSystem) * .09 : 0);
        const memoryBytes = 8 * 1048576 + windows.length * 4.5 * 1048576
          + Math.min(18 * 1048576, domNodes * 540) + heapShare * .38;
        return {
          pid:400 + Object.keys(System.apps).indexOf(app.id),
          name:app.name,
          user:'roll',
          cpu:clamp(cpu, 0, 100),
          threads:Math.max(3, 2 + windows.length * 2 + Math.round(domNodes / 180)),
          memoryBytes,
          memory:memoryBytes / 1048576,
          kind:t('ui.7d2ce3d54d36'),
          parent:'launchd',
          path:`/应用程序/${app.name}.app/Contents/MacOS/${app.id}`,
          appId:app.id,
          system:false,
          protected:false,
          front:isFront,
          windowCount:visibleWindows.length,
          domNodes,
        };
      });
      return [...systemRows, ...appRows];
    };

    const pushHistory = (name, a, b) => {
      const values = histories[name];
      values.push({ a:Number(a) || 0, b:Number(b) || 0 });
      if (values.length > historyLength) values.shift();
    };

    const sampleMetrics = () => {
      const now = performance.now();
      const elapsedSeconds = Math.max(.25, (now - lastSampleAt) / 1000);
      lastSampleAt = now;
      const frameBusy = clamp((frameOverage + longTaskTime) / Math.max(1, frameElapsed), 0, 1);
      metrics.frameRate = frameCount ? clamp(1000 / Math.max(1, frameElapsed / frameCount), 1, 60) : 60;
      metrics.cpuSystem = clamp(.25 + frameBusy * 31, 0, 100);
      metrics.cpuUser = clamp(.35 + frameBusy * 58 + System.windows.length * .08, 0, 100 - metrics.cpuSystem);
      frameElapsed = 0;
      frameOverage = 0;
      frameCount = 0;
      longTaskTime = 0;

      const memory = performance.memory;
      metrics.heapUsed = memory?.usedJSHeapSize || Math.max(24 * 1048576, storageUsage * .12);
      metrics.heapLimit = memory?.jsHeapSizeLimit || Math.max(512 * 1048576, (navigator.deviceMemory || 4) * 268435456);

      const resources = performance.getEntriesByType?.('resource') || [];
      const resourceBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      const receivedDelta = Math.max(0, resourceBytes - lastResourceBytes);
      const sentDelta = Math.max(0, resources.length - lastResourceCount) * 680;
      metrics.networkInRate = receivedDelta / elapsedSeconds;
      metrics.networkOutRate = sentDelta / elapsedSeconds;
      networkBytesReceived += receivedDelta;
      networkBytesSent += sentDelta;
      lastResourceBytes = resourceBytes;
      lastResourceCount = resources.length;

      const vfs = scanVfs();
      const vfsDelta = vfs.bytes - lastVfsBytes;
      metrics.diskReadRate = vfsDelta < 0 ? Math.abs(vfsDelta) / elapsedSeconds : 0;
      metrics.diskWriteRate = vfsDelta > 0 ? vfsDelta / elapsedSeconds : 0;
      if (vfsDelta < 0) diskBytesRead += Math.abs(vfsDelta);
      else diskBytesWritten += vfsDelta;
      lastVfsBytes = vfs.bytes;
      metrics.vfsBytes = vfs.bytes;
      metrics.files = vfs.files;
      metrics.folders = vfs.folders;

      pushHistory('cpu', metrics.cpuUser, metrics.cpuSystem);
      pushHistory('memory', metrics.heapUsed, metrics.heapUsed * .22);
      pushHistory('diskactivity', metrics.diskReadRate, metrics.diskWriteRate);
      pushHistory('diskusage', storageUsage, metrics.vfsBytes);
      pushHistory('network', metrics.networkInRate, metrics.networkOutRate);

      if (++storageEstimateTick % 8 === 1) refreshStorageEstimate();
    };

    const selectedProcess = () => currentProcesses.find((process) => process.pid === selectedPid) || null;
    const matchesScope = (process) => {
      if (scopeMode === 'my') return process.user === 'roll';
      if (scopeMode === 'active') return process.front || process.cpu >= .5;
      if (scopeMode === 'windowed') return !!process.appId && process.windowCount > 0;
      return true;
    };
    const compareProcesses = (left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * sortDirection;
      return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'zh-CN', { numeric:true }) * sortDirection;
    };

    const updateWindowState = () => {
      if (!win) return;
      const process = selectedProcess();
      win.dataset.activitySelection = process ? String(process.pid) : '';
      win.dataset.activityCanInspect = String(!!process);
      win.dataset.activityCanQuit = String(!!process?.appId && !process.protected);
      win.dataset.activityResource = resource;
      win.dataset.activityScope = scopeMode;
      win.dataset.activitySort = sortKey;
      win.dataset.activitySortDirection = sortDirection > 0 ? 'ascending' : 'descending';
      win.dataset.activityUpdateRate = String(intervalMs);
      root.dispatchEvent(new CustomEvent('app-command-state-changed', { bubbles:true }));
    };

    const renderRows = () => {
      currentProcesses = collectProcesses();
      const loweredQuery = query.trim().toLocaleLowerCase('zh-CN');
      visibleProcesses = currentProcesses.filter((process) =>
        matchesScope(process)
        && (!loweredQuery || `${process.name} ${process.pid} ${process.user}`.toLocaleLowerCase('zh-CN').includes(loweredQuery)))
        .sort(compareProcesses);
      if (selectedPid != null && !currentProcesses.some((process) => process.pid === selectedPid)) selectedPid = null;
      const scrollTop = processBody.scrollTop;
      processBody.innerHTML = '';
      if (!visibleProcesses.length) {
        const empty = el('p', 'activity-empty', t('ui.42181e723413'));
        processBody.appendChild(empty);
      } else {
        visibleProcesses.forEach((process) => {
          const row = el('button', `activity-process-row${process.pid === selectedPid ? ' sel' : ''}`);
          row.type = 'button';
          row.dataset.pid = String(process.pid);
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', String(process.pid === selectedPid));
          row.title = `${process.name} — PID ${process.pid}`;
          row.innerHTML = `<span class="c-pid">${process.pid}</span><span class="c-name">${escapeHtml(process.name)}${process.front ? `<i>${t('app.am2.7c182337cd47')}</i>` : ''}</span><span class="c-user">${escapeHtml(process.user)}</span><span class="c-cpu">${process.cpu.toFixed(1)}</span><span class="c-threads">${process.threads}</span><span class="c-memory">${formatBytes(process.memoryBytes)}</span><span class="c-kind">${escapeHtml(process.kind)}</span>`;
          row.addEventListener('click', () => selectProcess(process.pid));
          row.addEventListener('dblclick', () => showInspector(process.pid));
          processBody.appendChild(row);
        });
      }
      processBody.scrollTop = scrollTop;
      root.querySelectorAll('.activity-columns [data-sort]').forEach((button) => {
        const active = button.dataset.sort === sortKey;
        button.classList.toggle('sorted', active);
        button.setAttribute('aria-sort', active ? (sortDirection > 0 ? 'ascending' : 'descending') : 'none');
        const base = button.textContent.replace(/[▲▼]\s*$/, '').trim();
        button.textContent = `${base}${active ? (sortDirection > 0 ? ' ▲' : ' ▼') : ''}`;
      });
      const process = selectedProcess();
      inspectButton.disabled = !process;
      sampleButton.disabled = !process;
      quitButton.disabled = !process?.appId || !!process.protected;
      if (win) {
        const statusbar = win.querySelector('.win-statusbar');
        if (statusbar) statusbar.textContent = t('app.am.status2', { v: visibleProcesses.length, t: currentProcesses.length, cpu: '' });
      }
      updateWindowState();
    };

    const resourceDefinition = () => {
      if (resource === 'memory') return {
        title:t('ui.5022cccb3e8c'),
        legend:[[t('ui.e678238d3a57'),'#35a35b'],[t('app.am2.2a3460bc5871'),'#e3a23c']],
        maximum:Math.max(metrics.heapLimit, 1),
        stats:[
          [t('ui.e678238d3a57'),formatBytes(metrics.heapUsed),'green'],
          [t('app.am2.2a3460bc5871'),formatBytes(metrics.heapUsed * .22),'orange'],
          [t('ui.603039ccfdd4'),formatBytes(Math.max(0, metrics.heapLimit - metrics.heapUsed)),''],
          [t('app.am2.90a106549853'),formatBytes(metrics.heapLimit),''],
          [t('ui.e5a7bb4149e0'),formatBytes(storageUsage),''],
          [t('app.am2.6ee36f563b43'),metrics.heapUsed / metrics.heapLimit > .75 ? t('app.am.ab84c9d4ea') : metrics.heapUsed / metrics.heapLimit > .5 ? t('app.am2.2979261eddc3') : t('app.am2.fa66e8632694'),'green'],
        ],
      };
      if (resource === 'diskactivity') {
        const values = histories.diskactivity.flatMap((value) => [value.a, value.b]);
        return {
          title:t('app.am2.5f5787cf514a'),
          legend:[[t('ui.b6b97ac60d5d'),'#3f8ac7'],[t('ui.9e93bdccb257'),'#d65a55']],
          maximum:Math.max(1024, ...values) * 1.15,
          stats:[
            [t('app.am2.2c2a88bdeb7d'),formatRate(metrics.diskReadRate),'blue'],
            [t('app.am2.2081cc105002'),formatRate(metrics.diskWriteRate),'red'],
            [t('app.am2.202d1abd5bb3'),formatBytes(diskBytesRead),''],
            [t('app.am2.b57e595f6a83'),formatBytes(diskBytesWritten),''],
            [t('ui.49deaf7da20d'),String(metrics.files),''],
            [t('ui.46ecac29102a'),String(metrics.folders),''],
          ],
        };
      }
      if (resource === 'diskusage') return {
        title:t('app.am2.b576a604588e'),
        legend:[[t('ui.59dc9eb13477'),'#4d87c1'],[t('ui.0c83fc1bc7e1'),'#8fb052']],
        maximum:Math.max(storageQuota, storageUsage, metrics.vfsBytes, 1),
        stats:[
          [t('app.am2.1e9a5357f3f1'),formatBytes(storageUsage),'blue'],
          [t('ui.4981f67ab1d9'),formatBytes(Math.max(0, storageQuota - storageUsage)),'green'],
          [t('app.am2.4d12bfae2c33'),formatBytes(storageQuota),''],
          [t('ui.9c7b9ed62256'),formatBytes(metrics.vfsBytes),''],
          [t('ui.49deaf7da20d'),String(metrics.files),''],
          [t('ui.46ecac29102a'),String(metrics.folders),''],
        ],
      };
      if (resource === 'network') {
        const values = histories.network.flatMap((value) => [value.a, value.b]);
        return {
          title:t('ui.0cbda6b52442'),
          legend:[[t('ui.de7b4c9eebf8'),'#3f9d63'],[t('ui.1214d633a448'),'#d36a45']],
          maximum:Math.max(1024, ...values) * 1.15,
          stats:[
            [t('ui.f12d58650ecc'),formatRate(metrics.networkInRate),'green'],
            [t('ui.4ee75957758c'),formatRate(metrics.networkOutRate),'orange'],
            [t('ui.e314a96691c9'),formatBytes(networkBytesReceived),''],
            [t('ui.ba80022a63e6'),formatBytes(networkBytesSent),''],
            [t('app.am2.cd19de3818e1'),String(lastResourceCount),''],
            [t('app.am.9bb19ed866'),t('ui.6bd59b3971da'),''],
          ],
        };
      }
      return {
        title:t('ui.bdf91f384b92'),
        legend:[[t('ui.9ba763ea3423'),'#39a65b'],[t('ui.1a1f6dff7826'),'#dc5a50']],
        maximum:100,
        stats:[
          [t('ui.a9197713293f'),`${metrics.cpuUser.toFixed(1)}%`,'green'],
          [t('ui.6fda1fd1a503'),`${metrics.cpuSystem.toFixed(1)}%`,'red'],
          [t('ui.62eaf1702b37'),`${Math.max(0, 100 - metrics.cpuUser - metrics.cpuSystem).toFixed(1)}%`,''],
          [t('app.am2.488d6314600a'),String(currentProcesses.reduce((sum, process) => sum + process.threads, 0)),''],
          [t('app.am2.ee2ea34ae574'),String(currentProcesses.length),''],
          [t('ui.7bb8bba2d1ab'),`${metrics.frameRate.toFixed(0)} fps`,''],
        ],
      };
    };

    function renderResourceStats() {
      const definition = resourceDefinition();
      stats.innerHTML = `<header><b>${definition.title}</b><span>${definition.legend.map(([label,color]) => `<i style="--legend:${color}">${label}</i>`).join('')}</span></header><dl>${definition.stats.map(([label,value,tone]) => `<dt>${label}</dt><dd class="${tone}">${escapeHtml(value)}</dd>`).join('')}</dl>`;
      canvas.setAttribute('aria-label', `${definition.title}${t('app.am3.160ca7d135cf')}`);
      root.querySelectorAll('[data-resource]').forEach((button) => button.classList.toggle('sel', button.dataset.resource === resource));
    }

    const scheduleDraw = () => {
      if (drawId || closed) return;
      drawId = requestAnimationFrame(() => {
        drawId = 0;
        drawChart();
      });
    };

    function drawChart() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = Math.min(2, devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext('2d', { alpha:false });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cssWidth = width / ratio;
      const cssHeight = height / ratio;
      const definition = resourceDefinition();
      const values = histories[resource];
      const maximum = Math.max(1, definition.maximum);
      ctx.fillStyle = '#f9fbfc';
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.strokeStyle = '#d8dde1';
      ctx.lineWidth = 1;
      for (let line = 1; line < 5; line++) {
        const y = Math.round(cssHeight * line / 5) + .5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
      for (let line = 1; line < 9; line++) {
        const x = Math.round(cssWidth * line / 9) + .5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
        ctx.stroke();
      }
      const plot = (key, color) => {
        ctx.beginPath();
        values.forEach((value, index) => {
          const x = index / Math.max(1, values.length - 1) * cssWidth;
          const y = cssHeight - clamp(value[key] / maximum, 0, 1) * (cssHeight - 5) - 2.5;
          if (index) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      };
      plot('a', definition.legend[0][1]);
      plot('b', definition.legend[1][1]);
      ctx.strokeStyle = '#7f878e';
      ctx.lineWidth = 1;
      ctx.strokeRect(.5, .5, cssWidth - 1, cssHeight - 1);
    }

    const render = () => {
      renderRows();
      renderResourceStats();
      scheduleDraw();
    };

    const sampleAndRender = () => {
      if (closed) return;
      sampleMetrics();
      render();
    };

    const selectProcess = (pid, focus = false) => {
      selectedPid = Number(pid);
      renderRows();
      if (focus) processBody.querySelector(`[data-pid="${selectedPid}"]`)?.focus();
    };

    const processSample = (process) => {
      const stamp = new Date().toLocaleString();
      const mainFrame = process.appId
        ? `${process.name} event loop`
        : process.name === 'WindowServer' ? 'CGXServer main run loop' : `${process.name} main`;
      return [
        `Sampling process ${process.name} (PID ${process.pid}) every 1 ms for 10 seconds`,
        `Sample time: ${stamp}`,
        `Process path: ${process.path}`,
        `Architecture: ${process.kind}`,
        '',
        `Analyzing sample of process ${process.name} (PID ${process.pid})`,
        '',
        'Call graph:',
        `    ${Math.max(1, Math.round(process.cpu * 38))} Thread_0   DispatchQueue_1: com.apple.main-thread`,
        `    + ${Math.max(1, Math.round(process.cpu * 24))} ${mainFrame}`,
        `    + ! ${Math.max(1, Math.round(process.cpu * 13))} CFRunLoopRun`,
        `    + ! : ${Math.max(1, Math.round(process.cpu * 8))} mach_msg`,
        `    ${Math.max(1, process.threads - 1)} worker threads`,
        `      ${process.appId ? 'WebCore / JavaScriptCore event handling' : 'Mach messages and system services'}`,
        '',
        'Binary images:',
        `    ${process.path}`,
        '    /System/Library/Frameworks/CoreFoundation.framework/CoreFoundation',
        '    /usr/lib/libSystem.B.dylib',
        '',
        'Note: This is a web-edition diagnostic sample of a virtual process and the browser event loop; CPU, memory, and frame intervals come from session-observable data.',
      ].join('\n');
    };

    const showSample = (pid = selectedPid) => {
      const process = currentProcesses.find((candidate) => candidate.pid === Number(pid));
      if (!process) return System.beep();
      const sample = processSample(process);
      const content = el('div', 'activity-sample-sheet');
      const pre = el('pre');
      pre.textContent = sample;
      const actions = el('footer');
      const copy = el('button', 'aqua-btn', t('ui.bc6d0279b622'));
      const save = el('button', 'aqua-btn', t('ui.359721eae599'));
      actions.append(copy, save);
      content.append(pre, actions);
      let sheetApi = null;
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(sample);
          Leopard.toast(t('ui.8af97a099a8a'), t('ui.e121e0ae3765'));
        } catch (error) {
          System.beep();
        }
      });
      save.addEventListener('click', () => {
        sheetApi?.close('save');
        const safeName = process.name.replace(/[\u0000-\u001f\\/:]/g, '-').slice(0, 50) || t('app.am2.ee2ea34ae574');
        setTimeout(() => System.savePanel({
          parent:win, title:t('ui.30b9fb660cc8'), startPath:paths.documents,
          name:VFS.uniqueName(paths.documents, t('app.am.sampleName', { name: safeName }), '.txt'),
          extension:'txt', typeLabel:t('ui.0373f454fa15'), allowOverwrite:true,
          onSave:(path) => {
            const saved = VFS.putNode(path, { type:'file', kind:'document', mime:'text/plain', content:sample, creator:'activity', generated:true });
            if (saved) Leopard.toast(t('ui.8af97a099a8a'), `“${VFS.baseName(path)}”${t('app.am3.435aef5d8168')}。`);
            return saved;
          },
        }), 0);
      });
      sheetApi = System.showSheet({
        parent:win, title:`${process.name} ${t('app.am3.259712e0315b')}`, content,
        className:'activity-sample-dialog', buttons:[{ label:t('ui.6c14bd7f6f9e'), cancel:true }],
      });
    };

    const showInspector = (pid = selectedPid) => {
      const process = currentProcesses.find((candidate) => candidate.pid === Number(pid));
      if (!process) return System.beep();
      const content = el('div', 'activity-inspector-sheet');
      content.innerHTML = `<header><span class="activity-process-orb">${process.system ? '⚙' : 'A'}</span><div><h3>${escapeHtml(process.name)}</h3><p>${t('app.am2.ee2ea34ae574')} ID：${process.pid} · ${escapeHtml(process.user)}</p></div></header>
        <nav><button data-inspector-tab="general" class="sel">${t('app.am2.89ad93140b91')}</button><button data-inspector-tab="memory">${t('app.am.f8dc2d2a16')}</button><button data-inspector-tab="files">${t('app.am2.0c57ac286b6e')}</button></nav>
        <main></main><footer><button class="aqua-btn" data-inspector-sample>${t('app.am2.92076723d9d8')}</button></footer>`;
      const main = content.querySelector('main');
      const renderInspectorTab = (tab) => {
        content.querySelectorAll('[data-inspector-tab]').forEach((button) => button.classList.toggle('sel', button.dataset.inspectorTab === tab));
        const live = currentProcesses.find((candidate) => candidate.pid === process.pid) || process;
        if (tab === 'memory') {
          main.innerHTML = `<dl><dt>${t('app.am2.5132eb8e8fde')}</dt><dd>${formatBytes(live.memoryBytes)}</dd><dt>${t('app.am2.fc5c2aa84616')}</dt><dd>${formatBytes(live.memoryBytes * 2.65)}</dd><dt>${t('app.am3.af99b517edc0')}${t('app.am2.a5dba1001b90')}:</dt><dd>${formatBytes(live.memoryBytes * .18)}</dd><dt>${t('app.am3.2c14726227e1')}${t('app.am2.a5dba1001b90')}:</dt><dd>${formatBytes(live.memoryBytes * .82)}</dd><dt>${t('app.am3.8bf74a805278')}</dt><dd>${formatBytes(live.memoryBytes * 1.38)}</dd></dl>`;
        } else if (tab === 'files') {
          const files = live.appId
            ? [`${live.path}`, `${paths.library}/Preferences/com.apple.${live.appId}.plist`, '/dev/null', t('ui.0215610edd5f')]
            : [live.path, '/dev/null', '/dev/console', '/var/log/system.log'];
          main.innerHTML = `<pre>${escapeHtml(files.join('\n'))}</pre><p>${t('app.am3.a317467958bc')}</p>`;
        } else {
          main.innerHTML = `<dl><dt>${t('app.am3.ab2087b4419f')}</dt><dd class="ok">${live.front ? t('ui.8d0fba7ad892') : t('app.am2.762d720fea64')}</dd><dt>% CPU:</dt><dd>${live.cpu.toFixed(1)}</dd><dt>${t('app.am2.488d6314600a')}:</dt><dd>${live.threads}</dd><dt>${t('app.am2.b69cb905d323')}</dt><dd>${escapeHtml(live.kind)}</dd><dt>${t('app.am.parent')}:</dt><dd>${escapeHtml(live.parent)}</dd><dt>${t('app.am3.56961d0717af')}</dt><dd>${escapeHtml(live.path)}</dd><dt>${t('app.am3.f5c4a7ae3da3')}</dt><dd>${live.windowCount || 0}</dd></dl>`;
        }
      };
      content.addEventListener('click', (event) => {
        const tabButton = event.target.closest('[data-inspector-tab]');
        if (tabButton) renderInspectorTab(tabButton.dataset.inspectorTab);
        if (event.target.closest('[data-inspector-sample]')) showSample(process.pid);
      });
      renderInspectorTab('general');
      System.showSheet({
        parent:win, title:`${process.name} ${t('app.am3.ba82d11f5aa1')}`, content,
        className:'activity-inspector-dialog', buttons:[{ label:t('ui.6c14bd7f6f9e'), cancel:true }],
      });
    };

    const quitSelected = () => {
      const process = selectedProcess();
      if (!process) return System.beep();
      if (!process.appId || process.protected) {
        System.alertBox(t('ui.8af97a099a8a'), t('ui.2b582a4430e6'));
        return;
      }
      System.confirmSheet({
        parent:win,
        headline:`${t('app.am3.86685fb25985')}${t('app.am2.ee2ea34ae574')}“${process.name}”？`,
        message:t('ui.6082f29dc51f'),
        okLabel:t('ui.feecb1e6adec'), danger:true,
        onOK:() => {
          System.quitApp(process.appId);
          selectedPid = null;
          setTimeout(sampleAndRender, 80);
        },
      });
    };

    const setResource = (nextResource) => {
      if (!histories[nextResource]) return;
      resource = nextResource;
      renderResourceStats();
      updateWindowState();
      scheduleDraw();
    };
    const setScope = (nextScope) => {
      if (!['all','my','active','windowed'].includes(nextScope)) return;
      scopeMode = nextScope;
      scope.value = nextScope;
      renderRows();
    };
    const setSort = (nextSort) => {
      if (!['pid','name','user','cpu','threads','memory','kind'].includes(nextSort)) return;
      if (sortKey === nextSort) sortDirection *= -1;
      else {
        sortKey = nextSort;
        sortDirection = ['name','user','kind'].includes(nextSort) ? 1 : -1;
      }
      renderRows();
    };
    const setUpdateRate = (milliseconds) => {
      const next = [500,1000,2000,5000].includes(Number(milliseconds)) ? Number(milliseconds) : 1000;
      intervalMs = next;
      if (timer) clearInterval(timer);
      timer = setInterval(sampleAndRender, intervalMs);
      updateWindowState();
      sampleAndRender();
    };

    const actions = {
      'inspect-process':() => showInspector(),
      'sample-process':() => showSample(),
      'quit-process':quitSelected,
      'focus-search':() => { search.focus(); search.select(); },
      'refresh-now':sampleAndRender,
      'show-cpu':() => setResource('cpu'),
      'show-memory':() => setResource('memory'),
      'show-disk-activity':() => setResource('diskactivity'),
      'show-disk-usage':() => setResource('diskusage'),
      'show-network':() => setResource('network'),
      'scope-all':() => setScope('all'),
      'scope-my':() => setScope('my'),
      'scope-active':() => setScope('active'),
      'scope-windowed':() => setScope('windowed'),
      'sort-pid':() => setSort('pid'),
      'sort-name':() => setSort('name'),
      'sort-cpu':() => setSort('cpu'),
      'sort-memory':() => setSort('memory'),
      'update-very-often':() => setUpdateRate(500),
      'update-often':() => setUpdateRate(1000),
      'update-normal':() => setUpdateRate(2000),
      'update-slow':() => setUpdateRate(5000),
    };

    win = System.createWindow({
      app:'activity', title:t('ui.8af97a099a8a'), width:870, height:590,
      toolbar, content:root, statusbar:t('app.am2.089f15945e2e'),
      onResize:() => scheduleDraw(),
      onClose:() => {
        closed = true;
        if (timer) clearInterval(timer);
        if (rafId) cancelAnimationFrame(rafId);
        if (drawId) cancelAnimationFrame(drawId);
        resizeObserver?.disconnect();
        longTaskObserver?.disconnect();
        return true;
      },
    });

    inspectButton.addEventListener('click', () => showInspector());
    sampleButton.addEventListener('click', () => showSample());
    quitButton.addEventListener('click', quitSelected);
    scope.addEventListener('change', () => setScope(scope.value));
    search.addEventListener('input', () => {
      query = search.value;
      renderRows();
    });
    root.addEventListener('click', (event) => {
      const sortButton = event.target.closest('[data-sort]');
      const resourceButton = event.target.closest('[data-resource]');
      if (sortButton) setSort(sortButton.dataset.sort);
      else if (resourceButton) setResource(resourceButton.dataset.resource);
    });
    processBody.addEventListener('keydown', (event) => {
      if (!visibleProcesses.length) return;
      const currentIndex = Math.max(0, visibleProcesses.findIndex((process) => process.pid === selectedPid));
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = clamp(currentIndex + (event.key === 'ArrowDown' ? 1 : -1), 0, visibleProcesses.length - 1);
        selectProcess(visibleProcesses[nextIndex].pid, true);
      } else if (event.key === 'Enter' && selectedPid != null) {
        event.preventDefault();
        showInspector();
      }
    });
    win.addEventListener('leopard-command', (event) => {
      const action = actions[event.detail?.command];
      if (action) {
        event.preventDefault();
        action();
      }
    });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => scheduleDraw());
      resizeObserver.observe(canvas);
    }
    rafId = requestAnimationFrame(frameProbe);
    const initialVfs = scanVfs();
    lastVfsBytes = initialVfs.bytes;
    Object.assign(metrics, { vfsBytes:initialVfs.bytes, files:initialVfs.files, folders:initialVfs.folders });
    refreshStorageEstimate();
    sampleAndRender();
    timer = setInterval(sampleAndRender, intervalMs);
    return win;
  }

  System.registerApp({
    id:'activity', name:t('ui.8af97a099a8a'), icon, open,
    about:t('ui.7e04d3e1c8d5'),
    keywords:t('ui.1c76941b6051'),
  });
})();
