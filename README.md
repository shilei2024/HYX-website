# 弘易芯科技官网

企业官网，支持 Docker 部署、独立运营数据、每日自动备份与 **HTTPS（443）**。

## 📁 文档与脚本

| 文档/脚本 | 用途 |
|-----------|------|
| **[部署指南.md](部署指南.md)** | 从零部署（含 HTTPS 可选） |
| **[日常更新.md](日常更新.md)** | 日常更新与维护 |
| **[故障排查.md](故障排查.md)** | 常见问题排查 |
| **[HTTPS配置指南.md](HTTPS配置指南.md)** | 443/SSL 证书与 Nginx 配置 |
| `一键部署.sh` | 一键部署（可选启用 HTTPS） |
| `server/storage.js` | 首次启动迁移运营数据、图片与账号 |
| `server/backup.js` | 全量备份及每日定时任务 |
| `.env.example` | 持久化路径、备份时间和保留天数配置 |
| `install-service.sh` | 启用 Docker 开机启动、停用旧 Watch |

## 🎯 快速开始

```bash
cd /path/to/HYX-website
cp -n .env.example .env
# 编辑 .env：首次生产部署设置至少 12 位的 ADMIN_PASSWORD，替换示例占位值。
chmod +x 一键部署.sh manage-watch.sh install-service.sh setup-permissions.sh
./一键部署.sh
```

按提示选择是否启用 **HTTPS（443）**；启用前需将证书放入 `ssl/` 并修改 `nginx-https.conf` 域名，详见 [HTTPS配置指南.md](HTTPS配置指南.md)。部署脚本使用当前工作区代码，不会强制覆盖本地内容。

默认把运营内容存入仓库旁的 `../hyx-website-data/`，备份存入 `../hyx-website-backups/`。可复制 `.env.example` 为 `.env`，改成服务器上的绝对路径。`docker compose up -d --build` 会启动官网、后台和 `hyx-backup` 定时服务：每日北京时间 **03:00** 全量备份，保留 **30 天**。迁移、恢复和运维步骤见 [生产环境部署与维护指南.md](生产环境部署与维护指南.md)。

## 🚀 功能

- 一键部署：HTTP（80）或 HTTPS（80+443）
- 静态代码与运营目录直接挂载：后台保存后前台刷新生效，无需 Watch
- 代码和数据分离：首次启动自动迁移旧内容，之后更新代码不会覆盖运营数据
- 每日备份：JSON、上传图片、后台账号及内容历史全部打包
- 后台和备份使用 Node 24 LTS 容器
- 开机自启：启用 Docker 系统服务，容器自动重启
- 支持 Vercel 部署：见下方「部署到 Vercel」
- **后台内容管理**：无需改代码，网页后台直接增删改查全站内容

## 🛠️ 后台内容管理

浏览器访问 **`/admin/`**（如 `http://你的域名/admin/`），登录后即可管理全站内容，保存后**前台立即生效**：

| 模块 | 可管理内容 |
|------|-----------|
| 轮播图片 / 关于区块 | 首页英雄区图片、各语言文字、关于我们图文 |
| 新闻管理 / 新闻分类 | 持续新增新闻（分类、日期、封面、中英文正文） |
| 代理品牌 / 分销品牌 | 品牌 Logo、名称、官网链接、说明 |
| 产品列表 / 产品分类 / 应用框图 | 产品图文、分类、方案框图 |
| 站点设置 | 公司信息、联系方式、页脚备案、办公地点 |
| 多语言文案 | 中/英/俄界面文案（导航、按钮、栏目标题等） |

- **本地开发默认账号**：`admin` / `hyx@2026`。Docker 首次生产部署必须在 `.env` 配置至少 12 位的 `ADMIN_PASSWORD`；已有账号迁移后仍使用原密码，上线前应更换开发默认密码。
- **技术实现**：零依赖 Node.js 服务（`server/server.js`）读写 `HYX_DATA_DIR/content/`，图片保存至 `HYX_DATA_DIR/uploads/`，账号及保存前的历史快照保存在 `HYX_DATA_DIR/server-data/`；访问 URL 仍为 `/data/` 和 `/assets/uploads/`
- **本地运行**：`node server/server.js`，前台 http://localhost:3000/ ，后台 http://localhost:3000/admin/
- 注意：Vercel 纯静态部署不含该 Node 服务，后台管理仅在使用 Docker/自有服务器部署时可用
- **在线留言**：需要在后台站点设置中填写有效的 Formspree 表单 ID；未配置时三种语言均提示电话或邮箱联系，仅发送成功后跳转成功页。
- **本地手动备份**：`node server/backup.js`；单独运行定时任务：`node server/backup.js --schedule`。直接用 Node 运行时可通过环境变量指定目录，或使用 `node --env-file=.env ...`（Node 20.6+）加载配置。
- **生产部署与日常维护（含迁移、备份/恢复、代码更新）详见 [生产环境部署与维护指南.md](生产环境部署与维护指南.md)**

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

**最后更新**：2026-10-10
