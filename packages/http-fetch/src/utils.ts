import { blobBody } from './body/blob.js'
import { bytesBody } from './body/bytes.js'
import { formDataBody } from './body/form-data.js'
import { readableStreamBody } from './body/readable-stream.js'
import { stringBody } from './body/string.js'

export function normalizeContent (body: BodyInit | null | undefined, headers: Headers): ReadableStream | undefined {
  if (body == null) {
    return
  }

  if (typeof body === 'string') {
    return stringBody(body, headers)
  } else if (body instanceof Blob) {
    return blobBody(body, headers)
  } else if (isBytes(body)) {
    return bytesBody(body, headers)
  } else if (body instanceof URLSearchParams) {
    return stringBody(body.toString(), headers)
  } else if (body instanceof ReadableStream) {
    return readableStreamBody(body, headers)
  } else if (body instanceof FormData) {
    return formDataBody(body, headers)
  }

  throw new Error('Unsupported body type')
}

function isBytes (obj?: any): obj is Uint8Array {
  if (obj == null) {
    return false
  }

  return obj.byteLength != null
}
