# 腾讯云现有 HTTPS 网站升级步骤

现有目录：`/var/www/hyx-websit`。路径按用户提供的拼写保留，没有末尾 e。

本文件是升级方案，尚未在腾讯云执行。迁移前应在旧后台把开发默认密码改成正式密码。适用于原版 Docker HTTPS 配置；如果服务器实际使用了宝塔、宿主机 nginx 或自定义 Compose，先核对挂载与服务方式再调整命令。

## 0. 确认新版已合入 main

本次持久化与备份版本通过代码审核、CI 后合入 main。升级前先 git fetch，再确认 main 含 server/storage.js、server/backup.js 和新版 Compose。不要以本地运营 JSON 覆盖线上数据。

## 1. 在服务器核对当前版本与改动（只读）

登录腾讯云后：

```bash
cd /var/www/hyx-websit
git fetch origin
git branch --show-current
git log -1 --oneline
git status --short
git log --left-right --oneline HEAD...origin/main
git diff --name-status origin/main
git diff -- nginx-https.conf docker-compose-https.yml
docker compose -f docker-compose-https.yml ps
docker inspect hyx-admin --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
grep -nE 'server_name|ssl_certificate' nginx-https.conf
```

JSON 的本地修改可能是线上运营内容，不要 restore/reset 还原。确认后台实际挂载的内容目录、上传图片目录和账号目录，域名/证书参数是否经过线上定制。如果不是项目默认挂载，下文复制源也要改成检查到的实际目录。

## 2. 在临时目录准备新代码，保留线上配置

建议先在新目录准备，避免服务器工作区修改与 git pull 冲突。以下步骤在同一个 SSH 会话执行，sudo 需要当前账号的正常权限：

```bash
APP_DIR=/var/www/hyx-websit
NEXT_DIR=/var/www/hyx-websit-next
DATA_DIR=/var/lib/hyx-website
BACKUP_DIR=/var/backups/hyx-website
UPGRADE_BACKUP_DIR=/var/backups/hyx-website-upgrade
UPGRADE_STAMP=$(date +%Y%m%d-%H%M%S)
PREVIOUS_DIR="${APP_DIR}.previous-${UPGRADE_STAMP}"

sudo git clone --branch main https://github.com/shilei2024/HYX-website.git "$NEXT_DIR"
sudo git -C "$NEXT_DIR" ls-files --error-unmatch server/storage.js server/backup.js
```

clone 目录已经存在时不要覆盖，先检查其用途。第二条检查失败说明新版尚未发布，先停止升级，此时旧站没有改变。

将证书复制到候选目录，保留原证书；创建候选配置：

```bash
sudo cp -a "$APP_DIR/ssl" "$NEXT_DIR/ssl"
sudo cp "$NEXT_DIR/.env.example" "$NEXT_DIR/.env"
sudo chmod 600 "$NEXT_DIR/.env"
sudo diff -u "$APP_DIR/nginx-https.conf" "$NEXT_DIR/nginx-https.conf"
```

diff 有差异时通常返回 1，正常查看即可。编辑候选的 nginx-https.conf，保留线上实际 server_name、ssl_certificate、ssl_certificate_key 及其他必要定制，同时保留新版 /data/ 与 /assets/uploads/ 的 alias。**不要直接用旧配置覆盖新版，也不要用默认域名覆盖现网域名。**

候选 .env 指定：

```dotenv
HYX_DATA_DIR=/var/lib/hyx-website
HYX_BACKUP_DIR=/var/backups/hyx-website
TZ=Asia/Shanghai
BACKUP_TIME=03:00
BACKUP_KEEP_DAYS=30
```

原账号将复制到外部目录，初始密码变量不会覆盖已存在账号。保留其他实际使用的部署参数。检查 DATA_DIR、BACKUP_DIR 是否已被其他部署使用；此流程要求 DATA_DIR 是尚未使用的新目录，已有运营数据时不要继续覆盖复制。

提前检查配置并构建镜像，可缩短停机时间：

```bash
cd "$NEXT_DIR"
sudo docker compose -f docker-compose-https.yml config --quiet
sudo docker compose -f docker-compose-https.yml build
```

## 3. 暂停后台编辑，备份并迁移线上数据

在维护窗口操作，验收完成前不要继续后台编辑。若安装过旧 hyx-watch.service，先停用它，避免迁移期间还在同步：

```bash
if systemctl cat hyx-watch.service >/dev/null 2>&1; then
  sudo systemctl disable --now hyx-watch.service
fi
pgrep -af '[d]ocker compose watch'
```

若另有手动启动的 Watch 进程，核对上面显示的 PID 与项目后停止该进程，不要继续带着旧 Watch 切换目录。

暂停旧后台，前台此时仍可读：

```bash
cd "$APP_DIR"
sudo docker compose -f docker-compose-https.yml stop hyx-admin
```

全量备份旧目录，包括代码、运营内容、上传图片、账号、证书与部署配置。备份目录在网站之外：

```bash
sudo install -d -m 700 "$UPGRADE_BACKUP_DIR"
SNAPSHOT="$UPGRADE_BACKUP_DIR/before-upgrade-${UPGRADE_STAMP}.tar.gz"
sudo tar --exclude='./logs' --exclude='./watch.log' -czf "$SNAPSHOT" -C "$APP_DIR" .
sudo chmod 600 "$SNAPSHOT"
sudo tar -tzf "$SNAPSHOT" >/dev/null
```

仅在备份和校验均成功后继续；否则恢复旧 hyx-admin，先解决备份问题。

对未使用过的外部目录复制运营文件，原文件不删除：

```bash
(
set -e
sudo test ! -e "$DATA_DIR"
sudo install -d "$DATA_DIR/content" "$DATA_DIR/uploads" "$DATA_DIR/server-data"
sudo cp -a "$APP_DIR/site/data/." "$DATA_DIR/content/"
if [ -d "$APP_DIR/site/assets/uploads" ]; then
  sudo cp -a "$APP_DIR/site/assets/uploads/." "$DATA_DIR/uploads/"
fi
if [ -d "$APP_DIR/server-data" ]; then
  sudo cp -a "$APP_DIR/server-data/." "$DATA_DIR/server-data/"
fi
if [ -d "$APP_DIR/server/data" ]; then
  sudo cp -an "$APP_DIR/server/data/." "$DATA_DIR/server-data/"
fi
sudo chmod 700 "$DATA_DIR/server-data"
)
```

这个复制步骤在子 shell 内启用遇错停止。目录检查或任何复制失败时，必须停止并核对，不能进入下一步切换。逐项确认 content/ 与原 site/data/、uploads/ 与原上传目录一致；原后台存在持久化账号时，核对外部 users.json 与旧账号文件一致。不要将本机 D 盘的运营目录拷过来覆盖线上内容。

## 4. 切换代码目录并启动新版 HTTPS

仍在同一会话，保留旧目录作回退：

```bash
cd "$APP_DIR"
sudo docker compose -f docker-compose-https.yml down
cd /var/www
sudo mv "$APP_DIR" "$PREVIOUS_DIR"
sudo mv "$NEXT_DIR" "$APP_DIR"
cd "$APP_DIR"
sudo docker compose -f docker-compose-https.yml up -d --build --force-recreate --wait --wait-timeout 180
```

有短暂网站停机。切换前确认目标目录名称不冲突。新版启动会使用已复制的外部内容/账号，并生成迁移标记；之后更新代码不会覆盖外部运营内容。

## 5. 验证之后再放开编辑

```bash
sudo docker compose -f docker-compose-https.yml ps
sudo docker compose -f docker-compose-https.yml logs --tail 50 hyx-admin hyx-backup
sudo docker compose -f docker-compose-https.yml exec -T hyx-website nginx -t
sudo docker compose -f docker-compose-https.yml exec -T hyx-admin wget -qO- http://localhost:3000/api/health
sudo docker compose -f docker-compose-https.yml exec -T hyx-backup node /srv/app/server/backup.js
sudo cat "$BACKUP_DIR/last-success.json"
```

另外使用实际域名验证 HTTPS 首页、/admin/、/api/health、/data/news.json，确认 JSON 返回 Cache-Control: no-store、旧上传图片可访问、原账号可以登录。验收期间先做只读检查。

首份手动备份成功后，每日北京时间 03:00 的自动任务已配置，保留最近 30 天。备份打包 content、uploads、账号、旧 JSON 及迁移标记。若当天已经成功手动备份，定时服务不会再重复当天任务。

## 6. 失败回退

如果尚未恢复后台编辑、外部数据还与迁移前一致，可停止新容器，把当前代码目录另存为失败版本，再把 PREVIOUS_DIR 恢复为 /var/www/hyx-websit，用原 HTTPS Compose 启动。不要删除外部数据或升级前的归档。

如果新版上线后已经有内容或密码修改，回退前先将最新外部 content/、uploads/、server-data/ 复制回旧版实际使用的目录，确保新产生的内容和账号不会丢失；不应直接恢复旧快照覆盖最新运营内容。

本次没有连接服务器，也没有执行停机、迁移或切换。实际执行前必须先确认服务器检查结果。
