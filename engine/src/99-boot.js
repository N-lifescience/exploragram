// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Editor.tag();       // 원본 보관 전: 화면과 원본에 같은 편집 번호를 붙인다
  Source.capture();   // 엔진이 DOM을 바꾸기 전의 원본(저장할 때 쓴다)
  Stage.init();
  MathTex.init();   // 어절 보정보다 먼저: $…$ 자리를 잡는다
  Parts.init();   // Nav보다 먼저: 정답 상자 내용을 단계로 묶는다
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  KeepWords.apply(Stage.deck);   // 목차 제목을 뽑은 뒤 어절을 감싼다
  Anim.init();     // 어절 보정 뒤: 세어 올리기 숫자를 글자로 다시 쓴다
  await Store.init();
  await Session.init();
  Ink.init();      // Session.doc이 있어야 한다
  await Toolbar.init();
  Board.init();    // 툴바 자리(slots.board)에 버튼을 넣는다
  await Settings.init();
  Editor.init();   // 툴바(slots.misc)에 편집 단추를 넣는다
  Print.init();
  Live.init();     // 툴바(slots.misc)에 실시간 단추. 학생 역할이면 입장 화면
  // 수식이 있으면 그려질 때까지(최대 5초) 기다린다. 그래야 ready 뒤 점검이 그린 수식을 잰다.
  await Promise.race([MathTex.ready, new Promise((r) => setTimeout(r, 5000))]);
  Audit.init();    // ?audit도 모든 준비가 끝난 다음 실행한다
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML.audit = () => Audit.run();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels, Ask, InkGeom, InkModel, Store, Session, Tools, Ink, Toolbar, icon, Board, Settings, KeepWords, Print, Audit, Parts, TocSlide, Answer, Blank, Zoom, Expr, Stepper, MapReveal, Yearline, Sort, Quiz, Short, Order, Calc, Plot, Zip, Pptx, Source, PptFill, Timer, Picker, Score, Checklist, Hotspots, Poll, Labeling, Media, Anim, MathTex, Particles, Editor, Live, LiveCore };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
