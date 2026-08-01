import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { t } from '../i18n/index.js';
import { paths } from '../config.js';

// Calculator — Leopard basic, scientific and programmer modes with paper tape.
(() => {
  const { el } = System;
  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="ccg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dde4"/><stop offset=".45" stop-color="#9da5af"/><stop offset=".52" stop-color="#777f8a"/><stop offset="1" stop-color="#aeb5be"/></linearGradient><linearGradient id="ckg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#d9dde2"/><stop offset=".52" stop-color="#b7bdc5"/><stop offset="1" stop-color="#e7e9ec"/></linearGradient></defs><rect x="8" y="4" width="48" height="56" rx="8" fill="url(#ccg)" stroke="#4a505c" stroke-width="1.5"/><rect x="13" y="10" width="38" height="12" rx="2" fill="#dce8d4" stroke="#4a505c"/><g fill="url(#ckg)" stroke="#656b73" stroke-width=".65"><rect x="13" y="27" width="10" height="8" rx="2"/><rect x="26" y="27" width="10" height="8" rx="2"/><rect x="13" y="38" width="10" height="8" rx="2"/><rect x="26" y="38" width="10" height="8" rx="2"/><rect x="13" y="49" width="23" height="8" rx="2"/></g><g fill="#f4a21d" stroke="#8d5a05" stroke-width=".65"><rect x="39" y="27" width="12" height="8" rx="2"/><rect x="39" y="38" width="12" height="8" rx="2"/><rect x="39" y="49" width="12" height="8" rx="2"/></g></svg>`;

  const settingsKey = 'macweb.calculator.settings';
  const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(settingsKey)) || {}; }
    catch (error) { return {}; }
  };
  const saveSettings = (value) => localStorage.setItem(settingsKey, JSON.stringify(value));
  const escapePdf = (value) => String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const normalizeTapeText = (value) => String(value).replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('π', 'pi').replace(/[^\x20-\x7e]/g, '?');

  const conversionGroups = {
    length:{ name:t('ui.a5394989b6a6'), units:{ [t('calc.unit.m')]:1, [t('ui.37cdb08da99c')]:1000, [t('ui.581448d73678')]:.01, [t('ui.5b9738ac6c94')]:.001, [t('ui.df24703b42ba')]:.0254, [t('ui.da22946a4bb3')]:.3048, [t('calc.unit.yd')]:.9144, [t('ui.e7fd6452f098')]:1609.344, [t('ui.573c8f987d21')]:1852 } },
    area:{ name:t('ui.ac2c28db8769'), units:{ [t('ui.c3dada2ee219')]:1, [t('ui.eb9e8c3f5f92')]:1e6, [t('ui.8ba30e71d5f7')]:1e-4, [t('ui.28213b325f05')]:1e4, [t('ui.2a866d4fde60')]:4046.8564224, [t('ui.e2ec8c4bb82c')]:.09290304 } },
    volume:{ name:t('ui.a79cfe2dccc2'), units:{ [t('calc.unit.L')]:1, [t('ui.9011ac3e3b58')]:.001, [t('ui.698ebe4e73da')]:1000, [t('ui.2086b9ff6d11')]:3.785411784, [t('ui.28234daa70ea')]:4.54609, [t('calc.unit.cup')]:.2365882365 } },
    mass:{ name:t('ui.82f516820cfe'), units:{ [t('ui.7083090cfcc4')]:1, [t('calc.unit.g')]:.001, [t('ui.9a52d322d3cc')]:1e-6, [t('ui.b898e67beb1e')]:1000, [t('calc.unit.lb')]:.45359237, [t('ui.ea6c73a6c717')]:.028349523125, [t('ui.bde42d892597')]:6.35029318 } },
    speed:{ name:t('ui.f2fdffbb9ed5'), units:{ [t('ui.ca8c4ea71eec')]:1, [t('ui.b1033c029ae9')]:1/3.6, [t('ui.674315a2189b')]:.44704, [t('calc.unit.kn')]:.5144444444, [t('ui.1fd7463ef916')]:.3048 } },
    time:{ name:t('calc.time'), units:{ [t('calc.unit.s')]:1, [t('ui.28bf227b9bf7')]:60, [t('ui.99f6904ff388')]:3600, [t('calc.unit.d')]:86400, [t('calc.unit.wk')]:604800, [t('ui.de0fd6ce9a7b')]:31536000 } },
    temperature:{
      name:t('ui.d3bea9efb1b9'), units:[t('ui.b3a2ab776465'),t('ui.e4e4ba3ed24f'),t('ui.c1b5d3267b17')],
      convert(value, from, to) {
        const celsius = from === t('ui.b3a2ab776465') ? value : from === t('ui.e4e4ba3ed24f') ? (value - 32) * 5/9 : value - 273.15;
        return to === t('ui.b3a2ab776465') ? celsius : to === t('ui.e4e4ba3ed24f') ? celsius * 9/5 + 32 : celsius + 273.15;
      },
    },
    energy:{ name:t('ui.6e01538b7fa5'), units:{ [t('ui.1e018570dfaa')]:1, [t('ui.b4d1665e741f')]:1000, [t('ui.1168eebf5b63')]:4.184, [t('ui.ed4125583d9e')]:4184, [t('ui.07f213c43a3d')]:3.6e6, [t('ui.5d3181c33bbe')]:1.3558179483 } },
    power:{ name:t('ui.a89cb400648c'), units:{ [t('calc.unit.W')]:1, [t('ui.143b1ff7c341')]:1000, [t('ui.90164ff9e6ba')]:745.6998716, [t('ui.8651acc307d3')]:.0225969658 } },
    pressure:{ name:t('ui.aef4cb9d00f4'), units:{ [t('ui.ce112bbcabdb')]:1, [t('ui.8675148bd10a')]:1000, [t('calc.unit.bar')]:100000, [t('ui.239e1f33bbfd')]:101325, [t('calc.unit.psi')]:6894.7572932, [t('ui.fc3a538928fb')]:133.322387415 } },
  };

  function open() {
    const saved = loadSettings();
    const state = {
      mode:['basic','scientific','programmer'].includes(saved.mode) ? saved.mode : 'basic',
      cur:'0', acc:null, op:null, fresh:true, lastOp:null, lastOperand:null,
      memory:0, angle:saved.angle || 'deg', second:false,
      rpn:!!saved.rpn, stack:[],
      parens:[],
      grouping:saved.grouping !== false,
      decimals:saved.decimals ?? 'auto',
      speechKeys:!!saved.speechKeys,
      speechResults:!!saved.speechResults,
    };
    const programmer = {
      value:0n, input:'0', acc:null, op:null, fresh:true, base:Number(saved.base) || 10,
      wordSize:Number(saved.wordSize) || 64, error:false,
    };
    const tape = [];
    let mainWindow = null;
    let tapeWindow = null;
    let tapeArea = null;
    let converterCategory = 'length';

    const root = el('div', 'calculator-leopard');
    root.innerHTML = `<section class="calc-lcd"><div class="calc-rpn-stack" hidden></div><output aria-live="polite">0</output><small class="calc-lcd-status"></small></section>
      <section class="calc-program-meta" hidden><div class="calc-base-switch"></div><label>${t('calc.wordSize')}<select class="spp-select calc-word-size"><option value="64">${t('calc.qword')}</option><option value="32">${t('calc.dword')}</option><option value="16">${t('calc.word')}</option><option value="8">${t('calc.byte')}</option></select></label><span class="calc-character">ASCII: NUL · Unicode: U+0000</span><div class="calc-bits"></div></section>
      <section class="calc-keyboard"></section>`;
    const display = root.querySelector('output');
    const lcdStatus = root.querySelector('.calc-lcd-status');
    const rpnStack = root.querySelector('.calc-rpn-stack');
    const keyboard = root.querySelector('.calc-keyboard');
    const programMeta = root.querySelector('.calc-program-meta');
    const baseSwitch = root.querySelector('.calc-base-switch');
    const wordSize = root.querySelector('.calc-word-size');
    const character = root.querySelector('.calc-character');
    const bits = root.querySelector('.calc-bits');

    const persist = () => saveSettings({
      mode:state.mode, angle:state.angle, rpn:state.rpn, grouping:state.grouping,
      decimals:state.decimals, speechKeys:state.speechKeys, speechResults:state.speechResults,
      base:programmer.base, wordSize:programmer.wordSize,
    });
    const parentWindow = () => System.topWindowOf('calculator') || (mainWindow?.isConnected ? mainWindow : tapeWindow);
    const finite = (value) => Number.isFinite(Number(value));
    const rawNumber = () => Number(String(state.cur).replace(/,/g,''));
    const angleToRadians = (value) => state.angle === 'deg' ? value * Math.PI / 180 : state.angle === 'grad' ? value * Math.PI / 200 : value;
    const radiansToAngle = (value) => state.angle === 'deg' ? value * 180 / Math.PI : state.angle === 'grad' ? value * 200 / Math.PI : value;
    const cleanNumber = (value) => {
      if (!Number.isFinite(value)) return t('ui.b859c7be7501');
      if (Object.is(value, -0)) value = 0;
      if (Math.abs(value) > 9.999999999999e14 || Math.abs(value) && Math.abs(value) < 1e-11) return value.toExponential(10).replace(/\.?0+e/,'e');
      return String(Number(value.toPrecision(14)));
    };
    const formatDisplay = (raw) => {
      if (raw === t('ui.b859c7be7501')) return raw;
      const number = Number(raw);
      if (!Number.isFinite(number)) return String(raw);
      let text;
      if (state.decimals !== 'auto' && !/[eE]/.test(String(raw))) text = number.toFixed(Number(state.decimals));
      else text = cleanNumber(number);
      if (!state.grouping || /[eE]/.test(text)) return text;
      const [integer, fraction] = text.split('.');
      const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return fraction == null ? grouped : `${grouped}.${fraction}`;
    };
    const speak = (text) => {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = 'zh-CN';
      utterance.rate = .92;
      speechSynthesis.speak(utterance);
    };

    const maskProgrammer = (value) => BigInt.asUintN(programmer.wordSize, value);
    const programValueText = (value = programmer.value) => maskProgrammer(value).toString(programmer.base).toUpperCase();
    const parseProgrammerInput = (value) => {
      const text = String(value || '0');
      if (programmer.base === 16) return BigInt(`0x${text}`);
      if (programmer.base === 8) return BigInt(`0o${text}`);
      if (programmer.base === 2) return BigInt(`0b${text}`);
      return BigInt(text);
    };
    const setProgrammerValue = (value, fresh = true) => {
      programmer.value = maskProgrammer(value);
      programmer.input = programValueText();
      programmer.fresh = fresh;
      programmer.error = false;
      refresh();
    };
    const displayProgramBits = () => {
      const binary = programmer.error ? ''.padStart(programmer.wordSize,'0') : maskProgrammer(programmer.value).toString(2).padStart(programmer.wordSize,'0');
      bits.innerHTML = '';
      for (let offset = 0; offset < binary.length; offset += 4) {
        const nibble = el('span', '', binary.slice(offset, offset + 4));
        nibble.title = `Bit ${programmer.wordSize - offset - 1}–${Math.max(0, programmer.wordSize - offset - 4)}`;
        bits.appendChild(nibble);
      }
      const low = Number(maskProgrammer(programmer.value) & 0xffffn);
      const ascii = low >= 32 && low <= 126 ? String.fromCharCode(low) : low === 0 ? 'NUL' : '—';
      character.textContent = `ASCII: ${ascii} · Unicode: U+${low.toString(16).toUpperCase().padStart(4,'0')}`;
    };

    const addTape = (text, result = '') => {
      tape.push({ text:String(text), result:String(result) });
      if (tape.length > 250) tape.shift();
      syncTape();
      updateDatasets();
    };
    const tapeText = () => tapeArea?.value || tape.map((entry) => entry.text).join('\n');
    const syncTape = (force = false) => {
      if (!tapeArea || !force && document.activeElement === tapeArea) return;
      tapeArea.value = tape.map((entry) => entry.text).join('\n');
      tapeArea.scrollTop = tapeArea.scrollHeight;
    };

    const applyBinary = (left, right, operation) => {
      switch (operation) {
        case '+': return left + right;
        case '−': return left - right;
        case '×': return left * right;
        case '÷': return right === 0 ? NaN : left / right;
        case 'xʸ': return left ** right;
        case 'ʸ√x': return right === 0 ? NaN : left ** (1 / right);
        case 'mod': return right === 0 ? NaN : left % right;
        default: return right;
      }
    };
    const setNumber = (value, fresh = true) => {
      state.cur = typeof value === 'string' ? value : cleanNumber(value);
      state.fresh = fresh;
      refresh();
    };
    const clearNumber = () => {
      state.cur = '0'; state.acc = null; state.op = null; state.fresh = true;
      state.lastOp = null; state.lastOperand = null; state.stack = []; state.parens = []; state.second = false;
      programmer.value = 0n; programmer.input = '0'; programmer.acc = null; programmer.op = null; programmer.fresh = true; programmer.error = false;
      refresh();
    };
    const backspace = () => {
      if (state.mode === 'programmer') {
        if (programmer.fresh || programmer.error) return setProgrammerValue(0n);
        programmer.input = programmer.input.length > 1 ? programmer.input.slice(0,-1) : '0';
        programmer.value = parseProgrammerInput(programmer.input);
      } else {
        if (state.fresh || state.cur === t('ui.b859c7be7501')) return;
        state.cur = state.cur.length > 1 ? state.cur.slice(0,-1) : '0';
        if (state.cur === '-' || state.cur === '') state.cur = '0';
      }
      refresh();
    };
    const inputDigit = (digit) => {
      if (state.mode === 'programmer') {
        const numeric = parseInt(digit,16);
        if (numeric >= programmer.base) return System.beep();
        if (programmer.fresh || programmer.error) {
          programmer.input = digit;
          programmer.fresh = false;
          programmer.error = false;
        } else if (programmer.input.length < Math.ceil(programmer.wordSize / Math.log2(programmer.base))) {
          programmer.input = programmer.input === '0' ? digit : programmer.input + digit;
        }
        try { programmer.value = maskProgrammer(parseProgrammerInput(programmer.input)); }
        catch (error) { programmer.value = 0n; }
        refresh();
        return;
      }
      if (state.fresh || state.cur === t('ui.b859c7be7501')) {
        state.cur = digit === '.' ? '0.' : digit;
        state.fresh = false;
      } else {
        if (digit === '.' && (state.cur.includes('.') || /[eE]/.test(state.cur))) return;
        if ((digit === 'e' || digit === 'E') && /[eE]/.test(state.cur)) return;
        state.cur = state.cur === '0' && digit !== '.' ? digit : state.cur + digit;
      }
      refresh();
    };
    const openParen = () => {
      if (state.rpn) return System.beep();
      state.parens.push({ acc:state.acc, op:state.op });
      state.acc = null;
      state.op = null;
      state.cur = '0';
      state.fresh = true;
      refresh();
    };
    const closeParen = () => {
      if (state.rpn || !state.parens.length) return System.beep();
      let inner = rawNumber();
      if (state.op && state.acc !== null) inner = applyBinary(state.acc,inner,state.op);
      if (!Number.isFinite(inner)) return setNumber(t('ui.b859c7be7501'));
      const outer = state.parens.pop();
      state.cur = cleanNumber(inner);
      state.acc = outer.acc;
      state.op = outer.op;
      state.fresh = false;
      refresh();
    };

    const rpnEnter = () => {
      const value = finite(state.cur) ? rawNumber() : 0;
      if (!state.fresh) state.stack.push(value);
      else if (state.stack.length) state.stack.push(state.stack.at(-1));
      else state.stack.push(value);
      state.cur = cleanNumber(state.stack.at(-1));
      state.fresh = true;
      refresh();
    };
    const setBinary = (operation) => {
      if (state.rpn) {
        if (!state.fresh && finite(state.cur)) state.stack.push(rawNumber());
        if (state.stack.length < 2) return System.beep();
        const right = state.stack.pop();
        const left = state.stack.pop();
        const result = applyBinary(left, right, operation);
        if (!Number.isFinite(result)) {
          state.stack = []; return setNumber(t('ui.b859c7be7501'));
        }
        state.stack.push(result);
        state.cur = cleanNumber(result);
        state.fresh = true;
        addTape(`${cleanNumber(left)} ${operation} ${cleanNumber(right)} = ${cleanNumber(result)}`, result);
        if (state.speechResults) speak(formatDisplay(state.cur));
        return refresh();
      }
      const value = rawNumber();
      if (!Number.isFinite(value)) return;
      if (state.op && !state.fresh) {
        const result = applyBinary(state.acc, value, state.op);
        state.acc = result;
        state.cur = cleanNumber(result);
      } else if (state.acc === null) state.acc = value;
      state.op = operation;
      state.fresh = true;
      refresh();
    };
    const equals = () => {
      if (state.rpn) return rpnEnter();
      if (!state.op && !state.lastOp) return;
      const operation = state.op || state.lastOp;
      const right = state.op ? rawNumber() : state.lastOperand;
      const left = state.op ? state.acc : rawNumber();
      const result = applyBinary(left, right, operation);
      if (!Number.isFinite(result)) return setNumber(t('ui.b859c7be7501'));
      addTape(`${cleanNumber(left)} ${operation} ${cleanNumber(right)} = ${cleanNumber(result)}`, result);
      state.cur = cleanNumber(result);
      state.lastOp = operation;
      state.lastOperand = right;
      state.acc = null;
      state.op = null;
      state.fresh = true;
      refresh();
      if (state.speechResults) speak(formatDisplay(state.cur));
    };
    const unary = (action, label = action) => {
      let original;
      let value;
      if (state.rpn && state.fresh && state.stack.length) {
        original = state.stack.at(-1);
        value = original;
      } else {
        original = rawNumber();
        value = original;
      }
      switch (action) {
        case 'sign': value = -value; break;
        case 'percent': value /= 100; break;
        case 'square': value **= 2; break;
        case 'cube': value **= 3; break;
        case 'sqrt': value = value < 0 ? NaN : Math.sqrt(value); break;
        case 'cbrt': value = Math.cbrt(value); break;
        case 'reciprocal': value = value === 0 ? NaN : 1/value; break;
        case 'factorial': {
          if (value < 0 || value > 170 || !Number.isInteger(value)) value = NaN;
          else { let result = 1; for (let number = 2; number <= value; number++) result *= number; value = result; }
          break;
        }
        case 'ln': value = value <= 0 ? NaN : Math.log(value); break;
        case 'log10': value = value <= 0 ? NaN : Math.log10(value); break;
        case 'exp': value = Math.exp(value); break;
        case 'pow10': value = 10 ** value; break;
        case 'sin': value = Math.sin(angleToRadians(value)); break;
        case 'cos': value = Math.cos(angleToRadians(value)); break;
        case 'tan': value = Math.tan(angleToRadians(value)); break;
        case 'asin': value = value < -1 || value > 1 ? NaN : radiansToAngle(Math.asin(value)); break;
        case 'acos': value = value < -1 || value > 1 ? NaN : radiansToAngle(Math.acos(value)); break;
        case 'atan': value = radiansToAngle(Math.atan(value)); break;
        case 'sinh': value = Math.sinh(value); break;
        case 'cosh': value = Math.cosh(value); break;
        case 'tanh': value = Math.tanh(value); break;
        case 'abs': value = Math.abs(value); break;
        default: break;
      }
      if (!Number.isFinite(value)) return setNumber(t('ui.b859c7be7501'));
      if (state.rpn && state.fresh && state.stack.length) state.stack[state.stack.length - 1] = value;
      state.cur = cleanNumber(value);
      state.fresh = true;
      addTape(`${label}(${cleanNumber(original)}) = ${cleanNumber(value)}`, value);
      if (state.second && /^(a?(sin|cos|tan))$/.test(action)) state.second = false;
      refresh();
      if (state.speechResults) speak(formatDisplay(state.cur));
    };

    const applyProgrammer = (left, right, operation) => {
      const shift = Number(right % BigInt(programmer.wordSize));
      switch (operation) {
        case '+': return left + right;
        case '−': return left - right;
        case '×': return left * right;
        case '÷': return right === 0n ? null : left / right;
        case 'mod': return right === 0n ? null : left % right;
        case 'and': return left & right;
        case 'or': return left | right;
        case 'xor': return left ^ right;
        case '<<': return left << BigInt(shift);
        case '>>': return BigInt.asUintN(programmer.wordSize, left) >> BigInt(shift);
        default: return right;
      }
    };
    const setProgrammerBinary = (operation) => {
      if (programmer.error) return;
      if (programmer.op && !programmer.fresh) {
        const result = applyProgrammer(programmer.acc, programmer.value, programmer.op);
        if (result === null) {
          programmer.error = true; return refresh();
        }
        programmer.acc = maskProgrammer(result);
        programmer.value = programmer.acc;
      } else if (programmer.acc === null) programmer.acc = programmer.value;
      programmer.op = operation;
      programmer.fresh = true;
      refresh();
    };
    const programmerEquals = () => {
      if (!programmer.op || programmer.error) return;
      const left = programmer.acc;
      const right = programmer.value;
      const operation = programmer.op;
      const result = applyProgrammer(left, right, operation);
      if (result === null) {
        programmer.error = true; return refresh();
      }
      programmer.value = maskProgrammer(result);
      programmer.input = programValueText();
      programmer.acc = null; programmer.op = null; programmer.fresh = true;
      addTape(`${left.toString(programmer.base).toUpperCase()} ${operation} ${right.toString(programmer.base).toUpperCase()} = ${programValueText()}`, programmer.value);
      refresh();
      if (state.speechResults) speak(programValueText());
    };

    const makeKey = (spec) => {
      const button = el('button', `calc-aqua-key${spec.kind ? ` ${spec.kind}` : ''}${spec.active ? ' active' : ''}`, spec.label);
      button.type = 'button';
      button.dataset.action = spec.action;
      if (spec.span) button.style.gridColumn = `span ${spec.span}`;
      if (spec.disabled) button.disabled = true;
      if (spec.title) button.title = spec.title;
      return button;
    };
    const renderKeyboard = () => {
      keyboard.innerHTML = '';
      keyboard.className = `calc-keyboard ${state.mode}`;
      programMeta.hidden = state.mode !== 'programmer';
      if (state.mode === 'basic') {
        [
          {label:'C',action:'clear',kind:'function'},{label:'±',action:'unary:sign',kind:'function'},
          {label:'%',action:'unary:percent',kind:'function'},{label:'÷',action:'binary:÷',kind:'operator'},
          {label:'7',action:'digit:7'},{label:'8',action:'digit:8'},{label:'9',action:'digit:9'},{label:'×',action:'binary:×',kind:'operator'},
          {label:'4',action:'digit:4'},{label:'5',action:'digit:5'},{label:'6',action:'digit:6'},{label:'−',action:'binary:−',kind:'operator'},
          {label:'1',action:'digit:1'},{label:'2',action:'digit:2'},{label:'3',action:'digit:3'},{label:'+',action:'binary:+',kind:'operator'},
          {label:'0',action:'digit:0',span:2},{label:'.',action:'digit:.'},{label:state.rpn?'Enter':'=',action:'equals',kind:'operator'},
        ].forEach((spec) => keyboard.appendChild(makeKey(spec)));
      } else if (state.mode === 'scientific') {
        const trig = (name) => state.second ? {label:`${name}⁻¹`,action:`unary:a${name}`} : {label:name,action:`unary:${name}`};
        [
          {label:'(',action:'paren:left',kind:'function'},{label:')',action:'paren:right',kind:'function'},
          {label:'mc',action:'memory-clear',kind:'function',active:state.memory!==0},{label:'m+',action:'memory-add',kind:'function'},
          {label:'m−',action:'memory-subtract',kind:'function'},{label:'mr',action:'memory-recall',kind:'function'},
          {label:'C',action:'clear',kind:'function'},{label:'±',action:'unary:sign',kind:'function'},{label:'%',action:'unary:percent',kind:'function'},{label:'÷',action:'binary:÷',kind:'operator'},
          {label:'2nd',action:'toggle-second',kind:'function',active:state.second},{label:'x²',action:'unary:square',kind:'function'},
          {label:'x³',action:'unary:cube',kind:'function'},{label:'xʸ',action:'binary:xʸ',kind:'function'},
          {label:'eˣ',action:'unary:exp',kind:'function'},{label:'10ˣ',action:'unary:pow10',kind:'function'},
          {label:'7',action:'digit:7'},{label:'8',action:'digit:8'},{label:'9',action:'digit:9'},{label:'×',action:'binary:×',kind:'operator'},
          {label:'1/x',action:'unary:reciprocal',kind:'function'},{label:'√x',action:'unary:sqrt',kind:'function'},
          {label:'∛x',action:'unary:cbrt',kind:'function'},{label:'ʸ√x',action:'binary:ʸ√x',kind:'function'},
          {label:'ln',action:'unary:ln',kind:'function'},{label:'log₁₀',action:'unary:log10',kind:'function'},
          {label:'4',action:'digit:4'},{label:'5',action:'digit:5'},{label:'6',action:'digit:6'},{label:'−',action:'binary:−',kind:'operator'},
          {label:'x!',action:'unary:factorial',kind:'function'},trig('sin'),trig('cos'),trig('tan'),
          {label:'sinh',action:'unary:sinh',kind:'function'},{label:'cosh',action:'unary:cosh',kind:'function'},
          {label:'1',action:'digit:1'},{label:'2',action:'digit:2'},{label:'3',action:'digit:3'},{label:'+',action:'binary:+',kind:'operator'},
          {label:state.angle.toUpperCase(),action:'cycle-angle',kind:'function'},{label:'π',action:'constant:pi',kind:'function'},
          {label:'e',action:'constant:e',kind:'function'},{label:'EE',action:'exponent',kind:'function'},
          {label:'Rand',action:'random',kind:'function'},{label:'⌫',action:'backspace',kind:'function'},
          {label:'0',action:'digit:0',span:2},{label:'.',action:'digit:.'},{label:state.rpn?'Enter':'=',action:'equals',kind:'operator'},
        ].forEach((spec) => keyboard.appendChild(makeKey(spec)));
      } else {
        const digitDisabled = (digit) => parseInt(digit,16) >= programmer.base;
        [
          ...['A','B','C','D','E','F'].map((digit) => ({label:digit,action:`digit:${digit}`,kind:'hex',disabled:digitDisabled(digit)})),
          {label:'and',action:'program-binary:and',kind:'function'},{label:'or',action:'program-binary:or',kind:'function'},
          {label:'xor',action:'program-binary:xor',kind:'function'},{label:'not',action:'program-not',kind:'function'},
          {label:'<<',action:'program-binary:<<',kind:'function'},{label:'>>',action:'program-binary:>>',kind:'function'},
          {label:'C',action:'clear',kind:'function'},{label:'±',action:'program-sign',kind:'function'},
          {label:'mod',action:'program-binary:mod',kind:'function'},{label:'7',action:'digit:7',disabled:digitDisabled('7')},
          {label:'8',action:'digit:8',disabled:digitDisabled('8')},{label:'9',action:'digit:9',disabled:digitDisabled('9')},
          {label:'⌫',action:'backspace',kind:'function'},{label:'4',action:'digit:4',disabled:digitDisabled('4')},
          {label:'5',action:'digit:5',disabled:digitDisabled('5')},{label:'6',action:'digit:6',disabled:digitDisabled('6')},
          {label:'×',action:'program-binary:×',kind:'operator'},{label:'÷',action:'program-binary:÷',kind:'operator'},
          {label:'0',action:'digit:0',disabled:digitDisabled('0')},{label:'1',action:'digit:1',disabled:digitDisabled('1')},
          {label:'2',action:'digit:2',disabled:digitDisabled('2')},{label:'3',action:'digit:3',disabled:digitDisabled('3')},
          {label:'+',action:'program-binary:+',kind:'operator'},{label:'−',action:'program-binary:−',kind:'operator'},
          {label:'=',action:'program-equals',kind:'operator',span:6},
        ].forEach((spec) => keyboard.appendChild(makeKey(spec)));
      }
    };

    const refresh = () => {
      root.dataset.mode = state.mode;
      if (state.mode === 'programmer') {
        display.textContent = programmer.error ? t('ui.b859c7be7501') : programValueText();
        lcdStatus.textContent = `${programmer.base === 16 ? t('ui.8e35f2b9f3ff') : programmer.base === 10 ? t('ui.bfa03483a252') : programmer.base === 8 ? t('ui.bfc2c4a3918c') : t('ui.78ff74e37b12')} · ${programmer.wordSize}-bit`;
        rpnStack.hidden = true;
        displayProgramBits();
        baseSwitch.querySelectorAll('[data-base]').forEach((button) => {
          button.classList.toggle('sel',Number(button.dataset.base) === programmer.base);
        });
        wordSize.value = String(programmer.wordSize);
      } else {
        display.textContent = formatDisplay(state.cur);
        lcdStatus.textContent = `${state.mode === 'scientific' ? state.angle.toUpperCase() : ''}${state.op ? `  ${state.op}` : ''}${state.memory ? '  M' : ''}`;
        rpnStack.hidden = !state.rpn;
        if (state.rpn) {
          const visible = [...state.stack, ...(!state.fresh && finite(state.cur) ? [rawNumber()] : [])].slice(-3);
          rpnStack.innerHTML = visible.map((value,index) => `<span><b>${visible.length-index}</b>${formatDisplay(cleanNumber(value))}</span>`).join('');
        }
      }
      keyboard.querySelectorAll('.operator').forEach((button) => {
        const operation = button.dataset.action?.split(':')[1];
        button.classList.toggle('selected', operation && (state.mode === 'programmer' ? programmer.op === operation : state.op === operation));
      });
      updateDatasets();
    };
    const updateDatasets = () => {
      [mainWindow,tapeWindow].filter(Boolean).forEach((win) => {
        win.dataset.calculatorMode = state.mode;
        win.dataset.calculatorTape = String(!!tapeWindow?.isConnected);
        win.dataset.calculatorRpn = String(state.rpn);
        win.dataset.calculatorGrouping = String(state.grouping);
        win.dataset.calculatorHasTape = String(!!tapeText().trim());
        win.dataset.calculatorSpeechKeys = String(state.speechKeys);
        win.dataset.calculatorSpeechResults = String(state.speechResults);
        win.dataset.calculatorDecimals = String(state.decimals);
        win.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
      });
    };
    const fitWindowForMode = () => {
      if (!mainWindow?.isConnected) return;
      const dimensions = state.mode === 'basic' ? [238,334] : state.mode === 'scientific' ? [535,398] : [570,478];
      const oldWidth = mainWindow.getBoundingClientRect().width;
      mainWindow.style.width = `${Math.min(dimensions[0],innerWidth-24)}px`;
      mainWindow.style.height = `${Math.min(dimensions[1],innerHeight-70)}px`;
      mainWindow.style.left = `${Math.max(6,Math.min(innerWidth-dimensions[0]-6,parseFloat(mainWindow.style.left)-(dimensions[0]-oldWidth)/2))}px`;
      mainWindow.style.top = `${Math.max(25,Math.min(innerHeight-dimensions[1]-36,parseFloat(mainWindow.style.top)))}px`;
    };
    const setMode = (mode) => {
      if (!['basic','scientific','programmer'].includes(mode)) return;
      state.mode = mode;
      state.op = null; state.acc = null; state.fresh = true; state.second = false; state.parens = [];
      programmer.op = null; programmer.acc = null; programmer.fresh = true;
      if (mode === 'programmer') state.rpn = false;
      renderKeyboard();
      fitWindowForMode();
      refresh();
      persist();
    };
    const setProgrammerBase = (base) => {
      programmer.base = Number(base);
      programmer.input = programValueText();
      programmer.fresh = true;
      renderKeyboard();
      refresh();
      persist();
    };

    const recalculateTape = () => {
      const lines = tapeArea.value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      tape.length = 0;
      lines.forEach((line) => {
        const match = line.match(/^(-?[\d.e+]+)\s*([+\-−*×/÷])\s*(-?[\d.e+]+)\s*=/i);
        if (!match) {
          tape.push({text:line,result:''});
          return;
        }
        const operation = ({'-':'−','*':'×','/':'÷'})[match[2]] || match[2];
        const result = applyBinary(Number(match[1]),Number(match[3]),operation);
        tape.push({text:`${match[1]} ${operation} ${match[3]} = ${cleanNumber(result)}`,result:cleanNumber(result)});
      });
      syncTape(true);
      updateDatasets();
      Leopard.toast(t('ui.bbbf3aed4356'), t('calc.tapeRecalc'));
    };
    const openPaperTape = () => {
      if (tapeWindow?.isConnected) {
        System.focusWindow(tapeWindow);
        return;
      }
      const content = el('div','calculator-tape');
      content.innerHTML = `<header><b>${t('ui.7f6102c06772')}</b><span>${t('ui.355bb22b289f')}</span></header><textarea aria-label="${t('ui.be204365e1bc')}" spellcheck="false"></textarea><footer><button class="aqua-btn tape-clear">${t('ui.7b15e5e8e7bd')}</button><button class="aqua-btn tape-recalculate">${t('ui.072a0843f15e')}</button></footer>`;
      tapeArea = content.querySelector('textarea');
      tapeWindow = System.createWindow({
        app:'calculator',title:t('ui.7f6102c06772'),width:315,height:430,content,noResize:true,
        onClose:() => {
          if (tapeArea?.value.trim()) {
            tape.length = 0;
            tapeArea.value.split(/\n+/).filter(Boolean).forEach((text) => tape.push({text,result:''}));
          }
          tapeArea = null;
          setTimeout(() => { tapeWindow = null; updateDatasets(); },0);
          return true;
        },
      });
      content.querySelector('.tape-clear').addEventListener('click',() => {
        tape.length = 0; tapeArea.value = ''; updateDatasets();
      });
      content.querySelector('.tape-recalculate').addEventListener('click',recalculateTape);
      tapeArea.addEventListener('input',updateDatasets);
      tapeWindow.addEventListener('leopard-command',handleCommand);
      syncTape(true);
      updateDatasets();
    };
    const closePaperTape = () => {
      if (tapeWindow?.isConnected) System.closeWindow(tapeWindow);
    };
    const saveTape = () => {
      const text = tapeText();
      if (!text.trim()) return System.beep();
      System.savePanel({
        parent:parentWindow(),title:t('ui.0d1cd5c8f66b'),startPath: paths.documents,
        name:VFS.uniqueName(paths.documents, t('calc.tapeFile', { date: new Date().toISOString().slice(0,10) }),'.txt'),
        extension:'txt',typeLabel:t('ui.0373f454fa15'),allowOverwrite:true,
        onSave:(path) => {
          const savedNode = VFS.putNode(path,{type:'file',kind:'document',mime:'text/plain',content:`${text}\n`,creator:'calculator',generated:true});
          if (savedNode) {
            System.addRecentDocument?.(path,'calculator');
            Leopard.toast(t('ui.bbbf3aed4356'), t('calc.tapeSaved', { name: VFS.baseName(path) }));
          }
          return savedNode;
        },
      });
    };
    const printTape = () => {
      const lines = tapeText().split('\n').filter(Boolean).slice(0,32);
      if (!lines.length) return System.beep();
      const commands = ['BT /F1 19 Tf 58 786 Td (Calculator Paper Tape) Tj','0 -31 Td /F1 10 Tf'];
      lines.forEach((line) => commands.push(`0 -18 Td (${escapePdf(normalizeTapeText(line).slice(0,80))}) Tj`));
      commands.push('ET');
      const stream = commands.join('\n');
      const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      ];
      let pdf = '%PDF-1.4\n';
      const offsets = [0];
      objects.forEach((body,index) => {
        offsets.push(pdf.length);
        pdf += `${index+1} 0 obj\n${body}\nendobj\n`;
      });
      const xref = pdf.length;
      pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
      offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10,'0')} 00000 n \n`; });
      pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const path = `${paths.downloads}/${VFS.uniqueName(paths.downloads, t('calc.tapeFile', { date: new Date().toISOString().slice(0,10) }),'.pdf')}`;
      VFS.putNode(path,{type:'file',kind:'pdf',mime:'application/pdf',src:`data:application/pdf;base64,${btoa(pdf)}`,creator:'calculator',generated:true});
      System.addRecentDocument?.(path,'calculator');
      Leopard.toast('Web PDF Printer', t('calc.tapePrinted', { name: VFS.baseName(path) }));
    };

    const showConverter = (initialCategory = converterCategory) => {
      converterCategory = conversionGroups[initialCategory] ? initialCategory : 'length';
      const pane = el('div','calculator-converter');
      pane.innerHTML = `<p>${t('calc.convertHelp')}</p><label><span>${t('calc.category')}</span><select class="spp-select convert-category"></select></label><label><span>${t('calc.from')}</span><select class="spp-select convert-from"></select></label><label><span>${t('calc.to')}</span><select class="spp-select convert-to"></select></label><label><span>${t('calc.input')}</span><input class="aqua-input convert-input" inputmode="decimal"></label><label><span>${t('calc.result')}</span><output class="convert-output">0</output></label><small>${t('calc.convertNote')}</small>`;
      const category = pane.querySelector('.convert-category');
      const from = pane.querySelector('.convert-from');
      const to = pane.querySelector('.convert-to');
      const input = pane.querySelector('.convert-input');
      const output = pane.querySelector('.convert-output');
      Object.entries(conversionGroups).forEach(([id,group]) => category.add(new Option(group.name,id)));
      category.value = converterCategory;
      input.value = state.mode === 'programmer' ? Number(programmer.value) : (finite(state.cur) ? rawNumber() : 0);
      const fillUnits = () => {
        const group = conversionGroups[category.value];
        const units = Array.isArray(group.units) ? group.units : Object.keys(group.units);
        from.innerHTML = ''; to.innerHTML = '';
        units.forEach((unit) => { from.add(new Option(unit,unit)); to.add(new Option(unit,unit)); });
        to.selectedIndex = Math.min(1,units.length-1);
        update();
      };
      const update = () => {
        const value = Number(input.value);
        const group = conversionGroups[category.value];
        let result = NaN;
        if (Number.isFinite(value)) {
          if (group.convert) result = group.convert(value,from.value,to.value);
          else result = value * group.units[from.value] / group.units[to.value];
        }
        output.value = output.textContent = Number.isFinite(result) ? cleanNumber(result) : t('calc.invalidNumber');
      };
      category.addEventListener('change',() => { converterCategory=category.value;fillUnits(); });
      from.addEventListener('change',update); to.addEventListener('change',update); input.addEventListener('input',update);
      fillUnits();
      System.showSheet({
        parent:parentWindow(),title:t('ui.942742d7978e'),content:pane,className:'calculator-convert-sheet',initialFocus:input,
        buttons:[
          {label:t('ui.4d0b4688c787'),cancel:true},
          {label:t('ui.942742d7978e'),default:true,action:() => {
            const value = Number(output.textContent);
            if (!Number.isFinite(value)) return false;
            if (state.mode === 'programmer') setProgrammerValue(BigInt(Math.round(value)));
            else setNumber(value);
          }},
        ],
      });
    };

    const copyDisplay = async () => {
      const text = display.textContent;
      try { await navigator.clipboard.writeText(text); Leopard.toast(t('ui.bbbf3aed4356'),t('ui.ec0ddf341ec3')); }
      catch (error) { System.beep(); }
    };
    const pasteDisplay = async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim().replace(/,/g,'');
        if (state.mode === 'programmer') {
          const value = BigInt(text);
          setProgrammerValue(value);
        } else {
          const value = Number(text);
          if (!Number.isFinite(value)) throw new Error('not number');
          setNumber(value);
        }
      } catch (error) {
        System.alertBox(t('ui.2bf5fa04cbcf'),t('ui.0bf0126af145'));
      }
    };

    const toggleRpn = () => {
      if (state.mode === 'programmer') return System.beep();
      state.rpn = !state.rpn;
      state.op = null; state.acc = null; state.stack = [];
      state.fresh = true;
      renderKeyboard(); refresh(); persist();
    };
    const handleAction = (action, spokenLabel = '') => {
      if (state.speechKeys && spokenLabel) speak(spokenLabel);
      const [kind,value] = action.split(':');
      if (kind === 'digit') inputDigit(value);
      else if (kind === 'binary') setBinary(value);
      else if (kind === 'unary') unary(value,spokenLabel || value);
      else if (kind === 'program-binary') setProgrammerBinary(value);
      else if (action === 'program-equals') programmerEquals();
      else if (action === 'program-not') setProgrammerValue(~programmer.value);
      else if (action === 'program-sign') setProgrammerValue(-BigInt.asIntN(programmer.wordSize,programmer.value));
      else if (action === 'equals') equals();
      else if (action === 'clear') clearNumber();
      else if (action === 'backspace') backspace();
      else if (action === 'toggle-second') { state.second=!state.second;renderKeyboard();refresh(); }
      else if (action === 'cycle-angle') { state.angle=state.angle==='deg'?'rad':state.angle==='rad'?'grad':'deg';renderKeyboard();refresh();persist(); }
      else if (kind === 'constant') setNumber(value==='pi'?Math.PI:Math.E);
      else if (action === 'random') setNumber(Math.random(),false);
      else if (action === 'exponent') inputDigit('e');
      else if (action === 'memory-clear') { state.memory=0;refresh(); }
      else if (action === 'memory-add') { if(finite(state.cur))state.memory+=rawNumber();refresh(); }
      else if (action === 'memory-subtract') { if(finite(state.cur))state.memory-=rawNumber();refresh(); }
      else if (action === 'memory-recall') setNumber(state.memory);
      else if (action === 'paren:left') openParen();
      else if (action === 'paren:right') closeParen();
    };

    const commandActions = {
      'mode-basic':() => setMode('basic'),
      'mode-scientific':() => setMode('scientific'),
      'mode-programmer':() => setMode('programmer'),
      'toggle-paper-tape':() => tapeWindow?.isConnected ? closePaperTape() : openPaperTape(),
      'save-paper-tape':saveTape,
      'print-paper-tape':printTape,
      'copy-result':copyDisplay,
      'paste-number':pasteDisplay,
      'clear-calculator':clearNumber,
      'toggle-rpn':toggleRpn,
      'toggle-grouping':() => {state.grouping=!state.grouping;refresh();persist();},
      'decimals-auto':() => {state.decimals='auto';refresh();persist();},
      'decimals-0':() => {state.decimals=0;refresh();persist();},
      'decimals-2':() => {state.decimals=2;refresh();persist();},
      'decimals-5':() => {state.decimals=5;refresh();persist();},
      'decimals-9':() => {state.decimals=9;refresh();persist();},
      'convert-length':() => showConverter('length'),
      'convert-area':() => showConverter('area'),
      'convert-volume':() => showConverter('volume'),
      'convert-mass':() => showConverter('mass'),
      'convert-temperature':() => showConverter('temperature'),
      'convert-speed':() => showConverter('speed'),
      'convert-time':() => showConverter('time'),
      'convert-energy':() => showConverter('energy'),
      'convert-power':() => showConverter('power'),
      'convert-pressure':() => showConverter('pressure'),
      'toggle-speak-keys':() => {state.speechKeys=!state.speechKeys;updateDatasets();persist();},
      'toggle-speak-results':() => {state.speechResults=!state.speechResults;updateDatasets();persist();},
      'speak-result':() => speak(display.textContent),
      'stop-speaking':() => window.speechSynthesis?.cancel(),
    };
    function handleCommand(event) {
      const action = commandActions[event.detail?.command];
      if (!action) return;
      event.preventDefault();
      action();
    }

    keyboard.addEventListener('click',(event) => {
      const button = event.target.closest('[data-action]');
      if (button && !button.disabled) handleAction(button.dataset.action,button.textContent.trim());
    });
    baseSwitch.innerHTML = [['16','HEX'],['10','DEC'],['8','OCT'],['2','BIN']].map(([base,label]) => `<button data-base="${base}">${label}</button>`).join('');
    baseSwitch.addEventListener('click',(event) => {
      const button = event.target.closest('[data-base]');
      if (button) setProgrammerBase(button.dataset.base);
    });
    wordSize.value = String(programmer.wordSize);
    wordSize.addEventListener('change',() => {
      programmer.wordSize = Number(wordSize.value);
      setProgrammerValue(programmer.value);
      persist();
    });

    mainWindow = System.createWindow({
      app:'calculator',title:t('ui.bbbf3aed4356'),width:238,height:334,content:root,noResize:true,
      onClose:() => { window.speechSynthesis?.cancel(); return true; },
    });
    mainWindow.addEventListener('leopard-command',handleCommand);
    mainWindow.tabIndex = -1;
    mainWindow.addEventListener('mousedown',() => mainWindow.focus());
    mainWindow.addEventListener('keydown',(event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const key = event.key;
      let handled = true;
      if (/^[0-9]$/.test(key) || state.mode === 'programmer' && /^[a-f]$/i.test(key)) inputDigit(key.toUpperCase());
      else if (key === '.' && state.mode !== 'programmer') inputDigit('.');
      else if (key === '+' ) state.mode === 'programmer' ? setProgrammerBinary('+') : setBinary('+');
      else if (key === '-') state.mode === 'programmer' ? setProgrammerBinary('−') : setBinary('−');
      else if (key === '*') state.mode === 'programmer' ? setProgrammerBinary('×') : setBinary('×');
      else if (key === '/') state.mode === 'programmer' ? setProgrammerBinary('÷') : setBinary('÷');
      else if (key === 'Enter' || key === '=') state.mode === 'programmer' ? programmerEquals() : equals();
      else if (key === 'Escape' || key.toLowerCase() === 'c') clearNumber();
      else if (key === 'Backspace') backspace();
      else handled = false;
      if (handled) { event.preventDefault();event.stopPropagation(); }
    });

    setMode(state.mode);
    mainWindow.focus();
    return mainWindow;
  }

  System.registerApp({
    id:'calculator',name:t('ui.bbbf3aed4356'),icon,open,
    about:t('ui.36431d9fe61b'),
    keywords:t('ui.0db77f244536'),
  });
})();
