import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import { registerIpcHandlers } from "./ipcHook";
import { initWindow } from "./main/window";
import { electronRegisterBlueTooth } from "./main/bluetoothDevices";
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
app.commandLine.appendSwitch(
  "enable-experimental-web-platform-features",
  "true"
);
app.commandLine.appendSwitch("enable-web-bluetooth", "true");
function initElectron() {
  const mainWindow = initWindow();
  electronRegisterBlueTooth(mainWindow);
}
//当Electron完成时，将调用此方法
//初始化并准备创建浏览器窗口。
//某些API只能在此事件发生后使用。
app.on("ready", () => {
  initElectron();
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
    initElectron();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
registerIpcHandlers();
