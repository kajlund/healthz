import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../../', import.meta.url));
  const env = loadEnv(mode, envDir, '');
  const apiPort = env.PORT || '3000';

  return {
    envDir,
    server: {
      proxy: {
        '/api': `http://localhost:${apiPort}`,
        '^/health(?:$|\\?)': `http://localhost:${apiPort}`,
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
