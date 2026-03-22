# kaku-remote

Kaku 터미널 세션을 웹 브라우저에서 공유 접속할 수 있게 해주는 도구.

## 구조

```
Kaku (터미널) → tmux (세션 관리) → ttyd (웹 터미널) → 브라우저
```

- **Kaku 탭** = tmux 윈도우. 각 탭은 독립적인 셸
- **웹 대시보드** (`http://localhost:7777`) 에서 열린 세션 목록 확인 + 클릭으로 접속
- 웹과 Kaku가 같은 세션을 공유 (양방향 입출력)
- Kaku 종료 시 웹 클라이언트가 없는 세션은 자동 정리

## 요구사항

- [Kaku](https://github.com/niceda/kaku) 터미널
- [tmux](https://github.com/tmux/tmux) — `brew install tmux`
- [ttyd](https://github.com/tsl0922/ttyd) — `brew install ttyd`
- [Tailscale](https://tailscale.com) — 원격 접속 시 (선택)

## 설치

```bash
make setup    # 요구사항 확인
make install  # 서버 배포 + launchd 등록 + Kaku 설정
```

## 사용법

설치 후 Kaku를 재시작하면 자동으로 tmux 세션 안에서 열린다.

웹 대시보드: `http://localhost:7777`

Tailscale 연결 시 다른 기기에서도 `http://<tailscale-ip>:7777`로 접속 가능.

### 명령어

| 명령어 | 설명 |
|---|---|
| `make serve` | 서버 시작 |
| `make stop` | 서버 중지 |
| `make sync` | 코드 변경 후 반영 + 재시작 |
| `make status` | 상태 확인 |
| `make install` | 전체 설치 |
| `make uninstall` | 전체 제거 |

## 참고

- 서버는 macOS 샌드박스 제한으로 `~/.local/share/kaku-remote/`에 복사되어 실행
- launchd가 로그인 시 자동 시작, 크래시 시 재시작
- 서버 로그: `/tmp/kaku-remote.log`
