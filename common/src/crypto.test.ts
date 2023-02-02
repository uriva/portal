import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.174.0/testing/asserts.ts";
import {
  decrypt,
  encrypt,
  genKeyPair,
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
