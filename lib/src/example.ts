import { connect } from "./layer1";

const myPublicKey = "<server public key>";
connect({
  publicKey: myPublicKey,
  privateKey: "<some private key",
  onMessage: console.log,
  onClose: () => {
    console.log("closed socket");
  },
}).then(async (sendMessage) => {
  console.log("connection established");
  try {
    sendMessage({ to: myPublicKey, payload: "hello" });
    sendMessage({
      to: myPublicKey,
      payload: { text: "i can send json too" },
    });
    console.log("sent messages");
  } catch (e) {
    console.error(e);
  }
});
