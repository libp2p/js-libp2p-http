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

// Step 2 start fetch client
process.stdout.write(`node client-fetch.js ${address}\n`)

const {
  process: fetchClient
} = await matchOutput(/Hello World!/g, 'node', [path.resolve(__dirname, '../src/client-fetch.js'), address])

process.stdout.write('==================================================================\n')

// Step 2 start fetch client
process.stdout.write(`node client-http.js ${address}\n`)

const {
  process: httpClient
} = await matchOutput(/Hello World!/g, 'node', [path.resolve(__dirname, '../src/client-http.js'), address])

process.stdout.write('==================================================================\n')

fetchClient.kill()
httpClient.kill()
server.kill()
