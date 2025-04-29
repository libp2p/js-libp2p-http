# Serving websites from web browsers with libp2p

With libp2p providing the networking layer for HTTP servers, you are no longer
limited to servers being in the cloud or on servers with fixed addresses.

Instead a web browser listening on a WebRTC address can serve web pages in the
same way a Node.js server can.

Finally, the distributed web!

## Step 1 - start the relay

In order for a browser node to be dialable over WebRTC, it needs a mechanism to
perform an [SDP handshake](https://en.wikipedia.org/wiki/Session_Description_Protocol).

libp2p uses Circuit Relay servers to do this.

```console
npm run relay

> @libp2p/http-example-serving-websites-from-web-browsers@1.0.0 relay
> node ./src/relay.js

Relay listening on:
/ip4/127.0.0.1/tcp/50040/ws/p2p/12D3KooWG7UmwmLGGfg7QhciMoEG7Zirz7ecCcAir26uZwPLEF62
/ip4/192.168.1.226/tcp/50040/ws/p2p/12D3KooWG7UmwmLGGfg7QhciMoEG7Zirz7ecCcAir26uZwPLEF62
```

## Step 2 - start the browser-server

[index.js]('./index.js) in this directory contains code to run a libp2p node
that listens on the `/http/1.1` protocol for incoming requests and hands them
off to a web server created using `createServer` from
`@libp2p/http-server/node`.

This function implements the same API as [http.createServer](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener)
just without depending on any Node.js internals so you can use it in a web
browser with no other dependencies!

Start the webapp (your browser should open):
"
```console
npm start

  VITE v6.3.3  ready in 63 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Paste one of the relay addresses into the text box and click "Connect".

Eventually one or more listening addresses should appear on the page.

## Step 3 - run the HTTP proxy

Unfortunately we still can't listen on a socket in a web browser, so if we want
to see this working in a browser window we'll need to proxy incoming HTTP
requests.

Start the proxy server with one of the listening addresses from the web page:

```console
npm run proxy -- /ip4/127.0.0.1/tcp/57457/ws/p2p/12Relay.../p2p-circuit/webrtc/p2p/12Browser

Proxy listening on:
http://127.0.0.1:62305
```

## Step 4 - open the proxy URL in another browser

Open the proxy URL in a web browser and you should see the page served from
the first browser over a libp2p stream.

## Next steps

Can you serve images from the server?

What about adding REST-like endpoints that you can invoke from the page served
by the first web page?

`@libp2p/http-server/node` also exports a `createWebSocketServer` function, can
you use it to serve WebSocket connections from browsers?

Libp2p has a `@libp2p/websocket` transport - can you implement your own
transport that runs libp2p over websockets over HTTP over libp2p over WebRTC?
