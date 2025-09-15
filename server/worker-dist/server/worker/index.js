import { Server } from 'colyseus';
import { RoomType } from '../../types/Rooms';
import { SkyOffice } from '../rooms/SkyOffice';
// Durable Object para manter estado das salas
export class RoomDurableObject {
    state;
    env;
    server;
    constructor(state, env) {
        this.state = state;
        this.env = env;
        // Inicializar servidor Colyseus
        this.server = new Server({
            // Configuração para Cloudflare Workers
            presence: undefined, // Usar estado interno do Durable Object
        });
        // Registrar handlers das salas
        this.server.define(RoomType.PUBLIC, SkyOffice, {
            name: 'Public Lobby',
            description: 'For making friends and familiarizing yourself with the controls',
            password: null,
            autoDispose: false,
        });
        this.server.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing();
    }
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/ws') {
            // Handle WebSocket upgrade
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
        // Aceitar a conexão WebSocket
        server.accept();
        // Integrar com Colyseus
        this.handleColyseusConnection(server);
        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
    handleColyseusConnection(webSocket) {
        // Implementação simplificada para Cloudflare Workers
        // TODO: Integrar adequadamente com Colyseus quando suportado
        webSocket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                // Processar mensagens básicas
                console.log('Received message:', data);
                // Echo para teste
                webSocket.send(JSON.stringify({ type: 'echo', data }));
            }
            catch (error) {
                console.error('Error processing message:', error);
            }
        });
        webSocket.addEventListener('close', () => {
            console.log('WebSocket connection closed');
        });
        webSocket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
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
            return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // API routes para listar salas
        if (url.pathname === '/matchmake/joinOrCreate/lobby') {
            return new Response(JSON.stringify({
                message: 'Lobby endpoint',
                roomId: 'lobby-' + Math.random().toString(36).substr(2, 9)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // Redirecionar conexões WebSocket para Durable Object
        if (url.pathname === '/ws' || url.pathname.startsWith('/matchmake/')) {
            const durableObjectId = env.ROOMS.idFromName('game-server');
            const durableObject = env.ROOMS.get(durableObjectId);
            return durableObject.fetch(request);
        }
        return new Response('Not Found', {
            status: 404,
            headers: corsHeaders
        });
    }
};
