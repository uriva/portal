import { crypto, types } from "../../common/src/index.ts";

import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

type ServerMessage = types.ServerMessage;
type ClientMessage = types.ClientMessage;
type ClientLibToServer = types.ClientLibToServer;

type PublicKey = crypto.PublicKey;
type PrivateKey = crypto.PrivateKey;

const { decrypt, encrypt, sign, verify } = crypto;

export interface ConnectOptions {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: types.UnderEncryption) => void;
  onClose: () => void;
}

interface ClientToLib {
  to: PublicKey;
  payload: ClientMessage;
}

const signableString = (encryptedPayload, to) =>
  JSON.stringify({ payload: encryptedPayload, to });

export const connect = ({
  publicKey,
  privateKey,
  onMessage,
  onClose,
}: ConnectOptions): Promise<(message: ClientToLib) => void> =>
  new Promise((resolve) => {
    const socket = new StandardWebSocketClient(
      Deno.env.url || "ws://localhost:3000",
    );
    const sendThroughSocket = (x: ClientLibToServer) =>
      socket.send(JSON.stringify(x));
    socket.onopen = () => {
      console.log("socket opened");
    };
    socket.onclose = onClose;
    socket.onmessage = ({ data }) => {
      const message: ServerMessage = JSON.parse(data.toString());
      switch (message.type) {
        case "validated": {
          resolve(({ payload, to }: ClientToLib) => {
            const encryptedPayload = encrypt(
              JSON.stringify(payload),
              publicKey,
            );
            const certificate = sign(
              privateKey,
              signableString(encryptedPayload, to),
            );
            sendThroughSocket({
              type: "message",
              payload: {
                to,
                from: publicKey,
                payload: encryptedPayload,
                certificate,
              },
            });
          });
          return;
        }
        case "challenge": {
          const { challenge } = message.payload;
          sendThroughSocket({
            type: "id",
            payload: {
              publicKey,
              certificate: sign(privateKey, challenge),
            },
          });
          return;
        }
        case "message": {
          const { payload, certificate } = message.payload;
          const underEncryption: types.UnderEncryption = JSON.parse(
            decrypt(payload, privateKey),
          );
          if (
            verify(
              underEncryption.from,
              certificate,
              signableString(payload, publicKey),
            )
          ) {
            onMessage(underEncryption);
          } else {
            console.error("ignoring a message with bad certificate");
          }
          return;
        }
      }
    };
  });
