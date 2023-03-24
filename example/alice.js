const { connect, getPublicKey } = require("message-portal");

const alice =
  "a0df4297637a6d0087414e6cb8d295f4284a42fb1da38362ee0c17e31765dd03";
const bob = "f353ce7b4df97a8db6ec6dc2acafee09b4e84848a1fd0f9a1066fa926112f791";

connect({
  privateKey: alice,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(`Bob (${from}) says`, payload)),
  onClose: () => {
    console.log("socket disconnected");
  },
}).then(({ send }) => {
  setInterval(() => {
    console.log("sending");
    send({
      to: getPublicKey(bob),
      payload: "hello from Alice.",
    }).then(() => {
      console.log("Bob has acked!");
    });
  }, 5000);
});
