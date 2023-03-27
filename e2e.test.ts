import {
  connect,
  generatePrivateKey,
  getPublicKey,
} from "./client/src/index.ts";

import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";

const alicePayload = { text: "hello Bob! I've sent you this json." };
const bobPayload = "hello Alice, here's a string message.";

const backendUrl = "wss://uriva-portal-mete6t9t7geg.deno.dev/";

const makeSocketFunctions = () => {
  const socket = new StandardWebSocketClient(backendUrl);
  socket.on("open", () => {
    console.debug("socket opened");
  });
  let resolveOuter: (() => void) | null = null;
  const closePromise = new Promise<void>((resolve) => {
    resolveOuter = resolve;
  });
  socket.on("close", () => {
    console.debug("socket closed");
    if (!resolveOuter) throw "should not happen";
    resolveOuter();
  });
  socket.on("error", (e: any) => {
    console.error(e);
  });
  return {
    close: () => {
      socket.close();
      return closePromise;
    },
    socketSend: (x: any) => socket.send(JSON.stringify(x)),
    socketReceive: (handler: (msg: any) => void) =>
      socket.on("message", ({ data }) => handler(JSON.parse(data.toString()))),
  };
};

Deno.test("e2e", async () => {
  const alice = generatePrivateKey();
  const bob = generatePrivateKey();
  const events: string[] = [];
  const aliceSocket = makeSocketFunctions();
  const bobSocket = makeSocketFunctions();
  await Promise.all([
    connect({
      ...aliceSocket,
      privateKey: alice,
      onMessage: ({ from, payload }) =>
        new Promise<void>((resolve) => {
          events.push("bob->alice");
          assertEquals(from, getPublicKey(bob));
          assertEquals(payload, bobPayload);
          resolve();
        }),
    }),
    connect({
      ...bobSocket,
      privateKey: bob,
      onMessage: ({ from, payload }) =>
        new Promise<void>((resolve) => {
          events.push("alice->bob");
          assertEquals(from, getPublicKey(alice));
          assertEquals(payload, alicePayload);
          resolve();
        }),
    }),
  ])
    .then(([aliceSend, bobSend]) =>
      Promise.all([
        aliceSend({ to: getPublicKey(bob), payload: alicePayload }).then(() => {
          events.push("bob-acked");
        }),
        bobSend({ to: getPublicKey(alice), payload: bobPayload }).then(() => {
          events.push("alice-acked");
        }),
      ]),
    )
    .then(() => {
      assertEquals(
        new Set(events),
        new Set(["alice->bob", "bob->alice", "bob-acked", "alice-acked"]),
      );
      return Promise.all([aliceSocket.close(), bobSocket.close()]);
    });
});
