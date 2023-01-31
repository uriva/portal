import { crypto, types } from "shared";

import WebSocket from "ws";

type ServerMessage = types.ServerMessage;
type ClientMessage = types.ClientMessage;
type ClientLibToServer = types.ClientLibToServer;

type PublicKey = crypto.PublicKey;
type Certificate = crypto.Signature;
type PrivateKey = crypto.PrivateKey;

const { decrypt, encrypt, sign, verify } = crypto;

export interface InteriorToExterior {
  from: PublicKey;
  payload: ClientMessage;
}

export interface ConnectOptions {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: InteriorToExterior) => void;
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
    const socket = new WebSocket(process.env.url || "ws://localhost:3000");
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
          const { from, payload, certificate } = message.payload;
          const isVerified = verify(
            from,
            certificate,
            signableString(payload, publicKey),
          );
          if (!isVerified) {
            console.error("ignoring a message which is not signed");
          }
          const decryptedPayloadString = decrypt(payload, privateKey);
          if (!isVerified) {
            socket.close();
            return;
          }
          onMessage({
            from,
            payload: JSON.parse(decryptedPayloadString),
          });
          return;
        }
      }
    };
  });
