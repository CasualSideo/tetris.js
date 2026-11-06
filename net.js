
const PREFIX = 'p2p-tetris-';
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const OPTS = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

class Net {
  constructor(h) { this.h = h; this.conn = null; this.peer = null; this.isHost = false; }
  host() {
    this.isHost = true;
    const code = Array.from({ length: 5 }, () => CHARS[Math.random() * CHARS.length | 0]).join('');
    this.peer = new Peer(PREFIX + code, OPTS);
    this.peer.on('open', () => this.h.ready(code));
    this.peer.on('connection', c => (this.conn ? c.close() : this.bind(c)));
    this.peer.on('error', e => {
      if (e.type === 'unavailable-id') { this.peer.destroy(); this.host(); } else this.h.error(e);
    });
  }
  join(code) {
    this.peer = new Peer(OPTS);
    this.peer.on('open', () => this.bind(this.peer.connect(PREFIX + code.toUpperCase().trim(), { reliable: true })));
    this.peer.on('error', e => this.h.error(e));
  }
  bind(c) {
    this.conn = c;
    c.on('open', () => this.h.open());
    c.on('data', d => this.h.data(d));
    c.on('close', () => { this.conn = null; this.h.close(); });
  }
  send(m) { if (this.conn && this.conn.open) this.conn.send(m); }
}
