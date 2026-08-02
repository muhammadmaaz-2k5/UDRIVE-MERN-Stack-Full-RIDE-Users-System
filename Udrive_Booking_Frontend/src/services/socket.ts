import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';
let socket: Socket | null = null;

export const initSocket = (token: string): Socket => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    extraHeaders: {
      access_token: token,
    },
  });

  socket.on('connect', () => {
    console.log('Connected to socket server');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
