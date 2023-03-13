import {
  KeyPair,
  comparePublicKeys,
  genKeyPair,
  logPubKey,
} from "../../common/src/crypto.ts";
import {
  WebSocketClient,
  WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import {
  conj,
  get,
  getOrDefault,
  has,
  remove,
  removeAllFromArray,
  set,
} from "../../common/src/utils.ts";
import { crypto, types } from "../../common/src/index.ts";

const { randomString, verify, hashPublicKey } = crypto;

type ClientLibToServer = types.ClientLibToServer;
type NotValidatedMessage = types.NotValidatedMessage;
type RegularMessagePayload = types.RegularMessagePayload;
type ServerChallengeMessage = types.ServerChallengeMessage;
type ServerRegularMessage = types.ServerRegularMessage;
type ValidatedMessage = types.ValidatedMessage;

type PublicKey = crypto.PublicKey;

type RelayMessage = {
  type: "relay";
  payload: RegularMessagePayload;
};

type ServerOutgoingMessage =
  | ServerRegularMessage
  | ServerChallengeMessage
  | ValidatedMessage
  | NotValidatedMessage
  | RelayMessage;

const publicKeyToSocket: Map<string, WebSocketClient[]> = new Map();

const connectAndReturnSocketForPeerHub = (
  // deno-lint-ignore no-unused-vars
  publicKey: PublicKey,
  // @ts-ignore not yet implemented
): Promise<WebSocketClient> => {
  console.error("not yet implemented");
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
const redisRemoveFromSet = (key: string, value: string) => {
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
        set(publicKeyToSocket, id, [
          await connectAndReturnSocketForPeerHub(id),
        ]);
        return get(publicKeyToSocket, id);
      }),
    );

const sendMessageToClient =
  (message: ServerOutgoingMessage) => (socket: WebSocketClient) =>
    socket.send(JSON.stringify(message));

const portEnvPAram = "port";

const forwardMessage = async (
  serverKey: KeyPair,
  to: PublicKey,
  payload: RegularMessagePayload,
) => {
  getOrDefault([], publicKeyToSocket, hashPublicKey(to)).forEach(
    sendMessageToClient({ type: "message", payload }),
  );
  (await resolvePeerHubSockets(serverKey.publicKey)(to)).map(
    (sockets) =>
      sockets &&
      sockets.forEach(sendMessageToClient({ type: "relay", payload })),
  );
};

// Incoming connections might be from a client or another hub.
const onClientConnect = (serverKey: KeyPair) => (socket: WebSocketClient) => {
  let socketPublicKey: null | PublicKey = null;
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
    redisAddToSet(hashPublicKey(publicKey), hashPublicKey(serverKey.publicKey));
  };
  const challenge = randomString(10);
  sendMessageToClient({ type: "challenge", payload: { challenge } })(socket);
  socket.on("close", () => {
    if (!socketPublicKey) return;
    const arr = get(publicKeyToSocket, hashPublicKey(socketPublicKey));
    if (arr) {
      removeAllFromArray(arr, socket);
    }
    if (!arr.length) {
      remove(publicKeyToSocket, hashPublicKey(socketPublicKey));
    }
    redisRemoveFromSet(
      hashPublicKey(socketPublicKey),
      hashPublicKey(serverKey.publicKey),
    );
    if (
      (
        get(
          publicKeyToSocket,
          hashPublicKey(socketPublicKey),
        ) as Array<WebSocketClient>
      ).includes(socket)
    ) {
      socket.close(1000);
      remove(publicKeyToSocket, hashPublicKey(socketPublicKey));
    }
  });
  socket.on("message", async (message) => {
    const { type, payload }: ClientLibToServer | RelayMessage =
      JSON.parse(message);
    if (type === "relay") {
      (get(publicKeyToSocket, hashPublicKey(payload.to)) || []).forEach(
        sendMessageToClient({ type: "message", payload }),
      );
    }
    if (type === "id") {
      if (socketPublicKey) return; // A socket will serve only one publicKey until its death.
      const { publicKey, certificate } = payload;
      console.log("identifying client");
      if (await verify(publicKey, certificate, challenge)) {
        setSocketPublicKey(publicKey);
        sendMessageToClient({ type: "validated" })(socket);
      } else {
        sendMessageToClient({ type: "bad-auth" })(socket);
      }
    }
    if (type === "message") {
      if (!socketPublicKey) return; // Unauthenticated sockets are not to be used.
      const { to } = payload;
      if (!canSendMessage(socketPublicKey, to)) {
        return;
      }
      console.log(
        `got message from ${logPubKey(socketPublicKey)} to ${logPubKey(to)}`,
      );
      recordForRateLimitingAndBilling(socketPublicKey, to);
      forwardMessage(serverKey, to, payload);
    }
  });
};

const start = (serverKey: KeyPair) => {
  new WebSocketServer(parseInt(Deno.env.get(portEnvPAram) || "3000")).on(
    "connection",
    onClientConnect(serverKey),
  );
};

genKeyPair().then(start);
