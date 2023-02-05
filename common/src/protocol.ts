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

type PlainTextMessage = {
  data: unknown;
  from: string;
};

export const encryptAndSign = async (
  you: PublicKey,
  me: KeyPair,
  data: unknown,
): Promise<SecureShortMessage> => {
  const myPKHash = hashPublicKey(me.publicKey);

  const message: PlainTextMessage = {
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
  data: unknown;
  from: PublicKey;
};

export const SignatureDoesNotMatchError = "signature doesn't match";
export const MessageNotFromSignerError =
  "message not from the public key that signed it";
export type VerificationError =
  | typeof SignatureDoesNotMatchError
  | typeof MessageNotFromSignerError;

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
    return err({ reason: SignatureDoesNotMatchError });
  }

  // TODO: Type checking??
  const plaintextMessage: PlainTextMessage = JSON.parse(
    await decrypt(message.cipher, me.privateKey),
  );

  if (message.signer != plaintextMessage.from) {
    return err({ reason: MessageNotFromSignerError });
  }

  return ok({
    data: plaintextMessage.data,
    from: signer,
  });
};
