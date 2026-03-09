const jwt = require('jsonwebtoken');

const connectedUsers = new Map();

module.exports = function socketManager(io) {
    // Define namespaces
    const alertsNs = io.of('/alerts');
    const usageNs = io.of('/usage');
    const dashboardNs = io.of('/dashboard');
    const notifyNs = io.of('/notify');

    io.on('connection', (socket) => {
        console.log(`[Socket] New connection: ${socket.id}`);

        socket.on('authenticate', (token) => {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.data.userId = decoded.id;
                socket.data.role = decoded.role;
                connectedUsers.set(decoded.id.toString(), socket.id);
                console.log(`[Socket] Authenticated user: ${decoded.id} with role: ${decoded.role}`);

                // Also join a room for their role
                socket.join(`role:${decoded.role}`);
            } catch (err) {
                console.error('[Socket] Authentication failed:', err.message);
                socket.disconnect();
            }
        });

        socket.on('join_block', (blockId) => {
            if (socket.data.userId) {
                socket.join(`block:${blockId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
            if (socket.data.userId) {
                connectedUsers.delete(socket.data.userId.toString());
            }
        });
    });

    return io;
};

// Export helper functions correctly
module.exports.emitToRole = (io, role, event, data) => {
    io.to(`role:${role}`).emit(event, data);
};

module.exports.emitToBlock = (io, blockId, event, data) => {
    io.to(`block:${blockId}`).emit(event, data);
};

module.exports.emitToUser = (io, userId, event, data) => {
    const socketId = connectedUsers.get(userId.toString());
    if (socketId) {
        io.to(socketId).emit(event, data);
    }
};

module.exports.emitToAll = (io, event, data) => {
    io.emit(event, data);
};
