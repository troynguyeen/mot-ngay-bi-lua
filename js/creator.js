// creator.js — "Tạo nhân vật": the player's own character. A photo-studio preview (its own renderer: soft key light,
// fill, rim, a seamless grey backdrop, soft shadows) next to controls for everything in a look: sex, height, build,
// skin; face shape, eyes, brows, nose, mouth; hair and beard; top, trousers, shoes and their colours; glasses.
// The look is remembered on this browser, worn by the player in the game and shown to teammates in multiplayer.
// The ready-made looks are original; there is deliberately no option to copy a costume from a film or game.
(function (G) {
'use strict';
const T = G.T, HUM = G.HUM;
const KEY = 'mnbl-look-v1';
const $ = (id) => document.getElementById(id);

// ---------------- palettes & choices ----------------
const SKINS = [0xf2d0b4, 0xe8bf9a, 0xdcae8a, 0xd2a27c, 0xc79a74, 0xb88760, 0xa8754f, 0x8d5f3f, 0x6e4630, 0x4f3324];
const HAIRC = [0x0d0a08, 0x15110e, 0x2a1a12, 0x4a2e1c, 0x6a4026, 0x8b5a32, 0xb5824e, 0xd8b680, 0xe8dcc0, 0x8a8a8a, 0xb0362c, 0x2d3f6e];
const IRIS = [0x1e140c, 0x2a1a10, 0x4a2f18, 0x6b5a2a, 0x3f6a4a, 0x3c5f80, 0x707a82];
const CLOTH = [0xf2f0ea, 0xc9c2b2, 0x8a8f96, 0x3a3d42, 0x111214, 0x1f2b4a, 0x2e5a8a, 0x7fa6c9, 0x2f6b4f, 0x5b5a3c, 0xc9b48a, 0x8a5a32, 0x7a2836, 0xc0392b, 0xe0782a, 0xe8c547, 0xd98aa0, 0x6a4a8a];
const SOLE = [0xf4f2ec, 0xdedbd4, 0x9a968e, 0x2b2926, 0x111111, 0x8a5a32, 0xe0782a];
const LIPS = [0xc77a72, 0xb05a5a, 0xa84050, 0x8a3a3a, 0xd99a8a, 0x9a5a4a];
const OPT = {
  sex: [['m', 'Nam'], ['f', 'Nữ']],
  hair: [['bald', 'Trọc'], ['buzz', 'Đầu đinh'], ['short', 'Ngắn'], ['side', 'Rẽ ngôi'], ['undercut', 'Undercut'], ['wavy', 'Lượn sóng'], ['curly', 'Xoăn'], ['bob', 'Bob'], ['long', 'Dài'], ['pony', 'Đuôi ngựa'], ['bun', 'Búi cao']],
  fh: [['none', 'Không'], ['stubble', 'Lún phún'], ['mustache', 'Ria mép'], ['goatee', 'Râu dê'], ['beard', 'Quai nón'], ['full', 'Râu rậm']],
  brow: [['normal', 'Vừa'], ['thin', 'Mảnh'], ['thick', 'Rậm'], ['straight', 'Ngang'], ['arched', 'Cong'], ['angled', 'Xếch']],
  top: [['tee', 'Áo thun'], ['longtee', 'Thun dài tay'], ['tank', 'Ba lỗ'], ['polo', 'Polo'], ['shirt', 'Sơ mi'], ['track', 'Khoác thể thao'], ['hoodie', 'Hoodie']],
  pattern: [['solid', 'Trơn'], ['stripes', 'Sọc ngang'], ['checks', 'Caro']],
  bottom: [['trousers', 'Quần tây'], ['jeans', 'Quần jean'], ['track', 'Jogger'], ['cargo', 'Túi hộp'], ['shorts', 'Quần short'], ['skirt', 'Váy']],
  shoes: [['sneaker', 'Thể thao'], ['slipon', 'Giày lười vải'], ['boot', 'Bốt'], ['dress', 'Giày tây']],
  glasses: [['', 'Không'], ['clear', 'Kính tròn'], ['rect', 'Kính vuông'], ['sun', 'Kính râm']],
};
// tabs: [id, label, camera, items]; items: [kind, key, label, extra]
const TABS = [
  ['body', 'Cơ thể', 'body', [['choice', 'sex', 'Giới tính'], ['range', 'height', 'Chiều cao', ['Thấp', 'Cao']], ['range', 'build', 'Dáng người', ['Gầy', 'Đầy đặn']], ['color', 'skin', 'Màu da', SKINS]]],
  ['face', 'Khuôn mặt', 'face', [['face', 'width', 'Độ rộng mặt', ['Thon', 'Rộng']], ['face', 'jaw', 'Quai hàm', ['Thon', 'Vuông']], ['face', 'chin', 'Cằm', ['Lẹm', 'Nhô']], ['face', 'cheek', 'Gò má', ['Phẳng', 'Cao']], ['face', 'ear', 'Tai', ['Nhỏ', 'To']]]],
  ['eyes', 'Mắt', 'face', [['face', 'eyeSize', 'Kích thước', ['Nhỏ', 'To']], ['face', 'eyeGap', 'Khoảng cách', ['Gần', 'Xa']], ['face', 'eyeTilt', 'Đuôi mắt', ['Cụp', 'Xếch']], ['face', 'lid', 'Độ mở mí', ['Híp', 'Mở to']], ['color', 'iris', 'Màu mắt', IRIS]]],
  ['brows', 'Chân mày', 'face', [['choice', 'brow', 'Kiểu'], ['face', 'browThick', 'Độ dày', ['Mảnh', 'Dày']], ['face', 'browArch', 'Độ cong', ['Thẳng', 'Cong']], ['face', 'browTilt', 'Độ nghiêng', ['Cụp', 'Xếch']], ['face', 'browH', 'Độ cao', ['Thấp', 'Cao']], ['color', 'browColor', 'Màu', HAIRC, 'Theo tóc']]],
  ['nose', 'Mũi', 'face', [['face', 'noseW', 'Độ rộng', ['Thon', 'Rộng']], ['face', 'noseL', 'Độ dài', ['Ngắn', 'Dài']], ['face', 'bridge', 'Sống mũi', ['Thấp', 'Cao']], ['face', 'tip', 'Đầu mũi', ['Nhỏ', 'To']]]],
  ['mouth', 'Miệng', 'face', [['face', 'mouthW', 'Độ rộng', ['Hẹp', 'Rộng']], ['face', 'lips', 'Độ dày môi', ['Mỏng', 'Dày']], ['color', 'lip', 'Màu môi', LIPS, 'Tự nhiên']]],
  ['hair', 'Tóc & râu', 'head', [['choice', 'hair', 'Kiểu tóc'], ['color', 'hairColor', 'Màu tóc', HAIRC], ['color', 'hairColor2', 'Nhuộm đuôi', HAIRC, 'Không'], ['choice', 'fh', 'Râu']]],
  ['top', 'Áo', 'body', [['choice', 'top', 'Kiểu áo'], ['color', 'topColor', 'Màu chính', CLOTH], ['color', 'topColor2', 'Màu phối (sọc, viền)', CLOTH], ['color', 'innerColor', 'Áo bên trong', CLOTH], ['choice', 'pattern', 'Họa tiết']]],
  ['bottom', 'Quần', 'body', [['choice', 'bottom', 'Kiểu quần'], ['color', 'bottomColor', 'Màu chính', CLOTH], ['color', 'bottomColor2', 'Màu sọc (jogger)', CLOTH]]],
  ['shoes', 'Giày', 'feet', [['choice', 'shoes', 'Kiểu giày'], ['color', 'shoeColor', 'Màu giày', CLOTH], ['color', 'soleColor', 'Màu đế', SOLE], ['color', 'laceColor', 'Màu dây', CLOTH, 'Tự động']]],
  ['extra', 'Phụ kiện', 'face', [['choice', 'glasses', 'Kính']]],
];
// ready-made looks (all original)
const PRESETS = [
  ['Nam (mặc định)', { sex: 'm', skin: 0xc79a74, hair: 'short', hairColor: 0x120e0b, fh: 'stubble', top: 'tee', topColor: 0xc9c2b2, bottom: 'trousers', bottomColor: 0x2a3140, shoes: 'sneaker', shoeColor: 0x2b2a2c, soleColor: 0xdedbd4 }],
  ['Sinh viên', { sex: 'm', skin: 0xd2a27c, hair: 'side', hairColor: 0x1a1410, fh: 'none', top: 'hoodie', topColor: 0x8a8f96, innerColor: 0xe8e4dc, bottom: 'jeans', bottomColor: 0x34465f, shoes: 'sneaker', shoeColor: 0xf2f0ea, soleColor: 0xf4f2ec, face: { eyeSize: 0.56, jaw: 0.42 } }],
  ['Dân văn phòng', { sex: 'm', skin: 0xc9976f, hair: 'side', hairColor: 0x0f0c0a, fh: 'none', glasses: 'rect', top: 'shirt', topColor: 0xb9cbe0, topColor2: 0xf2f0ea, bottom: 'trousers', bottomColor: 0x2e3238, shoes: 'dress', shoeColor: 0x1e140e, soleColor: 0x1a1210, face: { jaw: 0.6, browThick: 0.6 } }],
  ['Thể thao', { sex: 'm', skin: 0xb58460, hair: 'undercut', hairColor: 0x15100c, fh: 'goatee', top: 'track', topColor: 0x1f2b4a, topColor2: 0xe0782a, innerColor: 0xeeeae2, bottom: 'track', bottomColor: 0x1f2b4a, bottomColor2: 0xe0782a, shoes: 'sneaker', shoeColor: 0xf3f1ec, soleColor: 0xe0782a, face: { jaw: 0.65, chin: 0.6 } }],
  ['Phượt thủ', { sex: 'm', skin: 0xa8754f, hair: 'curly', hairColor: 0x1c140f, fh: 'beard', top: 'tank', topColor: 0xe9e4d8, bottom: 'cargo', bottomColor: 0x5b5a3c, shoes: 'boot', shoeColor: 0x5a3b24, soleColor: 0x231a14, build: 0.62, face: { cheek: 0.62, noseW: 0.6 } }],
  ['Cô gái thành phố', { sex: 'f', skin: 0xdcae8a, hair: 'bob', hairColor: 0x1b120d, fh: 'none', top: 'polo', topColor: 0xf1efe9, topColor2: 0xf1efe9, bottom: 'skirt', bottomColor: 0x23304a, shoes: 'slipon', shoeColor: 0x1b1b1e, soleColor: 0xf2f0ea, face: { eyeSize: 0.62, lips: 0.6, width: 0.42 } }],
  ['Tóc dài', { sex: 'f', skin: 0xc99a76, hair: 'long', hairColor: 0x2a1a12, hairColor2: 0x6a4026, fh: 'none', top: 'longtee', topColor: 0x7a2836, bottom: 'jeans', bottomColor: 0x2e3d58, shoes: 'boot', shoeColor: 0x2a1c14, soleColor: 0x1c1410, face: { eyeTilt: 0.6, noseW: 0.4 } }],
  ['Áo sọc', { sex: 'f', skin: 0xb88760, hair: 'pony', hairColor: 0x120d0a, fh: 'none', top: 'tee', pattern: 'stripes', topColor: 0xf2efe7, topColor2: 0x1f3a64, bottom: 'shorts', bottomColor: 0xc9b48a, shoes: 'sneaker', shoeColor: 0xe9e6df, soleColor: 0xe9e6df, face: { eyeSize: 0.58 } }],
];
G.LOOK_PRESETS = PRESETS;

// ---------------- storage, codes (multiplayer) ----------------
const clean = (L) => { const o = Object.assign({}, G.normLook(L)); delete o._norm; return o; };
G.loadLook = () => { try { const s = localStorage.getItem(KEY); if (s) return G.normLook(JSON.parse(s)); } catch (e) { /* storage blocked */ } return null; };
G.saveLook = (L) => { try { localStorage.setItem(KEY, JSON.stringify(clean(L))); } catch (e) { /* storage blocked */ } };
G.playerLook = () => G.loadLook() || G.normLook(PRESETS[0][1]);
// a short text form of a look (letters, digits and ; , . - only) — what teammates receive
const hex = (c) => (c === null || c === undefined ? '-' : (c >>> 0).toString(16).padStart(6, '0').slice(-6));
const unhex = (s) => (/^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : null);
const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);
const oneOf = (v, list, d) => (list.some((o) => o[0] === v) ? v : d);
G.lookCode = function (look) {
  const L = G.normLook(look);
  return ['2', L.sex, pct(L.height), pct(L.build), hex(L.skin), HUM.FACE_KEYS.map((k) => pct(L.face[k] === undefined ? 0.5 : L.face[k])).join(','), hex(L.iris), L.brow, hex(L.browColor), hex(L.lip), L.fh,
    L.hair, hex(L.hairColor), hex(L.hairColor2), L.top, hex(L.topColor), hex(L.topColor2), hex(L.innerColor), L.pattern, L.bottom, hex(L.bottomColor), hex(L.bottomColor2),
    L.shoes, hex(L.shoeColor), hex(L.soleColor), hex(L.laceColor), L.glasses || '-'].join(';');
};
G.lookFromCode = function (s) {
  if (typeof s !== 'string' || s.length > 400) return null;
  const a = s.split(';'); if (a[0] !== '2' || a.length < 27) return null;
  const n = (v) => Math.max(0, Math.min(100, parseInt(v, 10) || 0)) / 100;
  const face = {}; a[5].split(',').forEach((v, i) => { const k = HUM.FACE_KEYS[i]; if (k) face[k] = n(v); });
  const c = (v, d) => { const x = unhex(v); return x === null ? d : x; };
  return G.normLook({
    sex: a[1] === 'f' ? 'f' : 'm', height: n(a[2]), build: n(a[3]), skin: c(a[4], 0xc79a74), face, iris: c(a[6], 0x2a1a10), brow: oneOf(a[7], OPT.brow, 'normal'),
    browColor: c(a[8], null), lip: c(a[9], null), fh: oneOf(a[10], OPT.fh, 'none'), hair: oneOf(a[11], OPT.hair, 'short'), hairColor: c(a[12], 0x15110e), hairColor2: c(a[13], null),
    top: oneOf(a[14], OPT.top, 'tee'), topColor: c(a[15], 0x777777), topColor2: c(a[16], 0xe8e4dc), innerColor: c(a[17], 0xe9e6df), pattern: oneOf(a[18], OPT.pattern, 'solid'),
    bottom: oneOf(a[19], OPT.bottom, 'trousers'), bottomColor: c(a[20], 0x333333), bottomColor2: c(a[21], 0xe8e4dc),
    shoes: oneOf(a[22], OPT.shoes, 'sneaker'), shoeColor: c(a[23], 0x1c1a19), soleColor: c(a[24], 0x2b2926), laceColor: c(a[25], null), glasses: a[26] === '-' ? '' : oneOf(a[26], OPT.glasses, ''),
  });
};
// the player wears it (in the game and, for teammates, over the network)
G.applyPlayerLook = function (look) {
  const L = G.normLook(look);
  if (G.player && G.player.h && G.restyle) G.restyle(G.player.h, L);
  if (G.net && G.net.sendLook && G.net.on) G.net.sendLook();
};

// ---------------- random looks ----------------
function randomLook() {
  const r = Math.random, pickA = (a) => a[(r() * a.length) | 0], sex = r() < 0.5 ? 'm' : 'f';
  const face = {}; for (const k of HUM.FACE_KEYS) face[k] = Math.max(0, Math.min(1, 0.5 + (r() + r() - 1) * 0.42));
  const natural = [0x0d0a08, 0x15110e, 0x2a1a12, 0x4a2e1c, 0x6a4026, 0x8b5a32];
  const hairColor = r() < 0.85 ? pickA(natural) : pickA(HAIRC);
  const top = pickA(OPT.top)[0], bottom = sex === 'f' && r() < 0.25 ? 'skirt' : pickA(OPT.bottom.filter((o) => o[0] !== 'skirt'))[0];
  const shoes = pickA(OPT.shoes)[0];
  return G.normLook({
    sex, height: 0.3 + r() * 0.4, build: 0.25 + r() * 0.5, skin: pickA(SKINS), face, iris: pickA(IRIS.slice(0, 4)), brow: pickA(OPT.brow)[0], fh: sex === 'f' ? 'none' : pickA(OPT.fh)[0],
    hair: sex === 'm' ? pickA(['short', 'side', 'undercut', 'curly', 'buzz', 'wavy', 'short', 'side']) : pickA(['bob', 'long', 'pony', 'bun', 'wavy', 'curly', 'long']),
    hairColor, hairColor2: r() < 0.15 ? pickA(HAIRC) : null,
    top, topColor: pickA(CLOTH), topColor2: pickA(CLOTH), innerColor: pickA([0xf2f0ea, 0xe9e6df, 0x111214, 0x8a8f96]), pattern: top === 'tee' || top === 'shirt' ? pickA(['solid', 'solid', 'stripes', 'checks']) : 'solid',
    bottom, bottomColor: pickA([0x111214, 0x1f2b4a, 0x34465f, 0x2e3238, 0x5b5a3c, 0xc9b48a, 0x3a3d42, 0x2e3d58, 0x7a2836]), bottomColor2: pickA(CLOTH),
    shoes, shoeColor: shoes === 'dress' || shoes === 'boot' ? pickA([0x1e140e, 0x2a1c14, 0x5a3b24, 0x111111]) : pickA(CLOTH), soleColor: shoes === 'dress' || shoes === 'boot' ? 0x1c1410 : pickA(SOLE),
    glasses: r() < 0.15 ? pickA(['clear', 'rect', 'sun']) : '',
  });
}

// ---------------- the studio preview ----------------
let open = false, look = null, startLook = null, tab = 'body';
let R = null, scene = null, cam = null, person = null, raf = 0, dirty = false, keyDir = null, keyCol = null;
const view = { yaw: 0.35, pitch: 0.06, dist: 3.4, tgtY: 0.95, want: { yaw: 0.35, pitch: 0.06, dist: 3.4, tgtY: 0.95 }, spin: false };
const SHOTS = { body: [3.5, 0.92, 0.06], head: [1.05, 1.6, 0.05], face: [0.72, 1.62, 0.03], feet: [1.5, 0.3, 0.22] };
function studio() {
  scene = new T.Scene();
  // (the background is written as is; the fog is in linear light, so the floor melts into it)
  scene.background = new T.Color(0x56575a); scene.fog = new T.Fog(new T.Color(0x56575a).convertSRGBToLinear().getHex(), 4.5, 10);
  // seamless backdrop: a floor that fades into the background
  const floor = new T.Mesh(new T.CircleGeometry(12, 64), new T.MeshStandardMaterial({ color: new T.Color(0x6a6b6d).convertSRGBToLinear(), roughness: 0.92, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // key (warm, soft shadow), fill (cool), two rims, sky / ground fill
  const key = new T.DirectionalLight(0xfff1e2, 1.55); key.position.set(2.4, 4.2, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 2.3, bottom: -0.3, near: 0.5, far: 12 });
  scene.add(key); scene.add(key.target); key.target.position.set(0, 0.9, 0);
  const fill = new T.DirectionalLight(0xdfe8ff, 0.32); fill.position.set(-3, 2, 2.5); scene.add(fill);
  const rim = new T.DirectionalLight(0xffffff, 0.9); rim.position.set(-2.2, 3, -3.2); scene.add(rim);
  const rim2 = new T.DirectionalLight(0xfff4e8, 0.45); rim2.position.set(2.6, 2.4, -2.6); scene.add(rim2);
  scene.add(new T.HemisphereLight(0xdfe4ea, 0x4a4846, 0.22));
  keyDir = { value: key.position.clone().normalize() }; keyCol = { value: new T.Vector3(1.0, 0.95, 0.9) };
  // reflections: a softbox room
  const room = new T.Scene();
  room.add(new T.Mesh(new T.BoxGeometry(14, 8, 14), new T.MeshBasicMaterial({ color: 0x1c1d1e, side: T.BackSide })));
  for (const [x, y, z, w, h, k] of [[3, 4, 4, 4, 3, 1.6], [-4, 3, 2, 3, 3, 0.6], [-2, 3, -5, 4, 2, 1.0], [0, 3.9, 0, 6, 6, 0.3]]) {
    const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(1, 0.98, 0.95).multiplyScalar(k), side: T.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 1, 0); room.add(p);
  }
  const pm = new T.PMREMGenerator(R);
  scene.environment = pm.fromScene(room, 0.03).texture; pm.dispose();
  cam = new T.PerspectiveCamera(30, 1, 0.05, 50);
}
function makePerson(L) {
  const p = G.buildPerson(Object.assign({ lod: 0 }, clean(L)));
  // its own geometry (sliders rebuild it often) and material settings for the studio
  const m = p.body.material; m.gfxSkip = true; m.userData.chU.chKeyDir = keyDir; m.userData.chU.chKeyCol = keyCol;
  p.ownGeo = false;
  scene.add(p.group);
  return p;
}
function pose(p, t) { G.animHuman(p, { pose: 'stand', t, studio: true }); }
function frame(t) {
  raf = requestAnimationFrame(frame);
  const cv = R.domElement, w = cv.clientWidth, h = cv.clientHeight, pr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
  if (dirty) { dirty = false; G.restyle(person, look, { noCache: true, lod: 0 }); }
  if (view.spin) view.want.yaw += 0.006;
  for (const k of ['yaw', 'pitch', 'dist', 'tgtY']) view[k] += (view.want[k] - view[k]) * 0.14;
  const dist = view.dist * Math.max(1, Math.sqrt(1.35 / Math.max(0.3, cam.aspect)));   // narrow previews step back a little
  const cx = Math.sin(view.yaw) * Math.cos(view.pitch) * dist, cz = Math.cos(view.yaw) * Math.cos(view.pitch) * dist, cy = view.tgtY + Math.sin(view.pitch) * dist;
  cam.position.set(cx, cy, cz); cam.lookAt(0, view.tgtY, 0);
  if (G.creatorTest && G.creatorTest.custom) G.creatorTest.custom(t / 1000, person); else pose(person, t / 1000);
  R.render(scene, cam);
}
function shot(kind) { const s = SHOTS[kind] || SHOTS.body; view.want.dist = s[0]; view.want.tgtY = s[1]; view.want.pitch = s[2]; }

// ---------------- the panel ----------------
function changed(rebuild) { dirty = true; if (rebuild) renderTab(); }
function swatchRow(key, colors, noneLabel) {
  const row = document.createElement('div'); row.className = 'cr-swatches';
  const cur = look[key];
  if (noneLabel) { const b = document.createElement('button'); b.type = 'button'; b.className = 'cr-sw cr-none' + (cur === null ? ' on' : ''); b.textContent = noneLabel; b.onclick = () => { look[key] = null; changed(true); }; row.appendChild(b); }
  for (const c of colors) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cr-sw' + (cur === c ? ' on' : ''); b.style.background = '#' + hex(c); b.setAttribute('aria-label', '#' + hex(c));
    b.onclick = () => { look[key] = c; changed(true); }; row.appendChild(b);
  }
  const pick = document.createElement('input'); pick.type = 'color'; pick.className = 'cr-pick'; pick.value = '#' + (cur === null || cur === undefined ? 'ffffff' : hex(cur)); pick.title = 'Màu tùy chọn';
  pick.oninput = () => { look[key] = parseInt(pick.value.slice(1), 16); changed(false); };
  pick.onchange = () => renderTab();
  row.appendChild(pick);
  return row;
}
function renderTab() {
  const body = $('cr-body'); body.textContent = '';
  const def = TABS.find((t) => t[0] === tab) || TABS[0];
  for (const [kind, key, label, extra, noneLabel] of def[3]) {
    // only what applies: the inner shirt for the track jacket, the stripe colour for joggers
    if (key === 'innerColor' && look.top !== 'track' && look.top !== 'hoodie') continue;
    if (key === 'bottomColor2' && look.bottom !== 'track') continue;
    if (key === 'pattern' && !['tee', 'longtee', 'shirt', 'polo', 'tank'].includes(look.top)) continue;
    if (key === 'laceColor' && look.shoes === 'slipon') continue;
    const f = document.createElement('div'); f.className = 'cr-field';
    const lb = document.createElement('label'); lb.textContent = label; f.appendChild(lb);
    if (kind === 'choice') {
      const row = document.createElement('div'); row.className = 'cr-choices';
      for (const [v, name] of OPT[key]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'cr-ch' + (look[key] === v ? ' on' : ''); b.textContent = name;
        b.onclick = () => {
          look[key] = v;
          if (key === 'sex') { if (v === 'f') { look.fh = 'none'; if (['short', 'buzz', 'undercut', 'side', 'bald'].includes(look.hair)) look.hair = 'long'; } else if (['long', 'pony', 'bun', 'bob'].includes(look.hair)) look.hair = 'short'; }
          changed(true);
        };
        row.appendChild(b);
      }
      f.appendChild(row);
    } else if (kind === 'range' || kind === 'face') {
      const isFace = kind === 'face';
      const cur = isFace ? (look.face[key] === undefined ? 0.5 : look.face[key]) : look[key];
      const wrap = document.createElement('div'); wrap.className = 'cr-range';
      const a = document.createElement('span'); a.textContent = extra ? extra[0] : '';
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '1'; inp.value = String(Math.round(cur * 100)); inp.setAttribute('aria-label', label);
      const b = document.createElement('span'); b.textContent = extra ? extra[1] : '';
      inp.oninput = () => { const v = +inp.value / 100; if (isFace) look.face[key] = v; else look[key] = v; changed(false); };
      inp.ondblclick = () => { inp.value = '50'; inp.oninput(); };
      wrap.append(a, inp, b); f.appendChild(wrap);
    } else if (kind === 'color') f.appendChild(swatchRow(key, extra, noneLabel));
    body.appendChild(f);
  }
  for (const b of document.querySelectorAll('#cr-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
}
function buildUI() {
  const tabs = $('cr-tabs'); tabs.textContent = '';
  for (const [id, label, shotKind] of TABS) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = id; b.textContent = label;
    b.onclick = () => { tab = id; shot(shotKind); renderTab(); };
    tabs.appendChild(b);
  }
  const sel = $('cr-preset'); sel.textContent = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Chọn một mẫu…'; sel.appendChild(o0);
  PRESETS.forEach(([name], i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = name; sel.appendChild(o); });
  sel.onchange = () => { if (sel.value === '') return; look = G.normLook(JSON.parse(JSON.stringify(PRESETS[+sel.value][1]))); look.face = Object.assign({}, look.face); changed(true); };
}
// drag to turn, wheel / pinch to zoom
function bindView(cv) {
  let drag = null, pinch = 0;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; view.spin = false; $('cr-spin').classList.remove('on'); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.want.yaw -= (e.clientX - drag.x) * 0.008; view.want.pitch = Math.max(-0.3, Math.min(0.75, view.want.pitch + (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
  });
  const up = () => { drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); view.want.dist = Math.max(0.5, Math.min(5, view.want.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) { pinch = 0; return; }
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) view.want.dist = Math.max(0.5, Math.min(5, view.want.dist * pinch / d));
    pinch = d;
  }, { passive: true });
}

// ---------------- open / close ----------------
G.openCreator = function () {
  if (open) return;
  open = G.creatorOpen = true;
  startLook = G.playerLook(); look = G.normLook(JSON.parse(JSON.stringify(clean(startLook)))); look.face = Object.assign({}, look.face);
  // a fresh canvas (and context) each time; the game stops drawing behind
  const host = $('cr-stage'), old = $('cr-canvas');
  const cv = document.createElement('canvas'); cv.id = 'cr-canvas'; if (old) old.replaceWith(cv); else host.prepend(cv);
  R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 0.78;
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.physicallyCorrectLights = false;
  studio();
  person = makePerson(look);
  tab = 'body'; shot('body'); view.yaw = view.want.yaw = 0.35;
  buildUI(); renderTab();
  bindView(cv);
  $('creator').hidden = false;
  raf = requestAnimationFrame(frame);
};
function close(save) {
  if (!open) return;
  cancelAnimationFrame(raf);
  if (save) { G.saveLook(look); G.applyPlayerLook(look); }
  $('creator').hidden = true;
  if (person) { if (person.ownGeo) person.body.geometry.dispose(); person.body.material.dispose(); }
  if (scene && scene.environment) scene.environment.dispose();
  if (R) { R.dispose(); R.forceContextLoss(); }
  R = scene = cam = person = null;
  open = G.creatorOpen = false;
  if (G.onCreatorClosed) G.onCreatorClosed(save);
}
G.closeCreator = close;
// for tests: set a look / a camera shot / a tab directly
G.creatorTest = { set(L) { look = G.normLook(L); look.face = Object.assign({}, look.face); dirty = true; renderTab(); }, shot, view, tab(t) { tab = t; renderTab(); },
  // for the pose review sheets: extra people in the studio, the camera, and a per-frame hook (custom) that poses them
  scene: () => scene, cam: () => cam, person: () => person, make: (L) => makePerson(G.normLook(L)), custom: null };
// the game does not draw while the studio is open
const render0 = G.render;
if (render0) G.render = function () { if (open) return; return render0.apply(this, arguments); };
addEventListener('keydown', (e) => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); close(false); } }, true);
$('cr-save').onclick = () => close(true);
$('cr-cancel').onclick = () => close(false);
$('cr-random').onclick = () => { look = randomLook(); changed(true); };
$('cr-reset').onclick = () => { look = G.normLook(JSON.parse(JSON.stringify(clean(startLook)))); look.face = Object.assign({}, look.face); changed(true); };
$('cr-spin').onclick = () => { view.spin = !view.spin; $('cr-spin').classList.toggle('on', view.spin); };
for (const b of document.querySelectorAll('[data-shot]')) b.onclick = () => shot(b.dataset.shot);
for (const id of ['btn-creator', 'btn-pause-creator']) { const b = $(id); if (b) b.onclick = () => G.openCreator(); }
})(window.G);
