import { crypto, types } from "../../common/src/index.ts";
import {
  conj,
  get,
  getOrDefault,
  remove,
  removeAllFromArray,
  set,
} from "../../common/src/utils.ts";

const { randomString, verify } = crypto;

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

const publicKeyToSocket: Map<string, WebSocket[]> = new Map();

const sendMessageToClient =
  (message: ServerOutgoingMessage) => (socket: WebSocket) => {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // ignore closed socket
    }
  };

const handleUpgrade = (req: Request): Response => {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Portal WebSocket Hub OK", { status: 200 });
  }
  // deno-lint-ignore no-explicit-any
  const pair = new (globalThis as any).WebSocketPair();
  const client: WebSocket = pair[0];
  // deno-lint-ignore no-explicit-any
  const server: WebSocket & { accept: () => void } = pair[1];
  server.accept();

  let socketPublicKey: null | PublicKey = null;
  const challenge = randomString(10);
  sendMessageToClient({ type: "challenge", payload: { challenge } })(server);

  server.addEventListener("message", (ev: MessageEvent) => {
    const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
    const { type, payload }: ClientLibToServer | RelayMessage = JSON.parse(raw);
    if (type === "relay") {
      (get(publicKeyToSocket, payload.to) || []).forEach(
        sendMessageToClient({ type: "message", payload }),
      );
    }
    if (type === "id") {
      if (socketPublicKey) return;
      const { publicKey, certificate } = payload;
      if (verify(publicKey, certificate, challenge)) {
        socketPublicKey = publicKey;
        set(
          publicKeyToSocket,
          publicKey,
          conj(getOrDefault([], publicKeyToSocket, publicKey), server),
        );
        sendMessageToClient({ type: "validated" })(server);
      } else {
        sendMessageToClient({ type: "bad-auth" })(server);
      }
    }
    if (type === "message") {
      if (!socketPublicKey) return;
      const { to } = payload;
      getOrDefault([], publicKeyToSocket, to).forEach(
        sendMessageToClient({ type: "message", payload }),
      );
    }
  });

  const cleanup = () => {
    try {
      server.close(1000, "closed");
    } catch {
      // ignore
    }
    if (!socketPublicKey) return;
    const arr = get(publicKeyToSocket, socketPublicKey);
    if (arr) {
      removeAllFromArray(arr, server);
      if (!arr.length) {
        remove(publicKeyToSocket, socketPublicKey);
      }
    }
  };

  server.addEventListener("close", cleanup);
  server.addEventListener("error", cleanup);

  // deno-lint-ignore no-explicit-any
  return new Response(null, { status: 101, webSocket: client } as any);
};

export class PortalDO {
  fetch(req: Request): Response {
    return handleUpgrade(req);
  }
}

type WorkerEnv = {
  PORTAL_DO: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (req: Request) => Promise<Response> };
  };
};

export const worker = {
  fetch: (req: Request, env: WorkerEnv) => {
    const id = env.PORTAL_DO.idFromName("global-v1");
    return env.PORTAL_DO.get(id).fetch(req);
  },
};

export default worker;
