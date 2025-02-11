<template>
  <div>
    <h2>协议版本</h2>
    <a-radio-group
      v-model:value="protocolTypeIndex"
      button-style="solid"
      @change="switchProtocolType"
    >
      <a-radio-button
        v-for="(item, index) in protocolTypes"
        :key="index"
        :value="item"
        >{{ item }}</a-radio-button
      >
    </a-radio-group>
    <h2>协议列表</h2>
    {{ selectedProtocol }}
    <a-select
      ref="select"
      v-model:value="selectedProtocol"
      style="width: 120px"
      :options="selectProtocolOptions"
      :fieldNames="{ value: 'md5', label: 'text' }"
      :dropdownMatchSelectWidth="false"
      @change="handleChange"
    >
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, getCurrentInstance } from "vue";
import { useRouter } from "vue-router";

import BMSProtocol from "./../../../sdk/api/protocol/BMSProtocol";
import ChargerProtocol from "./../../../sdk/api/protocol/ChargerProtocol";
import PowerProtocol from "./../../../sdk/api/protocol/PowerProtocol";

let instance = getCurrentInstance();
const router = useRouter();

const protocolTypeIndex = ref<string>("0"); // 当前协议类型, 默认为 0:BMS
const protocolTypes = ref(["BMS", "POWER", "CHARGER"]); // 协议类型列表
const selectProtocolOptions = ref([]); // 选择的协议列表
const selectedProtocol = ref(""); // 选择的协议

/**
 * 选择协议
 * @param e  事件
 */
const switchProtocolType = async function (e: Event) {
  const index = protocolTypeIndex.value.toUpperCase();
  switch (index) {
    case "BMS":
      selectProtocolOptions.value = await new BMSProtocol().list();
      break;
    case "CHARGER":
      selectProtocolOptions.value = await new ChargerProtocol().list();
      break;
    case "POWER":
      selectProtocolOptions.value = await new PowerProtocol().list();
      break;
  }
};

const handleChange = (value: string, option: any) => {
  console.log("handleChange", value, option);
  let selected = option as SelectProtocol;
  instance.appContext.config.globalProperties.selectProtocol = selected;
};
</script>

<style scoped></style>
