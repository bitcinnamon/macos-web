import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths, HOME_USER, HOME_DISPLAY_NAME } from '../config.js';
import { t } from '../i18n/index.js';

// 网络${t('app.net2.c7878a725734')} (Network Utility) — browser-observable diagnostics
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><radialGradient id="nug" cx=".4" cy=".35"><stop offset="0" stop-color="#b8e0f8"/><stop offset="1" stop-color="#2f6faf"/></radialGradient></defs><circle cx="32" cy="32" r="25" fill="url(#nug)" stroke="#1a4a80" stroke-width="1.5"/><g stroke="#dff0fc" stroke-width="1.5" fill="none"><ellipse cx="32" cy="32" rx="25" ry="10"/><ellipse cx="32" cy="32" rx="10" ry="25"/><line x1="7" y1="32" x2="57" y2="32"/></g></svg>`;
  const TAB_DEFINITIONS = [
    ['info',t('app.net2.d99af5ab459a')], ['netstat','Netstat'], ['appletalk','AppleTalk'], ['ping','Ping'],
    ['lookup','Lookup'], ['trace','Traceroute'], ['whois','Whois'], ['finger','Finger'], ['portscan',t('ui.355922e844ea')],
  ];
  const RECORD_TYPES = ['A','AAAA','CNAME','MX','NS','TXT','SOA'];
  const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException(t('ui.f2878ae6e3ac'), 'AbortError'));
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
    const runButton = el('button', 'finder-toolbar-btn', t('app.net2.7b5c566f695f'));
    const stopButton = el('button', 'finder-toolbar-btn', t('ui.7138fba53475'));
    const copyButton = el('button', 'finder-toolbar-btn', t('ui.e72b3b6fd32c'));
    const toolbarSpacer = el('i');
    const toolbarStatus = el('span', 'netutil-toolbar-status', t('ui.b796f2d4ca85'));
    stopButton.disabled = true;
    toolbar.append(runButton, stopButton, copyButton, toolbarSpacer, toolbarStatus);

    const root = el('div', 'netutil-app');
    root.innerHTML = `<nav class="netutil-tabs" aria-label="${t('app.net2.1c62466fd693')}">${TAB_DEFINITIONS.map(([id,label]) => `<button data-net-tab="${id}">${label}</button>`).join('')}</nav><section class="netutil-workspace"></section>`;
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
      toolbarStatus.textContent = label || (value ? t('app.net2.6c5c8be7f8d8') : t('ui.b796f2d4ca85'));
      updateWindowState();
    };
    const beginOperation = (label) => {
      if (busy) stopOperation();
      abortController = new AbortController();
      const id = ++operationId;
      setBusy(true, label);
      return { id, signal:abortController.signal };
    };
    const finishOperation = (id, label = t('ui.33246f6a5e5b')) => {
      if (id !== operationId) return;
      abortController = null;
      setBusy(false, label);
    };
    const stopOperation = () => {
      if (!busy) return;
      operationId++;
      abortController?.abort();
      abortController = null;
      setBusy(false, t('ui.364a892073a0'));
      const output = panes[currentTab]?.output;
      if (output) output.textContent += t('app.net2.8939802fe6ca');
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
      toolbarStatus.textContent = panes[id].status || t('ui.b796f2d4ca85');
      if (win) {
        const statusbar = win.querySelector('.win-statusbar');
        if (statusbar) statusbar.textContent = panes[id].boundary || t('ui.7e615d7095b9');
      }
      updateWindowState();
    };

    // Information
    const info = makePane('info', t('ui.eb27664b98f9'), t('ui.9d4a4a9bf206'));
    info.classList.add('netutil-info-pane');
    info.insertBefore(el('div', 'netutil-info-card'), info.output);
    info.output.hidden = true;
    const infoCard = info.querySelector('.netutil-info-card');
    const refreshInfo = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      const resources = performance.getEntriesByType?.('resource') || [];
      const transferred = resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      infoCard.innerHTML = `<label>${t('app.net2.7b486e1c36de')}<select><option>${t('app.net2.0ca1bbb535d1')}</option></select></label><section><div class="netutil-interface-orb">⌁</div><dl>
        <dt>${t('app.net2.fe8edb7b583b')}</dt><dd>en0</dd><dt>${t('app.net2.69b7770d291f')}</dt><dd>${t('app.net3.73e601718bbd')}</dd>
        <dt>${t('app.net3.633c5b2063aa')}</dt><dd class="${navigator.onLine ? 'ok' : 'warning'}">${navigator.onLine ? t('app.net2.b4c048d9366b') : t('ui.211357d22f4d')}</dd>
        <dt>${t('app.net3.2cc11920ccf2')}</dt><dd>${escapeText(connection.effectiveType || connection.type || t('ui.d9c32a4c3dda'))}</dd>
        <dt>${t('app.net3.7923f925a755')}</dt><dd>${connection.downlink != null ? `${connection.downlink} Mbps` : t('app.net2.9cc9a5aeed79')}</dd>
        <dt>${t('app.net3.211942590e4b')}</dt><dd>${connection.rtt != null ? `${connection.rtt} ms` : t('app.net2.9cc9a5aeed79')}</dd>
        <dt>${t('app.net3.49331af5a0fa')}</dt><dd>${connection.saveData ? t('ui.65fc81e16119') : t('ui.6c14bd7f6f9e')}</dd>
        <dt>${t('app.net3.a820fc567c58')}</dt><dd>${resources.length}</dd><dt>${t('app.net3.10e4c7e557c6')}</dt><dd>${formatBytes(transferred)}</dd>
        <dt>IPv4 ${t('app.net3.95ad9b5d0723')}：</dt><dd>${t('app.net2.45bab5907564')}</dd><dt>IPv6 ${t('app.net3.95ad9b5d0723')}：</dt><dd>${t('app.net2.45bab5907564')}</dd>
      </dl></section><footer><button class="aqua-btn" data-info-refresh>${t('app.net2.9b49f6e173fd')}</button><button class="aqua-btn" data-public-ip>${t('app.net3.c95644070eef')}</button><span></span></footer>`;
      infoCard.querySelector('[data-info-refresh]').addEventListener('click', refreshInfo);
      infoCard.querySelector('[data-public-ip]').addEventListener('click', queryPublicIp);
      info.status = navigator.onLine ? t('ui.dc6fab0c189a') : t('ui.1fa452da6274');
      if (currentTab === 'info') toolbarStatus.textContent = info.status;
      updateWindowState();
    };
    const queryPublicIp = async () => {
      const { id, signal } = beginOperation(t('ui.47eb640221d0'));
      const button = infoCard.querySelector('[data-public-ip]');
      if (button) button.disabled = true;
      try {
        const response = await fetch('https://api64.ipify.org?format=json', { signal, cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        System.alertBox(t('ui.b8960b3717c0'), t('app.net.publicIpBox', { ip: data.ip || t('ui.395661335908') }));
        finishOperation(id, t('ui.d203afcc8157'));
      } catch (error) {
        if (error.name !== 'AbortError') {
          System.alertBox(t('ui.b8960b3717c0'), `${t('app.net2.7fa43b1b9167')}：${error.message || t('ui.f1b1586c08dd')}`);
          finishOperation(id, t('app.net2.7fa43b1b9167'));
        }
      } finally {
        if (button) button.disabled = false;
      }
    };
    info.run = refreshInfo;
    info.boundary = t('ui.b409cfb60e2a');

    // Netstat
    const netstat = makePane('netstat', 'Netstat', t('ui.6f85d5f67b3d'),
      `<div class="netutil-controls"><label><input type="radio" name="netstat-mode" value="connections" checked> ${t('app.net2.411391d2a50f')}</label><label><input type="radio" name="netstat-mode" value="stats"> ${t('app.net2.7ecb19f2e070')}</label><button class="aqua-btn default" data-netstat-run>Netstat</button></div>`);
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
        clearOutput('netstat', t('app.net.netstatHdr') + `${t('app.net2.53d49afd0f9f').padEnd(10)}${t('app.net2.4f0e7e6716c7').padStart(8)}${t('ui.8813f622368b').padStart(14)}${t('app.net2.9338cc8608b7').padStart(12)}\n`);
        [...protocols.entries()].forEach(([protocol, value]) => appendOutput('netstat', `${protocol.padEnd(10)}${String(value.requests).padStart(8)}${formatBytes(value.bytes).padStart(14)}${`${value.duration.toFixed(0)} ms`.padStart(12)}\n`));
        if (!protocols.size) appendOutput('netstat', t('app.net2.d4166f0c4089'));
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
        clearOutput('netstat', `${t('app.net.activeHdr')}${t('app.net2.53d49afd0f9f').padEnd(10)}${t('app.net2.630aa014412a').padEnd(38)}${t('app.net2.4f0e7e6716c7').padStart(7)}${t('ui.de7b4c9eebf8').padStart(12)}\n`);
        [...hosts.entries()].sort((left,right) => right[1].last - left[1].last).forEach(([host,value]) =>
          appendOutput('netstat', `${String(value.protocol).padEnd(10)}${host.slice(0,37).padEnd(38)}${String(value.count).padStart(7)}${formatBytes(value.bytes).padStart(12)}\n`));
        if (!hosts.size) appendOutput('netstat', t('app.net2.05289730138e'));
      }
      netstat.status = `t('app.net.resListed', { n: resources.length })`;
      toolbarStatus.textContent = netstat.status;
      copyButton.disabled = false;
      updateWindowState();
    };
    netstat.querySelector('[data-netstat-run]').addEventListener('click', netstat.run);
    netstat.boundary = t('ui.41014d73df6a');

    // AppleTalk
    const appletalk = makePane('appletalk', 'AppleTalk', t('ui.074522069b21'),
      `<div class="netutil-appletalk-card"><span></span><div><h3>${t('app.net.appletalkTitle')}</h3><p>${t('app.net.appletalkBody')}</p><dl><dt>${t('app.net3.c07417d8f769')}</dt><dd>*</dd><dt>${t('app.net3.3131e85710a3')}</dt><dd>Leopard Web</dd><dt>${t('app.net2.fe8edb7b583b')}</dt><dd>No AppleTalk stack available</dd></dl></div></div>`);
    appletalk.output.hidden = true;
    appletalk.run = null;
    appletalk.boundary = t('ui.a6b68245da64');

    // Ping
    const ping = makePane('ping', 'Ping', t('ui.d8550b291008'),
      `<div class="netutil-form"><label><span>${t('app.net2.87e2047d879d')}</span><input class="aqua-input" data-ping-host value="example.com"></label><label><span>${t('app.net2.63f4105d085e')}</span><select data-ping-count><option value="4">${t('app.net2.c2d3ad6f5278')}</option><option value="10">${t('app.net2.2e0c2189e025')}</option><option value="0">${t('app.net2.6254ea54f200')}</option></select></label><button class="aqua-btn default" data-ping-run>Ping</button></div>`);
    ping.run = async () => {
      const host = normalizedHost(ping.querySelector('[data-ping-host]').value);
      if (!host) return System.alertBox('Ping', t('ui.18c1d6018283'));
      const limit = Number(ping.querySelector('[data-ping-count]').value);
      const total = limit || 1000;
      const { id, signal } = beginOperation(t('app.net.pinging', { host }));
      clearOutput('ping', t('app.net.pingHdr', { host }));
      const times = [];
      let sent = 0;
      try {
        for (let sequence = 0; sequence < total; sequence++) {
          if (id !== operationId) return;
          sent++;
          const started = performance.now();
          try {
            await fetch(`https://${host}/?network-utility-ping=${Date.now()}-${sequence}`, {
              mode:'no-cors', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', signal,
            });
            const elapsed = performance.now() - started;
            times.push(elapsed);
            appendOutput('ping', t('app.net.pingReply', { host, seq: sequence, ms: elapsed.toFixed(1) }));
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            appendOutput('ping', t('app.net.pingTimeout', { seq: sequence }));
          }
          await wait(350, signal);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
      if (id !== operationId) return;
      const received = times.length;
      appendOutput('ping', t('app.net.pingStats', { host, sent, received, loss: sent ? ((sent-received)/sent*100).toFixed(1) : 0 }));
      if (received) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const average = times.reduce((sum,value) => sum + value,0) / received;
        appendOutput('ping', t('app.net.rtt', { min: min.toFixed(1), avg: average.toFixed(1), max: max.toFixed(1) }));
      }
      finishOperation(id, `Ping complete: ${received}/${sent}`);
      copyButton.disabled = false;
    };
    ping.querySelector('[data-ping-run]').addEventListener('click', ping.run);
    ping.boundary = t('ui.064ca5580b6e');

    // DNS Lookup
    const lookup = makePane('lookup', 'Lookup', t('ui.3b8d5f6885bc'),
      `<div class="netutil-form"><label><span>${t('app.net2.0eb38196e0d7')}</span><input class="aqua-input" data-lookup-host value="apple.com"></label><label><span>${t('app.net3.b206e7fc5768')}</span><select data-lookup-type>${RECORD_TYPES.map((type) => `<option>${type}</option>`).join('')}</select></label><button class="aqua-btn default" data-lookup-run>Lookup</button></div>`);
    lookup.run = async () => {
      const host = normalizedHost(lookup.querySelector('[data-lookup-host]').value);
      const type = lookup.querySelector('[data-lookup-type]').value;
      if (!host) return System.alertBox('Lookup', t('ui.442fbf8a5813'));
      const { id, signal } = beginOperation(`${t('app.net3.ea02e910eb59')} ${host}…`);
      clearOutput('lookup', t('app.net.lookup', { host, type }));
      try {
        const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${encodeURIComponent(type)}`, { signal, cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        appendOutput('lookup', `${t('app.net.serverLine', { status: data.Status === 0 ? 'NOERROR' : data.Status })}`);
        (data.Answer || []).forEach((answer) =>
          appendOutput('lookup', `${answer.name}\t${answer.TTL}\tIN\t${type}\t${answer.data}\n`));
        if (!data.Answer?.length) appendOutput('lookup', `${t('app.net.noRec', { type })}`);
        finishOperation(id, `t('app.net.lookupDone', { n: data.Answer?.length || 0 })`);
        copyButton.disabled = false;
      } catch (error) {
        if (error.name === 'AbortError') return;
        appendOutput('lookup', `${t('app.net.queryFail', { msg: error.message || t('ui.f1b1586c08dd') })}`);
        finishOperation(id, t('ui.5cb0974da089'));
      }
    };
    lookup.querySelector('[data-lookup-run]').addEventListener('click', lookup.run);
    lookup.boundary = t('ui.a4c4844ee058');

    // Traceroute
    const trace = makePane('trace', 'Traceroute', t('ui.10ee4275c7cf'),
      `<div class="netutil-form compact"><label><span>${t('app.net2.42099fa767df')}</span><input class="aqua-input" data-trace-host value="apple.com"></label><button class="aqua-btn default" data-trace-run>Trace</button></div>`);
    trace.run = async () => {
      const host = normalizedHost(trace.querySelector('[data-trace-host]').value);
      if (!host) return System.alertBox('Traceroute', t('ui.18c1d6018283'));
      const { id, signal } = beginOperation(`${t('app.net.tracing', { host })}`);
      clearOutput('trace', `${t('app.net.traceHdr', { host })}`);
      let roundTrip = Number(navigator.connection?.rtt) || 80;
      try {
        const started = performance.now();
        await fetch(`https://${host}/?network-utility-trace=${Date.now()}`, {
          mode:'no-cors', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', signal,
        });
        roundTrip = performance.now() - started;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
      const firstHop = Math.max(1, Math.min(8, Number(navigator.connection?.rtt || 4) * .08));
      const hops = [
        ['192.168.1.1',t('ui.b631f34c9c2f'),firstHop],
        ['10.0.0.1',t('ui.1ca6fed5ba33'),Math.max(firstHop+2,roundTrip*.18)],
        [t('app.net2.c385692e477d'),t('ui.ac9cfa3b70c2'),Math.max(firstHop+5,roundTrip*.42)],
        [t('app.net2.b5f4c5ef07f7'),t('ui.07671a630533'),Math.max(firstHop+8,roundTrip*.72)],
        [host,t('ui.15a0dfe4eeb2'),roundTrip],
      ];
      try {
        for (let index = 0; index < hops.length; index++) {
          await wait(230, signal);
          const [address,label,latency] = hops[index];
          appendOutput('trace', `${String(index+1).padStart(2)}  ${String(address).padEnd(24)} ${latency.toFixed(1).padStart(8)} ms  ${label}\n`);
        }
        finishOperation(id, `Traceroute ${t('app.net3.aafde1f6f4b6')}：${roundTrip.toFixed(1)} ms`);
        copyButton.disabled = false;
      } catch (error) {}
    };
    trace.querySelector('[data-trace-run]').addEventListener('click', trace.run);
    trace.boundary = t('ui.7d2ef9cbbd41');

    // Whois via RDAP
    const whois = makePane('whois', 'Whois', t('ui.001c85edcdd2'),
      `<div class="netutil-form compact"><label><span>${t('app.net2.0a2fe129de4f')}</span><input class="aqua-input" data-whois-host value="apple.com"></label><button class="aqua-btn default" data-whois-run>Whois</button></div>`);
    whois.run = async () => {
      const host = normalizedHost(whois.querySelector('[data-whois-host]').value);
      if (!host || !host.includes('.')) return System.alertBox('Whois', t('app.net2.47005273265e'));
      const { id, signal } = beginOperation(`${t('app.net3.ea02e910eb59')} ${host}…`);
      clearOutput('whois', `${t('app.net.whoisQ', { host })}`);
      try {
        const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, { signal, headers:{ Accept:'application/rdap+json, application/json' } });
        if (!response.ok) throw new Error(`t('app.net.rdapHttp', { status: response.status })`);
        const data = await response.json();
        const event = (name) => data.events?.find((item) => item.eventAction === name)?.eventDate || '—';
        const registrar = data.entities?.find((entity) => entity.roles?.includes('registrar'));
        const registrarName = registrar?.vcardArray?.[1]?.find((item) => item[0] === 'fn')?.[3] || registrar?.handle || '—';
        appendOutput('whois', `Domain Name: ${data.ldhName || data.unicodeName || host}\n`);
        appendOutput('whois', `Registry Domain ID: ${data.handle || '—'}\nRegistrar: ${registrarName}\n`);
        appendOutput('whois', `Created: ${event('registration')}\nUpdated: ${event('last changed')}\nExpires: ${event('expiration')}\n`);
        appendOutput('whois', `Status: ${(data.status || []).join(', ') || '—'}\n`);
        appendOutput('whois', `Name Servers:\n${(data.nameservers || []).map((server) => `  ${server.ldhName || server.unicodeName}`).join('\n') || '  —'}\n`);
        finishOperation(id, t('ui.f78a8bfe9fba'));
        copyButton.disabled = false;
      } catch (error) {
        if (error.name === 'AbortError') return;
        appendOutput('whois', `${t('app.net.queryFail', { msg: error.message || t('ui.e3718e23f8d5') })}`);
        finishOperation(id, t('ui.e4662d677260'));
      }
    };
    whois.querySelector('[data-whois-run]').addEventListener('click', whois.run);
    whois.boundary = t('ui.c92aaf41554b');

    // Finger
    const finger = makePane('finger', 'Finger', t('ui.1b4946c2bfcf'),
      `<div class="netutil-form compact"><label><span>${t('app.net2.fa49cebb6b57')}</span><input class="aqua-input" data-finger-user value="roll"></label><button class="aqua-btn default" data-finger-run>Finger</button></div>`);
    finger.run = () => {
      const value = finger.querySelector('[data-finger-user]').value.trim().replace(/@.*$/,'');
      const users = {
        [HOME_USER]:{ name:HOME_USER, fullName:HOME_DISPLAY_NAME, home:paths.home, shell:'/bin/bash', status:t('app.net2.01a4adb930af') },
        root:{ name:'root', fullName:'System Administrator', home:'/var/root', shell:'/bin/sh', status:t('app.net2.335e0ea211d4') },
        guest:{ name:'guest', fullName:'Guest User', home:'/用户/Guest', shell:'/bin/bash', status:t('ui.6c7dcbb73a59') },
      };
      const user = users[value.toLocaleLowerCase('en-US')];
      clearOutput('finger');
      if (!user) appendOutput('finger', `${t('app.net.fingerMiss', { value })}`);
      else {
        let projects = 0;
        try { projects = VFS.walk(user.home).filter((path) => VFS.get(path)?.type !== 'dir').length; } catch (error) {}
        appendOutput('finger', `Login: ${user.name.padEnd(18)} Name: ${user.fullName}\nDirectory: ${user.home.padEnd(28)} Shell: ${user.shell}\n`);
        appendOutput('finger', `On since: ${user.name === 'roll' ? new Date(System.bootTime).toLocaleString('zh-CN') : '—'}\nStatus: ${user.status}\n`);
        appendOutput('finger', `Virtual files: ${projects}\n${t('app.net.plan')}\n`);
      }
      finger.status = user ? t('app.net.foundUser', { name: user.name }) : t('ui.f940b0457779');
      toolbarStatus.textContent = finger.status;
      copyButton.disabled = false;
      updateWindowState();
    };
    finger.querySelector('[data-finger-run]').addEventListener('click', finger.run);
    finger.boundary = t('ui.7b530f4868fb');

    // Port Scan
    const portscan = makePane('portscan', t('ui.355922e844ea'), t('ui.6eeb560781a3'),
      `<div class="netutil-form portscan"><label><span>${t('app.net2.5d0f204e9270')}</span><input class="aqua-input" data-port-host value="example.com"></label><label><span>${t('app.net2.6b73d69e57df')}</span><div><input class="aqua-input" type="number" min="1" max="65535" data-port-start value="80"><b>${t('app.net2.10cbe3e757dd')}</b><input class="aqua-input" type="number" min="1" max="65535" data-port-end value="81"></div></label><button class="aqua-btn default" data-port-run>${t('app.net3.667393491d57')}</button></div>`);
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
          mode:'no-cors', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', signal:controller.signal,
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
      if (!host) return System.alertBox(t('ui.355922e844ea'), t('ui.18c1d6018283'));
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 65535 || start > end) return System.alertBox(t('ui.355922e844ea'), t('ui.4e6f1ea1cc08'));
      if (end - start + 1 > 32) return System.alertBox(t('ui.355922e844ea'), t('ui.aac6d665159c'));
      const { id, signal } = beginOperation(t('app.net.scanning', { host }));
      clearOutput('portscan', t('app.net.scanHdr', { host, start, end }));
      const ports = Array.from({ length:end-start+1 }, (_,index) => start+index);
      let openCount = 0;
      for (let offset = 0; offset < ports.length; offset += 4) {
        const results = await Promise.all(ports.slice(offset,offset+4).map((port) => probePort(host,port,signal)));
        if (id !== operationId || signal.aborted) return;
        results.forEach((result) => {
          if (result.open) openCount++;
          appendOutput('portscan', `${String(result.port).padStart(5)}/${result.scheme.padEnd(5)} ${result.open ? t('app.net2.ed7a4af888f4') : t('ui.e753167a82a0')}${result.open ? `  ${result.elapsed.toFixed(1)} ms` : ''}\n`);
        });
      }
      appendOutput('portscan', t('app.net.scanDone', { ports: ports.length, open: openCount }) + '\n');
      finishOperation(id, `Port scan complete: ${openCount}/${ports.length}`);
      copyButton.disabled = false;
    };
    portscan.querySelector('[data-port-run]').addEventListener('click', portscan.run);
    portscan.boundary = t('ui.be1f930b3c24');

    const runCurrent = () => {
      if (!busy) panes[currentTab]?.run?.();
    };
    const copyOutput = async () => {
      const text = panes[currentTab]?.output?.textContent || '';
      if (!text) return System.beep();
      try {
        await navigator.clipboard.writeText(text);
        Leopard.toast(t('ui.a087b91fc16a'), t('ui.bfe18fd187fe'));
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
      app:'netutil', title:t('ui.a087b91fc16a'), width:810, height:570,
      toolbar, content:root, statusbar:t('ui.7e615d7095b9'),
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
    id:'netutil', name:t('ui.a087b91fc16a'), icon, open,
    about:t('app.net2.db2a20618c13'),
    keywords:t('ui.dc048dba60ac'),
  });
})();
