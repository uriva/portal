import * as crypto from "crypto";

const { publicEncrypt, generateKeyPairSync, randomBytes } = crypto;

export type PrivateKey = string;
export type PublicKey = string;
export type Signature = string;
export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}
export const genKeyPair: () => KeyPair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
  });

export const encrypt = (publicKey: PublicKey, str: string): string =>
  publicEncrypt(publicKey, Buffer.from(str)).toString();

export const decrypt = (privateKey: PrivateKey, str: string): string =>
  crypto.privateDecrypt(privateKey, Buffer.from(str)).toString();

export const sign = (privateKey: PrivateKey, str: string): Signature =>
  crypto.sign(null, Buffer.from(str), privateKey).toString();

export const verify = (
  publicKey: PublicKey,
  signature: Signature,
  str: string,
): boolean =>
  crypto.verify(null, Buffer.from(str), publicKey, Buffer.from(signature));

export const randomString = () => randomBytes(64).toString("hex");
