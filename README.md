# 弘易芯科技官网

企业官网静态站，支持 Docker 部署、Watch 自动同步与 **HTTPS（443）**。

## 📁 文档与脚本

| 文档/脚本 | 用途 |
|-----------|------|
| **[部署指南.md](部署指南.md)** | 从零部署（含 HTTPS 可选） |
| **[日常更新.md](日常更新.md)** | 日常更新与维护 |
| **[故障排查.md](故障排查.md)** | 常见问题排查 |
| **[HTTPS配置指南.md](HTTPS配置指南.md)** | 443/SSL 证书与 Nginx 配置 |
| `一键部署.sh` | 一键部署（可选启用 HTTPS） |
| `sync-html.sh` | 拉取代码后同步到 html/，页面才会更新 |
| `manage-watch.sh` | Watch 模式管理 |
| `install-service.sh` | systemd 开机自启 |

## 🎯 快速开始

```bash
cd /path/to/HYX-website
chmod +x 一键部署.sh sync-html.sh manage-watch.sh install-service.sh setup-permissions.sh
./一键部署.sh
```

按提示选择是否启用 **HTTPS（443）**；启用前需将证书放入 `ssl/` 并修改 `nginx-https.conf` 域名，详见 [HTTPS配置指南.md](HTTPS配置指南.md)。手动部署见 [部署指南.md](部署指南.md)。

## 🚀 功能

- 一键部署：HTTP（80）或 HTTPS（80+443）
- Watch 自动同步：`git pull` 后执行 `./sync-html.sh`，数秒生效（仅 HTTP 模式）
- 开机自启：可安装 systemd 服务

---

## 📞 技术支持

- 📧 邮箱：bill.zhang@hyic-tech.cn
- 📱 电话：138 2367 4897

---

**最后更新**：2025 年
