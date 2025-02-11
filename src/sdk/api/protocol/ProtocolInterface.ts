export interface ProtocolInterface {

	/**
	 * 获取协议列表
	 * @param forceRefresh 
	 */
	list(forceRefresh: boolean): Promise<SelectProtocol[]> 

	/**
	 * 获取协议体
	 * @param protocolMD5 
	 * @param versionNum 
	 */
	get(md5: string, versionNum: string,packetConfigType:string):ChildProtocol | undefined

	/**
	 * 清空协议缓存。若出现协议和服务器不一致的情况下则调用此方法清理
	 */
	cleanStore():void

	/**
	 * 获取制定类型的协议包配置.主要用于获取CRC校验方式
	 * @param md5 
	 * @param packetConfigType 
	 * @returns 
	 */
	getPacketConfig(md5: string,packetConfigType:string):PacketConfig
	
	/**
	 * 构建批量读指令
	 */
	buildBulkReadCommand(protocolMD5:string,versionNum:string,packetConfigType:string,code:string):BuildSendResult
	
	/**
	 * 构建下发指令
	 */
	buildCommand(protocolMD5:string,versionNum:string,packetConfigType:string,fun:string,code:string,value:string):BuildSendResult

	/**
	 * 获取下发的指令定义
	 * @param protocolMD5 
	 * @param versionNum 
	 * @param packetConfigType 
	 * @param fun 
	 * @param code 
	 */
	getCommandDefine(protocolMD5:string,versionNum:string,packetConfigType:string,fun:string,code: string) : CommandDetail|undefined

	/**
	 * 手动构建一个Hex指令
	 * @param prefix 帧头
	 * @param suffix 帧尾
	 * @param funcCode 功能码
	 * @param registCode 寄存器地址
	 * @param payload 载荷
	 * @param needCrc 是否需要CRC校验
	 * @returns 
	 */
	manualPackageCommand(prefix:string,suffix:string,funcCode:string,registCode:string,payload:string,needCrc:boolean):string

	/**
	 * 解析上报的Hex报文<br>
	 * 注意如果解析失败Data中包含的将是Hex报文。解析失败时success是false
	 * @param protocolMD5 主协议MD5
	 * @param versionNum 子协议版本
	 * @param hex Hex字符串原文
	 */
	analyzePackage(protocolMD5:string,versionNum:string,packetConfigType:string,hex: string): AnalyzeSendResult

	/**
	 * 校验Hex报文的功能码和ackFunc是否一致
	 * @param protocolMD5 
	 * @param versionNum 
	 * @param packetConfigType 
	 * @param ackFunc 校验功能码
	 * @param hex 
	 * @param registCode 校验寄存器地址（可选）
	 */
	ackCheck(protocolMD5:string,versionNum:string,packetConfigType:string,ackFunc:string,hex:string,registCode?:string):boolean
	
}