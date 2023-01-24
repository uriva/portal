import { Certificate, PrivateKey, PublicKey } from "./crypto";

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
    certificate: Certificate;
  };
}

export interface ValidatedMessage {
  type: "validated";
}

export interface NotValidatedMessage {
  type: "bad-auth";
}

export type ClientMessage = any;

export interface RegularMessagePayload {
  certificate: Certificate;
  from: PublicKey;
  to: PublicKey;
  payload: ClientMessage;
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
