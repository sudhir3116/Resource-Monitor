import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                    icons: ['lucide-react'],
                }
            }
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5001',
                changeOrigin: true,
                secure: false,
                configure: (proxy) => {
                    proxy.on('error', (err, req, res) => {
                        console.log('[Proxy] Backend not reachable yet')
                        res.writeHead(503, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({
                            message: 'Backend server is not running'
                        }))
                    })
                }
            },
            '/socket.io': {
                target: 'ws://localhost:5001',
                ws: true,
            }
        }
    }
})
