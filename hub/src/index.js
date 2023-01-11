import WebSocket from "ws";
import cryptoRandomString from "crypto-random-string";

const publicKeyToSocket = {};
const hubIpToSocket = {};

const server = new WebSocket.Server({ port: 8080 });

const conj = () => {};
const has = () => {};
const remove = () => {};
const isMeIP = () => {};
const connectToHubSocket = () => {};

const redisAddToSet = () => {};
const redisGetWithDefault = () => {};
const redisRemoveFromSet = () => {};

const recordForRateLimitingAndBilling = () => {};

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
    redisAddToSet(publicKey, myIP);
  };
  const challenge = cryptoRandomString({ length: 10 });
  socket.send(JSON.stringify({ event: "challenge", payload: challenge }));
  socket.on("close", () => {
    if (publicKeyForSocket) {
      publicKeyToSocket[publicKeyForSocket] =
        publicKeyToSocket[publicKeyForSocket].length === 1
          ? []
          : remove(publicKeyToSocket[publicKey], socket);
      redisRemoveFromSet(publicKey, myIP);
      if (hubIpToSocket[ip] === socket) {
        socket.close();
        delete hubIpToSocket[ip];
      }
    }
  });
  socket.on("message", (message) => {
    const { event, payload } = JSON.parse(message);
    if (event === "hub-id") {
      const { certificate } = payload;
      if (validate(hubsPublicKey, certificate, challenge)) {
        if (has(hubIpToSocket, ip)) {
          hubIpToSocket[ip].close();
        }
        hubIpToSocket[ip] = socket;
        isPeerHub = true;
        socket.send(JSON.stringify({ event: "hub-validated" }));
      } else {
        socket.send(JSON.stringify({ event: "bad-hub-auth" }));
      }
    }

    if (event === "relay") {
      if (!isPeerHub) return;
      const { to, from, message } = payload;
      publicKeyForSocket[to].send(
        JSON.stringify({
          event: "message",
          payload: { from, message },
        }),
      );
    }

    if (event === "id") {
      if (publicKeyForSocket) return; // A socket will serve only one publicKey until its death.
      const { publicKey, certificate } = payload;
      if (validate(publicKey, certificate, challenge)) {
        setSocketPublicKey(publicKey);
        socket.send(JSON.stringify({ event: "validated" }));
      } else {
        socket.send(JSON.stringify({ event: "bad-auth" }));
      }
    }
    if (event === "message") {
      if (!publicKeyForSocket) return; // Unauthenticated sockets are not to be used.
      const { to, message } = payload;
      if (!canSendMessage(publicKeyForSocket, to)) {
        return;
      }
      recordForRateLimitingAndBilling(publicKeyForSocket, to);
      if (has(publicKeyToSocket, to)) {
        publicKeyToSocket[to].map((socket) => {
          socket.send(
            JSON.stringify({
              event: "message",
              payload: { from: publicKeyForSocket, message },
            }),
          );
        });
      }
      resolvePeerHubSockets(to).map((socket) =>
        socket.send(
          JSON.stringify({
            event: "relay",
            payload: { to, from: publicKeyForSocket, message },
          }),
        ),
      );
    }
  });
});
