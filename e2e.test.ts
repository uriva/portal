import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import {
  connect,
  generatePrivateKey,
  getPublicKey,
} from "./client/src/index.ts";

const alicePayload = { text: "hello Bob! I've sent you this json." };
const bobPayload = "hello Alice, here's a string message.";

Deno.test("e2e", async () => {
  const alice = generatePrivateKey();
  const bob = generatePrivateKey();
  const events: string[] = [];
  await new Promise<void>((resolve) => {
    let closedCount = 0;
    const markClosed = () => {
      closedCount++;
      assert(closedCount <= 2);
      if (closedCount === 2) resolve();
    };
    Promise.all([
      connect({
        privateKey: alice,
        onMessage: ({ from, payload }) =>
          new Promise((resolve) => {
            events.push("bob->alice");
            assertEquals(from, getPublicKey(bob));
            assertEquals(payload, bobPayload);
            resolve();
          }),
        onClose: () => {
          markClosed();
        },
      }),
      connect({
        privateKey: bob,
        onMessage: ({ from, payload }) =>
          new Promise((resolve) => {
            events.push("alice->bob");
            assertEquals(from, getPublicKey(alice));
            assertEquals(payload, alicePayload);
            resolve();
          }),
        onClose: () => {},
      }),
    ])
      .then(([aliceFn, bobFn]) =>
        Promise.all([
          aliceFn
            .send({ to: getPublicKey(bob), payload: alicePayload })
            .then(() => {
              events.push("bob-acked");
            }),
          bobFn
            .send({ to: getPublicKey(alice), payload: bobPayload })
            .then(() => {
              events.push("alice-acked");
            }),
        ]).then(() => () => {
          aliceFn.close();
          bobFn.close();
        })
      )
      .then((close) => {
        assertEquals(
          new Set(events),
          new Set(["alice->bob", "bob->alice", "bob-acked", "alice-acked"]),
        );
        close();
      });
  });
});
