import { io } from "socket.io-client";

const getSocketURL = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  const host = window.location.hostname;
  return `http://${host}:5000`;
};

const socket = io(getSocketURL());

export default socket;