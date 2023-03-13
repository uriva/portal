import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.174.0/testing/asserts.ts";
import {
  decrypt,
  encrypt,
  generatePrivateKey,
  getPublicKey,
  randomString,
  sign,
  verify,
} from "./crypto.ts";

Deno.test("encrypt and decrypt", async () => {
  const sender = generatePrivateKey();
  const recipient = generatePrivateKey();
  const data = randomString(1000);
  assertEquals(
    await decrypt(
      recipient,
      getPublicKey(sender),
      await encrypt(sender, getPublicKey(recipient), data),
    ),
    data,
  );
});

Deno.test("sign and verify", () => {
  const privateKey = generatePrivateKey();
  const data = randomString(1000);
  const signature = sign(privateKey, data);
  assertEquals(verify(getPublicKey(privateKey), signature, data), true);
  assertEquals(
    verify(getPublicKey(generatePrivateKey()), signature, data),
    false,
  );
});

Deno.test("generate a random string", () => {
  assertEquals(typeof randomString(10), "string");
  assertNotEquals(randomString(10), randomString(10));
  assertEquals(randomString(10).length, 10);
});
