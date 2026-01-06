export default {
  build: {
    rollupOptions: {
      input: "/index.html"
    }
  },
  esbuild: {
    loader: { ".js": "jsx" },
    jsx: "automatic"
  }
};
