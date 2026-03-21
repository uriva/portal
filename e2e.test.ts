import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import {
  connect,
  generatePrivateKey,
  getPublicKey,
} from "./client/src/index.ts";

const TEST_PORT = 9876;
const HUB_URL = `ws://localhost:${TEST_PORT}/`;

// Sanitizers disabled because subprocess + websocket connections create
// async ops that Deno's test runner can't track across process boundaries.
const testOpts = { sanitizeResources: false, sanitizeOps: false };

let hubProcess: Deno.ChildProcess | null = null;

const startHub = async (port = TEST_PORT): Promise<Deno.ChildProcess> => {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--no-check",
      "--allow-net",
      "--allow-env",
      "--allow-import",
      "hub/src/index.ts",
    ],
    env: { port: String(port) },
    stdout: "null",
    stderr: "null",
  });
  const process = cmd.spawn();
  const url = `ws://localhost:${port}/`;
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

const killHub = async (process: Deno.ChildProcess) => {
  try {
    process.kill("SIGTERM");
  } catch {
    // already dead
  }
  // Wait a bit for the port to free up
  await new Promise((r) => setTimeout(r, 200));
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Tests ---

Deno.test({
  name: "e2e: two clients exchange messages via local hub",
  ...testOpts,
  fn: async () => {
    const hub = await startHub();
    try {
      const alice = generatePrivateKey();
      const bob = generatePrivateKey();

      const alicePayload = { text: "hello Bob! I've sent you this json." };
      const bobPayload = "hello Alice, here's a string message.";

      const events: string[] = [];

      const [aliceFn, bobFn] = await Promise.all([
        connect({
          privateKey: alice,
          hubUrl: HUB_URL,
          reconnect: false,
          onMessage: ({ from, payload }) =>
            new Promise<void>((resolve) => {
              events.push("bob->alice");
              assertEquals(from, getPublicKey(bob));
              assertEquals(payload, bobPayload);
              resolve();
            }),
          onClose: () => {},
        }),
        connect({
          privateKey: bob,
          hubUrl: HUB_URL,
          reconnect: false,
          onMessage: ({ from, payload }) =>
            new Promise<void>((resolve) => {
              events.push("alice->bob");
              assertEquals(from, getPublicKey(alice));
              assertEquals(payload, alicePayload);
              resolve();
            }),
          onClose: () => {},
        }),
      ]);

      await Promise.all([
        aliceFn
          .send({ to: getPublicKey(bob), payload: alicePayload })
          .then(() => events.push("bob-acked")),
        bobFn
          .send({ to: getPublicKey(alice), payload: bobPayload })
          .then(() => events.push("alice-acked")),
      ]);

      assertEquals(
        new Set(events),
        new Set(["alice->bob", "bob->alice", "bob-acked", "alice-acked"]),
      );

      aliceFn.close();
      bobFn.close();
    } finally {
      await killHub(hub);
    }
  },
});

Deno.test({
  name: "e2e: hubUrl option works (connects to custom url)",
  ...testOpts,
  fn: async () => {
    const hub = await startHub();
    try {
      const key = generatePrivateKey();
      const fn = await connect({
        privateKey: key,
        hubUrl: HUB_URL,
        reconnect: false,
        onMessage: () => Promise.resolve(),
        onClose: () => {},
      });
      // If we got here, the connection succeeded with a custom hubUrl
      fn.close();
    } finally {
      await killHub(hub);
    }
  },
});

Deno.test({
  name: "e2e: ack timeout rejects when peer is missing",
  ...testOpts,
  fn: async () => {
    const hub = await startHub();
    try {
      const alice = generatePrivateKey();
      const bob = generatePrivateKey();

      const aliceFn = await connect({
        privateKey: alice,
        hubUrl: HUB_URL,
        reconnect: false,
        ackTimeoutMs: 500,
        onMessage: () => Promise.resolve(),
        onClose: () => {},
      });

      // Bob is not connected, so nobody will ack
      await assertRejects(
        () => aliceFn.send({ to: getPublicKey(bob), payload: "hello?" }),
        Error,
        "ack timeout",
      );

      aliceFn.close();
    } finally {
      await killHub(hub);
    }
  },
});

Deno.test({
  name: "e2e: pending acks rejected on close",
  ...testOpts,
  fn: async () => {
    const hub = await startHub();
    try {
      const alice = generatePrivateKey();
      const bob = generatePrivateKey();

      const aliceFn = await connect({
        privateKey: alice,
        hubUrl: HUB_URL,
        reconnect: false,
        ackTimeoutMs: 30_000,
        onMessage: () => Promise.resolve(),
        onClose: () => {},
      });

      // Send but don't await - bob is not connected so no ack will come
      const sendPromise = aliceFn.send({
        to: getPublicKey(bob),
        payload: "will never arrive",
      });

      // Close immediately - should reject the pending ack
      await delay(50);
      aliceFn.close();

      await assertRejects(
        () => sendPromise,
        Error,
        "connection closed",
      );
    } finally {
      await killHub(hub);
    }
  },
});

Deno.test({
  name: "e2e: replay protection rejects stale timestamps",
  ...testOpts,
  fn: async () => {
    const hub = await startHub();
    try {
      const alice = generatePrivateKey();
      const bob = generatePrivateKey();

      let bobReceivedMessage = false;

      const bobFn = await connect({
        privateKey: bob,
        hubUrl: HUB_URL,
        reconnect: false,
        onMessage: () => {
          bobReceivedMessage = true;
          return Promise.resolve();
        },
        onClose: () => {},
      });

      // Connect a raw websocket as "alice" and send a message with stale timestamp
      const { encrypt, sign, getPublicKey: getPub } = await import(
        "./common/src/crypto.ts"
      );

      const ws = new WebSocket(HUB_URL);
      await new Promise<void>((resolve) => {
        ws.onmessage = (event: MessageEvent) => {
          const msg = JSON.parse(String(event.data));
          if (msg.type === "challenge") {
            ws.send(
              JSON.stringify({
                type: "id",
                payload: {
                  publicKey: getPub(alice),
                  certificate: sign(alice, msg.payload.challenge),
                },
              }),
            );
          }
          if (msg.type === "validated") resolve();
        };
      });

      // Send message with timestamp 10 minutes in the past (exceeds 5 min max age)
      const staleTimestamp = Date.now() - 10 * 60 * 1000;
      const innerPayload = JSON.stringify({
        type: "message",
        payload: { id: "test1", payload: "stale" },
      });
      const encPayload = await encrypt(alice, getPub(bob), innerPayload);
      const signableStr = encPayload + getPub(bob) + staleTimestamp;
      ws.send(
        JSON.stringify({
          type: "message",
          payload: {
            to: getPub(bob),
            from: getPub(alice),
            payload: encPayload,
            timestamp: staleTimestamp,
            certificate: sign(alice, signableStr),
          },
        }),
      );

      await delay(500);

      assert(
        !bobReceivedMessage,
        "bob should not have received the stale message",
      );

      ws.close();
      bobFn.close();
    } finally {
      await killHub(hub);
    }
  },
});

Deno.test({
  name: "e2e: reconnection after hub restart",
  ...testOpts,
  fn: async () => {
    let hub = await startHub();
    try {
      const alice = generatePrivateKey();
      const bob = generatePrivateKey();

      const received: string[] = [];

      // Use low-level connect (from connect.ts) to avoid ack complexity during reconnect
      const { connect: rawConnect } = await import("./client/src/connect.ts");

      const aliceFn = await rawConnect({
        privateKey: alice,
        hubUrl: HUB_URL,
        reconnect: true,
        maxReconnectDelayMs: 500,
        onMessage: ({ payload }) => {
          received.push(payload as string);
        },
        onClose: () => {},
      });

      // Kill the hub
      await killHub(hub);
      await delay(1000);

      // Restart the hub
      hub = await startHub();
      // Give alice time to reconnect
      await delay(2000);

      // Connect bob and send a raw message (no ack layer)
      const bobFn = await rawConnect({
        privateKey: bob,
        hubUrl: HUB_URL,
        reconnect: false,
        onMessage: () => {},
        onClose: () => {},
      });

      bobFn.send({ to: getPublicKey(alice), payload: "after reconnect" });

      // Wait for alice to receive it
      await delay(1000);

      assert(received.length >= 1, "alice should have received at least one message");
      assert(
        received.includes("after reconnect"),
        "alice should have received the reconnect message",
      );

      aliceFn.close();
      bobFn.close();
    } finally {
      await killHub(hub);
    }
  },
});
