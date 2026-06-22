# 진행 현황 (기준선)

> **단일 진입점.** "지금 어디까지 됐나"는 여기만 본다. 기준 = `spec-v6.md` §18 마일스톤(그대로 미러링).
> 큰 단계 끝낼 때마다 체크박스·현재 위치 한 줄 갱신. 최종 갱신: 2026-06-21.

## 현재 위치
**▶ P2 완료 ✅** (코어 BE: 업로드·할당·tasks·ActiveEdit·audit 구현 및 Docker 스모크 검증). 다음은 P3(워크스페이스 FE).
- 백엔드: login/me/refresh/logout + 단일세션(SESSION_SUPERSEDED) + 동의게이트(3종)·듀얼서명·증빙PDF(weasyprint)·audit
  - docker 통합검증: 로그인/단일세션/틀린비번/체크누락·blank서명·정상동의·멱등·admin403 + DB(agreement_records·signature_assets·PDF파일) 확인
- 프론트: /login·/agreement(SignaturePad)·middleware 가드·workspace 미동의 리다이렉트, `next build` 타입체크 통과
- P2 백엔드: `/admin/datasets/upload` xlsx 업로드·7×300 할당, `/tasks/summary|list|get|autosave|submit`, 동의/잠금/버전충돌/ActiveEdit 가드, audit 기록
- P2 검증: `compileall` 통과, Docker `api` 기동·라우트 등록 확인, `pytest tests/test_p2_core.py` 4개 통과(업로드/할당·tasks·ActiveEdit·version/guard), 2,100건 할당 단위 검증(7명×300)
- 실검증 중 잡은 버그: passlib↔bcrypt5(→4.0.1 핀), @types/react-signature-canvas 누락
- **미검증(후속)**: 브라우저 E2E(로그인→서명→제출 클릭 흐름)은 Playwright로 P6에서. web+nginx 합본 기동도 그때.

## 마일스톤 (spec-v6 §18)
| Phase | 산출물 | DoD | 상태 |
|---|---|---|---|
| **P0** 셋업 | repo·docker·DB·Alembic·시드·파일스토리지 | `compose up` 기동·마이그레이션 통과 | ✅ 검증완료 |
| **P1** 인증/동의/서명 | login·me·미들웨어·단일세션 + 듀얼 서명 + agreement(서명·PDF) | 미동의→/agreement 강제, 서명 검증·증빙 PDF | ✅ BE검증·FE빌드검증(브라우저E2E는 P6) |
| **P2** 코어 BE | 업로드/할당·tasks(list/get/autosave/submit)·ActiveEdit·audit | 2,100→7×300, 제출 검증·로그, 단위 green | ✅ 구현·스모크검증 완료 |
| **P3** 워크스페이스 FE | Q-A 목록(검색·필터)·상세 에디터·실시간 검증·autosave·단축키·재수정 | auto-resume·목록↔상세·제출 조건·자동 이동 | ⬜ |
| **P4** 최종 제출/락킹 | batch eligibility·batch-submit(서명·PDF·잠금)·LockedBanner·423 가드 | 300/300시 모달→잠금→읽기전용, 미완료/재호출 차단 | ⬜ |
| **P5** 관리자/실시간 | 대시보드·SSE·diff·필터·품질 지표·서명/PDF·unlock·Export·PII 파기 | 제출 즉시 반영·서명 PDF·unlock·파기 | ⬜ |
| **P6** 보안/QA | 암호화·rate limit·CSRF·E2E·백업 | 보안 점검·E2E green·백업 리허설 | ⬜ |

상태: ⬜ 대기 · 🟡 진행 · ✅ 완료

## 착수 전 미결 (spec 밖, 사람이 결정) — 단계 막지 않음
- **C. 근거 원문 표출** — 상세화면(§7.3)에 근거 교범 원문 추가할지 → P3 전 결정.
- **D. RAG→검수앱 데이터 계약** — `kdefense_bench.jsonl`→xlsx 변환·정확히 2,100 보장·메타 전달 → P2 전 결정.
- **E. 보안/망분리·PII 키 관리** — 배포환경(우분투+Tailscale) 정합 → P6 전 결정.
- 법무(저작권 1단어 임계·전자서명 효력) = 별도 트랙, 개발은 spec 값대로 진행.

> 규칙: 단계 끝 → 이 표 상태 갱신 + 현재 위치 한 줄. 상세는 spec-v6.md 참조.
