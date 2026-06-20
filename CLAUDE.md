# CLAUDE.md — kdt-sme-review

## 오리엔테이션 (세션 시작 시 먼저 읽기)
- **이 저장소** = SME 검수앱. 전문가(SME) 7인이 생성된 QA 2,100건을 검토·수정·합의(IAA)하는
  다중사용자 HITL 웹앱. **검수자들이 서버에서 쓰는 독립 서비스로 런칭 예정.**
  현재 코드 없음(설계만). 상세는 `README.md`.
- **K-Defense Bench 사업의 3개 저장소 중 하나** (이 repo는 ② 검수 담당):
  | 저장소 | 담당 | 관계 |
  |---|---|---|
  | `defense-dataset-platform` | OCR 데이터생산 + 연구·문서 허브 | 설계문서 위치 (별도 repo) |
  | `kdt-rag-pipeline` | RAG/QA 생성 | **입력 원천** (검수 대상 데이터, 별도 repo) |
  | **이 저장소** `kdt-sme-review` | SME 검수 웹서비스 | 여기 |
- **범위 경계**: 여기엔 검수앱 코드만. OCR·RAG 생성 코드는 **없다**(각 별도 repo).
  데이터 흐름 = OCR(platform) → QA 생성(rag) → **검수(여기)** → 반출.
- **입력**: RAG 산출물 `kdefense_bench.jsonl` (생성: `kdt-rag-pipeline`).
- **설계 참고**: `defense-dataset-platform` 의 `_docs/tasks/검수앱-설계/`,
  `_docs/research/검수 앱 상세 설계_윤지수.md` (OneDrive).

## git / 계정
- 소유 계정 = **captain-jpexstudio**. Mac 로컬은 SSH 별칭으로 라우팅
  (`git@github.com-jpexstudio:...`). 새 머신 세팅: defense-dataset-platform의
  `_shared/playbooks/git-multi-account-mac-20260620.md` 참조.

## 착수 메모
- 스택·범위 미확정 — `defense-dataset-platform/_docs/overview.md` 현황표 기준으로 확정 후 시작.

> 이 문서는 세션 오리엔테이션용. 착수하면 스택·구조를 여기 채워나간다.
