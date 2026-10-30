(() => {
  'use strict';

  const SIZE = Art.SIZE;
  const GRID = 128;             // 남은 털을 셀 때 쓰는 격자
  const CELL = SIZE / GRID;
  const DONE_RATIO = 0.04;      // 남은 털이 이보다 적으면 자동 완성

  const TOOLS = {
    scissors: { radius: 26 },
    clipper: { radius: 60 },
    hand: { radius: 0 },
  };

  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const rig = $('#rig');
  const cutCanvas = $('#cut');
  const hairCanvas = $('#hair');
  const faceImg = $('#face');
  const cursorEl = $('#cursor');
  const fx = $('#fx');
  const fxCtx = fx.getContext('2d');
  const cutCtx = cutCanvas.getContext('2d', { willReadFrequently: true });
  const hairCtx = hairCanvas.getContext('2d', { willReadFrequently: true });
  const small = document.createElement('canvas');
  small.width = small.height = GRID;
  const smallCtx = small.getContext('2d', { willReadFrequently: true });

  const state = {
    tool: 'scissors',
    started: false,
    finished: false,
    last: null,
    snipTravel: 0,
    petTravel: 0,
    face: '',
    faceUntil: 0,
    lockUntil: 0,
    buzzing: false,
    buzzLast: 0,
    dirty: false,
    progress: 0,
  };

  let sources = null;
  let mask = null;  // 털 많은 그림과 자른 그림이 다른 칸 = 잘라야 할 털
  let maskTotal = 1;
  let petTimer = 0;
  const particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- 털 상태 ----------
  function grid(src) {
    smallCtx.clearRect(0, 0, GRID, GRID);
    smallCtx.drawImage(src, 0, 0, GRID, GRID);
    return smallCtx.getImageData(0, 0, GRID, GRID).data;
  }

  function buildMask() {
    const a = grid(sources.hairFull);
    const b = grid(sources.hairCut);
    mask = new Uint8Array(GRID * GRID);
    let total = 0;
    for (let i = 0; i < mask.length; i++) {
      const j = i * 4;
      if (a[j + 3] < 40) continue;
      const diff = Math.abs(a[j + 3] - b[j + 3]) + Math.abs(a[j] - b[j])
        + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]);
      if (diff > 90) { mask[i] = 1; total++; }
    }
    maskTotal = Math.max(1, total);
  }

  // 남은 털 비율 (0~1)
  function measure() {
    const d = grid(hairCanvas);
    let left = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] && d[i * 4 + 3] > 90) left++;
    state.progress = 1 - left / maskTotal;
    return left / maskTotal;
  }

  function hairHits(p, r) {
    const x0 = Math.max(0, Math.floor(p.x - r)), y0 = Math.max(0, Math.floor(p.y - r));
    const x1 = Math.min(SIZE, Math.ceil(p.x + r)), y1 = Math.min(SIZE, Math.ceil(p.y + r));
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return 0;
    const d = hairCtx.getImageData(x0, y0, w, h).data;
    let n = 0;
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const dx = x0 + x - p.x, dy = y0 + y - p.y;
        if (dx * dx + dy * dy > r * r || d[(y * w + x) * 4 + 3] < 60) continue;
        if (mask[(((y0 + y) / CELL) | 0) * GRID + (((x0 + x) / CELL) | 0)]) n++;
      }
    }
    return n;
  }

  function onBody(p) {
    if (p.x < 0 || p.y < 0 || p.x >= SIZE || p.y >= SIZE) return false;
    return cutCtx.getImageData(p.x | 0, p.y | 0, 1, 1).data[3] > 0
      || hairCtx.getImageData(p.x | 0, p.y | 0, 1, 1).data[3] > 0;
  }

  function resetHair() {
    hairCtx.globalCompositeOperation = 'source-over';
    hairCtx.clearRect(0, 0, SIZE, SIZE);
    hairCtx.drawImage(sources.hairFull, 0, 0, SIZE, SIZE);
  }

  // ---------- 표정 ----------
  function setFace(name) {
    if (state.face === name) return;
    state.face = name;
    faceImg.src = sources.faces[name];
    faceImg.classList.remove('pop');
    void faceImg.offsetWidth;
    faceImg.classList.add('pop');
  }

  // 잠시 다른 표정을 보여준다. lock이면 그동안 다른 표정으로 안 바뀐다.
  function express(name, hold = 800, lock = false) {
    const now = performance.now();
    if (now < state.lockUntil) return;
    setFace(name);
    state.faceUntil = now + hold;
    if (lock) state.lockUntil = now + hold;
  }

  // 아무것도 안 할 때 표정은 얼마나 잘랐는지에 따라
  function baseFace() {
    if (state.progress < 0.3) return 'cry';
    if (state.progress < 0.7) return 'calm';
    return 'relief';
  }

  // ---------- 도구 ----------
  function toCanvas(e) {
    const r = hairCanvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  }

  function unit() {
    return hairCanvas.getBoundingClientRect().width / SIZE;
  }

  function cut(prev, p, dist, e) {
    const r = TOOLS[state.tool].radius;
    const hits = hairHits(p, r);
    hairCtx.save();
    hairCtx.globalCompositeOperation = 'destination-out';
    hairCtx.lineCap = 'round';
    hairCtx.lineWidth = r * 2;
    hairCtx.beginPath();
    hairCtx.moveTo(prev.x, prev.y);
    hairCtx.lineTo(p.x + 0.01, p.y);
    hairCtx.stroke();
    hairCtx.restore();

    if (state.tool === 'clipper') startBuzz();
    if (!hits) return;
    state.dirty = true;

    const u = unit();
    const n = state.tool === 'clipper' ? Math.min(5, 1 + ((hits / 25) | 0)) : (Math.random() < 0.6 ? 1 : 0);
    for (let i = 0; i < n && particles.length < 320; i++) {
      spawnHair(e.clientX + rand(-r, r) * u * 0.7, e.clientY + rand(-r, r) * u * 0.7, u);
    }
    if (state.tool === 'scissors') {
      state.snipTravel += dist;
      if (state.snipTravel > 40 || dist === 0) {
        state.snipTravel = 0;
        Sound.snip();
        restartClass(cursorEl, 'snip');
      }
    }
    express('endure', 700);
  }

  function pet(p, dist, e) {
    if (!onBody(p)) return;
    express('happy', 900);
    rig.classList.add('petting');
    clearTimeout(petTimer);
    petTimer = setTimeout(() => rig.classList.remove('petting'), 350);
    state.petTravel += dist;
    if (state.petTravel > 90) {
      state.petTravel = 0;
      spawnHeart(e.clientX, e.clientY - 24 * unit() * 2, unit());
      Sound.pet();
    }
  }

  function startBuzz() {
    state.buzzLast = performance.now();
    if (state.buzzing) return;
    state.buzzing = true;
    Sound.buzzStart();
    stage.classList.add('buzz');
    cursorEl.classList.add('buzzing');
    express('shock', 900, true);
  }

  function stopBuzz() {
    if (!state.buzzing) return;
    state.buzzing = false;
    Sound.buzzStop();
    stage.classList.remove('buzz');
    cursorEl.classList.remove('buzzing');
  }

  function selectTool(name) {
    state.tool = name;
    state.last = null;
    stopBuzz();
    document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tool === name)));
    cursorEl.innerHTML = Art.ICONS[name];
    cursorEl.dataset.tool = name;
    Sound.click();
  }

  // ---------- 입력 ----------
  function moveCursor(e) {
    const r = stage.getBoundingClientRect();
    const lift = e.pointerType === 'mouse' ? 0 : -48; // 손가락에 가리지 않게 위로
    cursorEl.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top + lift}px)`;
    cursorEl.classList.add('show');
  }

  function hideCursor() {
    cursorEl.classList.remove('show');
  }

  function onPointer(e) {
    if (!state.started || state.finished) return;
    // 마우스는 올리기만 해도, 펜·터치는 누른 채로 움직일 때만
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return;
    moveCursor(e);
    const p = toCanvas(e);
    const prev = state.last || p;
    state.last = p;
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (state.tool === 'hand') pet(p, dist, e);
    else cut(prev, p, dist, e);
  }

  // ---------- 파티클 ----------
  function spawnHair(x, y, u) {
    particles.push({
      kind: 'hair', x, y,
      vx: rand(-90, 90), vy: rand(-170, -30),
      rot: rand(0, Math.PI * 2), vr: rand(-7, 7),
      life: 0, max: rand(1.4, 2.3),
      size: rand(30, 56) * u, seed: Math.random() * 100,
      tuft: Math.random() < 0.08,
    });
  }

  function spawnHeart(x, y, u) {
    particles.push({ kind: 'heart', x, y, vx: rand(-25, 25), vy: -80, rot: rand(-0.3, 0.3), vr: 0, life: 0, max: 1.1, size: 40 * u, seed: 0 });
  }

  function spawnConfetti() {
    const r = stage.getBoundingClientRect();
    const colors = ['#ff9fb6', '#ffd56b', '#8fd3c7', '#a9c8ff', '#ffffff'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        kind: 'confetti', x: r.left + rand(0, r.width), y: r.top + rand(-40, r.height * 0.2),
        vx: rand(-60, 60), vy: rand(-220, 40), rot: rand(0, 6), vr: rand(-9, 9),
        life: 0, max: rand(1.8, 2.8), size: rand(6, 11), seed: Math.random() * 100,
        color: colors[i % colors.length],
      });
    }
  }

  function updateParticles(dt) {
    const H = window.innerHeight;
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt;
      if (q.kind === 'heart') {
        q.vy += 30 * dt;
      } else {
        q.vy = Math.min(q.vy + 900 * dt, q.kind === 'hair' ? 380 : 260);
        q.vx *= 0.985;
        q.x += Math.sin(q.life * 5 + q.seed) * 30 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.life > q.max || q.y > H + 60) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    const dpr = window.devicePixelRatio || 1;
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    fxCtx.lineJoin = 'round';
    fxCtx.lineCap = 'round';
    for (const q of particles) {
      const fade = q.max - q.life < 0.4 ? Math.max(0, (q.max - q.life) / 0.4) : 1;
      fxCtx.save();
      fxCtx.globalAlpha = fade;
      fxCtx.translate(q.x, q.y);
      fxCtx.rotate(q.rot);
      const s = q.size;
      if (q.kind === 'hair' && q.tuft) {
        fxCtx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const rr = k % 2 ? s * 0.3 : s * 0.4;
          fxCtx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        fxCtx.fillStyle = '#fff';
        fxCtx.fill();
        fxCtx.lineWidth = Math.max(1.5, s * 0.08);
        fxCtx.strokeStyle = Art.INK;
        fxCtx.stroke();
      } else if (q.kind === 'hair') {
        fxCtx.beginPath();
        for (let k = 0; k <= 4; k++) fxCtx.lineTo(-s / 2 + (s * k) / 4, k % 2 ? s * 0.18 : -s * 0.18);
        fxCtx.lineWidth = Math.max(1.5, s * 0.09);
        fxCtx.strokeStyle = Art.INK;
        fxCtx.stroke();
      } else if (q.kind === 'heart') {
        fxCtx.beginPath();
        fxCtx.moveTo(0, s * 0.35);
        fxCtx.bezierCurveTo(-s * 0.6, -s * 0.05, -s * 0.3, -s * 0.55, 0, -s * 0.2);
        fxCtx.bezierCurveTo(s * 0.3, -s * 0.55, s * 0.6, -s * 0.05, 0, s * 0.35);
        fxCtx.fillStyle = '#ff8fab';
        fxCtx.fill();
        fxCtx.lineWidth = Math.max(1.5, s * 0.07);
        fxCtx.strokeStyle = Art.INK;
        fxCtx.stroke();
      } else {
        fxCtx.fillStyle = q.color;
        fxCtx.fillRect(-s / 2, -s / 4, s, s / 2);
      }
      fxCtx.restore();
    }
  }

  function resizeFx() {
    const dpr = window.devicePixelRatio || 1;
    fx.width = Math.round(window.innerWidth * dpr);
    fx.height = Math.round(window.innerHeight * dpr);
  }

  // ---------- 진행 ----------
  function finish() {
    if (state.finished || !state.started) return;
    state.finished = true;
    state.last = null;
    stopBuzz();
    hideCursor();
    measure();

    // 남아 있던 털이 한꺼번에 떨어진다
    const r = hairCanvas.getBoundingClientRect();
    const u = r.width / SIZE;
    const extra = Math.round(40 * (1 - state.progress));
    for (let i = 0; i < extra; i++) {
      const a = rand(0, Math.PI * 2), d = rand(220, 320);
      spawnHair(r.left + (512 + Math.cos(a) * d) * u, r.top + (600 + Math.sin(a) * d) * u, u);
    }
    hairCanvas.classList.add('vanish');
    setTimeout(() => {
      hairCtx.clearRect(0, 0, SIZE, SIZE);
      hairCanvas.classList.remove('vanish');
    }, 750);

    setFace('done');
    rig.classList.add('celebrate');
    Sound.fanfare();
    spawnConfetti();
    setTimeout(() => document.body.classList.add('is-done'), 500);
  }

  function reset() {
    stopBuzz();
    particles.length = 0;
    hairCanvas.classList.remove('vanish');
    resetHair();
    Object.assign(state, { finished: false, progress: 0, dirty: false, last: null, lockUntil: 0, faceUntil: 0 });
    rig.classList.remove('celebrate');
    document.body.classList.remove('is-done');
    setFace('cry');
  }

  let lastT = performance.now();
  let lastMeasure = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (state.buzzing && now - state.buzzLast > 220) stopBuzz();
    if (state.started && !state.finished) {
      if (state.dirty && now - lastMeasure > 350) {
        lastMeasure = now;
        state.dirty = false;
        if (measure() < DONE_RATIO) finish();
      }
      if (!state.finished && now > state.faceUntil) setFace(baseFace());
    }
    updateParticles(dt);
    drawParticles();
    requestAnimationFrame(loop);
  }

  function restartClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---------- 시작 ----------
  async function init() {
    sources = await Art.load(window.HAIRCUT_ASSETS);
    cutCtx.drawImage(sources.hairCut, 0, 0, SIZE, SIZE);
    resetHair();
    buildMask();
    setFace('cry');

    document.querySelectorAll('.tool').forEach((b) => {
      b.querySelector('.ico').innerHTML = Art.ICONS[b.dataset.tool];
      b.addEventListener('click', () => selectTool(b.dataset.tool));
    });
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = Art.ICONS[el.dataset.icon]; });
    cursorEl.innerHTML = Art.ICONS[state.tool];
    cursorEl.dataset.tool = state.tool;

    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      }
      state.last = null;
      onPointer(e);
    });
    stage.addEventListener('pointermove', onPointer);
    const release = (e) => {
      state.last = null;
      if (e.pointerType !== 'mouse') { hideCursor(); stopBuzz(); }
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', () => {
      state.last = null;
      hideCursor();
      stopBuzz();
    });

    $('#start').addEventListener('click', () => {
      Sound.unlock();
      Sound.click();
      state.started = true;
      $('#intro').classList.remove('show');
    });
    $('#finish').addEventListener('click', finish);
    $('#reset').addEventListener('click', () => { Sound.click(); reset(); });
    $('#again').addEventListener('click', () => { Sound.click(); reset(); });

    const mute = $('#mute');
    const paintMute = () => {
      const m = Sound.isMuted();
      mute.textContent = m ? '🔇' : '🔊';
      mute.setAttribute('aria-pressed', String(m));
      mute.setAttribute('aria-label', m ? '소리 켜기' : '소리 끄기');
    };
    mute.addEventListener('click', () => { Sound.unlock(); Sound.setMuted(!Sound.isMuted()); paintMute(); });
    paintMute();

    window.addEventListener('keydown', (e) => {
      const tool = { 1: 'scissors', 2: 'clipper', 3: 'hand' }[e.key];
      if (tool && state.started && !state.finished) selectTool(tool);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopBuzz(); });
    window.addEventListener('resize', resizeFx);
    resizeFx();
    requestAnimationFrame(loop);
  }

  init();
})();
