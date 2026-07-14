import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: "127.0.0.1",
        proxy: {
            // Flask API — same-origin in dev so the session cookie just works
            "/api": {
                target: "http://127.0.0.1:5000",
                changeOrigin: true,
            },
        },
    },
});
