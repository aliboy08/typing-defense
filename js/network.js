export class Network {
  constructor() {
    this._socket   = null;
    this._handlers = {
      onRoomJoined:       null,
      onRoomError:        null,
      onPartnerConnected: null,
      onPartnerLeft:      null,
      onGameState:        null,
      onWordDestroyed:    null,
      onBaseHit:          null,
      onGameOver:         null,
    };
  }

  connect() {
    if (this._socket) return;
    this._socket = io(); // io() is injected by socket.io CDN script
    const h = this._handlers;
    this._socket.on('room_joined',       d => h.onRoomJoined?.(d));
    this._socket.on('room_error',        d => h.onRoomError?.(d));
    this._socket.on('partner_connected', () => h.onPartnerConnected?.());
    this._socket.on('partner_left',      () => h.onPartnerLeft?.());
    this._socket.on('game_state',        d => h.onGameState?.(d));
    this._socket.on('word_destroyed',    d => h.onWordDestroyed?.(d));
    this._socket.on('base_hit',          d => h.onBaseHit?.(d));
    this._socket.on('game_over',         d => h.onGameOver?.(d));
  }

  on(event, fn)  { this._handlers[event] = fn; }
  createRoom()   { this._socket?.emit('create_room'); }
  joinRoom(code) { this._socket?.emit('join_room', { roomCode: code }); }
  sendInput(text){ this._socket?.emit('player_input', { text }); }
}
