import { cryptoRandomString } from "https://deno.land/x/crypto_random_string@1.0.0/mod.ts";

export type PrivateKey = { signing: JsonWebKey; encryption: JsonWebKey };
export type PublicKey = { signing: JsonWebKey; encryption: JsonWebKey };
export type Signature = string;

export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

const signAlgo = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: "SHA-256",
};
const encryptAlgo = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: "SHA-256",
};

const format = "jwk";

const stringToUIntArray = (str: string) => new TextEncoder().encode(str);
const exportJWK = (key: CryptoKey) => crypto.subtle.exportKey(format, key);

export const genKeyPair = async () => {
  const signingKeyPair = await crypto.subtle.generateKey(signAlgo, true, [
    "sign",
    "verify",
  ]);
  const encryptionKeyPair = await crypto.subtle.generateKey(encryptAlgo, true, [
    "encrypt",
    "decrypt",
  ]);
  return {
    privateKey: {
      signing: await exportJWK(signingKeyPair.privateKey),
      encryption: await exportJWK(encryptionKeyPair.privateKey),
    },
    publicKey: {
      signing: await exportJWK(signingKeyPair.publicKey),
      encryption: await exportJWK(encryptionKeyPair.publicKey),
    },
  };
};

export const encrypt = async (data: string, { encryption }: PublicKey) =>
  crypto.subtle
    .encrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, encryption, encryptAlgo, true, [
        "encrypt",
      ]),
      stringToUIntArray(data),
    )
    .then((b) => b.toString());

export const decrypt = async (data: string, { encryption }: PrivateKey) =>
  crypto.subtle
    .decrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, encryption, encryptAlgo, true, [
        "decrypt",
      ]),
      stringToUIntArray(data),
    )
    .then((b) => b.toString());

export const verify = async (
  { signing }: PublicKey,
  signature: Signature,
  data: string,
) =>
  crypto.subtle.verify(
    signAlgo,
    await crypto.subtle.importKey(format, signing, signAlgo, false, ["verify"]),
    stringToUIntArray(signature),
    stringToUIntArray(data),
  );

export const sign = async ({ signing }: PrivateKey, data: string) =>
  crypto.subtle
    .sign(
      signAlgo,
      await crypto.subtle.importKey(format, signing, signAlgo, false, ["sign"]),
      stringToUIntArray(data),
    )
    .then((b) => b.toString());

export const randomString = () => cryptoRandomString({ length: 64 });
