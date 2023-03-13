import { crypto, types } from "../../common/src/index.ts";

import { connect } from "./connect.ts";

type ClientToExterior = { to: crypto.PublicKey; payload: types.ClientMessage };

type AckProtocolPayload =
  | { type: "ack"; payload: { id: string } }
  | {
      type: "message";
      payload: { id: string; payload: types.RegularMessagePayload };
    };

type AckProtocol = { to: crypto.PublicKey; payload: AckProtocolPayload };

export interface ConnectWithAckingOptions {
  privateKey: crypto.PrivateKey;
  onMessage: (message: types.UnderEncryption) => Promise<void>;
  onClose: () => void;
}

export const connectWithAcking = async ({
  privateKey,
  onMessage,
  onClose,
}: ConnectWithAckingOptions): Promise<
  (message: ClientToExterior) => Promise<void>
> => {
  const acks = new Map<string, () => void>();
  const send: (msg: AckProtocol) => void = await connect({
    privateKey,
    onMessage: (message: types.UnderEncryption) => {
      const { type, payload }: AckProtocolPayload = message.payload;
      if (type === "ack") {
        const callback = acks.get(payload.id);
        if (!callback) {
          console.error(`missing entry for ack ${payload.id}`, acks);
          return;
        }
        callback();
        acks.delete(message.payload.id);
      }
      if (type === "message") {
        onMessage({ from: message.from, payload }).then(() => {
          send({
            to: message.from,
            payload: { type: "ack", payload: { id: payload.id } },
          });
        });
      }
    },
    onClose,
  });
  return ({ to, payload }: ClientToExterior) =>
    new Promise((resolve) => {
      const id = crypto.randomString(10);
      console.log("created message id", id);
      acks.set(id, resolve);
      send({ to, payload: { type: "message", payload: { id, payload } } });
    });
};
