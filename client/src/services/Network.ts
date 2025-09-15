import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'
import { setSessionId } from '../stores/UserStore'
import { setLobbyJoined } from '../stores/RoomStore'
import { pushChatMessage } from '../stores/ChatStore'

export default class Network {
  private ws?: WebSocket
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000

  mySessionId!: string
  connected = false

  constructor() {
    this.connect()
    
    // Eventos do Phaser
    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
  }

  private connect() {
    const protocol = window.location.protocol.replace('http', 'ws')
    let endpoint: string
    
    if (process.env.NODE_ENV === 'production') {
      endpoint = import.meta.env.VITE_SERVER_URL || 'wss://skyoffice.gabrielschmitt7.workers.dev'
    } else {
      endpoint = `${protocol}//${window.location.hostname}:3000`
    }

    // Adicionar /ws se não estiver presente
    if (!endpoint.endsWith('/ws')) {
      endpoint += '/ws'
    }

    console.log('🔗 Connecting to:', endpoint)

    try {
      this.ws = new WebSocket(endpoint)
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.attemptReconnect()
      return
    }

    this.ws.onopen = () => {
      console.log('✅ Connected to SkyOffice server!')
      this.connected = true
      this.reconnectAttempts = 0
      
      // Simular conexão bem-sucedida
      this.mySessionId = Math.random().toString(36).substr(2, 9)
      store.dispatch(setSessionId(this.mySessionId))
      store.dispatch(setLobbyJoined(true))
      
      // Enviar mensagem inicial
      this.send({
        type: 'join_room',
        roomId: 'lobby'
      })
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('❌ Disconnected from server')
      this.connected = false
      store.dispatch(setLobbyJoined(false))
      this.attemptReconnect()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.connected = false
      store.dispatch(setLobbyJoined(false))
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      setTimeout(() => {
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('❌ Max reconnection attempts reached')
    }
  }

  private handleMessage(data: any) {
    console.log('📨 Received:', data)

    switch (data.type) {
      case 'connected':
        console.log('✅ Server confirmed connection:', data.message)
        break
        
      case 'room_joined':
        console.log('🏠 Joined room:', data.roomId)
        break
        
      case 'player_moved':
        // Emitir evento para o Phaser
        phaserEvents.emit(Event.PLAYER_UPDATED, {
          sessionId: data.playerId,
          x: data.position?.x,
          y: data.position?.y
        })
        break
        
      case 'chat_message':
        // Adicionar mensagem ao chat
        const chatMessage = {
          author: data.playerId || 'Unknown',
          createdAt: data.timestamp || Date.now(),
          content: data.message || ''
        } as any
        store.dispatch(pushChatMessage(chatMessage))
        break
        
      case 'echo':
        console.log('🔊 Echo from server:', data.data)
        break
        
      default:
        console.log('❓ Unknown message type:', data.type)
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send:', data)
    }
  }

  // Métodos para compatibilidade com o código existente
  async joinOrCreatePublic(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        this.send({
          type: 'join_room',
          roomId: 'public-lobby'
        })
        resolve({ sessionId: this.mySessionId })
      } else {
        reject(new Error('Not connected to server'))
      }
    })
  }

  async joinCustomById(roomId: string, password?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        this.send({
          type: 'join_room',
          roomId: roomId,
          password: password
        })
        resolve({ sessionId: this.mySessionId })
      } else {
        reject(new Error('Not connected to server'))
      }
    })
  }

  async createCustom(roomData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        this.send({
          type: 'create_room',
          roomData: roomData
        })
        resolve({ sessionId: this.mySessionId })
      } else {
        reject(new Error('Not connected to server'))
      }
    })
  }

  // Métodos para atualizações do jogador
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    this.send({
      type: 'player_move',
      position: { x: currentX, y: currentY },
      animation: currentAnim
    })
  }

  updatePlayerName(currentName: string) {
    this.send({
      type: 'player_name',
      name: currentName
    })
  }

  // Método para chat
  sendChatMessage(content: string) {
    this.send({
      type: 'chat_message',
      message: content
    })
  }

  // Métodos vazios para compatibilidade (Computer/Whiteboard)
  connectToComputer(computerId: string) {
    console.log('💻 Computer connection requested:', computerId)
    // TODO: Implementar lógica de computador
  }

  connectToWhiteboard(whiteboardId: string) {
    console.log('📝 Whiteboard connection requested:', whiteboardId)
    // TODO: Implementar lógica de whiteboard
  }

  // Métodos para compatibilidade com WebRTC
  readyToConnect() {
    console.log('🎥 Ready to connect video')
    // TODO: Implementar lógica de WebRTC
  }

  videoConnected() {
    console.log('🎥 Video connected')
    // TODO: Implementar lógica de WebRTC
  }

  // Métodos para eventos (compatibilidade)
  onPlayerJoined(callback: any, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  onPlayerLeft(callback: any, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  onMyPlayerReady(callback: any, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_READY, callback, context)
  }

  onMyPlayerVideoConnected(callback: any, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, callback, context)
  }

  onPlayerUpdated(callback: any, context?: any) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  onItemUserAdded(callback: any, context?: any) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  onItemUserRemoved(callback: any, context?: any) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  onChatMessageAdded(callback: any, context?: any) {
    phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context)
  }

  onStopScreenShare(computerId: string) {
    console.log('🖥️ Stop screen share:', computerId)
    // TODO: Implementar lógica de screen share
  }

  disconnectFromComputer(computerId: string) {
    console.log('💻 Disconnect from computer:', computerId)
    // TODO: Implementar lógica de computador
  }

  disconnectFromWhiteboard(whiteboardId: string) {
    console.log('📝 Disconnect from whiteboard:', whiteboardId)
    // TODO: Implementar lógica de whiteboard
  }

  // Propriedade webRTC para compatibilidade
  webRTC?: any

  // Método para limpeza
  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}