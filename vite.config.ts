import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// 정적 호스트가 없는 주소에 404 상태로 앱 셸을 돌려주도록 index.html 사본을 만든다.
function notFoundPage(): Plugin {
  return {
    name: 'spa-not-found-page',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexHtml = bundle['index.html'];
      if (indexHtml?.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: '404.html', source: indexHtml.source });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), notFoundPage()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
