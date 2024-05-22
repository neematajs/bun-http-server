# Simple wrapper for Bun's built-in HTTP server

### Features
 - simple routing
 - cors

### Install
```sh
bun install @neematajs/bun-http-server
```

### Usage
```TS
import { Server } from '@neematajs-bun/http-server'

const server = new Server({
    // bun serve options except "fetch" and "ws", see https://bun.sh/docs/api/http#bun-serve
  }, 
  {
    cors: {
      // cors options 
    }
  }
)
  .get('/some-endpoint', (req, server) => new Response()) // matches "GET /some-enpoint"
  .post('/some/*/endpoint', (req, server) => new Response()) // matches "POST /some/anything/endpoint"
  .request(['GET', 'POST'], (req, server) => new Response())
  .upgrade('/ws', (req) => {
    const data = { some: 'ws data here' }
    const headers = {}
    return { data, headers }
  })
  .ws({
    // bun's ws handlers, see https://bun.sh/docs/api/websockets
  })
```
