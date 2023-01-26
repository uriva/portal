import * as crypto from "crypto";

const { publicEncrypt, generateKeyPairSync, randomBytes } = crypto;

export type PrivateKey = string;
export type PublicKey = string;
export type Signature = string;

export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}
const passphrase = "";
export const genKeyPair = () =>
  crypto.generateKeyPairSync("rsa", {
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
export const encrypt = (text, publicKey) =>
  crypto.publicEncrypt(publicKey, Buffer.from(text)).toString("base64");

export const decrypt = (ciphertext, privateKey) =>
  crypto
    .privateDecrypt(
      {
        key: privateKey,
        passphrase: "",
      },
      Buffer.from(ciphertext, "base64"),
    )
    .toString("utf8");

const SIGNATURE_METHOD = "RSA-SHA256";
const SIGNATURE_ENCODING = "hex";

export const verify = (
  publicKey: PublicKey,
  signature: Signature,
  str: string,
) =>
  crypto.verify(
    SIGNATURE_METHOD,
    Buffer.from(str),
    publicKey,
    Buffer.from(signature, SIGNATURE_ENCODING),
  );

export const sign = (privateKey: PrivateKey, str: string): Signature =>
  crypto
    .sign(SIGNATURE_METHOD, Buffer.from(str), privateKey)
    .toString(SIGNATURE_ENCODING);

export const randomString = () => randomBytes(64).toString("hex");
