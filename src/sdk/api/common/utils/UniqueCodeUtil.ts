import { log } from "./logPlugins";

/**
 * 工具类 UniqueCodeUtil
 * 提供处理唯一码和相关操作的功能
 */
export default class UniqueCodeUtil {
  /**
   * 从URL中提取唯一码（u 参数的值）
   * @param url 完整的URL字符串
   * @returns 唯一码字符串或null
   */
  private static extractUniqueCode(url: string): string | null {
    try {
      log.debug("开始解析URL:", url);
      // 使用正则表达式提取 u 参数
      const match = url.match(/[?&]u=([^&]+)/);
      const result = match ? decodeURIComponent(match[1]) : null;
      log.debug("提取到的唯一码:", result);
      return result;
    } catch (error) {
      log.error("URL解析失败：", error);
      return null;
    }
  }

  /**
   * 反转字节用于MAC地址计算
   * @param byte 输入字节
   * @returns 反转后的字节
   */
  private static reverseByte(byte: number): number {
    let temp = 0;
    for (let i = 0; i < 8; i++) {
      temp |= (byte >> i) & 0x01;
      if (i < 7) temp <<= 1;
    }
    return temp;
  }

  /**
   * 将缓冲区转换为十六进制格式
   * @param buffer 数组缓冲区
   * @returns 十六进制字符串
   */
  private static ab2hex(buffer: number[]): string {
    return buffer.map((bit) => ('00' + bit.toString(16)).toUpperCase().slice(-2)).join(":");
  }

  /**
   * 将设备唯一码的前12位转换为MAC地址
   * 转换规则：将每个字符的ASCII值转换为十六进制，按特定算法计算
   * @param uniqueId 唯一码字符串
   * @returns 转换后的MAC地址（例如：20:9D:E2:D7:40:9A）
   */
  private static convertUniqueIdToMac(uniqueId: string): string | null {
    log.debug("开始转换唯一码为MAC地址:", uniqueId);

    // 校验唯一码是否有效
    if (!uniqueId || uniqueId.length < 12) {
      log.error("唯一码长度不足12位，无法转换为MAC地址。唯一码:", uniqueId);
      return null;
    }

    // 提取前12位字符
    const macSource = uniqueId.slice(0, 12);
    log.debug("用于转换的前12位字符:", macSource);

    // 转换为ASCII码数组
    const asciiArray = Array.from(macSource).map((char) => char.charCodeAt(0));
    log.debug("转换后的ASCII数组:", asciiArray);

    // 按算法处理每组数据
    const macArray = [];
    for (let i = 0; i < 6; i++) {
      const high = asciiArray[i * 2];
      const low = asciiArray[i * 2 + 1];
      const value = low ^ this.reverseByte(high);
      macArray.push(value);
    }

    log.debug("转换后的HEX数组:", macArray);

    // 格式化为MAC地址
    const macAddress = this.ab2hex(macArray);
    log.debug("生成的MAC地址:", macAddress);

    return macAddress.toUpperCase();
  }

  /**
   * 解析扫码地址获取MAC地址
   * @param url 扫码后的地址信息
   * @returns 蓝牙MAC地址或null
   */
  public static parse(url: string): string | null {
    log.debug("开始解析扫码地址获取MAC地址:", url);

    // 提取URL中的唯一码
    const uniqueCode = this.extractUniqueCode(url);

    if (!uniqueCode) {
      log.error("未能从URL中提取到唯一码。");
      return null;
    }

    // 将唯一码转换为MAC地址
    const macAddress = this.convertUniqueIdToMac(uniqueCode);
    log.debug("最终生成的MAC地址:", macAddress);

    return macAddress;
  }
}
