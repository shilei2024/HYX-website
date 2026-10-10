#!/bin/bash
# 使用当前检出代码部署；先校验和构建，完成后再重建服务。
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Docker 未安装"; exit 1; }
docker compose version >/dev/null
if [ ! -d site ]; then echo "site 目录不存在"; exit 1; fi

echo "使用当前代码部署。运营数据保留在独立目录，脚本不修改 Git 工作区。"
read -rp "启用 HTTPS（需要 ssl/ 证书与已配置域名）？[y/N] " REPLY
CONFIG_FILE=docker-compose.yml
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    if [ ! -s ssl/fullchain.pem ] || [ ! -s ssl/privkey.pem ]; then
        echo "HTTPS 证书缺失，停止部署，请先按 HTTPS配置指南.md 配置。"
        exit 1
    fi
    CONFIG_FILE=docker-compose-https.yml
fi
COMPOSE=(docker compose -f "$CONFIG_FILE")
"${COMPOSE[@]}" config --quiet
echo "构建镜像（失败时不会停止当前容器）..."
"${COMPOSE[@]}" build
echo "重建服务并等待官网、后台与首次备份通过健康检查..."
"${COMPOSE[@]}" up -d --force-recreate --remove-orphans --wait --wait-timeout 180
"${COMPOSE[@]}" ps
echo "部署验证通过。后台保存后前台刷新生效；默认每日北京时间 03:00 备份，保留 30 天。"
echo "备份日志：docker logs hyx-backup"
echo "首次升级需先备份现网并迁移运营数据，步骤见 腾讯云HTTPS升级步骤.md。"
