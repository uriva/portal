import { connect, generatePrivateKey } from "../../client/src/index.ts";

import { getPublicKey } from "../../common/src/crypto.ts";

// Imagine each of these segments happen on a different machine, with
// arbitrary networking setup.
// All Alice and Bob need to do to communicate is have the other party's public key
// (a small serializable json).
const alice = await generatePrivateKey();
const bob = await generatePrivateKey();

Promise.all([
  connect({
    privateKey: alice,
    onMessage: ({ from, payload }) =>
      Promise.resolve(console.log(`bob (${from}) says`, payload)),
    onClose: () => {},
  }),
  connect({
    privateKey: bob,
    onMessage: ({ from, payload }) =>
      Promise.resolve(console.log(`alice (${from}) says`, payload)),
    onClose: () => {},
  }),
]).then(([aliceSendMessage, bobSendMessage]) => {
  aliceSendMessage({
    to: getPublicKey(bob),
    payload: { text: "hello Bob! I've sent you this small json" },
  }).then(() => {
    console.log("Bob has acked!");
  });
  bobSendMessage({
    to: getPublicKey(alice),
    payload: "hello alice here's a string message",
  }).then(() => {
    console.log("Alice has acked!");
  });
});
