import { crypto, types } from "shared";

import { WebSocketServer } from "ws";
import cryptoRandomString from "crypto-random-string";

type ClientLibToServer = types.ClientLibToServer;
type NotValidatedMessage = types.NotValidatedMessage;
type RegularMessagePayload = types.RegularMessagePayload;
type ServerChallengeMessage = types.ServerChallengeMessage;
type ServerRegularMessage = types.ServerRegularMessage;
type ValidatedMessage = types.ValidatedMessage;

type Certificate = crypto.Certificate;
type PublicKey = crypto.PublicKey;

type RelayMessage = {
  type: "relay";
  payload: RegularMessagePayload;
};

type HubIdMessage = {
  type: "hub-id";
  payload: {
    hubPublicKey: PublicKey;
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
const hubIpToSocket = {};

const server = new WebSocketServer({ port: 3000 });

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
    if (has(hubIpToSocket, ip)) {
      return hubIpToSocket[ip];
    }
    hubIpToSocket[ip] = connectToHubSocket(ip);
    return hubIpToSocket[ip];
  });

// Incoming connections might be from a client or another hub.
server.on("connection", (socket, request) => {
  const sendMessageToClient = (message: ServerOutgoingMessage) =>
    socket.send(JSON.stringify(message));
  let publicKeyForSocket = null;
  let isPeerHub = false;
  const ip = request.socket.remoteAddress;
  const setSocketPublicKey = (publicKey) => {
    publicKeyForSocket = publicKey;
    publicKeyToSocket[publicKey] = conj(
      publicKeyToSocket[publicKey] || [],
      sendMessageToClient,
    );
    redisAddToSet(publicKey, myIP());
  };
  const challenge = cryptoRandomString({ length: 10 });
  sendMessageToClient({ type: "challenge", payload: { challenge } });
  socket.on("close", () => {
    if (publicKeyForSocket) {
      publicKeyToSocket[publicKeyForSocket] =
        publicKeyToSocket[publicKeyForSocket].length === 1
          ? []
          : remove(publicKeyToSocket[publicKeyForSocket], socket);
      redisRemoveFromSet(publicKeyForSocket, myIP());
      if (hubIpToSocket[ip] === socket) {
        socket.close();
        delete hubIpToSocket[ip];
      }
    }
  });
  socket.on("message", (message) => {
    const { type, payload }: ClientLibToServer | HubToHubMessage =
      JSON.parse(message);
    if (type === "hub-id") {
      const { certificate, hubPublicKey } = payload;
      if (crypto.validate(hubPublicKey, certificate, hubPublicKey)) {
        if (has(hubIpToSocket, ip)) {
          hubIpToSocket[ip].close();
        }
        hubIpToSocket[ip] = socket;
        isPeerHub = true;
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
      if (crypto.validate(publicKey, certificate, challenge)) {
        setSocketPublicKey(publicKey);
        sendMessageToClient({ type: "validated" });
      } else {
        sendMessageToClient({ type: "bad-auth" });
      }
    }
    if (type === "message") {
      if (!publicKeyForSocket) return; // Unauthenticated sockets are not to be used.
      const { to, certificate, from } = payload;
      if (from !== publicKeyForSocket) return;
      if (!canSendMessage(publicKeyForSocket, to)) {
        return;
      }
      recordForRateLimitingAndBilling(publicKeyForSocket, to);
      console.log("processing message", payload);
      if (has(publicKeyToSocket, to)) {
        publicKeyToSocket[to].forEach((sendMessageToClient) => {
          sendMessageToClient({
            type: "message",
            payload,
          });
        });
      }
      resolvePeerHubSockets(to).map((socket) =>
        sendMessageToClient({
          type: "relay",
          payload: {
            to,
            from: publicKeyForSocket,
            payload: payload.payload,
            certificate,
          },
        }),
      );
    }
  });
});
