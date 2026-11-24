// myanmar_missions.js — what the team has to do on the long Myanmar map, act by act (the engine: myanmar.js).
// Everything here is made up: the compound, the people, the codes. Each mission has a `type`:
//   do        one person holds E                       support   one holds a spot while another works
//   together  two hold the same spot                   multi     several spots, shared out (`hit`: only some count)
//   carry     bring things one by one (slow, no run)   sync      spots held at the same time until a total is reached
//   seq       spots in an order learnt earlier         window    all spots within a few seconds of the first
//   panel     a puzzle (panel.js)                      escort    walk somebody who can't walk alone
//   gather    the whole team in one place              paddle    everybody rows
// `time` = seconds for that mission (× the room's time option). R = this try's random draw: codes and orders change.
(function (G) {
'use strict';
const COLORS = [['đỏ', 0xb03030], ['xanh', 0x2f5fa8], ['vàng', 0xc9a530], ['trắng', 0xd8d4cc]];
const QUIZ = [
  ['Người xưng công an gọi video, bắt bà Sáu chuyển tiền để “xác minh”.', 'Cúp máy, ra công an phường hoặc gọi 113', 'Chuyển một nửa trước cho chắc', 'Đọc số tài khoản để họ kiểm tra'],
  ['Một ông cụ nhận link bảo cài app “cập nhật định danh”.', 'Không bấm, chỉ cài app từ kho chính thức', 'Cài thử rồi xóa sau', 'Gửi link cho con cháu cài giúp'],
  ['Chị công nhân làm “nhiệm vụ” bấm thích, giờ phải nạp tiền mới rút được.', 'Dừng lại, không nạp thêm, báo công an', 'Nạp thêm một lần để gỡ vốn', 'Rủ bạn nạp cùng cho đủ mức'],
  ['“Người yêu” quen qua mạng rủ đầu tư, lãi 30 % một tháng.', 'Không chuyển tiền, kể với người thân', 'Đầu tư thử số nhỏ', 'Vay thêm vì cơ hội có hạn'],
  ['Có người báo con bà Hai cấp cứu, cần tiền viện phí ngay.', 'Gọi thẳng cho con và nhà trường', 'Chuyển ngay kẻo chậm', 'Chờ họ gọi lại lần nữa'],
  ['Một sinh viên được mời sang nước ngoài: việc nhẹ, lương 25 triệu, không hợp đồng.', 'Không đi, kiểm tra công ty có giấy phép', 'Đi thử một tháng rồi về', 'Đưa hộ chiếu cho họ làm hồ sơ'],
  ['“Nhân viên ngân hàng” xin mã OTP để khóa giao dịch lạ.', 'Không đọc mã, gọi số in sau thẻ', 'Đọc mã thật nhanh', 'Chụp màn hình gửi qua tin nhắn'],
  ['Anh tài xế vừa lỡ chuyển tiền cho kẻ lừa đảo.', 'Gọi ngân hàng ngay và trình báo công an', 'Im lặng vì ngại', 'Thuê người trên mạng lấy lại hộ'],
];
const digits = (R, n) => Array.from({ length: n }, () => Math.floor(R() * 10)).join('');
const shuffled = (R, list) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
};
const range = (n) => Array.from({ length: n }, (x, i) => i);
const bitsOn = (b, n) => range(n).filter((i) => (b >> i) & 1);

// everything random of one try, from the round's seed (every screen computes the same)
function draw(rand) {
  const R = rand;
  const d = {};
  d.cellCode = digits(R, 4);
  d.scratch = shuffled(R, range(6)).slice(0, 4);
  d.camSeq = range(8).map(() => Math.floor(R() * 4));
  const caps = shuffled(R, [[true, true], [true, false], [false, true], [false, false]]), cols = shuffled(R, COLORS);
  d.suspects = range(4).map((i) => ({ cap: caps[i][0], sleeves: caps[i][1], color: cols[i] }));
  d.mole = Math.floor(R() * 4);
  const m = d.suspects[d.mole], not = d.suspects[(d.mole + 1 + Math.floor(R() * 3)) % 4];
  d.clues = [
    m.cap ? 'Hắn có đội mũ.' : 'Hắn không đội mũ.',
    m.sleeves ? 'Hắn mặc áo dài tay.' : 'Hắn mặc áo ngắn tay.',
    'Chắc chắn không phải người áo ' + not.color[0] + '.',
  ];
  d.fuse = shuffled(R, range(8)).slice(0, 3);
  d.levers = shuffled(R, range(5));
  d.freq = Math.round((89 + R() * 17) * 10) / 10;
  d.freqStart = d.freq > 98 ? 88 : 108;
  d.safeCode = digits(R, 4);
  d.quiz = shuffled(R, QUIZ).slice(0, 4).map(([q, ok, w1, w2]) => { const a = shuffled(R, [ok, w1, w2]); return { q, a, ok: a.indexOf(ok) }; });
  return d;
}

const ACTS = [
  { name: 'Bến sông', river: true, missions: [{ id: 'boat', type: 'river' }] },

  // ------------------------------------------------------------------------------------------------
  {
    name: 'Phòng giam', spawn: 1, post: (L) => L.detPost, postName: 'cột giữa hành lang khu giam',
    intro: [['', 'Khu giam · Khu Sương Đen, Myanmar']],
    missions: [
      { id: 'nhan', type: 'do', time: 60, lv: 1, t: 'Hỏi chị Nhàn cùng phòng: đây là đâu?', at: (L) => L.nhan, r: 1.6, hold: 1.2, label: 'Hỏi chuyện chị Nhàn (giữ)',
        say: [['Chị Nhàn', 'Khu Sương Đen, bên Myanmar. Mấy em cũng uống nước của ông lái tàu tên Tư phải không?'],
          ['Chị Nhàn', 'Ổng là người của đường dây Campuchia. Ai chạy ra được bến là ổng bán tiếp qua bên này.'],
          ['Chị Nhàn', 'Muốn sống thì đi cùng nhau. Bẻ song cửa trước, hai người mới đủ sức.']] },
      { id: 'bars', type: 'together', time: 75, lv: 2, t: 'Bẻ song cửa: 2 người cùng giữ E', at: (L) => L.barsSpot, r: 1.7, key: 'song', hold: 6, label: 'Bẻ song cửa (2 người cùng giữ)',
        say: [['Chị Nhàn', 'Chìa khóa trên bàn tên trực. Gõ ống nước cuối hành lang là hắn phải ra xem.']] },
      { id: 'desk', type: 'do', time: 170, lv: 3, t: 'Trộm chìa khóa: 1 người gõ ống nước dụ tên trực (điểm xanh), 1 người lấy', at: (L) => L.deskKey, r: 1.5, hold: 2, label: 'Lấy chùm chìa khóa (giữ)',
        block: () => { const g = G.guards.find((x) => x.id === 'station'); return g && Math.hypot(g.pos.x + 48, g.pos.z + 33.6) < 4.2 ? 'Tên trực còn ở đây. Cần người gõ ống nước dụ hắn ra' : null; },
        lure: { at: (L) => L.pipe, r: 5, label: 'Gõ ống nước dụ tên trực (giữ)', toast: 'Tên trực đang đi ra. Nấp vào phòng giam ngay, để đồng đội lấy chìa khóa!' },
        say: [['Chị Nhàn', 'Cửa ngoài còn khóa số. Người trốn trước khắc mã lên tường các phòng giam.']] },
      { id: 'scratch', type: 'multi', time: 190, lv: 3, t: (st) => 'Tìm 4 số khắc trên tường các phòng giam (' + st.count + '/4)', spots: (L, d) => d.scratch.map((i) => L.scratches[i]), hold: 3, label: 'Xem vết khắc trên tường (giữ)',
        found: (i, d) => 'Số thứ ' + (i + 1) + ' là ' + d.cellCode[i],
        note: (st, d) => 'Mã cửa: ' + d.cellCode.split('').map((c, i) => ((st.bits >> i) & 1 ? c : '_')).join(' ') },
      { id: 'exit', type: 'panel', time: 90, lv: 3, t: 'Bấm mã 4 số mở cửa khu giam', at: (L) => L.keypad, label: 'Bấm mã cửa', kind: 'code',
        note: (st, d) => 'Mã cửa: ' + d.cellCode.split('').join(' '),
        spec: (d) => ({ title: 'Khóa số khu giam', hint: 'Mã cả đội tìm được: ' + d.cellCode.split('').join(' '), code: d.cellCode }),
        say: [['Chị Nhàn', 'Hộ chiếu tụi nó giữ trong Tòa A. Chị ra ngõ sau nhà ngủ chờ, có gì tới tìm chị.']] },
    ],
  },

  // ------------------------------------------------------------------------------------------------
  {
    name: 'Tòa nhà lừa đảo', spawn: 2, post: (L) => L.post, postName: 'cột giữa sân',
    intro: [['', 'Tòa A: nơi hàng trăm người bị ép nhắn tin lừa đảo mỗi đêm.']],
    missions: [
      { id: 'entry', type: 'support', time: 150, lv: 3, t: 'Mở cửa Tòa A: 1 người ghì tay nắm (điểm xanh), 1 người mở khóa', at: (L) => L.entry, help: (L) => L.entryHelp, key: 'cua', hold: 5,
        label: 'Mở khóa Tòa A (giữ)', helpLabel: 'Ghì tay nắm cửa cho khỏi kêu (giữ E)', wait: 'Cửa kêu rất to. Cần 1 đồng đội ghì tay nắm (điểm xanh)' },
      { id: 'papers', type: 'multi', time: 210, lv: 3, t: (st) => 'Lục 6 tủ tìm hộ chiếu của mọi người (' + st.count + '/6)', spots: (L) => L.drawers, hold: 3, label: 'Lục tủ hồ sơ (giữ)' },
      { id: 'cams', type: 'panel', time: 130, lv: 3, t: 'Tắt camera: nhớ và bấm lại 3 lượt tín hiệu', at: (L) => L.console, label: 'Dùng bàn điều khiển camera', kind: 'memory',
        spec: (d) => ({ title: 'Bàn điều khiển camera', hint: 'Nhìn thứ tự sáng rồi bấm lại (hoặc dùng phím mũi tên).', rounds: 3, make: (r) => d.camSeq.slice(r, r + 4 + r) }) },
      { id: 'data', type: 'sync', time: 190, lv: 4, t: (st) => 'Chép bằng chứng: 1 người ở máy tính, 1 người giữ cầu dao (' + st.secs + '/25 giây)', spots: (L) => [L.pc, L.breaker], key: 'chep', secs: 25,
        labels: ['Chép dữ liệu đường dây (giữ E)', 'Giữ cầu dao phòng máy chủ (giữ E)'] },
      { id: 'warn', type: 'panel', time: 150, lv: 2, t: 'Dùng máy lừa đảo để cảnh báo các nạn nhân', at: (L) => L.warnPc, label: 'Nhắn cảnh báo nạn nhân', kind: 'quiz',
        spec: (d) => ({ title: 'Cứu người ở đầu dây bên kia', hint: 'Chọn lời khuyên đúng. Sai một câu là làm lại từ đầu.', qs: d.quiz }),
        say: [['Chị Nhàn', 'Trong tụi mình có một đứa chỉ điểm. Hỏi ba người ở quanh nhà ngủ, mỗi người biết một chút.']] },
      { id: 'witness', type: 'multi', time: 210, lv: 3, t: (st) => 'Hỏi 3 nhân chứng quanh nhà ngủ (' + st.count + '/3)', spots: (L) => L.witness, r: 1.8, hold: 2.5, label: 'Hỏi nhân chứng (giữ)', bots: false,
        found: (i, d) => d.clues[i],
        note: (st, d) => bitsOn(st.bits, 3).map((i) => d.clues[i]).join(' ') },
      { id: 'mole', type: 'panel', time: 120, lv: 4, t: 'Gặp chị Nhàn, chỉ ra kẻ chỉ điểm', at: (L) => L.alley, r: 1.9, label: 'Chỉ mặt kẻ chỉ điểm', kind: 'choice',
        note: (st, d) => d.clues.join(' '),
        spec: (d) => ({ title: 'Ai là kẻ chỉ điểm?', hint: 'Đối chiếu 3 lời khai.', clues: d.clues, answer: d.mole, wrongText: 'Không phải. Người bị nghi oan la lên, mất 15 giây.',
          items: d.suspects.map((s) => ['Áo ' + s.color[0], (s.sleeves ? 'dài tay' : 'ngắn tay') + ' · ' + (s.cap ? 'có đội mũ' : 'không đội mũ')]) }),
        say: [['Chị Nhàn', 'Đúng là nó. Chị sẽ canh không cho nó đi báo.'],
          ['Chị Nhàn', 'Muốn gọi cứu phải có điện cho cột ăng-ten. Trạm điện góc đông bắc, thiếu cầu chì với xăng.']] },
    ],
  },

  // ------------------------------------------------------------------------------------------------
  {
    name: 'Điện và ăng-ten', spawn: 3, post: (L) => L.post, postName: 'cột giữa sân',
    intro: [['', 'Khu phía đông: trạm điện, cột ăng-ten, lính và chó tuần dày hơn.']],
    missions: [
      { id: 'fuse', type: 'multi', time: 270, lv: 3, t: (st) => 'Lục các tủ điện tìm 3 cầu chì (' + st.got + '/3)', spots: (L) => L.fuseBoxes, hold: 3, label: 'Lục tủ điện (giữ)', want: 3,
        hit: (i, d) => d.fuse.includes(i), found: (i, d) => (d.fuse.includes(i) ? 'Có một cầu chì!' : 'Tủ trống.') },
      { id: 'fuel', type: 'carry', time: 270, lv: 4, t: (st) => 'Khiêng 2 can xăng về máy phát (' + st.count + '/2)', items: (L) => L.fuel, to: (L) => L.generator, what: 'can xăng', look: 'can' },
      { id: 'plan', type: 'do', time: 120, lv: 2, t: 'Xem sơ đồ thứ tự cầu dao trong trạm điện', at: (L) => L.diagram, r: 1.6, hold: 3, label: 'Đọc sơ đồ cầu dao (giữ)' },
      { id: 'levers', type: 'seq', time: 210, lv: 4, t: (st) => 'Gạt 5 cầu dao quanh trạm đúng thứ tự (' + st.count + '/5)', spots: (L) => L.levers, names: ['A', 'B', 'C', 'D', 'E'], order: (d) => d.levers, hold: 1.2, label: 'Gạt cầu dao',
        note: (st, d) => 'Sơ đồ: ' + d.levers.map((i, k) => (k < st.count ? '✓' : 'ABCDE'[i])).join(' → ') },
      { id: 'cut', type: 'sync', time: 170, lv: 4, t: (st) => 'Cắt đèn pha: giữ 2 công tắc xa nhau cùng lúc (' + st.secs + '/6 giây)', spots: (L) => L.switches, key: 'ct', secs: 6, atOnce: true,
        labels: ['Giữ công tắc tây (giữ E)', 'Giữ công tắc đông (giữ E)'],
        say: [['', 'Cả khu tối om. Đèn chỉ tắt cho tới khi tin cầu cứu đi xong.']] },
      { id: 'climb', type: 'support', time: 170, lv: 3, t: 'Nối dây trên cột ăng-ten: 1 người giữ thang (điểm xanh), 1 người leo', at: (L) => L.ladder, help: (L) => L.ladderHelp, key: 'thang', hold: 7, climb: true,
        label: 'Leo cột nối dây (giữ)', helpLabel: 'Giữ chân thang (giữ E)', wait: 'Thang lung lay. Cần 1 đồng đội giữ chân thang (điểm xanh)' },
      { id: 'tune', type: 'panel', time: 120, lv: 3, t: 'Dò tần số cứu hộ trong buồng phát sóng', at: (L) => L.radio, label: 'Dò máy phát sóng', kind: 'tune',
        spec: (d) => ({ title: 'Máy phát sóng', hint: 'Dò tới khi vạch tín hiệu đầy rồi giữ yên.', target: d.freq, start: d.freqStart, min: 87.5, max: 108.5 }) },
      { id: 'send', type: 'sync', time: 270, lv: 4, t: (st) => 'Phát tin cầu cứu: 1 người ở máy, 1 người giữ chảo (' + st.secs + '/45 giây)', spots: (L) => [L.radio, L.dish], key: 'phat', secs: 45, noiseEvery: 15,
        labels: ['Phát tin cầu cứu (giữ E)', 'Giữ chảo hướng về Thái Lan (giữ E)'],
        warn: 'Cứ 15 giây máy rú một lần, lính gần đó kéo tới. Bị thấy thì buông ra chạy, tiến độ vẫn còn.',
        say: [['Thiếu tá Anan', '(qua phiên dịch) Cảnh sát Thái Lan nghe rõ. Chúng tôi không vào Myanmar được. Hãy tới bờ sông Moei.'],
          ['Đại úy Minh', 'Anh Minh đây, đang ở Mae Sot cùng Đại sứ quán. Mang theo người bị thương và bằng chứng nhé.'],
          ['Chị Nhàn', 'Anh Lộc còn nằm trong khu phạt, gãy chân. Không bỏ ai lại.']] },
    ],
  },

  // ------------------------------------------------------------------------------------------------
  {
    name: 'Cứu người, lấy bằng chứng', spawn: 4, post: (L) => L.post, postName: 'cột giữa sân',
    intro: [['', 'Khu phạt ở góc tây nam. Biệt thự của quản khu ở góc đông nam.']],
    missions: [
      { id: 'ring', type: 'support', time: 270, lv: 4, t: 'Chìa khu phạt: 1 người giữ xích (điểm xanh), 1 người cúi lấy từ tên gác ngủ', at: (L) => L.keys, help: (L) => L.keysHelp, key: 'xich', hold: 3, crouch: true, r: 1.2,
        label: 'Rút chùm chìa khóa (giữ)', helpLabel: 'Giữ dây xích cho khỏi kêu (giữ E)', wait: 'Xích sẽ kêu. Cần 1 đồng đội giữ dây xích (điểm xanh)' },
      { id: 'cells', type: 'multi', time: 210, lv: 3, t: (st) => 'Chia nhau mở 6 phòng phạt (' + st.count + '/6)', spots: (L) => L.cellSpots, hold: 3, label: 'Mở khóa phòng phạt (giữ)' },
      { id: 'med', type: 'carry', time: 270, lv: 3, t: (st) => 'Mang 2 hộp cứu thương từ phòng y tế cho anh Lộc (' + st.count + '/2)', items: (L) => L.meds, to: (L) => L.injured, what: 'hộp cứu thương', look: 'kit' },
      { id: 'splint', type: 'together', time: 100, lv: 2, t: 'Nẹp chân cho anh Lộc: 2 người cùng giữ E', at: (L) => L.injuredHelp, r: 2, key: 'nep', hold: 7, label: 'Nẹp chân anh Lộc (2 người cùng giữ)',
        say: [['Anh Lộc', 'Đưa tôi ra gần miệng cống phía nam. Tôi đi chậm, đừng bỏ xa quá.']] },
      { id: 'escort', type: 'escort', time: 270, lv: 4, t: 'Dìu anh Lộc tới chỗ nấp gần miệng cống', from: (L) => L.injured, to: (L) => L.hideout,
        via: () => [[-60, 37.8], [-43, 38.4], [-40.6, 39.4], [-40.4, 45], [-34, 45.4], [-32, 57], [14, 57.4]],
        say: [['Anh Lộc', 'Đêm nay ông Tư qua lấy tiền ở biệt thự. Nghe lỏm dưới cửa sổ là biết mã két.']] },
      { id: 'spy', type: 'sync', time: 220, lv: 4, t: (st) => 'Cúi dưới cửa sổ biệt thự nghe lỏm ông Tư (' + st.secs + '/20 giây)', spots: (L) => [L.spy], key: 'nghe', secs: 20, crouch: true,
        labels: ['Nghe lỏm (cúi người, giữ E)'],
        lines: [[1, 'Quản khu', 'Lô vừa rồi toàn đứa chạy khỏe đấy. Bên Campuchia còn hàng không, anh Tư?'],
          [7, 'Ông Tư', 'Còn. Tụi nó thấy ông già người Việt là tin liền. Một lon nước ngọt là xong.'],
          [13, 'Quản khu', 'Tiền với sổ giao người tôi cất két. Mã vẫn như cũ…']],
        say: [['', 'Hai người bỏ ra sân, cửa biệt thự không khóa. Cả đội đã nghe được mã két.']] },
      { id: 'safe', type: 'panel', time: 150, lv: 4, t: 'Mở két, lấy sổ giao người của ông Tư', at: (L) => L.safe, label: 'Mở két', kind: 'code',
        note: (st, d) => 'Mã két: ' + d.safeCode.split('').join(' '),
        spec: (d) => ({ title: 'Két của quản khu', hint: 'Mã nghe lỏm được: ' + d.safeCode.split('').join(' '), code: d.safeCode }),
        say: [['', 'Cuốn sổ ghi từng chuyến tàu, từng người, từng lần nhận tiền. Trang nào cũng có chữ ký ông Tư.']] },
      { id: 'valves', type: 'window', time: 220, lv: 4, t: (st) => 'Xả cống: vặn cả 3 van trong 28 giây (' + st.count + '/3' + (st.left ? ' · còn ' + st.left + ' giây' : '') + ')', spots: (L) => L.valves, secs: 28, hold: 2.5, label: 'Vặn van xả cống (giữ)' },
      { id: 'grate', type: 'together', time: 120, lv: 3, t: 'Nhấc song sắt miệng cống: 2 người cùng giữ E', at: (L) => L.drain, r: 2.2, key: 'cong', hold: 6, label: 'Nhấc song sắt (2 người cùng giữ)' },
      { id: 'drain', type: 'gather', time: 170, lv: 3, t: (st) => 'Cả đội tập trung ở miệng cống (' + st.count + '/' + st.total + ')', at: (L) => L.drain, r: 4 },
    ],
  },

  // ------------------------------------------------------------------------------------------------
  {
    name: 'Rừng biên giới', border: true, spawn: 5, post: (L, p) => (p.z < 118 ? L.post : L.post2), postName: 'gốc cây ven đường mòn',
    intro: [['', 'Cống thoát nước dẫn ra rừng biên giới. Sông Moei còn 200 m.'],
      ['Chị Thiri', '(tiếng Việt lơ lớ) Tôi là người làng bên này. Theo dải vải hồng tôi buộc, đừng đi đường khác.']],
    missions: [
      { id: 'ribbon', type: 'multi', ordered: true, time: 240, lv: 3, t: (st) => 'Lần theo 6 dải vải hồng theo thứ tự (' + st.count + '/6)', spots: (L) => L.ribbons, r: 1.8, hold: 1.5, label: 'Gỡ dải vải, tìm dải kế tiếp (giữ)', bots: false },
      { id: 'planks', type: 'carry', time: 270, lv: 4, t: (st) => 'Khiêng 3 tấm ván bắc cầu qua suối (' + st.count + '/3)', items: (L) => L.planks, to: (L) => L.bridgeSpot, what: 'tấm ván', look: 'plank' },
      { id: 'gate', type: 'support', time: 200, lv: 4, t: 'Qua chốt gác: 1 người căng xích (điểm xanh), 1 người tháo khóa', at: (L) => L.chain, help: (L) => L.chainHelp, key: 'chot', hold: 6,
        label: 'Tháo khóa cổng chốt (giữ)', helpLabel: 'Căng xích cho khỏi kêu (giữ E)', wait: 'Xích sẽ kêu. Cần 1 đồng đội căng xích (điểm xanh)' },
      { id: 'bamboo', type: 'carry', time: 330, lv: 4, t: (st) => 'Khiêng 4 bó tre ra bờ sông làm bè (' + st.count + '/4)', items: (L) => L.poles, to: (L) => L.raftSpot, what: 'bó tre', look: 'pole' },
      { id: 'lash', type: 'sync', time: 150, lv: 3, t: (st) => 'Buộc bè: giữ 2 đầu cùng lúc (' + st.secs + '/14 giây)', spots: (L) => L.lash, key: 'be', secs: 14,
        labels: ['Buộc đầu bè trái (giữ E)', 'Buộc đầu bè phải (giữ E)'] },
      { id: 'board', type: 'gather', time: 130, lv: 3, t: (st) => 'Cả đội lên bè (' + st.count + '/' + st.total + ')', at: (L) => L.board, r: 3.6 },
      { id: 'row', type: 'paddle', time: 150, lv: 3, t: (st) => 'Cùng chèo qua sông Moei (' + st.count + '/' + st.need + ' nhịp)', per: 24,
        say: [['Thiếu tá Anan', '(qua phiên dịch) Tới đất Thái rồi. Mọi người an toàn.']] },
    ],
  },

  { name: 'Về nhà', airport: true, missions: [{ id: 'home', type: 'airport' }] },
];

G.MYANMAR = { ACTS, draw, total: ACTS.reduce((n, a) => n + a.missions.length, 0) };
})(window.G);
