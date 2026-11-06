// @ts-check
import { defineConfig, loadEnv } from "vite";
import { tokenConfig, tokenMiddleware } from "./server/token.mjs";

export default defineConfig(({ mode }) => {
  // Load .env without the VITE_ prefix filter. These values stay on the server:
  // nothing here is exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // LiveKit (the SDK's WebRTC transport) is a ~500 kB chunk the SDK loads on demand.
    build: { chunkSizeWarningLimit: 600 },
    plugins: [
      {
        name: "decart-token-endpoint",
        configureServer(server) {
          server.middlewares.use(tokenMiddleware(tokenConfig(env)));
        },
        configurePreviewServer(server) {
          server.middlewares.use(tokenMiddleware(tokenConfig(env)));
        },
      },
    ],
  };
});
