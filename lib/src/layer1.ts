import { crypto, types } from "shared";

import { ClientLibToServer } from "shared/src/types";
import WebSocket from "ws";

type ServerMessage = types.ServerMessage;
type ClientMessage = types.ClientMessage;

type PublicKey = crypto.PublicKey;
type Certificate = crypto.Certificate;
type PrivateKey = crypto.PrivateKey;

const { certify, decrypt, encrypt, validate } = crypto;

export interface InteriorToExterior {
  from: PublicKey;
  payload: ClientMessage;
  certificate: Certificate;
}

export interface Parameters {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: InteriorToExterior) => void;
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
}: Parameters): Promise<(message: ClientToLib) => Certificate> =>
  new Promise((resolve) => {
    const socket = new WebSocket("ws://localhost:3000");
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
            const encryptedPayload = encrypt(publicKey, privateKey, payload);
            const certificate = certify(
              publicKey,
              privateKey,
              JSON.stringify({ payload: encryptedPayload, to }),
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
            // The message certificate acts as a guid.
            return certificate;
          });
          return;
        }
        case "challenge": {
          const { challenge } = message.payload;
          sendThroughSocket({
            type: "id",
            payload: {
              publicKey,
              certificate: certify(publicKey, privateKey, challenge),
            },
          });
          return;
        }
        case "message": {
          const { from, payload, certificate } = message.payload;
          console.log(payload);
          const decryptedPayloadString = decrypt(
            publicKey,
            privateKey,
            payload,
          );
          if (!validate(from, certificate, decryptedPayloadString)) {
            socket.close();
            return;
          }
          onMessage({
            certificate: payload.certificate,
            from,
            payload: JSON.parse(decryptedPayloadString),
          });
          return;
        }
      }
    };
  });
