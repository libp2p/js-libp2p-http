# Serving libp2p over an Express app

This example is the inverse of [../express-server-over-libp2p](../express-server-over-libp2p/README.md)
- instead of serving an Express app over libp2p streams, we're going to serve
libp2p protocols over HTTP.

## Step 1 - start the server

The script at [./src/server.js](./src/server.js) creates a libp2p node with a
custom HTTP protocol handler registered for `/test-http-protocol/1.0.0` in
addition to a `@libp2p/http-ping` handler.

It creates a `http.Server` to accept incoming HTTP requests and uses the
`canHandle` function exported by `@libp2p/http-server/node` to try to delegate
processing of each incoming request to libp2p, otherwise it returns a 404.

Run the server with the following command:

```console
node src/server.js
Server listening on:
http://127.0.0.1:58135
```

## Step 2 - run the HTTP client

The script at [./src/client-http.js](./src/client-http.js) uses [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
to interact with the libp2p server over HTTP without using any libp2p modules
itself.

It invokes the custom HTTP protocol handler, then the `@libp2p/http-ping`
handler.

Copy the URL that the server is listening on and pass it as a CLI arg:

```console
node ./src/client-http.js http://127.0.0.1:58231
GET http://127.0.0.1:58231/test-http-protocol/1.0.0 200 OK
Hello World!
GET http://127.0.0.1:58231/http-ping/1 200 OK
Ping took 2 ms
```

## Step 3 - run the libp2p client

The script at [./src/client-libp2p.js](./src/client-libp2p.js) behaves in the
same way as the HTTP client, except it uses a libp2p node to send the HTTP
requests instead of [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

Copy the URL that the server is listening on and pass it as a CLI arg:

```console
node client-libp2p.js http://127.0.0.1:58231
GET http://127.0.0.1:58231 200 OK
Hello World!
Ping took 3 ms
```

## Next steps

Experiment with the server - can you add your own custom HTTP handler and invoke
it from the client?

Which is easier, using fetch or libp2p?
