# 필기웹 (pdf-ink) — 작업 규칙

GoodNotes처럼 PDF 위에 필기하는 웹앱. 서버·로그인 없음. 배포: https://pdf-ink.vercel.app
바닐라 JS + Vite. `src/main.js`(DOM 배선) + 순수 모듈 ~30개(각자 `*.test.js`).

## 절차 (반드시)

1. 새 일은 **이슈부터** (`gh issue create`, 한국어).
2. **브랜치 → PR → 스쿼시 머지** (`gh pr merge --squash --delete-branch`). **main 직접 커밋 금지** — 이걸 어겨서 사고가 두 번 났다.
3. 머지 전 `npm test`(node --test)와 `npm run build` 둘 다 통과. 경고 0.
4. 머지 후 `docs/PROCESS.md`에 **왜 그렇게 했는지** 한 단락(한국어, 이슈 번호 붙여).
5. 사용자 확인은 Vercel 배포로 한다 — 이 기계엔 브라우저가 없다.

## 코드 규칙

- 순수 모듈은 DOM을 모른다. DOM·이벤트는 main.js만.
- 계약 테스트 문화: 배선·디자인 수치는 정규식 핀으로 못박는다. 동작을 바꾸면 **핀을 새 사실로 갱신**하고 이유를 주석에.
- `markup.test.js`(HTML 태그 짝), `imports.test.js`(모듈 간 + main.js 지역 이름꼴 가드)가 있다. 새 함수·상수를 쓰기 전에 실제 이름을 확인할 것.
- 주석·커밋·문서는 한국어, 존재 이유(왜)를 적는다.

## 함정 (실제로 밟았던 것)

- `git add -A` 전에 폴더의 PDF 확인 — 상용 PDF가 커밋된 적 있다 (`.gitignore`에 `*.pdf`).
- 파이썬으로 main.js를 고칠 때 `import \{[\s\S]*?\}` 식 정규식은 **앞 블록까지 삼킨다**. 마지막 `import {`를 rindex로 잡을 것.
- `history.undo`(past 아님), `pageStrokes(page)`, `inkKey(leaf)` — 짐작 말고 grep.
- 셸 heredoc에 백틱·괄호 든 한국어 본문을 넣으면 먹힌다. PR 본문은 파일로.

## 자주 쓰는 것

- 전체 테스트: `npm test 2>&1|grep -E "^# (pass|fail)|^not ok"`
- PDF 링크 검사: `node scripts/inspect-links.mjs 문서.pdf`
- 서드파티 표시 재생성: `npm run notices`

## 분업 (마스터 승인, 2026-09-05)

「~~해줘」를 받으면 오케스트레이터가 다 하지 말고 나눈다:

- **직접 한다**: 원인 모르는 버그 진단, 설계 결정, 명세 작성, 최종 검토, 한 줄짜리 수정(위임이 더 느리다).
- **implementer(소넷)에게 위임**: 명세가 정해진 구현. 이슈 번호·완료 기준·손댈 파일을 명세로 넘긴다.
- **검토는 실물로**: 서브에이전트의 보고를 믿지 말고 `git diff`를 직접 읽고 `npm test`를 다시 돌린 뒤에 커밋한다. 커밋·PR·머지는 오케스트레이터만 한다.
