// dark.js — "Đường tối": optional branch after the three Cambodia maps. Nam stays and works for the ring.
// Three new runs chasing sales → promotion to guard → an in-game top-up offer to buy the manager seat.
// Every ending of this branch closes on the joint police raid, with Nam on the wrong side of it.
(function (G) {
'use strict';
const P = G.player, ui = G.ui, S = G.state, ST = G.story;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const { run, wait, say, card, fx } = ST;
const $ = (id) => document.getElementById(id);
const TARGET = 25000, MANAGER_PRICE = 15000;

ST.startDark = function () {
  S.dark = true; S.stats.sales = 0; S.stats.wallet = 0; S.stats.scammed = 0; S.stats.warned = 0; S.f.darkLoan = 0;
  ui.card([{ t: 'Đường tối', c: 'big' }, { t: 'Nếu ngày ấy, trong phòng tối ở Sihanoukville, Nam gật đầu ở lại làm cho bọn chúng...' },
    { t: 'Nhánh “nếu như”. Mục tiêu: doanh số ' + G.money(TARGET) + ' sau 3 bản đồ để được lên lính canh. Hoa hồng 30% vào ví.', c: 'place' }], () => ST.startDark1());
};
// one work run: load a map, walk to the workstation, run two cases, report
function darkRun(ck, level, label, time, spawn, seat, ids, bossLook, bossPos, next) {
  ST.reset(); S.dark = true; S.chapter = ck; S.phase = 'dark'; G.saveCheckpoint(ck); ui.black(false);
  G.loadLevel(level); G.setTime(time); G.setGuardsMode(time > 19 || time < 5 ? 'night' : 'day'); ui.hud(true); S.phaseLabel = label; S.mood = 'night';
  G.titleOrbit = { r: 85, h: 34, cx: 0, cz: 0 };
  const boss = G.addNpc('dboss', bossLook, { x: bossPos[0], z: bossPos[1], yaw: bossPos[2], pose: 'talk' });
  G.placePlayer(spawn[0], spawn[1], spawn[2]);
  // daytime walks inside the compound (19–26m to the desk, 17–18m to the boss), no guards hunting you
  G.OBJ = [{ t: 'Vào chỗ làm việc', at: () => seat, done: () => S.f.worked, hideNear: 2, time: 45, lv: 1 }, { t: 'Báo cáo doanh số với quản lý', at: () => boss.pos, done: () => S.f.reported, time: 40, lv: 1 }];
  G.INTER = [
    { at: () => seat, r: 2.0, when: () => !S.f.worked, label: 'Ngồi vào máy', run: () => {
      S.busy = true; P.frozen = true; P.pose = 'type'; P.pos.set(seat.x, 0, seat.z - 0.2); P.yaw = seat.yaw; G.cam.yaw = seat.yaw + Math.PI + 0.35; G.cam.pitch = 0.28;
      ST.workShift(ids, 'Quản lý', () => { S.f.worked = true; S.busy = false; P.frozen = false; P.pose = null; ui.toast('Doanh số: ' + G.money(S.stats.sales) + ' / ' + G.money(TARGET) + ' · Ví: ' + G.money(S.stats.wallet), 4200); });
    } },
    { at: () => boss.pos, r: 2.2, when: () => S.f.worked && !S.f.reported, label: 'Báo cáo', run: () => {
      S.f.reported = true; const ok = S.stats.sales >= TARGET * (ck - 10) / 3;
      ui.say([['Quản lý', ok ? 'Khá lắm. Cứ đà này mày sẽ được mặc áo cam.' : 'Doanh số thế này mà đòi lên chức? Làm gấp đôi đi.'], ['', 'Doanh số hiện tại: ' + G.money(S.stats.sales) + '. Mục tiêu sau 3 bản đồ: ' + G.money(TARGET) + '.']], () => ui.fade(next));
    } },
  ];
  ST.tick = () => {};
  ST.respawn = () => ({ x: spawn[0], z: spawn[1], yaw: spawn[2] });
  if (G.desk17Marker) G.desk17Marker.visible = level === 'sihanouk';
}
ST.startDark1 = () => darkRun(11, 'sihanouk', 'Đường tối · 1/3', 14, [-5.5, -11, Math.PI], Object.assign({ yaw: Math.PI }, L().seat17 || { x: -0.4, z: -28.25 }),
  ['police', 'invest'], { shirt: 0x5a1a1f, pants: 0x18181b, skin: 0xb58a62, glasses: true }, [-5, -44, 0], ST.startDark2);
ST.startDark2 = () => { darkRun(12, 'jungle', 'Đường tối · 2/3', 10, [0, 8, Math.PI], { x: 0, z: -6.25, yaw: Math.PI }, ['romance', 'relative'], { shirt: 0x2a2a1a, pants: 0x1a1a14, skin: 0x9a6a48, bald: true, tattoo: true, sleeveless: true }, [4, -9, -Math.PI / 2], ST.startDark3); };
ST.startDark3 = () => { darkRun(13, 'sihanouk', 'Đường tối · 3/3 · ca đêm', 22, [-5.5, -11, Math.PI], { x: -0.4, z: -28.25, yaw: Math.PI }, ['shipper', 'utility'], { shirt: 0x5a1a1f, pants: 0x18181b, skin: 0xb58a62, glasses: true }, [-5, -44, 0], ST.darkVerdict); };

ST.darkVerdict = function () {
  if (S.stats.sales < TARGET) { ST.darkEnding('low'); return; }
  ST.reset(); S.dark = true; S.chapter = 14; S.phase = 'darkguard'; ui.black(false);
  G.loadLevel('sihanouk'); G.setTime(21.5); G.setRain(0.6); G.setGuardsMode('day'); ui.hud(true); S.phaseLabel = 'Lính canh · ca đêm';
  const boss = G.addNpc('dboss', { shirt: 0x2a1a1a, pants: 0x111111, skin: 0xb58a62, glasses: true, bald: true }, { x: -2, z: 6, yaw: Math.PI, pose: 'talk' });
  P.h.torso.material.color.copy(G.C(0xd9692a));
  G.placePlayer(-2, 9, Math.PI);
  const cps = [{ x: 60, z: -20 }, { x: 60, z: 22 }, { x: -60, z: 32 }, { x: -48, z: -46 }]; S.f.cp = 0;
  run([
    say([['Trùm', 'Doanh số ' + G.money(S.stats.sales) + '. Từ hôm nay mày mặc áo cam.'], ['Trùm', 'Đi tuần bốn góc. Đứa nào trèo tường thì báo động. Mỗi đứa bắt lại được thưởng 5.000 đô.'], ['Nam (nghĩ)', 'Mấy tháng trước, mình cũng từng bò qua chính bãi sân này...']]),
  ], () => {
    // patrol loop measured at 328m (~100s walking, ~55s running) + 4 check-ins; then 141m across the compound to the east wall
    G.OBJ = [{ t: () => 'Đi tuần, điểm danh 4 chốt (' + S.f.cp + '/4)', at: () => cps[Math.min(S.f.cp, 3)], done: () => S.f.cp >= 4, time: 150, lv: 2 }, { t: 'Kiểm tra tiếng động ở tường phía đông', at: () => ({ x: 64, z: 1 }), done: () => S.f.runnerDone, time: 60, lv: 2 }];
    G.OBJ.forEach((o) => { if (typeof o.t === 'function') { const f = o.t; Object.defineProperty(o, 't', { get: f }); } });
    G.INTER = [{ at: () => cps[Math.min(S.f.cp, 3)], r: 2, when: () => S.f.cp < 4, label: 'Điểm danh chốt', hold: 1, run: () => { S.f.cp++; G.sfx('beep'); if (S.f.cp >= 4) { const r = G.addNpc('runner', { shirt: 0x8a6a8a, pants: 0x2a2a30, skin: 0xd6a985, longHair: true }, { x: 66.5, z: 1, yaw: Math.PI / 2, pose: 'raise' }); ui.toast('Có tiếng động ở lưới B40 phía đông!', 3000); } } }];
    ST.tick = () => { if (S.f.cp >= 4 && !S.f.runnerDone && !S.busy && G.near({ x: 64, z: 1 }, 5)) { S.f.runnerDone = true; ST.darkRunner(); } };
  });
};
ST.darkRunner = function () {
  const r = npc('runner'); r.pose = 'stand'; r.yaw = -Math.PI / 2; P.frozen = true;
  G.cine([P.pos.x - 2.5, 2.0, P.pos.z + 3], [66, 1.2, 1], false, 1.2);
  run([say([['Cô gái', 'Anh ơi... anh là người Việt phải không? Em xin anh... em mới bị bán sang đây ba ngày.'], ['Cô gái', 'Em chỉ cần cắt xong lưới này thôi...']])], () => ui.choose('Nam', 'Bộ đàm bên hông. Chỉ cần bấm nút là có 5.000 đô.', [
    { label: 'Bấm bộ đàm báo động', sub: '+5.000$ vào ví. Cô gái bị lôi đi.', fn: () => { S.f.alerted = true; S.stats.wallet += 5000; G.sfx('alert'); G.sfx('bark'); r.pose = 'hands_up'; ui.say([['', 'Đèn pha bật sáng. Hai tên áo cam và một con chó lao tới. Cô gái không kêu thêm tiếng nào.']], ST.darkOffer); } },
    { label: 'Quay đi, coi như không thấy', sub: 'Không thưởng. Nếu bị phát hiện, mày cũng xong.', fn: () => { S.f.letGo = true; G.npcGo(r, [[72, 1], [80, 1]], { hide: true }); ui.say([['', 'Nam quay mặt về phía sân. Sau lưng, tiếng lưới thép rách khẽ khàng.'], ['Nam (nghĩ)', 'Chạy đi. Đừng tin tài xế tuk-tuk nào cả.']], ST.darkOffer); } },
  ]));
};
// in-game top-up offer: buy the manager seat with commission money (or a predatory loan)
ST.darkOffer = function () {
  G.cineOff();
  const w = S.stats.wallet;
  ui.say([['Trùm', 'Muốn ngồi ghế quản lý thì phải có “thành ý”. Nạp ' + G.money(MANAGER_PRICE) + ' vào quỹ của tao.'], ['', 'Ví hoa hồng của bạn: ' + G.money(w) + ' (tiền trong game).']], () => ui.choose('Nạp tiền mua chức quản lý', 'Tiền trong game, không dùng tiền thật. Chọn cách nạp:', [
    { label: 'Nạp ' + G.money(MANAGER_PRICE) + ' từ ví hoa hồng', sub: w >= MANAGER_PRICE ? 'Còn lại ' + G.money(w - MANAGER_PRICE) + '.' : 'Không đủ tiền trong ví.', fn: () => { if (w >= MANAGER_PRICE) { S.stats.wallet -= MANAGER_PRICE; ST.darkManager(false); } else ui.say([['Trùm', 'Ví mày có ' + G.money(w) + '. Đừng làm tao mất thời gian.']], ST.darkOffer); } },
    { label: 'Vay nóng của Trùm để nạp', sub: 'Nợ ' + G.money(MANAGER_PRICE * 2) + ', lãi nhân đôi mỗi tháng.', fn: () => { S.f.darkLoan = MANAGER_PRICE * 2; ST.darkManager(true); } },
    { label: 'Không nạp, ở lại làm lính canh', sub: '', fn: () => ST.darkEnding('guard') },
  ]));
};
ST.darkManager = function (loan) {
  G.sfx('pickup');
  ui.say([['Trùm', 'Tốt. Từ mai mày quản lý tổ 3. Đứa nào thiếu chỉ tiêu thì mày biết phải làm gì rồi đấy.'], ['', loan ? 'Tờ giấy nợ ký bằng tay trái run run. Con số trên đó lớn hơn số nợ chuộc thân ngày đầu.' : 'Số tiền lừa được từ những ông bà già ở quê, giờ chảy ngược vào túi trùm.']], () => ST.darkEnding('manager'));
};
ST.darkEnding = function (kind) {
  S.ended = true; S.phase = 'ending'; ui.hud(false); G.unlockPointer(); S.endMood = 'horror'; G.saveCheckpoint(1);
  const st = S.stats, L2 = (a, b) => `<div>${a}</div><div>${b}</div>`;
  let title, story;
  if (kind === 'low') {
    title = 'Doanh số thấp'; S.endMood = 'hope';
    story = 'Nam không đạt doanh số. Bọn chúng đánh, bỏ đói, ép làm gấp đôi. Ba tháng sau, chiến dịch phối hợp giữa lực lượng chức năng Việt Nam và Campuchia ập vào, và Nam được giải cứu như một nạn nhân. Những lần cố tình làm hỏng kịch bản đã giữ lại tiền cho ' + st.warned + ' gia đình.';
  } else if (kind === 'guard') {
    title = 'Từ nạn nhân thành đồng phạm';
    story = 'Nam mặc áo cam thêm ba tháng. Khi chiến dịch phối hợp ập vào, Nam bị bắt cùng đường dây, bị điều tra với vai trò đồng phạm. ' + (S.f.letGo ? 'Cô gái Nam để chạy thoát đêm ấy đã ra làm chứng, giúp cơ quan điều tra xem xét tình tiết giảm nhẹ.' : 'Cô gái bị bắt lại đêm ấy là một trong những người làm chứng chống lại Nam.');
  } else {
    title = 'Quản lý lừa đảo';
    story = 'Nam ngồi ghế quản lý, đứng sau lưng những người như mình ngày đầu, cầm dùi cui điện. Khi chiến dịch phối hợp ập vào, Nam bị bắt với vai trò tổ chức, đối mặt mức xử lý nặng nhất trong nhóm. ' + (S.f.darkLoan ? 'Khoản vay nóng của Trùm vẫn còn nguyên trên giấy.' : 'Toàn bộ tiền hoa hồng bị thu giữ.');
  }
  $('end-eyebrow').textContent = 'Đường tối · Kết thúc'; const h = $('end-title'); h.textContent = title; h.className = kind === 'low' ? 'good' : 'bad';
  $('end-story').textContent = story + ' Nhánh này là “nếu như”. Ngoài đời, người bị ép buộc vẫn có thể bị xử lý hình sự nếu sau đó tự nguyện tham gia lừa đảo, canh giữ hay đánh đập người khác.';
  $('end-ledger').innerHTML = L2('Doanh số lừa đảo', G.money(st.sales)) + L2('Ví hoa hồng còn lại', G.money(st.wallet)) + L2('Người bị lừa qua tay Nam', st.scammed + ' / 6') + L2('Người được Nam cảnh báo', st.warned + ' / 6') + (kind !== 'low' ? L2('Cô gái ở tường phía đông', S.f.letGo ? 'Đã chạy thoát' : 'Bị bắt lại') : '');
  $('end-signs').hidden = false; $('end-choices').hidden = true; $('btn-again').hidden = false; $('btn-again').textContent = 'Chơi lại từ đầu'; $('btn-again').onclick = () => G.leavePage();
  $('ending').hidden = false;
};
})(window.G);
