/* eslint-disable no-console */

import { createServer } from 'node:http'
import { http } from '@libp2p/http'
import { authenticatedRoute } from '@libp2p/http/routes'
import { HTTP_PEER_ID_AUTH_PROTOCOL } from '@libp2p/http-peer-id-auth'
import { canHandle } from '@libp2p/http-server/node'
import { createLibp2p } from 'libp2p'

const node = await createLibp2p({
  services: {
    http: http()
  }
})

node.services.http.handle(HTTP_PEER_ID_AUTH_PROTOCOL, authenticatedRoute({
  path: '/auth',
  handler: (req, peerId) => {
    console.log('Client ID:', peerId.toString())

    return new Response('', {
      status: 200
    })
  }
}))

node.services.http.handle('/log-my-id/1', authenticatedRoute({
  path: '/log-my-id',
  handler: (req, peerId) => {
    console.log('Client ID:', peerId.toString())

    return new Response('', {
      status: 200
    })
  }
}))

const handled = canHandle(node)

const server = createServer()
server.on('request', (req, res) => {
  if (handled(req, res)) {
    return
  }

  res.statusCode = 404
  res.end()
})

server.listen(8001, () => {
  console.info('Server listening on:')
  console.info(`http://127.0.0.1:${server.address().port}`)
  console.log('Server ID:', node.peerId.toString())
})
