import {} from './common/model/GlobalModel';

export interface BleConnectionInterface {
	/**
	 * 设备发现回调<br>
	 * 注意设备在开启scan的过程中，这个接口的返回速度将会非常快。回调方要做好异步刷新提高UI渲染效率
	 */
	onDeviceDiscover(callback: BleDiscoverListType): void;

	/**
	 * 主动获取搜寻的设备列表。注意您将无法通过修改返回的列表数据来影响SDK逻辑
	 */
	getDiscoverDevices(): BleDevice[];

	/**
	 * 根据设备ID主动获取搜寻的设备列表。注意您将无法通过修改返回的列表数据来影响SDK逻辑
	 */
	getDiscoverDevicesById(deviceId: string): BleDevice | undefined;

	/**
	 * 开始扫描回调
	 */
	onStartScan(callback: onScanType): void;

	/**
	 * 结束扫描回调
	 */
	onStopScan(callback: onScanType): void;

	/**
	 * 连接蓝牙设备
	 */
	connect(bleConnectEntity: BleConnectModel): Promise<boolean>;

	/**
	 * 主动断开连接
	 */
	disconnect(deviceId: string): Promise<boolean>;

	/**
	 * 获取已连接的所有设备
	 * 此操作会让设备和连接设备之间的MTU协调到最大值。此处需要将MTU回写到设备列表
	 * 注意：Android设备或性能较差的设备可能需要多次获取才能获取到最新值。建议调用方尝试多次间隔调用。MTU不为20即为协调后的最大值
	 */
	getConnected(): Promise<BleDevice[]>;

	/**
	 * 获取蓝牙适配器状态
	 */
	getBleStatus(): Promise<BleAdapterStateModel>;

	/**
	 * 连接成功回调
	 */
	onConnect(callback: BleCallbackType): void;

	/**
	 * 错误回调
	 */
	onError(callback: BleCallbackType): void;

	/**
	 * 断线重连回调
	 */
	onReConnect(callback: BleCallbackType): void;

	/**
	 * 断开连接回调
	 */
	onDisconnect(callback: BleCallbackType): void;

	/**
	 * 接收消息回调
	 */
	onMessageArrived(callback: BleCallbackType): void;

	/**
	 * 离线回调
	 */
	onOffline(callback: BleCallbackType): void;

	/**
	 * 蓝牙适配器状态变化（开启或打开蓝牙）
	 */
	onAdapterStateChange(callback: BleCallbackType): void;

	/**
	 * 蓝牙设备状态变化
	 * @param callback 
	 */
	onBLEStateChange(callback: BleCallbackType): void;

	/**
	 * 主动读消息
	 */
	readMessage(message: BleMessageModel): Promise<string | void>;

	/**
	 * 发送消息
	 */
	publishMessage(message: BleMessageModel): Promise<string | void>;

	/**
	 * 发送消息并等待回复
	 * @param message 
	 * @param timeout 超时等待时间（单位：毫秒）
	 * @param ackCheck 
	 * @param retry 消息发送失败重试次数，默认值0 不重试。失败的定义是：未得到有效响应
	 * @param allowTransactionHistory 是否允许消费历史数据。历史消息的定时是：拿到正确订阅的数据如果再发送指令之前就认为是历史数据
	 */
	publishMessageWait(message: BleMessageModel, timeout: number,ackCheck: (resHex:string) => boolean,retry?: number,allowTransactionHistory?:boolean): Promise<string | undefined>;

	/**
	 * 订阅设备消息回复.消息会以回调messageArrivedCallback的方式传递出去
	 */
	notify(model: BleNotifyModel): Promise<string | void>;
}
