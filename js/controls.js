// controls.js — mobile touch controls. Every control (stick, action buttons, pause, minimap) is placed from a saved
// layout, kept separately for portrait and landscape. The editor (pause menu or settings → "Nút điều khiển") shows
// ghost copies the player can drag, resize and make more or less see-through; Save writes it to this browser.
(function (G) {
'use strict';
const $ = (id) => document.getElementById(id);
const S = G.state;
const KEY = 'mnbl-ctl-v2', OLD_KEY = 'mnbl-ctl-v1'; // v2: smaller minimap tucked to the right edge
// base size in CSS px at 100 %; the minimap is a rectangle
const CTL = [
  { id: 'joy', el: 'joy', name: 'Cần di chuyển', base: 140, kind: 'joy' },
  { id: 'use', el: 't-use', name: 'Dùng', base: 84 },
  { id: 'run', el: 't-run', name: 'Chạy', base: 60 },
  { id: 'crouch', el: 't-crouch', name: 'Cúi', base: 60 },
  { id: 'throw', el: 't-throw', name: 'Ném đá', base: 56 },
  { id: 'menu', el: 'btn-hud-pause', name: 'Tạm dừng', base: 46 },
  { id: 'map', el: 'minimap', name: 'Bản đồ nhỏ', base: 88, w: 88, h: 72, kind: 'map' }, // small; tap it in game to see it big
];
// [x, y] = centre as a fraction of the screen, then scale. Thumb zones: stick bottom-left, actions fanned round "Dùng".
const DEF = {
  p: { joy: [0.24, 0.83, 1], use: [0.8, 0.81, 1], run: [0.85, 0.67, 1], crouch: [0.585, 0.885, 1], throw: [0.6, 0.735, 1], menu: [0.5, 0.935, 1], map: [0.88, 0.335, 1] },
  l: { joy: [0.13, 0.7, 0.95], use: [0.89, 0.7, 0.95], run: [0.93, 0.43, 0.95], crouch: [0.78, 0.86, 0.95], throw: [0.775, 0.58, 0.95], menu: [0.5, 0.91, 0.95], map: [0.7, 0.13, 1] },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const fresh = (o) => { const out = {}; for (const c of CTL) { const d = DEF[o][c.id]; out[c.id] = { x: d[0], y: d[1], s: d[2], a: 1 }; } return out; };
function load() {
  const L = { p: fresh('p'), l: fresh('l'), labels: false };
  let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* storage blocked or bad JSON */ }
  if (!v) { // older save: keep the player's buttons, let the minimap take its new small corner spot
    try { v = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); } catch (e) { v = null; }
    if (v && typeof v === 'object') for (const o of ['p', 'l']) if (v[o]) delete v[o].map;
  }
  if (v && typeof v === 'object') {
    for (const o of ['p', 'l']) if (v[o]) for (const c of CTL) { const it = v[o][c.id]; if (it) L[o][c.id] = { x: clamp(num(it.x, 0.5), 0, 1), y: clamp(num(it.y, 0.5), 0, 1), s: clamp(num(it.s, 1), 0.6, 1.6), a: clamp(num(it.a, 1), 0.2, 1) }; }
    L.labels = !!v.labels;
  }
  return L;
}
let LAYOUT = load();
const orient = () => (innerWidth > innerHeight ? 'l' : 'p');
// centre (kept fully on screen) and size in px
const place = (c, it) => { const w = (c.w || c.base) * it.s, h = (c.h || c.base) * it.s, W = innerWidth, H = innerHeight; return [clamp(it.x * W, w / 2 + 4, W - w / 2 - 4), clamp(it.y * H, h / 2 + 4, H - h / 2 - 4), w, h]; };

G.applyControls = function () {
  const touch = !!G.input.touch, set = LAYOUT[orient()];
  document.body.classList.toggle('ctl-touch', touch);
  for (const c of CTL) {
    const el = $(c.el); if (!el) continue;
    if (!touch) { if (c.id === 'menu' || c.id === 'map') for (const k of ['left', 'top', 'width', 'height', 'transform', 'opacity']) el.style[k] = ''; continue; }
    const it = set[c.id], [x, y, w, h] = place(c, it);
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.transform = 'translate(-50%,-50%)'; el.style.opacity = it.a;
  }
  $('touch').classList.toggle('labels', !!LAYOUT.labels);
  $('btn-pause-layout').hidden = $('btn-settings-layout').hidden = !touch;
};

// ---------------- editor ----------------
let draft = null, sel = 'use', ret = null, drag = null;
const HINT = 'Kéo một nút để đổi chỗ. Chạm vào nút để chỉnh kích thước và độ rõ. Bố cục màn hình dọc và ngang được lưu riêng.';
function render() {
  const box = $('ctl-ghosts'), set = draft[orient()]; box.textContent = '';
  $('ctl-orient').textContent = orient() === 'l' ? 'Màn hình ngang' : 'Màn hình dọc';
  for (const c of CTL) {
    const g = document.createElement('div'); g.className = 'ghost' + (c.kind ? ' ' + c.kind : '') + (c.id === sel ? ' sel' : ''); g.dataset.id = c.id;
    const face = document.createElement('div'); face.className = 'face';
    if (c.kind === 'map') face.textContent = 'Bản đồ';
    else { const src = $(c.el).querySelector('svg'); if (src) face.appendChild(src.cloneNode(true)); }
    const nm = document.createElement('span'); nm.className = 'gname'; nm.textContent = c.name;
    g.append(face, nm); box.appendChild(g); posGhost(g, c, set[c.id]);
    g.addEventListener('pointerdown', (e) => startDrag(e, c, g));
  }
}
function posGhost(g, c, it) { const [x, y, w, h] = place(c, it); g.style.left = x + 'px'; g.style.top = y + 'px'; g.style.width = w + 'px'; g.style.height = h + 'px'; g.style.opacity = Math.max(0.4, it.a); }
function select(id) {
  sel = id; const c = CTL.find((k) => k.id === id), it = draft[orient()][id];
  for (const g of $('ctl-ghosts').children) g.classList.toggle('sel', g.dataset.id === id);
  $('ctl-sel-name').textContent = $('ctl-all').checked ? 'Tất cả các nút' : c.name;
  $('ctl-size').value = Math.round(it.s * 100); $('ctl-size-v').textContent = Math.round(it.s * 100) + '%';
  $('ctl-alpha').value = Math.round(it.a * 100); $('ctl-alpha-v').textContent = Math.round(it.a * 100) + '%';
}
function startDrag(e, c, g) {
  e.preventDefault(); select(c.id);
  const [x, y] = place(c, draft[orient()][c.id]);
  drag = { c, g, id: e.pointerId, ox: e.clientX - x, oy: e.clientY - y };
  try { g.setPointerCapture(e.pointerId); } catch (er) { /* old browsers */ }
  g.classList.add('drag');
}
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const it = draft[orient()][drag.c.id];
  it.x = clamp((e.clientX - drag.ox) / innerWidth, 0, 1); it.y = clamp((e.clientY - drag.oy) / innerHeight, 0, 1);
  posGhost(drag.g, drag.c, it);
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const it = draft[orient()][drag.c.id], [x, y] = place(drag.c, it); it.x = x / innerWidth; it.y = y / innerHeight; // store where it really sits
  drag.g.classList.remove('drag'); drag = null;
};
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
function tune(key, val) { // size or visibility, for the selected control or all of them
  const set = draft[orient()], ids = $('ctl-all').checked ? CTL.map((c) => c.id) : [sel];
  for (const id of ids) set[id][key] = val;
  for (const g of $('ctl-ghosts').children) if (ids.includes(g.dataset.id)) posGhost(g, CTL.find((c) => c.id === g.dataset.id), set[g.dataset.id]);
}
$('ctl-size').addEventListener('input', (e) => { const v = e.target.value / 100; $('ctl-size-v').textContent = e.target.value + '%'; tune('s', v); });
$('ctl-alpha').addEventListener('input', (e) => { const v = e.target.value / 100; $('ctl-alpha-v').textContent = e.target.value + '%'; tune('a', v); });
$('ctl-all').addEventListener('change', () => select(sel));
$('ctl-labels').addEventListener('change', (e) => { draft.labels = e.target.checked; });
$('ctl-reset').onclick = () => { draft[orient()] = fresh(orient()); draft.labels = false; $('ctl-labels').checked = false; render(); select(sel); };
$('ctl-exit').onclick = () => close(false);
$('ctl-save').onclick = () => close(true);
$('ctl-collapse').onclick = () => {
  const body = $('ctl-body'), hide = !body.hidden; body.hidden = hide;
  $('ctl-collapse').textContent = hide ? 'Mở rộng ▾' : 'Thu gọn ▴'; $('ctl-collapse').setAttribute('aria-expanded', String(!hide));
};
function open() {
  draft = JSON.parse(JSON.stringify(LAYOUT));
  ret = { pause: !$('pause').hidden, settings: !$('settings').hidden };
  $('pause').hidden = true; $('settings').hidden = true;
  $('ctl-labels').checked = !!draft.labels; $('ctl-all').checked = false;
  $('ctl-hint').textContent = HINT + (S.mp && G.playing() ? ' Chơi nhiều người: trò chơi vẫn chạy trong lúc bạn chỉnh.' : '');
  G.ctlEditing = true; document.body.classList.add('ctl-editing'); $('ctl-editor').hidden = false; render(); select(sel);
}
function close(save) {
  if (save) { LAYOUT = draft; try { localStorage.setItem(KEY, JSON.stringify(LAYOUT)); } catch (e) { /* storage blocked: keeps for this visit */ } G.applyControls(); }
  $('ctl-editor').hidden = true; G.ctlEditing = false; drag = null; document.body.classList.remove('ctl-editing');
  // back to the menus we came from, unless the team resumed the game meanwhile
  if (ret) { const live = G.playing() && !S.paused; $('pause').hidden = !(ret.pause && S.paused); $('settings').hidden = !(ret.settings && !live); }
  if (save && G.ui) G.ui.toast('Đã lưu bố cục nút', 1800);
}
G.openControlEditor = open;
$('btn-pause-layout').onclick = open;
$('btn-settings-layout').onclick = open;
addEventListener('keydown', (e) => { if (G.ctlEditing && e.code === 'Escape') { e.stopImmediatePropagation(); close(false); } }, true);
let rT = 0;
addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { G.applyControls(); if (G.ctlEditing) { render(); select(sel); } }, 120); });
G.applyControls();
})(window.G);
