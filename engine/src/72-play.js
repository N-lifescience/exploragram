// 재생: 슬라이더에 data-play를 붙이면 엔진이 시간을 흘려 준다(최솟값 → 최댓값). 계산 상자 안이든 직접 짠 그림이든 같다.
// 작성 모양: <input type="range" name="t" min="0" max="10" step="0.1" value="0" data-play="6">  (6초 동안, 비우면 6초)
//   data-loop: 끝에 닿으면 처음부터 다시. 「▶ 재생」·「한 칸」·「처음으로」 단추는 엔진이 슬라이더 바로 위에 단다.
// 값이 바뀔 때마다 input 이벤트를 보낸다(e.chPlay = 한 칸에 걸리는 ms, 계산 상자는 그 시간 안에 그림을 옮긴다).
// 「한 칸」과 「처음으로」는 사람이 슬라이더를 민 것처럼 보낸다(chPlay 없음, 계산 상자는 0.6초 동안 흘려 보낸다).
// 손으로 밀면 멈추고, 장을 넘기면 멈춘다. 움직임 끄기여도 재생은 된다(선생님이 누른 것이므로).
const PLAY_SEC = 6;

const Play = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('input[type="range"][data-play]', Stage.deck)) {
      if (el.closest('.ch-stops')) continue;   // 단계 막대의 슬라이더는 단계 막대가 다룬다
      const sec = Number(el.dataset.play);
      const run = h('button', { type: 'button', class: 'ch-play-run', text: '▶ 재생' });
      const one = h('button', { type: 'button', class: 'ch-play-step', text: '한 칸' });
      const back = h('button', { type: 'button', class: 'ch-reset', text: '처음으로' });
      el.before(h('div', { class: 'ch-play' }, run, one, back));
      const item = { el, run, one, back, sec: Number.isFinite(sec) && sec > 0 ? clamp(sec, 1, 120) : PLAY_SEC,
        loop: el.hasAttribute('data-loop'), running: false, raf: 0, p: 0, last: 0 };
      run.addEventListener('click', (e) => { this.toggle(item); e.currentTarget.blur(); });
      one.addEventListener('click', (e) => { this.stop(item); this.step(item); e.currentTarget.blur(); });
      back.addEventListener('click', (e) => { this.stop(item); this.seek(item, 0, true, false); e.currentTarget.blur(); });   // 되감기는 손 조작처럼 흘려 보낸다
      el.addEventListener('pointerdown', () => this.stop(item));
      el.addEventListener('input', (e) => { if (e.isTrusted) this.stop(item); this.mark(item); });
      el.addEventListener('change', () => this.mark(item));
      this.list.push(item);
      this.mark(item);
    }
    on('hide', (slide) => { for (const item of this.list) if (slide.contains(item.el)) this.stop(item); });
  },

  range(item) {
    const lo = Number(item.el.min || 0);
    const hi = Number(item.el.max || 100);
    const st = item.el.step === 'any' ? 0 : Number(item.el.step || 1);
    return { lo, hi, st };
  },

  // 0~1 자리로 옮긴다. 값이 바뀌었으면 input(끝이면 change도)을 보낸다. timed가 false면 재생 시간(chPlay)을 붙이지 않는다.
  seek(item, p, end, timed = true) {
    const { lo, hi, st } = this.range(item);
    item.p = clamp(p, 0, 1);
    const before = item.el.value;
    item.el.value = String(lo + (hi - lo) * item.p);   // 브라우저가 step 칸에 맞춘다
    if (item.el.value === before) return;
    const steps = st > 0 && hi > lo ? (hi - lo) / st : 0;
    const ms = steps ? (item.sec * 1000) / steps : 0;
    const send = (type) => { const ev = new Event(type, { bubbles: true }); if (timed) ev.chPlay = ms; item.el.dispatchEvent(ev); };
    send('input');
    if (end) send('change');
  },

  // 「한 칸」: step만큼 나아간다(step이 any면 범위의 20분의 1). 끝에서는 data-loop일 때만 처음으로 돌아간다.
  step(item) {
    const { lo, hi, st } = this.range(item);
    if (!(hi > lo)) return;
    const v = Number(item.el.value);
    if (v >= hi) { if (item.loop) this.seek(item, 0, true, false); return; }
    this.seek(item, (Math.min(hi, v + (st > 0 ? st : (hi - lo) / 20)) - lo) / (hi - lo), true, false);
  },

  // 끝에 닿으면 「한 칸」을 잠근다(되풀이하는 슬라이더는 처음으로 돌아가므로 잠그지 않는다)
  mark(item) {
    item.one.disabled = !item.loop && Number(item.el.value) >= Number(item.el.max || 100);
  },

  start(item) {
    if (item.running) return;
    const { lo, hi } = this.range(item);
    item.p = hi > lo ? clamp((Number(item.el.value) - lo) / (hi - lo), 0, 1) : 0;
    if (item.p >= 1) this.seek(item, 0);   // 끝에 있으면 처음부터
    item.running = true;
    item.run.textContent = '❚❚ 멈춤';
    item.last = performance.now();
    const tick = (now) => {
      if (!item.running) return;
      const dt = Math.min(0.1, Math.max(0, now - item.last) / 1000);
      item.last = now;
      let p = item.p + dt / item.sec;
      if (p >= 1 && !item.loop) { this.seek(item, 1, true); this.stop(item); return; }
      if (p >= 1) p -= 1;
      this.seek(item, p);
      item.raf = requestAnimationFrame(tick);
    };
    item.raf = requestAnimationFrame(tick);
  },

  stop(item) {
    if (!item.running) return;
    item.running = false;
    cancelAnimationFrame(item.raf);
    item.run.textContent = '▶ 재생';
  },

  toggle(item) { if (item.running) this.stop(item); else this.start(item); },
};
