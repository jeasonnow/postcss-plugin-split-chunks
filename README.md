# PostCSS Plugin Split Chunks

[![npm version](https://badge.fury.io/js/postcss-plugin-split-chunks.svg)](https://www.npmjs.com/package/postcss-plugin-split-chunks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A PostCSS plugin that intelligently splits a single CSS file into multiple smaller chunks based on a configurable byte size limit. It preserves nested structures like `@media` queries, ensuring styles remain correctly grouped across the generated files. Ideal for environments with CSS size restrictions or for improving parallel loading performance.

[中文文档](./README-CN.md)

## Features

- 🎯 **Size-based splitting**: Split CSS files based on configurable byte size limits
- 🧠 **Intelligent @-rule handling**: Preserves `@media`, `@supports`, and other nested structures
- 🔒 **Non-splittable rules**: `@keyframes`, `@font-face`, `@page`, `@counter-style` are kept intact
- ✅ **Valid CSS output**: Each chunk is standalone and valid CSS
- 🚀 **Performance optimized**: Improves loading performance through parallel chunk loading
- 🛠️ **Build tool friendly**: Easy integration with existing PostCSS workflows

## Installation

Install with npm:

```bash
npm install postcss-plugin-split-chunks --save-dev
```

Or with yarn:

```bash
yarn add postcss-plugin-split-chunks --dev
```

## Usage

### Basic Usage

Add `postcss-plugin-split-chunks` to your PostCSS plugins list:

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-plugin-split-chunks')({
      size: 50 * 1024 // 50KB chunks
    })
  ]
}
```

### With Build Tools

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

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `size` | `number` | `409600` (400KB) | Maximum byte size for each chunk |

## Example

### Input CSS

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

### Output (with 2KB limit)

**Chunk 1:**
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

**Chunk 2:**
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

## How It Works

1. **Size Calculation**: Each CSS rule's byte size is calculated using UTF-8 encoding
2. **Intelligent Splitting**: When adding a rule would exceed the size limit, a new chunk is created
3. **Structure Preservation**: Nested structures like `@media` queries are intelligently handled
4. **Non-splittable Rules**: Certain @-rules that cannot be split are kept as complete units
5. **Valid Output**: Each chunk is valid, standalone CSS that can be loaded independently

## Special Handling

### Non-splittable @-rules

These @-rules are never split and always kept as complete units:
- `@keyframes`
- `@font-face`
- `@page`
- `@counter-style`

### Nested Structures

The plugin intelligently handles nested structures:
- `@media` queries can be split, with rules distributed across chunks while maintaining the media query context
- `@supports` and other conditional @-rules are handled similarly
- Nested structures are rebuilt in each chunk as needed

## Demo

Run the included demo to see the plugin in action:

```bash
# Clone the repository
git clone https://github.com/jeasonnow/postcss-plugin-split-chunks.git
cd postcss-plugin-split-chunks

# Install dependencies
npm install

# Run the demo
npm run demo
```

The demo will process a sample CSS file with different size limits and show you:
- How many chunks are created
- Size of each chunk
- Preview of the generated CSS
- Output files in the `dist/` directory

## Use Cases

- **Performance Optimization**: Split large CSS files for better loading performance
- **HTTP/2 Optimization**: Take advantage of multiplexing with smaller files
- **Progressive Loading**: Load critical CSS first, then additional chunks
- **Size Restrictions**: Work within platform or CDN file size limits
- **Build Tool Integration**: Automatically split CSS during the build process

## Requirements

- Node.js >= 18.0.0
- PostCSS >= 8.4.27

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a list of changes.
