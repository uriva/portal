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

export const stringEncode = (str: string): ArrayBuffer =>
  new TextEncoder().encode(str).buffer;

export const stringDecode = (arr: ArrayBuffer): string =>
  new TextDecoder().decode(arr);

export const stringFromArrayBuffer = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((n) => String.fromCharCode(n))
    .join("");

export const arrayBufferFromString = (str: string): ArrayBuffer =>
  new Uint8Array(Array.from(str).map((c) => c.charCodeAt(0)));

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
      stringEncode(data)
    )
    .then(stringFromArrayBuffer);

export const decrypt = async (data: string, { encryption }: PrivateKey) =>
  crypto.subtle
    .decrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, encryption, encryptAlgo, true, [
        "decrypt",
      ]),
      arrayBufferFromString(data)
    )
    .then(stringDecode);

export const verify = async (
  { signing }: PublicKey,
  signature: Signature,
  data: string
) =>
  crypto.subtle.verify(
    signAlgo,
    await crypto.subtle.importKey(format, signing, signAlgo, false, ["verify"]),
    arrayBufferFromString(signature),
    stringEncode(data)
  );

export const sign = async ({ signing }: PrivateKey, data: string) =>
  crypto.subtle
    .sign(
      signAlgo,
      await crypto.subtle.importKey(format, signing, signAlgo, false, ["sign"]),
      stringEncode(data)
    )
    .then(stringFromArrayBuffer);

export const randomString = () => cryptoRandomString({ length: 64 });
