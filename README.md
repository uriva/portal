# Portal

![A simple trick](https://mastermixmovies.files.wordpress.com/2018/10/290a2-prestige5.jpg)

Send JSON messages from anywhere to anywhere with 0 configuration.

## Quickstart

`npm i message-portal`

First make keys for Alice and Bob (repeat this twice):

```js
import { generatePrivateKey, getPublicKey } from "message-portal";

const privateKey = generatePrivateKey();
console.log(getPublicKey(privateKey), privateKey);
```

Then on Alice's machine:

```js
import { connect } from "message-portal";

const alicePrivateKey = "...";
const bobPublicKey = "...";

connect({
  privateKey: alicePrivateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(`Bob (${from}) says`, payload)),
  onClose: () => {},
}).then(({ send }) => {
  send({
    to: bobPublicKey,
    payload: { text: "hello Bob! I've sent you this json." },
  }).then(() => {
    console.log("Bob has acked!");
  });
});
```

On Bob's machine:

```js
import { connect } from "message-portal";

const bobPrivateKey = "...";
const alicePublicKey = "...";

connect({
  privateKey: bobPrivateKey,
  onMessage: ({ from, payload }) =>
    Promise.resolve(console.log(`Alice (${from}) says`, payload)),
  onClose: () => {},
}).then(({ send }) => {
  send({
    to: alicePublicKey,
    payload: "hello Alice, here's a string message.",
  }).then(() => {
    console.log("Alice has acked!");
  });
});
```

## Motivation

Somehow it's still frustrating to send messasges between pieces of codes.

Typical quotes:

- "I only know how to set up networking on GCP, not on AWS"
- "I need the devops guy to help me with helm, but they're not available right
  now"
- "Turns out I need two way communication, so now I need to have a socket
  alongside my http connections 🤦"
- "I can't get the messages to go through this firewall"

It is a sad fact that even when you just want to pass messages from point A to
point B, you still need to consider the surrounding environment:

1. static ips or domain
1. opening ports to the hosting machine
1. configurations of cloud environments (heroku, amazon, gcp etc')
1. Persistent connection (socket) or transient (http).

We would like a better abstraction over message passing.

Using `portal` you can worry about this later or not at all, and simply
`npm install` in two locations, plug in a string you generate locally, and you
get instant connectivity.

## Works everywhere

Portal works in Node.js, Deno, and the browser. Since it uses WebSockets
instead of HTTP, there are no CORS issues to deal with. Just `import` and go,
even from a plain `<script>` tag.

## How does it work

Implementation is very simple - e2e encrypted messages are passed through a
socket connecion to a third party server, running open source code.

Messages are e2e encrypted, so the server cannot look into them.

## Security

The relay server never sees your messages. Every message is encrypted with the
recipient's public key before it leaves your machine, using ECDH key exchange
over secp256k1. The server just shuffles opaque blobs around. A compromised
server learns nothing about your message contents.

This matters because the relay is a third party. You shouldn't have to trust it.
With portal, you don't. The server could be logging everything and it wouldn't
help an attacker.

Every message includes a timestamp signed by the sender. The recipient rejects
anything older than 5 minutes. This means if someone records your encrypted
traffic and replays it later, the other side will just drop it. You're safe from
re-transmission attacks without any extra configuration.
