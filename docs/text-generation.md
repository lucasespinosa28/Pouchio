# Text generation (/ai-capabilities/text-generation)



## Overview

Text generation uses [`qvac-fabric-llm.cpp`](https://github.com/tetherto/qvac-fabric-llm.cpp) as inference engine. Load any supported model using `modelType: "llm"`. Then, provide array `history` as input where each element is an object with properties:

* `role: string`; can be either `"user"` or `"assistant"`
* `content: string`

`role: "user"` indicates that `content` is a previous prompt.  `role: "assistant"` indicates that `content` is a previous inference (LLM output).

Output is generated based on the full sequence of messages provided in `history`.

## Functions

Use the following sequence of function calls:

1. [`loadModel()`](/reference/api#loadmodel)
2. [`completion()`](/reference/api#completion)
3. [`unloadModel()`](/reference/api#unloadmodel)

For how to use each function, see [SDK — API reference](/reference/api/).

## Models

You can load any [`llama.cpp`](https://github.com/ggml-org/llama.cpp)-compatible text-generation/chat model. Model file format: `*.gguf`.

* If the model is sharded across multiple files (a multi-file bundle), see [Sharded models](/models/sharded-models).
* For multimodal prompts (images + text), see [Multimodal](/ai-capabilities/multimodal).
* To adapt a model to domain-specific tasks, see [Fine-tuning](/ai-capabilities/fine-tuning).
* For models available as constants, see [SDK — Models](/introduction#models).

## Features

* Event stream: `completion()` exposes a single ordered `events` async iterable plus an aggregated `final` promise. Events are discriminated by `type` — `contentDelta`, `thinkingDelta`, `toolCall`, `toolError`, `completionStats`, `completionDone`, `rawDelta`. The terminal `completionDone` event carries a `stopReason` (e.g. `"eos"`, `"length"`, `"cancelled"`).
* Thinking content: models that emit `<think>` blocks surface them as dedicated `thinkingDelta` events (enable with `captureThinking: true`), so consumers don't have to parse tags from raw text.
* Tool calls: the model emits structured tool calls as `toolCall` events ordered alongside content and thinking in the same stream.
* MCP: plug MCP servers into `completion()` so the model can use external tools (e.g., web search) via the same tool-call mechanism.
* Raw output: with `emitRawDeltas: true`, every raw model token is also emitted as a `rawDelta` event in parallel to the structured events — useful for debugging or full-fidelity logging.
* KV cache: cache and reuse the model’s key/value attention state to speed up follow-up turns in long conversations.

## Examples

### Usage

The canonical way to consume `completion()` is the `events` async iterable plus the aggregated `final` promise. The following script shows how to handle each event type and read the aggregated result:

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/completion-events.js title="completion-events.js" lineNumbers
      /**
       * Event-driven completion — demonstrates the unified `CompletionEvent` stream.
       *
       * `completion()` returns a `CompletionRun` with two primary surfaces:
       *
       *  - `events`  — an `AsyncIterable<CompletionEvent>` of ordered, typed events
       *                (`contentDelta`, `thinkingDelta`, `toolCall`, `toolError`,
       *                 `completionStats`, `completionDone`, `rawDelta`).
       *  - `final`   — a `Promise<CompletionFinal>` that resolves once the stream
       *                ends, providing aggregated `contentText`, `thinkingText`,
       *                `toolCalls`, `stats`, and `raw.fullText`.
       *
       * Set `captureThinking: true` to attempt best-effort `<think>` block parsing
       * into dedicated `thinkingDelta` events. `final.raw.fullText` keeps the exact
       * model output.
       */
      import { completion, loadModel, unloadModel, QWEN3_600M_INST_Q4, } from "@qvac/sdk";
      try {
          const modelId = await loadModel({
              modelSrc: QWEN3_600M_INST_Q4,
              modelConfig: { ctx_size: 4096 },
              onProgress: (p) => console.log(`Loading: ${p.percentage.toFixed(1)}%`),
          });
          console.log(`✅ Model loaded: ${modelId}\n`);
          const result = completion({
              modelId,
              history: [
                  { role: "user", content: "Explain quantum computing in 2 sentences" },
              ],
              stream: true,
              captureThinking: true,
          });
          for await (const event of result.events) {
              handleEvent(event);
          }
          const final = await result.final;
          console.log("\n\n--- Final Result ---");
          console.log(`Content: ${final.contentText}\n`);
          if (final.thinkingText) {
              console.log(`Thinking: ${final.thinkingText}\n`);
          }
          if (final.stats) {
              console.log(`Stats: ${final.stats.tokensPerSecond?.toFixed(1)} tok/s`);
          }
          if (final.toolCalls.length > 0) {
              console.log(`Tool calls: ${final.toolCalls.map((c) => c.name).join(", ")}`);
          }
          if (final.stopReason) {
              console.log(`Stop reason: ${final.stopReason}`);
          }
          console.log(`Raw output length: ${final.raw.fullText.length} chars`);
          await unloadModel({ modelId, clearStorage: false });
      }
      catch (error) {
          console.error("❌ Error:", error);
          process.exit(1);
      }
      function handleEvent(event) {
          switch (event.type) {
              case "contentDelta":
                  process.stdout.write(event.text);
                  break;
              case "thinkingDelta":
                  process.stdout.write(`\x1b[2m${event.text}\x1b[0m`);
                  break;
              case "toolCall":
                  console.log(`\n→ Tool: ${event.call.name}(${JSON.stringify(event.call.arguments)})`);
                  break;
              case "toolError":
                  console.warn(`\n⚠ Tool error [${event.error.code}]: ${event.error.message}`);
                  break;
              case "completionStats":
                  console.log(`\n📊 ${event.stats.tokensPerSecond?.toFixed(1)} tok/s`);
                  break;
              case "completionDone":
                  if (event.stopReason === "error" && "error" in event) {
                      console.error(`\n❌ ${event.error.message}`);
                  }
                  break;
              case "rawDelta":
                  break;
          }
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/completion-events.ts title="completion-events.ts" lineNumbers
      /**
       * Event-driven completion — demonstrates the unified `CompletionEvent` stream.
       *
       * `completion()` returns a `CompletionRun` with two primary surfaces:
       *
       *  - `events`  — an `AsyncIterable<CompletionEvent>` of ordered, typed events
       *                (`contentDelta`, `thinkingDelta`, `toolCall`, `toolError`,
       *                 `completionStats`, `completionDone`, `rawDelta`).
       *  - `final`   — a `Promise<CompletionFinal>` that resolves once the stream
       *                ends, providing aggregated `contentText`, `thinkingText`,
       *                `toolCalls`, `stats`, and `raw.fullText`.
       *
       * Set `captureThinking: true` to attempt best-effort `<think>` block parsing
       * into dedicated `thinkingDelta` events. `final.raw.fullText` keeps the exact
       * model output.
       */

      import {
        completion,
        loadModel,
        unloadModel,
        QWEN3_600M_INST_Q4,
        type CompletionEvent,
      } from "@qvac/sdk";

      try {
        const modelId = await loadModel({
          modelSrc: QWEN3_600M_INST_Q4,
          modelConfig: { ctx_size: 4096 },
          onProgress: (p) => console.log(`Loading: ${p.percentage.toFixed(1)}%`),
        });
        console.log(`✅ Model loaded: ${modelId}\n`);

        const result = completion({
          modelId,
          history: [
            { role: "user", content: "Explain quantum computing in 2 sentences" },
          ],
          stream: true,
          captureThinking: true,
        });

        for await (const event of result.events) {
          handleEvent(event);
        }

        const final = await result.final;

        console.log("\n\n--- Final Result ---");
        console.log(`Content: ${final.contentText}\n`);
        if (final.thinkingText) {
          console.log(`Thinking: ${final.thinkingText}\n`);
        }
        if (final.stats) {
          console.log(`Stats: ${final.stats.tokensPerSecond?.toFixed(1)} tok/s`);
        }
        if (final.toolCalls.length > 0) {
          console.log(`Tool calls: ${final.toolCalls.map((c) => c.name).join(", ")}`);
        }
        if (final.stopReason) {
          console.log(`Stop reason: ${final.stopReason}`);
        }
        console.log(`Raw output length: ${final.raw.fullText.length} chars`);

        await unloadModel({ modelId, clearStorage: false });
      } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
      }

      function handleEvent(event: CompletionEvent) {
        switch (event.type) {
          case "contentDelta":
            process.stdout.write(event.text);
            break;
          case "thinkingDelta":
            process.stdout.write(`\x1b[2m${event.text}\x1b[0m`);
            break;
          case "toolCall":
            console.log(
              `\n→ Tool: ${event.call.name}(${JSON.stringify(event.call.arguments)})`,
            );
            break;
          case "toolError":
            console.warn(
              `\n⚠ Tool error [${event.error.code}]: ${event.error.message}`,
            );
            break;
          case "completionStats":
            console.log(`\n📊 ${event.stats.tokensPerSecond?.toFixed(1)} tok/s`);
            break;
          case "completionDone":
            if (event.stopReason === "error" && "error" in event) {
              console.error(`\n❌ ${event.error.message}`);
            }
            break;
          case "rawDelta":
            break;
        }
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

<Callout type="info">
  The examples below (`Tool call`, `MCP`, `KV cache`) still consume `result.tokenStream` and `result.toolCallStream`, which are convenience wrappers around the canonical `events` / `final` stream shown above. Both APIs are supported; new code should prefer `events` / `final`.
</Callout>

### Tool call

The following script shows how to provide tool definitions to `completion()`, consume the streaming output, and read the parsed tool calls.

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/tools/llamacpp-native-tools.js title="completion-tool-call.js" lineNumbers
      import { completion, loadModel, unloadModel, QWEN3_1_7B_INST_Q4, } from "@qvac/sdk";
      import { tools, toolSchemas, mockExecute } from "./shared";
      try {
          const modelId = await loadModel({
              modelSrc: QWEN3_1_7B_INST_Q4,
              modelConfig: {
                  ctx_size: 4096,
                  tools: true,
              },
              onProgress: (progress) => console.log(`Loading: ${progress.percentage.toFixed(1)}%`),
          });
          console.log(`✅ Model loaded successfully! Model ID: ${modelId}`);
          const history = [
              {
                  role: "system",
                  content: "You are a helpful assistant that can use tools to get the weather and horoscope.",
              },
              {
                  role: "user",
                  content: "What's the weather in Tokyo and my horoscope for Aquarius?",
              },
          ];
          console.log("\n🤖 AI Response:");
          console.log("(Streaming with tool definitions in prompt)\n");
          const result = completion({ modelId, history, stream: true, tools });
          const tokensTask = (async () => {
              for await (const token of result.tokenStream) {
                  process.stdout.write(token);
              }
          })();
          const toolsTask = (async () => {
              for await (const evt of result.toolCallStream) {
                  console.log(`\n\n→ Tool Call Detected: ${evt.call.name}(${JSON.stringify(evt.call.arguments)})`);
                  console.log(`   ID: ${evt.call.id}`);
              }
          })();
          await Promise.all([tokensTask, toolsTask]);
          const stats = await result.stats;
          const toolCalls = await result.toolCalls;
          console.log("\n\n📋 Parsed Tool Calls:");
          if (toolCalls.length > 0) {
              for (const call of toolCalls) {
                  console.log(`  - ${call.name}(${JSON.stringify(call.arguments)})`);
                  const schema = toolSchemas[call.name];
                  if (schema) {
                      const validated = schema.safeParse(call.arguments);
                      if (validated.success) {
                          console.log(`    ✓ Arguments validated with Zod`);
                      }
                      else {
                          console.log(`    ✗ Validation failed:`, validated.error);
                      }
                  }
              }
          }
          else {
              console.log("  No tool calls detected in response");
          }
          console.log("\n📊 Performance Stats:", stats);
          if (toolCalls.length > 0) {
              console.log("\n\n🔧 Simulating Tool Execution...");
              const toolResults = toolCalls.map((call) => {
                  const result = mockExecute(call.name, call.arguments);
                  console.log(`  ✓ ${call.name}: ${result}`);
                  return { toolCallId: call.id, result };
              });
              history.push({
                  role: "assistant",
                  content: await result.text,
              });
              for (const toolResult of toolResults) {
                  history.push({
                      role: "tool",
                      content: toolResult.result,
                  });
              }
              console.log("\n\n🤖 Follow-up Response with Tool Results:");
              const followUpResult = completion({
                  modelId,
                  history,
                  stream: true,
                  tools,
              });
              for await (const token of followUpResult.tokenStream) {
                  process.stdout.write(token);
              }
              const followUpStats = await followUpResult.stats;
              console.log("\n\n📊 Follow-up Stats:", followUpStats);
          }
          console.log("\n\n🎉 Completed!");
          await unloadModel({ modelId, clearStorage: false });
      }
      catch (error) {
          console.error("❌ Error:", error);
          process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/tools/llamacpp-native-tools.ts title="completion-tool-call.ts" lineNumbers
      import {
        completion,
        loadModel,
        unloadModel,
        type ToolCall,
        type CompletionStats,
        QWEN3_1_7B_INST_Q4,
      } from "@qvac/sdk";
      import { tools, toolSchemas, mockExecute } from "./shared";

      try {
        const modelId = await loadModel({
          modelSrc: QWEN3_1_7B_INST_Q4,
          modelConfig: {
            ctx_size: 4096,
            tools: true,
          },
          onProgress: (progress) =>
            console.log(`Loading: ${progress.percentage.toFixed(1)}%`),
        });
        console.log(`✅ Model loaded successfully! Model ID: ${modelId}`);

        const history = [
          {
            role: "system",
            content:
              "You are a helpful assistant that can use tools to get the weather and horoscope.",
          },
          {
            role: "user",
            content: "What's the weather in Tokyo and my horoscope for Aquarius?",
          },
        ];

        console.log("\n🤖 AI Response:");
        console.log("(Streaming with tool definitions in prompt)\n");

        const result = completion({ modelId, history, stream: true, tools });

        const tokensTask = (async () => {
          for await (const token of result.tokenStream) {
            process.stdout.write(token);
          }
        })();

        const toolsTask = (async () => {
          for await (const evt of result.toolCallStream) {
            console.log(
              `\n\n→ Tool Call Detected: ${evt.call.name}(${JSON.stringify(evt.call.arguments)})`,
            );
            console.log(`   ID: ${evt.call.id}`);
          }
        })();

        await Promise.all([tokensTask, toolsTask]);

        const stats: CompletionStats | undefined = await result.stats;
        const toolCalls: ToolCall[] = await result.toolCalls;

        console.log("\n\n📋 Parsed Tool Calls:");
        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            console.log(`  - ${call.name}(${JSON.stringify(call.arguments)})`);

            const schema = toolSchemas[call.name as keyof typeof toolSchemas];
            if (schema) {
              const validated = schema.safeParse(call.arguments);
              if (validated.success) {
                console.log(`    ✓ Arguments validated with Zod`);
              } else {
                console.log(`    ✗ Validation failed:`, validated.error);
              }
            }
          }
        } else {
          console.log("  No tool calls detected in response");
        }

        console.log("\n📊 Performance Stats:", stats);

        if (toolCalls.length > 0) {
          console.log("\n\n🔧 Simulating Tool Execution...");

          const toolResults = toolCalls.map((call) => {
            const result = mockExecute(call.name, call.arguments);
            console.log(`  ✓ ${call.name}: ${result}`);
            return { toolCallId: call.id, result };
          });

          history.push({
            role: "assistant",
            content: await result.text,
          });

          for (const toolResult of toolResults) {
            history.push({
              role: "tool",
              content: toolResult.result,
            });
          }

          console.log("\n\n🤖 Follow-up Response with Tool Results:");
          const followUpResult = completion({
            modelId,
            history,
            stream: true,
            tools,
          });

          for await (const token of followUpResult.tokenStream) {
            process.stdout.write(token);
          }

          const followUpStats = await followUpResult.stats;
          console.log("\n\n📊 Follow-up Stats:", followUpStats);
        }

        console.log("\n\n🎉 Completed!");
        await unloadModel({ modelId, clearStorage: false });
      } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

### MCP

You create and manage the MCP client, connect it to one or more MCP servers, and pass it to `completion()`. The following script shows how to attach an MCP client to `completion()` so the model can call a web search tool and then continue with the results:

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/mcp-websearch.js title="completion-mcp.js" lineNumbers
      /**
       * MCP DuckDuckGo Search Example
       *
       * A web search example using DuckDuckGo - no API key required!
       * The server provides tools to search the web and get answers.
       *
       * Prerequisites:
       * - Install MCP SDK: bun add @modelcontextprotocol/sdk
       *
       * Run with: bun run examples/mcp-websearch.ts
       */
      import { completion, loadModel, unloadModel, QWEN3_1_7B_INST_Q4, } from "@/index";
      // MCP SDK is a user-installed optional dependency
      // Install with: bun add @modelcontextprotocol/sdk
      // eslint-disable-next-line import/no-unresolved
      import { Client } from "@modelcontextprotocol/sdk/client/index.js";
      // eslint-disable-next-line import/no-unresolved
      import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
      function parseSearchResults(mcpResult) {
          try {
              const result = mcpResult;
              // Extract text content from MCP response
              const textContent = result.content?.find((c) => c.type === "text");
              if (!textContent?.text) {
                  return JSON.stringify(mcpResult);
              }
              // Parse the JSON array of search results
              const rawResults = JSON.parse(textContent.text);
              // Extract just the useful fields (title, url, snippet)
              const cleanResults = rawResults.slice(0, 5).map((r) => ({
                  title: r.title ?? "Unknown",
                  url: r.url ?? "",
                  snippet: r.snippet ?? "",
              }));
              // Format as concise text for LLM
              return cleanResults
                  .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
                  .join("\n\n");
          }
          catch {
              // If parsing fails, return a truncated version
              const str = typeof mcpResult === "string" ? mcpResult : JSON.stringify(mcpResult);
              return str.slice(0, 2000);
          }
      }
      let mcpClient = null;
      try {
          console.log("🦆 MCP DuckDuckGo Search Example\n");
          // ============================================================
          // STEP 1: Connect to DuckDuckGo MCP server
          // ============================================================
          console.log("1️⃣  Starting DuckDuckGo MCP server...");
          mcpClient = new Client({
              name: "qvac-ddg-example",
              version: "1.0.0",
          });
          const transport = new StdioClientTransport({
              command: "npx",
              args: ["-y", "@oevortex/ddg_search"],
          });
          await mcpClient.connect(transport);
          console.log("   ✓ MCP server connected\n");
          // ============================================================
          // STEP 2: Load model
          // ============================================================
          console.log("2️⃣  Loading model...");
          const modelId = await loadModel({
              modelSrc: QWEN3_1_7B_INST_Q4,
              modelConfig: {
                  ctx_size: 4096,
                  tools: true,
              },
              onProgress: (progress) => process.stdout.write(`\r   Loading: ${progress.percentage.toFixed(1)}%`),
          });
          console.log(`\n   ✓ Model loaded\n`);
          // ============================================================
          // STEP 3: Ask AI to search the web (with MCP client)
          // ============================================================
          const history = [
              {
                  role: "system",
                  content: `You are a helpful assistant with access to web search.
      Use the search tool when you need current information.
      Always cite your sources with the URL.`,
              },
              {
                  role: "user",
                  content: "What is the current weather in New York City?",
              },
          ];
          console.log("3️⃣  Asking AI to search the web...\n");
          console.log("🤖 AI Response:");
          // Pass MCP client directly to completion - tools are adapted internally!
          const result = completion({
              modelId,
              history,
              stream: true,
              mcp: [{ client: mcpClient, includeResources: false }],
          });
          for await (const token of result.tokenStream) {
              process.stdout.write(token);
          }
          const toolCalls = await result.toolCalls;
          console.log("\n");
          // ============================================================
          // STEP 4: Execute tool calls using call() - automatic MCP routing!
          // ============================================================
          if (toolCalls.length > 0) {
              console.log("4️⃣  Executing search...\n");
              const toolResults = [];
              for (const toolCall of toolCalls) {
                  console.log(`🔍 ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                  if (!toolCall.invoke) {
                      console.log(`   ⚠️ No handler found for tool "${toolCall.name}"`);
                      continue;
                  }
                  // Use invoke() - automatically routes to the correct MCP client!
                  const mcpResult = await toolCall.invoke();
                  // Parse and clean up the search results
                  const cleanResult = parseSearchResults(mcpResult);
                  console.log(`   ✓ Got search results:`);
                  console.log(cleanResult
                      .split("\n")
                      .map((l) => `      ${l}`)
                      .join("\n"));
                  console.log();
                  toolResults.push({ id: toolCall.id, result: cleanResult });
              }
              // ============================================================
              // STEP 5: Continue with search results
              // ============================================================
              console.log("5️⃣  Getting AI response with search results...\n");
              history.push({
                  role: "assistant",
                  content: await result.text,
              });
              for (const tr of toolResults) {
                  history.push({
                      role: "tool",
                      content: tr.result,
                  });
              }
              console.log("🤖 Final Response:");
              const finalResult = completion({
                  modelId,
                  history,
                  stream: true,
                  mcp: [{ client: mcpClient, includeResources: false }],
              });
              for await (const token of finalResult.tokenStream) {
                  process.stdout.write(token);
              }
              console.log("\n");
          }
          // ============================================================
          // Cleanup
          // ============================================================
          console.log("6️⃣  Cleaning up...");
          await unloadModel({ modelId, clearStorage: false });
          console.log("   ✓ Done\n");
          console.log("🎉 Example completed!");
          process.exit(0);
      }
      catch (error) {
          console.error("❌ Error:", error);
          process.exit(1);
      }
      finally {
          if (mcpClient) {
              try {
                  await mcpClient.close();
              }
              catch {
                  // Ignore close errors
              }
          }
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/mcp-websearch.ts title="completion-mcp.ts" lineNumbers
      /**
       * MCP DuckDuckGo Search Example
       *
       * A web search example using DuckDuckGo - no API key required!
       * The server provides tools to search the web and get answers.
       *
       * Prerequisites:
       * - Install MCP SDK: bun add @modelcontextprotocol/sdk
       *
       * Run with: bun run examples/mcp-websearch.ts
       */

      import {
        completion,
        loadModel,
        unloadModel,
        QWEN3_1_7B_INST_Q4,
      } from "@/index";

      // MCP SDK is a user-installed optional dependency
      // Install with: bun add @modelcontextprotocol/sdk
      // eslint-disable-next-line import/no-unresolved
      import { Client } from "@modelcontextprotocol/sdk/client/index.js";
      // eslint-disable-next-line import/no-unresolved
      import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

      // ============================================================
      // Helper: Parse MCP search results into clean format for LLM
      // ============================================================
      type SearchResult = {
        title: string;
        url: string;
        snippet: string;
      };

      type McpContent = {
        type: string;
        text?: string;
      };

      type McpToolResult = {
        content: McpContent[];
      };

      type RawSearchResult = {
        title?: string;
        url?: string;
        snippet?: string;
        Description?: string;
      };

      function parseSearchResults(mcpResult: unknown): string {
        try {
          const result = mcpResult as McpToolResult;

          // Extract text content from MCP response
          const textContent = result.content?.find((c) => c.type === "text");
          if (!textContent?.text) {
            return JSON.stringify(mcpResult);
          }

          // Parse the JSON array of search results
          const rawResults = JSON.parse(textContent.text) as RawSearchResult[];

          // Extract just the useful fields (title, url, snippet)
          const cleanResults: SearchResult[] = rawResults.slice(0, 5).map((r) => ({
            title: r.title ?? "Unknown",
            url: r.url ?? "",
            snippet: r.snippet ?? "",
          }));

          // Format as concise text for LLM
          return cleanResults
            .map(
              (r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`,
            )
            .join("\n\n");
        } catch {
          // If parsing fails, return a truncated version
          const str =
            typeof mcpResult === "string" ? mcpResult : JSON.stringify(mcpResult);
          return str.slice(0, 2000);
        }
      }

      let mcpClient: Client | null = null;

      try {
        console.log("🦆 MCP DuckDuckGo Search Example\n");

        // ============================================================
        // STEP 1: Connect to DuckDuckGo MCP server
        // ============================================================
        console.log("1️⃣  Starting DuckDuckGo MCP server...");

        mcpClient = new Client({
          name: "qvac-ddg-example",
          version: "1.0.0",
        });

        const transport = new StdioClientTransport({
          command: "npx",
          args: ["-y", "@oevortex/ddg_search"],
        });

        await mcpClient.connect(transport);
        console.log("   ✓ MCP server connected\n");

        // ============================================================
        // STEP 2: Load model
        // ============================================================
        console.log("2️⃣  Loading model...");
        const modelId = await loadModel({
          modelSrc: QWEN3_1_7B_INST_Q4,
          modelConfig: {
            ctx_size: 4096,
            tools: true,
          },
          onProgress: (progress) =>
            process.stdout.write(`\r   Loading: ${progress.percentage.toFixed(1)}%`),
        });
        console.log(`\n   ✓ Model loaded\n`);

        // ============================================================
        // STEP 3: Ask AI to search the web (with MCP client)
        // ============================================================
        const history = [
          {
            role: "system",
            content: `You are a helpful assistant with access to web search.
      Use the search tool when you need current information.
      Always cite your sources with the URL.`,
          },
          {
            role: "user",
            content: "What is the current weather in New York City?",
          },
        ];

        console.log("3️⃣  Asking AI to search the web...\n");
        console.log("🤖 AI Response:");

        // Pass MCP client directly to completion - tools are adapted internally!
        const result = completion({
          modelId,
          history,
          stream: true,
          mcp: [{ client: mcpClient, includeResources: false }],
        });

        for await (const token of result.tokenStream) {
          process.stdout.write(token);
        }

        const toolCalls = await result.toolCalls;
        console.log("\n");

        // ============================================================
        // STEP 4: Execute tool calls using call() - automatic MCP routing!
        // ============================================================
        if (toolCalls.length > 0) {
          console.log("4️⃣  Executing search...\n");

          const toolResults: Array<{ id: string; result: string }> = [];

          for (const toolCall of toolCalls) {
            console.log(`🔍 ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);

            if (!toolCall.invoke) {
              console.log(`   ⚠️ No handler found for tool "${toolCall.name}"`);
              continue;
            }

            // Use invoke() - automatically routes to the correct MCP client!
            const mcpResult = await toolCall.invoke();

            // Parse and clean up the search results
            const cleanResult = parseSearchResults(mcpResult);

            console.log(`   ✓ Got search results:`);
            console.log(
              cleanResult
                .split("\n")
                .map((l) => `      ${l}`)
                .join("\n"),
            );
            console.log();

            toolResults.push({ id: toolCall.id, result: cleanResult });
          }

          // ============================================================
          // STEP 5: Continue with search results
          // ============================================================
          console.log("5️⃣  Getting AI response with search results...\n");

          history.push({
            role: "assistant",
            content: await result.text,
          });

          for (const tr of toolResults) {
            history.push({
              role: "tool",
              content: tr.result,
            });
          }

          console.log("🤖 Final Response:");
          const finalResult = completion({
            modelId,
            history,
            stream: true,
            mcp: [{ client: mcpClient, includeResources: false }],
          });

          for await (const token of finalResult.tokenStream) {
            process.stdout.write(token);
          }
          console.log("\n");
        }

        // ============================================================
        // Cleanup
        // ============================================================
        console.log("6️⃣  Cleaning up...");
        await unloadModel({ modelId, clearStorage: false });
        console.log("   ✓ Done\n");

        console.log("🎉 Example completed!");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
      } finally {
        if (mcpClient) {
          try {
            await mcpClient.close();
          } catch {
            // Ignore close errors
          }
        }
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

### KV cache

The following script enables `kvCache: true` to speed up follow-up turns, and then compares it with `kvCache: false` on the same history:

<Tabs>
  <Tab value="js" label="JavaScript" default>
    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/kv-cache-example.js title="completion-kv-cache.js" lineNumbers
      import { completion, LLAMA_3_2_1B_INST_Q4_0, loadModel, unloadModel, VERBOSITY, } from "@qvac/sdk";
      try {
          // Load the model
          const modelId = await loadModel({
              modelSrc: LLAMA_3_2_1B_INST_Q4_0,
              modelConfig: {
                  device: "gpu",
                  ctx_size: 2048,
                  verbosity: VERBOSITY.ERROR,
              },
          });
          console.log("🧠 Testing KV Cache functionality...\n");
          // First conversation with auto-keyed cache enabled
          console.log("📝 First conversation (building cache for the next turn):");
          const history1 = [
              { role: "user", content: "What is the capital of France?" },
          ];
          const result1 = completion({
              modelId,
              history: history1,
              stream: true,
              kvCache: true,
          }); // kvCache = true
          for await (const token of result1.tokenStream) {
              process.stdout.write(token);
          }
          const final1 = await result1.final;
          const stats1 = final1.stats;
          console.log(`\n⏱️  First completion stats: ${JSON.stringify(stats1)}\n`);
          // Continue conversation (should reuse the completed first-turn cache).
          console.log("🔄 Continuing conversation (reusing previous turn cache):");
          const history2 = [
              { role: "user", content: "What is the capital of France?" },
              {
                  role: "assistant",
                  content: final1.cacheableAssistantContent ?? final1.contentText,
              },
              { role: "user", content: "What about Germany?" },
          ];
          // Auto-keyed caching should:
          // 1. Find the cache saved after turn 1 under [user, assistant]
          // 2. Load that cache and process only the new "What about Germany?" user turn
          // 3. Save the updated cache and rename it to include the new assistant response
          const result2 = completion({
              modelId,
              history: history2,
              stream: true,
              kvCache: true,
          }); // kvCache = true
          for await (const token of result2.tokenStream) {
              process.stdout.write(token);
          }
          const stats2 = await result2.stats;
          console.log(`\n⏱️  Second completion stats: ${JSON.stringify(stats2)}\n`);
          // Compare with non-cached version
          console.log("🚀 Same conversation without cache:");
          const result3 = completion({
              modelId,
              history: history2,
              stream: true,
              kvCache: false,
          }); // kvCache = false
          for await (const token of result3.tokenStream) {
              process.stdout.write(token);
          }
          const stats3 = await result3.stats;
          console.log(`\n⏱️  Non-cached completion stats: ${JSON.stringify(stats3)}\n`);
          console.log("✅ KV Cache test completed!");
          await unloadModel({ modelId, clearStorage: false });
      }
      catch (error) {
          console.error("❌ Error:", error);
          process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>

  <Tab value="ts" label="TypeScript">
    <WrapCode>
      ```ts file=<rootDir>/packages/sdk/examples/kv-cache-example.ts title="completion-kv-cache.ts" lineNumbers
      import {
        completion,
        LLAMA_3_2_1B_INST_Q4_0,
        loadModel,
        unloadModel,
        VERBOSITY,
      } from "@qvac/sdk";

      try {
        // Load the model
        const modelId = await loadModel({
          modelSrc: LLAMA_3_2_1B_INST_Q4_0,
          modelConfig: {
            device: "gpu",
            ctx_size: 2048,
            verbosity: VERBOSITY.ERROR,
          },
        });

        console.log("🧠 Testing KV Cache functionality...\n");

        // First conversation with auto-keyed cache enabled
        console.log("📝 First conversation (building cache for the next turn):");
        const history1 = [
          { role: "user", content: "What is the capital of France?" },
        ];

        const result1 = completion({
          modelId,
          history: history1,
          stream: true,
          kvCache: true,
        }); // kvCache = true

        for await (const token of result1.tokenStream) {
          process.stdout.write(token);
        }

        const final1 = await result1.final;
        const stats1 = final1.stats;
        console.log(`\n⏱️  First completion stats: ${JSON.stringify(stats1)}\n`);

        // Continue conversation (should reuse the completed first-turn cache).
        console.log("🔄 Continuing conversation (reusing previous turn cache):");
        const history2 = [
          { role: "user", content: "What is the capital of France?" },
          {
            role: "assistant",
            content: final1.cacheableAssistantContent ?? final1.contentText,
          },
          { role: "user", content: "What about Germany?" },
        ];

        // Auto-keyed caching should:
        // 1. Find the cache saved after turn 1 under [user, assistant]
        // 2. Load that cache and process only the new "What about Germany?" user turn
        // 3. Save the updated cache and rename it to include the new assistant response
        const result2 = completion({
          modelId,
          history: history2,
          stream: true,
          kvCache: true,
        }); // kvCache = true

        for await (const token of result2.tokenStream) {
          process.stdout.write(token);
        }

        const stats2 = await result2.stats;
        console.log(`\n⏱️  Second completion stats: ${JSON.stringify(stats2)}\n`);

        // Compare with non-cached version
        console.log("🚀 Same conversation without cache:");
        const result3 = completion({
          modelId,
          history: history2,
          stream: true,
          kvCache: false,
        }); // kvCache = false

        for await (const token of result3.tokenStream) {
          process.stdout.write(token);
        }

        const stats3 = await result3.stats;
        console.log(`\n⏱️  Non-cached completion stats: ${JSON.stringify(stats3)}\n`);

        console.log("✅ KV Cache test completed!");

        await unloadModel({ modelId, clearStorage: false });
      } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
      }
      ```
    </WrapCode>
  </Tab>
</Tabs>

<Callout type="success">
  **Tip:** all examples throughout this documentation are self-contained and runnable. For instructions on how to run them, see [SDK quickstart](/quickstart).
</Callout>
