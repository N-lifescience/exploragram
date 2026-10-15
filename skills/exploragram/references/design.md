# 화면과 디자인

## 교실 화면

- 전자칠판(16:9)에 띄운다. 무대 1280×720을 엔진이 창에 맞춰 확대·축소한다. 교실 맨 뒤에서도 읽혀야 한다.
- 글자 크기는 아래와 같다. SVG 안 글자도 실제 크기로 잰다. 넘치면 글자를 줄이지 말고 **장을 나눈다**.
  - 장 제목: 40~44px
  - 본문: 30px 안팎
  - 어떤 글자도 20px 미만은 안 된다. 엔진 툴바와 쪽 번호는 예외다.
- 쓸 수 있는 높이는 테마마다 다르다.
  - `ppt` 테마: `data-sec`이 있는 장은 위 112·아래 56을 뺀 552px(제목 포함), 없는 장(표지 등)은 위 72
  - `paper` 테마: 위 72·아래 64를 뺀 584px
  - 점검의 넘침 메시지가 넘친 px와 맨 아래 요소를 알려 준다.
- 긴 제시문과 보기가 있는 문항(수능형)은 제시문을 왼쪽, 보기를 오른쪽에 둔다. 제시문만 22~24px까지 줄여도 된다. 보기가 반 폭에서 두 줄이 되거나 제시문이 8줄을 넘으면 제시문 장과 보기 장으로 나눈다.
- 누르는 것은 56px 이상으로 만든다(단추 `min-height: 56px`, 슬라이더 `input` 높이 56px). 엔진 부품의 단추는 이미 맞춰져 있다. 마우스를 올려야만 되는 기능은 만들지 않는다.
- 빈 곳을 눌러 넘기는 기능은 없다(판서 중 사고 방지). 넘기기는 → Space PageDown, ← PageUp, 숫자+Enter, 툴바 ◀ ▶다.

## 원본 PPT의 얼굴 다시 그리기

1. **원본을 본다.** 코드를 실행할 수 있으면 장을 그림으로 뽑는다.
   - Windows + PowerPoint:
     ```powershell
     $p = New-Object -ComObject PowerPoint.Application
     $d = $p.Presentations.Open("C:\경로\수업.pptx", $true, $false, $false)
     $d.SaveAs("C:\경로\ppt-slides", 18)
     $d.Close(); $p.Quit()
     ```
     `18`은 PNG로 저장하라는 뜻이다.
   - LibreOffice: `soffice --headless --convert-to pdf 수업.pptx`로 PDF를 만든 뒤 쪽을 그림으로 본다.
2. **색은 `theme.json`의 `css` 줄에서 시작한다.** 예: `body[data-theme="ppt"] { --accent: #1D4E89; --tab: #1D4E89; --tab-ink: #FFFFFF; }`
3. **머리 띠와 배지를 이 수업의 CSS로 그린다.**
   - `ppt` 테마는 위 30px 색 띠와, `data-sec` 이름을 쓴 왼쪽 위 탭(높이 78px, `.slide::before`)을 그린다. 원본에 다른 머리 띠가 있으면 제목을 띠로 만들어 그 위를 덮는다. 이 방법은 위 여백이 112px인 장(`data-sec`이 있는 장)에 쓴다. `data-sec`은 목차 묶음으로 계속 쓴다.

```css
/* 원본처럼 위 머리 띠 + 오른쪽 배지 */
section.slide > h2 {
  position: absolute; z-index: 5; left: 0; top: 0; width: 1280px; height: 100px; margin: 0;
  padding: 0 260px 0 60px; box-sizing: border-box; display: flex; align-items: center;
  background: var(--tab); color: var(--tab-ink); font-size: 42px; line-height: 1.2; border: 0;
}
.badge {
  position: absolute; z-index: 6; top: 27px; right: 42px; min-width: 160px; height: 48px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; background: #F59F00; color: #222; font-size: 26px; font-weight: 800;
}
```

4. **표지와 장 바탕처럼 장 전체의 모양은 엔진 규칙보다 우선순위를 높여야 이긴다.** 바탕을 색으로 칠하면 글자색도 모두 바꾼다. 표지의 꼬리표(`.kicker`)는 강조색, 제목은 어두운 글자, `::after`는 쪽 번호다.

```css
body[data-theme="ppt"] section.slide.cover { background: var(--tab); color: var(--tab-ink); }
body[data-theme="ppt"] section.slide.cover h1,
body[data-theme="ppt"] section.slide.cover .kicker,
body[data-theme="ppt"] section.slide.cover::after { color: var(--tab-ink); }
```

5. 번호 상자, 핵심어 색(원본의 빨강·파랑), 쪽 표시, 액자도 같은 방법으로 다시 그린다. 등장 효과는 엔진에 맡긴다.
6. 장마다 되풀이되는 머리 띠·배지에는 `data-enter="off"`를 붙인다(엔진 v1.1부터). 붙이지 않으면 장을 넘길 때마다 엔진의 등장 효과로 띠가 다시 나타난다. 배지처럼 꾸밈만 하는 요소에는 `aria-hidden="true"`도 붙인다.
7. `data-allow-overflow`는 아껴 쓴다. 장 안에 하나라도 있으면 **그 장 전체의 넘침 점검이 꺼진다.** 머리 띠·배지는 무대 안에 있으므로 붙이지 않는다. 무대 밖으로 일부러 삐져나가는 꾸밈 도형에만 붙이고, 그 장은 `states.mjs`로 찍은 그림을 직접 보며 넘침을 확인한다.

## 테마

`<body data-theme="…">`

| 테마 | 모습 | 쓰는 때 |
|---|---|---|
| `ppt` | 흰 바탕, 위 색 띠, 왼쪽 위 `data-sec` 탭 | 원본 PPT 모양을 이을 때(권장) |
| `paper` | 따뜻한 종이색, 강조색 하나 | 원본 색이 없거나 단순할 때 |
| `grid` | 32px 모눈 | 수학·과학 풀이 |
| `chalk` | 어두운 초록 칠판, 흰 펜 | 칠판 느낌 |

- 색 변수는 다음과 같다.
  - `--accent`: 제목 번호·단추·막대
  - `--tab`·`--tab-ink`: 머리 띠와 그 글자
  - `--table-head`·`--table-side`: 엔진 표의 머리 줄과 첫 칸
  - `--pill`, `--qnum`, `--bar-c`, `--map-new`
- 글자 대비는 4.5:1 이상으로 한다. 밝은 띠에는 어두운 `--tab-ink`를 쓴다.

## 배치

- 엔진이 쓰는 이름은 수업 CSS에서 쓰지 않는다. 엔진은 어절마다 `<ch-w class="w">`로 감싸므로 `.w` 규칙은 모든 낱말에 걸린다. `.band`는 표지 띠, `ch-`로 시작하는 이름은 엔진 부품이다. `data-eid`는 편집 모드가 요소마다 붙이는 번호다.
- 동그라미 숫자(①②)는 Windows에서 22px 안팎일 때 ⊙처럼 깨질 수 있다. 직접 만든 단추와 눈금 이름에는 '1.'을 쓴다. 엔진 부품(퀴즈 보기 번호, `ol.circled`)의 번호는 엔진이 맡는다.

- 두 칸 배치는 `display: grid; grid-template-columns: 420px 1fr; gap: 28px;`처럼 이 수업 CSS에 쓴다. 익스플로라그램(Exploragram)은 왼쪽에 그림·그래프, 오른쪽에 손잡이를 둔다(`1fr 420px`). 오른손잡이 교사가 판 앞에서 조작해도 몸이 그림을 가리지 않는다.
- 그림 폭을 정하면 높이가 따라 커진다. 그림과 막대(약 110px)가 제목 아래 약 470px 안에 들어가게 폭을 고른다.

## 인쇄

Ctrl+P로 장마다 한 쪽씩 인쇄된다. 엔진이 단계를 모두 펼치고, 문제는 정답 표시, 분류 카드는 정답 칸에 넣어 인쇄한다. 직접 짠 익스플로라그램은 인쇄할 때 지금 상태 그대로 나온다.

## 그림

- 외부 그림 주소를 쓰지 않는다. 만드는 동안은 `src="media/3-1.png"`처럼 추출한 파일을 상대 경로로 가리키고, 전달할 때 `bundle.py`가 `data:` URI(긴 변 1600px 이하)로 넣는다. 코드를 실행할 수 없으면 그림 자리 `img[data-ppt]`로 남긴다. `bundle.py`가 큰 PNG를 JPEG로 바꿔 넣는다.
- 영상·사료 주소 같은 링크는 `a.pill`로 쓴다. 원본 PPT의 로컬 파일 링크(mp4 등)는 '원본 PPT 22쪽 영상'처럼 적거나 뺀다.
- 모든 그림에 `alt`를 단다. 교과서 지도와 사진은 그림 설명에 출처를 쓴다.
- 학생 실명과 사진을 넣지 않는다.
