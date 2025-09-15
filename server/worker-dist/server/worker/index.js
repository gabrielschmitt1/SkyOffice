// Worker compatível com Colyseus para SkyOffice
export class RoomDurableObject {
    state;
    env;
    rooms;
    connections;
    roomConnections;
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.rooms = new Map();
        this.connections = new Map();
        this.roomConnections = new Map();
    }
    async fetch(request) {
        const url = new URL(request.url);
        // Colyseus WebSocket upgrade
        if (url.pathname === '/' || url.pathname === '/ws') {
            return this.handleWebSocket(request);
        }
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
    }
    async handleWebSocket(request) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response('Expected Upgrade: websocket', { status: 426 });
        }
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        server.accept();
        const connectionId = Math.random().toString(36).substr(2, 9);
        this.connections.set(connectionId, server);
        this.handleGameConnection(server, connectionId);
        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
    handleGameConnection(webSocket, connectionId) {
        // Enviar confirmação de conexão
        webSocket.send(JSON.stringify({
            type: 'connected',
            connectionId,
            message: 'Connected to SkyOffice server'
        }));
        webSocket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                // Processar diferentes tipos de mensagens
                switch (data.type) {
                    case 'join_room':
                        this.handleJoinRoom(webSocket, connectionId, data.roomId || 'lobby');
                        break;
                    case 'player_move':
                        // Broadcast movimento para outros players na mesma sala
                        this.broadcastToRoom({
                            type: 'player_moved',
                            playerId: connectionId,
                            position: data.position
                        }, connectionId);
                        break;
                    case 'chat_message':
                        // Broadcast mensagem de chat para a sala
                        this.broadcastToRoom({
                            type: 'chat_message',
                            playerId: connectionId,
                            message: data.message,
                            timestamp: Date.now()
                        }, connectionId);
                        break;
                    default:
                        // Echo para mensagens não reconhecidas
                        webSocket.send(JSON.stringify({ type: 'echo', data }));
                }
            }
            catch (error) {
                console.error('Error processing message:', error);
                webSocket.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to process message'
                }));
            }
        });
        webSocket.addEventListener('close', () => {
            console.log('WebSocket connection closed:', connectionId);
            this.handleDisconnect(connectionId);
        });
        webSocket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
            this.handleDisconnect(connectionId);
        });
    }
    handleJoinRoom(webSocket, connectionId, roomId) {
        // Remover de outras salas primeiro
        this.removeFromAllRooms(connectionId);
        // Adicionar à nova sala
        if (!this.roomConnections.has(roomId)) {
            this.roomConnections.set(roomId, new Set());
        }
        this.roomConnections.get(roomId).add(connectionId);
        // Enviar confirmação
        webSocket.send(JSON.stringify({
            type: 'room_joined',
            roomId: roomId,
            message: 'Successfully joined room',
            playersInRoom: this.roomConnections.get(roomId).size
        }));
        // Notificar outros players na sala
        this.broadcastToRoom({
            type: 'player_joined',
            playerId: connectionId,
            message: 'Player joined the room'
        }, connectionId);
        console.log(`Player ${connectionId} joined room ${roomId}. Total players: ${this.roomConnections.get(roomId).size}`);
    }
    handleDisconnect(connectionId) {
        this.removeFromAllRooms(connectionId);
        this.connections.delete(connectionId);
    }
    removeFromAllRooms(connectionId) {
        for (const [roomId, players] of this.roomConnections) {
            if (players.has(connectionId)) {
                players.delete(connectionId);
                // Notificar outros players que alguém saiu
                this.broadcastToRoom({
                    type: 'player_left',
                    playerId: connectionId,
                    message: 'Player left the room'
                }, connectionId);
                console.log(`Player ${connectionId} left room ${roomId}. Remaining players: ${players.size}`);
                // Se a sala ficou vazia, podemos removê-la
                if (players.size === 0) {
                    this.roomConnections.delete(roomId);
                }
                break;
            }
        }
    }
    broadcastToRoom(message, senderConnectionId) {
        const messageStr = JSON.stringify(message);
        // Encontrar a sala do sender
        for (const [roomId, players] of this.roomConnections) {
            if (players.has(senderConnectionId)) {
                // Broadcast para todos na sala exceto o sender
                for (const playerId of players) {
                    if (playerId !== senderConnectionId) {
                        const ws = this.connections.get(playerId);
                        if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
                            try {
                                ws.send(messageStr);
                            }
                            catch (error) {
                                console.error('Error broadcasting message:', error);
                                this.handleDisconnect(playerId);
                            }
                        }
                    }
                }
                break;
            }
        }
    }
    broadcast(message, sender) {
        const messageStr = JSON.stringify(message);
        this.connections.forEach((ws, connectionId) => {
            if (ws !== sender && ws.readyState === WebSocket.READY_STATE_OPEN) {
                try {
                    ws.send(messageStr);
                }
                catch (error) {
                    console.error('Error broadcasting message:', error);
                    this.handleDisconnect(connectionId);
                }
            }
        });
    }
}
// Worker principal
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        // Health check
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                timestamp: Date.now(),
                message: 'SkyOffice Worker is healthy'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // API endpoint para listar salas disponíveis
        if (url.pathname === '/api/rooms') {
            const rooms = [];
            // Adicionar salas ativas com jogadores reais
            for (const [roomId, players] of this.roomConnections) {
                rooms.push({
                    id: roomId,
                    name: roomId === 'lobby' ? 'Public Lobby' : `Room ${roomId}`,
                    players: players.size,
                    maxPlayers: 50
                });
            }
            // Adicionar sala lobby padrão se não existir
            if (!this.roomConnections.has('lobby')) {
                rooms.push({
                    id: 'lobby',
                    name: 'Public Lobby',
                    players: 0,
                    maxPlayers: 50
                });
            }
            return new Response(JSON.stringify(rooms), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // Endpoint para criar/juntar-se a uma sala
        if (url.pathname === '/matchmake/joinOrCreate/lobby') {
            return new Response(JSON.stringify({
                message: 'Lobby endpoint',
                roomId: 'lobby-' + Math.random().toString(36).substr(2, 9),
                sessionId: Math.random().toString(36).substr(2, 16)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // Redirecionar conexões WebSocket para Durable Object (Colyseus compatibility)
        if (url.pathname === '/' || url.pathname === '/ws' || url.pathname.startsWith('/matchmake/')) {
            const durableObjectId = env.ROOMS.idFromName('game-server');
            const durableObject = env.ROOMS.get(durableObjectId);
            return durableObject.fetch(request);
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
            });
        }
        return new Response('Not Found', {
            status: 404,
            headers: corsHeaders
        });
    }
};
