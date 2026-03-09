import React, { useEffect, useState } from 'react';
import { getSocket } from '../../utils/socket';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export default function ConnectionStatus() {
    const [status, setStatus] = useState('offline');

    useEffect(() => {
        const socket = getSocket();

        if (!socket) {
            setStatus('offline');
            return;
        }

        const onConnect = () => setStatus('live');
        const onDisconnect = () => setStatus('offline');

        // Setup initial state
        if (socket.connected) {
            setStatus('live');
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // Native re-connection events handle 'reconnecting' smoothly without explicit reconnect_attempt listener needed typically if polling auto-fails quickly,
        // but we'll monitor closely.
        let interval = setInterval(() => {
            if (!socket.connected && status === 'live') {
                setStatus('reconnecting');
            }
        }, 3000);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            clearInterval(interval);
        };
    }, [status]);

    if (status === 'live') return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border"
            style={{
                backgroundColor: status === 'offline' ? 'var(--color-danger)' : 'var(--color-warning)',
                color: 'white',
                borderColor: 'transparent'
            }}
        >
            {status === 'offline' ? (
                <>
                    <WifiOff size={16} />
                    <span className="text-sm font-medium">You are offline. Data may not be current. Reconnecting...</span>
                </>
            ) : (
                <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">Reconnecting...</span>
                </>
            )}
        </div>
    );
}
