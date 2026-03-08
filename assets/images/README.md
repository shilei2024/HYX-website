# 图片资源

本目录用于存放网站图片。

## 首页 Hero 轮播背景（三张）

首页顶部轮播目前使用在线科技感占位图。若要改为自有照片：

1. 准备三张**有科技感**的横图（建议 1920×600 或以上，比例约 16:5），例如：电路板、芯片、数据中心、研发场景等。
2. 将图片命名为 **`hero-1.jpg`**、**`hero-2.jpg`**、**`hero-3.jpg`** 放入本目录（`assets/images/`）。
3. 在 **`css/styles.css`** 中，将以下三处 `url(...)` 改为本地路径：
   - 第一张：搜索 `carousel-item:nth-child(1)`，将 `url('https://images.unsplash.com/...')` 改为 `url('../assets/images/hero-1.jpg')`
   - 第二张：`nth-child(2)` → `url('../assets/images/hero-2.jpg')`
   - 第三张：`nth-child(3)` → `url('../assets/images/hero-3.jpg')`

未放置上述文件时，页面会继续显示当前占位图。

## 服务客户页面

将「服务客户」页右侧展示的图片命名为 **`serving-customers.jpg`** 并放在本目录下即可自动显示。

若未放置该文件，页面会显示占位图；放置后刷新即可看到您的图片。
