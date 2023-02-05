import {
  ClientLibToServer,
  ClientMessage,
  ServerMessage,
} from "../../common/src/types.ts";

import { PrivateKey, PublicKey, sign } from "../../common/src/crypto.ts";
import {
  encryptAndSign,
  VerifiedMessage,
  verifyAndDecrypt,
} from "../../common/src/protocol.ts";

import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

export interface ConnectOptions {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: VerifiedMessage) => void;
  onClose: () => void;
}

interface ClientToLib {
  to: PublicKey;
  payload: ClientMessage;
}

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
            sendThroughSocket({
              type: "message",
              payload: {
                to,
                payload: await encryptAndSign(
                  to,
                  { publicKey, privateKey },
                  payload,
                ),
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
          const verifiedMessage = await verifyAndDecrypt(
            { publicKey, privateKey },
            message.payload.payload,
          );

          if (verifiedMessage.isOk) {
            onMessage(verifiedMessage.value);
          } else {
            console.error("ignoring a message with bad certificate");
          }
          return;
        }
      }
    });
  });
