import { resolve } from 'node:path';

export default {
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        letter: resolve(__dirname, 'letter/index.html'),
      },
    },
  },
};
