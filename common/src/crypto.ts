import { Md5 } from "https://deno.land/std@0.119.0/hash/md5.ts";
import { cryptoRandomString } from "https://deno.land/x/crypto_random_string@1.0.0/mod.ts";

export type PrivateKey = { signing: JsonWebKey; encryption: JsonWebKey };
export type PublicKey = { signing: JsonWebKey; encryption: JsonWebKey };
export type EncryptedString = string;
export type Signature = string;
export type RandomString = string;
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
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: "SHA-256",
};

const format = "jwk";

const stringEncode = (str: string): ArrayBuffer =>
  new TextEncoder().encode(str).buffer;

const stringDecode = (arr: ArrayBuffer): string =>
  new TextDecoder().decode(arr);

const stringFromArrayBuffer = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((n) => String.fromCharCode(n))
    .join("");

const arrayBufferFromString = (str: string): ArrayBuffer =>
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

export const encrypt = async (
  data: string,
  { encryption }: PublicKey,
): Promise<EncryptedString> => {
  if (data.length > maxMessageLength) throw "string is too long to encrypt";
  return crypto.subtle
    .encrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, encryption, encryptAlgo, true, [
        "encrypt",
      ]),
      stringEncode(data),
    )
    .then(stringFromArrayBuffer);
};

export const decrypt = async (
  data: EncryptedString,
  { encryption }: PrivateKey,
) =>
  crypto.subtle
    .decrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, encryption, encryptAlgo, true, [
        "decrypt",
      ]),
      arrayBufferFromString(data),
    )
    .then(stringDecode);

export const verify = async (
  { signing }: PublicKey,
  signature: Signature,
  data: string,
) =>
  crypto.subtle.verify(
    signAlgo,
    await crypto.subtle.importKey(format, signing, signAlgo, false, ["verify"]),
    arrayBufferFromString(signature),
    stringEncode(data),
  );

export const sign = async ({ signing }: PrivateKey, data: string) =>
  crypto.subtle
    .sign(
      signAlgo,
      await crypto.subtle.importKey(format, signing, signAlgo, false, ["sign"]),
      stringEncode(data),
    )
    .then(stringFromArrayBuffer);

export const maxMessageLength = 446;

export const randomString = (length: number): RandomString =>
  cryptoRandomString({ length });

type StrObject = { [index: string]: string };
const sortObjKeys = (x: StrObject) =>
  Object.keys(x)
    .sort()
    .reduce((acc: { [index: string]: string }, key) => {
      acc[key] = x[key];
      return acc;
    }, {});

const hashJWK = (x: JsonWebKey) =>
  new Md5().update(JSON.stringify(sortObjKeys(x as StrObject))).toString();

export const hashPublicKey = ({ encryption, signing }: PublicKey) =>
  hashJWK(encryption) + hashJWK(signing);

export const comparePublicKeys = (p1: PublicKey, p2: PublicKey) =>
  hashPublicKey(p1) === hashPublicKey(p2);
