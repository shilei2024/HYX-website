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
if [ ! -d "html" ]; then
    echo "创建 html 目录..."
    mkdir -p html
    echo "复制网站文件..."
    rsync -av --exclude='html/' --exclude='logs/' --exclude='.git/' --exclude='*.md' --exclude='*.sh' --exclude='docker-compose.yml' --exclude='Dockerfile' --exclude='.dockerignore' . html/
    echo "✅ 文件准备完成"
else
    echo "ℹ️  html 目录已存在"
fi
echo ""

# 部署容器
echo "停止旧容器..."
docker compose down --remove-orphans || true

echo "构建镜像..."
docker compose build --no-cache

echo "启动容器..."
docker compose up -d

echo ""
docker compose ps
echo ""

# 询问是否启动 Watch
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

echo ""
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo ""
echo "访问网站：http://$(hostname -I | awk '{print $1}')"
echo "后续更新：git pull"
echo "安装服务：sudo ./install-service.sh"
echo ""
