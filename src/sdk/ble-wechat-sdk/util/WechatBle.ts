import { log, CircularQueue } from '../../api/common/utils';

/**
 * 按照低功耗蓝牙原生插件的封装风格，重新封装微信低功耗蓝牙操作API
 */
export class WechatBle {
    private static STATUS_OK = "2500"; // 表示成功的状态码
    private static STATUS_ERROR = "2400";

    private static connectDeviceServiceIds:Array<{deviceId:string,primaryService:Array<string>}>=[]//用来存储已连接设备主服务uuid

    private static autoReconnectDevicesId:Set<string> = new Set()//加入重连的设备列表
    private static maxReconnectAttempts: number = 5; // 最大重连次数
    private static reconnectInterval: number = 1000; // 重连间隔（毫秒）
    private static reconnectAttempts: Map<string, number> = new Map(); // 记录每个设备的重连次数


    /**
     * 连接低功耗蓝牙设备
     * @param options 
     * @param callback 
     */
    public static createBLEConnection(options: { deviceId: string },callback: (res: {status: string;message?: string;}) => void) {
        const { deviceId } = options;
        const timeout = 10 * 1000; // 10秒超时

        wx.createBLEConnection({
            deviceId,
            timeout,
            success(res) {
                log.debug(`device ${options.deviceId} connect success`)
                callback({
                    status: WechatBle.STATUS_OK, // 成功时返回 "2500"
                });
            },
            fail(res) {
                log.warn(`device ${options.deviceId} connect fail.${res}`)
                callback({
                    status: String(res.errCode), // 将错误码转换为字符串
                    message: res.errMsg, // 错误消息
                });
            },
        });
    }

    /**
     * 断开与低功耗蓝牙设备的连接
     * @param options 
     * @param callback 
     */
    public static closeBLEConnection(options: { deviceId: string }, callback: (res: { status: string; message?: string; }) => void) {
        const { deviceId } = options;
        wx.closeBLEConnection({
            deviceId,
            success(res) {
                log.debug(`device ${options.deviceId} close connect success`);
                
                // 断开连接后删除对应设备的主服务信息
                WechatBle.connectDeviceServiceIds = WechatBle.connectDeviceServiceIds.filter(item => item.deviceId !== deviceId);

                callback({
                    status: WechatBle.STATUS_OK, // 成功时返回 "2500"
                });
            },
            fail(res) {
                log.warn(`device ${options.deviceId} close connect fail. ${res.errMsg}`);
                callback({
                    status: String(res.errCode), // 将错误码转换为字符串
                    message: res.errMsg, // 错误消息
                });
            },
        });
    }

    // 移除断线重连设备
    public static removeAutoReconnect(options: { deviceId: string }, callback: (res: { status: string; message?: string }) => void): void {
        const { deviceId } = options;
        if (this.autoReconnectDevicesId.has(deviceId)) {
            this.autoReconnectDevicesId.delete(deviceId);
            callback({ status: WechatBle.STATUS_OK, message: "设备已从断线重连列表移除" });
        } else {
            callback({ status: WechatBle.STATUS_ERROR, message: "设备不在断线重连列表中" });
        }
    }
    

    // 添加断线重连设备
    public static addAutoReconnect(options: { deviceId: string }, callback: (res: { status: string; message?: string }) => void): void {
        const { deviceId } = options;
        
        if (!deviceId) {
            callback({ status: WechatBle.STATUS_ERROR, message: "设备ID不能为空" });
            return;
        }

        if (this.autoReconnectDevicesId.has(deviceId)) {
            callback({ status: WechatBle.STATUS_ERROR, message: "设备已在断线重连列表中" });
        } else {
            this.autoReconnectDevicesId.add(deviceId);
            callback({ status: WechatBle.STATUS_OK, message: "设备已添加到断线重连列表" });
        }
    }

    // 断线重连具体实现
    private static reconnect(deviceId: string) {
        // 查询设备是否在自动重连列表中
        if (!WechatBle.autoReconnectDevicesId.has(deviceId)) {
            return;
        }
        log.debug("即将重连的设备是否存在："+WechatBle.autoReconnectDevicesId.has(deviceId))

        // 初始化重连次数
        if (!WechatBle.reconnectAttempts.has(deviceId)) {
            WechatBle.reconnectAttempts.set(deviceId, 0);
        }

        // 设备未连接，检查重连次数
        let attempts = WechatBle.reconnectAttempts.get(deviceId) || 0;
        if (attempts >= WechatBle.maxReconnectAttempts) {
            // 达到最大重连次数，移除设备并清除记录
            WechatBle.autoReconnectDevicesId.delete(deviceId);
            WechatBle.reconnectAttempts.delete(deviceId);
            log.warn(`设备 ${deviceId} 达到最大重连次数，停止重连。`);
            return;
        }

        // 尝试重连
        WechatBle.createBLEConnection({ deviceId }, (res2) => {
            if (res2.status === WechatBle.STATUS_OK) {
                log.debug("连接成功，清除重连记录")
                // 连接成功，清除重连记录
                WechatBle.reconnectAttempts.delete(deviceId);
            } else {
                // 增加重连次数并延迟重试
                log.debug("增加重连次数并延迟重试")
                WechatBle.reconnectAttempts.set(deviceId, attempts + 1);
                setTimeout(() => WechatBle.reconnect(deviceId), WechatBle.reconnectInterval);
            }
        });
    
    }

    //监听蓝牙适配器状态变化事件
    public static onBluetoothAdapterStateChange(options: {},callback: (res: {status: string;available:boolean,discovering:boolean}) => void) {
        wx.onBluetoothAdapterStateChange(function (res) {
            log.debug('adapterState changed, now is'+ res)
            callback({
                status: WechatBle.STATUS_OK,
                available:res.available,
                discovering:res.discovering
            })
        })
    }

    /**
     * 监听寻找到新设备的事件
     * @param callback 
     */
    public static onBluetoothDeviceFound(options: {},callback: (res: {status: string;devices:Array<BleDevice>}) => void) {
        wx.onBluetoothDeviceFound(function(res) {
            var devices = res.devices;
            callback({
                status: WechatBle.STATUS_OK,
                devices:WechatBle.devicesTransition(devices)
            })
        })
    }

    /**
     * 设备列表转换成全局兼容的BleDevice类型
     * @param wechatDevice 
     * @returns 
     */
    private static devicesTransition(wechatDevice:Array<any>):Array<BleDevice>{
        let result :Array<BleDevice> =[] 
        wechatDevice.forEach(item=>{
            result.push({
                deviceId: item.deviceId,
                localName: item.localName,
                RSSI: item.RSSI,
                advertisData: WechatBle.ab2hex(item.advertisData),
                name: item.name,
                mtu: 20,
                isAutoReConn:item.connectable
            })
        })
        return result
    }

    /**
     * 监听低功耗蓝牙连接状态的改变事件。包括开发者主动连接或断开连接，设备丢失，连接异常断开等等
     * @param callback 
     */
    public static onBLEConnectionStateChange(options: {},callback: (res: {status: string,deviceId:string,connected:boolean}) => void) {
        wx.onBLEConnectionStateChange(function(res) {
            log.debug(`device ${res.deviceId} state has changed, connected: ${res.connected}`)
            //如果是断开连接则触发断线重连
            if(res.connected==false){
                WechatBle.reconnect(res.deviceId)
            }
            callback({
                status: WechatBle.STATUS_OK,
                deviceId:res.deviceId,
                connected:res.connected
            })
        })
    }

    /**
     * ArrayBuffer转16进制字符串
     * @param buffer 
     * @returns 
     */
    private static ab2hex(buffer) {
        let hexArr = Array.prototype.map.call(
            new Uint8Array(buffer),
            function(bit) {
            return ('00' + bit.toString(16)).slice(-2)
            }
        )
        return hexArr.join('');
    }

    /**
     * Hex字符串转ArrayBuffer
     * @param hexString 
     * @returns 
     */
    private static hex2ab(hexString: string): ArrayBuffer {
        // 去除所有空格
        let cleanedHexString = hexString.replace(/\s+/g, '');
        
        // 创建一个长度为字节数的ArrayBuffer
        let buffer = new ArrayBuffer(cleanedHexString.length / 2);
        let dataView = new Uint8Array(buffer);

        // 每两个字符代表一个字节，转换为Uint8
        for (let i = 0; i < cleanedHexString.length; i += 2) {
            dataView[i / 2] = parseInt(cleanedHexString.substr(i, 2), 16);
        }

        return buffer;
    }


    /**
     * 监听低功耗蓝牙设备的特征值变化事件
     * @param callback 
     */
    public static onBLECharacteristicValueChange(options: {},callback: (res: {
        status: string,
        deviceId:string,
        serviceId:string,
        characteristicId:string,
        value:string,
    }) => void) {

        wx.onBLECharacteristicValueChange(function(res) {
            callback({
                status: WechatBle.STATUS_OK,
                deviceId:res.deviceId,
                serviceId:res.serviceId,
                characteristicId:res.characteristicId,
                value:WechatBle.ab2hex(res.value),
            })
        })
    }

    /**
     * 初始化蓝牙模块
     * @param callback 
     */
    public static openBluetoothAdapter(options: {},callback: (res: {
        status: string,
        message?:string,
    }) => void) {
        wx.openBluetoothAdapter({
            complete(res){
                let status = WechatBle.STATUS_OK
                if(res.errCode!=0){
                    status = String(res.errCode)
                }
                callback({
                    status: status,
                    message:res.errMsg
                })
            }
        })
    }
    
    /**
     * 开始搜寻附近的蓝牙外围设备
     * @param callback 回调函数，返回状态和信息
     */
    public static startBluetoothDevicesDiscovery(
        options: {},
        callback: (res: { status: string; message?: string }) => void
    ) {
        // 检查定位权限和服务
        this.checkLocationPermissionAndService(
            () => {
                // 用户同意授权并定位服务开启后，开始搜索蓝牙设备
                wx.openBluetoothAdapter({
                    success() {
                        wx.startBluetoothDevicesDiscovery({
							interval:5,//上报设备的间隔
                            allowDuplicatesKey:true,//是否允许上报重复的设备
                            powerLevel:'high',
                            success(res) {
                                callback({ status: WechatBle.STATUS_OK, message: res.errMsg });
                            },
                            fail(err) {
                                callback({ status: String(err.errCode), message: err.errMsg });
                            },
                        });
                    },
                    fail(err) {
                        callback({ status: String(err.errCode), message: "蓝牙初始化失败：" + err.errMsg });
                    },
                });
            },
            (errMsg) => {
                // 定位权限或服务未通过
                callback({ status: "error", message: errMsg });
            }
        );
    }

    /**
     * 检查用户定位权限和系统定位服务是否开启
     * @param onSuccess 权限和服务正常后的回调
     * @param onError 权限或服务异常时的回调
     */
    private static checkLocationPermissionAndService(onSuccess: () => void, onError: (errMsg: string) => void) {
        // 检查权限设置
        wx.getSetting({
            success(res) {
                if (!res.authSetting["scope.userLocation"]) {
                    // 请求授权
                    wx.authorize({
                        scope: "scope.userLocation",
                        success() {
                            // 授权成功后检查定位服务
                            WechatBle.checkLocationService(onSuccess, onError);
                        },
                        fail() {
                            // 用户拒绝授权
                            wx.showModal({
                                title: "提示",
                                content: "蓝牙功能需要地理位置权限，请前往设置开启。",
                                success(modalRes) {
                                    if (modalRes.confirm) {
                                        wx.openSetting({
                                            success(settingRes) {
                                                if (settingRes.authSetting["scope.userLocation"]) {
                                                    // 用户重新授权成功
                                                    WechatBle.checkLocationService(onSuccess, onError);
                                                } else {
                                                    onError("用户未授权地理位置权限");
                                                }
                                            },
                                        });
                                    } else {
                                        onError("用户取消授权");
                                    }
                                },
                            });
                        },
                    });
                } else {
                    // 已授权，检查定位服务
                    WechatBle.checkLocationService(onSuccess, onError);
                }
            },
            fail() {
                onError("无法获取权限设置");
            },
        });
    }

    /**
     * 检查系统定位服务是否开启
     * @param onSuccess 定位服务正常后的回调
     * @param onError 定位服务异常时的回调
     */
    private static checkLocationService(onSuccess: () => void, onError: (errMsg: string) => void) {
        wx.getLocation({
            type: "wgs84",
            success() {
                // 定位服务正常
                onSuccess();
            },
            fail(err) {
                // 定位服务未开启
                wx.showModal({
                    title: "提示",
                    content: "请确保系统定位服务已开启。",
                    success() {
                        onError("系统定位服务未开启");
                    },
                });
            },
        });
    }


    /**
     * 停止搜寻附近的蓝牙外围设备
     * @param callback 
     */
    public static stopBluetoothDevicesDiscovery(options: {},callback: (res: {
        status: string,
        message?:string,
    }) => void) {
        wx.stopBluetoothDevicesDiscovery({
            complete (res) {
                let status = WechatBle.STATUS_OK
                if(res.errCode!=0){
                    status = String(res.errCode)
                }
                callback({
                    status: status,
                    message:res.errMsg
                })
            }
        })
    }

    /**
     * 获取蓝牙设备所有服务
     * @param options 
     * @param callback 
     */
    public static getBLEDeviceServices(
        options: { deviceId: string },
        callback: (res: {
            status: string;
            message?: string;
            services?:Array<{
                uuid:string,
                isPrimary:boolean
            }
            >
        }) => void
    ) {
        const { deviceId } = options;
        wx.getBLEDeviceServices({
            // 这里的 deviceId 需要已经通过 wx.createBLEConnection 与对应设备建立连接
            deviceId,
            success(res) {
                // 过滤出 isPrimary 为 true 的服务，并提取其 UUID
                const primaryService = res.services
                    .filter((service: any) => service.isPrimary === true)
                    .map((service: any) => service.uuid);
            
                // 查找是否已经有该设备的记录
                const existingDevice = WechatBle.connectDeviceServiceIds.find(item => item.deviceId.toLowerCase() === deviceId.toLowerCase());
            
                if (existingDevice) {
                    // 如果已经存在，则覆盖主服务ID
                    existingDevice.primaryService = primaryService;
                } else {
                    // 如果不存在，添加新记录
                    WechatBle.connectDeviceServiceIds.push({ deviceId, primaryService });
                }
            
                // 继续回调逻辑
                callback({
                    status: WechatBle.STATUS_OK,
                    message: res.errMsg,
                    services: res.services
                });
            },
            fail(res){
                callback({
                    status: String(res.errCode), 
                    message: res.errMsg, 
                });
            }
        })
    }

    //获取蓝牙低功耗设备某个服务中所有特征
    public static getBLEDeviceCharacteristics(
        options: { deviceId: string ,serviceId:string},
        callback: (res: {
            status:string,
            message:string,
            characteristics?:any
        }) => void
    ){
        const {deviceId,serviceId} = options
        wx.getBLEDeviceCharacteristics({
            // 这里的 deviceId 需要已经通过 wx.createBLEConnection 与对应设备建立链接
            deviceId,
            // 这里的 serviceId 需要在 wx.getBLEDeviceServices 接口中获取
            serviceId,
            success(res){
                callback({
                    status: WechatBle.STATUS_OK,
                    message:res.errMsg,
                    characteristics:res.characteristics
                })
            },
            fail(res){
                callback({
                    status: String(res.errCode),
                    message:res.errMsg,
                })
            }
          })

    }

    /**
     * 获取已连接的设备列表
     * @param options 
     * @param callback 
     */
    public static getConnectedBluetoothDevices(
        options: {}, callback: (res: {
            status: string,
            message: string,
            devices?: Array<BleDevice>
        }) => void
    ) {
        // 获取所有已连接设备的主服务 ID 并去重
        const services = Array.from(new Set(WechatBle.connectDeviceServiceIds.flatMap(item => item.primaryService)));

        wx.getConnectedBluetoothDevices({
            services,
            success(res) {
                callback({
                    status: WechatBle.STATUS_OK,
                    message: res.errMsg,
                    devices: WechatBle.devicesTransition(res.devices)
                });
            },
            fail(res) {
                callback({
                    status: String(res.errCode),
                    message: res.errMsg,
                });
            }
        });
    }


    /**
     * 获取蓝牙适配器最新状态
     * @param options 
     * @param callback 
     */
    public static getBluetoothAdapterState(options: {},callback: (res: {
	  status:string,
	  message:string,
	  available:boolean,
	  discovering:boolean,
    }) => void) {
        wx.getBluetoothAdapterState({
            success (res) {
                let available=res.available
                let discovering =res.discovering
                //如果是开发者工具调试，则参数获取略有不同
                if(res.adapterState){
                    available=res.adapterState.available
                    discovering =res.adapterState.discovering
                    //如果电源关闭则可用状态切换成false
                    if(!res.adapterState.powered)available=false
                }
                callback({
                    status: WechatBle.STATUS_OK, 
                    message: res.errMsg, 
                    available:available,
                    discovering:discovering,
                });
            },
            fail(res){
                callback({
                    status: String(res.errCode), 
                    message: res.errMsg, 
                    available:false,
                    discovering:false,
                });
            }
        })
    }

    /**
     * 读取低功耗蓝牙设备的特征值的二进制数据值
     * @param options 
     * @param callback 
     */
    public static readBLECharacteristicValue(
        options: {
            deviceId:string,
            serviceId:string,
            characteristicId:string
        },
        callback: (res: {
            status:string,
            message:string,
            value:string
        }) => void) {
            const {deviceId,serviceId,characteristicId} = options
            wx.readBLECharacteristicValue({
                // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
                deviceId,
                // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
                serviceId,
                // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
                characteristicId,
                success (res) {
                    callback({
                        status: WechatBle.STATUS_OK,
                        message:res.errMsg,
                        value:WechatBle.ab2hex(res.value),
                    })
                }
            })
    }

    /**
     * 向低功耗蓝牙设备特征值中写入二进制数据，支持分包发送
     * @param options 
     * @param callback 
     */
    public static writeBLECharacteristicValue(
        options: {
            deviceId: string,
            serviceId: string,
            characteristicId: string,
            value: string,
            mtu?: number // 可选的 MTU，默认值为 20
            writeType?:string,
            maxTrans?:number //单次发送数据的最大字节数
        },
        callback: (res: {
            status: string,
            message: string,
        }) => void
    ) {

        let { deviceId, serviceId, characteristicId, value, mtu = 20,writeType = 'write',maxTrans} = options;

        //设置单包一次最大传输字节数
		if (!maxTrans || maxTrans <= 0) {
            maxTrans = mtu-10
		}else if(maxTrans>mtu){
            maxTrans = mtu-10
        }

        const valueArrayBuffer = WechatBle.hex2ab(value);
        const totalPackets = Math.ceil(valueArrayBuffer.byteLength / maxTrans);
        let wxWriteType = 'writeNoResponse';
        if (writeType.toLowerCase().trim() === 'write') {
            wxWriteType = 'write';
        } else if (writeType.toLowerCase().trim() === 'writenoresponse') {
            wxWriteType = 'writeNoResponse';
        }

        const sendPacket = (index: number) => {
            if (index >= totalPackets) {
                // 全部发送成功
                callback({ status: WechatBle.STATUS_OK, message: "All packets sent successfully" });
                return;
            }

            const start = index * maxTrans;
            const end = Math.min(start + maxTrans, valueArrayBuffer.byteLength);
            const packet = valueArrayBuffer.slice(start, end);

            wx.writeBLECharacteristicValue({
                deviceId,
                serviceId,
                characteristicId,
                value: packet,
                wxWriteType,
                success: () => {
                    // 发送下一包
                    sendPacket(index + 1);
                },
                fail: (res) => {
                    // 发送失败，终止发送
                    callback({ status: String(res.errCode), message: res.errMsg });
                }
            });
        };

        // 从第一包开始发送
        sendPacket(0);
    }

    /**
     * 启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值
     * @param options 
     * @param callback 
     */
    public static notifyBLECharacteristicValueChange(
        options: {
            deviceId:string,
            serviceId:string,
            characteristicId:string,
        },
        callback: (res: {
            status:string,
            message:string,
        }) => void
    ) {
        const {deviceId,serviceId,characteristicId} = options
        wx.notifyBLECharacteristicValueChange({
            state: true, // 启用 notify 功能
            // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
            deviceId,
            // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
            serviceId,
            // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
            characteristicId,
            complete (res) {
                log.debug('notifyBLECharacteristicValueChange complete'+res.errMsg)
                let status = WechatBle.STATUS_OK
                if(res.errCode!=0){
                    status = String(res.errCode)
                }
                callback({
                    status: status,
                    message:res.errMsg
                })
            }
        })

    }

    /**
     * 取消订阅
     * @param options 
     * @param callback 
     */
    public static cancelNotifyBLECharacteristicValueChange(
        options: {
            deviceId:string,
            serviceId:string,
            characteristicId:string,
        },
        callback: (res: {
            status:string,
            message:string,
        }) => void
    ) {
        const {deviceId,serviceId,characteristicId} = options
        wx.notifyBLECharacteristicValueChange({
            state: false, // 取消 notify 功能
            // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
            deviceId,
            // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
            serviceId,
            // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
            characteristicId,
            complete (res) {
                log.debug('notifyBLECharacteristicValueChange complete'+ res.errMsg)
                let status = WechatBle.STATUS_OK
                if(res.errCode!=0){
                    status = String(res.errCode)
                }
                callback({
                    status: status,
                    message:res.errMsg
                })
            }
        })
    }

    /**
     * 协调mtu
     * @param options 
     * @param callback 
     * <br>
     * 逻辑是:进来就setmtu 如果设置失败或者成功后得到的mtu是等于20的则200毫秒后重新获取。重新获取的最大次数是3次，三次后无论成功失败都调用getmtu方法获取mtu。最终以getmtu的方法为准，获取不到则返回20
     */
    public static async coordinateBLEMTU(
        options: {
            deviceId: string;
        },
        callback: (res: {
            status: string;
            message: string;
            value: number;
        }) => void
    ) {
        const { deviceId } = options;
        const maxRetries = 3; // 最大重试次数
        const maxMTU = 512; // 最大 MTU 值
        const defaultMTU = 20; // 默认 MTU 值
    
        // 封装 wx.setBLEMTU 成为 Promise
        const setBLEMTU = (mtu: number): Promise<number> => {
            return new Promise((resolve, reject) => {
                wx.setBLEMTU({
                    deviceId,
                    mtu,
                    success: (res) => resolve(res.mtu || defaultMTU),
                    fail: (err) => reject(err),
                });
            });
        };
    
        // 封装 wx.getBLEMTU 成为 Promise
        const getBLEMTU = (): Promise<number> => {
            return new Promise((resolve, reject) => {
                wx.getBLEMTU({
                    deviceId,
                    success: (res) => resolve(res.mtu || defaultMTU),
                    fail: () => resolve(defaultMTU), // 获取失败返回默认值
                });
            });
        };
    
        // 设置 MTU 的重试逻辑
        const retrySetMTU = async (): Promise<number> => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const mtu = await setBLEMTU(maxMTU);
                    if (mtu !== defaultMTU) {
                        return mtu; // 成功设置且不为默认值，直接返回
                    }
                    await new Promise((r) => setTimeout(r, 200)); // 延迟 200ms
                } catch (err) {
                    console.error(`设置 MTU 第 ${attempt} 次失败:`, err);
                    if (attempt === maxRetries) {
                        break; // 达到最大重试次数直接退出
                    }
                    await new Promise((r) => setTimeout(r, 200)); // 延迟 200ms
                }
            }
            return defaultMTU; // 重试失败后返回默认值
        };
    
        // 主流程逻辑
        try {
            //如果不是ios设备那么可以尝试设置mtu。ios设备不支持
            const deviceInfo = wx.getDeviceInfo()
            if(!deviceInfo.platform||deviceInfo.platform.toLowerCase()!='ios'){
                await retrySetMTU();
            }
            
            const finalMTU = await getBLEMTU(); // 最终以 getBLEMTU 为准
            console.error("协调后的MTU:"+finalMTU)
            callback({
                status: WechatBle.STATUS_OK,
                message: 'MTU 校准完成',
                value: finalMTU,
            });
        } catch (err) {
            console.error('MTU 校准失败:', err);
            callback({
                status: String(err.errCode || 'ERROR'),
                message: `MTU 校准失败: ${err.errMsg || '未知错误'}`,
                value: defaultMTU,
            });
        }
    }
    
    
    
}