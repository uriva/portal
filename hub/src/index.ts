import WebSocketServer from "ws";
import cryptoRandomString from "crypto-random-string";

const publicKeyToSocket = {};
const hubIpToSocket = {};

const server = new WebSocketServer({ port: 8080 });

const validate = (publicKey, certificate) => {
  console.error("not implemented");
  return true;
};

const conj = (arr, x) => [...arr, x];
const has = (key, map) => key in map;
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
  let publicKeyForSocket = null;
  let isPeerHub = false;
  const ip = request.socket.remoteAddress;
  const setSocketPublicKey = (publicKey) => {
    publicKeyForSocket = publicKey;
    publicKeyToSocket[publicKey] = conj(
      publicKeyToSocket[publicKey] || [],
      socket,
    );
    redisAddToSet(publicKey, myIP());
  };
  const challenge = cryptoRandomString({ length: 10 });
  socket.send(JSON.stringify({ type: "challenge", payload: challenge }));
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
    const { type, payload } = JSON.parse(message);
    if (type === "hub-id") {
      const { certificate, hubPublicKey } = payload;
      if (validate(hubPublicKey, certificate)) {
        if (has(hubIpToSocket, ip)) {
          hubIpToSocket[ip].close();
        }
        hubIpToSocket[ip] = socket;
        isPeerHub = true;
        socket.send(JSON.stringify({ type: "hub-validated" }));
      } else {
        socket.send(JSON.stringify({ type: "bad-hub-auth" }));
      }
    }

    if (type === "relay") {
      if (!isPeerHub) return;
      const { to, from, message } = payload;
      publicKeyForSocket[to].send(
        JSON.stringify({
          type: "message",
          payload: { from, message },
        }),
      );
    }

    if (type === "id") {
      if (publicKeyForSocket) return; // A socket will serve only one publicKey until its death.
      const { publicKey, certificate } = payload;
      if (validate(publicKey, certificate)) {
        setSocketPublicKey(publicKey);
        socket.send(JSON.stringify({ type: "validated" }));
      } else {
        socket.send(JSON.stringify({ type: "bad-auth" }));
      }
    }
    if (type === "message") {
      if (!publicKeyForSocket) return; // Unauthenticated sockets are not to be used.
      const { to, message, certificate } = payload;
      if (!canSendMessage(publicKeyForSocket, to)) {
        return;
      }
      recordForRateLimitingAndBilling(publicKeyForSocket, to);
      if (has(publicKeyToSocket, to)) {
        publicKeyToSocket[to].map((socket) => {
          socket.send(
            JSON.stringify({
              type: "message",
              payload: { from: publicKeyForSocket, message, certificate },
            }),
          );
        });
      }
      resolvePeerHubSockets(to).map((socket) =>
        socket.send(
          JSON.stringify({
            type: "relay",
            payload: { to, from: publicKeyForSocket, message, certificate },
          }),
        ),
      );
    }
  });
});
