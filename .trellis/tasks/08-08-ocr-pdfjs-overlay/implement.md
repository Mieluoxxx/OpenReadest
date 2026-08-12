# pdf.js OCR 覆盖层实现清单

## 步骤

1. `makePDF(file, { ocrProvider } = {})`：保存 provider 引用，不引入模块级全局。
2. `render()` 文本层渲染后：扫描页检测（streamTextContent 空 + textLayer 无 span）→ 离屏渲染（OCR viewport 200 DPI + rotation）→ `toBlob('image/png')` → `ocrProvider`。
3. 构造完整 synthetic `TextContent`（items/styles/lang/fontName/dir/hasEOL）→ 清空 textLayer → `pdfjsLib.TextLayer` 二次渲染；失败退回手工 span。
4. 坐标换算：OCR 像素四角点 `viewport.convertToPdfPoint` → 用户空间基线 transform。
5. 内存缓存 `pageNumber → lines`；缩放重渲染直接复用；未命中走 `ocr_get_cached_page`。

## 验证

- 正常文本 PDF 零回归；扫描页覆盖层 + 选中/复制。
- 缩放/重渲染不重复识别；旋转页坐标正确。
- 单测：provider 单元测试（synthetic TextContent、缓存命中分支、判别联合失败分支）。

## 出口

- 覆盖层注入在锁定 pdfjs-dist 5.x 稳定；坐标换算正确。
