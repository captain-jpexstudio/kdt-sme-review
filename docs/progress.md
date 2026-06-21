# 진행 현황 (기준선)

> **단일 진입점.** "지금 어디까지 됐나"는 여기만 본다. 기준 = `spec-v6.md` §18 마일스톤(그대로 미러링).
> 큰 단계 끝낼 때마다 체크박스·현재 위치 한 줄 갱신. 최종 갱신: 2026-06-21.

## 현재 위치
**▶ P0 완료 ✅** — `docker compose up` 실검증 통과. 다음은 P1(인증·동의·듀얼서명).
- 검증: db healthy → `alembic upgrade head`(0001_initial) → 테이블 10개 → `/api/v1/health` 200 → 시드(admin1+reviewer7)
- 실검증 중 잡은 버그: passlib↔bcrypt5 비호환 → bcrypt 4.0.1 핀으로 수정
- 미검증: web(Next.js)·nginx 컨테이너는 아직 미기동(P3 화면 작업 시 확인)

## 마일스톤 (spec-v6 §18)
| Phase | 산출물 | DoD | 상태 |
|---|---|---|---|
| **P0** 셋업 | repo·docker·DB·Alembic·시드·파일스토리지 | `compose up` 기동·마이그레이션 통과 | ✅ 검증완료 |
| **P1** 인증/동의/서명 | login·me·미들웨어·단일세션 + 듀얼 서명 + agreement(서명·PDF) | 미동의→/agreement 강제, 서명 검증·증빙 PDF | ⬜ |
| **P2** 코어 BE | 업로드/할당·tasks(list/get/autosave/submit)·ActiveEdit·audit | 2,100→7×300, 제출 검증·로그, 단위 green | ⬜ |
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
