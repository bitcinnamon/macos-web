// 网络实用工具 (Network Utility) — browser-observable diagnostics
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><radialGradient id="nug" cx=".4" cy=".35"><stop offset="0" stop-color="#b8e0f8"/><stop offset="1" stop-color="#2f6faf"/></radialGradient></defs><circle cx="32" cy="32" r="25" fill="url(#nug)" stroke="#1a4a80" stroke-width="1.5"/><g stroke="#dff0fc" stroke-width="1.5" fill="none"><ellipse cx="32" cy="32" rx="25" ry="10"/><ellipse cx="32" cy="32" rx="10" ry="25"/><line x1="7" y1="32" x2="57" y2="32"/></g></svg>`;
  const TAB_DEFINITIONS = [
    ['info','信息'], ['netstat','Netstat'], ['appletalk','AppleTalk'], ['ping','Ping'],
    ['lookup','Lookup'], ['trace','Traceroute'], ['whois','Whois'], ['finger','Finger'], ['portscan','端口扫描'],
  ];
  const RECORD_TYPES = ['A','AAAA','CNAME','MX','NS','TXT','SOA'];
  const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('操作已取消', 'AbortError'));
    }, { once:true });
  });
  const escapeText = (value) => String(value ?? '');
  const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };
  const normalizedHost = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
      return url.hostname.replace(/^\[|\]$/g, '');
    } catch (error) {
      return '';
    }
  };

  function open() {
    const toolbar = el('div', 'netutil-toolbar');
    const runButton = el('button', 'finder-toolbar-btn', '▶ 开始');
    const stopButton = el('button', 'finder-toolbar-btn', '■ 停止');
    const copyButton = el('button', 'finder-toolbar-btn', '拷贝结果');
    const toolbarSpacer = el('i');
    const toolbarStatus = el('span', 'netutil-toolbar-status', '就绪');
    stopButton.disabled = true;
    toolbar.append(runButton, stopButton, copyButton, toolbarSpacer, toolbarStatus);

    const root = el('div', 'netutil-app');
    root.innerHTML = `<nav class="netutil-tabs" aria-label="网络工具">${TAB_DEFINITIONS.map(([id,label]) => `<button data-net-tab="${id}">${label}</button>`).join('')}</nav><section class="netutil-workspace"></section>`;
    const workspace = root.querySelector('.netutil-workspace');
    const panes = {};
    let win = null;
    let currentTab = 'info';
    let busy = false;
    let operationId = 0;
    let abortController = null;

    const setBusy = (value, label = '') => {
      busy = value;
      runButton.disabled = value || !panes[currentTab]?.run;
      stopButton.disabled = !value;
      toolbarStatus.textContent = label || (value ? '正在运行…' : '就绪');
      updateWindowState();
    };
    const beginOperation = (label) => {
      if (busy) stopOperation();
      abortController = new AbortController();
      const id = ++operationId;
      setBusy(true, label);
      return { id, signal:abortController.signal };
    };
    const finishOperation = (id, label = '完成') => {
      if (id !== operationId) return;
      abortController = null;
      setBusy(false, label);
    };
    const stopOperation = () => {
      if (!busy) return;
      operationId++;
      abortController?.abort();
      abortController = null;
      setBusy(false, '操作已停止');
      const output = panes[currentTab]?.output;
      if (output) output.textContent += '\n操作已由用户停止。\n';
    };
    const outputFor = (id) => panes[id]?.output || null;
    const clearOutput = (id, text = '') => {
      const output = outputFor(id);
      if (output) output.textContent = text;
    };
    const appendOutput = (id, text) => {
      const output = outputFor(id);
      if (!output) return;
      output.textContent += text;
      output.scrollTop = output.scrollHeight;
    };
    const makePane = (id, title, description, controlsHtml = '') => {
      const pane = el('article', `netutil-pane netutil-${id}`);
      pane.innerHTML = `<header><span class="netutil-orb">${id === 'portscan' ? '⌁' : id === 'info' ? 'i' : '◎'}</span><div><h2>${title}</h2><p>${description}</p></div></header>${controlsHtml}<pre class="netutil-output" tabindex="0"></pre>`;
      pane.output = pane.querySelector('.netutil-output');
      panes[id] = pane;
      return pane;
    };

    const updateWindowState = () => {
      if (!win) return;
      win.dataset.netutilTab = currentTab;
      win.dataset.netutilBusy = String(busy);
      win.dataset.netutilCanRun = String(!!panes[currentTab]?.run);
      win.dataset.netutilHasOutput = String(!!panes[currentTab]?.output?.textContent);
      root.dispatchEvent(new CustomEvent('app-command-state-changed', { bubbles:true }));
    };

    const switchTab = (id) => {
      if (!panes[id] || busy) return;
      currentTab = id;
      workspace.replaceChildren(panes[id]);
      root.querySelectorAll('[data-net-tab]').forEach((button) => button.classList.toggle('sel', button.dataset.netTab === id));
      runButton.disabled = !panes[id].run;
      copyButton.disabled = !panes[id].output?.textContent;
      toolbarStatus.textContent = panes[id].status || '就绪';
      if (win) {
        const statusbar = win.querySelector('.win-statusbar');
        if (statusbar) statusbar.textContent = panes[id].boundary || '浏览器可观测网络诊断';
      }
      updateWindowState();
    };

    // Information
    const info = makePane('info', '网络接口信息', '查看浏览器可观测的连接状态、链路类型和接口统计。');
    info.classList.add('netutil-info-pane');
    info.insertBefore(el('div', 'netutil-info-card'), info.output);
    info.output.hidden = true;
    const infoCard = info.querySelector('.netutil-info-card');
    const refreshInfo = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      const resources = performance.getEntriesByType?.('resource') || [];
      const transferred = resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      infoCard.innerHTML = `<label>请选择一个网络接口来查看信息：<select><option>en0（浏览器网络栈）</option></select></label><section><div class="netutil-interface-orb">⌁</div><dl>
        <dt>接口：</dt><dd>en0</dd><dt>硬件地址：</dt><dd>浏览器隐藏</dd>
        <dt>状态：</dt><dd class="${navigator.onLine ? 'ok' : 'warning'}">${navigator.onLine ? '活跃' : '离线'}</dd>
        <dt>连接类型：</dt><dd>${escapeText(connection.effectiveType || connection.type || '未知')}</dd>
        <dt>链路速度：</dt><dd>${connection.downlink != null ? `${connection.downlink} Mbps` : '浏览器未报告'}</dd>
        <dt>估算 RTT：</dt><dd>${connection.rtt != null ? `${connection.rtt} ms` : '浏览器未报告'}</dd>
        <dt>节省流量：</dt><dd>${connection.saveData ? '打开' : '关闭'}</dd>
        <dt>已加载资源：</dt><dd>${resources.length}</dd><dt>已传输数据：</dt><dd>${formatBytes(transferred)}</dd>
        <dt>IPv4 地址：</dt><dd>由浏览器隐私层管理</dd><dt>IPv6 地址：</dt><dd>由浏览器隐私层管理</dd>
      </dl></section><footer><button class="aqua-btn" data-info-refresh>刷新</button><button class="aqua-btn" data-public-ip>查询公共 IP…</button><span></span></footer>`;
      infoCard.querySelector('[data-info-refresh]').addEventListener('click', refreshInfo);
      infoCard.querySelector('[data-public-ip]').addEventListener('click', queryPublicIp);
      info.status = navigator.onLine ? 'en0 活跃' : 'en0 离线';
      if (currentTab === 'info') toolbarStatus.textContent = info.status;
      updateWindowState();
    };
    const queryPublicIp = async () => {
      const { id, signal } = beginOperation('正在查询公共 IP…');
      const button = infoCard.querySelector('[data-public-ip]');
      if (button) button.disabled = true;
      try {
        const response = await fetch('https://api64.ipify.org?format=json', { signal, cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        System.alertBox('公共 IP 地址', `当前浏览器网络出口：${data.ip || '未返回地址'}`);
        finishOperation(id, '公共 IP 查询完成');
      } catch (error) {
        if (error.name !== 'AbortError') {
          System.alertBox('公共 IP 地址', `查询失败：${error.message || '网络不可用'}`);
          finishOperation(id, '查询失败');
        }
      } finally {
        if (button) button.disabled = false;
      }
    };
    info.run = refreshInfo;
    info.boundary = '接口地址与硬件地址受浏览器隐私模型保护';

    // Netstat
    const netstat = makePane('netstat', 'Netstat', '显示浏览器资源连接、协议摘要和可观测的远程主机。',
      `<div class="netutil-controls"><label><input type="radio" name="netstat-mode" value="connections" checked> 显示当前网络连接</label><label><input type="radio" name="netstat-mode" value="stats"> 显示每个协议的统计信息</label><button class="aqua-btn default" data-netstat-run>Netstat</button></div>`);
    netstat.run = () => {
      const mode = netstat.querySelector('input[name="netstat-mode"]:checked')?.value || 'connections';
      const resources = performance.getEntriesByType?.('resource') || [];
      if (mode === 'stats') {
        const protocols = new Map();
        resources.forEach((entry) => {
          let protocol = 'other';
          try { protocol = new URL(entry.name).protocol.replace(':','').toUpperCase(); } catch (error) {}
          const current = protocols.get(protocol) || { requests:0, bytes:0, duration:0 };
          current.requests++;
          current.bytes += entry.transferSize || entry.encodedBodySize || 0;
          current.duration += entry.duration || 0;
          protocols.set(protocol, current);
        });
        clearOutput('netstat', `协议统计（浏览器资源计时缓冲区）\n${'协议'.padEnd(10)}${'请求'.padStart(8)}${'接收字节'.padStart(14)}${'总耗时'.padStart(12)}\n`);
        [...protocols.entries()].forEach(([protocol, value]) => appendOutput('netstat', `${protocol.padEnd(10)}${String(value.requests).padStart(8)}${formatBytes(value.bytes).padStart(14)}${`${value.duration.toFixed(0)} ms`.padStart(12)}\n`));
        if (!protocols.size) appendOutput('netstat', '尚无可观测的网络资源。\n');
      } else {
        const hosts = new Map();
        resources.forEach((entry) => {
          try {
            const url = new URL(entry.name);
            const key = `${url.protocol}//${url.host}`;
            const current = hosts.get(key) || { count:0, bytes:0, last:0, protocol:entry.nextHopProtocol || url.protocol.replace(':','') };
            current.count++;
            current.bytes += entry.transferSize || entry.encodedBodySize || 0;
            current.last = Math.max(current.last, entry.responseEnd || 0);
            hosts.set(key, current);
          } catch (error) {}
        });
        clearOutput('netstat', `活动的 Internet 连接（浏览器资源）\n${'协议'.padEnd(10)}${'远程地址'.padEnd(38)}${'请求'.padStart(7)}${'接收'.padStart(12)}\n`);
        [...hosts.entries()].sort((left,right) => right[1].last - left[1].last).forEach(([host,value]) =>
          appendOutput('netstat', `${String(value.protocol).padEnd(10)}${host.slice(0,37).padEnd(38)}${String(value.count).padStart(7)}${formatBytes(value.bytes).padStart(12)}\n`));
        if (!hosts.size) appendOutput('netstat', '尚无可观测的活动连接。\n');
      }
      netstat.status = `${resources.length} 个资源记录`;
      toolbarStatus.textContent = netstat.status;
      copyButton.disabled = false;
      updateWindowState();
    };
    netstat.querySelector('[data-netstat-run]').addEventListener('click', netstat.run);
    netstat.boundary = 'Netstat 基于 Resource Timing，不读取内核套接字表';

    // AppleTalk
    const appletalk = makePane('appletalk', 'AppleTalk', '查看经典 Mac 网络区域与节点状态。',
      `<div class="netutil-appletalk-card"><span></span><div><h3>AppleTalk 未激活</h3><p>现代浏览器不提供 AppleTalk/DDP 协议栈。此页保留 Leopard 工具的布局与状态说明。</p><dl><dt>默认区域：</dt><dd>*</dd><dt>节点：</dt><dd>Leopard Web</dd><dt>接口：</dt><dd>无可用 AppleTalk 接口</dd></dl></div></div>`);
    appletalk.output.hidden = true;
    appletalk.run = null;
    appletalk.boundary = 'AppleTalk 协议无法从浏览器访问';

    // Ping
    const ping = makePane('ping', 'Ping', '通过无缓存 HTTP 请求测量目标主机的真实浏览器往返时间。',
      `<div class="netutil-form"><label><span>请输入要 Ping 的网络地址：</span><input class="aqua-input" data-ping-host value="example.com"></label><label><span>只发送：</span><select data-ping-count><option value="4">4 个 Ping</option><option value="10">10 个 Ping</option><option value="0">连续 Ping</option></select></label><button class="aqua-btn default" data-ping-run>Ping</button></div>`);
    ping.run = async () => {
      const host = normalizedHost(ping.querySelector('[data-ping-host]').value);
      if (!host) return System.alertBox('Ping', '请输入有效的主机名或 IP 地址。');
      const limit = Number(ping.querySelector('[data-ping-count]').value);
      const total = limit || 1000;
      const { id, signal } = beginOperation(`正在 Ping ${host}…`);
      clearOutput('ping', `PING ${host}：通过 fetch(no-cors) 测量 HTTP 可达性\n`);
      const times = [];
      let sent = 0;
      try {
        for (let sequence = 0; sequence < total; sequence++) {
          if (id !== operationId) return;
          sent++;
          const started = performance.now();
          try {
            await fetch(`https://${host}/?network-utility-ping=${Date.now()}-${sequence}`, {
              mode:'no-cors', cache:'no-store', signal,
            });
            const elapsed = performance.now() - started;
            times.push(elapsed);
            appendOutput('ping', `来自 ${host} 的 HTTP 响应：seq=${sequence} time=${elapsed.toFixed(1)} ms\n`);
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            appendOutput('ping', `请求超时：seq=${sequence}（目标不可达或浏览器策略阻止）\n`);
          }
          await wait(350, signal);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
      if (id !== operationId) return;
      const received = times.length;
      appendOutput('ping', `\n--- ${host} HTTP Ping 统计 ---\n${sent} 个请求已发送，${received} 个收到，${sent ? ((sent-received)/sent*100).toFixed(1) : 0}% 丢失\n`);
      if (received) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const average = times.reduce((sum,value) => sum + value,0) / received;
        appendOutput('ping', `往返 min/avg/max = ${min.toFixed(1)}/${average.toFixed(1)}/${max.toFixed(1)} ms\n`);
      }
      finishOperation(id, `Ping 完成：${received}/${sent}`);
      copyButton.disabled = false;
    };
    ping.querySelector('[data-ping-run]').addEventListener('click', ping.run);
    ping.boundary = '浏览器不能发送 ICMP；Ping 使用真实 HTTP 往返计时';

    // DNS Lookup
    const lookup = makePane('lookup', 'Lookup', '通过 DNS-over-HTTPS 查询公开 DNS 记录。',
      `<div class="netutil-form"><label><span>请输入 Internet 地址：</span><input class="aqua-input" data-lookup-host value="apple.com"></label><label><span>查询类型：</span><select data-lookup-type>${RECORD_TYPES.map((type) => `<option>${type}</option>`).join('')}</select></label><button class="aqua-btn default" data-lookup-run>Lookup</button></div>`);
    lookup.run = async () => {
      const host = normalizedHost(lookup.querySelector('[data-lookup-host]').value);
      const type = lookup.querySelector('[data-lookup-type]').value;
      if (!host) return System.alertBox('Lookup', '请输入有效的 Internet 地址。');
      const { id, signal } = beginOperation(`正在查询 ${host}…`);
      clearOutput('lookup', `正在通过 DNS-over-HTTPS 查询 ${host} 的 ${type} 记录…\n\n`);
      try {
        const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${encodeURIComponent(type)}`, { signal, cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        appendOutput('lookup', `服务器：dns.google\n状态：${data.Status === 0 ? 'NOERROR' : data.Status}\n\n`);
        (data.Answer || []).forEach((answer) =>
          appendOutput('lookup', `${answer.name}\t${answer.TTL}\tIN\t${type}\t${answer.data}\n`));
        if (!data.Answer?.length) appendOutput('lookup', `没有找到 ${type} 记录。\n`);
        finishOperation(id, `Lookup 完成：${data.Answer?.length || 0} 条记录`);
        copyButton.disabled = false;
      } catch (error) {
        if (error.name === 'AbortError') return;
        appendOutput('lookup', `查询失败：${error.message || '网络不可用'}\n`);
        finishOperation(id, 'Lookup 失败');
      }
    };
    lookup.querySelector('[data-lookup-run]').addEventListener('click', lookup.run);
    lookup.boundary = 'DNS 查询使用 dns.google 的公开 DoH 服务';

    // Traceroute
    const trace = makePane('trace', 'Traceroute', '测量目标 HTTP 往返，并以明确标注的方式重建可解释路径。',
      `<div class="netutil-form compact"><label><span>请输入要追踪其路由的网络地址：</span><input class="aqua-input" data-trace-host value="apple.com"></label><button class="aqua-btn default" data-trace-run>Trace</button></div>`);
    trace.run = async () => {
      const host = normalizedHost(trace.querySelector('[data-trace-host]').value);
      if (!host) return System.alertBox('Traceroute', '请输入有效的主机名或 IP 地址。');
      const { id, signal } = beginOperation(`正在追踪 ${host}…`);
      clearOutput('trace', `traceroute 到 ${host}\n浏览器不能设置 IP TTL；中间跃点为明确标注的解释模型，末端往返为真实 HTTP 测量。\n\n`);
      let roundTrip = Number(navigator.connection?.rtt) || 80;
      try {
        const started = performance.now();
        await fetch(`https://${host}/?network-utility-trace=${Date.now()}`, { mode:'no-cors', cache:'no-store', signal });
        roundTrip = performance.now() - started;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
      const firstHop = Math.max(1, Math.min(8, Number(navigator.connection?.rtt || 4) * .08));
      const hops = [
        ['192.168.1.1','本地网关（解释）',firstHop],
        ['10.0.0.1','接入网络（解释）',Math.max(firstHop+2,roundTrip*.18)],
        ['骨干路由器','运营商骨干（解释）',Math.max(firstHop+5,roundTrip*.42)],
        ['边缘节点','目标边缘网络（解释）',Math.max(firstHop+8,roundTrip*.72)],
        [host,'目标 HTTP 端点（实测）',roundTrip],
      ];
      try {
        for (let index = 0; index < hops.length; index++) {
          await wait(230, signal);
          const [address,label,latency] = hops[index];
          appendOutput('trace', `${String(index+1).padStart(2)}  ${String(address).padEnd(24)} ${latency.toFixed(1).padStart(8)} ms  ${label}\n`);
        }
        finishOperation(id, `Traceroute 完成：${roundTrip.toFixed(1)} ms`);
        copyButton.disabled = false;
      } catch (error) {}
    };
    trace.querySelector('[data-trace-run]').addEventListener('click', trace.run);
    trace.boundary = '浏览器不开放 TTL/ICMP；末端 HTTP 计时真实，中间跃点为解释模型';

    // Whois via RDAP
    const whois = makePane('whois', 'Whois', '通过标准 RDAP 服务查询域名注册资料。',
      `<div class="netutil-form compact"><label><span>请输入域名：</span><input class="aqua-input" data-whois-host value="apple.com"></label><button class="aqua-btn default" data-whois-run>Whois</button></div>`);
    whois.run = async () => {
      const host = normalizedHost(whois.querySelector('[data-whois-host]').value);
      if (!host || !host.includes('.')) return System.alertBox('Whois', '请输入有效的公开域名。');
      const { id, signal } = beginOperation(`正在查询 ${host}…`);
      clearOutput('whois', `正在通过 RDAP 查询 ${host}…\n\n`);
      try {
        const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, { signal, headers:{ Accept:'application/rdap+json, application/json' } });
        if (!response.ok) throw new Error(`RDAP 返回 HTTP ${response.status}`);
        const data = await response.json();
        const event = (name) => data.events?.find((item) => item.eventAction === name)?.eventDate || '—';
        const registrar = data.entities?.find((entity) => entity.roles?.includes('registrar'));
        const registrarName = registrar?.vcardArray?.[1]?.find((item) => item[0] === 'fn')?.[3] || registrar?.handle || '—';
        appendOutput('whois', `Domain Name: ${data.ldhName || data.unicodeName || host}\n`);
        appendOutput('whois', `Registry Domain ID: ${data.handle || '—'}\nRegistrar: ${registrarName}\n`);
        appendOutput('whois', `Created: ${event('registration')}\nUpdated: ${event('last changed')}\nExpires: ${event('expiration')}\n`);
        appendOutput('whois', `Status: ${(data.status || []).join(', ') || '—'}\n`);
        appendOutput('whois', `Name Servers:\n${(data.nameservers || []).map((server) => `  ${server.ldhName || server.unicodeName}`).join('\n') || '  —'}\n`);
        finishOperation(id, 'Whois/RDAP 查询完成');
        copyButton.disabled = false;
      } catch (error) {
        if (error.name === 'AbortError') return;
        appendOutput('whois', `查询失败：${error.message || '服务不可用'}\n`);
        finishOperation(id, 'Whois 查询失败');
      }
    };
    whois.querySelector('[data-whois-run]').addEventListener('click', whois.run);
    whois.boundary = 'Whois 使用标准 HTTPS RDAP；不开放 TCP 43';

    // Finger
    const finger = makePane('finger', 'Finger', '查询 Leopard Web 本机虚拟用户目录。',
      `<div class="netutil-form compact"><label><span>请输入用户名：</span><input class="aqua-input" data-finger-user value="roll"></label><button class="aqua-btn default" data-finger-run>Finger</button></div>`);
    finger.run = () => {
      const value = finger.querySelector('[data-finger-user]').value.trim().replace(/@.*$/,'');
      const users = {
        roll:{ name:'roll', fullName:'Roll', home:'/用户/roll', shell:'/bin/bash', status:'已登录' },
        root:{ name:'root', fullName:'System Administrator', home:'/var/root', shell:'/bin/sh', status:'未登录' },
        guest:{ name:'guest', fullName:'Guest User', home:'/用户/Guest', shell:'/bin/bash', status:'已停用' },
      };
      const user = users[value.toLocaleLowerCase('en-US')];
      clearOutput('finger');
      if (!user) appendOutput('finger', `finger: ${value}: 没有这个本机虚拟用户。\n`);
      else {
        let projects = 0;
        try { projects = VFS.walk(user.home).filter((path) => VFS.get(path)?.type !== 'dir').length; } catch (error) {}
        appendOutput('finger', `Login: ${user.name.padEnd(18)} Name: ${user.fullName}\nDirectory: ${user.home.padEnd(28)} Shell: ${user.shell}\n`);
        appendOutput('finger', `On since: ${user.name === 'roll' ? new Date(System.bootTime).toLocaleString('zh-CN') : '—'}\nStatus: ${user.status}\n`);
        appendOutput('finger', `Virtual files: ${projects}\nPlan: 在 Leopard Web 上工作。\n`);
      }
      finger.status = user ? `找到用户 ${user.name}` : '未找到用户';
      toolbarStatus.textContent = finger.status;
      copyButton.disabled = false;
      updateWindowState();
    };
    finger.querySelector('[data-finger-run]').addEventListener('click', finger.run);
    finger.boundary = '浏览器不能连接 Finger TCP 79；此页查询虚拟本机用户目录';

    // Port Scan
    const portscan = makePane('portscan', '端口扫描', '在用户明确开始后，以浏览器 HTTP/HTTPS 请求探测最多 32 个端口。',
      `<div class="netutil-form portscan"><label><span>请输入 Internet 或 IP 地址：</span><input class="aqua-input" data-port-host value="example.com"></label><label><span>扫描端口范围：</span><div><input class="aqua-input" type="number" min="1" max="65535" data-port-start value="80"><b>至</b><input class="aqua-input" type="number" min="1" max="65535" data-port-end value="81"></div></label><button class="aqua-btn default" data-port-run>扫描</button></div>`);
    const probePort = async (host, port, parentSignal) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1400);
      const onAbort = () => controller.abort();
      parentSignal.addEventListener('abort', onAbort, { once:true });
      const securePorts = new Set([443,4443,8443,9443]);
      const scheme = securePorts.has(port) ? 'https' : 'http';
      const started = performance.now();
      try {
        await fetch(`${scheme}://${host}:${port}/?network-utility-port-scan=${Date.now()}`, {
          mode:'no-cors', cache:'no-store', signal:controller.signal,
        });
        return { port, open:true, elapsed:performance.now()-started, scheme };
      } catch (error) {
        return { port, open:false, elapsed:performance.now()-started, scheme, aborted:parentSignal.aborted };
      } finally {
        clearTimeout(timeout);
        parentSignal.removeEventListener('abort', onAbort);
      }
    };
    portscan.run = async () => {
      const host = normalizedHost(portscan.querySelector('[data-port-host]').value);
      const start = Number(portscan.querySelector('[data-port-start]').value);
      const end = Number(portscan.querySelector('[data-port-end]').value);
      if (!host) return System.alertBox('端口扫描', '请输入有效的主机名或 IP 地址。');
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 65535 || start > end) return System.alertBox('端口扫描', '请输入 1 至 65535 之间的有效端口范围。');
      if (end - start + 1 > 32) return System.alertBox('端口扫描', '为避免对目标造成过多请求，每次最多扫描 32 个端口。');
      const { id, signal } = beginOperation(`正在扫描 ${host}…`);
      clearOutput('portscan', `端口扫描已开始：${host}，端口 ${start}-${end}\n只有浏览器允许的 HTTP/HTTPS 服务可被确认；“无响应”不等于端口一定关闭。\n\n`);
      const ports = Array.from({ length:end-start+1 }, (_,index) => start+index);
      let openCount = 0;
      for (let offset = 0; offset < ports.length; offset += 4) {
        const results = await Promise.all(ports.slice(offset,offset+4).map((port) => probePort(host,port,signal)));
        if (id !== operationId || signal.aborted) return;
        results.forEach((result) => {
          if (result.open) openCount++;
          appendOutput('portscan', `${String(result.port).padStart(5)}/${result.scheme.padEnd(5)} ${result.open ? '可达' : '无响应或受浏览器限制'}${result.open ? `  ${result.elapsed.toFixed(1)} ms` : ''}\n`);
        });
      }
      appendOutput('portscan', `\n扫描完成：${ports.length} 个端口，${openCount} 个浏览器可达端点。\n`);
      finishOperation(id, `端口扫描完成：${openCount}/${ports.length}`);
      copyButton.disabled = false;
    };
    portscan.querySelector('[data-port-run]').addEventListener('click', portscan.run);
    portscan.boundary = '仅在明确点击后发起最多 32 个 HTTP/HTTPS 探测；结果不是原始 TCP SYN 扫描';

    const runCurrent = () => {
      if (!busy) panes[currentTab]?.run?.();
    };
    const copyOutput = async () => {
      const text = panes[currentTab]?.output?.textContent || '';
      if (!text) return System.beep();
      try {
        await navigator.clipboard.writeText(text);
        Leopard.toast('网络实用工具', '结果已拷贝。');
      } catch (error) {
        System.beep();
      }
    };

    const actions = {
      'run-current':runCurrent,
      'stop-operation':stopOperation,
      'copy-output':copyOutput,
      'refresh-info':refreshInfo,
      'show-info':() => switchTab('info'),
      'show-netstat':() => switchTab('netstat'),
      'show-appletalk':() => switchTab('appletalk'),
      'show-ping':() => switchTab('ping'),
      'show-lookup':() => switchTab('lookup'),
      'show-traceroute':() => switchTab('trace'),
      'show-whois':() => switchTab('whois'),
      'show-finger':() => switchTab('finger'),
      'show-portscan':() => switchTab('portscan'),
    };

    win = System.createWindow({
      app:'netutil', title:'网络实用工具', width:810, height:570,
      toolbar, content:root, statusbar:'浏览器可观测网络诊断',
      onClose:() => {
        operationId++;
        abortController?.abort();
        removeEventListener('online', refreshInfo);
        removeEventListener('offline', refreshInfo);
        return true;
      },
    });

    root.querySelector('.netutil-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-net-tab]');
      if (button) switchTab(button.dataset.netTab);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && event.target.matches('input')) {
        event.preventDefault();
        runCurrent();
      }
    });
    runButton.addEventListener('click', runCurrent);
    stopButton.addEventListener('click', stopOperation);
    copyButton.addEventListener('click', copyOutput);
    win.addEventListener('leopard-command', (event) => {
      const action = actions[event.detail?.command];
      if (action) {
        event.preventDefault();
        action();
      }
    });
    addEventListener('online', refreshInfo);
    addEventListener('offline', refreshInfo);

    refreshInfo();
    netstat.run();
    clearOutput('netstat');
    switchTab('info');
    return win;
  }

  System.registerApp({
    id:'netutil', name:'网络实用工具', icon, open,
    about:'提供信息、Netstat、AppleTalk、HTTP Ping、DNS Lookup、Traceroute、RDAP Whois、Finger 和受限端口扫描。',
    keywords:'network ping dns 网络 lookup traceroute whois finger port scan netstat',
  });
})();
