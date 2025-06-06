import { toWebSocket } from '@libp2p/http-server/node'
import { WebSocketServer } from 'ws'
import type { CanHandle } from '@libp2p/http-server/node'
import type { Server } from 'node:http'

export function createWss (server: Server, handled?: CanHandle): Server {
  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', (ws, req) => {
    if (handled?.(toWebSocket(ws, req)) === true) {
      return
    }

    if (req.url === '/echo') {
      ws.on('message', (data) => {
        ws.send(data)
      })
    } else {
      ws.send('Hello world!')
      ws.close()
    }
  })

  server.on('request', (req, res) => {
    if (handled?.(req, res) === true) {
      return
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
    res.setHeader('Access-Control-Allow-Headers', '*')

    res.writeHead(400)
    res.end()
  })
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  })

  return server
}
