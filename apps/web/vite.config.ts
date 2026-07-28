import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const rootPackage = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  base: '/Global-travel-plans/',
  define: {
    __APP_VERSION__: JSON.stringify(rootPackage.version),
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'development'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
  },
});
