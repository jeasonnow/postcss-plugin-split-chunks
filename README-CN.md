# PostCSS Plugin Split Chunks

[![npm version](https://badge.fury.io/js/postcss-plugin-split-chunks.svg)](https://www.npmjs.com/package/postcss-plugin-split-chunks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个 PostCSS 插件，可以根据可配置的字节大小限制，智能地将单个 CSS 文件拆分为多个较小的块。它保留了嵌套结构（如 `@media` 查询），确保样式在生成的文件中保持正确分组。非常适合有 CSS 大小限制的环境或用于提高并行加载性能。

[English Documentation](./README.md)

## 特性

- 🎯 **基于大小的拆分**：根据可配置的字节大小限制拆分 CSS 文件
- 🧠 **智能 @-rule 处理**：保留 `@media`、`@supports` 和其他嵌套结构
- 🔒 **不可拆分规则**：`@keyframes`、`@font-face`、`@page`、`@counter-style` 保持完整
- ✅ **有效的 CSS 输出**：每个块都是独立且有效的 CSS
- 🚀 **性能优化**：通过并行块加载提高加载性能
- 🛠️ **构建工具友好**：易于与现有 PostCSS 工作流集成

## 安装

使用 npm 安装：

```bash
npm install postcss-plugin-split-chunks --save-dev
```

或使用 yarn：

```bash
yarn add postcss-plugin-split-chunks --dev
```

## 使用方法

### 基本用法

将 `postcss-plugin-split-chunks` 添加到您的 PostCSS 插件列表中：

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-plugin-split-chunks')({
      size: 50 * 1024 // 50KB 块
    })
  ]
}
```

### 与构建工具一起使用

#### Webpack

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['postcss-plugin-split-chunks', { size: 30 * 1024 }]
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
```

#### Vite

```js
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        require('postcss-plugin-split-chunks')({ size: 40 * 1024 })
      ]
    }
  }
})
```

## 选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `size` | `number` | `409600` (400KB) | 每个块的最大字节大小 |

## 示例

### 输入 CSS

```css
.header {
  background-color: #333;
  color: white;
  padding: 20px;
}

@media screen and (max-width: 768px) {
  .header {
    padding: 10px;
  }

  .navigation {
    display: none;
  }
}

@keyframes slideIn {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
```

### 输出（2KB 限制）

**块 1：**
```css
.header {
  background-color: #333;
  color: white;
  padding: 20px;
}

@media screen and (max-width: 768px) {
  .header {
    padding: 10px;
  }

  .navigation {
    display: none;
  }
}
```

**块 2：**
```css
@keyframes slideIn {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
```

## 工作原理

1. **大小计算**：使用 UTF-8 编码计算每个 CSS 规则的字节大小
2. **智能拆分**：当添加规则会超过大小限制时，创建新块
3. **结构保留**：智能处理嵌套结构（如 `@media` 查询）
4. **不可拆分规则**：某些无法拆分的 @-rules 保持为完整单元
5. **有效输出**：每个块都是有效的、独立的 CSS，可以独立加载

## 特殊处理

### 不可拆分的 @-rules

这些 @-rules 永远不会被拆分，始终保持为完整单元：
- `@keyframes`
- `@font-face`
- `@page`
- `@counter-style`

### 嵌套结构

插件智能处理嵌套结构：
- `@media` 查询可以被拆分，规则分布在各个块中，同时保持媒体查询上下文
- `@supports` 和其他条件 @-rules 也类似处理
- 根据需要在每个块中重建嵌套结构

## 演示

运行包含的演示来查看插件的实际效果：

```bash
# 克隆仓库
git clone https://github.com/jeasonnow/postcss-plugin-split-chunks.git
cd postcss-plugin-split-chunks

# 安装依赖
npm install

# 运行演示
npm run demo
```

演示将使用不同的大小限制处理示例 CSS 文件，并向您展示：
- 创建了多少个块
- 每个块的大小
- 生成的 CSS 预览
- `dist/` 目录中的输出文件

## 使用场景

- **性能优化**：拆分大型 CSS 文件以获得更好的加载性能
- **HTTP/2 优化**：利用多路复用处理较小的文件
- **渐进式加载**：首先加载关键 CSS，然后加载其他块
- **大小限制**：在平台或 CDN 文件大小限制内工作
- **构建工具集成**：在构建过程中自动拆分 CSS

## 系统要求

- Node.js >= 18.0.0
- PostCSS >= 8.4.27

## 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](./LICENSE) 文件。

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解更改列表。
