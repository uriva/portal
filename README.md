`portal` is a service to abstract away networking configuration, and replace them with an in-language API that developers can use easily.

# Motivation

Typical quotes:

- "I need to get the devops guy to open a port, nevermind I will just not do it"
- "Actually I need two way communication, so now I need to have a socket alongside my http connections. Shit. 🤦"
- "I can't get the messages to go through this firewallu."

It is a sad fact that even when you just want to pass messages from point A to point B, you need to consider the surrounding environment:

1. static ips or domain
2. opening ports to the hosting machine
3. configurations of cloud environments (heroku, amazon, gcp etc')

Using `portal` you can worry about this later or not at all, and simply `npm install` in two locations, plug in a string you generate locally, and you get instant connectivity.

# How does it work

Implementation is very simple - e2e encrypted messages are passed through a socket connecion to a third party server, running open source code.

It's still frustrating to send messasges between computers.
