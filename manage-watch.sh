#!/bin/bash
# 兼容旧运维命令；网站已直接挂载代码和独立运营目录，无需 Compose Watch。
echo "当前版本无需 Watch。代码静态文件与运营数据直接挂载，后台保存后刷新官网即可。"
echo "服务状态：docker compose ps"
echo "备份日志：docker logs hyx-backup"
