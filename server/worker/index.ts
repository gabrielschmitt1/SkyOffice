// Worker compatível com Colyseus para SkyOffice
export class RoomDurableObject {
  state: DurableObjectState
  env: Env
  rooms: Map<string, any>
  connections: Set<WebSocket>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.rooms = new Map()
    this.connections = new Set()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // Colyseus WebSocket upgrade
    if (url.pathname === '/' || url.pathname === '/ws') {
      return this.handleWebSocket(request)
    }
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 })
    }
    
    return new Response('Not Found', { status: 404 })
  }

  async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    server.accept()
    this.connections.add(server)
    this.handleGameConnection(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private handleGameConnection(webSocket: WebSocket) {
    const connectionId = Math.random().toString(36).substr(2, 9)
    
    // Enviar confirmação de conexão
    webSocket.send(JSON.stringify({
      type: 'connected',
      connectionId,
      message: 'Connected to SkyOffice server'
    }))
    
    webSocket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string)
        console.log('Received message:', data)
        
        // Processar diferentes tipos de mensagens
        switch (data.type) {
          case 'join_room':
            webSocket.send(JSON.stringify({
              type: 'room_joined',
              roomId: data.roomId || 'lobby',
              message: 'Successfully joined room'
            }))
            break
            
          case 'player_move':
            // Broadcast movimento para outros players
            this.broadcast({
              type: 'player_moved',
              playerId: connectionId,
              position: data.position
            }, webSocket)
            break

          case 'chat_message':
            // Broadcast mensagem de chat
            this.broadcast({
              type: 'chat_message',
              playerId: connectionId,
              message: data.message,
              timestamp: Date.now()
            }, webSocket)
            break
            
          default:
            // Echo para mensagens não reconhecidas
            webSocket.send(JSON.stringify({ type: 'echo', data }))
        }
      } catch (error) {
        console.error('Error processing message:', error)
        webSocket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }))
      }
    })

    webSocket.addEventListener('close', () => {
      console.log('WebSocket connection closed:', connectionId)
      this.connections.delete(webSocket)
    })

    webSocket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event)
      this.connections.delete(webSocket)
    })
  }

  private broadcast(message: any, sender?: WebSocket) {
    const messageStr = JSON.stringify(message)
    this.connections.forEach(ws => {
      if (ws !== sender && ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(messageStr)
        } catch (error) {
          console.error('Error broadcasting message:', error)
          this.connections.delete(ws)
        }
      }
    })
  }
}

// Worker principal
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: Date.now(),
        message: 'SkyOffice Worker is healthy'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // API endpoint para listar salas disponíveis
    if (url.pathname === '/api/rooms') {
      return new Response(JSON.stringify([
        { id: 'lobby', name: 'Public Lobby', players: 0, maxPlayers: 50 },
        { id: 'office1', name: 'Office Meeting Room', players: 0, maxPlayers: 20 }
      ]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Endpoint para criar/juntar-se a uma sala
    if (url.pathname === '/matchmake/joinOrCreate/lobby') {
      return new Response(JSON.stringify({ 
        message: 'Lobby endpoint',
        roomId: 'lobby-' + Math.random().toString(36).substr(2, 9),
        sessionId: Math.random().toString(36).substr(2, 16)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Redirecionar conexões WebSocket para Durable Object (Colyseus compatibility)
    if (url.pathname === '/' || url.pathname === '/ws' || url.pathname.startsWith('/matchmake/')) {
      const durableObjectId = env.ROOMS.idFromName('game-server')
      const durableObject = env.ROOMS.get(durableObjectId)
      return durableObject.fetch(request)
    }

    // Página inicial do Worker com informações úteis
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'SkyOffice Worker is running!',
        version: '2.0.0',
        endpoints: {
          health: '/health',
          websocket: '/ws',
          rooms: '/api/rooms',
          matchmaking: '/matchmake/joinOrCreate/lobby'
        },
        timestamp: new Date().toISOString(),
        status: 'online'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Not Found', { 
      status: 404, 
      headers: corsHeaders 
    })
  }
}

// Types para Cloudflare Workers
interface Env {
  ROOMS: DurableObjectNamespace
  NODE_ENV?: string
}

// Extensão dos tipos globais do WebSocket para Cloudflare Workers
declare const WebSocket: {
  readonly READY_STATE_CONNECTING: 0
  readonly READY_STATE_OPEN: 1
  readonly READY_STATE_CLOSING: 2
  readonly READY_STATE_CLOSED: 3
}