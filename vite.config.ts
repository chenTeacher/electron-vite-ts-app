import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import vueDevTools from "vite-plugin-vue-devtools";
import Inspector from 'vite-plugin-vue-inspector'
import { fileURLToPath, URL } from "node:url";

export default defineConfig(() => {
  const baseConfig = {
    build: {
      report: true, // 打印详细的构建报告
    },
    plugins: [vue(), vueJsx(), vueDevTools(), Inspector()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src/renderer", import.meta.url)),
      },
    },
  };

  if (process.env.NODE_ENV === "development") {
    // 开发环境下的配置
  } else if (process.env.NODE_ENV === "production") {
    // 生产环境下的配置
  } else if (process.env.NODE_ENV === "test") {
    // 测试环境下的配置
  }
  return baseConfig;
});
