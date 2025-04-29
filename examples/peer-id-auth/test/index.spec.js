import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchOutput, execa } from 'test-ipfs-example/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await execa('go', ['build', '-o', 'go-node', 'main.go'], {
  cwd: path.resolve(__dirname, '../go-peer')
})

// Step 1 start go server
process.stdout.write(`./go-peer/go-node\n`)

const {
  process: goServer
} = await matchOutput(/listening on/g, './go-peer/go-node')

process.stdout.write('==================================================================\n')

// Step 2 start js client
process.stdout.write(`node src/client.js\n`)

const {
  process: jsClient
} = await matchOutput(/Server ID/g, 'node', [path.resolve(__dirname, '../src/client.js')])

process.stdout.write('==================================================================\n')

jsClient.kill()
goServer.kill()

// Step 1 start go server
process.stdout.write(`./go-peer/go-node\n`)

const {
  process: jsServer
} = await matchOutput(/listening on/g, './src/server.js')

process.stdout.write('==================================================================\n')

// Step 2 start js client
process.stdout.write(`node src/client.js\n`)

const {
  process: goClient
} = await matchOutput(/Server ID/g, './go-peer/go-node', ['client'])

process.stdout.write('==================================================================\n')

jsServer.kill()
goClient.kill()
