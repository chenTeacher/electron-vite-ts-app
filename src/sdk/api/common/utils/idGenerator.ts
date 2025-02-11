export const getClientId = () => `mqttx_${Math.random().toString(16).substring(2, 10)}` as string
export const getCollectionId = () => `collection_${Math.random().toString(32).substring(2, 10)}` as string
export const getSubscriptionId = () => `scription_${Math.random().toString(32).substring(2, 10)}` as string
export const getMessageId = () => `message_${Math.random().toString(32).substring(2, 10)}` as string
export const getCopilotMessageId = () => `copilot_${Math.random().toString(32).substring(2, 10)}` as string

export default {
  getClientId,
  getCollectionId,
  getSubscriptionId,
  getMessageId,
}
