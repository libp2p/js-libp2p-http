# libp2p as a HTTP transport

In this example we will see how we can use libp2p as a transport for HTTP
messages in Node.js. We will configure [Undici](https://github.com/nodejs/undici),
Node's [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
implementation, and [http.request](https://nodejs.org/api/http.html#httprequesturl-options-callback)
to use libp2p as it's networking layer, in order for it to take advantage of
peer discovery, NAT traversal, multi-routes and other libp2p features.

## Step 1 - start the server

The script at [./src/server.js](./src/server.js) creates a basic [express](https://expressjs.com/)
app that has a simple "Hello world" route mounted on `/`.

It creates a `http.Server` to pass HTTP requests to the express app, and finally
a libp2p node to make incoming `Stream`s conform to the `net.Socket` API and
pass them to the `http.Server`.

Run the server with the following command:

```console
node src/server.js
Server listening on:
/ip4/127.0.0.1/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
/ip4/192.168.1.226/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
```

## Step 2 - run the Undici/fetch client

The script at [./src/client-fetch.js](./src/client-fetch.js) uses a custom
[dispatcher](https://github.com/nodejs/undici/blob/main/docs/docs/api/Dispatcher.md)
with Node.js' built-in fetch implementation, [Undici](https://github.com/nodejs/undici),
to open a stream to the libp2p server over which HTTP messages are sent.

Copy the URL that the server is listening on and pass it as a CLI arg:

```console
node ./src/client-fetch.js /ip4/127.0.0.1/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
GET /ip4/127.0.0.1/tcp/49153/p2p/12D3KooWKkShDk1oJDmBp4GsREbS8uqkiMhj9MJP9HGkWes7KavK 200 OK
Hello World!
```

## Step 3 - run the HTTP client

The script at [./src/client-http.js](./src/client-http.js) uses a custom [Agent](https://nodejs.org/api/http.html#class-httpagent)
to work with the [request](https://nodejs.org/api/http.html#httprequestoptions-callback)
function from Node.js' `http` module in a similar way.

Copy the URL that the server is listening on and pass it as a CLI arg:

```console
node ./src/client-http.js /ip4/127.0.0.1/tcp/1234/p2p/12D3KooWPUq3SjKGmVz4fhqMHZpZ185ZErfusp9x4QFgqwVCTxWt
GET /ip4/127.0.0.1/tcp/49153/p2p/12D3KooWKkShDk1oJDmBp4GsREbS8uqkiMhj9MJP9HGkWes7KavK 200 OK
Hello World!
```

## Next steps

The configured peer receives all HTTP requests - can you write a basic version
of shared hosting where separate HTTP servers or apps might receive requests for
different requested hosts?
