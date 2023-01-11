`portal` is a service to abstract away networking configuration, and replace them with an in-language API that developers can use easily.

# Motivation

1. I need to get the devops guy to open a port -> I will just not do it
1. Actually I need two way communication, so now I need to have a socket alongside my rpc connections. Shit. 🤦
1. I can't get the messages to go through this firewall.

It's still frustrating to send messasges between computers.

# Features

mvp:

1. e2ee

future:

1. load balancing
1. session preservation (all requests from a client reach the same server)
1.

# Architecture

1. redis stores who is connected to whom
1. acking every message is implemented on client-lib (not involving the hub)
   1. technically the recieving client sends to the sender a certificate of the original message certificate.

# Todo

1. how to restart a hub without harming traffic
1. cleanup inactive sockets
1. client lib
   1. acking
1. redis
