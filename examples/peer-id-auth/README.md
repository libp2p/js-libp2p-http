# HTTP Peer ID Auth

This folder contains a simple HTTP server and client that in both Go and JS that
will run the [HTTP Peer ID Auth](https://github.com/libp2p/specs/blob/master/http/peer-id-auth.md)
protocol to mutually authenticate the client and server and allow them to
exchange peer IDs.

Use this as an example for how to authenticate your server to libp2p clients (or
any client that wants to authenticate a peer id). You can also use this to
authenticate your client's peer id to a libp2p+HTTP server.

## Step 1 - start a server

You can start either the go server:

```console
cd go-peer
go run .
```

..or the js server

```console
node ./src/server.js
```

## Step 2 - start a client

You can start either the go client:

```console
cd go-peer
go run . client
```

..or the js client

```console
node ./src/client.js
```

You should see both the client and server print out each other's PeerIds.

