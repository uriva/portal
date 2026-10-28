const distDir = new URL("../dist", import.meta.url).pathname;
await Deno.mkdir(distDir, { recursive: true });

const workerOut = `${distDir}/worker.js`;

await new Deno.Command("deno", {
  args: ["cache", "--allow-import", "hub/src/worker.ts"],
  stdout: "inherit",
  stderr: "inherit",
}).output();

const cmd = new Deno.Command("deno", {
  args: [
    "bundle",
    "--minify",
    "--external",
    "cloudflare:workers",
    "--external",
    "crypto",
    "--external",
    "node:*",
    "-o",
    workerOut,
    "hub/src/worker.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
});

const status = await cmd.output();
if (!status.success) {
  Deno.exit(status.code);
}

const rawCode = await Deno.readTextFile(workerOut);

const header = `import { DurableObject as __cf_DurableObject } from "cloudflare:workers";
`;

const patchedCode = header + "\n" +
  rawCode
    .replaceAll('from"crypto"', 'from"node:crypto"')
    .replaceAll('from "crypto"', 'from "node:crypto"')
    .replace(
      /class(?:\s+[a-zA-Z0-9_$]+)?\{fetch\(/,
      "class extends __cf_DurableObject{fetch(",
    );

await Deno.writeTextFile(workerOut, patchedCode);
console.log(
  `Successfully built and patched ${workerOut} for Cloudflare Workers (${
    Math.round(patchedCode.length / 1024)
  } KB)`,
);
