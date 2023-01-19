export type PublicKey = string;
type PrivateKey = string;
export type Certificate = string;
type ClientMessage = any;

interface ServerMessagePayload {
  certificate: Certificate;
  from: PublicKey;
  payload: ClientMessage;
}

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

interface ServerToInterior {
  type: string;
  payload: ServerMessagePayload;
}

export interface ExteriorToInterior {
  to: PublicKey;
  payload: ClientMessage;
}
const encrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  payload: ClientMessage,
): string => {
  console.error("not yet implemented");
  return "some encryped string";
};

const certify = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedPayload: string,
  to: PublicKey,
): Certificate => {
  console.error("not yet implemented");
  return "some certificate";
};

const decrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encrypedString: string,
): string => {
  console.error("not yet implemented");
  return "some decryped string";
};

const validate = (
  publicKey: PublicKey,
  certificate: Certificate,
  payload: string,
): boolean => {
  console.error("not yet implemented");
  return true;
};

export const connect = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  onMessage: (message: InteriorToExterior) => void,
  onClose: () => void,
): Promise<(message: ExteriorToInterior) => Certificate> =>
  new Promise((resolve) => {
    const socket = new WebSocket("wss://localhost:3000");
    socket.onopen = () => {
      resolve(({ payload, to }: ExteriorToInterior) => {
        const encrypedPayload = encrypt(publicKey, privateKey, payload);
        const certificate = certify(publicKey, privateKey, encrypedPayload, to);
        const toSend: InteriorToServer = {
          type: "message",
          payload: {
            to,
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
      const message: ServerToInterior = JSON.parse(data);
      if (message.type === "message") {
        const { from, payload } = message.payload;
        const decryptedPayloadString = decrypt(
          publicKey,
          privateKey,
          payload.payload,
        );
        if (!validate(from, payload.certificate, decryptedPayloadString)) {
          socket.close();
          return;
        }
        onMessage({
          certificate: payload.certificate,
          from,
          payload: JSON.parse(decryptedPayloadString),
        });
      }
    };
  });
