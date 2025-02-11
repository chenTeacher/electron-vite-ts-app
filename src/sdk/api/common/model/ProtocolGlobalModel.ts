export {};
declare global {
	/**
	 * 用于被渲染的Select数据对象
	 */
	interface SelectProtocol {
		/**
		 * 协议名称
		 */
		text: string;

		/**
		 *主协议 MD5
		 */
		md5:string;

		/**
		 * 子协议版本号
		 */
		versionNum:string;
	}

	/**
	 * 从API返回的协议
	 */
	interface ApiProtocol {
		/**
		 * 主协议唯一ID
		 */
		uniqueId: number;

		/**
		 * 协议编码
		 */
		code: string;

		/**
		 * 协议名称
		 */
		name: string;

		/**
		 * 协议文件下载路径
		 */
		downloadUrl: string;

		/**
		 * 文件MD5值
		 */
		md5: string;

		/**
		 * 协议类型 bms|charger|power
		 */
		type:string;
	}

	/**
	 * 用来本地持久化的协议对象
	 */
	interface StoreProtocol extends ApiProtocol {
		mainProtocol: MainProtocol;
	}

	interface PacketConfig{
		/**
		 * 类型。BLE、MQTT、485、CAN等
		 */
		type:string

		/**
		 * 是否需要CRC校验
		 */
		needCrc:boolean

		/**
		 * 帧头
		 */
		prefix:string

		/**
		 * 帧尾
		 */
		suffix:string
	}

	/**
	 * 主协议对象
	 */
	interface MainProtocol {

		/**
		 * 协议编码
		 */
		protocolCode: string;

		/**
		 * 协议名称
		 */
		protocolName: string;

		/**
		 * 数据包配置
		 */
		packetConfigs:Array<PacketConfig>

		/**
		 * 子协议
		 */
		protocols: Map<string,ChildProtocol>;
	}

	/**
	 * 自协议对象
	 */
	interface ChildProtocol {
		/**
		 * 协议所属环境类型<br>
		 * prod:发行版|dev:测试版|pub:公测版
		 */
		env: string;

		/**
		 * 子协议编码
		 */
		code: string;

		/**
		 * 描述
		 */
		desc: string;

		/**
		 * 名称
		 */
		name: string;

		/**
		 * 是否需要crc
		 */
		needCrc?: boolean | false;

		/**
		 * 协议前缀
		 */
		prefix?: string;

		/**
		 * 协议后缀
		 */
		suffix?: string;

		/**
		 * 协议版本号
		 */
		versionNum: string;

		/**
		 * 批量读指令集<br>
		 * key:指令代码<br>
		 * value:BulkReadValue 指令/ACK功能码/指令描述
		 */
		bulkReadCommands: Map<string, BulkReadValue>;

		/**
		 * 上报指令<br>
		 * key:Hex功能码<br>
		 * value:ReportValue 解析类型/功能码/功能描述/通用寄存器功能定义
		 */
		reportDefine: Map<string, ReportValue>;

		/**
		 * 下发指令<br>
		 * key:Hex功能码<br>
		 * value:SendCommandValue 功能码/功能描述/寄存器功能详情
		 */
		sendCommands: Map<string, SendCommandValue>;
	}

	/**
	 * 批量读取指令结构
	 */
	interface BulkReadValue {
		/**
		 * 指令英文Code值
		 */
		key?:string

		/**
		 * ACK功能码
		 * <br><font color=red>（HEX字符串）</font>
		 */
		ackFunc: string;

		/**
		 * 描述
		 */
		define: string;

		/**
		 * 指令
		 * <br><font color=red>（HEX字符串）</font>
		 */
		hex: string;
	}

	/**
	 * 数据上报指令结构对象
	 */
	interface ReportValue {
		/**
		 * 解析类型<br>
		 * general:常规 遵循协议默认解析原则<br>
		 * custom:自定义 复杂报文解析时，需提供解析方法<br>
		 */
		analysisType: string;

		/**
		 *
		 * key:寄存器地址Hex值<br>
		 * value:ReportRegisterValue 数据上报寄存器功能定义
		 */
		details: Map<string, ReportRegisterValue>;

		/**
		 * 功能码
		 * <br><font color=red>（HEX字符串）</font>
		 */
		func: string;

		/**
		 * 功能描述
		 */
		funcName: string;
	}

	/**
	 * 数据上报寄存器功能定义
	 */
	interface ReportRegisterValue {
		/**
		 * 数据类型。如：uint16
		 */
		dataType: string;

		/**
		 * 寄存器地址含义描述
		 */
		define: string;

		/**
		 * 寄存器英文编码。协议范围内全局唯一
		 */
		fieldName: string;

		/**
		 * 数据长度
		 */
		len: number;

		/**
		 * 数据倍数
		 */
		range: number;

		/**
		 * 寄存器地址
		 * <br><font color=red>（HEX字符串）</font>
		 */
		reg: string;

		/**
		 * 寄存器指令排序
		 */
		sort: number;

		/**
		 * 单位
		 */
		unit: string;
	}

	/**
	 * 下发指令
	 */
	interface SendCommandValue {
		/**
		 * 功能码
		 * <br><font color=red>（HEX字符串）</font>
		 */
		func: string;

		/**
		 * 功能说明
		 */
		funcName: string;

		/**
		 * 指令组<br>
		 * key:指令英文代码。协议内全局唯一<br>
		 * value:CommandDetail 指令详情
		 */
		regDetails: Map<string, CommandDetail>;
	}

	/**
	 * 下发指令详情
	 */
	interface CommandDetail {
		/**
		 * 指令英文Code
		 */
		key?:string

		/**
		 * ACK功能码
		 * <br><font color=red>（HEX字符串）</font>
		 */
		ack: string;

		auth: string;

		/**
		 * 单位。如：uint16
		 */
		dataType: string;

		/**
		 * 指令描述
		 */
		define: string;

		/**
		 * 指令
		 * <br><font color=red>（HEX字符串）</font>
		 */
		hex: string;

		/**
		 * 权限
		 */
		level: number;

		/**
		 * 指令范围
		 */
		range: number;

		sort: number;

		/**
		 * 单位
		 */
		unit: string;
	}
	
	/**
	 * 构建发送命令的统一返回结果
	 */
	interface BuildSendResult{
		/**
		 * 是否成功
		 */
		success:boolean
		
		/**
		 * 错误消息
		 */
		message?:string
		
		/**
		 * Hex命令
		 */
		command?:string
		
		/**
		 * ACK功能码(HEX)
		 */
		ack?:string
	}

	interface AnalyzeSendResult{
		/**
		 * 是否成功
		 */
		success:boolean
		
		/**
		 * 错误消息
		 */
		message?:string
		
		/**
		 * 解析后的数据<br>
		 * Key:指令Code<br>
		 * Value<AnalyzeData>:解析结果，若是数值类型，自动做了倍数转换
		 */
		data?:AnalyzeData[]
	}

	/**
	 * Hex格式化后的报文对象
	 */
	interface HexPackage{
		/**
		 * 功能码
		 */
		func:string

		/**
		 * 寄存器地址
		 */
		registCode:string

		/**
		 * 数据长度
		 */
		dataLength:number

		/**
		 * 数据长度Hex格式
		 */
		dataLengthHex:string

		/**
		 * 荷载
		 */
		data:string

		/**
		 * CRC
		 */
		crc:string
	}

	/**
	 * 解析后数据的类型<br>
	 * Hex:表示解析失败，按照荷载Hex原文返回<br>
	 * REAL:表示解析成功，返回的是真实值
	 */
	type AnalyzeDataType = 'HEX' | 'REAL'

	/**
	 * 解析后的单个数据
	 */
	interface AnalyzeData{

		/**
		 * 功能码
		 */
		func:string

		/**
		 * 寄存器英文编码
		 */
		registerFieldName:string
		
		/**
		 * 寄存器含义
		 */
		registerDefine:string

		/**
		 * 数据类型
		 */
		dataType:AnalyzeDataType

		/**
		 * 数据
		 */
		data:string

		/**
		 * 解析前的hex数据
		 */
		hex:string
	}

}
