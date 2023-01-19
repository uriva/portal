import {
  Certificate,
  ExteriorToInterior,
  InteriorToExterior,
  PublicKey,
  certify,
  connect,
} from "./layer1";
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

const connectWithAcking = async (
  publicKey: string,
  privateKey: string,
  onMessage: (message: ExteriorToClient) => Promise<void>,
  onClose: () => void,
): Promise<(message: ClientToExterior) => Promise<void>> => {
  const acks = new Map<Certificate, () => void>();
  const send = await connect(
    publicKey,
    privateKey,
    (message: InteriorToExterior) => {
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
          send({
            to: message.from,
            payload: {
              type: "ack",
              payload: ackPayload,
          });
        });
      }
    },
    onClose,
  );
  return (message: ClientToExterior) =>
    new Promise((resolve) => {
      acks.set(send(message), resolve);
    });
};
