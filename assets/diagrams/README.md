# 应用框图图片

本目录用于存放「应用框图」页面的示意图。当前使用 `placeholder.svg` 作为占位图。

替换为实际框图时，可保留 `placeholder.svg` 作为默认图，或在 `data/diagram-categories.json` 中为每个分类指定不同图片路径，例如：

- `assets/diagrams/wearable.png` — 智能穿戴类
- `assets/diagrams/power-adapter.png` — 电源转接类
- `assets/diagrams/motor-*.png` — 各电机驱动类

修改图片路径请编辑 `data/diagram-categories.json` 中对应条目的 `image` 字段。
