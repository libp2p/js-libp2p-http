/**
 * Extends the native Response class to preserve the passed headers - the fetch
 * spec restricts access to certain headers that we need access to -
 * `set-cookie`, `Access-Control-*`, etc, and the native Response implementation
 * in browsers removes them
 */
export class Response extends globalThis.Response {
  public readonly headers: Headers

  constructor (body: BodyInit | null, init?: ResponseInit) {
    super(body, init)

    this.headers = new Headers(init?.headers)
  }
}
