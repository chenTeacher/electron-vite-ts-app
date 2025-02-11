/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */
import "./assets/main.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import App from "./App.vue";
import router from "./router";

import { Buffer } from "buffer";
import { MqttConnectionImpl } from "../sdk/mqtt-sdk/connection/MqttConnectionImpl";
import mitt from "mitt";

// 确保全局都能访问到 Buffer
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = Buffer;
} else if (typeof global !== "undefined") {
  global.Buffer = Buffer;
} else {
  // 如果上述全局对象都不存在，则手动定义一个全局对象
  const globalObject = Function("return this")();
  globalObject.Buffer = Buffer;
}

// 为非 Node.js 环境提供 global 别名
if (typeof global === "undefined") {
  if (typeof globalThis !== "undefined") {
    globalThis.global = globalThis;
  } else {
    const globalObject = Function("return this")();
    globalObject.global = globalObject;
  }
}

const app = createApp(App);
const emitter = mitt();
app.config.globalProperties.mqttConnect = new MqttConnectionImpl();
app.config.globalProperties.isGlobalListenerRegistered = false;
app.config.globalProperties.bleAdapterState = false;
app.config.globalProperties.selectProtocol = {};
// 全局挂载
app.config.globalProperties.$bus = emitter;

app.use(createPinia());
app.use(router);
app.use(Antd);

app.mount("#app");
