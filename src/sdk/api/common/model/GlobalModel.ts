import { MqttClient } from 'mqtt-expand'


declare global {
  type $TSFixed = any
  
  type Protocol = 'ws' | 'wss' | 'mqtt' | 'mqtts'

  type PayloadType = 'Plaintext' | 'Base64' | 'JSON' | 'Hex' 

  type QoS = 0 | 1 | 2

  type RetainHandling = 0 | 1 | 2

  type QoSList = [0, 1, 2]

  type RetainHandlingList = [0, 1, 2]

  type ProtocolMap = {
    [key in ProtocolOption]: string
  }

  type CertType = '' | 'server' | 'self'

  type MqttVersion = '3.1.1' | '5.0'

  enum ProtocolOption {
    ws = 'ws',
    wss = 'wss',
    mqtt = 'mqtt',
    mqtts = 'mqtts',
  }

  type MessageType = 'all' | 'received' | 'publish'


  type NameCallBack = (name: string) => string


  interface QueueEntity{
    /**
     * 消息体
     */
    payload:string

    /**
     * 消息接收时间
     */
    receiveTime:Date
  }
  // Vuex state
  interface ActiveConnection {
    [id: string]: {
      client: MqttClient
      subscriptions?: SubscriptionModel[]
    }
  }

  // Connections
  interface Client {
    readonly id: string
    client: Partial<MqttClient>
  }

  interface Message {
    readonly id: string
    message: MessageModel
  }

  interface ClientInfo {
    readonly id: string
    showClientInfo: boolean
  }

  interface Subscriptions {
    readonly id: string
    subscriptions: SubscriptionModel[]
  }

  interface UnreadMessage {
    readonly id: string
    unreadMessageCount?: 0
    increasedCount?: number
  }

  interface SubscriptionModel {
    id?: string
    topic: string
    qos: QoS
    disabled: boolean
    alias?: string
    retain?: boolean
    color?: string
    createAt: string
    // MQTT 5.0 only
    nl?: boolean
    rap?: boolean
    rh?: RetainHandling
    subscriptionIdentifier?: number | null
  }

  interface MessageModel {
    id?: string
    createAt: string
    out: boolean
    payload: string
    qos: QoS
    retain: boolean
    topic: string
    color?: string
    properties?: PushPropertiesModel
    meta?: string
  }

  interface MessagePaginationModel {
    list: MessageModel[]
    total: number
    publishedTotal: number
    receivedTotal: number
    limit: number
    page: number
  }

  interface HistoryMessageHeaderModel {
    connectionId?: string
    id?: string
    retain: boolean
    topic: string
    qos: QoS
    createAt?: string
  }

  interface HistoryMessagePayloadModel {
    connectionId?: string
    id?: string
    payload: string
    payloadType: string
    createAt?: string
  }

  interface SSLPath {
    rejectUnauthorized?: boolean
    ALPNProtocols?: string | null
    ca: string
    cert: string
    key: string
  }

  // MQTT 5 feature
  interface WillPropertiesModel {
    willDelayInterval?: number | null
    payloadFormatIndicator?: boolean | null
    messageExpiryInterval?: number | null
    contentType?: string | null
    responseTopic?: string | null
    correlationData?: string | Buffer | null
    userProperties?: { [key: string]: string | string[] } | null
  }

  interface WillModel {
    id?: string
    lastWillTopic: string
    lastWillPayload: string
    lastWillQos: QoS
    lastWillRetain: boolean
    properties?: WillPropertiesModel
  }

  interface MqttConnectionModel extends SSLPath,ConnectAbstract{
    readonly id?: string
    clientId: string
    name: string
    clean: boolean
    protocol?: Protocol
    createAt: string
    updateAt: string
    host: string
    port: number
    keepalive: number
    connectTimeout: number
    reconnect: boolean
    reconnectPeriod: number
    username: string
    password: string
    path: string
    certType?: CertType
    ssl: boolean
    mqttVersion: string
    unreadMessageCount: number
    messages: MessageModel[]
    subscriptions: SubscriptionModel[]
    will?: WillModel
    clientIdWithTime?: boolean
    parentId?: string | null
    isCollection: false
    orderId?: number
    properties?: ClientPropertiesModel
	
	/**
	 * 数据完整性校验
	 */
	checkFun?:(data:string)=>boolean,
  }


  // MQTT 5 feature
  interface ClientPropertiesModel {
    sessionExpiryInterval?: number | null
    receiveMaximum?: number | null
    maximumPacketSize?: number | null
    topicAliasMaximum?: number | null
    requestResponseInformation?: boolean | null
    requestProblemInformation?: boolean | null
    userProperties?: { [key: string]: string | string[] } | null
    authenticationMethod?: string | null
    authenticationData?: Buffer | null
  }

  interface PushOptions {
    qos?: QoS
    retain?: boolean
    dup?: boolean
    properties?: PushPropertiesModel
  }

  // MQTT 5 feature
  interface PushPropertiesModel {
    payloadFormatIndicator?: boolean | null
    messageExpiryInterval?: number | null
    topicAlias?: number | null
    responseTopic?: string | null
    correlationData?: string | Buffer | null
    userProperties?: { [key: string]: string | string[] } | null
    subscriptionIdentifier?: number | null
    contentType?: string | null
  }

  interface SSLContent {
    ca: string | string[] | Buffer | Buffer[] | undefined
    cert: string | string[] | Buffer | Buffer[] | undefined
    key: string | string[] | Buffer | Buffer[] | undefined
  }

  interface ConnectionTreeState {
    id: string
    expanded: boolean
  }

  interface ConnectionTreeStateMap {
    [id: string]: {
      expanded: boolean
    }
  }

  type LogLevel = 'debug' | 'info' | 'warn' | 'error'
  
  /**
   * 定义回调通用返回类型
   */
  interface MqttConnectCallbak{
      //连接id
      id?:string,
  
      //连接名称
      name?:string
	  
	  //信息
	  data?:string
  
      //mqtt的消息回复
      msgArrived?: MessageModel
  }
  
  export type MqttCallbackType = (data: MqttConnectCallbak) => void;
  
  interface ConnectAbstract{
  }
  
  
  // ble model
  interface BleOptions{
	  /**
	   * 连接超时时间
	   */
	  connectTimeout?:number|15000
	  
	  /**
	   * 是否自动重连
	   */
	  reConnect:boolean | true
	  
	  /**
	  * mtu协调次数。在连接后触发mtu协调值最大次数
	  */
	  mtuCoordinateNum : number | 3
	  
    /**
     * 消息发送间隔。和上次发送数据的间隔时长
     */
    sendMsgInterval : number|100
  }
  
	interface BleConnectModel extends ConnectAbstract{
		/**
		* 设备ID
		*/
		deviceId: string
		
		/**
		 * 帧头(大小写不敏感)
		 */
		frameHeader:string,
		
		/**
		 * 帧尾(大小写不敏感)
		 */
		frameTail:string,
		
		/**
		 * 数据完整性校验
		 */
		checkFun?:(data:string)=>boolean,
		
		
	}
  
  interface BleDevice {
	/**
	 * 扫描序列号（无业务含义，仅用来内部标注是不是最近扫描得到的设备）
	 */
	scanSequence?:string
	  
  	/**
	 * 设备ID
	 */
	deviceId: string
    
	/**
	 * 蓝牙名称[local]
	 */
	localName: string
	
	/**
	 * 信号强度
	 */
    RSSI: number
	
    advertisData: string
	
	/**
	 * 蓝牙名称
	 */
    name: string
    // advertisServiceUUIDs
	
	/**
	 * mtu值。默认20.设备连接并尝试获取连接信息的时候会刷新最新的mtu值。获取时会自动协调mtu最大值
	 */
    mtu: number
	
	/**
	 * 是否已连接
	 */
	connected?:boolean|false
	
	/**
	 * 是否开始自动重连（内部控制属性，无需关注）<br>
	 * 如果是手动断开连接为了防止自动重连再次连上。所以通过次变量进行控制
	 */
	isAutoReConn:boolean|true
	
	/**
	 * 连接中
	 */
	connecting?:boolean|false
	
	/**
	 * 开始连接的时间
	 */
	startConnTime?:Date
	
	/**
	 * 获取mtu协调值的最大次数
	 */
	mtuCoordinateNum?: number| 3,
	
	/**
	 * 是否是从已连接的设备中恢复得到
	 */
	isRecover?:boolean|false
	
	/**
	 * 蓝牙设备的服务与特征。将会在连接的时候获取
	 */
	services?: BleService[]
  }
  
  interface BleAdapterStateModel{
	  /**
	   * 状态码
	   */
	  status:string,
	  
	  /**
	   * 状态消息
	   */
	  message:string,
	  
	  /**
	   * 适配器是否可用
	   */
	  available:boolean,
	  
		/**
		 * 是否开启自动发现(设备扫描)
		 */
	  discovering:boolean,
  }
  
  export type BleDiscoverListType = (data: BleDevice[]) => void;
  
  export type onScanType = () => void;
  
  
  interface BleConnectCallbak{
	/**
	* 设备ID
	*/
	deviceId?: string
	
	/**
	 * 是否成功
	 */
	success?:boolean|true
	
	/**
	 * 原生插件返回的消息
	 */
	data?:any
	
	/**
	 * 返回的订阅消息
	 */
	notifyMsg?:string
  }
  
  export type BleCallbackType = (data: BleConnectCallbak) => void;

  interface BleStateConnectCallbak{
    /**
    * 设备ID
    */
    deviceId: string
    
    /**
     * 连接状态
     */
    connected:boolean
    
    }
    
    export type BleStateConnectCallbakType = (data: BleStateConnectCallbak) => void;
  
  /**
   * 蓝牙服务
   */
  interface BleService{
	  
	isPrimary:boolean
	
	uuid:string
	
	characteristics?:Characteristic[]
	
  }
  
  /**
   * 特征属性
   */
  interface CharacteristicProperties{
	  read: boolean,
	  indicate: boolean,
	  write: boolean,
	  notify: boolean
	  writeNoResponse:boolean
	  signedWrite:boolean
  }
  
  /**
   * 特征
   */
  interface Characteristic{
	uuid:string
	properties:CharacteristicProperties
  }
  
	interface BleMessageModel {
		/**
		 * 设备ID
		 */
		deviceId:string,
		
		/**
		 * 服务UUID
		 */
		serviceId:string,
		
		/**
		 * 特征UUID（注意向低功耗蓝牙设备特征值中写入二进制数据。注意：必须设备的特征值支持 write 才可以成功调用。）
		 */
		characteristicId:string
		
		/**
		 * 数据荷载
		 */
		value:string
		
		/**
		 * 数据类型
		 */
		payloadType:PayloadType|'Hex'

    /**
     * MTU值
     */
    mtu?:number

    /**
     * 写入类型:write|writenoresponse
     */
    writeType?:string|''

    /**
     * 单次发送数据的最大字节数。不设置的话默认读取设备mtu-10值
     */
    maxTrans?:number
	}
	
	interface BleNotifyModel {
		/**
		 * 设备ID
		 */
		deviceId:string,
		
		/**
		 * 服务UUID
		 */
		serviceId:string,
		
		/**
		 * 特征UUID（注意向低功耗蓝牙设备特征值中写入二进制数据。注意：必须设备的特征值支持 write 才可以成功调用。）
		 */
		characteristicId:string
		
		/**
		 * 数据类型
		 */
		payloadType:PayloadType|'Hex'
	}

  interface Advertising{
    /**
     * 设备类型
     */
    deviceType:string,

    /**
     * mac地址
     */
    macAddress: Array<string>,

    /**
     * 屏幕蓝牙配对码
     */
    screenPairingCode:string,

    /**
     * 充电器蓝牙配对吗
     */
    chargerPairingCode:string,
  }
}