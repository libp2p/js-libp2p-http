import cookies from '@fastify/cookie'
import { fastify } from 'fastify'
import type { CanHandle } from '@libp2p/http-server/node'
import type { FastifyRequest } from 'fastify'
import type { Server, IncomingMessage } from 'node:http'

export async function createFastifyHTTP (server: Server, handled?: CanHandle): Promise<Server> {
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

  await app.register(cookies)

  // fastify only supports 'application/json' and 'text/plain' by default
  app.addContentTypeParser('*', async (req: FastifyRequest, payload: IncomingMessage) => {
    return payload
  })
  app.get('/', async (req, reply) => {
    await reply.send('Hello World!')
  })
  app.post('/echo', (req, reply) => {
    if (typeof req.body === 'string') {
      return reply.send(req.body)
    }

    req.raw.on('data', (buf) => {
      reply.raw.write(buf)
    })
    req.raw.on('end', () => {
      reply.raw.end()
    })
    req.raw.on('error', (err) => {
      reply.raw.destroy(err)
    })
  })
  app.get('/set-cookies', async (req, res) => {
    res.statusCode = 201
    await res.setCookie('cookie-1', 'value-1', {
      domain: req.headers.host,
      maxAge: 3600
    })
      .setCookie('cookie-2', 'value-2')
      .send()
  })
  app.get('/get-cookies', async (req, res) => {
    await res.send(JSON.stringify(Object.entries(req.cookies).map(([key, value]) => `${key}=${value}`)))
  })

  await app.ready()

  if (server == null) {
    throw new Error('Server not created')
  }

  return server
}
