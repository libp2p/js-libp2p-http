import { createWebSocketServer as createWss } from '@libp2p/http-server/node'
import type { CanHandle } from '@libp2p/http-server/node'
import type { Server } from 'node:http'

export function createWebSocketServer (server: Server, handled?: CanHandle): Server {
  const wss = createWss()
  wss.addEventListener('connection', (evt) => {
    const ws = evt.webSocket

    if (handled?.(ws) === true) {
      return
    }

    if (ws.url === '/echo') {
      ws.addEventListener('message', (evt) => {
        ws.send(evt.data)
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
    wss.handleUpgrade(request, socket, head)
  })

  return server
}
