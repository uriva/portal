import { connect, genKeyPair } from "../../client/src/index.ts";
import { hashPublicKey } from "../../common/src/crypto.ts";
import { RegularMessagePayload } from "../../common/src/types.ts";

const { publicKey, privateKey } = await genKeyPair();

connect({
  publicKey,
  privateKey,
  onMessage: ({ from, data }) =>
    Promise.resolve(
      console.log(
        hashPublicKey(from).slice(0, 10),
        "says",
        (data as RegularMessagePayload).payload,
      ),
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
