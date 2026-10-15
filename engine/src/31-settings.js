// ⚙ 설정: 이 PC의 저장소에 저장하고 수업 화면에 즉시 적용한다.
const Settings = {
  values: { motionOff: false, printInk: false, palmErase: true, palmSize: 0 },
  button: null,
  extras: [],   // 다른 모듈이 설정 창 아래에 붙이는 묶음(그림 채우기·저장 등)
  ITEMS: [
    ['motionOff', '움직임 끄기', '슬라이드 전환과 단계 효과를 끕니다'],
    ['printInk', '인쇄에 판서 포함', '지금 반의 판서와 칠판을 함께 인쇄합니다'],
    ['palmErase', '손등·손바닥으로 지우기', '넓게 닿는 터치를 지우개로 씁니다. 잘 안 되면 「손으로 맞추기」'],
  ],

  async init() {
    const saved = await Store.get('settings');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(this.values)) {
        if (typeof saved[key] === typeof this.values[key] && (typeof saved[key] !== 'number' || Number.isFinite(saved[key]))) this.values[key] = saved[key];
      }
    }
    this.apply();
    if (!this.button || !this.button.isConnected) {
      this.button = Toolbar.btn('gear', '설정', (e) => Toolbar.togglePop(e.currentTarget, () => this.panel()));
      Toolbar.slots.misc.append(this.button);
    }
  },

  panel() {
    return h('div', { class: 'ch-pop-settings' }, h('h3', { text: '설정' }),
      ...this.ITEMS.map(([key, label, desc]) => h('label', { class: 'ch-switch' },
        h('input', {
          type: 'checkbox', 'data-key': key, checked: this.values[key],
          onchange: (e) => this.set(key, e.target.checked),
        }),
        h('span', null, h('b', { text: label }), h('small', { text: desc })))),
      Toolbar.menuItem('손으로 맞추기 (이 칠판에서 손등 지우개 인식)', () => { Toolbar.closePop(); this.calibrate(); }),
      ...this.extras.map((fn) => fn()));
  },

  set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.values, key)) return;
    this.values[key] = typeof this.values[key] === 'number' ? Math.max(0, Number(value) || 0) : !!value;
    this.apply();
    return Store.set('settings', { ...this.values });
  },

  apply() {
    document.documentElement.classList.toggle('ch-motion-off', this.values.motionOff);
    emit('motion', this.values.motionOff);   // 저장값은 첫 장이 보인 뒤에 읽으므로, 그 사이 저절로 움직인 부품이 멈추게 알린다
    Ink.palmErase = this.values.palmErase;
    Ink.palmSize = this.values.palmSize;
    for (const input of qsa('.ch-pop-settings input[data-key]')) input.checked = this.values[input.dataset.key];
  },

  // 손가락 끝으로 한 번, 손등(검지 마디)으로 한 번 문질러 이 칠판이 알려 주는 닿은 크기를 잰다.
  // 둘의 가운데를 지우개 기준으로 삼는다. 칠판이 크기를 알려 주지 않으면 그렇다고 말해 준다.
  calibrate() {
    const sizes = [0, 0];
    let step = 0;
    const msg = h('p', { class: 'ch-calib-msg' });
    const read = h('p', { class: 'ch-calib-read' });
    const close = h('button', { type: 'button', class: 'ch-calib-close', text: '닫기', onclick: () => box.remove() });
    const box = h('div', { class: 'ch-calib', role: 'dialog', 'aria-label': '손등 지우개 맞추기' }, msg, read, close);
    const say = () => {
      msg.textContent = step === 0 ? '① 손가락 끝으로 화면을 한 번 그어 주세요' : '② 지우개처럼 손등(검지 마디)으로 문질러 주세요';
    };
    const size = (e) => Math.max(e.width || 0, e.height || 0);
    box.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      e.preventDefault();
      if (e.pointerType !== 'touch') { read.textContent = '마우스·펜이 아니라 칠판에 손을 대 주세요.'; return; }
      sizes[step] = Math.max(sizes[step], size(e));
    });
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !e.buttons) return;
      sizes[step] = Math.max(sizes[step], size(e));
      read.textContent = `닿은 크기 ${Math.round(size(e))}`;
    });
    box.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch' || !sizes[step]) return;
      if (step === 0) { step = 1; say(); read.textContent = `손가락 ${Math.round(sizes[0])}`; return; }
      const [finger, palm] = sizes;
      box.classList.add('is-done');
      if (palm < finger * 1.4 || palm - finger < 4) {
        msg.textContent = '이 칠판은 손등과 손가락을 크기로 구별해 알려 주지 않아요.';
        read.textContent = `손가락 ${Math.round(finger)} · 손등 ${Math.round(palm)} — 지우개는 툴바·양옆 도구에서 골라 주세요.`;
        return;
      }
      const cut = Math.round((finger + palm) / 2);
      this.set('palmErase', true);
      this.set('palmSize', cut);
      msg.textContent = '맞췄어요. 이제 손등으로 문지르면 지워집니다.';
      read.textContent = `손가락 ${Math.round(finger)} · 손등 ${Math.round(palm)} → 기준 ${cut}`;
    });
    say();
    document.body.append(box);
  },
};
