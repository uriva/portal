import { ExteriorToInterior, InteriorToExterior, connect } from "./layer1";

import { crypto } from "shared";

type PublicKey = crypto.PublicKey;
type Certificate = crypto.Certificate;

type ClientMessage = any;
type ExteriorToClient = { from: PublicKey; payload: ClientMessage };
type ClientToExterior = { to: PublicKey; payload: ClientMessage };
type AckPayload = { certificate: Certificate };
interface ClientMessageWithAcking {
  type: string;
  payload: {
    type: string;
    payload: AckPayload | ClientMessage;
  };
}

export const connectWithAcking = async (
  publicKey: string,
  privateKey: string,
  onMessage: (message: ExteriorToClient) => Promise<void>,
  onClose: () => void,
): Promise<(message: ClientToExterior) => Promise<void>> => {
  const acks = new Map<Certificate, () => void>();
  const send = await connect({
    publicKey,
    privateKey,
    onMessage: (message: InteriorToExterior) => {
      const { type, payload }: ClientMessageWithAcking = message.payload;
      if (type === "ack") {
        const ackPayload: AckPayload = payload.payload;
        const callback = acks.get(ackPayload.certificate);
        if (!callback) {
          console.error("missing entry for ack");
          return;
        }
        callback();
        acks.delete(ackPayload.certificate);
      }
      if (type === "message") {
        onMessage({ from: message.from, payload }).then(() => {
          const ackPayload: AckPayload = { certificate: message.certificate };
          const messageToInterior: ExteriorToInterior = {
            to: message.from,
            payload: {
              type: "ack",
              payload: ackPayload,
            },
          };
          send(messageToInterior);
        });
      }
    },
    onClose,
  });
  return (message: ClientToExterior) =>
    new Promise((resolve) => {
      acks.set(send(message), resolve);
    });
};
