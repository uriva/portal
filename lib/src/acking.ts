import { InteriorToExterior, connect } from "./connect";
import { crypto, types } from "shared";

import { randomString } from "shared/src/crypto";

type ClientMessage = types.ClientMessage;
type RegularMessagePayload = types.RegularMessagePayload;

type PublicKey = crypto.PublicKey;
type PrivateKey = crypto.PrivateKey;

type ClientToExterior = { to: PublicKey; payload: ClientMessage };

interface AckMessage {
  type: "ack";
  payload: {
    id: string;
  };
}
type RegularMessage = {
  type: "message";
  payload: { id: string; payload: RegularMessagePayload };
};

type AckProtocolPayload = AckMessage | RegularMessage;

type AckProtocol = {
  to: PublicKey;
  payload: AckProtocolPayload;
};
export interface ConnectWithAckingOptions {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  onMessage: (message: InteriorToExterior) => Promise<void>;
  onClose: () => void;
}

export const connectWithAcking = async ({
  publicKey,
  privateKey,
  onMessage,
  onClose,
}: ConnectWithAckingOptions): Promise<
  (message: ClientToExterior) => Promise<void>
> => {
  const acks = new Map<string, () => void>();
  const send: (msg: AckProtocol) => void = await connect({
    publicKey,
    privateKey,
    onMessage: (message: InteriorToExterior) => {
      const { type, payload }: AckProtocolPayload = message.payload;
      switch (type) {
        case "ack": {
          const callback = acks.get(payload.id);
          if (!callback) {
            console.error("missing entry for ack");
            return;
          }
          callback();
          acks.delete(message.payload.id);
          return;
        }
        case "message": {
          onMessage({ from: message.from, payload }).then(() => {
            send({
              to: message.from,
              payload: {
                type: "ack",
                payload: { id: payload.id },
              },
            });
          });
        }
      }
    },
    onClose,
  });
  return ({ to, payload }: ClientToExterior) =>
    new Promise((resolve) => {
      const msgId = randomString();
      console.log("created message id", msgId);
      acks.set(msgId, resolve);
      send({
        to,
        payload: { type: "message", payload: { id: msgId, payload } },
      });
    });
};
