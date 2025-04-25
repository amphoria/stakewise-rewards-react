import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv';
import process from 'process';

dotenv.config();

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      process: 'process/browser'
    }
  },

  define: {
    // We stringify here so the replacement is a literal object
    'process.env': JSON.stringify(process.env)
  },  
  
  plugins: [react()],
})
