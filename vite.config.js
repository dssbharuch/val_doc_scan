
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/val_doc_scan/",

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Document Scanner",
        short_name: "Doc Scanner",
        description: "Personal document scanner",
        theme_color: "#0f172a",
        background_color: "#f1f5f9",
        display: "standalone",
        start_url: "/val_doc_scan/",
        scope: "/val_doc_scan/"
      }
    })
  ]
});
