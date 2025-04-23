import fastifyWebSocket from '@fastify/websocket'
import { fastify } from 'fastify'
import { toWebSocket } from './to-websocket.js'
import type { DidHandle } from '../../src/servers/node.js'
import type { Server } from 'node:http'

export async function createFastifyWebSocket (server: Server, handler?: DidHandle): Promise<Server> {
  const app = fastify({
    serverFactory: (app, opts) => {
      server.addListener('request', (req, res) => {
        if (handler?.(req, res) !== true) {
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
      if (handler?.(toWebSocket(socket, req.raw)) === true) {
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
