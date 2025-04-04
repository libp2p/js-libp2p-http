import { webSocketHandler } from './websocket-handler.js'
import type { HTTPRequestHandler } from './index.js'
import type { HTTPRegistrar } from './registrar.js'

export function wellKnownHandler (registrar: HTTPRegistrar): HTTPRequestHandler {
  return webSocketHandler(ws => {
    const map = JSON.stringify(registrar.getProtocolMap())
    ws.send(map)
    ws.close()
  }, {
    fallback: async (req) => {
      const map = JSON.stringify(registrar.getProtocolMap())
      return new Response(map, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': `${map.length}`
        }
      })
    }
  })
}
