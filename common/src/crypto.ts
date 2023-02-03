import { Sha256 } from "https://deno.land/std@0.119.0/hash/sha256.ts";
import { cryptoRandomString } from "https://deno.land/x/crypto_random_string@1.0.0/mod.ts";

export type PrivateKey = { signing: JsonWebKey; decryption: JsonWebKey };
export type PublicKey = { verification: JsonWebKey; encryption: JsonWebKey };
export type KeyPair = {
  publicKey: PublicKey;
  privateKey: PrivateKey;
};

export type EncryptedShortString = string;
export type EncryptedBigData = {
  encrypted: number[];
  iv: number[];
};
export type Signature = string;
export type RandomString = string;

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

export const genKeyPair = async (): Promise<KeyPair> => {
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
      decryption: await exportJWK(encryptionKeyPair.privateKey),
    },
    publicKey: {
      verification: await exportJWK(signingKeyPair.publicKey),
      encryption: await exportJWK(encryptionKeyPair.publicKey),
    },
  };
};

export const encrypt = async (
  data: string,
  { encryption }: PublicKey,
): Promise<EncryptedShortString> => {
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
  data: EncryptedShortString,
  { decryption }: PrivateKey,
) =>
  crypto.subtle
    .decrypt(
      encryptAlgo,
      await crypto.subtle.importKey(format, decryption, encryptAlgo, true, [
        "decrypt",
      ]),
      arrayBufferFromString(data),
    )
    .then(stringDecode);

export const verify = async (
  { verification }: PublicKey,
  signature: Signature,
  data: string,
) =>
  crypto.subtle.verify(
    signAlgo,
    await crypto.subtle.importKey(format, verification, signAlgo, false, [
      "verify",
    ]),
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

const hashJWK = (x: JsonWebKey): Sha256 =>
  new Sha256().update(JSON.stringify(sortObjKeys(x as StrObject)));

export const hashPublicKey = (
  { encryption, verification }: PublicKey,
): string =>
  new Sha256()
    .update(hashJWK(encryption).arrayBuffer())
    .update(hashJWK(verification).arrayBuffer())
    .toString();

export const comparePublicKeys = (p1: PublicKey, p2: PublicKey) =>
  hashPublicKey(p1) === hashPublicKey(p2);

const createSymmetricKey = () =>
  crypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 128,
    },
    true,
    ["encrypt", "decrypt"],
  );

const encryptSymmetric = async (
  key: CryptoKey,
  data: string,
): Promise<EncryptedBigData> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(128 / 8));
  return {
    iv: Array.from(iv),
    encrypted: Array.from(
      new Uint8Array(
        await window.crypto.subtle.encrypt(
          {
            name: "AES-CBC",
            iv,
          },
          key,
          new TextEncoder().encode(data),
        ),
      ),
    ),
  };
};

const symmetricAlgo = {
  name: "AES-CBC",
};

export const decryptLongString = async (
  privateKey: PrivateKey,
  { symmetricKey, data: { encrypted, iv } }: EncryptedStringWithSymmetricKey,
) =>
  new TextDecoder().decode(
    await window.crypto.subtle.decrypt(
      {
        ...symmetricAlgo,
        iv: new Uint8Array(iv),
      },
      await crypto.subtle.importKey(
        format,
        JSON.parse(await decrypt(symmetricKey, privateKey)),
        symmetricAlgo,
        false,
        ["encrypt", "decrypt"],
      ),
      new Uint8Array(encrypted),
    ),
  );

export type EncryptedStringWithSymmetricKey = {
  data: EncryptedBigData;
  symmetricKey: EncryptedShortString;
};

export const encryptLongString = async (
  publicKey: PublicKey,
  dataToEncrypt: string,
): Promise<EncryptedStringWithSymmetricKey> => {
  const symmetricKeyUnencrypted = await createSymmetricKey();
  const [data, symmetricKey] = await Promise.all([
    encryptSymmetric(symmetricKeyUnencrypted, dataToEncrypt),
    encrypt(
      JSON.stringify(await exportJWK(symmetricKeyUnencrypted)),
      publicKey,
    ),
  ]);
  return { data, symmetricKey };
};
