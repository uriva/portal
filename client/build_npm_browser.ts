import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

const outDir = "./dist";

await emptyDir(outDir);

await build({
  typeCheck: false,
  entryPoints: ["./client/src/index.ts"],
  outDir,
  shims: {
    webSocket: true,
    timers: true,
    deno: true,
    crypto: true,
  },
  compilerOptions: { lib: ["dom"] },
  package: {
    name: "message-portal",
    version: Deno.args[0],
    description: "Move messages without environment configuration.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/uriva/portal.git",
    },
    bugs: {
      url: "https://github.com/uriva/portal/issues",
    },
  },
});
