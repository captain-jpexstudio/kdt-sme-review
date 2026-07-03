#!/usr/bin/env bash
# 프론트 배포: 로컬 frontend + docker-compose.yml 을 서버로 동기화 후 web 재빌드(프로덕션).
# 사용: ./deploy.sh   (서버 ssh 별칭 defense-server, 배포 경로 /home/guru/kdt-sme-review)
set -euo pipefail

SERVER="${DEPLOY_SERVER:-defense-server}"
DIR="${DEPLOY_DIR:-/home/guru/kdt-sme-review}"

echo "▶ 코드 동기화 → $SERVER:$DIR"
rsync -az --exclude node_modules --exclude .next --exclude '.env*' ./frontend/ "$SERVER:$DIR/frontend/"
rsync -az ./docker-compose.yml "$SERVER:$DIR/docker-compose.yml"

echo "▶ web 재빌드·재기동(프로덕션 빌드)"
ssh "$SERVER" "cd $DIR && docker compose up -d --build web"

echo "✅ 배포 완료 → https://domainxiom.com"
