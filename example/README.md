# PostCSS Split Chunks Plugin Example

This example demonstrates how to use the `postcss-plugin-split-chunks` plugin to split large CSS files into smaller chunks based on byte size.

## Files

- `input.css` - Sample CSS file with various rules and media queries
- `demo.js` - Node.js script that demonstrates the plugin functionality
- `package.json` - Dependencies for the example

## How to Run

1. Install dependencies:
   ```bash
   cd example
   npm install
   ```

2. Run the demo:
   ```bash
   npm run demo
   ```

## What the Demo Does

The demo script will:

1. **Read the input CSS file** (`input.css`) and show its size
2. **Process the CSS with different size limits**:
   - 1KB chunks (creates many small chunks)
   - 2KB chunks (moderate chunking)
   - 4KB chunks (fewer, larger chunks)
   - No size limit (no splitting)

3. **Generate output files** for each configuration:
   - `output-1024bytes-chunk1.css`, `output-1024bytes-chunk2.css`, etc.
   - `output-2048bytes-chunk1.css`, `output-2048bytes-chunk2.css`, etc.
   - `output-4096bytes-chunk1.css`, `output-4096bytes-chunk2.css`, etc.

4. **Display statistics** for each run:
   - Number of chunks created
   - Size of each chunk
   - Total output size
   - Preview of the first chunk

## Key Features Demonstrated

- **Size-based splitting**: CSS is split when chunks exceed the specified byte limit
- **Intelligent @-rule handling**:
  - `@keyframes`, `@font-face`, `@page`, `@counter-style` are never split
  - `@media` queries are handled intelligently to maintain valid CSS
- **Nested structure preservation**: Complex nested rules are properly maintained
- **Valid CSS output**: Each chunk is standalone and valid CSS

## Expected Output

When you run the demo, you'll see output similar to:

```
🚀 PostCSS Split Chunks Plugin Demo

📄 Input CSS file size: 3456 bytes
📄 Input CSS preview (first 200 chars):
/* Large CSS file for demonstration */
@media screen and (max-width: 768px) {
  .header {
    background-color: #333;
    color: white;
    padding: 20px;
...

🔧 Processing with 1KB chunks (1024 bytes limit):
============================================================
✅ Successfully split into 4 chunks:
   Chunk 1: 987 bytes
   Chunk 2: 1021 bytes
   Chunk 3: 856 bytes
   Chunk 4: 592 bytes
📊 Total output size: 3456 bytes
📁 Files saved with prefix: output-1024bytes-chunk*.css
...
```

## Understanding the Results

- **Smaller size limits** create more chunks but ensure no single file is too large
- **Larger size limits** create fewer chunks, reducing HTTP requests
- **No size limit** keeps everything in one chunk
- **Total size remains the same** - no CSS is lost in the splitting process
- **Each chunk is valid CSS** that can be loaded independently

## Use Cases

This plugin is useful for:

- **Performance optimization**: Split large CSS files for better loading performance
- **HTTP/2 optimization**: Take advantage of multiplexing with smaller files
- **Progressive loading**: Load critical CSS first, then additional chunks
- **Build tool integration**: Automatically split CSS during the build process
