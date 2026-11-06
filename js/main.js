import { Game, W, H, COLORS } from './tetris.js';

const $ = s => document.querySelector(s);
const me = $('#me').getContext('2d');
let game = null, over = false;

const status = t => ($('#status').textContent = t);
const show = id => { $('#menu').hidden = id !== 'menu'; $('#play').hidden = id !== 'play'; };
function overlay(text, label, fn) {
  $('#msg').textContent = text;
  const b = $('#again'); b.hidden = !label; b.textContent = label || ''; b.onclick = fn;
  $('#overlay').hidden = false;
}

// ---------- game flow ----------
function startGame(seed) {
  over = false;
  game = new Game(seed, onEvent);
  $('#overlay').hidden = true; show('play');
}

function onEvent(t) { if (t === 'dead') end(); }
function end() {
  if (over) return;
  over = true; game.dead = true;
  overlay(`Game over. Score ${game.score}`, 'Play again', () => startGame(Math.random() * 2 ** 32 >>> 0));
}


// ---------- lobby ----------

$('#solo').onclick = () => startGame(Math.random() * 2 ** 32 >>> 0);

// ---------- input ----------
const ACT = { ArrowLeft: 'L', ArrowRight: 'R', ArrowDown: 'D', ArrowUp: 'cw', KeyX: 'cw', KeyZ: 'ccw', Space: 'hd' };
function act(a) {
  if (!game || game.dead) return;
  if (a === 'L') game.move(-1); else if (a === 'R') game.move(1);
  else if (a === 'cw') game.rotate(1); else if (a === 'ccw') game.rotate(-1);
  else if (a === 'hd') game.hardDrop();
}
addEventListener('keydown', e => {
  const a = ACT[e.code];
  if (!a || !game || $('#play').hidden) return;
  e.preventDefault();
  if (a === 'D') { game.soft = true; return; }
  if (e.repeat && a !== 'L' && a !== 'R') return;
  act(a);
});
addEventListener('keyup', e => { if (e.code === 'ArrowDown' && game) game.soft = false; });

// ---------- rendering ----------
function cell(ctx, x, y, s, v, a = 1) {
  ctx.globalAlpha = a; ctx.fillStyle = COLORS[v];
  ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); ctx.globalAlpha = 1;
}
function grid(ctx, str, s) {
  ctx.clearRect(0, 0, W * s, H * s);
  for (let i = 0; i < str.length; i++) if (+str[i]) cell(ctx, i % W, i / W | 0, s, +str[i]);
}

function render() {
  const g = game, s = 30;
  grid(me, g.snapshot(), s);
  if (!g.dead) {
    g.p.m.forEach((r, j) => r.forEach((v, i) => {
      if (!v) return;
      cell(me, g.p.x + i, g.p.y + j, s, v);
    }));
  }


  $('#stats').textContent = `Score  ${g.score}\nLines  ${g.lines}\nLevel  ${g.level}`;
}

let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(t - last, 50); last = t;
  if (!game) return;
  if (!game.dead) {
    game.update(dt);
  }
  render();
}
requestAnimationFrame(frame);
