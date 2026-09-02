# 구조 (UML)

바닐라 JS + Vite. 프레임워크가 없고, **순수 모듈 + 얇은 배선** 두 층입니다.
`src/main.js`가 DOM·이벤트·클라우드 호출을 붙이고, 나머지 모듈은 DOM을 모른 채 계산만 해서 `node --test`로 못 박습니다.

## 1. 컴포넌트

```mermaid
graph TD
  subgraph 배선["배선 (DOM을 안다)"]
    main["main.js<br/>이벤트 · 캔버스 · 상태"]
  end

  subgraph 그리기
    ink["ink.js<br/>획 · 경로 · 지우개"]
    tools["tools.js<br/>도구 · 색 · 굵기"]
    shape["shapeHold.js · stampGhost.js"]
    select["select.js · marqueeHold.js"]
    media["image.js · stickers.js · mosaic.js · capture.js"]
  end

  subgraph 문서
    preview["preview.js<br/>잎(leaf) 모델 · 썸"]
    pageOps["pageOps.js<br/>복사 · 삭제 · 회전 · 순서"]
    outline["outline.js · pdfOutline.js<br/>목차 · 책갈피"]
    window["pageWindow.js<br/>보이는 쪽만 렌더"]
    viewport["viewport.js<br/>배율 · 이동"]
    areaLink["areaLink.js · split.js"]
  end

  subgraph 저장
    storage["storage.js<br/>localStorage"]
    prefs["prefs.js<br/>설정"]
    recent["recent.js · fileHandle.js"]
    inkFile["inkFile.js<br/>사이드카 형식"]
    thumbPack["thumbPack.js<br/>썸 묶음"]
    history["history.js<br/>되돌리기"]
  end

  subgraph 바깥
    pdfjs["pdf.js<br/>렌더 · 목차 읽기"]
    pdflib["pdf-lib<br/>주석 굽기 · 목차 쓰기"]
    dbx["dropbox.js<br/>PKCE · 파일"]
    gd["gdrive.js<br/>GIS · Picker · 파일"]
    idb["IndexedDB<br/>files · thumbs · stickers"]
  end

  main --> 그리기 & 문서 & 저장
  main --> pdfjs & pdflib & dbx & gd & idb
  toolbar["toolbar.js · interact.js<br/>바 배치 · 홀드 · 펜 버튼"] --> main
  validate["validate.js"] --> main
```

규칙: **모듈끼리는 얕게만 부르고**(`pageOps → preview`처럼), 순환은 만들지 않습니다. `src/imports.test.js`가 「안 들여온 함수 호출」과 「없는 이름 들여오기」를 빌드 전에 잡습니다.

## 2. 문서 모델

```mermaid
classDiagram
  class Doc {
    identity: string
    leaves: Leaf[]
    pages: Map~inkKey, Item[]~
    outline: OutlineEntry[]
  }
  class Leaf {
    id: string
    kind: "pdf" | "outline"
    pdfPage: number
    rotate: 0|90|180|270
    bookmark: boolean
    inkId?: string
  }
  class Item {
    kind: "stroke"|"image"|"stamp"|"mosaic"
    color · width · alpha
    points: number[]
  }
  class Sidecar {
    v: 1
    savedAt: number
    ink · leaves · outline
    shareThumbs: boolean
  }
  Doc "1" *-- "n" Leaf
  Doc "1" *-- "n" Item : inkKey(leaf)
  Doc ..> Sidecar : 직렬화

  note for Leaf "필기 키는 inkId ?? pdfPage.\n복제한 쪽은 자기 inkId를 받아\n원본과 획을 공유하지 않는다."
```

## 3. 열기 — 클라우드 문서

```mermaid
sequenceDiagram
  actor 사용자
  participant App as main.js
  participant Cloud as 드롭박스 / 드라이브
  participant Local as localStorage · IndexedDB

  사용자->>App: 클라우드에서 열기
  App->>Cloud: 로그인(PKCE) 또는 토큰(GIS)
  App->>Cloud: 파일 고르기 (목록 / Picker)
  Cloud-->>App: PDF 바이트
  App->>App: validate.js (PDF · 20MB)
  App->>App: 보기(잠금)로 시작 (#127)
  par 사이드카
    App->>Cloud: <이름>.pdf.ink 찾기·받기
    Cloud-->>App: 필기 · 잎 · 목차 · savedAt
    App->>Local: pickNewer(로컬, 원격)
    Note over App,Local: 빈 사이드카는<br/>로컬 필기를 못 지운다
  and 썸
    App->>Local: 저장된 썸 키 목록
    opt 10% 넘게 비었고 공유 켬
      App->>Cloud: <이름>.pdf.thumbs 받기
    end
    App->>App: 남은 쪽만 idle에 그리기
  end
  App-->>사용자: 첫 쪽 · 잠금 해제 가능
```

## 4. 저장 — 세 갈래

```mermaid
sequenceDiagram
  participant App as main.js
  participant Cloud

  Note over App: 필기가 바뀔 때마다
  App->>App: persistStrokes → localStorage
  App->>App: scheduleInkAutosave (2.5s 디바운스)
  Note over App: 그리는 중이면 미루고,<br/>탭을 숨기면 즉시 밀어낸다
  alt 드라이브 문서
    App->>Cloud: (없으면) 사이드카 만들기 → PATCH 바이트
  else 드롭박스 문서
    App->>Cloud: upload <경로>.pdf.ink
  else 로컬 파일
    App->>App: 브라우저에만 (자동 저장 대상 아님)
  end

  Note over App: ⋯ PDF에 굽기 (사람이 누를 때만)
  App->>Cloud: 버전 확인 → 주석 박은 PDF 쓰기
  Note over App: 이때만 필기가 굳는다 (#126)
```

## 5. 도구 상태

```mermaid
stateDiagram-v2
  [*] --> 보기 : 문서를 열면 잠금 (#127)
  보기 --> 편집 : 잠금 해제
  편집 --> 보기 : 잠금

  state 편집 {
    [*] --> 펜
    펜 --> 형광 --> 색연필 --> 펜
    펜 --> 지우개 : 도구 / 펜 버튼
    지우개 --> 펜 : 버튼을 떼면
    펜 --> 선택
    선택 --> 펜
    펜 --> 스탬프

    state 펜 {
      [*] --> 그리는중 : pointerdown
      그리는중 --> 도형칩 : 끝에서 400ms 정지
      도형칩 --> [*] : 칩을 고르면 도형
      도형칩 --> [*] : 안 고르면 손 획
      그리는중 --> [*] : pointerup
    }
  }
```

`펜 → 지우개`는 도구를 바꾸지 않고 그 획만 지우개로 만듭니다(펜 배럴 버튼). 지우개 꼭지는 배정과 무관하게 언제나 지우개입니다.

## 6. 왜 이렇게

- **모듈은 DOM을 모른다** — 그래야 `node --test`로 브라우저 없이 계약을 못 박고, 회귀가 PR 전에 잡힙니다.
- **사이드카가 기본, 굽기는 선택** — 획은 좌표라 KB고, PDF를 다시 쓰면 필기가 굳습니다. 자동 저장은 굳히면 안 됩니다.
- **덮어쓰지 않는다** — 드롭박스는 `rev` update, 드라이브는 `version` 확인 후 쓰기, 다른 이름으로 저장은 `add + autorename`.
- **쪽 창(window) 렌더** — 400쪽에서도 보이는 쪽만 캔버스를 답니다.
- **한 획은 한 캔버스** — 그리는 동안은 `liveCanvas`에만 얹어, 쌓인 필기와 무관하게 프레임 비용이 일정합니다.
