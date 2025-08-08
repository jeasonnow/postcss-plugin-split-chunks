const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const splitChunksPlugin = require("../index.js");

const outputDir = path.join(__dirname, "../dist");

async function runDemo() {
  console.log("🚀 PostCSS Split Chunks Plugin Demo\n");

  // Read input CSS file
  const inputPath = path.join(__dirname, "input.css");
  const inputCSS = fs.readFileSync(inputPath, "utf8");

  console.log(
    "📄 Input CSS file size:",
    Buffer.byteLength(inputCSS, "utf8"),
    "bytes"
  );
  console.log("📄 Input CSS preview (first 200 chars):");
  console.log(inputCSS.substring(0, 200) + "...\n");

  // Configure plugin with different size limits
  const configs = [
    { size: 1024, name: "1KB chunks" }, // 1KB - will create many small chunks
    { size: 2048, name: "2KB chunks" }, // 2KB - moderate chunking
    { size: 4096, name: "4KB chunks" }, // 4KB - fewer, larger chunks
  ];

  for (const config of configs) {
    console.log(
      `\n🔧 Processing with ${config.name} (${config.size} bytes limit):`
    );
    console.log("=".repeat(60));

    try {
      // Process CSS with PostCSS and our plugin
      const result = await postcss([
        splitChunksPlugin({ size: config.size }),
      ]).process(inputCSS, {
        from: inputPath,
        map: { inline: false },
      });

      // Check if chunks were created
      if (result.chunks && result.chunks.length > 0) {
        console.log(
          `✅ Successfully split into ${result.chunks.length} chunks:`
        );

        result.chunks.forEach((chunk, index) => {
          const chunkSize = Buffer.byteLength(chunk.css, "utf8");
          console.log(`   Chunk ${index + 1}: ${chunkSize} bytes`);

          // Save chunk to file
          const chunkPath = path.join(
            __dirname,
            "..",
            `dist/output-${config.size}bytes-chunk${index + 1}.css`
          );
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
          }
          fs.writeFileSync(chunkPath, chunk.css);
        });

        // Calculate total size
        const totalSize = result.chunks.reduce(
          (sum, chunk) => sum + Buffer.byteLength(chunk.css, "utf8"),
          0
        );
        console.log(`📊 Total output size: ${totalSize} bytes`);
        console.log(
          `📁 Files saved with prefix: output-${config.size}bytes-chunk*.css`
        );

        // Show preview of first chunk
        console.log(`\n📋 Preview of first chunk (first 300 chars):`);
        console.log(result.chunks[0].css.substring(0, 300) + "...");
      } else {
        console.log("⚠️  No chunks created - CSS fits within size limit");
        console.log(
          `📁 Original CSS size: ${Buffer.byteLength(inputCSS, "utf8")} bytes`
        );
      }
    } catch (error) {
      console.error("❌ Error processing CSS:", error.message);
    }
  }

  // Demonstrate with no size limit
  console.log("\n🔧 Processing with no size limit:");
  console.log("=".repeat(60));

  try {
    const result = await postcss([
      splitChunksPlugin(), // No size limit
    ]).process(inputCSS, { from: inputPath });

    if (result.chunks && result.chunks.length > 0) {
      console.log(
        `✅ Created ${result.chunks.length} chunk (no splitting occurred)`
      );
      console.log(
        `📊 Chunk size: ${Buffer.byteLength(
          result.chunks[0].css,
          "utf8"
        )} bytes`
      );
    } else {
      console.log("⚠️  No chunks created");
    }
  } catch (error) {
    console.error("❌ Error processing CSS:", error.message);
  }

  console.log(
    "\n🎉 Demo completed! Check the generated chunk files in the example directory."
  );
  console.log("\n💡 Tips:");
  console.log("   - Smaller size limits create more chunks");
  console.log(
    "   - @keyframes, @font-face, @page, @counter-style rules are never split"
  );
  console.log("   - Nested @media rules are handled intelligently");
  console.log("   - Each chunk is valid, standalone CSS");
}

// Handle errors gracefully
runDemo().catch((error) => {
  console.error("💥 Demo failed:", error);
  process.exit(1);
});
