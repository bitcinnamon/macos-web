// iTunes — Leopard library UI with original, procedurally synthesized songs.
(() => {
  const { el } = System;
  const icon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="itunes-disc"><stop stop-color="#f9fbfd"/><stop offset=".13" stop-color="#89939e"/><stop offset=".16" stop-color="#eef4f8"/><stop offset=".48" stop-color="#a7d7e5"/><stop offset=".62" stop-color="#f4cae1"/><stop offset=".78" stop-color="#dbe7a8"/><stop offset="1" stop-color="#88949e"/></radialGradient><linearGradient id="itunes-note" x2="0" y2="1"><stop stop-color="#5aa9eb"/><stop offset="1" stop-color="#195d9d"/></linearGradient><filter id="itunes-shadow"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".4"/></filter></defs><g filter="url(#itunes-shadow)"><circle cx="31" cy="32" r="28" fill="url(#itunes-disc)" stroke="#65717c"/><circle cx="31" cy="32" r="6" fill="#f9fbfc" stroke="#7a8691"/><path d="M35 42V19l14-3v21" fill="none" stroke="#eff8ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 42V19l14-3v21" fill="none" stroke="url(#itunes-note)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="30" cy="43" rx="7" ry="5" fill="url(#itunes-note)" transform="rotate(-18 30 43)"/><ellipse cx="44" cy="38" rx="7" ry="5" fill="url(#itunes-note)" transform="rotate(-18 44 38)"/></g></svg>`;

  const FREQ = {};
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let octave = 1; octave <= 7; octave++) {
    NAMES.forEach((name, index) => {
      FREQ[name + octave] = 440 * Math.pow(2, (index - 9) / 12 + octave - 4);
    });
  }

  const TRACKS = [
    {
      name: '红雾回廊', artist: '幻想音源研究室', album: '弹幕幻想曲集', genre: '弹幕幻想原创', bpm: 168,
      color: ['#e35d69', '#46142a'], wave: 'square',
      melody: [['A4',.5],['C5',.5],['E5',.5],['D5',.5],['C5',.5],['A4',.5],['G#4',1],['E4',1],['A4',.5],['B4',.5],['C5',1],['E5',.5],['F5',.5],['E5',1],['D5',.5],['C5',.5],['B4',1],['G#4',1]],
      chords: [['A3','C4','E4'],['F3','A3','C4'],['D3','F3','A3'],['E3','G#3','B3']],
    },
    {
      name: '月下竹林', artist: '幻想音源研究室', album: '弹幕幻想曲集', genre: '弹幕幻想原创', bpm: 152,
      color: ['#b596e8', '#263b75'], wave: 'triangle',
      melody: [['E5',.5],['F#5',.5],['A5',1],['B5',.5],['A5',.5],['F#5',1],['E5',.5],['C#5',.5],['B4',1],['C#5',.5],['E5',.5],['F#5',1],['E5',.5],['C#5',.5],['B4',1],['A4',1]],
      chords: [['F#3','A3','C#4'],['D3','F#3','A3'],['E3','G#3','B3'],['C#3','E3','G#3']],
    },
    {
      name: '境界疾走', artist: '幻想音源研究室', album: '弹幕幻想曲集', genre: '弹幕幻想原创', bpm: 178,
      color: ['#ffcf62', '#76355f'], wave: 'square',
      melody: [['D5',.25],['F5',.25],['A5',.5],['C6',.5],['A5',.5],['G5',.25],['F5',.25],['E5',.5],['D5',.5],['A4',.5],['C5',.5],['D5',.5],['F5',.5],['E5',.5],['C5',.5],['A4',1]],
      chords: [['D3','F3','A3'],['A#2','D3','F3'],['C3','E3','G3'],['A2','C#3','E3']],
    },
    {
      name: '无声站台', artist: '雨线乐队（虚构）', album: '写不完的夏夜', genre: '青春情绪摇滚原创', bpm: 136,
      color: ['#61a8db', '#233a58'], wave: 'sawtooth',
      melody: [['E4',1],['G4',.5],['A4',1.5],['B4',1],['A4',1],['G4',2],['E4',1],['D4',1],['E4',1],['G4',1],['B4',1],['A4',1],['G4',2],['D4',2]],
      chords: [['C3','G3','E4'],['G2','D3','B3'],['A2','E3','C4'],['F2','C3','A3']],
    },
    {
      name: '雨后失真', artist: '雨线乐队（虚构）', album: '写不完的夏夜', genre: '青春情绪摇滚原创', bpm: 148,
      color: ['#8da1b5', '#342e52'], wave: 'sawtooth',
      melody: [['B4',.5],['A4',.5],['G4',1],['D5',1],['B4',1],['A4',2],['E4',1],['G4',1],['A4',1],['B4',1],['D5',.5],['E5',.5],['D5',1],['B4',2]],
      chords: [['G2','D3','B3'],['D3','A3','F#4'],['E3','B3','G4'],['C3','G3','E4']],
    },
    {
      name: '写不完的夏夜', artist: '雨线乐队（虚构）', album: '写不完的夏夜', genre: '青春情绪摇滚原创', bpm: 126,
      color: ['#ed8a71', '#5c2c55'], wave: 'triangle',
      melody: [['A4',1],['C5',1],['E5',2],['D5',1],['C5',1],['A4',2],['G4',1],['A4',1],['C5',1],['D5',1],['E5',2],['C5',1],['A4',1],['G4',2]],
      chords: [['A2','E3','C4'],['F2','C3','A3'],['C3','G3','E4'],['G2','D3','B3']],
    },
    {
      name: '玻璃海的信号', artist: 'L-39 合成歌手', album: '零点蓝光', genre: '歌声合成器原创', bpm: 150,
      color: ['#58d5d0', '#245a86'], wave: 'vocal',
      melody: [['C5',.5],['E5',.5],['G5',1],['A5',.5],['G5',.5],['E5',1],['D5',.5],['E5',.5],['G5',1],['E5',.5],['D5',.5],['C5',1],['A4',1],['C5',1]],
      chords: [['C3','E3','G3'],['A2','C3','E3'],['F2','A2','C3'],['G2','B2','D3']],
    },
    {
      name: '零点蓝光', artist: 'L-39 合成歌手', album: '零点蓝光', genre: '歌声合成器原创', bpm: 160,
      color: ['#4e89e6', '#32286e'], wave: 'vocal',
      melody: [['F#4',.5],['A4',.5],['C#5',.5],['E5',.5],['F#5',1],['E5',1],['C#5',.5],['B4',.5],['A4',1],['C#5',.5],['E5',.5],['F#5',1],['A5',1],['E5',1],['C#5',2]],
      chords: [['F#2','C#3','A3'],['D3','A3','F#4'],['A2','E3','C#4'],['E3','B3','G#4']],
    },
    {
      name: '未命名的明天', artist: 'L-39 合成歌手', album: '零点蓝光', genre: '歌声合成器原创', bpm: 142,
      color: ['#86e7c2', '#3c467e'], wave: 'vocal',
      melody: [['D5',1],['E5',.5],['F#5',.5],['A5',1],['F#5',1],['E5',2],['B4',1],['D5',1],['E5',1],['F#5',1],['A5',.5],['B5',.5],['A5',1],['F#5',2]],
      chords: [['D3','F#3','A3'],['B2','D3','F#3'],['G2','B2','D3'],['A2','C#3','E3']],
    },
  ];
  const SONG_LOOPS = 4;

  let audio = null;
  let master = null;
  let playing = -1;
  let selected = 0;
  let stopPlayback = null;
  let currentUI = null;
  let playGeneration = 0;
  let equalizerFilters = [];
  let enhancerNode = null;
  const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const PLAYER_STATE_KEY = 'macweb.itunes.player-state.v1';

  function ensureAudio() {
    if (!audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audio = new AudioCtx();
      master = audio.createGain();
      master.gain.value = .2;
      enhancerNode = audio.createDynamicsCompressor();
      enhancerNode.threshold.value = -18;
      enhancerNode.ratio.value = 5;
      let chain = master;
      equalizerFilters = EQ_BANDS.map((frequency) => {
        const filter = audio.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1.1;
        filter.gain.value = 0;
        chain.connect(filter);
        chain = filter;
        return filter;
      });
      chain.connect(enhancerNode);
      enhancerNode.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume();
  }

  function envelope(gain, start, duration, peak = .17, attack = .018) {
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(attack, duration * .25));
    gain.gain.setValueAtTime(peak * .78, start + duration * .62);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration * .94);
  }

  function tone(note, start, duration, track, destination = master, level = .16) {
    if (!FREQ[note]) return [];
    const nodes = [];
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(track.wave === 'sawtooth' ? 1750 : 2800, start);
    filter.Q.value = track.wave === 'vocal' ? 7 : 1.2;
    filter.connect(gain);
    gain.connect(destination);
    const voices = track.wave === 'vocal'
      ? [{ type: 'sawtooth', detune: -7, level: level * .62 }, { type: 'square', detune: 7, level: level * .32 }]
      : [{ type: track.wave, detune: 0, level }];
    envelope(gain, start, duration, voices.reduce((sum, voice) => sum + voice.level, 0));
    voices.forEach((voice) => {
      const osc = audio.createOscillator();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(FREQ[note], start);
      osc.detune.value = voice.detune;
      if (track.wave === 'vocal') {
        const vibrato = audio.createOscillator();
        const vibratoGain = audio.createGain();
        vibrato.frequency.value = 5.3;
        vibratoGain.gain.value = 10;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.detune);
        vibrato.start(start);
        vibrato.stop(start + duration);
        nodes.push(vibrato);
      }
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + duration);
      nodes.push(osc);
    });
    return nodes;
  }

  function kick(start, destination = master) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.setValueAtTime(145, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + .11);
    gain.gain.setValueAtTime(.34, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .16);
    osc.connect(gain); gain.connect(destination);
    osc.start(start); osc.stop(start + .17);
    return osc;
  }

  function noiseHit(start, duration, level, highpass, destination = master) {
    const length = Math.ceil(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    filter.type = 'highpass'; filter.frequency.value = highpass;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(destination);
    source.start(start); source.stop(start + duration);
    return source;
  }

  function durationOf(track) {
    const beats = track.melody.reduce((sum, [, duration]) => sum + duration, 0);
    return beats * SONG_LOOPS * 60 / track.bpm;
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function stop(fadeSeconds = 0) {
    if (!stopPlayback) return;
    const fn = stopPlayback;
    stopPlayback = null;
    fn(fadeSeconds);
  }

  function playTrack(index, ui = currentUI) {
    const crossfade = !!stopPlayback && !!ui?.preferences?.crossfade;
    stop(crossfade ? .55 : 0);
    if (!ui) return;
    ensureAudio();
    master.gain.setValueAtTime(Number(ui.volume?.value || 32) / 100 * .58, audio.currentTime);
    ui.applyPreferences?.();
    const generation = ++playGeneration;
    const track = TRACKS[index];
    playing = index;
    selected = index;
    const beat = 60 / track.bpm;
    const start = audio.currentTime + .06;
    const loops = SONG_LOOPS;
    const loopBeats = track.melody.reduce((sum, [, duration]) => sum + duration, 0);
    const total = loopBeats * loops * beat;
    const nodes = [];
    const trackBus = audio.createGain();
    trackBus.gain.setValueAtTime(crossfade ? .0001 : 1, audio.currentTime);
    trackBus.connect(master);
    if (crossfade) trackBus.gain.exponentialRampToValueAtTime(1, audio.currentTime + .55);

    for (let loop = 0; loop < loops; loop++) {
      let cursor = start + loop * loopBeats * beat;
      track.melody.forEach(([note, beats]) => {
        nodes.push(...tone(note, cursor, beats * beat * .98, track, trackBus));
        cursor += beats * beat;
      });
    }
    const bars = Math.ceil(loopBeats * loops / 4);
    for (let bar = 0; bar < bars; bar++) {
      const chord = track.chords[bar % track.chords.length];
      const barStart = start + bar * 4 * beat;
      chord.forEach((note) => nodes.push(...tone(note, barStart, beat * 3.9, { ...track, wave: 'triangle' }, trackBus, .04)));
      nodes.push(...tone(chord[0], barStart, beat * 1.7, { ...track, wave: 'sine' }, trackBus, .09));
      nodes.push(...tone(chord[0], barStart + 2 * beat, beat * 1.7, { ...track, wave: 'sine' }, trackBus, .08));
      for (let step = 0; step < 8; step++) {
        const when = barStart + step * beat / 2;
        if (step === 0 || step === 4) nodes.push(kick(when, trackBus));
        if (step === 2 || step === 6) nodes.push(noiseHit(when, .11, .12, 900, trackBus));
        else nodes.push(noiseHit(when, .035, .025, 5500, trackBus));
      }
    }

    const timer = setInterval(() => {
      const elapsed = Math.max(0, audio.currentTime - start);
      const progress = Math.min(1, elapsed / total);
      ui.progress.style.width = `${progress * 100}%`;
      ui.elapsed.textContent = formatTime(elapsed);
      ui.remaining.textContent = `−${formatTime(total - elapsed)}`;
      if (progress >= 1 && generation === playGeneration) {
        stop();
        const next = ui.repeatOne ? index
          : ui.shuffle ? Math.floor(Math.random() * TRACKS.length)
            : (index + 1) % TRACKS.length;
        playTrack(next, ui);
      }
    }, 80);
    stopPlayback = (fadeSeconds = 0) => {
      clearInterval(timer);
      const finish = () => {
        nodes.forEach((node) => { try { node.stop(); } catch (error) {} });
        try { trackBus.disconnect(); } catch (error) {}
      };
      if (fadeSeconds > 0) {
        const now = audio.currentTime;
        trackBus.gain.cancelScheduledValues(now);
        trackBus.gain.setValueAtTime(Math.max(.0001, trackBus.gain.value), now);
        trackBus.gain.exponentialRampToValueAtTime(.0001, now + fadeSeconds);
        setTimeout(finish, fadeSeconds * 1000 + 40);
      } else finish();
      if (generation === playGeneration) {
        playing = -1;
        updateUI(ui);
      }
    };
    updateUI(ui);
  }

  function updateUI(ui) {
    ui.rows.forEach((row) => {
      const index = Number(row.dataset.index);
      row.classList.toggle('sel', index === selected);
      row.classList.toggle('playing', index === playing);
      row.querySelector('.it-state').textContent = index === playing ? '▶' : '';
    });
    const track = TRACKS[playing >= 0 ? playing : selected];
    ui.title.textContent = playing >= 0 ? track.name : 'iTunes';
    ui.subtitle.textContent = playing >= 0 ? `${track.artist} — ${track.album}` : 'Leopard Web 原创音乐库';
    ui.play.textContent = playing >= 0 ? '❚❚' : '▶';
    ui.art.style.setProperty('--art-a', track.color[0]);
    ui.art.style.setProperty('--art-b', track.color[1]);
    ui.art.querySelector('b').textContent = track.name;
  }

  function showEqualizer() {
    ensureAudio();
    const panel = el('div', 'itunes-equalizer');
    const header = el('header');
    const enabled = el('label');
    const enabledCheck = el('input');
    enabledCheck.type = 'checkbox';
    enabledCheck.checked = true;
    enabled.append(enabledCheck, document.createTextNode(' 开启'));
    const preset = el('select', 'aqua-input');
    [['flat','平直'],['rock','摇滚'],['electronic','电子'],['vocal','人声增强'],['bass','低音增强']].forEach(([value,label]) => {
      const option = el('option', '', label); option.value = value; preset.appendChild(option);
    });
    header.append(enabled, preset);
    const bands = el('div', 'itunes-eq-bands');
    const sliders = EQ_BANDS.map((frequency, index) => {
      const label = el('label');
      const value = el('span', '', '0');
      const slider = el('input');
      slider.type = 'range'; slider.min = '-12'; slider.max = '12'; slider.step = '1'; slider.value = String(equalizerFilters[index]?.gain.value || 0);
      const name = frequency >= 1000 ? `${frequency / 1000}K` : String(frequency);
      label.append(value, slider, el('small', '', name));
      slider.addEventListener('input', () => {
        value.textContent = `${Number(slider.value) > 0 ? '+' : ''}${slider.value}`;
        if (equalizerFilters[index]) equalizerFilters[index].gain.setTargetAtTime(enabledCheck.checked ? Number(slider.value) : 0, audio.currentTime, .03);
      });
      slider.dispatchEvent(new Event('input'));
      bands.appendChild(label);
      return slider;
    });
    const presets = {
      flat:[0,0,0,0,0,0,0,0,0,0],
      rock:[5,4,2,0,-2,-1,1,3,5,5],
      electronic:[4,3,0,-2,-1,1,2,1,4,5],
      vocal:[-2,-2,-1,1,3,5,4,2,0,-1],
      bass:[8,7,5,3,1,0,-1,-2,-2,-2],
    };
    preset.addEventListener('change', () => sliders.forEach((slider,index) => {
      slider.value = String(presets[preset.value][index]); slider.dispatchEvent(new Event('input'));
    }));
    enabledCheck.addEventListener('change', () => sliders.forEach((slider) => slider.dispatchEvent(new Event('input'))));
    panel.append(header, bands);
    System.createWindow({
      app:'itunes', title:'iTunes 均衡器', width:610, height:330, content:panel,
      noResize:true, bodyBg:'#d8d8d8',
      autoFitContent:{ minHeight:300, maxHeight:400 },
    });
  }

  function open() {
    let preferences = System.getAppPreferences?.('itunes') || {};
    let savedPlayerState = {};
    try { savedPlayerState = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || '{}'); } catch (error) {}
    if (preferences.rememberPosition !== false && Number.isInteger(savedPlayerState.selected) && TRACKS[savedPlayerState.selected]) {
      selected = savedPlayerState.selected;
    }
    const root = el('div', 'itunes-leopard');
    const top = el('header', 'it-player');
    const controls = el('div', 'it-controls');
    const previous = el('button', 'it-round', '◀◀');
    const play = el('button', 'it-round it-play', '▶');
    const next = el('button', 'it-round', '▶▶');
    controls.append(previous, play, next);
    const lcd = el('div', 'it-display');
    const title = el('b', '', 'iTunes');
    const subtitle = el('span', '', 'Leopard Web 原创音乐库');
    const trackLine = el('div', 'it-progress');
    const progress = el('i');
    trackLine.appendChild(progress);
    const elapsed = el('small', '', '0:00');
    const remaining = el('small', 'right', '−0:00');
    lcd.append(title, subtitle, trackLine, elapsed, remaining);
    const volume = el('input', 'it-volume');
    volume.type = 'range'; volume.min = '0'; volume.max = '100';
    volume.value = String(Math.max(0, Math.min(100, Number(savedPlayerState.volume) || 32)));
    const search = el('input', 'aqua-input aqua-search it-search');
    search.placeholder = '搜索';
    const playerTools = el('div', 'it-player-tools');
    playerTools.append(el('span', 'it-speaker', '🔈'), volume, search);
    top.append(controls, lcd, playerTools);

    const body = el('div', 'it-library');
    const sidebar = el('aside', 'it-source-list');
    sidebar.innerHTML = `<h4>资料库</h4><button data-filter="all" class="sel"><i>♫</i>音乐</button>
      <h4>播放列表</h4><button data-filter="弹幕幻想原创"><i>✦</i>弹幕幻想原创</button>
      <button data-filter="青春情绪摇滚原创"><i>⚡</i>青春情绪摇滚原创</button>
      <button data-filter="歌声合成器原创"><i>◉</i>歌声合成器原创</button>
      <div class="it-custom-playlists"></div>
      <h4>设备</h4><button data-filter="device"><i>▣</i>Leopard Web</button>`;
    const main = el('main', 'it-library-main');
    const album = el('section', 'it-album-head');
    const art = el('div', 'it-artwork');
    art.innerHTML = '<i>♫</i><b>红雾回廊</b><small>ORIGINAL</small>';
    const albumInfo = el('div');
    albumInfo.innerHTML = '<h2>原创演示曲库</h2><p>9 首歌曲 · 3 个风格播放列表</p><small>所有旋律与音色均由本项目原创并通过 WebAudio 实时合成；未收录商业录音。</small>';
    album.append(art, albumInfo);
    const table = el('div', 'it-song-table');
    const head = el('div', 'it-song-row it-song-head');
    head.innerHTML = '<span class="it-state"></span><span>#</span><span>名称</span><span>艺术家</span><span>专辑</span><span>类型</span><span>时间</span>';
    const list = el('div', 'it-song-list');
    table.append(head, list);
    main.append(album, table);
    body.append(sidebar, main);
    root.append(top, body);

    let filter = 'all';
    let query = '';
    let win = null;
    const PLAYLISTS_KEY = 'macweb.itunes.playlists.v1';
    let playlists = [];
    try { playlists = JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]'); } catch (error) { playlists = []; }
    if (!Array.isArray(playlists)) playlists = [];
    const rows = TRACKS.map((track, index) => {
      const row = el('button', 'it-song-row');
      row.dataset.index = String(index);
      row.dataset.genre = track.genre;
      row.innerHTML = `<span class="it-state"></span><span>${index + 1}</span><span>${track.name}</span><span>${track.artist}</span><span>${track.album}</span><span>${track.genre}</span><span>${formatTime(durationOf(track))}</span>`;
      row.addEventListener('click', () => { selected = index; updateUI(ui); });
      row.addEventListener('dblclick', () => playTrack(index, ui));
      list.appendChild(row);
      return row;
    });
    const ui = { rows, title, subtitle, progress, elapsed, remaining, play, art, volume, shuffle:false, repeatOne:false, preferences };
    currentUI = ui;
    const applyPreferences = () => {
      ui.preferences = preferences;
      root.classList.toggle('source-large', preferences.sourceTextSize === 'large');
      root.classList.toggle('genre-hidden', preferences.showGenre === false);
      if (enhancerNode && audio) {
        const enhanced = preferences.soundEnhancer !== false;
        enhancerNode.threshold.setTargetAtTime(enhanced ? -18 : 0, audio.currentTime, .03);
        enhancerNode.ratio.setTargetAtTime(enhanced ? 5 : 1, audio.currentTime, .03);
      }
    };
    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'itunes') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('itunes') || {};
      applyPreferences();
    };
    ui.applyPreferences = applyPreferences;
    document.addEventListener('app-preferences-changed', preferencesChanged);
    applyPreferences();

    const filterRows = () => {
      rows.forEach((row, index) => {
        const track = TRACKS[index];
        const playlist = filter.startsWith('playlist:') ? playlists.find(item => `playlist:${item.id}` === filter) : null;
        const matchesFilter = filter === 'all' || filter === 'device' || track.genre === filter || !!playlist?.tracks?.includes(index);
        const haystack = `${track.name} ${track.artist} ${track.album} ${track.genre}`.toLowerCase();
        row.hidden = !matchesFilter || !haystack.includes(query);
      });
    };
    const renderPlaylists = () => {
      const container = sidebar.querySelector('.it-custom-playlists');
      container.innerHTML = '';
      playlists.forEach((playlist) => {
        const button = el('button');
        button.dataset.filter = `playlist:${playlist.id}`;
        button.append(el('i', '', '♫'), document.createTextNode(playlist.name));
        container.appendChild(button);
      });
    };
    const newPlaylist = () => System.promptSheet({
      parent:win,title:'新建播放列表',message:'播放列表名称：',value:'未命名播放列表',okLabel:'创建',
      validate:name=>playlists.some(item=>item.name.toLowerCase()===name.toLowerCase())?'已经存在同名播放列表。':true,
      onOK:name=>{
        const playlist={id:Date.now(),name,tracks:[selected]};
        playlists.push(playlist);localStorage.setItem(PLAYLISTS_KEY,JSON.stringify(playlists));
        renderPlaylists();filter=`playlist:${playlist.id}`;filterRows();
        if(win)win.dataset.currentPlaylist=String(playlist.id);
        sidebar.querySelectorAll('button').forEach(item=>item.classList.toggle('sel',item.dataset.filter===filter));
      },
    });
    const deletePlaylist = () => {
      const id=Number(win?.dataset.currentPlaylist);const playlist=playlists.find(item=>item.id===id);
      if(!playlist)return;
      System.confirmSheet({
        parent:win,title:'删除播放列表',headline:`删除播放列表“${playlist.name}”？`,
        message:'歌曲仍会保留在 iTunes 资料库中。',okLabel:'删除',danger:true,
        onOK:()=>{
          playlists=playlists.filter(item=>item.id!==id);localStorage.setItem(PLAYLISTS_KEY,JSON.stringify(playlists));
          filter='all';win.dataset.currentPlaylist='';renderPlaylists();filterRows();
          sidebar.querySelectorAll('button').forEach(item=>item.classList.toggle('sel',item.dataset.filter==='all'));
        },
      });
    };
    renderPlaylists();
    sidebar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      filter = button.dataset.filter;
      if(win)win.dataset.currentPlaylist=filter.startsWith('playlist:')?filter.slice('playlist:'.length):'';
      sidebar.querySelectorAll('button').forEach((item) => item.classList.toggle('sel', item === button));
      filterRows();
    });
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); filterRows(); });
    play.addEventListener('click', () => {
      if (playing >= 0) { stop(); return; }
      playTrack(selected, ui);
    });
    const stepTrack = (direction) => {
      selected = ui.shuffle ? Math.floor(Math.random() * TRACKS.length) : (selected + direction + TRACKS.length) % TRACKS.length;
      playTrack(selected, ui);
    };
    previous.addEventListener('click', () => stepTrack(-1));
    next.addEventListener('click', () => stepTrack(1));
    volume.addEventListener('input', () => {
      if (!master || !audio) return;
      master.gain.setTargetAtTime(Number(volume.value) / 100 * .58, audio.currentTime, .03);
    });
    updateUI(ui);
    win = System.createWindow({
      app: 'itunes', title: 'iTunes', width: 900, height: 590, content: root,
      statusbar: '9 首原创歌曲 · WebAudio 实时合成 · 未包含商业录音',
      onClose: () => {
        stop();
        document.removeEventListener('app-preferences-changed', preferencesChanged);
        if (preferences.rememberPosition !== false) {
          localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ selected, volume:Number(volume.value) }));
        } else localStorage.removeItem(PLAYER_STATE_KEY);
        currentUI = null;
        return true;
      },
    });
    win.dataset.shuffle = 'false';
    win.dataset.repeatOne = 'false';
    win.dataset.browserHidden = 'false';
    win.dataset.sidebarHidden = 'false';
    win.dataset.currentPlaylist = '';
    win.addEventListener('leopard-command', (event) => {
      const actions = {
        'new-playlist':newPlaylist,
        'delete-playlist':deletePlaylist,
        'toggle-browser':() => {
          album.hidden = !album.hidden; win.dataset.browserHidden = String(album.hidden);
        },
        'toggle-source-list':() => {
          root.classList.toggle('source-hidden');
          win.dataset.sidebarHidden = String(root.classList.contains('source-hidden'));
        },
        'play-pause':() => play.click(),
        'previous-track':() => previous.click(),
        'next-track':() => next.click(),
        'toggle-shuffle':() => {
          ui.shuffle = !ui.shuffle; win.dataset.shuffle = String(ui.shuffle);
          Leopard.toast('iTunes', ui.shuffle ? '随机播放已开启。' : '随机播放已关闭。');
        },
        'toggle-repeat-one':() => {
          ui.repeatOne = !ui.repeatOne; win.dataset.repeatOne = String(ui.repeatOne);
          Leopard.toast('iTunes', ui.repeatOne ? '将重复当前歌曲。' : '将继续播放下一首歌曲。');
        },
        'store-home':() => System.alertBox('iTunes Store','Leopard Web 不连接商业商店；本地资料库中的曲目均为项目原创合成音乐。'),
        'check-downloads':() => Leopard.toast('iTunes Store','没有可用的下载项目。'),
        'show-equalizer':showEqualizer,
        'get-artwork':() => Leopard.toast('iTunes','所有原创专辑插图均为最新。'),
      };
      const action = actions[event.detail?.command];
      if (action) { event.preventDefault(); action(); }
    });
  }

  System.registerApp({
    id: 'itunes', name: 'iTunes', icon, open,
    about: 'Leopard 风格资料库，含弹幕幻想、青春情绪摇滚与歌声合成器三类原创 WebAudio 曲目。',
    keywords: 'itunes music 音乐 播放 弹幕 摇滚 vocal synth',
  });
})();
