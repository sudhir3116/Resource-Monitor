import { io } from 'socket.io-client'

let socket = null

export const getSocket = () => {
    if (!socket) {
        socket = io('http://localhost:5001', {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            autoConnect: false
        })
    }
    return socket
}

export const connectSocket = (token) => {
    const s = getSocket()
    if (!s.connected) {
        s.connect()
        s.emit('authenticate', token)
    }
    return s
}

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}

export default getSocket
