# docs/ — 구현 기준 (SSoT)

- **`spec-v6.md`** — Survey Web 통합 기획/개발 설계서 v6.0. **이 repo의 단일 구현 기준(SSoT).**
  코드는 이 문서를 따른다. PRD + Technical Spec(구현 착수용).
  - 원본 위치: `defense-dataset-platform/_docs/specs/SME-REVIEW/SurveyWeb_통합_기획개발_설계서_v6.md`
  - v2~v5 및 옛 설계(`research/검수 앱 상세 설계_윤지수.md`)를 **통합·대체**한다.

## 옛 설계 대비 주요 변경 (착수 전 인지)
- **스택 확정**: Next.js 14 + FastAPI + Postgres + Nginx/Docker(자체호스팅, Vercel 아님).
- **범위 축소**: 교차/이중 검수·IAA(κ)·자동 채점 **제외**(부록 D 향후 확장). 검수자 7명 × 각 300문항, 겹침 없음.
- **핵심 = Active Edit(정답 변형·저작권) + 듀얼 서명 + 락킹**. 배정은 라운드로빈(§13.2).

> 옛 윤지수 설계는 platform `research/`에 참조용으로 보존. 충돌 시 항상 v6 우선.
