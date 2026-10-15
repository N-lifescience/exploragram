# Exploragram · 학생이 직접 움직이며 원리를 찾아내는 수업 그림

> **AI에게**: 선생님이 이 저장소 주소와 수업 PPT를 주면 합본 지침 하나를 읽고 그대로 따른다.
> 지침: https://raw.githubusercontent.com/N-lifescience/exploragram/main/guide/exploragram-guide.md
> 만들기 전에 선생님에게 먼저 묻고(인터뷰), 설계표를 확인받은 뒤 HTML 파일 하나를 만든다.

선생님이 자기 AI(ChatGPT·Gemini·Claude)에게 수업 PPT를 주면, 판서와 활동이 들어간 수업용 HTML이 나온다. 판서·칠판·반별 저장·넘기기·인쇄·자동 점검은 이 저장소의 엔진이 맡고, AI는 수업 내용과 활동만 쓴다.


**익스플로라그램(Exploragram)** 은 explore와 diagram을 합친 이름이다. 샌프란시스코 과학관 익스플로라토리움(Exploratorium)이 과학을 만지게 했듯, 칠판 위 수업 그림을 학생이 직접 움직이게 한다.
## 무엇이 다른가

- **펜을 든 채로 넘긴다.** 펜·형광펜 상태에서도 ◀ ▶, 활동 단추, 슬라이더가 그대로 작동한다. PPT처럼 펜 모드와 마우스 모드를 오가지 않는다.
- **판서가 남는다.** 장마다, 반마다 따로 저장되고 브라우저를 닫아도 남는다. 칠판 모드(흰색·모눈·초록 칠판 등)도 있다.
- **PPT로 못 하는 활동.** 값을 바꾸면 계산해서 바뀌는 시뮬레이션과 그래프, 하나씩 열리는 지도·연표, 끌어서 나누는 카드, 보기마다 이유가 나오는 문제.
- **0단계에서 시작.** 단계형 활동은 모두 가린 채 시작하고 한 칸씩 연다. 리모컨 →로도 연다.
- **바로 고친다.** 툴바 「편집」을 누르면 글·상자·그림·SVG 도형을 골라 글 내용, 크기, 색, 위치를 고치고 HTML 파일로 저장한다. AI에게 다시 부탁하지 않아도 된다.

## 선생님: 3단계로 쓰기

1. AI에게 수업 PPT를 올리고 이렇게 쓴다.
   `https://github.com/N-lifescience/exploragram 지침대로 이 PPT를 수업 HTML로 바꿔줘`
   (주소를 못 읽는 AI는 `guide/exploragram-guide.md` 파일을 받아 PPT와 함께 올린다.)
2. AI가 묻는 질문(교과·차시, 수업 장면, 헷갈리는 지점, 넣고 싶은 활동, 지킬 것)에 답하고, 설계표를 확인한다.
3. 받은 `.html` 파일을 더블클릭해서 수업한다. 그림 자리가 비어 있으면 원본 PPT를 화면에 끌어다 놓고, ⚙ 설정의 「그림 넣어 저장」을 누른다.

수업 중 단축키: → ← 넘기기 · P 펜 · H 형광펜 · E 지우개 · L 레이저 · Esc 손 · C 칠판 · T 목차 · F 전체 화면 · B 검정 화면 · ? 도움말 · D 자동 점검.
학교 PC가 재부팅 때 저장소를 지운다면, 반 메뉴의 「판서 백업 파일로 저장」을 쓴다.

## 실시간 수업: 학생이 자기 기기에서 함께 만진다

1. 교사: 툴바 「실시간」을 누르면 방 코드 6자리와 QR이 나온다.
2. 학생: 웨일북·휴대폰에서 QR을 찍거나 사이트(`https://n-lifescience.github.io/exploragram/`)에 코드를 넣는다. 교사 PC에 있는 수업 파일이면 「학생용 파일 저장」으로 받은 파일을 웨일 클래스에 올리고, 학생은 그 파일을 열어 코드를 넣는다.
3. 학생 화면은 교사 장을 따라가고, 교사가 연 범위 안에서는 지난 장으로 돌아가 볼 수 있다(「선생님 화면으로」로 복귀). 익스플로라그램(Exploragram) 슬라이더는 학생이 직접 움직인다.
4. 교사 「학생 보기」: 슬라이더마다 학생 값이 막대로 모인다. 막대를 누르면 그 값이 칠판 익스플로라그램에 들어가고(누가 맞췄는지는 모른다), 「내 값으로」로 되돌린다.

저장 안 함 · 이름 안 받음: 학생 값은 수업 중 교사 화면 메모리에만 있다가 창을 닫으면 사라진다. 전송은 Supabase Realtime(broadcast, DB 안 씀)이고, 주소와 공개 키는 `live.config.json`에 넣고 다시 빌드한다. 비어 있으면 같은 PC 탭끼리만 된다(시험용, 주소 뒤 `?live=local`).

## 저장소 구성

| 경로 | 내용 |
|---|---|
| `engine/` | 엔진(`exploragram.js`·`.css`, 빌드 결과). 소스는 `engine/src`, `engine/css` |
| `skills/exploragram/` | AI 지침(스킬). `SKILL.md`, `references/`(익스플로라그램 `exploragram.md`, 부품 사전, 화면, 한국어, 레퍼런스 완성본 `examples/`), `scripts/`(`extract_pptx.py`, `bundle.py`, `states.mjs`), `assets/template.html` |
| `guide/exploragram-guide.md` | 채팅 AI용 합본 지침(빌드 때 자동 생성) |
| `examples/` | 직접 만든 예시 덱(`m2-parts.html`: 모든 부품), 연수 슬라이드(`training.html`: 21장, 실제 수업 시연·기능 지도·실시간 체험·실습·익스플로라그램 수요 설문. 사이트에서는 `/examples/training.html`, 한 파일판은 `bundle.py examples/training.html --offline --engine engine`), 소개 덱(`intro-story.html`: 23장, exploragram이 만들어진 이야기), 실습용 PPT(`practice/`: 과학 '확산', 사회 '수요와 공급', `tools/make_practice_pptx.py`로 만듦) |
| `tests/`, `tools/` | 엔진 시험, 빌드, 화면 캡처·점검(`tools/shots.mjs`), 사이트 묶기(`tools/site.mjs` → `_site/`) |
| `site/`, `live.config.json` | 배포 사이트 첫 화면(실시간 수업 참여·PPT 전후 비교·예시 수업·만드는 법), 실시간 설정. `.github/workflows/pages.yml`이 main에 올라오면 Pages로 배포한다 |

## 개발

Node.js 22 이상, Chrome 또는 Edge. npm 설치는 필요 없다.

```bash
node tools/build.mjs && node --test tests/unit/*.test.mjs && node tests/run-browser.mjs tests/browser/*.test.html && node tests/run-docs.mjs
```

현황: `docs/m1-status.md`(엔진 코어), `docs/m2-status.md`(공통 부품·테마·그림 채우기).

## 저작권과 개인정보

- 교과서·출판사 그림이 들어간 수업 HTML은 **수업용으로만** 쓰고 인터넷에 공개하지 않는다.
- 이 저장소에는 교과서·출판사 자료와 그 변환본을 넣지 않는다. 예시는 모두 직접 만든 것이다.
- 엔진은 학생 정보를 받거나 보내지 않는다. 판서와 활동 기록은 그 PC의 브라우저 안에만 남는다. 끌어다 놓은 PPT도 브라우저 안에서만 열린다.

저작권: N-lifescience, 모든 권리 보유. 수업에 쓰는 것은 자유롭게 허용하고 코드를 복제·수정해 다시 배포하려면 허락이 필요하다(`LICENSE`). v1.6.1까지는 MIT로 배포했다.
