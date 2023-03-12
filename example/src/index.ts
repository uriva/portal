import { connect, genKeyPair } from "../../client/src/index.ts";

// Imagine each of these segments happen on a different machine, with
// arbitrary networking setup.
// All Alice and Bob need to do to communicate is have the other party's public key
// (a small serializable json).
const alice = await genKeyPair();
const bob = await genKeyPair();

connect({
  publicKey: alice.publicKey,
  privateKey: alice.privateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(`bob (${from}) says`, payload)),
  onClose: () => {},
}).then((sendMessage) => {
  sendMessage({
    to: bob.publicKey,
    payload: { text: "hello Bob! I've sent you this small json" },
  }).then(() => {
    console.log("Bob has acked!");
  });
});

connect({
  publicKey: bob.publicKey,
  privateKey: bob.privateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(`alice (${from}) says`, payload)),
  onClose: () => {},
}).then((sendMessage) => {
  sendMessage({
    to: alice.publicKey,
    payload: "hello alice here's a string message",
  }).then(() => {
    console.log("Alice has acked!");
  });
});
