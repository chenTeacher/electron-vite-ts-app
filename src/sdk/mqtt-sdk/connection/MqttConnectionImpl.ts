import { MqttClient, IConnackPacket, IPublishPacket, IClientPublishOptions, IDisconnectPacket, Packet } from 'mqtt-expand';

import { Subject, fromEvent } from 'rxjs';
import { bufferTime, map, filter, takeUntil } from 'rxjs/operators';

import {} from '../../api/common/model/GlobalModel';
import { log, CircularQueue, validFormatJson, time } from '../../api/common/utils';
import { createClient } from '../utils/mqttUtils';
import getErrorReason from '../utils/mqttErrorReason';
import { MqttConnectionInterface } from '../../api/MqttConnectionInterface';

export class MqttConnectionImpl implements MqttConnectionInterface {
	private connectCallback?: MqttCallbackType; // 存储连接成功的回调
	private errorCallback?: MqttCallbackType; // 存储连接错误的回调
	private reconnectCallback?: MqttCallbackType; // 存储重连的回调
	private disconnectCallback?: MqttCallbackType; // 存储断开连接的回调
	private offlineCallback?: MqttCallbackType; // 存储离线的回调
	private messageArrivedCallback?: MqttCallbackType; // 存储离线的回调

	onConnect(callback: MqttCallbackType): void {
		this.connectCallback = callback; // 存储连接成功的回调
	}

	onError(callback: MqttCallbackType): void {
		this.errorCallback = callback; // 存储连接错误的回调
	}

	onReConnect(callback: MqttCallbackType): void {
		this.reconnectCallback = callback; // 存储重连的回调
	}

	onDisconnect(callback: MqttCallbackType): void {
		this.disconnectCallback = callback; // 存储断开连接的回调
	}

	onOffline(callback: MqttCallbackType): void {
		this.offlineCallback = callback; // 存储离线的回调
	}

	onMessageArrived(callback: MqttCallbackType): void {
		this.messageArrivedCallback = callback; // 存储消息回复的回调
	}

	private defaultPayloadType: PayloadType = 'Hex';
	private connectionModel!: MqttConnectionModel;
	private connectLoading = false;
	private disconnectLoding = false;
	private unsubLoading = false;
	private reTryConnectTimes = 0;
	private curConnectionId!: string | undefined;
	private sendFrequency: number | undefined = undefined;
	private sendTimeId: number | null = null;
	private sendTimedMessageCount = 0;
	private maxReconnectTimes!: number;

	private restoreCircularQueue: CircularQueue<QueueEntity> = new CircularQueue<QueueEntity>(100);

	private client: Partial<MqttClient> = {
		connected: false,
		options: {}
	};

	private subReceiveRecord: SubscriptionModel;

	// Connect
	public async connect(connection: MqttConnectionModel): Promise<boolean | void> {
		if (this.client.connected || this.connectLoading) {
			return false;
		}
		this.connectLoading = true;
		// new client
		try {
			let { curConnectClient, connectUrl } = createClient(connection);
			this.client = curConnectClient;
			const { name, id } = connection;
			if (id && this.client.on) {
				log.info(`Assigned ID ${id} to MQTTX client`);
				this.client.on('connect', this._onConnect);
				this.client.on('error', this._onError);
				this.client.on('reconnect', this._onReConnect);
				this.client.on('disconnect', this._onDisconnect);
				this.client.on('offline', this._onOffline);
				this._onMessageArrived(this.client as MqttClient, id);
				// Debug MQTT Packet Log
				this.client.on('packetsend', (packet) => this.onPacketSent(packet, name));
				this.client.on('packetreceive', (packet) => this.onPacketReceived(packet, name));
			}

			const protocolLogMap: ProtocolMap = {
				mqtt: 'MQTT/TCP connection',
				mqtts: 'MQTT/SSL connection',
				ws: 'MQTT/WS connection',
				wss: 'MQTT/WSS connection'
			};
			const curOptionsProtocol: Protocol = (this.client as MqttClient).options.protocol as Protocol;
			let connectLog = `Client ${connection.name} connected using ${protocolLogMap[curOptionsProtocol]} at ${connectUrl}`;
			log.info(connectLog);

			this.connectionModel = connection;
			return true;
		} catch (error) {
			this.connectLoading = false;
			const err = error as Error;
			this._onError(err);
		}
	}

	// Disconnect
	public disconnect(): boolean | void {
		if (!this.client.connected || this.disconnectLoding) {
			return false;
		}
		this.stopTimedSend();
		this.disconnectLoding = true;
		this.client.end!(false, () => {
			this.disconnectLoding = false;
			this.reTryConnectTimes = 0;
			log.info(`MQTTX client named ${this.connectionModel.name} with client ID ${this.connectionModel.clientId} disconnected`);

			// 当断开连接时调用存储的回调
			if (this.disconnectCallback) {
				this.disconnectCallback({
					id: this.connectionModel.id,
					name: this.connectionModel.name
				});
			}
		});
	}

	/**
	 * 订阅topic
	 * @param subReceiveRecord
	 */
	public async subscribe(subReceiveRecord: SubscriptionModel, payloadType: PayloadType): Promise<boolean> {
		this.defaultPayloadType = payloadType;
		this.subReceiveRecord = subReceiveRecord;

		let isFinished = false;
		let qos = subReceiveRecord.qos;
		let nl = subReceiveRecord.nl;
		let rap = subReceiveRecord.rap;
		let rh = subReceiveRecord.rh;

		if (this.client.subscribe) {
			let properties: { subscriptionIdentifier: number } | undefined = undefined;
			if (this.connectionModel.mqttVersion === '5.0' && subReceiveRecord.subscriptionIdentifier != undefined) {
				properties = {
					subscriptionIdentifier: subReceiveRecord.subscriptionIdentifier
				};
			}
			this.client.subscribe(subReceiveRecord.topic, { qos, nl, rap, rh, properties }, async (error, granted) => {
				if (error) {
					log.error(error);
					isFinished = true; // Set isFinished to true to break the loop
					return; // Exit early
				}
				const successSubscriptions: string[] = [];
				granted.forEach((grant) => {
					if ([0, 1, 2].includes(grant.qos)) {
						successSubscriptions.push(grant.topic);
					} else {
						setTimeout(() => {
							console.log(grant.topic + '订阅失败');
						}, 0);
					}
				});
				if (!successSubscriptions.length) {
					isFinished = true; // Set isFinished to true to break the loop
					return; // Exit early
				}

				isFinished = true; // Indicate that the subscription process is finished
			});
		}

		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		// Wait for the subscription process to finish
		while (!isFinished) {
			await sleep(100);
		}

		return true; // Return true if the subscription process is finished
	}

	/**
	 * 取消订阅
	 * @returns
	 */
	public unsubscribe(): Promise<boolean> {
		const { topic, qos } = this.subReceiveRecord;
		return new Promise((resolve, reject) => {
			if (!this.client || !this.client.connected || !topic) {
				resolve(false);
				return false;
			}
			this.unsubLoading = true;
			if (this.client.unsubscribe) {
				this.client.unsubscribe(topic, { qos }, async (error) => {
					this.unsubLoading = false;
					if (error) {
						resolve(false);
						return false;
					}
					resolve(true);
					return true;
				});
			}
		});
	}

	// Connect callback
	private _onConnect = (conBack: IConnackPacket) => {
		this.connectLoading = false;
		this.curConnectionId = this.connectionModel.id;
		this.connectionModel.reconnect = false;
		log.info(`Successful connection for ${this.connectionModel.name}, MQTT.js onConnect trigger`);
		// 当连接成功时调用存储的回调
		if (this.connectCallback) {
			this.connectCallback({
				id: this.connectionModel.id,
				name: this.connectionModel.name
			});
		}
	};

	// Error callback
	private _onError = (error: Error) => {
		this.forceCloseTheConnection();
		log.error(`Connection failed, MQTT.js onError trigger, Error: ${error.stack}`);
		// 当连接失败时调用存储的回调
		if (this.errorCallback) {
			this.errorCallback({
				id: this.connectionModel.id,
				name: this.connectionModel.name,
				data: error.stack
			});
		}
		// this.$emit('reload')
	};

	// Reconnect callback
	private _onReConnect = () => {
		if (!this.connectionModel.reconnect) {
			this.forceCloseTheConnection();
			// this.$emit('reload')
		} else {
			if (this.reTryConnectTimes > this.maxReconnectTimes) {
				log.warn('Max reconnect limit reached, stopping retries');
				this.forceCloseTheConnection();
			} else {
				log.info(`Retrying connection for ${this.connectionModel.name}, attempt: ${this.reTryConnectTimes}`);
				this.reTryConnectTimes += 1;
				this.connectLoading = true;
				// 当重连时调用存储的回调
				if (this.reconnectCallback) {
					this.reconnectCallback({
						id: this.connectionModel.id,
						name: this.connectionModel.name
					});
				}
			}
		}
	};

	private _onDisconnect = (packet: IDisconnectPacket) => {
		const reasonCode = packet.reasonCode!;
		const reason = reasonCode === 0 ? 'Normal disconnection' : getErrorReason('5.0', reasonCode);
		console.log('onDisconnect:' + reason);
		const logMessage = 'Received disconnect packet from Broker. MQTT.js onDisconnect trigger';
		log.warn(logMessage);
		// 当断开连接时调用存储的回调
		if (this.disconnectCallback) {
			this.disconnectCallback({
				id: this.connectionModel.id,
				name: this.connectionModel.name
			});
		}
	};

	private _onOffline = () => {
		log.info(`The connection ${this.connectionModel.name} (clientID ${this.connectionModel.clientId}) is offline. MQTT.js onOffline trigger`);
		// 当离线时调用存储的回调
		if (this.offlineCallback) {
			this.offlineCallback({
				id: this.connectionModel.id,
				name: this.connectionModel.name
			});
		}
	};

	/**
	 * Handles the event when a packet is sent.
	 * @param {Packet} packet - The packet that was sent.
	 * @param {string} name - The name of the connection.
	 */
	private onPacketSent(packet: Packet, name: string) {
		log.debug(`[${name}] Sent packet: ${JSON.stringify(packet)}`);
	}

	/**
	 * Handles the event when a packet is received.
	 *
	 * @param {Packet} packet - The received packet.
	 * @param {string} name - The name of the connection.
	 */
	private onPacketReceived(packet: Packet, name: string) {
		log.debug(`[${name}] Received packet: ${JSON.stringify(packet)}`);
	}

	public stopTimedSend() {
		this.sendFrequency = undefined;
		this.sendTimedMessageCount = 0;
		if (this.sendTimeId) {
			clearInterval(this.sendTimeId);
			this.sendTimeId = null;
			log.info(`Timed messages sending stopped for ${this.connectionModel.name}`);
		}
	}

	private forceCloseTheConnection() {
		if (this.client.end) {
			this.client.end(true, () => {
				this.reTryConnectTimes = 0;
				this.connectLoading = false;
				log.warn(`MQTTX force closed the connection ${this.connectionModel.name} (Client ID: ${this.connectionModel.clientId})`);
			});
		}
	}

	private onClose() {
		log.info(`Connection for ${this.connectionModel.name} closed, MQTT.js onClose trigger`);
		this.connectLoading = false;
	}

	// 处理接收数据
	private _onMessageArrived(client: MqttClient, id: string) {
		this.restoreCircularQueue = new CircularQueue<QueueEntity>(100);
		const unsubscribe$ = new Subject();

		if (client.listenerCount('close') <= 1) {
			fromEvent(client, 'close').subscribe(() => {
				unsubscribe$.next();
				unsubscribe$.complete();
				this.onClose();
			});
		}

		const messageSubject$ = fromEvent(client, 'message').pipe(takeUntil(unsubscribe$));

		const processMessageSubject$ = messageSubject$.pipe(
			map(([topic, payload, packet]: any) => {
				return this.processReceivedMessage(topic, payload, packet);
			})
		);
		// const filterMessageSubject$ = processMessageSubject$.pipe(
		// 	filter((m: any) => id === this.curConnectionId && m.topic.includes(this.subReceiveRecord.topic )),
		// )

		processMessageSubject$.pipe(bufferTime(1000)).subscribe((messages: MessageModel[]) => {
			try {
				messages.forEach((message: MessageModel) => {
					if (message && id === this.curConnectionId && message.payload != undefined) {
						console.log('%c<--：' + message.payload, 'background-color: #409EFF; color: #ffffff;');
						let checkResult = true
						//校验数据
						if (this.connectionModel.checkFun) {
							if (!this.connectionModel.checkFun(message.payload)) {
								log.error('[数据校验失败]' + message.payload);
								checkResult = false
							}
						}
						
						if(checkResult){
							//回复的消息放入环形队列中
							this.restoreCircularQueue.enqueue({
								payload:message.payload,
								receiveTime:new Date()
							});
							//若存在监听则把消息传入到监听中
							if (this.messageArrivedCallback) {
								this.messageArrivedCallback({
									id: this.connectionModel.id,
									name: this.connectionModel.name,
									msgArrived: message
								});
							}
						}
						
					} else {
						log.warn(`Connection with ID: ${id} has received a new, unread message`);
					}
				});
			} catch (error) {
				log.error((error as Error).toString());
				return;
			}
		});
	}

	/**
	 * 根据类型，把接收到的数据转换成对应的格式
	 * @param topic
	 * @param payload
	 * @param packet
	 */
	private processReceivedMessage(topic: string, payload: Buffer, packet: IPublishPacket) {
		const { qos, retain, properties } = packet;
		let receivedPayload;
		let receiveType = this.defaultPayloadType;
		if (receiveType == 'Plaintext') {
			receivedPayload = payload;
		} else if (receiveType === 'Base64') {
			receivedPayload = payload.toString('base64');
		} else if (receiveType === 'Hex') {
			receivedPayload = payload.toString('hex').replace(/(.{4})/g, '$1 ');
		} else if (receiveType === 'JSON') {
			let jsonValue: string | undefined;
			try {
				jsonValue = validFormatJson(payload.toString());
			} catch (error) {
				throw error;
			}
			if (jsonValue) {
				receivedPayload = jsonValue;
			}
		}

		if (!receivedPayload) {
			return;
		}

		const receivedMessage: MessageModel = {
			id: Math.random().toString(32).substring(2, 10),
			out: false,
			createAt: time.getNowDate(),
			topic,
			payload: receivedPayload.toString(),
			qos,
			retain,
			properties
		};

		return receivedMessage;
	}

	/**
	 * 简单发送消息的实现。<br>
	 * 生产环境慎用，设计目的仅用作快速调试使用
	 */
	public async simplePublishMessage(topicName: string, content: string, type: PayloadType): Promise<string | void> {
		console.log('%c-->' + content, 'background-color: #34c388; color: #ffffff;');
		let message: MessageModel = {
			id: Math.random().toString(32).substring(2, 10),
			out: false,
			createAt: time.getNowDate(),
			topic: topicName,
			payload: content,
			qos: 0,
			retain: false
		};

		await this.publishMessage(message, type);
	}

	/**
	 * 发布消息到mqtt
	 * @param message
	 * @param type
	 */
	public async publishMessage(message: MessageModel, type: PayloadType): Promise<void> {
		const { topic, qos, payload, retain, properties } = message;

		const props = properties ? this.processProperties(properties) : undefined;

		let finalPayload: string | Buffer | undefined = payload;

		if (payload) {
			finalPayload = this.convertPublishPayload(type, message.payload);
			if (finalPayload === undefined) return;
		}

		this.client.publish!(topic, finalPayload, { qos, retain, properties: props as IClientPublishOptions['properties'] }, async (error: Error) => {
			if (error) {
				this._onError(error);
				return;
			}
		});
	}

	public async publishMessageWait(message: MessageModel, type: PayloadType, timeout: number,ackCheck: (resHex:string) => boolean,retry: number = 0): Promise<String | undefined> {
		// 记录开始时间
		const pollingInterval = 100;
		let attempts = 0;

		while (attempts <= retry) {
			// 发送数据
			await this.publishMessage(message,type);
			const startTime = Date.now();

			while (Date.now() - startTime < timeout) {
				const receivedMessage = await this.getMessageFromQueue(timeout - (Date.now() - startTime));

				if (
					receivedMessage !== undefined && 
					receivedMessage.receiveTime.getTime() > startTime && 
					ackCheck(receivedMessage.payload)
				) {
					// 如果获取到数据且校验通过，返回获取到的数据
					return receivedMessage.payload;
				}

				// 等待100毫秒后再获取数据
				await new Promise((resolve) => setTimeout(resolve, pollingInterval));
			}

			// 重试次数增加
			attempts += 1;
		}

		log.debug('超时无响应数据');
		// 超时或重试结束返回 undefined
		return undefined;
	}

	private filterNonNullEntries(properties: any): any {
		return Object.fromEntries(Object.entries(properties).filter(([_, v]) => v != null));
	}

	private processProperties(properties: any) {
		const props = this.filterNonNullEntries(properties);
		if (props.correlationData && typeof props.correlationData === 'string') {
			props.correlationData = Buffer.from(props.correlationData);
		}
		if (props.userProperties) {
			props.userProperties = { ...props.userProperties }; // Convert Vue object to JS object
		}
		return props;
	}

	/**
	 * 根据PayloadType转换待发布的数据类型
	 * @param publishType
	 * @param publishValue
	 */
	private convertPublishPayload = (publishType: PayloadType, publishValue: string) => {
		if (publishType === 'Base64') {
			return Buffer.from(publishValue, 'base64');
		}
		if (publishType === 'Hex') {
			return Buffer.from(publishValue.replace(/\s+/g, ''), 'hex');
		}
		if (publishType === 'JSON') {
			try {
				validFormatJson(publishValue.toString());
			} catch (error) {
				log.error(error);
				return undefined;
			}
		}
		return publishValue;
	};

	/**
	 * 从环形队列获取消息
	 * @param timeout 获取消息的超时时间 毫秒。最大值30000
	 */
	private async getMessageFromQueue(timeout: number): Promise<QueueEntity | undefined> {
		if (timeout > 30000) timeout = 30000;
		const interval = 50; // 每50毫秒检查一次
		const maxTries = timeout / interval; // 最多尝试次数

		return new Promise((resolve) => {
			let tries = 0;
			const intervalId = setInterval(() => {
				const message = this.restoreCircularQueue.dequeue();
				if (message !== undefined) {
					clearInterval(intervalId);
					resolve(message);
				} else if (tries >= maxTries) {
					clearInterval(intervalId);
					resolve(undefined);
				}
				tries++;
			}, interval);
		});
	}
}
