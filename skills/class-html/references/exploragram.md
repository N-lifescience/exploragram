# 익스플로라그램(Exploragram)

## 무엇이 익스플로라그램인가

세 가지가 있으면 익스플로라그램이다.

1. **손잡이**: 학생이 바꾸는 입력 한두 개(슬라이더, 단추 묶음). 셋을 넘기지 않는다. 「시장에 맡기기」처럼 저절로 움직이게 하는 단추를 더해도 된다.
2. **함께 바뀌는 두 표현**: 그림과 함께 수치·식·그래프·막대 가운데 하나 이상이 같은 계산으로 움직인다.
3. **결과에 따라 달라지는 문장**: "팽압이 0이다", "양보하는 성향이 퍼진다"처럼 지금 값이 무엇을 뜻하는지 한 줄로 말한다.

누르면 글이 열리기만 하는 것, 퀴즈, 분류 카드는 익스플로라그램이 아니다.

단추를 누르면 설명 글이나 카드 목록만 바뀌는 것도 아니다. 고른 값으로 무엇인가를 계산해야 한다. 자리, 길이, 개수, 비율, 판정 가운데 하나가 값에 따라 달라지고 그림이 그것을 보여 준다.

**몇 개?** 한 차시(PPT 10~25장)에 보통 2~4개. 헷갈리는 지점마다 하나씩이고, 법칙 둘을 한 익스플로라그램으로 묶어도 된다.

## 설계 순서

1. 헷갈리는 지점을 한 문장으로 쓴다. 예: "부풀수록 물을 더 빨아들일 것 같다."
2. 그 지점을 가르는 변수를 찾는다. 예: 세포 부피. 이 변수가 손잡이가 된다.
3. 변수가 바뀌면 무엇이 보여야 오개념이 깨지는지 정한다. 예: 세포가 커지는 그림과, 흡수력 막대가 줄어드는 모습을 함께 보여 준다.
   - 변하는 것과 함께 변하지 않는 것도 보여 준다. 기하에서는 모양을 바꿔도 그대로인 성질이 그 차시의 결론인 경우가 많다. 예: 삼각형의 꼭짓점을 옮겨도 무게중심은 중선을 2:1로 나눈다.
4. 계산 규칙을 정한다.
   - 교과서 식이 있으면 그 식을 쓴다.
   - 식이 없는 교과(윤리·사회·국어)는 개념을 지키는 단순한 모형을 만든다. 저울의 무게, 세대마다 바뀌는 비율, 부등호 같은 것이다.
   - 모형 수치는 `data-ai="모형 수치"`로 표시하고, 화면에도 '모형'이라고 적는다.
5. 극단값을 확인한다. 최솟값·최댓값·경계값에서 그림과 문장이 말이 되는지 본다. 0으로 나누면 '?'를 보인다.

## 교과별 아이디어

- **과학**: 식으로 그림이 바뀌는 모식도(흡수력 = 삼투압 − 팽압, 옴의 법칙 회로, 렌즈 상), 변인 슬라이더와 그래프 위 지금 값 표시, 입자 상자(확산·삼투·기체), 시간 막대(세포 분열 단계, 판 이동).
- **수학**: 계수 슬라이더에 따라 그래프와 식이 함께 바뀌는 것, 시행 횟수를 늘리면 상대도수가 확률에 다가가는 시뮬레이션, 도형 변형과 넓이 식.
  - 분수함수의 계수 막대와 점근선, 나눈 개수 막대를 늘리면 직사각형 넓이의 합이 정적분 값에 다가가는 것, 꼭짓점 좌표를 바꿔도 그대로인 무게중심의 비.
  - 풀이가 여럿이면 비교 전환(`.switch`)으로 풀이를 하나씩 연다. 수식은 `$…$`로 써서 교과서처럼 보이게 한다(`components.md`의 수식).
- **사회**:
  - 지리: 출산율·사망률로 인구 피라미드를 바꾼다.
  - 일반사회: 수요·공급 곡선을 옮기면 균형점이 움직인다. 득표율을 바꾸면 의석 계산이 바뀐다.
  - 역사: 연도 막대로 세력 지도를 색칠한다. 조건 단추로 선거권 범위를 판정한다. 기준 단추를 고르면 인물 카드가 축 위에서 자리를 옮겨 같은 편이 바뀐다. 문서의 조항을 고르면 세력별 찬반 막대가 달라진다.
- **윤리**: 두 원리의 무게를 비교하는 저울, 세대별 전략 비율 시뮬레이션, 벤담의 쾌락 계산(기준별 점수), 정언 명령 보편화 시험(모두가 그렇게 하면 어떻게 되나).
- **국어**: 장면 막대에 따라 인물의 정서 곡선과 표정이 바뀌는 것, 서술자 위치를 바꾸면 같은 장면의 문장이 달라지는 것, 문장 성분을 옮기면 의미가 달라지는 것, 시기 단추와 단계 막대로 표기와 발음이 함께 바뀌는 것.
- **영어·제2외국어**: 시제 타임라인 막대(사건 시점과 말하는 시점), 두 문장을 관계사로 합치는 전환.
- **정보**: 정렬·탐색을 한 단계씩 추적하며 비교 횟수를 세는 것, 비트를 켜고 끄면 십진수가 바뀌는 것, 가중치 막대를 밀면 예측 직선과 오차 막대, 평균 제곱 오차가 함께 바뀌는 것.
- **기술·가정, 예체능**: 영양·전력 계산기와 그림, 템포·박자 막대와 악보 표시.

## 엔진에 붙이는 뼈대

그림·그래프는 왼쪽, 손잡이(슬라이더·단추)와 수치는 오른쪽 칸에 둔다. 교사 대부분이 오른손잡이라 판 앞에서 오른쪽 손잡이를 밀어도 몸이 그림을 가리지 않고, 학생은 왼쪽에서 오른쪽으로 읽으며 그림을 먼저 본다.

아래 뼈대는 상대 부피 0.85~1.30을 다루는 모형이다. 슬라이더는 '시작'(가림)에서 시작하고, 첫 조작에서 익스플로라그램이 열린다. 코드는 세 곳으로 나눠 넣는다. CSS는 `<head>`의 `<style>`에, 장은 본문에, 스크립트는 `</body>` 바로 앞에 둔다. 익스플로라그램이 쓸 수 있는 높이는 제목 아래 약 470px(ppt 테마, `data-sec`이 있는 장)이다.

```html
<!-- 장 -->
<section class="slide" id="absorb" data-sec="2. 삼투" data-title="흡수력 익스플로라그램">
  <h2>세포가 부풀면 물을 더 빨아들일까?</h2>
  <div class="dh" data-ai="흡수력 익스플로라그램" data-activity>
    <div class="dh-view">
      <svg viewBox="0 0 600 320" aria-label="세포 그림과 흡수력 막대">
        <ellipse id="ab-cell" cx="200" cy="160" rx="120" ry="90" fill="#DFF0ED" stroke="#0F766E" stroke-width="6"/>
        <rect id="ab-bar" x="430" y="280" width="70" height="0" fill="#9A6B06"/>
        <text x="465" y="312" font-size="26" text-anchor="middle">흡수력</text>
      </svg>
      <div class="dh-veil" id="ab-veil"><span>막대를 밀어 보자</span></div>
      <p class="dh-out" id="ab-out"></p>
    </div>
    <div>
      <p class="dh-lab">세포 부피 <b id="ab-v-out">시작</b></p>
      <input type="range" id="ab-v" min="0" max="10" value="0" autocomplete="off" aria-label="세포 부피">
      <p class="dh-calc" id="ab-eq" data-ai="모형 수치">흡수력 = 삼투압 − 팽압 (모형)</p>
    </div>
  </div>
</section>
```

```css
.dh { display: grid; grid-template-columns: 1fr 400px; gap: 28px; margin-top: 16px; }
.dh-view { position: relative; }
.dh-view svg { display: block; width: 100%; max-height: 340px; }
.dh-veil { position: absolute; inset: 0; display: grid; place-items: center; border: 3px dashed #B8C4CE; border-radius: 18px; background: #EEF2F5; color: #5C6B78; font-size: 28px; }
.dh-veil[hidden] { display: none; }
.dh input[type=range] { width: 100%; height: 56px; }
.dh button { min-height: 56px; font-size: 24px; }
.dh-lab, .dh-out { font-size: 26px; }
.dh-calc { font-size: 22px; }
```

```html
<script>
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const EQ = '흡수력 = 삼투압 − 팽압 (모형)';
  function drawAbsorb() {
    const k = +$('#ab-v').value;                 // 0 = 시작(가림)
    $('#ab-veil').hidden = k > 0;
    if (!k) { $('#ab-v-out').textContent = '시작'; $('#ab-eq').textContent = EQ; $('#ab-out').textContent = ''; return; }
    const v = 0.85 + (k - 1) * 0.05;             // 상대 부피 0.85~1.30
    const osm = 8.7 / v;
    const tur = v <= 1 ? 0 : 6.4 * ((v - 1) / 0.35) ** 1.6;
    const s = osm - tur;
    $('#ab-v-out').textContent = v.toFixed(2) + '배';
    $('#ab-cell').setAttribute('rx', 120 * v);
    $('#ab-cell').setAttribute('ry', 90 * v);
    $('#ab-bar').setAttribute('height', s * 24);
    $('#ab-bar').setAttribute('y', 280 - s * 24);
    $('#ab-eq').textContent = `흡수력 ${s.toFixed(1)} = 삼투압 ${osm.toFixed(1)} − 팽압 ${tur.toFixed(1)} (모형)`;
    $('#ab-out').textContent = tur === 0 ? '팽압이 0이다. 흡수력이 가장 크다.' : '부풀수록 팽압이 커져 흡수력이 준다.';
  }
  $('#ab-v').addEventListener('input', drawAbsorb);
  $('#ab-v').addEventListener('change', (e) => e.target.blur());   // 손을 떼면 초점을 풀어 → 키·리모컨이 다시 장을 넘기게
  drawAbsorb();                                  // 첫 그리기는 직접 부른다
});
</script>
```

- 화면 글은 `textContent`로 바꾸는 것이 기본이다. 굵게·색 같은 꾸밈이 필요하면 코드에 적어 둔 글만 `innerHTML`로 넣는다. 학생이 입력한 글은 절대 `innerHTML`로 넣지 않는다.
- **슬라이더는 손을 떼면(`change`) `blur()`로 초점을 푼다.** 엔진은 초점이 입력란에 있으면 키를 무시하므로, 풀지 않으면 슬라이더를 만진 뒤 → 키와 리모컨이 장을 넘기지 않고 슬라이더 값을 바꾼다. 엔진 계산 상자는 이미 그렇게 한다.
- 슬라이더에 `autocomplete="off"`를 붙인다. 새로고침 때 브라우저가 값을 되살려 가림막이 열린 채 시작하는 것을 막는다.
- 첫 그리기는 `DOMContentLoaded` 안에서 직접 부른다. 주소로 익스플로라그램 장을 바로 열면 그 장의 `onShow`가 불리지 않는다.
- 가림막 글은 `<span>` 하나로 감싼다. 감싸지 않고 `<br>`을 쓰면 두 줄이 격자 칸 둘로 갈려 위아래로 벌어진다.
- 시간·연도 막대는 첫 칸을 '시작'(가림)으로 두고, 둘째 칸부터 실제 값(0초, 1783년)을 둔다. 눈금 글자는 손잡이의 실제 자리에 둔다. 손잡이 지름이 `T`, 칸 위치가 0~1의 `f`이면 `left: calc(T / 2 + (100% - T) * f)`, `transform: translateX(-50%)`.
- 측정값과 모형값이 섞이면 모형값에만 '(모형)'을 붙이고, PPT 표의 값은 '표의 값'이라고 밝힌다.
- 단추만 있는 익스플로라그램은 자동 점검이 활동으로 세지 않는다. 익스플로라그램을 감싼 요소에 `data-activity`를 붙이면 센다(뼈대처럼).
- 펜 모드에서도 슬라이더와 단추는 조작된다.
- 장이 보일 때 움직임을 시작해야 하면 `ClassHTML.onShow((slide, i) => …)`를, 넘길 때 멈춰야 하면 `ClassHTML.onHide`를 쓴다. 장을 넘겨도 직접 짠 익스플로라그램의 상태는 그대로 남는다. 다시 들어올 때 처음으로 돌리려면 `onShow`에서 값을 0으로 되돌린다.
- 익스플로라그램이 여럿이면 장마다 `draw…` 함수를 하나씩 두고, id 앞머리(`ab-`, `vg-`)로 서로 섞이지 않게 한다.
- SVG 화살촉(`marker`)은 그 SVG 안에 id를 따로 두고 `marker-end` 속성으로 건다. 다른 장의 SVG에 있는 marker를 가리키면 보이지 않는다.

## 스크립트 없이: 계산 상자로 만드는 익스플로라그램

코드를 실행해 확인할 수 없는 환경(채팅 AI)이라면 이 방법이 더 안전하다. 엔진 계산 상자(`.calc`)가 수를 셈하고, 단계 막대(`.reveal data-name`)가 손잡이와 0단계 가림을 맡는다. 그림은 CSS 변수로 움직인다.

```html
<div class="calc" data-ai="모형 수치" data-let="v = 0.80 + k * 0.05; t = v <= 1 ? 0 : 6.4 * ((v - 1) / 0.35) ^ 1.6; s = 8.7 / v - t">
  <div class="reveal" data-name="k" data-stops="시작|0.85|0.90|0.95|1.00|1.05|1.10|1.15|1.20|1.25|1.30" style="display: grid; grid-template-columns: 1fr 400px; gap: 28px">
    <div class="veil">
      <svg viewBox="0 0 400 300" width="400"><ellipse class="cell" cx="200" cy="150" rx="120" ry="90" data-style="--s: v"/></svg>
    </div>
    <div data-at="1">
      <p>세포 부피 <output data-expr="v" data-digits="2"></output>배</p>
      <p>흡수력 <output data-expr="s" data-digits="1"></output> (모형)</p>
      <div class="bar" data-value="s" data-max="10.5"></div>
      <p data-show="t == 0">팽압이 0이다. 흡수력이 가장 크다.</p>
      <p data-show="t > 0">부풀수록 팽압이 커져 흡수력이 준다.</p>
    </div>
  </div>
</div>
```

```css
.cell { transform-box: fill-box; transform-origin: center; transform: scale(var(--s, 1)); transition: transform .3s; fill: #DFF0ED; stroke: #0F766E; stroke-width: 6; }
```

- `k`는 지금 칸 번호다(시작 = 0). `.veil`과 `data-at="1"`이 0단계에서 결과를 가린다.
- `data-style="--s: v"`로 CSS 변수를 넘기고, CSS가 `scale()`·`translate()`·색을 바꾼다. 위치 보간은 `translate(calc((var(--x0) + (var(--x1) - var(--x0)) * var(--t)) * 1px), 0)`처럼 쓴다.
- SVG 속성은 `data-attr="width: 216 * v; points: pts"`로 바꾼다. 세대마다 바뀌는 시뮬레이션은 `data-let`에 `p1 = …; p2 = f(p1); …`처럼 풀어 쓰고, 꺾은선 점은 글자를 이어 붙여 만든다.
- 문법은 `components.md` 8절(계산 상자)과 1절(단계 막대)에 있다.

## 상태를 찍어 확인하기

엔진 자동 점검은 직접 짠 익스플로라그램의 처음 상태(가림막)만 본다. `scripts/states.mjs`는 처음에 모든 장을 점검하고, `states.json`에 적은 상태마다 조작한 뒤 그 장을 다시 점검하고 찍는다. 넘침·잘림·작은 글자와 수업 스크립트의 예외(이벤트 처리기 안에서 난 것 포함)를 적어 준다.

```json
[
  { "slide": 2, "name": "min", "js": "const r = document.querySelector('#ab-v'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "max", "js": "const r = document.querySelector('#ab-v'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "back", "js": "const r = document.querySelector('#ab-v'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true }))" }
]
```

`node scripts/states.mjs 수업.html 폴더 states.json` — `slide`는 1부터 센 장 번호다(`ClassHTML.go`는 0부터). 최솟값·최댓값·경계값(팽압이 0이 되는 곳 같은)·모든 단추·'시작'으로 되돌리기를 적는다. 찍힌 그림을 직접 열어 겹침과 계산값을 본다.

## 내기 전 확인

- [ ] 헷갈리는 지점마다 익스플로라그램이 있는가. 손잡이가 그림과 수치(식·그래프)를 함께 바꾸는가.
- [ ] 최솟값·최댓값·경계값에서 그림, 수치, 문장이 맞는가. 직접 눌러 보고 찍어 보았는가.
- [ ] 첫 조작 전에는 결과가 가려져 있는가.
- [ ] 익스플로라그램 안 글자(SVG 포함)가 20px 이상인가. 손잡이와 단추가 56px 이상인가.
- [ ] 모형 수치에 `data-ai="모형 수치"`를 붙이고 화면에 '모형'이라고 적었는가.
- [ ] 단추를 눌렀을 때 글만 바뀌는 장에 `data-activity`를 붙이지 않았는가.
- [ ] 장에 '원본 PPT', '익스플로라그램 ①' 같은 만드는 쪽 말이 없는가.
