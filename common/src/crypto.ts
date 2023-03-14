import * as base64 from "https://denopkg.com/chiefbiiko/base64@master/mod.ts";
import * as secp256k1 from "https://deno.land/x/secp256k1/mod.ts";

import { cryptoRandomString } from "https://deno.land/x/crypto_random_string@1.0.0/mod.ts";
import randomBytes from "https://deno.land/std@0.84.0/node/_crypto/randomBytes.ts";
import { sha256 } from "https://denopkg.com/chiefbiiko/sha256@v1.0.0/mod.ts";

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
  cryptoRandomString({ length });

const getNormalizedX = (key: Uint8Array): Uint8Array => key.slice(1, 33);
export type EncryptedString = string;
export const encrypt = async (
  privKey: PrivateKey,
  pubKey: PublicKey,
  text: string,
): Promise<EncryptedString> => {
  const iv = Uint8Array.from(randomBytes(16));
  return `${
    base64.fromUint8Array(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-CBC", iv },
          await crypto.subtle.importKey(
            "raw",
            getNormalizedX(secp256k1.getSharedSecret(privKey, "02" + pubKey)),
            { name: "AES-CBC" },
            false,
            ["encrypt"],
          ),
          new TextEncoder().encode(text),
        ),
      ),
    )
  }?iv=${base64.fromUint8Array(new Uint8Array(iv.buffer))}`;
};

export const decrypt = async (
  privKey: PrivateKey,
  pubKey: PublicKey,
  data: string,
): Promise<string> => {
  const [ctb64, ivb64] = data.split("?iv=");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: base64.toUint8Array(ivb64) },
      await crypto.subtle.importKey(
        "raw",
        getNormalizedX(secp256k1.getSharedSecret(privKey, "02" + pubKey)),
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      ),
      base64.toUint8Array(ctb64),
    ),
  );
};
