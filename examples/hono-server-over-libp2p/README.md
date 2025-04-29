# Serving a Hono app over libp2p

In this example we will start a libp2p node that listens for incoming streams
that use the `/http/1.1` protocol.

It will convert the incoming stream to a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request)
and hand it off to a fetch-based handler (in the example we use [Hono]()https://hono.dev/)
and then write the returned [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response)
back into the stream for the client to read.

## Step 1 - start the server

The script at [./src/server.js](./src/server.js) creates a basic [express](https://expressjs.com/)
app that has a simple "Hello world" route mounted on `/`.

It creates a `Hono` app to serve HTTP content, and a libp2p node to make
incoming `Stream`s conform to the `Request` API and pass them to the app.

Run the server with the following command:

```console
node src/server.js
Server listening on:
/ip4/127.0.0.1/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
/ip4/192.168.1.226/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
```

## Step 2 - run the client

The script at [./src/client.js](./src/client.js) starts a libp2p node with the
TCP transport, accepts a command line argument of a multiaddr and makes a HTTP
request to it over a libp2p stream.

Copy one of the multiaddrs the server is listening on and pass it as a CLI arg:

```console
node ./src/client.js /ip4/127.0.0.1/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
GET /ip4/127.0.0.1/tcp/55265/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt 200 OK
Hello World!
```

## Next steps

Experiment with the server - can you make it accept requests on other paths?

What about query parameters or custom headers?

> [!TIP]
> You can add `http-path` tuples to a multiaddr with:
> ```
> addr.encapsulate(`/http-path/${encodeURIComponent(foo?bar=baz)}`)
> ```

How about making a request with a body such as a `POST` request?
