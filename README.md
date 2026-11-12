# SQLD NOTE v3.1

SQLD 개념을 단계적으로 배우고 해당 유형 문제를 계속 푸는 가벼운 정적 웹앱. 별도 npm 설치나 신규 DB 프로젝트가 필요 없다.

## 웹사이트

https://sqld-note-lite.vercel.app/

## 학습 구조

1. 핵심 — 원리, 단계형 판별 팁, 개념별 시각 도식
2. 예제 — 실제 입력 테이블 → SQL → 실행 순서 → 결과 테이블
3. 함정 — 비슷한 SQL 조건과 자주 나오는 오해 비교
4. 문제 — 개념별 확인 문제 2개 (총 30개)
5. 실전 — **해당 개념 관련 문제은행 바로 풀기**와 학습 상태, 미리보기

15개 핵심 단원, 8개 보충 단원. 문제은행은 자체 제작 146문항(개념형 71, SQLite 실행 결과로 검증한 SQL형 75). 18개 개념형 문항은 A~D 보기별 해설도 제공한다. 문제은행 원문은 제3자 복원 기출이 아니다.

## 파일

- `index.html`: 기존 개념 15개, 기존 확인 문제 30문항, 라우팅 및 Supabase Auth 모듈
- `assets/v3.css`: 통합 반응형 UI
- `assets/v3.js`: 문제은행 로직, 실전 단계, 연관 문제, 보충 단원, 시각화 로더
- `content/deepdives.json`: 15개 원리 심화 설명
- `content/visuals.json`: 15개 개념별 시각 모델
- `content/supplements.json`: 8개 보충 단원
- `questions/bank.json`: 146개 자체 제작 문제, 정답, 풀이, 입력 및 실제 실행 결과
- `questions/manifest.json`: 버전·문항 구성 메타데이터
- `QA_AND_NEXT_PLAN.md`: 검수 결과와 남은 개선 과제

## DEVLOG Supabase 데이터

프로젝트 `devlog-hub`를 재사용하고 기존 SQLD용 데이터 자원을 유지한다.

- `public.sqld_note_snapshots`: 기존 15개 개념·30개 확인 문제 기록
- `public.sqld_question_states`: 실전 문제 정답/오답/모름/정복 기록
- `public.sqld_record_answer`: 정복 상태가 오답으로 퇴행하지 않도록 원자적으로 저장

Google OAuth 복귀 허용 URL: `https://sqld-note-lite.vercel.app/**`. Provider 활성화 및 실계정 로그인 결과는 실제 환경에서 확인해야 한다. 브라우저 오프라인 저장은 로그인 없이 동작한다.

## 테스트

개념·보충 단원 렌더링, 5단계 이동, 문제은행 유형 필터, 정답·오답·모름, 360~1440px 레이아웃 및 SQLite 결과 비교를 수행했다. 75개 SQL 문제는 저장된 실행 결과표 및 정답과 비교해 불일치 0건이다. 실제 Google 로그인의 PC/모바일 간 종단 간 검증은 남아 있다.
