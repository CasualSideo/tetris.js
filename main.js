
const $ = s => document.querySelector(s);
const me = $('#me').getContext('2d'), opp = $('#opp').getContext('2d'), side = $('#side').getContext('2d');
const DAS = 170, ARR = 45;
let game = null, net = null, oppBoard = null, over = false, wins = [0, 0];
const held = {};

const setStatus = t => ($('#status').textContent = t);

const syncKeys = () => { $('#keys').hidden = $('#menu').hidden && $('#overlay').hidden; };
const show = id => { $('#menu').hidden = id !== 'menu'; $('#play').hidden = id !== 'play'; syncKeys(); };
function overlay(text, label, fn) {
  $('#msg').textContent = text;
  const b = $('#again'); b.hidden = !label; b.textContent = label || ''; b.onclick = fn;
  $('#overlay').hidden = false; syncKeys();
}

// ---------- game flow ----------
function startGame(seed) {
  over = false; oppBoard = null;
  for (const k in held) delete held[k];
  game = new Game(seed, onEvent);
  $('#overlay').hidden = true; if ($('#keysDlg').open) $('#keysDlg').close(); show('play');
}
const hostStart = () => { const seed = Math.random() * 2 ** 32 >>> 0; net.send({ t: 'start', seed }); startGame(seed); };

function onEvent(t, v) {
  if (t === 'attack') net && net.send({ t: 'atk', n: v });
  else if (t === 'board') net && net.send({ t: 'board', b: game.snapshot() });
  else if (t === 'dead') { net && net.send({ t: 'dead' }); end(false); }
}
function end(win) {
  if (over) return;
  over = true; game.dead = true;
  if (!net) return overlay(`Game over. Score ${game.score}`, 'Play again', () => startGame(Math.random() * 2 ** 32 >>> 0));
  wins[win ? 0 : 1]++;
  const msg = `${win ? 'You win!' : 'You lose.'} ${wins[0]}–${wins[1]}`;
  net.isHost ? overlay(msg, 'Rematch', hostStart) : overlay(`${msg} Waiting for the host to start the next round.`);
}

function onData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'start' && Number.isFinite(d.seed) && !net.isHost) startGame(d.seed >>> 0);
  else if (d.t === 'atk' && game && !game.dead) game.receive(Math.max(0, Math.min(4, d.n | 0)));
  else if (d.t === 'board' && typeof d.b === 'string' && /^[0-8]{200}$/.test(d.b)) oppBoard = d.b;
  else if (d.t === 'dead' && game) end(true);
}

// ---------- lobby ----------
function connect() {
  net = new Net({
    ready: code => {
      $('#share').value = `${location.origin}${location.pathname}?room=${code}`;
      $('#room').hidden = false; setStatus(`Room ${code} is open. Waiting for your opponent…`);
    },
    open: () => {
      show('play'); wins = [0, 0];
      net.isHost ? overlay('Opponent connected', 'Start game', hostStart) : overlay('Connected. Waiting for the host to start…');
    },
    data: onData,
    close: () => { if (game) game.dead = true; show('play'); overlay('Your opponent left.', 'Back to menu', () => (location.href = location.pathname)); },
    error: e => setStatus(e.type === 'peer-unavailable' ? 'Room not found. Check the code and try again.' : `Connection problem (${e.type}). Try again.`),
  });
  return net;
}
const join = code => { if (code.trim()) { setStatus('Connecting…'); connect().join(code); } };

$('#solo').onclick = () => startGame(Math.random() * 2 ** 32 >>> 0);
$('#create').onclick = () => { setStatus('Creating room…'); connect().host(); };
$('#join').onclick = () => join($('#code').value);
$('#code').onkeydown = e => e.key === 'Enter' && join($('#code').value);
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText($('#share').value); $('#copy').textContent = 'Copied'; } catch { $('#share').select(); } };
const room = new URLSearchParams(location.search).get('room');
if (room) join(room);

// ---------- input ----------
const NAMES = { L: 'Move left', R: 'Move right', D: 'Soft drop', cw: 'Rotate', ccw: 'Rotate back', hd: 'Hard drop', hold: 'Hold' };
const DEFAULTS = { L: ['ArrowLeft'], R: ['ArrowRight'], D: ['ArrowDown'], cw: ['ArrowUp', 'KeyX'], ccw: ['KeyZ'], hd: ['Space'], hold: ['KeyC', 'ShiftLeft'] };
const clone = o => JSON.parse(JSON.stringify(o));
const label = c => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[c] || c.replace(/^(Key|Digit)/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2'));
let binds = clone(DEFAULTS), ACT = {}, listening = null;
try {
  const s = JSON.parse(localStorage.getItem('p2p-tetris-keys'));
  if (s && Object.keys(DEFAULTS).every(a => Array.isArray(s[a]) && s[a].every(c => typeof c === 'string'))) binds = s;
} catch {}
const keyText = a => binds[a].map(label).join(' / ') || 'Unbound';
function applyBinds() {
  ACT = {};
  for (const a in binds) binds[a].forEach(c => (ACT[c] = a));
  try { localStorage.setItem('p2p-tetris-keys', JSON.stringify(binds)); } catch {}
  $('#keyhint').textContent = Object.keys(NAMES).map(a => `${NAMES[a]}: ${keyText(a)}`).join(' · ');
  $('#keylist').replaceChildren(...Object.keys(NAMES).map(a => {
    const row = document.createElement('div'), b = document.createElement('button');
    row.className = 'keyrow'; row.textContent = NAMES[a];
    b.textContent = listening === a ? 'Press a key…' : keyText(a);
    b.onclick = () => { listening = a; applyBinds(); };
    row.append(b); return row;
  }));
}

addEventListener('keydown', e => {
  if (!listening) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') {
    for (const a in binds) binds[a] = binds[a].filter(c => c !== e.code);
    binds[listening] = [e.code];
  }
  listening = null; applyBinds();
}, true);
$('#keys').onclick = () => $('#keysDlg').showModal();
$('#keysDone').onclick = () => $('#keysDlg').close();
$('#keysDlg').onclose = () => { listening = null; applyBinds(); };
$('#keysReset').onclick = () => { binds = clone(DEFAULTS); listening = null; applyBinds(); };
applyBinds();
function act(a) {
  if (!game || game.dead) return;
  if (a === 'L') game.move(-1); else if (a === 'R') game.move(1);
  else if (a === 'cw') game.rotate(1); else if (a === 'ccw') game.rotate(-1);
  else if (a === 'hd') game.hardDrop(); else if (a === 'hold') game.swap();
}
addEventListener('keydown', e => {
  const a = ACT[e.code];
  if (!a || !game || $('#play').hidden) return;
  e.preventDefault();
  if (e.repeat || a in held) return;
  held[a] = 0; act(a);
});
addEventListener('keyup', e => delete held[ACT[e.code]]);
addEventListener('blur', () => { for (const k in held) delete held[k]; });

// ---------- rendering ----------
function cell(ctx, x, y, s, v, a = 1) {
  ctx.globalAlpha = a; ctx.fillStyle = COLORS[v];
  ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); ctx.globalAlpha = 1;
}
function grid(ctx, str, s) {
  ctx.clearRect(0, 0, W * s, H * s);
  for (let i = 0; i < str.length; i++) if (+str[i]) cell(ctx, i % W, i / W | 0, s, +str[i]);
}
function mini(id, x, y) { shape(id).forEach((r, j) => r.forEach((v, i) => v && cell(side, x + i, y + j, 18, v))); }

function render() {
  const g = game, s = 30;
  grid(me, g.snapshot(), s);
  if (!g.dead) {
    const gy = g.ghostY();
    g.p.m.forEach((r, j) => r.forEach((v, i) => {
      if (!v) return;
      cell(me, g.p.x + i, gy + j, s, v, .25); cell(me, g.p.x + i, g.p.y + j, s, v);
    }));
  }
  me.fillStyle = '#ef4444'; me.fillRect(0, (H - g.pending) * s, 4, g.pending * s);
  grid(opp, oppBoard || '0'.repeat(W * H), 15);

  side.clearRect(0, 0, 110, 330);
  side.fillStyle = '#a3a6c8'; side.font = '13px system-ui';
  side.fillText('Hold', 6, 16); if (g.held) mini(g.held, 1, 1.4);
  side.fillText('Next', 6, 116);
  g.queue.slice(0, 3).forEach((id, i) => mini(id, 1, (130 + i * 66) / 18));

  $('#stats').textContent = `Score  ${g.score}\nLines  ${g.lines}\nLevel  ${g.level}` + (net ? `\nWins   ${wins[0]}–${wins[1]}` : '');
}

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(t - last, 50); last = t;
  if (!game) return;
  if (!game.dead) {
    for (const a of ['L', 'R']) if (a in held && (held[a] += dt) > DAS) { held[a] -= ARR; act(a); }
    game.soft = 'D' in held; game.update(dt);
  }
  render();
}
requestAnimationFrame(frame);
