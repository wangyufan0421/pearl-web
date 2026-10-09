import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/prlstats": {
        target: "https://prlstats.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/prlstats/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
