// Worker compatível com Colyseus para SkyOffice
export class RoomDurableObject {
  state: DurableObjectState
  env: Env
  rooms: Map<string, any>
  connections: Map<string, WebSocket>
  roomConnections: Map<string, Set<string>>
  computerUsers: Map<string, Set<string>> // computerId -> Set<connectionId>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.rooms = new Map()
    this.connections = new Map()
    this.roomConnections = new Map()
    this.computerUsers = new Map()
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
    const connectionId = Math.random().toString(36).substr(2, 9)
    this.connections.set(connectionId, server)
    this.handleGameConnection(server, connectionId)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private handleGameConnection(webSocket: WebSocket, connectionId: string) {
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
            this.handleJoinRoom(webSocket, connectionId, data.roomId || 'lobby')
            break
            
          case 'player_move':
            // Broadcast movimento para outros players na mesma sala
            this.broadcastToRoom({
              type: 'player_moved',
              playerId: connectionId,
              position: data.position
            }, connectionId)
            break

          case 'chat_message':
            // Broadcast mensagem de chat para a sala (exceto para o remetente)
            this.broadcastToRoom({
              type: 'chat_message',
              playerId: connectionId,
              message: data.message,
              timestamp: Date.now()
            }, connectionId)
            break
            
          case 'connect_computer':
            this.handleConnectComputer(connectionId, data.computerId)
            break
            
          case 'disconnect_computer':
            this.handleDisconnectComputer(connectionId, data.computerId)
            break
            
          case 'create_room':
            this.handleCreateRoom(webSocket, connectionId, data.roomData)
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
      this.handleDisconnect(connectionId)
    })

    webSocket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event)
      this.handleDisconnect(connectionId)
    })
  }

  private handleJoinRoom(webSocket: WebSocket, connectionId: string, roomId: string) {
    // Remover de outras salas primeiro
    this.removeFromAllRooms(connectionId)
    
    // Adicionar à nova sala
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set())
    }
    this.roomConnections.get(roomId)!.add(connectionId)
    
    // Enviar confirmação com lista de jogadores existentes
    const existingPlayers = Array.from(this.roomConnections.get(roomId)!.values())
      .filter(id => id !== connectionId)
    
    webSocket.send(JSON.stringify({
      type: 'room_joined',
      roomId: roomId,
      connectionId: connectionId,
      message: 'Successfully joined room',
      playersInRoom: this.roomConnections.get(roomId)!.size,
      existingPlayers: existingPlayers
    }))
    
    // Notificar outros players na sala
    this.broadcastToRoom({
      type: 'player_joined',
      playerId: connectionId,
      message: 'Player joined the room'
    }, connectionId)
    
    console.log(`Player ${connectionId} joined room ${roomId}. Total players: ${this.roomConnections.get(roomId)!.size}`)
  }

  private handleDisconnect(connectionId: string) {
    this.removeFromAllRooms(connectionId)
    this.removeFromAllComputers(connectionId)
    this.connections.delete(connectionId)
  }

  private removeFromAllRooms(connectionId: string) {
    for (const [roomId, players] of this.roomConnections) {
      if (players.has(connectionId)) {
        players.delete(connectionId)
        
        // Notificar outros players que alguém saiu
        this.broadcastToRoom({
          type: 'player_left',
          playerId: connectionId,
          message: 'Player left the room'
        }, connectionId)
        
        console.log(`Player ${connectionId} left room ${roomId}. Remaining players: ${players.size}`)
        
        // Se a sala ficou vazia, podemos removê-la
        if (players.size === 0) {
          this.roomConnections.delete(roomId)
        }
        break
      }
    }
  }

  private broadcastToRoom(message: any, senderConnectionId: string) {
    const messageStr = JSON.stringify(message)
    
    // Encontrar a sala do sender
    for (const [roomId, players] of this.roomConnections) {
      if (players.has(senderConnectionId)) {
        // Broadcast para todos na sala exceto o sender
        for (const playerId of players) {
          if (playerId !== senderConnectionId) {
            const ws = this.connections.get(playerId)
            if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
              try {
                ws.send(messageStr)
              } catch (error) {
                console.error('Error broadcasting message:', error)
                this.handleDisconnect(playerId)
              }
            }
          }
        }
        break
      }
    }
  }

  private broadcast(message: any, sender?: WebSocket) {
    const messageStr = JSON.stringify(message)
    this.connections.forEach((ws, connectionId) => {
      if (ws !== sender && ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(messageStr)
        } catch (error) {
          console.error('Error broadcasting message:', error)
          this.handleDisconnect(connectionId)
        }
      }
    })
  }

  private handleConnectComputer(connectionId: string, computerId: string) {
    // Remover de outros computadores primeiro
    this.removeFromAllComputers(connectionId)
    
    // Adicionar ao computador
    if (!this.computerUsers.has(computerId)) {
      this.computerUsers.set(computerId, new Set())
    }
    this.computerUsers.get(computerId)!.add(connectionId)
    
    // Notificar outros usuários no computador
    this.broadcastToComputer({
      type: 'computer_user_joined',
      playerId: connectionId,
      computerId: computerId
    }, computerId, connectionId)
    
    console.log(`Player ${connectionId} connected to computer ${computerId}. Total users: ${this.computerUsers.get(computerId)!.size}`)
  }

  private handleDisconnectComputer(connectionId: string, computerId: string) {
    if (this.computerUsers.has(computerId)) {
      this.computerUsers.get(computerId)!.delete(connectionId)
      
      // Notificar outros usuários no computador
      this.broadcastToComputer({
        type: 'computer_user_left',
        playerId: connectionId,
        computerId: computerId
      }, computerId, connectionId)
      
      console.log(`Player ${connectionId} disconnected from computer ${computerId}. Remaining users: ${this.computerUsers.get(computerId)!.size}`)
      
      // Se o computador ficou vazio, podemos removê-lo
      if (this.computerUsers.get(computerId)!.size === 0) {
        this.computerUsers.delete(computerId)
      }
    }
  }

  private removeFromAllComputers(connectionId: string) {
    for (const [computerId, users] of this.computerUsers) {
      if (users.has(connectionId)) {
        users.delete(connectionId)
        
        // Notificar outros usuários
        this.broadcastToComputer({
          type: 'computer_user_left',
          playerId: connectionId,
          computerId: computerId
        }, computerId, connectionId)
        
        console.log(`Player ${connectionId} left computer ${computerId}. Remaining users: ${users.size}`)
        
        // Se o computador ficou vazio, removê-lo
        if (users.size === 0) {
          this.computerUsers.delete(computerId)
        }
        break
      }
    }
  }

  private broadcastToComputer(message: any, computerId: string, senderConnectionId: string) {
    const messageStr = JSON.stringify(message)
    
    if (this.computerUsers.has(computerId)) {
      const users = this.computerUsers.get(computerId)!
      
      // Broadcast para todos no computador exceto o sender
      for (const userId of users) {
        if (userId !== senderConnectionId) {
          const ws = this.connections.get(userId)
          if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
            try {
              ws.send(messageStr)
            } catch (error) {
              console.error('Error broadcasting computer message:', error)
              this.handleDisconnect(userId)
            }
          }
        }
      }
    }
  }

  private handleCreateRoom(webSocket: WebSocket, connectionId: string, roomData: any) {
    const roomId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Criar a sala
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set())
    }
    
    // Adicionar o criador à sala
    this.roomConnections.get(roomId)!.add(connectionId)
    
    // Enviar confirmação de criação
    webSocket.send(JSON.stringify({
      type: 'room_created',
      roomId: roomId,
      connectionId: connectionId,
      message: 'Custom room created successfully',
      roomData: roomData
    }))
    
    console.log(`Player ${connectionId} created custom room ${roomId}`)
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
      const rooms = []
      
      // Adicionar salas ativas com jogadores reais
      for (const [roomId, players] of this.roomConnections) {
        let roomName = 'Public Lobby'
        let roomType = 'PUBLIC'
        
        if (roomId === 'lobby') {
          roomName = 'Public Lobby'
          roomType = 'PUBLIC'
        } else if (roomId.startsWith('custom-')) {
          roomName = `Custom Room ${roomId.split('-')[1]}`
          roomType = 'CUSTOM'
        } else {
          roomName = `Room ${roomId}`
          roomType = 'CUSTOM'
        }
        
        rooms.push({
          id: roomId,
          name: roomName,
          roomType: roomType,
          players: players.size,
          maxPlayers: 50
        })
      }
      
      // Adicionar sala lobby padrão se não existir
      if (!this.roomConnections.has('lobby')) {
        rooms.push({
          id: 'lobby',
          name: 'Public Lobby',
          roomType: 'PUBLIC',
          players: 0,
          maxPlayers: 50
        })
      }
      
      return new Response(JSON.stringify(rooms), {
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