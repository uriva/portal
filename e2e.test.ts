import {
  connect,
  generatePrivateKey,
  getPublicKey,
} from "./client/src/index.ts";

Deno.test("e2e", () => {
  const alice = generatePrivateKey();
  const bob = generatePrivateKey();

  connect({
    privateKey: alice,
    onMessage: ({ from, payload }) =>
      Promise.resolve(console.log(`Bob (${from}) says`, payload)),
    onClose: () => {},
  }).then((sendMessage) => {
    sendMessage({
      to: getPublicKey(bob),
      payload: { text: "hello Bob! I've sent you this json." },
    }).then(() => {
      console.log("Bob has acked!");
    });
  });

  connect({
    privateKey: bob,
    onMessage: ({ from, payload }) =>
      Promise.resolve(console.log(`Alice (${from}) says`, payload)),
    onClose: () => {},
  }).then((sendMessage) => {
    sendMessage({
      to: getPublicKey(alice),
      payload: "hello Alice, here's a string message.",
    }).then(() => {
      console.log("Alice has acked!");
    });
  });
});
