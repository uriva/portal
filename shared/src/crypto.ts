import * as crypto from "crypto";

const { publicEncrypt, privateDecrypt, generateKeyPairSync, randomBytes } =
  crypto;

export type PrivateKey = string;
export type PublicKey = string;
export type Signature = string;

export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

export const genKeyPair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 530,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
export const encrypt = (text: string, publicKey: PublicKey) =>
  publicEncrypt(publicKey, Buffer.from(text)).toString("base64");

export const decrypt = (ciphertext, privateKey) =>
  privateDecrypt(
    {
      key: privateKey,
      passphrase: "",
    },
    Buffer.from(ciphertext, "base64"),
  ).toString("utf8");

const SIGNATURE_ENCODING = "hex";

export const verify = (
  publicKey: PublicKey,
  signature: Signature,
  str: string,
) =>
  crypto.verify(
    null,
    Buffer.from(str),
    publicKey,
    Buffer.from(signature, SIGNATURE_ENCODING),
  );

export const sign = (privateKey: PrivateKey, str: string): Signature =>
  crypto.sign(null, Buffer.from(str), privateKey).toString(SIGNATURE_ENCODING);

export const randomString = () => randomBytes(64).toString("hex");
