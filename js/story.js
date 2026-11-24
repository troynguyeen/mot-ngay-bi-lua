// story.js — scam scripts, the intro (home → van → office → holding room) and Chapter 1 (Sihanoukville)
(function (G) {
'use strict';
const P = G.player, ui = G.ui, S = G.state;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const ST = G.story = G.story || {};
// tiny sequencer: run([step(next) ...], done)
const run = ST.run = (steps, done) => { let i = 0; const next = () => { if (i >= steps.length) { if (done) done(); return; } const s = steps[i++]; s(next); }; next(); };
const wait = ST.wait = (ms) => (n) => setTimeout(n, ms);
const say = ST.say = (lines) => (n) => ui.say(lines, n);
const card = ST.card = (lines) => (n) => ui.card(lines, n);
const fx = ST.fx = (f) => (n) => { f(); n(); };
G.ITEM_NAMES = { phone: 'Điện thoại', card: 'Thẻ từ', cutter: 'Kìm cắt', wire: 'Sợi thép', sat: 'Điện thoại vệ tinh', key: 'Chìa khóa xích' };

// ===================== scam scripts (what Nam is forced to run) =====================
G.SCAM_CASES = {
  police: { title: 'Giả danh công an', victim: 'Bác Hòa', victimShort: 'Bác Hòa', sub: '67 tuổi · Thái Bình · gọi video', ava: 'BH', amount: 12000, amountText: '300.000.000đ',
    steps: ['Gọi video, mặc áo giả cảnh phục, đọc đúng tên và số căn cước của nạn nhân.', 'Đe dọa: tài khoản dính đường dây rửa tiền, sắp bị bắt.', 'Bắt chuyển tiền vào “tài khoản tạm giữ” để xác minh.', 'Cấm nói với con cháu. Chuyển xong thì chặn số.'],
    rounds: [
      { v: ['Alo, ai đấy? Sao các anh mặc áo công an gọi video cho tôi?'], a: 'Tôi là cán bộ điều tra. Tài khoản của bác liên quan một đường dây rửa tiền, bác phải hợp tác.', b: 'Bác ơi, công an không làm việc qua điện thoại hay gọi video. Bác cúp máy đi ạ.' },
      { v: ['Trời ơi, tôi có làm gì đâu! Giờ phải làm sao?', 'Ơ thế cậu là ai? Sao lại bảo tôi cúp máy?'], a: 'Bác chuyển toàn bộ tiền tiết kiệm vào tài khoản tạm giữ để xác minh, xong sẽ hoàn lại.', b: 'Không có cái gọi là “tài khoản tạm giữ”. Ai bắt chuyển tiền qua điện thoại là lừa đảo.' },
      { v: ['Tôi có 300 triệu gửi ngân hàng, giờ ra rút luôn nhé?', 'Cảm ơn cậu, tôi sẽ ra đồn công an phường hỏi.'], a: 'Đúng rồi bác, và tuyệt đối không được nói với ai, kể cả con cháu.', b: 'Bác báo con cháu và công an phường ngay. Đừng tin cuộc gọi nào bắt giữ bí mật.' }],
    okText: 'Bác Hòa cúp máy, gọi con trai rồi lên đồn công an phường. Quản lý ghi tên bạn vào sổ.', badText: 'Bác Hòa rút hết 300 triệu tiền dưỡng già chuyển vào “tài khoản tạm giữ”. Tiền đi qua 6 tài khoản trung gian rồi biến mất.' },
  relative: { title: 'Giả danh người thân', victim: 'Cô Thu', victimShort: 'Cô Thu', sub: '52 tuổi · Nghệ An · tài khoản của con trai bị chiếm', ava: 'CT', amount: 2000, amountText: '50.000.000đ',
    steps: ['Dùng tài khoản mạng xã hội bị chiếm của người thân nạn nhân.', 'Báo tin gấp: tai nạn, đang cấp cứu, cần tiền ngay.', 'Đưa số tài khoản “của bạn” hoặc “của bệnh viện”.', 'Không cho gọi kiểm tra: “máy vỡ rồi”, “đang trong phòng mổ”.'],
    rounds: [
      { v: ['Con ơi, sao con nhắn hoảng thế? Con đang ở đâu?'], a: 'Mẹ ơi con bị tai nạn xe, đang cấp cứu, cần 50 triệu đóng viện phí gấp.', b: 'Cô ơi, cô gọi điện thẳng cho con trai cô trước đã. Tài khoản này có thể đang bị người khác dùng.' },
      { v: ['Trời ơi! Để mẹ gọi cho con nhé?', 'Ơ, sao lại bảo cô gọi? Cháu là ai?'], a: 'Máy con vỡ rồi mẹ. Mẹ chuyển vào số tài khoản bạn con giúp con.', b: 'Cháu không phải con cô. Có người đang giả làm con cô để lấy tiền.' },
      { v: ['Mẹ chạy ra ngân hàng đây, con cố lên!', 'Cô vừa gọi được cho thằng Tùng, nó đang đi làm bình thường!'], a: 'Mẹ nhanh lên, bác sĩ đang chờ.', b: 'May quá cô ạ. Cô báo họ hàng cảnh giác và bảo anh ấy đổi mật khẩu ngay.' }],
    okText: 'Cô Thu gọi được cho con trai thật. Anh ấy vẫn bình an. Cô đăng cảnh báo cho cả họ.', badText: 'Cô Thu vay hàng xóm 50 triệu chuyển ngay. Tối đó con trai gọi về, hoàn toàn không biết chuyện gì.' },
  invest: { title: 'Đầu tư chứng khoán, bất động sản', victim: 'Anh Khoa', victimShort: 'Anh Khoa', sub: '35 tuổi · kỹ sư · nhóm Zalo “chuyên gia”', ava: 'AK', amount: 20000, amountText: '500.000.000đ',
    steps: ['Mời vào nhóm “chuyên gia”, toàn tài khoản ảo khoe lãi.', 'Cho nạp ít, trả lãi thật để tạo lòng tin.', 'Dụ nạp lớn vào “dự án đất nền” hoặc “mã cổ phiếu nội bộ”.', 'Khi đòi rút thì bắt đóng “thuế, phí”, rồi khóa tài khoản.'],
    rounds: [
      { v: ['Em thấy nhóm bên anh khoe lãi 20% một tuần, có thật không anh?'], a: 'Thật em. Em nạp thử 10 triệu, anh chỉ mua mã nội bộ, cuối tuần rút được luôn.', b: 'Không có khoản đầu tư nào lãi 20% một tuần đâu em. Đó là dấu hiệu lừa đảo.' },
      { v: ['Em rút được 12 triệu thật rồi! Giờ em muốn vào gói dự án đất nền.', 'Anh nói thật hả? Vậy mấy người khoe lãi trong nhóm là ai?'], a: 'Gói dự án tối thiểu 500 triệu, lãi gấp đôi sau 3 tháng. Hôm nay hết suất.', b: 'Mấy người khoe lãi đều là tài khoản ảo. Em đừng nạp thêm đồng nào.' },
      { v: ['Em bán xe, vay thêm ngân hàng để nạp đủ. Rút ra có mất phí gì không anh?', 'Em sẽ rời nhóm. Có cần báo ai không anh?'], a: 'Rút thì đóng 15% thuế trước nhé em, đúng quy trình.', b: 'Em chụp lại toàn bộ tin nhắn, báo công an và ngân hàng của em.' }],
    okText: 'Anh Khoa rời nhóm, gửi bằng chứng cho công an. Nhóm Zalo bị báo cáo và đóng lại.', badText: 'Anh Khoa nạp 500 triệu rồi bị đòi thêm “thuế” mới được rút. Tài khoản bị khóa. Khoản vay ngân hàng kéo dài 5 năm.' },
  romance: { title: 'Lừa tình, lừa tiền', victim: 'Chị Mai', victimShort: 'Chị Mai', sub: '41 tuổi · Hải Phòng · quen qua mạng 2 tháng', ava: 'CM', amount: 4400, amountText: '110.000.000đ',
    steps: ['Dựng hồ sơ ảo: kỹ sư nước ngoài, ảnh đẹp, nhắn lời ngọt ngào mỗi ngày.', 'Hứa về Việt Nam cưới, gửi “quà” qua đường bưu điện.', 'Giả hải quan đòi “phí thông quan” cho thùng quà.', 'Mỗi lần đóng lại phát sinh phí mới.'],
    rounds: [
      { v: ['Anh ơi, hải quan gọi bảo thùng quà của anh bị giữ, phải đóng phí 30 triệu.'], a: 'Em đóng giúp anh nhé, trong đó có vàng và tiền mặt anh gửi cho em.', b: 'Chị ơi, hải quan không thu phí qua tài khoản cá nhân. Không có thùng quà nào cả.' },
      { v: ['Em đóng rồi. Giờ họ bảo đóng thêm “phí chống rửa tiền” 80 triệu.', 'Anh nói vậy là sao? Hai tháng nay anh là ai?'], a: 'Sắp xong rồi em, đóng nốt là quà về tay em.', b: 'Người chị đang nói chuyện không có thật. Hồ sơ dùng ảnh lấy cắp của người khác.' },
      { v: ['Em cầm sổ đỏ đi vay rồi. Anh thương em thật không?', 'Trời ơi... chị phải làm gì bây giờ?'], a: 'Anh thương em nhất. Em chuyển đi rồi tuần sau mình gặp nhau.', b: 'Chị báo công an, giữ lại toàn bộ tin nhắn và số tài khoản đã chuyển.' }],
    okText: 'Chị Mai dừng chuyển tiền và báo công an. Chị nói mình thấy nhục, nhưng còn hơn mất cả căn nhà.', badText: 'Chị Mai cầm sổ đỏ vay nóng 80 triệu chuyển tiếp. Không có thùng quà nào. “Người yêu” biến mất sau một đêm.' },
  shipper: { title: 'Giả danh shipper', victim: 'Bạn Linh', victimShort: 'Linh', sub: '24 tuổi · TP.HCM · đang chờ đơn hàng', ava: 'BL', amount: 1100, amountText: '27.000.000đ',
    steps: ['Gọi báo có đơn hàng giao tới, người đang chờ hàng dễ tin.', 'Báo đơn lỗi, cần “xác nhận” qua đường link.', 'Link giả giống trang ngân hàng hoặc ví điện tử để lấy mật khẩu.', 'Hỏi mã OTP gửi về điện thoại, rút sạch tài khoản.'],
    rounds: [
      { v: ['Alo, em là người nhận nè. Đơn của em tới chưa anh?'], a: 'Đơn em bị lỗi thanh toán, em bấm link anh gửi để xác nhận lại nhé.', b: 'Bạn đừng bấm đường link nào người lạ gửi, kể cả shipper.' },
      { v: ['Em bấm rồi, nó bắt đăng nhập ngân hàng.', 'Ủa, anh là shipper mà sao bảo em đừng bấm?'], a: 'Đúng rồi em, đăng nhập để hệ thống hoàn tiền.', b: 'Đó là trang giả. Bạn tắt ngay, đừng nhập mật khẩu.' },
      { v: ['Có mã OTP gửi về máy em, anh cần không?', 'Em gọi tổng đài ngân hàng đây. Cảm ơn anh.'], a: 'Em đọc mã cho anh để hoàn tất nhé.', b: 'Không ai được biết mã OTP của bạn. Gọi ngân hàng khóa tài khoản và đổi mật khẩu.' }],
    okText: 'Linh gọi tổng đài ngân hàng, khóa tài khoản kịp lúc. Không mất đồng nào.', badText: 'Tài khoản của Linh bị rút sạch 27 triệu tiền lương trong vòng 2 phút.' },
  utility: { title: 'Tiền điện, tiền nước', victim: 'Ông Phúc', victimShort: 'Ông Phúc', sub: '63 tuổi · Đà Nẵng · sống một mình', ava: 'OP', amount: 3600, amountText: '90.000.000đ',
    steps: ['Giả nhân viên điện lực: báo nợ tiền điện, sẽ cắt điện trong 2 giờ.', 'Gửi link cài “ứng dụng điện lực” giả.', 'Ứng dụng giả chiếm quyền điều khiển điện thoại.', 'Rút tiền trong tài khoản ngân hàng khi nạn nhân ngủ.'],
    rounds: [
      { v: ['Tôi tháng nào cũng đóng đủ mà, sao lại nợ?'], a: 'Hệ thống ghi ông nợ 3 tháng. Ông cài ứng dụng theo link để kiểm tra, không thì 2 tiếng nữa cắt điện.', b: 'Ông ơi, điện lực không gọi bắt cài ứng dụng qua link. Ông gọi tổng đài chính thức để hỏi.' },
      { v: ['Tôi cài xong rồi, nó đòi cấp quyền gì đó.', 'Thế cậu là ai mà nói thế?'], a: 'Ông bấm “cho phép” hết, để máy yên, đừng tắt.', b: 'Ông gỡ ứng dụng đó ngay và tắt mạng. Đó là phần mềm chiếm quyền điện thoại.' },
      { v: ['Màn hình nó tự chạy kìa cậu ơi!', 'Cảm ơn cậu, tôi nhờ cháu sang xem giúp.'], a: 'Bình thường ông ạ, hệ thống đang cập nhật.', b: 'Ông nhờ người thân mang máy ra cửa hàng và báo ngân hàng khóa tài khoản ngay.' }],
    okText: 'Cháu ông Phúc gỡ ứng dụng và khóa tài khoản kịp. Ông dặn cả xóm cảnh giác.', badText: 'Đêm đó tài khoản ông Phúc bị rút 90 triệu, toàn bộ tiền ông để dành lúc ốm đau.' },
};
G.SCAM_LIBRARY = Object.values(G.SCAM_CASES).map((c) => c.title);
// run several cases in a row at a workstation; done(warnedCount)
ST.workShift = function (ids, boss, done) {
  let i = 0, warned = 0;
  const next = () => {
    if (i >= ids.length) { done(warned); return; }
    const id = ids[i++];
    const intro = i === 1 ? null : [[boss, ['Ca tiếp theo. Làm cho tử tế vào.', 'Nhanh tay lên, khách đang chờ.', 'Ca cuối. Tao đứng sau lưng mày đấy.'][Math.min(i - 1, 2)]]];
    const go = () => ui.scam(G.SCAM_CASES[id], (ok) => { if (ok) warned++; next(); });
    if (intro) ui.say(intro, go); else go();
  };
  next();
};

// ===================== helpers =====================
ST.reset = function () { S.items = {}; S.f = {}; S.caught = 0; S.stealthPhase = false; S.clockRun = false; S.deadline = 0; S.onDeadline = null; S.mood = null; S.ended = false; S.clockRate = 1; S.teamPlay = false; S.actLabel = ''; P.load = 0; S.tied = false; S.out = false; S.teamStage = null; S.teamLeg = 0; S.teamDone = 0; if (ST.teamSceneStop) ST.teamSceneStop(); G.INTER = []; G.OBJ = []; G.input.crouch = false; G.input.run = false; P.chain = null; P.frozen = false; P.pose = null; P.slowT = 0; P.walkAmt = 0; P.walkSpeed = 0; P.eyeH = 1.55; G.cineOff(); G.cam.drug = 0; ui.blur(0); G.vanMoving = false; G.engineSound(false); G.ring(false); };
ST.chapterCard = (n, name, sub) => card([{ t: 'Chương ' + n, c: 'place' }, { t: name, c: 'big' }].concat(sub ? [{ t: sub }] : []));
ST.retry = () => { const ck = G.loadCheckpoint(); ui.fade(() => { const ch = (ck && ck.ch) || S.chapter || 1; ({ 1: ST.startCh1, 2: ST.startCh2, 3: ST.startCh3, 4: ST.startCh4, 5: ST.flightHome, 11: ST.startDark1, 12: ST.startDark2, 13: ST.startDark3 }[ch] || ST.startCh1)(true); }); };
// generic capture: ch-specific respawn, 3 strikes → retry screen
G.onCaught = function (src) {
  if (S.busy || S.ended || !S.stealthPhase) return;
  if (S.teamPlay) { ST.teamTie(src); return; } // team mode: no strikes, you get tied to the post until a teammate frees you
  S.busy = true; P.frozen = true; G.stealth = false; S.hold = null; P.climb = 0;
  G.sfx('caught'); if (src === 'dog') { G.sfx('bark'); G.sfx('growl'); } G.sfx('arrest'); ui.flash(); G.shake(0.25); // baton, "Áaa!", "Tha em với đại ca!", blows
  setTimeout(() => G.shake(0.2), 600); setTimeout(() => G.shake(0.2), 1100);
  ui.toast(src === 'light' ? 'ĐÈN PHA PHÁT HIỆN BẠN!' : src === 'dog' ? 'CHÓ NGHIỆP VỤ ĐÃ ĐÁNH HƠI THẤY BẠN!' : 'BỊ BẮT!', 1800);
  S.caught++; S.stats.caughtTotal++; S.debt += 3000; if (!S.mp) S.clock += 30;
  if (S.mp && S.caught < S.maxCaught) G.net.say('caught');
  setTimeout(() => {
    if (S.caught >= S.maxCaught) { ST.failScreen('caught'); return; }
    ui.fade(() => {
      P.pos.y = 0; const sp = ST.respawn ? ST.respawn() : L().dormSpawn; G.placePlayer(sp.x, sp.z, sp.yaw || Math.PI);
      if (S.mp) G.forgetLocal(); else G.setGuardsMode('night'); G.searchSus = 0;
      S.busy = false; P.frozen = false; G.resetStance(); G.missionTimerRefill(0.5); // dragged back to the start: at least half the mission time again
      ui.say([['Lính gác', ['Chạy đi đâu? Mày tưởng trốn được à?', 'Lần sau tao bẻ chân mày.', 'Còn một lần nữa là mày biết tay.'][Math.min(S.caught - 1, 2)]], ['', `Bạn bị đánh và lôi về chỗ cũ. Bị bắt ${S.caught}/${S.maxCaught} lần.`]]);
    });
  }, 1300);
};
ST.failScreen = function (kind) {
  S.ended = true; S.busy = true; S.stealthPhase = false; ui.hud(false); G.unlockPointer();
  if (S.mp) { G.net.say('out'); G.net.leave(); }
  const titles = { caught: ['Bị bắt lần thứ ba', 'Bọn chúng đánh Nam bất tỉnh. Khi tỉnh dậy, mọi kế hoạch đã đổ bể.'], dawn: ['Trời đã sáng', 'Tiếng còi điểm danh vang lên. Kế hoạch thất bại.'], chase: ['Không ra kịp bến sông', 'Đám tay chân của đường dây đuổi kịp, quật ngã Nam bên bờ sông và lôi ngược về lò gạch. Chiếc tàu của ông Tư phải rời bến.'] };
  const [t, s] = titles[kind] || titles.caught;
  document.getElementById('end-eyebrow').textContent = 'Chương ' + S.chapter + ' · Thất bại';
  const h = document.getElementById('end-title'); h.textContent = t; h.className = 'bad';
  document.getElementById('end-story').textContent = s + ' Bạn có thể chơi lại chương này từ đầu.';
  document.getElementById('end-ledger').innerHTML = '';
  document.getElementById('end-choices').hidden = true; document.getElementById('end-signs').hidden = true;
  document.getElementById('btn-again').textContent = 'Chơi lại chương ' + S.chapter;
  document.getElementById('btn-again').onclick = () => { document.getElementById('ending').hidden = true; S.ended = false; ST.retry(); };
  setTimeout(() => { document.getElementById('ending').hidden = false; }, 500);
};

// ===================== mission timeout: Nam dies, everything restarts from mission 1 =====================
// [speaker, last line, what happened] per phase. Kept to narration, like the other violent beats in the game.
const DEATH = {
  ch1: ['Lính gác', 'Tao đã bảo đi nhanh lên. Chậm chạp thế này thì giữ mày lại làm gì?', 'Nam chậm trễ ngay ngày đầu ở đặc khu S-7. Bọn lính gác lôi Nam ra làm gương cho cả xưởng. Trận đòn bằng dùi cui điện kéo dài đến khi Nam không còn cử động.'],
  ch1night: ['Lính gác', 'Đứa nào đây? Bắt được rồi!', 'Kế hoạch trốn dừng lại giữa chừng. Bọn gác lôi Nam ra giữa sân trong mưa để làm gương cho cả khu. Nam không qua khỏi đêm đó.'],
  ch2night: ['Trùm Sẹo', 'Tao đã nói rồi. Rừng này rộng lắm.', 'Bọn chúng phát hiện chiếc lồng bị cạy trước khi Nam kịp làm xong. Ở trại rừng ấy, không ai tìm thấy Nam nữa.'],
  ch3night: ['Tên gác', 'Thằng này định làm gì đấy?!', 'Thời cơ trôi qua. Bọn gác ập vào nhà giam trước khi đội đặc nhiệm kịp vào. Nam không bao giờ ra được tới bờ sông.'],
  dark: ['Quản lý', 'Chậm thế này thì doanh số ở đâu ra? Lôi nó ra sau.', 'Ở đường dây này, người không còn giá trị thì bị loại bỏ. Nam cũng vậy.'],
  darkguard: ['Trùm', 'Lính canh gì mà chậm thế? Mày cũng muốn vào phòng tối à?', 'Trùm không giữ lại một tên lính canh vô dụng. Nam biến mất như những người Nam từng canh giữ.'],
};
G.onMissionTimeout = function (o) {
  if (S.ended || !o) return;
  if (S.teamPlay) { if (G.net.isHost()) ST.teamEnd('time'); return; } // team mode: the host ends the round for everyone
  const [idx, n] = G.missionIndex(o), d = DEATH[S.phase] || DEATH.ch1night;
  S.busy = true; P.frozen = true; S.hold = null; S.stealthPhase = false; G.stealth = false; S.clockRun = false; S.onDeadline = null;
  P.climb = 0; P.pos.y = 0; P.pose = null; G.unlockPointer(); document.getElementById('prompt').hidden = true;
  if (S.mp) G.net.say('dead');
  ui.toast('HẾT GIỜ!', 2200); G.sfx('alert'); G.sfx('caught'); ui.flash(); G.shake(0.2);
  run([
    wait(1100),
    say([[d[0], d[1]]]),
    fx(() => { P.frozen = true; G.sfx('arrest'); ui.flash('#7ab8ff'); G.shake(0.3); P.pose = 'shock'; }), wait(1000),
    fx(() => { ui.flash(); G.shake(0.35); P.pose = 'lie'; }), wait(1700),
    (nx) => { ui.hud(false); ui.black(true); setTimeout(nx, 1300); },
  ], () => ST.deathScreen(o, idx, n, d[2]));
};
ST.deathScreen = function (o, idx, n, story) {
  const $ = (id) => document.getElementById(id);
  const mp = S.mp, room = mp ? G.net.room : '', dark = S.dark;
  S.ended = true; S.busy = true; S.phase = 'ending'; S.endMood = 'horror'; ui.hud(false); G.unlockPointer(); ui.black(false);
  if (mp) G.net.leave();
  // progress is wiped: the next run starts at mission 1 with a fresh ledger
  S.stats = { warned: 0, scammed: 0, sales: 0, wallet: 0, freed: 0, caughtTotal: 0 }; S.debt = 15000;
  if (!mp) G.saveCheckpoint(dark ? 11 : 1);
  $('end-eyebrow').textContent = (dark ? 'Đường tối' : 'Chương ' + S.chapter) + ' · Nhiệm vụ ' + idx + '/' + n + ' · Hết giờ';
  const h = $('end-title'); h.textContent = 'Nam đã chết'; h.className = 'bad';
  $('end-story').textContent = story + (mp ? ' Hết giờ là chết. Vào lại phòng để cả nhóm chơi lại từ nhiệm vụ số 1.' : dark ? ' Hết giờ là chết. Bạn phải chơi lại Đường tối từ nhiệm vụ số 1.' : ' Hết giờ là chết. Bạn phải chơi lại từ nhiệm vụ số 1 của Chương 1.');
  const led = $('end-ledger'); led.innerHTML = '';
  [['Nhiệm vụ chưa xong', o.t], ['Độ khó', G.LV_NAME[o.lv || 2]], ['Thời hạn', G.fmtSec(o.time)]].forEach(([a, b]) => { const x = document.createElement('div'), y = document.createElement('div'); x.textContent = a; y.textContent = b; led.append(x, y); });
  $('end-choices').hidden = true; $('end-signs').hidden = true;
  const btn = $('btn-again'); btn.hidden = false;
  btn.textContent = mp ? 'Vào lại phòng ' + room : 'Chơi lại từ nhiệm vụ 1';
  btn.onclick = () => {
    if (mp) { G.leavePage(location.pathname + '?room=' + encodeURIComponent(room)); return; }
    $('ending').hidden = true; ST.restartFromMission1(dark);
  };
  setTimeout(() => { $('ending').hidden = false; }, 500);
};
ST.restartFromMission1 = function (dark) {
  ui.fade(() => {
    S.ended = false; S.busy = false; S.paused = false; P.h.torso.material.color.setHex(0xc9c2b2);
    S.stats = { warned: 0, scammed: 0, sales: 0, wallet: 0, freed: 0, caughtTotal: 0 }; S.debt = 15000;
    if (dark) { S.dark = true; ST.startDark1(); } else { S.dark = false; ST.startCh1(); }
  });
};

// ===================== INTRO =====================
const HEAD_LOCK = '<div class="lock-time">23:41</div>';
const HEAD_HR = '<div class="ava">H</div><div><b>Chị Hương · Tuyển dụng</b><small>● đang hoạt động</small></div>';
const HEAD_FEED = '<div class="ava" style="background:#1877f2">f</div><div><b>Việc Làm Online · Tuyển Gấp</b><small>214.000 thành viên</small></div>';
ST.start = function () {
  ST.reset(); S.chapter = 0; S.phase = 'cut'; S.stats = { warned: 0, scammed: 0, sales: 0, wallet: 0, freed: 0, caughtTotal: 0 }; S.debt = 15000; S.dark = false;
  document.getElementById('title').hidden = true; G.audioInit();
  G.loadLevel('prologue'); G.setTime(23.7); S.mood = 'home'; ui.hud(false);
  const s = L().homeSeat; P.pos.set(s.x, 0, s.z); P.yaw = s.yaw; P.frozen = true; P.pose = 'phone_sit';
  npc('mom').h.group.visible = npc('dad').h.group.visible = false;
  G.cine([1.5, 1.85, 1.9], [-1.0, 0.85, -0.9], true, 0.6);
  run([
    card([{ t: 'Phòng trọ ngoại thành · 23:41', c: 'place' }, { t: 'Ba tháng trước, Nam bị cắt giảm trong đợt layoff của công ty cũ. Từ đó đến nay, chưa nơi nào gọi lại.' }, { t: 'Tiền nhà trọ nợ hai tháng. Khoản vay của đám cho vay nặng lãi, gốc lẫn lãi đã gần gấp đôi.' }]),
    (n) => { // lock screen notifications
      ui.phoneOpen(HEAD_LOCK);
      [['📧', 'Email · 3 tháng trước', 'Thông báo chấm dứt hợp đồng lao động do tái cơ cấu nhân sự.'], ['🏠', 'Cô Ba chủ trọ', 'Nam ơi, hai tháng tiền nhà rồi đó. Cuối tuần không đóng thì cô cho người khác thuê.'], ['📞', 'Anh Hải (vay)', '9 cuộc gọi nhỡ'], ['💬', 'Anh Hải (vay)', 'Vay 50 củ, giờ gốc lãi 80. Chủ nhật không có thì anh em xuống tận nơi.'], ['💬', 'Số lạ', '[Ảnh] Cổng nhà bố mẹ mày đây. Biết điều thì trả đi.'], ['💬', 'Mẹ', 'Con ngủ chưa? Mai mẹ hỏi chú Hai xem có chỗ nào nhận người không.']]
        .forEach(([ic, a, b], i) => setTimeout(() => { ui.phoneNode('notif', `<span class="ic">${ic}</span><div><b>${a}</b><p>${b}</p></div>`); G.sfx('buzz'); }, 300 + i * 650));
      setTimeout(() => ui.phoneButtons([{ label: 'Mở khóa ▸', primary: true, fn: () => n() }]), 4300);
    },
    (n) => { // creditor calls
      document.querySelector('.phone-top').innerHTML = '<div class="ava" style="background:#7a1a1a">!</div><div><b>Anh Hải (vay)</b><small>đang gọi…</small></div>';
      document.getElementById('chat').innerHTML = '<div class="call"><div class="call-ava">AH</div><b>Anh Hải (vay)</b><span>Cuộc gọi đến</span></div>'; G.ring(true);
      ui.phoneButtons([{ label: 'Từ chối', cls: 'decline', fn: () => { G.ring(false); n('no'); } }, { label: 'Nghe máy', primary: true, fn: () => { G.ring(false); n('yes'); } }]);
    },
    (n) => { ui.phoneClose(); n(); },
    say([['Anh Hải', 'Nam à, anh Hải đây. Năm chục triệu của anh, giờ cả gốc lẫn lãi là tám chục rồi.'], ['Nam', 'Anh cho em khất thêm ít hôm, em đang tìm việc...'], ['Anh Hải', 'Câu đó mày nói ba lần rồi. Chủ nhật không có tiền thì anh em xuống tận nhà bố mẹ mày nói chuyện.']]),
    fx(() => { const m = npc('mom'), d = npc('dad'); m.h.group.visible = d.h.group.visible = true; m.pos.set(3.4, 0, 1.0); d.pos.set(3.9, 0, 0.5); G.npcGo(m, [[1.7, 1.1]], { walk: true }); G.npcGo(d, [[2.4, 0.4]], { walk: true }); G.cine([1.2, 1.7, -1.6], [2.0, 1.3, 0.8], false, 1.2); G.sfx('door2'); }),
    wait(1800),
    say([['Bố', 'Ba tháng rồi đấy. Ngày nào cũng ôm cái điện thoại.'], ['Mẹ', 'Thôi ông... Nam ơi, cô Ba chủ trọ gọi cho mẹ rồi. Mẹ vừa vay chỗ cô Tư để con đóng tiền nhà.'], ['Bố', 'Còn cái đám cho vay kia gọi cả về quê. Mai mà không đi tìm việc thì tự mà lo lấy thân. Bố mẹ không gánh nổi nữa.'], ['Nam', 'Con biết rồi mà...']]),
    fx(() => { G.npcGo(npc('mom'), [[3.6, 1.0]], { walk: true, hide: true }); G.npcGo(npc('dad'), [[3.9, 0.6]], { walk: true, hide: true }); G.cine([1.5, 1.85, 1.9], [-1.0, 0.85, -0.9], false, 1); }),
    wait(1200),
    (n) => { // the job feed
      ui.phoneOpen(HEAD_FEED);
      ui.phoneNode('post', '<b>Quán Bún Cô Ba</b><p>Tuyển phụ bếp, 7 triệu/tháng, làm 6h–14h. Ưu tiên gần chợ.</p><small>2 bình luận</small>');
      ui.phoneNode('post hot', '<b>Nhân Lực Toàn Cầu · Tuyển dụng</b><p class="big">🔥 TUYỂN GẤP 20 NHÂN VIÊN CSKH – VIỆC NHẸ LƯƠNG CAO 🔥</p><ul><li>Lương cứng từ 3.000$ – 5.000$/tháng (hơn 75 triệu đồng) + thưởng doanh số</li><li>Đóng full BHXH, BHYT</li><li>Bao ăn ở, xe đưa đón tận nhà</li><li>Làm tốt được thưởng du lịch nước ngoài cho cả gia đình</li><li>Không cần kinh nghiệm, không cần bằng cấp</li></ul><p>Inbox ngay, chỉ còn 3 suất!</p><div class="cmts"><span>Ngọc Ánh: Em làm 3 tháng mua được xe rồi ạ 😍</span><span>Tuấn Phạm: ib</span><span>Hồng Nhung: Cty uy tín lắm mn ơi</span></div><button type="button" class="btn primary apply" data-act="apply">Nộp CV</button>');
      ui.phoneNode('post', '<b>Giao Hàng Nhanh 247</b><p>Tuyển shipper xe máy, thu nhập theo đơn. Tự túc xăng xe.</p><small>15 bình luận</small>');
      ui.phoneButtons([]);
      setTimeout(() => ui.toast('Kéo xuống đọc bài đăng. Bấm “Nộp CV” khi đã quyết định.', 3600), 600);
      ui.onPhoneAct = (act) => { if (act === 'apply') { ui.onPhoneAct = null; G.sfx('pickup'); n(); } };
    },
    (n) => { ui.phoneClose(); n(); },
    say([['Nam (nghĩ)', 'Lương nghìn đô... hơn 3.000 đô một tháng.'], ['Nam (nghĩ)', 'Chỉ cần vài tháng là trả hết tiền nhà, trả hết cho anh Hải. Còn đưa được bố mẹ đi du lịch.'], ['', 'Nam bấm gửi CV.']]),
    (n) => { ui.phoneChat(HEAD_HR, [
      ['me', 'Chào chị, em vừa nộp CV vị trí chăm sóc khách hàng ạ.'],
      ['them', 'Chào em, chị nhận được rồi nha. Hồ sơ em rất phù hợp 😊'],
      ['them', 'Lương cứng 3.000 đô, làm tốt lên 5.000 đô, trả bằng đô la luôn em nhé.'],
      ['them', 'Mai 8h em lên văn phòng đại diện phỏng vấn trực tiếp luôn nhé. Công ty có xe 16 chỗ đón tận nhà, phỏng vấn xong đưa về tận nơi.'],
      ['me', 'Dạ em cảm ơn chị. Em có cần mang gì không ạ?'],
      ['them', 'Em mang căn cước với hộ chiếu nếu có nha, để làm hồ sơ đi công tác nước ngoài sau này.'],
      ['me', 'Dạ em có hộ chiếu ạ.'],
      ['them', 'Ok em, 7h30 xe tới. Đừng kể nhiều với ai, nhiều người tranh suất lắm 😉'],
    ], n, { btn: 'Tắt máy ▸' }); },
    say([['Nam (nghĩ)', 'Hơn 3.000 đô, có bảo hiểm... Lần này phải được.']]),
    card([{ t: 'Sáng hôm sau · 07:30', c: 'place' }, { t: 'Một chiếc xe 16 chỗ đỗ trước đầu hẻm, cửa kính dán phim đen kín mít.' }]),
  ], ST.van);
};
// --- the van: first-person, look for odd details ---
ST.van = function () {
  S.phase = 'van'; S.mood = 'night'; S.clock = 8.2 * 60; G.setTime(8.2); G.overcast = 0.7; G.cineOff(); G.cam.mode = 'fp'; S.phaseLabel = 'Trên xe 16 chỗ';
  const s = L().vanSeat; P.pos.set(s.x, 0, s.z); P.yaw = 0; P.frozen = true; P.pose = 'sit'; P.eyeH = 1.32; G.cam.yaw = Math.PI; G.cam.pitch = 0.08;
  G.vanMoving = true; G.engineSound(true); ui.hud(true);
  S.f.vanSeen = 0; S.f.vanT = 0; L().vanHot.forEach((h) => { h.seen = false; });
  G.OBJ = [{ t: 'Nhìn quanh xe (đưa tâm nhìn vào chỗ lạ, bấm E)', at: () => ({ x: P.pos.x, z: P.pos.z }), done: () => S.f.vanDone, hideNear: 99 }];
  ui.toast('Kéo chuột / vuốt màn hình để nhìn quanh', 3500);
};
ST.vanTick = function (dt) {
  if (S.busy || S.f.vanDone) return;
  S.f.vanT += dt;
  const eye = new G.T.Vector3(P.pos.x, P.eyeH, P.pos.z), fwd = G.camForward(); let aim = null;
  for (const h of L().vanHot) { if (h.seen) continue; const d = new G.T.Vector3(h.x, h.y, h.z).sub(eye); const dist = d.length(); if (dist > 4.5) continue; if (d.normalize().dot(fwd) > 0.965) { aim = h; break; } }
  const pr = document.getElementById('prompt');
  if (aim) { pr.hidden = false; document.getElementById('prompt-text').textContent = 'Quan sát'; document.getElementById('prompt-key').hidden = false; pr.style.opacity = 1; if (G.input.usePressed) { aim.seen = true; S.f.vanSeen++; ui.say([['Nam (nghĩ)', aim.text]]); } }
  else pr.hidden = true;
  if ((S.f.vanSeen >= 2 || S.f.vanT > 40) && !S.busy) { S.f.vanDone = true; ST.vanCall(); }
};
ST.vanCall = function () {
  run([
    fx(() => G.ring(true)), wait(2200),
    (n) => ui.choose('Anh Hải (vay)', 'Điện thoại rung. Lại là anh Hải.', [{ label: 'Nghe máy', fn: () => { G.ring(false); n(); } }]),
    say([['Anh Hải', 'Còn ba ngày nữa là chủ nhật. Không có tiền thì đừng trách anh em tới tận nhà bố mẹ mày.'], ['Nam (nghĩ)', 'Có gì đó không ổn... Nhưng nếu đậu phỏng vấn thì có tiền trả nợ.'], ['Nam (nghĩ)', 'Thôi kệ. Cứ lên phỏng vấn xem sao.']]),
    (n) => ui.fade(n),
  ], ST.office);
};
// --- the office: the glass of water ---
ST.office = function () {
  S.phase = 'office'; S.mood = 'home'; G.vanMoving = false; G.engineSound(false); G.cam.mode = 'tp'; P.eyeH = 1.55; S.clock = 10 * 60; G.setTime(10); G.overcast = 0.5; S.phaseLabel = 'Văn phòng đại diện';
  const d = L().officeDoor; G.placePlayer(d.x, d.z, -Math.PI / 2); P.frozen = false; P.pose = null;
  G.OBJ = [{ t: 'Vào văn phòng, ngồi chờ ở ghế sofa', at: () => L().officeSofaStand, done: () => S.f.sat }];
  G.INTER = [{ at: () => L().officeSofaStand, r: 1.8, when: () => !S.f.sat, label: 'Ngồi chờ', run: ST.officeSit }];
  ui.say([['Lễ tân', 'Em là Nam đúng không? Vào đây ngồi đợi chút nhé.']]);
};
ST.officeSit = function () {
  S.f.sat = true; const s = L().officeSofa; P.pos.set(s.x, 0, s.z); P.yaw = s.yaw; P.frozen = true; P.pose = 'sit';
  G.cine([s.x + 2.6, 1.7, s.z + 3.2], [s.x - 0.4, 0.9, s.z + 0.6], false, 1.4);
  const r = npc('recep');
  const drink = () => run([
    fx(() => { P.pose = 'drink'; G.sfx('pickup'); }), wait(1300), fx(() => { G.officeGlass.visible = false; P.pose = 'sit'; }),
    say([['Lễ tân', 'Anh phụ trách ra ngay đây. Em cứ ngồi nghỉ.']]),
    fx(() => { G.sfx('drug'); S.f.drugT = 0; S.f.drugging = true; }), wait(2600),
    say([['Nam (nghĩ)', 'Sao... đầu nặng quá... Mắt không mở nổi...'], ['Người đàn ông mặc vest', 'Ngủ đi em. Tỉnh dậy là tới công ty rồi.']]),
    (n) => { ui.black(true); setTimeout(n, 1600); },
  ], ST.holding);
  run([
    fx(() => G.npcGo(r, [[s.x + 0.5, s.z + 1.3]], { walk: true })), wait(2600),
    say([['Lễ tân', 'Anh phụ trách đang họp, em đợi khoảng 15 phút nhé. Em uống nước đi, ngoài trời nóng lắm.']]),
    (n) => ui.choose('', 'Ly nước lọc đặt trên bàn.', [
      { label: 'Uống nước', fn: n },
      { label: 'Em chưa khát ạ', fn: () => ui.say([['Lễ tân', 'Trời nóng thế này mà. Uống đi em, đợi lâu lắm đấy.'], ['Nam (nghĩ)', 'Chắc mình lo xa quá...']], n) },
    ]),
  ], drink);
};
// --- holding room in Sihanoukville ---
ST.holding = function () {
  G.cine([180.6, 1.7, 1.9], [179.6, 0.6, -2.6], true, 1.2); ui.hud(false); G.OBJ = []; G.INTER = [];
  S.f.drugging = false; G.cam.drug = 0; ui.blur(0); G.setTime(26); G.overcast = 1; G.setRain(0.85); G.lightningOn = true; S.mood = 'horror';
  const h = L().holdNam; P.pos.set(h.x, 0, h.z); P.yaw = 0; P.frozen = true; P.pose = 'floor';
  const v1 = npc('v1'), g1 = npc('g1'), g2 = npc('g2');
  run([
    card([{ t: '...', c: 'place' }, { t: 'Không biết bao lâu sau.' }]),
    fx(() => ui.black(false)),
    say([['', 'Nam tỉnh dậy trên nền xi măng ẩm. Hai tay bị trói bằng dây rút. Hộ chiếu, điện thoại, ví đều không còn.'], ['', 'Bên cạnh là năm người lạ, cũng bị trói như anh. Ngoài kia, mưa đập vào cửa sổ song sắt.']]),
    fx(() => G.npcGo(g2, [[178.5, 0.4]], { walk: true })), wait(1600),
    fx(() => { g2.pose = 'talk'; }),
    say([['Gã xăm trổ', 'Chào mừng tới Sihanoukville. Từ giờ chúng mày làm cho công ty.'], ['Gã xăm trổ', 'Mỗi đứa nợ công ty 15.000 đô tiền mua. Làm trả đủ thì về.']]),
    fx(() => { v1.pose = 'stand'; G.cine([179.8, 1.5, 0.4], [177.6, 1.0, -2.4], false, 1.6); }), wait(700),
    say([['Một thanh niên', 'Thả tôi ra! Tôi không làm! Tôi sẽ báo công an!']]),
    fx(() => G.npcGo(g1, [[176.7, -1.9]], { speed: 3.5 })), wait(1100),
    fx(() => { g1.pose = 'strike'; v1.pose = 'shock'; G.sfx('shock'); G.shake(0.12); ui.flash('#7ab8ff'); G.spark.visible = true; G.spark.position.set(177.4, 1.2, -2.2); G.zapLight.position.set(177.4, 1.2, -2.2); G.zapLight.intensity = 3; }),
    wait(1400),
    fx(() => { G.spark.visible = false; G.zapLight.intensity = 0; v1.pose = 'lie'; v1.pos.z += 0.3; g1.pose = 'stand'; G.sfx('hit'); }),
    say([['Gã xăm trổ', 'Còn đứa nào muốn báo công an nữa không?']]),
    fx(() => { G.cine([180.4, 1.2, -1.4], [180.0, 0.7, -2.6], false, 0.8); G.sfx('heart'); ui.blur(3); }), wait(1500),
    fx(() => { G.sfx('heart'); ui.blur(7); }), wait(1200),
    (n) => { ui.black(true); setTimeout(n, 1200); },
    card([{ t: 'Nam ngất đi.', c: 'place' }]),
  ], () => { ui.blur(0); ST.startCh1(); });
};

// ===================== CHAPTER 1 — SIHANOUKVILLE =====================
ST.startCh1 = function () {
  ST.reset(); S.chapter = 1; S.phase = 'ch1'; G.saveCheckpoint(1); S.debt = Math.max(S.debt, 15000);
  ui.black(false); G.loadLevel('sihanouk'); G.setTime(7.3); G.setGuardsMode('day'); ui.hud(true); S.phaseLabel = 'Ca sáng';
  G.titleOrbit = { r: 135, h: 58, cx: 0, cz: 0 };
  const esc = G.addNpc('esc', { shirt: 0xd9692a, pants: 0x1b1d22, cap: 0x1b1d22, stunBaton: true, skin: 0xa8754f }, { x: 26.5, z: 16.5, yaw: -1.6 });
  G.addNpc('boss', { shirt: 0x5a1a1f, pants: 0x18181b, skin: 0xb58a62, glasses: true }, { x: -5, z: -44.2, yaw: 0 });
  G.addNpc('bay', { shirt: 0xb9b2a0, pants: 0x3a3a34, skin: 0xa8754f, hair: 0x8f8a84, sleeveless: true }, { x: 36.2, z: 27.75, yaw: Math.PI, pose: 'sit' }).h.group.visible = false;
  G.addNpc('hung', { shirt: 0xb07a58, pants: 0x2a2a2a, skin: 0xb07a58, bruises: true, shorts: true }, { x: 34.2, z: -38, yaw: -Math.PI / 2, pose: 'tied' });
  G.placePlayer(28.6, 18.6, -1.6);
  const path = [[13, 16], [9, -6], [-5.5, -10], [-5.5, -20], [-2.4, -26.6]];
  S.f.escI = 0; S.f.escNag = 0;
  // time = seconds allowed once the mission becomes current (measured paths: escort walk ~77m at the guard's pace, seat 2.4m)
  G.OBJ = [{ t: 'Đi theo lính gác vào xưởng', at: () => esc.pos, done: () => S.f.escDone, hideNear: 4, time: 90, lv: 1 }, { t: 'Ngồi vào bàn số 17 (ghế trống có biển vàng)', at: () => L().seat17, done: () => S.f.deskDone, hideNear: 6, time: 30, lv: 1 }];
  G.INTER = [{ at: () => L().seat17, r: 2.3, when: () => S.f.escDone && !S.f.deskDone, label: 'Ngồi vào bàn số 17', run: ST.ch1Desk }];
  ST.respawn = () => L().dormSpawn;
  ST.chapterCard(1, 'Sihanoukville', 'Đặc khu S-7. Tường cao sáu mét, thép gai, camera khắp nơi. Từ bên ngoài không ai nhìn vào được.')(() => {
    ui.say([['Lính gác', 'Dậy! Đi theo tao. Đi chậm là ăn dùi cui.']], () => { S.f.escStart = true; });
  });
  ST.tick = function (dt) {
    if (S.f.escStart && !S.f.escDone && !S.busy) {
      const d = Math.hypot(P.pos.x - esc.pos.x, P.pos.z - esc.pos.z);
      if (!esc.run && d < 5.5) {
        if (S.f.escI >= path.length) { S.f.escDone = true; esc.pose = 'talk'; esc.yaw = Math.atan2(P.pos.x - esc.pos.x, P.pos.z - esc.pos.z); ui.say([['Lính gác', 'Bàn 17. Ngồi xuống, làm theo kịch bản trên màn hình.']]); }
        else G.npcGo(esc, [path[S.f.escI++]], { walk: true, speed: 1.7 });
      }
      if (d > 9) { S.f.escNag -= dt; if (S.f.escNag <= 0) { S.f.escNag = 4; ui.toast('Lính gác: “Đi nhanh lên! Muốn ăn đòn à?”', 2200); } }
    }
    if (G.desk17Marker) G.desk17Marker.visible = S.f.escDone && !S.f.deskDone;
    ST.ch1NightTick && S.phase === 'ch1night' && ST.ch1NightTick(dt);
  };
};
ST.ch1Desk = function () {
  S.busy = true; P.frozen = true; P.pose = 'type'; const s = L().seat17; P.pos.set(s.x, 0, s.z); P.yaw = Math.PI; G.cam.yaw = 0.35; G.cam.pitch = 0.28;
  run([
    say([['Quản lý', 'Ba khách hôm nay. Kịch bản có sẵn bên trái màn hình. Làm sai một chữ là mày biết hậu quả.']]),
    (n) => ST.workShift(['police', 'relative', 'invest'], 'Quản lý', (w) => { S.f.warnedCh1 = w; n(); }),
    (n) => {
      const boss = npc('boss'); boss.pos.set(-1.8, 0, -27.2); boss.yaw = Math.atan2(s.x + 1.8, s.z + 27.2); boss.pose = 'talk'; P.frozen = true; P.pose = 'type';
      if (S.f.warnedCh1 >= 2) { S.debt += 3000; ui.say([['Quản lý', 'Mày nghĩ tao không đọc được màn hình à?']], () => { G.sfx('shock'); P.pose = 'shock'; setTimeout(() => { P.pose = 'type'; }, 1000); ui.flash('#7ab8ff'); G.shake(0.2); ui.say([['', 'Dùi cui điện dí vào gáy. Cả hàng ghế im phăng phắc.'], ['Quản lý', 'Hôm nay nhịn đói. Cộng 3.000 đô vào nợ. Tối nay vào phòng tối với thằng Hùng.']], n); }); }
      else ui.say([['Quản lý', 'Được đấy. Nhưng vẫn chưa đủ 5.000 đô một ngày.'], ['Quản lý', 'Thiếu chỉ tiêu thì biết rồi đấy. Tối nay vào phòng tối.']], n);
    },
    say([['', 'Nam biết mình không thể đợi đến tối. Phải tìm cách ra khỏi đây.']]),
    (n) => { S.f.deskDone = true; ui.fade(n); },
  ], ST.ch1Noon);
};
ST.ch1Noon = function () {
  S.phaseLabel = 'Giờ ăn trưa'; G.setTime(12.2); npc('boss').h.group.visible = false; npc('esc').h.group.visible = false;
  const bay = npc('bay'); bay.h.group.visible = true; bay.pos.set(L().baySeat.x, 0, L().baySeat.z); bay.yaw = Math.PI; bay.pose = 'sit';
  P.frozen = false; P.pose = null; G.placePlayer(L().hallDoor.x, L().hallDoor.z + 0.5, 0);
  G.OBJ = [{ t: 'Đến nhà ăn, tìm Chú Bảy', at: () => L().bayTalk, done: () => S.f.bayDone, time: 60, lv: 1 }];
  G.INTER = [{ at: () => L().bayTalk, r: 2.2, when: () => !S.f.bayDone, label: 'Ngồi cạnh Chú Bảy', run: ST.ch1Bay }];
  ui.toast('12:10 · Giờ ăn trưa. Tìm Chú Bảy ở nhà ăn.', 3600);
};
ST.ch1Bay = function () {
  S.f.bayDone = true; npc('bay').pose = 'talk';
  ui.say([
    ['Chú Bảy', 'Ngồi xuống, ăn đi. Đừng nhìn quanh, tụi nó có camera.'],
    ['Chú Bảy', 'Chú ở đây tám tháng rồi. Thằng Hùng trốn hụt tuần trước, giờ vẫn bị xích trong phòng tối.'],
    ['Nam', 'Con không làm nổi việc này. Có cách nào ra không chú?'],
    ['Chú Bảy', 'Dưới đệm giường số 3 trong ký túc có cái điện thoại chú giấu. Trong này phá sóng. Phải leo lên giàn giáo tòa nhà đang xây mới có sóng.'],
    ['Chú Bảy', 'Nhắn cho gia đình, gửi vị trí. Rồi lấy kìm cắt trong nhà kho. Cửa kho mở bằng thẻ từ ở phòng bảo vệ, thằng gác cổng chốc chốc lại ra cổng hút thuốc.'],
    ['Chú Bảy', 'Lưới B40 phía đông giáp đường lớn, cắt được. Ra tới đường có anh tài xế tuk-tuk đỗ dưới cột đèn. Chú nghe nói nó hay chở người trốn ra cửa khẩu.'],
    ['Chú Bảy', 'Đêm nay mưa to, có chó đi tuần, camera quét đỏ. Cúi thấp người, đi chỗ tối, ném đá để dụ tụi nó.'],
    ['Nam', 'Chú đi cùng con đi.'],
    ['Chú Bảy', 'Chú già rồi, chạy không nổi. Con ra được thì báo người vào cứu tụi chú.'],
  ], () => ui.fade(ST.ch1Night));
};
ST.ch1Setup = function () { // shared by solo night and multiplayer
  S.phase = 'ch1night'; S.phaseLabel = 'Đêm · điểm danh 05:30'; S.clock = 21 * 60; G.setTime(21); G.setRain(0.9); G.lightningOn = true;
  G.setGuardsMode('night'); S.stealthPhase = true; S.clockRun = true; S.deadline = 29.5 * 60; S.onDeadline = () => ST.failScreen('dawn');
  ['esc', 'boss'].forEach((k) => { if (npc(k)) npc(k).h.group.visible = false; });
  const bay = npc('bay'); if (bay) { bay.h.group.visible = true; bay.pos.set(36.2, 0, 27.75); bay.yaw = Math.PI; bay.pose = 'sit'; }
  G.input.crouch = true; G.input.run = false;
  const I = S.items, F = S.f;
  // Timers sum to 500s, inside the 510s night (21:00 → 05:30). Walking paths measured on the map:
  // bed 16m · scaffold 74m + 6s climb · guard room 108m + wait for the smoke break (~90s cycle) · store 120m · east fence 150m + 2 guards · street 24m
  G.OBJ = [
    { t: 'Lấy điện thoại dưới đệm giường số 3 (Ký túc)', at: () => L().bed3, done: () => I.phone, time: 45, lv: 1 },
    { t: 'Leo giàn giáo tòa nhà đang xây, nhắn tin cho gia đình', at: () => L().ladder, done: () => F.sent, time: 75, lv: 2 },
    { t: 'Lấy thẻ từ trong phòng bảo vệ (đợi gác ra cổng hút thuốc)', at: () => L().card, done: () => I.card, time: 130, lv: 3 },
    { t: 'Quẹt thẻ mở nhà kho, lấy kìm cắt', at: () => (G.doors.kho.open ? L().cutter : L().khoDoor), done: () => I.cutter, time: 100, lv: 3 },
    { t: 'Cắt lưới B40 ở tường phía đông', at: () => L().fence, done: () => F.fenceCut, time: 120, lv: 4 },
    { t: S.mp ? 'Ra tới đường lớn' : 'Ra đường lớn, tìm xe tuk-tuk dưới cột đèn', at: () => L().tuk, done: () => F.reachedTuk, time: 30, lv: 2 },
    { t: 'Tùy chọn: giải cứu Hùng ở phòng tối', opt: true, at: () => (G.doors.ptoi.open ? L().hung : L().ptoiDoor), done: () => F.hung },
  ];
  G.INTER = [
    { at: () => ({ x: 36.2, z: 26.4 }), r: 1.7, when: () => !S.mp, label: 'Hỏi nhỏ Chú Bảy', run: () => ui.say([['Chú Bảy', ST.ch1Hint()]]) },
    { at: () => L().bed3, r: 1.7, when: () => !I.phone, label: 'Lục dưới đệm giường số 3', hold: 1.2, run: () => { ST.world('phone'); ui.toast('Có điện thoại! Pin 9%. Trong khu này bị phá sóng, phải lên chỗ cao.', 3800); } },
    { at: () => L().ladder, r: 1.7, when: () => !F.sent, label: 'Leo giàn giáo, nhắn tin (giữ)', hold: 6, block: () => (!I.phone ? 'Leo lên cũng vô ích, bạn chưa có điện thoại' : S.mp && !G.coopOthers('lad') ? 'Thang rung lắc. Cần 1 đồng đội giữ chân thang (điểm xanh)' : null), onHold: ST.climbHold, onCancel: ST.climbCancel, run: ST.ch1Climb },
    // team mode: the second person for the ladder, the fence and a tied-up teammate
    { at: () => ST.TEAM.ladderHelp, r: 1.3, when: () => S.mp && !F.sent, label: () => (G.coopMine() === 'lad' ? 'Đang giữ chân thang. Đừng buông!' : 'Giữ chân thang cho đồng đội leo (giữ E)'), hold: Infinity, coop: 'lad', block: () => (!I.phone ? 'Lấy điện thoại trước đã' : null), run: () => {} },
    { at: () => L().breaker, r: 1.4, when: () => S.mp && !F.fenceCut, label: () => (G.coopMine() === 'cdao' ? 'Đang giữ cầu dao: đèn pha đã tắt. Đừng buông!' : 'Giữ cầu dao cắt điện đèn pha (giữ E)'), hold: Infinity, coop: 'cdao', block: () => (!I.cutter ? 'Chưa có kìm cắt. Cắt điện lúc này chỉ làm bọn gác nghi ngờ' : null), run: () => {} },
    { at: () => (ST.tiedNear() || P).pos, r: 1.7, when: () => S.mp && !!ST.tiedNear(), label: () => 'Cởi trói cho ' + (ST.tiedNear() || { name: 'đồng đội' }).name + ' (giữ)', hold: 2.2, run: () => ST.freeMate() },
    { at: () => L().card, r: 1.5, when: () => !I.card, label: 'Lấy thẻ từ', hold: 0.6, run: () => { ST.world('card'); ui.toast('Đã lấy thẻ từ. Mở được nhà kho và phòng tối.', 3000); } },
    Object.assign({ at: () => L().khoDoor, r: 1.8, when: () => !G.doors.kho.open, label: 'Quẹt thẻ mở nhà kho', hold: 1, block: () => (!I.card ? 'Cửa kho khóa. Cần thẻ từ' : null), run: () => { ST.world('kho'); G.makeNoise(P.pos.x, P.pos.z, 7, 'door'); } },
      S.mp ? { label: 'Quẹt thẻ, cùng nâng cửa cuốn (2 người giữ E)', hold: 2.5, coop: 'kho', need: 2 } : {}),
    { at: () => L().cutter, r: 1.6, when: () => G.doors.kho.open && !I.cutter, label: 'Lấy kìm cắt', hold: 0.6, run: () => { ST.world('cutter'); ui.toast('Có kìm cắt. Lưới B40 ở tường phía đông.', 3000); } },
    { at: () => L().ptoiDoor, r: 1.7, when: () => !G.doors.ptoi.open, label: 'Quẹt thẻ mở phòng tối', hold: 1, block: () => (!I.card ? 'Phòng tối khóa. Cần thẻ từ' : null), run: () => { ST.world('ptoi'); G.makeNoise(P.pos.x, P.pos.z, 7, 'door'); } },
    { at: () => L().hung, r: 1.5, when: () => G.doors.ptoi.open && !F.hung, label: 'Cởi trói cho Hùng', hold: 2.5, run: () => { ST.world('hung'); ui.say([['Hùng', 'Anh... cảm ơn anh. Em tưởng mình chết ở đây rồi.'], ['Hùng', 'Em tự lo được. Anh đi đi, đừng để tụi nó thấy hai đứa đi chung.']]); } },
    { at: () => L().fence, r: 1.9, when: () => !F.fenceCut, label: 'Cắt lưới B40 (giữ)', hold: 3.5, block: () => (!I.cutter ? 'Lưới B40 chắc chắn. Cần kìm cắt' : S.mp && !G.lightsOut ? 'Đèn pha, camera soi thẳng vào lưới. Cần 1 đồng đội giữ cầu dao ở tường bắc ký túc' : null), onHold: () => { if (Math.random() < 0.08) G.sfx('cut'); }, run: () => { ST.world('fence'); G.sfx('cut'); G.makeNoise(P.pos.x, P.pos.z, 10, 'cut'); ui.toast('Lưới đã thủng. Ra đường lớn!', 2600); } },
    S.mp ? { at: () => ST.TEAM.lure, r: 2.4, when: () => !I.card, label: 'Rung cổng sắt dụ tên gác ra (giữ)', hold: 1.2, block: () => (performance.now() - (F.lureAt || 0) < 9000 ? 'Vừa rung cổng xong. Trốn đi!' : null), run: () => ST.lureGate() }
      : { at: () => ({ x: 9, z: 53.2 }), r: 3, label: '', block: () => 'Cổng sắt khóa chặt' },
  ];
  ST.respawn = () => Object.assign({ yaw: Math.PI }, L().dormSpawn);
};
ST.ch1Hint = function () {
  const i = G.OBJ.indexOf(G.currentObj());
  return ['Giường số 3, dãy phía bắc ký túc. Lấy điện thoại trước đã.', 'Tòa nhà đang xây ở góc đông bắc, sau phòng tối. Thang leo ở chân giàn giáo. Coi chừng đèn trên nóc tòa A.', 'Phòng bảo vệ sát cổng chính. Đợi thằng gác ra cổng hút thuốc rồi hãy vào.', 'Nhà kho ở góc tây bắc, sau xưởng. Quẹt thẻ là cửa cuốn mở.', 'Lưới B40 ở tường phía đông, ngay giữa. Có camera quét gần đó và chó đi tuần.', 'Ra đường lớn tìm xe tuk-tuk dưới cột đèn. Đi đi con.'][i] || 'Đi đi con.';
};
ST.climbHold = function (p) { const top = L().towerTop; P.frozen = true; P.pose = 'climb'; P.climb = p; P.pos.set(top.x, Math.min(p * 1.15, 1) * top.y, top.z); P.yaw = Math.PI; P.phase += 0.25; };
ST.climbCancel = function () { P.climb = 0; P.pos.set(L().ladder.x, 0, L().ladder.z); P.frozen = false; P.pose = null; };
ST.ch1Climb = function () {
  P.pose = 'phone'; P.climb = 1;
  ui.phoneChat('<div class="ava" style="background:#7a5a8a">M</div><div><b>Mẹ</b><small>● 1 vạch sóng</small></div>', [
    ['sys', 'Có sóng · 1 vạch · Pin 6%'],
    ['me', '📍 Đã chia sẻ vị trí hiện tại'],
    ['me', 'Mẹ ơi, con bị lừa sang Campuchia, đang bị nhốt ở một khu nhà cao tầng ở Sihanoukville. Mẹ báo công an giúp con.'],
    ['them', 'Nam ơi!!! Con đang ở đâu? Trời ơi, mẹ gọi cho con mấy ngày nay...'],
    ['me', 'Con sẽ tìm cách trốn. Mẹ đưa định vị này cho công an nhé. Con hết pin rồi.'],
    ['sys', 'Điện thoại tắt nguồn.'],
  ], () => { ST.world('sent'); ST.climbCancel(); ui.toast('Đã gửi vị trí cho gia đình. Giờ cần thẻ từ, kìm cắt, rồi ra tường phía đông.', 4200); }, { btn: 'Leo xuống ▸' });
};
ST.ch1Night = function () { ST.ch1Setup(); G.placePlayer(L().dormSpawn.x, L().dormSpawn.z, Math.PI); P.frozen = false; P.pose = null; ui.card([{ t: '21:00', c: 'big' }, { t: 'Mưa như trút. Đèn pha trên nóc tòa A bắt đầu quét. Chó được thả ra.' }, { t: 'Bạn có đến 5:30 sáng, giờ điểm danh.', c: 'place' }], () => ui.toast('Cúi người (C), tránh đèn pha, camera đỏ và chó nghiệp vụ', 4200)); };
// world flags (shared in multiplayer)
const WORLD_MSG = { phone: 'đã lấy được điện thoại', card: 'đã lấy thẻ từ', cutter: 'đã lấy kìm cắt', kho: 'đã mở nhà kho', ptoi: 'đã mở phòng tối', sent: 'đã gửi tin cho gia đình', fence: 'đã cắt thủng lưới B40 phía đông', hung: 'đã cởi trói cho Hùng' };
G.applyWorld = function (k, by) {
  const I = S.items, F = S.f;
  if (k === 'phone') I.phone = true;
  else if (k === 'card') { I.card = true; if (G.cardMesh) G.cardMesh.visible = false; }
  else if (k === 'cutter') { I.cutter = true; if (G.cutterMesh) G.cutterMesh.visible = false; }
  else if (k === 'kho') { G.openDoor(G.doors.kho); G.sfx('door'); }
  else if (k === 'ptoi') { G.openDoor(G.doors.ptoi); G.sfx('door'); }
  else if (k === 'sent') F.sent = true;
  else if (k === 'fence') { if (!F.fenceCut) { F.fenceCut = true; const fp = G.fencePanel; fp.col.off = true; fp.mesh.visible = false; const m = new G.T.Mesh(G.planeGeo(2.4, 4.6, 1.6), G.MAT.fence); m.rotation.set(-Math.PI / 2, 0, Math.PI / 2); m.position.set(72.4, 0.05, 0); G.add(m); } }
  else if (k === 'hung') { if (!F.hung) { F.hung = true; const h = npc('hung'); if (h) { h.pose = 'stand'; G.npcGo(h, [[29.4, -38], [27, -38], [27, -52]], { hide: true }); } } }
  else return;
  if (by) { ui.toast(by + ' ' + (WORLD_MSG[k] || ''), 3400); G.sfx('pickup'); } else if (['phone', 'card', 'cutter', 'hung'].includes(k)) G.sfx('pickup');
};
ST.world = (k) => { G.applyWorld(k); if (S.mp && G.net.on) G.net.emit(k); };
G.netToast = (text) => { if (text && S.mp) ui.toast(text, 3200); };
G.onNetClock = (c) => { if (S.mp && typeof c === 'number' && c > 0 && S.teamPlay) S.clock = c; };
G.onNetLost = () => {
  if (!S.mp) return;
  const playing = S.teamPlay && !S.ended;
  if (playing) ST.teamEnd('lost', true);
  S.mp = false; for (const [id, p] of [...G.net.peers]) { if (p.h.group.parent) p.h.group.parent.remove(p.h.group); G.net.peers.delete(id); }
  if (!document.getElementById('room').hidden) { document.getElementById('room').hidden = true; document.getElementById('title').hidden = false; G.openLobby('', 'Mất kết nối tới máy chủ game.'); }
};
ST.ch1NightTick = function () {
  if (S.busy || S.f.reachedTuk) return;
  if (S.mp) return; // team mode ends through ST.teamTick
  if (S.f.fenceCut && G.near(L().tuk, 3.2)) { S.f.reachedTuk = true; ST.ch1Betrayal(); }
};
ST.ch1Betrayal = function () {
  S.stealthPhase = false; S.clockRun = false; P.frozen = true; P.pose = null; S.busy = true; ui.hud(false);
  const drv = G.addNpc('drv', { shirt: 0x4a6a8a, pants: 0x2a2a2a, skin: 0xa8754f, cap: 0x8a1a1a }, { x: 89.4, z: 4.6, yaw: Math.PI, pose: 'stand' });
  G.cine([84.5, 2.2, 9.5], [89, 1.2, 2.5], false, 1.2);
  run([
    say([['Tài xế tuk-tuk', 'Người Việt hả? Lên xe nhanh, tôi đưa ra cửa khẩu.'], ['Nam', 'Cảm ơn anh... cảm ơn anh...']]),
    fx(() => { drv.pose = 'phone'; drv.yaw = 0; }), wait(900),
    say([['', 'Tài xế quay lưng đi, nói nhỏ vào điện thoại bằng một thứ tiếng Nam không hiểu.'], ['Nam (nghĩ)', 'Anh ta đang gọi cho ai vậy...?']]),
    fx(() => { const s = G.betraySuv; s.visible = true; s.position.set(90, 0, -40); s.rotation.y = 0; G.betrayBeam.intensity = 3; G.sfx('door2'); G.engineSound(true); G.cine([84, 3, 12], [90, 1, -6], false, 1); }),
    (n) => { let k = 0; const iv = setInterval(() => { G.betraySuv.position.z += 2.6; if (++k > 12) { clearInterval(iv); n(); } }, 70); },
    fx(() => { G.sfx('bark'); for (let i = 0; i < 3; i++) { const g = G.addNpc('gang' + i, { shirt: 0x111111, pants: 0x1b1d22, skin: 0xa8754f, bald: i === 0, tattoo: i === 0, stun: true }, { x: 88 + i, z: -2, yaw: 0 }); G.npcGo(g, [[P.pos.x - 1 + i, P.pos.z - 1.2]], { speed: 4.5 }); } }),
    wait(900),
    say([['Gã xăm trổ', 'Chạy đâu? Tài xế tuk-tuk quanh đây đều là người của tao.']]),
    fx(() => { G.sfx('arrest'); ui.flash('#7ab8ff'); G.shake(0.35); P.pose = 'shock'; }), wait(1100),
    fx(() => { G.shake(0.3); P.pose = 'lie'; ui.flash(); }), wait(1500),
    (n) => { ui.black(true); G.engineSound(false); setTimeout(n, 1400); },
  ], ST.ch1Cage);
};
ST.ch1Cage = function () {
  G.betraySuv.visible = false; G.betrayBeam.intensity = 0;
  P.pos.set(36.6, 0, -40.6); P.yaw = -Math.PI / 2; P.pose = 'floor';
  G.cine([32.5, 1.4, -37.8], [36.6, 0.6, -40.6], true, 1); ui.black(false); S.mood = 'horror';
  const boss = G.addNpc('trum', { shirt: 0x2a1a1a, pants: 0x111111, skin: 0xb58a62, glasses: true, bald: true }, { x: 33.6, z: -39.6, yaw: Math.PI / 2, pose: 'talk' });
  run([
    say([['', 'Nam tỉnh lại trong một chiếc lồng sắt nhốt chó, người đầy vết dùi cui điện.'], ['Trùm', 'Mày thích trốn lắm hả? Tin nhắn gửi về nhà à? Ở đây mạng nào tao cũng nghe được.'], ['Trùm', 'Hàng lỗi thì bán đi. Bên rừng đang cần người. Ở đó không có ai nhẹ tay như tao đâu.']]),
    fx(() => G.sfx('cage')),
    card([{ t: 'Đêm đó, chiếc lồng sắt bị chất lên thùng xe tải cùng những chiếc lồng khác.' }, { t: 'Không ai biết họ đi đâu.', c: 'place' }]),
  ], () => ST.startCh2());
};
})(window.G);
