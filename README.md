# SQLD NOTE v3.6 — 고난도 예제 · 300문항 · 50문항 모의고사

운영: https://sqld-note-lite.vercel.app/  
저장소: https://github.com/0JDaEun/sqld-note-lite

## 학습 기능

1. **핵심 개념 15개**: 핵심 → 입력·SQL·결과 예제 → 함정 → 확인 문제 2개 → 개념별 실전 문제. 예제 단계에 신규 **조건 변화 비교표 15개** 추가 (`content/advanced_cases.json`).
2. **전체 개념 30개 한 페이지**: 개편 이후 SQLD 학습 범위를 30개 학습 항목으로 재구성. 미니 데이터 표·검색·관련 문제 연결 유지.
3. **보충 단원 13개**: 모델링 트랜잭션, NULL 속성, 본질/인조식별자, 표준 JOIN 등.
4. **문제은행 300문항**: 기존 247문항의 **문항 ID·콘텐츠 객체 불변**. 신규 독립 제작 53문항(모델링 시나리오형 16, SQLite에서 직접 실행·대조한 SQL형 37). 전체 과목 분포 **1과목 60 / 2과목 240**. 검증 분류는 SQLite 162 / 개념 검토 71 / 편집 검토 67. 난이도는 편집 추정 **하 27, 중 154, 상 119**.
5. **실전 모의고사**: `#mock`에서 50문항·90분, 1과목 10문항·2과목 40문항, 각 문제 2점. 합격 판정은 총점 60점 이상 + 1과목 최소 4문항 + 2과목 최소 16문항 정답. 문제 이동, 답변 변경, 다시 볼 문제 표시, 페이지 재방문 복구, 시간 만료 자동 제출, 채점·취약 유형·해설 열람.

## 모의고사 상태와 이용 시 주의점

- 모의고사는 기존 문제은행에서 독립적으로 표본을 추출합니다. **실제 SQLD 복원 원문으로 구성된 미공개 실전 문제는 아닙니다.** 한 번 정복한 문항도 모의고사에는 포함될 수 있어 실제 처음 보는 문제에 대한 시험 점수 예측으로 해석할 수 없습니다.
- 모의고사 진행·최근 결과는 `sqld_mock_exam_v1`, `sqld_mock_history_v1`에 **현재 기기 로컬 저장**합니다. Google/Supabase에는 동기화하지 않습니다. 브라우저 사이트 데이터가 삭제되거나 다른 기기를 쓰면 모의고사 기록은 복구되지 않습니다.
- 모의고사 풀이 결과는 **기본 문제은행의 정복·오답·모름 상태를 절대 수정하지 않습니다.** 기본 학습 데이터는 기존 `sqld_v3_guest_v1`과 Supabase 테이블을 유지합니다.
- 실제 시험은 SQLD 시험 안내에 따라 50문항·90분·10:40 및 60점/과목 40% 기준을 구현했습니다(공식 링크: https://www.dataq.or.kr/). 최신 변경은 시험 기관 공지를 우선합니다.
- 문항 난이도는 **실제 정답률에 기반하지 않은 추정 등급**이고, 빈출도는 근거가 없어 **미집계**입니다. Oracle 고유 문법을 SQLite 검증 결과와 혼동하지 마세요.

## 파일 구조

- `index.html`: 학습 사이트, 새 모의고사 메뉴 및 홈 진입
- `assets/v3.js` + `assets/v3.css`: 기존 학습·문제은행·시각화·동기화 및 P1 고난도 비교표
- `assets/mock.js`: **독립 모의고사 상태머신, 시험 시간, 응답, 채점** (DB 변경 없음)
- `content/advanced_cases.json`: 15개 개념 × 조건 변화 비교표
- `content/quick_reference.json`, `content/syllabus.json`: 전체 개념 30개
- `content/supplements.json`: 보충 단원 13개
- `questions/bank.json`: 총 300문항
- `questions/manifest.json`: 과목·난이도·검증 메타데이터
- `questions/baseline_v34.json`, `questions/baseline_v35.json`: 이전 문항 원본 보존 확인
- `scripts/validate_v36.py`: 기준선 및 신규 SQL 실행 결과 검증
- `scripts/make_test_fixture_v36.py`, `scripts/test_v36.py`: 다중 화면 폭 브라우저 검증 (Playwright, Chromium 필요)
- `QA_v36.md`: QA 요약, 제한 사항 및 후속 개선

## QA

```bash
python scripts/validate_v36.py
python scripts/make_test_fixture_v36.py
python scripts/test_v36.py
```

※ `validate_v36.py`는 외부 경로 없이 저장소 안의 `baseline_v35.json`을 사용하도록 설계돼 있습니다. 37개 신규 SQL 결과를 SQLite로 다시 계산하고, 기존 247문항의 불변성을 비교합니다.

## 남은 개선 사항

- 실제 Google OAuth 로그인 후 PC/모바일 간 SQLD 문제은행 클라우드 동기화 종단간 검증은 완료되지 않았습니다.
- Oracle 고유 문법은 Oracle 실행 엔진으로 일괄 검증하지 못했습니다.
- 기존 일부 보기별 해설은 규칙 기반 초안으로 개별 전문가 감수가 필요합니다.
- 모의고사는 자체 제작 문제은행 재활용이며 회차별 미공개 기출과 독립된 점수 예측 도구가 아닙니다.
- 빈출 출처·복원 회차별 자료를 확인하기 전까지 빈출률 또는 S등급을 부여하지 않습니다.
- 모의고사 Google 계정 동기화, 시험 유형의 독립 신규 세트, 풀이 데이터 기반 실측 난이도는 후속 과제입니다.
