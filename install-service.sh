#!/bin/bash
# 容器的 restart: unless-stopped 负责服务重启，停用旧版 Watch 避免同步初始数据。
set -e
if command -v systemctl >/dev/null 2>&1; then
    if systemctl cat hyx-watch.service >/dev/null 2>&1; then
        sudo systemctl disable --now hyx-watch.service
    fi
    sudo systemctl enable --now docker
fi
echo "容器已配置自动重启，定期备份由 hyx-backup 服务运行，无需额外安装 Watch。"
