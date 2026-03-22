# remotty

터미널 세션을 웹 브라우저에서 공유 접속할 수 있게 해주는 도구.

Python 표준 라이브러리만 사용하는 단일 파일 서버. 외부 의존성 없음. 프레임워크 없음.

## 구조

```
Terminal → tmux (세션 관리) → ttyd (웹 터미널) → 브라우저
```

- 모든 터미널 앱에서 사용 가능
- **웹 대시보드** (`http://localhost:7777`)에서 열린 세션 목록 확인 + 클릭으로 접속
- 웹과 터미널이 같은 세션을 공유 (양방향 입출력)
- 웹에서 새 세션 생성 가능 (+ 버튼)
- 터미널 종료 시 웹 클라이언트가 없는 세션은 자동 정리

## 요구사항

- [tmux](https://github.com/tmux/tmux) — `brew install tmux`
- [ttyd](https://github.com/tsl0922/ttyd) — `brew install ttyd`
- [Tailscale](https://tailscale.com) — 원격 접속 시 (선택)

## 설치

```bash
make setup    # 요구사항 확인
make install  # 서버 배포 + launchd 등록 + 터미널 설정
```

## 터미널 설정

### Kaku

`make install` 시 자동 설정. Kaku를 열면 바로 remotty 세션에 들어간다.

### 다른 터미널 (iTerm2, Terminal.app, Alacritty 등)

tmux 세션 `remotty`에 접속하면 웹 대시보드에 표시된다.

```bash
tmux new-session -A -s remotty
```

셸 설정(`~/.zshrc` 등)에 추가하면 터미널 실행 시 자동 접속:

```bash
# remotty: auto-attach tmux session
if [ -z "$TMUX" ]; then
  tmux new-session -A -s remotty
fi
```

## 웹 대시보드

### 로컬 접속

```
http://localhost:7777
```

### Tailscale을 통한 원격 접속

같은 Tailscale 네트워크의 어떤 기기에서든 접속할 수 있다.

```bash
# Tailscale SSH 활성화
tailscale set --ssh

# Tailscale IP 확인
tailscale ip -4
```

이후 `http://<tailscale-ip>:7777`로 접속.

서버 시작 시 Tailscale IP가 감지되면 콘솔에 접속 주소가 출력된다.

```
remotty running on http://0.0.0.0:7777
Mobile access: http://100.x.x.x:7777
```

### 명령어

| 명령어 | 설명 |
|---|---|
| `make serve` | 서버 시작 |
| `make stop` | 서버 중지 |
| `make sync` | 코드 변경 후 반영 + 재시작 |
| `make status` | Tailscale, tmux 상태 확인 |
| `make install` | 전체 설치 |
| `make uninstall` | 전체 제거 |

## 참고

- 서버는 macOS 샌드박스 제한으로 `~/.local/share/remotty/`에 복사되어 실행
- launchd가 로그인 시 자동 시작, 크래시 시 재시작
- 서버 로그: `/tmp/remotty.log`
