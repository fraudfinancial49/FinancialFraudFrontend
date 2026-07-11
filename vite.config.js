import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// https://vitejs.dev/config/
var BACKEND_URL = "https://financialfraudbackend.onrender.com";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            "/api": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/auth": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/vault": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/honeypot": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/admin": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/health": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/ready": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
            "/model-info": {
                target: BACKEND_URL,
                changeOrigin: true,
                secure: true,
            },
        },
    },
    build: {
        outDir: "dist",
        sourcemap: false,
    },
});
