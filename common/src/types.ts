import { PublicKey, Signature } from "./crypto.ts";

export interface ServerChallengeMessage {
  type: "challenge";
  payload: {
    challenge: string;
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

export type ClientMessage = any;

export interface UnderEncryption {
  from: PublicKey;
  payload: ClientMessage;
}

export interface RegularMessagePayload {
  certificate: Signature;
  to: PublicKey;
  payload: UnderEncryption;
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
