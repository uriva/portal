import {
  PrivateKey,
  PublicKey,
  decrypt,
  encrypt,
  getPublicKey,
  sign,
  verify,
} from "../../common/src/crypto.ts";

import { ServerRegularMessage } from "../../common/src/types.ts";
import { types } from "../../common/src/index.ts";

export interface IncomingMessage {
  from: PublicKey;
  payload: types.ClientMessage;
}

interface ConnectOptions {
  privateKey: PrivateKey;
  onMessage: (message: IncomingMessage) => void;
  socketSend: (msg: types.ClientLibToServer) => void;
  socketReceive: (handler: (msg: types.ServerMessage) => void) => void;
}

interface ClientToLib {
  to: PublicKey;
  payload: types.ClientMessage;
}

const signableString = (encryptedPayload: string, to: PublicKey) =>
  encryptedPayload + to;

const signEncryptedMessage =
  (privateKey: PrivateKey, to: PublicKey) =>
  (encryptedStr: string): ServerRegularMessage => ({
    type: "message",
    payload: {
      to,
      from: getPublicKey(privateKey),
      payload: encryptedStr,
      certificate: sign(privateKey, signableString(encryptedStr, to)),
    },
  });

const encryptAndSign =
  (publicKey: PublicKey, privateKey: PrivateKey) =>
  ({ payload, to }: ClientToLib): Promise<ServerRegularMessage> =>
    encrypt(privateKey, publicKey, JSON.stringify(payload)).then(
      signEncryptedMessage(privateKey, to),
    );

export const connect = ({
  socketReceive,
  socketSend,
  privateKey,
  onMessage,
}: ConnectOptions): Promise<(message: ClientToLib) => void> =>
  new Promise((resolve, reject) => {
    socketReceive((message: types.ServerMessage) => {
      if (message.type === "validated") {
        console.debug("socket validated");
        resolve((message) =>
          encryptAndSign(message.to, privateKey)(message).then(socketSend),
        );
      }
      if (message.type === "challenge") {
        console.debug("got challenge");
        const { challenge } = message.payload;
        socketSend({
          type: "id",
          payload: {
            publicKey: getPublicKey(privateKey),
            certificate: sign(privateKey, challenge),
          },
        });
      }
      if (message.type === "bad-auth") {
        reject("bad credentials");
      }
      if (message.type === "message") {
        const { payload, certificate, from } = message.payload;
        if (
          !verify(
            from,
            certificate,
            signableString(payload, getPublicKey(privateKey)),
          )
        ) {
          console.error("ignoring a message with bad certificate");
          return;
        }
        decrypt(privateKey, from, payload)
          .then(JSON.parse)
          .then((payload) => ({ payload, from }))
          .then(onMessage);
      }
    });
  });
