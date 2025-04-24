# Serve HTTP resources over libp2p streams using Express

In this example we will configure an [Express](https://expressjs.com/) server,
but instead of accepting incoming HTTP requests using a Node.js [http.Server](https://nodejs.org/api/http.html#class-httpserver)
instance, we will configure a libp2p node to listen on the `/http/1.1` protocol,
parse data sent over incoming streams on that protocol as HTTP requests and
inject them into the Express server.

This lets libp2p take care of the routing, thus taking advantage of features
like multi-routes, NAT transversal and stream multiplexing over a single
connection while integrating seamlessly with existing HTTP applications.

## Getting started

