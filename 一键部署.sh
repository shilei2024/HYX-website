#!/bin/bash
# 弘易芯科技官网 - 一键部署脚本

set -e

cd "$(dirname "$0")"

echo "🚀 开始部署弘易芯科技官网..."
echo ""

# 检查环境
echo "检查环境..."
command -v docker &> /dev/null || { echo "❌ Docker 未安装"; exit 1; }
docker compose version &> /dev/null || { echo "❌ Docker Compose 未安装"; exit 1; }
command -v git &> /dev/null || { echo "❌ Git 未安装"; exit 1; }
echo "✅ 环境检查通过"
echo ""

# 拉取代码（与远程保持一致，本地修改将被覆盖）
echo "拉取最新代码..."
git fetch origin
if git show-ref -q refs/remotes/origin/main; then
    git reset --hard origin/main
elif git show-ref -q refs/remotes/origin/master; then
    git reset --hard origin/master
else
    echo "❌ 未找到远程分支 main 或 master"
    exit 1
fi
echo "✅ 代码已更新"
echo ""

# 准备文件
if [ ! -d "site" ]; then
    echo "❌ site 目录不存在，请确认仓库完整"
    exit 1
fi
echo "✅ 网站目录 site/ 就绪（git pull 后 Watch 自动同步）"
echo ""

# 部署模式：是否启用 HTTPS（443）
USE_HTTPS=""
read -p "是否启用 HTTPS（443 端口，需已放置证书到 ssl/ 并修改 nginx-https.conf 域名）？[y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "ssl/fullchain.pem" ] && [ -f "ssl/privkey.pem" ]; then
        USE_HTTPS=1
    else
        echo "⚠️  未检测到 ssl/fullchain.pem 或 ssl/privkey.pem，将使用 HTTP 部署。"
        echo "    配置 HTTPS 请参阅：HTTPS配置指南.md"
    fi
fi

# 部署容器
echo "停止旧容器..."
docker compose down --remove-orphans || true
[ -f "docker-compose-https.yml" ] && docker compose -f docker-compose-https.yml down --remove-orphans 2>/dev/null || true

echo "构建镜像..."
docker compose build --no-cache

echo "启动容器..."
if [ -n "$USE_HTTPS" ]; then
    docker compose -f docker-compose-https.yml up -d
    echo "✅ 已使用 HTTPS 配置启动（80 + 443）"
else
    docker compose up -d
fi

echo ""
docker compose ps
echo ""

# 询问是否启动 Watch（仅 HTTP 模式推荐）
if [ -z "$USE_HTTPS" ]; then
    read -p "是否启动 Watch 自动同步模式？[y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "manage-watch.sh" ]; then
            chmod +x manage-watch.sh
            ./manage-watch.sh start-bg
        else
            nohup docker compose watch > watch.log 2>&1 &
            echo "✅ Watch 模式已启动"
        fi
    fi
else
    echo "ℹ️  HTTPS 模式未启用 Watch，更新内容请重新执行部署或手动重启容器。"
fi

echo ""
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo ""
if [ -n "$USE_HTTPS" ]; then
    echo "访问网站：https://$(hostname -I | awk '{print $1}')（请使用已配置的域名访问 HTTPS）"
else
    echo "访问网站：http://$(hostname -I | awk '{print $1}')"
fi
echo "后续更新：见 日常更新.md"
echo "安装服务：sudo ./install-service.sh"
echo "HTTPS 配置：HTTPS配置指南.md"
echo ""
