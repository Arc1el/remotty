<p align="center">
  <img src="web/remotty.svg" alt="Remotty" width="120" height="120">
  <h1 align="center">Remotty</h1>
  <p align="center">
    <strong>어디서든 내 터미널. 폰에서도.</strong>
  </p>
  <p align="center">
    Python 파일 하나. 의존성 제로. 빌드 불필요.
  </p>
</p>

---

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.ko.md"><strong>한국어</strong></a>
</p>

> **Remotty** = remote + tty

Claude Code를 밤새 돌려놓았나요? 긴 빌드를 실행 중인가요? Codex에게 리팩토링을 맡겨뒀나요?

폰으로 확인하세요. 출력을 스크롤하세요. **음성으로 명령하세요.** 브라우저만 있으면 됩니다 — SSH 앱도, 추가 설정도 필요 없습니다.

**맥북을 가방에 넣고, 핫스팟을 연결하고, 버스에서 계속 작업하세요.** STT 버튼을 탭하고 "git status"라고 말하면 터미널에 입력됩니다. 맥북은 닫아둬도 됩니다.

<p align="center">
  <img src="web/wide.png" alt="와이드 (폴더블 / 가로모드)" height="400">
  &nbsp;&nbsp;
  <img src="web/narrow.png" alt="내로우 (폰)" height="400">
</p>
<p align="center">
  <em>왼쪽: 폴더블 / 가로모드 사이드 패널 — 오른쪽: 폰 세로모드</em>
</p>

## 왜 remotty인가?

Claude Code, Codex 등 AI 에이전트는 터미널에서 오랜 시간 작업합니다. 맥 앞에 앉아서 기다릴 필요가 없습니다. Remotty가 있으면 자리를 떠나도 어디서든 확인할 수 있습니다.

### "Claude Code Remote는?"

Anthropic에서 [Claude Code Remote](https://docs.anthropic.com/en/docs/claude-code/remote)를 제공합니다. 하지만 실제로 써보면:

- **불안정합니다.** 연결이 자주 끊기고, 세션이 경고 없이 사라질 수 있습니다.
- **내가 원한 게 아닙니다.** 서버 측 업데이트, 버전 변경 등 통제할 수 없는 요인들이 작업 환경을 바꿀 수 있습니다.
- **내 터미널이 아닙니다.** 로컬 환경, dotfiles, tmux 설정 — 그대로 쓰고 싶은데 원격 컨테이너에선 뭔가 항상 다릅니다.

### "Claude Code Channels는?"

[Channels](https://docs.anthropic.com/en/docs/claude-code/channels)는 Telegram, Discord, 웹훅 등을 통해 Claude Code 세션에 메시지를 보낼 수 있게 해줍니다 — 하지만 알림 브릿지이지 터미널이 아닙니다. 터미널 출력을 보거나, 히스토리를 스크롤하거나, dev 서버를 미리보기할 수 없습니다. Remotty는 터치 컨트롤, 음성 입력, 라이브 프리뷰가 있는 풀 터미널을 브라우저에서 제공합니다 — Channels가 설계된 목적과 다릅니다. Channels는 이벤트를 Claude에게 *전달*하고, Remotty는 Claude가 하는 일을 *보고 제어*합니다.

Remotty는 **내 맥의 터미널**을 브라우저에서 엽니다. 클라우드 서비스 의존 없이, 환경 100% 유지, 어디서든 접속 가능합니다.

|  | remotty | 기타 |
|---|---|---|
| 설치 | `make install` | Docker, Node.js, 설정 파일... |
| 서버 | 파일 1개 (`server.py`) | 프레임워크, 패키지, 빌드 |
| 의존성 | Python 표준 라이브러리만 | npm, pip, cargo... |
| Web UI | 파일 3개 (HTML+CSS+JS) | React, webpack, 200MB node_modules |
| 모바일 입력 | 터치 + 음성 (STT) | 키보드만 |
| 원격 미리보기 | Tailscale로 어디서든 dev server 미리보기 가능 | 별도 터널링 필요 |
| 자동 시작 | 내장 (launchd) | 수동 설정 |

## 시작하기

### 설치

```bash
brew install tmux ttyd                      # 최초 1회
git clone https://github.com/Arc1el/remotty.git
cd remotty
make install                                # 완료
```

### 브라우저에서 열기

```
https://localhost:7777
```

`http://`가 아니라 **`https://`**입니다. `make install`이 HTTPS를 활성화합니다.
처음 방문 시 보안 경고가 뜹니다 — "고급" → "계속"을 한 번만 탭하세요.

### Tailscale로 어디서든 접속 (권장)

**[Tailscale](https://tailscale.com/docs/how-to/quickstart) 설정을 강력히 권장합니다.** 맥북에 고정 IP를 부여하여 같은 Wi-Fi, 핫스팟, 카페, 해외 등 어디서든 접속할 수 있습니다. 포트포워딩도, VPN 설정도 필요 없습니다.

```bash
brew install tailscale                  # 설치
sudo brew services start tailscale     # Tailscale 데몬 시작
tailscale login                         # 인증 (브라우저 열림)
tailscale ip -4                         # 고정 IP 확인
# → https://100.x.x.x:7777 tailnet 내 모든 기기에서 접속 가능
```

폰에도 Tailscale을 설치하세요 ([iOS](https://apps.apple.com/app/tailscale/id1470499037) / [Android](https://play.google.com/store/apps/details?id=com.tailscale.ipn)). 같은 계정으로 로그인 후 `https://100.x.x.x:7777`을 북마크하면 — 같은 네트워크든 아니든 항상 접속됩니다.

> **Tailscale 없이도 가능합니다.** 폰과 맥이 같은 네트워크(Wi-Fi 또는 핫스팟)에 있으면 맥의 로컬 IP로 접속하세요. 또는 **핫스팟 트릭** — 맥북을 폰 핫스팟에 연결하고, 덮개를 닫고, 가방에 넣고, 폰에서 `https://localhost:7777`을 여세요.

## 작동 방식

```
Terminal → tmux → ttyd → 리버스 프록시 → Browser
```

1. 터미널이 `remotty`라는 tmux 세션 안에서 실행됩니다
2. 서버가 tmux를 감시하고 활성 윈도우 목록을 제공합니다
3. 웹 대시보드에서 세션을 클릭하면 — 바로 접속. 동일한 세션, 동일한 입출력

윈도우 2에서 Claude Code가 돌고 있다면? 탭하세요. Claude Code가 보는 것과 정확히 같은 화면이 보입니다. 직접 앞에 앉아 있는 것처럼 타이핑할 수 있습니다.

## 기능

### 모바일 우선 컨트롤

Remotty는 책상 위 키보드가 아닌, 손에 든 폰을 위해 만들어졌습니다.

- **터치 컨트롤** — 방향키, Enter, Ctrl+C, Escape, Tab — 엄지로 누르기 좋게 설계
- **음성 입력 (STT)** — STT 버튼을 탭하고 명령을 말하면 터미널에 입력됩니다. 작은 키보드 필요 없음. EN과 한국어 지원
- **풀 보이스 모드** — 핸즈프리 터미널 제어. "다음" / "ok"으로 Enter, "취소" / "cancel"로 Ctrl+C. 활성 시 오렌지 펄스 글로우 표시
- **스크롤 모드** — 스와이프로 tmux copy-mode 터미널 히스토리 스크롤
- **세션 전환** — 상단 탭 바에서 대시보드로 돌아가지 않고 세션 전환
- **폴더블 / 와이드 모바일** — 넓은 화면(Galaxy Fold, iPad, 가로모드)에서 컨트롤이 사이드 패널로 이동. 드래그 가능한 리사이즈 핸들로 터미널 공간 최대화

### 세션 관리

- **세션 공유** — 웹과 터미널이 같은 세션을 공유. 한쪽에서 타이핑하면 다른 쪽에서 보임
- **다중 윈도우** — Claude Code는 윈도우 1에서, 쉘은 윈도우 2에서
- **세션 이름 변경** — 탭 길게 누르기(터미널) 또는 편집 아이콘 탭(대시보드)
- **웹에서 생성** — `+`를 탭하여 새 터미널 윈도우 생성

### Dev 서버 미리보기

- **인라인 미리보기** — 로컬 dev 서버 포트를 추가하면 Remotty 안에서 바로 웹페이지 미리보기
- **경로 탐색** — URL 바에서 원하는 라우트로 이동. SPA 라우터, API 엔드포인트 등 지원
- **리버스 프록시** — 미리보기가 Remotty의 HTTPS를 통과하므로 혼합 콘텐츠 문제 없음

### 인프라

- **HTTPS** — 첫 실행 시 자체 서명 인증서 자동 생성. STT 등 최신 브라우저 API에 필요
- **리버스 프록시** — ttyd와 dev 서버 미리보기를 단일 포트로 제공. 혼합 콘텐츠 없음
- **자동 정리** — 유휴 터미널 백엔드 자동 종료
- **자동 시작** — 로그인 시 서버 시작, 크래시 시 재시작 (launchd)
- **다크 / 라이트 테마** — 대시보드 헤더에서 토글. 글래스모피즘 UI with 백드롭 블러

## 음성 입력 (STT)

<p align="center">
  <img src="web/stt-demo.gif" alt="STT 데모 — 음성으로 터미널에 명령 입력" width="300">
  <br>
  <em>명령을 말하세요. 터미널에 입력됩니다.</em>
</p>

터미널 컨트롤에서 STT 버튼을 탭하면 듣기가 시작됩니다. 바가 나타나며:

- 실시간 음성 인식 텍스트
- **언어 전환** — `EN` / `한` 탭으로 영어/한국어 전환
- **전송** (✓) — 텍스트를 터미널에 전송
- **취소** (✕) — 취소 후 닫기

STT는 브라우저 내장 [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)를 사용합니다 — API 키, 외부 서비스, 비용 없음. Chrome, Safari, Edge에서 동작. HTTPS와 마이크 권한 필요.

> **팁:** 데스크톱에서는 자체 서명 인증서 사이트에 대한 마이크 접근을 브라우저 설정에서 수동으로 허용해야 할 수 있습니다.

## 풀 보이스 모드

<p align="center">
  <img src="web/voicecmd-demo.gif" alt="풀 보이스 모드 데모 — 키워드로 터미널 제어" width="480">
  <br>
  <em>"다음"으로 Enter, "취소"로 Ctrl+C — 핸즈프리.</em>
</p>

Claude Code가 "계속할까요?"라고 물으면 — 그냥 **"다음"** 또는 **"ok"**이라고 말하세요. 아무것도 만질 필요 없습니다.

풀 보이스 모드는 마이크를 핸즈프리 컨트롤러로 바꿉니다. 짧은 키워드를 계속 듣고 터미널 키에 매핑하여, 화면을 보지 않고도 AI 에이전트 프롬프트를 승인, 거부, 탐색할 수 있습니다.

컨트롤 패널에서 **Voice** 버튼을 탭하면 모드가 토글됩니다. 활성 시 오렌지 펄스 글로우가 터미널을 감싸고, 중앙 토스트가 인식된 내용을 표시합니다.

### 키워드 → 액션

| 액션 | 키워드 (한국어) | Keywords (English) |
|---|---|---|
| **Enter** ↵ | 다음, 확인, 오케이, 알겠어, 네, 응, 좋아, 진행, 계속 | next, ok, yes, confirm, continue, go, enter |
| **Ctrl+C** ✕ | 취소, 안돼, 중지, 멈춰, 아니, 그만 | cancel, stop, no, abort, quit |

- **짧은 발화 (1-2단어)** → 키워드 매칭 → 커맨드 실행
- **긴 발화 (3단어 이상)** → 텍스트 입력으로 자동 전환, 3초 침묵 후 터미널에 전송
- 인식되지 않은 짧은 단어는 무시 — 토스트에 `—`이 잠깐 표시되어 들었음을 알림
- 언어는 STT와 동일한 EN/한 토글 사용
- 브라우저 음성 인식 세션이 끝나면 마이크 자동 재시작

### 자동 딕테이션

<p align="center">
  <img src="web/voicecmd-dictate-demo.gif" alt="보이스 딕테이션 데모 — 버튼 없이 명령 입력" width="700">
  <br>
  <em>긴 문장을 말하면 3초 침묵 후 자동 전송됩니다.</em>
</p>

트리거 키워드 불필요. 자연스럽게 말하면 됩니다 — 풀 보이스 모드가 길이를 자동 감지합니다. "다음" 같은 짧은 단어는 즉시 커맨드를 실행하고, "git status" 같은 긴 문장은 보이스 바에 카운트다운 타이머와 함께 표시된 후 말이 끝나면 자동 전송됩니다.

> **예시:** Claude Code가 멀티 스텝 리팩토링을 실행하는 동안 커피를 만들고 있습니다. 멈추면 — "다음". 또 멈추면 — "다음". 명령을 타이핑해야 할 때는 그냥 "git status"라고 말하면 — 보이스 바가 나타나고, 3초 침묵을 카운트다운한 후 전송합니다. 다시 듣기 모드로. 폰을 만진 적이 없습니다.

## Dev 서버 미리보기

<p align="center">
  <img src="web/preview-demo.gif" alt="Dev 서버 미리보기 데모 — Remotty 안에서 웹페이지 미리보기" width="600">
  <br>
  <em>터미널에서 localhost 링크를 클릭하면 미리보기 탭으로 열립니다.</em>
</p>

Claude Code나 Codex로 웹 앱을 만들고 있나요? 아무 포트에서 dev 서버를 실행하라고 시키세요 — 앱을 전환하지 않고 Remotty 안에서 바로 결과를 미리봅니다.

세션 바에서 **+Preview**를 탭하고 포트 번호(예: `3000`, `5173`)를 입력하면 내장 브라우저 탭에 페이지가 로드됩니다. Remotty 세션이 Tailscale로 연결되므로 폰, 카페, 어디서든 동작합니다 — 추가 터널링 불필요.

- **미리보기 추가** — `+Preview` 탭, 포트 입력. dev 서버 페이지가 인라인으로 로드
- **경로 탐색** — URL 바에서 원하는 라우트로 이동 (예: `/dashboard`, `/api/health`)
- **새로고침** — 터미널을 떠나지 않고 미리보기 새로고침
- **외부에서 열기** — 미리보기를 새 브라우저 탭에서 열기
- **닫기** — 미리보기 탭의 `x`를 탭하여 제거
- **지속성** — 미리보기 포트가 localStorage에 저장되어 페이지 새로고침에도 유지

미리보기는 Remotty의 HTTPS 서버를 통해 리버스 프록시되므로 혼합 콘텐츠 문제나 추가 포트 노출이 없습니다.

> **예시 워크플로우:** 버스를 타고 있습니다. Claude Code에게 "포트 5173에서 랜딩 페이지 만들어줘"라고 말합니다. Vite가 실행됩니다. `+Preview`를 탭하고 `5173`을 입력하면 — 결과를 바로 봅니다. 전부 폰에서.

## 레퍼런스

### 터미널 설정

#### Kaku

자동. `make install`이 모든 것을 처리합니다.

#### iTerm2

1. **iTerm2 → Settings → Profiles** 열기
2. 프로필 선택 (또는 새로 생성)
3. **General** 탭으로 이동
4. **Command**에서 **Command**를 선택하고 입력:

```
tmux -u new-session -t remotty \; new-window
```

5. iTerm2 재시작

모든 새 탭/윈도우가 `remotty` 세션 안에 **새 tmux 윈도우**를 생성합니다 — Kaku와 동일한 동작.

#### 기타 터미널

`~/.zshrc` (또는 `~/.bashrc`)에 추가:

```bash
# remotty: tmux 세션 자동 연결
if [ -z "$TMUX" ]; then
  tmux new-session -A -s remotty
fi
```

### HTTPS

`make install`이 기본적으로 HTTPS로 서버를 설정합니다 (`--https` 플래그). 자체 서명 인증서가 첫 실행 시 `.certs/`에 자동 생성됩니다.

첫 방문 시 보안 경고가 뜹니다 — "고급" → "계속"을 한 번 탭하면 해당 기기에서 다시 묻지 않습니다.

**경고가 괜찮은 이유:** 인증서는 자체 서명(CA 미검증)이지만 연결은 완전히 암호화됩니다. 서버와 클라이언트 모두 본인 소유이므로 실제 보안 우려가 없습니다 — 로컬/사설 서버의 표준 방식입니다.

**HTTPS가 중요한 이유:** 음성 인식, 마이크 접근 등 최신 브라우저 API는 [보안 컨텍스트](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)를 요구합니다. HTTPS가 이를 제공하며, 자체 서명 인증서에서도 동작합니다.

### 명령어

| 명령어 | 설명 |
|---|---|
| `make install` | 전체 설치 |
| `make uninstall` | 완전 제거 |
| `make serve` | 서버 시작 |
| `make stop` | 서버 중지 |
| `make sync` | 코드 변경 배포 |
| `make status` | Tailscale + tmux 상태 확인 |

### 스택

```
server.py ........ Python 표준 라이브러리 (HTTPS, 리버스 프록시, WebSocket 릴레이)
index.html ....... 세션 대시보드
terminal.html .... 웹 터미널 + 터치/음성 컨트롤
style.css ........ 대시보드 스타일 (글래스모피즘, 다크/라이트)
terminal.css ..... 터미널 스타일
app.js ........... 대시보드 로직 + 테마 토글
terminal.js ...... 터미널 + STT 로직
```

React 없음. Next.js 없음. Docker 없음. node_modules 없음.

Python과 브라우저만.

## 라이선스

MIT
