import { ClientMessage, RegularMessagePayload } from "shared/src/types";
import { InteriorToExterior, connect } from "./layer1";

import { crypto } from "shared";

type PublicKey = crypto.PublicKey;
type Certificate = crypto.Certificate;

type ExteriorToClient = { from: PublicKey; payload: ClientMessage };
type ClientToExterior = { to: PublicKey; payload: ClientMessage };

interface AckMessage {
  type: "ack";
  payload: {
    certificate: Certificate;
  };
}

type AckProtocol = {
  to: PublicKey;
  payload: AckMessage | { type: "message"; payload: RegularMessagePayload };
};

export const connectWithAcking = async (
  publicKey: string,
  privateKey: string,
  onMessage: (message: ExteriorToClient) => Promise<void>,
  onClose: () => void,
): Promise<(message: ClientToExterior) => Promise<void>> => {
  const acks = new Map<Certificate, () => void>();
  const send: (msg: AckProtocol) => Certificate = await connect({
    publicKey,
    privateKey,
    onMessage: (message: InteriorToExterior) => {
      const { type, payload }: AckMessage | ClientMessage = message.payload;
      switch (type) {
        case "ack": {
          const callback = acks.get(payload.certificate);
          if (!callback) {
            console.error("missing entry for ack");
            return;
          }
          callback();
          acks.delete(payload.payload.certificate);
          return;
        }
        case "message": {
          onMessage({ from: message.from, payload }).then(() => {
            send({
              to: message.from,
              payload: {
                type: "ack",
                payload: { certificate: message.certificate },
              },
            });
          });
          return;
        }
      }
    },
    onClose,
  });
  return (message: ClientToExterior) =>
    new Promise((resolve) => {
      acks.set(
        send({
          to: message.to,
          payload: { type: "message", payload: message.payload },
        }),
        resolve,
      );
    });
};
