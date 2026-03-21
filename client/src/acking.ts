import { IncomingMessage, connect } from "./connect.ts";
import { crypto, types } from "../../common/src/index.ts";

type ClientToExterior = { to: crypto.PublicKey; payload: types.ClientMessage };

type AckProtocolPayload =
  | { type: "ack"; payload: { id: string } }
  | {
      type: "message";
      payload: { id: string; payload: types.RegularMessagePayload };
    };

const DEFAULT_ACK_TIMEOUT_MS = 30_000;

export interface ConnectWithAckingOptions {
  privateKey: crypto.PrivateKey;
  onMessage: (message: IncomingMessage) => Promise<void>;
  onClose: () => void;
  ackTimeoutMs?: number;
}

export const connectWithAcking = async ({
  privateKey,
  onMessage,
  onClose,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS,
}: ConnectWithAckingOptions): Promise<{
  send: (message: ClientToExterior) => Promise<void>;
  close: () => void;
}> => {
  const acks = new Map<string, { resolve: () => void; reject: (err: Error) => void; timer: number }>();

  const clearAck = (id: string) => {
    const entry = acks.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      acks.delete(id);
    }
  };

  const rejectAllPending = () => {
    for (const [id, entry] of acks) {
      clearTimeout(entry.timer);
      entry.reject(new Error("connection closed before ack received"));
      acks.delete(id);
    }
  };

  const { send, close } = await connect({
    privateKey,
    onMessage: (message: IncomingMessage) => {
      const { type, payload }: AckProtocolPayload = message.payload;
      if (type === "ack") {
        const entry = acks.get(payload.id);
        if (!entry) {
          console.error(`missing entry for ack ${payload.id}`);
          return;
        }
        clearTimeout(entry.timer);
        entry.resolve();
        acks.delete(payload.id);
      }
      if (type === "message") {
        onMessage({ from: message.from, payload: payload.payload }).then(() => {
          send({
            to: message.from,
            payload: { type: "ack", payload: { id: payload.id } },
          });
        });
      }
    },
    onClose: () => {
      rejectAllPending();
      onClose();
    },
  });
  return {
    close: () => {
      rejectAllPending();
      close();
    },
    send: ({ to, payload }: ClientToExterior) =>
      new Promise((resolve, reject) => {
        const id = crypto.randomString(10);
        const timer = setTimeout(() => {
          acks.delete(id);
          reject(new Error(`ack timeout after ${ackTimeoutMs}ms`));
        }, ackTimeoutMs);
        acks.set(id, { resolve, reject, timer: timer as unknown as number });
        send({ to, payload: { type: "message", payload: { id, payload } } });
      }),
  };
};
