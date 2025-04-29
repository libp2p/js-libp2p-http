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

// Step 2 start client
process.stdout.write(`node client.js ${address}\n`)

const {
  process: client
} = await matchOutput(/Hello World!/g, 'node', [path.resolve(__dirname, '../src/client.js'), address])

process.stdout.write('==================================================================\n')

client.kill()
server.kill()
