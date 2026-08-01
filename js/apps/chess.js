// 国际象棋 (Chess) — two-player board with legal move generation (basic rules)
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="4" fill="#ecd9b0" stroke="#6b5236" stroke-width="2"/><g fill="#a97c50">${[0,2,4,6].map(r => [0,2,4,6].map(c => `<rect x="${8 + (c + (r % 4 === 0 ? 1 : 0)) * 6}" y="${8 + r * 6}" width="6" height="6"/>`).join('')).join('')}</g><text x="32" y="46" text-anchor="middle" font-size="30">♞</text></svg>`;

  const GLYPH = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };

  function initBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    back.forEach((p, i) => { b[0][i] = 'b' + p; b[7][i] = 'w' + p; });
    for (let i = 0; i < 8; i++) { b[1][i] = 'bP'; b[6][i] = 'wP'; }
    return b;
  }

  function movesFor(b, r, c) {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece[0], kind = piece[1];
    const out = [];
    const add = (rr, cc) => {
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false;
      const t = b[rr][cc];
      if (!t) { out.push([rr, cc]); return true; }
      if (t[0] !== color) out.push([rr, cc]);
      return false;
    };
    const ray = (dr, dc) => { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } };
    if (kind === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const start = color === 'w' ? 6 : 1;
      if (!b[r + dir] || b[r + dir][c] === undefined) return out;
      if (!b[r + dir][c]) {
        out.push([r + dir, c]);
        if (r === start && !b[r + 2 * dir][c]) out.push([r + 2 * dir, c]);
      }
      for (const dc of [-1, 1]) {
        const t = b[r + dir] && b[r + dir][c + dc];
        if (t && t[0] !== color) out.push([r + dir, c + dc]);
      }
    } else if (kind === 'N') {
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => add(r+dr, c+dc));
    } else if (kind === 'B') { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => ray(dr,dc)); }
    else if (kind === 'R') { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => ray(dr,dc)); }
    else if (kind === 'Q') { [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => ray(dr,dc)); }
    else if (kind === 'K') { [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => add(r+dr, c+dc)); }
    return out;
  }

  function open() {
    let board = initBoard();
    let turn = 'w';
    let sel = null;
    let over = false;

    const wrap = el('div', 'chess-wrap');
    const boardEl = el('div', 'chess-board');
    const status = el('div', 'chess-status');
    const reset = el('button', 'aqua-btn', '新游戏');
    reset.style.marginTop = '8px';
    wrap.append(boardEl, status, reset);

    function render() {
      boardEl.innerHTML = '';
      const hints = sel ? movesFor(board, sel[0], sel[1]).map(([r, c]) => r * 8 + c) : [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const sq = el('div', 'ch-sq ' + ((r + c) % 2 ? 'dark' : 'light'));
        if (sel && sel[0] === r && sel[1] === c) sq.classList.add('sel');
        if (hints.includes(r * 8 + c)) sq.classList.add('hint');
        const p = board[r][c];
        if (p) sq.textContent = GLYPH[p];
        sq.addEventListener('click', () => click(r, c));
        boardEl.appendChild(sq);
      }
      status.textContent = over ? over : (turn === 'w' ? '白方走棋（双人对弈）' : '黑方走棋');
    }

    function click(r, c) {
      if (over) return;
      const p = board[r][c];
      if (sel) {
        const legal = movesFor(board, sel[0], sel[1]).some(([rr, cc]) => rr === r && cc === c);
        if (legal) {
          const captured = board[r][c];
          board[r][c] = board[sel[0]][sel[1]];
          board[sel[0]][sel[1]] = null;
          if (board[r][c][1] === 'P' && (r === 0 || r === 7)) board[r][c] = board[r][c][0] + 'Q';
          if (captured && captured[1] === 'K') over = `${turn === 'w' ? '白方' : '黑方'}获胜！🏆`;
          turn = turn === 'w' ? 'b' : 'w';
          sel = null;
          render();
          return;
        }
        sel = null;
      }
      if (p && p[0] === turn) sel = [r, c];
      render();
    }

    reset.addEventListener('click', () => { board = initBoard(); turn = 'w'; sel = null; over = false; render(); });
    render();
    System.createWindow({ app: 'chess', title: '国际象棋', width: 380, height: 460, content: wrap, noResize: true, bodyBg: '#d8d3c8' });
  }

  System.registerApp({
    id: 'chess', name: '国际象棋', icon, open,
    about: '双人对弈棋盘，含基本走子规则、吃子、兵升变。吃掉国王获胜。',
    keywords: 'chess 象棋 棋',
  });
})();
