import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import * as secp256k1 from "https://deno.land/x/secp256k1@1.7.2/mod.ts";
import { sha256 } from "npm:@noble/hashes@1.3.3/sha256";

export type PrivateKey = ReturnType<typeof generatePrivateKey>;
export type PublicKey = ReturnType<typeof getPublicKey>;
export type Signature = ReturnType<typeof sign>;

export const generatePrivateKey = (): string =>
  secp256k1.utils.bytesToHex(secp256k1.utils.randomPrivateKey());

export const getPublicKey = (privateKey: string): string =>
  secp256k1.utils.bytesToHex(secp256k1.schnorr.getPublicKey(privateKey));

export const verify = (
  publicKey: PublicKey,
  signature: Signature,
  data: string,
) => secp256k1.schnorr.verifySync(signature, sha256(data), publicKey);

export const sign = (privateKey: PrivateKey, data: string) =>
  secp256k1.utils.bytesToHex(
    secp256k1.schnorr.signSync(sha256(data), privateKey),
  );

export type RandomString = string;

export const randomString = (length: number): RandomString =>
  encodeBase64(secp256k1.utils.randomBytes(Math.ceil((length * 3) / 4)))
    .slice(0, length);

const getNormalizedX = (key: Uint8Array): Uint8Array => new Uint8Array(key.slice(1, 33));
export type EncryptedString = string;
export const encrypt = async (
  privKey: PrivateKey,
  pubKey: PublicKey,
  text: string,
): Promise<EncryptedString> => {
  const iv = new Uint8Array(secp256k1.utils.randomBytes(16));
  return `${encodeBase64(
    new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-CBC", iv },
        await crypto.subtle.importKey(
          "raw",
          new Uint8Array(getNormalizedX(secp256k1.getSharedSecret(privKey, "02" + pubKey))),
          { name: "AES-CBC" },
          false,
          ["encrypt"],
        ),
        new TextEncoder().encode(text),
      ),
    ),
  )}?iv=${encodeBase64(iv)}`;
};

export const decrypt = async (
  privKey: PrivateKey,
  pubKey: PublicKey,
  data: string,
): Promise<string> => {
  const [ctb64, ivb64] = data.split("?iv=");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: decodeBase64(ivb64) },
      await crypto.subtle.importKey(
        "raw",
        new Uint8Array(getNormalizedX(secp256k1.getSharedSecret(privKey, "02" + pubKey))),
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      ),
      decodeBase64(ctb64),
    ),
  );
};
