import { assert } from "https://deno.land/std@0.179.0/testing/asserts.ts";

const TEST_PORT = 9876;
const HTTP_PORT = 9877;

const startHub = async (): Promise<Deno.ChildProcess> => {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--no-check",
      "--allow-net",
      "--allow-env",
      "--allow-import",
      "hub/src/index.ts",
    ],
    env: { port: String(TEST_PORT) },
    stdout: "null",
    stderr: "null",
  });
  const process = cmd.spawn();
  const url = `ws://localhost:${TEST_PORT}/`;
  for (let i = 0; i < 50; i++) {
    try {
      const ws = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.close();
          resolve();
        };
        ws.onerror = () => reject();
      });
      return process;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  process.kill("SIGTERM");
  throw new Error("hub did not start");
};

const killProcess = (p: Deno.ChildProcess) => {
  try {
    p.kill("SIGTERM");
  } catch {
    // already dead
  }
};

Deno.test({
  name: "browser: two clients exchange messages in Chrome",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    // 1. Bundle
    const bundle = new Deno.Command("deno", {
      args: [
        "run",
        "--no-check",
        "--allow-read",
        "--allow-write",
        "--allow-net",
        "--allow-env",
        "--allow-run",
        "--allow-import",
        "browser_bundle.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });
    const bundleResult = await bundle.output();
    if (!bundleResult.success) {
      throw new Error(
        "bundle failed: " + new TextDecoder().decode(bundleResult.stderr),
      );
    }

    // 2. Start hub
    const hub = await startHub();

    // 3. Start HTTP server that also listens for the test result callback
    const resultPromise = Promise.withResolvers<string>();
    const ac = new AbortController();

    Deno.serve(
      { port: HTTP_PORT, signal: ac.signal, onListen: () => {} },
      async (req) => {
        const url = new URL(req.url);

        // The test page POSTs its result here
        if (url.pathname === "/__result__" && req.method === "POST") {
          const body = await req.text();
          resultPromise.resolve(body);
          return new Response("ok");
        }

        const path = url.pathname === "/" ? "/browser-test.html" : url.pathname;
        try {
          const file = await Deno.readFile(`dist${path}`);
          const ct = path.endsWith(".js")
            ? "application/javascript"
            : "text/html";
          return new Response(file, {
            headers: { "content-type": ct },
          });
        } catch {
          return new Response("not found", { status: 404 });
        }
      },
    );

    // 4. Launch headless Chrome (no --dump-dom, just load the page)
    const chromePath = "/usr/bin/google-chrome";
    const chrome = new Deno.Command(chromePath, {
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        `http://localhost:${HTTP_PORT}/`,
      ],
      stdout: "null",
      stderr: "null",
    });
    const chromeProcess = chrome.spawn();

    try {
      // 5. Wait for the result (with timeout)
      const timeout = setTimeout(() => {
        resultPromise.resolve("TEST_TIMEOUT");
      }, 30_000);

      const result = await resultPromise.promise;
      clearTimeout(timeout);

      if (result.startsWith("TEST_FAIL")) {
        throw new Error("Browser test failed: " + result);
      }
      if (result === "TEST_TIMEOUT") {
        throw new Error("Browser test timed out after 30s");
      }

      assert(result === "TEST_PASS", "Unexpected result: " + result);
    } finally {
      killProcess(chromeProcess);
      ac.abort();
      killProcess(hub);
    }
  },
});
