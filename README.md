`portal` is a service to abstract away networking configuration, and replace them with an in-language API that developers can use easily.

`npm i message-portal`

# Example usage

```
const { connect, generatePrivateKey, getPublicKey } = require("message-portal");

// Imagine each of these segments happen on a different machine, with
// arbitrary networking setup.
// All Alice and Bob need to do to communicate is have the other party's public key.
Promise.all([generatePrivateKey(), generatePrivateKey()]).then(([alice, bob]) =>
  Promise.all([
    connect({
      privateKey: alice,
      onMessage: ({ from, payload }) =>
        Promise.resolve(console.log(`bob (${from}) says`, payload)),
      onClose: () => {},
    }),
    connect({
      privateKey: bob,
      onMessage: ({ from, payload }) =>
        Promise.resolve(console.log(`alice (${from}) says`, payload)),
      onClose: () => {},
    }),
  ]).then(([aliceSendMessage, bobSendMessage]) => {
    aliceSendMessage({
      to: getPublicKey(bob),
      payload: { text: "hello Bob! I've sent you this small json" },
    }).then(() => {
      console.log("Bob has acked!");
    });
    bobSendMessage({
      to: getPublicKey(alice),
      payload: "hello alice here's a string message",
    }).then(() => {
      console.log("Alice has acked!");
    });
  }),
);
```

# Motivation

Typical quotes:

- "I need to get the devops guy to open a port, nevermind I will just not do it"
- "Actually I need two way communication, so now I need to have a socket alongside my http connections. Shit. 🤦"
- "I can't get the messages to go through this firewallu."

It is a sad fact that even when you just want to pass messages from point A to point B, you need to consider t he surrounding environment:

1. static ips or domain
2. opening ports to the hosting machine
3. configurations of cloud environments (heroku, amazon, gcp etc')

Using `portal` you can worry about this later or not at all, and simply `npm install` in two locations, plug in a string you generate locally, and you get instant connectivity.

# How does it work

Implementation is very simple - e2e encrypted messages are passed through a socket connecion to a third party server, running open source code.

It's still frustrating to send messasges between computers.
