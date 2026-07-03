# 배포 옵션 비교 — AWS vs 우분투+Tailscale

> **결정(2026-07-03): 우분투 홈서버 유지 + 공개 전환.** Tailscale 전용 → **Cloudflare Tunnel**로 공개하고
> 앞단에 **Access**(검수자 7인 이메일 인증)를 얹는다. 상세·절차는 **`deploy-cloudflare-tunnel.md`**.
> 이 문서는 그 결정에 이르기까지의 옵션 비교(AWS vs 우분투)를 보존한다.
>
> 상태(과거): **결정 대기**(P6 전 확정). spec §4.2와 progress.md 미결 E가 충돌하므로 이 문서로 정리.
> - spec §4.2: 운영 = **AWS EC2+RDS+S3** (기본값)
> - progress.md 미결 E: 배포환경 **우분투+Tailscale** 정합 → P6 전 결정
> - 공통 제약(spec): 자체호스팅(Vercel 아님)·보안격리, **단일 인스턴스**(§15), 일일 DB+서명/PDF 백업, Nginx(TLS).

## 0. 전제 — 둘 다 "내 VM에 docker compose" 형태
이 앱은 **stateful**(PostgreSQL·서명/PDF 파일볼륨·세션·SSE)이라 서버리스(Vercel/Lambda) 불가.
두 옵션 모두 **앱 구동은 docker compose 그대로**, 차이는 *그 박스가 어디에 있고 무엇을 매니지드로 빼느냐*다.

| 현재(로컬 compose) | AWS | 우분투+Tailscale |
|---|---|---|
| `db` 컨테이너+pgdata | **RDS** (매니지드) | db 컨테이너 유지(로컬 볼륨) |
| `sigdata` 로컬볼륨 | **S3** | 로컬 디스크 유지(+백업) |
| api·web·nginx | EC2에서 compose | 우분투에서 compose |
| 접근 | 공인 도메인+TLS | **Tailscale 사설망**(공인 노출 없음) |

---

## 1. 비교표

| 항목 | **AWS (EC2+RDS+S3)+Terraform** | **우분투 서버+Tailscale** |
|---|---|---|
| 근거 | spec §4.2 기본값 | progress.md 미결 E 후보 |
| 공인 노출 | 인터넷 노출(도메인+TLS, WAF/SG로 방어) | **노출 0** — Tailscale 사설 메시망으로만 접근 |
| 격리 수준 | VPC·프라이빗 서브넷·SG (논리 격리) | **물리/내부망 격리** — 검수자만 tailnet 참여 |
| IaC 적합 | **Terraform 최적**(VPC·RDS·S3·IAM·ACM) | Terraform 면적 작음 → **Ansible/compose**가 적합 |
| 매니지드 | RDS 자동백업·S3 버저닝·ACM 인증서 | 전부 직접(백업 cron·certbot 또는 Tailscale TLS) |
| 운영 부담 | 패치·SG·IAM 관리, but 매니지드가 덜어줌 | OS 패치·디스크·백업 전부 내 책임 |
| 비용(7명 규모) | t3.small+RDS+S3 ≈ **월 5~10만원대** | 서버 1대(사내/홈/저가 VPS) ≈ **월 0~수만원** |
| 확장성 | 즉시 스케일업·다중AZ 가능 | 수직 확장만, 사실상 고정 |
| 감사/재구축 | `terraform apply` 한 방 재현 | 이미지/Ansible 플레이북으로 재현 |
| 데이터 주권 | 서울리전 명시 고정 | **물리 위치를 내가 100% 통제** |
| 공공인증(CSAP) | 별도 미충족(필요시 NCP 공공존 전환) | 망분리엔 유리하나 인증은 별도 |
| 함정 | SG/IAM 오설정 시 공인 노출 위험, 비용 누수 | Tailscale 의존(계정·키 관리), 단일 박스 SPOF·백업 안 하면 끝 |

---

## 2. 어느 쪽이 언제 맞나

**AWS+Terraform 선택** = 다음 중 하나라도 참:
- 검수자가 **외부/원격 다수**라 공인 접근이 편해야 함
- 발주처가 **AWS/클라우드 운영**을 기대(인수인계·확장 전제)
- 매니지드 백업·가용성을 **운영부담 없이** 원함
- 인프라를 **코드로 감사·재현**해야 함(IaC 요구)

**우분투+Tailscale 선택** = 다음 중 하나라도 참:
- **공인 노출 자체를 없애는** 게 보안 1순위(망분리 지향)
- 검수자가 소수·고정(7명) → tailnet 초대로 충분
- **비용 최소화**·사내/온프레 서버 보유
- 데이터 물리 위치를 직접 통제해야 함

---

## 3. 권고 (현 정보 기준)

- **보안격리가 최우선이고 검수자 7명 고정이면 → 우분투+Tailscale가 spec의 "보안격리" 취지에 더 정확.**
  공인 노출 0 + 물리 통제 + 저비용. 단점(SPOF·백업·OS관리)은 백업 자동화로 상쇄.
- **발주처가 클라우드 운영/확장/인수인계를 요구하면 → AWS+Terraform.**
  이때 Terraform은 "프로비저닝 전용·린하게·state 원격백엔드(S3+DynamoDB, 암호화)·시크릿은 Secrets Manager 참조" 3원칙.

> 결정 변수 = **(a) 검수자 접근 형태(내부망 가능?) (b) 발주처의 운영·인수인계 요구.** 둘 다 계약/협의 사항.

---

## 4. 공통 — 어느 쪽이든 운영 전 채울 빈칸
1. **TLS** — 현 nginx.conf는 80만 리슨. AWS=ACM/certbot, Tailscale=tailnet TLS(`tailscale cert`).
2. **시크릿 관리** — `JWT_SECRET`·`PII_FERNET_KEY` .env 평문 탈피(AWS=Secrets Manager/SSM, 우분투=sops/age 또는 권한격리).
3. **스토리지 전환**(AWS만) — `services/storage.py` 로컬볼륨→S3 드라이버 분기.
4. **백업 리허설**(spec §15) — DB + 서명/PDF 일일 백업·복구 테스트. 증빙은 append-only라 **버저닝/불변보관** 권장.
5. **시드 비번 교체** — 시드 기본 `change-me` 운영 전 강제 변경.

---

## 5. 다음 단계
- 위 결정 변수(a,b) 확인 → 한 쪽 확정 → 해당 경로 **상세 배포 플레이북** 작성
  (AWS: Terraform 스켈레톤·RDS/S3 전환·TLS / 우분투: Ansible·Tailscale·certbot·백업 cron).
- 확정 시 progress.md 미결 E 해소 + spec §4.2 정합.
