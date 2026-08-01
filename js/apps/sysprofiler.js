import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 系统报告 (System Profiler) — real hardware/software info from browser APIs
(() => {
  const { el, HW, Kexts } = System;

  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1048576).toFixed(1)} MB`;
  };
  const storageState = () => VFS.storageStatus?.() || {
    backend:'localStorage', pending:0, estimatedBytes:0, historyBytes:0,
    schemaVersion:1, lastSavedAt:null, lastError:null,
  };
  const storageBackendName = (state = storageState()) => ({
    indexeddb:t('app.sp.storageIndexedDB'),
    localStorage:t('app.sp.storageLocalFallback'),
    memory:t('app.sp.storageMemoryOnly'),
    initializing:t('app.sp.storageInitializing'),
  }[state.backend] || state.backend || t('ui.d9c32a4c3dda'));

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
      setTimeout(() => finish(t('ui.ef56c988f354')), 800);
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
      if (!gl) return [['WebGL', t('ui.ef8274b96890')]];
      out.push([t('ui.b7a8cff4db7d'), System.HW.graphicsApi]);
      out.push([t('app.sp.9ea7b144d9'), gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' px']);
      out.push([t('app.sp.b54c4b1012'), gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(' × ')]);
      out.push([t('app.sp.1f362098c3'), gl.getParameter(gl.SHADING_LANGUAGE_VERSION)]);
      out.push([t('app.sp.f2dfc1e227'), gl.getContextAttributes().antialias ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')]);
      out.push([t('ui.f50a001968a9'), String((gl.getSupportedExtensions() || []).length)]);
      if (System.HW.webgl2) {
        out.push([t('app.sp.cde68308bb'), String(gl.getParameter(gl.MAX_SAMPLES))]);
        out.push([t('app.sp.b949a6d724'), String(gl.getParameter(gl.MAX_DRAW_BUFFERS))]);
      }
    } catch (e) {}
    return out;
  }

  const SECTIONS = [
    { id: 'hw', name: t('ui.7a608e2161a2'), group: t('ui.b4cd99b8d4f1'), rows: () => [
      [t('ui.b9c18e0bdeec'), HW.model],
      [t('app.sp.d74694dcab'), HW.modelIdentifier],
      [t('ui.f612d012eb39'), HW.processorName],
      [t('app.sp.d820caff4b'), HW.processor],
      [t('app.sp.a1fa67d20a'), HW.processorSource],
      [t('app.sp.1d065e43ec'), t('app.sp.5b28bddd2b')],
      [t('app.sp.b6f001e4bb'), t('app.sp.5b28bddd2b')],
      [t('app.sp.0731752f95'), `${HW.cores}（${t('app.sp4.92b414f3ec6d')}${t('app.sp3.f25bcc91a4b6')}）`],
      [t('app.sp.a29cc470a2'), HW.memory],
      [t('app.sp.cb18e4a29d'), HW.memorySource],
      [t('app.sp.715dc21f84'), HW.gpu],
      [t('app.sp.4fc9c5f202'), HW.serial],
      [t('app.sp.7339c56d6f'), `Macintosh HD (${storageBackendName()})`],
      [t('app.sp.376c790eea'), 'WebBoot 9A581'],
      [t('ui.7583fac643b9'), t('ui.f4865b2479bc')],
      [t('app.sp.1de033a7d2'), navigator.maxTouchPoints ? t('app.sp.touchPts', { n: navigator.maxTouchPoints }) : t('ui.11ef53ab2c59')],
    ]},
    { id: 'gpu', name: t('ui.5b1ca77f81f0'), rows: async () => {
      const fps = await measureFps();
      return [
        [t('app.sp.866592efc5'), HW.gpu],
        ['WebGL', HW.webgl ? `${t('app.sp4.8fe29a5c6d09')} — ${HW.graphicsApi}` : t('ui.ef8274b96890')],
        ['WebGL 2', HW.webgl2 ? t('ui.60e21625be29') : t('ui.6da06087e3bf')],
        [t('app.sp.4447e57f62'), HW.glVersion || t('ui.d9c32a4c3dda')],
        ['Quartz Extreme', HW.webgl && Kexts.isLoaded('QuartzExtreme.kext') ? t('ui.5b1ce5f3a76a') : t('ui.5c4cd8b667a1')],
        [t('app.sp.02eb3a220a'), HW.screen],
        [t('ui.5cd4d66fea3a'), `${screen.availWidth} × ${screen.availHeight}`],
        [t('app.sp2.2462a87e5c91'), HW.depth],
        [t('ui.a8779752ee4a'), String(HW.dpr) + (HW.dpr > 1 ? '（Retina）' : '')],
        [t('ui.ea1e93f1ea78'), fps],
        [t('app.sp2.9b2166196240'), matchMedia('(color-gamut: p3)').matches ? t('ui.467c7988bf08') : 'sRGB'],
        ['HDR', matchMedia('(dynamic-range: high)').matches ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
        ...glDetails(),
      ];
    }},
    { id: 'mem', name: t('app.sp.a29cc470a2'), rows: () => {
      const rows = [
        [t('ui.38883bd9c67c'), HW.memory],
        [t('app.sp2.0b433e481a69'), HW.memorySource],
      ];
      const pm = performance.memory;
      if (pm) {
        rows.push([t('app.sp2.0e142b22145e'), (pm.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB']);
        rows.push([t('app.sp2.41c968c8d166'), (pm.totalJSHeapSize / 1048576).toFixed(1) + ' MB']);
        rows.push([t('app.sp3.ba871c502233'), (pm.usedJSHeapSize / 1048576).toFixed(1) + ' MB']);
      } else rows.push([t('app.sp3.67477856f14f'), t('ui.620a5307fa57')]);
      return rows;
    }},
    { id: 'battery', name: t('app.sp3.1a819467fe1b'), rows: async () => {
      if (!navigator.getBattery) return [[t('app.sp2.74bcf9722fe0'), t('ui.f784aef2b495')]];
      try {
        const b = await navigator.getBattery();
        const fmt = (s) => (s === Infinity || isNaN(s)) ? '—' : t('app.sp.hm', { h: Math.floor(s / 3600), m: Math.round(s % 3600 / 60) });
        return [
          [t('app.sp3.1058e7320dbf'), Math.round(b.level * 100) + ' %'],
          [t('app.sp3.d9bb85d3eb8f'), b.charging ? t('ui.df31e094c32b') : t('app.sp3.400fa6d9cd52')],
          [t('app.sp3.d4d343dd311f'), b.charging ? fmt(b.chargingTime) : '—'],
          [t('app.sp3.e292daaf2a7e'), b.charging ? '—' : fmt(b.dischargingTime)],
        ];
      } catch (e) { return [[t('app.sp2.74bcf9722fe0'), t('app.sp.5fd6d32321')]]; }
    }},
    { id: 'storage', name: t('ui.091ca5213ef3'), rows: async () => {
      let quota = t('ui.d9c32a4c3dda'), usage = t('ui.d9c32a4c3dda'), persisted = t('ui.d9c32a4c3dda');
      try {
        const est = await navigator.storage.estimate();
        quota = (est.quota / 1073741824).toFixed(1) + ' GB';
        usage = (est.usage / 1024).toFixed(1) + ' KB';
        persisted = (await navigator.storage.persisted()) ? t('ui.e361558e82be') : t('ui.d0a3ff0d5432');
      } catch (e) {}
      const state = storageState();
      const rows = [
        [t('app.sp3.ec0312881cb7'), 'Macintosh HD'],
        [t('ui.42949b7f8fc9'), t('ui.c2f1b1653f46')],
        [t('app.sp.storageBackend'), storageBackendName(state)],
        [t('app.sp.storageSchema'), String(state.schemaVersion || '—')],
        [t('ui.a2f327f013d9'), quota],
        [t('ui.dca6ca992b7d'), usage],
        [t('ui.b1e6c560ee51'), formatBytes(state.estimatedBytes)],
        [t('app.sp.storageHistory'), formatBytes(state.historyBytes)],
        [t('app.sp.storagePending'), String(state.pending || 0)],
        [t('app.sp.storageLastSaved'), state.lastSavedAt ? new Date(state.lastSavedAt).toLocaleString() : '—'],
        [t('app.sp3.f5e726af6283'), persisted],
      ];
      if (state.lastError) rows.push([t('app.sp.storageLastError'), `${state.lastError.phase}: ${state.lastError.message}`]);
      return rows;
    }},
    { id: 'audio', name: t('app.sp3.3ea7e16e6127'), rows: () => {
      const rows = [];
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          rows.push(['Web Audio', t('ui.a9aab15d0126')]);
          rows.push([t('app.sp3.251c6b0718a4'), ctx.sampleRate + ' Hz']);
          rows.push([t('app.sp3.922a3b19d030'), (ctx.baseLatency != null ? (ctx.baseLatency * 1000).toFixed(1) + ' ms' : t('ui.d9c32a4c3dda'))]);
          ctx.close();
        } else rows.push(['Web Audio', t('ui.ef8274b96890')]);
      } catch (e) {}
      rows.push([t('app.sp3.54a90e40cf15'), (speechSynthesis && speechSynthesis.getVoices().length || 0) + t('app.sp3.ef59e3035af2')]);
      rows.push([t('ui.a5508cdf2eda'), document.createElement('audio').canPlayType('audio/mpeg') ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')]);
      rows.push([t('ui.e1761020807c'), document.createElement('audio').canPlayType('audio/mp4') ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')]);
      return rows;
    }},
    { id: 'ata', name: 'Serial-ATA', rows: () => [
      ['Intel ICH8-M AHCI', t('app.sp3.f254a16982cf')],
      [t('app.sp3.257c1398d8af'), 'Leopard Web'],
      [t('app.sp3.f23b116c1b3a'), 'Macintosh HD'],
      [t('app.sp3.e7e6e3bd4d44'), storageBackendName()],
      [t('ui.aed01fdabd41'), t('app.sp2.efd9e5128a0c')],
      [t('ui.0e65e4f249e6'), t('ui.de30fc6e2260')],
      [t('ui.6a3064dd161a'), t('ui.b0bee6289e3a')],
    ]},
    { id: 'usb', name: 'USB', rows: async () => {
      const rows = [
        [t('ui.955a2db77791'), t('ui.0531ba3bea60')],
        ['WebUSB API', navigator.usb ? t('ui.9a9576b89fc4') : t('app.sp.b2ac0c9fb1')],
        ['HID API', navigator.hid ? t('ui.9a9576b89fc4') : t('app.sp.b2ac0c9fb1')],
        [t('app.sp2.5b88ce4b64dc'), t('app.sp.gpConnected', { n: navigator.getGamepads ? navigator.getGamepads().filter(Boolean).length : 0 })],
      ];
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          devices.forEach((device, index) => rows.push([
            `${device.kind === 'audioinput' ? t('app.sp3.87ac55652813') : device.kind === 'audiooutput' ? t('app.sp3.44d8c0fdc34d') : device.kind === 'videoinput' ? t('app.sp3.f1c327c65ec3') : t('ui.775286f841a9')} ${index + 1}`,
            device.label || t('ui.31f09216eb02'),
          ]));
        } catch (error) { rows.push([t('ui.775286f841a9'), t('app.sp.5fd6d32321')]); }
      }
      return rows;
    }},
    { id: 'bluetooth', name: 'Bluetooth', rows: () => [
      [t('ui.1f739ed100a2'), '2.1.9f10-web'],
      ['Web Bluetooth', navigator.bluetooth ? t('ui.5191492281e5') : t('app.sp.b2ac0c9fb1')],
      [t('app.sp.badf3dd932'), t('ui.6c14bd7f6f9e')],
      ['Handoff', t('ui.ef8274b96890')],
      [t('app.sp.51c40d04d8'), t('ui.ec94f023e314')],
    ]},
    { id: 'firewire', name: t('app.sp.22ed742eaa'), rows: () => [
      [t('ui.94898d833a1e'), t('app.sp.3d6ed55d54')],
      [t('app.sp.51c40d04d8'), t('ui.a03cfb78e1f6')],
    ]},
    { id: 'disc', name: t('app.sp.128a89b81a'), rows: () => {
      const video = document.createElement('video');
      return [
        [t('app.sp.b450aa14b4'), t('ui.56de77caa02b')],
        [t('app.sp.59e50fbf56'), document.createElement('audio').canPlayType('audio/wav') ? t('ui.04dffbab9fb7') : t('ui.d9c32a4c3dda')],
        [t('ui.dd77f703e5e7'), video.canPlayType('video/mp4') ? t('ui.8d250bf36175') : t('ui.d9c32a4c3dda')],
        [t('app.sp.a52e665bd5'), t('ui.ce8b5ded230b')],
      ];
    }},
    { id: 'printer', name: t('ui.491f7e6d04fe'), rows: () => [
      [t('ui.47505f07a973'), t('ui.00e77d62a4c1')],
      [t('ui.c738b685a0a1'), t('ui.5e8155ab4749')],
      ['CUPS', t('ui.ba0437415df0')],
      [t('ui.c6283332cbb6'), t('ui.e0d8dfc69a49')],
    ]},
    { id: 'diag', name: t('app.sp.5232f2afb1'), rows: () => [
      [t('app.sp.956e3c6b0d'), t('ui.dcc4233255ab')],
      [t('ui.8d3a76134e91'), HW.webgl2 ? t('ui.dcc4233255ab') : t('ui.e37c86b0b77c')],
      [t('ui.622a22e5bc07'), storageState().lastError ? t('app.sp.0428ab1962') : t('ui.dcc4233255ab')],
      [t('app.sp.3a03b505d2'), window.isSecureContext ? t('ui.dcc4233255ab') : t('ui.db4d4d25202f')],
      ['JavaScript', t('ui.dcc4233255ab')],
    ]},
    { id: 'input', name: t('ui.c15e33676a95'), rows: () => [
      [t('app.sp.2ea2776e39'), matchMedia('(pointer: fine)').matches ? t('ui.df26c3c7e5a0') : (matchMedia('(pointer: coarse)').matches ? t('ui.389db2661a31') : t('ui.d9c32a4c3dda'))],
      [t('app.sp.1de3163c51'), matchMedia('(hover: hover)').matches ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
      [t('app.sp3.de4d3036d21f'), String(navigator.maxTouchPoints || 0)],
      [t('app.sp2.5b88ce4b64dc'), (navigator.getGamepads ? navigator.getGamepads().filter(Boolean).length : 0) + t('ui.fd124fd6655e')],
      [t('ui.1abc4061bb5d'), navigator.clipboard ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
    ]},
    { id: 'net', name: t('ui.0cbda6b52442'), group: t('ui.0cbda6b52442'), rows: () => {
      const c = navigator.connection || {};
      return [
        [t('ui.62e951a692ff'), navigator.onLine ? t('ui.65fe35c45e4e') : t('ui.211357d22f4d')],
        [t('app.sp.c004aaee4d'), t('ui.381ff104acda')],
        [t('ui.927ce3859763'), c.effectiveType || t('ui.d9c32a4c3dda')],
        [t('app.sp3.1457673cd920'), c.downlink != null ? c.downlink + ' Mbps' : t('ui.d9c32a4c3dda')],
        [t('app.sp3.6a1771420c90'), c.rtt != null ? c.rtt + ' ms' : t('ui.d9c32a4c3dda')],
        [t('app.sp3.9ba132b6ca44'), c.saveData ? t('app.sp3.50f875f39a3d') : t('ui.6c14bd7f6f9e')],
      ];
    }},
    { id: 'airport', name: t('app.sp.cf73f1d2ec'), rows: () => {
      const c = navigator.connection || {};
      return [
        [t('app.sp3.77c94818f4ae'), 'AirPort 5.3.2-web'],
        [t('app.sp.c004aaee4d'), 'en0'],
        [t('ui.62e951a692ff'), navigator.onLine ? t('ui.04c398fae7f1') : t('ui.6c14bd7f6f9e')],
        [t('ui.f40bbc9f9432'), c.effectiveType ? `${c.effectiveType}（${t('app.sp4.253b5d87877f')}）` : t('app.sp.5b28bddd2b')],
        [t('app.sp3.cf38f8ac8591'), c.downlink != null ? t('app.sp.mbps', { n: c.downlink }) : t('app.sp.5b28bddd2b')],
        [t('app.sp3.ed93a00cf4be'), t('app.sp.5b28bddd2b')],
        [t('app.sp3.ac4564ce86ea'), (navigator.language || 'en-US').split('-')[1] || '—'],
      ];
    }},
    { id: 'ethernet', name: t('app.sp3.925816d0424d'), rows: () => {
      const c = navigator.connection || {};
      return [
        [t('app.sp.c004aaee4d'), t('ui.8ebc731b7ad9')],
        [t('ui.4433eb13beca'), t('ui.c8a57c1ff5cf')],
        [t('ui.62e951a692ff'), c.type === 'ethernet' && navigator.onLine ? t('ui.65fe35c45e4e') : t('ui.0967d58cecc3')],
        [t('ui.7ce1990f3fa5'), t('app.sp2.593cccf62c6a')],
        [t('ui.8ac9fb2e418c'), navigator.onLine ? t('ui.e61d7c03a7ab') : t('app.sp.6e77e340d1')],
        [t('ui.e8cd45074696'), t('ui.e61d7c03a7ab')],
        [t('ui.f2fdffbb9ed5'), c.downlink != null ? `${c.downlink} Mbps（${t('app.sp4.253b5d87877f')}）` : t('ui.d9c32a4c3dda')],
      ];
    }},
    { id: 'modems', name: t('app.sp3.6d31072d300e'), rows: () => [
      [t('app.sp3.3e52f265afc6'), t('app.sp.3d6ed55d54')],
      [t('app.sp3.75c0e196af6e'), t('ui.aa7c0b9e326b')],
      [t('app.sp.51c40d04d8'), t('ui.4a878ed33a6a')],
    ]},
    { id: 'locations', name: t('ui.88c34452cc46'), rows: () => [
      [t('app.sp2.33f49f21ebb5'), t('ui.acd877a9a247')],
      [t('app.sp3.8024b5daef71'), t('ui.7984dca86e9a')],
      [t('app.sp.3e8175a133'), t('ui.dec2ab2c773b')],
      [t('ui.7212581aae75'), localStorage.getItem('macweb.network.location') || t('app.sp2.33f49f21ebb5')],
    ]},
    { id: 'firewall', name: t('app.sp3.3a94156c566d'), rows: () => [
      [t('ui.26bbd7400aeb'), t('ui.dd12bd0f07c1')],
      [t('app.sp.3a03b505d2'), window.isSecureContext ? t('ui.0014ec3f621b') : t('app.sp3.b375acaec580')],
      [t('app.sp3.b381e38da284'), t('ui.25d284315063')],
      [t('app.sp3.fbb5b6b12786'), t('ui.f6032b7ba92b')],
      ['Cookie', navigator.cookieEnabled ? t('ui.c083cdf1f733') : t('ui.d989e55188c9')],
    ]},
    { id: 'locale', name: t('app.sp4.2326c9d88310'), rows: () => {
      const dtf = Intl.DateTimeFormat().resolvedOptions();
      return [
        [t('app.sp4.d5f80c06438c'), HW.lang],
        [t('app.sp4.10540dec22f8'), (navigator.languages || []).join(', ')],
        [t('app.sp4.ed71b1a310d6'), dtf.timeZone],
        [t('ui.215e70fc5a20'), 'UTC' + (new Date().getTimezoneOffset() <= 0 ? '+' : '−') + Math.abs(new Date().getTimezoneOffset() / 60)],
        [t('app.sp.4869cd73ae'), dtf.calendar],
        [t('ui.a25fec2eb994'), dtf.numberingSystem],
      ];
    }},
    { id: 'sw', name: t('app.sp.3b97803425'), group: t('app.sp.3b97803425'), rows: () => {
      const brands = navigator.userAgentData && navigator.userAgentData.brands
        ? navigator.userAgentData.brands.map((b) => `${b.brand} ${b.version}`).join(' · ') : null;
      return [
        [t('ui.735f889efbfd'), 'Mac OS X 10.5 Leopard (Web) Build 9A581-www'],
        [t('app.sp4.38677567c787'), 'Darwin 9.8.0 (JavaScript)'],
        [t('app.sp.boot'), System.uptimeStr()],
        [t('app.sp4.43c7a1398374'), `${innerWidth} × ${innerHeight}`],
        ['Cookie', navigator.cookieEnabled ? t('ui.25d284315063') : t('ui.6c7dcbb73a59')],
        [t('ui.1f68ac558b30'), navigator.pdfViewerEnabled ? t('app.sp4.c484ab79e99b') : t('ui.72077749f794')],
        [t('ui.87fb54b26e99'), navigator.webdriver ? t('app.sp2.527e1483d880') : t('app.sp2.efd9e5128a0c')],
        ...(brands ? [[t('app.sp4.e17964d9daa3'), brands]] : []),
        ['User-Agent', HW.ua],
      ];
    }},
    { id: 'developer', name: t('app.sp4.fae4004f94e1'), rows: () => [
      ['JavaScript', t('ui.86f5614c376c')],
      ['WebAssembly', typeof WebAssembly === 'object' ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
      ['Service Worker', !('serviceWorker' in navigator) ? t('ui.ef8274b96890') : navigator.serviceWorker.controller ? t('ui.a9aab15d0126') : t('ui.fbb34edf901c')],
      ['IndexedDB', window.indexedDB ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
      ['WebGL 2', HW.webgl2 ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
      ['Web Audio', (window.AudioContext || window.webkitAudioContext) ? t('ui.a9aab15d0126') : t('ui.ef8274b96890')],
      [t('app.sp.3a03b505d2'), window.isSecureContext ? t('app.sp2.527e1483d880') : t('app.sp2.efd9e5128a0c')],
      [t('app.sp4.092cbc0d5ece'), 'Leopard Web 9A581-www'],
    ]},
    { id: 'accessibility', name: t('app.sp4.66445c55461d'), rows: () => [
      [t('ui.0ff170f1fc28'), t('ui.ee3e404454ac')],
      [t('app.sp4.6e94ed15d7d3'), matchMedia('(prefers-reduced-motion: reduce)').matches ? t('ui.ad9f7873a498') : t('app.sp.notOn')],
      [t('app.sp4.5bea2ab19fcb'), matchMedia('(prefers-contrast: more)').matches ? t('ui.ad9f7873a498') : t('app.sp.notOrHidden')],
      [t('app.sp.forced'), matchMedia('(forced-colors: active)').matches ? t('ui.25d284315063') : t('app.sp4.9392eded737b')],
      [t('ui.6b8c09125a01'), t('ui.14d8b9ac1850')],
      [t('ui.2a46ad86300d'), t('app.sp2.593cccf62c6a')],
    ]},
    { id: 'apps', name: t('ui.8a443802664a'), rows: () => Object.values(System.apps).map((a) => [a.name, `${a.id} · 1.0 (Web)${a.windows.length ? ` — ${t('app.sp3.b27c633da0f1')}` : ''}`]) },
    { id: 'kext', name: t('app.sp4.71e68a391356'), rows: () => Kexts.list().map((k) => [k.name, `${k.loaded ? t('ui.8f7ae8b9551d') : t('ui.6a73084a7fc2')} · v${k.ver} — ${k.desc}`]) },
    { id: 'fonts', name: t('ui.b50d4d8352f5'), rows: async () => {
      const families = ['Lucida Grande','Helvetica','Arial','Times New Roman','Georgia','Monaco','Courier New','PingFang SC','Hiragino Sans GB','Songti SC'];
      if (document.fonts?.ready) await document.fonts.ready;
      return families.map((family) => [family, document.fonts?.check(`12px "${family}"`) ? t('ui.e91365cf9ed9') : t('ui.beff4a1cd1a6')]);
    }},
    { id: 'frameworks', name: 'Frameworks', rows: () => [
      ['Aqua.framework', t('ui.fdb1999c98ea')],
      ['AppKit.framework', t('ui.a967464d361b')],
      ['CoreGraphics.framework', `Canvas 2D / ${HW.graphicsApi}`],
      ['WebKit.framework', navigator.userAgent],
      ['WebAudio.framework', (window.AudioContext || window.webkitAudioContext) ? t('app.sp2.7497cc4933eb') : t('ui.beff4a1cd1a6')],
      ['MediaDevices.framework', navigator.mediaDevices ? t('app.sp2.7497cc4933eb') : t('ui.beff4a1cd1a6')],
    ]},
    { id: 'prefpanes', name: t('app.sp4.308a5f36794f'), rows: () => [
      [t('ui.2d7c0c32a376'), t('ui.1b3a153419db')],
      [t('ui.b4cd99b8d4f1'), t('ui.a2cfbc9d5a05')],
      [t('ui.2e1812ee6733'), t('ui.5349c3e6dbf1')],
      [t('ui.1a1f6dff7826'), t('ui.9004b4c48cca')],
    ]},
    { id: 'startup', name: t('ui.9f87973b5b54'), rows: () => [
      ['Finder', t('ui.32560b43a8ce')],
      ['Dock', t('ui.fa097a6ee02c')],
      ['SystemUIServer', t('ui.18b58e783ab2')],
      ['Spotlight', t('ui.7e5249473575')],
      ['Dashboard', localStorage.getItem('macweb.dashboard.disabled') === '1' ? t('ui.6c7dcbb73a59') : t('ui.e91365cf9ed9')],
    ]},
    { id: 'syncservices', name: 'SyncServices', rows: () => [
      [t('ui.4c8a2cb5753a'), t('ui.d8a908bacbb6')],
      [t('ui.e93d32ec1b56'), t('ui.37d6f622bb0b')],
      [t('ui.89a8a85afe26'), t('ui.c5bb69bf4449')],
      [t('ui.b5279b76c19e'), t('ui.ed6972398363')],
      [t('ui.88f8222fda95'), t('app.sp.notConfigured')],
    ]},
    { id: 'installations', name: t('ui.2b1a3dc8913e'), rows: () => [
      ['Mac OS X Leopard Web', t('ui.09f996ecbfd3')],
      [t('ui.5e8a30ef0f7b'), t('app.sp.appsReg', { n: Object.keys(System.apps).length })],
      [t('ui.8e71f2638d85'), t('ui.d7a62045a7f9')],
      [t('ui.d323ac71c923'), t('ui.e19cdf0e6387')],
    ]},
    { id: 'log', name: t('app.sp4.701d28132315'), rows: () => System.syslogBuf.slice(-14).map((l) => [l.ts, `[${l.src}] ${l.msg}`]) },
  ];

  function open() {
    const layout = el('div', 'sprof-layout');
    const side = el('div', 'sprof-side');
    const main = el('div', 'sprof-main');
    const toolbar = el('div', 'sprof-toolbar');
    const refresh = el('button', 'finder-toolbar-btn', t('ui.38108eaa1d32'));
    const copy = el('button', 'finder-toolbar-btn', t('ui.bc6d0279b622'));
    const save = el('button', 'finder-toolbar-btn', t('ui.359721eae599'));
    const search = el('input', 'aqua-input aqua-search');
    search.placeholder = t('app.sp4.3e248bdc0136');
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
      loadingHead.innerHTML = `<div class="sprof-section-icon">i</div><div><h2>${sec.name}</h2><p>${t('app.sp4.0849c4ad5c09')}</p></div>`;
      main.appendChild(loadingHead);
      const rows = await sec.rows();
      if (version !== renderVersion) return;
      currentRows = rows;
      main.innerHTML = '';
      const header = el('header', 'sprof-section-head');
      const badge = el('div', 'sprof-section-icon', sec.group === t('ui.b4cd99b8d4f1') || ['hw','gpu','mem','storage','audio','ata','usb','bluetooth','firewire','disc','printer','diag','battery','input'].includes(sec.id) ? '⌘' : sec.group === t('ui.0cbda6b52442') || ['net','airport','locations','firewall','locale'].includes(sec.id) ? '⌁' : 'i');
      const heading = el('div');
      heading.append(el('h2', '', sec.name), el('p', '', t('app.sp.rowMeta', { n: rows.length, group: sec.group || t('app.sp.detail') })));
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
      if (win) win.querySelector('.win-statusbar').textContent = t('app.sp.statusFmt', { sec: sec.name, n: rows.length });
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
        Leopard.toast(t('ui.d79f8ee9cc4a'), t('ui.321c395405dd'));
      } catch (error) {
        System.alertBox(t('ui.d79f8ee9cc4a'), t('ui.46bb25e07540'));
      }
    });
    save.addEventListener('click', async () => {
      const endBusy = System.beginBusy(160);
      const originalStatus = win.querySelector('.win-statusbar').textContent;
      win.querySelector('.win-statusbar').textContent = t('ui.39821d19984c');
      try {
        let group = '';
        const report = [];
        for (const section of SECTIONS) {
          if (section.group) group = section.group;
          let rows;
          try { rows = await section.rows(); }
          catch (error) { rows = [[t('ui.8ecc7d04f396'), error?.message || t('ui.5f76edc5de7b')]]; }
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
          title:t('app.sp4.bfb9362411fa'),
          startPath:paths.documents, extension:'spx',
          typeLabel:t('app.sp4.33b2529b0e9f'),
          allowOverwrite:true,
          onSave:(path)=>{
            const saved = VFS.putNode(path, {
              type:'file', kind:'document', content,
              mime:'application/x-apple-systemprofiler+xml',
              creator:'sysprofiler', generated:true, createdAt:generatedAt,
            });
            if(saved) Leopard.toast(t('ui.d79f8ee9cc4a'), t('app.sp.saved', { name: VFS.baseName(path) }));
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

    win = System.createWindow({ app: 'sysprofiler', title: `${HW.model} — ${t('app.sp4.19063fc48f9f')}`, width: 850, height: 590, toolbar, content: layout, statusbar: t('app.sp.collecting') });
    render();
  }

  System.registerApp({
    id: 'sysprofiler', name: t('ui.d79f8ee9cc4a'), icon, open,
    about: t('app.sp.about2'),
    keywords: t('app.sp.keywords'),
  });
})();
