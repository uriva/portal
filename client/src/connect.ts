import {
  decrypt,
  encrypt,
  getPublicKey,
  PrivateKey,
  PublicKey,
  sign,
  verify,
} from "../../common/src/crypto.ts";

import { ServerRegularMessage } from "../../common/src/types.ts";
import { StandardWebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { types } from "../../common/src/index.ts";

export interface IncomingMessage {
  from: PublicKey;
  payload: types.ClientMessage;
}

export interface ConnectOptions {
  privateKey: PrivateKey;
  onMessage: (message: IncomingMessage) => void;
  onClose: () => void;
  reconnect?: boolean;
  maxReconnectDelayMs?: number;
}

interface ClientToLib {
  to: PublicKey;
  payload: types.ClientMessage;
}

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

const signableString = (
  encryptedPayload: string,
  to: PublicKey,
  timestamp: number,
) => encryptedPayload + to + timestamp;

const signEncryptedMessage =
  (privateKey: PrivateKey, to: PublicKey) =>
  (encryptedStr: string): ServerRegularMessage => {
    const timestamp = Date.now();
    return {
      type: "message",
      payload: {
        to,
        from: getPublicKey(privateKey),
        payload: encryptedStr,
        timestamp,
        certificate: sign(
          privateKey,
          signableString(encryptedStr, to, timestamp),
        ),
      },
    };
  };

const encryptAndSign =
  (publicKey: PublicKey, privateKey: PrivateKey) =>
  ({ payload, to }: ClientToLib): Promise<ServerRegularMessage> =>
    encrypt(privateKey, publicKey, JSON.stringify(payload)).then(
      signEncryptedMessage(privateKey, to),
    );

const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 500;

const connectOnce = ({
  privateKey,
  onMessage,
  onClose,
}: {
  privateKey: PrivateKey;
  onMessage: (message: IncomingMessage) => void;
  onClose: () => void;
}): Promise<{
  send: (message: ClientToLib) => void;
  close: () => void;
}> =>
  new Promise((resolve, reject) => {
    const socket = new StandardWebSocketClient(
      Deno.env.get("url") || "wss://uriva-portal-mete6t9t7geg.deno.dev/",
    );
    const sendThruSocket = (message: types.ClientLibToServer) =>
      socket.send(JSON.stringify(message));
    socket.on("open", () => {
      console.debug("socket opened");
    });
    socket.on("error", () => {
      reject("could not open connection");
    });
    socket.on("close", onClose);
    // deno-lint-ignore no-explicit-any
    socket.on("message", async ({ data }: { data: any }) => {
      const message: types.ServerMessage = JSON.parse(data.toString());
      if (message.type === "validated") {
        console.debug("socket validated");
        resolve({
          close: () => socket.close(),
          send: (message) =>
            encryptAndSign(
              message.to,
              privateKey,
            )(message).then(sendThruSocket),
        });
      }
      if (message.type === "challenge") {
        console.debug("got challenge");
        const { challenge } = message.payload;
        sendThruSocket({
          type: "id",
          payload: {
            publicKey: getPublicKey(privateKey),
            certificate: sign(privateKey, challenge),
          },
        });
      }
      if (message.type === "message") {
        const { payload, certificate, from, timestamp } = message.payload;
        if (
          !verify(
            from,
            certificate,
            signableString(payload, getPublicKey(privateKey), timestamp),
          )
        ) {
          console.error("ignoring a message with bad certificate");
          return;
        }
        const age = Date.now() - timestamp;
        if (age < 0 || age > MAX_MESSAGE_AGE_MS) {
          console.error(
            `ignoring a message with stale timestamp (age: ${age}ms)`,
          );
          return;
        }
        onMessage({
          payload: JSON.parse(await decrypt(privateKey, from, payload)),
          from,
        });
      }
    });
  });

export const connect = ({
  privateKey,
  onMessage,
  onClose,
  reconnect = true,
  maxReconnectDelayMs = DEFAULT_MAX_RECONNECT_DELAY_MS,
}: ConnectOptions): Promise<{
  send: (message: ClientToLib) => void;
  close: () => void;
}> => {
  if (!reconnect) {
    return connectOnce({ privateKey, onMessage, onClose });
  }

  let currentConnection: { send: (m: ClientToLib) => void; close: () => void } | null = null;
  let closed = false;
  let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

  const doConnect = (): Promise<void> =>
    connectOnce({
      privateKey,
      onMessage,
      onClose: () => {
        currentConnection = null;
        if (closed) {
          onClose();
          return;
        }
        console.debug(`connection lost, reconnecting in ${reconnectDelay}ms`);
        setTimeout(() => {
          if (closed) return;
          doConnect().catch(() => {
            // retry is handled inside doConnect via the onClose cycle
          });
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelayMs);
      },
    }).then((conn) => {
      currentConnection = conn;
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    }).catch((err) => {
      if (closed) return;
      console.debug(`connection failed: ${err}, retrying in ${reconnectDelay}ms`);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          if (closed) { resolve(); return; }
          reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelayMs);
          doConnect().then(resolve).catch(resolve);
        }, reconnectDelay);
      });
    });

  return new Promise((resolve) => {
    doConnect().then(() => {
      resolve({
        send: (message: ClientToLib) => {
          if (!currentConnection) {
            throw new Error("not connected");
          }
          currentConnection.send(message);
        },
        close: () => {
          closed = true;
          if (currentConnection) {
            currentConnection.close();
          } else {
            onClose();
          }
        },
      });
    });
  });
};
