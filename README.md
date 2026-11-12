# SQLD NOTE v3.4

기존 v3.3에서 **자체 제작 50문항을 추가해 총 226문항**으로 확장했습니다.

- 새 문제: 실제 SQLite 실행 비교 40문항, 데이터 모델링 개념형 10문항.
- 기존 176문항의 ID와 개념·정오답 기록 유지.
- 총 SQL 실행형 125문항의 실제 실행 결과와 저장 정답 검증.
- 난이도는 예상 등급(실측이 아님); 새 문제에서는 중·상 난이도 중심.
- 문제은행에 난이도 필터 추가 (전체, 상, 중, 하).
- 빈출도는 복원 회차별 근거가 없어 **미집계**로 표시.
- SQLD양파는 별도 외부 학습 리소스로 연결하며 콘텐츠를 크롤링·복제하지 않음(재사용 허가 미확인).
- Google 로그인·기존 Supabase 문제 기록 테이블·문제 ID는 변경하지 않음.

## 파일

- `index.html`: 기존 핵심 15개 및 확인 문제 30개, Google Auth
- `assets/v3.js`, `assets/v3.css`: 문제은행, 저장/동기화/시각화 UI
- `questions/bank.json`, `questions/manifest.json`: 176문항 및 검증 메타데이터
- `content/deepdives.json`, `content/visuals.json`, `content/execution_traces.json`, `content/supplements.json`: 학습 콘텐츠
- `QA_v33.md`: 재현 가능한 검증 결과와 남은 작업

## 데이터 연동

새 DB를 만들지 않고 DEVLOG Supabase 기존 `sqld_note_snapshots`, `sqld_question_states`, `sqld_record_answer`를 사용한다. 본 버전에서는 기존 DB 스키마, 정복 상태, 문항 고유 ID, 로컬 저장 키를 변경하지 않았다. 사용자별 RLS는 그대로 유지한다.

Google 로그인 후 **실제 계정의 다른 기기 간 동기화**는 아직 종단 간 검증하지 못했다. 계정 로그인을 정상적으로 마쳤는지와 클라우드에 저장되었는지를 사용자 기기에서 확인해야 한다. 모의 브라우저 클라우드 읽기 실패→재시도/정복 우선 동작은 통과했다.

## 문제 출처·검수 한계

공개된 복원 기출 원문을 복제하지 않고 직접 작성한 학습 문제다. Oracle 고유 함수(`REGEXP_*`, `PIVOT`, 날짜 함수 등)의 설명과 예상 결과는 Oracle 공식 문서를 참고해 편집 검토했으나 실제 Oracle DB로 일괄 실행 검증하지 못했다. 기존 129개 규칙 기반 보기별 설명은 추가 수작업 개별 검수가 필요한 초안이다.
