import fastifyWebSocket from '@fastify/websocket'
import { toWebSocket } from '@libp2p/http-server/node'
import { fastify } from 'fastify'
import type { CanHandle } from '@libp2p/http-server/node'
import type { Server } from 'node:http'

export async function createFastifyWebSocket (server: Server, handled?: CanHandle): Promise<Server> {
  const app = fastify({
    serverFactory: (app, opts) => {
      server.addListener('request', (req, res) => {
        if (handled?.(req, res) !== true) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Request-Method', '*')
          res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
          res.setHeader('Access-Control-Allow-Headers', '*')

          app(req, res)
        }
      })

      return server
    }
  })
  await app.register(fastifyWebSocket)
  await app.register(async function (fastify) {
    fastify.get('/echo', { websocket: true }, (socket, req) => {
      socket.on('message', message => {
        socket.send(message)
      })
    })
    fastify.get('/*', { websocket: true }, (socket, req) => {
      if (handled?.(toWebSocket(socket, req.raw)) === true) {
        return
      }

      socket.send('Hello world!')
      socket.close()
    })
  })

  await app.ready()

  if (server == null) {
    throw new Error('Server not created')
  }

  return server
}
