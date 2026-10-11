# HTTPS 配置与证书维护

本文以现有腾讯云网站为准：`/var/www/hyx-website`，域名 `hyic-tech.com` 和 `www.hyic-tech.com`。代码升级流程见 [腾讯云HTTPS升级步骤.md](腾讯云HTTPS升级步骤.md)。

## 已完成的服务器配置

根据 2026-10-10 的 [服务器配置对话](https://chatgpt.com/s/cx_6acb9b8c9d848191af23d9d2ee9d34d4)：

- acme.sh 安装在 `/root/.acme.sh`，使用 Let's Encrypt、腾讯云 DNS API `dns_tencent`、RSA 2048。
- 已签发覆盖两个域名的证书，当时验证的到期时间为 **2027-01-08 06:52:55 UTC**。实际有效期以服务器检查为准。
- 安装文件是 `/var/www/hyx-website/ssl/fullchain.pem` 和 `privkey.pem`，Docker 挂载至 `/etc/nginx/ssl`。
- 已登记 nginx 配置检查及 reload 命令；root cron 每天执行四次 acme.sh 到期检查，只有符合续期条件才签发。
- 已删除旧 `renew-ssl.sh` 定时任务，`certbot.timer` 已停用。

原 HTTP standalone 续期的外部验证失败。现网继续使用已成功的 DNS 验证方案；代码升级不需要重新申请证书、重新输入 DNS 密钥或停止 nginx 来续期。

## 升级时保留的文件

| 文件/目录 | 用途 |
|---|---|
| `/root/.acme.sh/` | CA 账户、域名配置、DNS 凭据和签发文件，属于宿主机持久化配置 |
| root crontab | 自动运行 acme.sh；保持已有任务和其他任务 |
| `/var/www/hyx-website/ssl/` | nginx 使用的安装副本；代码目录切换后仍须保持这个绝对路径 |
| `/var/www/hyx-website/.env` | 本机部署参数，权限 600，不进入 Git |

acme.sh 内部目录与 nginx 安装目录有不同用途。nginx 使用 `--install-cert` 安装的副本，续期后 acme.sh 自动更新该副本并执行已登记的 reload。不要让 nginx 直接指向 acme.sh 内部文件。[acme.sh 官方说明](https://github.com/acmesh-official/acme.sh#3-install-the-cert-to-apachenginx-etc)

## 只读检查

先通过正常 SSH 登录，再进入 root shell；服务器的 ubuntu 用户此前没有 Docker socket 权限：

```bash
sudo -i
cd /var/www/hyx-website
docker inspect hyx-website --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
docker exec hyx-website nginx -t
openssl x509 -in ssl/fullchain.pem -noout -dates -issuer -ext subjectAltName
crontab -l
systemctl is-enabled certbot.timer || true
systemctl is-active certbot.timer || true
test -x /root/.acme.sh/acme.sh
```

检查公网实际提供的证书，区分磁盘文件与 nginx 当前加载的版本：

```bash
openssl s_client -connect hyic-tech.com:443 -servername hyic-tech.com </dev/null 2>/dev/null |
  openssl x509 -noout -dates -issuer -ext subjectAltName
curl -fsSI https://hyic-tech.com/
curl -fsSI https://www.hyic-tech.com/
```

预期证书 SAN 包含两个域名，HTTPS 请求通过正常证书校验。不要通过 `curl -k` 的结果判断 TLS 部署成功。

## 重新安装已有证书及登记 reload

仅在代码切换完成、`hyx-website` 已运行时操作。以下安装现有 RSA 证书，不发起新的 DNS 验证：

```bash
install -d -m 700 /var/www/hyx-website/ssl
chmod 600 /var/www/hyx-website/ssl/privkey.pem
chmod 644 /var/www/hyx-website/ssl/fullchain.pem
/root/.acme.sh/acme.sh --install-cert -d hyic-tech.com \
  --key-file /var/www/hyx-website/ssl/privkey.pem \
  --fullchain-file /var/www/hyx-website/ssl/fullchain.pem \
  --reloadcmd '/usr/bin/docker exec hyx-website nginx -t && /usr/bin/docker exec hyx-website nginx -s reload'
```

应看到安装和 reload 成功；随后重新检查磁盘和公网证书。现网是 RSA 证书，所以此命令不带 `--ecc`。其他主机若使用 ECC 证书，必须按其签发类型调整。

## 自动续期检查

对话最后确认的 root cron 内容如下（时间使用服务器 cron 的时区）：

```text
20 1,7,13,19 * * * "/root/.acme.sh"/acme.sh --cron --home "/root/.acme.sh" > /dev/null
```

升级前后比较 `crontab -l`，保持已有任务即可，无需重复添加。常规手动到期检查：

```bash
/root/.acme.sh/acme.sh --cron --home /root/.acme.sh
```

未到续期时间显示跳过属于正常结果，不能据此证明 DNS 凭据和未来续期一定成功。到期后应查看 acme.sh 日志及公网证书有效期；若 DNS 授权失效，先修复账户/权限，再按照官方说明处理。不要例行使用强制续期反复签发。

## Nginx 配置要求

新配置保留两个域名、相同证书路径、外部运营目录 alias、后台 API 和 `/healthz`。容器健康检查访问 `http://127.0.0.1/healthz`，避免 localhost 解析到 IPv6 或被 HTTP 重定向影响。

现网 nginx 1.29.5 支持独立的 `http2 on;` 指令。新版使用 `listen 443 ssl;` 加 `http2 on;`；该语法要求 nginx 1.25.1 及以上。[nginx 官方说明](https://nginx.org/en/docs/http/ngx_http_v2_module.html#http2)

首次部署到其他服务器时，先按 [acme.sh 安装说明](https://github.com/acmesh-official/acme.sh#1-how-to-install) 和 [DNS API 文档](https://github.com/acmesh-official/acme.sh/wiki/dnsapi#dns_tencent) 为自己的域名完成签发，再登记实际安装路径与 reload 命令。DNS 密钥在服务器私密配置中管理，不能写入本仓库或公开日志。
