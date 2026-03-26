// Socket.io client wrapper
const Network = (() => {
  let socket = null;

  const handlers = {
    onRoomJoined:       null,
    onRoomError:        null,
    onPartnerConnected: null,
    onPartnerLeft:      null,
    onGameState:        null,
    onWordDestroyed:    null,
    onBaseHit:          null,
    onGameOver:         null,
  };

  function connect() {
    if (socket) return;
    socket = io();

    socket.on('room_joined',       (d) => handlers.onRoomJoined?.(d));
    socket.on('room_error',        (d) => handlers.onRoomError?.(d));
    socket.on('partner_connected', ()  => handlers.onPartnerConnected?.());
    socket.on('partner_left',      ()  => handlers.onPartnerLeft?.());
    socket.on('game_state',        (d) => handlers.onGameState?.(d));
    socket.on('word_destroyed',    (d) => handlers.onWordDestroyed?.(d));
    socket.on('base_hit',          (d) => handlers.onBaseHit?.(d));
    socket.on('game_over',         (d) => handlers.onGameOver?.(d));
  }

  function createRoom() { socket?.emit('create_room'); }
  function joinRoom(code) { socket?.emit('join_room', { roomCode: code }); }
  function sendInput(text) { socket?.emit('player_input', { text }); }

  return {
    connect, createRoom, joinRoom, sendInput,
    on(event, fn) { handlers[event] = fn; },
  };
})();
