# 배포 런북 — 우분투 홈서버 + Cloudflare Tunnel + Access (공개 전환)

> 상태: **채택 확정**(2026-07-03). `deploy-options.md`의 "우분투+Tailscale"을 기반으로,
> 접근을 **Tailscale 전용 → 공개(Cloudflare Tunnel)**로 전환한다. progress.md 미결 **E** 해소 경로.
> 대상 독자: 운영자(=나). 이 문서만 따라 하면 공개 배포가 된다.

## 0. 무엇을 바꾸나 (한 줄)
앱 구동은 **지금 그대로**(우분투 홈서버 docker compose). **바꾸는 건 진입로 하나뿐** —
Tailscale 사설망 대신 **Cloudflare Tunnel**로 공개하고, 앞단에 **Cloudflare Access**(이메일 화이트리스트) 인증을 얹는다.

## 1. 현재 → 목표

| | 현재 | 목표 |
|---|---|---|
| 서버 | 우분투 홈서버, docker compose | **동일** |
| 진입로 | Tailscale 사설망 전용 | **Cloudflare Tunnel**(공개 도메인) |
| 공인 포트 | 없음(홈 공유기 닫힘) | **여전히 없음** — 아웃바운드 터널만 |
| 공인 IP 노출 | 없음 | **없음** — Cloudflare IP만 노출, 홈 IP 은닉 |
| TLS | 없음(80만) | **Cloudflare 엣지가 자동 종단**(인증서 관리 불필요) |
| 인증 | tailnet 참여자 | **앱 로그인 + 그 앞단 Cloudflare Access(검수자 7인 이메일)** |
| 관리자망 | Tailscale | (선택) **Tailscale 유지** — 아래 §7 |

## 2. 원리 (요약)
```
[검수자 브라우저] --HTTPS--> [Cloudflare 엣지] <==아웃바운드 상시터널==> [cloudflared 컨테이너] --http--> [nginx:80] --> web/api
```
- `cloudflared`가 홈서버에서 Cloudflare로 **밖으로** 상시 연결 → 홈 공유기에 **인바운드 포트 0개**.
- 방문자는 도메인으로 접속 → 엣지가 그 터널로 요청 전달.
- 엣지에서 TLS 종단, 터널 구간은 자체 암호화. 홈 IP는 DNS에 안 뜬다.
- 자세한 보안 논의는 §8.

## 3. 사전 준비 (사람이 브라우저에서 — 자동화 불가)
1. **Cloudflare 계정** 생성.
2. **도메인 구매**: 대시보드 → *Domain Registration → Register Domains*에서 검색·구매.
   - 원가 판매(갱신가 동일). `.com` ≈ $10/년 권장(신뢰도), `.xyz`/`.info`는 더 저렴.
   - 구매 시 자동으로 Cloudflare DNS에 연결됨(네임서버 수동설정 불필요).
   - 이 문서에선 도메인을 `<DOMAIN>` (예: `review.example.com` 또는 apex `example.com`)로 표기.

## 4. 터널 생성 → 토큰 발급 (대시보드, 토큰형)
> 토큰형(Remote-managed)을 쓴다. 로컬 인증서/`config.yml` 관리 불필요, 라우팅은 대시보드에서.

1. 대시보드 → **Zero Trust → Networks → Tunnels → Create a tunnel**.
2. 유형 **Cloudflared** 선택 → 이름(예: `kdt-sme-review`) → **Save**.
3. 나오는 화면에서 **터널 토큰**을 복사(설치 명령의 `--token eyJ...` 값).
   - 이 토큰이 곧 시크릿. `.env`의 `CF_TUNNEL_TOKEN`에 넣는다(§6). **git 커밋 금지.**
4. **Public Hostnames** 탭 → **Add a public hostname**:
   - Subdomain/Domain = `<DOMAIN>`
   - Service Type = **HTTP**, URL = **`nginx:80`**
     (compose 내부 서비스명. cloudflared가 같은 docker 네트워크라 이름으로 해석됨)
5. 저장하면 Cloudflare가 DNS(CNAME→터널)를 자동 생성.

## 5. Access 인증 게이트 (검수자 7인만 진입)
> 앱 로그인 **앞단**에 네트워크 레벨 인증을 한 겹 더. PII 앱 권장.

1. 대시보드 → **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Application domain = `<DOMAIN>` (전체 호스트. `/`·`/api` 모두 커버됨).
3. **Identity**: 손쉬운 시작은 **One-time PIN**(이메일로 코드) — IdP 없이 즉시 가능.
   (원하면 Google Workspace/GitHub 등 IdP 연동 가능.)
4. **Policy**: Action = **Allow**, Include = **Emails** → 검수자 7인 이메일 나열
   (또는 Emails ending in `@회사도메인`).
5. 세션 지속시간(예: 24h) 설정. 저장.

- 효과: 도메인 접속 시 먼저 Access 로그인(이메일 OTP) → 통과해야 앱 화면 도달.
- 주의: **API(`/api/*`)도 같은 호스트라 Access가 함께 건다.** 브라우저 XHR은 Access 쿠키(`CF_Authorization`)를 자동 동봉하므로 정상 동작. 외부 기계 호출(웹훅 등) 필요 시 그 경로만 **Service Token** 정책으로 예외 처리.

## 6. 코드/설정 변경 (내가 적용 — §10 체크)
### 6.1 compose에 `cloudflared` 추가
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}
    depends_on:
      - nginx
```
- 라우팅은 대시보드에서 하므로 마운트/설정파일 없음. 토큰만 주입.
- `nginx`의 `ports: 80/443` 호스트 매핑은 **터널만 쓰면 제거 가능**하지만,
  LAN/Tailscale 로컬 접근을 위해 **80은 유지 권장**(공유기엔 어차피 안 열림).

### 6.2 `.env` (신규 키)
```
# --- Cloudflare Tunnel ---
CF_TUNNEL_TOKEN=            # §4에서 복사한 터널 토큰 (시크릿, git 금지)
```

### 6.3 프론트 API 베이스 & 쿠키
- `NEXT_PUBLIC_API_BASE` = `https://<DOMAIN>/api/v1` (기존 `http://localhost/...`에서 교체).
- **세션 쿠키 `Secure` 플래그** 운영 활성화 필수(HTTPS 전제). SameSite=Lax 유지면 됨(동일 도메인).
  → 백엔드 쿠키 설정 지점 점검(P6 항목과 함께).

### 6.4 SSE(관리자 실시간 피드) 주의
- nginx는 이미 `/api/`에서 `proxy_buffering off`. cloudflared/엣지도 SSE 통과함.
- 다만 엣지 idle 타임아웃으로 장시간 무이벤트 시 끊길 수 있음 → **EventSource 자동 재연결**로 흡수(프론트 기본 동작 확인). 필요 시 서버 keepalive 코멘트(`: ping\n\n`) 주기 전송.

## 7. (선택) 관리자망은 Tailscale 유지
- 공개 진입로 = Tunnel+Access(검수자). 관리자(`/admin`)·SSH·DB는 **Tailscale로만** 접근하도록 유지 가능.
- 방법: nginx에서 `/admin`은 tailnet 대역(100.x)만 허용하거나, Access 정책을 관리자 이메일로 더 좁힘.
- 최소구성만 원하면 이 절 생략 — Access 정책 하나로 검수자+관리자 함께 관리.

## 8. 보안 평가
**이득**
- 홈 공인 IP·포트 **완전 은닉**(인바운드 0). 포트스캔·직접공격 표면 제거.
- TLS 자동, **DDoS 흡수**, WAF/Rate limit/봇차단 추가 가능(대시보드 룰).
- **Access = 앱 로그인 전 네트워크 인증** 한 겹. 자격 없는 접속은 앱에 도달조차 못 함.

**트레이드오프 / 유의**
- **Cloudflare가 TLS 종단** → 엣지에서 평문을 볼 수 있는 위치. CF 신뢰가 전제.
  (완화: 엣지↔서버는 터널 자체 암호화. SSL/TLS 모드 **Full(strict)** 권장.)
- **CF 의존성** — CF 장애 시 접속 불가(무료 SLA 없음). 홈서버 SPOF는 그대로.
- **터널 토큰 = 시크릿** — 유출 시 타인이 터널 연결 가능. `.env` git 제외, 유출 시 대시보드에서 토큰 회전.
- Access **OTP는 이메일 계정 탈취에 종속** — 민감도 높으면 IdP+2FA로 격상.

## 9. 남은 공통 빈칸 (deploy-options §4와 동일 — 공개 전환으로 더 중요)
1. **시크릿 관리** — `JWT_SECRET`·`PII_FERNET_KEY`·`CF_TUNNEL_TOKEN` 평문 `.env` 탈피(sops/age 또는 권한격리).
2. **백업 리허설**(spec §15) — DB + 서명/PDF 일일 백업·복구 테스트. 공개 후엔 필수.
3. **시드 비번 교체** — 시드 기본 `change-me` 운영 전 강제 변경.
4. **쿠키 Secure/CSRF**(P6) — 공개 HTTPS 전제로 반드시.

## 10. 실행 체크리스트
- [ ] Cloudflare 계정 + 도메인 구매(§3)
- [ ] 터널 생성·토큰 확보·Public Hostname `nginx:80` 연결(§4)
- [ ] Access 앱+정책(검수자 7인)(§5)
- [ ] compose에 `cloudflared` 추가(§6.1)
- [ ] `.env`에 `CF_TUNNEL_TOKEN`, `NEXT_PUBLIC_API_BASE` 갱신(§6.2/6.3)
- [ ] 쿠키 Secure·SSE 재연결 확인(§6.3/6.4)
- [ ] `docker compose up -d --build` → `https://<DOMAIN>` 접속 → Access 로그인 → 앱 로그인 확인
- [ ] progress.md 미결 **E** 해소 표기 + deploy-options 결정 반영

## 11. 롤백
- 문제 시: 대시보드에서 터널/Access 비활성 또는 `cloudflared` 컨테이너 중지 →
  공개 진입로 즉시 차단. Tailscale 경로는 그대로 살아있어 **무중단 후퇴** 가능.
