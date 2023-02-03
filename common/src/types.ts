export { err, ok, Result } from "npm:true-myth@6.2.0/result";

import {
  EncryptedShortString,
  PublicKey,
  RandomString,
  Signature,
} from "./crypto.ts";

export interface ServerChallengeMessage {
  type: "challenge";
  payload: {
    challenge: RandomString;
  };
}

export interface ClientIdentificationMessage {
  type: "id";
  payload: {
    publicKey: PublicKey;
    certificate: Signature;
  };
}

export interface ValidatedMessage {
  type: "validated";
}

export interface NotValidatedMessage {
  type: "bad-auth";
}

// deno-lint-ignore no-explicit-any
export type ClientMessage = any;

export interface UnderEncryption {
  from: PublicKey;
  payload: ClientMessage;
}

export interface RegularMessagePayload {
  certificate: Signature;
  to: PublicKey;
  payload: EncryptedShortString;
}

export interface ServerRegularMessage {
  type: "message";
  payload: RegularMessagePayload;
}

export type ServerMessage =
  | ValidatedMessage
  | ServerChallengeMessage
  | ServerRegularMessage;

export type ClientLibToServer =
  | ServerRegularMessage
  | ClientIdentificationMessage;
