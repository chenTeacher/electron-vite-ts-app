<script setup lang="ts">
// import { RouterLink, RouterView } from 'vue-router'
import AIChatView from '@/components/AIChatView.vue'
import { ref } from 'vue'

const message = ref('Hello World!')
const sendMessage = () => {
  console.log('📤 发送消息')
  window.electronAPI.message('Hello from Vue!')
}

const sendAndReceive = async () => {
  const ret = await window.electronAPI.receiveAndReturn('Hello from Vue!')
  console.log('📤 发送消息并接收回复', ret)
  message.value = ret.newData
}
</script>

<template>
  <div>
    <div>{{message}}</div>
    <p>Welcome to your Font Mini...嗨嗨</p>
    <button @click="sendMessage">
      单向通信
    </button>
    <button @click="sendAndReceive">
      双向通信
      
    </button>
  </div>
    <AIChatView></AIChatView>
  <!-- <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView /> -->
</template>

<style scoped>

</style>
