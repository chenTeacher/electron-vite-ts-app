<template>
  <div class="chat-app">
    <div class="chat-container">
      <div class="chat-messages" ref="messageContainer">
        <div
          v-for="message in chatStore.messages"
          :key="message.id"
          :class="[
            'message-wrapper',
            message.role === 'user' ? 'user-message' : 'ai-message',
          ]"
        >
          <div class="message-content">
            <div class="avatar">
              <div v-if="message.role === 'user'" class="user-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <div v-else class="ai-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="message-container">
              <div class="sender-name">
                {{ message.role === 'user' ? '你' : 'Assistant' }}
              </div>
              <div class="message-text">
                <div v-if="message.loading" class="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div v-else class="text-content" v-html="formatMessage(message.content)"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="input-panel">
        <div class="input-container">
          <textarea
            v-model="inputMessage"
            class="message-input"
            :rows="1"
            placeholder="发送消息..."
            @keydown.enter.prevent="handleEnter"
            @input="autoResize"
            ref="textareaRef"
          ></textarea>
          <button 
            class="send-button"
            @click="handleSendMessage"
            :disabled="!inputMessage.trim() || chatStore.isLoading"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 2L11 13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useChatStore } from '@/stores/chat';
import { marked } from 'marked';
import hljs from 'highlight.js';
import "highlight.js/styles/github.css";

// Store
const chatStore = useChatStore();

// Refs
const messageContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const inputMessage = ref('');

// 配置 marked
marked.setOptions({
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true
});

// 设置自定义渲染器
const renderer = new marked.Renderer();
renderer.code = (code, language) => {
  const validLanguage = hljs.getLanguage(language || '') ? language : 'plaintext';
  const highlightedCode = hljs.highlight(code, {
    language: validLanguage || 'plaintext',
    ignoreIllegals: true
  }).value;
  return `<pre><code class="hljs language-${validLanguage}">${highlightedCode}</code></pre>`;
};
marked.use({ renderer });

// Methods
const formatMessage = (content: string): string => {
  return marked.parse(content);
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`;
  }
};

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) return;
  handleSendMessage();
};

const handleSendMessage = async () => {
  const message = inputMessage.value.trim();
  if (!message || chatStore.isLoading) return;

  // 清空输入框
  inputMessage.value = '';
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }

  try {
    await chatStore.sendMessage(message);
  } catch (error) {
    console.error('Failed to send message:', error);
    // 这里可以添加错误提示
  }
};

// Watchers
watch(() => chatStore.messages, scrollToBottom, { deep: true });

// Lifecycle
onMounted(() => {
  scrollToBottom();
});
</script>

<style lang="less" scoped>
.chat-app {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #343541;  // 深色背景

  .chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 180px;

      .message-wrapper {
        padding: 24px 0;
        
        &.user-message {
          background: #343541;  // 用户消息背景
        }
        
        &.ai-message {
          background: #444654;  // AI 消息背景
        }

        .message-content {
          display: flex;
          width: 100%;
          max-width: calc(100% - 48px);
          min-width: 200px;
          margin: 0 auto;
          padding: 0 24px;
          gap: 16px;
          align-items: flex-start;
          box-sizing: border-box;
          
          @media (min-width: 768px) {
            max-width: 48rem;
          }

          .avatar {
            width: 28px;
            height: 28px;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            
            .user-avatar {
              background: #5c5c70;  // 用户头像背景
              width: 100%;
              height: 100%;
              border-radius: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ececf1;  // 用户头像图标颜色
            }
            
            .ai-avatar {
              background: #19c37d;  // AI 头像背景
              width: 100%;
              height: 100%;
              border-radius: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
          }

          .message-container {
            flex: 1;
            min-width: 0;

            .sender-name {
              font-size: 14px;
              color: #ececf1;  // 发送者名称颜色
              margin-bottom: 4px;
            }

            .message-text {
              .text-content {
                font-size: 15px;
                line-height: 1.6;
                white-space: pre-wrap;
                word-break: break-word;
                color: #ececf1;  // 文本颜色
              }

              .loading-dots {
                padding: 8px 0;
                display: flex;
                gap: 4px;
                
                span {
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: #ececf1;  // 加载动画颜色
                  animation: bounce 1.4s infinite ease-in-out;
                }
              }
            }

            code {
              font-family: 'Söhne Mono', Monaco, Andale Mono, Ubuntu Mono, monospace;
              font-size: 14px;
              
              &:not(pre code) {
                color: #ececf1;
                padding: 2px 6px;
                background: #64646f;  // 行内代码背景
                border-radius: 4px;
              }
            }

            pre {
              background: #64646f;  // 代码块背景
              padding: 16px;
              border-radius: 8px;
              overflow-x: auto;
              margin: 16px 0;
              
              code {
                background: none;
                padding: 0;
                color: #ececf1;
              }
            }
          }
        }

        &.user-message {
          .message-container {
            .message-text {
              .text-content {
                background: #5c5c70;  // 用户消息气泡背景
                color: #ececf1;  // 用户消息文字颜色
                padding: 12px 16px;
                border-radius: 16px 16px 0 16px;
                display: inline-block;
                max-width: 80%;
              }
            }
          }
        }
      }

      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background-color: #565869;  // 滚动条颜色
        border-radius: 4px;
        
        &:hover {
          background-color: #676980;  // 滚动条悬停颜色
        }
      }
    }

    .input-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #343541;
      padding: 24px 0;
      border-top: 1px solid #565869;
      width: 100%;
      
      .input-container {
        width: 100%;
        max-width: calc(100% - 48px);
        min-width: 200px;
        margin: 0 auto;
        padding: 0 24px;
        position: relative;
        box-sizing: border-box;
        
        @media (min-width: 768px) {
          max-width: 48rem;
        }
        
        .message-input {
          width: 100%;
          max-height: 200px;
          padding: 12px 48px 12px 16px;
          border-radius: 24px;
          border: 1px solid #565869;
          background: #40414f;
          color: #ececf1;
          font-size: 15px;
          line-height: 1.5;
          resize: none;
          outline: none;
          box-shadow: 0 0 0 1px #565869;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          
          &:focus {
            border-color: #19c37d;
            box-shadow: 0 0 0 1px #19c37d;
          }
          
          &::placeholder {
            color: #8e8ea0;
          }
        }
        
        .send-button {
          position: absolute;
          right: 32px;
          bottom: 8px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #ececf1;  // 发送按钮颜色
          transition: background-color 0.2s;
          
          &:hover {
            background: #565869;  // 发送按钮悬停背景
          }
          
          &:disabled {
            color: #8e8ea0;  // 禁用状态颜色
            cursor: not-allowed;
            
            &:hover {
              background: transparent;
            }
          }
        }
      }
      
      .input-footer {
        width: 100%;
        max-width: calc(100% - 48px);
        min-width: 200px;
        margin: 8px auto 0;
        padding: 0 24px;
        box-sizing: border-box;
        
        @media (min-width: 768px) {
          max-width: 48rem;
        }
        
        .footer-text {
          font-size: 12px;
          color: #8e8ea0;
        }
      }
    }
  }
}

@keyframes bounce {
  0%, 80%, 100% { 
    transform: scale(0);
    opacity: 0.3;
  }
  40% { 
    transform: scale(1);
    opacity: 1;
  }
}
</style>
