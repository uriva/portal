import { Certificate, PrivateKey, PublicKey } from "./crypto";

export interface ServerChallengeMessage {
  type: "challenge";
  payload: {
    challenge: string;
  };
}

export interface ValidatedMessage {
  type: "validated";
}

export type ClientMessage = any;

export interface ServerRegularMessage {
  type: "message";
  payload: {
    certificate: Certificate;
    from: PublicKey;
    to: PublicKey;
    payload: ClientMessage;
  };
}

export type ServerMessage =
  | ValidatedMessage
  | ServerChallengeMessage
  | ServerRegularMessage;
