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
  (message: ServerOutgoingMessage) => (socket: WebSocket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

const forwardMessage = (to: PublicKey, payload: RegularMessagePayload) => {
  const sockets = publicKeyToSocket.get(to) || [];
  sockets.forEach(sendMessageToClient({ type: "message", payload }));
};

const onClientMessage = (
  socket: WebSocket,
  challenge: string,
  socketIdentity: () => PublicKey | null,
  setSocketIdentity: (pk: PublicKey) => void,
) =>
(message: string) => {
  try {
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
  } catch (e) {
    console.error("Failed to parse message", e);
  }
};

const onClientConnect = (socket: WebSocket) => {
  let socketPublicKey: null | PublicKey = null;
  const challenge = randomString(10);
  sendMessageToClient({ type: "challenge", payload: { challenge } })(socket);
  
  socket.addEventListener("close", () => {
    if (!socketPublicKey) return;
    if (!publicKeyToSocket.has(socketPublicKey)) return;
    
    let arr = publicKeyToSocket.get(socketPublicKey) || [];
    arr = arr.filter((s) => s !== socket);
    
    if (!arr.length) {
      publicKeyToSocket.delete(socketPublicKey);
    } else {
      publicKeyToSocket.set(socketPublicKey, arr);
    }
  });

  const handleMessage = onClientMessage(
    socket,
    challenge,
    () => socketPublicKey,
    (publicKey: PublicKey) => {
      socketPublicKey = publicKey;
      const arr = publicKeyToSocket.get(publicKey) || [];
      publicKeyToSocket.set(publicKey, [...arr, socket]);
    },
  );

  socket.addEventListener("message", (event) => {
    handleMessage(String(event.data));
  });
};

Deno.serve({ port: parseInt(Deno.env.get("port") || "8000") }, (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("OK", { status: 200 }); // Health check for Deno Deploy
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("open", () => {
    onClientConnect(socket);
  });
  return response;
});
