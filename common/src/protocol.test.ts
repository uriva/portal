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

Deno.test("encrypt and verify a long message", async () => {
  const longMessage = "A long message!".repeat(512);

  const [senderKey, receiverKey] = await Promise.all(
    [genKeyPair(), genKeyPair()],
  );

  const secureMessage = await encryptAndSign(
    receiverKey.publicKey,
    senderKey,
    longMessage,
  );

  const recoveredMessage = await verifyAndDecrypt(
    receiverKey,
    secureMessage,
  );

  assert(recoveredMessage.isOk);
  assertEquals(recoveredMessage.value.from, senderKey.publicKey);
  assertEquals(recoveredMessage.value.data, longMessage);
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
    JSON.stringify(authenticMessage.cipher),
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

  secureMessage.cipher.data.encrypted = secureMessage.cipher.data.encrypted
    .slice(-1).concat(666);

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
