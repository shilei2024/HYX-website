# 域名绑定与 HTTPS 配置指南

本文档提供完整的域名绑定和 HTTPS 配置步骤。

## 目录

- [前置条件](#前置条件)
- [步骤一：购买域名](#步骤一购买域名)
- [步骤二：域名解析配置](#步骤二域名解析配置)
- [步骤三：服务器准备](#步骤三服务器准备)
- [步骤四：Docker 部署网站](#步骤四docker-部署网站)
- [步骤五：申请 SSL 证书](#步骤五申请-ssl-证书)
- [步骤六：配置 HTTPS](#步骤六配置-https)
- [步骤七：验证与测试](#步骤七验证与测试)
- [证书自动续期](#证书自动续期)

---

## 前置条件

| 项目 | 要求 |
|------|------|
| 域名 | 已购买，如 `hyic-tech.com` |
| 服务器 | Linux 服务器（Ubuntu 20.04+ 推荐） |
| 公网 IP | 服务器有独立公网 IP |
| 端口 | 80 和 443 端口开放 |

---

## 步骤一：购买域名

### 国内域名注册商

| 注册商 | 网址 | 特点 |
|--------|------|------|
| 阿里云 | https://wanwang.aliyun.com | 国内首选，备案方便 |
| 腾讯云 | https://dnspod.cloud.tencent.com | DNSPod 整合 |
| 华为云 | https://www.huaweicloud.com/product/domain.html | 企业级服务 |

### 域名选择建议

```
推荐格式：
- hyic-tech.com        # 主域名
- www.hyic-tech.com    # www 子域名
```

---

## 步骤二：域名解析配置

### 2.1 登录域名控制台

以阿里云为例：

1. 登录 [阿里云控制台](https://dns.console.aliyun.com)
2. 进入「域名」→「解析设置」
3. 点击「添加记录」

### 2.2 添加解析记录

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | 你的服务器IP | 600 |
| A | www | 你的服务器IP | 600 |

**示例配置：**

```
域名：hyic-tech.com
服务器IP：123.45.67.89

解析记录：
1. A记录 @ → 123.45.67.89（解析 hyic-tech.com）
2. A记录 www → 123.45.67.89（解析 www.hyic-tech.com）
```

### 2.3 验证解析生效

```bash
# 在本地电脑执行
ping hyic-tech.com
ping www.hyic-tech.com

# 应该返回你的服务器 IP
```

---

## 步骤三：服务器准备

### 3.1 安装 Docker

```bash
# Ubuntu 系统安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
apt install docker-compose-plugin -y

# 验证安装
docker --version
docker compose version
```

### 3.2 开放防火墙端口

```bash
# Ubuntu UFW 防火墙
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable

# CentOS firewalld 防火墙
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

### 3.3 云服务器安全组

在云服务商控制台配置安全组规则：

| 方向 | 端口 | 协议 | 来源 |
|------|------|------|------|
| 入站 | 80 | TCP | 0.0.0.0/0 |
| 入站 | 443 | TCP | 0.0.0.0/0 |
| 入站 | 22 | TCP | 你的IP |

---

## 步骤四：Docker 部署网站

### 4.1 上传项目文件

```bash
# 方式一：使用 Git
cd /var/www
git clone <your-repo-url> hyx-website
cd hyx-website

# 方式二：使用 SCP 上传
# 在本地执行
scp -r HYX-website/* user@your-server:/var/www/hyx-website/
```

### 4.2 启动 HTTP 版本

```bash
cd /var/www/hyx-website

# 使用 HTTP 配置启动
docker compose up -d --build

# 验证运行状态
docker ps
```

### 4.3 测试 HTTP 访问

```bash
# 在浏览器访问
http://hyic-tech.com
http://www.hyic-tech.com

# 或使用 curl 测试
curl -I http://hyic-tech.com
```

---

## 步骤五：申请 SSL 证书

### 方式一：Let's Encrypt 免费证书（推荐）

#### 5.1 安装 Certbot

```bash
# Ubuntu/Debian
apt update
apt install certbot -y

# CentOS
yum install certbot -y
```

#### 5.2 申请证书

```bash
# 停止 Docker 容器（释放 80 端口）
docker stop hyx-website

# 申请证书（替换 your-domain.com）
certbot certonly --standalone \
  -d hyic-tech.com \
  -d www.hyic-tech.com \
  --email 879886239@qq.com \
  --agree-tos \
  --no-eff-email

# 证书保存路径
# /etc/letsencrypt/live/hyic-tech.com/fullchain.pem
# /etc/letsencrypt/live/hyic-tech.com/privkey.pem
```

#### 5.3 复制证书到项目目录

```bash
# 创建 SSL 目录
mkdir -p /var/www/hyx-website/ssl

# 复制证书
cp /etc/letsencrypt/live/hyic-tech.com/fullchain.pem /var/www/HYX-website/ssl/
cp /etc/letsencrypt/live/hyic-tech.com/privkey.pem /var/www/HYX-website/ssl/

# 设置权限
chmod 644 /var/www/hyx-website/ssl/*.pem
```

### 方式二：阿里云免费证书

1. 登录 [阿里云 SSL 证书控制台](https://yundun.console.aliyun.com/?p=cas)
2. 点击「免费证书」→「创建证书」
3. 填写域名信息，选择 DNS 验证
4. 按提示添加 TXT 解析记录
5. 等待签发（约 5-10 分钟）
6. 下载 Nginx 格式证书

**下载后文件：**
- `hyic-tech.com.pem`（证书文件）
- `hyic-tech.com.key`（私钥文件）

```bash
# 重命名并复制到项目
mkdir -p /var/www/HYX-website/ssl
cp hyic-tech.com.pem /var/www/HYX-website/ssl/fullchain.pem
cp hyic-tech.com.key /var/www/HYX-website/ssl/privkey.pem
```

---

## 步骤六：配置 HTTPS

### 6.1 使用项目内的 HTTPS 配置

项目已包含 `docker-compose-https.yml`（根目录），用于 80 + **443** 端口及 SSL 证书。请先完成「步骤四」或执行 `./一键部署.sh` 生成 `html/` 目录，并将证书放入 `ssl/`（见步骤五）。

### 6.2 修改 Nginx HTTPS 配置

编辑 `nginx-https.conf`，修改域名：

```nginx
# 将 your-domain.com 替换为实际域名
server_name hyic-tech.com www.hyic-tech.com;
```

### 6.3 启动 HTTPS 服务

```bash
cd /var/www/hyx-website

# 停止当前容器（若已在运行）
docker compose down
docker compose -f docker-compose-https.yml down 2>/dev/null || true

# 使用 HTTPS 配置启动（80 + 443）
docker compose -f docker-compose-https.yml up -d --build

# 查看状态与日志
docker compose -f docker-compose-https.yml ps
docker compose -f docker-compose-https.yml logs -f hyx-website
```

**或在一键部署时选择**：执行 `./一键部署.sh`，在提示「是否启用 HTTPS（443 端口）」时选 `y`，并确保已放置 `ssl/fullchain.pem` 与 `ssl/privkey.pem`。

---

## 步骤七：验证与测试

### 7.1 测试 HTTPS 访问

```bash
# 浏览器访问
https://hyic-tech.com
https://www.hyic-tech.com

# 命令行测试
curl -I https://hyic-tech.com
```

### 7.2 测试 HTTP 重定向

```bash
# 应该返回 301 重定向到 HTTPS
curl -I http://hyic-tech.com
# 输出：HTTP/1.1 301 Moved Permanently
```

### 7.3 SSL 证书检测

在线工具检测：
- https://www.ssllabs.com/ssltest/
- https://myssl.com/

目标评级：**A 或 A+**

### 7.4 检查安全头

```bash
curl -I https://hyic-tech.com

# 应该看到以下响应头：
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
```

---

## 证书自动续期

### 什么是证书自动续期？

Let's Encrypt 证书有效期只有 **90 天**，到期后网站将显示"不安全"警告，用户无法正常访问。因此需要设置自动续期，让服务器在证书过期前自动更新。

### 为什么选择自动续期？

| 方式 | 说明 | 推荐度 |
|------|------|--------|
| 手动续期 | 每 3 个月手动执行命令，容易忘记 | ⭐ 不推荐 |
| 自动续期 | 服务器自动检查并更新，无需人工干预 | ⭐⭐⭐ 强烈推荐 |

---

### 自动续期完整配置（小白专用）

> **前提条件**：
> - 已完成步骤五的 SSL 证书申请
> - 服务器已安装 `certbot` 工具
> - Docker 容器名称为 `hyx-website`
> - 项目目录为 `/var/www/HYX-website`

---

#### 步骤一：检查 Certbot 是否已安装

```bash
# 检查 certbot 是否已安装
certbot --version

# 如果显示版本号（如 certbot 1.21.0），说明已安装
# 如果显示"命令未找到"，请先安装：
apt update && apt install certbot -y
```

---

#### 步骤二：检查当前证书状态

```bash
# 查看证书有效期
certbot certificates

# 输出示例：
# Expiry Date: 2026-06-15 03:00:00+00:00 (VALID: 85 days)
# 表示证书还有 85 天过期
```

---

#### 步骤三：创建自动续期脚本

我们将创建一个脚本文件，它会自动完成：续期证书 → 复制新证书 → 重启 Docker 容器

```bash
# 1. 进入项目目录
cd /var/www/HYX-website

# 2. 创建续期脚本（复制以下整段命令一起粘贴执行）
cat > /var/www/HYX-website/renew-ssl.sh << 'EOF'
#!/bin/bash
# ====================================
# SSL 证书自动续期脚本
# 创建时间：2026-03-21
# 说明：自动续期 Let's Encrypt 证书并重启服务
# ====================================

# 设置变量（根据你的实际情况修改）
PROJECT_DIR="/var/www/HYX-website"           # 项目目录
CONTAINER_NAME="hyx-website"                  # Docker 容器名称
DOMAIN="hyic-tech.com"                         # 你的域名（不含 www）
LOG_FILE="/var/log/ssl-renew.log"            # 日志文件路径

# 记录开始时间
echo "========================================" >> $LOG_FILE
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始 SSL 证书续期检查" >> $LOG_FILE

# 进入项目目录
cd $PROJECT_DIR

# 停止 Docker 容器（释放 80 端口，供 certbot 使用）
echo "停止 Docker 容器..." >> $LOG_FILE
docker stop $CONTAINER_NAME

# 等待 3 秒确保端口完全释放
sleep 3

# 执行证书续期
# --quiet: 安静模式，只在出错时输出
# --non-interactive: 非交互模式，适合自动化脚本
echo "执行证书续期..." >> $LOG_FILE
/usr/bin/certbot renew --quiet --non-interactive

# 检查续期是否成功
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书续期成功" >> $LOG_FILE
    
    # 复制新证书到项目目录
    echo "复制新证书..." >> $LOG_FILE
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/
    
    # 设置证书文件权限
    chmod 644 ./ssl/*.pem
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书已复制到项目目录" >> $LOG_FILE
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告：证书续期可能失败，请检查日志" >> $LOG_FILE
fi

# 启动 Docker 容器
echo "启动 Docker 容器..." >> $LOG_FILE
docker start $CONTAINER_NAME

# 等待容器启动
sleep 5

# 检查容器状态
CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' $CONTAINER_NAME)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 容器状态: $CONTAINER_STATUS" >> $LOG_FILE

# 发送通知（可选，需要配置邮件服务）
# echo "SSL证书已续期" | mail -s "SSL续期通知" your-email@example.com

echo "[$(date '+%Y-%m-%d %H:%M:%S')] SSL 证书续期流程完成" >> $LOG_FILE
echo "========================================" >> $LOG_FILE
EOF

# 3. 给脚本添加执行权限
chmod +x /var/www/HYX-website/renew-ssl.sh

# 4. 确认脚本创建成功
ls -la /var/www/HYX-website/renew-ssl.sh
# 应显示：-rwxr-xr-x ... renew-ssl.sh
```

---

#### 步骤四：创建日志文件

```bash
# 创建日志文件并设置权限
touch /var/log/ssl-renew.log
chmod 644 /var/log/ssl-renew.log

# 查看日志文件（应该为空）
cat /var/log/ssl-renew.log
```

---

#### 步骤五：手动测试续期脚本

在设置自动任务之前，先手动测试脚本是否正常工作：

```bash
# 执行测试续期（不会真正续期，只是模拟）
/usr/bin/certbot renew --dry-run

# 如果输出类似以下内容，说明配置正确：
# Congratulations, all simulated renewals succeeded
```

如果测试失败，常见原因：
- 80 端口被占用 → 先停止 Docker：`docker stop hyx-website`
- 域名解析错误 → 检查：`ping hyic-tech.com`
- 证书尚未到期无法续期 → 正常，续期命令会在到期前 30 天才执行

---

#### 步骤六：设置定时自动执行（Crontab）

Crontab 是 Linux 系统的定时任务工具，可以设置在指定时间自动执行脚本。

```bash
# 1. 打开定时任务编辑器
crontab -e

# 如果是第一次使用，会提示选择编辑器，建议选择 nano（数字 1）
```

在打开的文件中，**滚动到最底部**，添加以下一行：

```bash
# SSL 证书自动续期 - 每周日凌晨 3 点执行
0 3 * * 0 /var/www/HYX-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1
```

**时间说明**：

| 字段 | 值 | 含义 |
|------|-----|------|
| 分钟 | 0 | 第 0 分钟 |
| 小时 | 3 | 凌晨 3 点 |
| 日期 | * | 每月每天 |
| 月份 | * | 每月 |
| 星期 | 0 | 周日 |

**其他时间设置示例**：

```bash
# 每天凌晨 3 点执行
0 3 * * * /var/www/HYX-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1

# 每月 1 日凌晨 4 点执行
0 4 1 * * /var/www/HYX-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1

# 每周一凌晨 2 点 30 分执行
30 2 * * 1 /var/www/HYX-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1
```

保存并退出：
- **nano 编辑器**：按 `Ctrl + O` 保存，按 `Ctrl + X` 退出
- **vim 编辑器**：按 `Esc`，输入 `:wq`，按 `Enter`

---

#### 步骤七：验证定时任务设置成功

```bash
# 查看当前用户的定时任务列表
crontab -l

# 应该看到你刚才添加的那一行
```

---

#### 步骤八：手动执行一次续期脚本（可选）

如果想立即验证脚本是否正常工作：

```bash
# 手动执行续期脚本
/var/www/HYX-website/renew-ssl.sh

# 执行后查看日志
cat /var/log/ssl-renew.log
```

---

### 自动续期工作原理图解

```
┌─────────────────────────────────────────────────────────────────┐
│                    自动续期工作流程                               │
└─────────────────────────────────────────────────────────────────┘

  每周日凌晨 3 点
       │
       ▼
┌──────────────────┐
│  Crontab 定时器   │  ← 系统自动触发
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 执行续期脚本      │  ← renew-ssl.sh
│ renew-ssl.sh     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 停止 Docker 容器 │  ← 释放 80 端口
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Certbot 续期证书  │  ← 检查并更新证书
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 复制证书到项目    │  ← 更新 ./ssl/ 目录
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 启动 Docker 容器  │  ← 加载新证书
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 记录日志         │  ← 写入 /var/log/ssl-renew.log
└──────────────────┘
```

---

### 日常维护命令

#### 查看证书有效期

```bash
# 方法一：使用 certbot 命令
certbot certificates

# 方法二：查看证书文件日期
openssl x509 -in /etc/letsencrypt/live/hyic-tech.com/fullchain.pem -noout -dates
```

#### 查看续期日志

```bash
# 查看最近 50 行日志
tail -50 /var/log/ssl-renew.log

# 实时监控日志（按 Ctrl+C 退出）
tail -f /var/log/ssl-renew.log
```

#### 手动强制续期

```bash
# 强制续期（即使证书未到期也执行）
certbot renew --force-renewal

# 然后复制证书并重启容器
cp /etc/letsencrypt/live/hyic-tech.com/fullchain.pem /var/www/HYX-website/ssl/
cp /etc/letsencrypt/live/hyic-tech.com/privkey.pem /var/www/HYX-website/ssl/
docker restart hyx-website
```

---

### 自动续期常见问题

#### 问题 1：定时任务没有执行

**检查方法**：
```bash
# 1. 确认 crontab 服务正在运行
systemctl status cron     # Ubuntu/Debian
systemctl status crond    # CentOS/RHEL

# 2. 确认定时任务已添加
crontab -l

# 3. 查看系统日志
grep CRON /var/log/syslog | tail -20
```

**解决方法**：
```bash
# 如果服务未运行，启动服务
systemctl start cron      # Ubuntu/Debian
systemctl start crond     # CentOS/RHEL

# 设置开机自启
systemctl enable cron     # Ubuntu/Debian
systemctl enable crond    # CentOS/RHEL
```

#### 问题 2：续期失败，提示端口被占用

**原因**：80 端口被其他程序占用

**解决方法**：
```bash
# 查看占用 80 端口的程序
netstat -tlnp | grep :80
# 或
lsof -i :80

# 如果是 Docker 容器占用，先停止
docker stop hyx-website
```

#### 问题 3：续期成功但网站仍显示证书过期

**原因**：Docker 容器未加载新证书

**解决方法**：
```bash
# 重启 Docker 容器
docker restart hyx-website

# 如果还不行，重新构建容器
cd /var/www/HYX-website
docker compose -f docker-compose-https.yml down
docker compose -f docker-compose-https.yml up -d --build
```

#### 问题 4：证书申请次数限制

**原因**：Let's Encrypt 有申请频率限制（每周 5 次/域名）

**解决方法**：
```bash
# 使用 --dry-run 测试，不会计入申请次数
certbot renew --dry-run

# 等待一周后再申请，或更换域名
```

---

### 快速命令参考卡

| 操作 | 命令 |
|------|------|
| 查看证书状态 | `certbot certificates` |
| 测试续期 | `certbot renew --dry-run` |
| 手动续期 | `/var/www/HYX-website/renew-ssl.sh` |
| 查看定时任务 | `crontab -l` |
| 编辑定时任务 | `crontab -e` |
| 查看续期日志 | `tail -50 /var/log/ssl-renew.log` |
| 重启 Docker | `docker restart hyx-website` |
| 查看容器状态 | `docker ps -a | grep hyx-website` |

---

### 一键配置命令（复制粘贴即用）

如果你是小白，可以直接复制以下命令一次性完成所有配置：

```bash
# ============ 一键配置 SSL 自动续期 ============

# 创建续期脚本
cat > /var/www/HYX-website/renew-ssl.sh << 'EOF'
#!/bin/bash
PROJECT_DIR="/var/www/HYX-website"
CONTAINER_NAME="hyx-website"
DOMAIN="hyic-tech.com"
LOG_FILE="/var/log/ssl-renew.log"

echo "========================================" >> $LOG_FILE
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始 SSL 证书续期" >> $LOG_FILE

cd $PROJECT_DIR
docker stop $CONTAINER_NAME
sleep 3

/usr/bin/certbot renew --quiet --non-interactive

if [ $? -eq 0 ]; then
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/
    chmod 644 ./ssl/*.pem
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书续期成功" >> $LOG_FILE
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 证书续期失败，请检查" >> $LOG_FILE
fi

docker start $CONTAINER_NAME
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 完成" >> $LOG_FILE
EOF

# 添加执行权限
chmod +x /var/www/HYX-website/renew-ssl.sh

# 创建日志文件
touch /var/log/ssl-renew.log

# 添加定时任务（每周日凌晨 3 点执行）
(crontab -l 2>/dev/null; echo "0 3 * * 0 /var/www/HYX-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1") | crontab -

# 验证配置
echo ""
echo "===== 配置完成 ====="
echo "定时任务列表："
crontab -l
echo ""
echo "脚本位置：/var/www/HYX-website/renew-ssl.sh"
echo "日志位置：/var/log/ssl-renew.log"
echo "===================="
```

执行完成后，系统会每周日凌晨 3 点自动检查并续期 SSL 证书。

---

## 常见问题

### 1. 证书申请失败

**原因**：80 端口被占用或域名解析未生效

**解决**：
```bash
# 检查 80 端口
netstat -tlnp | grep 80

# 停止占用端口的进程
docker stop hyx-website

# 检查域名解析
dig hyic-tech.com
```

### 2. HTTPS 访问显示不安全

**原因**：证书链不完整

**解决**：
```bash
# 确保使用 fullchain.pem 而不是 cert.pem
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

### 3. HTTP 没有重定向到 HTTPS

**解决**：
```bash
# 检查 nginx-https.conf 中的重定向配置
# 确保 return 301 https://$server_name$request_uri; 存在
```

### 4. 混合内容警告

**原因**：页面中有 HTTP 资源引用

**解决**：确保所有资源使用 HTTPS 或相对协议：
```html
<!-- 错误 -->
<script src="http://example.com/script.js"></script>

<!-- 正确 -->
<script src="https://example.com/script.js"></script>
<!-- 或 -->
<script src="//example.com/script.js"></script>
```

---

## 配置文件清单

| 文件 | 用途 |
|------|------|
| `nginx-docker.conf` | Docker HTTP 配置 |
| `nginx-https.conf` | HTTPS 配置模板 |
| `docker-compose.yml` | HTTP 部署配置 |
| `docker-compose-https.yml` | HTTPS 部署配置 |
| `ssl/fullchain.pem` | SSL 证书文件 |
| `ssl/privkey.pem` | SSL 私钥文件 |

---

## 技术支持

如有问题，请联系：

- **技术负责人**：张先生
- **电话**：138 2367 4897
- **邮箱**：bill.zhang@hyic-tech.cn

---

**文档版本**：v2.1
**最后更新**：2026-03-21