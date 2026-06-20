# Text embeddings (/ai-capabilities/text-embeddings)



## Overview

Text embeddings uses [`qvac-fabric-llm.cpp`](https://github.com/tetherto/qvac-fabric-llm.cpp) as inference engine. Load any supported model using `modelType: "embeddings"`. Then, provide text input as `text` where the value is either a single `string` or an array of strings.

`embed()` returns a single embedding vector (`number[]`) for single text input, or an array of embedding vectors (`number[][]`) for batch input.

## Functions

Use the following sequence of function calls:

1. [`loadModel()`](/reference/api#loadmodel)
2. [`embed()`](/reference/api#embed)
3. [`unloadModel()`](/reference/api#unloadmodel)

For how to use each function, see [SDK â€” API reference](/reference/api/).

## Models

You can load any [`llama.cpp`](https://github.com/ggml-org/llama.cpp)-compatible embeddings model. Model file format: `*.gguf`.

* If the model is sharded across multiple files (a multi-file bundle), see [Sharded models](/models/sharded-models).
* For models available as constants, see [SDK â€” Models](/introduction#models).

## Example

The following script shows an example of embedding:

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/embed-p2p.js title="text-embeddings.js" lineNumbers
      import { embed, GTE_LARGE_FP16, loadModel, unloadModel } from "@qvac/sdk";
      function cosineSimilarity(vecA, vecB) {
          let dotProduct = 0;
          for (let i = 0; i < vecA.length; i++) {
              dotProduct += vecA[i] * vecB[i];
          }
          return dotProduct;
      }
      try {
          const modelId = await loadModel({
              modelSrc: GTE_LARGE_FP16,
              onProgress: (progress) => {
                  console.log(progress);
              },
              modelConfig: {
                  gpuLayers: 99,
                  device: "gpu",
              },
          });
          console.log("\nðŸ“ Example 1: Single Text Embedding");
          console.log("=".repeat(50));
          const { embedding: singleEmbedding } = await embed({
              modelId,
              text: "Hello, world!",
          });
          console.log("Input: 'Hello, world!'");
          console.log("Embedding dimensions:", singleEmbedding.length);
          console.log("First 10 values:", singleEmbedding.slice(0, 10));
          console.log("\nðŸ“ Example 2: Batch Text Embeddings");
          console.log("=".repeat(50));
          const texts = [
              "The quick brown fox jumps over the lazy dog",
              "A fast auburn fox leaps over a sleepy canine",
              "Python is a programming language",
          ];
          const { embedding: batchEmbeddings } = await embed({ modelId, text: texts });
          console.log("Input: Array of", texts.length, "texts");
          console.log("Output: Array of", batchEmbeddings.length, "embeddings");
          const [emb1, emb2, emb3] = batchEmbeddings;
          if (!emb1 || !emb2 || !emb3) {
              throw new Error("Expected 3 embeddings");
          }
          console.log("Each embedding dimensions:", emb1.length);
          console.log("\nðŸ” Similarity Analysis");
          console.log("=".repeat(50));
          const similarity1 = cosineSimilarity(emb1, emb2);
          const similarity2 = cosineSimilarity(emb1, emb3);
          console.log("Similarity between texts 1 and 2 (similar meaning):", similarity1.toFixed(4));
          console.log("Similarity between texts 1 and 3 (different topics):", similarity2.toFixed(4));
          console.log("\nðŸ’¡ Higher values indicate more similar meanings");
          await unloadModel({ modelId, clearStorage: false });
      }
      catch (error) {
          console.error("âŒ Error:", error);
          process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/embed-p2p.ts title="text-embeddings.ts" lineNumbers
      import { embed, GTE_LARGE_FP16, loadModel, unloadModel } from "@qvac/sdk";

      function cosineSimilarity(vecA: number[], vecB: number[]) {
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i]! * vecB[i]!;
        }
        return dotProduct;
      }

      try {
        const modelId = await loadModel({
          modelSrc: GTE_LARGE_FP16,
          onProgress: (progress) => {
            console.log(progress);
          },
          modelConfig: {
            gpuLayers: 99,
            device: "gpu",
          },
        });

        console.log("\nðŸ“ Example 1: Single Text Embedding");
        console.log("=".repeat(50));

        const { embedding: singleEmbedding } = await embed({
          modelId,
          text: "Hello, world!",
        });

        console.log("Input: 'Hello, world!'");
        console.log("Embedding dimensions:", singleEmbedding.length);
        console.log("First 10 values:", singleEmbedding.slice(0, 10));

        console.log("\nðŸ“ Example 2: Batch Text Embeddings");
        console.log("=".repeat(50));

        const texts = [
          "The quick brown fox jumps over the lazy dog",
          "A fast auburn fox leaps over a sleepy canine",
          "Python is a programming language",
        ];

        const { embedding: batchEmbeddings } = await embed({ modelId, text: texts });

        console.log("Input: Array of", texts.length, "texts");
        console.log("Output: Array of", batchEmbeddings.length, "embeddings");

        const [emb1, emb2, emb3] = batchEmbeddings;

        if (!emb1 || !emb2 || !emb3) {
          throw new Error("Expected 3 embeddings");
        }

        console.log("Each embedding dimensions:", emb1.length);

        console.log("\nðŸ” Similarity Analysis");
        console.log("=".repeat(50));

        const similarity1 = cosineSimilarity(emb1, emb2);
        const similarity2 = cosineSimilarity(emb1, emb3);

        console.log(
          "Similarity between texts 1 and 2 (similar meaning):",
          similarity1.toFixed(4),
        );
        console.log(
          "Similarity between texts 1 and 3 (different topics):",
          similarity2.toFixed(4),
        );
        console.log("\nðŸ’¡ Higher values indicate more similar meanings");

        await unloadModel({ modelId, clearStorage: false });
      } catch (error) {
        console.error("âŒ Error:", error);
        process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

<Callout type="success">
  **Tip:** all examples throughout this documentation are self-contained and runnable. For instructions on how to run them, see [SDK quickstart](/quickstart).
</Callout>
