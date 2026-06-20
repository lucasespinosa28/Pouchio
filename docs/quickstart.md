# Quickstart (/quickstart)



import { TrackCopy } from '@/components/track-copy'

## Requirements

* Node.js $\geq$ v22.17
* npm $\geq$ v10.9

## Step-by-step

<Steps>
  <Step>
    Create the examples workspace:

    ```bash
    mkdir qvac-examples
    cd qvac-examples
    npm init -y && npm pkg set type=module
    ```
  </Step>

  <Step>
    Install the SDK:

    <TrackCopy name="npm_install">
      ```bash
      npm i @qvac/sdk
      ```
    </TrackCopy>
  </Step>

  <Step>
    Create the quickstart script:

    <WrapCode>
      ```js file=<rootDir>/packages/sdk/dist/examples/quickstart.js title="quickstart.js" lineNumbers
      // The SDK is silent by default. Pointing QVAC_CONFIG_PATH at a config with
      // `loggerConsoleOutput: true` prints the SDK's client and server logs to the
      // console. Drop this line (or set the flag to false) to run quietly.
      const configDir = import.meta.dirname ?? process.cwd();
      process.env["QVAC_CONFIG_PATH"] =
          `${configDir}/config/default/default.config.json`;
      const { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } = await import("@qvac/sdk");
      try {
          // Load a model into memory
          const modelId = await loadModel({
              modelSrc: LLAMA_3_2_1B_INST_Q4_0,
              onProgress: (progress) => {
                  console.log(progress);
              },
          });
          // You can use the loaded model multiple times
          const history = [
              {
                  role: "user",
                  content: "Explain quantum computing in one sentence",
              },
          ];
          const result = completion({ modelId, history, stream: true });
          for await (const token of result.tokenStream) {
              process.stdout.write(token);
          }
          // Unload model to free up system resources
          await unloadModel({ modelId });
      }
      catch (error) {
          console.error("❌ Error:", error);
          process.exit(1);
      }
      export {};
      ```
    </WrapCode>
  </Step>

  <Step>
    Run the quickstart script with Node.js:

    ```bash
    node quickstart.js
    ```

    Or with the [Bare](https://bare.pears.com) runtime (same script; the SDK installs a Node-compatible `process` global on Bare so `process.stdout` and `process.exit` work without importing `bare-process` in your own file):

    ```bash
    bare quickstart.js
    ```

    You still need Bare and the SDK’s **Bare peer dependencies** (including `bare-process` and the other `bare-*` packages listed for `@qvac/sdk`) installed in the project. Recent npm versions resolve peers when you run `npm i @qvac/sdk`; if resolution fails, install the peers your package manager reports as missing.
  </Step>
</Steps>

## Running examples

Follow these instructions to run any example in this documentation:

* All examples are self-contained, runnable JavaScript scripts. Use the `qvac-examples` workspace created in this quickstart to store and run them as you explore this documentation.
* Run each example with the indicated compatible JavaScript environment. QVAC supports multiple environments (Node.js, Bare, and Expo). After you `import` from `@qvac/sdk`, Bare has a `process` global (via `bare-process`) for typical CLI patterns; some examples still use other Node-specific APIs (e.g. `fs` without Bare shims) and note their compatible environment.
* Some examples also provide a TypeScript version. If you want to run TS directly, install the required dev dependencies:
  ```bash
  npm i -D tsx typescript
  ```
