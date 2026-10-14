<!-- 자동 생성: node tools/build.mjs (손으로 고치지 않는다) -->
# class-html 합본 지침

> **AI에게**: 이 파일 하나가 Exploragram(옛 이름 class-html) 지침 전체다. 선생님이 수업 PPT를 주면 이 지침대로 수업용 HTML을 만든다.
> **반드시**: `<head>`에 아래 엔진 css·js 두 줄을 넣는다(지금 환경에서 안 열려도 그대로 둔다). 넘기기·툴바를 직접 짜지 않고, PPT 장을 통째로 그림으로 넣지 않는다(1절 기준 8·9).
> 본문의 `references/…`는 이 파일의 해당 절을, `scripts/…`는 저장소 https://github.com/N-lifescience/exploragram 의 `skills/class-html/scripts/`를 가리킨다.
> 엔진: `https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/engine/class-html.css`·`.js` (v1.5.0)
> 레퍼런스 완성본(`references/examples/`): https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/skills/class-html/references/examples/elem-shadow.html · https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/skills/class-html/references/examples/eth-exploragram.html · https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/skills/class-html/references/examples/mid-linear.html · https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/skills/class-html/references/examples/sci-diffusion.html · https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/skills/class-html/references/examples/soc-supply-demand.html

## 차례

1. 절차와 기준
2. 익스플로라그램
3. 화면과 원본 모양
4. 부품 사전
5. 한국어 문장

---

## 1. 절차와 기준

PPT를 HTML로 옮기는 일이 아니다. PPT로는 못 하는 수업을 만든다. 중심은 **익스플로라그램**(Exploragram: explore + diagram, explorable explanation에서 온 말)이다. 학생이나 교사가 값을 바꾸거나 고르면 그림과 수치·식·그래프가 함께 계산되어 바뀐다.

**만들기 전에 교과에 맞는 레퍼런스 하나를 연다.** `references/examples/`에 있다. 모양을 베끼지 말고 수준을 가져온다.

- 과학·수학·정보: `sci-diffusion.html`. 연수 실습 PPT로 만든 12장짜리 완성본이다. 원본의 머리 띠·배지를 다시 그렸다. 익스플로라그램은 셋이다: 시간 막대로 퍼지는 입자, 온도에 따라 바뀌는 입자 길과 그래프, 매질 단추.
- 사회: `soc-supply-demand.html`. 역시 12장짜리 완성본이다. 익스플로라그램은 가격 막대로 움직이는 수요·공급 그래프, 사건 단추로 옮겨 가는 곡선이다.
- 윤리·국어처럼 계산이 없는 교과: `eth-exploragram.html`. 익스플로라그램 다섯 장이다: 이성과 정서의 저울, 리벳 실험 시간 막대, 공감 게이지, 마을 시뮬레이터, 혈연 선택 부등호.
- 초등학교: `elem-shadow.html`. 초등 과학 '빛과 그림자' 9장이다. 낱말을 쉽게 쓰고, 익스플로라그램은 손전등과 인형 사이 거리로 그림자 크기가 바뀌는 모형(옆에서 본 빛줄기와 벽의 그림자를 함께), 물체를 골라 그림자 진하기가 바뀌는 모형이다.
- 수학·중학교: `mid-linear.html`. 중2 '일차함수의 그래프' 10장이다. 스크립트 없이 엔진 계산 상자와 그래프만으로 만든 본보기다: 기울기·y절편 슬라이더, 증가량의 비(어디서 재도 같은 기울기), 단계 막대로 여는 활용 문제.

익스플로라그램을 설계하는 법, 교과별 아이디어, 뼈대 코드, 상태 찍기는 `references/exploragram.md`에 있다. 화면·원본 모양은 `references/design.md`, 부품은 `references/components.md`, 문장은 `references/korean.md`에 있다.

### 엔진이 하는 일

판서(펜·형광펜·지우개·레이저), 칠판, 반별 저장, 넘기기, 인쇄, 자동 점검, 편집 모드(교사가 툴바 「편집」에서 글·상자·그림·도형을 골라 고치고 HTML로 저장)는 엔진이 한다. 이 기능을 직접 만들지 않는다. 펜을 든 채로 익스플로라그램의 단추나 슬라이더를 눌러도 엔진이 조작으로 처리한다. 교사가 펜 모드와 조작 모드를 오갈 필요가 없다. 다만 엔진은 초점이 입력란에 있으면 → 키를 무시하므로, 직접 짠 슬라이더는 손을 떼면 초점을 풀어야 한다(`exploragram.md` 뼈대).

- 뼈대는 `assets/template.html`이다. `<head>`에 엔진 css·js 두 줄(`@1`)을 넣는다. 판서 저장 열쇠인 `<html data-deck="…">`는 영문 소문자·숫자·하이픈으로 덱마다 다르게 쓴다(예: `sci-diffusion-1`). 몸체는 `<body data-theme="ppt">`로 연다.
- 장 하나는 `<section class="slide" id="고정-id" data-title="…">` 하나다. 무대는 1280×720이고 엔진이 화면에 맞춰 키운다.
- 답이나 결론은 `class="step"`으로 숨긴다. → 키를 누르면 차례로 열린다.
- 익스플로라그램 스크립트는 `</body>` 앞 `<script>` 하나에 `document.addEventListener('DOMContentLoaded', () => { … })`로 쓴다. 학생 입력을 `innerHTML`로 넣지 않는다.
- 넘친 장은 엔진이 조금 줄여서 다 보이게 한다(많이 넘쳐도 0.75배까지만). 수업에서 내용이 잘리지 않게 하는 안전망이다. 점검은 줄이기 전 크기로 재서 계속 오류로 알린다. 넘친 장은 나눠서 고친다.
- 엔진 부품으로는 퀴즈, 분류 카드, 라벨 붙이기, 순서 배열, 연표, 지도 단계 공개, 입자 상자, 계산 상자와 그래프(끌어 옮기는 점 포함)가 있다(`references/components.md`). 딱 맞으면 쓴다. 익스플로라그램은 부품에 개념을 맞추지 말고 개념에 맞춰 직접 짠다. 코드를 실행해 화면을 확인할 수 없는 환경이면 스크립트 대신 계산 상자와 CSS 변수로 익스플로라그램을 만든다(`references/exploragram.md`의 '스크립트 없이').

### 절차

1. **읽기**
   - 코드를 실행할 수 있으면 `python3 scripts/extract_pptx.py 수업.pptx -o 작업폴더`를 돌린다(Windows는 `py -3`). `outline.md`(장별 글·노트), `media/`(그림), `theme.json`(원본 색)이 나온다. 실행할 수 없으면 PPT를 직접 읽고, 그림은 `<img data-ppt="12-2" alt="…">` 자리로 남긴다.
   - 글이 적은 장은 그림을 열어 읽는다. 글이 박힌 그림(말풍선, 표, 손글씨 정리)은 HTML 글로 다시 친다.
   - PPT에서 차례로 나타나던 내용은 `.step` 순서나 단계 막대로 옮긴다. 도형이 움직이던 애니메이션은 그 움직임을 만드는 손잡이(슬라이더)로 바꾼다.
   - 장을 그림으로 뽑을 수 있으면 뽑아서 원본 모양을 본다(`references/design.md`의 '원본 PPT의 얼굴').
2. **인터뷰.** 아래를 한 번에 묻는다. 짐작한 답에 (추천)을 붙이고, "알아서"라고 하면 추천대로 간다. 물을 수 없는 환경이면 추천대로 만들고, 정한 답을 전달 때 함께 알린다.
   ① 교과·학년·차시
   ② 학생이 가장 헷갈려 하는 지점(PPT에서 후보 3개를 뽑아 보여 준다)
   ③ 꼭 만지게 하고 싶은 장면. "PPT로 수업할 때 아쉬웠던 장면이 있나요?"를 함께 묻는다.
   ④ 지킬 것: 시험 범위, 그대로 둘 문장, 뺄 장
   ⑤ 넣을 영상이나 사이트 주소, 글이 많은 그림(표, 원문 분석)의 원문 파일. 영상 주소는 선생님이 준 것만 쓴다. 원문을 받으면 그림 속 글을 짐작해 읽지 않고 원문으로 다시 친다.
3. **설계 확인.** 표를 채팅에 보여 주고 "이대로 만들까요?"라고 묻는다. 표의 칸은 '개념 | 헷갈리는 지점 | 익스플로라그램: 무엇을 만지면 무엇이 계산되어 바뀌나'다. 설계표는 HTML에 넣지 않는다. 물을 수 없는 환경이면 설계표를 전달 메모에 붙이고 진행한다.
4. **쓰기.** 아래 '기준'을 따른다.
5. **점검**
   - 코드를 실행할 수 있으면 `node scripts/states.mjs 수업.html 폴더 [states.json]`을 돌린다(Node 22 이상, 크롬이나 엣지). 엔진 자동 점검 결과(넘침·잘림·작은 글자·부품 실수)와 스크립트 예외를 적어 준다. errors가 0이 될 때까지 고친다.
   - 엔진 점검은 부품의 여러 상태를 재지만, 직접 짠 익스플로라그램은 처음 상태(가림막)만 본다. 익스플로라그램마다 최솟값·최댓값·경계값·모든 단추를 `states.json`에 적어 그 상태마다 다시 재고 찍는다(`exploragram.md`). 찍은 그림을 직접 열어 겹침과 계산값을 확인한다.
   - 코드를 실행할 수 없으면 전달할 때 이렇게 부탁한다. "파일을 열었을 때 툴바에 「점검」 단추가 뜨면 눌러 보세요. 점검 창에서 「AI에게 보낼 말 복사」를 누르고 여기에 붙여 주시면 고쳐 드릴게요."
   - 선생님이 파일을 처음 열면 엔진이 한 번 점검한다. 고칠 곳이 있으면 툴바에 「점검 N」 단추가 뜬다. 전자칠판에서는 ⚙ 설정의 「자동 점검」으로도 연다. 선생님이 복사한 목록을 붙여 넣으면 그 항목만 고치고 파일 전체를 다시 준다.
   - 단추만 있는 익스플로라그램은 익스플로라그램을 감싼 요소에 `data-activity`를 붙여야 점검이 활동으로 센다.
6. **전달**
   - 사용법, 확인 부탁, 저작권 안내는 채팅 답변에 쓴다. 장에는 넣지 않는다.
   - `python3 scripts/bundle.py 수업.html -o 수업-한파일.html`로 그림을 파일 안에 넣는다. 인터넷이 없는 교실이면 `--offline`을 붙인다.
   - 사용법을 쓴다: ① 더블클릭해 연다 ② 툴바에서 펜을 고르고 ◀ ▶로 넘긴다. 그림 자리(`img[data-ppt]`)가 남아 있으면 ③ 원본 PPT를 화면에 끌어다 놓고 ⚙ 「그림 넣어 저장」을 덧붙인다. 글자·색·위치를 고칠 곳이 있으면 툴바 「편집」에서 바로 고치고 「HTML 저장」으로 받은 파일로 원래 파일을 바꾸면 된다는 것도 알린다.
   - AI가 푼 정답, 흐린 그림에서 읽은 글, 모형 수치, 스스로 정한 인터뷰 답은 따로 적어 선생님께 확인을 부탁한다.
   - "교과서 그림이 들어 있으니 수업용으로만 쓰고 인터넷에 공개하지 마세요."를 덧붙인다.

### 기준

1. **익스플로라그램.** 헷갈리는 지점마다 중심 장 하나는 익스플로라그램으로 만든다(한 차시에 보통 2~4개). 손잡이(슬라이더·단추)는 보통 1~2개, 많아도 3개다(저절로 움직이는 단추는 따로). 손잡이가 그림과 수치·식·그래프를 함께 바꾸고, 결과에 따라 문장이 달라진다. 누르면 글이 나타나기만 하는 장, 퀴즈, 분류 카드는 익스플로라그램이 아니다. 이런 장은 익스플로라그램 뒤의 확인용으로 쓴다. 한 장에 익스플로라그램 하나.
   - 단추를 눌렀을 때 바뀌는 것이 글뿐이면 익스플로라그램이 아니다. 고른 값으로 자리, 길이, 개수, 비율, 판정 가운데 하나를 계산해 그림과 함께 바꾼다.
   - 글만 바뀌는 장에는 `data-activity`를 붙이지 않는다. 붙이면 점검이 `text-only`로 알리고 활동 장으로 세지 않는다.
2. **0단계에서 시작.** 직접 짠 익스플로라그램은 첫 조작 전까지 결과를 가림막으로 가린다. 단계·시간·연도를 여는 슬라이더는 첫 칸이 '시작'이다. 연표·지도·비교 전환도 아무것도 공개되지 않은 상태에서 시작하고, 첫 조작이 1단계를 연다.
   - 조건을 비교하는 슬라이더(사람 수, 정서 세기처럼 기준값이 있어야 비교되는 것)는 기준값에서 시작해도 된다. 그때도 결과는 다른 첫 조작(상황 고르기 등) 전까지 가린다. 점검의 `not-veiled` 경고는 남아도 된다.
   - 엔진 계산 상자(`.calc`)는 기준값을 보여 주며 시작해도 된다. 엔진이 첫 상태를 점검하고 초점도 풀어 주기 때문이다. 계산 상자로도 0단계 가림이 필요하면 단계 막대를 변수로 쓴다(`exploragram.md`의 '스크립트 없이').
3. **원본 PPT의 얼굴.** 색만 옮기지 않는다. 머리 띠, 배지, 번호 상자, 쪽 표시, 빨강·파랑 핵심어 같은 원본 모양을 이 수업의 CSS로 다시 그린다. 방법은 `references/design.md`에 있다.
4. **사실은 그대로, 문장은 새로.**
   - 사실·정의·정답·자료 출처는 PPT 그대로 둔다. 문장은 윤문한다(`references/korean.md`). AI 말투를 쓰지 않고, 줄은 의미 단위로 바꾸고, 맞춤법을 지킨다.
   - 장 순서는 수업 흐름에 맞게 바꿔도 된다. 그때 글 속의 '6쪽의 표' 같은 가리킴을 새 쪽 번호로 고친다.
5. **PPT 밖 내용은 아껴서.** 새 사례나 실험은 익스플로라그램에 꼭 필요할 때만 들인다. 표시는 다음과 같이 한다.
   - AI가 새로 쓴 설명·문항·예시는 그것을 감싼 가장 작은 덩어리에 `data-ai="무엇"`을 붙인다.
   - 모형 수치에는 `data-ai="모형 수치"`를 붙이고 화면에도 '(모형)'이라고 적는다.
   - PPT에 정답이 없는 문제를 AI가 풀었으면 `data-ai="정답 확인 필요"`를 붙인다.
   - 표시는 겹쳐도 된다. 익스플로라그램 전체에 '무엇', 그 안의 수치에 '모형 수치'를 붙인다.
6. **교실 뒤에서 읽힌다.** 본문은 30px 안팎이고, 어떤 글자도 20px보다 작으면 안 된다(SVG 안 글자 포함, 엔진 툴바·쪽 번호는 예외). 넘치면 글자를 줄이지 말고 장을 나눈다. 표의 글자도 줄이지 않는다. 줄이 많은 표는 두 장으로 나눈다. 누르는 것은 56px 이상으로 만들고(단추 높이, 슬라이더 입력 높이), 마우스를 올려야만 되는 기능은 만들지 않는다. 한 장에 한 생각만 담는다.
7. **안전.** 외부 그림 주소는 쓰지 않는다. 만드는 동안은 `media/` 상대 경로, 전달할 때는 `bundle.py`로 넣은 `data:` URI, 코드를 실행할 수 없으면 `img[data-ppt]`를 쓴다. 학생 실명과 사진은 넣지 않는다. 장마다 고정 `id`를 붙인다.
8. **엔진을 꼭 쓴다.** `<head>`의 엔진 css·js 두 줄을 지우거나 바꾸지 않는다. 만드는 환경에서 엔진 주소가 열리지 않아도 그대로 둔다(교실 브라우저가 연다). 넘기기·툴바·판서·무대 크기 맞추기를 직접 짜지 않는다. 장(`section.slide`)에는 `display`를 주지 않는다. 가운데 맞춤 같은 배치는 장 안에 상자를 하나 두고 거기에 준다. `.step`은 → 키를 눌러야 나타난다. 처음부터 보여야 하는 상자에는 다른 클래스 이름을 쓴다. 인터넷이 없는 교실이면 전달 때 `bundle.py --offline`으로 엔진을 파일 안에 넣는다.
9. **PPT 장을 통째로 그림으로 넣지 않는다.** 장 전체를 찍은 그림을 붙이면 글을 고칠 수 없고 익스플로라그램도 못 붙인다. 문제·식·표는 HTML 글로 다시 치고(수식은 `references/components.md`의 수식), 원본 그림은 그림 부분만 쓴다. 표나 원문 분석처럼 글이 많은 그림도 HTML 표와 글로 다시 친다. 그림으로 줄여 넣으면 교실 뒤에서 읽을 수 없다. 장 안을 `position: absolute` 틀로 통째로 덮지 않는다. 여백은 엔진이 잡는다.
10. **학생이 보는 화면에는 수업만.** 만드는 과정 이야기를 장에 쓰지 않는다.
    - '원본 PPT의 표를 재구성함', 'PPT 3쪽 참고' 같은 말을 쓰지 않는다. 출처가 필요하면 '교과서 62쪽'처럼 학생이 찾을 수 있는 것을 적는다.
    - '익스플로라그램 ①', '손잡이 ①'을 제목이나 꼬리표로 쓰지 않는다. 그 장에서 던지는 물음을 제목으로 쓴다.
    - PPT에서 틀린 계산이나 표기를 찾으면 장에는 바른 내용만 쓴다. 무엇을 고쳤는지는 전달 메모에 적는다.
    - 문제의 정답 자리를 섞는다. 정답이 모두 같은 번호면 점검이 알린다.

### 길이

- PPT가 40장을 넘으면 차시별로 파일을 나눈다.
- 답이 길어 끊기면 선생님이 '계속'이라고 쓸 때 끊긴 곳부터 이어 쓴다. 코드를 실행할 수 있으면 장을 파일로 나눠 쓰고 이어 붙인다.

---

## 2. 익스플로라그램

### 무엇이 익스플로라그램인가

세 가지가 있으면 익스플로라그램이다.

1. **손잡이**: 학생이 바꾸는 입력 한두 개(슬라이더, 단추 묶음). 셋을 넘기지 않는다. 「시장에 맡기기」처럼 저절로 움직이게 하는 단추를 더해도 된다.
2. **함께 바뀌는 두 표현**: 그림과 함께 수치·식·그래프·막대 가운데 하나 이상이 같은 계산으로 움직인다.
3. **결과에 따라 달라지는 문장**: "팽압이 0이다", "양보하는 성향이 퍼진다"처럼 지금 값이 무엇을 뜻하는지 한 줄로 말한다.

누르면 글이 열리기만 하는 것, 퀴즈, 분류 카드는 익스플로라그램이 아니다.

단추를 누르면 설명 글이나 카드 목록만 바뀌는 것도 아니다. 고른 값으로 무엇인가를 계산해야 한다. 자리, 길이, 개수, 비율, 판정 가운데 하나가 값에 따라 달라지고 그림이 그것을 보여 준다.

**몇 개?** 한 차시(PPT 10~25장)에 보통 2~4개. 헷갈리는 지점마다 하나씩이고, 법칙 둘을 한 익스플로라그램으로 묶어도 된다.

### 설계 순서

1. 헷갈리는 지점을 한 문장으로 쓴다. 예: "부풀수록 물을 더 빨아들일 것 같다."
2. 그 지점을 가르는 변수를 찾는다. 예: 세포 부피. 이 변수가 손잡이가 된다.
3. 변수가 바뀌면 무엇이 보여야 오개념이 깨지는지 정한다. 예: 세포가 커지는 그림과, 흡수력 막대가 줄어드는 모습을 함께 보여 준다.
   - 변하는 것과 함께 변하지 않는 것도 보여 준다. 기하에서는 모양을 바꿔도 그대로인 성질이 그 차시의 결론인 경우가 많다. 예: 삼각형의 꼭짓점을 옮겨도 무게중심은 중선을 2:1로 나눈다.
4. 계산 규칙을 정한다.
   - 교과서 식이 있으면 그 식을 쓴다.
   - 식이 없는 교과(윤리·사회·국어)는 개념을 지키는 단순한 모형을 만든다. 저울의 무게, 세대마다 바뀌는 비율, 부등호 같은 것이다.
   - 모형 수치는 `data-ai="모형 수치"`로 표시하고, 화면에도 '모형'이라고 적는다.
5. 극단값을 확인한다. 최솟값·최댓값·경계값에서 그림과 문장이 말이 되는지 본다. 0으로 나누면 '?'를 보인다.

### 교과별 아이디어

- **과학**: 식으로 그림이 바뀌는 모식도(흡수력 = 삼투압 − 팽압, 옴의 법칙 회로, 렌즈 상), 변인 슬라이더와 그래프 위 지금 값 표시, 입자 상자(확산·삼투·기체), 시간 막대(세포 분열 단계, 판 이동).
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

#### 꼭짓점을 끌어 옮기는 무게중심(수학 예시)

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

### 엔진에 붙이는 뼈대

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

### 스크립트 없이: 계산 상자로 만드는 익스플로라그램

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

### 상태를 찍어 확인하기

엔진 자동 점검은 직접 짠 익스플로라그램의 처음 상태(가림막)만 본다. `scripts/states.mjs`는 처음에 모든 장을 점검하고, `states.json`에 적은 상태마다 조작한 뒤 그 장을 다시 점검하고 찍는다. 넘침·잘림·작은 글자와 수업 스크립트의 예외(이벤트 처리기 안에서 난 것 포함)를 적어 준다.

```json
[
  { "slide": 2, "name": "min", "js": "const r = document.querySelector('#ab-v'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "max", "js": "const r = document.querySelector('#ab-v'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }))" },
  { "slide": 2, "name": "back", "js": "const r = document.querySelector('#ab-v'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true }))" }
]
```

`node scripts/states.mjs 수업.html 폴더 states.json` — `slide`는 1부터 센 장 번호다(`ClassHTML.go`는 0부터). 최솟값·최댓값·경계값(팽압이 0이 되는 곳 같은)·모든 단추·'시작'으로 되돌리기를 적는다. 찍힌 그림을 직접 열어 겹침과 계산값을 본다.

### 내기 전 확인

- [ ] 헷갈리는 지점마다 익스플로라그램이 있는가. 손잡이가 그림과 수치(식·그래프)를 함께 바꾸는가.
- [ ] 최솟값·최댓값·경계값에서 그림, 수치, 문장이 맞는가. 직접 눌러 보고 찍어 보았는가.
- [ ] 첫 조작 전에는 결과가 가려져 있는가.
- [ ] 익스플로라그램 안 글자(SVG 포함)가 20px 이상인가. 손잡이와 단추가 56px 이상인가.
- [ ] 모형 수치에 `data-ai="모형 수치"`를 붙이고 화면에 '모형'이라고 적었는가.
- [ ] 단추를 눌렀을 때 글만 바뀌는 장에 `data-activity`를 붙이지 않았는가.
- [ ] 장에 '원본 PPT', '익스플로라그램 ①' 같은 만드는 쪽 말이 없는가.

---

## 3. 화면과 원본 모양

### 교실 화면

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

### 원본 PPT의 얼굴 다시 그리기

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

### 테마

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

### 배치

- 엔진이 쓰는 이름은 수업 CSS에서 쓰지 않는다. 엔진은 어절마다 `<ch-w class="w">`로 감싸므로 `.w` 규칙은 모든 낱말에 걸린다. `.band`는 표지 띠, `ch-`로 시작하는 이름은 엔진 부품이다. `data-eid`는 편집 모드가 요소마다 붙이는 번호다.
- 동그라미 숫자(①②)는 Windows에서 22px 안팎일 때 ⊙처럼 깨질 수 있다. 직접 만든 단추와 눈금 이름에는 '1.'을 쓴다. 엔진 부품(퀴즈 보기 번호, `ol.circled`)의 번호는 엔진이 맡는다.

- 두 칸 배치는 `display: grid; grid-template-columns: 420px 1fr; gap: 28px;`처럼 이 수업 CSS에 쓴다. 익스플로라그램(Exploragram)은 왼쪽에 그림·그래프, 오른쪽에 손잡이를 둔다(`1fr 420px`). 오른손잡이 교사가 판 앞에서 조작해도 몸이 그림을 가리지 않는다.
- 그림 폭을 정하면 높이가 따라 커진다. 그림과 막대(약 110px)가 제목 아래 약 470px 안에 들어가게 폭을 고른다.

### 인쇄

Ctrl+P로 장마다 한 쪽씩 인쇄된다. 엔진이 단계를 모두 펼치고, 문제는 정답 표시, 분류 카드는 정답 칸에 넣어 인쇄한다. 직접 짠 익스플로라그램은 인쇄할 때 지금 상태 그대로 나온다.

### 그림

- 외부 그림 주소를 쓰지 않는다. 만드는 동안은 `src="media/3-1.png"`처럼 추출한 파일을 상대 경로로 가리키고, 전달할 때 `bundle.py`가 `data:` URI(긴 변 1600px 이하)로 넣는다. 코드를 실행할 수 없으면 그림 자리 `img[data-ppt]`로 남긴다. `bundle.py`가 큰 PNG를 JPEG로 바꿔 넣는다.
- 영상·사료 주소 같은 링크는 `a.pill`로 쓴다. 원본 PPT의 로컬 파일 링크(mp4 등)는 '원본 PPT 22쪽 영상'처럼 적거나 뺀다.
- 모든 그림에 `alt`를 단다. 교과서 지도와 사진은 그림 설명에 출처를 쓴다.
- 학생 실명과 사진을 넣지 않는다.

---

## 4. 부품 사전

엔진이 동작을 붙인다. 수업 HTML에는 구조와 `data-*` 속성만 쓴다. 퀴즈·분류 같은 확인 활동과 단계 공개는 부품으로 쓴다. 익스플로라그램(Exploragram)은 개념에 맞춰 직접 짜도 된다(`exploragram.md`, 이 문서 12절).

`data-why`·`data-hint`·`data-stops` 같은 속성 값은 글자만 된다(태그 없음). 위첨자·아래첨자는 유니코드로 쓴다(Na⁺, H₂O, x²).

### 0. 뼈대와 공통 모양

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

### 1. 단계 막대 `.reveal`

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

### 2. 비교 전환 `.switch`

```html
<div class="switch" id="fr" data-stops="시작|7월 혁명 1830|2월 혁명 1848">
  <dl data-only="1">…</dl>
  <dl data-only="2">…</dl>
</div>
```

단추형 단계 막대. 단추 줄과 "단추를 눌러 보자" 안내는 `.switch` 안 맨 위에 붙는다(단계 막대의 슬라이더는 맨 아래). 처음엔 아무 단추도 눌려 있지 않다. 나머지는 단계 막대와 같다.

### 3. 그림 지도 단계 공개 `figure.map-reveal`

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

### 4. 연표 막대 `ol.yearline`

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

### 5. 분류 카드 `.sort`

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

### 6. 즉시 확인 문제 `.quiz`

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

#### 6-1. 단답 쓰기 `.short`

```html
<div class="short" data-ph="내 생각을 한 문장으로 적어요">
  <p class="ask">바람이 없는데도 냄새가 퍼지는 이유는 무엇일까?</p>
</div>
```

- 엔진이 입력칸과 「보내기」를 붙인다. 200자까지 받는다. `data-ph`는 입력칸 안 안내 글이다.
- 실시간 수업에서는 학생이 보낸 답이 교사 「학생 보기」에 이름 없이 카드로 모인다. 교사는 카드의 ×로 칠판에서 숨길 수 있다.
- 실시간이 아닐 때는 「보내기」를 눌러도 아무 데도 가지 않는다. 생각 열기·예측·한 줄 정리처럼 답이 여럿일 수 있는 물음에 쓴다. 정답이 하나인 물음은 `.quiz`나 `.blank`를 쓴다.
- 높이: 입력칸 약 100px + 알림 줄 약 40px.

### 7. 순서 배열 `ol.order`

```html
<ol class="order">
  <li data-why="처음에는 시야가 넓은 저배율로 찾는다.">저배율 대물렌즈로 돌린다</li>
  <li data-why="…">프레파라트를 재물대에 고정한다</li>
</ol>
```

정답 순서로 쓴다. 엔진이 섞어 내놓고, 학생이 차례로 눌러 쌓으면 자리마다 채점한다. 맞은 칸 아래에 `data-why`가 붙어 길어지므로 항목은 5개 안팎, 이유는 한 줄로. 모두 맞으면 뒤 `.step`을 연다.

### 8. 계산 상자 `.calc` — 입력하면 화면이 계산해서 바뀐다

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

### 9. 그래프 `figure.plot`

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

#### 9-1. 끌 수 있는 점 `data-drag`

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

### 10. 그림 자리 `img[data-ppt]`

```html
<img data-ppt="12-2" alt="빈 회의 풍자화" width="480">
```

- 코드를 실행할 수 없어 그림을 못 넣을 때만 쓴다. `12-2`는 원본 PPT 12쪽의 2번째 그림(슬라이드 XML의 그림 순서, `extract_pptx.py`의 번호와 같다).
- 선생님이 원본 PPTX를 화면에 끌어다 놓으면 채워지고, ⚙ 「그림 넣어 저장」으로 파일에 넣는다.

### 11. 교실 도구

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

### 12. 맞춤 스크립트(익스플로라그램)

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

### 13. 입자 상자 `figure.particles`

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

### 14. 라벨 붙이기 `figure.labeling`

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

### 15. 영상 카드와 링크 카드 `.video`, `a.link-card`

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

### 점검 코드(D 키, `?audit`, ⚙ 설정의 「자동 점검」)

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
| `empty-image`, `no-alt`, `dup-id` | 빈 그림 자리, 그림 설명 없음, 중복 id | |

- 오류가 있으면 선생님이 파일을 처음 열 때 툴바에 「점검 N」 단추가 뜬다. 점검 창의 「AI에게 보낼 말 복사」는 목록을 수정 요청 글로 복사한다. 변환 과정을 설명하는 덱처럼 알림이 필요 없으면 `<html data-audit="off">`로 끈다.
- 넘친 장은 엔진이 줄여서 다 보이게 한다(0.75배까지). 점검은 줄이기 전 크기로 잰다. `<html data-fit="off">`로 끈다.

---

## 5. 한국어 문장

PPT의 사실·정의·정답·자료 출처는 바꾸지 않는다. 문장은 뜻을 지키며 다시 쓴다(윤문).

**우선순위**: PPT 원문(정의·정답·사료·시험 문제·교과서 인용)은 아래 말투 규칙보다 앞선다. 원문에 '~를 통해'가 있어도 정의 문장이면 그대로 둔다. 말투 규칙은 AI가 새로 쓰거나 고쳐 쓰는 문장에 적용한다.

### 규칙

1. 한 문장에는 생각 하나. 화살표(→)로 길게 잇지 말고 문장이나 단계로 나눈다. PPT가 화살표 사슬로 인과를 보이면, 칸을 나눈 사슬 도식(칸마다 한 문장)이나 익스플로라그램(Exploragram)으로 바꾼다.
2. 문장 끝을 맞춘다. 개념 설명은 '-다'로 끝나는 평서문, 발문은 '-까?', 활동 지시는 '-해 보자'.
3. 맞춤법과 띄어쓰기를 지킨다. 의존 명사(것, 수, 때), 수와 단위(10 mL, 1830년), 고유 명사를 확인한다.
4. 줄은 의미 단위로 바꾼다. 제목과 핵심 문장은 의미가 끊기는 곳에 `<br>`을 직접 넣는다.
   - 조사나 어미가 줄 맨 앞에 오지 않게 한다.
   - 숫자와 단위, 괄호 안 내용, 고유 명사는 한 줄에 둔다.
   - 엔진이 어절 단위로 줄을 바꾸므로(`word-break: keep-all`) 낱말 중간에서는 끊기지 않는다.
5. AI가 새로 만든 설명·문항·예시는 그 요소에 `data-ai="무엇"`을 붙인다(화면에는 안 보이고 점검 D에서 보인다).
6. 학생이 읽을 말만 쓴다. '원본 PPT에서는 ~라고 설명한다', '~로 제시됨'처럼 자료를 건네는 말투를 쓰지 않고 사실을 바로 말한다. 만든 과정과 확인 부탁은 전달 메모에 쓴다.

### 쓰지 않는 말투

'함께 알아볼까요?', '~해 봅시다!', '정말 중요해요', '핵심은 ~입니다', '~라고 할 수 있습니다', '~하는 것이 중요합니다', '다양한', '효과적으로', '~를 통해', '~에 대해', '되어지다', 느낌표 남발, 이모지, '여러분'으로 시작하는 문장.

### 고쳐 쓰기의 예

| 원문(PPT) | 고친 글 |
|---|---|
| 산업 혁명 → 도시 인구 증가 → 노동 문제 발생(장시간 노동, 낮은 임금) | 산업 혁명으로 도시 인구가 크게 늘었다.<br>그러자 노동 문제가 생겼다.<br>(장시간 노동, 낮은 임금) |
| 세포막을 통한 물질 이동의 다양한 방식에 대해 알아봅시다! | 물질은 세포막을 어떻게 지나갈까? |
| 농도가 높은 곳에서 낮은 곳으로 물질이 이동하는 현상을 확산이라고 할 수 있습니다. | 물질이 농도가 높은 곳에서 낮은 곳으로 퍼져 나가는 현상을 확산이라고 한다. |
| 차티스트 운동을 통해 노동자들은 참정권 확대를 요구했음 | 노동자들은 차티스트 운동을 벌여 참정권을 넓히라고 요구했다. |

쓰지 말 글: "프랑스 혁명은 유럽에 큰 영향을 미쳤다고 할 수 있습니다. 이를 통해 다양한 변화가 나타났어요!"

### 피드백 문장(문제·카드의 data-why, data-hint)

- 맞을 때: "맞다. ○○이다. (이유 한 문장)"
- 틀릴 때: 왜 아닌지 사실로 말한다. "○○은 1830년 프랑스에서 일어났다." 학생을 탓하지 않는다.
- 실마리(data-hint): 답을 말하지 않고 생각할 거리를 준다. "움직이는 것은 물일까, 냄새 분자일까?" 엔진이 앞에 "다시 생각해 보자."를 붙이므로 그 말로 시작하지 않는다.
- 분류 카드를 모두 맞히면 엔진이 "모두 맞혔다!"를 붙인다. 마지막 카드의 이유는 그 뒤에 이어 읽혀도 자연스럽게 쓴다.
