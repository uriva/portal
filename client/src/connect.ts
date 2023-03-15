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
import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { types } from "../../common/src/index.ts";

export interface IncomingMessage {
  from: PublicKey;
  payload: types.ClientMessage;
}

export interface ConnectOptions {
  privateKey: PrivateKey;
  onMessage: (message: IncomingMessage) => void;
  onClose: () => void;
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
  privateKey,
  onMessage,
  onClose,
}: ConnectOptions): Promise<{
  send: (message: ClientToLib) => void;
  close: () => void;
}> =>
  new Promise((resolve, reject) => {
    const socket = new StandardWebSocketClient(
      Deno.env.get("url") || "wss://uriva-portal-mete6t9t7geg.deno.dev/",
    );
    const sendThruSocket = (message: types.ClientLibToServer) =>
      socket.send(JSON.stringify(message));
    socket.on("open", () => {
      console.debug("socket opened");
    });
    socket.on("error", () => {
      reject("could not open connection");
    });
    socket.on("close", onClose);
    socket.on("message", async ({ data }) => {
      const message: types.ServerMessage = JSON.parse(data.toString());
      if (message.type === "validated") {
        console.debug("socket validated");
        resolve({
          close: () => socket.close(),
          send: (message) =>
            encryptAndSign(
              message.to,
              privateKey,
            )(message).then(sendThruSocket),
        });
      }
      if (message.type === "challenge") {
        console.debug("got challenge");
        const { challenge } = message.payload;
        sendThruSocket({
          type: "id",
          payload: {
            publicKey: getPublicKey(privateKey),
            certificate: sign(privateKey, challenge),
          },
        });
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
        onMessage({
          payload: JSON.parse(await decrypt(privateKey, from, payload)),
          from,
        });
      }
    });
  });
