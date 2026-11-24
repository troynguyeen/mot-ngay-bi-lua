// game.js — shared framework: UI (dialog, cards, phone, scam screen, choices), interactions, objectives, HUD,
// minimap, pause/settings/lobby, checkpoints and the main loop. The story itself lives in story*.js.
(function (G) {
'use strict';
const T = G.T, C = G.C, P = G.player;
const $ = (id) => document.getElementById(id);
const S = G.state = {
  phase: 'title', chapter: 0, stealthPhase: false, clockRun: false, clock: 21 * 60, deadline: 0, onDeadline: null,
  debt: 15000, caught: 0, maxCaught: 3, busy: false, paused: false, hold: null, ended: false, mp: false,
  items: {}, f: {}, stats: { warned: 0, scammed: 0, sales: 0, wallet: 0, freed: 0, caughtTotal: 0 }, dark: false,
};
G.INTER = []; G.OBJ = [];
const ui = G.ui = {};

// ---------------- small UI helpers ----------------
let toastTimer = 0;
ui.toast = (text, ms) => { const el = $('toast'); el.textContent = text; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms || 2800); };
ui.fade = (cb, hold) => { $('fade').classList.add('on'); setTimeout(() => { if (cb) cb(); setTimeout(() => $('fade').classList.remove('on'), hold || 150); }, 950); };
ui.black = (on) => $('fade').classList.toggle('on', !!on);
ui.flash = (color, op) => { const f = $('flash'); f.style.background = color || 'var(--blood)'; f.style.transition = 'none'; f.style.opacity = String(op || 0.85); requestAnimationFrame(() => { f.style.transition = 'opacity 1.2s'; f.style.opacity = '0'; }); };
ui.blur = (px) => { G.renderer.domElement.style.filter = px ? `blur(${px}px) saturate(${Math.max(0.3, 1 - px / 10)})` : ''; };
const money = (n) => Math.round(n).toLocaleString('vi-VN') + '$';
const fmtClock = (m) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
G.fmtClock = fmtClock; G.money = money;

// ---------------- dialog + choices ----------------
let dlg = null;
ui.say = function (lines, done) {
  dlg = { lines, i: 0, done, shown: 0, full: '' }; S.busy = true; P.frozen = true; G.unlockPointer(); showLine();
};
function showLine() {
  const [who, text] = dlg.lines[dlg.i];
  $('dlg-who').textContent = who; $('dlg-who').style.visibility = who ? 'visible' : 'hidden';
  dlg.full = text; dlg.shown = 0; $('dlg-text').textContent = ''; $('dlg-choices').innerHTML = ''; $('dlg-next').hidden = false;
  $('dialog').hidden = false; document.body.classList.add('talking');
}
function dlgAdvance() {
  if (!dlg || dlg.choice) return;
  if (dlg.shown < dlg.full.length) { dlg.shown = dlg.full.length; return; }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) { closeDlg(); const d = dlg.done; dlg = null; if (d) d(); }
  else showLine();
}
function closeDlg() { $('dialog').hidden = true; document.body.classList.remove('talking'); S.busy = false; P.frozen = false; P.pose = null; }
$('dialog').addEventListener('click', (e) => { if (!e.target.closest('.choice')) dlgAdvance(); });
ui.choose = function (who, text, options) { // options: [{ label, sub, fn }]
  dlg = { lines: [[who, text]], i: 0, shown: 0, full: text, choice: true }; S.busy = true; P.frozen = true; G.unlockPointer();
  $('dlg-who').textContent = who; $('dlg-who').style.visibility = who ? 'visible' : 'hidden'; $('dlg-text').textContent = text; dlg.shown = text.length;
  $('dlg-next').hidden = true; const box = $('dlg-choices'); box.innerHTML = '';
  options.forEach((o) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
    const strong = document.createElement('b'); strong.textContent = o.label; b.appendChild(strong);
    if (o.sub) { const s = document.createElement('span'); s.textContent = o.sub; b.appendChild(s); }
    b.onclick = () => { closeDlg(); dlg = null; o.fn(); };
    box.appendChild(b);
  });
  $('dialog').hidden = false; document.body.classList.add('talking');
};

// ---------------- narrative card ----------------
let card = null;
ui.card = function (lines, done) {
  const box = $('card-lines'); box.innerHTML = ''; $('card').hidden = false; S.busy = true; G.unlockPointer();
  card = { done, timers: [] };
  lines.forEach((ln, i) => card.timers.push(setTimeout(() => { const p = document.createElement('p'); if (ln.c) p.className = ln.c; p.textContent = ln.t; box.appendChild(p); }, i * 1400)));
  card.ready = Date.now() + Math.min(lines.length * 1400, 2600);
};
function cardNext() {
  if (!card || Date.now() < card.ready) return;
  card.timers.forEach(clearTimeout); $('card').hidden = true; const d = card.done; card = null; S.busy = false; if (d) d();
}
$('card').addEventListener('click', cardNext);

// ---------------- phone ----------------
let phoneRun = null;
ui.phoneOpen = (head) => { document.querySelector('.phone-top').innerHTML = head; $('chat').innerHTML = ''; $('phone-bot').innerHTML = ''; $('phone').hidden = false; S.busy = true; G.unlockPointer(); };
ui.phoneClose = () => { if (phoneRun) phoneRun.stop = true; phoneRun = null; $('phone').hidden = true; S.busy = false; };
ui.phoneButtons = (btns) => {
  const bar = $('phone-bot'); bar.innerHTML = '';
  btns.forEach((b) => { const el = document.createElement('button'); el.type = 'button'; el.className = 'btn' + (b.primary ? ' primary' : '') + (b.cls ? ' ' + b.cls : ''); el.textContent = b.label; el.onclick = b.fn; bar.appendChild(el); });
};
ui.phoneNode = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; $('chat').appendChild(d); $('chat').scrollTop = $('chat').scrollHeight; return d; };
ui.phoneMsgs = function (msgs, done, btn) { // animated chat; resolves when the player taps the button
  const chat = $('chat'); const run = phoneRun = { stop: false }; let i = 0;
  const finish = () => { if (run.stop) return; run.stop = true; phoneRun = null; if (done) done(); };
  ui.phoneButtons([{ label: btn || 'Bỏ qua ▸', fn: finish }]);
  const step = () => {
    if (run.stop) return;
    if (i >= msgs.length) { ui.phoneButtons([{ label: btn || 'Tiếp tục ▸', primary: true, fn: finish }]); return; }
    const [who, text] = msgs[i++]; let tEl = null;
    if (who === 'them') { tEl = document.createElement('div'); tEl.className = 'typing'; tEl.innerHTML = '<i></i><i></i><i></i>'; chat.appendChild(tEl); chat.scrollTop = chat.scrollHeight; }
    setTimeout(() => {
      if (run.stop) return; if (tEl) tEl.remove();
      const m = document.createElement('div'); m.className = 'msg ' + who; m.textContent = text; chat.appendChild(m); chat.scrollTop = chat.scrollHeight;
      G.sfx(who === 'sys' ? 'beep' : 'msg'); setTimeout(step, who === 'me' ? 850 : 650 + Math.min(text.length * 16, 1300));
    }, who === 'them' ? 800 + Math.min(text.length * 12, 1200) : 260);
  };
  setTimeout(step, 400);
};
ui.phoneChat = function (head, msgs, done, opt) { ui.phoneOpen(head); ui.phoneMsgs(msgs, () => { ui.phoneClose(); if (done) done(); }, opt && opt.btn); };
$('phone').addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a && ui.onPhoneAct) ui.onPhoneAct(a.dataset.act, a); });

// ---------------- scam workstation ----------------
ui.scam = function (cs, done) { // cs: { id, title, victim, sub, ava, steps[], rounds[], amount, okText, badText }
  $('scam').hidden = false; S.busy = true; G.unlockPointer();
  $('scam-title').textContent = cs.title; $('scam-victim').textContent = cs.victim; $('scam-sub').textContent = cs.sub; $('scam-ava').textContent = cs.ava;
  const ol = $('scam-steps'); ol.innerHTML = ''; cs.steps.forEach((s) => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
  const lib = $('scam-lib'); lib.innerHTML = ''; (G.SCAM_LIBRARY || []).forEach((n) => { const li = document.createElement('li'); li.textContent = n; if (n === cs.title) li.className = 'cur'; lib.appendChild(li); });
  $('scam-quota').textContent = S.dark ? `Doanh số của bạn: ${money(S.stats.sales)} · Ví hoa hồng: ${money(S.stats.wallet)}` : 'KHÔNG LÀM = CHÍCH ĐIỆN. Chỉ tiêu ngày: 5.000$ / người. Thiếu chỉ tiêu: không cơm, phạt “phòng tối”. Camera ghi lại toàn bộ màn hình.';
  const chat = $('scam-chat'), opts = $('scam-opts'); chat.innerHTML = ''; opts.innerHTML = '';
  let r = 0, lastB = false, warns = 0;
  const add = (who, text) => { const m = document.createElement('div'); m.className = 'msg ' + who; m.textContent = text; chat.appendChild(m); chat.scrollTop = chat.scrollHeight; };
  const round = () => {
    const R = cs.rounds[r];
    const tEl = document.createElement('div'); tEl.className = 'typing'; tEl.innerHTML = '<i></i><i></i><i></i>'; chat.appendChild(tEl);
    setTimeout(() => {
      tEl.remove(); add('them', R.v.length > 1 && lastB ? R.v[1] : R.v[0]); G.sfx('msg'); opts.innerHTML = '';
      [['a', 'Làm theo kịch bản', R.a], ['b', 'Cảnh báo người này (bị phát hiện là bị phạt)', R.b]].forEach(([k, lab, text]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'choice ' + k; const lb = document.createElement('b'); lb.textContent = lab; b.appendChild(lb); b.appendChild(document.createTextNode(text));
        b.onclick = () => { opts.innerHTML = ''; add('me', text); G.sfx('type'); lastB = k === 'b'; if (lastB) warns++; r++; if (r < cs.rounds.length) setTimeout(round, 650); else setTimeout(result, 800); };
        opts.appendChild(b);
      });
    }, 1100);
  };
  const result = () => {
    const ok = warns >= 2;
    add('sys', ok ? cs.victimShort + ' đã rời cuộc trò chuyện.' : 'Giao dịch thành công: +' + cs.amountText);
    const p = document.createElement('div'); p.className = 'result'; p.textContent = ok ? cs.okText : cs.badText;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary'; b.style.justifySelf = 'end'; b.textContent = 'Tiếp';
    b.onclick = () => { $('scam').hidden = true; S.busy = false; if (ok) S.stats.warned++; else { S.stats.scammed++; S.stats.sales += cs.amount; S.stats.wallet += cs.amount * (S.dark ? 0.3 : 0.08); } done(ok, warns); };
    opts.innerHTML = ''; opts.appendChild(p); opts.appendChild(b);
  };
  round();
};

// ---------------- cutscene camera ----------------
G.cine = (pos, look, snap, k) => { G.cam.mode = 'cine'; G.cam.cine.pos.set(pos[0], pos[1], pos[2]); G.cam.cine.look.set(look[0], look[1], look[2]); G.cam.cine.snap = !!snap; G.cam.cine.k = k || 2.5; if (snap) { G.camera.position.set(pos[0], pos[1], pos[2]); } };
G.cineOff = () => { G.cam.mode = 'tp'; G.cam.cine.snap = false; };

// ---------------- interactions ----------------
const near = (p, r) => Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r;
G.near = near;
function updateInteract(dt) {
  let best = null, bd = 1e9;
  if (!S.busy && !P.frozen || S.hold) {
    for (const it of G.INTER) { if (it.when && !it.when()) continue; const p = it.at(); const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  }
  if (S.hold && S.hold.it !== best) { if (S.hold.it.onCancel) S.hold.it.onCancel(); S.hold = null; }
  const pr = $('prompt');
  if (!best || S.busy) { pr.hidden = true; return; }
  const blocked = best.block && best.block();
  pr.hidden = false; $('prompt-text').textContent = blocked || (typeof best.label === 'function' ? best.label() : best.label); $('prompt-key').hidden = !!blocked;
  pr.style.opacity = blocked ? 0.75 : 1;
  // becoming blocked mid-hold (e.g. a teammate lets go of the ladder) cancels the hold
  if (blocked) { if (S.hold && S.hold.it === best) { if (best.onCancel) best.onCancel(); S.hold = null; } $('prompt-hold').style.width = '0'; return; }
  if (best.hold) {
    if (G.input.use) {
      if (!S.hold) S.hold = { it: best, p: 0 };
      // co-op holds: progress only while enough teammates hold E on the same spot
      const have = best.need ? G.coopCount(best.coop) : 0;
      if (best.need && have < best.need) $('prompt-text').textContent = 'Chờ đồng đội cùng giữ E (' + have + '/' + best.need + ')';
      else S.hold.p = Math.min(1, S.hold.p + dt / best.hold);
      if (best.onHold) best.onHold(S.hold.p);
      if (S.hold.p >= 1) { S.hold = null; $('prompt-hold').style.width = '0'; best.run(); return; }
    } else if (S.hold) { if (best.onCancel) best.onCancel(); S.hold = null; }
    $('prompt-hold').style.width = ((S.hold ? S.hold.p : 0) * 100) + '%';
  } else if (G.input.usePressed) best.run();
}
G.currentObj = () => G.OBJ.find((o) => !o.opt && !o.done()) || null;

// ---------------- co-op holds (team mode) ----------------
// An interaction with { coop: 'key' } marks the spot this player is holding; it is sent to the room in 'st'.
// { need: n } makes progress wait until n players hold the same key at once.
G.coopMine = () => (S.hold && S.hold.it.coop && G.input.use ? S.hold.it.coop : '');
G.coopOthers = (k) => { if (!S.mp || !G.net.on) return 0; let n = 0; for (const p of G.net.peers.values()) if (p.hl === k && G.net.fresh(p)) n++; return n; };
G.coopCount = (k) => (G.coopMine() === k ? 1 : 0) + G.coopOthers(k);

// ---------------- mission timers ----------------
// An objective may carry { time: seconds, lv: 1..4 }. The countdown starts when it becomes the current objective,
// stops while a dialog / phone / scam screen is open or the game is paused (solo), and on expiry calls G.onMissionTimeout.
G.LV_NAME = ['', 'Dễ', 'Vừa', 'Khó', 'Rất khó'];
const MT = G.mtimer = { obj: null, left: 0, total: 0, beep: 0, warned: false, fired: false, live: false };
const fmtSec = G.fmtSec = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
G.missionIndex = (o) => { const list = G.OBJ.filter((x) => !x.opt); return [list.indexOf(o) + 1, list.length]; };
G.missionTimerRefill = (frac) => { if (MT.total && !MT.fired) MT.left = Math.max(MT.left, Math.ceil(MT.total * frac)); };
function updateMissionTimer(dt) {
  const cur = G.currentObj();
  if (cur !== MT.obj) { MT.obj = cur; MT.total = cur && cur.time ? cur.time : 0; MT.left = MT.total; MT.beep = Math.ceil(MT.total); MT.warned = false; MT.fired = false; }
  MT.live = false;
  if (!MT.total || MT.fired || S.ended || $('hud').hidden) return;
  // team mode: the host owns the clock (never pauses); other players tick locally between host snapshots and never fire
  const replica = S.mp && G.net.on && !G.net.isHost();
  MT.live = S.mp ? $('card').hidden : (!S.busy && G.cam.mode !== 'cine');
  // a guest only counts down on its own for a moment after each host update, so it never runs ahead of a slow host
  if (MT.live && MT.left > 0 && !(replica && performance.now() - (MT.netAt || 0) > 600)) {
    MT.left = Math.max(0, MT.left - dt);
    if (!MT.warned && MT.total >= 60 && MT.left <= 30) { MT.warned = true; ui.toast('Còn 30 giây để hoàn thành nhiệm vụ!', 2400); }
    const s = Math.ceil(MT.left); if (s <= 10 && s < MT.beep) { MT.beep = s; G.sfx('beep'); }
  }
  if (MT.left <= 0 && !replica && (S.mp || !S.busy)) { MT.fired = true; if (G.onMissionTimeout) G.onMissionTimeout(cur); }
}
G.onNetTimer = (mt) => { if (MT.obj && !MT.fired && G.OBJ.indexOf(MT.obj) === mt[0]) { MT.left = Math.max(0, Math.min(MT.total, mt[1])); MT.netAt = performance.now(); } };
G.missionTimerAdd = (sec) => { if (MT.total && !MT.fired) MT.left = Math.min(MT.total, MT.left + sec); };
let mtSig = '';
function drawMissionTimer() {
  const el = $('mtimer'), on = !!MT.total && !MT.fired;
  const sig = on ? Math.ceil(MT.left) + '|' + MT.live + '|' + MT.obj.lv : '';
  if (sig === mtSig) return; mtSig = sig; el.hidden = !on; if (!on) return;
  const lv = MT.obj.lv || 2;
  $('mt-time').textContent = fmtSec(MT.left);
  $('mt-lv').textContent = G.LV_NAME[lv]; el.dataset.lv = lv;
  $('mt-bar').style.width = (MT.left / MT.total * 100).toFixed(1) + '%';
  el.classList.toggle('warn', MT.left <= Math.min(30, MT.total * 0.5));
  el.classList.toggle('crit', MT.left <= 10);
  el.classList.toggle('held', !MT.live);
}

// beacon over the current objective
const beacon = new T.Group(); G.scene.add(beacon);
const gem = new T.Mesh(new T.OctahedronGeometry(0.22), G.std({ color: C(0xf0a23a), emissive: C(0xf0a23a), emissiveIntensity: 1.6 })); gem.position.y = 2.3; beacon.add(gem);
const bBeam = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 40, 8, 1, true), new T.MeshBasicMaterial({ color: C(0xf0a23a), transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
bBeam.position.y = 22.3; beacon.add(bBeam);
// second beacon (team mode): the partner spot of a two-person mission (teal), or a tied-up teammate (red)
const beacon2 = new T.Group(); G.scene.add(beacon2); beacon2.visible = false;
const gem2Mat = G.std({ color: C(0x3fbf8a), emissive: C(0x3fbf8a), emissiveIntensity: 1.6 });
const gem2 = new T.Mesh(new T.OctahedronGeometry(0.18), gem2Mat); gem2.position.y = 2.2; beacon2.add(gem2);
const bBeam2Mat = new T.MeshBasicMaterial({ color: C(0x3fbf8a), transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, fog: false });
const bBeam2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 40, 8, 1, true), bBeam2Mat); bBeam2.position.y = 22.2; beacon2.add(bBeam2);

// ---------------- HUD + minimap ----------------
let objSig = '', objCur = null, objNewUntil = 0;
// ---- collapsible mission list: phones start collapsed (only the current mission), the choice is remembered ----
let objMin = null;
try { const v = localStorage.getItem('mnbl-objmin'); if (v !== null) objMin = v === '1'; } catch (e) { /* storage blocked */ }
if (objMin === null) objMin = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
function setObjMin(on, save) {
  objMin = on; $('hud').classList.toggle('obj-min', on);
  $('obj-toggle').setAttribute('aria-expanded', String(!on)); $('obj-act').textContent = on ? 'Xem tất cả ▾' : 'Thu gọn ▴';
  if (save) { try { localStorage.setItem('mnbl-objmin', on ? '1' : '0'); } catch (e) { /* storage blocked */ } }
}
setObjMin(objMin, false);
G.toggleObjectives = () => setObjMin(!objMin, true);
$('obj-toggle').addEventListener('click', G.toggleObjectives);
$('objectives').addEventListener('click', () => { if (objMin) setObjMin(false, true); }); // tap the collapsed mission to see all
// touch buttons mirror the game state: toggles lit when on, "Dùng" glows when something can be used, "Ném đá" dims outside stealth
let touchSig = '';
function syncTouch() {
  const ready = !$('prompt').hidden && !$('prompt-key').hidden && !S.busy;
  const sig = (G.input.crouch ? 'c' : '') + (G.input.run ? 'r' : '') + (ready ? 'u' : '') + (S.stealthPhase ? 's' : '');
  if (sig === touchSig) return; touchSig = sig;
  $('t-crouch').classList.toggle('on', !!G.input.crouch); $('t-run').classList.toggle('on', !!G.input.run);
  $('t-use').classList.toggle('ready', ready); $('t-throw').classList.toggle('dim', !S.stealthPhase);
}
function updateHud(det) {
  $('clock-time').textContent = fmtClock(G.timeH * 60);
  $('clock-phase').textContent = S.phaseLabel || '';
  if (S.dark) { $('debt-label').textContent = 'Doanh số'; $('debt').textContent = money(S.stats.sales); $('debt').classList.add('gold'); }
  else { $('debt-label').textContent = 'Nợ chuộc thân'; $('debt').textContent = money(S.debt); $('debt').classList.remove('gold'); }
  $('caught').textContent = S.mp ? String(S.caught) : S.caught + ' / ' + S.maxCaught;
  const away = S.phase === 'ch4' || S.phase === 'airport'; // the escape and the flight: no debt, no three strikes
  if ($('stat-debt').hidden !== (!!S.mp || away)) $('stat-debt').hidden = !!S.mp || away; // no ransom debt in team mode
  if ($('stat-caught').hidden !== away) $('stat-caught').hidden = away;
  document.body.classList.toggle('team-escape', away && !!S.mp); // (a fuller HUD: the stylesheet thins it out on phones)
  const cur = G.currentObj();
  const dist = cur ? Math.round(Math.hypot(P.pos.x - cur.at().x, P.pos.z - cur.at().z)) : 0;
  const sig = G.OBJ.map((o) => (o.done() ? 1 : 0) + (o === cur ? 'c' : '') + o.t).join('|') + dist + JSON.stringify(S.items);
  if (cur !== objCur) { objCur = cur; objNewUntil = cur && G.OBJ.indexOf(cur) > 0 ? performance.now() + 3000 : 0; } // flag a fresh mission for 3 s
  if (sig !== objSig || (objNewUntil && performance.now() > objNewUntil)) {
    if (objNewUntil && performance.now() > objNewUntil) objNewUntil = 0;
    objSig = sig; const ul = $('objectives'); ul.innerHTML = '';
    G.OBJ.forEach((o) => {
      const li = document.createElement('li'); li.className = (o.done() ? 'done ' : '') + (o === cur ? 'cur ' : '') + (o === cur && objNewUntil ? 'new ' : '') + (o.opt ? 'opt' : '');
      const ot = document.createElement('span'); ot.className = 'ot'; ot.textContent = o.t; li.appendChild(ot);
      if (o === cur) { const s = document.createElement('span'); s.className = 'dist'; s.textContent = dist + 'm'; li.appendChild(s); }
      ul.appendChild(li);
    });
    const main = G.OBJ.filter((o) => !o.opt), done = main.filter((o) => o.done()).length;
    $('obj-count').textContent = (S.actLabel ? S.actLabel + ' · ' : 'Nhiệm vụ ') + Math.min(main.length, done + (cur ? 1 : 0)) + '/' + main.length; // (a long map also says which act)
    $('obj-box').hidden = !G.OBJ.length;
    const inv = $('inv'); inv.innerHTML = ''; Object.entries(S.items).forEach(([k, v]) => { if (!v || !G.ITEM_NAMES || !G.ITEM_NAMES[k]) return; const s = document.createElement('span'); s.className = 'it'; s.textContent = G.ITEM_NAMES[k]; inv.appendChild(s); });
  }
  const team = $('team');
  const teamSig = S.mp ? [...G.net.peers.values()].map((p) => p.id + p.name + (p.td ? 't' : '') + (p.o ? 'o' : '')).join('|') + (G.net.isHost() ? 'H' : '') : '';
  if (team.dataset.sig !== teamSig) {
    team.dataset.sig = teamSig; team.textContent = ''; team.hidden = !S.mp;
    if (S.mp) {
      const head = document.createElement('span'); head.className = 'team-head'; head.textContent = 'Đồng đội · ' + (G.net.roomName || G.net.room); team.appendChild(head);
      for (const p of G.net.peers.values()) { const s = document.createElement('span'); s.className = 'mate' + (p.td ? ' tied' : p.o ? ' out' : ''); s.style.setProperty('--mate', '#' + p.color.toString(16).padStart(6, '0')); const tw = G.story && G.story.teamMap ? G.story.teamMap() : {}; s.textContent = p.name + (p.td ? ' · ' + (tw.downWord || 'bị trói') : p.o ? ' · ' + (tw.outWord || 'đã ra ngoài') : ''); team.appendChild(s); }
      if (!G.net.peers.size) { const s = document.createElement('span'); s.className = 'mate'; s.textContent = 'Không còn đồng đội'; team.appendChild(s); }
    }
  }
  // team-mode status line: [class, text] from the story, or null
  const bn = !G.story ? null : S.mp ? (G.story.teamBanner ? G.story.teamBanner() : null) : (G.story.soloBanner ? G.story.soloBanner() : null), bEl = $('mp-banner'), bSig = bn ? bn.join('|') : '';
  if (bEl.dataset.sig !== bSig) { bEl.dataset.sig = bSig; bEl.hidden = !bn; if (bn) { bEl.className = bn[0]; bEl.textContent = bn[1]; } }
  drawMissionTimer();
  if (G.input.touch) syncTouch();
  const st = S.teamPlay && G.mySight && G.mySight.v > 0 && G.mySight.v >= det ? G.mySight : null; // the guards' 5 s rule (not the searchlights')
  const d = $('detect'); d.classList.toggle('on', st ? true : det > 0.02); d.classList.toggle('hot', st ? st.seen && det > 0.6 : det > 0.6);
  document.body.classList.toggle('detecting', d.classList.contains('on'));
  d.querySelector('i').style.width = (det * 100) + '%';
  $('detect-label').textContent = (st && (st.seen ? 'Chạy ngay · ' + Math.max(1, Math.ceil(st.left - 0.02)) + ' giây' : 'Đang thoát')) || (G.detLabel && G.detLabel(det)) || (det > 0.72 ? 'Bị phát hiện!' : det > 0.33 ? 'Nghi ngờ' : 'Có người để ý');
  $('vignette').style.boxShadow = `inset 0 0 160px 40px rgba(195,22,28,${(det * (S.phase === 'ch4' ? 0.22 : 0.55)).toFixed(2)})`;
}
// ---- minimap: drawn at the size it is shown (crisp at any size); small = markers only, big = labels too.
// Tap it (or press M) to open it big in the middle of the screen; tap again or outside to shrink it back.
const mm = $('minimap'), mg = mm.getContext('2d');
let mapBig = false;
G.toggleMap = (on) => {
  mapBig = on === undefined ? !mapBig : !!on;
  if (mapBig && mm.hidden) mapBig = false;
  document.body.classList.toggle('map-big', mapBig); $('map-shade').hidden = !mapBig;
  drawMinimap(performance.now() / 1000);
};
mm.addEventListener('click', (e) => { e.stopPropagation(); G.toggleMap(); });
$('map-shade').addEventListener('click', () => G.toggleMap(false));
function drawMinimap(t) {
  const cfg = G.levelCfg, b = cfg.bounds; mm.hidden = !b;
  if (!b) { if (mapBig) { mapBig = false; document.body.classList.remove('map-big'); $('map-shade').hidden = true; } return; }
  const cw = mm.clientWidth, ch = mm.clientHeight; if (!cw || !ch) return;
  const u = Math.min(2.5, devicePixelRatio || 1), W = Math.round(cw * u), H = Math.round(ch * u);
  if (mm.width !== W || mm.height !== H) { mm.width = W; mm.height = H; }
  const big = cw >= 300, sz = (big ? 1.6 : cw < 130 ? 1.15 : 1) * u; // one marker unit in canvas px
  const msc = Math.min(W / (b.x1 - b.x0), H / (b.z1 - b.z0)), mox = (W - (b.x1 - b.x0) * msc) / 2, moz = (H - (b.z1 - b.z0) * msc) / 2;
  const mx = (x) => mox + (x - b.x0) * msc, mz = (z) => moz + (z - b.z0) * msc;
  const g = mg; g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(30,34,30,.7)'; g.fillRect(0, 0, W, H);
  const c = cfg.compound;
  if (c) { g.fillStyle = 'rgba(70,58,44,.9)'; g.fillRect(mx(c.x0), mz(c.z0), (c.x1 - c.x0) * msc, (c.z1 - c.z0) * msc); g.strokeStyle = '#a99d88'; g.lineWidth = 1.5 * u; g.strokeRect(mx(c.x0), mz(c.z0), (c.x1 - c.x0) * msc, (c.z1 - c.z0) * msc); }
  if (cfg.street) { g.fillStyle = 'rgba(40,40,46,.95)'; g.fillRect(mx(cfg.street.x0), 0, (cfg.street.x1 - cfg.street.x0) * msc, H); }
  if (cfg.fence) { g.strokeStyle = S.f.fenceCut ? '#3f8a7e' : '#d7d0c0'; g.setLineDash([2 * u, 1.5 * u]); g.lineWidth = 1.5 * u; g.beginPath(); g.moveTo(mx(cfg.fence.x), mz(cfg.fence.z0)); g.lineTo(mx(cfg.fence.x), mz(cfg.fence.z1)); g.stroke(); g.setLineDash([]); }
  g.font = '600 ' + ((big ? 12 : 7.5) * u) + 'px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const extra = cfg.extra || [], fs = (big ? 12 : 7.5) * u;
  const blocks = G.buildings.concat(extra);
  for (const bl of blocks) { g.fillStyle = bl.name === 'ptoi' ? '#5a2226' : '#2b2622'; g.fillRect(mx(bl.x0), mz(bl.z0), (bl.x1 - bl.x0) * msc, (bl.z1 - bl.z0) * msc); }
  // names after every block is filled; extra areas (the scaffold tower) along their top edge so they don't sit on a neighbour's name
  if (cw >= 160) for (const bl of blocks) if (bl.label && (bl.x1 - bl.x0) > 7) { g.fillStyle = 'rgba(234,220,194,.8)'; g.fillText(bl.label, mx((bl.x0 + bl.x1) / 2), extra.includes(bl) ? mz(bl.z0) + fs * 0.8 : mz((bl.z0 + bl.z1) / 2)); }
  if (G.night > 0.5) for (const s of G.searchlights) { if (s.off || s.roofed || (s.red && G.lightsOut) || (!s.red && (G.lightsOut || G.night < 0.5))) continue; g.fillStyle = s.red ? 'rgba(255,60,60,.35)' : 'rgba(255,244,216,.28)'; g.beginPath(); g.arc(mx(s.tgt.x), mz(s.tgt.z), s.r * msc, 0, 7); g.fill(); }
  for (const gd of G.guards) {
    // team mode shows the zone that counts: by day too, seated guards too, as far as that guard sees you right now
    const team = !!S.teamPlay, hot = gd.state === 'alert' || (team && gd.wp > 0);
    if (gd.state !== 'sleep' && (team || (G.night > 0.5 && gd.state !== 'sit'))) {
      const sight = team ? G.sightRange(gd, G.sightVis()) : 13 * (gd.dog ? G.DOG_SIGHT : 1);
      g.fillStyle = hot ? 'rgba(255,40,40,.35)' : 'rgba(240,162,58,.22)'; const a = Math.atan2(Math.cos(gd.yaw), Math.sin(gd.yaw)); g.beginPath(); g.moveTo(mx(gd.pos.x), mz(gd.pos.z)); g.arc(mx(gd.pos.x), mz(gd.pos.z), sight * msc, a - 0.7, a + 0.7); g.closePath(); g.fill();
      if (gd.dog) { // it also smells you all round it: a small ring that shrinks while you sneak
        g.strokeStyle = hot ? 'rgba(255,40,40,.6)' : 'rgba(192,128,64,.55)'; g.lineWidth = u; g.setLineDash([2 * u, 2 * u]);
        g.beginPath(); g.arc(mx(gd.pos.x), mz(gd.pos.z), (P.crouch ? G.DOG_SMELL.sneak : G.DOG_SMELL.stand) * msc, 0, 7); g.stroke(); g.setLineDash([]);
      }
    }
    g.fillStyle = hot ? '#ff3030' : gd.dog ? '#c08040' : '#f0a23a'; g.beginPath(); g.arc(mx(gd.pos.x), mz(gd.pos.z), (gd.dog ? 1.5 : 2) * sz, 0, 7); g.fill();
  }
  if (G.mapMarks) for (const p of G.mapMarks()) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(mx(p.x), mz(p.z), 2.2 * sz, 0, 7); g.fill(); } // the men chasing (Chapter 4)
  if (S.mp) for (const p of G.net.peers.values()) {
    if (!p.got || p.p === 'gone') continue; g.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); g.strokeStyle = '#000'; g.lineWidth = u; g.beginPath(); g.arc(mx(p.pos.x), mz(p.pos.z), 2.75 * sz, 0, 7); g.fill(); g.stroke();
    if (p.td) { g.strokeStyle = (t * 3) % 1 < 0.5 ? '#ff3030' : '#ffffff'; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(mx(p.pos.x), mz(p.pos.z), 5 * sz, 0, 7); g.stroke(); }
  }
  const o = G.currentObj(), q = 3 * sz;
  const o2 = o && o.at2 ? o.at2() : null; // (may have none just now)
  if (o2) { const p = o2; g.save(); g.translate(mx(p.x), mz(p.z)); g.rotate(Math.PI / 4); g.strokeStyle = '#3fbf8a'; g.lineWidth = 1.5 * u; g.strokeRect(-q, -q, 2 * q, 2 * q); g.restore(); }
  if (o) { const p = o.at(); g.save(); g.translate(mx(p.x), mz(p.z)); g.rotate(Math.PI / 4); g.fillStyle = '#f0a23a'; g.strokeStyle = '#000'; g.lineWidth = u; g.fillRect(-q, -q, 2 * q, 2 * q); g.strokeRect(-q, -q, 2 * q, 2 * q); g.restore(); }
  g.save(); g.translate(mx(P.pos.x), mz(P.pos.z)); g.rotate(-P.yaw + Math.PI); g.scale(sz / 2, sz / 2);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
}
ui.hud = (on) => { $('hud').hidden = !on; $('touch').hidden = !(on && G.input.touch); $('keys').hidden = G.input.touch; if (!on && mapBig) G.toggleMap(false); };

// ---------------- checkpoints (per browser) ----------------
G.saveCheckpoint = (ch) => { try { localStorage.setItem('mnbl-ckpt', JSON.stringify({ ch, stats: S.stats, debt: S.debt })); } catch (e) { /* storage blocked */ } };
G.loadCheckpoint = () => { try { return JSON.parse(localStorage.getItem('mnbl-ckpt') || 'null'); } catch (e) { return null; } };

// ---------------- pause / settings / lobby ----------------
const playing = () => S.phase !== 'title' && S.phase !== 'ending' && !S.ended;
G.playing = playing;
G.wantsPointerLock = () => playing() && !S.paused && !S.busy && !S.panel && !G.input.touch && G.cam.mode !== 'cine';
// Solo: pauses this game. Team mode: pauses the whole room (mission clock, guards, bots) through the server, which
// tells everyone; anyone can resume. `fromNet` = the room told us, so don't send it back.
let pauseBy = '';
function setPause(on, fromNet) {
  if (!playing() || (on && S.busy && !fromNet)) return;
  if (S.mp && G.net.on && !fromNet) { pauseBy = 'Bạn'; G.net.send({ t: 'pause', on }); }
  S.paused = on; $('pause').hidden = !on;
  if (!on) $('settings').hidden = true;
  if (on) {
    G.unlockPointer(); const o = G.currentObj();
    $('pause-title').textContent = S.mp ? 'Cả đội tạm dừng' : 'Tạm dừng';
    $('pause-obj').textContent = (S.mp ? (pauseBy || 'Đồng đội') + ' đã tạm dừng cả đội: đồng hồ nhiệm vụ, lính gác và bot đều dừng lại. Ai bấm “Tiếp tục” thì cả đội chơi tiếp. ' : '')
      + (o ? 'Nhiệm vụ hiện tại: ' + o.t : '') + (o && MT.obj === o && MT.total ? ' · Còn ' + fmtSec(MT.left) + ' (' + (S.mp && G.story.teamBase().retry ? 'hết giờ là làm lại chặng này' : 'hết giờ là chết, chơi lại từ nhiệm vụ 1') + ')' : '');
    $('btn-resume').textContent = S.mp ? 'Tiếp tục cho cả đội' : 'Tiếp tục';
    $('btn-retry').hidden = !(S.chapter >= 1 && !S.mp);
  }
}
G.setPause = setPause;
G.onNetPause = (m) => {
  if (!S.teamPlay || S.ended) return;
  const mine = m.by === G.net.id;
  pauseBy = mine ? 'Bạn' : m.name;
  if (!!m.on !== S.paused) setPause(!!m.on, true);
  if (!m.on && !mine) ui.toast(m.left ? m.name + ' đã rời phòng. Cả đội chơi tiếp.' : m.name + ' đã cho cả đội chơi tiếp', 2600);
  else if (m.on && !mine) ui.toast(m.name + ' đã tạm dừng cả đội', 2200);
};
G.onKey = function (code) {
  if (G.ctlEditing || G.creatorOpen) return; // the control-layout editor / character creator handle their own keys
  if (code === 'Escape' && mapBig) { G.toggleMap(false); return; }
  if (G.panel && G.panel.key(code)) return; // a puzzle is open (panel.js)
  if (code === 'KeyM' && playing()) { G.toggleMap(); return; }
  if (code === 'Escape' && !$('settings').hidden) { $('settings').hidden = true; return; }
  if (code === 'Escape' && !$('lobby').hidden) { $('lobby').hidden = true; return; }
  // Esc in fullscreen leaves fullscreen (browser) and only ever pauses here, so it can't unpause by accident
  if (code === 'Escape' && (fsEl() || performance.now() - fsExitAt < 500)) { if (!S.busy && !S.paused) setPause(true); return; }
  if (code === 'Escape' || code === 'KeyP') { if (!S.busy) setPause(!S.paused); }
  if (code === 'KeyJ' && playing() && G.toggleObjectives) G.toggleObjectives();
  if (card && ['KeyE', 'Space', 'Enter'].includes(code)) cardNext();
};
let wasLocked = false;
document.addEventListener('pointerlockchange', () => { const l = !!document.pointerLockElement; if (wasLocked && !l && playing() && !S.busy && !S.panel) setPause(true); wasLocked = l; });

// ---------------- fullscreen + keyboard lock (desktop) ----------------
// Ctrl is crouch and W is walk, so Ctrl+W used to close the tab. In fullscreen, the Keyboard Lock API
// (Chrome / Edge) hands browser shortcuts (Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Tab…) to the game instead.
// Escape is left out of the lock, so one press of Esc still leaves fullscreen.
const FS_KEY = 'mnbl-fs';
let fsPref = true; try { fsPref = localStorage.getItem(FS_KEY) !== '0'; } catch (e) { /* storage blocked */ }
const LOCK_CODES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => 'Key' + c).concat([...'0123456789'].map((d) => 'Digit' + d),
  ['Space', 'Tab', 'Enter', 'Backspace', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Backslash', 'Backquote']);
const docEl = document.documentElement;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsOK = () => !G.input.touch && !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
const canLockKeys = () => !!(navigator.keyboard && navigator.keyboard.lock);
let fsExitAt = -1e9, fsHinted = false;
G.enterFullscreen = function () {
  if (!fsOK() || fsEl()) return;
  try {
    const r = docEl.requestFullscreen ? docEl.requestFullscreen({ navigationUI: 'hide' }) : docEl.webkitRequestFullscreen();
    if (r && r.then) r.then(() => {}, () => {}); // refused (sandboxed frame, no gesture): keep playing windowed
  } catch (e) { /* not allowed here */ }
};
G.exitFullscreen = function () {
  if (!fsEl()) return;
  try { const r = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
};
function onFullscreen() {
  const on = !!fsEl();
  document.body.classList.toggle('fs', on);
  $('btn-pause-fs').textContent = on ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình';
  if (on) {
    if (canLockKeys()) navigator.keyboard.lock(LOCK_CODES).catch(() => {});
    if (!fsHinted) {
      fsHinted = true;
      ui.toast(canLockKeys() ? 'Toàn màn hình: Ctrl + W giờ chỉ điều khiển game. Nhấn Esc để thoát toàn màn hình.'
        : 'Toàn màn hình. Nhấn Esc để thoát. Trình duyệt này không chặn được Ctrl + W, nếu lỡ bấm sẽ có hộp hỏi lại.', 4500);
    }
  } else {
    fsExitAt = performance.now();
    if (canLockKeys() && navigator.keyboard.unlock) navigator.keyboard.unlock();
    if (playing() && !S.busy && !S.paused) setPause(true);
  }
}
document.addEventListener('fullscreenchange', onFullscreen);
document.addEventListener('webkitfullscreenchange', onFullscreen);
// enter fullscreen from a real click: the start / resume buttons, or a click on the game view while playing.
// 'click' (not pointerdown) so the layout change of going fullscreen can't swallow the button's own click.
const FS_BUTTONS = new Set(['btn-start', 'btn-continue', 'btn-resume', 'btn-quick-bot', 'btn-room-start']);
document.addEventListener('click', (e) => {
  if (!fsPref || fsEl() || e.pointerType === 'touch' || !fsOK()) return;
  const t = e.target, b = t && t.closest && t.closest('button');
  if ((b && FS_BUTTONS.has(b.id)) || (t && t.tagName === 'CANVAS' && playing() && !S.paused)) G.enterFullscreen();
}, true);
$('btn-pause-fs').hidden = !fsOK();
$('btn-pause-fs').onclick = () => { if (fsEl()) G.exitFullscreen(); else G.enterFullscreen(); };
$('fs-opt').hidden = !fsOK();
$('opt-fs').checked = fsPref;
$('opt-fs').addEventListener('change', (e) => {
  fsPref = e.target.checked;
  try { localStorage.setItem(FS_KEY, fsPref ? '1' : '0'); } catch (err) { /* storage blocked: keeps for this visit */ }
});
// while playing, Ctrl/Cmd + letter must not trigger browser shortcuts (save, find, bookmark…); devtools stays reachable
addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !playing()) return;
  const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC')) return;
  if (/^(Key|Digit)/.test(e.code) || e.code === 'Tab') e.preventDefault();
}, true);
// last line of defence (Firefox / Safari / windowed): ask before the tab closes mid-game
let leaving = false;
G.leavePage = (url) => { leaving = true; if (url) location.href = url; else location.reload(); };
addEventListener('beforeunload', (e) => { if (leaving || !playing()) return; e.preventDefault(); e.returnValue = ''; });
$('btn-how').onclick = () => { $('howto').hidden = false; };
$('btn-how-close').onclick = () => { $('howto').hidden = true; };
$('btn-resume').onclick = () => setPause(false);
$('btn-restart').onclick = () => G.leavePage();
$('btn-retry').onclick = () => { setPause(false); if (G.story && G.story.retry) G.story.retry(); };
$('btn-again').onclick = () => G.leavePage();
function syncSettings() { for (const k of ['music', 'sfx']) { $('vol-' + k).value = G.settings[k]; $('vol-' + k + '-val').textContent = G.settings[k] + '%'; } G.onZoom(G.cam.zoom); if (G.gfxSyncUI) G.gfxSyncUI(); }
// camera distance slider ↔ pinch / wheel
G.onZoom = (z) => { const p = Math.round(z * 100); $('cam-zoom').value = p; $('cam-zoom-val').textContent = p + '%'; };
$('cam-zoom').addEventListener('input', (e) => G.setZoom(e.target.value / 100, true));
for (const k of ['music', 'sfx']) $('vol-' + k).addEventListener('input', (e) => { G.audioInit(); G.setVolume(k, e.target.value); $('vol-' + k + '-val').textContent = G.settings[k] + '%'; });
$('vol-sfx').addEventListener('change', () => G.sfx('pickup'));
$('btn-settings').onclick = () => { syncSettings(); $('settings').hidden = false; };
$('btn-pause-settings').onclick = () => { syncSettings(); $('settings').hidden = false; };
$('btn-settings-close').onclick = () => { $('settings').hidden = true; };
$('btn-hud-pause').onclick = () => setPause(true);
const randRoom = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const inviteLink = (code) => location.origin + location.pathname + '?room=' + code;
function updateInvite() { const code = cleanCode($('mp-room').value); $('mp-room').value = code; $('mp-invite').textContent = code && G.net.supported() ? 'Link mời: ' + inviteLink(code) : ''; }
// ---- room list: every public room (even empty) + private rooms people created ----
const ROOM_CHIP = { empty: 'Trống', open: 'Còn chỗ', play: 'Đang chơi', full: 'Đầy' };
let roomsTimer = 0, joining = false, lastRooms = null;
const roomNote = (text) => { const ul = $('room-list'); ul.textContent = ''; const li = document.createElement('li'); li.className = 'note'; li.textContent = text; ul.appendChild(li); };
function renderRooms(d) {
  const ul = $('room-list'); ul.textContent = '';
  if (!d.rooms.length) { roomNote('Chưa có phòng nào.'); return; }
  lastRooms = d;
  for (const r of d.rooms) {
    const bots = r.b || 0, people = r.n - bots; // a real player can take a bot's seat, so only people make a room full
    const st = r.phase === 'play' ? 'play' : people >= d.max ? 'full' : r.n === 0 ? 'empty' : 'open';
    const li = document.createElement('li'); li.className = 'room-item'; li.dataset.state = st;
    const main = document.createElement('div'); main.className = 'rm-main';
    const b = document.createElement('b'); b.textContent = r.name;
    const mp = teamMaps()[r.map];
    const sm = document.createElement('small'); sm.textContent = (r.fixed ? 'Phòng công khai' : 'Phòng riêng · mã ' + r.code) + (r.n && mp ? ' · ' + mp.name : '') + (r.host ? ' · chủ phòng ' + r.host : '');
    main.append(b, sm);
    if (r.n && mp && mp.badge) { const hard = document.createElement('small'); hard.className = 'rm-hard'; hard.textContent = mp.badge + ': cân nhắc thời gian trước khi vào'; main.appendChild(hard); }
    const pips = document.createElement('div'); pips.className = 'pips'; pips.setAttribute('aria-label', r.n + ' trên ' + d.max + ' người');
    for (let i = 0; i < d.max; i++) { const pi = document.createElement('i'); if (i < people) pi.className = 'on'; else if (i < r.n) pi.className = 'bot'; pips.appendChild(pi); }
    const cnt = document.createElement('span'); cnt.textContent = r.n + '/' + d.max + (bots ? ' · ' + bots + ' bot' : ''); pips.appendChild(cnt);
    const act = document.createElement('div'); act.className = 'rm-act';
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = ROOM_CHIP[st];
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small' + (st === 'empty' || st === 'open' ? ' primary' : '');
    btn.textContent = st === 'empty' ? 'Tạo đội' : 'Vào'; btn.disabled = st === 'full' || st === 'play' || joining;
    btn.onclick = () => joinRoom(r.code);
    act.append(chip, btn); li.append(main, pips, act); ul.appendChild(li);
  }
}
async function refreshRooms() {
  if (!G.net.supported()) { roomNote('Danh sách phòng chỉ có khi mở game qua máy chủ riêng (link ngrok).'); return; }
  try { renderRooms(await G.net.fetchRooms()); } catch (e) { roomNote('Không tải được danh sách phòng. Kiểm tra máy chủ game còn chạy không.'); }
}
function openLobby(room, msg) {
  let saved = ''; try { saved = localStorage.getItem('mnbl-name') || ''; } catch (e) { /* storage blocked */ }
  if (!$('mp-name').value) $('mp-name').value = saved;
  $('mp-room').value = room || $('mp-room').value || randRoom();
  $('mp-status').textContent = msg || (G.net.supported() ? '' : 'Bản đang mở (trong Claude) không cho kết nối mạng. Mở game qua máy chủ riêng (link ngrok) để chơi nhiều người.');
  $('btn-join').disabled = !G.net.supported(); $('btn-quick-bot').disabled = !G.net.supported(); updateInvite(); $('lobby').hidden = false;
  refreshRooms(); clearInterval(roomsTimer);
  roomsTimer = setInterval(() => { if ($('lobby').hidden) clearInterval(roomsTimer); else refreshRooms(); }, 3000);
  if (!saved) setTimeout(() => $('mp-name').focus(), 50);
}
async function joinRoom(code, withBot) {
  const name = $('mp-name').value.trim().slice(0, 16); code = cleanCode(code);
  if (!name) { $('mp-status').textContent = 'Nhập tên hiển thị để đồng đội nhận ra bạn.'; $('mp-name').focus(); return; }
  if (!code) { $('mp-status').textContent = 'Nhập mã phòng (chữ hoặc số).'; return; }
  try { localStorage.setItem('mnbl-name', name); } catch (er) { /* storage blocked */ }
  joining = true; $('btn-join').disabled = true; $('mp-status').textContent = 'Đang vào phòng ' + code + '…'; G.audioInit();
  try { await G.net.connect(name, code); clearInterval(roomsTimer); $('lobby').hidden = true; G.showRoom(); if (withBot && G.net.isHost()) G.net.addBot(); }
  catch (msg) { $('mp-status').textContent = String(msg); refreshRooms(); }
  finally { joining = false; $('btn-join').disabled = !G.net.supported(); }
}
$('mp-room').addEventListener('input', updateInvite);
$('btn-mp').onclick = () => openLobby();
$('btn-rooms-refresh').onclick = refreshRooms;
// one tap: take the first empty public room (or a fresh private one) and bring a bot along
$('btn-quick-bot').onclick = async () => {
  if (!G.net.supported()) return;
  try { lastRooms = await G.net.fetchRooms(); } catch (e) { /* use whatever we have */ }
  const empty = lastRooms && lastRooms.rooms.find((r) => r.n === 0 && r.phase === 'wait');
  joinRoom(empty ? empty.code : randRoom(), true);
};
$('btn-lobby-close').onclick = () => { $('lobby').hidden = true; clearInterval(roomsTimer); };
$('lobby-form').addEventListener('submit', (e) => { e.preventDefault(); joinRoom($('mp-room').value); });
G.openLobby = openLobby;
G.openLobbyFromUrl = () => { const r = new URLSearchParams(location.search).get('room'); if (r) openLobby(cleanCode(r)); };
// ---- waiting room: who is in, host starts the round (needs at least 2) ----
function renderRoom() {
  if ($('room').hidden || !G.net.on) return;
  const N = G.net, list = [{ id: N.id, name: N.name, color: N.color }].concat([...N.peers.values()]);
  $('room-title').textContent = N.roomName && N.roomName !== N.room && !N.roomName.endsWith(N.room) ? N.roomName + ' · ' + N.room : N.roomName || N.room;
  $('room-count').textContent = list.length + '/' + N.max + ' người' + (list.length < N.min ? ' · cần thêm ' + (N.min - list.length) + ' người nữa mới bắt đầu được' : '');
  const ul = $('room-players'); ul.textContent = '';
  const host = N.isHost();
  list.forEach((p) => {
    const li = document.createElement('li'); li.style.setProperty('--mate', '#' + p.color.toString(16).padStart(6, '0')); if (p.bot) li.className = 'bot';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name; li.appendChild(nm);
    const tags = [p.id === N.hostId ? 'Chủ phòng' : '', p.id === N.id ? 'Bạn' : '', p.bot ? 'Bot hỗ trợ' : ''].filter(Boolean).join(' · ');
    if (tags) { const em = document.createElement('em'); em.textContent = tags; li.appendChild(em); }
    if (p.bot && host) { const x = document.createElement('button'); x.type = 'button'; x.className = 'kick'; x.textContent = '×'; x.title = 'Xóa ' + p.name; x.setAttribute('aria-label', 'Xóa ' + p.name); x.onclick = () => G.net.kickBot(p.id); li.appendChild(x); }
    ul.appendChild(li);
  });
  for (let i = list.length; i < N.max; i++) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Chỗ trống'; ul.appendChild(li); }
  renderMaps(host);
  $('room-invite').textContent = 'Link mời: ' + inviteLink(N.room);
  const enough = list.length >= N.min, people = list.filter((p) => !p.bot).length;
  $('btn-room-start').hidden = !host; $('btn-room-start').disabled = !enough;
  $('btn-room-bot').hidden = !host || list.length >= N.max;
  $('room-status').textContent = !host ? 'Đang chờ chủ phòng bắt đầu…'
    : !enough ? 'Chưa có ai vào? Bấm “+ Thêm bot” để chơi cùng bot ngay, hoặc gửi link mời cho bạn bè.'
    : people === 1 ? 'Bạn chơi cùng bot. Bấm Bắt đầu, hoặc chờ bạn bè vào thay chỗ bot.' : 'Bạn là chủ phòng. Bấm Bắt đầu khi cả đội đã sẵn sàng.';
}
// map picker: the story's maps with their team missions (story2.js ST.TEAMMAPS), and the long Myanmar map (myanmar.js)
const teamMaps = () => (G.story && G.story.TEAMMAPS) || {};
function renderMaps(host) {
  const maps = teamMaps(), N = G.net, cur = maps[N.map] ? N.map : 'sihanouk', box = $('room-maps');
  const sig = cur + (host ? 'H' : '') + '|' + (N.maps || []).join(',');
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig; box.textContent = '';
    for (const [k, m] of Object.entries(maps)) {
      const known = N.knowsMap(k);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'map-opt' + (m.badge ? ' hard' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === cur)); b.disabled = !host || !known;
      const t = document.createElement('b'); t.textContent = m.name; const s = document.createElement('span'); s.textContent = m.sub; b.append(t, s);
      if (m.badge) { const em = document.createElement('em'); em.className = 'map-badge'; em.textContent = m.badge; b.appendChild(em); }
      if (m.warn) { const w = document.createElement('span'); w.className = 'map-warn'; w.textContent = known ? m.warn : 'Chưa mở: máy chủ đang chạy bản cũ, cần khởi động lại. ' + m.warn; b.appendChild(w); }
      b.onclick = () => { if (G.net.isHost() && G.net.map !== k) G.net.setMap(k); };
      box.appendChild(b);
    }
    const m = maps[cur];
    if (m) {
      $('room-rules-title').textContent = m.rulesTitle || m.name + ' · cả đội phải hỗ trợ nhau mới thoát được';
      const ul = $('room-rules-list'); ul.textContent = '';
      for (const [a, txt] of m.rules) { const li = document.createElement('li'), bb = document.createElement('b'); bb.textContent = a + ':'; li.append(bb, ' ' + txt); ul.appendChild(li); }
    }
  }
  $('room-map-note').textContent = host ? 'Bạn là chủ phòng: bấm để chọn' : 'Chủ phòng chọn bản đồ';
  renderResume(host, maps[cur]);
  renderOpts(host, cur);
}
// a long map can be picked up again at the furthest act this host's browser has reached (server option `from`)
function renderResume(host, m) {
  const box = $('room-resume'), from = String((G.net.opts || {}).from || '0'), kept = host && m && m.saved ? m.saved() : 0;
  const show = !!m && !!m.saved && (kept > 0 || from !== '0');
  box.hidden = !show; if (!show) return;
  const pick = from !== '0' ? from : String(kept), sig = from + '|' + kept + (host ? 'H' : '');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig; box.textContent = '';
  const lab = document.createElement('span'); lab.id = 'opt-l-from'; lab.textContent = 'Bắt đầu từ';
  const seg = document.createElement('div'); seg.className = 'seg two'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-labelledby', lab.id);
  for (const [v, name] of [['0', 'Đầu map'], [pick, 'Chơi tiếp · ' + m.actName(+pick)]]) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(from === v)); b.disabled = !host;
    b.textContent = name;
    b.onclick = () => { if (G.net.isHost()) G.net.setOpts({ from: v }); };
    seg.appendChild(b);
  }
  box.append(lab, seg);
}
// round options: time of day, weather, mission time, number of guards (host chooses, everyone sees)
function renderOpts(host, map) {
  const groups = (G.story && G.story.TEAMOPTS) || [], o = G.net.opts || {}, box = $('room-opts');
  const sig = map + JSON.stringify(o) + (host ? 'H' : '');
  if (box.dataset.sig === sig) return; box.dataset.sig = sig; box.textContent = '';
  const hints = $('room-opt-hint'); hints.textContent = '';
  for (const g of groups) {
    const row = document.createElement('div'); row.className = 'opt-row';
    const lab = document.createElement('span'); lab.textContent = g.label; lab.id = 'opt-l-' + g.k;
    const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-labelledby', lab.id);
    for (const [v, name] of g.opts) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(o[g.k] === v)); b.disabled = !host;
      b.textContent = g.k === 'guards' && G.story.guardCount ? name + ' · ' + G.story.guardCount(map, v) : name;
      b.onclick = () => { if (G.net.isHost() && G.net.opts[g.k] !== v) G.net.setOpts({ [g.k]: v }); };
      seg.appendChild(b);
    }
    row.append(lab, seg); box.appendChild(row);
    const li = document.createElement('li'), bb = document.createElement('b'), pick = g.opts.find((x) => x[0] === o[g.k]);
    bb.textContent = g.label + ' · ' + (pick ? pick[1] : '') + ':'; const own = ((teamMaps()[map] || {}).hints || {})[g.k] || {}; li.append(bb, ' ' + (own[o[g.k]] || g.hint[o[g.k]] || '')); hints.appendChild(li);
  }
  const nb = $('btn-room-newbie'), newbie = G.story.NEWBIE_OPTS || {};
  nb.hidden = !host; nb.disabled = Object.keys(newbie).every((k) => o[k] === newbie[k]);
}
$('btn-room-newbie').onclick = () => { if (G.net.isHost()) G.net.setOpts(G.story.NEWBIE_OPTS); };
$('btn-room-bot').onclick = () => G.net.addBot();
G.showRoom = () => { if (!G.net.on) return; S.mp = true; $('title').hidden = true; $('ending').hidden = true; $('room').hidden = false; renderRoom(); };
G.onRoster = renderRoom;
G.onNetError = (msg) => { if (!$('room').hidden) $('room-status').textContent = msg; else ui.toast(msg, 3200); };
$('btn-room-start').onclick = () => { $('btn-room-start').disabled = true; G.net.send({ t: 'start' }); setTimeout(renderRoom, 1500); };
$('btn-room-leave').onclick = () => { G.net.leave(); S.mp = false; $('room').hidden = true; $('title').hidden = false; openLobby(); };

// ---------------- main loop ----------------
let last = performance.now(), heartT = 0, mmT = 0;
G.titleOrbit = { r: 135, h: 58, cx: 0, cz: 0 };
// optional frame cap (settings → Đồ họa → Giới hạn khung hình): an accumulator keeps the average rate exact
let capAcc = 0, capPrev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const cap = G.gfx && G.gfx.cap;
  if (cap) { capAcc += now - capPrev; capPrev = now; const iv = 1000 / cap; if (capAcc < iv - 1) return; capAcc = Math.min(capAcc - iv, iv); }
  else { capPrev = now; capAcc = 0; }
  tick(now);
}
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  const inp = G.input;
  G.weatherTick(dt, P.indoor);
  if (S.phase === 'title' || S.phase === 'ending') {
    const a = t * 0.04, o = G.titleOrbit;
    G.camera.position.set(o.cx + Math.cos(a) * o.r, o.h, o.cz + Math.sin(a) * o.r); G.camera.lookAt(o.cx, 4, o.cz);
    G.stealth = false; G.updateGuards(dt, t); G.updateSearchlights(dt, t); G.updateNpcs(dt, t); G.worldTick(dt, t);
    G.updateSky({ x: o.cx, z: o.cz }); beacon.visible = false; beacon2.visible = false; G.musicMood(S.phase === 'ending' ? (S.endMood || 'hope') : 'title', 0);
    G.render(); inp.usePressed = false; inp.throwPressed = false; return;
  }
  // paused (solo, or the whole team room): nothing moves, no clock, no guards, no bots
  if (S.paused) { inp.keys = {}; inp.joyX = inp.joyY = 0; inp.lookX = inp.lookY = 0; inp.use = false; inp.usePressed = false; inp.throwPressed = false; G.render(); return; }
  if (dlg && !dlg.choice) { dlg.shown += dt * 55; $('dlg-text').textContent = dlg.full.slice(0, Math.floor(dlg.shown)); if (inp.usePressed) { inp.usePressed = false; dlgAdvance(); } }
  if (S.clockRun && (!S.busy || S.mp)) {
    if (!S.mp || G.net.isHost()) S.clock += dt * (S.clockRate || 1);
    G.setTime(S.clock / 60);
    if (S.deadline && S.clock >= S.deadline && S.onDeadline) { const f = S.onDeadline; S.onDeadline = null; f(); }
  }
  G.stealth = S.stealthPhase && !S.busy;
  if (inp.run && inp.crouch) inp.run = false; // one stance at a time: if something switched both on, sneaking wins
  if (inp.throwPressed && S.stealthPhase && !S.busy && !P.frozen) G.throwStone();
  G.updatePlayer(dt, t);
  G.updateCamera(dt, t);
  if (S.mp) G.net.update(dt, t, S.ended);
  const gs = G.updateGuards(dt, t) || 0;
  const ss = G.updateSearchlights(dt, S.mp ? G.net.now() : t) || 0;
  G.updateNpcs(dt, t); G.updateStones(dt); G.worldTick(dt, t);
  updateInteract(dt);
  if (G.story && G.story.tick) G.story.tick(dt, t);
  updateMissionTimer(dt);
  const o = G.currentObj();
  beacon.visible = !!o && !S.busy && G.cam.mode !== 'cine';
  if (o) { const p = o.at(); beacon.position.set(p.x, 0, p.z); gem.rotation.y = t * 2; gem.position.y = 2.3 + Math.sin(t * 3) * 0.12; if (near(p, 1.2) || (o.hideNear && near(p, o.hideNear))) beacon.visible = false; }
  const help = S.mp && G.story && G.story.teamHelpAt ? G.story.teamHelpAt() : null, p2 = help || (o && o.at2 ? o.at2() : null);
  beacon2.visible = !!p2 && !S.busy && G.cam.mode !== 'cine' && !near(p2, 1.2);
  if (p2) { beacon2.position.set(p2.x, 0, p2.z); gem2.rotation.y = -t * 2; const col = help ? 0xff3a3a : 0x3fbf8a; gem2Mat.color.setHex(col); gem2Mat.emissive.setHex(col); bBeam2Mat.color.setHex(col); }
  const det = Math.max(gs, ss, G.extraDet ? G.extraDet() : 0); // (the chase to the river adds how close the mob is)
  G.musicMood(S.mood || (G.night > 0.5 ? 'night' : 'day'), det);
  heartT -= dt; if (det > 0.45 && heartT <= 0) { G.sfx('heart'); heartT = 1.1 - det * 0.5; }
  G.ambience(G.night, P.indoor);
  updateHud(det);
  mmT -= dt; if (mmT <= 0) { mmT = 0.1; drawMinimap(t); }
  G.updateSky(P.pos);
  G.render();
  inp.usePressed = false; inp.throwPressed = false;
}
requestAnimationFrame(frame);
G.dev = { step: (n, ms) => { for (let i = 0; i < (n || 1); i++) tick(last + (ms || 16.7)); } };
})(window.G);
