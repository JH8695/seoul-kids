import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 등 하위 경로 배포에서도 동작
});
