# 第三方依赖与许可证

轻投将以下依赖作为本地文件分发。未修改依赖源代码；保留原文件中的版权声明。具体完整条款以各自附带的许可证为准。

| 依赖 | 版本 | 用途 | 许可证文件 |
|---|---|---|---|
| Mozilla PDF.js / pdfjs-dist | 5.6.205 | PDF 文字读取与 Worker | `extension/vendor/pdfjs/LICENSE`，Apache License 2.0 |
| PDF.js CMap 数据 | 随上述版本 | 字符映射 | `extension/vendor/pdfjs/cmaps/LICENSE` |
| Foxit 标准字体 | 随上述版本 | 标准字体度量 | `extension/vendor/pdfjs/standard_fonts/LICENSE_FOXIT` |
| Liberation 标准字体 | 随上述版本 | 标准字体度量 | `extension/vendor/pdfjs/standard_fonts/LICENSE_LIBERATION` |
| JSZip | 3.10.1 | 解压 DOCX 的文档 XML | `extension/vendor/jszip/LICENSE.markdown`，选用其中 MIT 许可证 |

JSZip 压缩发行文件保留其所含 pako 等组件的原始版权／许可注释，pako 的 MIT 完整文本另附于 `extension/vendor/jszip/LICENSE_PAKO`。没有加入远程代码加载、CDN、分析埋点或联网解析服务。

上游：[PDF.js](https://github.com/mozilla/pdf.js)、[JSZip](https://github.com/Stuk/jszip)、[pako](https://github.com/nodeca/pako)。这些依赖保持各自许可证，自有项目 MIT 许可证不替代第三方条款。
