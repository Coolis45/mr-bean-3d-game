import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: './',
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