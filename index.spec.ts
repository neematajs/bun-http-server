import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Server } from './index'

describe('Should pass', () => {
  const hostname = 'localhost'
  const testValue = 'test'

  let port: number
  let server: Server

  const getUrl = (path: string) =>
    new URL(path, `http://${hostname}:${port}`).toString()

  const makeRequest = (path: string, method: string) =>
    fetch(getUrl(path), { method } as any).then((res) => {
      if (!res.ok) throw res.status
      return res.text()
    })

  beforeEach(() => {
    server = new Server({ port: 0 } as any)
      .get('/get', () => new Response(testValue))
      .post('/post', () => new Response(testValue))
      .get('/some/*/blob', () => new Response(testValue))
      .upgrade('/upgrade', () => ({ data: testValue }))
      .ws({
        open: (ws) => {
          ws.binaryType = 'nodebuffer'
        },
        message: (ws, message) => {
          ws.sendText(
            JSON.stringify({
              data: ws.data,
              message: message.toString('utf-8'),
            }),
          )
        },
      })
      .request(['GET', 'POST'], '/both', () => new Response(testValue))
    server.listen()
    port = server.port!
  })

  afterEach(() => {
    server?.close()
  })

  test('Should create a new server', () => {
    expect(server).toBeDefined()
  })

  test('Should handle GET', () => {
    expect(makeRequest('/get', 'GET')).resolves.toBe(testValue)
    expect(makeRequest('/post', 'GET')).rejects.toBe(404)
  })

  test('Should handle POST', () => {
    expect(makeRequest('/post', 'POST')).resolves.toBe(testValue)
    expect(makeRequest('/get', 'POST')).rejects.toBe(404)
  })

  test('Should handle both', () => {
    expect(makeRequest('/both', 'GET')).resolves.toBe(testValue)
    expect(makeRequest('/both', 'POST')).resolves.toBe(testValue)
  })

  test('Should handle blob', () => {
    expect(makeRequest('/some/anything/blob', 'GET')).resolves.toBe(testValue)
  })

  test('Should handle upgrade', async () => {
    const ws = new WebSocket(`ws://${hostname}:${port}/upgrade`)
    await new Promise((resolve) => (ws.onopen = resolve))
    ws.send(testValue)

    const message: MessageEvent = await new Promise(
      (resolve) => (ws.onmessage = resolve as any),
    )

    expect(JSON.parse(message.data)).toEqual({
      data: testValue,
      message: testValue,
    })
    const ws2 = new WebSocket(`ws://${hostname}:${port}/get`)
    await new Promise((resolve) => (ws2.onclose = resolve))
    expect(ws2.readyState).toBe(WebSocket.CLOSED)
  })
})
