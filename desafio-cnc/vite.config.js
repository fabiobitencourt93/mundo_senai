import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Esta linha é a solução: obriga o Vite a usar estritamente a mesma 
    // instância do React para o seu código e para o React Three Fiber.
    dedupe: ['react', 'react-dom', 'three']
  }
})