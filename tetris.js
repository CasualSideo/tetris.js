const W = 10, H = 20;
const COLORS = ['', '#22d3ee', '#facc15', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316', '#64748b'];

const SHAPES = ['0000/1111/0000/0000', '11/11', '010/111/000', '011/110/000', '110/011/000', '100/111/000', '001/111/000'];
const shape = id => SHAPES[id - 1].split('/').map(r => [...r].map(c => +c && id));
const rot = (m, d) => d > 0
  ? m[0].map((_, x) => m.map(r => r[x]).reverse())
  : m[0].map((_, x) => m.map(r => r[r.length - 1 - x]));


function rng(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class Game {
  constructor(seed, emit) {
    this.rand = rng(seed); this.emit = emit; this.bag = []; this.queue = [];
    this.board = Array.from({ length: H }, () => Array(W).fill(0));
    Object.assign(this, { score: 0, lines: 0, level: 1, held: 0, canHold: true, dead: false, pending: 0, soft: false, acc: 0, lockT: 0, resets: 0 });
    this.spawn();
  }
  nextId() {
    while (this.queue.length < 5) {
      if (!this.bag.length) {
        this.bag = [1, 2, 3, 4, 5, 6, 7];
        for (let i = 6; i > 0; i--) { const j = this.rand() * (i + 1) | 0; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
      }
      this.queue.push(this.bag.pop());
    }
    return this.queue.shift();
  }
  spawn(id = this.nextId()) {
    const m = shape(id);
    this.p = { id, m, x: (W - m[0].length) >> 1, y: 0 };
    this.acc = this.lockT = this.resets = 0;
    if (this.hit(m, this.p.x, 0)) this.die();
  }
  die() { if (!this.dead) { this.dead = true; this.emit('dead'); } }
  hit(m, x, y) {
    return m.some((r, j) => r.some((v, i) => v && (x + i < 0 || x + i >= W || y + j >= H || (y + j >= 0 && this.board[y + j][x + i]))));
  }
  grounded() { return this.hit(this.p.m, this.p.x, this.p.y + 1); }
  nudge() { if (this.grounded() && this.resets++ < 15) this.lockT = 0; }
  move(d) { if (!this.hit(this.p.m, this.p.x + d, this.p.y)) { this.p.x += d; this.nudge(); } }
  rotate(d) {
    const m = rot(this.p.m, d);
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
      if (!this.hit(m, this.p.x + dx, this.p.y + dy)) {
        Object.assign(this.p, { m, x: this.p.x + dx, y: this.p.y + dy });
        return this.nudge();
      }
    }
  }
  gravity() { return Math.max(40, 800 * 0.85 ** (this.level - 1)) / (this.soft ? 20 : 1); }
  update(dt) {
    if (this.dead) return;
    if (this.grounded()) { this.acc = 0; if ((this.lockT += dt) >= 500) this.lock(); return; }
    this.lockT = 0; this.acc += dt;
    const g = this.gravity();
    while (this.acc >= g) {
      this.acc -= g;
      if (this.grounded()) break;
      this.p.y++; if (this.soft) this.score++;
    }
  }
  hardDrop() { let n = 0; while (!this.grounded()) { this.p.y++; n++; } this.score += 2 * n; this.lock(); }
  ghostY() { let y = this.p.y; while (!this.hit(this.p.m, this.p.x, y + 1)) y++; return y; }
  swap() {
    if (!this.canHold) return;
    const cur = this.p.id, h = this.held;
    this.held = cur; this.spawn(h || this.nextId()); this.canHold = false;
  }
  lock() {
    const { p } = this; let over = false;
    p.m.forEach((r, j) => r.forEach((v, i) => {
      if (!v) return;
      if (p.y + j < 0) over = true; else this.board[p.y + j][p.x + i] = v;
    }));
    if (over) return this.die();
    const keep = this.board.filter(r => !r.every(Boolean)), n = H - keep.length;
    while (keep.length < H) keep.unshift(Array(W).fill(0));
    this.board = keep;
    this.lines += n; this.level = 1 + (this.lines / 10 | 0);
    this.score += [0, 100, 300, 500, 800][n] * this.level;
    let atk = [0, 0, 1, 2, 4][n];
    const c = Math.min(atk, this.pending); atk -= c; this.pending -= c;
    if (atk) this.emit('attack', atk);
    if (!n && this.pending) { this.garbage(this.pending); this.pending = 0; }
    this.canHold = true; this.spawn(); this.emit('board');
  }
  garbage(n) {
    for (let k = 0; k < n; k++) {
      if (this.board[0].some(Boolean)) return this.die();
      const hole = Math.random() * W | 0;
      this.board.shift();
      this.board.push(Array.from({ length: W }, (_, i) => i === hole ? 0 : 8));
    }
  }
  receive(n) { this.pending += n; }
  snapshot() { return this.board.flat().join(''); }
}
