import { createLibp2p } from 'libp2p'
import { http } from '@libp2p/http'
import { pingHTTP } from '@libp2p/http-ping'
import { canHandle } from '@libp2p/http-server/node'
import { createServer } from 'node:http'
import { HTTP_TEST_PROTOCOL } from './common.js'

// create a libp2p node with a HTTP service that can serve arbitrary HTTP
// protocols and a HTTP ping handler that implements the HTTP ping protocol
const node = await createLibp2p({
  services: {
    http: http(),
    pingHTTP: pingHTTP()
  }
})

// register a handler function for the passed protocol - it will be served at
// the protocol id path by default
node.services.http.handle(HTTP_TEST_PROTOCOL, {
  handler: (req) => {
    return new Response('Hello World!')
  }
})

// this handler will return `true` if the request was handled by the libp2p
// node, otherwise it should be passed to an application server like express
// or otherwise handled
const handled = canHandle(node)

// an HTTP server that listens on a port and receives incoming requests
const server = createServer()
server.on('request', (req, res) => {
  if (handled(req, res)) {
    return
  }

  res.statusCode = 404
  res.end()
})

server.listen(0, () => {
  console.info('Server listening on:')
  console.info(`http://127.0.0.1:${server.address().port}`)
})
