# SQLD NOTE Lite — DEVLOG Supabase 연동

## 배포 중인 주소

https://sqld-note-lite.vercel.app

- Vercel: `sqld-note-lite` (정적 HTML 1개, 빌드 불필요)
- Supabase: 기존 `devlog-hub` (`ebbufqscomopzhljksxx`)
- 테이블: `public.sqld_note_snapshots` (RLS 적용, 이미 생성 완료)

## 남은 한 가지 설정: Google OAuth 복귀 URL

Supabase Dashboard → 프로젝트 `devlog-hub` → Authentication → URL Configuration → **Redirect URLs** 에 아래 주소 추가:

`https://sqld-note-lite.vercel.app/**`

같은 계정의 다른 Vercel 별칭 URL을 사용한다면 `https://sqld-note-lite-daeun4.vercel.app/**`도 추가할 수 있습니다. Google Provider 설정은 기존 DEVLOG 프로젝트의 것을 재사용하며, 이미 Scope에서 사용한 Google 로그인과 공통 Auth입니다. 실제 로그인·동기화는 복귀 URL 등록 후 브라우저에서 확인하세요.

## GitHub로 자동 배포하려면

현재 Vercel은 소스 직접 업로드로 배포했습니다. 아직 GitHub 저장소와 자동 연결되어 있지 않습니다.

1. GitHub에 새 저장소 `sqld-note-lite` 생성
2. 이 압축파일의 `index.html`을 저장소 루트에 업로드
3. Vercel의 `sqld-note-lite` 프로젝트 Settings → Git에서 저장소 연결 (또는 새 Git 프로젝트 Import)

현재 코드에는 비밀키가 없고, Supabase의 공개 가능한 publishable key만 포함됩니다. 서비스 역할 키는 포함되지 않았습니다.

## 저장 방식

- 로그인 전: 기기에 로컬 저장
- 로그인 후: 해당 계정 1행에 진행 상황·채점 답안 저장
- 새 기기: 로그인한 계정의 서버 기록 로드
- 새 계정의 서버 기록이 없고 현재 **사이트의 같은 출처**에 로컬 학습기록이 있는 경우에만 가져오기 확인 표시
- 서로 다른 기기에서 동시에 수정하면 나중에 저장된 전체 기록이 적용됩니다.

원래 파일(`file://`)이나 다른 도메인의 localStorage는 브라우저 보안 정책으로 자동 가져오지 못합니다.
