const { Buffer } = require("buffer"); // Import Buffer for precise byte length calculation

module.exports = (opts = {}) => {
  // Set default values in bytes. Default is 400KB.
  const { size = 400 * 1024 } = opts;

  return {
    postcssPlugin: "postcss-chunk-by-size", // Plugin name

    Once(root, { result, postcss }) {
      const finalChunks = []; // Store all final generated code chunks
      let currentChunk = postcss.root(); // Current chunk being built
      let currentChunkSize = 0; // Estimated byte size of current chunk

      // Create a new code chunk
      const startNewChunk = () => {
        if (currentChunk.nodes.length > 0) {
          finalChunks.push(currentChunk);
        }
        currentChunk = postcss.root();
        currentChunkSize = 0;
      };

      /**
       * Add a node to the current code chunk while handling overflow and recursion.
       * @param {import('postcss').Node} node The node to be added.
       * @param {import('postcss').AtRule} [parentShell] The current @-rule shell.
       * @param {Array<import('postcss').AtRule>} [parentChain] Complete parent @-rule chain.
       */
      const addNode = (node, parentShell = null, parentChain = []) => {
        // Calculate estimated byte size of the node
        const nodeSize = Buffer.byteLength(node.toString(), "utf8");

        // Extreme case: A single rule's byte size exceeds the limit. Such rules cannot be split.
        if (size && nodeSize > size) {
          const identifier =
            node.type === "rule"
              ? `starting with selector '${node.selectors[0]}'`
              : `@-rule '@${node.name}'`;
          node.warn(
            result,
            `${identifier} has an estimated size of ${nodeSize} bytes, exceeding the ${size} byte limit and cannot be split.`
          );
        }

        const projectedSize = currentChunkSize + nodeSize;

        // If the node is an @-rule and adding it completely would cause overflow, we must split its content.
        if (
          node.type === "atrule" &&
          node.nodes &&
          node.nodes.length > 0 &&
          size &&
          projectedSize > size
        ) {
          // Special handling: Some @-rules should not be split and must be kept as complete units
          const nonSplittableAtRules = [
            "keyframes",
            "font-face",
            "page",
            "counter-style",
          ];
          if (nonSplittableAtRules.includes(node.name)) {
            // If current chunk cannot accommodate this complete @-rule, create a new chunk
            if (currentChunk.nodes.length > 0) {
              startNewChunk();
            }

            // If there's a parent chain, rebuild nested structure
            if (parentChain.length > 0) {
              let currentParent = currentChunk;

              for (const parentAtRule of parentChain) {
                const newParentShell = parentAtRule.clone({ nodes: [] });
                currentChunkSize += Buffer.byteLength(
                  newParentShell.toString(),
                  "utf8"
                ); // Add shell size
                currentParent.append(newParentShell);
                currentParent = newParentShell;
              }

              // Add complete @-rule to the deepest nested structure
              currentParent.append(node.clone());
              currentChunkSize += nodeSize;
            } else {
              // Add directly to current chunk
              const targetParent = parentShell || currentChunk;
              targetParent.append(node.clone());
              currentChunkSize += nodeSize;
            }
            return;
          }

          // Check if there's actual content to split (not just empty @-rules)
          const hasActualContent = node.nodes.some(
            (child) =>
              child.type === "rule" ||
              (child.type === "atrule" && child.nodes && child.nodes.length > 0)
          );

          if (!hasActualContent) {
            // If no actual content, add the entire node directly
            const targetParent =
              parentShell && currentChunk.last
                ? currentChunk.last
                : currentChunk;
            targetParent.append(node.clone());
            currentChunkSize += nodeSize;
            return;
          }

          // Recursively process child nodes of this @-rule without pre-creating shells
          const newParentChain = [...parentChain, node];
          node.nodes.forEach((child) =>
            addNode(child, parentShell, newParentChain)
          );
          return;
        }

        // Normal flow: If node would cause current chunk to overflow, create a new chunk.
        if (size && projectedSize > size && currentChunk.nodes.length > 0) {
          startNewChunk();
        }

        // If we need to add a node and have a parent chain, ensure complete nested structure is created
        if (parentChain.length > 0) {
          let currentParent = currentChunk;

          // Rebuild complete nested structure
          for (const parentAtRule of parentChain) {
            // Check if the same @-rule already exists
            let existingShell = null;
            if (currentParent.nodes.length > 0) {
              const lastNode = currentParent.last;
              if (
                lastNode &&
                lastNode.type === "atrule" &&
                lastNode.name === parentAtRule.name &&
                lastNode.params === parentAtRule.params
              ) {
                existingShell = lastNode;
              }
            }

            if (!existingShell) {
              const newParentShell = parentAtRule.clone({ nodes: [] });
              // Add estimated size of newly created shell
              currentChunkSize += Buffer.byteLength(
                newParentShell.toString(),
                "utf8"
              );
              currentParent.append(newParentShell);
              currentParent = newParentShell;
            } else {
              currentParent = existingShell;
            }
          }

          // Add node to the deepest nested structure
          currentParent.append(node.clone());
          currentChunkSize += nodeSize;
        } else {
          // Append node to the correct parent (either chunk root or parent shell).
          const targetParent = parentShell || currentChunk;
          targetParent.append(node.clone()); // Clone node to avoid moving the original node
          currentChunkSize += nodeSize;
        }
      };

      root.nodes.forEach((node) => addNode(node));
      startNewChunk(); // Add the last remaining code chunk.

      // Attach generated code chunks to PostCSS result object for use by the main plugin.
      result.chunks = finalChunks.map((chunk) =>
        chunk.toResult({
          map: result.opts.map, // Pass source map options
        })
      );

      // Clear original root node to prevent unsplit CSS from being output.
      root.removeAll();
    },
  };
};

module.exports.postcss = true;
