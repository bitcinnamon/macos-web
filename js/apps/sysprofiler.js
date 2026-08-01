// 系统报告 (System Profiler) — real hardware/software info from browser APIs
(() => {
  const { el, HW, Kexts } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="34" rx="3" fill="#2a2f38" stroke="#5a6270" stroke-width="1.5"/><rect x="11" y="13" width="42" height="28" fill="#7ec0ea"/><text x="32" y="32" text-anchor="middle" font-size="14" fill="#fff" font-family="Monaco,monospace">i</text><path d="M24 44 h16 l3 8 H21z" fill="#b8bec8" stroke="#5a6270" stroke-width="1.5"/><rect x="16" y="52" width="32" height="4" rx="2" fill="#9aa2b0"/></svg>`;

  // measure real display refresh rate via rAF sampling
  // (rAF is paused in background tabs, so fall back to “未知” after a short timeout)
  let fpsCache = null;
  function measureFps() {
    if (fpsCache) return Promise.resolve(fpsCache);
    return new Promise((res) => {
      let done = false;
      const stamps = [];
      const finish = (v) => { if (!done) { done = true; res(v); } };
      setTimeout(() => finish('未知（标签页在后台）'), 800);
      function frame(t) {
        if (done) return;
        stamps.push(t);
        if (stamps.length < 31) requestAnimationFrame(frame);
        else {
          const deltas = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b);
          const median = deltas[Math.floor(deltas.length / 2)];
          fpsCache = Math.round(1000 / median) + ' Hz';
          finish(fpsCache);
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function glDetails() {
    const out = [];
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { powerPreference: 'high-performance' })
        || c.getContext('webgl', { powerPreference: 'high-performance' });
      if (!gl) return [['WebGL', '不支持']];
      out.push(['图形 API', System.HW.graphicsApi]);
      out.push(['最大纹理尺寸', gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' px']);
      out.push(['最大视口', gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(' × ')]);
      out.push(['着色语言', gl.getParameter(gl.SHADING_LANGUAGE_VERSION)]);
      out.push(['抗锯齿', gl.getContextAttributes().antialias ? '支持' : '不支持']);
      out.push(['WebGL 扩展数', String((gl.getSupportedExtensions() || []).length)]);
      if (System.HW.webgl2) {
        out.push(['最大多重采样', String(gl.getParameter(gl.MAX_SAMPLES))]);
        out.push(['最大绘制缓冲', String(gl.getParameter(gl.MAX_DRAW_BUFFERS))]);
      }
    } catch (e) {}
    return out;
  }

  const SECTIONS = [
    { id: 'hw', name: '硬件概述', group: '硬件', rows: () => [
      ['型号名称', HW.model],
      ['型号标识符', HW.modelIdentifier],
      ['处理器名称', HW.processorName],
      ['处理器', HW.processor],
      ['处理器信息来源', HW.processorSource],
      ['处理器速度', '浏览器未公开'],
      ['处理器数量', '浏览器未公开'],
      ['总核心数', `${HW.cores}（逻辑处理器）`],
      ['内存', HW.memory],
      ['内存信息来源', HW.memorySource],
      ['图形处理器', HW.gpu],
      ['序列号', HW.serial],
      ['启动磁盘', 'Macintosh HD (localStorage)'],
      ['固件版本', 'WebBoot 9A581'],
      ['SMC 版本', '1.0f1-web（虚拟）'],
      ['触控', navigator.maxTouchPoints ? `支持（${navigator.maxTouchPoints} 点触控）` : '不支持（鼠标/触控板）'],
    ]},
    { id: 'gpu', name: '图形卡/显示器', rows: async () => {
      const fps = await measureFps();
      return [
        ['芯片组型号', HW.gpu],
        ['WebGL', HW.webgl ? `支持 — ${HW.graphicsApi}` : '不支持'],
        ['WebGL 2', HW.webgl2 ? '支持（游戏优先使用）' : '不支持（使用兼容路径）'],
        ['驱动版本', HW.glVersion || '未知'],
        ['Quartz Extreme', HW.webgl && Kexts.isLoaded('QuartzExtreme.kext') ? '已启用（硬件加速合成）' : '未启用（软件渲染）'],
        ['分辨率', HW.screen],
        ['可用区域', `${screen.availWidth} × ${screen.availHeight}`],
        ['像素深度', HW.depth],
        ['缩放因子 (DPR)', String(HW.dpr) + (HW.dpr > 1 ? '（Retina）' : '')],
        ['刷新率（实测）', fps],
        ['色域', matchMedia('(color-gamut: p3)').matches ? '广色域 (Display P3)' : 'sRGB'],
        ['HDR', matchMedia('(dynamic-range: high)').matches ? '支持' : '不支持'],
        ...glDetails(),
      ];
    }},
    { id: 'mem', name: '内存', rows: () => {
      const rows = [
        ['物理内存（浏览器上报）', HW.memory],
        ['信息来源', HW.memorySource],
      ];
      const pm = performance.memory;
      if (pm) {
        rows.push(['JS 堆上限', (pm.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB']);
        rows.push(['JS 堆已分配', (pm.totalJSHeapSize / 1048576).toFixed(1) + ' MB']);
        rows.push(['JS 堆已使用', (pm.usedJSHeapSize / 1048576).toFixed(1) + ' MB']);
      } else rows.push(['JS 堆信息', '此浏览器不提供 (performance.memory)']);
      return rows;
    }},
    { id: 'battery', name: '电源/电池', rows: async () => {
      if (!navigator.getBattery) return [['电池信息', '此浏览器不提供 (Battery API)']];
      try {
        const b = await navigator.getBattery();
        const fmt = (s) => (s === Infinity || isNaN(s)) ? '—' : `${Math.floor(s / 3600)} 小时 ${Math.round(s % 3600 / 60)} 分钟`;
        return [
          ['电量', Math.round(b.level * 100) + ' %'],
          ['电源', b.charging ? '电源适配器（正在充电）' : '电池'],
          ['充满还需', b.charging ? fmt(b.chargingTime) : '—'],
          ['预计续航', b.charging ? '—' : fmt(b.dischargingTime)],
        ];
      } catch (e) { return [['电池信息', '读取失败']]; }
    }},
    { id: 'storage', name: '存储', rows: async () => {
      let quota = '未知', usage = '未知', persisted = '未知';
      try {
        const est = await navigator.storage.estimate();
        quota = (est.quota / 1073741824).toFixed(1) + ' GB';
        usage = (est.usage / 1024).toFixed(1) + ' KB';
        persisted = (await navigator.storage.persisted()) ? '是（持久存储）' : '否（可被浏览器回收）';
      } catch (e) {}
      const vfsSize = (JSON.stringify(localStorage).length / 1024).toFixed(1);
      return [
        ['磁盘', 'Macintosh HD'],
        ['文件系统', 'HFS+ (localStorage 模拟)'],
        ['容量（浏览器配额）', quota],
        ['已使用（源）', usage],
        ['localStorage 占用', vfsSize + ' KB'],
        ['持久化', persisted],
      ];
    }},
    { id: 'audio', name: '音频', rows: () => {
      const rows = [];
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          rows.push(['Web Audio', '支持']);
          rows.push(['采样率', ctx.sampleRate + ' Hz']);
          rows.push(['输出延迟基准', (ctx.baseLatency != null ? (ctx.baseLatency * 1000).toFixed(1) + ' ms' : '未知')]);
          ctx.close();
        } else rows.push(['Web Audio', '不支持']);
      } catch (e) {}
      rows.push(['语音合成音色', (speechSynthesis && speechSynthesis.getVoices().length || 0) + ' 个']);
      rows.push(['MP3 解码', document.createElement('audio').canPlayType('audio/mpeg') ? '支持' : '不支持']);
      rows.push(['AAC 解码', document.createElement('audio').canPlayType('audio/mp4') ? '支持' : '不支持']);
      return rows;
    }},
    { id: 'ata', name: 'Serial-ATA', rows: () => [
      ['Intel ICH8-M AHCI', '虚拟控制器'],
      ['厂商', 'Leopard Web'],
      ['产品', 'Macintosh HD'],
      ['协议', 'Web Storage / IndexedDB'],
      ['可移除介质', '否'],
      ['BSD 名称', 'disk0s2（兼容显示）'],
      ['S.M.A.R.T. 状态', '已验证（虚拟磁盘）'],
    ]},
    { id: 'usb', name: 'USB', rows: async () => {
      const rows = [
        ['USB 高速总线', '浏览器设备沙箱'],
        ['WebUSB API', navigator.usb ? '可用（设备访问需要用户授权）' : '此浏览器不提供'],
        ['HID API', navigator.hid ? '可用（设备访问需要用户授权）' : '此浏览器不提供'],
        ['游戏手柄', `${navigator.getGamepads ? navigator.getGamepads().filter(Boolean).length : 0} 个已连接`],
      ];
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          devices.forEach((device, index) => rows.push([
            `${device.kind === 'audioinput' ? '音频输入' : device.kind === 'audiooutput' ? '音频输出' : device.kind === 'videoinput' ? '摄像头' : '媒体设备'} ${index + 1}`,
            device.label || '受保护的设备（授权后显示名称）',
          ]));
        } catch (error) { rows.push(['媒体设备', '读取失败']); }
      }
      return rows;
    }},
    { id: 'bluetooth', name: 'Bluetooth', rows: () => [
      ['Apple Bluetooth 软件版本', '2.1.9f10-web'],
      ['Web Bluetooth', navigator.bluetooth ? '可用（配对时由浏览器请求授权）' : '此浏览器不提供'],
      ['可发现', '关闭'],
      ['Handoff', '不支持'],
      ['说明', '网页只能看见用户在授权对话框中主动选择的设备'],
    ]},
    { id: 'firewire', name: 'FireWire', rows: () => [
      ['FireWire 总线', '未检测到'],
      ['说明', '浏览器没有 IEEE 1394 硬件枚举权限'],
    ]},
    { id: 'disc', name: '光盘刻录', rows: () => {
      const video = document.createElement('video');
      return [
        ['刻录机', '未检测到（网页无法直接控制光驱）'],
        ['CD 音频读取', document.createElement('audio').canPlayType('audio/wav') ? '可解码 WAV' : '未知'],
        ['DVD 视频解码', video.canPlayType('video/mp4') ? '支持浏览器兼容视频' : '未知'],
        ['虚拟磁盘映像', 'VFS 支持只读演示卷'],
      ];
    }},
    { id: 'printer', name: '打印机', rows: () => [
      ['默认打印机', '由真实浏览器打印面板管理'],
      ['打印系统', 'window.print() / PDF 下载'],
      ['CUPS', '网页沙箱不公开打印队列与驱动'],
      ['测试页', '可在“打印与传真”偏好设置中生成 PDF'],
    ]},
    { id: 'diag', name: '诊断', rows: () => [
      ['上次开机自检', '通过'],
      ['WebGL 2 上下文', HW.webgl2 ? '通过' : '未通过（使用兼容路径）'],
      ['本地存储读写', (() => { try { localStorage.setItem('__sprof_test','1'); localStorage.removeItem('__sprof_test'); return '通过'; } catch (error) { return '失败'; } })()],
      ['安全上下文', window.isSecureContext ? '通过' : '警告：非安全上下文'],
      ['JavaScript', '通过'],
    ]},
    { id: 'input', name: '输入设备', rows: () => [
      ['指针类型', matchMedia('(pointer: fine)').matches ? '精确（鼠标/触控板）' : (matchMedia('(pointer: coarse)').matches ? '粗略（触屏）' : '未知')],
      ['悬停能力', matchMedia('(hover: hover)').matches ? '支持' : '不支持'],
      ['最大触控点', String(navigator.maxTouchPoints || 0)],
      ['游戏手柄', (navigator.getGamepads ? navigator.getGamepads().filter(Boolean).length : 0) + ' 个已连接'],
      ['剪贴板 API', navigator.clipboard ? '支持' : '不支持'],
    ]},
    { id: 'net', name: '网络', group: '网络', rows: () => {
      const c = navigator.connection || {};
      return [
        ['状态', navigator.onLine ? '已连接' : '离线'],
        ['接口', 'en0 (浏览器网络栈)'],
        ['连接类型', c.effectiveType || '未知'],
        ['下行带宽估计', c.downlink != null ? c.downlink + ' Mbps' : '未知'],
        ['往返延迟估计', c.rtt != null ? c.rtt + ' ms' : '未知'],
        ['省流量模式', c.saveData ? '开启' : '关闭'],
      ];
    }},
    { id: 'airport', name: 'AirPort', rows: () => {
      const c = navigator.connection || {};
      return [
        ['软件版本', 'AirPort 5.3.2-web'],
        ['接口', 'en0'],
        ['状态', navigator.onLine ? '已连接到 Leopard Web' : '关闭'],
        ['PHY 模式', c.effectiveType ? `${c.effectiveType}（浏览器估计）` : '浏览器未公开'],
        ['传输速率', c.downlink != null ? `${c.downlink} Mbps（估计）` : '浏览器未公开'],
        ['信道', '浏览器未公开'],
        ['国家/地区代码', (navigator.language || 'en-US').split('-')[1] || '—'],
      ];
    }},
    { id: 'ethernet', name: '以太网卡', rows: () => {
      const c = navigator.connection || {};
      return [
        ['接口', 'en1（兼容显示）'],
        ['设备名称', '浏览器网络适配器'],
        ['状态', c.type === 'ethernet' && navigator.onLine ? '已连接' : '未检测到独立以太网连接'],
        ['MAC 地址', '浏览器隐私沙箱不公开'],
        ['IPv4 配置', navigator.onLine ? '由宿主系统管理（网页不可读取）' : '未配置'],
        ['IPv6 配置', '由宿主系统管理（网页不可读取）'],
        ['速度', c.downlink != null ? `${c.downlink} Mbps（浏览器估计）` : '未知'],
      ];
    }},
    { id: 'modems', name: '调制解调器', rows: () => [
      ['外置调制解调器', '未检测到'],
      ['内建调制解调器', '此 Mac 没有内建调制解调器'],
      ['说明', '浏览器不公开串行端口、拨号连接或运营商配置'],
    ]},
    { id: 'locations', name: '位置', rows: () => [
      ['自动', 'AirPort：Leopard Web；以太网：未连接'],
      ['家庭', 'AirPort：首选；代理：关闭'],
      ['工作', '以太网：DHCP；AirPort：备用'],
      ['当前活动位置', localStorage.getItem('macweb.network.location') || '自动'],
    ]},
    { id: 'firewall', name: '防火墙', rows: () => [
      ['应用程序防火墙', '由宿主操作系统与浏览器负责'],
      ['安全上下文', window.isSecureContext ? '安全 (HTTPS/localhost)' : '不安全'],
      ['同源策略', '已启用'],
      ['第三方框架限制', '遵循目标站点 CSP / X-Frame-Options'],
      ['Cookie', navigator.cookieEnabled ? '允许（受浏览器策略限制）' : '停用'],
    ]},
    { id: 'locale', name: '区域与语言', rows: () => {
      const dtf = Intl.DateTimeFormat().resolvedOptions();
      return [
        ['首选语言', HW.lang],
        ['语言列表', (navigator.languages || []).join(', ')],
        ['时区', dtf.timeZone],
        ['UTC 偏移', 'UTC' + (new Date().getTimezoneOffset() <= 0 ? '+' : '−') + Math.abs(new Date().getTimezoneOffset() / 60)],
        ['日历', dtf.calendar],
        ['数字系统', dtf.numberingSystem],
      ];
    }},
    { id: 'sw', name: '软件', group: '软件', rows: () => {
      const brands = navigator.userAgentData && navigator.userAgentData.brands
        ? navigator.userAgentData.brands.map((b) => `${b.brand} ${b.version}`).join(' · ') : null;
      return [
        ['系统版本', 'Mac OS X 10.5 Leopard (Web) Build 9A581-www'],
        ['内核版本', 'Darwin 9.8.0 (JavaScript)'],
        ['开机时间', System.uptimeStr()],
        ['窗口尺寸', `${innerWidth} × ${innerHeight}`],
        ['Cookie', navigator.cookieEnabled ? '已启用' : '已停用'],
        ['内建 PDF 查看器', navigator.pdfViewerEnabled ? '有' : '无'],
        ['自动化控制 (webdriver)', navigator.webdriver ? '是' : '否'],
        ...(brands ? [['浏览器标识', brands]] : []),
        ['User-Agent', HW.ua],
      ];
    }},
    { id: 'developer', name: '开发者', rows: () => [
      ['JavaScript', 'ECMAScript 模块 · 已启用'],
      ['WebAssembly', typeof WebAssembly === 'object' ? '支持' : '不支持'],
      ['Service Worker', 'serviceWorker' in navigator ? '支持（当前系统未注册）' : '不支持'],
      ['IndexedDB', window.indexedDB ? '支持' : '不支持'],
      ['WebGL 2', HW.webgl2 ? '支持' : '不支持'],
      ['Web Audio', (window.AudioContext || window.webkitAudioContext) ? '支持' : '不支持'],
      ['安全上下文', window.isSecureContext ? '是' : '否'],
      ['构建标识', 'Leopard Web 9A581-www'],
    ]},
    { id: 'accessibility', name: '辅助技术', rows: () => [
      ['VoiceOver 实用工具', 'Leopard Web 内建'],
      ['减少动态效果', matchMedia('(prefers-reduced-motion: reduce)').matches ? '用户已请求' : '未请求'],
      ['增强对比度', matchMedia('(prefers-contrast: more)').matches ? '用户已请求' : '未请求或浏览器不公开'],
      ['强制颜色', matchMedia('(forced-colors: active)').matches ? '已启用' : '未启用'],
      ['键盘导航', '支持菜单、窗口、Aqua 面板和应用程序控件'],
      ['屏幕阅读器状态', '浏览器隐私沙箱不公开'],
    ]},
    { id: 'apps', name: '应用程序', rows: () => Object.values(System.apps).map((a) => [a.name, `${a.id} · 1.0 (Web)${a.windows.length ? ' — 正在运行' : ''}`]) },
    { id: 'kext', name: '扩展', rows: () => Kexts.list().map((k) => [k.name, `${k.loaded ? '✅ 已装载' : '⬜ 未装载'} · v${k.ver} — ${k.desc}`]) },
    { id: 'fonts', name: '字体', rows: async () => {
      const families = ['Lucida Grande','Helvetica','Arial','Times New Roman','Georgia','Monaco','Courier New','PingFang SC','Hiragino Sans GB','Songti SC'];
      if (document.fonts?.ready) await document.fonts.ready;
      return families.map((family) => [family, document.fonts?.check(`12px "${family}"`) ? '可用' : '不可用']);
    }},
    { id: 'frameworks', name: 'Frameworks', rows: () => [
      ['Aqua.framework', 'CSS 视觉层 · 已载入'],
      ['AppKit.framework', 'System 窗口管理 · 已载入'],
      ['CoreGraphics.framework', `Canvas 2D / ${HW.graphicsApi}`],
      ['WebKit.framework', navigator.userAgent],
      ['WebAudio.framework', (window.AudioContext || window.webkitAudioContext) ? '已载入' : '不可用'],
      ['MediaDevices.framework', navigator.mediaDevices ? '已载入' : '不可用'],
    ]},
    { id: 'prefpanes', name: '偏好设置面板', rows: () => [
      ['个人', '外观、桌面与屏幕保护程序、Dock、Exposé 与 Spaces、多语言环境、安全性、Spotlight'],
      ['硬件', 'CD 与 DVD、显示器、节能器、键盘与鼠标、打印与传真、声音'],
      ['互联网与无线', '.Mac、网络、Bluetooth、共享'],
      ['系统', '帐户、日期与时间、家长控制、软件更新、语音、Time Machine、万能辅助'],
    ]},
    { id: 'startup', name: '启动项目', rows: () => [
      ['Finder', '已启动 · 桌面与文件系统'],
      ['Dock', '已启动 · 应用程序切换与 Stacks'],
      ['SystemUIServer', '已启动 · 菜单栏状态项目'],
      ['Spotlight', '已启动 · 本地 VFS 索引'],
      ['Dashboard', localStorage.getItem('macweb.dashboard.disabled') === '1' ? '已停用' : '可用'],
    ]},
    { id: 'syncservices', name: 'SyncServices', rows: () => [
      ['同步服务', 'Leopard Web 本地事件总线'],
      ['通讯录与 iCal', '生日字段可同步到生日历'],
      ['Finder 与桌面', '共享同一虚拟文件系统'],
      ['应用程序偏好设置', '更改会实时广播给已打开的应用程序'],
      ['云端同步', '未配置；数据保留在当前浏览器来源中'],
    ]},
    { id: 'installations', name: '安装项目', rows: () => [
      ['Mac OS X Leopard Web', '9A581-www · 当前构建'],
      ['Leopard 应用程序组件', `${Object.keys(System.apps).length} 个应用已注册`],
      ['虚拟 Macintosh HD', '首次启动时创建 · localStorage'],
      ['用户内容', '由 Finder、Photo Booth、TextEdit 与打印功能生成'],
    ]},
    { id: 'log', name: '日志', rows: () => System.syslogBuf.slice(-14).map((l) => [l.ts, `[${l.src}] ${l.msg}`]) },
  ];

  function open() {
    const layout = el('div', 'sprof-layout');
    const side = el('div', 'sprof-side');
    const main = el('div', 'sprof-main');
    const toolbar = el('div', 'sprof-toolbar');
    const refresh = el('button', 'finder-toolbar-btn', '刷新');
    const copy = el('button', 'finder-toolbar-btn', '拷贝');
    const save = el('button', 'finder-toolbar-btn', '存储…');
    const search = el('input', 'aqua-input aqua-search');
    search.placeholder = '筛选报告';
    toolbar.append(refresh, copy, save, search);

    let cur = 'hw';
    let currentRows = [];
    let renderVersion = 0;
    let win;
    const sectionText = () => {
      const sec = SECTIONS.find((section) => section.id === cur);
      return `${sec.name}\n${currentRows.map(([key, value]) => `${key}: ${value}`).join('\n')}`;
    };
    async function render() {
      const version = ++renderVersion;
      const sec = SECTIONS.find((s) => s.id === cur);
      main.innerHTML = '';
      const loadingHead = el('header', 'sprof-section-head');
      loadingHead.innerHTML = `<div class="sprof-section-icon">i</div><div><h2>${sec.name}</h2><p>正在收集数据…</p></div>`;
      main.appendChild(loadingHead);
      const rows = await sec.rows();
      if (version !== renderVersion) return;
      currentRows = rows;
      main.innerHTML = '';
      const header = el('header', 'sprof-section-head');
      const badge = el('div', 'sprof-section-icon', sec.group === '硬件' || ['hw','gpu','mem','storage','audio','ata','usb','bluetooth','firewire','disc','printer','diag','battery','input'].includes(sec.id) ? '⌘' : sec.group === '网络' || ['net','airport','locations','firewall','locale'].includes(sec.id) ? '⌁' : 'i');
      const heading = el('div');
      heading.append(el('h2', '', sec.name), el('p', '', `${rows.length} 项资料 · ${sec.group || '详细资料'}`));
      header.append(badge, heading);
      main.appendChild(header);
      const table = el('table', 'sprof-table');
      rows.forEach(([k, v]) => {
        const tr = el('tr');
        const key = el('td', '', `${k}:`);
        const value = el('td', '', String(v));
        tr.append(key, value);
        table.appendChild(tr);
      });
      main.appendChild(table);
      side.querySelectorAll('.sprof-item').forEach((s) => s.classList.toggle('sel', s.dataset.id === cur));
      if (win) win.querySelector('.win-statusbar').textContent = `${sec.name} · ${rows.length} 项 · 可拷贝或存储为完整 .spx 报告`;
    }

    let groupBody = null;
    let groupName = '';
    SECTIONS.forEach((s) => {
      if (s.group) {
        groupName = s.group;
        const block = el('section', 'sprof-group-block');
        block.dataset.search = s.group.toLowerCase();
        block.dataset.collapsed = '0';
        const group = el('button', 'sprof-group');
        group.type = 'button';
        group.setAttribute('aria-expanded', 'true');
        group.innerHTML = `<span class="sprof-group-disclosure">▾</span><span>${s.group}</span>`;
        const body = el('div', 'sprof-group-items');
        groupBody = body;
        group.addEventListener('click', () => {
          const collapsed = block.dataset.collapsed !== '1';
          block.dataset.collapsed = collapsed ? '1' : '0';
          block.classList.toggle('collapsed', collapsed);
          group.setAttribute('aria-expanded', String(!collapsed));
          body.hidden = collapsed;
        });
        block.append(group, body);
        side.appendChild(block);
      }
      const item = el('button', 'sprof-item');
      item.dataset.id = s.id;
      item.dataset.search = `${groupName} ${s.name}`.toLowerCase();
      item.innerHTML = `<span class="sprof-item-gutter" aria-hidden="true"></span><span>${s.name}</span>`;
      item.addEventListener('click', () => { cur = s.id; render(); });
      groupBody.appendChild(item);
    });
    layout.append(side, main);
    refresh.addEventListener('click', () => { fpsCache = null; render(); });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sectionText());
        Leopard.toast('系统报告', '当前部分已经拷贝到剪贴板。');
      } catch (error) {
        System.alertBox('系统报告', '浏览器没有授予剪贴板写入权限。');
      }
    });
    save.addEventListener('click', async () => {
      const endBusy = System.beginBusy(160);
      const originalStatus = win.querySelector('.win-statusbar').textContent;
      win.querySelector('.win-statusbar').textContent = '正在收集完整系统报告…';
      try {
        let group = '';
        const report = [];
        for (const section of SECTIONS) {
          if (section.group) group = section.group;
          let rows;
          try { rows = await section.rows(); }
          catch (error) { rows = [['收集错误', error?.message || '未知错误']]; }
          report.push({ group, name:section.name, rows });
        }
        const xmlEscape = (value) => String(value)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        const generatedAt = new Date().toISOString();
        const sectionsXml = report.map((section) => `<dict>
  <key>_dataType</key><string>SPSectionDataType</string>
  <key>_group</key><string>${xmlEscape(section.group)}</string>
  <key>_name</key><string>${xmlEscape(section.name)}</string>
  <key>_items</key><array>${section.rows.map(([key, value]) => `<dict><key>_name</key><string>${xmlEscape(key)}</string><key>_value</key><string>${xmlEscape(value)}</string></dict>`).join('')}</array>
</dict>`).join('\n');
        const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>SPReportVersion</key><string>1.0</string>
<key>Machine_Name</key><string>${xmlEscape(HW.model)}</string>
<key>System_Version</key><string>Mac OS X 10.5 Leopard (Web) 9A581-www</string>
<key>Generated_At</key><string>${generatedAt}</string>
<key>Data</key><array>
${sectionsXml}
</array></dict></plist>`;
        System.savePanel({
          parent:win,
          title:'存储系统报告',
          startPath:'/用户/roll/文稿',
          name:`${HW.model} 系统报告.spx`,
          extension:'spx',
          typeLabel:'System Profiler 报告',
          allowOverwrite:true,
          onSave:(path)=>{
            const saved = VFS.putNode(path, {
              type:'file', kind:'document', content,
              mime:'application/x-apple-systemprofiler+xml',
              creator:'sysprofiler', generated:true, createdAt:generatedAt,
            });
            if(saved) Leopard.toast('系统报告', `“${VFS.baseName(path)}”已存储，可在 Finder 中下载。`);
            return saved;
          },
        });
      } finally {
        win.querySelector('.win-statusbar').textContent = originalStatus;
        endBusy();
      }
    });
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      side.querySelectorAll('.sprof-group-block').forEach((block) => {
        const groupMatch = !!query && block.dataset.search.includes(query);
        const items = Array.from(block.querySelectorAll('.sprof-item'));
        items.forEach((item) => { item.hidden = !!query && !groupMatch && !item.dataset.search.includes(query); });
        const visible = items.some((item) => !item.hidden);
        block.hidden = !!query && !visible;
        const group = block.querySelector('.sprof-group');
        const body = block.querySelector('.sprof-group-items');
        if (query) {
          body.hidden = false;
          block.classList.remove('collapsed');
          group.setAttribute('aria-expanded', 'true');
        } else {
          const collapsed = block.dataset.collapsed === '1';
          body.hidden = collapsed;
          block.classList.toggle('collapsed', collapsed);
          group.setAttribute('aria-expanded', String(!collapsed));
        }
      });
    });

    win = System.createWindow({ app: 'sysprofiler', title: `${HW.model} — 系统报告`, width: 850, height: 590, toolbar, content: layout, statusbar: '正在收集浏览器与虚拟硬件资料…' });
    render();
  }

  System.registerApp({
    id: 'sysprofiler', name: '系统报告', icon, open,
    about: 'Leopard 风格完整分类报告：硬件、GPU/WebGL、设备、电源、存储、网络、安全、软件、字体、扩展与日志；真实浏览器资料和虚拟硬件会明确区分。',
    keywords: 'profiler 系统报告 硬件 信息 about',
  });
})();
