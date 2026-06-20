# kdt-sme-review — SME 검수앱

전문가(SME) 7인이 생성된 QA 2,100건을 검토·수정·합의(IAA)하는 다중사용자 HITL 웹앱.
**K-Defense Bench 사업의 ★심장** — 검수자들이 서버에서 쓰는 독립 서비스로 런칭 예정.
현재 코드 없음(설계만 존재).

## 위치
- **입력**: RAG 파이프라인 산출물 `kdefense_bench.jsonl`
  (생성: 별도 저장소 `captain-jpexstudio/kdt-rag-pipeline`)
- **출력**: 검수 완료 QA → 반출(③)
- **설계 참고**: `defense-dataset-platform` 저장소 `_docs/tasks/검수앱-설계/`,
  `_docs/research/검수 앱 상세 설계_윤지수.md` (OneDrive)

## 관련 저장소
- `defense-dataset-platform` — OCR 데이터 생산 + 연구·문서 허브 (입력 데이터 원천)
- `kdt-rag-pipeline` — RAG/QA 생성 (검수 대상 데이터 생성)

착수 시 스택·범위는 `defense-dataset-platform/_docs/overview.md` 현황표 기준으로 확정한다.
