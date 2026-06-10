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
| `manage-watch.sh` | Watch 模式管理 |
| `install-service.sh` | systemd 开机自启 |

## 🎯 快速开始

```bash
cd /path/to/HYX-website
chmod +x 一键部署.sh manage-watch.sh install-service.sh setup-permissions.sh
./一键部署.sh
```

按提示选择是否启用 **HTTPS（443）**；启用前需将证书放入 `ssl/` 并修改 `nginx-https.conf` 域名，详见 [HTTPS配置指南.md](HTTPS配置指南.md)。手动部署见 [部署指南.md](部署指南.md)。

## 🚀 功能

- 一键部署：HTTP（80）或 HTTPS（80+443）
- Watch 自动同步：`git pull` 后数秒自动生效，**无需手动 sync**（仅 HTTP 模式）
- 开机自启：可安装 systemd 服务
- 支持 Vercel 部署：见下方「部署到 Vercel」

## ☁️ 部署到 Vercel（可选）

`vercel.json` 已固化配置，直接从 GitHub 导入即可：

1. 登录 [Vercel](https://vercel.com)，点击 **Add New... → Project**
2. 选择 `shilei2024/HYX-website` 仓库 → **Import**
3. Vercel 会自动读取 `vercel.json`，识别到：
   - 静态站点（无构建步骤）
   - 站点根目录 `site/`
4. 点击 **Deploy**，数十秒后即可访问

> **如果未引入 `vercel.json`**（旧版本）：需要在 Vercel 项目 → **Settings → General → Root Directory** 手动填入 `site`，否则会因找不到 `index.html` 返回 404。

如需修改站点根目录，仅改 `vercel.json` 中的 `outputDirectory` 字段并提交，Vercel 会自动重新部署。

---

## 📞 技术支持

- 📧 邮箱：bill.zhang@hyic-tech.cn
- 📱 电话：138 2367 4897

---

**最后更新**：2025 年
