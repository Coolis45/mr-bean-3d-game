import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: '/mr-bean-3d-game/',
    server: {
        host: true,
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        assetsDir: 'assets',
        minify: 'terser',
        sourcemap: false
    }
});