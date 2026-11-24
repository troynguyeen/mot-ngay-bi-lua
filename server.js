// server.js — static file server + tiny WebSocket relay for multiplayer rooms (no accounts, no deps)
// Run: node server.js   (PORT env optional, default 8765)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8765;
const MAX_MSG = 16 * 1024;        // max size of one client message
const MAX_MISSION = 6000;         // Myanmar map: the host's mission state, as JSON
const MAX_PLAYERS = 6;            // per room
const MIN_PLAYERS = 2;            // team mode: the co-op missions need at least two people
// shared world events per map: S-7 (Sihanoukville) · jungle camp · brick kiln · the escape · Myanmar (its missions
// travel as 'act' / 'ms' instead: they can be undone when the team has to redo an act)
const WORLD_KEYS = ['phone', 'card', 'cutter', 'kho', 'ptoi', 'sent', 'fence', 'hung',
  'wire', 'jlock', 'sat', 'sos', 'jc0', 'jc1', 'jc2', 'jc3',
  'key', 'kc0', 'kc1', 'kc2', 'kc3', 'wh', 'power', 'rao', 'river', 'depart', 'takeoff', 'twist', 'border'];
// only the host moves the team on to the next leg of the escape
const HOST_KEYS = ['river', 'depart', 'takeoff', 'twist', 'border'];
const MAPS = ['sihanouk', 'jungle', 'kiln', 'river', 'myanmar']; // the host picks one in the waiting room
const DEFAULT_MAP = MAPS[0];
// round options the host picks too: time of day, weather, mission time, how many guards
// (`from`: the long Myanmar map only, the act to resume from)
const OPTS = { tod: ['day', 'dusk', 'night'], wx: ['dry', 'rain', 'storm'], time: ['easy', 'normal', 'hard'], guards: ['few', 'normal', 'many'], from: ['0', '1', '2', '3', '4', '5'] };
const DEFAULT_OPTS = { tod: 'night', wx: 'rain', time: 'normal', guards: 'normal', from: '0' };
const END_KINDS = ['win', 'time', 'caught', 'alone'];
const COLORS = [0x3f8ad8, 0xd8c23f, 0x9c5bd1, 0x3fbf8a, 0xe0607e, 0x5ec8e0];
// public rooms that always show in the list, even when empty
const FIXED_ROOMS = [['P1', 'Phòng 1'], ['P2', 'Phòng 2'], ['P3', 'Phòng 3'], ['P4', 'Phòng 4'], ['P5', 'Phòng 5'], ['P6', 'Phòng 6']];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

// ---------------- static files ----------------
// index.html is authored as body content (the Artifact skeleton style), so wrap it in a real document here.
const SKELETON_HEAD = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>';
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (p === '/api/rooms') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(roomList())); }
  if (p === '/' || p === '') p = '/index.html';
  const segs = p.split(/[\\/]+/).filter(Boolean);
  if (segs.some((s) => s.startsWith('.') || s === '..') || segs[segs.length - 1] === 'server.js') { res.writeHead(404); return res.end('not found'); }
  const file = path.join(ROOT, ...segs);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    fs.readFile(file, (err2, data) => {
      if (err2) { res.writeHead(500); return res.end('error'); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      if (segs.length === 1 && segs[0] === 'index.html') res.end(SKELETON_HEAD + data.toString('utf8') + '</body></html>');
      else res.end(data);
    });
  });
});

// ---------------- WebSocket (RFC 6455, text frames only) ----------------
let nextId = 0;
// code -> { code, name, fixed, clients: Map<id, client>, hostId, world: {}, clock, phase: 'wait' | 'play' }
const rooms = new Map();
const newRoom = (code, name, fixed) => ({ code, name: name || 'Phòng riêng ' + code, fixed: !!fixed, clients: new Map(), hostId: null, world: {}, clock: null, phase: 'wait', map: DEFAULT_MAP, opts: Object.assign({}, DEFAULT_OPTS) });
for (const [code, name] of FIXED_ROOMS) rooms.set(code, newRoom(code, name, true));
function roomList() {
  const list = [...rooms.values()].map((r) => {
    const host = r.clients.get(r.hostId);
    return { code: r.code, name: r.name, fixed: r.fixed, n: r.clients.size, b: botsIn(r).length, phase: r.phase, host: host ? host.name : '', map: r.map, opts: r.opts };
  });
  list.sort((a, b) => (b.fixed - a.fixed) || (a.fixed ? a.code.localeCompare(b.code) : b.n - a.n));
  return { max: MAX_PLAYERS, min: MIN_PLAYERS, rooms: list };
}
const roster = (room) => [...room.clients.values()].map((x) => ({ id: x.id, name: x.name, color: x.color, bot: !!x.bot, look: x.look || '' }));
// a player's character from the creator, as short text (letters, digits and ; , . - only)
const cleanLook = (s) => (typeof s === 'string' && s.length <= 400 && /^[0-9a-z;,.-]*$/i.test(s) ? s : '');
function resetRoom(room) { room.phase = 'wait'; room.world = {}; room.clock = null; room.paused = null; }
// ---- bots: room members without a socket. The host's browser simulates them and sends their state ('bst'). ----
const BOT_NAMES = ['Bot Tuấn', 'Bot Lan', 'Bot Minh', 'Bot Hoa', 'Bot Dũng', 'Bot Hải'];
const humansIn = (room) => [...room.clients.values()].filter((x) => !x.bot);
const botsIn = (room) => [...room.clients.values()].filter((x) => x.bot);
function addBot(room) {
  if (room.clients.size >= MAX_PLAYERS) return null;
  const all = [...room.clients.values()], usedC = new Set(all.map((x) => x.color)), usedN = new Set(all.map((x) => x.name));
  const id = ++nextId;
  const b = { id, bot: true, sock: null, buf: null, room, dead: false, seen: Date.now(), name: BOT_NAMES.find((n) => !usedN.has(n)) || 'Bot ' + id, color: COLORS.find((col) => !usedC.has(col)) || COLORS[id % COLORS.length] };
  room.clients.set(id, b);
  broadcast(room, { t: 'join', id, name: b.name, color: b.color, bot: true });
  return b;
}
function removeBot(room, b) { room.clients.delete(b.id); broadcast(room, { t: 'leave', id: b.id }); }

function sendFrame(c, op, payload) {
  if (!c.sock || c.sock.destroyed) return;
  const len = payload.length; let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(len, 6); }
  c.sock.write(Buffer.concat([head, payload]));
}
const send = (c, obj) => sendFrame(c, 1, Buffer.from(JSON.stringify(obj)));
const broadcast = (room, obj, exceptId) => { const s = Buffer.from(JSON.stringify(obj)); for (const [id, c] of room.clients) if (id !== exceptId) sendFrame(c, 1, s); };

function kill(c) { if (c.dead) return; c.dead = true; try { c.sock.destroy(); } catch (e) { /* ignore */ } leave(c); }

function parseFrames(c) {
  for (;;) {
    const b = c.buf; if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; if (b.readUInt32BE(2) !== 0) return kill(c); len = b.readUInt32BE(6); off = 10; }
    if (len > MAX_MSG || !masked) return kill(c);
    if (b.length < off + 4 + len) return;
    const mask = b.subarray(off, off + 4), data = Buffer.alloc(len);
    for (let i = 0; i < len; i++) data[i] = b[off + 4 + i] ^ mask[i & 3];
    c.buf = b.subarray(off + 4 + len);
    if (op === 8) { sendFrame(c, 8, Buffer.alloc(0)); return kill(c); }
    if (op === 9) { sendFrame(c, 10, data); continue; }
    if (op === 1 && fin) { let msg; try { msg = JSON.parse(data.toString('utf8')); } catch (e) { continue; } if (msg && typeof msg === 'object') onMessage(c, msg); }
  }
}

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Người lạ';
const cleanRoom = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
const leg = (v) => (v === 1 || v === 2 || v === 3 || v === 4 ? v : 0); // which leg a player is on (1 river, 2 airport, 3 Myanmar compound, 4 border)
const vec3 = (a) => (Array.isArray(a) && a.length === 3 ? a.map(num) : null);

function onMessage(c, m) {
  if (m.t === 'join') {
    if (c.room) return;
    const code = cleanRoom(m.room); if (!code) return send(c, { t: 'error', msg: 'Mã phòng không hợp lệ' });
    let room = rooms.get(code);
    if (!room) { room = newRoom(code); rooms.set(code, room); }
    if (room.phase === 'play') return send(c, { t: 'error', msg: 'Phòng đang chơi. Chờ ván sau hoặc chọn phòng khác.' });
    // a real player takes a bot's seat when the room is full
    if (room.clients.size >= MAX_PLAYERS) { const bots = botsIn(room); if (bots.length) removeBot(room, bots[bots.length - 1]); }
    if (room.clients.size >= MAX_PLAYERS) return send(c, { t: 'error', msg: 'Phòng đã đủ ' + MAX_PLAYERS + ' người. Chọn phòng khác.' });
    const used = new Set([...room.clients.values()].map((x) => x.color));
    c.name = cleanName(m.name); c.color = COLORS.find((col) => !used.has(col)) || COLORS[c.id % COLORS.length]; c.room = room; c.look = cleanLook(m.look);
    room.clients.set(c.id, c);
    if (!room.hostId) room.hostId = c.id;
    send(c, { t: 'welcome', id: c.id, hostId: room.hostId, room: code, name: room.name, phase: room.phase, map: room.map, maps: MAPS, opts: room.opts, max: MAX_PLAYERS, min: MIN_PLAYERS, now: Date.now(), world: room.world, clock: room.clock, color: c.color,
      peers: roster(room).filter((x) => x.id !== c.id) });
    broadcast(room, { t: 'join', id: c.id, name: c.name, color: c.color, look: c.look }, c.id);
    console.log(`[room ${code}] + ${c.name} (#${c.id}) — ${room.clients.size} người`);
    return;
  }
  const room = c.room; if (!room) return;
  switch (m.t) {
    case 'st': // player state, relayed to everyone else. hl = co-op spot being held, td = tied up, o = outside the wall
      if (room.phase !== 'play') return;
      broadcast(room, { t: 'st', from: c.id, e: leg(m.e), x: num(m.x), y: num(m.y), z: num(m.z), yaw: num(m.yaw), c: !!m.c, r: !!m.r, s: num(m.s), p: typeof m.p === 'string' ? m.p.slice(0, 8) : '', b: !!m.b, n: !!m.n,
        hl: typeof m.hl === 'string' ? m.hl.slice(0, 8) : '', td: !!m.td, o: !!m.o }, c.id);
      break;
    case 'gs': // guard snapshot from the host only (+ mission timer: [objective index, seconds left])
      if (c.id !== room.hostId || room.phase !== 'play') return;
      room.clock = num(m.clock);
      broadcast(room, { t: 'gs', g: Array.isArray(m.g) ? m.g.slice(0, 32) : [], clock: room.clock, det: m.det && typeof m.det === 'object' ? m.det : {}, mt: Array.isArray(m.mt) ? [num(m.mt[0]), num(m.mt[1])] : null }, c.id);
      break;
    case 'esc': // river escape: the host's snapshot of the men chasing
      if (c.id !== room.hostId || room.phase !== 'play' || !Array.isArray(m.th)) return;
      broadcast(room, { t: 'esc', th: m.th.slice(0, 16).map((a) => (Array.isArray(a) ? [num(a[0]), num(a[1]), num(a[2]), num(a[3])] : null)) }, c.id);
      break;
    case 'rock': { // river escape: one stone thrown (start point, velocity); each player works out the flight itself
      if (c.id !== room.hostId || room.phase !== 'play') return;
      const o = vec3(m.o), v = vec3(m.v);
      if (o && v) broadcast(room, { t: 'rock', o, v }, c.id);
      break;
    }
    case 'start': // host starts the round from the waiting room
      if (c.id !== room.hostId || room.phase !== 'wait') return;
      if (room.clients.size < MIN_PLAYERS) return send(c, { t: 'error', msg: 'Cần ít nhất ' + MIN_PLAYERS + ' người để bắt đầu.' });
      resetRoom(room); room.phase = 'play';
      broadcast(room, { t: 'start', now: Date.now(), players: roster(room), map: room.map, opts: room.opts });
      console.log(`[room ${room.code}] bắt đầu ván (${room.map} ${Object.values(room.opts).join('/')}) — ${room.clients.size} người`);
      break;
    case 'opts': // host changes the round options in the waiting room (only known keys and values)
      if (c.id !== room.hostId || room.phase !== 'wait' || !m.opts || typeof m.opts !== 'object') return;
      for (const k of Object.keys(OPTS)) if (OPTS[k].includes(m.opts[k])) room.opts[k] = m.opts[k];
      broadcast(room, { t: 'opts', opts: room.opts });
      break;
    case 'map': // host picks the map in the waiting room; everyone (the host too) gets the choice back
      if (c.id !== room.hostId || room.phase !== 'wait' || !MAPS.includes(m.map)) return;
      room.map = m.map;
      broadcast(room, { t: 'map', map: room.map });
      break;
    case 'end': // host reports the team result; the room goes back to waiting
      if (c.id !== room.hostId || room.phase !== 'play') return;
      resetRoom(room);
      broadcast(room, { t: 'end', r: END_KINDS.includes(m.r) ? m.r : 'caught' }, c.id);
      console.log(`[room ${room.code}] kết thúc ván: ${m.r}`);
      break;
    case 'free': { // someone untied a teammate (the host may act for one of its bots with `as`)
      if (room.phase !== 'play') return;
      const asBot = c.id === room.hostId && m.as != null ? room.clients.get(Number(m.as)) : null;
      if (asBot && !asBot.bot) return;
      const target = room.clients.get(Number(m.id)); if (!target || (target.id === c.id && !asBot)) return;
      const by = asBot || c;
      broadcast(room, { t: 'free', id: target.id, by: by.id, name: by.name }, c.id);
      break;
    }
    case 'pause': { // team pause: anyone can stop the whole room, anyone can resume it (so nobody is stuck behind an idle player)
      if (room.phase !== 'play') return;
      const on = !!m.on;
      if (on === !!room.paused) return;
      room.paused = on ? { by: c.id, name: c.name } : null;
      broadcast(room, { t: 'pause', on, by: c.id, name: c.name }); // to everyone, the sender too
      break;
    }
    case 'bot_add': // host fills empty seats with bots in the waiting room
      if (c.id !== room.hostId || room.phase !== 'wait') return;
      if (!addBot(room)) send(c, { t: 'error', msg: 'Phòng đã đủ ' + MAX_PLAYERS + ' người.' });
      break;
    case 'bot_kick': {
      if (c.id !== room.hostId || room.phase !== 'wait') return;
      const b = room.clients.get(Number(m.id)); if (b && b.bot) removeBot(room, b);
      break;
    }
    case 'bst': { // a bot's state, simulated by the host, relayed like a player's
      if (c.id !== room.hostId || room.phase !== 'play') return;
      const b = room.clients.get(Number(m.id)); if (!b || !b.bot) return;
      broadcast(room, { t: 'st', from: b.id, e: leg(m.e), x: num(m.x), y: num(m.y), z: num(m.z), yaw: num(m.yaw), c: !!m.c, r: !!m.r, s: num(m.s), p: typeof m.p === 'string' ? m.p.slice(0, 8) : '', b: false, n: false,
        hl: typeof m.hl === 'string' ? m.hl.slice(0, 8) : '', td: !!m.td, o: !!m.o }, c.id);
      break;
    }
    case 'look': // someone changed their character
      c.look = cleanLook(m.look);
      broadcast(room, { t: 'look', id: c.id, look: c.look }, c.id);
      break;
    case 'ev': // shared world event (doors, items, fence…)
      if (room.phase !== 'play' || !WORLD_KEYS.includes(m.k) || room.world[m.k]) return;
      if (HOST_KEYS.includes(m.k) && c.id !== room.hostId) return;
      room.world[m.k] = true;
      { // the host may report a bot's work (a bot opened a cage) under the bot's name
        const asBot = c.id === room.hostId && m.as != null ? room.clients.get(Number(m.as)) : null;
        const who = asBot && asBot.bot ? asBot : c;
        broadcast(room, { t: 'ev', k: m.k, from: who.id, name: who.name }, c.id);
      }
      break;
    case 'act': { // Myanmar: a player did a piece of a mission; the host decides what it changes
      if (room.phase !== 'play' || c.id === room.hostId) return;
      const host = room.clients.get(room.hostId);
      if (host) send(host, { t: 'act', from: c.id, name: c.name, k: typeof m.k === 'string' ? m.k.slice(0, 12) : '', e: num(m.e), i: num(m.i), x: num(m.x) });
      break;
    }
    case 'ms': { // Myanmar: the mission state, from the host only
      if (c.id !== room.hostId || room.phase !== 'play' || !m.s || typeof m.s !== 'object') return;
      if (JSON.stringify(m.s).length > MAX_MISSION) return;
      broadcast(room, { t: 'ms', s: m.s }, c.id);
      break;
    }
    case 'noise': { // noises / light alerts go to the host, who runs the guards
      const host = room.clients.get(room.hostId);
      if (host && host.id !== c.id) send(host, { t: 'noise', x: num(m.x), z: num(m.z), r: Math.min(num(m.r), 30), k: typeof m.k === 'string' ? m.k.slice(0, 8) : '' });
      break;
    }
    case 'caught': { // host tells a player they were caught
      if (c.id !== room.hostId) return;
      const target = room.clients.get(Number(m.to));
      if (target) send(target, { t: 'caught', src: m.src === 'light' ? 'light' : 'guard' });
      break;
    }
    case 'say': { // short status line ("X đã thoát", "X bị bắt"); the host can speak for a bot
      const asBot = c.id === room.hostId && m.as != null ? room.clients.get(Number(m.as)) : null;
      const who = asBot && asBot.bot ? asBot : c;
      broadcast(room, { t: 'say', from: who.id, name: who.name, k: typeof m.k === 'string' ? m.k.slice(0, 12) : '' }, c.id);
      break;
    }
  }
}

function leave(c) {
  const room = c.room; if (!room || !room.clients.has(c.id)) return;
  room.clients.delete(c.id);
  console.log(`[room ${room.code}] - ${c.name} (#${c.id}) — còn ${room.clients.size} người`);
  const people = humansIn(room);
  if (!people.length) { room.clients.clear(); resetRoom(room); room.hostId = null; room.map = DEFAULT_MAP; room.opts = Object.assign({}, DEFAULT_OPTS); if (!room.fixed) rooms.delete(room.code); return; } // bots never stay alone
  broadcast(room, { t: 'leave', id: c.id });
  if (room.hostId === c.id) { room.hostId = people[0].id; broadcast(room, { t: 'host', id: room.hostId }); }
  if (room.paused && room.paused.by === c.id) { room.paused = null; broadcast(room, { t: 'pause', on: false, by: c.id, name: c.name, left: true }); } // whoever paused left
  // a team round cannot go on with one person left (unless everybody already got away: the rest is the journey home.
  // On the Myanmar map the boat is the trap, so "away" is only once they are over the border river.)
  const away = room.map === 'myanmar' ? room.world.border : room.world.depart;
  if (room.phase === 'play' && !away && room.clients.size < MIN_PLAYERS) { resetRoom(room); broadcast(room, { t: 'end', r: 'alone' }); }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { id: ++nextId, sock: socket, buf: Buffer.alloc(0), room: null, name: '', color: 0, dead: false, seen: Date.now() };
  socket.on('data', (d) => { c.seen = Date.now(); c.buf = Buffer.concat([c.buf, d]); if (c.buf.length > MAX_MSG * 4) return kill(c); parseFrames(c); });
  socket.on('close', () => kill(c));
  socket.on('error', () => kill(c));
});
// drop silent sockets (closed tabs that never sent a close frame)
setInterval(() => { for (const room of rooms.values()) for (const c of [...room.clients.values()]) if (!c.bot && Date.now() - c.seen > 30000) kill(c); }, 10000);

server.listen(PORT, () => console.log(`Một Ngày Bị Lừa — http://localhost:${PORT}  (WebSocket: /ws)`));
