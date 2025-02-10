import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import { registerIpcHandlers } from "./ipcHook";
import { initWindow } from "./main/window";
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// const mainWindow = initWindow()
// const createWindow = () => {
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 800,
//     height: 600,
//     icon: path.join(__dirname, 'assets/logo.png'),  //  设置图标
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'),
//     },
//   });
//   // 移除菜单

//   mainWindow.removeMenu()
//   // 加载应用程序逻辑
//   if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
//     mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
//   } else {
//     mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
//   }
//   // 打开开发工具 Open the DevTools.
//   mainWindow.webContents.openDevTools();
// };

//当Electron完成时，将调用此方法
//初始化并准备创建浏览器窗口。
//某些API只能在此事件发生后使用。
app.on("ready", () => {
  initWindow()
});

//关闭所有窗口后退出，macOS除外。在那里，这很常见
//让应用程序及其菜单栏保持活动状态，直到用户退出
//显式使用Cmd+Q。
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  //在OS X上，当出现以下情况时，通常会在应用程序中重新创建一个窗口
  //单击dock图标后，没有其他打开的窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    initWindow()
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
registerIpcHandlers();
