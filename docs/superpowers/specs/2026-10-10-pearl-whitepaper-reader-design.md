# Pearl 白皮书阅读页设计

## 目标

新增 `/archive/whitepaper`，让「Pearl档案」下的「Pearl白皮书」打开一页可长期访问的中文社区文档阅读入口，并在页面内直接阅读用户提供的原始 PDF。

## 阅读结构

页面采用研究档案而不是普通下载页的形式：

1. 顶部沿用全站导航和 Pearl 档案下拉菜单。
2. 首屏左侧显示 `Pearl 白皮书`、文档类型、阅读说明和“开始阅读”操作；右侧显示文档元数据与 PDF 页数。
3. 正文采用窄侧栏目录与大面积嵌入式 PDF 阅读器。目录的作用是定位阅读区与下载原文，不伪造 PDF 内的章节跳转能力。
4. 文档资源放在 `public/documents/pearl-whitepaper.pdf`，由浏览器以 `/documents/pearl-whitepaper.pdf` 加载；不依赖用户电脑桌面上的绝对路径。
5. PDF 无法内嵌时，阅读器保留明确的“在新窗口打开原文”链接，保证内容仍可访问。

## 视觉方向

延续站点的珍珠白背景、Fraunces 标题与 Instrument Sans 正文；白皮书页加入更克制的研究文档排版：细线、等宽编号、宽阅读画布、固定感的目录。它借鉴 pearlresearch.ai 的“标题 + 目录 + 长文”信息层级，但不复制页面文案、图像或代码。

## 组件与路由

- `WhitepaperPage.tsx`：页面结构、文档元数据和 PDF iframe/object fallback。
- `whitepaper.css`：该页面专属的响应式研究文档版式。
- `App.tsx`：将 `/archive/whitepaper` 分配给新页面。
- `ArchiveNavigation.tsx`：更新「Pearl白皮书」菜单 URL。
- `public/documents/pearl-whitepaper.pdf`：来自用户提供的静态 PDF 副本。

## 验证

测试应验证：下拉链接的路径；`/archive/whitepaper` 路由；页面标题；PDF 访问地址；回退链接。随后运行全量 Vitest 与 Vite build，并用本地浏览器检查桌面与移动布局。
