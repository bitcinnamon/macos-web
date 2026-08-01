import { System } from '../system/index.js';
import { t } from '../i18n/index.js';

// OpenGL 演示 (Quartz Extreme) — WebGL2-first hardware-accelerated cube + refresh telemetry
(() => {
  const { el, HW } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="glg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b3fe4"/><stop offset=".5" stop-color="#2f7fd0"/><stop offset="1" stop-color="#5fe8c0"/></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="8" fill="#14161c" stroke="#000" stroke-width="1.5"/><path d="M32 14 L48 24 L48 42 L32 52 L16 42 L16 24 Z" fill="url(#glg)" stroke="#dff" stroke-width="1.2"/><path d="M32 14 L48 24 L32 34 L16 24 Z" fill="#fff" opacity=".3"/><path d="M32 34 L32 52" stroke="#dff" stroke-width="1.2"/></svg>`;

  const SHADERS = {
    webgl2: {
      vertex: `#version 300 es
        in vec3 p;
        in vec3 col;
        uniform mat4 mvp;
        out vec3 vc;
        void main() {
          gl_Position = mvp * vec4(p, 1.0);
          vc = col;
        }`,
      fragment: `#version 300 es
        precision mediump float;
        in vec3 vc;
        out vec4 outColor;
        void main() { outColor = vec4(vc, 1.0); }`,
    },
    webgl: {
      vertex: `attribute vec3 p;
        attribute vec3 col;
        uniform mat4 mvp;
        varying vec3 vc;
        void main() {
          gl_Position = mvp * vec4(p, 1.0);
          vc = col;
        }`,
      fragment: `precision mediump float;
        varying vec3 vc;
        void main() { gl_FragColor = vec4(vc, 1.0); }`,
    },
  };

  const cubeVertices = (() => {
    const data = [];
    const faces = [
      [[-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1], [0.36,0.62,0.93]],
      [[-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1], [0.48,0.25,0.89]],
      [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1],     [0.37,0.91,0.75]],
      [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1], [0.96,0.71,0.24]],
      [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1],     [0.94,0.33,0.29]],
      [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1], [0.99,0.48,0.75]],
    ];
    faces.forEach((face) => {
      const [a, b, c, d, color] = face;
      [[a, b, c], [a, c, d]].forEach((triangle) => {
        triangle.forEach((vertex) => data.push(...vertex, ...color));
      });
    });
    return new Float32Array(data);
  })();

  function open() {
    const wrap = el('div', 'gl-wrap');
    const canvas = el('canvas', 'gl-canvas');
    const hud = el('div', 'gl-hud');
    wrap.append(canvas, hud);

    let running = true;
    let gl = null;
    let backend = '';
    let contextLost = false;
    let frameId = 0;
    let program = null;
    let buffer = null;
    let vao = null;
    let mvpLocation = null;
    let loseContextExtension = null;
    let cssWidth = 1;
    let cssHeight = 1;
    let pixelRatio = 1;
    let frames = 0;
    let frameIntervalEwma = 16.67;
    let lastTimestamp = 0;
    let lastHudAt = 0;
    let renderCostEwma = 0;

    const rx = new Float32Array(16);
    const ry = new Float32Array(16);
    const translation = new Float32Array([
      1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-5,1,
    ]);
    const projection = new Float32Array(16);
    const matrixA = new Float32Array(16);
    const matrixB = new Float32Array(16);
    const mvp = new Float32Array(16);

    const win = System.createWindow({
      app: 'opengl',
      title: t('ui.b32fa6443c55'),
      width: 560,
      height: 440,
      content: wrap,
      statusbar: '',
      bodyBg: '#14161c',
      onClose: cleanup,
      onResize: fit,
    });

    const contextAttributes = {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      desynchronized: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    };
    gl = canvas.getContext('webgl2', contextAttributes);
    backend = gl ? 'WebGL 2.0' : '';
    if (!gl) {
      gl = canvas.getContext('webgl', contextAttributes)
        || canvas.getContext('experimental-webgl', contextAttributes);
      backend = gl ? t('ui.136c23d7d7a0') : '';
    }
    if (!gl) {
      wrap.innerHTML = `<div style="color:#f88;padding:40px;text-align:center">${t('app.gl.noSupport')}</div>`;
      return;
    }
    loseContextExtension = gl.getExtension('WEBGL_lose_context');

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || 'Shader compile failed';
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }

    function initResources() {
      const source = SHADERS[backend.startsWith('WebGL 2') ? 'webgl2' : 'webgl'];
      const vertexShader = compile(gl.VERTEX_SHADER, source.vertex);
      const fragmentShader = compile(gl.FRAGMENT_SHADER, source.fragment);
      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || 'Program link failed';
        gl.deleteProgram(program);
        program = null;
        throw new Error(message);
      }

      if (backend.startsWith('WebGL 2')) {
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
      }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'p');
      const color = gl.getAttribLocation(program, 'col');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
      if (vao) gl.bindVertexArray(null);
      mvpLocation = gl.getUniformLocation(program, 'mvp');
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
    }

    function multiply(out, a, b) {
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
          out[column * 4 + row] =
            a[row] * b[column * 4]
            + a[4 + row] * b[column * 4 + 1]
            + a[8 + row] * b[column * 4 + 2]
            + a[12 + row] * b[column * 4 + 3];
        }
      }
    }

    function updateMatrix(time) {
      const x = time * 0.0006;
      const y = time * 0.0009;
      const cx = Math.cos(x);
      const sx = Math.sin(x);
      const cy = Math.cos(y);
      const sy = Math.sin(y);
      rx.set([1,0,0,0, 0,cx,sx,0, 0,-sx,cx,0, 0,0,0,1]);
      ry.set([cy,0,-sy,0, 0,1,0,0, sy,0,cy,0, 0,0,0,1]);
      const near = 1;
      const far = 20;
      projection.set([
        2.2 / Math.max(0.01, cssWidth / cssHeight),0,0,0,
        0,2.2,0,0,
        0,0,(far + near) / (near - far),-1,
        0,0,2 * far * near / (near - far),0,
      ]);
      multiply(matrixA, ry, rx);
      multiply(matrixB, translation, matrixA);
      multiply(mvp, projection, matrixB);
      return mvp;
    }

    function fit() {
      if (!gl || contextLost) return;
      const rect = wrap.getBoundingClientRect();
      cssWidth = Math.max(50, Math.round(rect.width));
      cssHeight = Math.max(50, Math.round(rect.height));
      const pixelBudgetRatio = Math.sqrt(3000000 / Math.max(1, cssWidth * cssHeight));
      pixelRatio = Math.max(0.75, Math.min(2, devicePixelRatio || 1, pixelBudgetRatio));
      const width = Math.max(1, Math.round(cssWidth * pixelRatio));
      const height = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    }

    function updateHud() {
      const refreshHz = 1000 / Math.max(0.01, frameIntervalEwma);
      hud.innerHTML = `<b>${Math.round(refreshHz)} Hz</b> · ${backend} · DPR ${pixelRatio.toFixed(2)}<br>${HW.gpu}<br>${t('app.gl.hudFrame', { ms: renderCostEwma.toFixed(2), ver: gl.getParameter(gl.VERSION) })}`;
      wrap.dataset.renderer = backend.startsWith('WebGL 2') ? 'webgl2' : 'webgl';
      wrap.dataset.rafHz = refreshHz.toFixed(1);
      wrap.dataset.renderMs = renderCostEwma.toFixed(2);
      wrap.dataset.dpr = pixelRatio.toFixed(2);
    }

    function draw(timestamp) {
      if (!running || !canvas.isConnected) return;
      frameId = requestAnimationFrame(draw);
      if (contextLost || document.hidden || win.style.display === 'none') {
        lastTimestamp = timestamp;
        return;
      }
      if (lastTimestamp) {
        const interval = timestamp - lastTimestamp;
        if (interval > 2 && interval < 100) {
          frameIntervalEwma += (interval - frameIntervalEwma) * 0.08;
        }
      }
      lastTimestamp = timestamp;
      frames++;
      const startedAt = performance.now();
      gl.clearColor(0.08, 0.086, 0.11, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      if (vao) gl.bindVertexArray(vao);
      else gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniformMatrix4fv(mvpLocation, false, updateMatrix(timestamp));
      gl.drawArrays(gl.TRIANGLES, 0, 36);
      if (vao) gl.bindVertexArray(null);
      const renderCost = performance.now() - startedAt;
      renderCostEwma += (renderCost - renderCostEwma) * 0.08;
      if (timestamp - lastHudAt >= 500) {
        updateHud();
        lastHudAt = timestamp;
      }
    }

    function onContextLost(event) {
      event.preventDefault();
      contextLost = true;
      wrap.dataset.renderer = 'lost';
      hud.innerHTML = `<b>GRAPHICS INTERRUPTED</b><br>${t('app.gl.restoring')}`;
    }

    function onContextRestored() {
      program = null;
      buffer = null;
      vao = null;
      try {
        initResources();
        contextLost = false;
        fit();
        System.syslog(t('app.gl.restored', { backend }), 'WindowServer');
      } catch (error) {
        running = false;
        hud.innerHTML = `<b>GRAPHICS ERROR</b><br>${error.message}`;
      }
    }

    function cleanup() {
      running = false;
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (!contextLost) {
        if (buffer) gl.deleteBuffer(buffer);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
    }

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    try {
      initResources();
    } catch (error) {
      running = false;
      wrap.innerHTML = `<div style="color:#f88;padding:40px;text-align:center">${t('app.gl.shaderFail', { msg: error.message })}</div>`;
      return;
    }
    fit();
    updateHud();
    frameId = requestAnimationFrame(draw);
    win._opengl = {
      getDiagnostics: () => ({
        renderer: wrap.dataset.renderer,
        backend,
        refreshHz: Number(wrap.dataset.rafHz || 0),
        renderMs: renderCostEwma,
        dpr: pixelRatio,
        frames,
        contextLost,
        glContextLost: gl.isContextLost(),
        contextRestoreAvailable: !!loseContextExtension,
      }),
      loseContextForTest: () => loseContextExtension?.loseContext(),
      restoreContextForTest: () => loseContextExtension?.restoreContext(),
    };
    System.syslog(t('app.gl.created', { backend, gpu: HW.gpu }), 'WindowServer');
  }

  System.registerApp({
    id: 'opengl',
    name: t('ui.1bca6f8c35f3'),
    icon,
    open,
    about: t('ui.8f516d79ee9d'),
    keywords: t('ui.3c6ed87c1772'),
  });
})();
