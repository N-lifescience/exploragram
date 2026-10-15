# 익스플로라그램(Exploragram)

## 무엇이 익스플로라그램인가

네 가지가 모두 있어야 익스플로라그램이다.

1. **손잡이**: 학생이 바꾸는 입력 한두 개(슬라이더, 단추 묶음). 주로 원인(농도, 온도, 전도 속도)을 바꾼다. 셋을 넘기지 않는다. 「시장에 맡기기」처럼 저절로 움직이게 하는 단추를 더해도 된다.
2. **함께 바뀌는 두 표현**: 그림과 함께 수치·식·그래프·막대 가운데 하나 이상이 같은 계산으로 움직인다.
3. **결과에 따라 달라지는 문장**: "팽압이 0이다", "양보하는 성향이 퍼진다"처럼 지금 값이 무엇을 뜻하는지 한 줄로 말한다.
4. **움직임**: 값이 바뀌면 그림이 끝값으로 건너뛰지 않고 이어서 움직인다. 무엇이 어떻게 움직일지는 장면마다 고르는 축(시간, 공간, 시공간)이 정한다(아래 '축').

누르면 글이 열리기만 하는 것, 퀴즈, 분류 카드는 익스플로라그램이 아니다.

움직임은 빠지면 안 된다. 입력이 바뀔 때 그림을 끝값으로 다시 그리기만 하는 화면(static re-render)은 손잡이와 두 표현이 있어도 기준 미달이다. 학생 눈은 결과가 바뀌어 가는 모습을 따라가며 원인과 결과를 잇는다.

단추를 누르면 설명 글이나 카드 목록만 바뀌는 것도 아니다. 고른 값으로 무엇인가를 계산해야 한다. 자리, 길이, 개수, 비율, 판정 가운데 하나가 값에 따라 달라지고 그림이 그것을 보여 준다.

**몇 개?** 한 차시(PPT 10~25장)에 보통 2~4개. 헷갈리는 지점마다 하나씩이고, 법칙 둘을 한 익스플로라그램으로 묶어도 된다.

## 축

축은 움직임의 결과를 만들어 내는 변수다. 손잡이(농도, 온도)가 원인을 바꾸면 축은 그 결과를 펼쳐 보인다. 장면마다 시간, 공간, 시공간 가운데 하나를 고른다. 고르는 기준은 교과 맥락, 곧 그 개념이 던지는 질문이다. 축마다 움직이는 주체가 다르다.

| 축 | 개념이 묻는 것 | 움직이는 주체 | 조작 | 예 |
|---|---|---|---|---|
| 시간 | 어떻게 변해 가나, 얼마나 걸리나 | 대상이 제자리에서 변한다 | 시간 슬라이더와 「▶ 재생」, 「❚❚ 멈춤」, 「한 칸」, 「처음으로」. 단계로 나뉜 과정은 한 단계씩 | 식후 혈당 조절, 세포 주기의 DNA양, 효소 반응 |
| 공간 | 어디서 무엇이 다른가, 어느 수준에서 보나 | 시간은 멈추고 관찰자가 움직인다 | 탐침 끌기, 확대 단계 | 네프론 위치별 여과액 농도, 기관→세포→DNA 확대, 자극 후 특정 시점의 d1~d4 막전위 |
| 시공간 | 무엇이 어디로 퍼지거나 전달되나 | 대상이 공간을 가로질러 움직인다 | 재생, 입자 상자의 「움직이기」 | 확산과 삼투, 흥분 전도, 시냅스 전달 |

- **시간 축**: 시간 슬라이더에 `data-play`를 붙이면 엔진이 「▶ 재생」(재생 중에는 「❚❚ 멈춤」), 「한 칸」, 「처음으로」를 단다. 한 단계씩 보려면 「한 칸」을 누른다. 이름이 붙은 단계로 나뉘는 과정(세포 주기)은 계산 상자 안의 단계 막대로 만든다. → 키나 리모컨을 한 번 누를 때마다 한 단계씩 넘어간다. 그래프 선은 `data-x="0, max(t, 0.01)"`로 시간을 따라 그린다.
- **공간 축**: 시간을 한 시점에 멈추고 관찰자가 옮겨 다닌다. 탐침은 위치 슬라이더나 그래프의 끌 수 있는 점(`data-drag`)으로 옮긴다. 그림 속 탐침은 `data-attr`로 옮긴다. 그 자리의 값은 같은 계산 상자가 셈한다. 확대 단계는 단계 막대로 만든다. SVG `viewBox`를 `data-attr`로 바꾸면 그림이 그 수준으로 다가간다. 그래프 선은 `data-x="0, max(d, 0.01)"`로 탐침이 지나간 곳까지 그린다.
- **시공간 축**: 개수, 농도, 한 지점의 막전위 같은 거시 값과 그래프는 따로 지어 움직이지 않는다. 입자나 파동의 상태에서 계산한다. 막을 오가는 입자는 입자 상자로 만든다. 입자 종류에 `data-count="wl, wr"`를 붙이면 양쪽 개수가 계산 상자 변수가 된다. 수, 막대, 그래프는 이 변수로 계산한다. 축삭을 따라 전해지는 흥분처럼 파동으로 그릴 것은 위치 `x`와 시간 `t`의 식 하나로 그래프와 수치를 함께 계산하고 `t`에 `data-play`를 붙인다.
- 과학 밖에서도 같은 기준으로 고른다. 연도, 세대, 이야기 장면의 순서는 시간 축이다. 그래프나 지도 위의 자리(가격, x 좌표, 지역)를 옮겨 가며 견주면 공간 축이다.
- 원인을 바꿀 손잡이가 따로 없는 장면(세포 주기의 DNA양)은 축 조작이 손잡이를 겸한다. 그래도 축은 설계표에 따로 적는다.

### 질문이 축을 정한다(활동 전위)

| 수업의 질문 | 축 | 손잡이 | 움직이는 것 |
|---|---|---|---|
| 한 지점의 막전위는 자극을 받은 뒤 어떻게 변해 가나(흥분 발생 과정) | 시간 | 자극 세기(역치 아래, 위) | 막전위 그래프가 시간을 따라 그려지고 Na⁺ 통로와 K⁺ 통로가 차례로 열렸다 닫힌다 |
| 자극하고 4 ms가 지났을 때 d1~d4의 막전위는 각각 얼마인가 | 공간 | 전도 속도 | 시간은 4 ms에 멈춰 있고 탐침이 축삭을 따라 옮겨 가며 그 자리의 막전위를 읽는다 |
| 흥분은 축삭을 따라 어떻게 전달되나(전도) | 시공간 | 전도 속도 | 흥분 구간이 축삭을 따라 옮겨 가고 지점별 막전위 그래프가 함께 움직인다 |

공간 축과 시공간 축은 아래 뼈대에 있다. 두 뼈대는 같은 활동 전위 식을 쓰고 축만 다르다.

### 움직임 공통 규칙

- 어느 축이든 값이 바뀌면 0.6~0.8초 동안 이어서 움직인다. 끝값으로 순간 이동하지 않는다.
- 계산 상자는 엔진이 움직인다. 수(`data-expr`), 막대(`.bar`), `data-attr`, `data-style`이 0.6초 동안 끝값으로 간다. 그래프의 곡선과 점도 같은 시간 동안 새 자리로 간다. 더 길게 하려면 `data-tween="0.8"`을 붙인다.
- 재생 중에는 엔진이 다음 칸까지 걸리는 시간 동안 그림을 옮긴다. 「한 칸」과 「처음으로」는 사람이 슬라이더를 민 것처럼 0.6초 동안 옮긴다. 그래프에서 학생이 끄는 점(`data-drag`)은 손을 그대로 따라간다.
- 직접 짠 그림은 `requestAnimationFrame`으로 앞 값에서 새 값까지 0.6~0.8초 동안 보간(tween)하거나 바뀌는 SVG 요소에 CSS `transition`을 0.6~0.8초로 준다. 끝값만 넣고 끝내지 않는다(아래 '직접 짜야 할 때').
- ⚙ 「움직임 끄기」(`<html>`의 `ch-motion-off` 클래스)가 켜져 있으면 바로 끝값을 그린다. 엔진 부품도 직접 짠 움직임도 이 설정 하나만 확인한다. 교사가 누른 재생은 그대로 둔다.
- 운영체제의 움직임 줄이기(`prefers-reduced-motion`)는 따르지 않는다. 학교 PC는 '최적 성능' 같은 설정으로 이 값이 켜져 있기도 하다. 그대로 따르면 움직임이 통째로 사라진다. 움직임을 꺼야 하는 PC에서는 ⚙로 끈다. 그 PC가 설정을 기억한다.

## 설계 순서

1. 헷갈리는 지점을 한 문장으로 쓴다. 예: "부풀수록 물을 더 빨아들일 것 같다."
2. 그 지점을 가르는 변수를 찾는다. 예: 세포 부피. 원인을 바꾸는 변수(농도, 온도)는 손잡이가 되고 결과가 펼쳐지는 변수(시간, 위치)는 축이 된다.
3. 축을 고른다. 그 개념이 '어떻게 변해 가나'를 물으면 시간, '어디서 무엇이 다른가'를 물으면 공간, '무엇이 어디로 퍼지거나 전달되나'를 물으면 시공간이다. 예: 흡수력 장면은 '세포가 부풀어 가면 흡수력이 어떻게 변해 가나'를 묻는다. 그래서 시간 축이고 부피 단계를 하나씩 넘긴다(축 조작이 손잡이를 겸한다). 고른 이유는 설계표에 한 줄로 적는다.
4. 변수가 바뀌면 무엇이 보여야 오개념이 깨지는지 정한다. 예: 세포가 커지는 그림과, 흡수력 막대가 줄어드는 모습을 함께 보여 준다.
   - 변하는 것과 함께 변하지 않는 것도 보여 준다. 기하에서는 모양을 바꿔도 그대로인 성질이 그 차시의 결론인 경우가 많다. 예: 삼각형의 꼭짓점을 옮겨도 무게중심은 중선을 2:1로 나눈다.
5. 계산 규칙을 정한다.
   - 교과서 식이 있으면 그 식을 쓴다.
   - 식이 없는 교과(윤리·사회·국어)는 개념을 지키는 단순한 모형을 만든다. 저울의 무게, 세대마다 바뀌는 비율, 부등호 같은 것이다.
   - 모형 수치는 `data-ai="모형 수치"`로 표시하고, 화면에도 '모형'이라고 적는다.
6. 움직임과 부품을 정한다. 아래 '장면 메뉴'에서 고른 축에 맞는 장면을 찾고 그 장면의 부품을 쓴다. 시간 축이면 시간 슬라이더에 `data-play`를 붙인다. 움직임은 위 '움직임 공통 규칙'을 따른다.
7. 극단값을 확인한다. 최솟값·최댓값·경계값에서 그림과 문장이 말이 되는지 본다. 0으로 나누면 '?'를 보인다.

## 교과별 아이디어

- **과학**: 식으로 그림이 바뀌는 모식도(흡수력 = 삼투압 − 팽압, 옴의 법칙 회로, 렌즈 상), 변인 슬라이더와 그래프 위 지금 값 표시, 입자 상자(확산·삼투·기체), 시간 막대(세포 분열 단계, 판 이동), 재생으로 시간이 흐르는 실험(빨대 속 물 높이, 반응 속도 그래프).
- **수학**: 계수 슬라이더에 따라 그래프와 식이 함께 바뀌는 것, 시행 횟수를 늘리면 상대도수가 확률에 다가가는 시뮬레이션, 도형 변형과 넓이 식.
  - 분수함수의 계수 막대와 점근선, 나눈 개수 막대를 늘리면 직사각형 넓이의 합이 정적분 값에 다가가는 것, 꼭짓점 좌표를 바꿔도 그대로인 무게중심의 비.
  - 점을 직접 끌어 옮기는 장면(직선의 방정식, 내분점, 무게중심)은 그래프 위 끌 수 있는 점(`components.md` 9-1절)으로 만든다. 아래에 무게중심 예시가 있다.
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

### 꼭짓점을 끌어 옮기는 무게중심(수학 예시)

바꾸는 것, 변하는 것, 변하지 않는 것을 한 장에 함께 보여 준다.

- 바꾸는 것: 꼭짓점 A, B, C의 자리. 학생이 끌어 옮긴다.
- 변하는 것: 무게중심 G의 좌표, 선분 AG와 GM의 길이.
- 변하지 않는 것: AG : GM = 2 : 1. G는 중선 AM을 2 : 1로 나눈다.

```html
<section class="slide" id="centroid" data-sec="2. 무게중심" data-title="무게중심 익스플로라그램">
  <h2>꼭짓점을 옮겨도 그대로인 것은?</h2>
  <div class="calc" style="display:grid;grid-template-columns:600px 1fr;gap:32px;align-items:start"
       data-let="gx = (ax + bx + cx) / 3; gy = (ay + by + cy) / 3; mx = (bx + cx) / 2; my = (by + cy) / 2; ag = sqrt((gx - ax) ^ 2 + (gy - ay) ^ 2); gm = sqrt((mx - gx) ^ 2 + (my - gy) ^ 2); flat = abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < 0.001">
    <figure class="plot" data-x="-5, 5" data-y="-5, 5" data-xstep="1" data-ystep="1" data-height="420" aria-label="삼각형 ABC와 중선 AM, 무게중심 G">
      <i data-path="ax, ay; bx, by; cx, cy" data-close data-fill data-color="#0F766E"></i>
      <i data-path="ax, ay; mx, my" data-dash data-color="#2563EB"></i>
      <i data-point="mx, my" data-label="M"></i>
      <i data-point="gx, gy" data-label="G" data-color="#2563EB"></i>
      <i data-drag="ax, ay" data-value="-3, -2" data-label="A" data-snap="1"></i>
      <i data-drag="bx, by" data-value="4, -1" data-label="B" data-snap="1"></i>
      <i data-drag="cx, cy" data-value="1, 4" data-label="C" data-snap="1"></i>
    </figure>
    <div>
      <p>꼭짓점 A, B, C를 끌어 보자.</p>
      <p>G(<output data-expr="gx" data-digits="2"></output>, <output data-expr="gy" data-digits="2"></output>)</p>
      <p>AG <output data-expr="ag" data-digits="2"></output>, GM <output data-expr="gm" data-digits="2"></output></p>
      <p class="step"><b>AG : GM = <output data-expr="gm == 0 ? '?' : ag / gm" data-digits="2"></output> : 1</b></p>
      <p data-show="flat">세 점이 한 직선 위에 있다. 삼각형이 아니다.</p>
    </div>
  </div>
</section>
```

- G의 좌표와 두 길이는 끌 때마다 바뀌지만 비는 2.00 : 1에 머문다. 학생이 무엇이 그대로인지 먼저 말하게 한 뒤 →로 비를 연다(`.step`).
- 세 점이 한 직선 위에 오는 경계도 끌어서 확인한다. 이때 삼각형이 아니라는 문장이 나온다.
- 내분점은 같은 틀로 만든다. 점 A, B를 끌고 `px = (n * ax + m * bx) / (m + n)`으로 계산한 점을 `data-point`로 찍는다. 비 m : n은 슬라이더 두 개로 바꾼다.

## 장면 메뉴

부품 이름 대신 장면으로 고른다. 인터뷰 ③에서 선생님께 보여 주는 목록이다. 먼저 축을 고르고 그 축의 장면을 찾는다. 설계표의 '축', '쓸 부품', '움직이는 것' 칸도 여기서 채운다.

| 축 | 장면 | 쓸 부품 | 움직이는 것 |
|---|---|---|---|
| 시간 | 시간이 흐르며 물 높이, 온도, 개체 수가 변하는 실험 | 계산 상자, 재생 `data-play`(16절), 그래프 `figure.plot` | 시간 막대가 저절로 가고 그림과 곡선이 따라 그려진다 |
| 시간 | 세대나 단계마다 비율이 바뀌는 시뮬레이션 | 계산 상자의 `data-let` 연쇄와 재생 | 세대 막대가 저절로 가고 막대와 꺾은선이 바뀐다 |
| 시간 | 과정을 단계로 나눠 한 단계씩 넘긴다(세포가 부풀어 간다, 세포 주기) | 계산 상자 안의 단계 막대 `.reveal data-name`(1, 8절) | 한 단계 넘길 때마다 그림과 막대가 0.6초 동안 다음 값으로 간다 |
| 시간 | 연도가 지나며 하나씩 열리는 연표와 세력 지도 | `ol.yearline`, `figure.map-reveal`(3, 4절) | 단계마다 새 영역이 서서히 열린다 |
| 공간 | 탐침을 옮기며 자리마다 값을 읽는다(네프론 위치별 농도, 지점별 막전위) | 계산 상자, 위치 슬라이더, 그래프의 `data-vline`과 `data-point`(9절) | 탐침이 옮겨 가고 그 자리의 값이 바뀐다. 그래프는 탐침이 지나간 곳까지 그려진다 |
| 공간 | 계수를 바꾸며 그래프 위 자리마다 값을 견준다(어디서 재도 같은 기울기) | 계산 상자와 그래프(9절) | 슬라이더를 미는 동안 곡선과 지금 값 점이 손을 따라 움직인다 |
| 공간 | 점을 끌어 옮기면 바뀌는 도형과 직선 | 그래프의 끌 수 있는 점 `data-drag`(9-1절) | 학생이 끄는 대로 점과 도형이 움직인다 |
| 공간 | 기관에서 세포, DNA로 확대해 들어간다 | 계산 상자 안의 단계 막대, SVG `viewBox`를 `data-attr`로 | 단계마다 그림이 0.6초 동안 다가간다 |
| 시공간 | 입자가 막을 오가며 퍼지거나 모인다(확산, 삼투, 기체) | 입자 상자 `figure.particles`와 개수 변수 `data-count`(13절) | 입자가 저절로 움직이고 양쪽 개수가 바뀐다. 그 개수로 계산한 막대와 그래프가 함께 움직인다 |
| 시공간 | 흥분이나 신호가 전해진다(흥분 전도, 시냅스 전달) | 계산 상자, 위치와 시간의 식을 그린 그래프, 재생 | 흥분 구간이 축삭을 따라 옮겨 가고 그래프가 함께 움직인다 |

어느 축이든 손잡이를 바꾸면 계산 상자가 그림의 크기와 자리, 막대, 수치, 그래프를 0.6초 동안 끝값으로 옮긴다(`data-attr`, `data-style`, `.bar`, 8절, 9절).

맞는 장면이 없을 때만 그림을 직접 짠다(아래 '직접 짜야 할 때'). 그때도 값 계산을 계산 상자에 맡기면 움직임이 저절로 붙는다.

## 엔진에 붙이는 뼈대

그림·그래프는 왼쪽, 손잡이(슬라이더·단추)와 수치는 오른쪽 칸에 둔다. 교사 대부분이 오른손잡이라 판 앞에서 오른쪽 손잡이를 밀어도 몸이 그림을 가리지 않고, 학생은 왼쪽에서 오른쪽으로 읽으며 그림을 먼저 본다.

뼈대는 넷이고 모두 스크립트가 없다. 코드를 실행해 화면을 확인할 수 없는 환경(채팅 AI)에서도 안전하다. 익스플로라그램이 쓸 수 있는 높이는 제목 아래 약 470px(ppt 테마, `data-sec`이 있는 장)이다. 설계표로 쓰면 아래와 같다.

| 뼈대 | 손잡이 | 축 | 축을 고른 이유(교과 맥락) |
|---|---|---|---|
| 흡수력 | 부피 단계(축 조작이 겸한다) | 시간(단계) | 세포가 물을 빨아들여 부풀어 가는 동안 흡수력이 어떻게 변해 가는지 묻는다 |
| 빨대 속 물 높이 | 튜브 속 설탕물 농도 | 시간 | 물이 얼마나 빨리, 어디까지 오르는지 묻는다 |
| 지점별 막전위 | 전도 속도 | 공간 | 자극하고 4 ms가 지났을 때 축삭의 자리마다 막전위가 어떻게 다른지 묻는다 |
| 흥분 전도 | 전도 속도 | 시공간 | 흥분이 축삭을 따라 어떻게 전해지는지 묻는다 |

### 시간 축 ①: 과정을 단계로 넘기기(계산 상자와 단계 막대)

상대 부피 0.85~1.30을 다루는 흡수력 모형이다. 세포가 물을 빨아들여 부풀어 가는 과정을 부피 단계로 나눴다. 단계 막대가 축 조작과 0단계 가림을 맡고 계산 상자가 수를 셈한다. 세포 크기와 흡수력 막대는 SVG 속성(`data-attr`)으로 바꾼다. 막대를 밀거나 →를 눌러 한 단계 넘기면 엔진이 세포와 막대를 0.6초 동안 움직인다.

```html
<section class="slide" id="absorb" data-sec="2. 삼투" data-title="흡수력 익스플로라그램">
  <h2>세포가 부풀면 물을 더 빨아들일까?</h2>
  <div class="calc" data-ai="흡수력 익스플로라그램" data-let="v = 0.80 + k * 0.05; t = v <= 1 ? 0 : 6.4 * ((v - 1) / 0.35) ^ 1.6; o = 8.7 / v; s = o - t">
    <div class="reveal" data-name="k" data-stops="시작|0.85|0.90|0.95|1.00|1.05|1.10|1.15|1.20|1.25|1.30" style="display:grid;grid-template-columns:1fr 400px;gap:28px">
      <div class="veil">
        <svg viewBox="0 0 600 320" aria-label="세포 그림과 흡수력 막대">
          <ellipse cx="200" cy="160" rx="120" ry="90" fill="#DFF0ED" stroke="#0F766E" stroke-width="6" data-attr="rx: 120 * v; ry: 90 * v"/>
          <rect x="430" width="70" fill="#9A6B06" data-attr="y: 280 - s * 24; height: s * 24"/>
          <text x="465" y="312" font-size="26" text-anchor="middle">흡수력</text>
        </svg>
      </div>
      <div>
        <div class="ch-stops"></div>
        <div data-at="1">
          <p>세포 부피 <output data-expr="v" data-digits="2"></output>배</p>
          <p data-ai="모형 수치">흡수력 <output data-expr="s" data-digits="1"></output> = 삼투압 <output data-expr="o" data-digits="1"></output> − 팽압 <output data-expr="t" data-digits="1"></output> (모형)</p>
          <p data-show="t == 0">팽압이 0이다. 흡수력이 가장 크다.</p>
          <p data-show="t > 0">부풀수록 팽압이 커져 흡수력이 준다.</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

- `k`는 지금 칸 번호다(시작 = 0). `.veil`과 `data-at="1"`이 0단계에서 결과를 가린다. 빈 `<div class="ch-stops">`를 두면 단계 막대가 그 자리에 생긴다.
- SVG 속성은 `data-attr="rx: 120 * v"`, CSS는 `data-style="--s: v"`로 바꾼다. 수만 다른 글자 값(`'rotate(' + a + ' 100 100)'`, 꺾은선 `points`)도 흘러간다.
- 세대마다 바뀌는 시뮬레이션은 `data-let`에 `p1 = …; p2 = f(p1); …`처럼 풀어 쓰고, 꺾은선 점은 글자를 이어 붙여 만든다.
- 문법은 `components.md` 8절(계산 상자)과 1절(단계 막대)에 있다.

### 시간 축 ②: 재생(계산 상자, 재생, 그래프)

반투막 튜브를 꽂은 빨대 속 물 높이 모형이다. 손잡이는 튜브 속 설탕물 농도이고 축은 시간이다. 시간 슬라이더에 `data-play="8"`을 붙이면 엔진이 그 위에 「▶ 재생」, 「한 칸」, 「처음으로」를 달고 8초 동안 시간을 흘린다. 재생하는 동안 「▶ 재생」은 「❚❚ 멈춤」으로 바뀐다. 그래프 선은 `data-x="0, max(t, 0.01)"`라서 시간을 따라 그려진다.

```html
<section class="slide" id="tube" data-sec="2. 삼투" data-title="빨대 속 물 높이">
  <h2>시간이 지나면 빨대 속 물은 얼마나 올라갈까?</h2>
  <div class="calc" data-ai="빨대 삼투 실험 모형" data-let="top = 8 * c; h = top * (1 - exp(-t / 3))" style="display:grid;grid-template-columns:160px 1fr 380px;gap:24px;align-items:start">
    <svg viewBox="0 0 160 330" width="160" aria-label="증류수 비커에 담근 반투막 튜브와 빨대">
      <rect x="10" y="170" width="140" height="150" fill="#D3EBF7"/>
      <rect x="72" y="10" width="16" height="200" fill="#FFFFFF" stroke="#8C99A5" stroke-width="2"/>
      <rect x="74" width="12" fill="#3F8FB0" data-attr="y: 150 - h * 16; height: 60 + h * 16"/>
      <ellipse cx="80" cy="258" rx="34" ry="52" fill="#3F8FB0" stroke="#2A5F78" stroke-width="3"/>
    </svg>
    <figure class="plot" data-x="0, 10" data-y="0, 9" data-xstep="2" data-ystep="2" data-height="330" data-xlabel="시간(분)" data-ylabel="올라간 높이(칸)">
      <i data-line="top * (1 - exp(-x / 3))" data-x="0, max(t, 0.01)"></i>
      <i data-point="t, h"></i>
    </figure>
    <div style="text-wrap: balance">
      <p style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">튜브 속 설탕물
        <button data-set="c" data-value="0.5" aria-pressed="true">0.5 M</button>
        <button data-set="c" data-value="1">1 M</button></p>
      <p>시간 <output data-expr="t" data-unit="분"></output></p>
      <input type="range" name="t" min="0" max="10" step="0.5" value="0" data-play="8" aria-label="시간">
      <p data-ai="모형 수치">올라간 높이 <output data-expr="h" data-digits="1" data-unit="칸"></output> (모형)</p>
      <p data-show="t == 0">「재생」을 누르고 빨대 속 물을 지켜보자.</p>
      <p data-show="t > 0 && t < 10">물이 튜브 안으로 들어와 빨대 속 물이 오른다.</p>
      <div data-show="t == 10"><p>처음에는 빨리 오르다가 점점 느려진다.</p><p>농도를 바꿔 다시 재생해 보자.</p></div>
    </div>
  </div>
</section>
```

- 단추로 튜브 속 농도를 바꾸면 끝 높이(`top`)가 달라진다. 시간을 다시 흘려 두 농도를 견준다.
- 시작(`t = 0`)에는 물이 오르지 않았고 그래프도 비어 있다. 결과를 미리 보여 주지 않는다.
- `h`처럼 모형으로 만든 수에는 '(모형)'을 붙인다. 실험값이 있으면 `data-points`로 함께 찍는다.
- 재생 문법은 `components.md` 16절에 있다.

### 공간 축: 탐침(계산 상자, 위치 슬라이더, 그래프)

자극하고 4 ms가 지났을 때의 축삭이다. 손잡이는 전도 속도이고 축은 위치다. 시간은 4 ms에 멈춰 있고 학생이 탐침을 옮기며 자리마다 막전위를 읽는다. `u`는 흥분이 그 자리에 닿은 뒤 흐른 시간이다.

```html
<section class="slide" id="probe" data-sec="3. 흥분의 전도" data-title="지점별 막전위">
  <h2>자극하고 4 ms가 지났을 때 자리마다 막전위는?</h2>
  <div class="calc" data-ai="막전위 탐침 모형" data-let="u = 4 - d / v; m = u < 0 ? -70 : -70 + 100 * exp(-(u - 1) ^ 2 / 0.18) - 12 * exp(-(u - 2.2) ^ 2 / 0.5)" style="display:grid;grid-template-columns:1fr 420px;gap:24px;align-items:start">
    <div>
      <svg viewBox="0 0 600 70" aria-label="축삭과 탐침">
        <text x="0" y="62" font-size="22">자극</text>
        <rect x="100" y="46" width="480" height="16" rx="8" fill="#F3D9B1" stroke="#9A6B06" stroke-width="2"/>
        <g data-attr="transform: 'translate(' + d * 60 + ' 0)'">
          <path d="M100 4 V44" stroke="#2563EB" stroke-width="4"/>
          <circle cx="100" cy="44" r="6" fill="#2563EB"/>
        </g>
      </svg>
      <figure class="plot" data-x="0, 8" data-y="-90, 40" data-xstep="1" data-ystep="30" data-height="300" data-xlabel="자극한 곳에서 거리(cm)" data-ylabel="막전위(mV)" aria-label="자극 후 4 ms의 거리별 막전위">
        <i data-line="4 - x / v < 0 ? -70 : -70 + 100 * exp(-(4 - x / v - 1) ^ 2 / 0.18) - 12 * exp(-(4 - x / v - 2.2) ^ 2 / 0.5)" data-x="0, max(d, 0.01)"></i>
        <i data-point="d, m" data-label="탐침"></i>
      </figure>
    </div>
    <div>
      <p style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">전도 속도
        <button data-set="v" data-value="1" aria-pressed="true">1 cm/ms</button>
        <button data-set="v" data-value="2">2 cm/ms</button></p>
      <p>탐침 자리 <output data-expr="d" data-digits="1" data-unit="cm"></output></p>
      <input type="range" name="d" min="0" max="8" step="0.5" value="0" aria-label="탐침 자리">
      <p data-ai="모형 수치">막전위 <output data-expr="m" data-digits="0" data-unit="mV"></output> (모형)</p>
      <p data-show="u < 0">흥분이 아직 오지 않았다. 휴지 전위다.</p>
      <p data-show="u >= 0 && u < 1">탈분극 중이다. 막전위가 오른다.</p>
      <p data-show="u >= 1 && u < 2">재분극 중이다. 막전위가 내려간다.</p>
      <p data-show="u >= 2 && u < 3.5">과분극이다. 휴지 전위보다 낮다.</p>
      <p data-show="u >= 3.5">흥분이 지나가고 휴지 전위로 돌아왔다.</p>
    </div>
  </div>
</section>
```

- 탐침 그림은 `data-attr`의 `translate(…)`로 옮기므로 0.6초 동안 이어서 움직인다. 그래프는 탐침이 지나간 곳까지만 그린다(`data-x="0, max(d, 0.01)"`). 결과를 한꺼번에 보여 주지 않는다.
- 막전위 식은 모형이다. 흥분이 닿은 자리의 막전위는 −70 mV에서 1 ms 뒤 +30 mV에 이르고 2 ms 무렵 과분극된다. 교과서 그래프가 있으면 그 값에 맞춘다.
- d1~d4처럼 정해진 자리만 보게 하려면 위치 슬라이더 대신 단계 막대(`data-name="k"`, `data-stops="시작|d1|d2|d3|d4"`)를 두고 `data-let`에서 `k`로 `d`를 계산한다.

### 시공간 축: 전도(계산 상자, 재생, 그래프)

같은 축삭에서 시간을 흘린다. 손잡이는 전도 속도이고 축은 위치와 시간이다. 흥분이 일어난 구간이 축삭을 따라 옮겨 가고 거리별 막전위 그래프가 함께 움직인다.

```html
<section class="slide" id="conduct" data-sec="3. 흥분의 전도" data-title="흥분 전도">
  <h2>흥분은 축삭을 따라 어떻게 전해질까?</h2>
  <div class="calc" data-ai="흥분 전도 모형" data-let="u = t - 6 / v; m = u < 0 ? -70 : -70 + 100 * exp(-(u - 1) ^ 2 / 0.18) - 12 * exp(-(u - 2.2) ^ 2 / 0.5); a = clamp(v * (t - 2), 0, 8); b = clamp(v * t, 0, 8)" style="display:grid;grid-template-columns:1fr 420px;gap:24px;align-items:start">
    <div>
      <svg viewBox="0 0 600 70" aria-label="축삭과 흥분이 일어난 구간">
        <text x="0" y="62" font-size="22">자극</text>
        <rect x="100" y="46" width="480" height="16" rx="8" fill="#F3D9B1" stroke="#9A6B06" stroke-width="2"/>
        <rect y="42" height="24" rx="8" fill="#DC2626" data-attr="x: 100 + 60 * a; width: 60 * (b - a)"/>
        <path d="M460 4 V44" stroke="#2563EB" stroke-width="4"/>
      </svg>
      <figure class="plot" data-x="0, 8" data-y="-90, 40" data-xstep="1" data-ystep="30" data-height="300" data-xlabel="자극한 곳에서 거리(cm)" data-ylabel="막전위(mV)" aria-label="거리별 막전위">
        <i data-line="t - x / v < 0 ? -70 : -70 + 100 * exp(-(t - x / v - 1) ^ 2 / 0.18) - 12 * exp(-(t - x / v - 2.2) ^ 2 / 0.5)"></i>
        <i data-point="6, m" data-label="6 cm"></i>
      </figure>
    </div>
    <div>
      <p style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">전도 속도
        <button data-set="v" data-value="1" aria-pressed="true">1 cm/ms</button>
        <button data-set="v" data-value="2">2 cm/ms</button></p>
      <p>자극 후 <output data-expr="t" data-digits="1" data-unit="ms"></output></p>
      <input type="range" name="t" min="0" max="8" step="0.1" value="0" data-play="8" aria-label="자극 후 시간">
      <p data-ai="모형 수치">6 cm 지점 막전위 <output data-expr="m" data-digits="0" data-unit="mV"></output> (모형)</p>
      <p data-show="t == 0">「재생」을 누르고 축삭을 지켜보자.</p>
      <p data-show="t > 0 && u < 0">흥분이 아직 6 cm 지점에 닿지 않았다.</p>
      <p data-show="u >= 0 && u < 2">6 cm 지점에서 흥분이 일어나고 있다.</p>
      <p data-show="u >= 2">흥분이 6 cm 지점을 지나갔다.</p>
    </div>
  </div>
</section>
```

- 그래프, 6 cm 지점의 막전위, 축삭의 빨간 구간은 모두 같은 식(`t - x / v`)에서 나온다. 거시 값을 따로 지어 움직이지 않는다.
- 재생하면 곡선이 축삭을 따라 오른쪽으로 옮겨 간다. 전도 속도를 2 cm/ms로 바꿔 다시 재생하면 같은 시간에 두 배 멀리 간다.
- 위 공간 축 뼈대와 식이 같다. 시간을 4 ms에 멈추고 탐침을 옮기면 공간 축, 시간을 흘리면 시공간 축이다.
- 입자가 막을 오가는 확산과 삼투는 이 틀 대신 입자 상자(`components.md` 13절)로 만든다.

## 직접 짜야 할 때

부품과 계산 상자로 그릴 수 없는 그림만 직접 짠다. 세포 모양이 찌그러지는 것처럼 그림의 모양이 통째로 바뀌는 경우다. 직접 짜도 축을 고르고 '움직임 공통 규칙'을 지킨다. 아래 예시는 직접 짤 때의 틀을 보이려고 위 흡수력 모형을 스크립트로 다시 짠 것이다. 슬라이더는 '시작'(가림)에서 시작하고, 첫 조작에서 익스플로라그램이 열린다. 코드는 세 곳으로 나눠 넣는다. CSS는 `<head>`의 `<style>`에, 장은 본문에, 스크립트는 `</body>` 바로 앞에 둔다.

```html
<!-- 장 -->
<section class="slide" id="absorb-js" data-sec="2. 삼투" data-title="흡수력 익스플로라그램(스크립트)">
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
#ab-cell, #ab-bar { transition: rx .7s, ry .7s, y .7s, height .7s; }   /* 값이 바뀌면 0.7초 동안 이어서 움직인다 */
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

- **직접 짠 그림도 0.6~0.8초 동안 이어서 움직인다.** 바뀌는 SVG 요소에 CSS `transition`을 준다(위 `#ab-cell`, `#ab-bar`). 크롬, 엣지, 웨일에서는 `rx`, `cx`, `height`, `y` 같은 SVG 속성도 흘러간다. ⚙ 「움직임 끄기」를 켜면 엔진이 transition을 끈다. 운영체제 설정을 보는 `@media (prefers-reduced-motion)`은 쓰지 않는다(위 '움직임 공통 규칙').
- CSS로 흘릴 수 없는 것(캔버스, 글자로 쓴 수, 경로 `d`)은 `requestAnimationFrame`으로 보간한다. 아래 `tween`은 앞 값에서 새 값까지 0.7초 동안 그린다. ⚙ 「움직임 끄기」가 켜져 있으면 바로 끝값을 그린다. 재생이 보낸 `input`에는 한 칸 시간(`e.chPlay`)이 실려 오므로 그 시간 안에 닿게 한다.

```js
const still = () => document.documentElement.classList.contains('ch-motion-off');   // ⚙ 「움직임 끄기」만 본다
function tween(job, to, draw, ms = 700) {   // job = { v: 지금 값, raf: 0 }을 그림마다 하나씩 둔다
  cancelAnimationFrame(job.raf);
  const from = job.v, t0 = performance.now();
  const step = (now) => {
    const p = still() || ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
    job.v = from + (to - from) * (1 - (1 - p) ** 3);   // 끝에서 천천히 멈춘다
    draw(job.v);
    if (p < 1) job.raf = requestAnimationFrame(step);
  };
  job.raf = requestAnimationFrame(step);
}
// 쓰기: const cell = { v: 1, raf: 0 };
//       range.addEventListener('input', (e) => tween(cell, +range.value, (x) => el.setAttribute('rx', 120 * x), e.chPlay ?? 700));
```

- 시간 축이면 시간 슬라이더에 `data-play`를 붙인다. 엔진이 「재생」 단추를 달고 값을 바꿀 때마다 `input` 이벤트를 보내 직접 짠 처리기가 그대로 그린다.
- 화면 글은 `textContent`로 바꾸는 것이 기본이다. 굵게·색 같은 꾸밈이 필요하면 코드에 적어 둔 글만 `innerHTML`로 넣는다. 학생이 입력한 글은 절대 `innerHTML`로 넣지 않는다.
- **슬라이더는 손을 떼면(`change`) `blur()`로 초점을 푼다.** 엔진은 초점이 입력란에 있으면 키를 무시하므로, 풀지 않으면 슬라이더를 만진 뒤 → 키와 리모컨이 장을 넘기지 않고 슬라이더 값을 바꾼다. 엔진 계산 상자는 이미 그렇게 한다.
- 슬라이더에 `autocomplete="off"`를 붙인다. 새로고침 때 브라우저가 값을 되살려 가림막이 열린 채 시작하는 것을 막는다.
- 첫 그리기는 `DOMContentLoaded` 안에서 직접 부른다. 주소로 익스플로라그램 장을 바로 열면 그 장의 `onShow`가 불리지 않는다.
- 가림막 글은 `<span>` 하나로 감싼다. 감싸지 않고 `<br>`을 쓰면 두 줄이 격자 칸 둘로 갈려 위아래로 벌어진다.
- 시간·연도 막대는 첫 칸을 '시작'(가림)으로 두고, 둘째 칸부터 실제 값(0초, 1783년)을 둔다. 눈금 글자는 손잡이의 실제 자리에 둔다. 손잡이 지름이 `T`, 칸 위치가 0~1의 `f`이면 `left: calc(T / 2 + (100% - T) * f)`, `transform: translateX(-50%)`.
- 측정값과 모형값이 섞이면 모형값에만 '(모형)'을 붙이고, PPT 표의 값은 '표의 값'이라고 밝힌다.
- 단추만 있는 익스플로라그램은 자동 점검이 활동으로 세지 않는다. 익스플로라그램을 감싼 요소에 `data-activity`를 붙이면 센다(뼈대처럼).
- 펜 모드에서도 슬라이더와 단추는 조작된다.
- 장이 보일 때 움직임을 시작해야 하면 `Exploragram.onShow((slide, i) => …)`를, 넘길 때 멈춰야 하면 `Exploragram.onHide`를 쓴다. 장을 넘겨도 직접 짠 익스플로라그램의 상태는 그대로 남는다. 다시 들어올 때 처음으로 돌리려면 `onShow`에서 값을 0으로 되돌린다.
- 익스플로라그램이 여럿이면 장마다 `draw…` 함수를 하나씩 두고, id 앞머리(`ab-`, `vg-`)로 서로 섞이지 않게 한다.
- SVG 화살촉(`marker`)은 그 SVG 안에 id를 따로 두고 `marker-end` 속성으로 건다. 다른 장의 SVG에 있는 marker를 가리키면 보이지 않는다.

## 상태를 찍어 확인하기

엔진 자동 점검은 직접 짠 익스플로라그램의 처음 상태(가림막)만 본다. `scripts/states.mjs`는 처음에 모든 장을 점검하고, `states.json`에 적은 상태마다 조작한 뒤 그 장을 다시 점검하고 찍는다. 넘침·잘림·작은 글자와 수업 스크립트의 예외(이벤트 처리기 안에서 난 것 포함)를 적어 준다.

```json
[
  { "slide": 2, "name": "min", "js": "const r = document.querySelector('#ab-v'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "max", "js": "const r = document.querySelector('#ab-v'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "back", "js": "const r = document.querySelector('#ab-v'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true }))" }
]
```

`node scripts/states.mjs 수업.html 폴더 states.json` — `slide`는 1부터 센 장 번호다(`Exploragram.go`는 0부터). 최솟값·최댓값·경계값(팽압이 0이 되는 곳 같은)·모든 단추·'시작'으로 되돌리기를 적는다. 찍힌 그림을 직접 열어 겹침과 계산값을 본다.

## 내기 전 확인

- [ ] 헷갈리는 지점마다 익스플로라그램이 있는가. 손잡이가 그림과 수치(식·그래프)를 함께 바꾸는가.
- [ ] 최솟값·최댓값·경계값에서 그림, 수치, 문장이 맞는가. 직접 눌러 보고 찍어 보았는가.
- [ ] 첫 조작 전에는 결과가 가려져 있는가.
- [ ] 익스플로라그램 안 글자(SVG 포함)가 20px 이상인가. 손잡이와 단추가 56px 이상인가.
- [ ] 모형 수치에 `data-ai="모형 수치"`를 붙이고 화면에 '모형'이라고 적었는가.
- [ ] 장면마다 축(시간, 공간, 시공간)을 하나 골랐는가. 고른 이유가 그 개념이 던지는 질문과 맞는가.
- [ ] 값이 바뀌면 그림이 0.6~0.8초 동안 이어서 움직이는가(계산 상자, 입자 상자, `data-play`, 직접 짠 그림의 `transition`이나 `requestAnimationFrame`). 끝값으로 다시 그리기만 하는 장은 없는가.
- [ ] ⚙ 「움직임 끄기」를 켜면 직접 짠 움직임이 멈추는가. 운영체제 설정(`prefers-reduced-motion`)을 보는 코드는 없는가.
- [ ] 설계표에 적은 손잡이, 축, 부품, 움직임을 모두 만들었는가.
- [ ] 단추를 눌렀을 때 글만 바뀌는 장에 `data-activity`를 붙이지 않았는가.
- [ ] 장에 '원본 PPT', '익스플로라그램 ①' 같은 만드는 쪽 말이 없는가.
