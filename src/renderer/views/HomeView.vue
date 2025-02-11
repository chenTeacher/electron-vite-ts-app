<template>
  <div>
    <a-row :gutter="24">
      <a-col :span="8" v-for="(menu, index) in menus" :key="index">
        <a-card
          hoverable
          style="width: 200px"
          @click="navigateTo(menu.navigatePath)"
        >
          <template #cover>
            <img width="200" height="200" alt="example" :src="menu.icon" />
          </template>
          <a-card-meta :title="menu.title">
            <template #description>{{ menu.desc }}</template>
          </a-card-meta>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useRouter } from "vue-router";

import mqttIcon from "./../assets/mqtt.png"; // 添加这行导入
import bluetooth from "./../assets/Bluetooth.png"; // 添加这行导入
interface MenuConfig {
  title: string;
  icon: string;
  navigatePath: string;
  desc: string;
}

const router = useRouter();
// 定义功能菜单
const menus = reactive<MenuConfig[]>([
  {
    title: "MQTT测试",
    icon: mqttIcon,
    navigatePath: "/pages/mqtt",
    desc: "连接、收发消息、断线重连等",
  },
  {
    title: "蓝牙测试",
    icon: bluetooth,
    navigatePath: "/pages/bluetooth",
    desc: "连接、收发消息、断线重连等",
  },
]);
/**
 * 跳转到对应的页面
 */
const navigateTo = (path: string) => {
  router.push({ path });
};
</script>

<style scoped></style>
