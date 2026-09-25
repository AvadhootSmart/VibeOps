import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Generated Wails bindings live outside src/, so imports for them were
      // counting ../ four deep from nested components.
      "@wails": path.resolve(__dirname, "./wailsjs"),
    },
  },
})