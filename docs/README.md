# docs/ — 구현 기준 (SSoT)

- **`spec-v6.md`** — Survey Web 통합 기획/개발 설계서 v6.0. **이 repo의 단일 구현 기준(SSoT).**
  코드는 이 문서를 따른다. PRD + Technical Spec(구현 착수용).
  - 원본 위치: `defense-dataset-platform/_docs/specs/SME-REVIEW/SurveyWeb_통합_기획개발_설계서_v6.md`
  - v2~v5 및 옛 설계(`research/검수 앱 상세 설계_윤지수.md`)를 **통합·대체**한다.
- **`architecture.md`** — 코드 실측 기준 아키텍처(구성도·컴포넌트·API 표면·인증/가드·데이터모델·SSE/스토리지).
- **`business-logic.md`** — 비즈니스 규칙(BR)·상태머신·Active Edit/서명/락킹·불변식·임계값·에러코드.
- **`deploy-options.md`** — 배포 옵션 비교(AWS+Terraform vs 우분투+Tailscale). **결정: 우분투 유지+공개 전환**(아래).
- **`deploy-cloudflare-tunnel.md`** — 채택 배포 런북. 우분투 홈서버 유지 + Cloudflare Tunnel(공개)+Access(검수자 인증)+도메인. 미결 E 해소 경로.
- **`progress.md`** — 구현 진행현황(P0~P6).

## 옛 설계 대비 주요 변경 (착수 전 인지)
- **스택 확정**: Next.js 14 + FastAPI + Postgres + Nginx/Docker(자체호스팅, Vercel 아님).
- **범위 축소**: 교차/이중 검수·IAA(κ)·자동 채점 **제외**(부록 D 향후 확장). 검수자 7명 × 각 300문항, 겹침 없음.
- **핵심 = Active Edit(정답 변형·저작권) + 듀얼 서명 + 락킹**. 배정은 라운드로빈(§13.2).

> 옛 윤지수 설계는 platform `research/`에 참조용으로 보존. 충돌 시 항상 v6 우선.
