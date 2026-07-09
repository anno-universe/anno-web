import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/app"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      // Mirrors the Caddy `/original-images/*` rule so pre-signed image URLs
      // resolve in dev too: strip the prefix, rewrite to the bucket path, and
      // proxy to RustFS. `changeOrigin` sets the Host to localhost:9000 to
      // match the host boto3 signs in dev.
      "/original-images": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/original-images/, "/anno-images"),
      },
    },
  },
});
