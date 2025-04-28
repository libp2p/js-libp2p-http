import type { CanHandle } from '@libp2p/http-server/node'
import type { Server, RequestListener } from 'node:http'

export function createHttp (server: Server, handled?: CanHandle): Server {
  const app: RequestListener = (req, res) => {
    if (req.url === '/echo') {
      req.pipe(res)

      return
    }

    if (req.url === '/set-cookies') {
      res.appendHeader('set-cookie', `cookie-1=value-1; Domain=${req.headers.host}; Max-Age=3600`)
      res.appendHeader('set-cookie', 'cookie-2=value-2')
      res.writeHead(201)
      res.end()

      return
    }

    if (req.url === '/get-cookies') {
      res.end(JSON.stringify(req.headers.cookie?.split(';').map(s => s.trim()) ?? []))

      return
    }

    res.end('Hello World!')
  }

  server.on('request', (req, res) => {
    if (handled?.(req, res) !== true) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
      res.setHeader('Access-Control-Allow-Methods', ['OPTIONS', req.headers['access-control-request-method'] ?? ''])
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*')

      app(req, res)
    }
  })

  return server
}
