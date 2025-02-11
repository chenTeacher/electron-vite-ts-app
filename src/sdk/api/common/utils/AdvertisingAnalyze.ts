/**
 * 广播内容解析
 */
export default class AdvertisingAnalyze {
    /**
     * 设备类型枚举
     */
    private static deviceTypes: { [key: string]: string } = {
        "1388": "bms",
        "1389": "screen",
        "1390": "charger",
        "1391": "dtu",
    };
  
    /**
     * 解析广播数据
     * @param hexData 广播的 HEX 字符串数据
     * @returns 解析后的对象
     */
    public static parse(hexData: string): Advertising {
        hexData = hexData.toUpperCase()
        // 解析字段
        let deviceId = "";
        let macAddressVariants: string[] = [];
        let screenPairingCode = "";
        let chargerPairingCode = "";

        if (hexData.length >= 4) {
            const deviceIdLow = hexData.slice(0, 2);
            const deviceIdHigh = hexData.slice(2, 4);
            deviceId = `${deviceIdHigh}${deviceIdLow}`; // 高低位拼接
        }

        if (hexData.length >= 16) {
            const macBytes = hexData.slice(4, 16).match(/.{1,2}/g) || [];

            // 格式化 MAC 地址
            const macAddressNormal = macBytes.join(":");
            const macAddressAdjusted = [...macBytes];
            if (macAddressAdjusted.length >= 4) {
                // 第四个字节加 1
                const fourthByte = parseInt(macAddressAdjusted[3], 16) + 1;
                macAddressAdjusted[3] = fourthByte >= 0 ? fourthByte.toString(16).padStart(2, "0") : macAddressAdjusted[3];
            }
            macAddressVariants = [macAddressNormal, macAddressAdjusted.join(":").toUpperCase()];
        }

        // 新增的特殊情况：广播地址从第5个字节开始是mac地址
        if (hexData.length >= 20) {
            const macBytesSpecial = hexData.slice(8, 20).match(/.{1,2}/g) || [];
            
            const macAddressSpecial = macBytesSpecial.join(":");
            const macAddressAdjusted = [...macBytesSpecial];
            if (macAddressAdjusted.length >= 4) {
                // 第四个字节加 1
                const fourthByte = parseInt(macAddressAdjusted[3], 16) + 1;
                macAddressAdjusted[3] = fourthByte >= 0 ? fourthByte.toString(16).padStart(2, "0") : macAddressAdjusted[3];
            }
            
            macAddressVariants.push(macAddressSpecial);
            macAddressVariants.push(macAddressAdjusted.join(":").toUpperCase());
            
        }

        if (hexData.length >= 20) {
            screenPairingCode = hexData.slice(16, 20);
        }

        if (hexData.length >= 24) {
            chargerPairingCode = hexData.slice(20, 24);
        }

        // 获取设备类型
        const deviceType = this.deviceTypes[deviceId] || "";

        return {
            deviceType,
            macAddress: macAddressVariants,
            screenPairingCode,
            chargerPairingCode,
        };
    }
}
