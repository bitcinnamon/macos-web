import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 终端 (Terminal) — fake bash over the shared VFS
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="tmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6068"/><stop offset="1" stop-color="#23262b"/></linearGradient></defs><rect x="6" y="8" width="52" height="48" rx="6" fill="url(#tmg)" stroke="#111" stroke-width="1.5"/><rect x="6" y="8" width="52" height="12" rx="6" fill="#c8ccd2"/><circle cx="13" cy="14" r="2.4" fill="#f0554a"/><circle cx="21" cy="14" r="2.4" fill="#f5b53c"/><circle cx="29" cy="14" r="2.4" fill="#67c045"/><text x="12" y="38" font-family="Monaco, monospace" font-size="13" fill="#8ff08a" font-weight="bold">&gt;_</text></svg>`;

  function open() {
    let preferences = System.getAppPreferences?.('terminal') || {};
    let shellName = ['bash', 'zsh', 'sh'].includes(preferences.startupShell) ? preferences.startupShell : 'bash';
    const term = el('div', 'term');
    const HOME = paths.home;
    const requestedDirectory = String(preferences.workingDirectory || HOME);
    let cwd = VFS.isDir(requestedDirectory) ? requestedDirectory : HOME;
    let remote = null; // ssh session: {user, host, cwd}
    let win = null;

    function gitRoot() {
      let p = cwd;
      while (true) {
        if (VFS.get(p + '/.git')) return p;
        if (p === '/') return null;
        p = VFS.parentOf(p);
      }
    }

    function line(text, cls) {
      const d = el('div', 't-line' + (cls ? ' ' + cls : ''));
      d.textContent = text;
      term.insertBefore(d, inputRow);
      term.scrollTop = term.scrollHeight;
    }
    function promptStr() {
      if (remote) return `${remote.user}@${remote.host}:${remote.cwd}$ `;
      const short = cwd === HOME ? '~' : (cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd);
      return `roll@macweb:${short}$ `;
    }
    function resolve(p) {
      if (!p) return cwd;
      if (p === '~') return HOME;
      if (p.startsWith('~/')) return VFS.normalize(HOME + '/' + p.slice(2));
      if (p.startsWith('/')) return VFS.normalize(p);
      return VFS.normalize(cwd + '/' + p);
    }

    const commands = {
      help() {
        line(t('ui.65d26270df3c'));
        line(t('app.term.sys'));
        line(t('ui.fb653026a76c'));
        line(t('ui.6233c5345c49'));
        line('git:   init add commit log status remote push pull clone branch');
      },
      pwd() { line(cwd); },
      ls(args) {
        const showAll = args.some((a) => a === '-a' || a === '-la' || a === '-al');
        const paths = args.filter((a) => !a.startsWith('-'));
        const target = resolve(paths[0]);
        let items = VFS.list(target);
        if (items === null) { line(`ls: ${paths[0] || target}: ${t('app.term2.00c9bf933985')}`); return; }
        if (!showAll) items = items.filter((n) => !n.startsWith('.'));
        line(items.map((n) => VFS.isDir(target + '/' + n) ? n + '/' : n).join('  '));
      },
      cd(args) {
        const t = resolve(args[0] || '~');
        if (!VFS.isDir(t)) { line(t('app.term.notDir', { path: args[0] })); return; }
        cwd = t;
      },
      cat(args) {
        if (!args[0]) { line(t('app.term2.e94a0d2e3981')); return; }
        const n = VFS.get(resolve(args[0]));
        if (!n || n.type !== 'file') { line(`cat: ${args[0]}: ${t('app.term2.9f699dde9955')}`); return; }
        line(n.kind === 'image' ? t('app.term.binImg', { src: n.src }) : (n.content || ''));
      },
      echo(args, raw) {
        const m = raw.match(/>\s*(\S+)\s*$/);
        if (m) {
          const text = raw.replace(/\s*>\s*\S+\s*$/, '').replace(/^echo\s+/, '').replace(/^"(.*)"$/, '$1');
          VFS.writeFile(resolve(m[1]), text);
        } else line(args.join(' ').replace(/^"(.*)"$/, '$1'));
      },
      mkdir(args) {
        if (!args[0]) { line(t('app.term2.eca30edeeaf1')); return; }
        if (!VFS.mkdir(resolve(args[0]))) line(t('app.term.mkdirFail', { path: args[0] }));
      },
      touch(args) {
        if (!args[0]) { line(t('app.term2.92351037c534')); return; }
        const p = resolve(args[0]);
        if (!VFS.get(p)) VFS.writeFile(p, '');
      },
      rm(args) {
        const p = args.filter((a) => !a.startsWith('-'))[0];
        if (!p) { line(t('app.term2.0f44ad180dee')); return; }
        if (!VFS.remove(resolve(p))) line(`rm: ${p}: ${t('app.term2.00c9bf933985')}`);
      },
      date() { line(new Date().toString()); },
      whoami() { line('roll'); },
      uname(args) { line(args[0] === '-a' ? 'Darwin macweb 9.8.0 Darwin Kernel Version 9.8.0 (Web) i386' : 'Darwin'); },
      sw_vers() { line('ProductName:\tMac OS X\nProductVersion:\t10.5 (Web)\nBuildVersion:\t9A581-www'); },
      clear() { term.querySelectorAll('.t-line').forEach((d) => d.remove()); },
      open(args) {
        const name = (args[0] || '').toLowerCase();
        const map = { calculator:'calculator', notes:'notes', textedit:'textedit', safari:'safari', finder:'finder', ical:'ical', itunes:'itunes', preview:'preview', chess:'chess', diskutil:'diskutil', activity:'activity', console:'consoleapp', profiler:'sysprofiler', netutil:'netutil', fontbook:'fontbook', opengl:'opengl', mail:'mail', terminal:'terminal' };
        if (map[name]) { System.launch(map[name]); line(t('app.term.launching', { name })); }
        else line(t('app.term2.4f7774f736c7'));
      },
      banner(args) {
        const t = (args.join(' ') || 'MAC OS X').toUpperCase().slice(0, 10);
        line('*'.repeat(t.length * 2 + 8));
        line('*   ' + t.split('').join(' ') + '   *');
        line('*'.repeat(t.length * 2 + 8));
      },
      say(args) {
        const msg = args.join(' ') || 'hello';
        try { speechSynthesis.speak(new SpeechSynthesisUtterance(msg)); line(`🔊 ${msg}`); }
        catch (e) { line(msg); }
      },
      history() { hist.forEach((h, i) => line(`  ${i + 1}  ${h}`)); },
      uptime() { line(` up ${System.uptimeStr()}, 1 user, load averages: 0.42 0.33 0.28`); },
      hostname() { line('macweb.local'); },
      df() {
        navigator.storage.estimate().then((est) => {
          const used = ((est.usage || 0) / 1024).toFixed(0), quota = ((est.quota || 0) / 1024).toFixed(0);
          line('Filesystem     1K-blocks     Used  Mounted on');
          line(`/dev/disk0s2  ${quota.padStart(9)} ${used.padStart(8)}  /`);
        }).catch(() => line(t('ui.17def587009e')));
      },
      ps() {
        line('  PID TTY      TIME     CMD');
        Object.values(System.apps).forEach((a, i) => {
          if (a.windows.length) line(`  ${String(200 + i).padStart(3)} ??    0:0${i}.${i * 7 % 60}  ${a.id}`);
        });
        line('   88 ??    12:04.22  WindowServer');
      },
      top() { System.launch('activity'); line(t('ui.c3cfd85a0897')); },
      ifconfig() {
        const c = navigator.connection || {};
        line(`en0: flags=8863<UP,BROADCAST,RUNNING> mtu 1500`);
        line(`\tstatus: ${navigator.onLine ? 'active' : 'inactive'}`);
        line(`\tlink: ${c.effectiveType || 'unknown'} · downlink ${c.downlink != null ? c.downlink + ' Mbps' : '?'} · rtt ${c.rtt != null ? c.rtt + ' ms' : '?'}`);
      },
      // ---- kext 驱动 ----
      kextstat() {
        line('Index Loaded  Version   Name');
        System.Kexts.list().forEach((k, i) => line(`${String(i + 1).padStart(5)} ${k.loaded ? '  ✔   ' : '  ✘   '} ${k.ver.padEnd(9)} ${k.name}  (${k.desc})`));
      },
      kextload(args) {
        if (!args[0]) { line(t('app.term2.ba5f0c9191b3')); return; }
        const r = System.Kexts.load(args[0].startsWith('/') || args[0].startsWith('~') ? resolve(args[0]) : args[0]);
        line(r.msg);
      },
      kextunload(args) {
        if (!args[0]) { line(t('app.term2.e2e0e70129c9')); return; }
        line(System.Kexts.unload(args[0]).msg);
      },
      // ---- 真实网络 ----
      async ping(args) {
        const host = (args.filter((a) => !a.startsWith('-'))[0] || 'example.com').replace(/^https?:\/\//, '').split('/')[0];
        line(t('app.term.ping', { host }));
        const times = [];
        for (let i = 0; i < 4; i++) {
          const t0 = performance.now();
          try {
            await fetch('https://' + host + '/?t=' + Date.now(), {
              mode:'no-cors', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer',
            });
            const ms = performance.now() - t0; times.push(ms);
            line(`64 bytes from ${host}: icmp_seq=${i} time=${ms.toFixed(1)} ms`);
          } catch (e) { line(`Request timeout for icmp_seq ${i}`); }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (times.length) line(`--- ${times.length}/4 packets, avg ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} ms ---`);
      },
      async curl(args) {
        const url = args.filter((a) => !a.startsWith('-'))[0];
        if (!url) { line(t('app.term2.5505a76c662a')); return; }
        const full = /^https?:/.test(url) ? url : 'https://' + url;
        line(`* Connected to ${full}`);
        try {
          const r = await fetch(full, { credentials:'omit', referrerPolicy:'no-referrer' });
          const text = await r.text();
          line(`< HTTP ${r.status} ${r.statusText || ''}  (${text.length} bytes)`);
          text.split('\n').slice(0, 15).forEach((l) => line(l.slice(0, 120)));
          if (text.split('\n').length > 15) line(t('ui.09a59662a1d6') + text.split('\n').length + t('app.term2.1e47cfb774ea'));
        } catch (e) {
          line(t('app.term.curlFail'));
          line(t('app.term.curlHint'));
        }
      },
      // ---- ssh（模拟远程会话）----
      ssh(args) {
        const target = args[0];
        if (!target || !target.includes('@')) { line(t('ui.71ebbe5efdb9')); return; }
        const [user, host] = target.split('@');
        line(t('app.term.conn', { host }));
        setTimeout(() => {
          remote = { user, host, cwd: '~' };
          line(`Warning: Permanently added '${host}' (RSA) to the list of known hosts.`);
          line(`Welcome to ${host} (Darwin 9.8.0 remote)`);
          line(`Last login: ${new Date().toDateString()} from macweb.local`);
          line(t('ui.e07cab7a2114'));
          refreshPrompt();
        }, 500);
      },
      exit() {
        if (remote) { line(`Connection to ${remote.host} closed.`); remote = null; }
        else line('logout');
      },
      // ---- git（本地仓库模拟 + push 演示）----
      git(args, raw) {
        const sub = args[0];
        const root = gitRoot();
        const KEY = 'macweb.git.' + (root || cwd);
        const repo = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
        const saveRepo = (r) => localStorage.setItem(KEY, JSON.stringify(r));
        const hash = () => Math.random().toString(16).slice(2, 9);
        if (!sub) { line(t('app.term2.060ef789943c')); return; }
        if (sub === 'init') {
          if (VFS.get(cwd + '/.git')) { line(t('ui.e31aa3b222cf')); return; }
          VFS.mkdir(cwd + '/.git');
          localStorage.setItem('macweb.git.' + cwd, JSON.stringify({ branch: 'main', staged: [], commits: [], remotes: {} }));
          line(t('app.term.gitInit', { path: cwd }));
          return;
        }
        if (!root) { line(t('ui.e25faeeeb0b9')); return; }
        const r = repo();
        if (sub === 'status') {
          line(t('app.term.branch', { branch: r.branch }));
          const all = (VFS.list(root) || []).filter((n) => n !== '.git');
          const committed = new Set(r.commits.flatMap((c) => c.files));
          const untracked = all.filter((f) => !committed.has(f) && !r.staged.includes(f));
          if (r.staged.length) { line(t('app.term2.1b668cda036f')); r.staged.forEach((f) => line(t('app.term.newFile', { f }))); }
          if (untracked.length) { line(t('ui.4f4da84a7982')); untracked.forEach((f) => line(`\t${f}`)); }
          if (!r.staged.length && !untracked.length) line(t('ui.365a5fd0c262'));
        } else if (sub === 'add') {
          const t = args[1];
          if (!t) { line(t('app.term2.c5f3dfa3e6bc')); return; }
          const files = t === '.' || t === '-A'
            ? (VFS.list(root) || []).filter((n) => n !== '.git')
            : [t];
          files.forEach((f) => { if (!r.staged.includes(f) && VFS.get(root + '/' + f)) r.staged.push(f); });
          saveRepo(r);
        } else if (sub === 'commit') {
          const m = raw.match(/-m\s+"([^"]+)"|-m\s+(\S+)/);
          if (!m) { line(t('ui.4da0a949594b')); return; }
          if (!r.staged.length) { line(t('ui.e86595954300')); return; }
          const h = hash();
          r.commits.push({ hash: h, msg: m[1] || m[2], files: r.staged.slice(), ts: Date.now() });
          line(`[${r.branch} ${h}] ${m[1] || m[2]}`);
          line(t('app.term.changed', { n: r.staged.length }));
          r.staged = [];
          saveRepo(r);
        } else if (sub === 'log') {
          if (!r.commits.length) { line(t('ui.a9b42763e563')); return; }
          r.commits.slice().reverse().forEach((c) => {
            line(`commit ${c.hash} (HEAD -> ${r.branch})`);
            line(`Date: ${new Date(c.ts).toString().slice(0, 24)}`);
            line(`\n    ${c.msg}\n`);
          });
        } else if (sub === 'branch') {
          line(`* ${r.branch}`);
        } else if (sub === 'remote') {
          if (args[1] === 'add') { r.remotes[args[2] || 'origin'] = args[3] || 'git@github.com:roll/repo.git'; saveRepo(r); }
          else Object.entries(r.remotes).forEach(([n, u]) => line(`${n}\t${u} (push)`));
          if (!Object.keys(r.remotes).length && args[1] !== 'add') line(t('app.term.noRemote'));
        } else if (sub === 'push') {
          const remoteName = args.filter((a) => !a.startsWith('-'))[1] || 'origin';
          const url = r.remotes[remoteName] || (r.remotes[remoteName] = 'git@github.com:roll/macos-web.git', saveRepo(r), r.remotes[remoteName]);
          if (!r.commits.length) { line(t('ui.ce7eef9ffda0')); return; }
          const objs = r.commits.length * 3;
          line(t('app.term.enumObjs', { n: objs }));
          const steps = [
            t('app.term.countObjs', { a: objs, b: objs }),
            t('app.term.compressThreads', { n: System.HW.cores }),
            t('app.term.compressObjs', { a: objs - 1, b: objs - 1 }),
            t('app.term.writeObjs', { a: objs, b: objs, size: (objs * 1.7).toFixed(1) }),
            `To ${url}`,
            ` * [new branch]      ${r.branch} -> ${r.branch}`,
          ];
          steps.forEach((s, i) => setTimeout(() => { line(s); term.scrollTop = term.scrollHeight; }, 260 * (i + 1)));
        } else if (sub === 'pull') {
          line('Already up to date.');
        } else if (sub === 'clone') {
          const url = args[1] || 'https://github.com/roll/demo.git';
          const name = url.split('/').pop().replace(/\.git$/, '') || 'repo';
          line(t('app.term.cloning', { name }));
          setTimeout(() => {
            VFS.mkdir(cwd + '/' + name);
            VFS.mkdir(cwd + '/' + name + '/.git');
            VFS.writeFile(cwd + '/' + name + '/README.md', `# ${name}\n\ncloned from ${url}\n`);
            localStorage.setItem('macweb.git.' + VFS.normalize(cwd + '/' + name), JSON.stringify({ branch: 'main', staged: [], commits: [{ hash: 'a1b2c3d', msg: 'initial commit', files: ['README.md'], ts: Date.now() }], remotes: { origin: url } }));
            line(t('app.term.recvObjs'));
          }, 600);
        } else line(t('app.term.notGit', { sub }));
      },
    };

    // limited command set inside a fake ssh session
    function remoteExec(raw) {
      const parts = raw.split(/\s+/);
      const cmd = parts[0];
      const rfs = { 'projects': 'dir', 'logs': 'dir', 'deploy.sh': '#!/bin/bash\necho "deploying macos-web to prod..."\nrsync -av build/ /var/www/', 'motd.txt': `Welcome to ${remote.host}\nThis is a simulated remote host.` };
      switch (cmd) {
        case 'ls': line(Object.keys(rfs).map((k) => rfs[k] === 'dir' ? k + '/' : k).join('  ')); break;
        case 'pwd': line(`/home/${remote.user}`); break;
        case 'whoami': line(remote.user); break;
        case 'hostname': line(remote.host); break;
        case 'uname': line('Linux ' + remote.host + ' 5.15.0 x86_64 GNU/Linux'); break;
        case 'uptime': line(' up 247 days, 3 users, load average: 0.08, 0.03, 0.01'); break;
        case 'cat': {
          const f = rfs[parts[1]];
          line(f && f !== 'dir' ? f : `cat: ${parts[1] || ''}: ${t('app.term2.9f699dde9955')}`); break;
        }
        case 'echo': line(parts.slice(1).join(' ')); break;
        case 'exit': case 'logout': commands.exit(); break;
        case '': break;
        default: line(t('app.term.remoteOnly', { cmd }));
      }
    }

    const hist = [];
    let histIdx = -1;

    const inputRow = el('div', 't-input-row');
    const promptEl = el('span', 't-prompt');
    const inputWrap = el('span', 'terminal-input-wrap');
    const input = el('input', 't-in');
    const cursor = el('i', 'terminal-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    input.autocomplete = 'off';
    input.spellcheck = false;
    inputWrap.append(input, cursor);
    inputRow.append(promptEl, inputWrap);
    term.appendChild(inputRow);

    function refreshPrompt() { promptEl.textContent = promptStr(); }
    function syncCursor() {
      const index = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
      inputWrap.style.setProperty('--terminal-cursor-index', String(Math.max(0, index)));
    }
    ['input', 'keyup', 'click', 'focus', 'select'].forEach((eventName) => {
      input.addEventListener(eventName, syncCursor);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = input.value.trim();
        line(promptStr() + input.value);
        input.value = '';
        syncCursor();
        if (raw) {
          hist.push(raw); histIdx = hist.length;
          if (remote) remoteExec(raw);
          else {
            const parts = raw.split(/\s+/);
            const cmd = parts[0];
            if (commands[cmd]) commands[cmd](parts.slice(1), raw);
            else line(shellName === 'zsh'
              ? `zsh: command not found: ${cmd}（${t('app.term2.1e02e35d8d02')}）`
              : `-${shellName}: ${cmd}: command not found（${t('app.term2.1e02e35d8d02')}）`);
          }
        }
        refreshPrompt();
        term.scrollTop = term.scrollHeight;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = hist[histIdx] || '';
          requestAnimationFrame(() => {
            input.setSelectionRange(input.value.length, input.value.length);
            syncCursor();
          });
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < hist.length) {
          histIdx++;
          input.value = hist[histIdx] || '';
          requestAnimationFrame(() => {
            input.setSelectionRange(input.value.length, input.value.length);
            syncCursor();
          });
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const parts = input.value.split(/\s+/);
        const last = parts[parts.length - 1];
        const items = VFS.list(cwd) || [];
        const match = items.find((n) => n.startsWith(last));
        if (match) {
          parts[parts.length - 1] = match;
          input.value = parts.join(' ');
          requestAnimationFrame(() => {
            input.setSelectionRange(input.value.length, input.value.length);
            syncCursor();
          });
        }
      }
    });

    function applyPreferences() {
      shellName = ['bash', 'zsh', 'sh'].includes(preferences.startupShell) ? preferences.startupShell : 'bash';
      const fontSize = ['11', '13', '15', '18'].includes(String(preferences.fontSize))
        ? String(preferences.fontSize)
        : '13';
      const background = /^#[0-9a-f]{6}$/i.test(String(preferences.backgroundColor || ''))
        ? String(preferences.backgroundColor)
        : '#101418';
      const rgb = [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16));
      const luminance = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114;
      const foreground = luminance > 150 ? '#101010' : '#e8eee8';
      const cursorStyle = ['block', 'underline', 'bar'].includes(preferences.cursorStyle)
        ? preferences.cursorStyle
        : 'block';

      term.style.setProperty('--terminal-font-size', `${fontSize}px`);
      term.style.setProperty('--terminal-background', background);
      term.style.setProperty('--terminal-foreground', foreground);
      term.dataset.cursorStyle = cursorStyle;
      term.classList.toggle('cursor-steady', preferences.cursorBlink === false);
      if (win) {
        win._title.textContent = `${t('app.term2.6b73a51bf6cb')} — ${shellName} — 80×24`;
        win._body.style.background = background;
      }
      refreshPrompt();
      syncCursor();
    }
    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'terminal') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('terminal') || {};
      applyPreferences();
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);

    applyPreferences();
    line('Last login: ' + new Date().toDateString() + ' on console');
    line(t('ui.359d4b1bc3fc'));
    refreshPrompt();

    win = System.createWindow({
      app: 'terminal', title: `${t('app.term2.6b73a51bf6cb')} — ${shellName} — 80×24`,
      width: 580, height: 380, content: term,
      onClose:() => {
        document.removeEventListener('app-preferences-changed', preferencesChanged);
        return true;
      },
    });
    applyPreferences();
    term.addEventListener('click', () => input.focus());
    setTimeout(() => {
      input.focus();
      syncCursor();
    }, 250);
  }

  System.registerApp({
    id: 'terminal', name: t('ui.7f55a26d7dda'), icon, open, multiWindow: true,
    about: t('ui.5a480127118d'),
    keywords: t('ui.e5a16298a4ef'),
  });
})();
