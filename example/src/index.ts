import { connect, genKeyPair } from "../../client/src/index.ts";

const { publicKey, privateKey } = await genKeyPair();

connect({
  publicKey,
  privateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(
      console.log(JSON.stringify(from).slice(0, 10), "says", payload),
    ),
  onClose: () => {
    console.log("closed socket");
  },
}).then((sendMessage) => {
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
