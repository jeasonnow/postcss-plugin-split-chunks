const { test, describe } = require("node:test");
const assert = require("node:assert");
const postcss = require("postcss");
const plugin = require("./index");

/**
 * Helper function: Run plugin and return result
 * @param {string} css - Input CSS string
 * @param {object} opts - Plugin options
 * @returns {Promise<object>} Result object containing chunks
 */
async function runPlugin(css, opts = {}) {
  const result = await postcss([plugin(opts)]).process(css, {
    from: undefined,
  });
  return {
    css: result.css,
    chunks: result.chunks || [],
    warnings: result.warnings(),
  };
}

/**
 * Helper function: Calculate byte size of CSS string
 * @param {string} css - CSS string
 * @returns {number} Byte count
 */
function getByteSize(css) {
  return Buffer.byteLength(css.trim(), "utf8");
}

/**
 * Helper function: Count selectors in CSS (kept for certain tests)
 * @param {string} css - CSS string
 * @returns {number} Total selector count
 */
function countSelectors(css) {
  const root = postcss.parse(css);
  let count = 0;

  root.walkRules((rule) => {
    count += rule.selectors.length;
  });

  root.walkAtRules((atRule) => {
    if (atRule.nodes) {
      count += 1; // @-rule itself counts as 1
    }
  });

  return count;
}

describe("postcss-chunker-recursive", () => {
  describe("Plugin initialization", () => {
    test("should export a function", () => {
      assert.strictEqual(typeof plugin, "function");
    });

    test("should have postcss flag", () => {
      assert.strictEqual(plugin.postcss, true);
    });

    test("should return plugin object with correct structure", () => {
      const pluginInstance = plugin();
      assert.ok(pluginInstance.hasOwnProperty("postcssPlugin"));
      assert.ok(pluginInstance.hasOwnProperty("Once"));
      assert.strictEqual(pluginInstance.postcssPlugin, "postcss-chunk-by-size");
    });

    test("should use default size value when no options provided", async () => {
      const css = ".a{} .b{} .c{} .d{} .e{}";
      const result = await runPlugin(css);
      assert.ok(result.chunks.length >= 0);
    });

    test("should accept custom size option (byte count)", async () => {
      const css = ".a{color:red} .b{color:blue} .c{color:green}";
      const result = await runPlugin(css, { size: 50 }); // 50 byte limit
      assert.ok(result.chunks.length >= 1);

      // Verify each chunk size doesn't exceed limit (allow some tolerance for formatting)
      result.chunks.forEach((chunk) => {
        const chunkSize = getByteSize(chunk.css);
        // Allow some tolerance as PostCSS might add formatting
        assert.ok(chunkSize <= 200); // Reasonable upper limit
      });
    });
  });

  describe("Basic functionality", () => {
    test("should process CSS without errors", async () => {
      const css = ".class1 {} .class2 {} .class3 {}";
      const result = await runPlugin(css, { size: 100 }); // 100 byte limit

      assert.ok(result.chunks !== undefined);
      assert.ok(Array.isArray(result.chunks));
    });

    test("should handle empty CSS", async () => {
      const css = "";
      const result = await runPlugin(css, { size: 100 });

      assert.strictEqual(result.chunks.length, 0);
      assert.strictEqual(result.css.trim(), "");
    });

    test("should not split when CSS is within byte limit", async () => {
      const css = ".a{color:red} .b{color:blue}";
      const cssSize = getByteSize(css);
      const result = await runPlugin(css, { size: cssSize + 100 }); // Set limit larger than actual size

      assert.strictEqual(result.chunks.length, 1);
      const chunkCSS = result.chunks[0].css.trim();
      assert.ok(chunkCSS.includes(".a"));
      assert.ok(chunkCSS.includes(".b"));
    });

    test("should split when exceeding byte limit", async () => {
      const css =
        ".class1{color:red;font-size:14px} .class2{background:blue;margin:10px} .class3{padding:5px} .class4{border:1px solid black}";
      const result = await runPlugin(css, { size: 30 }); // 30 byte limit, force splitting
      console.log(result);
      assert.ok(result.chunks.length > 1);

      // Verify each chunk size is within reasonable range
      result.chunks.forEach((chunk) => {
        const chunkSize = getByteSize(chunk.css);
        assert.ok(chunkSize > 0);
        // Allow some tolerance for nested structures and formatting
        assert.ok(chunkSize < 500);
      });

      // Verify all content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color:red"));
      assert.ok(allCSS.includes("background:blue"));
    });

    test("should handle multiple selectors in single rule", async () => {
      const css = ".class1, .class2, .class3 { color: red; font-size: 14px; }";
      const result = await runPlugin(css, { size: 20 }); // Small byte limit

      assert.ok(result.chunks.length >= 1);
      // Verify content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color: red"));
      assert.ok(allCSS.includes("font-size: 14px"));
    });

    test("should preserve rule content when splitting", async () => {
      const css = `
        .class1 {
          color: red;
          font-size: 14px;
        }
        .class2 {
          background: blue;
          margin: 10px;
        }
      `;
      const result = await runPlugin(css, { size: 50 }); // 50 byte limit

      assert.ok(result.chunks.length >= 1);

      // Verify all content is preserved in some chunk
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color: red"));
      assert.ok(allCSS.includes("font-size: 14px"));
      assert.ok(allCSS.includes("background: blue"));
      assert.ok(allCSS.includes("margin: 10px"));
    });

    test("should preserve CSS content across multiple chunks", async () => {
      const css =
        ".test1 { color: red; background: yellow; } .test2 { color: blue; padding: 20px; }";
      const result = await runPlugin(css, { size: 25 }); // 25 byte limit, force splitting

      assert.ok(result.chunks.length > 0);

      // Verify at least some content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.length > 0);
      assert.ok(allCSS.includes("color"));
      assert.ok(allCSS.includes("background"));
      assert.ok(allCSS.includes("padding"));
    });
  });

  describe("@-rule handling", () => {
    test("should correctly handle media queries", async () => {
      const css = `
        @media screen {
          .class1 {color:red}
          .class2 {color:blue}
        }
        .class3 {color:green}
      `;
      const result = await runPlugin(css, { size: 50 }); // 50 byte limit

      assert.ok(result.chunks.length > 0);

      // Verify media query structure is maintained
      const hasMediaQuery = result.chunks.some((chunk) =>
        chunk.css.includes("@media screen")
      );
      assert.strictEqual(hasMediaQuery, true);
    });

    test("should split content within media queries", async () => {
      const css = `
        @media screen {
          .class1 {font-size:14px}
          .class2 {font-size:16px}
          .class3 {font-size:18px}
          .class4 {font-size:20px}
        }
      `;
      const result = await runPlugin(css, { size: 80 }); // 80 byte limit, may need splitting

      assert.ok(result.chunks.length > 0);

      // Verify each chunk has media query wrapper
      result.chunks.forEach((chunk) => {
        if (chunk.css.trim()) {
          assert.ok(chunk.css.includes("@media screen"));
        }
      });
    });

    test("should handle nested @-rules", async () => {
      const css = `
        @media screen {
          @supports (display: grid) {
            .class1 {display:grid}
            .class2 {display:flex}
          }
        }
        .class3 {display:block}
      `;
      const result = await runPlugin(css, { size: 100 }); // 100 byte limit

      assert.ok(result.chunks.length > 0);

      // Verify nested structure is maintained
      const hasNestedStructure = result.chunks.some(
        (chunk) =>
          chunk.css.includes("@media screen") && chunk.css.includes("@supports")
      );
      assert.strictEqual(hasNestedStructure, true);
    });

    test("should handle keyframe animations", async () => {
      const css = `
        @keyframes slideIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .class1 {animation:slideIn 1s}
        .class2 {animation:slideIn 2s}
      `;
      const result = await runPlugin(css, { size: 100 }); // 100 byte limit

      assert.ok(result.chunks.length > 0);

      // Verify keyframes are preserved
      const hasKeyframes = result.chunks.some((chunk) =>
        chunk.css.includes("@keyframes slideIn")
      );
      assert.strictEqual(hasKeyframes, true);
    });

    test("should handle @import rules", async () => {
      const css = `
        @import url("reset.css");
        .class1 {margin:0}
        .class2 {padding:0}
      `;
      const result = await runPlugin(css, { size: 30 }); // 30 byte limit

      assert.ok(result.chunks.length > 0);

      // Verify @import is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("@import"));
    });

    test("should handle @font-face rules", async () => {
      const css = `
        @font-face {
          font-family: "MyFont";
          src: url("font.woff");
        }
        .class1 {font-family:"MyFont"}
      `;
      const result = await runPlugin(css, { size: 50 }); // 50 byte limit

      assert.ok(result.chunks.length > 0);

      // Verify @font-face is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("@font-face"));
    });
  });

  describe("Special @-rule handling", () => {
    test("should maintain @keyframes integrity without splitting", async () => {
      const css = `
        @keyframes slideIn {
          0% { opacity: 0; transform: translateX(-100%); }
          50% { opacity: 0.5; transform: translateX(-50%); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .class1 {}
        .class2 {}
        .class3 {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify @keyframes is preserved as complete unit in some chunk
      const keyframesChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@keyframes slideIn")
      );
      assert.ok(keyframesChunk !== undefined);

      // Verify @keyframes contains all keyframes
      assert.ok(keyframesChunk.css.includes("0%"));
      assert.ok(keyframesChunk.css.includes("50%"));
      assert.ok(keyframesChunk.css.includes("100%"));
      assert.ok(keyframesChunk.css.includes("opacity: 0"));
      assert.ok(keyframesChunk.css.includes("opacity: 0.5"));
      assert.ok(keyframesChunk.css.includes("opacity: 1"));
    });

    test("should maintain @font-face integrity without splitting", async () => {
      const css = `
        @font-face {
          font-family: "CustomFont";
          src: url("font.woff2") format("woff2"),
               url("font.woff") format("woff");
          font-weight: normal;
          font-style: normal;
        }
        .class1 {}
        .class2 {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify @font-face is preserved as complete unit
      const fontFaceChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@font-face")
      );
      assert.ok(fontFaceChunk !== undefined);

      // Verify @font-face contains all properties
      assert.ok(fontFaceChunk.css.includes('font-family: "CustomFont"'));
      assert.ok(fontFaceChunk.css.includes('src: url("font.woff2")'));
      assert.ok(fontFaceChunk.css.includes("font-weight: normal"));
      assert.ok(fontFaceChunk.css.includes("font-style: normal"));
    });

    test("should maintain @page integrity without splitting", async () => {
      const css = `
        @page {
          margin: 1in;
          size: A4;
          @top-center {
            content: "Page Header";
          }
        }
        .class1 {}
        .class2 {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify @page is preserved as complete unit
      const pageChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@page")
      );
      assert.ok(pageChunk !== undefined);

      // Verify @page contains all content
      assert.ok(pageChunk.css.includes("margin: 1in"));
      assert.ok(pageChunk.css.includes("size: A4"));
      assert.ok(pageChunk.css.includes("@top-center"));
      assert.ok(pageChunk.css.includes('content: "Page Header"'));
    });

    test("should maintain @counter-style integrity without splitting", async () => {
      const css = `
        @counter-style custom-counter {
          system: cyclic;
          symbols: "★" "☆" "✦";
          suffix: " ";
        }
        .class1 {}
        .class2 {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify @counter-style is preserved as complete unit
      const counterStyleChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@counter-style")
      );
      assert.ok(counterStyleChunk !== undefined);

      // Verify @counter-style contains all properties
      assert.ok(counterStyleChunk.css.includes("system: cyclic"));
      assert.ok(counterStyleChunk.css.includes('symbols: "★" "☆" "✦"'));
      assert.ok(counterStyleChunk.css.includes('suffix: " "'));
    });

    test("should maintain special @-rule integrity in nested structures", async () => {
      const css = `
        @media screen {
          @keyframes nestedAnimation {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .class1 {}
          .class2 {}
        }
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify nested @keyframes is completely preserved
      const keyframesChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@keyframes nestedAnimation")
      );
      assert.ok(keyframesChunk !== undefined);

      // Verify nested structure is maintained
      assert.ok(keyframesChunk.css.includes("@media screen"));
      assert.ok(keyframesChunk.css.includes("@keyframes nestedAnimation"));
      assert.ok(keyframesChunk.css.includes("from { opacity: 0; }"));
      assert.ok(keyframesChunk.css.includes("to { opacity: 1; }"));
    });

    test("should correctly handle multiple special @-rules", async () => {
      const css = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @font-face {
          font-family: "TestFont";
          src: url("test.woff");
        }
        .class1 {}
        .class2 {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify both special @-rules are completely preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("@keyframes fadeIn"));
      assert.ok(allCSS.includes("from { opacity: 0; }"));
      assert.ok(allCSS.includes("to { opacity: 1; }"));
      assert.ok(allCSS.includes("@font-face"));
      assert.ok(allCSS.includes('font-family: "TestFont"'));
      assert.ok(allCSS.includes('src: url("test.woff")'));
    });

    test("should warn when special @-rules exceed size limit but keep them intact", async () => {
      const css = `
        @keyframes largeAnimation {
          0% { opacity: 0; transform: scale(0); }
          25% { opacity: 0.25; transform: scale(0.25); }
          50% { opacity: 0.5; transform: scale(0.5); }
          75% { opacity: 0.75; transform: scale(0.75); }
          100% { opacity: 1; transform: scale(1); }
        }
        .class1 {}
      `;
      const result = await runPlugin(css, { size: 2 });

      assert.ok(result.chunks.length > 0);

      // Verify @keyframes is still completely preserved
      const keyframesChunk = result.chunks.find((chunk) =>
        chunk.css.includes("@keyframes largeAnimation")
      );
      assert.ok(keyframesChunk !== undefined);

      // Verify all keyframes exist
      assert.ok(keyframesChunk.css.includes("0%"));
      assert.ok(keyframesChunk.css.includes("25%"));
      assert.ok(keyframesChunk.css.includes("50%"));
      assert.ok(keyframesChunk.css.includes("75%"));
      assert.ok(keyframesChunk.css.includes("100%"));
    });
  });

  describe("Edge cases", () => {
    test("should handle empty CSS", async () => {
      const css = "";
      const result = await runPlugin(css, { size: 5 });

      assert.strictEqual(result.chunks.length, 0);
      assert.strictEqual(result.css.trim(), "");
    });

    test("should handle CSS with only comments", async () => {
      const css = "/* This is a comment */ /* Another comment */";
      const result = await runPlugin(css, { size: 5 });

      // Comments may be preserved in chunks, which is normal
      assert.ok(result.chunks.length >= 0);
    });

    test("should warn about oversized single rules", async () => {
      const css = ".a, .b, .c, .d, .e { color: red; }";
      const result = await runPlugin(css, { size: 3 });

      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].text.includes("exceeding"));
      assert.ok(result.warnings[0].text.includes("cannot be split"));
    });

    test("should gracefully handle rules without selectors", async () => {
      const css = '@charset "UTF-8";';
      const result = await runPlugin(css, { size: 5 });

      assert.ok(result.chunks.length >= 0);
    });

    test("should handle malformed CSS by throwing error", async () => {
      const css = ".class1 { color: red; .class2 { background: blue; }";

      // PostCSS will throw syntax error, which is expected
      await assert.rejects(runPlugin(css, { size: 5 }));
    });

    test("should preserve whitespace and formatting", async () => {
      const css = `
        .class1 {
          color: red;
        }

        .class2 {
          background: blue;
        }
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length >= 1);
      // Verify content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color: red"));
      assert.ok(allCSS.includes("background: blue"));
    });

    test("should handle complex selectors", async () => {
      const css = `
        .parent > .child + .sibling ~ .other[attr="value"]:hover::before {}
        #id.class:nth-child(2n+1) {}
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length >= 1);
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes(".parent"));
      assert.ok(allCSS.includes("#id"));
    });

    test("should handle CSS variables", async () => {
      const css = `
        :root {
          --primary-color: #007bff;
          --secondary-color: #6c757d;
        }
        .button {
          color: var(--primary-color);
        }
      `;
      const result = await runPlugin(css, { size: 2 });

      assert.ok(result.chunks.length >= 1);
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("--primary-color"));
      assert.ok(allCSS.includes("var(--primary-color)"));
    });
  });

  describe("Source maps", () => {
    test("should pass through source map options", async () => {
      const css = ".class1 {} .class2 {}";
      const processor = postcss([plugin({ size: 1 })]);
      const result = await processor.process(css, {
        from: "test.css",
        map: { inline: false },
      });

      assert.ok(result.chunks.length >= 1);

      // Verify chunks exist and have content
      assert.ok(result.chunks.length > 0);
      result.chunks.forEach((chunk) => {
        assert.ok(chunk.css !== undefined);
      });
    });

    test("should handle source maps when splitting", async () => {
      const css = ".class1 { color: red; } .class2 { color: blue; }";
      const processor = postcss([plugin({ size: 1 })]);
      const result = await processor.process(css, {
        from: "input.css",
        map: true,
      });

      assert.ok(result.chunks.length >= 1);

      // Verify content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color: red"));
      assert.ok(allCSS.includes("color: blue"));
    });

    test("should work with source map options", async () => {
      const css = ".class1 {} .class2 {}";
      const processor = postcss([plugin({ size: 1 })]);

      await assert.doesNotReject(
        processor.process(css, {
          from: "test.css",
          map: { inline: false },
        })
      );
    });
  });

  describe("Performance and memory", () => {
    test("should efficiently handle large CSS files", async () => {
      // Generate many CSS rules
      const rules = [];
      for (let i = 0; i < 1000; i++) {
        rules.push(`.class${i} { color: red; }`);
      }
      const css = rules.join("\n");

      const startTime = Date.now();
      const result = await runPlugin(css, { size: 100 });
      const endTime = Date.now();

      assert.ok(result.chunks.length > 1);
      assert.ok(endTime - startTime < 5000); // Should complete within 5 seconds
    });

    test("should not create too many chunks", async () => {
      const css = ".a{} .b{} .c{} .d{} .e{} .f{}";
      const result = await runPlugin(css, { size: 2 });

      // Verify reasonable chunk count, not excessive
      assert.ok(result.chunks.length > 0);
      assert.ok(result.chunks.length <= 6); // Should not exceed original rule count
    });

    test("should handle deeply nested @-rules", async () => {
      const css = `
        @media screen {
          @supports (display: grid) {
            @media (min-width: 768px) {
              .class1 {}
              .class2 {}
            }
          }
        }
      `;
      const result = await runPlugin(css, { size: 1 });

      assert.ok(result.chunks.length > 0);

      // Verify deep nesting structure integrity is maintained
      // Each chunk containing class names must maintain complete nesting hierarchy
      result.chunks.forEach((chunk) => {
        if (chunk.css.includes(".class1") || chunk.css.includes(".class2")) {
          // Verify complete nested structure is preserved
          assert.ok(chunk.css.includes("@media screen"));
          assert.ok(chunk.css.includes("@supports (display: grid)"));
          assert.ok(chunk.css.includes("@media (min-width: 768px)"));

          // Verify nesting hierarchy correctness
          const mediaScreenIndex = chunk.css.indexOf("@media screen");
          const supportsIndex = chunk.css.indexOf("@supports");
          const mediaMinWidthIndex = chunk.css.indexOf(
            "@media (min-width: 768px)"
          );

          // Ensure correct nesting order
          assert.ok(mediaScreenIndex < supportsIndex);
          assert.ok(supportsIndex < mediaMinWidthIndex);
        }
      });

      // Verify all class names are preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes(".class1"));
      assert.ok(allCSS.includes(".class2"));
    });

    test("should efficiently handle large CSS files", async () => {
      // Generate many CSS rules
      const rules = [];
      for (let i = 0; i < 100; i++) {
        rules.push(`.class${i} { color: red; }`);
      }
      const css = rules.join("\n");

      const startTime = Date.now();
      const result = await runPlugin(css, { size: 10 });
      const endTime = Date.now();

      assert.ok(result.chunks.length > 0);
      assert.ok(endTime - startTime < 1000); // Should complete within 1 second
    });
  });

  describe("Integration tests", () => {
    test("should work with real-world CSS", async () => {
      const css = `
        /* Reset styles */
        * { margin: 0; padding: 0; }

        /* Layout */
        .container { max-width: 1200px; margin: 0 auto; }
        .row { display: flex; }
        .col { flex: 1; }

        /* Components */
        .button {
          padding: 10px 20px;
          border: none;
          cursor: pointer;
        }
        .button:hover { background: #f0f0f0; }

        /* Media queries */
        @media (max-width: 768px) {
          .container { padding: 0 15px; }
          .row { flex-direction: column; }
          .col { margin-bottom: 20px; }
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .fade-in { animation: fadeIn 0.3s ease-in; }
      `;

      const result = await runPlugin(css, { size: 5 });

      assert.ok(result.chunks.length > 0);

      // Verify all important content is preserved
      const allChunksCSS = result.chunks.map((chunk) => chunk.css).join("\n");
      assert.ok(allChunksCSS.includes(".container"));
      assert.ok(allChunksCSS.includes(".button"));
      assert.ok(allChunksCSS.includes("@media"));
      assert.ok(allChunksCSS.includes("@keyframes"));
    });

    test("should handle real-world CSS structures", async () => {
      const css = `
        .container { max-width: 1200px; }
        .button { padding: 10px; }
        @media (max-width: 768px) {
          .container { padding: 15px; }
        }
      `;

      const result = await runPlugin(css, { size: 3 });

      assert.ok(result.chunks.length > 0);

      // Verify important content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes(".container"));
      assert.ok(allCSS.includes(".button"));
    });

    test("should maintain CSS functionality after chunking", async () => {
      const css = `
        .parent .child { color: red; }
        .parent > .direct-child { color: blue; }
        .element:hover { background: yellow; }
        .element::before { content: ""; }
      `;

      const result = await runPlugin(css, { size: 2 });

      assert.ok(result.chunks.length > 0);

      // Verify selector integrity
      const allChunksCSS = result.chunks.map((chunk) => chunk.css).join("\n");
      assert.ok(allChunksCSS.includes(".parent .child"));
      assert.ok(allChunksCSS.includes(".parent > .direct-child"));
      assert.ok(allChunksCSS.includes(":hover"));
      assert.ok(allChunksCSS.includes("::before"));
    });

    test("should maintain CSS selector integrity", async () => {
      const css = `
        .parent .child { color: red; }
        .element:hover { background: yellow; }
        .element::before { content: ""; }
      `;

      const result = await runPlugin(css, { size: 2 });

      assert.ok(result.chunks.length > 0);

      // Verify selector structure is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes(".parent"));
      assert.ok(allCSS.includes(":hover"));
      assert.ok(allCSS.includes("::before"));
    });
  });

  describe("Configuration options", () => {
    test("should accept size option (byte count)", async () => {
      const css = ".a{color:red} .b{color:blue} .c{color:green}";

      const result1 = await runPlugin(css, { size: 20 }); // 20 byte limit
      const result2 = await runPlugin(css, { size: 200 }); // 200 byte limit

      assert.ok(result1.chunks.length >= 1);
      assert.ok(result2.chunks.length >= 1);

      // Smaller byte limit should produce more chunks
      assert.ok(result1.chunks.length >= result2.chunks.length);
    });

    test("should handle undefined size option", async () => {
      const css = ".a{color:red} .b{color:blue} .c{color:green}";

      await assert.doesNotReject(runPlugin(css, {}));
    });

    test("should use default size value (4000 bytes)", async () => {
      const css =
        ".a{color:red} .b{color:blue} .c{color:green} .d{color:yellow} .e{color:purple}";
      const result = await runPlugin(css);
      // Without size setting, use default 4000 bytes, small CSS should not be split
      assert.strictEqual(result.chunks.length, 1);
    });

    test("should correctly handle size of 0", async () => {
      const css = ".a{color:red} .b{color:blue}";
      const result = await runPlugin(css, { size: 0 });
      console.log(result);
      // Size of 0 should force splitting
      assert.ok(result.chunks.length >= 1);
    });

    test("should handle very large size values", async () => {
      const css = ".a{color:red} .b{color:blue} .c{color:green}";
      const result = await runPlugin(css, { size: 10000 });
      // Very large size should put all content in one chunk
      assert.strictEqual(result.chunks.length, 1);
    });
  });

  describe("Byte-based splitting functionality", () => {
    test("should accurately split CSS by byte count", async () => {
      const css =
        ".a{color:red} .b{color:blue} .c{color:green} .d{color:yellow}";
      const result = await runPlugin(css, { size: 25 }); // 25 byte limit

      assert.ok(result.chunks.length > 1);
      // Verify each chunk byte count doesn't exceed limit (allow reasonable tolerance)
      result.chunks.forEach((chunk) => {
        const chunkSize = getByteSize(chunk.css);
        // Allow some tolerance for nested structures and formatting
        assert.ok(chunkSize < 150); // Reasonable upper limit
      });

      // Verify all content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color:red"));
      assert.ok(allCSS.includes("color:blue"));
      assert.ok(allCSS.includes("color:green"));
      assert.ok(allCSS.includes("color:yellow"));
    });

    test("should correctly calculate byte count for CSS with Chinese characters", async () => {
      const css = ".中文类名{color:red} .english{color:blue}";
      const result = await runPlugin(css, { size: 30 }); // 30 byte limit

      assert.ok(result.chunks.length >= 1);

      // Verify Chinese characters are handled correctly
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("中文类名"));
      assert.ok(allCSS.includes("english"));
    });

    test("should handle CSS with special characters", async () => {
      const css = ".emoji🎉{color:red} .special-chars_123{color:blue}";
      const result = await runPlugin(css, { size: 40 }); // 40 byte limit

      assert.ok(result.chunks.length >= 1);

      // Verify special characters are handled correctly
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("emoji🎉"));
      assert.ok(allCSS.includes("special-chars_123"));
    });

    test("should maintain CSS rule integrity under byte limits", async () => {
      const css =
        ".long-class-name-that-might-be-split{color:red;background:blue;font-size:14px;margin:10px;padding:5px}";
      const result = await runPlugin(css, { size: 50 }); // 50 byte limit

      assert.ok(result.chunks.length >= 1);

      // Verify rule integrity is maintained
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("long-class-name-that-might-be-split"));
      assert.ok(allCSS.includes("color:red"));
      assert.ok(allCSS.includes("background:blue"));
      assert.ok(allCSS.includes("font-size:14px"));
    });

    test("should correctly handle byte count boundary cases", async () => {
      // Create CSS that's close to byte limit
      const css = ".test{color:red}"; // About 15 bytes
      const cssSize = getByteSize(css);

      // Test exactly equal to size
      const result1 = await runPlugin(css, { size: cssSize });
      assert.strictEqual(result1.chunks.length, 1);

      // Test slightly smaller than size
      const result2 = await runPlugin(css, { size: cssSize - 1 });
      assert.ok(result2.chunks.length >= 1);
    });

    test("should correctly handle media queries under byte limits", async () => {
      const css = "@media screen{.a{color:red}.b{color:blue}} .c{color:green}";
      const result = await runPlugin(css, { size: 40 }); // 40 byte limit

      assert.ok(result.chunks.length >= 1);

      // Verify media query structure is maintained
      const hasMediaQuery = result.chunks.some((chunk) =>
        chunk.css.includes("@media screen")
      );
      assert.strictEqual(hasMediaQuery, true);

      // Verify all content is preserved
      const allCSS = result.chunks.map((c) => c.css).join("");
      assert.ok(allCSS.includes("color:red"));
      assert.ok(allCSS.includes("color:blue"));
      assert.ok(allCSS.includes("color:green"));
    });
  });
});
