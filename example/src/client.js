import { connect } from "portal";

const sendMessage = connect({ publicKey: "<server public key>" });

try {
  await sendMessage("hello server, this is client speaking");
  await sendMessage({ someKey: "i can send json too" });
} catch (e) {
  console.error(e);
}
