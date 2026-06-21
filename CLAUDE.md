# CLAUDE.md — kdt-sme-review

## 오리엔테이션 (세션 시작 시 먼저 읽기)
- **이 저장소** = SME 검수앱. 전문가(SME) 7인이 생성된 QA 2,100건을 **각 300문항씩** 검수하며
  정답을 변형(Active Edit)해 저작권을 귀속시키는 다중사용자 HITL 웹앱.
  **검수자들이 서버에서 쓰는 독립 서비스로 런칭 예정.**
  > v6 범위: 교차/이중검수·IAA(κ)·자동채점은 **제외**(향후 확장). 단일 검수자/문항.
- **K-Defense Bench 사업의 3개 저장소 중 하나** (이 repo는 ② 검수 담당):
  | 저장소 | 담당 | 관계 |
  |---|---|---|
  | `defense-dataset-platform` | OCR 데이터생산 + 연구·문서 허브 | 설계문서 위치 (별도 repo) |
  | `kdt-rag-pipeline` | RAG/QA 생성 | **입력 원천** (검수 대상 데이터, 별도 repo) |
  | **이 저장소** `kdt-sme-review` | SME 검수 웹서비스 | 여기 |
- **범위 경계**: 여기엔 검수앱 코드만. OCR·RAG 생성 코드는 **없다**(각 별도 repo).
  데이터 흐름 = OCR(platform) → QA 생성(rag) → **검수(여기)** → 반출.
- **입력**: RAG 산출물 `kdefense_bench.jsonl` (생성: `kdt-rag-pipeline`).
- **구현 기준(SSoT)** = `docs/spec-v6.md`. 코드는 이 문서만 따른다. 진행현황 = `docs/progress.md`.
  옛 설계(`defense-dataset-platform/research/검수 앱 상세 설계_윤지수.md` 등)는 참조용, 충돌 시 v6 우선.

## git / 계정
- 소유 계정 = **captain-jpexstudio**. Mac 로컬은 SSH 별칭으로 라우팅
  (`git@github.com-jpexstudio:...`). 새 머신 세팅: defense-dataset-platform의
  `_shared/playbooks/git-multi-account-mac-20260620.md` 참조.

## 스택 (spec §4.2, P0 확정·검증)
- **백엔드**: FastAPI · SQLAlchemy 2(async) · Alembic · asyncpg · Postgres 16
- **프론트**: Next.js 14(App Router, TS) · zustand · react-query · shadcn/ui · react-signature-canvas
- **인프라**: Docker compose(db·api·web·nginx) · 자체호스팅(**Vercel 아님**, 보안격리)
- 핵심 로직: `active_edit`(정답변형 검증, §13.1) · `assignment`(7×300, §13.2) · 듀얼서명(§13.3)

## 구조 (spec §4.3)
```
backend/app/{core,db,api,services,schemas}/  · alembic/  · seed.py
frontend/app/{login,agreement,workspace,admin}/  · lib/activeEdit.ts(서버 검증 미러)  · stores/
docker-compose.yml · nginx/ · .env.example
```

## 로컬 실행
```bash
cp .env.example .env   # PII_FERNET_KEY 채우기(주석 참고)
docker compose up --build
# health: curl localhost/api/v1/health → {"status":"ok"}
```

## 작업 규칙
- **커밋은 잘게** — 논리 단위 1개 = 커밋 1개, 성격(기능/리팩터/설정/문서) 분리. `type(scope): 요약`.
- 혼자 작업 → main 직접 커밋 OK(브랜치 분기 불필요). 단 커밋 입자는 잘게 유지.
- **단계 끝나면** `docs/progress.md` 상태(P0~P6) + 현재위치 한 줄 갱신.
- 코드는 항상 `docs/spec-v6.md` 기준. 추측으로 기능 추가 금지(spec에 있는 것만).
