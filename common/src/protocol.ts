import { err, ok, Result } from "./types.ts";

import {
  decrypt,
  encrypt,
  hashPublicKey,
  KeyPair,
  PublicKey,
  sign,
  verify,
} from "./crypto.ts";

export type SecureShortMessage = {
  cipher: string;
  signature: string;
  signer: string;
};

type PlainTextMessageFormat = {
  // deno-lint-ignore no-explicit-any
  data: any;
  from: string;
};

export const encryptAndSign = async (
  you: PublicKey,
  me: KeyPair,
  data: string,
): Promise<SecureShortMessage> => {
  const myPKHash = hashPublicKey(me.publicKey);

  const message: PlainTextMessageFormat = {
    from: myPKHash,
    data,
  };

  const cipher = await encrypt(JSON.stringify(message), you);
  const signature = await sign(me.privateKey, cipher);

  return {
    cipher,
    signature,
    signer: myPKHash,
  };
};

export type VerifiedMessage = {
  // deno-lint-ignore no-explicit-any
  data: any;
  from: PublicKey;
};

export type VerificationError =
  | "signature doesn't match"
  | "message not from the public key that signed it";

export const verifyAndDecrypt = async (
  me: KeyPair,
  message: SecureShortMessage,
  getPublicKeyFromHash: (arg0: string) => PublicKey,
): Promise<Result<VerifiedMessage, { reason: VerificationError }>> => {
  const signer = getPublicKeyFromHash(message.signer);
  const signatureMatches = await verify(
    signer,
    message.signature,
    message.cipher,
  );
  if (!signatureMatches) {
    return err({ reason: "signature doesn't match" });
  }

  // TODO: Type checking??
  const plaintextMessage: PlainTextMessageFormat = JSON.parse(
    await decrypt(message.cipher, me.privateKey),
  );

  if (message.signer != plaintextMessage.from) {
    return err({ reason: "message not from the public key that signed it" });
  }

  return ok({
    data: plaintextMessage.data,
    from: signer,
  });
};
