// 그림 불러오기. 실제 그림이 없으면 같은 1024 캔버스 좌표로 임시 그림을 그린다.
const Art = (() => {
  const SIZE = 1024;
  const INK = '#1f1f1f';
  const BLUSH = '#f6a5b5';
  const BLUSH_LINE = '#e2708d';
  const TEAR = '#d6efff';
  const FACE_NAMES = ['cry', 'calm', 'relief', 'endure', 'shock', 'happy', 'done'];

  // 매번 같은 모양이 나오도록 시드 고정 난수
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#fff';
    return [c, ctx];
  }

  function zigzag(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }

  // 털 다 자른 몸
  function drawCut() {
    const [c, ctx] = makeCanvas();
    ctx.lineWidth = 12;
    for (const x of [350, 674]) {
      ctx.beginPath();
      ctx.arc(x, 410, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(512, 612, 236, 220, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 팔, 발
    ctx.lineWidth = 11;
    for (const d of ['M282 650 q-40 20 -10 52', 'M742 650 q40 20 10 52', 'M450 826 q8 24 32 6', 'M542 832 q24 18 32 -6']) {
      ctx.stroke(new Path2D(d));
    }
    return c;
  }

  // 털 많은 몸
  function drawFull() {
    const [c, ctx] = makeCanvas();
    const r = rng(7);
    const cx = 512, cy = 600, N = 90;
    const radii = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 - Math.PI / 2;
      const s = Math.sin(a);
      const base = 300 * (s < 0 ? 1 + 0.12 * -s : 1 - 0.03 * s);
      radii.push(k % 2 === 0 ? base + 30 + r() * 26 : base - 6 - r() * 10);
    }
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const a = ((k % N) / N) * Math.PI * 2 - Math.PI / 2;
      const rad = radii[k % N];
      const x = cx + Math.cos(a) * rad * 1.04;
      const y = cy + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 11;
    ctx.stroke();

    // 바깥쪽 털결
    ctx.lineWidth = 7;
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2;
      const rad = 215 + r() * 55;
      const x = cx + Math.cos(a) * rad * 1.04;
      const y = cy + Math.sin(a) * rad;
      if (x > 360 && x < 670 && y > 540 && y < 740) continue; // 얼굴 자리는 비운다
      const tx = -Math.sin(a), ty = Math.cos(a); // 접선
      const nx = Math.cos(a), ny = Math.sin(a);  // 바깥 방향
      const L = 14 + r() * 8;
      zigzag(ctx, [
        x - tx * L * 1.5, y - ty * L * 1.5,
        x - tx * L * 0.5 + nx * L, y - ty * L * 0.5 + ny * L,
        x + tx * L * 0.5, y + ty * L * 0.5,
        x + tx * L * 1.5 + nx * L, y + ty * L * 1.5 + ny * L,
      ]);
    }
    // 앞머리 (N W 모양)
    ctx.lineWidth = 9;
    zigzag(ctx, [398, 540, 412, 500, 432, 536, 450, 496, 466, 532, 480, 500]);
    zigzag(ctx, [544, 500, 558, 534, 576, 494, 594, 532, 612, 496, 626, 538]);
    zigzag(ctx, [440, 380, 458, 340, 478, 378, 498, 336, 520, 376, 540, 334, 560, 374, 580, 340]);
    return c;
  }

  // ---------- 표정 (1024 캔버스 전체 좌표, 얼굴만) ----------
  const L_EYE = [444, 618];
  const R_EYE = [580, 618];

  function mirror(svg) {
    return `${svg}<g transform="translate(1024 0) scale(-1 1)">${svg}</g>`;
  }
  function blush(hatched = true) {
    const lines = hatched
      ? `<path d="M370 678 l8 -18 M388 680 l8 -18 M406 678 l8 -18" stroke="${BLUSH_LINE}" stroke-width="5" stroke-linecap="round"/>`
      : '';
    return mirror(`<ellipse cx="390" cy="668" rx="36" ry="22" fill="${BLUSH}"/>${lines}`);
  }
  function shinyEye([x, y], r = 18) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`
      + `<circle cx="${x - r * 0.32}" cy="${y - r * 0.38}" r="${r * 0.34}" fill="#fff"/>`
      + `<circle cx="${x + r * 0.3}" cy="${y + r * 0.35}" r="${r * 0.14}" fill="#fff"/>`;
  }
  const stroke = (d, w = 7, extra = '') =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const MOUTH_W = stroke('M494 668 Q503 680 512 668 Q521 680 530 668', 6);

  const FACES = {
    cry: () =>
      blush()
      + mirror(stroke('M408 574 Q432 562 460 556'))
      + shinyEye(L_EYE, 20) + shinyEye(R_EYE, 20)
      + mirror(`<path d="M434 640 Q428 670 436 694 Q446 704 454 690 Q456 664 450 640 Z" fill="${TEAR}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`)
      + MOUTH_W,
    calm: () =>
      blush()
      + mirror(stroke('M414 568 Q436 562 460 566'))
      + shinyEye(L_EYE, 16) + shinyEye(R_EYE, 16)
      + MOUTH_W,
    relief: () =>
      blush()
      + mirror(stroke('M414 566 Q436 558 460 562'))
      + shinyEye(L_EYE, 16) + shinyEye(R_EYE, 16)
      + stroke('M494 664 Q512 684 530 664'),
    endure: () =>
      blush(false)
      + mirror(stroke('M408 578 Q434 562 462 552'))
      + mirror(stroke('M424 602 L462 618 L424 634', 8))
      + stroke('M484 672 q7 -9 14 0 q7 9 14 0 q7 -9 14 0 q7 9 14 0', 6)
      + `<path d="M664 530 Q646 562 664 574 Q682 562 664 530 Z" fill="${TEAR}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`,
    shock: () =>
      blush(false)
      + mirror(stroke('M412 552 Q436 538 462 546'))
      + mirror(`<circle cx="${L_EYE[0]}" cy="${L_EYE[1]}" r="24" fill="#fff" stroke="${INK}" stroke-width="6"/><circle cx="${L_EYE[0]}" cy="${L_EYE[1]}" r="7" fill="${INK}"/>`)
      + `<ellipse cx="512" cy="680" rx="15" ry="20" fill="${INK}"/>`
      + stroke('M470 498 v38 M496 494 v44 M528 494 v44 M554 498 v38', 5, 'style="stroke:#7ea6dc"'),
    happy: () =>
      blush()
      + mirror(stroke('M422 628 Q444 598 466 628', 8))
      + `<path d="M490 660 Q512 694 534 660 Z" fill="#ef8c9a" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
    done: () =>
      blush()
      + mirror(stroke('M414 562 Q436 552 460 556'))
      + mirror(stroke('M420 626 Q444 596 468 626', 8))
      + `<path d="M482 658 Q512 706 542 658 Z" fill="#ef8c9a" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`
      + `<path d="M500 684 Q512 676 524 684 Q518 696 512 696 Q506 696 500 684 Z" fill="#d9566d"/>`
      + mirror('<path d="M318 540 l9 22 l22 9 l-22 9 l-9 22 l-9 -22 l-22 -9 l22 -9 Z" fill="#ffd56b" stroke="#e0a93a" stroke-width="3" stroke-linejoin="round"/>'),
  };

  function svgUrl(body) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ---------- 도구 아이콘 ----------
  const ICONS = {
    scissors: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M33 33 L13 3 Q25 9 37 29 Z" fill="#e3e9f0"/>
      <path d="M31 33 L51 3 Q39 9 27 29 Z" fill="#e3e9f0"/>
      <path d="M27 41 L32 32 L37 41" fill="none"/>
      <circle cx="21" cy="48" r="9" fill="#ff9fb6"/><circle cx="21" cy="48" r="4" fill="#fff"/>
      <circle cx="43" cy="48" r="9" fill="#ff9fb6"/><circle cx="43" cy="48" r="4" fill="#fff"/>
      <circle cx="32" cy="31" r="2.2" fill="${INK}"/></g></svg>`,
    clipper: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M18 9 v-5 M23 9 v-5 M28 9 v-5 M33 9 v-5 M38 9 v-5 M43 9 v-5 M47 9 v-5" fill="none"/>
      <rect x="15" y="8" width="34" height="11" rx="3" fill="#e3e9f0"/>
      <path d="M18 19 H46 L44 54 Q44 60 38 60 H26 Q20 60 20 54 Z" fill="#8fd3c7"/>
      <rect x="28" y="30" width="8" height="13" rx="4" fill="#fff"/></g></svg>`,
    hand: `<svg viewBox="0 0 64 64"><path d="M22 60 Q12 48 13 34 L13 22 Q13 17 17.5 17 Q22 17 22 22 L22 31 L22 11 Q22 6 26 6 Q30 6 30 11 L30 29 L30 8 Q30 3 34 3 Q38 3 38 8 L38 29 L38 12 Q38 7 42 7 Q46 7 46 12 L46 36 L50 30 Q53.5 26 56.5 29 Q59 32 56 36 L47 52 Q43 60 34 60 Z" fill="#ffe2cf" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`,
  };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`));
      img.src = url;
    });
  }

  async function load(cfg = {}) {
    let hairFull = null, hairCut = null;
    if (cfg.hairFull && cfg.hairCut) {
      try {
        [hairFull, hairCut] = await Promise.all([loadImage(cfg.hairFull), loadImage(cfg.hairCut)]);
      } catch (err) {
        console.warn(err.message, '— 임시 그림을 씁니다.');
      }
    }
    if (!hairFull) {
      hairFull = drawFull();
      hairCut = drawCut();
    }
    const faces = {};
    await Promise.all(FACE_NAMES.map(async (name) => {
      const fallback = svgUrl(FACES[name]());
      const path = cfg.faces && cfg.faces[name];
      if (!path) { faces[name] = fallback; return; }
      try {
        await loadImage(path);
        faces[name] = path;
      } catch (err) {
        console.warn(err.message, '— 임시 표정을 씁니다.');
        faces[name] = fallback;
      }
    }));
    return { hairFull, hairCut, faces };
  }

  return { SIZE, INK, ICONS, load };
})();
