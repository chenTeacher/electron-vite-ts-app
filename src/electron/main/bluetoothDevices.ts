import { BrowserWindow, ipcMain } from "electron";

// 注册electron蓝牙监听事件
let bluetoothPinCallback: (response: Electron.Response) => void;
let selectBluetoothCallback: (response: string) => void;
export function electronRegisterBlueTooth(mainWindow: BrowserWindow) {
  mainWindow.webContents.on(
    "select-bluetooth-device",
    (
      event: Event,
      deviceList: Electron.BluetoothDevice[],
      callback: (deviceId: string) => void
    ) => {
      event.preventDefault();
      selectBluetoothCallback = callback;
      const result = deviceList.find((device) => {
        return device.deviceName === "test";
      });
      if (result) {
        callback(result.deviceId);
      } else {
        // The device wasn't found so we need to either wait longer (eg until the
        // device is turned on) or until the user cancels the request
      }
    }
  );

  ipcMain.on("cancel-bluetooth-request", (event) => {
    console.log("cancel-bluetooth-request");
    selectBluetoothCallback("");
  });

  // Listen for a message from the renderer to get the response for the Bluetooth pairing.
  ipcMain.on("bluetooth-pairing-response", (event, response) => {
    bluetoothPinCallback(response);
  });

  mainWindow.webContents.session.setBluetoothPairingHandler(
    (details, callback) => {
      bluetoothPinCallback = callback;
      // Send a message to the renderer to prompt the user to confirm the pairing.
      mainWindow.webContents.send("bluetooth-pairing-request", details);
    }
  );
}
