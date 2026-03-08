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
| 域名 | 已购买，如 `hyic-tech.cn` |
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
- hyic-tech.cn        # 主域名
- www.hyic-tech.cn    # www 子域名

国际域名：
- hyic-tech.com
- hyictech.com
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
域名：hyic-tech.cn
服务器IP：123.45.67.89

解析记录：
1. A记录 @ → 123.45.67.89（解析 hyic-tech.cn）
2. A记录 www → 123.45.67.89（解析 www.hyic-tech.cn）
```

### 2.3 验证解析生效

```bash
# 在本地电脑执行
ping hyic-tech.cn
ping www.hyic-tech.cn

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
http://hyic-tech.cn
http://www.hyic-tech.cn

# 或使用 curl 测试
curl -I http://hyic-tech.cn
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
  -d hyic-tech.cn \
  -d www.hyic-tech.cn \
  --email bill.zhang@hyic-tech.cn \
  --agree-tos \
  --no-eff-email

# 证书保存路径
# /etc/letsencrypt/live/hyic-tech.cn/fullchain.pem
# /etc/letsencrypt/live/hyic-tech.cn/privkey.pem
```

#### 5.3 复制证书到项目目录

```bash
# 创建 SSL 目录
mkdir -p /var/www/hyx-website/ssl

# 复制证书
cp /etc/letsencrypt/live/hyic-tech.cn/fullchain.pem /var/www/hyx-website/ssl/
cp /etc/letsencrypt/live/hyic-tech.cn/privkey.pem /var/www/hyx-website/ssl/

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
- `hyic-tech.cn.pem`（证书文件）
- `hyic-tech.cn.key`（私钥文件）

```bash
# 重命名并复制到项目
mkdir -p /var/www/hyx-website/ssl
cp hyic-tech.cn.pem /var/www/hyx-website/ssl/fullchain.pem
cp hyic-tech.cn.key /var/www/hyx-website/ssl/privkey.pem
```

---

## 步骤六：配置 HTTPS

### 6.1 更新 Docker Compose 配置

创建 `docker-compose-https.yml`：

```yaml
version: '3.8'

services:
  hyx-website:
    build:
      context: .
      dockerfile: Dockerfile
    image: hyx-website:latest
    container_name: hyx-website
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
      - ./nginx-https.conf:/etc/nginx/conf.d/default.conf:ro
    environment:
      - TZ=Asia/Shanghai
    networks:
      - hyx-network

networks:
  hyx-network:
    driver: bridge
```

### 6.2 修改 Nginx HTTPS 配置

编辑 `nginx-https.conf`，修改域名：

```nginx
# 将 your-domain.com 替换为实际域名
server_name hyic-tech.cn www.hyic-tech.cn;
```

### 6.3 启动 HTTPS 服务

```bash
cd /var/www/hyx-website

# 停止旧容器
docker compose down

# 使用 HTTPS 配置启动
docker compose -f docker-compose-https.yml up -d --build

# 查看日志
docker logs -f hyx-website
```

---

## 步骤七：验证与测试

### 7.1 测试 HTTPS 访问

```bash
# 浏览器访问
https://hyic-tech.cn
https://www.hyic-tech.cn

# 命令行测试
curl -I https://hyic-tech.cn
```

### 7.2 测试 HTTP 重定向

```bash
# 应该返回 301 重定向到 HTTPS
curl -I http://hyic-tech.cn
# 输出：HTTP/1.1 301 Moved Permanently
```

### 7.3 SSL 证书检测

在线工具检测：
- https://www.ssllabs.com/ssltest/
- https://myssl.com/

目标评级：**A 或 A+**

### 7.4 检查安全头

```bash
curl -I https://hyic-tech.cn

# 应该看到以下响应头：
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
```

---

## 证书自动续期

### Let's Encrypt 自动续期

Let's Encrypt 证书有效期 90 天，需要定期续期。

#### 方式一：Crontab 定时任务

```bash
# 编辑 crontab
crontab -e

# 添加续期任务（每月 1 日凌晨 3 点执行）
0 3 1 * * /usr/bin/certbot renew --quiet --post-hook "docker restart hyx-website"
```

#### 方式二：创建续期脚本

```bash
# 创建续期脚本
cat > /var/www/hyx-website/renew-ssl.sh << 'EOF'
#!/bin/bash
# 续期 SSL 证书

cd /var/www/hyx-website

# 续期证书
/usr/bin/certbot renew --quiet

# 复制新证书
cp /etc/letsencrypt/live/hyic-tech.cn/fullchain.pem ./ssl/
cp /etc/letsencrypt/live/hyic-tech.cn/privkey.pem ./ssl/

# 重启容器
docker restart hyx-website

echo "SSL 证书续期完成：$(date)"
EOF

chmod +x /var/www/hyx-website/renew-ssl.sh

# 添加到 crontab
echo "0 3 1 * * /var/www/hyx-website/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1" | crontab -
```

#### 手动续期测试

```bash
# 测试续期（不实际执行）
certbot renew --dry-run

# 手动续期
certbot renew
docker restart hyx-website
```

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
dig hyic-tech.cn
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

**文档版本**：v2.0  
**最后更新**：2026-03-08