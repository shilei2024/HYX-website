#!/usr/bin/env bash
# 在 GitHub Actions 的独立 Linux runner 中验证真实 HTTP/HTTPS，不触碰生产服务器。
set -euo pipefail
if [ "${CI:-}" != true ]; then
  echo "此脚本仅在隔离的 CI runner 中运行，避免占用本机 80/443 或改变本地容器。"
  exit 1
fi
MODE=${1:-http}
TEST_ROOT=$(mktemp -d "${RUNNER_TEMP:-/tmp}/hyx-deployment-${MODE}-XXXXXX")
export HYX_DATA_DIR="$TEST_ROOT/runtime"
export HYX_BACKUP_DIR="$TEST_ROOT/archives"
export ADMIN_USER=ci-admin
export ADMIN_PASSWORD=ci-disposable-password-2026
export TZ=Asia/Shanghai
COMPOSE=(docker compose -p "hyx-ci-$MODE" -f docker-compose.yml)
CURL=(curl --fail --silent --show-error)
STATUS_CURL=(curl --silent --show-error)
BASE=http://localhost
if [ "$MODE" = https ]; then
  mkdir "$TEST_ROOT/ssl"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=hyic-tech.com' \
    -addext 'subjectAltName=DNS:hyic-tech.com,DNS:www.hyic-tech.com' \
    -keyout "$TEST_ROOT/ssl/privkey.pem" -out "$TEST_ROOT/ssl/fullchain.pem" >/dev/null 2>&1
  cat > "$TEST_ROOT/tls.yml" <<EOF
services:
  hyx-website:
    volumes:
      - $TEST_ROOT/ssl:/etc/nginx/ssl:ro
EOF
  COMPOSE=(docker compose -p "hyx-ci-$MODE" -f docker-compose-https.yml -f "$TEST_ROOT/tls.yml")
  CURL+=(--cacert "$TEST_ROOT/ssl/fullchain.pem" --resolve hyic-tech.com:443:127.0.0.1)
  STATUS_CURL+=(--cacert "$TEST_ROOT/ssl/fullchain.pem" --resolve hyic-tech.com:443:127.0.0.1)
  BASE=https://hyic-tech.com
elif [ "$MODE" != http ]; then
  echo "未知测试模式：$MODE"; exit 1
fi
cleanup() {
  local result=$?
  if [ "$result" -ne 0 ]; then
    for container in $("${COMPOSE[@]}" ps -aq); do
      docker inspect --format '{{.Name}} {{json .State.Health}}' "$container" || true
    done
  fi
  "${COMPOSE[@]}" logs --tail 80 || true
  "${COMPOSE[@]}" down || true
  exit "$result"
}
trap cleanup EXIT

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --build --wait --wait-timeout 180
"${COMPOSE[@]}" exec -T hyx-website nginx -t
"${CURL[@]}" "$BASE/healthz" | grep -q ok
"${CURL[@]}" "$BASE/api/health" | grep -q '"ok":true'
for route in / /admin/ /products/brands.html /news/index.html /contact/index.html /en/ /ru/; do
  "${CURL[@]}" "$BASE$route" >/dev/null
done
"${CURL[@]}" -I "$BASE/admin/js/admin.js" | grep -qi 'cache-control: no-store'
"${CURL[@]}" -I "$BASE/js/components.js" | grep -qi 'cache-control: no-cache'

if [ "$MODE" = https ]; then
  mkdir -p site/.well-known/acme-challenge
  echo acme-fixture > site/.well-known/acme-challenge/ci-token
  curl -fsS http://localhost/.well-known/acme-challenge/ci-token | grep -q acme-fixture
  curl -sSI http://localhost/ | grep -q '301'
fi

# 使用实际登录和写入接口验证后台 → nginx → 运营目录整个边界。
TOKEN=$("${CURL[@]}" -H 'Content-Type: application/json' -d '{"username":"ci-admin","password":"ci-disposable-password-2026"}' "$BASE/api/auth/login" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
AUTH=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
"${CURL[@]}" "${AUTH[@]}" -X PUT -d '{"news":[{"id":999,"title":"persistent-ci-news"}],"types":[]}' "$BASE/api/data/news" >/dev/null
"${CURL[@]}" "$BASE/data/news.json" | grep -q persistent-ci-news
"${CURL[@]}" -I "$BASE/data/news.json" | grep -qi 'cache-control: no-store'
IMAGE=$("${CURL[@]}" "${AUTH[@]}" -d '{"filename":"ci.png","contentBase64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7u0AAAAASUVORK5CYII="}' "$BASE/api/upload" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).url')
"${CURL[@]}" "$BASE/$IMAGE" > "$TEST_ROOT/image-before.png"
"${CURL[@]}" -I "$BASE/$IMAGE" | grep -qi 'content-security-policy: sandbox'
STATUS=$("${STATUS_CURL[@]}" -o /dev/null -w '%{http_code}' "$BASE/api/data/news")
test "$STATUS" = 401

"${COMPOSE[@]}" restart hyx-admin
"${COMPOSE[@]}" up -d --wait --wait-timeout 90
"${CURL[@]}" "$BASE/data/news.json" | grep -q persistent-ci-news
"${COMPOSE[@]}" exec -T hyx-backup node /srv/app/server/backup.js
"${COMPOSE[@]}" exec -T hyx-backup node /srv/app/server/backup.js --health
ARCHIVE=$("${COMPOSE[@]}" exec -T hyx-backup node -p 'JSON.parse(require("fs").readFileSync("/srv/backups/last-success.json","utf8")).archive')
mkdir "$TEST_ROOT/restored"
docker run --rm -v "$TEST_ROOT:/fixture" node:24-alpine tar -xzf "/fixture/archives/$ARCHIVE" -C /fixture/restored
export HYX_DATA_DIR="$TEST_ROOT/restored"
"${COMPOSE[@]}" up -d --force-recreate --wait --wait-timeout 180
"${CURL[@]}" "$BASE/data/news.json" | grep -q persistent-ci-news
"${CURL[@]}" "$BASE/$IMAGE" > "$TEST_ROOT/image-after.png"
cmp "$TEST_ROOT/image-before.png" "$TEST_ROOT/image-after.png"
"${CURL[@]}" -H 'Content-Type: application/json' -d '{"username":"ci-admin","password":"ci-disposable-password-2026"}' "$BASE/api/auth/login" | grep -q '"ok":true'
echo "$MODE 部署、后台保存、图片、重启、备份和恢复验证通过"
