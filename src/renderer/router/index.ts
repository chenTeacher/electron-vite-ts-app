import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/pages/mqtt",
      name: "MQTT",
      component: () => import("../views/mqtt/index.vue"),
      meta: { title: "MQTT" },
    },
    {
      path: "/pages/bluetooth",
      name: "bluetooth",
      component: () => import("../views/bluetooth/index.vue"),
      meta: { title: "bluetooth" },
    },
    // {
    //   path: '/pages/bluetooth/bluetooth',
    //   name: 'Bluetooth',
    //   component: () => import('../pages/bluetooth/bluetooth.vue'),
    //   meta: { title: 'Bluetooth' }
    // },
    // {
    //   path: '/pages/bluetooth/bleDetail',
    //   name: 'BleDetail',
    //   component: () => import('../pages/bluetooth/bleDetail.vue')
    // },
    // {
    //   path: '/pages/bluetooth/bleMsgSend',
    //   name: 'BleMsgSend',
    //   component: () => import('../pages/bluetooth/bleMsgSend.vue')
    // },
    {
      path: "/pages/protocol/protocolReview",
      name: "ProtocolReview",
      component: () => import("../views/protocol/ProtocolReview.vue"),
      meta: { title: "选择指令" },
    },
  ],
});

export default router;
