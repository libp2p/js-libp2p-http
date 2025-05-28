import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchOutput } from 'test-ipfs-example/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Step 1 start server
process.stdout.write('node server.js\n')

const {
  process: server,
  matches: addresses
} = await matchOutput(/Server listening on:\n(.*)\n/, 'node', [path.resolve(__dirname, '../src/server.js')])

const address = addresses.slice(1).map(line => line.trim()).pop()

process.stdout.write('==================================================================\n')

// Step 2 start HTTP client
process.stdout.write(`node client-http.js ${address}\n`)

const {
  process: clientHTTP
} = await matchOutput(/Ping took/g, 'node', [path.resolve(__dirname, '../src/client-http.js'), address])

process.stdout.write('==================================================================\n')

// Step 2 start client
process.stdout.write(`node client-libp2p.js ${address}\n`)

const {
  process: clientLibp2p
} = await matchOutput(/Ping took/g, 'node', [path.resolve(__dirname, '../src/client-libp2p.js'), address])

process.stdout.write('==================================================================\n')

clientHTTP.kill()
clientLibp2p.kill()
server.kill()
