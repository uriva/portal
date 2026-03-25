import { generatePrivateKey } from "../../common/src/crypto.ts";
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

const publicKeyToSocket: Map<string, WebSocket[]> = new Map();

const sendMessageToClient =
  (message: ServerOutgoingMessage) => (socket: WebSocket) =>
    socket.send(JSON.stringify(message));

const portEnvParam = "port";

const forwardMessage = (to: PublicKey, payload: RegularMessagePayload) => {
  getOrDefault([], publicKeyToSocket, to).forEach(
    sendMessageToClient({ type: "message", payload }),
  );
};

const onClientMessage = (
  socket: WebSocket,
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

const onClientConnect = (socket: WebSocket) => {
  let socketPublicKey: null | PublicKey = null;
  const challenge = randomString(10);
  sendMessageToClient({ type: "challenge", payload: { challenge } })(socket);
  socket.addEventListener("close", () => {
    if (!socketPublicKey) return;
    if (!has(publicKeyToSocket, socketPublicKey)) return;
    const arr = get(publicKeyToSocket, socketPublicKey);
    removeAllFromArray(arr, socket);
    if (!arr.length) {
      remove(publicKeyToSocket, socketPublicKey);
    }
  });

  const handleMessage = onClientMessage(
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
  );

  socket.addEventListener("message", (event) => {
    handleMessage(String(event.data));
  });
};

const start = () => {
  Deno.serve({ port: parseInt(Deno.env.get(portEnvParam) || "3000") }, (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("Not implemented", { status: 501 });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.addEventListener("open", () => {
      onClientConnect(socket);
    });
    return response;
  });
};

start();
