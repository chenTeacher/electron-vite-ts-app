<template>
  <div class="content">
    <div>
      <p>连接设置</p>
      <a-form
        :model="connectInfo"
        name="basic"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 16 }"
        autocomplete="off"
        @finish="onFinish"
        @finishFailed="onFinishFailed"
      >
        <a-form-item
          label="客户端ID"
          name="clientId"
          :rules="[{ required: true, message: 'Please input your 客户端ID!' }]"
        >
          <a-input v-model:value="connectInfo.clientId" />
        </a-form-item>

        <a-form-item
          label="地址(wss)"
          name="host"
          :rules="[{ required: true, message: 'Please input your 地址(wss)!' }]"
        >
          <a-input v-model:value="connectInfo.host" />
        </a-form-item>
        <a-form-item
          label="端口"
          name="port"
          :rules="[{ required: true, message: 'Please input your 端口!' }]"
        >
          <a-input v-model:value="connectInfo.port" />
        </a-form-item>
        <a-form-item
          label="PATH"
          name="path"
          :rules="[{ required: true, message: 'Please input your PATH!' }]"
        >
          <a-input v-model:value="connectInfo.path" />
        </a-form-item>
        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
          <a-button type="primary" html-type="submit">
            {{ isConnect ? "断开连接" : "创建连接" }}
          </a-button>
        </a-form-item>
      </a-form>
      <div v-if="isConnect">
        <p>订阅主题</p>
        <a-form
          :model="connectInfo"
          name="basic"
          :label-col="{ span: 4 }"
          :wrapper-col="{ span: 16 }"
          autocomplete="off"
          @finish="() => (isSub ? unsubscribe() : subscribe())"
        >
          <a-form-item
            label="订阅主题"
            name="subTopic"
            :rules="[{ required: true, message: '请输入要订阅的主题!' }]"
          >
            <a-input v-model:value="connectInfo.subTopic" />
          </a-form-item>
          <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
            <a-button type="primary" html-type="submit">
              {{ isSub ? "取消订阅" : "订阅" }}
            </a-button>
          </a-form-item>
        </a-form>
      </div>
      <div v-if="isSub">
        <p>发送消息</p>
        <a-form
          :model="connectInfo"
          name="basic"
          :label-col="{ span: 4 }"
          :wrapper-col="{ span: 16 }"
          autocomplete="off"
          @finish="() => publishMessage()"
        >
          <a-form-item
            label="发送主题"
            name="sendTopic"
            :rules="[{ required: true, message: '请输入要发送的主题!' }]"
          >
            <a-input v-model:value="connectInfo.sendTopic" />
          </a-form-item>
          <a-form-item label="Radio">
            <a-radio-group v-model:value="connectInfo.msgType">
              <a-radio :value="0">常规</a-radio>
              <a-radio :value="1">响应式</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="发送消息" name="sendMsg">
            <a-input v-model:value="connectInfo.sendMsg" />
            <p></p>
            <a-button type="link" :size="'default'" @click="toCommand"
              >从协议生成消息</a-button
            >
          </a-form-item>

          <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
            <a-button type="primary" html-type="submit" :loading="isMsgSending">
              发送
            </a-button>
          </a-form-item>
        </a-form>
      </div>
      <div v-if="isSub">
        <a-timeline>
          <a-timeline-item
            v-for="(item, index) in historyMessageData"
            :key="index"
            :color="item.activeColor"
          >
            <p>Topic: {{ item.topic }}</p>
            <p>
              {{ item.msg }}
            </p>
            <p>{{ item.time }}</p>
          </a-timeline-item>
        </a-timeline>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  reactive,
  getCurrentInstance,
  onActivated,
  onDeactivated,
} from "vue";
import { useRouter } from "vue-router";
import time from "../../../sdk/api/common/utils/time";
import moment from "moment";
import BMSProtocol from "../../../sdk/api/protocol/BMSProtocol";

interface ConnectInfo {
  clientId: string; // 客户端ID
  host: string; // 地址(wss)
  port: string; // 端口
  path: string; // PATH
  // 订阅相关
  subTopic: string; // 订阅主题
  // 发送消息相关
  sendTopic: string; // 发送主题
  msgType: string; // 消息类型
  sendMsg: string; // 发送消息信息
  resAck: string; // 响应ACK
}

const router = useRouter();

const instance = getCurrentInstance();
const protocolImpl = new BMSProtocol();

let connection = instance.appContext.config.globalProperties.mqttConnect;
let isConnect = ref(false);
let reConnect = ref(false);
let historyMessageData = reactive([]);
let connectionModel: MqttConnectionModel;

let connectInfo = reactive({
  clientId: `sdkdemo_${Math.random().toString(16).substring(2, 10)}`,
  host: "emqx.antbms.com",
  port: 8084,
  path: "/mqtt",
  subTopic: "c/0/1515331618619037",
  sendTopic: "s/0/1515331618619037",
  sendMsg: "",
  msgType: 1,
  resAck: "",
});

const onFinish = async (values: any) => {
  isConnect.value ? await disconnect() : await connect();
};

const onFinishFailed = (errorInfo: any) => {
  console.log("Failed:", errorInfo);
};

/**
 *
 *
 */
const getDefaultRecord = (
  id: string,
  name: string,
  clientId: string,
  protocol: Protocol,
  host: string,
  port: number,
  path: string,
): MqttConnectionModel => {
  return {
    id: id,
    clientId: clientId,
    createAt: time.getNowDate(),
    updateAt: time.getNowDate(),
    name: name,
    clean: true,
    protocol: protocol,
    host: host,
    keepalive: 60,
    connectTimeout: 100,
    reconnect: true,
    reconnectPeriod: 3000,
    username: "",
    password: "",
    path: path,
    port: port,
    ssl: false,
    certType: "",
    rejectUnauthorized: true,
    ALPNProtocols: "",
    ca: "",
    cert: "",
    key: "",
    mqttVersion: "3.1.1",
    subscriptions: [],
    messages: [],
    unreadMessageCount: 0,
    clientIdWithTime: false,
    isCollection: false,
    parentId: null,
    // checkFun: BMSValidator.validate,
  };
};
/**
 * 创建连接
 */
async function connect() {
  connectionModel = getDefaultRecord(
    connectInfo.clientId,
    connectInfo.clientId,
    connectInfo.clientId,
    "wss",
    connectInfo.host,
    connectInfo.port,
    connectInfo.path,
  );

  //连接成功回调
  connection.onConnect(function (data: any) {
    console.log("连接成功", data);
    isConnect.value = true;
    reConnect.value = false;
  });

  connection.onError(function (data: any) {
    console.log("连接失败", data);
    isConnect.value = false;
    reConnect.value = false;
  });

  connection.onReConnect(function (data: any) {
    console.log("断线重连", data);
    reConnect.value = true;
  });

  connection.onDisconnect(function (data: any) {
    console.log("连接关闭", data);
    isConnect.value = false;
  });

  connection.onOffline(function (data: any) {
    console.log("离线", data);
    reConnect.value = true;
  });

  connection.onMessageArrived(function (data: any) {
    console.log("消息回复", data);
    historyMessageData.push({
      time: moment(new Date()).format("YYYY-MM-DD HH:mm:ss:SSS"),
      topic: data.msgArrived.topic,
      msg: data.msgArrived.payload,
      activeColor: "green",
      type: "reply",
    });
    // scrollToBottom();
  });

  // 调用 connect 方法
  let connectResult = await connection.connect(connectionModel);
  if (typeof connectResult === "boolean") {
    //TODO 消息通知
    console.log(connectResult);
  }
}
/**
 * 断开连接
 */
async function disconnect() {
  if (isSub.value) {
    await unsubscribe();
  }

  connection.disconnect();
}

// 订阅相关代码
let isSub = ref(false);
/**
 * 订阅
 */
async function subscribe() {
  console.log("订阅");
  //订阅
  let result = await connection.subscribe(
    {
      id: Math.random().toString(32).substring(2, 10),
      topic: connectInfo.subTopic,
      qos: 0,
      disabled: false,
      createAt: time.getNowDate(),
      alias: "",
      nl: undefined,
      rap: undefined,
      rh: undefined,
      subscriptionIdentifier: undefined,
    },
    "Hex",
  );

  if (typeof result === "boolean") {
    if (result) {
      isSub.value = true;
    }
  }
}

/**
 * 取消订阅
 */
async function unsubscribe() {
  let result = await connection.unsubscribe();
  if (typeof result === "boolean") {
    if (result) {
      isSub.value = false;
    }
  } else {
    console.warn("取消订阅异常，可能连接出现异常。");
    isSub.value = false;
  }
}

//  发送消息相关代码
let sendMsg = ref("");

/**
 * 发送一条消息
 */
const isMsgSending = ref(false);
async function publishMessage() {
  if (!connectInfo.sendMsg) return;
  isMsgSending.value = true;
  switch (connectInfo.msgType) {
    case 0:
      await simplePublishMessage();
      break;
    case 1:
      await publishMessageWait();
      break;
  }
  isMsgSending.value = false;
}

async function simplePublishMessage() {
  //发送一条数据
  historyMessageData.push({
    time: moment(new Date()).format("YYYY-MM-DD HH:mm:ss:SSS"),
    msg: sendMsg.value,
    topic: connectInfo.sendTopic,
    activeColor: "red",
    type: "send",
  });
  await connection.simplePublishMessage(
    connectInfo.sendTopic,
    sendMsg.value,
    "Hex",
  );
}

/**
 * 发送一条响应式消息
 */
async function publishMessageWait() {
  let selectedProtocol: SelectProtocol =
    instance.appContext.config.globalProperties.selectProtocol;
  //发送一条数据
  historyMessageData.push({
    time: moment(new Date()).format("YYYY-MM-DD HH:mm:ss:SSS"),
    msg: sendMsg.value,
    topic: connectInfo.sendTopic,
    activeColor: "red",
    type: "send",
  });

  let resp = await connection.publishMessageWait(
    {
      id: Math.random().toString(32).substring(2, 10),
      out: false,
      createAt: time.getNowDate(),
      topic: connectInfo.sendTopic,
      payload: sendMsg.value,
      qos: 0,
      retain: false,
    },
    "Hex",
    3000,
    (resHex: string) => {
      return protocolImpl.ackCheck(
        selectedProtocol.md5,
        selectedProtocol.versionNum,
        "MQTT",
        connectInfo.resAck,
        resHex,
      );
    },
    2,
  );

  if (resp) {
    console.log("收到响应");
  } else {
    console.log("无响应");
  }
}

// 从协议生成
/**
 *
 *
 */
const toCommand = () => {
  //跳转页面
  router.push({
    path: `/pages/protocol/protocolReview?packetConfigType=MQTT`,
  });
};

const handleCommandForPage = (result: BuildSendResult) => {
  connectInfo.sendMsg = result.command;
  connectInfo.resAck = result.ack;
};

// onMounted 或 setup 生命周期钩子
onMounted(async () => {
  instance.appContext.config.globalProperties.$bus.on(
    "handleCommand",
    handleCommandForPage,
  );
});

// 添加 activated 和 deactivated 钩子
onActivated(() => {
  console.log("组件被激活");
  // 如果需要，在这里重新初始化一些数据
});

onDeactivated(() => {
  console.log("组件被缓存");
  // 如果需要，在这里做一些数据清理工作，但不会断开连接
});

// 修改 onUnmounted 钩子，只在组件真正被销毁时才断开连接
onUnmounted(async () => {
  if (isConnect.value) {
    await disconnect();
  }
  instance.appContext.config.globalProperties.$bus.off(
    "handleCommand",
    handleCommandForPage,
  );
  console.log("MQTT页面真正销毁");
});
</script>
