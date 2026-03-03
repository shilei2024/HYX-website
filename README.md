# 深圳市弘易芯科技有限公司 - 企业官网

基于 PRD 要求搭建的静态企业官网，采用 HTML5 + CSS3 + JavaScript，Bootstrap 5 响应式布局，主色调为科技蓝与深灰，风格专业简洁。

## 项目结构

```
HYX-Website/
├── index.html              # 首页（中文）
├── assets/
│   └── logo.svg            # 公司 Logo（可替换为实际 Logo）
├── css/
│   └── styles.css          # 全局样式
├── js/
│   └── main.js             # 全局脚本（导航、搜索、语言高亮）
├── products/               # 产品中心（中文）
│   ├── index.html
│   └── detail.html
├── about/                  # 关于我们（中文）
│   ├── index.html, history.html, team.html, supply-chain.html, qualifications.html
├── news/                   # 新闻中心（中文）
│   ├── index.html, detail.html
├── join/                   # 加入我们（中文）
├── contact/                # 联系我们（中文）
├── en/                     # 英文版（结构同根目录）
│   ├── index.html
│   ├── products/, about/, news/, join/, contact/
├── ru/                     # 俄语版（结构同根目录）
│   ├── index.html
│   ├── products/, about/, news/, join/, contact/
└── README.md
```

## 功能说明

- **全局**：顶部导航（Logo、一级导航、语言切换 中/英/俄、搜索框）、页脚（公司信息、版权、法律条款、社交链接、邮箱与总机）
- **首页**：Banner 轮播、快捷入口（授权代理、产品中心、方案中心、联系我们）、公司简介、新闻动态
- **产品中心**：左侧分类导航（被动/主动元器件）、产品卡片列表、详情页（图片、参数、数据手册下载、询价）
- **关于我们**：公司介绍、发展历程、技术团队、供应链优势、资质荣誉
- **新闻中心**：分类 Tab、新闻卡片列表、详情页
- **加入我们**：社会招聘与校园招聘 Tab、职位列表与申请邮箱
- **联系我们**：总机/业务邮箱/投资者邮箱/地址、全球据点、意见反馈表单

## 本地预览

直接用浏览器打开 `index.html`，或使用本地服务器：

```bash
# 若已安装 Python 3
python -m http.server 8080

# 或 npx（需 Node.js）
npx serve .
```

然后访问 http://localhost:8080

## 多语言

- **中文**：根目录页面（`index.html`、`products/`、`about/` 等）
- **英文**：`en/` 目录，与中文结构一一对应（`en/index.html`、`en/products/`、`en/about/` 等）
- **俄语**：`ru/` 目录，与中文结构一一对应（`ru/index.html`、`ru/products/`、`ru/about/` 等）

顶部导航提供「中文 / EN / RU」切换，各语言内链到同语言页面，跨语言通过语言切换器跳转。

## 后续可替换内容

1. **Logo**：将 `assets/logo.svg` 替换为公司高清 Logo 源文件
2. **文案**：在各页面（含 `en/`、`ru/`）中替换为 PRD 提供的核心文案初稿
3. **图片**：将占位图（如 Unsplash 链接）替换为公司办公室、团队、产品等实际素材（注意版权）
4. **联系方式**：将 400-XXX-XXXX、邮箱、地址等替换为真实信息
5. **多语言文案**：英文、俄语页面内容可按实际需求做母语校对与优化

## 技术栈

- HTML5、CSS3、JavaScript
- Bootstrap 5.3.2（CDN）
- 无构建依赖，纯静态部署
