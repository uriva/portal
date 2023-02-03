import { crypto, types } from "../../common/src/index.ts";
import {
  decryptLongString,
  encryptLongString,
  sign,
  verify,
} from "../../common/src/crypto.ts";

import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

type ServerMessage = types.ServerMessage;
type ClientMessage = types.ClientMessage;
type ClientLibToServer = types.ClientLibToServer;

type PublicKey = crypto.PublicKey;
type PrivateKey = crypto.PrivateKey;

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

const signableString = (encryptedPayload: string, to: PublicKey) =>
  JSON.stringify({ payload: encryptedPayload, to });

export const connect = ({
  publicKey,
  privateKey,
  onMessage,
  onClose,
}: ConnectOptions): Promise<(message: ClientToLib) => void> =>
  new Promise((resolve) => {
    const socket = new StandardWebSocketClient(
      Deno.env.get("url") || "ws://localhost:3000",
    );
    const sendThroughSocket = (x: ClientLibToServer) =>
      socket.send(JSON.stringify(x));
    socket.on("open", () => {
      console.log("socket opened");
    });
    socket.on("close", onClose);
    socket.on("message", async ({ data }) => {
      const message: ServerMessage = JSON.parse(data.toString());
      switch (message.type) {
        case "validated": {
          resolve(async ({ payload, to }: ClientToLib) => {
            const encrypted = JSON.stringify(
              await encryptLongString(
                publicKey,
                JSON.stringify({ from: publicKey, payload }),
              ),
            );
            const certificate = await sign(
              privateKey,
              signableString(encrypted, to),
            );
            sendThroughSocket({
              type: "message",
              payload: {
                to,
                payload: encrypted,
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
              certificate: await sign(privateKey, challenge),
            },
          });
          return;
        }
        case "message": {
          const { payload, certificate } = message.payload;
          const underEncryption: types.UnderEncryption = JSON.parse(
            await decryptLongString(privateKey, JSON.parse(payload)),
          );
          if (
            await verify(
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
    });
  });
