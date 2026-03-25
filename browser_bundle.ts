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

await Deno.writeTextFile("dist/browser-test.html", `<!DOCTYPE html>
<html>
<body>
  <script type="module">
    import * as portal from "./browser-bundle.js";
    const runTest = async () => {
      try {
        const pk1 = portal.generatePrivateKey();
        const pk2 = portal.generatePrivateKey();
        const pub1 = portal.getPublicKey(pk1);
        const pub2 = portal.getPublicKey(pk2);

        let received = false;
        
        const hubUrl = "ws://localhost:9876/";

        const conn1 = await portal.connect({
          privateKey: pk1,
          hubUrl,
          onMessage: (msg) => {
            console.log("conn1 msg", msg);
          },
          onClose: () => {}
        });

        const conn2 = await portal.connect({
          privateKey: pk2,
          hubUrl,
          onMessage: async (msg) => {
            if (msg.payload === "hello") {
              received = true;
              await fetch("/__result__", { method: "POST", body: "TEST_PASS" });
            }
          },
          onClose: () => {}
        });

        await conn1.send({ to: pub2, payload: "hello" });
        
        setTimeout(() => {
          if (!received) fetch("/__result__", { method: "POST", body: "TEST_FAIL_TIMEOUT" });
        }, 5000);
      } catch (e) {
        await fetch("/__result__", { method: "POST", body: "TEST_FAIL_" + e.message });
      }
    };
    runTest();
  </script>
</body>
</html>`);
