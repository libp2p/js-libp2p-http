import type { Libp2pOverHTTPHandler } from './get-libp2p-over-http-handler.js'
import type { Server, RequestListener } from 'node:http'

export function createHttp (server: Server, handler?: Libp2pOverHTTPHandler): Server {
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
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
    res.setHeader('Access-Control-Allow-Headers', '*')

    if (handler?.(req, res) !== true) {
      app(req, res)
    }
  })

  return server
}
