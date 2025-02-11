import { CalculateCRC16Modbus } from "../common/utils/CalculateCRC16Modbus";

// 校验Hex格式的工具类
export default class BmsValidator {
  // 校验方法
  public static validate(hexString: string): boolean {
    // 去掉所有空格
    hexString = hexString.replace(/\s+/g, "");

    // 检查是否以7ea1开头以及aa55结尾
    if (!hexString.startsWith("7ea1") || !hexString.endsWith("aa55")) {
      return false;
    }

    // 移除帧头（7ea1）和帧尾（aa55），只处理中间的数据部分
    let content = hexString.slice(4, hexString.length - 4);

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

      // 提取CRC
      const crcFromPacket = content.slice(8 + dataLength, 8 + dataLength + 4); // 提取CRC
      const crcHighLowSwapped =
        crcFromPacket.slice(2) + crcFromPacket.slice(0, 2); // 高低位转换

      // 提取用于CRC计算的数据
      let crcData = functionCode + registCode + dataLengthHex + dataContent;

      // 计算CRC
      let calculatedCRC = "";
      if (isFirst) {
        calculatedCRC = CalculateCRC16Modbus("a1" + crcData);
        isFirst = false;
      } else {
        calculatedCRC = CalculateCRC16Modbus(crcData);
      }

      // 校验CRC
      if (calculatedCRC !== crcHighLowSwapped) {
        throw new Error('CRC check failed')
      }

      // 移动到下一个包
      content = content.slice(crcData.length + 4, content.length);
    }

    // 所有包都通过校验
    return true;
  }
}
