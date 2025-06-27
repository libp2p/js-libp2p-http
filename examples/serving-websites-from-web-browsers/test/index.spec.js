import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup, expect } from 'test-ipfs-example/browser'
import { matchOutput } from 'test-ipfs-example/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Setup
const test = setup()

// DOM
const connectBtn = '#dial-multiaddr-button'
const connectAddr = '#dial-multiaddr-input'
const output = 'body'
const listeningAddresses = '#listening-addresses'

let url

test.describe('serving websites from a web browser:', () => {
  let relayNode
  let relayNodeAddr
  let proxyNode
  let proxyNodeAddr

  test.beforeAll(async ({ servers }, testInfo) => {
    testInfo.setTimeout(5 * 60_000)

    const {
      process: relayProc,
      matches: relayAddr
    } = await matchOutput(/Relay listening on:\n(.*)\n/, 'node', [path.resolve(__dirname, '../src/relay.js')])

    relayNode = relayProc
    relayNodeAddr = relayAddr[1]

    url = servers[0].url
  }, {})

  test.afterAll(() => {
    proxyNode?.kill()
    relayNode?.kill()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(url)
  })

  test('should serve a web page via the proxy', async ({ page: pageA, context }) => {
    // connect the first page to the relay
    const webRTCAddressA = await dialRelay(pageA, relayNodeAddr)

    // start the proxy
    const {
      process: proxyProc,
      matches: proxyAddr
    } = await matchOutput(/Proxy listening on:\n(.*)\n/, 'node', [path.resolve(__dirname, '../src/proxy.js'), webRTCAddressA])

    proxyNode = proxyProc
    proxyNodeAddr = proxyAddr[1]

    // load second page
    const pageB = await context.newPage()
    await pageB.goto(proxyNodeAddr)

    const outputLocator = pageB.locator(output)
    await expect(outputLocator).toContainText('This web page was served from a browser')
  })
})

async function dialRelay (page, address) {
  // add the relay multiaddr to the input field and submit
  await page.fill(connectAddr, address)
  await page.click(connectBtn)

  const outputLocator = page.locator(output)
  await expect(outputLocator).toContainText(`Dialing '${address}'`)
  await expect(outputLocator).toContainText(`Connected to '${address}'`)

  const multiaddrsLocator = page.locator(listeningAddresses)
  await expect(multiaddrsLocator).toHaveText(/webrtc/)

  const multiaddrs = await page.textContent(listeningAddresses)
  const addr = multiaddrs.split(address).filter(str => str.includes('webrtc')).pop()

  return address + addr
}
