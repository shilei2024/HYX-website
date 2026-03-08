#!/bin/bash
# 安装 Watch 系统服务

set -e
cd "$(dirname "$0")"

CURRENT_USER=$(whoami)
SCRIPT_DIR="$(pwd)"

echo "安装 Watch 系统服务..."

# 配置服务文件
cp hyx-watch.service /tmp/hyx-watch.service
sed -i "s|/path/to/HYX-website|$SCRIPT_DIR|g" /tmp/hyx-watch.service
sed -i "s/your-username/$CURRENT_USER/g" /tmp/hyx-watch.service

# 安装服务
sudo cp /tmp/hyx-watch.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hyx-watch
sudo systemctl start hyx-watch

echo ""
echo "✅ 服务安装完成"
echo ""
sudo systemctl status hyx-watch --no-pager -l
echo ""
echo "管理命令："
echo "  sudo systemctl status hyx-watch"
echo "  sudo systemctl start hyx-watch"
echo "  sudo systemctl stop hyx-watch"
echo "  sudo systemctl restart hyx-watch"
echo "  sudo journalctl -u hyx-watch -f"
