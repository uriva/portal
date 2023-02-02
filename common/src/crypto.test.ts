import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.174.0/testing/asserts.ts";
import {
  decrypt,
  encrypt,
  genKeyPair,
  hashPublicKey,
  randomString,
  sign,
  verify,
} from "./crypto.ts";

Deno.test("encrypt and decrypt", async () => {
  const { privateKey, publicKey } = await genKeyPair();
  const data = "hello i am some data";
  assertEquals(await decrypt(await encrypt(data, publicKey), privateKey), data);
});

Deno.test("sign and verify", async () => {
  const { publicKey, privateKey } = await genKeyPair();
  const data = "hello i am some data";
  const signature = await sign(privateKey, data);
  assertEquals(await verify(publicKey, signature, data), true);
  assertEquals(
    await verify((await genKeyPair()).publicKey, signature, data),
    false,
  );
});

Deno.test("generate a random string", () => {
  assertEquals(typeof randomString(), "string");
  assertNotEquals(randomString(), randomString());
});

Deno.test("hash public keys", async () => {
  const [k1, k2] = await Promise.all([genKeyPair(), genKeyPair()]);
  assertEquals(hashPublicKey(k1.publicKey), hashPublicKey(k1.publicKey));
  assertNotEquals(hashPublicKey(k1.publicKey), hashPublicKey(k2.publicKey));
});
