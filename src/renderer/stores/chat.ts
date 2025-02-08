import { defineStore } from "pinia";
import { ref, computed } from "vue";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: "sk-43e6174f45e44a0d86bddc5e7ab7ca20",
  dangerouslyAllowBrowser: true,
});


export interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  loading?: boolean;
}

export const useChatStore = defineStore("chat", () => {
  // State
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);

  // Getters
  const lastMessage = computed(() => messages.value[messages.value.length - 1]);

  // Actions
  const addMessage = (message: Omit<Message, "id">) => {
    messages.value.push({
      id: Date.now().toString(),
      ...message,
    });
  };

  const updateLastMessage = (content: string) => {
    if (lastMessage.value) {
      lastMessage.value.content = content;
      lastMessage.value.loading = false;
    }
  };

  const sendMessage = async (content: string) => {
    // 添加用户消息
    addMessage({
      role: "user",
      content,
    });

    // 添加 AI 的加载消息
    addMessage({
      role: "ai",
      content: "",
      loading: true,
    });

    isLoading.value = true;

    try {
      const completion = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: content,
          },
        ],
        stream: false,
      });

      const data = {
        response: completion.choices[0].message.content,
      };
      console.log(data.response);
      if (data.response) {
        updateLastMessage(data.response);
      } else {
        updateLastMessage("抱歉，没有收到有效回复。");
      }
    } catch (error) {
      console.error("Error:", error);
      updateLastMessage("抱歉，出现了一些错误，请稍后重试。");
    } finally {
      isLoading.value = false;
    }
  };

  const clearMessages = () => {
    messages.value = [];
  };

  return {
    messages,
    isLoading,
    lastMessage,
    sendMessage,
    clearMessages,
  };
});
