import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// WebView2 109 (last runtime that supports Windows 7) is Chromium 109.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "chrome109",
    cssTarget: "chrome109",
  },
});