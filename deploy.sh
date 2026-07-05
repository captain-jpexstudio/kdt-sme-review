#!/usr/bin/env bash
# 배포: 로컬 backend·frontend·docker-compose.yml 을 서버로 동기화 후 api·web 재빌드(프로덕션).
#   - api 재기동 시 `alembic upgrade head` 자동 실행 → DB 마이그레이션 반영.
#   - 프론트만 바꿨으면 FRONT_ONLY=1 ./deploy.sh 로 web 만 배포(빠름).
# 사용: ./deploy.sh   (서버 ssh 별칭 defense-server, 배포 경로 /home/guru/kdt-sme-review)
set -euo pipefail

SERVER="${DEPLOY_SERVER:-defense-server}"
DIR="${DEPLOY_DIR:-/home/guru/kdt-sme-review}"
FRONT_ONLY="${FRONT_ONLY:-0}"

echo "▶ 코드 동기화 → $SERVER:$DIR"
rsync -az --exclude node_modules --exclude .next --exclude '.env*' ./frontend/ "$SERVER:$DIR/frontend/"
rsync -az ./docker-compose.yml "$SERVER:$DIR/docker-compose.yml"
if [ "$FRONT_ONLY" != "1" ]; then
  rsync -az --exclude __pycache__ --exclude .venv --exclude '.env*' ./backend/ "$SERVER:$DIR/backend/"
fi

if [ "$FRONT_ONLY" = "1" ]; then
  echo "▶ web 재빌드·재기동(프론트만)"
  ssh "$SERVER" "cd $DIR && docker compose up -d --build web"
else
  echo "▶ api·web 재빌드·재기동(api 기동 시 마이그레이션 자동 적용)"
  ssh "$SERVER" "cd $DIR && docker compose up -d --build api web"
fi

echo "✅ 배포 완료 → https://domainxiom.com"
