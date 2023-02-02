import { crypto, types } from "../../common/src/index.ts";

import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

const { randomString, verify } = crypto;

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
  | NotValidatedMessage;

const publicKeyToSocket = {};
const hubIdToSocket = {};

const server = new WebSocketServer(Deno.env.PORT || 3000);

const conj = (arr, x) => [...arr, x];
const has = (map, key) => key in map;
const remove = (mapping, key) => {
  const newMapping = { ...mapping };
  delete newMapping[key];
  return newMapping;
};
const isMeIP = (ip) => ip === myIP();
const connectToHubSocket = (ip) => {
  console.error("not yet implemented");
};

const myIP = () => {
  console.error("not yet implemented");
  return "1.1.1.1";
};

const redisAddToSet = (key, value) => {
  console.error("not yet implemented");
  return new Promise((resolve) => {
    resolve(null);
  });
};
const redisGetWithDefault = (defaultValue) => (key) => {
  console.error("not implemented");
  return [];
};
const redisRemoveFromSet = (key, value) => {
  console.error("not implemented");
};

const recordForRateLimitingAndBilling = (sender, receiver) => {
  console.error("not implemented");
};

const canSendMessage = (sender, receiver) => {
  console.error("not implemented");
  return true;
};

const resolvePeerHubSockets = (publicKey) =>
  redisGetWithDefault([])(publicKey).map((ip) => {
    if (isMeIP(ip)) {
      return null;
    }
    if (has(hubIdToSocket, ip)) {
      return hubIdToSocket[ip];
    }
    hubIdToSocket[ip] = connectToHubSocket(ip);
    return hubIdToSocket[ip];
  });

// Incoming connections might be from a client or another hub.
server.on("connection", (socket) => {
  const sendMessageToClient = (message: ServerOutgoingMessage) =>
    socket.send(JSON.stringify(message));
  let publicKeyForSocket = null;
  let isPeerHub = false;
  const setSocketPublicKey = (publicKey) => {
    publicKeyForSocket = publicKey;
    publicKeyToSocket[publicKey] = conj(
      publicKeyToSocket[publicKey] || [],
      sendMessageToClient,
    );
    redisAddToSet(publicKey, myIP());
  };
  const challenge = randomString();
  sendMessageToClient({ type: "challenge", payload: { challenge } });
  socket.on("close", () => {
    if (publicKeyForSocket) {
      publicKeyToSocket[publicKeyForSocket] =
        publicKeyToSocket[publicKeyForSocket].length === 1
          ? []
          : remove(publicKeyToSocket[publicKeyForSocket], socket);
      redisRemoveFromSet(publicKeyForSocket, myIP());
      if (hubIdToSocket[publicKeyForSocket] === socket) {
        socket.close();
        delete hubIdToSocket[publicKeyForSocket];
      }
    }
  });
  socket.on("message", async (message) => {
    const { type, payload }: ClientLibToServer | HubToHubMessage =
      JSON.parse(message);
    if (type === "hub-id") {
      if (publicKeyForSocket) return;
      const { publicKey, certificate } = payload;
      if (await verify(publicKey, certificate, challenge)) {
        if (has(hubIdToSocket, publicKey)) {
          hubIdToSocket[publicKey].close();
        }
        hubIdToSocket[publicKey] = socket;
        isPeerHub = true;
        publicKeyForSocket = publicKey;
        sendMessageToClient({ type: "validated" });
      } else {
        sendMessageToClient({ type: "bad-auth" });
      }
    }
    if (type === "relay") {
      if (!isPeerHub) return;
      publicKeyForSocket[payload.to].send(
        JSON.stringify({
          type: "message",
          payload,
        }),
      );
    }
    if (type === "id") {
      if (publicKeyForSocket) return; // A socket will serve only one publicKey until its death.
      const { publicKey, certificate } = payload;
      console.log("identifying client");
      if (await verify(publicKey, certificate, challenge)) {
        setSocketPublicKey(publicKey);
        sendMessageToClient({ type: "validated" });
      } else {
        sendMessageToClient({ type: "bad-auth" });
      }
    }
    if (type === "message") {
      if (!publicKeyForSocket) return; // Unauthenticated sockets are not to be used.
      const { to } = payload;
      if (!canSendMessage(publicKeyForSocket, to)) {
        return;
      }
      recordForRateLimitingAndBilling(publicKeyForSocket, to);
      console.log("processing message", payload);
      (publicKeyToSocket[to] || []).forEach((sendMessageToClient) => {
        sendMessageToClient({
          type: "message",
          payload,
        });
      });
      resolvePeerHubSockets(to).map((peerHubSocket) =>
        peerHubSocket.send(JSON.stringify(message))({
          type: "relay",
          payload,
        }),
      );
    }
  });
});
