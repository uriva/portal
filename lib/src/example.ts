import { connect } from "./layer1";
import { crypto } from "shared";

const { publicKey, privateKey } = crypto.genKeyPair();

connect({
  publicKey,
  privateKey,
  onMessage: (m) => console.log("message arrived back to client", m),
  onClose: () => {
    console.log("closed socket");
  },
}).then(async (sendMessage) => {
  console.log("connection established");
  try {
    sendMessage({ to: publicKey, payload: "hello" });
    sendMessage({
      to: publicKey,
      payload: { text: "i can send json too" },
    });
    console.log("sent messages");
  } catch (e) {
    console.error(e);
  }
});
