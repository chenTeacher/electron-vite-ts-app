import {} from './common/model/GlobalModel';
export interface MqttConnectionInterface {
	/**
	 * 创建连接
	 */
	connect(connectEntity: MqttConnectionModel): void;

	/**
	 * 主动断开连接
	 */
	disconnect(): boolean | void;

	/**
	 * 订阅topic
	 */
	subscribe(subReceiveRecord: SubscriptionModel, payloadType: PayloadType): void;

	/**
	 * 取消订阅
	 */
	unsubscribe(): Promise<boolean>;

	/**
	 * 发送简单消息<br>仅用作开发/测试环境使用
	 */
	simplePublishMessage(topicName: string, content: string, type: PayloadType): Promise<string | void>;

	/**
	 * 发送消息
	 */
	publishMessage(message: MessageModel, type: PayloadType): Promise<string | void>;

	/**
	 * 发送消息并等待回复
	 * @param message 
	 * @param type 
	 * @param timeout 
	 * @param ackCheck ACK校验方法
	 * @param retry 消息发送失败重试次数，默认值0 不重试。失败的定义是：未得到有效响应
	 */
	publishMessageWait(message: MessageModel, type: PayloadType, timeout: number,ackCheck: (resHex:string) => boolean,retry?: number): Promise<String | undefined> 

	/**
	 * 连接成功回调
	 */
	onConnect(callback: MqttCallbackType): void;

	/**
	 * 错误回调
	 */
	onError(callback: MqttCallbackType): void;

	/**
	 * 断线重连回调
	 */
	onReConnect(callback: MqttCallbackType): void;

	/**
	 * 断开连接回调
	 */
	onDisconnect(callback: MqttCallbackType): void;

	/**
	 * 接收消息回调
	 */
	onMessageArrived(callback: MqttCallbackType): void;

	/**
	 * 离线回调
	 */
	onOffline(callback: MqttCallbackType): void;
}
