import { connect, genKeyPair } from "portal";

const { publicKey, privateKey } = genKeyPair();

connect({
  publicKey,
  privateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(from.slice(0, 10), "says", payload)),
  onClose: () => {
    console.log("closed socket");
  },
}).then(async (sendMessage) => {
  console.log("connection established");
  try {
    sendMessage({ to: publicKey, payload: "hello" }).then(() => {
      console.log("first message arrived");
    });
    console.log("sent first message");
    sendMessage({
      to: publicKey,
      payload: { text: "i can send json too" },
    }).then(() => {
      console.log("second message arrived");
    });
    console.log("sent second message");
  } catch (e) {
    console.error(e);
  }
});
