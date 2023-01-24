import {
  decrypt,
  encrypt,
  genKeyPair,
  randomString,
  sign,
  verify,
} from "./crypto";

describe("testing crypto functions", () => {
  test("keypair outputs strings", () => {
    const { publicKey, privateKey } = genKeyPair();
    expect(typeof publicKey).toEqual("string");
    expect(typeof privateKey).toEqual("string");
  });

  test("encrypt and decrypt", () => {
    const { privateKey } = genKeyPair();
    const data = "hello i am some data";
    expect(decrypt(privateKey, encrypt(privateKey, data))).toEqual(data);
  });

  test("sign and verify", () => {
    const { publicKey, privateKey } = genKeyPair();
    const data = "hello i am some data";
    const signature = sign(privateKey, data);
    expect(verify(publicKey, signature, data)).toBeTruthy();
    expect(verify(genKeyPair().publicKey, signature, data)).toBeFalsy();
  });

  test("generate a random string", () => {
    expect(typeof randomString()).toEqual("string");
    expect(randomString() === randomString()).toBeFalsy();
  });
});
