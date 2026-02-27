# Web Komachi - 静态版

纯静态的古典日本語文書阅读器，可部署到 GitHub Pages 等静态托管服务。

## 目录结构

```
web-komachi/
├── index.html           # 首页/文档库
├── view.html            # 文档详情页
├── compare.html         # 比较页面
├── css/
│   └── style.css        # 样式表
├── js/
│   ├── app.js           # 通用工具
│   ├── library.js       # 文档库逻辑
│   ├── view.js          # 详情页逻辑
│   └── compare.js       # 比较页逻辑
├── data/                # 数据目录
│   ├── index.json       # 索引文件
│   └── documents/       # 单个文档 JSON
│       └── {id}.json
└── export_static.py     # 导出脚本
```

## 使用方法

### 1. 导出数据

在主项目目录运行导出脚本：

```bash
cd Project-Komachi
python web-komachi/export_static.py
```

这会将主应用数据库中的所有文档导出为静态 JSON 文件。

### 2. 本地预览

```bash
cd web-komachi
python -m http.server 8080
```

然后访问 http://localhost:8080

### 3. 部署到 GitHub Pages

1. 将 `web-komachi` 文件夹内容推送到仓库的 `gh-pages` 分支
2. 或者在仓库设置中启用 GitHub Pages，选择 `web-komachi` 作为源文件夹

## 更新数据

当主应用的数据库更新后，需要重新导出数据：

```bash
python web-komachi/export_static.py
```

**导出后需要更新的文件：**

- `data/index.json` - 文档索引（始终更新）
- `data/documents/{id}.json` - 新增或修改的文档

然后提交并推送这些更新的文件到托管服务。

## 数据格式

### index.json

```json
{
  "documents": [
    {
      "id": "1",
      "title": "文档标题",
      "dictionary": "unidic-chuko",
      "paragraph_count": 10,
      "token_count": 500,
      "tags": [
        {"name": "平安中期", "category": "era"}
      ],
      "metadata": {
        "author": "作者名",
        "era": "平安中期"
      }
    }
  ],
  "tags": [
    {"name": "平安中期", "category": "era", "count": 5}
  ],
  "stats": {
    "document_count": 10,
    "total_tokens": 5000
  }
}
```

### documents/{id}.json

```json
{
  "id": "1",
  "title": "文档标题",
  "dictionary": "unidic-chuko",
  "paragraph_count": 2,
  "token_count": 50,
  "tags": [...],
  "metadata": {...},
  "content": "原文内容...",
  "paragraphs": [
    {
      "index": 0,
      "content": "段落内容",
      "tokens": [
        {
          "surface": "表層形",
          "features": {
            "pos1": "名詞",
            "lemma": "基本形",
            ...
          }
        }
      ]
    }
  ]
}
```

## 功能

- ✅ 文档库浏览
- ✅ 标签筛选（时代、文体、自定义标签）
- ✅ 关键词搜索
- ✅ 文档详情查看
- ✅ 词元点击显示详细信息
- ✅ 句子高亮
- ✅ 品词颜色区分
- ✅ 多文档并列比较（最多4个）
- ✅ 响应式设计
