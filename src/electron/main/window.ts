// 窗口管理
import { BrowserWindow, globalShortcut } from "electron";
import path from "node:path";

const WINDOW_WIDTH = 800;
const WINDOW_HEIGHT = 600;
const WINDOW_ICON = path.join(__dirname, "assets/logo.png");

//  创建窗口
export const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    icon: WINDOW_ICON, //  设置图标
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  // 加载应用程序逻辑
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
  return mainWindow
};


// 对窗口的菜单做出调整
export const setWindowMenu = (mainWindow: BrowserWindow) => {
  mainWindow.removeMenu();
};

// 调试开发工具逻辑
export const openDevTools = (mainWindow: BrowserWindow) => {
  // 注册快捷键
  registerShortcut(mainWindow)
  // 如果是开发环境，则默认打开发工具
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
  // 如果是生产环境，则不打开开发工具
  else {
    mainWindow.webContents.closeDevTools();
  }
};

export const initWindow = () => {
  const mainWindow = createWindow()
  setWindowMenu(mainWindow)
  openDevTools(mainWindow)
};


// 注册快捷键
export const registerShortcut = (mainWindow: BrowserWindow) => {
  // 在注册前先检查快捷键是否已被注册
  if (globalShortcut.isRegistered('ALT+F12')) {
    console.log('F12快捷键已被注册，尝试注销后重新注册');
    globalShortcut.unregister('F12');
  }

  try {
    const ret = globalShortcut.register("ALT+F12", () => {
      mainWindow.webContents.openDevTools();
    });
    
    if (!ret) {
      console.log('F12快捷键注册失败，可能被其他程序占用');
    } else {
      console.log('F12快捷键注册成功');
    }
  } catch (error) {
    console.error('注册快捷键时发生错误:', error);
  }

   // 监听窗口关闭事件，注销快捷键
   mainWindow.on('closed', () => {
    globalShortcut.unregister('F12');
  });
}