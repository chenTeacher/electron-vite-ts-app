<template>
  <div class="bluetooth-container">
    <button @click="requestDevice" class="scan-btn">扫描蓝牙设备</button>
    <div v-if="devices.length" class="device-list">
      <div v-for="device in devices" :key="device.id" class="device-item">
        <div>设备名称: {{ device.name || "未知设备" }}</div>
        <div>设备ID: {{ device.id }}</div>
        <button @click="connectDevice(device)" :disabled="device.connected">
          {{ device.connected ? "已连接" : "连接" }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  device?: any;
}

const devices = ref<BluetoothDevice[]>([]);
const error = ref<string>("");

const requestDevice = async () => {
  try {
    error.value = "";
    console.log("点击了");
    if (!navigator.bluetooth) {
      error.value = "您的浏览器不支持 Web Bluetooth API";
      return;
    }
    console.log("device 开始");
    const isAvailability = await navigator.bluetooth.getAvailability();
    console.log(isAvailability);
    const device = await navigator.bluetooth.getDevices();
    console.log("device", device);
    // 检查设备是否已经在列表中
    const existingDeviceIndex = devices.value.findIndex(
      (d) => d.id === device.id
    );
    const newDevice: BluetoothDevice = {
      id: device.id,
      name: device.name || "未知设备",
      connected: false,
      device: device,
    };

    if (existingDeviceIndex >= 0) {
      devices.value[existingDeviceIndex] = newDevice;
    } else {
      devices.value.push(newDevice);
    }

    // 监听设备断开连接事件
    device.addEventListener("gattserverdisconnected", () => {
      const deviceIndex = devices.value.findIndex((d) => d.id === device.id);
      if (deviceIndex >= 0) {
        devices.value[deviceIndex].connected = false;
      }
    });
  } catch (err: any) {
    if (err.name === "NotFoundError") {
      error.value = "未找到蓝牙设备";
    } else if (err.name === "SecurityError") {
      error.value = "蓝牙权限被拒绝";
    } else {
      error.value = `扫描蓝牙设备失败: ${err.message}`;
    }
    console.error("蓝牙扫描错误:", err);
  }
};

const connectDevice = async (device: BluetoothDevice) => {
  try {
    error.value = "";
    const server = await device.device.gatt.connect();

    // 更新设备连接状态
    const deviceIndex = devices.value.findIndex((d) => d.id === device.id);
    if (deviceIndex >= 0) {
      devices.value[deviceIndex].connected = true;
    }

    console.log("连接成功:", server);
  } catch (err: any) {
    error.value = `连接设备失败: ${err.message}`;
    console.error("连接错误:", err);
  }
};
</script>

<style lang="less" scoped>
.bluetooth-container {
  padding: 20px;

  .scan-btn {
    margin-bottom: 20px;
    padding: 10px 20px;
  }

  .device-list {
    .device-item {
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  }

  .error-message {
    color: red;
    margin-top: 10px;
  }
}
</style>
