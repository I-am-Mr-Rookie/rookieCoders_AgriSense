import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === "build" ? "/payments/" : "/"),
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:4317" }
  }
}));
