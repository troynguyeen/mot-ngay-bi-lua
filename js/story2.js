// story2.js — Chapter 2 (jungle camp), Chapter 3 (kiln + rescue raid), the final choice, the trip home, multiplayer, boot
(function (G) {
'use strict';
const P = G.player, ui = G.ui, S = G.state, ST = G.story;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const { run, wait, say, card, fx } = ST;
const $ = (id) => document.getElementById(id);
const baseTick = () => { ST.tick = (dt) => { if (S.phase === 'van') ST.vanTick(dt); if (S.f.drugging) { S.f.drugT += dt; G.cam.drug = Math.min(1, S.f.drugT / 3); ui.blur(Math.min(6, S.f.drugT * 2)); } }; };
baseTick();
const wrapStart = ST.start; ST.start = function () { baseTick(); wrapStart(); };

// ===================== CHAPTER 2 — JUNGLE CAMP =====================
ST.startCh2 = function () {
  ST.reset(); S.chapter = 2; S.phase = 'ch2'; G.saveCheckpoint(2); ui.black(false);
  G.loadLevel('jungle'); G.setTime(22.5); S.mood = 'horror'; ui.hud(false); S.phaseLabel = 'Trại rừng';
  G.titleOrbit = { r: 80, h: 30, cx: 0, cz: 0 };
  const c = L().namCage; P.pos.set(c.x, 0, c.z); P.yaw = 0; P.frozen = true; P.pose = 'floor';
  const seo = G.addNpc('seo', { shirt: 0x2a2a1a, pants: 0x1a1a14, skin: 0x9a6a48, bald: true, tattoo: true, sleeveless: true, rifle: true }, { x: c.x + 0.4, z: c.z + 3.2, yaw: Math.PI, pose: 'talk' });
  G.cine([c.x + 2.6, 2.0, c.z + 4.2], [c.x, 0.7, c.z], true, 1);
  G.setGuardsMode('day');
  ST.respawn = () => ({ x: L().namCage.x, z: L().namCage.z, yaw: 0 });
  ST.tick = () => {};
  run([
    ST.chapterCard(2, 'Trại rừng', 'Hai ngày trên thùng xe tải. Đường đất, mưa, rồi rừng. Một nơi không có tên trên bản đồ.'),
    say([['Trùm Sẹo', 'Tao trả 18.000 đô cho mày. Ở đây không có điều hòa, không có cơm ngon.'], ['Trùm Sẹo', 'Đủ chỉ tiêu thì được ăn. Thiếu thì ra gốc cây kia đứng qua đêm.'], ['Trùm Sẹo', 'Còn trốn nữa thì rừng này rộng lắm. Không ai tìm thấy xác đâu.']]),
    fx(() => G.sfx('cage')),
    card([{ t: 'Những ngày sau đó là đòn roi, dùi cui điện và những bữa bị bỏ đói.' }, { t: 'Người ở lồng bên cạnh bị lôi đi một đêm và không quay lại.' }, { t: 'Nam không còn đếm được ngày.', c: 'place' }]),
    (n) => ui.fade(n),
    fx(() => { G.setTime(9.5); G.setRain(0.45); S.mood = 'night'; seo.pos.set(1.5, 0, -8.3); seo.yaw = Math.PI / 2; seo.pose = 'stand'; const s = L().workSeat; P.pos.set(s.x, 0, s.z); P.yaw = s.yaw; P.pose = 'type'; G.cineOff(); G.cam.yaw = 0.3; G.cam.pitch = 0.3; ui.hud(true); S.phaseLabel = 'Ca làm việc'; }),
    say([['Trùm Sẹo', 'Ba khách. Ở đây máy chậm, mạng chập chờn, nhưng chỉ tiêu thì không giảm đâu.']]),
    (n) => ST.workShift(['romance', 'shipper', 'utility'], 'Trùm Sẹo', (w) => { S.f.warnedCh2 = w; n(); }),
    (n) => {
      if (S.f.warnedCh2 >= 2) { G.sfx('beating'); G.shake(0.3); ui.flash(); ui.say([['', 'Trùm Sẹo giật phăng máy tính, đọc đoạn chat. Một cú báng súng vào vai.'], ['Trùm Sẹo', 'Mày cảnh báo khách? Tối nay không có cơm. Mai làm gấp đôi.']], n); }
      else ui.say([['Trùm Sẹo', 'Tạm được. Mai làm gấp đôi.']], n);
    },
    say([['Nam (nghĩ)', 'Ở đây có cột ăng-ten vệ tinh cạnh nhà trùm. Nếu lấy được cái điện thoại vệ tinh của hắn...'], ['Nam (nghĩ)', 'Đêm nay. Không đợi được nữa.']]),
    (n) => ui.fade(n),
  ], ST.ch2Night);
};
ST.ch2Night = function () {
  const seo = npc('seo'); if (seo) seo.h.group.visible = false;
  S.phase = 'ch2night'; S.phaseLabel = 'Đêm · trại rừng'; S.clock = 22 * 60; G.setTime(22); G.setRain(0.85); G.lightningOn = true; S.mood = null;
  G.setGuardsMode('night'); S.stealthPhase = true; S.clockRun = true; S.deadline = 29.5 * 60; S.onDeadline = () => ST.failScreen('dawn');
  const c = L().namCage; G.placePlayer(c.x, c.z, 0); P.frozen = false; P.pose = null; G.input.crouch = true; G.input.run = false;
  const I = S.items, F = S.f; F.freed = 0;
  const others = L().cages.filter((x, i) => i !== 2);
  // Timers sum to 440s, inside the 450s night (22:00 → 05:30). Measured paths: house 87m + porch guard's ~88s break cycle,
  // antenna 39m + 5s send, cages 93m + 24m between them + 4 × 2s, stream 110m past the swamp patrol
  G.OBJ = [
    { t: 'Tìm sợi thép giấu ở góc lồng', at: () => L().wire, done: () => I.wire, hideNear: 3, time: 30, lv: 1 },
    { t: 'Cạy khóa cửa lồng (giữ, sẽ có tiếng động)', at: () => L().cageLock, done: () => F.cageOpen, hideNear: 3, time: 30, lv: 2 },
    { t: 'Lẻn vào nhà trùm lấy điện thoại vệ tinh (đợi tên gác đi vệ sinh)', at: () => L().satphone, done: () => I.sat, time: 125, lv: 3 },
    { t: 'Ra bãi trống cạnh cột ăng-ten, gửi tin cầu cứu', at: () => L().antenna, done: () => F.sos, time: 50, lv: 2 },
    { t: () => 'Mở lồng cho 4 người còn lại (' + F.freed + '/4)', at: () => { const c2 = others.find((x) => !x.door.open) || others[0]; return { x: c2.x + 0.8, z: c2.z + c2.d / 2 + 0.6 }; }, done: () => F.freed >= 4, time: 115, lv: 3 },
    { t: 'Băng qua đầm lầy, ra bờ suối phía đông', at: () => L().swampExit, done: () => F.exit, time: 90, lv: 3 },
  ];
  G.OBJ.forEach((o) => { if (typeof o.t === 'function') { const f = o.t; Object.defineProperty(o, 't', { get: f }); } });
  G.INTER = [
    { at: () => L().wire, r: 1.1, when: () => !I.wire, label: 'Mò tìm sợi thép', hold: 2, run: () => { I.wire = true; G.sfx('pickup'); ui.toast('Một đoạn dây thép từ lưới lồng. Đủ để cạy khóa.', 3000); } },
    { at: () => L().cageLock, r: 1.1, when: () => !F.cageOpen, label: 'Cạy khóa (giữ)', hold: 5, block: () => (!I.wire ? 'Khóa móc to bằng nắm tay. Cần gì đó để cạy' : null), onHold: (p) => { if (p > 0.5 && !F.lockNoise) { F.lockNoise = true; G.sfx('cage'); G.makeNoise(P.pos.x, P.pos.z, 8, 'door'); } }, run: () => { F.cageOpen = true; L().namCage.door.open = true; L().namCage.door.col.off = true; G.sfx('cage'); ui.toast('Cửa lồng bật mở.', 2400); } },
    { at: () => L().satphone, r: 1.5, when: () => !I.sat, label: 'Lấy điện thoại vệ tinh', hold: 0.8, run: () => { I.sat = true; G.satMesh.visible = false; G.sfx('pickup'); ui.toast('Có điện thoại vệ tinh. Ra bãi trống cạnh cột ăng-ten mới bắt được tín hiệu.', 3600); } },
    { at: () => L().antenna, r: 2.6, when: () => !F.sos, label: 'Gửi tin cầu cứu (giữ)', hold: 5, block: () => (!I.sat ? 'Cần điện thoại vệ tinh trong nhà trùm' : null), onHold: () => { P.pose = 'phone'; }, onCancel: () => { P.pose = null; }, run: ST.ch2Sos },
    ...others.map((cg, i) => ({ at: () => ({ x: cg.x + 0.8, z: cg.z + cg.d / 2 + 0.6 }), r: 1.3, when: () => F.cageOpen && !cg.door.open, label: 'Mở lồng (giữ)', hold: 2, block: () => (!I.wire ? 'Cần sợi thép' : null), run: () => {
      cg.door.open = true; cg.door.col.off = true; F.freed++; S.stats.freed++; G.sfx('cage');
      const pr = npc('pr' + [0, 1, 3, 4][i]); if (pr) { pr.pose = 'stand'; G.npcGo(pr, [[cg.x + 0.5, cg.z + 2.4], [cg.x + 2, cg.z + 6], [-50, -20]], { walk: true, speed: 1.6, hide: true }); }
      ui.toast(['“Cảm ơn anh...”', '“Tôi đợi ở bờ suối.”', '“Đi, đi đi!”', '“Tôi nhớ mặt anh. Tôi sẽ sống.”'][F.freed - 1] || '', 2400);
    } })),
  ];
  ST.tick = () => { if (S.phase === 'ch2night' && !S.busy && !F.exit && G.near(L().swampExit, 3.2)) { if (!F.sos) { if (!F.warnSos) { F.warnSos = true; ui.toast('Ra được đây cũng chỉ lạc trong rừng. Phải gửi tin cầu cứu trước.', 3800); } } else if (F.freed < 4) { if (!F.warnFree) { F.warnFree = true; ui.toast('Còn người trong lồng. Nam không bỏ họ lại.', 3200); } } else { F.exit = true; ST.ch2Relocate(); } } };
  ui.card([{ t: '22:00', c: 'big' }, { t: 'Mưa rừng xối xả. Sấm chớp soi rõ từng song sắt.' }, { t: 'Trời sáng là mất cơ hội.', c: 'place' }], () => ui.toast('Tìm sợi thép trong góc lồng (E)', 3200));
};
ST.ch2Sos = function () {
  P.pose = 'phone';
  ui.phoneChat('<div class="ava" style="background:linear-gradient(135deg,#3f8a7e,#1d4e5a)">SOS</div><div><b>Đường dây bảo hộ công dân</b><small>● vệ tinh · yếu</small></div>', [
    ['sys', 'Tín hiệu vệ tinh · 2 vạch'],
    ['me', '📍 Tọa độ GPS đã gửi'],
    ['me', 'Tôi là Nguyễn Văn Nam, người Việt bị lừa bán sang Campuchia. Từng bị giữ ở Sihanoukville, giờ ở một trại trong rừng. Ở đây có ít nhất 5 người Việt bị nhốt lồng.'],
    ['them', 'Đã nhận tọa độ. Gia đình anh đã trình báo từ tin nhắn trước. Lực lượng chức năng hai nước đang phối hợp.'],
    ['them', 'Giữ an toàn. Nếu bị di chuyển, hãy tìm cách liên lạc lại.'],
    ['sys', 'Mất tín hiệu.'],
  ], () => { S.f.sos = true; P.pose = null; P.frozen = false; ui.toast('Tin cầu cứu đã đi. Giờ mở lồng cho mọi người rồi ra bờ suối.', 3800); }, { btn: 'Giấu điện thoại ▸' });
};
ST.ch2Relocate = function () {
  S.stealthPhase = false; S.clockRun = false; P.frozen = true; S.busy = true; ui.hud(false);
  G.cine([P.pos.x - 6, 3.5, P.pos.z + 6], [P.pos.x, 1, P.pos.z], false, 1.2);
  for (let i = 0; i < 4; i++) { const g = G.addNpc('hunt' + i, { shirt: 0x2a2a1a, pants: 0x1a1a14, skin: 0x9a6a48, rifle: true, cap: 0x1a1a14 }, { x: P.pos.x - 10 + i * 2, z: P.pos.z + 8, yaw: Math.PI }); G.npcGo(g, [[P.pos.x - 2 + i, P.pos.z + 2]], { speed: 4.2 }); }
  run([
    fx(() => { G.sfx('bark'); G.sfx('alert'); }), wait(900),
    say([['Trùm Sẹo', 'Có tín hiệu vệ tinh phát ra từ trại! Bọn nó báo công an rồi!'], ['Trùm Sẹo', 'Không giết ở đây được, cảnh sát đang tới. Dồn hết lên xe, chuyển đi ngay trong đêm!']]),
    fx(() => { G.sfx('arrest'); ui.flash('#7ab8ff'); G.shake(0.3); P.pose = 'shock'; }), wait(1000),
    fx(() => { ui.flash(); G.shake(0.3); P.pose = 'lie'; }), wait(1400),
    (n) => { ui.black(true); setTimeout(n, 1200); },
    card([{ t: 'Họ bị trói, bịt mắt, xếp chồng trên thùng xe như hàng hóa.' }, { t: 'Nhưng lần này, ở đâu đó, có người đã nghe thấy họ.', c: 'place' }]),
  ], () => ST.startCh3());
};

// ===================== CHAPTER 3 — THE KILN =====================
ST.startCh3 = function () {
  ST.reset(); S.chapter = 3; S.phase = 'ch3'; G.saveCheckpoint(3); ui.black(false);
  G.loadLevel('kiln'); G.setTime(23); S.mood = 'horror'; ui.hud(false); S.phaseLabel = 'Lò gạch';
  G.titleOrbit = { r: 85, h: 34, cx: 0, cz: 0 };
  const st = L().namStart, an = L().chainAnchor;
  G.placePlayer(st.x, st.z, Math.PI); P.frozen = true; P.pose = 'floor'; P.chain = { x: an.x, z: an.z, r: 3.4 };
  L().cells.forEach((c, i) => G.addNpc('cv' + i, { shirt: [0x6a5a4a, 0x8a6a6a, 0x4a5a6a, 0x5a6a4a][i], pants: 0x2a2a2a, skin: [0xc79a74, 0xd6a985, 0xb5835e, 0xa8754f][i], longHair: i % 2 === 1, bruises: true }, { x: c.x, z: c.z - 0.3, yaw: 0, pose: 'floor' }));
  const so = G.addNpc('sophea', { shirt: 0x8a4a5a, pants: 0x2a2a2a, skin: 0x9a6a48, longHair: true, longSleeve: true }, { x: 21, z: -25.5, yaw: Math.PI / 2 });
  G.cine([st.x - 3, 2.2, st.z + 1.5], [st.x, 0.7, st.z - 0.5], true, 1);
  G.setGuardsMode('night');
  ST.respawn = () => (S.items.key ? { x: st.x, z: st.z - 2, yaw: Math.PI } : { x: st.x, z: st.z, yaw: Math.PI });
  ST.tick = () => {};
  run([
    ST.chapterCard(3, 'Lò gạch bỏ hoang', 'Bọn chúng dồn tất cả về một lò gạch ven sông, chờ thuyền chuyển đi xa hơn nữa.'),
    say([['', 'Cổ chân Nam bị xích vào cột. Tên gác ngồi ngủ gật cách đó vài bước, chùm chìa khóa lủng lẳng bên hông.']]),
    fx(() => G.npcGo(so, [[34, -25], [st.x - 0.9, st.z - 0.4]], { walk: true, speed: 1.4 })), wait(4200),
    fx(() => { so.pose = 'kneel'; so.yaw = Math.atan2(st.x - so.pos.x, st.z - so.pos.z); }),
    say([['Dì Sophea', '(thì thầm, tiếng Việt lơ lớ) Ăn đi con. Dưới đáy bát có cái điện thoại.'], ['Dì Sophea', 'Dì nấu cơm cho tụi nó ba năm rồi. Dì cũng bị giữ ở đây.'], ['Dì Sophea', 'Có người gọi vào máy này, nói tiếng Việt. Họ tìm con.']]),
    fx(() => { so.pose = 'stand'; G.npcGo(so, [[34, -25], [21, -25.5], [-38, -30]], { walk: true, speed: 1.5, hide: true }); P.pose = 'phone_sit'; }),
    (n) => ui.phoneChat('<div class="ava" style="background:#1c3f8f">ĐN</div><div><b>Số lạ (+84)</b><small>● đang hoạt động</small></div>', [
      ['them', 'Nam, chúng tôi là lực lượng đặc nhiệm Việt Nam, đang phối hợp với cảnh sát Campuchia.'],
      ['them', 'Tin nhắn em gửi mẹ ở Sihanoukville và tín hiệu vệ tinh từ trại rừng đã dẫn chúng tôi tới đây.'],
      ['them', 'Cổng sau có lính và đèn pha. Nếu chúng tôi ập vào lúc còn người bên trong, con tin sẽ gặp nguy.'],
      ['them', 'Tắt máy phát điện phía đông để cắt toàn bộ đèn. Mở cửa các phòng giam, rồi đưa mọi người vượt rào phía tây, chạy ra bến sông.'],
      ['them', 'Ngoài bến có tàu của người mình chờ. Các em ra khỏi lò gạch là chúng tôi ập vào.'],
      ['me', 'Em hiểu rồi.'],
    ], n, { btn: 'Giấu điện thoại ▸' }),
    fx(() => { G.cineOff(); P.frozen = false; P.pose = null; ui.hud(true); }),
  ], ST.ch3Night);
};
ST.ch3Night = function () {
  S.phase = 'ch3night'; S.stealthPhase = true; S.clockRun = true; S.clock = 23 * 60; S.deadline = 29.5 * 60; S.onDeadline = () => ST.failScreen('dawn'); S.mood = null;
  G.input.crouch = true; G.input.run = false; const I = S.items, F = S.f; F.cells = 0;
  // Timers sum to 235s of the 390s night: the last map is the tightest. Measured paths: key 3m, cells 25m + 4 × 1.5s,
  // prison door 10m + generator 50m past the sweeping guard, west fence 95m
  const whDoor = { x: 20.9, z: -25.5 };
  G.OBJ = [
    { t: 'Lấy chìa khóa xích từ tên gác đang ngủ (phải cúi người)', at: () => L().keySpot, done: () => I.key, hideNear: 4, time: 30, lv: 2 },
    { t: () => 'Mở cửa 4 phòng giam (' + F.cells + '/4)', at: () => { const c = L().cells.find((x) => !x.door.open) || L().cells[0]; return { x: c.x + 1.0, z: c.z + c.d / 2 + 0.6 }; }, done: () => F.cells >= 4, time: 60, lv: 2 },
    { t: () => (G.doors.wh.open ? 'Tắt máy phát điện phía đông' : 'Mở cửa nhà giam, rồi tắt máy phát điện phía đông'), at: () => (G.doors.wh.open ? L().generator : whDoor), done: () => F.power, time: 85, lv: 3 },
    { t: 'Đưa mọi người vượt rào phía tây ra bờ sông', at: () => L().westFence, done: () => F.fence, time: 75, lv: 4 },
  ];
  G.OBJ.forEach((o) => { if (typeof o.t === 'function') { const f = o.t; Object.defineProperty(o, 't', { get: f }); } });
  G.INTER = [
    { at: () => L().keySpot, r: 1.15, when: () => !I.key, label: 'Lấy chìa khóa (giữ)', hold: 1.6, block: () => (!P.crouch ? 'Cúi người (C) để không đánh thức hắn' : null), run: () => { I.key = true; P.chain = null; G.sfx('pickup'); G.sfx('cage'); ui.toast('Xích đã mở. Đi nhẹ thôi.', 2600); } },
    ...L().cells.map((c, i) => ({ at: () => ({ x: c.x + 1.0, z: c.z + c.d / 2 + 0.6 }), r: 1.3, when: () => I.key && !c.door.open, label: 'Mở cửa phòng giam (giữ)', hold: 1.5, run: () => {
      c.door.open = true; c.door.col.off = true; F.cells++; S.stats.freed++; G.sfx('cage');
      const v = npc('cv' + i); if (v) v.pose = 'kneel';
      ui.toast(['“Có thật không... cảnh sát tới à?”', '“Tôi sẽ nằm im chờ.”', '“Cảm ơn em.”', '“Đi đi, cẩn thận con chó.”'][F.cells - 1] || '', 2600);
    } })),
    // the prison door was never openable, so nobody could reach the generator; the guard's key ring now opens it
    { at: () => whDoor, r: 1.7, when: () => !G.doors.wh.open, label: 'Mở khóa cửa nhà giam (giữ)', hold: 1.2, block: () => (!I.key ? 'Cửa nhà giam khóa. Chùm chìa khóa ở hông tên gác đang ngủ' : null), run: () => { G.openDoor(G.doors.wh); G.sfx('door'); G.makeNoise(P.pos.x, P.pos.z, 6, 'door'); ui.toast('Cửa nhà giam đã mở. Máy phát điện ở phía đông, cạnh bãi phơi gạch.', 3200); } },
    { at: () => L().generator, r: 1.9, when: () => !F.power, label: 'Tắt máy phát điện (giữ)', hold: 3, run: () => { F.power = true; G.killPower(); G.sfx('door2'); G.makeNoise(L().generator.x, L().generator.z, 70, 'stone'); ui.toast('Toàn bộ đèn tắt. Bọn gác đang chạy về phía máy phát!', 3800); } },
    { at: () => L().westFence, r: 1.8, when: () => !F.fence, label: 'Leo qua rào phía tây (giữ)', hold: 2, block: () => (!F.power ? 'Đèn pha còn chiếu dọc hàng rào. Tắt máy phát trước' : F.cells < 4 ? 'Còn người trong phòng giam. Mở cửa cho họ trước' : null), run: () => ST.ch3Fence() },
  ];
};
// over the west fence → Chapter 4, the run to the river (escape.js)
ST.ch3Fence = function () {
  S.f.fence = true; S.stealthPhase = false; S.clockRun = false; G.stealth = false; S.busy = true; P.frozen = true; P.pose = 'climb';
  G.sfx('cage');
  ui.fade(() => { P.pose = null; ST.startCh4(); }, 400);
};
// ===================== THE CHOICE (after the 4 Cambodia maps: the rescue on the river) =====================
ST.finalChoice = function () {
  S.ended = true; S.phase = 'ending'; ui.hud(false); G.unlockPointer(); S.endMood = 'hope';
  $('end-eyebrow').textContent = 'Hoàn thành 4 bản đồ ở Campuchia';
  const h = $('end-title'); h.textContent = 'Chọn hướng đi tiếp'; h.className = 'good';
  $('end-story').textContent = 'Nam đã sống sót qua Sihanoukville, trại rừng, lò gạch và bến sông, rồi được cảnh sát hai nước cứu. Bạn muốn kết thúc câu chuyện ở đây, hay chơi tiếp một nhánh khác?';
  $('end-ledger').innerHTML = ''; $('end-signs').hidden = true; $('btn-again').hidden = true;
  const box = $('end-choices'); box.hidden = false; box.innerHTML = '';
  [['Được thả tự do, trở về nhà', 'Kết thúc chính: lên máy bay về Việt Nam, về với bố mẹ.', () => ST.flightHome()],
   ['Chơi tiếp: Đường tối', 'Nhánh “nếu như”: Nam ở lại làm cho đường dây. Chạy 3 bản đồ mới, doanh số cao sẽ được lên lính canh. Có thể nạp tiền trong game để mua chức quản lý.', () => ST.startDark()]].forEach(([a, b, fn]) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'end-choice';
    const t = document.createElement('b'); t.textContent = a; const s = document.createElement('span'); s.textContent = b; btn.append(t, s);
    btn.onclick = () => { $('ending').hidden = true; box.hidden = true; $('btn-again').hidden = false; S.ended = false; ui.fade(fn); };
    box.appendChild(btn);
  });
  $('ending').hidden = false;
};
ST.epilogue = function () {
  ST.reset(); S.phase = 'cut'; S.chapter = 6; G.saveCheckpoint(1);
  G.loadLevel('prologue'); G.setTime(16.8); G.overcast = 0.2; G.setRain(0); G.lightningOn = false; S.mood = 'hope'; ui.hud(false);
  const mom = npc('mom'), dad = npc('dad');
  mom.pos.set(-0.2, 0, 0.6); mom.yaw = Math.PI / 2; dad.pos.set(-0.6, 0, -0.4); dad.yaw = Math.PI / 2;
  G.placePlayer(3.2, 1.1, -Math.PI / 2); P.frozen = true;
  G.cine([-1.6, 1.8, 2.0], [1.2, 1.1, 0.4], true, 0.8);
  run([
    card([{ t: 'Về đến nhà · tối hôm ấy', c: 'place' }, { t: 'Chuyến bay hồi hương hạ cánh xuống Tân Sơn Nhất. Nam được bàn giao về nước cùng 41 người khác. Có người khóc, có người không nói được câu nào.' }]),
    (n) => { const p = { x: 0.9, z: 1.0 }; let k = 0; const iv = setInterval(() => { P.pos.x += (p.x - P.pos.x) * 0.08; P.pos.z += (p.z - P.pos.z) * 0.08; P.phase += 0.2; G.animHuman(P.h, { pose: 'stand', amt: 0.6, phase: P.phase, t: k }); if (++k > 45) { clearInterval(iv); n(); } }, 40); },
    fx(() => { mom.pose = 'hug'; P.pose = 'hug'; dad.pose = 'talk'; }),
    say([['Mẹ', 'Nam ơi... con của mẹ...'], ['Bố', 'Về là được rồi. Nợ nần gì thì cả nhà cùng tính. Không ai bắt con phải đi đâu xa nữa.'], ['Nam', 'Con xin lỗi bố mẹ. Con cứ nghĩ việc nhẹ lương cao là cơ hội cuối...']]),
    (n) => ui.fade(n, 300),
  ], () => ST.goodEnding());
};
ST.goodEnding = function () {
  S.ended = true; S.phase = 'ending'; ui.hud(false); S.endMood = 'hope';
  const st = S.stats, L2 = (a, b) => `<div>${a}</div><div>${b}</div>`;
  $('end-eyebrow').textContent = 'Kết thúc · Trở về nhà'; const h = $('end-title'); h.textContent = 'Nam đã về nhà'; h.className = 'good';
  $('end-story').textContent = 'Chiến dịch phối hợp giữa lực lượng chức năng Việt Nam và Campuchia giải cứu hàng trăm người ở ba địa điểm. Nam được hỗ trợ tái hòa nhập, khoản vay nặng lãi được trình báo. ' + (st.warned >= 4 ? 'Nhiều người từng nghe Nam cảnh báo qua màn hình đã kịp giữ lại tiền của mình.' : 'Nhưng những người đã chuyển tiền qua tay Nam vẫn chưa lấy lại được gì.');
  $('end-ledger').innerHTML = L2('Người được Nam cảnh báo', st.warned + ' / 6') + L2('Người bị lừa qua tay Nam', st.scammed + ' / 6') + L2('Số tiền đã bị lừa', G.money(st.sales)) + L2('Người Nam mở lồng, mở cửa', st.freed) + L2('Số lần bị bắt', st.caughtTotal);
  $('end-signs').hidden = false; $('end-choices').hidden = true; $('btn-again').hidden = false; $('btn-again').textContent = 'Chơi lại từ đầu'; $('btn-again').onclick = () => G.leavePage();
  $('ending').hidden = false; G.sfx('win');
};

// ===================== MULTIPLAYER: team escape on the three Cambodia maps (2–6 players) =====================
// The host picks the map in the waiting room: Đặc khu S-7 (Sihanoukville), Trại rừng (jungle camp), Lò gạch (brick kiln,
// which goes on over the west fence into the river escape) or Bến sông (that escape on its own, team_escape.js).
// Each map runs the same missions as its solo night, with the hard parts turned into two-person jobs
// (a support spot held with E, a lure, or two people holding E together). Caught players are tied to a post until
// a teammate frees them. The host decides win / loss for the room. Bots (bots.js) read each map's `bot` block.
const TEAM = ST.TEAM = { ladderHelp: { x: 49.3, z: -35.0 }, lure: { x: 9, z: 53.3 }, outside: { x: 76, z: 0 } };
const peers = () => [...G.net.peers.values()];
const now = () => performance.now();
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const defineTitles = (list) => list.forEach((o) => { if (typeof o.t === 'function') { const f = o.t; Object.defineProperty(o, 't', { get: f }); } });
const freeHumans = () => { const out = []; if (!S.tied && !S.out) out.push(P.pos); for (const p of peers()) if (!p.bot && !p.td && !p.o && p.got) out.push(p.pos); return out; };
const humanNear = (p, r) => freeHumans().some((h) => dist(h, p) < r);
const untieInter = () => ({ at: () => (ST.tiedNear() || P).pos, r: 1.7, when: () => !!ST.tiedNear(), label: () => 'Cởi trói cho ' + (ST.tiedNear() || { name: 'đồng đội' }).name + ' (giữ)', hold: 2.2, run: () => ST.freeMate() });
// the second person's spot: hold E there for as long as the teammate needs it (sent to the room as `hl`)
const holdSpot = (at, key, idle, busy, block, when) => ({ at, r: 1.0, when, label: () => (G.coopMine() === key ? busy : idle), hold: Infinity, coop: key, block, run: () => {} });
// tie post for the maps that have none of their own: a wooden stake with chain rings
function teamPost(x, z) {
  const T = G.T, MAT = G.MAT;
  const m = new T.Mesh(new T.CylinderGeometry(0.11, 0.15, 2.5, 8), MAT.wood); m.position.set(x, 1.25, z); m.castShadow = true; m.receiveShadow = true; G.add(m);
  for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.TorusGeometry(0.19, 0.025, 4, 10), MAT.chain || MAT.steel); r.rotation.x = Math.PI / 2; r.position.set(x, 0.9 + i * 0.12, z); G.add(r); }
  G.addCollider(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 0, 2.5, { los: false });
}
const MAPS = ST.TEAMMAPS = {};
ST.teamBase = () => MAPS[S.teamMap] || MAPS.sihanouk;     // the map picked in the room
ST.teamMap = () => S.teamStage || ST.teamBase();          // the one being played (the kiln goes on to the river, the airport)
// ---- round options (host picks them in the waiting room; server.js keeps them in room.opts) ----
// guards: each map lists the guards a beginner round leaves out (`few`, never the ones a mission needs) and the patrols
// that get a second guard walking the same route the other way (`more`)
const OPT_TIME = { easy: 1.5, normal: 1, hard: 0.75 };
const OPT_WX = { dry: { rain: 0, cloud: 0.3, bolt: false }, rain: { rain: 0.6, cloud: 0.85, bolt: false }, storm: { rain: 0.95, cloud: 1, bolt: true } };
ST.TEAMOPTS = [
  { k: 'tod', label: 'Thời điểm', opts: [['day', 'Ban ngày'], ['dusk', 'Chiều tối'], ['night', 'Ban đêm']],
    hint: { day: 'Không có đèn pha, nhưng lính nhìn xa hơn (18 m thay vì 13 m).', dusk: 'Bắt đầu lúc 17:24, trời tối dần trong lúc chơi.', night: 'Đèn pha, đèn pin và chỗ tối để ẩn nấp.' } },
  { k: 'wx', label: 'Thời tiết', opts: [['dry', 'Khô ráo'], ['rain', 'Mưa'], ['storm', 'Mưa bão']],
    hint: { dry: 'Trời quang, lính nhìn rõ nhất.', rain: 'Mưa che bớt tầm nhìn của lính (khoảng 13 %).', storm: 'Mưa to, sấm chớp: lính nhìn kém nhất (khoảng 21 %).' } },
  { k: 'time', label: 'Thời gian nhiệm vụ', opts: [['easy', 'Thoải mái'], ['normal', 'Bình thường'], ['hard', 'Gấp']],
    hint: { easy: 'Mỗi nhiệm vụ có thêm 50 % thời gian. Hợp với người mới chơi.', normal: 'Thời gian như bản gốc.', hard: 'Mỗi nhiệm vụ chỉ còn 75 % thời gian.' } },
  { k: 'guards', label: 'Lính canh', opts: [['few', 'Ít'], ['normal', 'Bình thường'], ['many', 'Đông']],
    hint: { few: 'Bớt chó nghiệp vụ và vài tổ tuần tra. Hợp với người mới chơi.', normal: 'Số lính như bản gốc.', many: 'Thêm lính đi tuần ngược chiều trên các tuyến chính.' } },
];
ST.NEWBIE_OPTS = { time: 'easy', guards: 'few' };
ST.teamTimeK = () => OPT_TIME[(S.teamOpts || {}).time] || 1;
ST.guardCount = (map, level) => { const m = MAPS[map] || MAPS.sihanouk; return m.guardN + (level === 'few' ? -m.few.length : level === 'many' ? m.more.length : 0); };
ST.optsText = (o) => ST.TEAMOPTS.map((g) => (g.opts.find((x) => x[0] === o[g.k]) || g.opts[1])[1] + (g.k === 'time' ? ' (thời gian)' : g.k === 'guards' ? ' (lính canh)' : '')).join(' · ');
ST.teamGuards = teamGuards;
function teamGuards(tm, defs, level) {
  if (level === 'few') return defs.filter((d) => !tm.few.includes(d.id));
  if (level === 'many') return defs.concat(tm.more.map((id) => defs.find((d) => d.id === id)).filter((d) => d && d.route)
    .map((d) => Object.assign({}, d, { id: d.id + '2', route: d.route.slice().reverse() })));
  return defs;
}

// ---------------- Đặc khu S-7 (Sihanoukville): the original team map ----------------
MAPS.sihanouk = {
  name: 'Đặc khu S-7', sub: 'Sihanoukville · giàn giáo, phòng bảo vệ, nhà kho, lưới B40',
  rules: [['Giàn giáo', '1 người giữ chân thang, 1 người leo lên gửi tin cầu cứu.'], ['Thẻ từ', '1 người rung cổng sắt dụ tên gác ra ngoài, 1 người lẻn vào phòng bảo vệ.'],
    ['Nhà kho', 'cửa cuốn nặng, phải 2 người cùng giữ E mới nâng lên được.'], ['Lưới B40', '1 người giữ cầu dao cho tắt đèn pha, 1 người cắt lưới.'],
    ['Bị bắt', 'bị trói ở cột giữa sân. Đồng đội tới giữ E để cởi trói.'], ['Thắng', 'khi cả đội ra tới đường lớn. Thua khi hết giờ hoặc cả đội đều bị trói.']],
  postName: 'cột giữa sân', post: () => L().post, say: {}, night: 21,
  guardN: 10, few: ['dog1', 'dog2', 'hallE', 'hallIn', 'kho'], more: ['yard', 'east', 'hallE', 'dog1'],
  intro: 'Cả đội cùng trốn khỏi đặc khu S-7. Nhiều nhiệm vụ cần 2 người làm cùng lúc. Ai bị bắt sẽ bị trói ở cột giữa sân, đồng đội phải tới cởi trói.',
  goal: 'Thắng khi cả đội ra tới đường lớn. Hết giờ hoặc cả đội bị trói hết là thua.',
  win: 'Giữ thang, dụ gác, cùng nâng cửa kho, giữ cầu dao cho đồng đội cắt lưới: không ai trong đội ra được một mình. Ngoài đời, cách thoát an toàn nhất vẫn là liên lạc được với gia đình, công an và Đại sứ quán.',
  caught: 'Không còn ai tự do để cởi trói cho đồng đội. Cả đội bị lôi vào phòng tối.',
  outToast: 'Bạn đã ra tới đường lớn. Chờ cả đội!',
  spawn: (k) => ({ x: L().dormSpawn.x + ((k % 6) - 2.5) * 0.8, z: L().dormSpawn.z, yaw: Math.PI }),
  botSpawn: (i) => ({ x: L().dormSpawn.x + (i % 3 - 1) * 0.9, z: L().dormSpawn.z - 1.4 - Math.floor(i / 3) * 0.9, yaw: Math.PI }),
  setup() {
    G.loadLevel('sihanouk');
    G.addNpc('bay', { shirt: 0xb9b2a0, pants: 0x3a3a34, skin: 0xa8754f, hair: 0x8f8a84, sleeveless: true }, { x: 36.2, z: 27.75, yaw: Math.PI, pose: 'sit' });
    G.addNpc('hung', { shirt: 0xb07a58, pants: 0x2a2a2a, skin: 0xb07a58, bruises: true, shorts: true }, { x: 34.2, z: -38, yaw: -Math.PI / 2, pose: 'tied' });
    ST.ch1Setup(); ST.teamObjectives();
    S.phaseLabel = 'Đêm · cả đội cùng trốn'; S.clock = 21 * 60; G.setTime(21);
  },
  tick() { // yard power: off while anyone holds the breaker
    const cut = !S.f.fenceCut && G.coopCount('cdao') > 0;
    if (cut !== G.lightsOut) { G.lightsOut = cut; G.sfx('door2'); if (cut && G.coopMine() !== 'cdao') ui.toast('Đèn pha tắt rồi! Cắt lưới ngay!', 2200); }
  },
  exitOpen: () => !!S.f.fenceCut,
  isOut: (p) => !!S.f.fenceCut && p.x > 70.8, // through the cut fence = outside: safe from the guards
  lure: { at: () => TEAM.lure, r: 9, toast: 'Tên gác phòng bảo vệ đang ra cổng xem. Trốn ngay để đồng đội lấy thẻ từ!', botToast: ' đang rung cổng sắt dụ tên gác. Lấy thẻ từ ngay!' },
  banner(mine, cur, bots) {
    if (mine === 'lad') return ['', 'Đang giữ chân thang. Đừng buông cho tới khi đồng đội leo xong.'];
    if (mine === 'cdao') return ['', 'Đang giữ cầu dao: đèn pha và camera đã tắt. Đừng buông!'];
    if (mine === 'kho') return ['', 'Đang giữ cửa cuốn. Cần thêm 1 người cùng giữ.'];
    if (G.lightsOut) return ['good', 'Đèn pha đã tắt (đồng đội giữ cầu dao). Cắt lưới B40 ngay!'];
    if (G.coopOthers('lad')) return ['good', 'Đồng đội đang giữ chân thang. Leo lên ngay!'];
    if (G.coopOthers('kho')) return ['good', 'Đồng đội đang giữ cửa kho. Tới giữ E cùng để nâng cửa!'];
    if (bots) return [null, ['', 'Bot đang tới giữ chân thang. Ra giàn giáo, khi bot giữ xong thì leo lên.'], ['', 'Bot sẽ rung cổng dụ gác khi bạn tới gần phòng bảo vệ. Gác ra khỏi phòng thì lấy thẻ từ.'],
      ['', 'Bot sẽ giữ cửa cuốn nhà kho. Tới giữ E cùng bot.'], ['', 'Bot sẽ giữ cầu dao ở tường bắc ký túc. Đèn tắt thì cắt lưới.']][cur] || null;
    return null;
  },
  bot: {
    support: { 1: 'lad', 2: 'lure', 3: 'kho', 4: 'cdao' },
    spot: { lad: () => TEAM.ladderHelp, kho: () => ({ x: L().khoDoor.x + 0.4, z: L().khoDoor.z + 0.7 }), cdao: () => L().breaker },
    look: { lad: () => ({ x: 51, z: -36.4 }), kho: () => ({ x: -50, z: -36 }), cdao: () => ({ x: 44, z: 8 }) },
    main: { lad: () => L().ladder, kho: () => L().khoDoor, cdao: () => L().fence }, // where the human does the other half
    can: { lad: () => S.items.phone && !S.f.sent, kho: () => S.items.card && !G.doors.kho.open, cdao: () => !!S.items.cutter && !S.f.fenceCut },
    lure: { hide: () => ({ x: 20, z: 51 }), face: () => ({ x: 9, z: 60 }), done: () => !!S.items.card, // hide out of the guard-room guard's path, a short dash from the gate
      ready: () => { const og = G.guards.find((g) => g.kind === 'office'), gate = G.guards.find((g) => g.id === 'gate'); return !!og && og.state === 'sit' && humanNear(L().card, 20) && (!gate || dist(gate.pos, TEAM.lure) > 10); } },
    idle: (i) => ({ x: 55 - (i % 3) * 1.5, z: 27.5 - Math.floor(i / 3) * 1.5 }), // the far corner of the dorm
    preOut: () => ({ x: 67.5, z: 0 }), outSpot: (i) => ({ x: 78 + (i % 2) * 1.4, z: -3 + i * 1.3 }),
  },
};

// ---------------- Trại rừng (jungle camp): everyone starts locked in Nam's cage ----------------
const JLURE = { x: 49, z: -4 }, JLURE_HIDE = { x: 53, z: 16 }, JANT = { x: 43, z: 36 };
const jOthers = () => L().cages.filter((x, i) => i !== 2);
const jFreed = () => jOthers().filter((c) => c.door.open).length;
const jCua = () => ({ x: L().namCage.x - 0.85, z: L().namCage.z + 0.75 });
const cageSpot = (cg) => ({ x: cg.x + 0.8, z: cg.z + cg.d / 2 + 0.6 });
function jungleSos() {
  P.pose = 'phone';
  ui.phoneChat('<div class="ava" style="background:linear-gradient(135deg,#3f8a7e,#1d4e5a)">SOS</div><div><b>Đường dây bảo hộ công dân</b><small>● vệ tinh · yếu</small></div>', [
    ['sys', 'Tín hiệu vệ tinh · 2 vạch'],
    ['me', '📍 Tọa độ GPS đã gửi'],
    ['me', 'Chúng tôi là một nhóm người Việt bị lừa bán sang Campuchia, đang bị nhốt lồng ở một trại trong rừng. Ở đây còn ít nhất 4 người nữa.'],
    ['them', 'Đã nhận tọa độ. Lực lượng chức năng hai nước đang phối hợp. Giữ an toàn, cố ra khỏi trại.'],
    ['sys', 'Mất tín hiệu.'],
  ], () => { ST.world('sos'); P.pose = null; P.frozen = false; ui.toast('Tin cầu cứu đã đi. Giờ chia nhau mở lồng cho mọi người rồi ra bờ suối.', 3800); }, { btn: 'Giấu điện thoại ▸' });
}
MAPS.jungle = {
  name: 'Trại rừng', sub: 'Lồng sắt, nhà trùm, cột ăng-ten, đầm lầy',
  rules: [['Lồng sắt', '1 người giữ chặt cửa lồng cho khỏi kêu, 1 người cạy khóa bằng sợi thép.'], ['Nhà trùm', '1 người rung bụi tre phía đông dụ tên gác hiên nhà, 1 người lẻn vào lấy điện thoại vệ tinh.'],
    ['Cột ăng-ten', '1 người xoay chảo ăng-ten ở chân cột, 1 người gửi tin cầu cứu.'], ['4 lồng còn lại', 'chia nhau mở, rồi cả đội băng qua đầm lầy ra bờ suối phía đông.'],
    ['Bị bắt', 'bị trói ở gốc cây gần đống lửa. Đồng đội tới giữ E để cởi trói.'], ['Thắng', 'khi cả đội ra tới bờ suối. Thua khi hết giờ hoặc cả đội đều bị trói.']],
  postName: 'gốc cây gần đống lửa', post: () => ({ x: -14, z: 26 }), night: 22,
  guardN: 7, few: ['dogH', 'dogP', 'swamp'], more: ['cage', 'pat1', 'swamp'],
  say: { tied: ' bị bắt, đang bị trói ở gốc cây gần đống lửa! Tới cởi trói (giữ E)', street: ' đã ra tới bờ suối', back: ' quay lại trong trại', lured: ' đang rung bụi tre dụ tên gác hiên nhà' },
  intro: 'Cả đội bị nhốt chung một lồng sắt giữa rừng, cách xa mọi con đường. Nhiều việc cần 2 người làm cùng lúc. Ai bị bắt sẽ bị trói ở gốc cây gần đống lửa.',
  goal: 'Thắng khi cả đội ra tới bờ suối phía đông. Hết giờ hoặc cả đội bị trói hết là thua.',
  win: 'Giữ cửa lồng, dụ tên gác hiên nhà, xoay chảo ăng-ten cho tin cầu cứu đi được: không ai trong lồng thoát được một mình. Ngoài đời, một tín hiệu cầu cứu tới được gia đình, công an và Đại sứ quán là thứ cứu người.',
  caught: 'Không còn ai tự do để cởi trói cho đồng đội. Trùm Sẹo cho dồn cả đội lên xe, chuyển sâu hơn vào rừng.',
  outToast: 'Bạn đã ra tới bờ suối. Chờ cả đội!',
  spawn: (k) => { const c = L().namCage; return { x: c.x + ((k % 3) - 1) * 0.72, z: c.z + (k % 6 < 3 ? -0.5 : 0.35), yaw: 0 }; },
  botSpawn: (i) => MAPS.jungle.spawn(5 - (i % 6)),
  setup() {
    G.loadLevel('jungle'); S.chapter = 2; S.phase = 'ch2night'; S.phaseLabel = 'Đêm · trại rừng · cả đội';
    S.clock = 22 * 60; G.setTime(22); G.setRain(0.85); G.lightningOn = true; S.mood = null;
    G.setGuardsMode('night'); S.stealthPhase = true; S.clockRun = true; G.input.crouch = true; G.input.run = false;
    teamPost(-14, 26);
    const I = S.items, F = S.f, others = jOthers();
    // measured: cage → boss house ~75 m (+ the lure), house → antenna ~15 m, antenna → cage row ~90 m, cages → stream ~95 m through the swamp
    G.OBJ = [
      { t: 'Tìm sợi thép giấu ở góc lồng', at: () => L().wire, done: () => I.wire, hideNear: 3, time: 40, lv: 1 },
      { t: 'Cạy khóa lồng: 1 người giữ chặt cửa lồng (điểm xanh), 1 người cạy khóa', at: () => L().cageLock, at2: jCua, done: () => F.cageOpen, hideNear: 2, time: 50, lv: 2 },
      { t: 'Lấy điện thoại vệ tinh: 1 người rung bụi tre phía đông dụ tên gác hiên nhà (điểm xanh), 1 người lẻn vào nhà trùm', at: () => L().satphone, at2: () => JLURE, done: () => I.sat, time: 150, lv: 3 },
      { t: 'Gửi tin cầu cứu: 1 người xoay chảo ăng-ten ở chân cột (điểm xanh), 1 người gửi tin ở bãi trống', at: () => L().antenna, at2: () => JANT, done: () => F.sos, time: 90, lv: 2 },
      { t: () => 'Chia nhau mở 4 lồng còn lại (' + jFreed() + '/4)', at: () => cageSpot(others.find((x) => !x.door.open) || others[0]), done: () => jFreed() >= 4, time: 120, lv: 3 },
      { t: () => 'Cả đội băng qua đầm lầy ra bờ suối (' + ST.teamOut().join('/') + ')', at: () => L().swampExit, done: () => ST.allOut(), time: 110, lv: 3 },
    ];
    defineTitles(G.OBJ);
    G.INTER = [
      untieInter(),
      { at: () => L().wire, r: 1.1, when: () => !I.wire, label: 'Mò tìm sợi thép', hold: 2, run: () => { ST.world('wire'); ui.toast('Một đoạn dây thép từ lưới lồng. Đủ để cạy khóa.', 3000); } },
      holdSpot(jCua, 'cua', 'Giữ chặt cửa lồng cho khỏi kêu (giữ E)', 'Đang giữ chặt cửa lồng. Đừng buông!', () => (!I.wire ? 'Tìm sợi thép trước đã' : null), () => !F.cageOpen),
      { at: () => L().cageLock, r: 1.1, when: () => !F.cageOpen, label: 'Cạy khóa (giữ)', hold: 5,
        block: () => (!I.wire ? 'Khóa móc to bằng nắm tay. Cần gì đó để cạy' : !G.coopOthers('cua') ? 'Cửa lồng rung bần bật, sẽ kêu to. Cần 1 đồng đội giữ chặt cửa lồng (điểm xanh)' : null),
        run: () => { ST.world('jlock'); ui.toast('Cửa lồng bật mở. Không ai nghe thấy gì.', 2600); } },
      { at: () => JLURE, r: 2.2, when: () => !I.sat, label: 'Rung bụi tre dụ tên gác hiên nhà (giữ)', hold: 1.2, block: () => (now() - (F.lureAt || 0) < 9000 ? 'Vừa rung xong. Trốn đi!' : null), run: () => ST.teamLure() },
      { at: () => L().satphone, r: 1.5, when: () => !I.sat, label: 'Lấy điện thoại vệ tinh', hold: 0.8, run: () => { ST.world('sat'); ui.toast('Có điện thoại vệ tinh. Ra bãi trống cạnh cột ăng-ten mới bắt được tín hiệu.', 3600); } },
      holdSpot(() => JANT, 'ang', 'Xoay chảo ăng-ten về hướng vệ tinh (giữ E)', 'Đang giữ chảo ăng-ten đúng hướng. Đừng buông!', () => (!I.sat ? 'Lấy điện thoại vệ tinh trong nhà trùm trước đã' : null), () => !F.sos),
      { at: () => L().antenna, r: 2.6, when: () => !F.sos, label: 'Gửi tin cầu cứu (giữ)', hold: 5,
        block: () => (!I.sat ? 'Cần điện thoại vệ tinh trong nhà trùm' : !G.coopOthers('ang') ? 'Tín hiệu chập chờn. Cần 1 đồng đội xoay chảo ăng-ten ở chân cột (điểm xanh)' : null),
        onHold: () => { P.pose = 'phone'; }, onCancel: () => { P.pose = null; }, run: jungleSos },
      ...others.map((cg, i) => ({ at: () => cageSpot(cg), r: 1.3, when: () => F.cageOpen && !cg.door.open, label: 'Mở lồng (giữ)', hold: 2, block: () => (!I.wire ? 'Cần sợi thép' : null),
        run: () => { ST.world('jc' + i); ui.toast(['“Cảm ơn anh...”', '“Tôi đợi ở bờ suối.”', '“Đi, đi đi!”', '“Tôi nhớ mặt các anh. Tôi sẽ sống.”'][jFreed() - 1] || '', 2400); } })),
    ];
  },
  apply(k) {
    const I = S.items, F = S.f;
    if (k === 'wire') { I.wire = true; G.sfx('pickup'); }
    else if (k === 'jlock') { if (!F.cageOpen) { F.cageOpen = true; const d = L().namCage.door; d.open = true; d.col.off = true; G.sfx('cage'); } }
    else if (k === 'sat') { I.sat = true; if (G.satMesh) G.satMesh.visible = false; G.sfx('pickup'); }
    else if (k === 'sos') F.sos = true;
    else if (/^jc[0-3]$/.test(k)) {
      const i = +k[2], cg = jOthers()[i];
      if (cg && !cg.door.open) {
        cg.door.open = true; cg.door.col.off = true; S.stats.freed++; G.sfx('cage');
        const pr = npc('pr' + [0, 1, 3, 4][i]); if (pr) { pr.pose = 'stand'; G.npcGo(pr, [[cg.x + 0.5, cg.z + 2.4], [cg.x + 2, cg.z + 6], [-50, -20]], { walk: true, speed: 1.6, hide: true }); }
      }
    } else return false;
    return true;
  },
  msg: { wire: 'đã tìm thấy sợi thép', jlock: 'đã cạy được khóa lồng', sat: 'đã lấy được điện thoại vệ tinh', sos: 'đã gửi tin cầu cứu qua vệ tinh', jc0: 'đã mở một lồng', jc1: 'đã mở một lồng', jc2: 'đã mở một lồng', jc3: 'đã mở một lồng' },
  exitOpen: () => !!S.f.sos && jFreed() >= 4,
  penned: (p) => { const c = L().namCage; return !!c && !c.door.open && Math.abs(p.x - c.x) < c.w / 2 && Math.abs(p.z - c.z) < c.d / 2; }, // still locked in the cage
  isOut: (p) => MAPS.jungle.exitOpen() && p.x > 57, // past the gap in the palisade
  lure: { at: () => JLURE, r: 6, toast: 'Tên gác hiên nhà đang đi ra phía bụi tre. Trốn ngay để đồng đội vào nhà trùm!', botToast: ' đang rung bụi tre dụ tên gác hiên nhà. Vào nhà trùm ngay!' },
  banner(mine, cur, bots) {
    if (mine === 'cua') return ['', 'Đang giữ chặt cửa lồng. Đừng buông cho tới khi đồng đội cạy xong khóa.'];
    if (mine === 'ang') return ['', 'Đang giữ chảo ăng-ten đúng hướng. Đừng buông cho tới khi tin cầu cứu đi.'];
    if (G.coopOthers('cua')) return ['good', 'Đồng đội đang giữ cửa lồng. Cạy khóa ngay!'];
    if (G.coopOthers('ang')) return ['good', 'Đồng đội đang giữ chảo ăng-ten. Đứng ở bãi trống gửi tin cầu cứu ngay!'];
    if (bots) return [null, ['', 'Bot sẽ giữ chặt cửa lồng. Khi bot giữ xong thì cạy khóa.'], ['', 'Bot sẽ rung bụi tre dụ tên gác hiên nhà khi bạn tới gần nhà trùm.'],
      ['', 'Bot sẽ xoay chảo ăng-ten ở chân cột. Đứng ở bãi trống để gửi tin.'], ['', 'Bot cũng đang chia nhau mở lồng.']][cur] || null;
    return null;
  },
  bot: {
    support: { 1: 'cua', 2: 'lure', 3: 'ang' }, chore: { 4: true },
    spot: { cua: jCua, ang: () => JANT }, look: { cua: () => L().cageLock, ang: () => ({ x: 40, z: 36 }) },
    main: { cua: () => L().cageLock, ang: () => L().antenna },
    can: { cua: () => S.items.wire && !S.f.cageOpen, ang: () => S.items.sat && !S.f.sos },
    lure: { hide: () => JLURE_HIDE, face: () => ({ x: 47, z: -2 }), done: () => !!S.items.sat,
      ready: () => { const og = G.guards.find((g) => g.kind === 'office'); return !!og && og.state === 'sit' && humanNear(L().satphone, 24); } },
    chores: () => (S.f.cageOpen && S.items.wire ? jOthers().map((cg, i) => ({ key: 'jc' + i, at: cageSpot(cg), hold: 2, open: cg.door.open })).filter((c) => !c.open) : []),
    idle: (i) => (!S.f.cageOpen ? MAPS.jungle.botSpawn(i) : { x: -52 + (i % 3) * 1.2, z: -18 - Math.floor(i / 3) * 1.2 }),
    preOut: () => ({ x: 52, z: -29 }), outSpot: (i) => ({ x: 63 + (i % 2) * 1.4, z: -31 + i * 1.1 }),
  },
};

// ---------------- Lò gạch (brick kiln): everyone starts chained to one post in the prison ----------------
const KWH = { x: 20.9, z: -25.5 };
// the west fence (x = −52, 4 m): a pile of bricks to steady, then everybody climbs over to the strip by the river
const KFENCE = { x: -52, top: 4.2, pile: { x: -50.3, z: 2.7 }, inside: { x: -50.2, z: -0.6 }, outside: { x: -53.8, z: -0.6 } };
const kOut = (p) => p.x < KFENCE.x;
function kilnClimb(out) {
  S.hold = null; S.busy = true; P.frozen = true; P.pose = 'climb'; P.speed = 0; P.yaw = out ? -Math.PI / 2 : Math.PI / 2;
  S.f.climb = { t: 0, out, x: P.pos.x, to: out ? KFENCE.outside.x : KFENCE.inside.x };
  G.sfx('cage');
}
function kilnClimbTick(dt) {
  const c = S.f.climb; if (!c) return;
  if (S.tied) { S.f.climb = null; return; } // grabbed off the fence
  c.t += dt; const f = Math.min(1, c.t / 1.5);
  P.pos.x = c.x + (c.to - c.x) * G.clamp((f - 0.4) / 0.3, 0, 1);
  P.pos.y = f < 0.45 ? f / 0.45 * KFENCE.top : f < 0.65 ? KFENCE.top : KFENCE.top * (1 - ((f - 0.65) / 0.35) ** 2);
  P.phase += dt * 8;
  if (f >= 1) { P.pos.y = 0; S.f.climb = null; S.busy = false; P.frozen = false; P.pose = null; G.sfx('punch'); }
}
const kXich = () => ({ x: L().chainAnchor.x - 1.1, z: L().chainAnchor.z - 0.3 });
const cellSpot = (c) => ({ x: c.x + 1.0, z: c.z + c.d / 2 + 0.6 });
const kCells = () => L().cells.filter((c) => c.door.open).length;
MAPS.kiln = {
  name: 'Lò gạch', sub: 'Xích sắt, máy phát, vượt rào, bến sông, bay về Việt Nam',
  rules: [['Xích sắt', '1 người giữ chặt sợi xích cho khỏi kêu, 1 người cúi người bò tới lấy chìa khóa của tên gác đang ngủ.'], ['Phòng giam', 'chia nhau mở 4 phòng giam bằng chùm chìa khóa.'],
    ['Máy phát điện', 'cần gạt kẹt cứng, phải 2 người cùng giữ E mới tắt được toàn bộ đèn.'], ['Vượt rào', '1 người giữ chồng gạch cho vững, 1 người kê cao lên, rồi cả đội leo qua rào phía tây.'],
    ['Bị bắt', 'bị trói ở cột giữa bãi phơi gạch. Đồng đội tới giữ E để cởi trói (đã qua rào vẫn leo lại vào được).'],
    ['Chơi tiếp', 'cả đội chạy ra Bến sông dưới mưa đá, lên tàu, được cảnh sát hai nước đón. Ai gục thì đỡ nhau dậy.'],
    ['Thắng', 'khi cả đội bay về Việt Nam gặp bố mẹ. Thua khi hết giờ, cả đội bị trói hết hoặc gục cùng lúc.']],
  journey: 7, home: true,
  postName: 'cột giữa bãi phơi gạch', post: () => ({ x: -8, z: 23.7 }), night: 23,
  guardN: 7, few: ['dogK', 'kiln', 'wh'], more: ['yard1', 'kiln', 'wh'],
  say: { tied: ' bị bắt, đang bị trói ở cột giữa bãi phơi gạch! Tới cởi trói (giữ E)', street: ' đã vượt qua rào', back: ' leo lại vào trong lò gạch' },
  intro: 'Cả đội bị xích chung một cột trong nhà giam của lò gạch bỏ hoang. Ngoài bến sông có tàu chờ, cảnh sát Việt Nam và Campuchia đón ở hạ lưu. Ai bị bắt sẽ bị trói ở cột giữa bãi phơi gạch.',
  goal: 'Vượt rào phía tây, chạy ra bến, lên tàu, bay về Việt Nam. Hết giờ hoặc cả đội bị hạ hết là thua.',
  win: 'Giữ xích, cùng kéo cần gạt máy phát, kê gạch cho nhau vượt rào, đỡ nhau dậy dưới mưa đá rồi cùng bay về với gia đình. Ngoài đời, những cuộc giải cứu bắt đầu từ một tin nhắn tới được gia đình và công an.',
  caught: 'Không còn ai tự do để cởi trói cho đồng đội. Bọn gác dồn cả đội xuống thuyền trước khi đội đặc nhiệm kịp vào.',
  outToast: 'Bạn đã qua rào. Chờ cả đội!', outWord: 'đã qua rào',
  spawn: (k) => { const a = L().chainAnchor; return { x: a.x + ((k % 3) - 1) * 0.95, z: a.z - 1.0 - Math.floor((k % 6) / 3) * 0.85, yaw: Math.PI }; },
  botSpawn: (i) => MAPS.kiln.spawn(5 - (i % 6)),
  afterSpawn() { if (!S.items.key) { const a = L().chainAnchor; P.chain = { x: a.x, z: a.z, r: 3.4 }; } },
  setup() {
    G.loadLevel('kiln'); S.chapter = 3; S.phase = 'ch3night'; S.phaseLabel = 'Đêm · lò gạch · cả đội';
    S.clock = 23 * 60; G.setTime(23); S.mood = null;
    G.setGuardsMode('night'); S.stealthPhase = true; S.clockRun = true; G.input.crouch = true; G.input.run = false;
    L().cells.forEach((c, i) => G.addNpc('cv' + i, { shirt: [0x6a5a4a, 0x8a6a6a, 0x4a5a6a, 0x5a6a4a][i], pants: 0x2a2a2a, skin: [0xc79a74, 0xd6a985, 0xb5835e, 0xa8754f][i], longHair: i % 2 === 1, bruises: true }, { x: c.x, z: c.z - 0.3, yaw: 0, pose: 'floor' }));
    teamPost(-8, 23.7);
    const I = S.items, F = S.f;
    // measured: key 3 m, cells 25 m, prison door → generator ~45 m past the sweeping guard, generator → back gate ~50 m
    G.OBJ = [
      { t: 'Lấy chìa khóa: 1 người giữ chặt sợi xích (điểm xanh), 1 người cúi người bò tới tên gác đang ngủ', at: () => L().keySpot, at2: kXich, done: () => I.key, hideNear: 3, time: 50, lv: 2 },
      { t: () => 'Chia nhau mở 4 phòng giam (' + kCells() + '/4)', at: () => cellSpot(L().cells.find((x) => !x.door.open) || L().cells[0]), done: () => kCells() >= 4, time: 75, lv: 2 },
      { t: () => (G.doors.wh.open ? 'Máy phát điện: 2 người cùng giữ E kéo cần gạt' : 'Mở cửa nhà giam, rồi 2 người cùng kéo cần gạt máy phát điện phía đông'), at: () => (G.doors.wh.open ? L().generator : KWH), done: () => F.power, time: 120, lv: 3 },
      { t: 'Rào phía tây: 1 người giữ chồng gạch (điểm xanh), 1 người kê cao lên', at: () => L().westFence, at2: () => KFENCE.pile, done: () => F.rao, time: 120, lv: 4 },
      { t: () => 'Cả đội leo qua rào phía tây (' + ST.teamOut().join('/') + ')', at: () => (S.out ? KFENCE.outside : KFENCE.inside), done: () => ST.allOut() || !!F.going, time: 120, lv: 2 },
    ];
    defineTitles(G.OBJ);
    G.INTER = [
      untieInter(),
      holdSpot(kXich, 'xich', 'Giữ chặt sợi xích cho khỏi kêu (giữ E)', 'Đang giữ chặt sợi xích. Đừng buông!', null, () => !I.key),
      { at: () => L().keySpot, r: 1.15, when: () => !I.key, label: 'Lấy chìa khóa (giữ)', hold: 1.6,
        block: () => (!P.crouch ? 'Cúi người (C) để không đánh thức hắn' : !G.coopOthers('xich') ? 'Sợi xích kêu loảng xoảng, hắn sẽ tỉnh. Cần 1 đồng đội giữ chặt sợi xích (điểm xanh)' : null),
        run: () => { ST.world('key'); ui.toast('Có chùm chìa khóa. Xích của cả đội đã mở. Đi nhẹ thôi.', 3000); } },
      ...L().cells.map((c, i) => ({ at: () => cellSpot(c), r: 1.3, when: () => I.key && !c.door.open, label: 'Mở cửa phòng giam (giữ)', hold: 1.5,
        run: () => { ST.world('kc' + i); ui.toast(['“Có thật không... cảnh sát tới à?”', '“Tôi sẽ nằm im chờ.”', '“Cảm ơn các em.”', '“Đi đi, cẩn thận con chó.”'][kCells() - 1] || '', 2600); } })),
      { at: () => KWH, r: 1.7, when: () => !G.doors.wh.open, label: 'Mở khóa cửa nhà giam (giữ)', hold: 1.2, block: () => (!I.key ? 'Cửa nhà giam khóa. Chùm chìa khóa ở hông tên gác đang ngủ' : null),
        run: () => { ST.world('wh'); G.makeNoise(P.pos.x, P.pos.z, 6, 'door'); ui.toast('Cửa nhà giam đã mở. Máy phát điện ở phía đông, cạnh bãi phơi gạch.', 3200); } },
      { at: () => L().generator, r: 1.9, when: () => !F.power, label: 'Kéo cần gạt máy phát (2 người cùng giữ E)', hold: 3, coop: 'gen', need: 2, block: () => (!G.doors.wh.open ? 'Ra khỏi nhà giam trước đã' : null),
        run: () => { ST.world('power'); G.makeNoise(L().generator.x, L().generator.z, 30, 'stone'); ui.toast('Toàn bộ đèn tắt. Bọn gác gần đó đang chạy về phía máy phát!', 3800); } },
      holdSpot(() => KFENCE.pile, 'gach', 'Giữ chồng gạch cho vững (giữ E)', 'Đang giữ chồng gạch. Đừng buông!',
        () => (!F.power ? 'Đèn pha còn chiếu dọc hàng rào. Tắt máy phát trước' : kCells() < 4 ? 'Còn người trong phòng giam. Mở cửa cho họ trước' : null), () => !F.rao),
      { at: () => L().westFence, r: 1.7, when: () => !F.rao, label: 'Kê gạch sát rào (giữ)', hold: 3,
        block: () => (!F.power ? 'Đèn pha còn chiếu dọc hàng rào. Tắt máy phát trước' : kCells() < 4 ? 'Còn người trong phòng giam. Mở cửa cho họ trước' : !G.coopOthers('gach') ? 'Chồng gạch lung lay. Cần 1 đồng đội giữ cho vững (điểm xanh)' : null),
        run: () => { ST.world('rao'); ui.toast('Gạch đã kê cao. Cả đội leo qua rào ngay!', 3200); } },
      { at: () => KFENCE.inside, r: 2.1, when: () => F.rao && !S.out && !S.tied && !F.going, label: 'Leo qua rào (giữ)', hold: 0.8, run: () => kilnClimb(true) },
      { at: () => KFENCE.outside, r: 3.2, when: () => F.rao && S.out && !F.going && peers().some((p) => p.td), label: 'Leo lại vào trong cứu đồng đội (giữ)', hold: 0.8, run: () => kilnClimb(false) },
    ];
  },
  apply(k) {
    const I = S.items, F = S.f;
    if (k === 'key') { if (!I.key) { I.key = true; P.chain = null; G.sfx('pickup'); G.sfx('cage'); } }
    else if (/^kc[0-3]$/.test(k)) {
      const i = +k[2], c = L().cells[i];
      if (c && !c.door.open) { c.door.open = true; c.door.col.off = true; S.stats.freed++; G.sfx('cage'); const v = npc('cv' + i); if (v) v.pose = 'kneel'; }
    } else if (k === 'wh') { G.openDoor(G.doors.wh); G.sfx('door'); }
    else if (k === 'power') { if (!F.power) { F.power = true; G.killPower(); G.sfx('door2'); } }
    else if (k === 'rao') {
      if (!F.rao) {
        F.rao = true; G.sfx('door2'); // the pile grows into steps up the sheeting
        for (const [x, h, w] of [[-51.55, 2.5, 0.6], [-50.98, 1.6, 0.55]]) G.box({ x, z: -0.75, w, d: 1.1, h, mat: G.MAT.brick, S: 2, collide: false });
      }
    } else if (k === 'river') { if (ST.teamToRiver) ST.teamToRiver(); }
    else return false;
    return true;
  },
  msg: { key: 'đã lấy được chùm chìa khóa, xích đã mở', kc0: 'đã mở một phòng giam', kc1: 'đã mở một phòng giam', kc2: 'đã mở một phòng giam', kc3: 'đã mở một phòng giam', wh: 'đã mở cửa nhà giam', power: 'đã tắt máy phát điện, toàn bộ đèn tắt', rao: 'đã kê xong gạch, leo qua rào được rồi' },
  exitOpen: () => !!S.f.rao,
  isOut: (p) => !!S.f.rao && kOut(p) && !S.f.climb,
  tick(dt) { kilnClimbTick(dt); if (S.f.going && ST.teamSceneTick) ST.teamSceneTick(); },
  next: () => ST.world('river'),
  banner(mine, cur, bots) {
    if (mine === 'xich') return ['', 'Đang giữ chặt sợi xích. Đừng buông cho tới khi đồng đội lấy được chìa khóa.'];
    if (mine === 'gen') return ['', 'Đang kéo cần gạt máy phát. Cần đủ 2 người cùng giữ E.'];
    if (G.coopOthers('xich')) return ['good', 'Đồng đội đang giữ xích. Cúi người bò tới lấy chìa khóa!'];
    if (G.coopOthers('gen')) return ['good', 'Đồng đội đang kéo cần gạt. Tới giữ E cùng để tắt máy phát!'];
    if (mine === 'gach') return ['', 'Đang giữ chồng gạch. Đừng buông cho tới khi đồng đội kê xong.'];
    if (G.coopOthers('gach')) return ['good', 'Đồng đội đang giữ chồng gạch. Tới kê cao lên!'];
    if (G.lightsOut && cur === 3 && !bots) return ['good', 'Đèn đã tắt hết. Ra rào phía tây: 1 người giữ gạch, 1 người kê.'];
    if (bots) return [['', 'Bot sẽ giữ chặt sợi xích. Cúi người (C) bò tới lấy chìa khóa.'], ['', 'Bot cũng đang chia nhau mở phòng giam.'],
      ['', 'Bot sẽ cùng kéo cần gạt máy phát. Tới giữ E cùng bot.'], ['', 'Bot sẽ giữ chồng gạch ở rào phía tây. Bạn tới kê gạch.'], ['', 'Bot tự leo qua rào. Bạn cũng leo qua (giữ E).']][cur] || null;
    return null;
  },
  bot: {
    support: { 0: 'xich', 2: 'gen', 3: 'gach' }, chore: { 1: true },
    spot: { xich: kXich, gen: () => ({ x: L().generator.x + 0.2, z: L().generator.z + 1.1 }), gach: () => KFENCE.pile },
    look: { xich: () => L().keySpot, gen: () => ({ x: 44.6, z: 14 }), gach: () => ({ x: -52, z: 1.2 }) },
    main: { xich: () => L().keySpot, gen: () => L().generator, gach: () => L().westFence },
    can: { xich: () => !S.items.key, gen: () => G.doors.wh.open && !S.f.power, gach: () => !!S.f.power && !S.f.rao && kCells() >= 4 },
    climb: { open: () => !!S.f.rao, side: kOut, inside: KFENCE.inside, outside: KFENCE.outside, top: KFENCE.top },
    chores: () => (S.items.key ? L().cells.map((c, i) => ({ key: 'kc' + i, at: cellSpot(c), hold: 1.5, open: c.door.open })).filter((c) => !c.open) : []),
    idle: (i) => (!S.items.key || !G.doors.wh.open ? MAPS.kiln.botSpawn(i) : { x: -12 + (i % 3) * 1.2, z: -2 - Math.floor(i / 3) * 1.2 }), // inside the kiln tunnel
    preOut: () => KFENCE.inside, outSpot: (i) => ({ x: -54.6 - (i % 2) * 1.2, z: -4 + i * 1.7 }),
  },
};

// ---------------- shared team logic ----------------
// world events of the jungle / kiln maps (S-7's are handled in story.js)
const applyBase = G.applyWorld;
G.applyWorld = function (k, by) {
  const tm = S.teamPlay ? ST.teamMap() : null;
  if (tm && tm.apply && tm.apply(k)) { if (by && tm.msg && tm.msg[k]) { ui.toast(by + ' ' + tm.msg[k], 3400); G.sfx('pickup'); } return; } // (the host's stage changes carry no message)
  applyBase(k, by);
};
G.teamPenned = (pos) => { const tm = S.teamPlay ? ST.teamMap() : null; return !!(tm && tm.penned && tm.penned(pos)); };
G.teamSay = () => (S.teamPlay ? ST.teamMap().say : null) || {};
ST.teamOut = () => [(S.out ? 1 : 0) + peers().filter((p) => p.o).length, 1 + G.net.peers.size];
ST.allOut = () => { const [k, n] = ST.teamOut(); return ST.teamMap().exitOpen() && k >= n; };
ST.allTied = () => S.tied && peers().every((p) => p.td);
ST.tiedNear = () => { let best = null, bd = 2.4; for (const p of peers()) { if (!p.td || !p.got) continue; const d = Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z); if (d < bd) { bd = d; best = p; } } return best; };
ST.teamHelpAt = () => { if (!S.teamPlay || S.tied || S.ended) return null; let best = null, bd = 1e9; for (const p of peers()) { if (!p.td || !p.got) continue; const d = Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z); if (d < bd) { bd = d; best = p; } } return best ? best.pos : null; };
ST.teamObjectives = function () { // S-7
  const I = S.items, F = S.f;
  G.OBJ = [
    { t: 'Lấy điện thoại dưới đệm giường số 3 (Ký túc)', at: () => L().bed3, done: () => I.phone, time: 45, lv: 1 },
    { t: 'Gửi tin cầu cứu: 1 người giữ chân thang (điểm xanh), 1 người leo giàn giáo', at: () => L().ladder, at2: () => TEAM.ladderHelp, done: () => F.sent, time: 100, lv: 2 },
    { t: 'Lấy thẻ từ: 1 người rung cổng sắt dụ tên gác (điểm xanh), 1 người lẻn vào phòng bảo vệ', at: () => L().card, at2: () => TEAM.lure, done: () => I.card, time: 140, lv: 3 },
    { t: 'Nhà kho: 2 người cùng giữ E nâng cửa cuốn, rồi lấy kìm cắt', at: () => (G.doors.kho.open ? L().cutter : L().khoDoor), done: () => I.cutter, time: 120, lv: 3 },
    { t: 'Lưới B40: 1 người giữ cầu dao ở tường bắc ký túc (điểm xanh), 1 người cắt lưới', at: () => L().fence, at2: () => L().breaker, done: () => F.fenceCut, time: 140, lv: 4 },
    { t: () => 'Cả đội ra tới đường lớn (' + ST.teamOut().join('/') + ')', at: () => TEAM.outside, done: () => ST.allOut(), time: 90, lv: 2 },
    { t: 'Tùy chọn: giải cứu Hùng ở phòng tối', opt: true, at: () => (G.doors.ptoi.open ? L().hung : L().ptoiDoor), done: () => F.hung },
  ];
  defineTitles(G.OBJ);
};
ST.startMP = function (m) {
  ST.reset(); S.mp = true; S.chapter = 1; S.dark = false; S.stats = { warned: 0, scammed: 0, sales: 0, wallet: 0, freed: 0, caughtTotal: 0 };
  ['title', 'room', 'ending', 'lobby', 'pause'].forEach((id) => { $(id).hidden = true; }); S.paused = false;
  S.teamMap = MAPS[m && m.map] ? m.map : MAPS[G.net.map] ? G.net.map : 'sihanouk';
  const tm = ST.teamMap(), o = S.teamOpts = Object.assign({ tod: 'night', wx: 'rain', time: 'normal', guards: 'normal' }, G.net.opts || {}, (m && m.opts) || {});
  S.teamSeed = (m && m.now) || 1; // the same on every screen: what a round draws at random
  G.audioInit();
  // every client builds the same guard list (the host's snapshots address guards by their index)
  G.guardFilter = (defs) => teamGuards(tm, defs, o.guards);
  try { tm.setup(); } finally { G.guardFilter = null; }
  S.teamPlay = true; S.f.frees = 0; S.deadline = 0; S.onDeadline = null; S.clockRate = 0.7;
  // time of day and weather (guards keep their night patrols by day too; daylight just has no searchlights)
  const hour = o.tod === 'day' ? 9.5 : o.tod === 'dusk' ? 17.4 : tm.night, wx = OPT_WX[o.wx] || OPT_WX.rain;
  S.clock = hour * 60; G.overcast = wx.cloud; G.setRain(wx.rain); G.lightningOn = wx.bolt; G.setTime(hour);
  S.phaseLabel = { day: 'Ban ngày', dusk: 'Chiều tối', night: 'Ban đêm' }[o.tod] + ' · ' + tm.name + ' · cả đội';
  const tk = OPT_TIME[o.time] || 1; G.OBJ.forEach((ob) => { if (ob.time) ob.time = Math.round(ob.time * tk); });
  for (const g of G.guards) if (g.kind === 'office') g.noBreak = true; // the guard-room / porch guard only leaves when someone lures him out
  const sp = tm.spawn(G.net.id % 6); G.placePlayer(sp.x, sp.z, sp.yaw);
  if (tm.afterSpawn) tm.afterSpawn();
  if (G.bots) G.bots.start();
  ui.hud(true); ST.tick = ST.teamTick;
  const n = G.net.peers.size + 1;
  ui.card([{ t: (G.net.roomName || G.net.room) + ' · ' + tm.name + ' · ' + n + ' người', c: 'place' }, { t: G.fmtClock(S.clock), c: 'big' }, { t: tm.intro }, { t: ST.optsText(o), c: 'place' }, { t: tm.goal, c: 'place' }],
    () => ui.toast('Điểm vàng: nhiệm vụ chính · Điểm xanh: chỗ cho người thứ hai', 4200));
};
ST.teamTick = function (dt) {
  if (!S.teamPlay || S.ended) return;
  const tm = ST.teamMap(), base = ST.teamBase();
  if (base.baseTick) base.baseTick(dt || 0.016);
  if (G.bots) G.bots.tick(dt || 0.016); // host only: moves the bots and sends their state
  if (tm.tick) tm.tick(dt);
  if (tm.own || S.teamStage) return; // the escape's legs judge everything themselves (team_escape.js)
  // past the exit = outside: safe from the guards, waits for the rest of the team
  const out = tm.isOut(P.pos) && !S.tied;
  if (out !== S.out) { S.out = out; S.stealthPhase = !out; G.net.say(out ? 'street' : 'back'); if (out) { G.sfx('pickup'); ui.toast(tm.outToast, 2600); } }
  if (G.net.isHost()) {
    if (S.f.going) return;
    if (ST.allOut()) { if (tm.next) tm.next(); else ST.teamEnd('win'); }
    else if (ST.allTied()) ST.teamEnd('caught');
  }
};
ST.teamBanner = function () {
  if (!S.teamPlay || S.ended) return null;
  const tm = ST.teamMap();
  if (tm.own) return tm.banner();
  if (S.f.going) return null;
  if (S.tied) return ['bad', 'Bạn đang bị trói ở ' + tm.postName + '. Chờ đồng đội tới cởi trói.'];
  const tied = peers().filter((p) => p.td);
  if (S.out) { const [k, n] = ST.teamOut(); return ['good', 'Bạn đã ở ngoài (' + k + '/' + n + '). ' + (tied.length ? tied[0].name + ' còn bị trói bên trong!' : 'Chờ cả đội ra hết.')]; }
  if (tied.length) return ['bad', tied.map((p) => p.name).join(', ') + ' đang bị trói ở ' + tm.postName + '. Tới cởi trói (điểm đỏ).'];
  // with bots in the team, the map also says what they are waiting for
  return tm.banner ? tm.banner(G.coopMine(), G.OBJ.indexOf(G.currentObj()), peers().some((p) => p.bot && !p.td)) : null;
};
ST.teamLure = function () {
  const lu = ST.teamMap().lure, p = lu.at();
  S.f.lureAt = now(); G.sfx('cage'); G.sfx('door2');
  G.makeNoise(p.x, p.z, lu.r, 'lure'); G.net.say('lured');
  ui.toast(lu.toast, 3800);
};
ST.lureGate = ST.teamLure; // S-7's gate interaction (story.js) calls it by this name
ST.teamTie = function (src) {
  S.busy = true; P.frozen = true; G.stealth = false; S.hold = null; P.climb = 0; P.pos.y = 0;
  G.sfx('caught'); if (src === 'dog') { G.sfx('bark'); G.sfx('growl'); } G.sfx('arrest'); ui.flash(); G.shake(0.25);
  ui.toast(src === 'light' ? 'ĐÈN PHA PHÁT HIỆN BẠN!' : src === 'dog' ? 'CHÓ NGHIỆP VỤ ĐÃ ĐÁNH HƠI THẤY BẠN!' : 'BỊ BẮT!', 1800);
  S.caught++; S.stats.caughtTotal++;
  const round = S.f;
  setTimeout(() => ui.fade(() => {
    if (S.ended || S.f !== round) return; // (or the act started over meanwhile)
    const tm = ST.teamMap(), post = tm.post(), a = ((G.net.id || 0) % 6) / 6 * Math.PI * 2;
    P.chain = null; // (kiln) the chain would drag them back into the prison
    G.placePlayer(post.x + Math.sin(a) * 0.62, post.z + Math.cos(a) * 0.62, a + Math.PI);
    S.tied = true; S.busy = false; P.frozen = true; P.pose = 'tied'; G.resetStance(); G.forgetLocal(); G.searchSus = 0;
    G.net.say('tied'); ui.toast('Bạn bị trói ở ' + tm.postName + '. Chờ đồng đội tới cởi trói.', 4200);
  }), 1300);
};
ST.freeMate = function () {
  const m = ST.tiedNear(); if (!m) return;
  G.net.send({ t: 'free', id: m.id }); m.td = false; S.f.frees++; G.sfx('pickup');
  if (G.net.isHost()) G.missionTimerAdd(15);
  const tm = ST.teamMap();
  ui.toast((tm.freeWord ? 'Đã ' + tm.freeWord + ' ' + m.name : 'Đã cởi trói cho ' + m.name) + '. Chạy đi!', 2600);
};
G.onNetFree = function (m) {
  if (!S.teamPlay || S.ended) return;
  S.f.frees++; if (G.net.isHost()) G.missionTimerAdd(15); // a rescue buys the team a little time
  const tm = ST.teamMap(), verb = ' đã ' + (tm.freeDone || 'cởi trói cho') + ' ', tail = tm.freeTail || '';
  if (m.id === G.net.id) { if (!S.tied) return; S.tied = false; P.frozen = false; P.pose = null; G.resetStance(); G.sfx('pickup'); ui.toast(m.name + verb + 'bạn' + tail + '! Chạy đi!', 3000); return; }
  const p = G.net.peers.get(m.id); if (p) p.td = false;
  ui.toast(m.name + verb + (p ? p.name : 'đồng đội') + tail, 2600);
};
G.onNetStart = (m) => ST.startMP(m);
G.onNetEnd = (r) => { if (S.teamPlay && !S.ended) ST.teamEnd(r, true); };
ST.teamEnd = function (r, fromNet) {
  if (!S.teamPlay || S.ended) return;
  const map = ST.teamBase();
  if (!fromNet && G.net.isHost() && map.retry && (r === 'caught' || r === 'time')) { map.retry(r); return; } // (Myanmar: that act again, not the end)
  if (!fromNet && G.net.isHost()) G.net.send({ t: 'end', r });
  const failed = G.mtimer.obj ? G.mtimer.obj.t : '';
  S.paused = false; $('pause').hidden = true; $('settings').hidden = true; // e.g. a teammate left while the room was paused
  if (ST.teamSceneStop) ST.teamSceneStop();
  S.ended = true; S.stealthPhase = false; S.clockRun = false; S.hold = null; G.stealth = false; P.frozen = true; G.lightsOut = false; G.unlockPointer();
  const good = r === 'win';
  if (map.onEnd) map.onEnd(r);
  const home = good && !!map.home;
  if (good) { if (!home) G.sfx('siren'); }
  else if (r !== 'alone' && r !== 'lost') { G.sfx('alert'); G.sfx('caught'); setTimeout(() => G.sfx('beating'), 300); ui.flash(); G.shake(0.3); }
  ui.toast({ win: home ? 'CẢ ĐỘI ĐÃ VỀ NHÀ!' : 'CẢ ĐỘI ĐÃ THOÁT!', time: 'HẾT GIỜ!', caught: 'CẢ ĐỘI ĐÃ BỊ BẮT!', alone: 'ĐỒNG ĐỘI ĐÃ RỜI PHÒNG', lost: 'MẤT KẾT NỐI' }[r] || '', 2400);
  setTimeout(() => ST.teamEndScreen(r, failed), good ? 1600 : 2200);
};
ST.teamEndScreen = function (r, failed) {
  S.phase = 'ending'; S.endMood = r === 'win' ? 'hope' : 'horror'; ui.hud(false);
  const lost = r === 'lost', tm = ST.teamMap(), base = ST.teamBase();
  ui.black(false);
  const T = {
    win: [base.home ? 'Cả đội đã về nhà!' : 'Cả đội đã thoát!', 'good', base.win],
    time: tm.timeText ? ['Hết giờ · Tàu đã rời bến', 'bad', tm.timeText + ' Về phòng chờ để chơi lại.'] : ['Hết giờ · Cả đội đã chết', 'bad', 'Nhiệm vụ “' + failed + '” không xong kịp. Bọn gác phát hiện kế hoạch, không ai trong đội qua khỏi đêm đó. Về phòng chờ để cả đội chơi lại từ nhiệm vụ số 1.'],
    caught: ['Cả đội bị bắt', 'bad', (tm.caughtText || (typeof tm.caught === 'string' ? tm.caught : '')) + ' Về phòng chờ để chơi lại từ nhiệm vụ số 1.'],
    alone: ['Đồng đội đã rời phòng', 'bad', 'Chế độ đồng đội cần ít nhất 2 người. Về phòng chờ đợi người mới vào, hoặc rời phòng.'],
    lost: ['Mất kết nối', 'bad', 'Mất kết nối tới máy chủ game. Kiểm tra máy chủ và link ngrok còn chạy không.'],
  }[r] || ['Kết thúc', 'bad', ''];
  if ((r === 'alone' || r === 'lost') && base.savedText) T[2] += base.savedText();
  $('end-eyebrow').textContent = 'Chơi nhiều người · ' + (G.net.roomName || G.net.room) + ' · ' + base.name;
  const h = $('end-title'); h.textContent = T[0]; h.className = T[1]; $('end-story').textContent = T[2];
  const led = $('end-ledger'); led.innerHTML = '';
  const main = G.OBJ.filter((o) => !o.opt), total = base.journey || main.length;
  const done = r === 'win' ? total : Math.min(total, (S.teamDone || 0) + main.filter((o) => o.done()).length);
  [['Bản đồ', base.name], ['Tùy chọn', ST.optsText(S.teamOpts || {})], ['Đồng đội', [G.net.name].concat(peers().map((p) => p.name)).join(', ')], ['Nhiệm vụ hoàn thành', done + ' / ' + total], [base.home ? 'Lần cứu đồng đội' : 'Lần cởi trói cho nhau', S.f.frees || 0], [base.home ? 'Số lần bạn bị bắt hoặc gục' : 'Số lần bạn bị bắt', S.caught]].concat(base.ledger ? base.ledger() : [])
    .forEach(([a, b]) => { const x = document.createElement('div'), y = document.createElement('div'); x.textContent = a; y.textContent = b; led.append(x, y); });
  $('end-choices').hidden = true; $('end-signs').hidden = r !== 'win';
  const again = $('btn-again'), alt = $('btn-end-alt');
  again.hidden = false; again.textContent = lost ? 'Về màn hình chính' : 'Về phòng chờ';
  again.onclick = lost ? () => G.leavePage(location.pathname) : ST.backToRoom;
  alt.hidden = lost; alt.textContent = 'Rời phòng'; alt.onclick = () => { G.net.leave(); G.leavePage(location.pathname); };
  $('ending').hidden = false; if (r === 'win') G.sfx('win');
};
ST.backToRoom = function () {
  $('ending').hidden = true; $('btn-end-alt').hidden = true;
  ST.reset(); S.phase = 'title'; S.paused = false; P.frozen = false; P.pose = null; ui.hud(false); ui.black(false);
  G.loadLevel('sihanouk'); G.setGuardsMode('night'); G.setTime(19.9); G.setRain(0.4); G.titleOrbit = { r: 135, h: 58, cx: 0, cz: 0 };
  G.net.resetPeers(); G.showRoom();
};

// ===================== boot: title screen shows the compound at dusk =====================
G.loadLevel('sihanouk'); G.setGuardsMode('night'); G.setTime(19.9); G.setRain(0.4);
const ck = G.loadCheckpoint();
const cont = $('btn-continue');
if (ck && ck.ch >= 2 && ck.ch <= 13 && cont) { cont.hidden = false; cont.textContent = 'Chơi tiếp: ' + ({ 2: 'Chương 2', 3: 'Chương 3', 4: 'Chương 4', 5: 'Về nước', 11: 'Đường tối 1', 12: 'Đường tối 2', 13: 'Đường tối 3' }[ck.ch] || 'Chương ' + ck.ch); cont.onclick = () => { G.audioInit(); $('title').hidden = true; if (ck.stats) S.stats = ck.stats; if (ck.debt) S.debt = ck.debt; if (ck.ch >= 11) S.dark = true; ({ 2: ST.startCh2, 3: ST.startCh3, 4: ST.startCh4, 5: ST.flightHome, 11: ST.startDark1, 12: ST.startDark2, 13: ST.startDark3 }[ck.ch] || ST.startCh2)(); }; }
$('btn-start').onclick = () => ST.start();
G.openLobbyFromUrl();
})(window.G);
