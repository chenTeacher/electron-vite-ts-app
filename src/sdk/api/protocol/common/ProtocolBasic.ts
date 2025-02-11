import { log } from '../../common/utils';
import { ProtocolInterface } from '../ProtocolInterface';
import {CalculateCRC16Modbus} from "../../common/utils/CalculateCRC16Modbus"

/**
 * 协议核心实现抽象类
 */
export default abstract class ProtocolBasic implements ProtocolInterface{

    /**
     * 获取协议类型
     */
    public abstract getProtocolType():string;

    /**
     * 本地存储的协议数据
     */
    private static storeProtocols: StoreProtocol[] = [];
    
    /**
     * 从API实时获取协议文件
     */
    private async getListForApi(): Promise<ApiProtocol[]> {

      const apiUrl = "https://api.antbms.com/admin-api/business/protocol/getFormatProtocol";
      try {
        let response: any;

        // 请求体
        const requestBody = {};

        // 检测 uniapp 环境
        if (typeof uni !== "undefined" && uni.request) {
          response = await new Promise((resolve, reject) => {
            uni.request({
              url: apiUrl,
              method: "POST", // 改为 POST 请求
              data: requestBody, // 传递空的花括号作为请求体
              success: (res) => {
                if (res.statusCode === 200) {
                  resolve(res.data);
                } else {
                  reject(new Error(`请求失败，状态码: ${res.statusCode}`));
                }
              },
              fail: (err) => {
                reject(err);
              },
            });
          });
        } else {
          // 普通浏览器环境
          const res = await fetch(apiUrl, {
            method: "POST", // 改为 POST 请求
            headers: {
              "Content-Type": "application/json", // 设置请求头
            },
            body: JSON.stringify(requestBody), // 传递空的花括号作为请求体
          });
          if (!res.ok) {
            throw new Error(`请求失败，状态码: ${res.status}`);
          }
          response = await res.json();
        }
		
        // 检查接口数据
        if (response.code === 0 && Array.isArray(response.data)) {
            return response.data
        } else {
          log.error("API 返回格式不符合预期", response);
          return [];
        }
      } catch (error) {
        log.error("获取协议数据失败:", error);
        return [];
      }
    }

  
    /**
    * 对外提供下载下拉框渲染的数据
    */
    public async list(forceRefresh: boolean = false): Promise<SelectProtocol[]> {
        if (forceRefresh) {
          this.refreshCache();
        }

        if (ProtocolBasic.storeProtocols.length === 0) {
            const apiProtocols: ApiProtocol[] = await this.getListForApi();

            for (const apiProtocol of apiProtocols) {
                const key = `protocol_${apiProtocol.uniqueId}`;
                const localProtocol = await this.fetchLocalProtocol(key);

                // 检查本地是否存在协议
                if (localProtocol) {
                    await this.updateProtocolIfNeeded(apiProtocol, localProtocol, key);
                } else {
                    await this.addNewProtocol(apiProtocol, key);
                }
            }
        }

        return this.getSelectList();
    }
  
    /**
     * 刷新协议缓存
     */
    private refreshCache(): void {
        this.cleanStore();
        ProtocolBasic.storeProtocols = [];
    }

    /**
     * 根据环境决定从 indexedDB 或 uniapp 存储中获取协议
     * @param key 
     * @returns 
     */
    private async fetchLocalProtocol(key: string): Promise<StoreProtocol | undefined> {
        if (typeof uni !== "undefined" && uni.request) {
            return uni.getStorageSync(key) as StoreProtocol; // 从 uniapp 存储获取协议
        } else {
            return await this.getProtocolFromIndexedDB(key); // 从 indexedDB 获取协议
            
        }
    }

    /**
     * 检查协议的 md5 值是否匹配，不匹配则更新并保存
     * @param apiProtocol 
     * @param localProtocol 
     * @param key 
     */
    private async updateProtocolIfNeeded(apiProtocol: ApiProtocol, localProtocol: StoreProtocol, key: string): Promise<void> {
        if (localProtocol.md5.toLowerCase() !== apiProtocol.md5.toLowerCase()) {
            log.debug(`[更新协议]${apiProtocol.name}|${apiProtocol.md5}`);
            try {
                const updatedProtocol = await this.getStoreProtocol(apiProtocol); // 获取更新后的协议
                await this.saveProtocol(key, updatedProtocol); // 保存协议到本地存储
                ProtocolBasic.storeProtocols.push(updatedProtocol); // 更新本地协议列表
            } catch (error) {
                log.error(error); // 记录错误
            }
        } else {
            ProtocolBasic.storeProtocols.push(localProtocol); // 如果 md5 匹配，则直接添加到本地协议列表
        }
    }

    /**
     * 新增协议并存储到 storeProtocols 和本地缓存中
     * @param apiProtocol 
     * @param key 
     */
    private async addNewProtocol(apiProtocol: ApiProtocol, key: string): Promise<void> {
        log.debug(`[新增协议]${apiProtocol.name}|${apiProtocol.md5}`);
        try {
            const newProtocol = await this.getStoreProtocol(apiProtocol); // 获取新协议
            await this.saveProtocol(key, newProtocol); // 保存协议到本地存储
            ProtocolBasic.storeProtocols.push(newProtocol); // 添加到本地协议列表
        } catch (error) {
            log.error(error); // 记录错误
        }
    }

    /**
     * 保存协议到本地存储（根据环境选择存储方式）
     * @param key 
     * @param protocol 
     */
    private async saveProtocol(key: string, protocol: StoreProtocol): Promise<void> {
        if (typeof uni !== "undefined" && uni.request) {
            uni.setStorageSync(key, protocol); // 保存到 uniapp 存储
        } else {
            await this.saveProtocolToIndexedDB(key, protocol); // 保存到 indexedDB
        }
    }
    
    /**
     * 用于被渲染的Select数据
     */
    private getSelectList(): SelectProtocol[] {
        let result: SelectProtocol[] = [];
        ProtocolBasic.storeProtocols.forEach(storeProtocol => {
            //过滤协议类型。控制超类只能获取对应的协议
            if(storeProtocol.type.trim().toUpperCase()== this.getProtocolType().trim().toUpperCase()){
                //协议主体
                let mainProtocol = storeProtocol.mainProtocol as MainProtocol;

                let protocolName = mainProtocol.protocolName;
                // 使用 Object.entries 遍历 protocols 对象
                if (mainProtocol.protocols && typeof mainProtocol.protocols === 'object') {
                    Object.entries(mainProtocol.protocols).forEach(([key, childProtocol]: [string, any]) => {
                        result.push({
                            text: `${protocolName}_${childProtocol.versionNum}(${childProtocol.env})`,
                            md5:storeProtocol.md5,
                            versionNum:childProtocol.versionNum
                        });
                    });
                } else {
                    log.error(`mainProtocol.protocols 不是对象或未定义`+ mainProtocol.protocols);
                }
            }

        });

        return result;
    }


    
    /**
     * 通过 apiProtocol 对象获取 StoreProtocol。方法实现了协议下载的核心功能
     */
    private async getStoreProtocol(apiProtocol: ApiProtocol): Promise<StoreProtocol> {
        try {
            let res: any;
            let mainProtocol:MainProtocol = undefined
            if (typeof uni !== "undefined" && uni.request) {
                // 在 uniapp 环境中使用 uni.request
                res = await uni.request({
                    url: apiProtocol.downloadUrl,
                    method: 'GET'
                });
                    
                log.debug(`[下载协议][结果:${res.statusCode}]${res}`);
                if (res.statusCode !== 200 || !res.data) {
                    throw new Error("Failed to fetch data");
                }
                mainProtocol = res.data as MainProtocol
            } else {
                // 在 Web 环境中使用 fetch
                const response = await fetch(apiProtocol.downloadUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors' // 允许跨域请求
                });
    
                if (!response.ok) {
                    throw new Error(`Failed to fetch data with status ${response.status}`);
                }
    
                res = await response.json();
                log.debug(`[下载协议][web环境成功] URL: ${apiProtocol.downloadUrl}`);
                mainProtocol = res as MainProtocol
            }

            if (typeof mainProtocol ==='string') {
                throw new Error(`[下载的数据不符合 MainProtocol 的结构][getStoreProtocol][${apiProtocol.downloadUrl}]`);
            }
            
            // 构造 storeProtocol 对象
            return {
                uniqueId: apiProtocol.uniqueId,
                name: apiProtocol.name,
                code: apiProtocol.code,
                downloadUrl: apiProtocol.downloadUrl,
                md5: apiProtocol.md5,
                mainProtocol: mainProtocol,
                type:apiProtocol.type
            };
        } catch (error) {
            log.error(`[下载协议失败] URL: ${apiProtocol.downloadUrl}, 错误信息: ${error}`);
            throw error;
        }
    }


    /**
     * 从 indexedDB 中获取协议数据
     */
    private async getProtocolFromIndexedDB(key: string): Promise<StoreProtocol | undefined> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("ProtocolDB", 1);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains("protocols")) {
                    db.createObjectStore("protocols");
                }
            };

            request.onsuccess = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction("protocols", "readonly");
                const store = transaction.objectStore("protocols");
                const getRequest = store.get(key);
                
                getRequest.onsuccess = () => resolve(getRequest.result as StoreProtocol);
                getRequest.onerror = () => reject(getRequest.error);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 将协议数据保存到 indexedDB
     */
    private async saveProtocolToIndexedDB(key: string, protocol: StoreProtocol): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("ProtocolDB", 1);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains("protocols")) {
                    db.createObjectStore("protocols");
                }
            };

            request.onsuccess = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction("protocols", "readwrite");
                const store = transaction.objectStore("protocols");
                const putRequest = store.put(protocol, key);

                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };

            request.onerror = () => reject(request.error);
        });
    }

    
    /**
     * 清空缓存中的协议数据
     */
    public cleanStore() {
        if (typeof uni !== "undefined" && uni.request) {
            const res = uni.getStorageInfoSync();
            res.keys.forEach(key => {
                if (key.toLowerCase().startsWith('protocol_')) {
                    uni.removeStorageSync(key);
                }
            });
        } else {
            const request = indexedDB.open("ProtocolDB", 1);
            request.onsuccess = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction("protocols", "readwrite");
                const store = transaction.objectStore("protocols");
                const clearRequest = store.clear();
            
                clearRequest.onerror = () => log.error(clearRequest.error);
            };
        }
    }

    /**
     * 构建下发指令
     */
    public buildCommand(protocolMD5:string,versionNum:string,packetConfigType:string,fun:string,code: string, input: string): BuildSendResult {
        let result : BuildSendResult =  {success:false}
        try {
            //查找协议
            let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
            if(childProtocol == undefined){
                result.success=false
                result.message = `协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`
                return result
            }

            //查找指令
            let commandDetail:CommandDetail = ProtocolBasic.findCommandDetail(fun,code,childProtocol)

            //组装指令协议
            let command = ProtocolBasic.packageCommand(childProtocol,commandDetail,input,ProtocolBasic.highLowTransition(commandDetail.dataType),false)
            result.command=command
            result.success=true
            result.ack = commandDetail.ack	
        } catch (error) {
            let err = error as Error
            result.message = err.message
        }

        return result
    }

    /**
     * 获取下发的指令定义
     * @param protocolMD5 
     * @param versionNum 
     * @param packetConfigType 
     * @param fun 
     * @param code 
     * @returns 
     */
    public getCommandDefine(protocolMD5:string,versionNum:string,packetConfigType:string,fun:string,code: string) : CommandDetail|undefined{
        let result : BuildSendResult =  {success:false}
        try {
            //查找协议
            let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
            if(childProtocol == undefined){
                log.error(`协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`)
                return undefined
            }

            //查找指令
            let commandDetail:CommandDetail = ProtocolBasic.findCommandDetail(fun,code,childProtocol)
            return commandDetail

            
        } catch (error) {
            let err = error as Error
            result.message = err.message
        }

    }

    /**
     * 构建下发指令
     */
    public buildCommandForHex(protocolMD5:string,versionNum:string,packetConfigType:string,fun:string,code: string, hexInput: string): BuildSendResult {
        let result : BuildSendResult =  {success:false}
        try {
            //查找协议
            let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
            if(childProtocol == undefined){
                result.success=false
                result.message = `协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`
                return result
            }

            //查找指令
            let commandDetail:CommandDetail = ProtocolBasic.findCommandDetail(fun,code,childProtocol)

            //组装指令协议
            let command = ProtocolBasic.packageCommand(childProtocol,commandDetail,hexInput,false,true)
            result.command=command
            result.success=true
            result.ack = commandDetail.ack	
        } catch (error) {
            let err = error as Error
            result.message = err.message
        }

        return result
    }

    /**
     * 根据数据类型推断荷载是否需要高地位互换
     * @param dataType 
     * @returns 
     */
    private static highLowTransition(dataType:string):boolean{
        let result = false
        switch (dataType.toLowerCase()) {
            case "uint8":
                result = true
                break;
            case "uint16":
                result = true
                break;
            case "uint32":
                result = true
                break;
            case "uint64":
                result = true
                break;
            case "int":
                result = true
                break;
            case "long":
                result = true
                break;
            case "byte":
                result = false
                break;
            case "char":
                result = false
                break;
            case "short":
                result = true
                break;
            case "split":
                result = false
                break;
            case "date":
                result = false
                break;
            case "msgpack":
                result = false
                break;
            case "zip_msgpack":
                result = false
                break;
            default:
                result = false
                break;
        }
        log.debug(`[高低位反转][${dataType}][${result}]`)
        return result
    }
    
    /**
     * 构建批量读指令
     */
    public buildBulkReadCommand(protocolMD5:string,versionNum:string,packetConfigType:string,code: string): BuildSendResult {
        let result : BuildSendResult =  {success:false}
        try {
            //查找协议
            let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
            if(childProtocol == undefined){
                result.success=false
                result.message = `协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`
                return result
            }
            //查找指令
            let bulkReadValue:BulkReadValue = ProtocolBasic.findBulkReadCommandDetail(code,childProtocol)
            if(bulkReadValue == undefined){
                result.success=false
                result.message = `指令不存在，请确认指令在[${protocolMD5}][${versionNum}]协议中是否存在`
                return result
            }

            //组装指令协议
            let command = ProtocolBasic.packageBulkReadCommand(childProtocol.prefix,bulkReadValue.hex,childProtocol.needCrc,childProtocol.suffix)
            result.command=command
            result.success=true
            result.ack = bulkReadValue.ackFunc

        } catch (error) {
            let err = error as Error
            result.message = err.message
        }
        
        return result
    }

    /**
     * 构建指令下发Hex包
     * @param prefix 
     * @param useCrc 
     * @param suffix 
     * @param commandDetail 
     * @param input 填充值
     * @param highLowTransition
     * @param isHexInput 填充值是否是Hex。如果是hex则不需要做数据判定、转换和倍数
     */
    private static packageCommand(childProtocol:ChildProtocol,commandDetail:CommandDetail, input: string,highLowTransition:boolean,isHexInput:boolean): string {
        
        let prefix=childProtocol.prefix
        let useCrc=childProtocol.needCrc
        let suffix=childProtocol.suffix

        let fillData = ''
        if(isHexInput){
            fillData = ProtocolBasic.fillPlaceholderForHex(commandDetail.hex,input)
        }else{
            fillData = ProtocolBasic.fillPlaceholder(commandDetail.hex,input,commandDetail.dataType,highLowTransition,commandDetail.range)
        }

        // 构建基础的命令字符串
        let command = `${prefix || ''}${fillData}${suffix || ''}`;
    
        // 如果需要CRC校验，则计算并插入CRC字符串
        if (useCrc) {
            const crcStr = CalculateCRC16Modbus(prefix.replace(/\s+/g, '').slice(2,4) + fillData);
            const crcHighLowSwapped = crcStr.slice(2) + crcStr.slice(0, 2);//高低位转换
            command = `${prefix || ''}${fillData}${crcHighLowSwapped}${suffix || ''}`;
        }
    
        return command.replace(/\s+/g, '');

    }

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
    manualPackageCommand(prefix:string,suffix:string,funcCode:string,registCode:string,payload:string,needCrc:boolean):string{
        let fillData = ''
        if(payload&&payload==''){
            fillData = funcCode+registCode+'00'
        }else{
            fillData = funcCode+registCode+this.decimalToHexString(payload.length/2,2)+payload
        }
        
        if(needCrc){
            const crcStr = CalculateCRC16Modbus(prefix.replace(/\s+/g, '').slice(2,4) + fillData);
            const crcHighLowSwapped = crcStr.slice(2) + crcStr.slice(0, 2);//高低位转换
            return `${prefix || ''}${fillData}${crcHighLowSwapped}${suffix || ''}`.replace(/\s+/g, '');
        }else{
            return fillData.replace(/\s+/g, '')
        }
    }

    private static fillPlaceholderForHex(command: string, hexInput: string): string {
        // 先判断是否有占位符
        const placeholderMatch = command.match(/\{(\d+)\}/);
    
        if (!placeholderMatch) {
            return command;  // 找不到占位符则直接返回 command
        }
        if (hexInput === "" || hexInput === undefined || hexInput === null || Number.isNaN(hexInput)) {
            throw new Error("占位符存在，但输入的字符串为空");
        }
        return command.replace(/\{\d+\}/, hexInput);
    }

    /**
     * 指令填充。将带有占位符的指令填充成为完整的指令
     * @param command 
     * @param input 
     * @param dataType 
     * @param highLowTransition 
     * @param range 倍数
     * @returns 
     */
    private static fillPlaceholder(
        command: string,
        input: string | null, // str 允许为 null 或 undefined
        dataType: string,
        highLowTransition: boolean,
        range: number
    ): string {
        // 判断是否有占位符
        const placeholderMatch = command.match(/\{(\d+)\}/);
        if (!placeholderMatch) {
            return command; // 找不到占位符则直接返回 command
        }
        if (input === "" || input === undefined || input === null || Number.isNaN(input)) {
            throw new Error("占位符存在，但输入的字符串为空");
        }

        let hexStr = "";

        // 数据类型转换
        switch (dataType.toLowerCase()) {
            case "uint8":
                hexStr = Math.floor(parseFloat(input) * range)
                    .toString(16)
                    .padStart(2, "0")
                    .toUpperCase();
                break;

            case "uint16":
                hexStr = Math.floor(parseFloat(input) * range)
                    .toString(16)
                    .padStart(4, "0")
                    .toUpperCase();
                break;

            case "uint32":
                hexStr = Math.floor(parseFloat(input) * range)
                    .toString(16)
                    .padStart(8, "0")
                    .toUpperCase();
                break;

            case "uint64":
                hexStr = (BigInt(Math.floor(parseFloat(input) * range)))
                    .toString(16)
                    .padStart(16, "0")
                    .toUpperCase();
                break;

            case "int":
                const intInput = parseInt(input, 10); // 将输入解析为整数
            
                if (intInput < -2147483648 || intInput > 2147483647) {
                    throw new Error(`输入的 int 值超出范围: ${input}`);
                }
            
                // 处理负数的补码表示
                if (intInput < 0) {
                    hexStr = (intInput >>> 0) // 使用无符号右移将负数转为补码
                        .toString(16)
                        .padStart(8, "0")
                        .toUpperCase();
                } else {
                    // 正数直接转换为十六进制
                    hexStr = intInput
                        .toString(16)
                        .padStart(8, "0")
                        .toUpperCase();
                }
                break;
            case "long":
                const intValue = parseInt(input);
                hexStr = (intValue < 0
                    ? (intValue >>> 0).toString(16) // 处理负数补码
                    : intValue.toString(16))
                    .padStart(8, "0")
                    .toUpperCase();
                break;

            case "byte":
                hexStr = ProtocolBasic.signedIntToHex8(parseInt(input)).toUpperCase();
                break;

            case "char":
                hexStr = Buffer.from(input).toString("hex").toUpperCase();
                break;

            case "short":
                hexStr = ProtocolBasic.signedIntToHex(parseInt(input)).toUpperCase();
                break;

            case "split":
                hexStr = input
                    .split(".")
                    .map(part =>
                        parseInt(part)
                            .toString(16)
                            .padStart(2, "0")
                            .toUpperCase()
                    )
                    .join("");
                break;

            case "date":
                const [datePart, timePart] = input.split(" ");
                const [year, month, day] = datePart.split("-").map(Number);
                const [hour, minute, second] = timePart.split(":").map(Number);

                const yearHex = (year - 2000).toString(16).padStart(2, "0");
                const monthHex = month.toString(16).padStart(2, "0");
                const dayHex = day.toString(16).padStart(2, "0");
                const hourHex = hour.toString(16).padStart(2, "0");
                const minuteHex = minute.toString(16).padStart(2, "0");
                const secondHex = second.toString(16).padStart(2, "0");

                hexStr = `${yearHex}${monthHex}${dayHex}${hourHex}${minuteHex}${secondHex}0000`;
                break;
            case "messagepack":
                try {
                    // 假设 input 是可序列化的对象
                    const msgpack = require('msgpack-lite');
                    const packed = msgpack.encode(JSON.parse(input)); // 序列化为 Buffer
                    hexStr = packed.toString('hex').toUpperCase();   // 转换为十六进制
                } catch (error) {
                    throw new Error(`MessagePack 序列化失败: ${error.message}`);
                }
                break;
                

            default:
                throw new Error(`不支持的数据类型: ${dataType}`);
        }

        // 获取占位符字节长度，并计算对应的 HEX 长度
        const byteLength = parseInt(placeholderMatch[1], 10);
        const hexByteLength = byteLength * 2;

        // 高低位互换
        if (highLowTransition && hexStr.length % 2 === 0) {
            hexStr = hexStr.match(/.{1,2}/g)?.reverse().join("") || hexStr;
        }

        // 填充或截断 HEX 字符串
        let paddedHexStr = hexStr;
        if (hexStr.length < hexByteLength) {
            const padding = "00".repeat((hexByteLength - hexStr.length) / 2);
            paddedHexStr = hexStr + padding; // 填充
        } else if (hexStr.length > hexByteLength) {
            paddedHexStr = hexStr.substring(0, hexByteLength); // 截断
        }

        // 替换占位符为 HEX 字符串
        return command.replace(/\{\d+\}/, paddedHexStr);
    }

  
    
    /**
     * 构建批量指令Hex包
     * @param prefix 
     * @param data 
     * @param useCrc 
     * @param suffix 
     * @returns 
     */
    private static packageBulkReadCommand(prefix: string, data: string, useCrc: boolean, suffix: string): string {
        // 构建基础的命令字符串
        let command = `${prefix || ''}${data}${suffix || ''}`;
    
        // 如果需要CRC校验，则计算并插入CRC字符串
        if (useCrc) {
            const crcStr = CalculateCRC16Modbus(prefix.replace(/\s+/g, '').slice(2,4) + data);
            const crcHighLowSwapped = crcStr.slice(2) + crcStr.slice(0, 2);//高低位转换
            command = `${prefix || ''}${data}${crcHighLowSwapped}${suffix || ''}`;
        }
    
        return command.replace(/\s+/g, '');
    }
    
    /**
     * 获取子协议
     * @param md5 
     * @param versionNum 
     * @param packetConfigType 
     * @returns 
     */
    public get(md5: string, versionNum: string,packetConfigType:string): ChildProtocol | undefined{
        return ProtocolBasic.findProtocolByMD5(md5,versionNum,packetConfigType)
    }

    /**
     * 获取制定类型的协议包配置.主要用于获取CRC校验方式
     * @param md5 
     * @param packetConfigType 
     * @returns 
     */
    public getPacketConfig(md5: string,packetConfigType:string):PacketConfig{
        // 查找符合md5的 StoreProtocol
        let storeProtocol = ProtocolBasic.storeProtocols.find(protocol => protocol.md5 === md5);

        // 如果没有找到符合条件的 StoreProtocol，直接返回 undefined
        if (!storeProtocol) {
            log.error(`[无法获取主协议][findProtocolByMD5][${md5}]`)
            return undefined;
        }

        return storeProtocol.mainProtocol.packetConfigs.find(packetConfig => packetConfig.type===packetConfigType)
    }
    
    /**
     * 根据md5和子版本号查找协议
     */
    public static findProtocolByMD5(md5: string, versionNum: string,packetConfigType:string): ChildProtocol | undefined {
        // 查找符合md5的 StoreProtocol
        let storeProtocol = ProtocolBasic.storeProtocols.find(protocol => protocol.md5 === md5);
        
        // 如果没有找到符合条件的 StoreProtocol，直接返回 undefined
        if (!storeProtocol) {
            log.error(`[无法获取主协议][findProtocolByMD5][${md5}]`)
            return undefined;
        }

        // 查找符合版本号的 ChildProtocol
        let mainProtocol = storeProtocol.mainProtocol;
        let childProtocol:ChildProtocol = Object.entries(mainProtocol.protocols).find(([key, _]) => key === versionNum)?.[1];

        //给协议添加包配置
        let packetConfig:PacketConfig = mainProtocol.packetConfigs.find(config => config.type.toLowerCase() === packetConfigType.toLowerCase())
        if (!packetConfig) {
            log.error(`[无法获取包配置][findProtocolByMD5][${md5}][${versionNum}][${packetConfigType}]`)
            return undefined;
        }
        childProtocol.needCrc = packetConfig.needCrc
        childProtocol.prefix = packetConfig.prefix
        childProtocol.suffix = packetConfig.suffix

        return childProtocol
    }

    /**
     * 根据命令code在协议中查找批量读下发指令
     * @param code 
     * @param protocol 
     * @returns 
     */
    private static findBulkReadCommandDetail(code: string, protocol: ChildProtocol): BulkReadValue {
        const result = Object.entries(protocol.bulkReadCommands)
            .find(([key, _]) => key === code)?.[1];
    
        if (!result) {
            throw new Error(`Bulk read command detail not found for code: ${code}`);
        }
    
        return result;
    }

    /**
     * 根据功能码和命令code在协议中查找下发指令
     * @param func 
     * @param code 
     * @param protocol 
     * @returns 
     */
    private static findCommandDetail(func: string, code: string, protocol: ChildProtocol): CommandDetail {
        // 将功能码和命令code都转换为小写
        const lowerCaseFunc = func.toLowerCase();
        const lowerCaseCode = code.toLowerCase();

        // 查找与功能码对应的指令组
        const sendCommandValue:SendCommandValue = Object.entries(protocol.sendCommands)
            .find(([key]) => key.toLowerCase() === lowerCaseFunc)?.[1];

        // 如果找不到对应的指令组，抛出异常
        if (!sendCommandValue) {
            throw new Error(`send command not found for funcode: ${func}`);
        }

        // 查找与命令code对应的指令详情
        const commandDetail:CommandDetail= Object.entries(sendCommandValue.regDetails)
            .find(([key]) => key.toLowerCase() === lowerCaseCode)?.[1];

        // 如果找不到对应的指令详情，抛出异常
        if (!commandDetail) {
            throw new Error(`send commandDetail not found for code: ${code}`);
        }

        return commandDetail;
    }



    /**
     * 解析上报的Hex报文<br>
     * 注意如果解析失败Data中包含的将是Hex报文。解析失败时success是false
     * @param protocolMD5 主协议MD5
     * @param versionNum 子协议版本
     * @param hex Hex字符串原文
     */
    public analyzePackage(protocolMD5:string,versionNum:string,packetConfigType:string,hex: string): AnalyzeSendResult {
        let result:AnalyzeSendResult = {success:false,data:[]}
        
        //查找协议
        let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
        if(childProtocol == undefined){
            result.success=false
            result.message = `协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`
            return result
        }

        //先把hex解析成HexPackage对象。然后根据HexPackage中的功能码、寄存器地址、数据在协议中寻找解析办法
        let packages:HexPackage[] =ProtocolBasic.unPackage(childProtocol,hex)
        if(packages.length==0){
            result.success=false
            result.message = `无法拆包，请确认Hex报文完整性。HEX:${hex}`
            return result
        }

        //逐个解析HexPackage
        packages.forEach(packet=>{
            let packetData:AnalyzeData[] = ProtocolBasic.AnalyzeHexPackage(packet,childProtocol)
            result.data=result.data.concat(packetData)
        })
        result.success=true
        return result
    }

    /**
     * 根据功能码找到上报协议定义
     * @param func 功能码
     * @param protocol 
     * @returns 
     */
    private static findReportDefine(func: string, protocol: ChildProtocol): ReportValue {
        // 将功能码转换为小写
        const lowerCaseFunc = func.toLowerCase();
    
        // 遍历 protocol.reportDefine，找出与小写功能码匹配的定义
        const reportValue: ReportValue = Object.entries(protocol.reportDefine)
        .find(([key]) => key.toLowerCase() === lowerCaseFunc)?.[1];
    
        if (!reportValue) {
        throw new Error(`report define not found for funcode: ${func}`);
        }
    
        return reportValue;
    }

    /**
     * 根据寄存器地址查找寄存器解释定义
     * @param registCode 
     * @param reportValue 
     * @returns 
     */
    private static findReportRegistValue(registCode: string, reportValue: ReportValue): ReportRegisterValue {
        // 将寄存器代码转换为小写
        const lowerCaseRegistCode = registCode.toLowerCase();
    
        // 遍历 reportValue.details，找出与小写寄存器代码匹配的定义
        const result: ReportRegisterValue = Object.entries(reportValue.details)
        .find(([key]) => key.toLowerCase() === lowerCaseRegistCode)?.[1];
    
        if (!result) {
        throw new Error(`report registvalue not found for funcode: ${reportValue.func} and registCode:${registCode}`);
        }
    
        return result;
    }
  

    /**
     * 拿到批量度指令的后续所有指令
     * @param currentRegister 
     * @param registers 
     * @returns 
     */
    private static findReportRegistValuesBySort(currentRegister: ReportRegisterValue, registers: Map<string,ReportRegisterValue>): ReportRegisterValue[] {
        let result: ReportRegisterValue[] = [];

        // 把第一个元素加进去
        result.push(currentRegister);
        
        // 当前的 sort 值
        let currentSort = currentRegister.sort;
        
        // 使用 Object.entries 来遍历 registers 对象
        Object.entries(registers).forEach(([key, register]) => {
            if (register.sort > currentSort) {
                result.push(register);
            }
        });

        // 按照 sort 字段对结果进行排序
        result.sort((a, b) => a.sort - b.sort);
    
        return result;
    }


    /**
     * 解析单个包
     * @param packet 
     * @param protocol 
     */
    private static AnalyzeHexPackage(packet:HexPackage,protocol:ChildProtocol):AnalyzeData[]{
        let result:AnalyzeData[]= []
        try {
            //查找定义
			console.log('?????????1')
            let reportValue:ReportValue=ProtocolBasic.findReportDefine(packet.func,protocol)
console.log('?????????')
            //根据定义翻译数据
            if(reportValue.analysisType=='general'){
                //根据寄存器地址寻找指令定义
                let currentRegister:ReportRegisterValue=ProtocolBasic.findReportRegistValue(packet.registCode,reportValue)

                //功能码不是FF且实际报文长度packet.dataLength和currentRegister.len不符合，则判定为批量读
                if(reportValue.func.toLowerCase()=='ff'||(reportValue.func.toLowerCase()!='ff'&&packet.dataLength===currentRegister.len)){//单一指令上报
                    //拿到hex数据的原始类型转换和倍数进行除法计算得到最终的值
                    try {
                        let data = ProtocolBasic.convertHexToString(packet.data,currentRegister.dataType,currentRegister.range)
                        result.push({
                            dataType:'REAL',
                            data:data,
                            registerDefine:currentRegister.define,
                            registerFieldName:currentRegister.fieldName,
                            func:reportValue.func,
                            hex:packet.data
                        })
                    } catch (error) {
                        result.push({
                            dataType:'HEX',
                            data:packet.data,
                            registerDefine:currentRegister.define,
                            registerFieldName:currentRegister.fieldName,
                            func:reportValue.func,
                            hex:packet.data
                        })
                    }
                    

                }else{//批量读
                    // 获取寄存器定义并根据 sort 排序后的所有序列
                    let sortedRegisters: ReportRegisterValue[] = ProtocolBasic.findReportRegistValuesBySort(currentRegister, reportValue.details);

                    // 待解析的 Hex 字符串
                    let content = packet.data;

                    // 循环解析 sortedRegisters
                    sortedRegisters.forEach(register => {
                        // 判断是否还有数据需要解析
                        if (content.length === 0) return;

                        // 计算当前寄存器需要解析的 Hex 子串
                        const lenToParse = register.len * 2;
                        const pendingParsing = content.slice(0, lenToParse);

                        // 调用转换方法进行解析
                        try {
                            const data = ProtocolBasic.convertHexToString(pendingParsing, register.dataType, register.range);
                            log.debug(`待解析Hex段[${pendingParsing}],寄存器地址:[${register.reg}][${register.define}],解析结果[${data}]`)
                            // 将解析结果存入 resultMap
                            result.push({
                                dataType: 'REAL',
                                data: data,
                                registerDefine:register.define,
                                registerFieldName:register.fieldName,
                                func:reportValue.func,
                                hex:pendingParsing
                            });	
                        } catch (error) {
                            result.push({
                                dataType: 'HEX',
                                data: pendingParsing,
                                registerDefine:register.define,
                                registerFieldName:register.fieldName,
                                func:reportValue.func,
                                hex:pendingParsing
                            });	
                        }

                        // 截取剩余未解析的内容
                        content = content.slice(lenToParse);
                    })

                }
                
            }else if(reportValue.analysisType=='custom'){
                log.debug('无法自动解析，请自行解析Hex报文')
            }

        } catch (error) {
            let err = error as Error
            throw err
        }
        log.debug('[解析结果][AnalyzeHexPackage]'+JSON.stringify(result))
        return result
        
    }


    private static hexToSignedInt(hex: string): number {
        // 将十六进制字符串转换为整数
        const intVal = parseInt(hex, 16);
        // 判断是否超过了 int16 的正数范围
        if (intVal >= 0x8000) {
            // 若超过，转换为负数（使用补码转换）
            return intVal - 0x10000;
        }
        return intVal;
    }
    
    private static signedIntToHex(value: number): string {
        if (value < 0) {
            // 处理负数，将其转换为补码表示的16位十六进制
            value = 0x10000 + value;
        }
        // 转换为十六进制字符串，并确保长度为4位，不足的部分用0填充
        return value.toString(16).padStart(4, '0');
    }

    private static hexToSignedInt8(hex: string): number {
        // 解析十六进制字符串为整数
        let intVal = parseInt(hex, 16);
		
        // 判断是否超出 int8 的正数范围（即 > 127）
        if (intVal >= 0x80) {
			console.error(intVal - 0x100)
            // 负数处理，使用补码转换
            return intVal - 0x100;
        }
        return intVal;
    }
    
    private static signedIntToHex8(value: number): string {
        if (value < -128 || value > 127) {
            throw new RangeError("Value out of range for int8 (-128 to 127)");
        }
        if (value < 0) {
            value = 0x100 + value; // 计算 8 位补码
        }
        return value.toString(16).padStart(2, '0');
    }
    
    /**
     * 数据转换
     * @param hexStr 原文
     * @param type HEX原始数据类型
     * @param range 倍数
     * @returns 
     */
    private static convertHexToString(hexStr: string, type: string, range: number): string {
        try {
            let result: number | bigint;
            const highLowTransition = ProtocolBasic.highLowTransition(type);
    
            // 高低位转换
            if (highLowTransition && hexStr.length % 2 === 0) {
                hexStr = hexStr.match(/.{1,2}/g)?.reverse().join('') || hexStr;
            }
    
            // HEX 转换逻辑
            switch (type.toLowerCase()) {
                case "uint8":
                    result = parseInt(hexStr, 16) & 0xff;
                    break;
                case "uint16":
                    result = parseInt(hexStr, 16) & 0xffff;
                    break;
                case "uint32":
                    result = parseInt(hexStr, 16) & 0xffffffff;
                    break;
                case "uint64":
                    result = BigInt("0x" + hexStr); // 使用 BigInt 处理超大数值
                    return (result / BigInt(range)).toString();
                case "int":
                    result = parseInt(hexStr, 16);
                    break;
                case "long":
                    result = parseInt(hexStr, 16); // long 和 int 可共用逻辑，区分在上下文
                    break;
                case "byte":
                    result = ProtocolBasic.hexToSignedInt8(hexStr);
					break;
                case "char":
                    let charResult = '';
                    for (let i = 0; i < hexStr.length; i += 2) {
                        const hexPair = hexStr.slice(i, i + 2);
                        const char = String.fromCharCode(parseInt(hexPair, 16));
                        charResult += char;
                    }
                    return charResult.replace(/\x00+$/, '');
                case "short":
                    result = ProtocolBasic.hexToSignedInt(hexStr);
                    break;
                case "split":
                    return hexStr.match(/.{1,2}/g)?.map(h => parseInt(h, 16).toString()).join('.') || "";
                case "date":
                    if (hexStr.length === 16 && hexStr.endsWith("0000")) {
                        const year = parseInt(hexStr.slice(0, 2), 16) + 2000;
                        const month = parseInt(hexStr.slice(2, 4), 16);
                        const day = parseInt(hexStr.slice(4, 6), 16);
                        const hour = parseInt(hexStr.slice(6, 8), 16);
                        const minute = parseInt(hexStr.slice(8, 10), 16);
                        const second = parseInt(hexStr.slice(10, 12), 16);
                        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                    }
                    return "Invalid date format";
                case "messagepack":
                    try {
                        // 假设 hexStr 是 MessagePack 的十六进制编码
                        const buffer = Buffer.from(hexStr, 'hex');
                        const decoded = require('msgpack-lite').decode(buffer);
                        return JSON.stringify(decoded); // 将解码后的对象转换为字符串
                    } catch (error) {
                        log.error(`MessagePack 解码失败: ${error.message}`);
                        throw new Error("Invalid MessagePack format");
                    }
                    
                default:
                    log.warn(`数据解析出现未知数据类型: ${type}`);
                    return "";
            }
    
            // 数值类型处理
            if (["uint8", "uint16", "uint32", "short", "int", "long"].includes(type.toLowerCase())) {
                const decimalPlaces = Math.min(3, Math.log10(range));
                return (Number(result) / range).toFixed(decimalPlaces);
            }
    
            return result.toString();
        } catch (error) {
            const err = error as Error;
            log.error(`数据转换失败: ${err.message}, HEX: ${hexStr}, 类型: ${type}`);
            throw error;
        }
    }
    

   /**
     * 数据拆包。把Hex报文拆包成HexPackage[]数组
     * @param protocol 
     * @param hexString 
     * @returns 
     */
    private static unPackage(protocol: ChildProtocol, hexString: string): HexPackage[] {
        let result: HexPackage[] = [];

        try {
            // 去掉所有空格
            hexString = hexString.toLowerCase().replace(/\s+/g, "");
            
            let prefix = protocol.prefix.toLowerCase().replace(/\s+/g, "");
            let suffix = protocol.suffix.toLowerCase().replace(/\s+/g, "");

            // 检查帧头
            if (prefix !== '' && !hexString.startsWith(prefix)) {
                throw new Error(`[解析失败][拆包失败]帧头不匹配，期望的帧头为：${prefix}，实际数据为：${hexString.slice(0, prefix.length)}`);
            }

            // 检查帧尾
            if (suffix !== '' && !hexString.endsWith(suffix)) {
                throw new Error(`[解析失败][拆包失败]帧尾不匹配，期望的帧尾为：${suffix}，实际数据为：${hexString.slice(-suffix.length)}`);
            }

            // 移除帧头和帧尾，只处理中间的数据部分
            let content = hexString.slice(prefix.length, hexString.length - suffix.length);
            
            let isFirst = true;
            // 校验每个包的CRC并提取数据
            while (content.length > 0) {
                // 获取功能码和数据域长度
                const functionCode = content.slice(0, 2);
                const registCode = content.slice(2, 6);
                const dataLengthHex = content.slice(6, 8); // 数据域长度（字节数）
                const dataLength = parseInt(dataLengthHex, 16) * 2; // 转换为字符长度（字节数 * 2）

                // 数据内容
                const dataContent = content.slice(8, 8 + dataLength);

                let crcFromPacket = '';
                // 需要CRC则进行CRC提取和验证
                if (protocol.needCrc) {
                    // 提取CRC
                    crcFromPacket = content.slice(8 + dataLength, 8 + dataLength + 4); // 提取CRC
                    const crcHighLowSwapped =
                        crcFromPacket.slice(2) + crcFromPacket.slice(0, 2); // 高低位转换
                    
                    // 提取用于CRC计算的数据
                    let crcData = functionCode + registCode + dataLengthHex + dataContent;
                    
                    // 计算CRC
                    let calculatedCRC = "";
                    if (isFirst) {
                        //如果是多包协议。那么第一包需要包含帧头的第二个字节。后面的包不用
                        calculatedCRC = CalculateCRC16Modbus(prefix.slice(2)+ crcData);
                        isFirst = false;
                    } else {
                        calculatedCRC = CalculateCRC16Modbus(crcData);
                    }

                    // 校验CRC
                    if (calculatedCRC !== crcHighLowSwapped) {
                        throw new Error(`[解析失败][CRC校验失败]功能码：${functionCode}，寄存器号：${registCode}，数据内容：${crcData}，计算的CRC为：${calculatedCRC}，提取的CRC为：${crcHighLowSwapped}`);
                    }
                }

                result.push({
                    func: functionCode,
                    registCode: registCode,
                    dataLengthHex: dataLengthHex,
                    dataLength: dataLength,
                    data: dataContent,
                    crc: crcFromPacket
                });

                // 移动到下一个包
                content = content.slice((functionCode + registCode + dataLengthHex + dataContent).length + crcFromPacket.length, content.length);
            }
        } catch (error) {
            // 捕获并抛出详细错误
            let err = error as Error;
            throw new Error(`[拆包处理失败] ${err.message}`);
        }

        return result;
    }

    public ackCheck(protocolMD5:string,versionNum:string,packetConfigType:string,ackFunc: string, hex: string,registCode?:string): boolean {
        //查找协议
        let childProtocol:ChildProtocol = ProtocolBasic.findProtocolByMD5(protocolMD5,versionNum,packetConfigType)
        if(childProtocol == undefined){
            log.error(`协议版本未找到，请确认[${protocolMD5}][${versionNum}]协议是否存在`)
            return false
        }
        //拆包
        let packages:HexPackage[] = ProtocolBasic.unPackage(childProtocol,hex)
        //判断第一个包的功能码和ackFunc是否一致
        if(packages == undefined || packages.length==0){
            log.error(`[协议ACK校验][报文解析失败][${hex}]`)
            return false
        }
        if(packages[0].func.toLowerCase().replace(/\s+/g, "") != ackFunc.toLowerCase().replace(/\s+/g, "")){
            log.warn(`[协议ACK校验][失败][ACK功能码不匹配][${ackFunc}][${hex}][${registCode}]`)
            return false
        }
        if(registCode&&packages[0].registCode.toLowerCase().replace(/\s+/g, "") != registCode.toLowerCase().replace(/\s+/g, "")){
            log.warn(`[协议ACK校验][失败][寄存器地址不匹配][${ackFunc}][${hex}][${registCode}]`)
            return false
        }

        log.debug(`[协议ACK校验][成功][${ackFunc}][${hex}][${registCode}]`)
        return true
    }

    /**
     * 把十进制数字转换成16进制
     * @param decimal 
     * @param minLength 
     * @param uppercase 
     * @returns 
     */
    private decimalToHexString(decimal: number, minLength: number = 0, uppercase: boolean = true): string {
        if (decimal < 0) {
          throw new Error('Negative numbers are not supported.');
        }
      
        // 转换为十六进制字符串
        let hexString = decimal.toString(16);
      
        // 如果需要固定长度，进行补零
        if (minLength > 0) {
          hexString = hexString.padStart(minLength, '0');
        }
      
        // 转换为大写或小写
        return uppercase ? hexString.toUpperCase() : hexString;
    }
    
}