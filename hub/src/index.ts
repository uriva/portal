import {
  WebSocketClient,
  WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { comparePublicKeys, genKeyPair } from "../../common/src/crypto.ts";
import { crypto, types } from "../../common/src/index.ts";

const { randomString, verify, hashPublicKey } = crypto;

type ClientLibToServer = types.ClientLibToServer;
type NotValidatedMessage = types.NotValidatedMessage;
type RegularMessagePayload = types.RegularMessagePayload;
type ServerChallengeMessage = types.ServerChallengeMessage;
type ServerRegularMessage = types.ServerRegularMessage;
type ValidatedMessage = types.ValidatedMessage;

type Certificate = crypto.Signature;
type PublicKey = crypto.PublicKey;

type RelayMessage = {
  type: "relay";
  payload: RegularMessagePayload;
};

type HubIdMessage = {
  type: "hub-id";
  payload: {
    publicKey: PublicKey;
    certificate: Certificate;
  };
};

type HubToHubMessage = RelayMessage | HubIdMessage;

type ServerOutgoingMessage =
  | ServerRegularMessage
  | ServerChallengeMessage
  | ValidatedMessage
  | RelayMessage
  | NotValidatedMessage
  | HubToHubMessage;

const publicKeyToSocket: Map<string, WebSocketClient[]> = new Map();

function conj<T>(arr: Array<T>, x: T) {
  return [...arr, x];
}

function set<K, V>(map: Map<K, V>, key: K, value: V) {
  map.set(key, value);
  return map;
}

function get<K, V>(map: Map<K, V>, key: K) {
  return map.get(key);
}

function getOrDefault<K, V>(defaultValue: V, map: Map<K, V>, key: K): V {
  if (has(map, key)) {
    return get(map, key) as V;
  }
  return defaultValue;
}
function has<K, V>(map: Map<K, V>, key: K) {
  return map.has(key);
}

function remove<K, V>(mapping: Map<K, V>, key: K) {
  const newMapping = { ...mapping };
  newMapping.delete(key);
  return newMapping;
}

// @ts-ignore not yet implemented
const connectToHubSocket = (id): Promise<WebSocketClient> => {
  console.error("not yet implemented");
};

const myIP = () => {
  console.error("not yet implemented");
  return "1.1.1.1";
};

// deno-lint-ignore no-unused-vars
const redisAddToSet = (key: string, value: string): Promise<void> => {
  console.error("not yet implemented");
  return new Promise((resolve) => {
    resolve();
  });
};

// deno-lint-ignore no-unused-vars
const redisGetFromSetOrEmptyArray = (key: string) => {
  console.error("not implemented");
  return [];
};

// deno-lint-ignore no-unused-vars
const redisRemoveFromSet = (key: string) => {
  console.error("not implemented");
};

const recordForRateLimitingAndBilling = (
  // deno-lint-ignore no-unused-vars
  sender: PublicKey,
  // deno-lint-ignore no-unused-vars
  receiver: PublicKey,
) => {
  console.error("not implemented");
};

// deno-lint-ignore no-unused-vars
const canSendMessage = (sender: PublicKey, receiver: PublicKey) => {
  console.error("not implemented");
  return true;
};

const resolvePeerHubSockets =
  (myPublicKey: PublicKey) => (publicKey: PublicKey) =>
    Promise.all(
      redisGetFromSetOrEmptyArray(hashPublicKey(publicKey)).map(async (id) => {
        if (comparePublicKeys(id, myPublicKey)) {
          return null;
        }
        if (has(publicKeyToSocket, id)) {
          return get(publicKeyToSocket, id);
        }
        set(publicKeyToSocket, id, [await connectToHubSocket(id)]);
        return get(publicKeyToSocket, id);
      }),
    );

const sendMessageToClient = (
  socket: WebSocketClient,
  message: ServerOutgoingMessage,
) => socket.send(JSON.stringify(message));

const start = async () => {
  const server = new WebSocketServer(
    Deno.env.has("PORT") ? parseInt(Deno.env.get("PORT") as string) : 3000,
  );

  const serverKey = await genKeyPair();

  // Incoming connections might be from a client or another hub.
  server.on("connection", (socket) => {
    let socketPublicKey: null | PublicKey = null;
    let isPeerHub = false;
    const setSocketPublicKey = (publicKey: PublicKey) => {
      socketPublicKey = publicKey;
      set(
        publicKeyToSocket,
        hashPublicKey(publicKey),
        conj(
          getOrDefault([], publicKeyToSocket, hashPublicKey(publicKey)),
          socket,
        ),
      );
      redisAddToSet(
        hashPublicKey(publicKey),
        hashPublicKey(serverKey.publicKey),
      );
    };
    const challenge = randomString();
    sendMessageToClient(socket, { type: "challenge", payload: { challenge } });
    socket.on("close", () => {
      if (!socketPublicKey) return;
      // TODO(uri): we need a tiny event driven state management thing to replace this mess.
      set(
        publicKeyToSocket,
        hashPublicKey(socketPublicKey),
        getOrDefault([], publicKeyToSocket, hashPublicKey(socketPublicKey))
          .length === 1
          ? []
          : remove(publicKeyToSocket, hashPublicKey(socketPublicKey), socket),
      );
      redisRemoveFromSet(hashPublicKey(socketPublicKey), myIP());
      if (
        get(publicKeyToSocket, hashPublicKey(socketPublicKey)) as Array<>.includes(socket)
      ) {
        socket.close(1000);
        remove(publicKeyToSocket, hashPublicKey(socketPublicKey));
      }
    });
    socket.on("message", async (message) => {
      const { type, payload }: ClientLibToServer | HubToHubMessage =
        JSON.parse(message);
      if (type === "hub-id") {
        if (socketPublicKey) return;
        const { publicKey, certificate } = payload;
        if (await verify(publicKey, certificate, challenge)) {
          if (has(publicKeyToSocket, hashPublicKey(publicKey))) {
            get(publicKeyToSocket, hashPublicKey(publicKey)).forEach((s) =>
              s.close(),
            );
          }
          set(hubIdToSocket, hashPublicKey(publicKey), socket);
          isPeerHub = true;
          socketPublicKey = publicKey;
          sendMessageToClient(socket, { type: "validated" });
        } else {
          sendMessageToClient(socket, { type: "bad-auth" });
        }
      }
      if (type === "relay") {
        if (!isPeerHub) return;
        (get(publicKeyToSocket, hashPublicKey(payload.to)) || []).forEach(
          (socket) =>
            sendMessageToClient(socket, {
              type: "message",
              payload,
            }),
        );
      }
      if (type === "id") {
        if (socketPublicKey) return; // A socket will serve only one publicKey until its death.
        const { publicKey, certificate } = payload;
        console.log("identifying client");
        if (await verify(publicKey, certificate, challenge)) {
          setSocketPublicKey(publicKey);
          sendMessageToClient(socket, { type: "validated" });
        } else {
          sendMessageToClient(socket, { type: "bad-auth" });
        }
      }
      if (type === "message") {
        if (!socketPublicKey) return; // Unauthenticated sockets are not to be used.
        const { to } = payload;
        if (!canSendMessage(socketPublicKey, to)) {
          return;
        }
        recordForRateLimitingAndBilling(socketPublicKey, to);
        console.log("processing message", payload);
        getOrDefault([], publicKeyToSocket, hashPublicKey(to)).forEach(
          (socket) => {
            sendMessageToClient(socket, {
              type: "message",
              payload,
            });
          },
        );
        (await resolvePeerHubSockets(serverKey.publicKey)(to)).map(
          (sockets) =>
            sockets &&
            sockets.forEach((socket) =>
              sendMessageToClient(socket, {
                type: "relay",
                payload,
              }),
            ),
        );
      }
    });
  });
};
start();
