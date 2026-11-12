# SQLD NOTE v3.0

**기존 DEVLOG Supabase를 사용하는 가벼운 SQLD 학습 웹앱**입니다.

- 배포: https://sqld-note-lite.vercel.app
- GitHub `master` → Vercel 자동 배포
- 기존 개념 학습 15개, 기존 확인 문제 30문항 유지
- 15개 개념에 설명 보강(왜 그런지·판별 순서·함정), 실행 흐름 단계별 보기
- 빠진 범위 보충 개념 8개(실제 입력/결과 테이블 포함)
- **자체 제작·검수 실전 문제은행 131문항**(개념형 71문항, 최종 SQL을 SQLite로 재검증한 SQL 실행형 60문항)
- 새 문제 / 오답 / 모르겠어요 / 정복 상태를 자동으로 분류
- 정복 처리된 문항은 일반 출제에서 제외
- 오답·모름은 복습 모드로 이동
- 로그인 전 브라우저 로컬 저장, 로그인 후 Supabase 사용자별 동기화

## 구동

정적 파일을 HTTP(S)로 제공하면 됩니다. Vercel에는 프로젝트 루트 그대로 업로드합니다. 별도의 빌드, npm 설치 또는 서버리스 함수가 필요하지 않습니다.

## 파일

- `index.html` 기존 개념 학습과 홈·라우팅
- `assets/v3.css` 개선 UI 스타일
- `assets/v3.js` 문제은행, 보충 개념, 상태 저장 로직
- `questions/bank.json` 개별 원본 문제·정답·해설·입력 데이터·실행 결과
- `questions/manifest.json` 문제 데이터 버전과 출처 정책
- `content/deepdives.json` 15개 심화 설명
- `content/supplements.json` 보충 단원 8개

## DB

기존 Supabase 프로젝트 `devlog-hub`의 아래 자원만 사용합니다.

- 기존 `public.sqld_note_snapshots`: 개념 학습 완료·확인 문제
- 신규 `public.sqld_question_states`: 사용자별 문제은행 정답·오답·모름·횟수
- 신규 RPC `public.sqld_record_answer`: 동시 업데이트 시에도 정복 상태가 오답으로 되돌아가지 않도록 원자적으로 기록
- 신규 테이블은 RLS를 적용하고, 로그인 사용자 본인 `user_id`로만 접근할 수 있습니다.

최초 Google 로그인은 Supabase 프로젝트에서 Google Provider 및 Redirect URLs(`https://sqld-note-lite.vercel.app/**`) 설정이 되어 있어야 동작합니다. 실제 OAuth 계정으로의 종단 간 검증은 별도로 필요합니다.

## 사용 시 주의

1. 이 문제은행 131문항은 **복원 기출문제 원문이 아닌 자체 제작 학습문항**입니다. 허가받지 않은 제3자 기출·해설 원문을 복사하지 않았습니다.
2. SQL 실행형 60문항은 입력 데이터와 표시 SQL을 SQLite로 재실행해 정답과 보기를 검증했습니다. 그 외 71문항은 개념형으로 SQL 실행 검증 대상이 아닙니다.
3. DBMS마다 SQL 구문이 다를 수 있습니다. 문항에 표준 SQL / Oracle / SQLite 확인 범위를 표시했습니다.
4. 로그인 없이 푼 문제는 해당 브라우저에 보관됩니다. 로그인하면 명시적인 확인을 받은 후 계정으로 가져옵니다.
5. '정복' 상태는 일반 문제은행에서 재출제되지 않습니다. 문제 문서의 `id`는 영구 유지해야 기존 기록이 보존됩니다.

## 점검

- 360 / 390 / 430 / 1440px UI, 문제 채점·모름·보충단원 이동
- SQL 실행 문제 60개 재실행 및 옵션 비교
- 실제 계정이 아닌 모의 인증으로 DB 저장 RPC 호출 흐름 검증
- 실제 Google OAuth와 여러 기기 동기화는 로그인 환경에서 최종 확인 필요