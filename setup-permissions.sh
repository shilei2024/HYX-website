#!/bin/bash
# 设置文件权限

cd "$(dirname "$0")"

echo "设置文件权限..."

# 设置脚本执行权限
chmod +x 一键部署.sh server-deploy.sh manage-watch.sh install-service.sh setup-permissions.sh

# 设置目录权限
[ -d "html" ] && chmod -R 755 html/
[ -d "logs" ] && chmod -R 755 logs/

echo "✅ 权限设置完成"
