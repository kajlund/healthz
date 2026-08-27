import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "3000";

  return {
    server: {
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/health": `http://localhost:${apiPort}`,
      },
    },
    build: {
      outDir: "dist/public",
      emptyOutDir: false,
    },
  };
});
