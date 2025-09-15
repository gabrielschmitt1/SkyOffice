// Worker principal para SkyOffice

interface Env {
  ROOMS: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders })
    }

    // Endpoint para matchmaking
    if (url.pathname === '/matchmake/joinOrCreate/skyoffice') {
      const roomId = Math.random().toString(36).substr(2, 9)
      const sessionId = Math.random().toString(36).substr(2, 9)
      
      return new Response(JSON.stringify({ 
        room: {
          clients: 1,
          createdAt: new Date().toISOString(),
          maxClients: null,
          metadata: {
            name: 'Public Lobby',
            description: 'For making friends and familiarizing yourself with the controls',
            hasPassword: false
          },
          name: 'skyoffice',
          processId: Math.random().toString(36).substr(2, 9),
          roomId: roomId
        },
        sessionId: sessionId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Endpoint para listar salas
    if (url.pathname === '/api/rooms') {
      return new Response(JSON.stringify([
        {
          id: 'skyoffice',
          name: 'Public Lobby',
          roomType: 'PUBLIC',
          players: 1,
          maxPlayers: 50
        }
      ]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Redirecionar outras requisições para Durable Object
    const durableObjectId = env.ROOMS.idFromName('game-server')
    const durableObject = env.ROOMS.get(durableObjectId)
    return durableObject.fetch(request)
  }
}

export { RoomDurableObject } from './worker/index'
