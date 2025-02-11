<template>
  <div>
    <div>
      <p>{{ previewData.title }}</p>
      <p>{{ previewData.desc }}</p>
      <p>{{ previewData.source }}</p>
      <p>{{ previewData.extra }}</p>
      <p>{{ previewData.time }}</p>
    </div>
    <div>
      <a-radio-group v-model:value="segmentedActiveIndex" button-style="solid">
        <a-radio-button value="0">下发指令</a-radio-button>
        <a-radio-button value="1">批量读指令</a-radio-button>
      </a-radio-group>
    </div>
    <div>
      <!-- <a-input-search
        v-model:value="searchValue"
        style="margin-bottom: 8px"
        placeholder="Search"
      /> -->
      <a-collapse accordion>
        <a-collapse-panel
          v-for="(commandItem, index) in commandList"
          :key="index"
          :header="commandItem.title"
        >
          <a-list
            v-if="segmentedActiveIndex === '0'"
            item-layout="horizontal"
            :data-source="commandItem.commandDetails"
          >
            <template #renderItem="{ item: commandDetail }">
              <a-list-item>
                <a-list-item-meta
                  :title="commandDetail.define"
                  :description="`
              hex:${commandDetail.hex} ack:${commandDetail.ack} level:${commandDetail.level}
              ${commandDetail.dataType} | 单位:${commandDetail.unit} | 倍数:${commandDetail.range}
            `"
                />
                <template #actions>
                  <a
                    @click="frontCommandClick(commandDetail, commandItem.func)"
                    >{{ `执行:${commandDetail.key}` }}</a
                  >
                </template>
              </a-list-item>
            </template>
          </a-list>
          <a-list v-else item-layout="horizontal">
            <a-list-item>
              <a-list-item-meta
                :title="commandItem.define"
                :description="`
            hex:${commandItem.hex}
            ack:${commandItem.ackFunc}
            `"
              />
              <template #actions>
                <a @click="bulkReadCommandClick(commandItem.key)">{{
                  `执行:${commandItem.key}`
                }}</a>
              </template>
            </a-list-item>
          </a-list>
        </a-collapse-panel>
      </a-collapse>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance } from "vue";
import BMSProtocol from "../../../sdk/api/protocol/BMSProtocol";

let instance = getCurrentInstance();
let protocolImpl = new BMSProtocol();
// 获取跳转时传递的参数
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { packetConfigType = "MQTT" } = route.query as {
  packetConfigType?: string;
};

const previewData = ref({
  title: "",
  desc: "",
  source: "",
  extra: "",
  time: "",
});

// 选择下发方式
const segmentedActiveIndex = ref("0");

const sendCommandList = ref([]); // 下发指令集合
const bulkReadCommandsList = ref([]); // 批量读指令集合
const commandList = computed(() => {
  if (segmentedActiveIndex.value === "0") return sendCommandList.value;
  return bulkReadCommandsList.value;
});

//  初始化操作
const init = () => {
  const selectProtocol = getSelectProtocol();
  const protocol = getProtocol(selectProtocol);
  getPreviewData(protocol, selectProtocol);
  setSendCommandData(protocol.sendCommands);
  setBulkReadCommandsData(protocol.bulkReadCommands);
};
const getSelectProtocol = () => {
  let selectProtocol: SelectProtocol =
    instance.appContext.config.globalProperties.selectProtocol;
  return selectProtocol;
};

const getProtocol = (selectProtocol: SelectProtocol) => {
  let protocol = BMSProtocol.findProtocolByMD5(
    selectProtocol.md5,
    selectProtocol.versionNum,
    packetConfigType
  );
  return protocol;
};
const getPreviewData = (
  protocol: ChildProtocol,
  selectProtocol: SelectProtocol
) => {
  previewData.value = {
    title: selectProtocol.text,
    desc: `版本:${protocol.versionNum} 环境：${protocol.env}`,
    source: protocol.prefix,
    extra: `是否需要CRC: ${protocol.needCrc ? "是" : "否"}`,
    time: protocol.suffix,
  };
};

const setSendCommandData = (data: Map<string, SendCommandValue>) => {
  //渲染指令下发tab
  let sendCommands = data;
  let commands: any = [];
  Object.entries(sendCommands).forEach(([key, value]) => {
    //命令组
    let sendCommandValue: SendCommandValue = value;

    let commandDetails: any = [];
    Object.entries(sendCommandValue.regDetails).forEach(([key, value]) => {
      value.key = key;
      commandDetails.push(value);
    });

    commands.push({
      name: sendCommandValue.funcName,
      title: `${sendCommandValue.funcName}(${sendCommandValue.func})`,
      func: sendCommandValue.func,
      commandDetails: commandDetails,
    });
  });
  sendCommandList.value = commands;
};

const setBulkReadCommandsData = (data: Map<string, BulkReadValue>) => {
  //渲染批量指令下发tab
  let sendBulkReadCommands = data;
  let bulkCommands: any = [];
  Object.entries(sendBulkReadCommands).forEach(([key, value]) => {
    value.key = key;
    value.name = value.define;
    value.title = value.define;
    bulkCommands.push(value);
  });
  bulkReadCommandsList.value = bulkCommands;
};

const bulkReadCommandClick = (code: string) => {
  let selectedProtocol: SelectProtocol =
    instance.appContext.config.globalProperties.selectProtocol;
  let result: BuildSendResult = protocolImpl.buildBulkReadCommand(
    selectedProtocol.md5,
    selectedProtocol.versionNum,
    packetConfigType,
    code
  );
  if (!result.success) {
    console.log("bulkReadCommandClick result", result.message);
  } else {
    // uni.$emit("handleCommand", result);
    // uni.navigateBack();
    instance?.appContext.config.globalProperties.$bus.emit(
      "handleCommand",
      result
    );
    router.back();
  }
};

const frontCommandClick = (commandDetail: CommandDetail, func: string) => {
  let command = commandDetail.hex;
  // 先判断是否有占位符
  const placeholderMatch = command.match(/\{(\d+)\}/);

  const inputOpCode = commandDetail.key;
  const inputOpFunc = func;
  if (!placeholderMatch) {
    // input.value = "";
    commandClick(inputOpCode, inputOpFunc); //无参数直接调用
  } else {
    // inputShow.value = true;
  }
};

const commandClick = (inputOpFunc: string, inputOpCode: string) => {
  let selectedProtocol: SelectProtocol =
    instance.appContext.config.globalProperties.selectProtocol;
  let result: BuildSendResult = protocolImpl.buildCommand(
    selectedProtocol.md5,
    selectedProtocol.versionNum,
    packetConfigType,
    inputOpFunc,
    inputOpCode,
    ""
  );
  if (!result.success) {
    console.log("commandClick result", result.message);
  } else {
    // uni.$emit("handleCommand", result);
    // uni.navigateBack();
    instance?.appContext.config.globalProperties.$bus.emit(
      "handleCommand",
      result
    );
    router.back();
  }
};
onMounted(() => {
  init();
});
</script>
