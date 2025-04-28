# @libp2p/http-client

[![libp2p.io](https://img.shields.io/badge/project-libp2p-yellow.svg?style=flat-square)](http://libp2p.io/)
[![Discuss](https://img.shields.io/discourse/https/discuss.libp2p.io/posts.svg?style=flat-square)](https://discuss.libp2p.io)
[![codecov](https://img.shields.io/codecov/c/github/libp2p/js-libp2p-http.svg?style=flat-square)](https://codecov.io/gh/libp2p/js-libp2p-http)
[![CI](https://img.shields.io/github/actions/workflow/status/libp2p/js-libp2p-http/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/libp2p/js-libp2p-http/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> libp2p-compatible implementation of the WebSocket api

# About

<!--

!IMPORTANT!

Everything in this README between "# About" and "# Install" is automatically
generated and will be overwritten the next time the doc generator is run.

To make changes to this section, please update the @packageDocumentation section
of src/index.js or src/index.ts

To experiment with formatting, please run "npm run docs" from the root of this
repo and examine the changes made.

-->

This module allows you to use HTTP requests as a transport for libp2p
protocols (libp2p over HTTP), and also libp2p streams as a transport for HTTP
requests (HTTP over libp2p).

It integrates with existing Node.js friendly HTTP frameworks such as
[express](https://expressjs.com/) and [Fastify](https://fastify.dev) as well
as [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request)/
[Response](https://developer.mozilla.org/en-US/docs/Web/API/Response)-based
frameworks like [Hono](https://hono.dev/).

It even allows creating Node.js-style [http.Server](https://nodejs.org/api/http.html#class-httpserver)s
and [WebSocketServer](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#class-websocketserver)s
in browsers to truly realize the power of the distributed web.

In addition to URL-based addressing, it can use a libp2p PeerId and/or
multiaddr(s) and lets libp2p take care of the routing, thus taking advantage
of features like multi-routes, NAT transversal and stream multiplexing over a
single connection.

# Install

```console
$ npm i @libp2p/http
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `Libp2pHttp` in the global namespace.

```html
<script src="https://unpkg.com/@libp2p/http/dist/index.min.js"></script>
```

# API Docs

- <https://libp2p.github.io/js-libp2p-http>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/libp2p/js-libp2p-http/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/libp2p/js-libp2p-http/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
