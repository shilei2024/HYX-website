#!/bin/bash
# 将仓库根目录的网站文件同步到 html/，供 Docker Compose Watch 同步到容器
# 使用场景：git pull 之后执行，网站才会更新

set -e
cd "$(dirname "$0")"

if [ ! -d "html" ]; then
    echo "❌ html 目录不存在，请先执行 一键部署.sh"
    exit 1
fi

echo "正在将仓库文件同步到 html/ ..."
rsync -av --exclude='html/' --exclude='logs/' --exclude='.git/' --exclude='*.md' --exclude='*.sh' --exclude='docker-compose.yml' --exclude='docker-compose-https.yml' --exclude='Dockerfile' --exclude='.dockerignore' . html/
echo "✅ 同步完成。若已开启 Watch，容器会在数秒内更新。"
