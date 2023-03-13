import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

const outDir = "./npm";

await emptyDir(outDir);

await build({
  typeCheck: false,
  entryPoints: ["./client/src/index.ts"],
  outDir,
  shims: {
    undici: true,
    webSocket: true,
    timers: true,
    deno: true,
    crypto: true,
  },
  package: {
    // package.json properties
    name: "portal",
    version: Deno.args[0],
    description: "Your package.",
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
