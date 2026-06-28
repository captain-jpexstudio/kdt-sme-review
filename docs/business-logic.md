# 비즈니스 로직 — kdt-sme-review

> 이 앱이 *무엇을 강제하고 보장하는가*. 코드 실측 기준(파일·함수 명시). 아키텍처는 `architecture.md`, 화면/요구는 `spec-v6.md`.

## 0. 한 줄 목적
생성된 QA 2,100건을 SME 7인이 분담 검수하고, **정답을 반드시 능동 변형**시켜 산출물의 **지식재산권을 주최 측에 귀속**시키며, 동의·저작권 이관을 **듀얼 서명으로 증빙**하고 **전 과정을 불변 로그**로 남긴다.

## 1. 역할(RBAC)
| 역할 | 권한 |
|---|---|
| `reviewer` | 본인 Task 조회/임시저장/제출/재수정, 동의·서명, 최종제출, 본인 진행률 |
| `admin` | 업로드·할당, 전체 모니터링(SSE), 증빙 열람, 잠금 해제, Export, PII 관리·파기, 감사로그 |

## 2. 전체 흐름 (상태 머신)
```
[데이터 인입]  admin: xlsx 업로드 → datasets 생성 + 7×N 할당 → tasks(pending)
[게이트]       reviewer: 로그인 → (미동의면) /agreement 강제 → 동의3종+듀얼서명 → is_agreed
[검수]         task: pending ──autosave──▶ in_progress ──submit(ActiveEdit OK)──▶ completed
                                              ▲                                    │
                                              └──────────── 재수정(autosave) ◀──────┘
[최종제출]     전건 completed → batch-submit(듀얼서명) → is_batch_submitted=true(읽기전용 잠금)
[운영]         admin: unlock(잠금해제) · export(가명 xlsx) · PII purge
```

## 3. 비즈니스 규칙(BR)과 구현

### BR-1. 데이터 인입 = admin xlsx 업로드 (`api/admin.py` `upload_datasets` + `services/assignment.py`)
- **입력 포맷**: xlsx. 필수 컬럼 `question`,`answer`(+선택 `assigned_persona`,`batch_id`). 한글 별칭(`질문/정답/배정페르소나`) 자동 매핑(`load_xlsx`).
- **건수 강제**: `문항수 == reviewer수 × per_reviewer` 정확히 일치, 아니면 거부(`build_assignments` `ValueError` → 400 `INVALID_DATASET`). 기본 `per_reviewer=300` → 7×300=2,100.
- **할당 방식**(`build_assignments`):
  - `assigned_persona`가 전 행에 채워져 있으면 → **페르소나별 검수자 매핑**(정렬 후 1:1).
  - 아니면 → **시드 고정 셔플 라운드로빈**(`random.Random(42)`, 재현 가능).
- **멱등성**: 같은 `batch_id` 재업로드 → 409 `BATCH_EXISTS`.
- `datasets`는 불변(원본 보존), `tasks`는 (검수자×문항) 1행씩.
- ⚠ **데이터 계약(미결 D)**: 상류 RAG의 `kdefense_bench.jsonl`(30필드)을 누가 이 xlsx(2컬럼)로 변환할지, 메타(난이도·근거) 전달 여부는 미확정. 현재는 외부 변환 스크립트로 충당.

### BR-6/11. 동의 게이트 + 듀얼 서명 (`api/auth.py` `agreement`, `services/signature.py`·`pdf.py`)
- **최초 1회 강제**. 미동의 reviewer는 검수 API 전부 403(`NOT_AGREED`, `deps.agreed_reviewer`).
- **필수 동의 3종** 모두 `true`라야 통과: `security_copyright`(보안·저작권) / `privacy`(개인정보) / `tax`(세무). 누락 시 400 `NOT_AGREED`.
- **듀얼 서명** = ① 성명 타이핑(`typed_name`, 공백 거부) + ② 캔버스 드로잉(`signature_png`). 드로잉은 **빈 캔버스 검출**(`is_blank`: 잉크 픽셀 비율 < `SIGN_MIN_INK_RATIO=0.002`면 거부).
- **증빙 생성**: 서약 전문 + 서명이미지 + UTC시각 + IP → PDF 렌더(`pdf.py`), `agreement_records`에 `text_sha256`(서약 전문 해시)·서명 자산·IP·시각 저장. 서명 PNG도 sha256으로 자산화(`signature_assets`).
- 통과 시 `is_agreed=true` + `audit(AGREE_SIGN)`.

### BR-Core. 정답 능동 변형(Active Edit) — **저작권 귀속의 핵심** (`services/active_edit.py`)
제출 시 서버가 권위 검증(`verify_active_edit`):
- **기준선 = 항상 원본 `original_a`** (재수정 후에도 "원본 대비 변형" 보장).
- 토큰화(NFKC 정규화, 한글/영숫자만) 후 `difflib.SequenceMatcher`로 변경 단어수 산정.
- **거부 조건**:
  - 정답 공백(`mod_words==0`) → `ActiveEditError`
  - 원본과 동일(`identical`) 또는 변경 단어수 < `MIN_WORD_CHANGES`(=1) → `ActiveEditError` → 400 `ACTIVE_EDIT_REQUIRED`
- **차단하진 않지만 표시**: 변경률 < `SUSPICIOUS_RATIO`(=0.05)면 `suspicious=true` — 게으른 편집을 admin이 검토(차단 X).
- 반환 통계(`changed_words`,`change_ratio`,`mod_words`,`suspicious`)는 `audit_logs.SUBMIT.details.active_edit`에 보존 → admin 품질지표 산출 근거.
- 프론트 `lib/activeEdit.ts`가 **동일 규칙을 클라에서 미러**(실시간 카운터), 단 **권위는 서버**.

### BR-State. 검수 작업 생명주기 (`api/tasks.py`)
- 상태: `pending → in_progress → completed`. autosave가 pending/completed를 in_progress로 전환, submit이 completed로.
- **낙관적 잠금**: 모든 변경은 `version` 일치 검사(`_validate_version`), 불일치 시 409 `VERSION_CONFLICT`(+`current_version`). 성공 시 `version+1`.
- **본인 Task만**: `_owned_task_or_404`가 `WHERE Task.user_id == 본인` 강제 — 타인 작업 접근 404.
- **autosave**: draft_q/draft_a·오류사유·메모 저장(검증 없음, 임시). `AUTOSAVE` 감사+SSE.
- **submit**: Active Edit 검증 통과 시 modified_q/modified_a 확정·completed. `SUBMIT` 감사+SSE.
- **재수정**: completed도 다시 autosave/submit 가능(잠금 전까지). 기준선은 여전히 원본.
- **재개(resume)**: 마지막 접근 task로 복귀(`last_accessed_at` 우선).

### BR-Lock. 최종 제출·락킹 (`api/tasks.py` `batch_submit`)
- **자격**: `batch/eligibility` — 전 배정 건이 `completed`이고 미잠금일 때만 `eligible`.
- 미완료 상태 제출 시 400 `INCOMPLETE_TASKS`(completed/total 동봉).
- 통과 시 **두 번째 듀얼 서명**(최종제출·저작권 이관) → `final.pdf` 증빙 → `batch_submissions` + `is_batch_submitted=true` + `batch_submitted_at`.
- 이후 모든 편집 API는 423 `BATCH_LOCKED`(`ensure_not_locked`) — **읽기전용 잠금**. `BATCH_SUBMIT` 감사+SSE.

### BR-Admin. 모니터링·운영 (`api/admin.py`)
- **진행률**(`/reviewers`): 검수자별 total/completed/pending + **평균 변경률**·**trivial(suspicious) 건수**·마지막활동·잠금여부. 변경률은 `audit_logs.SUBMIT.details`에서 집계 → 게으른 편집 적발/코칭.
- **실시간 SSE**(`/audit/stream`): 제출·임시저장·최종제출 이벤트(가명만). 실명 해석은 화면 권한.
- **잠금 해제**(`/users/{id}/unlock`): `is_batch_submitted=false` 복귀 + `BATCH_UNLOCK` 감사. 검수자 재편집 허용.
- **Export**(`/export`): 완료분만, **가명(reviewer_code)** 컬럼. **실명·연락처·계좌 미포함**. dataset_id·원본·수정본·오류사유·제출시각.
- **증빙 열람**: 서명 메타/이미지·agreement.pdf·final.pdf.

### BR-PII. 개인정보 생명주기 (`core/crypto.py`, `payment_info`)
- 실명·전화·계좌는 `*_enc` 컬럼에 Fernet 암호화 저장. 주민번호는 **수집 안 함**(필요 시 유선 1회·즉시 파기, 서약 명시).
- 검수비 지급 후 지급정보 파기(`purge-payment`, `purged` 플래그).

## 4. 핵심 불변식 (앱이 보장하는 것)
1. **모든 완료 산출물은 원본과 다르다** — Active Edit 검증을 통과하지 않으면 completed 불가 → 저작권 귀속 근거.
2. **동의·이관은 위조 불가하게 증빙된다** — 서약 전문 해시 + 서명 해시 + IP + UTC가 불변 테이블·PDF에 고정.
3. **한 문항은 한 검수자에게만** — `UNIQUE(user_id,dataset_id)` + 본인 쿼리 강제.
4. **모든 행위는 추적된다** — append-only 감사로그(운영 시 DB 롤 UPDATE/DELETE 미부여).
5. **동시성 안전** — 낙관적 잠금(version)으로 덮어쓰기 충돌 차단(409).
6. **단일 세션** — 다른 기기 로그인이 이전 세션 무효(session_version).

## 5. 임계값·파라미터 (`core/config.py` / `.env`)
| 키 | 기본 | 의미 |
|---|---|---|
| `MIN_WORD_CHANGES` | 1 | Active Edit 최소 변경 단어수(미만 거부) |
| `SUSPICIOUS_RATIO` | 0.05 | 이 미만 변경률 → suspicious 표시(차단X) |
| `GOOD_RATIO` | 0.30 | (참고) 양호 변경률 기준 |
| `SIGN_MIN_INK_RATIO` | 0.002 | 서명 캔버스 빈칸 판정 임계 |
| `JWT_ACCESS_TTL_MIN`/`_REFRESH_TTL_DAYS` | 120 / 7 | 토큰 수명 |

> ⚠ `MIN_WORD_CHANGES=1`은 spec 기본값. "1단어만 바꿔도 통과"가 저작권상 충분한지는 **법무 트랙 별도 판단**(spec §0.2). suspicious 지표로 사후 적발 보완.

## 6. 주요 에러 코드
| 코드 | HTTP | 트리거 |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | 로그인 실패·토큰 무효 |
| `SESSION_SUPERSEDED` | 401 | 단일세션 무효화 |
| `NOT_AGREED` | 403 | 미동의 reviewer / 동의 3종 미체크 |
| `FORBIDDEN` | 403 | 역할 불일치 |
| `NOT_FOUND` | 404 | 타인/없는 Task |
| `VERSION_CONFLICT` | 409 | 낙관적 잠금 충돌 |
| `BATCH_EXISTS` | 409 | 동일 batch_id 재업로드 |
| `BATCH_LOCKED` | 423 | 최종제출 후 편집 |
| `INVALID_DATASET` | 400 | 컬럼 누락·건수 불일치 |
| `ACTIVE_EDIT_REQUIRED` | 400 | 정답 미변형·동일 |
| `SIGNATURE_REQUIRED` | 400 | 성명 공백·빈 캔버스 |
| `INCOMPLETE_TASKS` | 400 | 미완료 상태 최종제출 |
