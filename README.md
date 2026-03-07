# 深圳市弘易芯科技有限公司 - 企业官网

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)

基于数据驱动架构的企业官网，采用 HTML5 + CSS3 + JavaScript (ES6+)，Bootstrap 5 响应式布局。主色调为科技蓝与深灰，风格专业简洁。

## 项目特性

- **多语言支持**：中文、英文、俄文三语言版本
- **数据驱动**：所有内容通过 JSON 文件管理，便于维护
- **响应式设计**：适配桌面、平板、手机各种设备
- **SEO 优化**：语义化 HTML、Meta 标签、多语言 hreflang
- **性能优化**：Gzip 压缩、静态资源缓存、CDN 加速

## 项目结构

```
HYX-Website/
├── index.html                    # 首页（中文）
├── search.html                   # 站内搜索
├── privacy.html                  # 隐私政策
├── terms.html                    # 使用条款
├── assets/
│   ├── logo.png                  # 公司 Logo
│   ├── logo.svg                  # 公司 Logo（SVG）
│   ├── brands/                   # 代理品牌 Logo
│   ├── diagrams/                 # 应用框图图片
│   └── images/                   # 其他图片资源
├── css/
│   └── styles.css                # 全局样式
├── js/
│   ├── components.js             # 组件加载器（导航、页脚、多语言）
│   └── data-loader.js            # 数据渲染器（产品、新闻、品牌）
├── data/
│   ├── config.json               # 网站配置（联系方式、公司信息）
│   ├── products.json             # 产品分类数据
│   ├── brands.json               # 代理品牌数据
│   ├── distribution-brands.json  # 分销品牌数据
│   ├── news.json                 # 新闻数据
│   ├── diagram-categories.json   # 应用框图分类
│   └── i18n/
│       ├── zh.json               # 中文翻译
│       ├── en.json               # 英文翻译
│       └── ru.json               # 俄文翻译
├── products/                     # 产品中心（中文）
├── about/                        # 关于我们（中文）
├── news/                         # 新闻中心（中文）
├── contact/                      # 联系我们（中文）
├── en/                           # 英文版
├── ru/                           # 俄文版
├── nginx.conf                    # Nginx 配置示例
├── .htaccess                     # Apache 配置示例
├── README.md                     # 项目说明
└── 部署说明.md                    # 详细部署指南
```

## 快速开始

### 本地预览

```bash
# 使用 Python
cd HYX-website
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

访问 http://localhost:8080

## 部署指南

### 方式一：静态文件部署（推荐）

将项目所有文件上传到 Web 服务器的根目录即可。

详细部署步骤请参阅 [部署说明.md](./部署说明.md)。

### 方式二：Docker 部署

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t hyx-website .
docker run -d -p 80:80 hyx-website
```

## 内容管理

### 更新联系方式

编辑 `data/config.json`：

```json
{
  "contact": {
    "phone": "13823674897",
    "phoneDisplay": "138 2367 4897",
    "email": "bill.zhang@hyic-tech.cn",
    "contactPerson": "张先生",
    "addressFull": "深圳市龙华区民治街道新龙大厦2008A"
  }
}
```

### 添加代理品牌

编辑 `data/brands.json`，在 `brands` 数组中添加：

```json
{
  "id": 13,
  "name": "品牌名称",
  "nameEn": "Brand Name",
  "logo": "assets/brands/品牌名称.png",
  "url": "https://brand-website.com/",
  "description": "品牌描述",
  "descriptionEn": "Brand description"
}
```

### 配置表单提交

1. 访问 [Formspree](https://formspree.io) 注册账号
2. 创建表单获取 Form ID
3. 在 `data/config.json` 中配置：

```json
{
  "contact": {
    "formspreeFormId": "your-form-id"
  }
}
```

### 更新备案号

在 `data/config.json` 的 `footer` 中更新：

```json
{
  "footer": {
    "icp": "粤ICP备12345678号",
    "policeBeiAn": "粤公安备12345678901号"
  }
}
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| HTML5 | - | 页面结构 |
| CSS3 | - | 样式设计 |
| JavaScript | ES6+ | 交互逻辑 |
| Bootstrap | 5.3.2 | UI 框架（CDN） |

## 浏览器兼容性

- Chrome（推荐）
- Firefox
- Safari
- Edge

## 联系方式

- **联系人**：张先生
- **电话**：138 2367 4897
- **邮箱**：bill.zhang@hyic-tech.cn
- **地址**：深圳市龙华区民治街道新龙大厦2008A

---

© 2026 深圳市弘易芯科技有限公司 版权所有