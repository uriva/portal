import {
  generatePrivateKey,
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

const { randomString, verify } = crypto;

type ClientLibToServer = types.ClientLibToServer;
type RegularMessagePayload = types.RegularMessagePayload;
type ServerChallengeMessage = types.ServerChallengeMessage;
type ServerRegularMessage = types.ServerRegularMessage;
type ValidatedMessage = types.ValidatedMessage;
type NotValidatedMessage = types.NotValidatedMessage;

type PublicKey = crypto.PublicKey;

type ServerOutgoingMessage =
  | ServerRegularMessage
  | ServerChallengeMessage
  | ValidatedMessage
  | NotValidatedMessage;

const publicKeyToSocket: Map<string, WebSocketClient[]> = new Map();

const sendMessageToClient =
  (message: ServerOutgoingMessage) => (socket: WebSocketClient) =>
    socket.send(JSON.stringify(message));

const portEnvParam = "port";

const forwardMessage = (
  to: PublicKey,
  payload: RegularMessagePayload,
) => {
  getOrDefault([], publicKeyToSocket, to).forEach(
    sendMessageToClient({ type: "message", payload }),
  );
};

const onClientMessage = (
  socket: WebSocketClient,
  challenge: string,
  socketIdentity: () => PublicKey | null,
  setSocketIdentity: (pk: PublicKey) => void,
) =>
(message: string) => {
  const { type, payload }: ClientLibToServer = JSON.parse(message);
  if (type === "id") {
    if (socketIdentity()) return; // A socket will serve only one publicKey until its death.
    const { publicKey, certificate } = payload;
    if (verify(publicKey, certificate, challenge)) {
      setSocketIdentity(publicKey);
      sendMessageToClient({ type: "validated" })(socket);
    } else {
      sendMessageToClient({ type: "bad-auth" })(socket);
    }
  }
  if (type === "message") {
    const socketId = socketIdentity();
    if (!socketId) return; // Unauthenticated sockets are not to be used.
    const { to } = payload;
    forwardMessage(to, payload);
  }
};

const onClientConnect = (socket: WebSocketClient) => {
  let socketPublicKey: null | PublicKey = null;
  const challenge = randomString(10);
  sendMessageToClient({ type: "challenge", payload: { challenge } })(socket);
  socket.on("close", () => {
    if (!socketPublicKey) return;
    if (!has(publicKeyToSocket, socketPublicKey)) return;
    const arr = get(publicKeyToSocket, socketPublicKey);
    removeAllFromArray(arr, socket);
    if (!arr.length) {
      remove(publicKeyToSocket, socketPublicKey);
    }
  });
  socket.on(
    "message",
    onClientMessage(
      socket,
      challenge,
      () => socketPublicKey,
      (publicKey: PublicKey) => {
        socketPublicKey = publicKey;
        set(
          publicKeyToSocket,
          publicKey,
          conj(getOrDefault([], publicKeyToSocket, publicKey), socket),
        );
      },
    ),
  );
};

const start = () => {
  new WebSocketServer(parseInt(Deno.env.get(portEnvParam) || "3000")).on(
    "connection",
    onClientConnect,
  );
};

start();
