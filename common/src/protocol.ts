import { err, ok, Result } from "./types.ts";

import {
  decryptLongString,
  EncryptedStringWithSymmetricKey,
  encryptLongString,
  hashPublicKey,
  KeyPair,
  PublicKey,
  sign,
  verify,
} from "./crypto.ts";

export type SecureMessage = {
  cipher: EncryptedStringWithSymmetricKey;
  signature: string;
  signer: PublicKey;
};

type PlainTextMessage = {
  data: unknown;
  from: string;
};

export const encryptAndSign = async (
  you: PublicKey,
  me: KeyPair,
  data: unknown,
): Promise<SecureMessage> => {
  const message: PlainTextMessage = {
    from: hashPublicKey(me.publicKey),
    data,
  };

  const cipher = await encryptLongString(you, JSON.stringify(message));
  const signature = await sign(me.privateKey, JSON.stringify(cipher));

  return {
    cipher,
    signature,
    signer: me.publicKey,
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
  message: SecureMessage,
): Promise<Result<VerifiedMessage, { reason: VerificationError }>> => {
  if (
    !await verify(
      message.signer,
      message.signature,
      JSON.stringify(message.cipher),
    )
  ) {
    return err({ reason: SignatureDoesNotMatchError });
  }

  // TODO: Type checking??
  const plaintextMessage: PlainTextMessage = JSON.parse(
    await decryptLongString(me.privateKey, message.cipher),
  );

  if (plaintextMessage.from != hashPublicKey(message.signer)) {
    return err({ reason: MessageNotFromSignerError });
  }

  return ok({
    data: plaintextMessage.data,
    from: message.signer,
  });
};
