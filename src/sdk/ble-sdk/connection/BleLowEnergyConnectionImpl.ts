import {} from '../../api/common/model/GlobalModel';
import { log, CircularQueue } from '../../api/common/utils';
import { BleConnectionInterface } from '../../api/BleConnectionInterface';

export class BleLowEnergyConnectionImpl implements BleConnectionInterface {
	constructor(bleOptions: BleOptions) {
		this.bleOptions = bleOptions;
		//开启蓝牙监听
		this.initListener();
	}

	private stopScanCallback?: onScanType;
	private startScanCallback?: onScanType;

	private discoverCallback?: BleDiscoverListType;
	private connectCallback?: BleCallbackType; // 存储连接成功的回调
	private errorCallback?: BleCallbackType; // 存储连接错误的回调
	private reconnectCallback?: BleCallbackType; // 存储重连的回调
	private disconnectCallback?: BleCallbackType; // 存储断开连接的回调
	private offlineCallback?: BleCallbackType; // 存储离线的回调
	private messageArrivedCallback?: BleCallbackType; // 存储消息的回调
	private adapterStateChangeCallback?: BleCallbackType; // 存储蓝牙适配器状态变化的回调
	private bleStateChangeCallback?:BleStateConnectCallbakType;//设备状态变化回调

	onStopScan(callback: onScanType): void {
		this.stopScanCallback = callback;
	}
	onStartScan(callback: onScanType): void {
		this.startScanCallback = callback;
	}
	onDeviceDiscover(callback: BleDiscoverListType): void {
		this.discoverCallback = callback;
	}
	onReConnect(callback: BleCallbackType): void {
		this.reconnectCallback = callback;
	}
	onConnect(callback: BleCallbackType): void {
		this.connectCallback = callback;
	}
	onError(callback: BleCallbackType): void {
		this.errorCallback = callback;
	}
	onDisconnect(callback: BleCallbackType): void {
		this.disconnectCallback = callback;
	}
	onOffline(callback: BleCallbackType): void {
		this.offlineCallback = callback;
	}
	onMessageArrived(callback: BleCallbackType): void {
		this.messageArrivedCallback = callback;
	}
	onAdapterStateChange(callback: BleCallbackType): void {
		this.adapterStateChangeCallback = callback;
	}
	onBLEStateChange(callback: BleCallbackType): void {
		this.bleStateChangeCallback = callback;
	}

	private ble = uni.requireNativePlugin('sand-plugin-bluetooth-ace');

	private scanSequence = ''; //最近一次扫描的序列号。在停止扫描后，序列号不是这个值的设备会被移除
	private bleOptions: BleOptions;
	private connectModel: BleConnectModel;
	private deviceList: BleDevice[] = [];
	private deviceMap: Map<string, number> = new Map();

	/**
	 * 获取已发现的设备
	 */
	public getDiscoverDevices(): BleDevice[] {
		return JSON.parse(JSON.stringify(this.deviceList)); // 深拷贝后返回。不允许其它地方修改
	}

	/**
	 * 获取指定设备ID的已发现设备
	 */
	public getDiscoverDevicesById(deviceId: string): BleDevice | undefined {
		const device = this.deviceList.find((device) => device.deviceId === deviceId);
		return device ? JSON.parse(JSON.stringify(device)) : undefined; // 深拷贝后返回
	}

	/**
	 * 断开指定设备的连接
	 * @param deviceId 设备 ID
	 * @returns 成功断开连接返回 true，失败返回 false
	 */
	public async disconnect(deviceId: string): Promise<boolean> {
		let result = false;
		try {
			//修改缓存中设备连接状态
			let devIndex = this.deviceMap[deviceId];
			if (devIndex >= 0) {
				let dev = this.deviceList[devIndex];
				if (dev.isRecover != undefined && dev.isRecover) {
					return false;
				} else {
					dev.connected = false;
					dev.connecting = false;
					dev.isAutoReConn = false; //关闭设备自动重连。否则关闭不掉设备
					this.updateDevice(dev);
				}
			}

			// 移除自动重连
			await new Promise<void>((resolve) => {
				this.ble.removeAutoReconnect({ deviceId: deviceId }, (res: any) => {
					log.debug('[移除连接] [removeAutoReconnect]' + `[deviceId:${deviceId}]` + JSON.stringify(res));
					resolve(); // 无论成功或失败，继续执行关闭连接
				});
			});

			// 关闭设备连接
			await new Promise<void>((resolve, reject) => {
				this.ble.closeBLEConnection({ deviceId: deviceId }, (res2: any) => {
					log.debug('[关闭连接] [closeBLEConnection]' + `[deviceId:${deviceId}]` + JSON.stringify(res2));

					if (res2.status == "2500") {
						result = true;
						if (this.offlineCallback) {
							this.offlineCallback({
								deviceId: deviceId
							});
						}
						resolve(); // 关闭成功
					} else {
						reject('关闭连接失败'); // 关闭失败
					}
				});
			});
		} catch (error) {
			let errorLog = `[断开连接失败] [deviceId:${deviceId}]` + error;
			log.error(errorLog);
			if (this.errorCallback) {
				this.errorCallback({
					deviceId: deviceId,
					success: false,
					data: errorLog
				});
			}
		}

		if (this.disconnectCallback) {
			this.disconnectCallback({ deviceId: deviceId, success: result });
		}
		return result;
	}

	/**
	 * 连接到指定的蓝牙设备
	 * @param bleDeviceEntity 要连接的蓝牙设备实体
	 * @returns 成功连接返回 true，失败返回 false
	 */
	public async connect(bleConnectEntity: BleConnectModel): Promise<boolean> {
		this.connectModel = bleConnectEntity;
		const deviceId = bleConnectEntity.deviceId;

		try {
			// 停止扫描
			this.stopScan();

			// 开始连接蓝牙设备
			const connectResult = await new Promise<boolean>((resolve, reject) => {
				//判断当前要连接的蓝牙设备是否在缓存中。如果没有则说明被渲染的设备列表比较陈旧，为防止后续数据不一致带来的更新问题。将排除这种连接请求
				//如果是恢复的设备那也不允许连接。通讯底层没有持有蓝牙具柄，无法做任何操作，包括断开连接
				let devIndex = this.deviceMap[deviceId];
				if (devIndex < 0) {
					resolve(false); // 连接失败，返回 false
				} else {
					let dev = this.deviceList[devIndex];
					if (dev.isRecover != undefined && dev.isRecover) {
						resolve(false); // 连接失败，返回 false
					} else {
						//设置设备连接状态：正在连接中
						dev.connecting = true;
						dev.startConnTime = new Date();
						this.updateDevice(dev);
												
						this.ble.createBLEConnection({ deviceId: deviceId }, (res: any) => {
							log.debug('[创建连接] [createBLEConnection]' + `[deviceId:${deviceId}]` + JSON.stringify(res));
							if (res.status == "2500") {
								resolve(true); // 连接成功，返回 true
							} else {
								resolve(false); // 连接失败，返回 false
							}
						});
					}
				}
			});

			// 成功连接后加入自动重连（不影响最终返回结果）
			if (connectResult && this.bleOptions.reConnect) {
				this.ble.addAutoReconnect({ deviceId: deviceId }, (res2: any) => {
					if (res2.status == '2500') {
						log.debug('[加入自动重连] [addAutoReconnect]' + `[deviceId:${deviceId}]` + JSON.stringify(res2));
					} else {
						log.warn('[加入自动重连失败] [addAutoReconnect]' + `[deviceId:${deviceId}]` + JSON.stringify(res2)); //无法加入自动重连，反向设置重连属性为关闭
						this.bleOptions.reConnect = false;
					}
				});
			}

			return connectResult;
		} catch (error) {
			let errorLog = `[连接失败] [deviceId:${deviceId}]` + error;
			log.error(errorLog);
			if (this.errorCallback) {
				this.errorCallback({
					deviceId: deviceId,
					success: false,
					data: log
				});
			}

			return false; // 捕获异常，返回 false
		}
	}

	/**
	 * 添加一个设备
	 */
	private addFindDeviceByOne(dev: BleDevice): void {
		if (!dev) return;
		let list: BleDevice[] = [...this.deviceList];

		dev.scanSequence = this.scanSequence;
		//去重
		if (this.deviceMap[dev.deviceId] >= 0) {
			let index = this.deviceMap[dev.deviceId];
			//更新
			list.splice(index, 1, dev);
		} else {
			//新增
			//新增前给设备补充缺省属性
			if (!dev.mtu) dev.mtu = 20;
			if (dev.connected == undefined) dev.connected = false;
			if (dev.isAutoReConn == undefined) dev.isAutoReConn = true;
			if (dev.connecting == undefined) dev.connecting = false;

			list.push(dev);
			this.deviceMap[dev.deviceId] = list.length - 1;
		}

		this.deviceList = list;

		// 通知回调更新设备列表
		if (this.discoverCallback) {
			this.discoverCallback(this.deviceList);
		}
	}

	/**
	 * 添加发现的设备到缓存中
	 */
	private addFindDevice(devices: BleDevice[]): void {
		if (!devices) return;
		let list: BleDevice[] = [...this.deviceList];
		for (let i = 0; i < devices.length; i++) {
			let dev = devices[i];
			dev.scanSequence = this.scanSequence;
			//去重
			if (this.deviceMap[dev.deviceId] >= 0) {
				let index = this.deviceMap[dev.deviceId];
				//更新
				list.splice(index, 1, dev);
			} else {
				//新增
				//新增前给设备补充缺省属性
				if (!dev.mtu) dev.mtu = 20;
				if (dev.connected == undefined) dev.connected = false;
				if (dev.isAutoReConn == undefined) dev.isAutoReConn = true;
				if (dev.connecting == undefined) dev.connecting = false;

				list.push(dev);
				this.deviceMap[dev.deviceId] = list.length - 1;
			}
		}
		this.deviceList = list;

		// 通知回调更新设备列表
		if (this.discoverCallback) {
			this.discoverCallback(this.deviceList);
		}
	}

	/**
	 * 移除过期设备。在停止扫描后，列表一次性删除不是本次搜索得到的设备。保证设备列表的数据是最新的
	 */
	private removeExpiresDevice(): void {
		let list: BleDevice[] = [...this.deviceList];
		let updatedDeviceMap: Map<string, number> = new Map(); // 重新维护 deviceMap

		for (let i = 0; i < list.length; i++) {
			let device = list[i];
			// 如果设备未连接切 设备的scanSequence 和当前的 scanSequence 不相等，移除设备
			if (!device.connected && device.scanSequence !== this.scanSequence) {
				list.splice(i, 1);
				i--; // 由于 splice 移除了元素，数组长度减1，需要调整索引
				console.log('移除设备' + device.name);
			} else {
				// 保留设备并维护 deviceMap
				updatedDeviceMap[device.deviceId] = i;
			}
		}

		this.deviceList = list;
		this.deviceMap = updatedDeviceMap; // 更新 deviceMap 映射

		// 通知回调更新设备列表
		if (this.discoverCallback) {
			this.discoverCallback(this.deviceList);
		}
	}

	/**
	 * 更新设备列表
	 */
	private updateDevice(device: BleDevice): void {
		if (!device) return;
		// 检查 deviceList 中是否已存在该设备
		const existingDeviceIndex = this.deviceList.findIndex((d) => d.deviceId === device.deviceId);

		if (existingDeviceIndex !== -1) {
			// 更新 deviceList 中已存在的设备
			this.deviceList[existingDeviceIndex] = { ...this.deviceList[existingDeviceIndex], ...device };
		} else {
			// 如果没有找到，则将新设备添加到列表中
			this.deviceList.push(device);
		}

		let updatedDeviceMap: Map<string, number> = new Map(); // 重新维护 deviceMap
		let list: BleDevice[] = [...this.deviceList];
		for (let i = 0; i < list.length; i++) {
			let device = list[i];
			// 保留设备并维护 deviceMap
			updatedDeviceMap[device.deviceId] = i;
		}

		this.deviceMap = updatedDeviceMap; // 更新 deviceMap 映射
		// 通知回调更新设备列表
		if (this.discoverCallback) {
			this.discoverCallback(this.deviceList);
		}
	}

	//十六进制字符串转数组
	private hex2Bytes(hexStr: string): Array<number> {
		var pos: number = 0;
		var len = hexStr.length;
		if (len % 2 != 0) {
			return null;
		}
		len /= 2;
		var hexA = new Array<number>();
		for (var i = 0; i < len; i++) {
			var s = hexStr.substr(pos, 2);
			var v = parseInt(s, 16);
			hexA.push(v);
			pos += 2;
		}
		return hexA;
	}

	/**
	 * 开启蓝牙监听
	 */
	private initListener(): void {
		//适配器监听
		this.ble.onBluetoothAdapterStateChange({}, (res) => {
			log.debug('[适配器监听][onBluetoothAdapterStateChange]' + JSON.stringify(res));
			if (res.status == '2500') {
				if (res.available == false) {
					//停止扫描
					this.stopScan();

					//蓝牙适配器关闭后清空数据
					this.scanSequence = '';
					this.deviceList = [];
					this.deviceMap = new Map();
				}

				if (this.adapterStateChangeCallback) {
					this.adapterStateChangeCallback({
						success: res.available,
						data: res
					});
				}
			}
		});
		//发现设备监听
		this.ble.onBluetoothDeviceFound({}, (res) => {
			// log.debug('[发现了设备][onBluetoothDeviceFound]'+JSON.stringify(res));
			if (res.status == '2500') {
				let devices: BleDevice[] = JSON.parse(res.devices);
				this.addFindDevice(devices);
			}
		});
		//监听设备连接监听
		this.ble.onBLEConnectionStateChange({}, (res) => {
			log.debug('[设备连接状态][onBLEConnectionStateChange]' + JSON.stringify(res));

			let deviceId = res.deviceId;
			let connected = res.connected;

			if(this.bleStateChangeCallback){//回调通知
				this.bleStateChangeCallback({deviceId,connected})
			}

			let dev = this.deviceList[this.deviceMap[deviceId]];
			if (dev) {
				dev.connected = connected;
				dev.scanSequence = this.scanSequence; //防止断开后 设备就消失了
				dev.connecting = false;
				dev.startConnTime = new Date()
				this.updateDevice(dev);
			}

			//连接成功，获取服务和订阅特征
			if (connected == true) {
				if (this.connectCallback) {
					this.connectCallback({
						deviceId: deviceId
					});
				}
				this.getDeviceDetail(deviceId);
			} else {
				//如果设备信息缓存存在并且开启了断线重连，则设置设备为连接中
				let devIndex = this.deviceMap[deviceId];
				if (devIndex >= 0) {
					let dev = this.deviceList[devIndex];
					//是否开启了自动重连。如果是手动断开连接为了防止自动重连再次连上。所以通过次变量进行控制.
					//不允许恢复的设备进行断线重连
					if ((dev.isAutoReConn == undefined || dev.isAutoReConn == true) && (dev.isRecover == undefined || dev.isRecover == false)) {
						log.debug(`[触发重连]${dev.deviceId}`);
						dev.connecting = true;
						dev.startConnTime = new Date();
						this.updateDevice(dev);

						//触发断线重连的回调
						if (this.reconnectCallback) {
							this.reconnectCallback({
								deviceId: deviceId
							});
						}
					}
				}

				//触发离线回调
				if (this.offlineCallback) {
					this.offlineCallback({
						deviceId: deviceId
					});
				}
			}
		});

		//监听特征数据
		this.ble.onBLECharacteristicValueChange({}, (res) => {
			log.debug('[特征数据监听][onBLECharacteristicValueChange]' + '十六进制值:' + res.value);
			let value = res.value;
			//处理分包数据
			this.handleBluetoothData(value, res.deviceId);
		});

		//打开适配器
		this.ble.openBluetoothAdapter({}, (res) => {
			log.debug('[打开适配器]' + '[openBluetoothAdapter]' + JSON.stringify(res));
		});

		//恢复已经连接的设备
		this.getConnected();

		// 连接超时的设备轮询出来并断开连接
		setInterval(() => {
			const currentTime = new Date();
			this.deviceList.forEach((device) => {
				if ((device.isRecover == undefined || device.isRecover == false) && device.connecting) {
					const timeDiff = currentTime.getTime() - device.startConnTime.getTime();
					if (timeDiff > this.bleOptions.connectTimeout) {
						device.connecting = false;
						device.connected = false;
						this.disconnect(device.deviceId);
					}
				}
			});
		}, 100); // 每 100 毫秒轮询一次
	}

	/**
	 * 蓝牙数据存在复杂的拆包黏包问题。此方法是把单次拆/黏的包通过帧头和帧尾分割成数组后再处理
	 */
	private splitOncePackageData(content: string, frameHead: string, frameTail: string): string[] {
	  const result: string[] = [];
	  let start = 0;

	  while (start < content.length) {
		const headIndex = content.indexOf(frameHead, start);

		if (headIndex === -1) {
		  // 如果没有找到帧头，直接将剩余部分加入结果
		  result.push(content.slice(start));
		  break;
		}

		// 如果在start和headIndex之间有内容，先将这部分内容加入结果
		if (headIndex > start) {
		  result.push(content.slice(start, headIndex));
		}

		const tailIndex = content.indexOf(frameTail, headIndex + frameHead.length);

		if (tailIndex !== -1) {
		  // 找到完整的包
		  const completePacket = content.slice(headIndex, tailIndex + frameTail.length);
		  result.push(completePacket);
		  start = tailIndex + frameTail.length;
		} else {
		  // 找到帧头但没有帧尾，保存剩下的部分
		  result.push(content.slice(headIndex));
		  break;
		}
	  }

	  return result;
	}

	// 使用环形队列存储没有来得及消费的消息
	private msgsBox: Map<string, CircularQueue<QueueEntity>> = new Map();
	// 用一个对象来存储每个设备的 incompleteData
	private incompleteDataMap: { [deviceId: string]: string } = {};

	/**
	 * 处理蓝牙数据分包
	 * @param data 新接收到的数据(Hex)
	 * @param deviceId 设备ID
	 */
	private handleBluetoothData(data: string, deviceId: string): void {
		// 将接收到的数据转换为小写，忽略大小写
		const lowerCaseData = data.toLowerCase();
		
		const frameHeader = this.connectModel.frameHeader.toLowerCase()
		const frameTail = this.connectModel.frameTail.toLowerCase()
		
		// 初始化设备的 incompleteData，如果它不存在
		if (!this.incompleteDataMap[deviceId]) {
			this.incompleteDataMap[deviceId] = '';
		}
		
		let splitPackages:string[] = this.splitOncePackageData(lowerCaseData,frameHeader,frameTail)
		if(splitPackages && splitPackages.length>0){
			splitPackages.forEach(item=>{
				// 通过帧头判断新来的数据是否是一个新包的开始
				if (item.startsWith(frameHeader)) {
					// 如果之前有未完成的包，丢弃它
					this.incompleteDataMap[deviceId] = '';
				}
				
				// 拼接数据
				this.incompleteDataMap[deviceId] += item;
				
				// 通过帧尾检查是否已经接收到完整的包
				if (this.incompleteDataMap[deviceId].endsWith(frameTail)) {
					//校验数据
					if (this.connectModel.checkFun) {
						if (!this.connectModel.checkFun(this.incompleteDataMap[deviceId])) {
							log.error('[数据校验失败][handleBluetoothData]' + this.incompleteDataMap[deviceId]);
							// 删除该设备的缓存，避免内存浪费
							delete this.incompleteDataMap[deviceId];
							return
						}
					}
					
					
					//构建返回数据
					let msgData: BleConnectCallbak = {
						deviceId: deviceId,
						success: true,
						notifyMsg: this.incompleteDataMap[deviceId]
					};
				
					//数据放入环形队列等待被消费
					let restoreCircularQueue: CircularQueue<QueueEntity> = this.msgsBox[deviceId];
					if (!restoreCircularQueue) {
						restoreCircularQueue = new CircularQueue<QueueEntity>(100);
					}
					restoreCircularQueue.enqueue({
						payload:msgData.notifyMsg,
						receiveTime:new Date()
					});
					this.msgsBox[deviceId] = restoreCircularQueue;
					// 回调完整的数据包
					if (this.messageArrivedCallback) {
						this.messageArrivedCallback(msgData);
					}
				
				
					// 删除该设备的缓存，避免内存浪费
					delete this.incompleteDataMap[deviceId];
				}		
			})
		}
	}

	/**
	 * 从环形队列获取消息
	 * @param timeout 获取消息的超时时间 毫秒。最大值30000
	 */
	private async getMessageFromQueue(deviceId: string, timeout: number): Promise<QueueEntity | undefined> {
		if (timeout > 30000) timeout = 30000;
		const interval = 10; // 每10毫秒检查一次
		const maxTries = timeout / interval; // 最多尝试次数

		return new Promise((resolve) => {
			let tries = 0;
			const intervalId = setInterval(() => {
				let restoreCircularQueue: CircularQueue<QueueEntity> = this.msgsBox[deviceId];
				let message = undefined;
				if (restoreCircularQueue) {
					message = restoreCircularQueue.dequeue();
				}
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

	/**
	 * 开始扫描
	 */
	public startScan(): void {
		this.ble.startBluetoothDevicesDiscovery({}, (res) => {
			this.scanSequence = Math.random().toString(32).substring(2, 10);
			log.debug('[开始扫描]' + '[startBluetoothDevicesDiscovery]' + JSON.stringify(res));
			if (this.startScanCallback) {
				this.startScanCallback();
			}
		});
	}
	//停止扫描
	public stopScan(): void {
		this.ble.stopBluetoothDevicesDiscovery({}, (res) => {
			this.removeExpiresDevice();
			log.debug('[停止扫描]' + '[stopBluetoothDevicesDiscovery]' + JSON.stringify(res));

			if (this.stopScanCallback) {
				this.stopScanCallback();
			}
		});
	}

	/**
	 * 获取设备详细信息
	 */
	private getDeviceDetail(deviceId: string): void {
		let thit = this;
		// 获取服务列表
		this.ble.getBLEDeviceServices({ deviceId: deviceId }, (res) => {
			if (res.status == '2500') {
				log.debug('[获取服务]' + '[getBLEDeviceServices]' + res.services);
				let services: BleService[] = JSON.parse(res.services);

				// 优化后的遍历服务逻辑，使用循环代替递归
				let index = 0;

				const getNextService = () => {
					if (index < services.length) {
						let service = services[index];

						thit.ble.getBLEDeviceCharacteristics(
							{
								deviceId: deviceId,
								serviceId: service.uuid
							},
							(res2: any) => {
								log.debug('[获取特征]' + '[getBLEDeviceCharacteristics]' + JSON.stringify(res2));
								let characteristics: Characteristic[] = JSON.parse(res2.characteristics);
								service.characteristics = characteristics;

								index++; // 处理完当前服务后递增 index，获取下一个服务
								getNextService(); // 继续获取下一个服务
							}
						);
					}
				};

				// 开始获取第一个服务的特征
				getNextService();

				//更新设备服务和特征到已经设备中
				let devIndex = this.deviceMap[deviceId];
				let dev = this.deviceList[devIndex];
				dev.services = services;
				this.updateDevice(dev);

				this.getConnected();
			} else {
				log.error('[获取服务失败]' + '[getBLEDeviceServices]' + JSON.stringify(res));
			}
		});
	}

	/**
	 * 获取已连接的所有设备
	 * 此操作会让设备和连接设备之间的MTU协调到最大值。此处需要将MTU回写到设备列表
	 * 注意：Android设备或性能较差的设备可能需要多次获取才能获取到最新值。建议调用方尝试多次间隔调用。MTU不为20即为协调后的最大值
	 */
	public async getConnected(): Promise<BleDevice[]> {
		return new Promise((resolve, reject) => {
			this.ble.getConnectedBluetoothDevices({}, (res) => {
				if (res.status == '2500') {
					log.debug('[获取已连接] [getConnectedBluetoothDevices]' + JSON.stringify(res));
					let devices: BleDevice[] = JSON.parse(res.devices);

					//从全局Device中再次获取设备。并更新mtu值

					//判定是否已经存在与缓存。存在则合并mtu关键信息，否则添加
					for (let i = 0; i < devices.length; i++) {
						let item = devices[i];

						let devIndex = this.deviceMap[item.deviceId];
						if (devIndex >= 0) {
							//存在
							let globalDev = this.deviceList[devIndex];

							globalDev.mtu = item.mtu;
							this.addFindDeviceByOne(globalDev); // 更新
						} else {
							//不存在
							log.debug('[设备状态恢复] [getConnected]' + item.name);
							let newDev: BleDevice = {
								scanSequence: this.scanSequence,
								deviceId: item.deviceId,
								localName: item.localName,
								RSSI: item.RSSI,
								advertisData: item.advertisData,
								name: item.name,
								mtu: item.mtu,
								connected: true,
								isAutoReConn: true,
								connecting: false,
								startConnTime: new Date(),
								mtuCoordinateNum: 3,
								isRecover: true
							};

							this.addFindDeviceByOne(newDev); // 新增
						}
					}

					// 从缓存中获取最新已连接的设备
					let result: BleDevice[] = [];
					for (let i = 0; i < devices.length; i++) {
						result.push(this.getDiscoverDevicesById(devices[i].deviceId));
					}

					resolve(result); // 成功时返回设备列表
				} else {
					resolve([]);
				}
			});
		});
	}

	/**
	 * 获取蓝牙适配器状态
	 */
	public async getBleStatus(): Promise<BleAdapterStateModel> {
		return new Promise((resolve, reject) => {
			this.ble.getBluetoothAdapterState({}, (res) => {
				if (res) {
					// log.debug("[获取适配器状态] [getBluetoothAdapterState]"+ JSON.stringify(res));
					let bleAdapterStateModel: BleAdapterStateModel = res;
					resolve(bleAdapterStateModel); // 成功时返回适配器状态
				} else {
					reject('无法获取适配器状态');
				}
			});
		});
	}

	/**
	 * 主动读数据
	 */
	async readMessage(message: BleMessageModel): Promise<string | void> {
		log.debug('[尝试读数据] [readBLECharacteristicValue]' + JSON.stringify(message));
		return new Promise((resolve, reject) => {
			this.ble.readBLECharacteristicValue(message, (res) => {
				log.debug('[主动读响应] [writeBLECharacteristicValue]' + JSON.stringify(res));
				if (res.status == '2500') {
					this.handleBluetoothData(res.value, res.deviceId);
					resolve(res);
				} else {
					reject(res);
				}
			});
		});
	}

    private lastSendTime: number = 0; // 上次调用的时间

	/**
	 * 发送简单消息。不需要任何校验，支持分包处理（直接处理HEX字符串）
	 * @param message 包含设备ID、服务UUID、特征UUID、数据荷载的对象
	 */
	async publishMessage(message: BleMessageModel): Promise<string | void> {
		let { deviceId, serviceId, characteristicId, value, maxTrans } = message;

		// 参数校验
		if (!deviceId) {
			return Promise.reject(new Error("设备ID不能为空"));
		}
		if (!serviceId) {
			return Promise.reject(new Error("服务UUID不能为空"));
		}
		if (!characteristicId) {
			return Promise.reject(new Error("特征UUID不能为空"));
		}
		if (!value || typeof value !== "string" || !/^[0-9a-fA-F]+$/.test(value)) {
			return Promise.reject(new Error("数据荷载必须为有效的HEX字符串"));
		}
		if (!maxTrans || maxTrans <= 0) {
			let devIndex = this.deviceMap[deviceId];
			if (devIndex >= 0) {
				let dev = this.deviceList[devIndex];
				maxTrans = dev.mtu-10
			}else{
				return Promise.reject(new Error("设备不存在"));
			}
		}

		const currentTime = Date.now();
		const timeSinceLastCall = currentTime - this.lastSendTime;

		// 如果距离上次调用少于sendMsgInterval ms，则等待
		if (timeSinceLastCall < this.bleOptions.sendMsgInterval) {
			await new Promise(resolve => setTimeout(resolve, this.bleOptions.sendMsgInterval - timeSinceLastCall));
		}

		// 更新上次调用时间
		this.lastSendTime = Date.now();

		log.debug('[尝试写数据] [writeBLECharacteristicValue]' + JSON.stringify(message));

		// 分包处理（直接切割HEX字符串）
		const totalLength = value.length;
		const chunks: string[] = [];
		for (let i = 0; i < totalLength; i += maxTrans * 2) {
			chunks.push(value.substring(i, i + maxTrans * 2)); // 每次截取 maxTrans * 2 个字符（每字节2个HEX字符）
		}

		// 逐包发送
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];

			await new Promise<void>((resolve, reject) => {
				this.ble.writeBLECharacteristicValue({
					deviceId,
					serviceId,
					characteristicId,
					value: chunk, // 直接发送分包HEX字符串
					writeType:message.writeType
				}, (res) => {
					if (res) {
						resolve();
					} else {
						reject(new Error(`分包 ${i + 1} 写入失败`));
					}
				});
			});

		}

		return "写入成功";
	}


	/**
	 * 发送消息并等待返回，支持重试机制
	 */
	async publishMessageWait(
		message: BleMessageModel, 
		timeout: number, 
		ackCheck: (resHex: string) => boolean, 
		retry: number = 0,
		allowTransactionHistory:boolean = false
	): Promise<string | undefined> {
		// 记录开始时间
		const pollingInterval = 10;
		let attempts = 0;

		while (attempts <= retry) {
			// 发送数据
			await this.publishMessage(message);
			const startTime = Date.now();

			while (Date.now() - startTime < timeout) {
				const receivedMessage = await this.getMessageFromQueue(message.deviceId, timeout - (Date.now() - startTime));

				if(receivedMessage == undefined){
					break
				}else if (receivedMessage !== undefined && ackCheck(receivedMessage.payload)
				) {
					if(allowTransactionHistory){//允许消费历史数据
						return receivedMessage.payload;
					}else if(!allowTransactionHistory && receivedMessage.receiveTime.getTime() > startTime){//不允许消费历史数据，并且时间校验后发现 不是历史数据后也返回
						return receivedMessage.payload;
					}
				}

				// 等待20毫秒后再获取数据
				await new Promise((resolve) => setTimeout(resolve, pollingInterval));
			}

			// 重试次数增加
			attempts += 1;
		}

		log.debug('超时无响应数据');
		// 超时或重试结束返回 undefined
		return undefined;
	}


	/**
	 * 订阅设备消息回复.消息会回调messageArrivedCallback
	 */
	notify(model: BleNotifyModel): Promise<string | void> {
		return new Promise((resolve, reject) => {
			this.ble.notifyBLECharacteristicValueChange(
				{
					deviceId: model.deviceId,
					serviceId: model.serviceId,
					characteristicId: model.characteristicId
				},
				(res) => {
					log.debug('[订阅] [notifyBLECharacteristicValueChange]' + JSON.stringify(res));
					if (res.status == '2500') {
						resolve(res);
					} else {
						resolve(res);
					}
				}
			);
		});
	}
}
