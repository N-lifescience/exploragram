# 연수 슬라이드 글꼴

`examples/training.html`의 이야기(story) 테마가 쓰는 글꼴이다. 모두 SIL Open Font License 1.1이며 전문은 `OFL.txt`에 있다.

| 파일 | 글꼴 | 저작권 | 쓰는 곳 |
|---|---|---|---|
| `SpaceGrotesk-Variable.woff2` | Space Grotesk (가변) | Florian Karsten, The Space Grotesk Project Authors (2020) | 제목·숫자의 라틴 글자 |
| `WantedSans-Variable.woff2` | Wanted Sans (가변, 한글·라틴) | Wanted Lab, Inc. (2024), The Wanted Sans Project Authors | 본문·한글 제목 |
| `JetBrainsMono-Variable.woff2` | JetBrains Mono (가변) | JetBrains, The JetBrains Mono Project Authors (2020) | 모노 라벨 |

한 파일로 묶을 때(`skills/exploragram/scripts/bundle.py`) CSS의 `url('….woff2')`가 data URI로 들어간다.
