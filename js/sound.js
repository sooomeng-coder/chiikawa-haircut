// 효과음은 파일 없이 Web Audio로 합성한다.
const Sound = (() => {
  const KEY = 'chiikawa-haircut:muted';
  let ctx = null, master = null, noise = null, buzz = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* 저장소를 못 쓰면 기본값 */ }

  // 브라우저는 사용자 조작 뒤에만 소리를 허용하므로 시작 버튼에서 부른다.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function burst(t, freq, dur, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function tone(t, freq, dur, vol, type = 'sine', to = null) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // 사각
  function snip() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = 0.9 + Math.random() * 0.2;
    burst(t, 4300 * p, 0.04, 0.55);
    burst(t + 0.065, 5400 * p, 0.035, 0.4);
  }

  // 위잉 (켜져 있는 동안 계속)
  function buzzStart() {
    if (!ctx || buzz) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.06);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 118;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 237;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 48;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    o1.connect(lp);
    o2.connect(o2g).connect(lp);
    lfo.connect(lfoGain).connect(g.gain);
    lp.connect(g).connect(master);
    [o1, o2, lfo].forEach((o) => o.start(t));
    buzz = { g, nodes: [o1, o2, lfo] };
  }

  function buzzStop() {
    if (!ctx || !buzz) return;
    const t = ctx.currentTime;
    buzz.g.gain.cancelScheduledValues(t);
    buzz.g.gain.setTargetAtTime(0, t, 0.03);
    buzz.nodes.forEach((o) => o.stop(t + 0.25));
    buzz = null;
  }

  // 쓰다듬기
  function pet() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = 0.9 + Math.random() * 0.25;
    tone(t, 660 * p, 0.14, 0.12, 'sine', 990 * p);
  }

  function fanfare() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.11, f, 0.28, 0.16, 'triangle'));
    [659.25, 783.99, 1046.5].forEach((f) => tone(t + 0.5, f, 0.7, 0.09, 'triangle'));
  }

  function click() {
    if (!ctx) return;
    tone(ctx.currentTime, 880, 0.06, 0.08, 'sine', 1200);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  }

  return { unlock, snip, buzzStart, buzzStop, pet, fanfare, click, setMuted, isMuted: () => muted };
})();
