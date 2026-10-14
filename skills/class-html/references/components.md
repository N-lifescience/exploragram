# 부품 사전

엔진이 동작을 붙인다. 수업 HTML에는 구조와 `data-*` 속성만 쓴다. 퀴즈·분류 같은 확인 활동과 단계 공개는 부품으로 쓴다. 익스플로라그램(Exploragram)도 부품(계산 상자, 그래프, 입자 상자, 재생)으로 먼저 만들고 맞는 부품이 없을 때만 직접 짠다(`exploragram.md`, 이 문서 12절).

`data-why`·`data-hint`·`data-stops` 같은 속성 값은 글자만 된다(태그 없음). 위첨자·아래첨자는 유니코드로 쓴다(Na⁺, H₂O, x²).

## 0. 뼈대와 공통 모양

```html
<!doctype html>
<html lang="ko" data-deck="world-3-2-5">           <!-- 판서 저장 열쇠: 영문 소문자·숫자·하이픈, 덱마다 다르게 -->
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>자유주의와 민족주의</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/engine/class-html.css">
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/engine/class-html.js"></script>
<style>/* 이 수업만의 모양 */</style>
</head>
<body data-theme="ppt" style="--accent:#C04F15">
<section class="slide cover" id="cover" data-title="표지">…</section>
<section class="slide" id="vienna" data-sec="내용 정리" data-title="빈 체제의 성립">…</section>
</body></html>
```

- 슬라이드마다 고정 `id`(판서가 붙는 열쇠), 목차용 `data-title`, 묶음 이름 `data-sec`(ppt 테마에서는 왼쪽 위 색 띠).
- 무대는 1280×720. 안쪽 여백은 위 72(ppt 테마에서 `data-sec`이 있는 장은 112)·좌우 80·아래 56~64. 점검은 장 밖으로 나간 요소(`out`)와 아래로 넘친 내용(`slide-overflow`)을 오류로 잡는다.
- 이 수업만의 CSS는 그냥 클래스로 쓴다(`.pts { padding: 0 }`). 엔진 기본 글 규칙은 우선순위가 낮아 대개 진다. 다만 장 바탕·표지처럼 장 전체 모양은 `body[data-theme="ppt"] section.slide.cover { … }`처럼 앞에 붙여야 이긴다(`design.md`). 부품 안 모양을 바꿀 때는 부품 클래스부터 쓴다(`.sort .bin { … }`, `.quiz .opt { … }`).
- 엔진은 어절마다 `<ch-w class="w">`로 감싸 낱말 중간에서 줄이 갈리지 않게 한다. `span`이 아니므로 수업 CSS의 `span` 선택자에는 걸리지 않지만, 수업 CSS에 `.w`라는 이름을 쓰면 모든 낱말에 걸린다.

| 모양 | 작성 | 비고 |
|---|---|---|
| 단계 공개 | `<p class="step">` | →로 하나씩. `data-step="2"`가 같으면 함께 |
| 꼬리표 | `<p class="kicker">` | 강조색 선 + 작은 글씨 |
| 형광 강조 | `<mark>` | 노랑 밑줄 형광 |
| 번호 제목 | `<h2 data-n="1">` | 동그라미 번호 |
| 문항 | `<p class="q" data-n="1">` | 큰 번호 + 굵은 물음. 번호 대신 기호도 된다(`data-n="●"`) |
| 번호 목록 | `<ol class="points">` (1)(2), `<ol class="circled">` ①② | |
| 자료 단추 | `<a class="pill" href="…" target="_blank" rel="noopener">` | 색: `style="--pill:#7B3FC4"` |
| 비교표 | `<table class="compare">` | 첫 줄 thead, 첫 칸 th. 머리 색은 띠 색(`--tab`)을 따른다. 바꾸려면 `--table-head`, `--table-side`. 색은 `thead th`와 첫 칸 `th`에만 들어가므로 머리 칸을 `td`로 쓰지 않는다 |
| 빈칸 | `<span class="blank">확산</span>` | 누르면 열린다. 활동으로 치지 않는다 |
| 정답 상자 | `<div class="answer"><p>…</p></div>` | ✓ 단추나 →로 연다. `.answer.sheet`는 흰 답안지 |
| 그림 | `<figure class="fig"><img src="data:…" alt="…"><figcaption>…</figcaption></figure>` | 오른쪽 위 확대 단추, 손 모드에서 눌러 확대. 단추가 그림 속 글자를 가리면 `data-zoom="off"` |
| 표지 | 아래 '표지' 예시 | `img.cover-art`는 오른쪽 560px를 차지한다. 제목은 왼쪽 600px 안에서 `<br>`로 나눈다(겹치면 점검 경고). 그림의 보일 부분은 `style="object-position: 20% 50%"`로 고른다 |
| 수식 | `$x^2 + 1$`(줄 안), `$$E = mc^2$$`(가운데 한 줄) | KaTeX로 그린다(수식이 있을 때만 불러옴). 글자 그대로 $는 `\$`. `$5`처럼 $ 안쪽이 빈칸이면 수식이 아니다 |
| 장 표지 | `<section class="slide chapter" data-sec="2. 확산"><p class="kicker">2</p><h1>확산</h1></section>` | 띠 색 바탕의 소단원 시작 |
| 목차 슬라이드 | `<section class="slide toc"></section>` | 엔진이 `data-sec` 묶음 목록을 만든다(누르면 그 묶음 첫 장) |
| 움직임 | `data-anim="fade-up"`(또는 `fade pop wipe type highlight draw count`), 묶음은 부모에 `data-stagger` | 장이 보일 때마다 재생. `count`는 숫자만 든 요소(`<b data-anim="count">1,234명</b>`), `draw`는 SVG 선. 한 화면에 두세 가지만 |

표지:

```html
<section class="slide cover" id="cover" data-title="표지">
  <img class="cover-art" src="data:image/jpeg;base64,…" alt="표지 그림 설명">
  <div class="band"><p class="kicker">고등학교 생명과학 · 세포와 물질대사</p></div>
  <h1>세포막을 통한<br>물질 이동</h1>
</section>
```

표지 그림은 긴 변 1000px 이상이 좋다(작은 그림을 늘리면 흐리다). 그림이 없으면 `.cover-art`를 빼고 제목을 크게.

## 1. 단계 막대 `.reveal`

PPT로 할 수 없는 '하나씩 열기'. 0단계(전부 가림)에서 시작한다.

```html
<div class="reveal" data-stops="시작|증발|응결|강수">
  <div class="veil">0단계에 빗금으로 가려지는 영역(그림·도식)</div>
  <p data-at="1">1단계부터 보인다</p>
  <p data-only="2">2단계에서만 보인다</p>
  <p data-only="1 3">1단계와 3단계에서 보인다</p>
</div>
```

- `data-stops`: `|`로 나눈 눈금 이름. 첫 칸은 '시작'(없으면 엔진이 붙인다). 이름 안 줄바꿈은 `<br>`. 8칸 이상이면 지금 칸과 양 끝 이름만 보인다.
- 슬라이더는 엔진이 끝에 붙인다. 자리를 정하려면 `<div class="ch-stops"></div>`를 둔다.
- →·리모컨이 막대를 먼저 한 칸씩 연다. 막대가 다 열리면 그 뒤 `.step`, 그다음 장. `data-nav="off"`면 넘기기와 따로.
- 이전 장으로 돌아오면 끝 칸, 그 밖에는 0단계로 들어온다. 인쇄는 끝 칸.
- 막대 바깥에 있는 `data-at`·`data-only`는 그 장에 막대가 하나면 그 막대에, 여럿이면 `data-for="막대 id"`로 묶는다.
- 지금 칸은 `data-pos` 속성에 적힌다. CSS로 칸마다 모양을 바꿀 수 있다: `#fr[data-pos="2"] li:nth-child(3) { … }`.
- `data-only="0"`은 0단계(시작)에만 보이는 안내. `.veil`이 없으면 그림은 처음부터 보이고 `data-at`·`data-only`만 숨는다.
- 막대와 눈금 이름이 약 110px를 차지한다. 단계 막대 자체를 grid·flex로 배치하면 막대는 그 바로 뒤에 붙는다(칸 하나로 끼지 않는다).
- 안에는 표·그림·SVG·카드 무엇이든 넣을 수 있다.

## 2. 비교 전환 `.switch`

```html
<div class="switch" id="fr" data-stops="시작|7월 혁명 1830|2월 혁명 1848">
  <dl data-only="1">…</dl>
  <dl data-only="2">…</dl>
</div>
```

단추형 단계 막대. 단추 줄과 "단추를 눌러 보자" 안내는 `.switch` 안 맨 위에 붙는다(단계 막대의 슬라이더는 맨 아래). 처음엔 아무 단추도 눌려 있지 않다. 나머지는 단계 막대와 같다.

## 3. 그림 지도 단계 공개 `figure.map-reveal`

교과서 지도 그림 위에 근사 다각형을 겹쳐, 아직 아닌 땅을 회색으로 가렸다가 연다.

```html
<figure class="map-reveal fig" id="map-it" style="width:560px" data-stops="시작|1859년 이전|1859~60|1860~61" data-approx="회색은 아직 통일 전 · 근사">
  <img src="data:image/jpeg;base64,…" alt="이탈리아의 통일 지도">
  <svg viewBox="0 0 1600 945">                      <!-- 그림 원래 픽셀 크기와 같은 좌표 -->
    <polygon data-from="2" points="530,25 615,25 …"/>  <!-- 2칸에 열리는 땅(그전엔 회색) -->
    <polygon data-lost="2" points="330,0 402,0 …"/>    <!-- 2칸부터 빗금(잃은 땅) -->
  </svg>
</figure>
<p data-for="map-it" data-only="2"><b>① 카부르</b> 중북부를 병합했다.</p>
```

- 다각형은 '가릴 곳'이다. 그 칸 이전의 영토는 다각형으로 덮지 않는다.
- '근사' 꼬리표는 엔진이 붙인다(`data-approx`로 글을 바꾼다). 좌표는 근사여도 되지만 사실과 맞는 순서·지역이어야 한다.
- 막대(약 110px)는 지도 바로 아래에 붙는다. 지도 폭을 정해(예: 560px) 지도 높이 + 막대가 제목 아래 약 470px 안에 들게 한다. 옆 설명은 `data-for`로 묶는다.

## 4. 연표 막대 `ol.yearline`

```html
<ol class="yearline" data-from="1815" data-to="1871">
  <li data-year="1815" data-tag="유럽">빈 회의, 빈 체제 성립</li>
  <li data-year="1830" data-tag="프랑스" data-flag>7월 혁명</li>
  <li data-year="1861" data-tag="미국" data-color="#C04F15" data-flag>남북 전쟁 발발</li>
</ol>
```

- 축은 연도에 비례한다. 칸은 사건이 있는 해마다 하나(→로 다음 사건 해). 막대는 한 해씩 움직인다.
- `data-tag`마다 색이 정해진다(`data-color`로 그 꼬리표 색 지정). `data-flag`는 축 위 깃발.
- 화면: 지금 연도(큰 글자) + 최근 사건 4개 + 축. 높이 약 380px.

## 5. 분류 카드 `.sort`

```html
<div class="sort">
  <div class="bin" data-bin="l"><h3>자유주의</h3></div>
  <div class="bin" data-bin="n"><h3>민족주의</h3></div>
  <span data-bin="l" data-why="맞을 때 보여 줄 이유" data-hint="틀릴 때 실마리">7월 혁명</span>
  <span data-bin="n" data-why="…" data-hint="…">그리스 독립</span>
</div>
<p class="step">다 맞히면 열리는 정리</p>
```

- 칸이 `.sort` 바로 아래에 있으면 칸 수만큼 열을 나눈다(최대 4).
- 카드는 끌어서 놓거나, 카드→칸 차례로 누른다. 펜을 든 채로도 카드가 움직인다.
- 다 맞히면 이 부품 뒤의 첫 `.step`을 연다. 「다시」 단추가 붙는다.
- 아래에 알림 줄(이유·실마리)이 붙고, 맞힌 카드는 칸 안으로 들어간다. 엔진이 실마리 앞에 "다시 생각해 보자.", 마지막 이유 앞에 "모두 맞혔다!"를 붙인다.
- 칸 안의 빈 곳이나 이미 놓인 카드를 눌러도 그 칸에 놓인다.
- 높이: 풀기 전에는 카드 더미가 칸 위에 놓여 다 푼 뒤보다 길다. 카드 한 줄 60px, 빈 칸 120px, 「다시」·알림 줄 56px, 사이 16px. 칸 2개에 카드 6장(두세 줄)이면 약 400px다. 발문이 두 줄이면 제목(`h2`)을 빼거나 카드를 줄인다. 칸 높이는 이 수업 CSS로 바꾼다(`.sort .bin { min-height: 100px }`).

## 6. 즉시 확인 문제 `.quiz`

```html
<div class="quiz" data-cols="2">
  <button class="opt" data-why="삼투는 막을 사이에 둔 물의 이동이다.">삼투</button>
  <button class="opt" data-ok data-why="맞다. 확산이다.">확산</button>
</div>
<div class="quiz" data-multi data-why="모두 맞혔을 때 풀이">
  <button class="opt" data-ok>능동 수송</button><button class="opt">단순 확산</button>
</div>
```

- 보기마다 `data-why`(왜 맞고 왜 틀린지)를 쓴다. 정답은 `data-ok`(둘 이상이어도 된다).
- 하나 고르기는 누른 보기의 이유가 아래 알림 줄에 나온다. 여러 개 고르기는 「확인」 뒤 잘못 고른 보기와 놓친 보기 아래에 그 보기의 이유가 나오고, 다 맞히면 문제의 `data-why`가 나온다.
- 보기 안에 그림·SVG를 넣어도 된다(그래프 고르기 등).
- 점검은 가장 긴 이유가 나온 상태(여러 개 고르기는 이유가 가장 긴 두 보기를 틀린 상태)까지 잰다. 이유는 한 문장으로 짧게.
- 번호(동그라미 배지 안의 1, 2…)는 엔진이 붙인다(`data-num="off"`로 끔). `data-cols`로 열 수.
- 높이: 보기 한 줄 64px, 사이 12px, 아래 알림 줄 약 60px. 보기 5개면 약 380px다.
- 처음 맞히면 문제 뒤 첫 `.step`을 연다. 인쇄는 정답 표시.
- 실시간 수업에서는 학생이 처음 고른 보기(여러 개 고르기는 「확인」 때 고른 보기)가 교사 「학생 보기」에 보기별 인원으로 모인다. 정답 보기에는 ✓가 붙는다.

### 6-1. 단답 쓰기 `.short`

```html
<div class="short" data-ph="내 생각을 한 문장으로 적어요">
  <p class="ask">바람이 없는데도 냄새가 퍼지는 이유는 무엇일까?</p>
</div>
```

- 엔진이 입력칸과 「보내기」를 붙인다. 200자까지 받는다. `data-ph`는 입력칸 안 안내 글이다.
- 실시간 수업에서는 학생이 보낸 답이 교사 「학생 보기」에 이름 없이 카드로 모인다. 교사는 카드의 ×로 칠판에서 숨길 수 있다.
- 실시간이 아닐 때는 「보내기」를 눌러도 아무 데도 가지 않는다. 생각 열기·예측·한 줄 정리처럼 답이 여럿일 수 있는 물음에 쓴다. 정답이 하나인 물음은 `.quiz`나 `.blank`를 쓴다.
- 높이: 입력칸 약 100px + 알림 줄 약 40px.

## 7. 순서 배열 `ol.order`

```html
<ol class="order">
  <li data-why="처음에는 시야가 넓은 저배율로 찾는다.">저배율 대물렌즈로 돌린다</li>
  <li data-why="…">프레파라트를 재물대에 고정한다</li>
</ol>
```

정답 순서로 쓴다. 엔진이 섞어 내놓고, 학생이 차례로 눌러 쌓으면 자리마다 채점한다. 맞은 칸 아래에 `data-why`가 붙어 길어지므로 항목은 5개 안팎, 이유는 한 줄로. 모두 맞으면 뒤 `.step`을 연다.

## 8. 계산 상자 `.calc` — 입력하면 화면이 계산해서 바뀐다

```html
<div class="calc" style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start" data-const="k = 8.7" data-let="o = k / v; t = v <= 1 ? 0 : 6.44 * ((v - 1) / 0.35) ^ 1.6; s = o - t">
  <div>
  <input type="range" name="v" min="0.85" max="1.35" step="0.01" value="1.1" aria-label="세포 부피">
  <p>부피 <output data-expr="v" data-digits="2"></output></p>
  <p>흡수력 <output data-expr="s" data-digits="1" data-unit="기압"></output></p>
  <div class="bar" data-value="s" data-max="10.5" style="--bar-c:#B45309"></div>
  <p data-show="v < 1">원형질 분리: 팽압이 0이다.</p>
  <p data-class="is-ok: s > 0; is-bad: s <= 0">상태</p>
  </div>
  <svg viewBox="0 0 300 120" width="300"><rect data-attr="width: 216 * v; x: 150 - 108 * v" y="20" height="80"/></svg>
</div>
```

- 입력(변수 이름은 `name`): `input[type=range|number|checkbox|radio|text]`, `textarea`, `select`, 단추 고르기 `<button data-set="sex" data-value="여">`(처음엔 `aria-pressed="true"`인 것, 없으면 첫 단추).
- 단계 막대를 변수로: `.calc` 안의 `<div class="reveal" data-name="v" data-stops="…">` → 지금 칸 번호가 `v`. 0단계 시작이 필요한 활동은 이것을 쓴다.
- 계산: `data-const`(한 번), `data-let`(바뀔 때마다 앞에서부터).
- 단추 값(`data-value`)은 수처럼 생기면 수(`year == 1918`), 아니면 글자(`sex == '여'`)다.
- 출력: `data-expr`(글자, `data-digits` 소수 자리, `data-unit` 단위, `data-comma` 천 단위 쉼표 3,000), `data-show`(참이면 보임), `data-class="클래스: 식; …"`, `data-style="속성: 식"`(숫자는 px, `--변수`는 그대로), `data-attr="속성: 식"`(SVG), `.bar[data-value][data-max]`(막대 길이).
- 식 문법: 수, `'글자'`, `+ - * / % ^`, `== != < <= > >=`, `&& || !`, `조건 ? 가 : 나`, `× ÷ − ≤ ≥ ≠`도 된다. 함수: `abs min max round(x,n) floor ceil sqrt pow exp ln log(10이 밑) sin cos tan asin acos atan rad deg clamp(x,lo,hi) if(c,a,b) fix(x,n) len(글자) sign`. 상수 `pi e true false`. 글자 + 수는 이어 붙인다.
- 단위: 한글 단위(`초`·`원`·`인분`·`년`)는 숫자에 붙고(360초), 기호 단위(`℃`·`mL`·`%`)는 한 칸 띄운다(10 ℃). 단위 앞에 빈칸을 넣지 않는다.
- 식이 틀리면 그 자리에 '?'가 나오고 점검(D)에 오류로 뜬다. 근거 없는 수치를 지어내지 않는다. 단위를 쓴다.
- 계산 상자의 슬라이더는 중간값에서 시작해도 된다(단계를 여는 막대가 아니다). 엔진이 손을 뗄 때 초점을 풀어 주므로 → 키가 그대로 장을 넘긴다. 0단계 가림이 필요하면 위의 `.reveal data-name`을 쓴다.
- 입자·점이 많은 모식도는 `data-attr`로 점마다 식을 쓰지 말고 입자 상자 `figure.particles`(13절)를 쓰거나, 그림 몇 장을 단계 막대로 바꾼다.
- **움직임**: 사람이 손잡이를 움직이면 수(`data-expr`), 막대(`.bar`), `data-attr`, `data-style` 값이 0.6초 동안 끝값으로 흘러간다. 끝값이 정수면 정수로 세어 간다. 수만 다른 글자 값(`'rotate(' + a + ' 100 100)'`, 꺾은선 `points`)도 흐르고 `#` 색과 글자 결과는 바로 바뀐다. 그래프 곡선과 입자 상자는 흐르지 않고 다시 그린다.
- 바로 바뀌게 하려면 그 요소나 상자에 `data-tween="off"`를, 더 천천히 움직이려면 `data-tween="1.5"`(초)를 붙인다. 파일 전체는 `<html data-tween="off">`로 끈다. 자동 점검, `states.mjs`, 수업 스크립트가 값을 바꾸면 바로 끝값이 되고 ⚙ 「움직임 끄기」도 따른다.
- 시간을 엔진이 흘리게 하려면 슬라이더에 `data-play`를 붙인다(16절).

## 9. 그래프 `figure.plot`

```html
<figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-height="340" data-xlabel="세포의 상대적 부피" data-ylabel="압력(기압)">
  <i data-line="k / x" data-label="삼투압" data-color="#0F766E"></i>
  <i data-line="k / x - (x <= 1 ? 0 : 6.44 * ((x - 1) / 0.35) ^ 1.6)" data-label="흡수력" data-dash></i>
  <i data-vline="v"></i>
  <i data-point="v, s" data-label="지금"></i>
</figure>
```

`.calc` 안에 두면 그 변수(v, s, k…)를 쓰고 입력이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 `x`. 폭은 감싼 칸 폭, 높이는 `data-height`. 가로 기준선은 상수 식(`<i data-line="vmax" data-dash>`), 점 색은 `data-color`.

| 하고 싶은 것 | 쓰는 법 |
|---|---|
| 눈금 간격 정하기, 천 단위 쉼표 | 그래프에 `data-ystep="500"`·`data-xstep`, `data-comma`(4,000). 눈금 글자가 길면 왼쪽 여백이 저절로 늘어 세로축 이름과 겹치지 않는다 |
| 선을 일부 구간만 | 선에 `data-x="10, 60"`(식도 된다: `data-x="min(a, b), max(a, b)"`) |
| 조건이 맞을 때만 선·점 | `data-show="qd != qs"`. 거짓이면 선과 범례가 함께 숨는다. 세로 표시선(`data-vline`)과 선분(`data-path`)에도 쓴다 |
| 측정값(표의 점 여러 개) | `<i data-points="10, 360; 20, 260; 40, 160" data-label="측정값"></i>` 점으로 찍히고 범례에 동그라미 |
| 범례 | `data-label`이 있는 선·측정값이 그래프 위에 범례로 나온다. 움직이는 점의 이름은 점 옆에 |

예: 가격 슬라이더 `p`에 따라 초과량 구간만 굵게 보이기 `<i data-line="p" data-x="min(qd, qs), max(qd, qs)" data-show="qd != qs" data-label="초과량"></i>`.

### 9-1. 끌 수 있는 점 `data-drag`

학생이 그래프 위의 점을 직접 끌어 옮긴다. 점의 자리가 계산 상자 변수가 되어 `data-let`, 선, 점, 값(`data-expr`)이 함께 다시 계산된다. 아래는 두 점을 지나는 직선이다.

```html
<div class="calc" style="display:grid;grid-template-columns:560px 1fr;gap:28px;align-items:start" data-let="m = (by - ay) / (bx - ax); k = ay - m * ax">
  <figure class="plot" data-x="-5, 5" data-y="-5, 5" data-xstep="1" data-ystep="1" data-height="360" aria-label="두 점 A, B를 지나는 직선">
    <i data-line="m * x + k" data-show="ax != bx"></i>
    <i data-vline="ax" data-show="ax == bx && ay != by"></i>
    <i data-drag="ax, ay" data-value="-2, -1" data-label="A" data-snap="1"></i>
    <i data-drag="bx, by" data-value="2, 3" data-label="B" data-snap="1" data-color="#2563EB"></i>
  </figure>
  <div>
    <p>A(<output data-expr="ax"></output>, <output data-expr="ay"></output>), B(<output data-expr="bx"></output>, <output data-expr="by"></output>)</p>
    <p data-show="ax != bx">기울기 <output data-expr="m" data-digits="2"></output>, y절편 <output data-expr="k" data-digits="2"></output></p>
    <p data-show="ax == bx && ay != by">x = <output data-expr="ax"></output>인 세로선이다. 기울기가 없다.</p>
    <p data-show="ax == bx && ay == by">두 점이 겹쳤다. 직선이 하나로 정해지지 않는다.</p>
  </div>
</div>
```

| 하고 싶은 것 | 쓰는 법 |
|---|---|
| 끌 수 있는 점 | `.calc` 안 그래프에 `<i data-drag="ax, ay" data-value="-2, -1" data-label="A">`. `data-drag`는 가로와 세로 변수 이름, `data-value`는 처음 자리다 |
| 눈금에 붙이기 | `data-snap="1"`(가로와 세로 간격이 다르면 `"1, 0.5"`). 그래프의 `data-xstep`, `data-ystep`과 같게 두면 격자점에 붙는다. 빼면 아무 자리에나 놓인다 |
| 점 색 | `data-color="#2563EB"`. 빼면 강조색이다 |
| 계산된 점(무게중심, 내분점) | 움직이지 않는 점 `data-point="gx, gy"`로 찍고 좌표는 `data-let`에서 계산한다 |
| 선분, 다각형 | `<i data-path="ax, ay; bx, by; cx, cy" data-close data-fill>`. 점을 차례로 잇는다. `data-close`면 처음 점으로 돌아와 닫고 `data-fill`이면 옅게 칠한다. `data-dash`, `data-color`, `data-label`도 쓸 수 있다 |
| 세로선으로 바꿔 그리기 | 두 점의 가로 값이 같으면 기울기가 없다. `<i data-vline="ax" data-show="ax == bx">`로 그린다 |

- 점은 그래프 범위(`data-x`, `data-y`) 밖으로 나가지 않는다. 펜을 든 채로도 끌린다. 누르는 자리는 지름 56px이고 점 이름은 24px다.
- 키보드로는 Tab으로 점을 고른 뒤 화살표 키를 누른다. 눈금이 있으면 한 칸씩, 없으면 범위의 20분의 1씩 움직인다.
- 변수 이름은 점마다 두 개다. `x`는 곡선의 가로 변수라서 쓰지 않는다. `data-const`, `data-let`, 슬라이더 같은 입력과 이름이 겹치지 않게 한다.
- 끌 수 있는 점이 있으면 그래프 위쪽과 오른쪽 여백이 30px로 늘어난다. 점이 범위 끝에 가도 누르는 자리가 그래프 안에 들어온다.
- 점검(D)은 잘못 쓴 이름, 범위 밖의 처음 자리, 잘못 쓴 `data-snap`을 오류로 알린다. 점을 범위의 네 귀퉁이로 하나씩 옮기면서 넘침도 잰다. 좌표를 보여 주는 글은 음수나 소수로 길어져도 한 줄에 들어가게 칸을 넉넉히 잡는다.

## 10. 그림 자리 `img[data-ppt]`

```html
<img data-ppt="12-2" alt="빈 회의 풍자화" width="480">
```

- 코드를 실행할 수 없어 그림을 못 넣을 때만 쓴다. `12-2`는 원본 PPT 12쪽의 2번째 그림(슬라이드 XML의 그림 순서, `extract_pptx.py`의 번호와 같다).
- 선생님이 원본 PPTX를 화면에 끌어다 놓으면 채워지고, ⚙ 「그림 넣어 저장」으로 파일에 넣는다.

## 11. 교실 도구

활동으로 치지 않는 수업 진행 도구다. 상태는 그 화면 안에만 있다(저장하지 않는다).

```html
<div class="timer" data-sec="300" data-label="모둠 활동"></div>   <!-- 시작·멈춤·다시, 끝나면 '끝'과 깜빡임 -->
<div class="picker" data-range="1-30"></div>                     <!-- 발표자 뽑기(겹치지 않게). data-items="가|나|다"도 된다 -->
```

```html
<div class="score" data-teams="4"></div>                          <!-- 모둠 점수판(+1/−1). data-teams="빨강|파랑"도 된다 -->
<ul class="checklist"><li>보안경</li><li>실험복</li></ul>         <!-- 누르면 ✓, 아래에 '1 / 2' -->
```

```html
<figure class="hotspots" style="width:560px">                    <!-- 그림 위 번호를 누르면 그 설명 -->
  <img src="data:…" alt="…">
  <span class="hs" style="--x:30%; --y:40%">설명</span>
  <span class="hs" style="--x:70%; --y:55%" data-label="A">설명</span>
</figure>
```

```html
<div class="poll" data-options="찬성|반대|잘 모르겠다">              <!-- 손들기 투표. 보기는 2~6개 -->
  <p>급식에 채식의 날을 늘리는 데 찬성하나요?</p>
</div>
```

- 투표는 정답이 없는 물음에 쓴다. 정답이 있는 물음은 `.quiz`를 쓴다.
- 교사는 손 든 학생을 세면서 보기를 누른다. 누를 때마다 1명이 늘고 잘못 누르면 옆의 −1로 고친다. 「다시」는 모두 0명으로 돌린다.
- 실시간 수업에서는 학생이 자기 기기에서 하나를 고른다(바꿀 수 있다). 인원은 교사 「학생 보기」에 모이고 교사가 「칠판에 넣기」를 누르면 칠판의 투표에 들어간다.
- 높이: 보기 한 줄 64px, 사이 10px, 아래 줄 56px. 보기 3개면 약 290px다.

## 12. 맞춤 스크립트(익스플로라그램)

```html
<script>
document.addEventListener('DOMContentLoaded', () => {
  ClassHTML.onShow((slide, i) => { /* 장이 보일 때 */ });
});
</script>
```

- `</body>` 바로 앞에 둔다. `ClassHTML.onShow/onHide/go/next/prev/audit`를 쓴다. `ClassHTML.go(i)`의 `i`는 0부터 센다(1쪽 = 0). `innerHTML`로 학생 입력을 넣지 않는다.
- 설계 방법과 뼈대 코드는 `exploragram.md`. 조작한 상태를 찍어 확인할 때는 `scripts/states.mjs`.
- 펜을 든 채로 쓰는 규칙: 누르는 요소는 `button`·`a`·`label` 또는 `data-tap`, 끄는 요소(슬라이더가 아닌 것)는 `data-no-ink`.
- 값이 바뀌면 그림이 건너뛰지 않게 바뀌는 SVG 요소에 CSS `transition`을 준다(`exploragram.md`의 '직접 짜야 할 때'). 직접 짠 슬라이더에도 `data-play`를 붙일 수 있다(16절).

## 13. 입자 상자 `figure.particles`

```html
<div class="calc" style="display:grid;grid-template-columns:1fr 360px;gap:28px;align-items:start">
  <figure class="particles" data-membrane="0.5" data-labels="세포 밖|세포 안" data-height="300">
    <i data-kind="물" data-left="30" data-right="30" data-pass="1" data-color="#5AA9E6" data-size="4"></i>
    <i data-kind="설탕" data-left="sugar" data-right="5" data-pass="0" data-color="#C04F15" data-size="8"></i>
  </figure>
  <div>
    <p>세포 밖 설탕 <output data-expr="sugar" data-unit="개"></output></p>
    <input type="range" name="sugar" min="0" max="40" value="20" aria-label="세포 밖 설탕 수">
    <p data-show="sugar > 5">설탕은 막을 못 지난다. 물이 세포 밖으로 더 많이 나간다.</p>
  </div>
</div>
```

- `data-membrane`: 막의 가로 위치(0~1). 빼면 막이 없는 한 칸(기체 운동, 확산). 막이 없어도 `data-right`를 주면 처음에 가운데를 기준으로 나눠 놓고 양쪽 개수를 센다(잉크가 퍼지는 확산).
- `data-labels="세포 밖|세포 안"`은 상자 안 양쪽 위와 개수 줄에 나온다.
- 입자 종류마다 `data-left`·`data-right`(처음 개수), `data-pass`(막을 지날 확률 0~1: 반투과성막이면 물 1, 용질 0), `data-color`, `data-size`(반지름 px). 값은 식이라 계산 상자 변수를 쓸 수 있다. `data-speed`(상자 전체 속도, 기본 1)도 식.
- 장이 보이면 움직이고 넘기면 멈춘다. 「멈추기」·「다시」 단추, 아래에 양쪽 개수. 입자는 모두 300개까지.
- 삼투: 막을 못 지나는 입자(`data-pass="0"`, 용질)는 자기 쪽 막 구멍을 가려, 그쪽 물이 막을 지날 확률이 용질 비율만큼 줄어든다. 그래서 물은 용질이 많은 쪽으로 더 많이 모인다(교과서의 설명 모형).
- 움직임은 모형이다. 개수의 비율이 개념과 맞는지만 지키고, '실제 분자 수'처럼 말하지 않는다.

## 14. 라벨 붙이기 `figure.labeling`

```html
<figure class="labeling" style="width:560px">
  <img src="data:…" alt="식물 세포 모식도(이름 없음)">
  <span class="lb" style="--x:28%; --y:38%" data-why="핵에는 유전 물질이 들어 있다." data-hint="둥글고 보라색인 곳이다.">핵</span>
  <span class="lb" style="--x:55%; --y:50%" data-why="액포는 물과 양분을 저장한다." data-hint="가운데에서 가장 넓은 곳이다.">액포</span>
</figure>
<p class="step">다 붙이면 열리는 정리</p>
```

- `.lb` 하나가 자리 하나이자 이름표 하나다. `--x`, `--y`는 그림의 왼쪽 위에서 잰 비율이다. 그림(`<img>`나 `viewBox`가 있는 `<svg>`)은 `figure` 폭을 꽉 채운다.
- 엔진이 자리마다 번호 동그라미를 놓고 이름표를 섞어 그림 아래에 모은다. 이름표를 끌어 자리에 놓거나 이름표를 누른 뒤 번호를 누른다. 펜을 든 채로도 이름표가 움직인다.
- 맞으면 그 자리에 붙고 자리의 `data-why`가 나온다. 틀리면 이름표가 흔들리고 "다시 생각해 보자." 뒤에 그 이름표의 `data-hint`가 나온다. 다 붙이면 이 부품 뒤의 첫 `.step`을 연다. 「다시」 단추가 붙는다.
- 이름이 적힌 그림은 쓰지 않는다(답이 보인다). 이름을 지운 그림이나 직접 그린 SVG를 쓴다.
- 이름표는 2~8개가 알맞다. 번호 동그라미가 52px이므로 자리 사이를 60px 넘게 띄운다. 이름이 같은 자리가 둘이면 어느 쪽에 놓아도 맞다.
- 붙은 이름표는 자리 한가운데를 덮는다. 작은 구조는 자리를 구조 바로 옆에 잡는다.
- 높이: 그림 + 이름표 한 줄 60px + 알림 줄 56px + 사이 24px. 알림 줄은 `figure` 폭 안에서 줄을 바꾸므로 이유는 한 문장으로 짧게 쓴다. 점검은 붙이기 전과 다 붙인 뒤를 모두 잰다. 인쇄는 다 붙인 모습이다.

## 15. 영상 카드와 링크 카드 `.video`, `a.link-card`

```html
<div class="video" data-youtube="https://youtu.be/M7lc1UVf-VE" data-title="영상 제목" data-start="1:20" data-end="3:05"></div>
```

```html
<a class="link-card" href="https://n-lifescience.github.io/exploragram/" data-qr>예시 수업 모음<small>QR을 찍으면 학생 기기에서 열린다</small></a>
```

- 주소는 선생님이 준 것만 쓴다. 기억이나 짐작으로 영상이나 사이트 주소를 만들지 않는다(위 예시의 주소도 그대로 쓰지 않는다). 주소를 받지 못했으면 카드를 넣지 말고 파일을 전달할 때 넣을 주소를 묻는다.
- `data-youtube`에는 유튜브 주소나 영상 ID를 쓴다. 볼 구간은 `data-start`와 `data-end`로 정한다(`80` 또는 `1:20`). 주소에 `t=80`이 있으면 시작 시각으로 읽는다.
- 누르기 전에는 유튜브에 아무것도 요청하지 않는다. 사이트에 올린 수업(`https://`)은 그 자리에서 재생하고 장을 넘기면 꺼진다. 더블클릭으로 연 파일에서는 유튜브가 끼워 넣기를 막으므로(오류 153) 새 탭으로 연다.
- 영상 카드는 16:9 상자이고 폭은 760px까지다(높이 약 430px). 줄이려면 `style="width:560px"`.
- 링크 카드는 새 탭으로 열린다. `<small>`은 한 줄 설명이고 사이트 이름은 엔진이 주소에서 뽑아 붙인다. `href`는 `https://`나 `http://`로 시작해야 한다.
- `data-qr`을 붙이면 학생이 자기 기기로 찍을 QR이 붙는다(영상 카드와 링크 카드 모두). 그 장을 처음 열 때 그리며 인터넷이 없으면 주소가 글로 나온다.
- 영상 카드와 링크 카드는 활동 장으로 세지 않는다.

## 16. 재생 `data-play` — 시간을 엔진이 흘려 준다

```html
<div class="calc" data-let="top = 8 * c; h = top * (1 - exp(-t / 3))" style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
  <figure class="plot" data-x="0, 10" data-y="0, 9" data-xstep="2" data-ystep="2" data-height="300" data-xlabel="시간(분)" data-ylabel="높이(칸)">
    <i data-line="top * (1 - exp(-x / 3))" data-x="0, max(t, 0.01)"></i>
    <i data-point="t, h"></i>
  </figure>
  <div>
    <button data-set="c" data-value="0.5" aria-pressed="true">0.5 M</button>
    <button data-set="c" data-value="1">1 M</button>
    <p>시간 <output data-expr="t" data-unit="분"></output></p>
    <input type="range" name="t" min="0" max="10" step="0.5" value="0" data-play="8" aria-label="시간">
    <p>높이 <output data-expr="h" data-digits="1" data-unit="칸"></output> (모형)</p>
  </div>
</div>
```

- 슬라이더에 `data-play="8"`을 붙이면 엔진이 슬라이더 바로 위에 「▶ 재생」과 「처음으로」 단추를 단다. 숫자는 최솟값에서 최댓값까지 가는 초이고 비우면 6초다. 끝에 닿으면 멈춘다. `data-loop`를 붙이면 처음부터 되풀이한다.
- 계산 상자 안이면 값이 바뀔 때마다 다시 계산한다. 칸이 성기면 다음 칸까지 걸리는 시간 동안 그림을 흘려 보낸다. 그래프 선에 `data-x="0, max(t, 0.01)"`을 주면 곡선이 시간을 따라 그려진다.
- 직접 짠 그림의 슬라이더에도 붙인다. 엔진이 값을 바꿀 때마다 `input` 이벤트를 보내므로 직접 짠 처리기가 그대로 그린다.
- 끝에 있을 때 「▶ 재생」을 누르면 처음부터 다시 간다. 슬라이더를 손으로 잡거나 장을 넘기면 멈춘다. ⚙ 「움직임 끄기」를 켜도 재생은 된다.
- 재생할 슬라이더는 최솟값('시작'이나 0)에서 시작한다. 「재생」 줄만큼(약 64px) 높이가 늘어나니 점검(D)으로 넘침을 확인한다.
- 단계 막대(`.reveal`)가 만드는 막대에는 붙이지 않는다. 단계를 차례로 보여 주려면 `→` 키로 넘긴다.

## 점검 코드(D 키, `?audit`, ⚙ 설정의 「자동 점검」)

| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `slide-overflow`, `out` | 무대 밖으로 넘침 | 글자를 줄이지 말고 장을 나누거나 배치를 바꾼다 |
| `clip` | 상자 안 내용이 잘림 | 상자 높이·글 양 |
| `tiny-text` | 20px 미만 글자(SVG 안 글자는 실제 크기). 표는 표 하나에 한 번 알린다 | 글자 키우기, 그림 폭 키우기. 표는 두 장으로 나누기 |
| `part` | 부품 작성 실수(칸 없는 카드, 정답 없는 문제, 식 오류, 어느 막대인지 모르는 data-at …) | 메시지대로 |
| `not-veiled` | 부품 밖 슬라이더가 중간에서 시작하는데 그 장에 가림막이 없음 | 단계·시간 막대면 첫 칸을 '시작'으로. 조건 비교 슬라이더면 결과를 가림막으로 가린다(클래스 이름이 `veil`이나 `-veil`로 끝나면 가림막으로 본다) |
| `few-activities` | 활동 장이 3분의 1 미만 | 엔진 부품, 슬라이더, `[data-activity]`가 있는 장을 센다. 단추만 있는 익스플로라그램은 감싼 요소에 `data-activity`를 붙인다. 글만 바뀌는 장(`text-only`)은 세지 않는다 |
| `text-only` | 단추만 있고 그림, 수치, 입력이 없는 장에 `data-activity`가 있음 | 고른 값으로 그림과 수치가 계산되어 바뀌게 한다. 확인용 장이면 `data-activity`를 뗀다 |
| `meta-text` | 장에 '원본 PPT', '익스플로라그램 ①', 저작권 안내, 파일 사용 안내, 선생님께 하는 말이 있음 | 장에서 빼고 전달 메모에 쓴다 |
| `quiz-spot` | 문제 3개 이상의 정답이 모두 같은 번호 | 정답 자리를 섞는다 |
| `long-deck` | 40장을 넘음 | 차시별로 파일을 나눈다 |
| `slide-shown` | 보고 있지 않은 장이 화면에 남음 | 장에 준 `display`를 지운다 |
| `static-model` | 직접 짠 익스플로라그램이 있는데 수업 스크립트와 CSS에 움직임이 하나도 없음(경고) | 그림을 계산 상자로 옮긴다. 직접 짠 그림이면 바뀌는 SVG 요소에 `transition`을 주고 시간 막대에는 `data-play`를 붙인다 |
| `use-part` | 움직임이 없는 파일에서 손잡이가 있는 장에 직접 그린 점이 12개 이상(경고) | 입자가 막을 오가는 그림이면 입자 상자(13절)로 바꾼다. 농도를 점으로 나타낸 정지 그림이면 그대로 두어도 된다 |
| `empty-image`, `no-alt`, `dup-id` | 빈 그림 자리, 그림 설명 없음, 중복 id | |

- 오류가 있으면 선생님이 파일을 처음 열 때 툴바에 「점검 N」 단추가 뜬다. 점검 창의 「AI에게 보낼 말 복사」는 목록을 수정 요청 글로 복사한다. 변환 과정을 설명하는 덱처럼 알림이 필요 없으면 `<html data-audit="off">`로 끈다.
- 넘친 장은 엔진이 줄여서 다 보이게 한다(0.75배까지). 점검은 줄이기 전 크기로 잰다. `<html data-fit="off">`로 끈다.
