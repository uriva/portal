import WebSocket from "ws";
import { crypto } from "shared";

const {
  Certificate,
  PrivateKey,
  PublicKey,
  certify,
  decrypt,
  encrypt,
  validate,
} = crypto;

type ClientMessage = any;

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

interface ValidatedMessage {
  type: "validated";
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

type ServerMessage =
  | ValidatedMessage
  | ServerChallengeMessage
  | ServerRegularMessage;

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
    };
    socket.onclose = onClose;
    socket.onmessage = ({ data }) => {
      const message: ServerMessage = JSON.parse(data.toString());
      switch (message.type) {
        case "validated": {
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
          return;
        }
        case "challenge": {
          const { challenge } = message.payload;
          socket.send(
            JSON.stringify({
              type: "id",
              payload: {
                publicKey,
                certificate: certify(publicKey, privateKey, challenge),
              },
            }),
          );
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
