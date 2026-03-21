import * as esbuild from "npm:esbuild@0.23.1";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11";

// Plugin to stub out Node's 'crypto' module — secp256k1's index.ts imports
// it as a fallback, but in browsers crypto.getRandomValues is available
// natively so the Node fallback is never called.
const stubNodeCrypto: esbuild.Plugin = {
  name: "stub-node-crypto",
  setup(build) {
    build.onResolve({ filter: /^crypto$/ }, () => ({
      path: "crypto",
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};

const result = await esbuild.build({
  plugins: [stubNodeCrypto, ...denoPlugins()],
  entryPoints: ["client/src/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/browser-bundle.js",
  platform: "browser",
});
console.log("done", result.errors.length, "errors");
await esbuild.stop();
