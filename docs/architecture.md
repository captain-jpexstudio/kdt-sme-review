# 아키텍처 — kdt-sme-review

> SME 검수앱. 전문가 7인이 생성된 QA 2,100건을 각 300문항씩 검수하며, 정답을 능동 변형(Active Edit)해
> 저작권을 주최 측에 귀속시키는 다중사용자 HITL 웹앱. **SSoT = `spec-v6.md`**, 이 문서는 *코드 실측 기준* 구조 설명.

## 1. 구성도
```
Browser(Next.js 14) ──HTTP(S)──▶ Nginx ──▶ FastAPI(uvicorn) ──asyncpg──▶ PostgreSQL 16
                                    │                  └─▶ LocalStorage 볼륨(/data/signatures): 서명 PNG·증빙 PDF
                                    └ 정적/SSR(web:3000), /api/* → api:8000
```
- **단일 인스턴스**(spec §15). docker compose 4서비스: `db` · `api` · `web` · `nginx`.
- 컨테이너 간 통신은 compose 네트워크 내부. **호스트로 여는 포트는 nginx(80/443)뿐** — db/api/web은 비공개.

## 2. 컴포넌트

### 2.1 백엔드 (`backend/app/`, FastAPI · Python 3.11)
| 레이어 | 파일 | 책임 |
|---|---|---|
| 엔트리 | `main.py` | 앱 생성, 라우터 마운트(`/api/v1`), `/health` |
| 설정 | `core/config.py` | `.env` → `Settings`(DB·JWT·PII키·Active Edit 임계) |
| 인증 | `core/security.py` | bcrypt 해시, JWT(HS256) 발급/검증 |
| 암호화 | `core/crypto.py` | PII Fernet 암복호화 (실명·전화·계좌) |
| DB | `db/models.py`·`db/base.py` | SQLAlchemy 2 async 모델·세션 |
| 의존성 | `api/deps.py` | 인증·역할·동의·잠금 가드(아래 §4) |
| 라우터 | `api/{auth,tasks,admin}.py` | 엔드포인트(§3) |
| 서비스 | `services/{active_edit,assignment,signature,pdf,export,events,storage}.py` | 도메인 로직(§비즈니스로직 문서) |

### 2.2 프론트엔드 (`frontend/`, Next.js 14 App Router · TS)
| 경로 | 역할 |
|---|---|
| `app/login/page.tsx` | 로그인 |
| `app/agreement/page.tsx` | 동의 3종 + 듀얼 서명 게이트 |
| `app/workspace/page.tsx` | 검수 워크스페이스(목록↔상세·변형·제출·최종제출) |
| `app/admin/page.tsx` | 관리자 대시보드(진행률·SSE·증빙·Export·unlock) |
| `middleware.ts` | 1차 라우팅 가드 — `access_token` 쿠키 없으면 `/login`(`/workspace`·`/admin` 매처) |
| `stores/{authStore,taskStore}.ts` | zustand 클라이언트 상태 |
| `lib/{api,auth,tasks,admin,activeEdit}.ts` | API 클라이언트(axios) + Active Edit **클라 미러**(서버 검증과 동일 규칙) |
| `components/SignaturePad.tsx` | react-signature-canvas 서명 패드 |

> 상태 분기 2단계: **미들웨어**(쿠키 유무 1차) → **각 페이지**가 `/auth/me`로 `is_agreed`·잠금 등 정밀 분기.

## 3. API 표면 (`/api/v1`)
| 그룹 | 메서드·경로 | 가드 | 용도 |
|---|---|---|---|
| auth | POST `/auth/login` | - | 로그인(쿠키 발급, session_version++) |
| | POST `/auth/logout` · `/auth/refresh` · GET `/auth/me` | 쿠키 | 세션 |
| | POST `/auth/agreement` | reviewer | 동의 3종+듀얼서명→증빙PDF→`is_agreed=true` |
| tasks | GET `/tasks/summary`·`/list`·`/resume`·`/{id}` | agreed_reviewer | 조회·재개 |
| | PATCH `/tasks/{id}/autosave` | not_locked | 임시저장 |
| | PUT `/tasks/{id}/submit` | not_locked | 제출(Active Edit 검증) |
| | GET `/tasks/batch/eligibility` · POST `/tasks/batch-submit` | not_locked | 최종제출(서명→잠금) |
| admin | POST `/admin/datasets/upload` | admin | xlsx 업로드·할당 |
| | GET `/admin/reviewers`·`/stats` | admin | 모니터링 |
| | GET `/admin/audit/stream` | admin | 실시간 SSE |
| | GET `/admin/export` | admin | 완료분 가명 xlsx |
| | POST `/admin/users/{id}/unlock` | admin | 잠금 해제 |
| | GET `/admin/users/{id}/signatures`·`/agreement.pdf`·`/final.pdf` | admin | 증빙 열람 |

## 4. 인증·세션·가드 (`api/deps.py`)
- **쿠키 기반 JWT** — httpOnly·SameSite=lax·(운영)Secure. access(120분)/refresh(7일).
- **단일 세션(BR-8)** — `users.session_version`. 로그인마다 `+1`, 토큰의 `sv`와 불일치 시 401(`SESSION_SUPERSEDED`). 다른 기기 로그인이 이전 세션 무효화.
- **가드 체인**: `current_user` → `current_reviewer`(역할) → `agreed_reviewer`(동의) → `ensure_not_locked`(최종제출 전). admin은 `require_admin`.
  - 미동의 reviewer가 검수 API 호출 → 403 `NOT_AGREED`
  - 최종제출 완료 후 편집 시도 → 423 `BATCH_LOCKED`

## 5. 데이터 모델 (`db/models.py`)
- **불변(append-only)**: `datasets`(원본 Q-A) · `signature_assets` · `agreement_records` · `batch_submissions` · `audit_logs`.
  운영 시 앱 DB 롤에 UPDATE/DELETE 미부여로 무결성 보장(spec §5.2, P6).
- **가변**: `users`(세션·동의·잠금 플래그) · `tasks`(검수 작업, 낙관적 잠금 `version`) · `reviewer_profiles`/`payment_info`(PII 암호화).
- 핵심 제약: `tasks` `UNIQUE(user_id, dataset_id)` — 한 문항=한 검수자.
- **출처 추적**: `tasks.dataset_id → datasets`, `audit_logs.details`(JSONB)에 active_edit 통계 보존.

## 6. 시간·인코딩
- 저장 **UTC**, 표시 **KST**(프론트). 모든 타임스탬프 timezone-aware.

## 7. 보안 (구현 위치)
| 항목 | 구현 |
|---|---|
| 비밀번호 | bcrypt (`core/security.py`) |
| 세션 | httpOnly JWT 쿠키 + 단일세션 `session_version` |
| PII at-rest | Fernet 암호화 (`core/crypto.py`, `*_enc` 컬럼) |
| 권한 | 가드 의존성 + **본인 Task만**(쿼리 `WHERE user_id` 강제, `_owned_task_or_404`) |
| 증빙 무결성 | 서약 전문 sha256 + 서명 PNG sha256 + IP + UTC 시각 → PDF·`agreement_records`/`batch_submissions` |
| 감사 | 전 행위 `audit_logs`(LOGIN/AGREE_SIGN/AUTOSAVE/SUBMIT/BATCH_SUBMIT/BATCH_UNLOCK/DATASET_UPLOAD) |
| 공인노출 | (배포) Tailscale 내부망, 공인 포트 미개방 — `docs/deploy-options.md` |

## 8. 실시간(SSE) — `services/events.py`
- **in-process `asyncio.Queue` 브로드캐스터**. autosave/submit/batch-submit/unlock 이벤트를 admin `/audit/stream`으로 push.
- 페이로드는 **가명(reviewer_code)만** — 실명 해석은 admin 화면 권한 기반.
- ⚠ 단일 인스턴스 전제(메모리 큐). 다중 인스턴스로 확장 시 Redis pub/sub 등 외부 브로커 필요.

## 9. 스토리지 추상화 — `services/storage.py`
- 현재 `LocalStorage`(볼륨 `/data/signatures`). `put(key,bytes)`/`get(key)` 인터페이스.
- **운영(AWS) 전환점**: 동일 인터페이스로 S3 드라이버 교체 → 코드 영향 최소(spec §4.2).

## 10. 빌드·기동
- `docker compose up --build` → db healthy 후 api 기동, **`alembic upgrade head` 자동**, 시드 `python -m app.seed`(admin1+reviewer7).
- 현재 web는 `npm run dev`(개발 서버, spec P6에서 `build && start`로 전환 예정).
- 환경변수: `core/config.py`/`.env`(§참조). 미설정 시 `PII_FERNET_KEY` 사용 시점에 RuntimeError.

## 11. 알려진 한계 / TODO
- web 프로덕션 빌드 미전환(P6) · nginx TLS 미설정(현재 80) · SSE 메모리 큐(수평확장 불가) · LocalStorage(S3 미전환) · 시드 비번 `change-me` 운영 전 교체 필수.
