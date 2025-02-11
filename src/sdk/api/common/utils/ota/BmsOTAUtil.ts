import { log } from '../../utils';
import { BleConnectionInterface } from "../../../BleConnectionInterface";
import ProtocolBasic from "../../../protocol/common/ProtocolBasic";

interface OtaOption{
  bleConnect: BleConnectionInterface,//蓝牙连接对象
  deviceId: string,//蓝牙设备ID
  serviceId: string,//蓝牙服务ID
  characteristicId: string,//蓝牙特征ID
  protocolImpl:ProtocolBasic,//协议对象
  protocolMD5:string,//协议MD5
  protocolVersionNum:string,//协议子版本号
  upgradeCommandRetryNum:number,//升级指令重试次数
  upgradeFunc:string,//升级功能码
  upgradeCode:string,//升级指令协议编码
  softwareDownloadUrl:string,//软件固件下载地址
  upgradeType:UpgradeType,//固件升级类型

  /**
   * 单次最大数据传输大小（字节数）
   * <br>
   * 老蓝牙固定设置128，不支持通过mtu进行自适应。新蓝牙默认值时mtu-10。可以不设置
   */
  maxTrans?:number,
}

type UpgradeType = 'BMS' |'BMS_BOOT'| 'BMS_BLE' |'SCREEN'

/**
 * 不同类型固件升级时所使用的功能码
 */
enum SendPackageFun {
  BMS = '52',
  BMS_BOOT = '55',
  BMS_BLE = '57',
  SCREEN = '56'
}

/**
 * 异常回复时的功能码
 */
enum ErrorArrivedRegistCode {
  BMS = '0a00',
  BOOT = '2b00',
}


/**
 * 提供BMS蓝牙升级BMS固件、Boot固件和蓝牙固件升级的工具包
 */
export default class BmsOTAUtil{
    /**
     * OTA升级所需的所有参数
     */
    private otaOptions:OtaOption;

    /**
     * 进入升级状态的指令
     */
    private upgradeCommand:BuildSendResult;

    /**
     * 固件Hex数据
     */
    private hexData: string;

    /**
     * 设备是否进入了升级状态
     */
    private isUpgradeModel:boolean=false;

    /**
     * 升级流程是否异常终止
     */
    private isErrorStop = false;

    /**
     * 协议包配置
     */
    private packetConfigType='BLE'


    //---------------------------------回调函数注册 start
    private progressCallBack: ((progress: number) => void) | null = null;
    private errorCallBack: ((msg: string) => void) | null = null;
    private successCallBack: (() => void) | null = null;
    //---------------------------------回调函数注册 end

    /**
     * 根据环境不同传入蓝牙连接对象BleConnectionInterface接口的实现类
     * @param bleConnect BleConnectionInterface接口的实现类
     */
    constructor(otaOptions:OtaOption) {
      this.otaOptions = otaOptions;
    }
  
    // 注册进度回调
    public onProgress(progressCallBack: (progress: number) => void): void {
      this.progressCallBack = progressCallBack;
    }
  
    // 注册错误回调
    public onError(errorCallBack: (msg: string) => void): void {
      this.errorCallBack = errorCallBack;
    }
  
    // 注册成功回调
    public onSuccess(successCallBack: () => void): void {
      this.successCallBack = successCallBack;
    }

    /**
     * 执行升级指令并升级
     * @param interval 每次发送命令的间隔（毫秒）
     */
    private async switchToUpgradeMode(interval: number = 100) {
      try {
        const { bleConnect, deviceId, serviceId, characteristicId } = this.otaOptions;
        const { command } = this.upgradeCommand;

        log.debug(`执行升级指令:${command}`);

        let count= 0
        while (count<this.otaOptions.upgradeCommandRetryNum) {
          //出现异常时，不再尝试进入升级状态
          if(this.isErrorStop)return

          count++
          // 设备成功进入待升级状态后中断发送进入升级状态的指令
          if(this.isUpgradeModel){
            log.debug('设备成功进入待升级状态');
            return 
          }
          // 发送指令
          bleConnect.publishMessage({
            deviceId,
            serviceId,
            characteristicId,
            value: command,
            payloadType: 'Hex',
            // writeType:'writenoresponse',
          });

          // 等待间隔
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      } catch (error) {
        log.error(`[进入升级状态失败][${error}]`);
        throw new Error(`[进入升级状态失败][${error}]`)
      }

      // 进入升级状态的指令执行完成 等待一段时间 看看设备有没有真的进入。不进入的话提示错误
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if(!this.isUpgradeModel && this.errorCallBack){
        this.errorCallBack('设备无法进入待升级状态')
      }
    }

    /**
     * 升级固件核心方法
     * @param resHex
     * @param pkgNumbers 连续发送数据包数量
     */
    private async firmwareUpgrade(resHex: string,pkgNumbers:number): Promise<void> {
      resHex = resHex.replace(/\s+/g, "");
      const { bleConnect, deviceId, serviceId, characteristicId, protocolImpl, protocolMD5 } = this.otaOptions;

      //获取协议包配置
      let packetConfig: PacketConfig = protocolImpl.getPacketConfig(protocolMD5, this.packetConfigType);

      //获取序号(寄存器地址)
      let packageSize = 128
      let reg = resHex.slice(6, 10);
      let start = this.hexStringToDecimal(reg)//发送到第几个包了
      
      //连续发送数据
      for(let packageNumber=start ;packageNumber<pkgNumbers+start ; packageNumber++){
        reg = this.decimalToLittleEndianHexString(packageNumber)
        let payload = this.readHexDataByIndex(this.hexData, packageNumber);
  
        let sendPackageFun:SendPackageFun
        switch(this.otaOptions.upgradeType){
          case 'BMS':
            sendPackageFun = SendPackageFun.BMS
            break
          case 'BMS_BOOT':
            sendPackageFun = SendPackageFun.BMS_BOOT
            break
          case 'BMS_BLE':
            sendPackageFun = SendPackageFun.BMS_BLE
            break
          case 'SCREEN':
            sendPackageFun = SendPackageFun.SCREEN
            break
        }
  
        let command = protocolImpl.manualPackageCommand(packetConfig.prefix, packetConfig.suffix, sendPackageFun, reg, payload, packetConfig.needCrc);
  
        log.debug(`升级中，当前发送到了第 ${packageNumber} 包`);
  
        try {
          await bleConnect.publishMessage({
            deviceId,
            serviceId,
            characteristicId,
            value: command,
            payloadType: 'Hex',
            maxTrans:this.otaOptions.maxTrans,
            writeType:'writenoresponse',
          });
  
          //调用回调函数把进度回传出去
          if(this.progressCallBack){
            let progress = this.calculateHexFileProgress(this.hexData,packageNumber,packageSize)
            this.progressCallBack(progress)
          }
  
        } catch (error) {
          log.error(`[升级中发生错误][${error}]`);
          throw new Error(`[升级中发生错误][${error}]`)
        }
      }
      
    }


    /**
     * 把两个字节的Hex数字字符串转换成数字
     * @param hexString 
     * @returns 
     */
    private hexStringToDecimal(hexString: string): number {
      // 去除所有空格（预防用户误输入空格）
      const sanitizedHexString = hexString.replace(/\s+/g, '');
    
      // 检查是否是有效的十六进制字符串
      if (!/^[0-9a-fA-F]+$/.test(sanitizedHexString)) {
        throw new Error('输入必须是有效的十六进制字符串');
      }
    
      // 检查字符串长度是否为偶数
      if (sanitizedHexString.length % 2 !== 0) {
        throw new Error('十六进制字符串的长度必须是偶数');
      }
    
      // 将高低位字节对调
      const reversedHexString = sanitizedHexString
        .match(/.{2}/g) // 将字符串按2个字符分组
        ?.reverse() // 反转字节顺序
        .join(''); // 合并为字符串
    
      if (!reversedHexString) {
        throw new Error('处理十六进制字符串失败');
      }
    
      // 转换为十进制
      return parseInt(reversedHexString, 16);
    }

    /**
     * 把数字转换为固定2字节小端字节序的Hex字符串
     * @param num 
     * @returns 
     */
    private decimalToLittleEndianHexString(num: number): string {
      // 检查数字是否在 16-bit 无符号整数范围内
      if (num < 0 || num > 65535) {
        throw new Error('数字必须在16位无符号整数范围内（0到65535之间）');
      }

      // 转换为十六进制字符串并补齐到2字节（4个字符）
      const hexString = num.toString(16).padStart(4, '0');

      // 将高低位字节对调（小端序）
      const littleEndianHexString = hexString
        .match(/.{2}/g) // 按字节（每2个字符）分组
        ?.reverse()     // 反转字节顺序
        .join('');      // 合并为字符串

      if (!littleEndianHexString) {
        throw new Error('处理十六进制字符串失败');
      }

      // 返回转换后的小端字节序的十六进制字符串
      return littleEndianHexString.toUpperCase();
    }

    
    /**
     * 检测是否为 uniapp 环境
     * @returns 
     */
    private isUniApp(): boolean {
      return typeof uni !== 'undefined' && typeof uni.request === 'function';
    }

    /**
     * 下载文件并返回二进制数据
     * @param url 
     * @returns 
     */
    private async downloadFile(url: string): Promise<{ fileName: string; hexData: string ,fileSize:number}> {
      let fileName = 'unknown_file';
      let binaryData: ArrayBuffer;

      try {
        if (this.isUniApp()) {
          // 使用 uniapp 的 uni.request
          const response: any = await new Promise((resolve, reject) => {
            uni.request({
              url,
              method: 'GET',
              responseType: 'arraybuffer',
              success: resolve,
              fail: reject,
            });
          });
  
          if (response.statusCode !== 200) {
            throw new Error(`文件下载失败：${response.errMsg}`);
          }
  
          binaryData = response.data;
          const contentDisposition = response.header['Content-Disposition'] || response.header['content-disposition'];
          fileName = contentDisposition?.match(/filename="?(.+?)"?$/)?.[1] || fileName;
  
        } else {
          // 使用 fetch
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`文件下载失败：${response.statusText}`);
          }
  
          binaryData = await response.arrayBuffer();
          const contentDisposition = response.headers.get('content-disposition');
          fileName = contentDisposition?.match(/filename="?(.+?)"?$/)?.[1] || fileName;
        }
      } catch (error) {
        log.error(error);
        throw error
      }


      // 将 ArrayBuffer 转换为 Uint8Array
      const byteArray = new Uint8Array(binaryData);
      let hexData = '';

      // 遍历每个字节并将其转换为十六进制
      for (let i = 0; i < byteArray.length; i++) {
        const byte = byteArray[i];
        hexData += byte.toString(16).padStart(2, '0'); // 转换为 2 位十六进制，补充前导零
      }

      let fileSize = binaryData.byteLength

      return { fileName, hexData , fileSize};
    }

    /**
     * 按顺序读取定长Hex数据
     * @param hexData 十六进制字符串
     * @param index 从1开始的索引
     * @returns 指定范围的十六进制字符串
     */
    private readHexDataByIndex(hexData: string, index: number): string {
      const length: number = 128; // 每次读取的固定字节长度

      // 校验输入的十六进制数据是否合法
      if (!/^[0-9a-fA-F]+$/.test(hexData)) {
        throw new Error('输入的 hexData 必须是有效的十六进制字符串');
      }

      // 检查索引是否有效（从1开始的索引）
      if (index < 1) {
        throw new Error('索引必须大于或等于 1');
      }

      // 计算从 index 开始的字节数据段
      const startIdx = (index - 1) * length * 2; // 将索引转换为起始位置（1字节=2个HEX字符）
      const endIdx = startIdx + length * 2; // 确定结束位置

      // 如果起始索引超出范围，返回空字符串
      if (startIdx >= hexData.length) {
        return '';
      }

      // 提取指定范围的子字符串
      const segment = hexData.slice(startIdx, Math.min(endIdx, hexData.length));

      // 返回十六进制字符串
      return segment;
    }


    /**
     * 把输入的字符串转换成Hex字符串
     * @param input 输入的字符串
     * @returns 
     */
    private stringToHex(input: string): string {
      return Array.from(input)
        .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
    }

    /**
     * 把Number数值转换成Hex
     * @param num 数值
     * @param byteLength Hex固定长度
     * @returns 
     */
    private numberToHexWithEndianSwap(num: number, byteLength: number = 4): string {
      if (num < 0) {
        throw new Error('不支持负数');
      }
    
      // 将数字转换为 16 进制，补齐到指定字节长度
      const hexString = num.toString(16).padStart(byteLength * 2, '0');
    
      // 将 16 进制字符串按字节分组（每两位为一字节）
      const byteArray = hexString.match(/.{2}/g);
      if (!byteArray) {
        throw new Error('解析十六进制字符串失败');
      }
    
      // 反转字节数组以实现高低位交换
      const swappedHex = byteArray.reverse().join('');
    
      return swappedHex;
    }

    /**
     * 计算发送进度百分比
     * @param hexData 十六进制字符串文件内容
     * @param currentChunk 当前发送到的包序号（从1开始）
     * @param chunkSize 每包发送的字节数
     * @returns 当前进度百分比
     */
    private calculateHexFileProgress(
      hexData: string,
      currentChunk: number,
      chunkSize: number
    ): number {      
      // 校验输入的十六进制数据是否合法
      if (!/^[0-9a-fA-F]*$/.test(hexData)) {
          throw new Error('输入的 hexData 必须是有效的十六进制字符串');
      }
      if (currentChunk < 1) {
          throw new Error('当前块的大小必须大于或等于 1');
      }
      if (chunkSize <= 0) {
          throw new Error('块大小必须大于 0');
      }

      // 转换 HEX 字符串为字节长度
      const totalBytes = Math.ceil(hexData.length / 2); // HEX 每2个字符等于1字节
      const totalChunks = Math.ceil(totalBytes / chunkSize); // 总包数

      // 防止超出总包范围的非法输入
      if (currentChunk > totalChunks) {
          return 100; // 进度完成
      }

      // 计算并返回进度百分比
      const progress = Math.round((currentChunk / totalChunks) * 100);
      return progress;
    }

    /**
     * 处理BMS固件和BOOT固件升级过程中的消息回复
     * @param data 
     */
    private async bmsMessageArrived(data:any,arrivedAck:string,registCode:string){
          const {protocolImpl, protocolMD5, protocolVersionNum } = this.otaOptions;
          
          //未进入升级状态
          if(!this.isUpgradeModel){
            if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'0100')){
              this.isUpgradeModel = true
              //发送第一包数据
              await this.firmwareUpgrade(data.notifyMsg,1).catch(err => log.error('Firmware upgrade failed:'+ err));

            }else if(data.notifyMsg.indexOf(`61${registCode}0202`)>0){
              if(this.errorCallBack){
                this.errorCallBack('Boot模式进入失败')
                this.isErrorStop=true
              }
            }else if(data.notifyMsg.indexOf(`61${registCode}0203`)>0){
              if(this.errorCallBack){
                this.errorCallBack('权限不足')
              }
            }else if(data.notifyMsg.indexOf(`61${registCode}0204`)>0){
              if(this.errorCallBack){
                this.errorCallBack('地址超范围')
                this.isErrorStop=true
              }
            }else if(data.notifyMsg.indexOf(`61${registCode}0205`)>0){
              if(this.errorCallBack){
                this.errorCallBack('电池类型错误')
                this.isErrorStop=true
              }
            }else if(data.notifyMsg.indexOf(`61${registCode}0206`)>0){
              if(this.errorCallBack){
                this.errorCallBack('电流信息错误')
                this.isErrorStop=true
              }
            }else if(data.notifyMsg.indexOf(`61${registCode}0207`)>0){
              if(this.errorCallBack){
                this.errorCallBack('固件不匹配')
                this.isErrorStop=true
              }
            }
          }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg)){
            //已经进入了升级状态
            await this.firmwareUpgrade(data.notifyMsg,1).catch(err => log.error('Firmware upgrade failed:'+ err));
          }else if (protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, 'ff', data.notifyMsg)){
            this.isUpgradeModel = false
            if(this.successCallBack){
              this.successCallBack()
            }
          }
    }

    /**
     * 处理蓝牙固件升级过程中的消息回复
     * @param data 
     */
    private async bleMessageArrived(data:any,arrivedAck:string){
      const {protocolImpl, protocolMD5, protocolVersionNum } = this.otaOptions;
      
      if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'01ff')){
        this.isUpgradeModel = true
        if(this.errorCallBack){
          this.errorCallBack('固件不匹配')
          this.isErrorStop=true
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'02ff')){
        this.isUpgradeModel = false
        if(this.successCallBack){
          this.successCallBack()
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'03ff')){
        if(this.errorCallBack){
          this.errorCallBack('固件升级失败')
          this.isErrorStop=true
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg)){
        this.isUpgradeModel = true
        await this.firmwareUpgrade(data.notifyMsg,16).catch(err => log.error('Firmware upgrade failed:'+ err));
      }
    
    }

    /**
     * 处理蓝牙固件升级过程中的消息回复
     * @param data 
     */
    private async screenBleMessageArrived(data:any,arrivedAck:string){
      const {protocolImpl, protocolMD5, protocolVersionNum } = this.otaOptions;
      
      if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'01ef')){
        this.isUpgradeModel = true
        if(this.errorCallBack){
          this.errorCallBack('固件不匹配')
          this.isErrorStop=true
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'02ef')){
        this.isUpgradeModel = false
        if(this.successCallBack){
          this.successCallBack()
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg,'03ef')){
        if(this.errorCallBack){
          this.errorCallBack('固件升级失败')
          this.isErrorStop=true
        }
      }else if(protocolImpl.ackCheck(protocolMD5, protocolVersionNum, this.packetConfigType, arrivedAck, data.notifyMsg)){
        this.isUpgradeModel = true
        await this.firmwareUpgrade(data.notifyMsg,16).catch(err => log.error('Firmware upgrade failed:'+ err));
      }
      
    }

    /**
     * 开始升级
     */
    public async start(){
      const { deviceId,bleConnect, protocolImpl, protocolMD5, protocolVersionNum,softwareDownloadUrl,upgradeFunc,upgradeCode } = this.otaOptions;

      //下载固件
      try {
        const { fileName, hexData ,fileSize} = await this.downloadFile(softwareDownloadUrl);
        if(!fileName||!hexData||!fileSize)return

        this.hexData=hexData
        log.debug(`Downloaded file name: ${fileName}`);

        //根据升级文件构建进入升级状态的载荷数据
        let payload:string=this.stringToHex(fileName.slice(0,8))+'0000000000000000'+this.numberToHexWithEndianSwap(fileSize)+'00000000';

        this.upgradeCommand = protocolImpl.buildCommandForHex(
          protocolMD5,
          protocolVersionNum,
          this.packetConfigType,
          upgradeFunc,
          upgradeCode,
          payload)

        //获取协议定义。拿到ack
        let commandDetail:CommandDetail = protocolImpl.getCommandDefine(protocolMD5,protocolVersionNum,this.packetConfigType,upgradeFunc,upgradeCode)
        if(commandDetail==undefined){
          throw Error('无法从协议获取指令定义')
        }

        // 订阅设备回复。按照设备的回复发送升级数据
        bleConnect.onMessageArrived(async (data) => {
          switch (this.otaOptions.upgradeType) {
            case 'BMS':
              await this.bmsMessageArrived(data,commandDetail.ack,ErrorArrivedRegistCode.BMS);
              break;
            case 'BMS_BOOT':
              await this.bmsMessageArrived(data,commandDetail.ack,ErrorArrivedRegistCode.BOOT);
              break;
            case 'BMS_BLE':
              await this.bleMessageArrived(data,commandDetail.ack);
              break;
            case 'SCREEN':
              await this.screenBleMessageArrived(data,commandDetail.ack);
              break;

          }
        });

        //如果设备连接不稳定。都会触发断线重连。升级过程中触发则中断固件升级
        bleConnect.onBLEStateChange(async (state:BleStateConnectCallbak) => {
          if(state.deviceId==deviceId&&state.connected==false&&this.errorCallBack&&this.isUpgradeModel){
            this.errorCallBack('设备连接不稳定')
            this.isErrorStop=true
          }
        })

        //让设备进入升级状态
        await this.switchToUpgradeMode()

      } catch (error) {
        log.error(error);
        if(this.errorCallBack){
          this.errorCallBack(error)
        }
      }
     
    }
}