import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.174.0/testing/asserts.ts";

import {
  encryptAndSign,
  MessageNotFromSignerError,
  SignatureDoesNotMatchError,
  verifyAndDecrypt,
} from "./protocol.ts";
import { genKeyPair, sign } from "./crypto.ts";

Deno.test("verify a secure message", async () => {
  const testMessage = "A test message!";

  const [senderKey, receiverKey] = await Promise.all(
    [genKeyPair(), genKeyPair()],
  );

  const secureMessage = await encryptAndSign(
    receiverKey.publicKey,
    senderKey,
    testMessage,
  );

  const recoveredMessage = await verifyAndDecrypt(
    receiverKey,
    secureMessage,
  );

  assert(recoveredMessage.isOk);
  assertEquals(recoveredMessage.value.from, senderKey.publicKey);
  assertEquals(recoveredMessage.value.data, testMessage);
});

Deno.test("attacker fails to spoof a signature", async () => {
  const [senderKey, receiverKey, attackerKey] = await Promise.all(
    [genKeyPair(), genKeyPair(), genKeyPair()],
  );

  const authenticMessage = await encryptAndSign(
    receiverKey.publicKey,
    senderKey,
    "A test message!",
  );

  const spoofedSignature = await sign(
    attackerKey.privateKey,
    authenticMessage.cipher,
  );

  const spoofedMessage = {
    cipher: authenticMessage.cipher,
    signature: spoofedSignature,
    signer: attackerKey.publicKey,
  };

  const recoveredMessage = await verifyAndDecrypt(
    receiverKey,
    spoofedMessage,
  );

  assert(recoveredMessage.isErr);
  assertEquals(
    recoveredMessage.error.reason,
    MessageNotFromSignerError,
  );
});

Deno.test("attacker fails to tamper a message", async () => {
  const [senderKey, receiverKey] = await Promise.all(
    [genKeyPair(), genKeyPair()],
  );

  const secureMessage = await encryptAndSign(
    receiverKey.publicKey,
    senderKey,
    "A test message!",
  );

  const spoofedCipher = "x" + secureMessage.cipher.substring(
    1,
    secureMessage.cipher.length,
  );
  secureMessage.cipher = spoofedCipher;

  const recoveredMessage = await verifyAndDecrypt(
    receiverKey,
    secureMessage,
  );

  assert(recoveredMessage.isErr);
  assertEquals(
    recoveredMessage.error.reason,
    SignatureDoesNotMatchError,
  );
});
