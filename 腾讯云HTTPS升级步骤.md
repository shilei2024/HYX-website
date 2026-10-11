# 腾讯云现有 HTTPS 网站人工升级

本指南由人工在服务器执行；本次只调整代码、配置和指导文件，没有连接服务器或执行部署。

发布顺序：**本机修改并提交 → 推送 GitHub → 审核、CI 通过后合入 main → 服务器从 GitHub 获取已发布代码 → 对比、备份、迁移并部署。** 首次迁移使用候选目录；完成数据分离后的日常更新使用原代码目录的 `git pull --ff-only origin main`。

## 0. 根据另一台电脑的配置确定升级方式

2026-10-10 的 [服务器配置对话](https://chatgpt.com/s/cx_6acb9b8c9d848191af23d9d2ee9d34d4) 已确认：

| 项目 | 当时已验证的状态 | 本次升级处理 |
|---|---|---|
| 代码路径 | `/var/www/hyx-website`，全部小写 | 切换后保持此路径 |
| 官网 | `hyx-website` 容器，80/443，nginx 1.29.5 | 保留域名与证书挂载，升级为三个服务 |
| 原挂载 | `site`、`ssl`、`nginx-https.conf`、`logs` 均来自代码目录 | 先复制服务器当前运营内容，使用新版外部目录 |
| 证书 | acme.sh + `dns_tencent` + Let's Encrypt，RSA 2048，覆盖两个域名 | 保留 `/root/.acme.sh`、root cron、证书安装/reload 设置 |
| 已解决的问题 | 大写目录导致旧脚本复制失败；HTTP standalone 续期失败；localhost 健康检查误用 IPv6 | 不再使用旧 Certbot 停站脚本，保留 `127.0.0.1/healthz` |
| 网络 | GitHub clone 曾超时 | 先确认服务器能访问 GitHub；clone/fetch 成功后再进入维护窗口 |
| 尚未确认 | 服务器源代码提交、后台/账号是否存在、当前运营数据 | 必须先检查；不能把另一台电脑的同步状态当作服务器状态 |

升级后运营目录为 `/var/lib/hyx-website`，每日备份为 `/var/backups/hyx-website`（北京时间 03:00，保留 30 天）。证书账户和 root cron 属于宿主机配置，运营数据归档不包含它们，因此另外备份。

## 1. 先在本机将代码发布到 GitHub

本机在 `D:\cursor-project\hyx-website` 修改、审核并提交需要发布的代码。下面以部署文档修改为例，功能更新时将 `git add` 的列表改为实际代码文件；发布分支名称使用尚未存在的新名称。每条命令成功后再继续，失败时先处理错误。

```powershell
cd D:\cursor-project\hyx-website
git status --short
git diff
git switch -c codex/release-update
git add -- README.md "腾讯云HTTPS升级步骤.md" "部署指南.md" "生产环境部署与维护指南.md" "日常更新.md"
git diff --cached --stat
git diff --cached --check
git commit -m "docs: update server deployment workflow"
git push -u origin codex/release-update
```

在 [GitHub 仓库](https://github.com/shilei2024/HYX-website) 为发布分支创建 PR，审核并等待 CI 通过后合入 `main`。确认合并后 `main` 的 CI 也通过，记录其 **40 位提交号**，供第 3 节校验部署版本。服务器只部署已合入 `main` 的版本。

本机已有未提交的品牌 JSON 属于本机运营内容，不纳入本次代码发布。上传图片、账号、`.env`、证书和 DNS 凭据也不提交；服务器运营数据以线上实际文件为准。

## 2. 服务器只读核对

通过你现有的 SSH 方式登录。以下命令都在同一个 root Bash 会话执行，避免 ubuntu 用户的 Docker 权限问题：

```bash
sudo -i
bash
set -euo pipefail
# 代码和公开内容需要 nginx 工作进程可读；私密目录/文件另行设置 700/600。
umask 022
APP_DIR=/var/www/hyx-website
NEXT_DIR=/var/www/hyx-website-next
DATA_DIR=/var/lib/hyx-website
BACKUP_DIR=/var/backups/hyx-website
UPGRADE_BACKUP_DIR=/var/backups/hyx-website-upgrade
UPGRADE_STAMP=$(date +%Y%m%d-%H%M%S)
PREVIOUS_DIR="${APP_DIR}.previous-${UPGRADE_STAMP}"
cd "$APP_DIR"
pwd
docker version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect hyx-website --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
docker inspect hyx-website --format '{{index .Config.Labels "com.docker.compose.project"}}'
docker exec hyx-website nginx -v
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git log -1 --oneline
  git status --short
  git remote -v
fi
if docker inspect hyx-admin >/dev/null 2>&1; then
  docker inspect hyx-admin --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
fi
pgrep -af '[n]ode.*server|[d]ocker compose watch' || true
grep -nE 'server_name|ssl_certificate' nginx-https.conf
openssl x509 -in ssl/fullchain.pem -noout -dates -issuer -ext subjectAltName
crontab -l
systemctl is-enabled certbot.timer || true
systemctl is-active certbot.timer || true
test -x /root/.acme.sh/acme.sh
find "$APP_DIR/server-data" "$APP_DIR/server/data" -maxdepth 1 -name users.json -print 2>/dev/null || true
if [ -e "$DATA_DIR" ]; then ls -ld "$DATA_DIR" "$DATA_DIR"/*; fi
df -h /var/www /var/lib /var/backups
```

此处有三个检查点：

1. 官网挂载应与第 0 节一致，域名仍为 `hyic-tech.com` 和 `www.hyic-tech.com`。若后台、内容或上传目录另有挂载，下面复制源要改成这些实际路径。
2. 如果已经存在已使用的外部数据目录或 `.initialized.json`，不要执行第 5 节首次迁移；先备份并沿用实际 `HYX_DATA_DIR`，按 [生产维护指南](生产环境部署与维护指南.md) 的代码更新流程操作。
3. 本流程按原 Compose 项目名 `hyx-website` 执行。若检查到其他项目名，应将下文 `-p hyx-website` 全部改为原项目名，保持容器归属一致；若容器并非由 Compose 管理，先调整切换和回退步骤再执行。

**任何检查或命令失败都先停止处理，不要继续后面的切换。** `set -euo pipefail` 会让本次 Bash 在未处理错误时退出。重新进入 Bash 后须恢复变量和检查状态。

## 3. 服务器从 GitHub 获取代码、对比并提前构建

先将第 1 节记录的 GitHub `main` 提交号粘贴到提示中，再克隆候选代码目录。旧官网此时继续运行：

```bash
read -r -p '请输入 GitHub main 已通过 CI 的 40 位提交号: ' EXPECTED_COMMIT
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]]
test ! -e "$NEXT_DIR"
test ! -e "$PREVIOUS_DIR"
git clone --branch main --single-branch https://github.com/shilei2024/HYX-website.git "$NEXT_DIR"
git -C "$NEXT_DIR" fetch origin main
test "$(git -C "$NEXT_DIR" rev-parse origin/main)" = "$EXPECTED_COMMIT"
test "$(git -C "$NEXT_DIR" rev-parse HEAD)" = "$EXPECTED_COMMIT"
git -C "$NEXT_DIR" remote -v
git -C "$NEXT_DIR" log -1 --oneline
git -C "$NEXT_DIR" ls-files --error-unmatch server/storage.js server/backup.js
```

若 GitHub 连接超时，先解决服务器到 GitHub 的网络连通性，成功获取代码前不暂停旧站。若提交号检查失败，说明远端版本与预期不同，先在 GitHub 核对 `main` 和 CI 状态；不跳过版本校验继续部署。clone 失败后可能留下候选目录，重试前检查并另选未使用的候选目录。[Git clone 官方说明](https://git-scm.com/docs/git-clone)

若旧目录有 Git 元数据，从 GitHub 获取 `main` 并比较原提交与本次发布版本：

```bash
if git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$APP_DIR" fetch https://github.com/shilei2024/HYX-website.git main
  test "$(git -C "$APP_DIR" rev-parse FETCH_HEAD)" = "$EXPECTED_COMMIT"
  git -C "$APP_DIR" log --left-right --oneline HEAD...FETCH_HEAD
  git -C "$APP_DIR" diff --name-status HEAD FETCH_HEAD
  git -C "$APP_DIR" status --short
fi
if diff -u "$APP_DIR/nginx-https.conf" "$NEXT_DIR/nginx-https.conf"; then
  :
else
  test "$?" -eq 1
fi
```

`git diff HEAD FETCH_HEAD` 展示已提交代码差异，`git status` 展示旧站未提交改动；运营 JSON 的差异不是应当还原的错误。不要 reset、restore 或用本机 JSON 覆盖服务器内容。旧目录没有 Git 元数据时，仍可使用 GitHub 克隆的候选目录部署，并保留原目录用于数据迁移和回退。

复制现有证书及部署参数到候选目录：

```bash
cp -a "$APP_DIR/ssl" "$NEXT_DIR/ssl"
if [ -f "$APP_DIR/.env" ]; then
  cp -a "$APP_DIR/.env" "$NEXT_DIR/.env"
else
  cp "$NEXT_DIR/.env.example" "$NEXT_DIR/.env"
fi
chmod 600 "$NEXT_DIR/.env"
nano "$NEXT_DIR/.env"
```

在 `.env` 中确认下面参数；已有同名项直接修改，避免重复：

```dotenv
HYX_DATA_DIR=/var/lib/hyx-website
HYX_BACKUP_DIR=/var/backups/hyx-website
TZ=Asia/Shanghai
BACKUP_TIME=03:00
BACKUP_KEEP_DAYS=30
ADMIN_USER=admin
ADMIN_PASSWORD=replace-with-strong-password
```

**必须将密码占位值改成至少 12 位的正式密码。** 对话只展示了官网容器，不能假定存在旧账号。若第 5 节迁移了有效旧账号，新环境变量不会改掉原密码；若没有旧账号，这个密码用于首次创建账号。密码只在服务器编辑，不发到聊天或提交 Git。包含 `$`、`#` 等字符时按 Compose `.env` 规则使用单引号包裹；可以选用随机字母数字密码避免解析歧义。

对比 nginx 配置后，只合并必要的现网定制：域名和证书路径保持原值，保留新版 `/data/`、`/assets/uploads/`、`/api/` 和 `/healthz`。不要整份复制旧配置覆盖新版。

```bash
cd "$NEXT_DIR"
docker compose -p hyx-website -f docker-compose-https.yml config --quiet
CONFIG_DATA_DIR=$(docker compose -p hyx-website -f docker-compose-https.yml config --environment | sed -n 's/^HYX_DATA_DIR=//p')
CONFIG_BACKUP_DIR=$(docker compose -p hyx-website -f docker-compose-https.yml config --environment | sed -n 's/^HYX_BACKUP_DIR=//p')
printf 'Compose 数据目录：%s\nCompose 备份目录：%s\n' "$CONFIG_DATA_DIR" "$CONFIG_BACKUP_DIR"
test "$CONFIG_DATA_DIR" = "$DATA_DIR"
test "$CONFIG_BACKUP_DIR" = "$BACKUP_DIR"
docker compose -p hyx-website -f docker-compose-https.yml pull hyx-admin hyx-backup
docker compose -p hyx-website -f docker-compose-https.yml build --pull hyx-website
```

配置输出的两个目录必须与迁移目标一致，否则先修正候选 `.env` 和 shell 中的同名环境变量，再继续。`DATA_DIR`/`BACKUP_DIR` 是本指南的 shell 变量，Compose 实际使用的是 `HYX_DATA_DIR`/`HYX_BACKUP_DIR`；只设置前者不会改变容器挂载。shell 中已导出的同名变量优先于 `.env`。[Docker 变量优先级](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

所有镜像拉取和构建成功后再进入维护窗口；失败时旧站仍正常运行，先解决镜像下载问题。不要为了绕过下载失败改回旧 Node 版本。上面的配置命令只显示数据路径，不打印解析后的密码。

## 4. 暂停编辑，备份旧站和证书账户

维护期间暂停后台保存及上传。旧站如有 Watch，应先停用：

```bash
if systemctl cat hyx-watch.service >/dev/null 2>&1; then
  systemctl disable --now hyx-watch.service
fi
pgrep -af '[d]ocker compose watch|[n]ode.*server' || true
if docker inspect hyx-admin >/dev/null 2>&1; then
  docker stop hyx-admin
fi
```

没有 `hyx-admin` 是可接受的旧版状态。若上面发现另有本项目宿主机后台或手动 Watch，先按实际服务方式停止它；不要停止其他项目的 Node 进程。此时旧官网继续提供页面。

```bash
install -d -m 700 "$UPGRADE_BACKUP_DIR"
SNAPSHOT="$UPGRADE_BACKUP_DIR/before-upgrade-${UPGRADE_STAMP}.tar.gz"
ACME_SNAPSHOT="$UPGRADE_BACKUP_DIR/acme-account-${UPGRADE_STAMP}.tar.gz"
CRON_SNAPSHOT="$UPGRADE_BACKUP_DIR/root-crontab-${UPGRADE_STAMP}.txt"
tar --exclude='./logs' --exclude='./watch.log' -czf "$SNAPSHOT" -C "$APP_DIR" .
tar -czf "$ACME_SNAPSHOT" -C /root .acme.sh
crontab -l > "$CRON_SNAPSHOT"
chmod 600 "$SNAPSHOT" "$ACME_SNAPSHOT" "$CRON_SNAPSHOT"
tar -tzf "$SNAPSHOT" >/dev/null
tar -tzf "$ACME_SNAPSHOT" >/dev/null
```

这两份归档含账号、私钥或 DNS 凭据，仅保存在私密备份目录，不能上传到代码仓库。若备份失败，先恢复旧后台（如有），停止升级。

## 5. 首次迁移服务器运营文件

下文只适用于第 2 节确认的旧版默认目录及尚未使用的 `DATA_DIR`。若有外部挂载，先把复制源改成真实目录；如果已有外部运营数据，沿用原数据，不执行此处复制。

```bash
test ! -e "$DATA_DIR"
OLD_CONTENT_DIR="$APP_DIR/site/data"
OLD_UPLOADS_DIR="$APP_DIR/site/assets/uploads"
OLD_USERS_DIR=""
for candidate in "$APP_DIR/server-data" "$APP_DIR/server/data"; do
  if [ -f "$candidate/users.json" ]; then
    if [ -n "$OLD_USERS_DIR" ]; then
      cmp "$OLD_USERS_DIR/users.json" "$candidate/users.json"
    else
      OLD_USERS_DIR="$candidate"
    fi
  fi
done
test -d "$OLD_CONTENT_DIR"
install -d -m 755 "$DATA_DIR" "$DATA_DIR/content" "$DATA_DIR/uploads"
install -d -m 700 "$DATA_DIR/server-data" "$BACKUP_DIR"
cp -a "$OLD_CONTENT_DIR/." "$DATA_DIR/content/"
if [ -d "$OLD_UPLOADS_DIR" ]; then
  cp -a "$OLD_UPLOADS_DIR/." "$DATA_DIR/uploads/"
fi
if [ -n "$OLD_USERS_DIR" ]; then
  cp -a "$OLD_USERS_DIR/." "$DATA_DIR/server-data/"
fi
chmod 700 "$DATA_DIR/server-data"
diff -qr "$OLD_CONTENT_DIR" "$DATA_DIR/content"
if [ -d "$OLD_UPLOADS_DIR" ]; then
  diff -qr "$OLD_UPLOADS_DIR" "$DATA_DIR/uploads"
fi
if [ -n "$OLD_USERS_DIR" ]; then
  cmp "$OLD_USERS_DIR/users.json" "$DATA_DIR/server-data/users.json"
fi
cd "$NEXT_DIR"
docker compose -p hyx-website -f docker-compose-https.yml run --rm --no-deps hyx-admin node /srv/app/server/storage.js
test -f "$DATA_DIR/.initialized.json"
```

若两处旧账号文件同时存在且不同，`cmp` 会停止本流程；以旧后台实际挂载为准核对，不能猜测覆盖。旧后台另有历史快照路径时也要迁移至 `server-data/`。没有旧账号文件时，新版首次启动创建正式账号。

`storage.js` 只补齐缺失的初始文件并验证 JSON，不覆盖已复制的服务器内容；任何迁移/校验错误均需修复后再切换。原目录和原文件仍保留。

## 6. 切换代码，保留现有 DNS 续期

先检查 `date`、root cron 和 acme.sh 进程，选择避开续期任务运行的维护时间。cron 的时间以服务器时区为准；对话中的任务是每天 01:20、07:20、13:20、19:20 检查。切换前刷新候选证书副本，缩短已登记安装路径暂时不可用的间隙：

```bash
date
crontab -l
pgrep -af '[a]cme.sh' || true
```

如果 acme.sh 正在签发/安装，等它完成再继续，保留原定时任务。

```bash
cp -a "$APP_DIR/ssl/." "$NEXT_DIR/ssl/"
openssl x509 -in "$NEXT_DIR/ssl/fullchain.pem" -noout -checkend 86400
chmod 600 "$NEXT_DIR/ssl/privkey.pem"
chmod 644 "$NEXT_DIR/ssl/fullchain.pem"
cd "$APP_DIR"
docker compose -p hyx-website -f docker-compose-https.yml down
cd /var/www
mv "$APP_DIR" "$PREVIOUS_DIR"
mv "$NEXT_DIR" "$APP_DIR"
cd "$APP_DIR"
docker compose -p hyx-website -f docker-compose-https.yml up -d --force-recreate --wait --wait-timeout 180
/root/.acme.sh/acme.sh --install-cert -d hyic-tech.com \
  --key-file /var/www/hyx-website/ssl/privkey.pem \
  --fullchain-file /var/www/hyx-website/ssl/fullchain.pem \
  --reloadcmd '/usr/bin/docker exec hyx-website nginx -t && /usr/bin/docker exec hyx-website nginx -s reload'
crontab -l > "$UPGRADE_BACKUP_DIR/root-crontab-after-${UPGRADE_STAMP}.txt"
cmp "$CRON_SNAPSHOT" "$UPGRADE_BACKUP_DIR/root-crontab-after-${UPGRADE_STAMP}.txt"
```

此处有短暂停机。三个服务使用提前准备好的镜像，证书命令只安装已有 RSA 证书并登记原路径/reload，不重新签发、不读取旧 Certbot 副本。不要恢复旧 `renew-ssl.sh` 定时任务或启用 `certbot.timer`。acme.sh 仍位于仓库之外。

## 7. 验收后恢复后台编辑

```bash
cd "$APP_DIR"
test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"
docker compose -p hyx-website -f docker-compose-https.yml ps
docker inspect hyx-website hyx-admin hyx-backup --format '{{println .Name}}{{range .Mounts}}{{println .Type .Source "->" .Destination}}{{end}}'
ACTUAL_DATA_DIR=$(docker inspect hyx-admin --format '{{range .Mounts}}{{if eq .Destination "/srv/persistent"}}{{.Source}}{{end}}{{end}}')
ACTUAL_BACKUP_DATA_DIR=$(docker inspect hyx-backup --format '{{range .Mounts}}{{if eq .Destination "/srv/persistent"}}{{.Source}}{{end}}{{end}}')
ACTUAL_BACKUP_DIR=$(docker inspect hyx-backup --format '{{range .Mounts}}{{if eq .Destination "/srv/backups"}}{{.Source}}{{end}}{{end}}')
ACTUAL_CONTENT_DIR=$(docker inspect hyx-website --format '{{range .Mounts}}{{if eq .Destination "/srv/content"}}{{.Source}}{{end}}{{end}}')
ACTUAL_UPLOADS_DIR=$(docker inspect hyx-website --format '{{range .Mounts}}{{if eq .Destination "/srv/uploads"}}{{.Source}}{{end}}{{end}}')
printf '后台实际数据：%s\n备份实际数据：%s\n实际备份目录：%s\n' "$ACTUAL_DATA_DIR" "$ACTUAL_BACKUP_DATA_DIR" "$ACTUAL_BACKUP_DIR"
test "$ACTUAL_DATA_DIR" = "$DATA_DIR"
test "$ACTUAL_BACKUP_DATA_DIR" = "$DATA_DIR"
test "$ACTUAL_BACKUP_DIR" = "$BACKUP_DIR"
test "$ACTUAL_CONTENT_DIR" = "$DATA_DIR/content"
test "$ACTUAL_UPLOADS_DIR" = "$DATA_DIR/uploads"
docker compose -p hyx-website -f docker-compose-https.yml logs --tail 50 hyx-admin hyx-backup
docker exec hyx-website nginx -t
docker exec hyx-website wget -qO- http://127.0.0.1/healthz
docker exec hyx-admin wget -qO- http://127.0.0.1:3000/api/health
curl -fsSI https://hyic-tech.com/
curl -fsSI https://www.hyic-tech.com/
curl -fsS https://hyic-tech.com/api/health
curl -fsSI https://hyic-tech.com/data/news.json
openssl s_client -connect hyic-tech.com:443 -servername hyic-tech.com </dev/null 2>/dev/null |
  openssl x509 -noout -dates -issuer -ext subjectAltName
docker exec hyx-backup node /srv/app/server/backup.js
docker exec hyx-backup node /srv/app/server/backup.js --health
ARCHIVE=$(docker exec hyx-backup node -p 'JSON.parse(require("fs").readFileSync("/srv/backups/last-success.json","utf8")).archive')
tar -tzf "$ACTUAL_BACKUP_DIR/$ARCHIVE" >/dev/null
cat "$ACTUAL_BACKUP_DIR/last-success.json"
```

预期三个容器均 healthy，TLS 正常校验，SAN 包含两个域名，内容响应有 `Cache-Control: no-store`，全量备份可读。磁盘证书与公网证书有效期应一致。

挂载检查不一致时，先按第 10 节核对，不能直接把 shell 的 `BACKUP_DIR` 改成实际值后跳过数据验收：后台可能同样读取了另一份初始内容。只有确认实际数据就是迁移目标，才能继续验收。

浏览器打开 `https://hyic-tech.com/admin/`，核对原新闻、品牌和上传图片。迁移了旧账号就用原密码；没有旧账号则用服务器 `.env` 中设定的新账号。确认数据齐全后恢复编辑，可以保存一项可恢复的测试内容并上传测试图片，刷新前台检查，再在后台清理测试内容。

`hyx-backup` 已随 Compose 配置每日北京时间 03:00 自动备份，保留 30 天，无需额外 crontab。宿主机的 acme.sh cron 继续负责证书续期，两者分别检查。新代码更新和容器重建后，内容、图片和账号仍来自相同外部目录。

## 8. 失败回退

若尚未恢复后台编辑、外部数据仍与迁移前一致，按下面恢复原代码。变量仍来自同一 Bash 会话；若已退出，用第 4 节记录的时间戳定位实际旧目录，不能重新生成时间戳来猜路径。

```bash
test -d "$PREVIOUS_DIR"
FAILED_DIR="${APP_DIR}.failed-${UPGRADE_STAMP}"
test ! -e "$FAILED_DIR"
cd "$APP_DIR"
docker compose -p hyx-website -f docker-compose-https.yml down
cp -a "$APP_DIR/ssl/." "$PREVIOUS_DIR/ssl/"
cd /var/www
mv "$APP_DIR" "$FAILED_DIR"
mv "$PREVIOUS_DIR" "$APP_DIR"
cd "$APP_DIR"
docker compose -p hyx-website -f docker-compose-https.yml up -d
/root/.acme.sh/acme.sh --install-cert -d hyic-tech.com \
  --key-file /var/www/hyx-website/ssl/privkey.pem \
  --fullchain-file /var/www/hyx-website/ssl/fullchain.pem \
  --reloadcmd '/usr/bin/docker exec hyx-website nginx -t && /usr/bin/docker exec hyx-website nginx -s reload'
curl -fsSI https://hyic-tech.com/
```

保留失败目录、外部数据和升级归档。如果新版已经产生内容、图片或密码修改，回退前先备份最新外部数据，并将最新内容复制到旧后台实际使用的目录；不要拿升级前快照覆盖新产生的数据。

验收稳定后再安排归档旧代码。后续正常更新见 [生产环境部署与维护指南.md](生产环境部署与维护指南.md)，证书检查见 [HTTPS配置指南.md](HTTPS配置指南.md)。

## 9. 完成首次迁移后的日常 GitHub 更新

每次先在本机按第 1 节提交、推送并合入 GitHub `main`，确认 CI 通过。服务器已经使用外部运营目录、工作区没有需要保留的代码改动时，在 root Bash 中执行：

```bash
set -euo pipefail
cd /var/www/hyx-website
test "$(git branch --show-current)" = main
test "$(git remote get-url origin)" = https://github.com/shilei2024/HYX-website.git
test -z "$(git status --porcelain)"
read -r -p '请输入本次 GitHub main 已通过 CI 的 40 位提交号: ' EXPECTED_COMMIT
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]]
git fetch origin main
test "$(git rev-parse origin/main)" = "$EXPECTED_COMMIT"
git log --left-right --oneline HEAD...origin/main
git diff --stat HEAD origin/main
```

查看差异并确认本次发布版本后，先做运营全量备份，再从 GitHub 更新代码并重建服务：

```bash
docker compose -p hyx-website -f docker-compose-https.yml exec -T hyx-backup node /srv/app/server/backup.js
git pull --ff-only origin main
test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"
docker compose -p hyx-website -f docker-compose-https.yml config --quiet
docker compose -p hyx-website -f docker-compose-https.yml up -d --build --force-recreate --wait --wait-timeout 180
docker compose -p hyx-website -f docker-compose-https.yml ps
curl -fsS https://hyic-tech.com/api/health
curl -fsSI https://hyic-tech.com/
```

上述检查拒绝未处理的工作区改动和不一致的发布版本。证书、`.env` 和外部运营数据继续沿用；后续涉及部署参数、nginx 定制或更复杂变更时，先备份配置并使用第 3～8 节的候选目录切换流程。`git pull --ff-only` 无法快进时先核对分支差异，不强制重置服务器代码。[Git pull 官方说明](https://git-scm.com/docs/git-pull)

## 10. 容器内有备份、宿主机预期目录却找不到

这通常表示 shell 中 `BACKUP_DIR` 与实际挂载路径不同。默认 Compose 路径是 `../hyx-website-data` 和 `../hyx-website-backups`；部署在 `/var/www/hyx-website` 时，它们对应 `/var/www/hyx-website-data` 和 `/var/www/hyx-website-backups`。先按实际容器挂载定位，不创建空目录来掩盖错误。

以下是只读检查。**一次只复制一个命令块**，不要把多条命令拼到同一行：

```bash
docker inspect hyx-backup hyx-admin --format '{{println .Name}}{{range .Mounts}}{{println .Type .Source "->" .Destination}}{{end}}'
```

```bash
grep -nE '^[[:space:]]*(HYX_DATA_DIR|HYX_BACKUP_DIR|BACKUP_TIME|BACKUP_KEEP_DAYS)=' /var/www/hyx-website/.env
```

```bash
docker exec hyx-backup cat /srv/backups/last-success.json
```

```bash
docker exec hyx-backup node /srv/app/server/backup.js --health
```

若后台数据路径也不一致，先暂停编辑，对比两份数据：

```bash
diff -qr /var/lib/hyx-website /var/www/hyx-website-data || true
```

这只报告差异文件，不显示账号内容。运行目录中的新闻/品牌与迁移目标不同时，先确认升级后是否有保存、上传或改密；已经产生新修改时必须先备份并逐项保留，不能直接覆盖。

如果迁移目标已经存在、升级后尚未进行后台操作：保留迁移目标里的原运营 JSON，将当前目录中缺失的账号/图片补到迁移目标，保留两处原始目录和归档。修改服务器 `.env` 的两个 HYX 路径为预期绝对路径，保持原账号密码配置；清除 shell 同名路径变量的覆盖或为 Compose 命令显式指定它们，再运行 storage.js 补齐缺失的初始文件并验证数据。重建三个服务后重新检查实际挂载，并手动备份新的正确数据目录。

操作前停止后台和备份，制作权限受限的归档，包含两份数据、已有备份和 `.env`。补齐账号/图片时使用不覆盖已有文件的复制；两处已有账号不同则先核对，不猜测替换。调整挂载不需要修改 acme.sh、root 证书 cron 或重新签发证书。
