// panel.js — the small hands-on puzzles of the Myanmar map: keypad, memory, choice, questions, radio dial, paddling.
// A panel does not stop the world: the player stands still but guards still see them (S.panel: actors.js localExposed),
// and the panel says so when somebody does. W / S / Esc or the Close button steps away from it.
(function (G) {
'use strict';
const S = G.state, P = G.player;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let cur = null;

// `fast`: react on pointerdown (memory, paddling: rapid taps must all count); keyboards still get click
function button(text, cls, fn, fast) {
  const b = el('button', cls, text); b.type = 'button';
  if (fast) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    b.addEventListener('click', (e) => { if (e.detail === 0) fn(); });
  } else b.addEventListener('click', fn);
  return b;
}
function say(text, cls) { const e = $('puzzle-msg'); e.textContent = text || ''; e.dataset.kind = cls || ''; }
function wrong(text) {
  if (!cur) return;
  G.sfx('buzz'); say(text, 'bad');
  if (cur.spec.wrong) cur.spec.wrong();
}
function solved() {
  if (!cur) return;
  const f = cur.spec.done;
  close(); G.sfx('pickup');
  if (f) f();
}

// ---------------- the kinds: each returns { tick(dt), key(code) } ----------------
const KIND = {
  code(box, o) {
    let typed = '';
    const show = el('output', 'pz-code'), grid = el('div', 'pz-keys');
    const draw = () => { show.textContent = o.code.split('').map((_, i) => typed[i] || '_').join(' '); };
    const press = (d) => {
      if (d === 'del') { typed = typed.slice(0, -1); draw(); return; }
      if (typed.length >= o.code.length) return;
      typed += d; G.sfx('type'); say(''); draw();
      if (typed.length < o.code.length) return;
      if (typed === o.code) { solved(); return; }
      typed = ''; draw(); wrong('Sai mã. Báo động kêu lên, mất 15 giây.');
    };
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) grid.append(button(d, 'pz-key', () => press(d), true));
    grid.append(button('⌫', 'pz-key', () => press('del'), true), button('0', 'pz-key', () => press('0'), true));
    box.append(show, grid); draw();
    return { key(code) { const m = /^(?:Digit|Numpad)(\d)$/.exec(code); if (m) press(m[1]); else if (code === 'Backspace') press('del'); else return false; return true; } };
  },
  memory(box, o) {
    const NAMES = ['▲', '▶', '▼', '◀'], pads = el('div', 'pz-pads'), state = el('p', 'pz-state');
    let round = 0, seq = [], at = 0, show = 0, t = 0.8, showing = true, litT = 0;
    const bs = NAMES.map((n, i) => { const b = button(n, 'pz-pad', () => press(i), true); b.dataset.i = i; pads.append(b); return b; });
    const light = (i) => { bs.forEach((b, k) => b.classList.toggle('lit', k === i)); };
    function next() { seq = o.make(round); at = 0; show = 0; t = 0.9; showing = true; state.textContent = 'Nhìn kỹ · lượt ' + (round + 1) + '/' + o.rounds; }
    function press(i) {
      if (showing || !cur) return;
      light(i); litT = 0.18; G.sfx('beep');
      if (seq[at] !== i) { wrong('Sai thứ tự. Camera báo động, xem lại từ đầu.'); round = 0; next(); return; }
      say('');
      if (++at < seq.length) return;
      if (++round >= o.rounds) { solved(); return; }
      next();
    }
    box.append(state, pads); next();
    return {
      tick(dt) {
        if (litT > 0) { litT -= dt; if (litT <= 0) light(-1); }
        if (!showing) return;
        t -= dt; if (t > 0) return;
        if (show >= seq.length * 2) { showing = false; light(-1); state.textContent = 'Bấm lại đúng thứ tự (' + seq.length + ' nút)'; return; }
        if (show % 2) { light(-1); t = 0.22; } else { light(seq[show / 2]); G.sfx('beep'); t = 0.55; }
        show++;
      },
      key(code) { const i = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(code); if (i < 0) return false; press(i); return true; },
    };
  },
  choice(box, o) {
    const list = el('div', 'pz-list');
    o.items.forEach((it, i) => {
      const b = button('', 'pz-opt', () => {
        if (i === o.answer) { solved(); return; }
        b.disabled = true; wrong(o.wrongText || 'Sai. Mất 15 giây.');
      });
      b.append(el('b', '', (i + 1) + '. ' + it[0])); if (it[1]) b.append(el('span', '', it[1]));
      list.append(b);
    });
    if (o.clues) { const ul = el('ul', 'pz-clues'); for (const c of o.clues) ul.append(el('li', '', c)); box.append(ul); }
    box.append(list);
    return { key(code) { const m = /^Digit([1-9])$/.exec(code), b = m && list.children[+m[1] - 1]; if (!b) return false; if (!b.disabled) b.click(); return true; } };
  },
  quiz(box, o) {
    let at = 0;
    const q = el('p', 'pz-q'), list = el('div', 'pz-list');
    const draw = () => {
      const it = o.qs[at]; q.textContent = (at + 1) + '/' + o.qs.length + ' · ' + it.q; list.textContent = '';
      it.a.forEach((text, i) => list.append(button((i + 1) + '. ' + text, 'pz-opt', () => {
        if (i !== it.ok) { at = 0; draw(); wrong('Sai cách cứu người. Làm lại từ câu đầu.'); return; }
        say('Đúng.', 'good');
        if (++at >= o.qs.length) solved(); else draw();
      })));
    };
    box.append(q, list); draw();
    return { key(code) { const m = /^Digit([1-9])$/.exec(code), b = m && list.children[+m[1] - 1]; if (!b) return false; b.click(); return true; } };
  },
  tune(box, o) {
    let f = o.start, held = 0;
    const show = el('output', 'pz-code'), bar = el('div', 'pz-signal'), fill = el('i'), row = el('div', 'pz-dial');
    bar.append(fill);
    const move = (d) => { f = G.clamp(Math.round((f + d) * 10) / 10, o.min, o.max); G.sfx('type'); };
    for (const [t, d] of [['−1', -1], ['−0,1', -0.1], ['+0,1', 0.1], ['+1', 1]]) row.append(button(t, 'pz-key', () => move(d), true));
    box.append(show, bar, row);
    return {
      tick(dt) {
        const off = Math.abs(f - o.target), k = Math.max(0.03, 1 - off / 6), on = off < 0.05;
        show.textContent = f.toFixed(1).replace('.', ',') + ' MHz';
        fill.style.width = (on ? 100 : k * 88 + Math.sin(performance.now() / 70) * 2) + '%';
        bar.classList.toggle('on', on);
        held = on ? held + dt : 0;
        say(on ? 'Bắt được sóng. Giữ nguyên…' : off < 1 ? 'Gần lắm rồi.' : 'Toàn tiếng rè. Dò theo vạch tín hiệu.', on ? 'good' : '');
        if (held >= 1.5) solved();
      },
      key(code) {
        const d = { ArrowLeft: -0.1, ArrowRight: 0.1, ArrowDown: -1, ArrowUp: 1 }[code];
        if (d === undefined) return false;
        move(d); return true;
      },
    };
  },
  paddle(box, o) {
    const BEAT = 0.85;
    let t = 0, last = -1, beat = 0;
    const prog = el('div', 'pz-signal'), fill = el('i'), row = el('div', 'pz-oars'), txt = el('p', 'pz-state');
    prog.append(fill);
    const hit = (side) => {
      if (!cur || last === beat) return;
      last = beat;
      if (side === beat % 2) { G.sfx('splash'); say('Đúng nhịp.', 'good'); o.stroke(1); } else say('Lệch nhịp! Chèo bên đang sáng.', 'bad');
    };
    const bs = [button('◀ Trái (A)', 'pz-pad', () => hit(0), true), button('Phải (D) ▶', 'pz-pad', () => hit(1), true)];
    row.append(bs[0], bs[1]); box.append(txt, prog, row);
    return {
      tick(dt) {
        t += dt; beat = Math.floor(t / BEAT);
        bs.forEach((b, i) => b.classList.toggle('lit', beat % 2 === i && last !== beat));
        const [n, need] = o.progress();
        txt.textContent = 'Cả đội cùng chèo: ' + Math.floor(n) + '/' + need + ' nhịp';
        fill.style.width = Math.min(100, n / need * 100) + '%';
      },
      key(code) { if (code === 'KeyA' || code === 'ArrowLeft') hit(0); else if (code === 'KeyD' || code === 'ArrowRight') hit(1); else return false; return true; },
    };
  },
};

// ---------------- open / close ----------------
function open(spec) {
  if (cur) close();
  cur = { spec, warn: false };
  S.panel = spec.kind; S.hold = null;
  P.frozen = true; P.speed = 0; P.running = false;
  G.input.keys = {}; G.input.joyX = G.input.joyY = 0; G.input.use = false;
  G.unlockPointer();
  $('puzzle-title').textContent = spec.title;
  $('puzzle-hint').textContent = spec.hint || ''; $('puzzle-hint').hidden = !spec.hint;
  $('puzzle-warn').hidden = true;
  const body = $('puzzle-body'); body.textContent = ''; body.className = 'pz-' + spec.kind;
  say('');
  cur.ui = KIND[spec.kind](body, spec);
  $('puzzle-close').hidden = !!spec.locked;
  $('puzzle').hidden = false;
}
function close() {
  if (!cur) return;
  cur = null; S.panel = '';
  $('puzzle').hidden = true;
  G.input.keys = {};
  if (!S.busy && !S.tied) { P.frozen = false; P.pose = null; }
}
function tick(dt) {
  if (!cur) return;
  if (S.tied || S.busy || S.ended) { close(); return; } // caught, or a scene took over
  const seen = !cur.spec.locked && !!(G.mySight && G.mySight.seen);
  if (seen !== cur.warn) { cur.warn = seen; $('puzzle-warn').hidden = !seen; }
  if (cur.ui.tick) cur.ui.tick(dt);
}
// true = the key was used here (game.js onKey)
function key(code) {
  if (!cur || S.paused) return false;
  if (cur.ui.key && cur.ui.key(code)) return true;
  if (!cur.spec.locked && (code === 'Escape' || code === 'KeyW' || code === 'KeyS')) { close(); return true; }
  return false;
}
$('puzzle-close').addEventListener('click', close);

G.panel = { open, close, tick, key, isOpen: () => !!cur };
})(window.G);
