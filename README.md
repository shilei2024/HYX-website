# 深圳市弘易芯科技有限公司 - 企业官网

基于数据驱动架构的企业官网，采用 HTML5 + CSS3 + JavaScript，Bootstrap 5 响应式布局，主色调为科技蓝与深灰，风格专业简洁。

**生产环境版本** - 可直接部署到服务器

## 项目结构

```
HYX-Website/
├── index.html                    # 首页（中文）
├── assets/
│   ├── logo.png                  # 公司 Logo
│   └── logo.svg                  # 公司 Logo（SVG 备用）
├── css/
│   └── styles.css                # 全局样式
├── js/
│   ├── components.js             # 组件加载器（导航、页脚）
│   └── data-loader.js            # 数据渲染器
├── data/
│   ├── config.json               # 网站配置（联系方式、公司信息等）
│   ├── products.json             # 产品数据
│   ├── news.json                 # 新闻数据
│   └── i18n/
│       ├── zh.json               # 中文翻译
│       ├── en.json               # 英文翻译
│       └── ru.json               # 俄文翻译
├── products/                     # 产品中心（中文）
│   ├── index.html
│   └── detail.html
├── about/                        # 关于我们（中文）
│   ├── index.html
│   ├── history.html
│   ├── team.html
│   ├── supply-chain.html
│   └── qualifications.html
├── news/                         # 新闻中心（中文）
│   ├── index.html
│   └── detail.html
├── contact/                      # 联系我们（中文）
├── en/                           # 英文版
│   ├── index.html
│   ├── products/
│   ├── news/
│   └── contact/
├── ru/                           # 俄语版
│   ├── index.html
│   ├── products/
│   ├── news/
│   └── contact/
└── README.md
```

## 部署到服务器

### 方式 1：静态文件部署（推荐）

将项目所有文件上传到 Web 服务器（Nginx/Apache）的 web 目录即可。

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/HYX-Website;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json;
    
    # 缓存静态资源
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|json)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Apache 配置示例

创建 `.htaccess` 文件：

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# 启用压缩
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/css application/javascript application/json
</IfModule>
```

### 方式 2：使用 Node.js 服务器

```bash
# 安装 serve
npm install -g serve

# 启动服务器
serve -s . -p 8080
```

### 方式 3：使用 Docker

创建 `Dockerfile`：

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

构建和运行：

```bash
docker build -t hyx-website .
docker run -p 80:80 hyx-website
```

## 内容更新指南

### 更新联系方式

编辑 `data/config.json`：

```json
{
  "contact": {
    "phone": "13823674897",
    "phoneDisplay": "138 2367 4897",
    "email": "bill.zhang@hyic-tech.cn",
    "contactPerson": "张先生",
    "addressFull": "深圳市南山区科技园"
  }
}
```

### 添加新产品

编辑 `data/products.json`，在 `products` 数组中添加：

```json
{
  "id": 7,
  "name": "新产品名称",
  "nameEn": "New Product Name",
  "category": "capacitor",
  "description": "产品描述",
  "descriptionEn": "Product description",
  "image": "图片 URL"
}
```

### 添加新闻

编辑 `data/news.json`，在 `news` 数组中添加：

```json
{
  "id": 7,
  "title": "新闻标题",
  "titleEn": "News Title",
  "type": "company",
  "date": "2025-03-07",
  "summary": "新闻摘要",
  "summaryEn": "News summary",
  "image": "图片 URL"
}
```

### 更新备案号

备案号下来后，在 `data/config.json` 的 `footer` 中更新：

- `icp`：填写实际 ICP 备案号（如 `粤ICP备12345678号`），链接已指向 [https://beian.miit.gov.cn/](https://beian.miit.gov.cn/)
- `policeBeiAn`：填写实际公安备案号（如 `粤公安备12345678901号`），链接已指向 [https://beian.mps.gov.cn/](https://beian.mps.gov.cn/)

当前为占位符，仅需替换为真实号码即可。

### 更新多语言翻译

编辑 `data/i18n/` 目录下的文件：
- `zh.json` - 中文
- `en.json` - 英文
- `ru.json` - 俄文

### 更新 Logo

替换 `assets/logo.png` 文件即可。
建议尺寸：高度 40px，宽度按比例，格式 PNG 或 SVG。

## 本地开发

### 使用 Python

```bash
python -m http.server 8080
```

访问 http://localhost:8080

### 使用 Node.js

```bash
npx serve .
```

访问 http://localhost:3000

## 技术栈

- **前端框架**: HTML5, CSS3, JavaScript (ES6+)
- **UI 框架**: Bootstrap 5.3.2 (CDN)
- **数据格式**: JSON
- **部署方式**: 静态文件部署
- **构建工具**: 无（纯静态，无需构建）

## 浏览器兼容性

- Chrome (推荐)
- Firefox
- Safari
- Edge
- IE 11+ (有限支持)

## 性能优化建议

1. **启用 Gzip 压缩** - 减少传输大小
2. **使用 CDN** - 加速 Bootstrap 等第三方资源
3. **图片优化** - 压缩图片，使用 WebP 格式
4. **缓存策略** - 设置合理的缓存头
5. **懒加载** - 图片和非关键资源懒加载

## SEO 优化建议

1. **Meta 标签** - 每个页面都有独特的 title 和 description
2. **语义化 HTML** - 使用正确的标签结构
3. **sitemap.xml** - 创建并提交站点地图
4. **robots.txt** - 配置搜索引擎爬虫规则
5. **多语言** - 使用 hreflang 标签标注语言版本

## 联系方式

- **联系人**: 张先生
- **电话**: 138 2367 4897
- **邮箱**: bill.zhang@hyic-tech.cn
- **地址**: 深圳市南山区科技园

---

© 2025 深圳市弘易芯科技有限公司 版权所有