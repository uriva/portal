import {
  Certificate,
  PrivateKey,
  PublicKey,
  certify,
  decrypt,
  encrypt,
  validate,
} from "./crypto";

import WebSocket from "ws";

type ClientMessage = any;

interface InteriorToServer {
  type: string;
  payload: {
    to: PublicKey;
    certificate: Certificate;
    payload: ClientMessage;
  };
}

export interface InteriorToExterior {
  from: PublicKey;
  payload: ClientMessage;
  certificate: Certificate;
}
interface ServerChallengeMessage {
  type: "challenge";
  payload: {
    challenge: string;
  };
}

interface ServerRegularMessage {
  type: "message";
  payload: {
    certificate: Certificate;
    from: PublicKey;
    to: PublicKey;
    payload: ClientMessage;
  };
}

export interface ExteriorToInterior {
  to: PublicKey;
  payload: ClientMessage;
}
export interface Parameters {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: InteriorToExterior) => void;
  onClose: () => void;
}
type ServerMessage = ServerChallengeMessage | ServerRegularMessage;

export const connect = ({
  publicKey,
  privateKey,
  onMessage,
  onClose,
}: Parameters): Promise<(message: ExteriorToInterior) => Certificate> =>
  new Promise((resolve) => {
    const socket = new WebSocket("ws://localhost:3000");
    socket.onopen = () => {
      console.log("socket opened");
      resolve(({ payload, to }: ExteriorToInterior) => {
        const encrypedPayload = encrypt(publicKey, privateKey, payload);
        const certificate = certify(
          publicKey,
          privateKey,
          JSON.stringify({ payload: encrypedPayload, to }),
        );
        const toSend: ServerRegularMessage = {
          type: "message",
          payload: {
            to,
            from: publicKey,
            payload: encrypedPayload,
            certificate,
          },
        };
        socket.send(JSON.stringify(toSend));
        // The message certificate acts as a guid.
        return certificate;
      });
    };
    socket.onclose = onClose;
    socket.onmessage = ({ data }) => {
      const message: ServerMessage = JSON.parse(data);
      switch (message.type) {
        case "challenge": {
          const { challenge } = message.payload;
          socket.send(
            JSON.stringify({
              publicKey,
              certificate: certify(publicKey, privateKey, challenge),
            }),
          );
          return;
        }
        case "message": {
          const { from, payload, certificate } = message.payload;
          const decryptedPayloadString = decrypt(
            publicKey,
            privateKey,
            payload.payload,
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
