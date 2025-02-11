// 导入用于CRC-16-MODBUS校验的库
import crc from 'crc';

// CRC-16-MODBUS算法校验
export const CalculateCRC16Modbus=(data: string): string =>{
	const buffer = Buffer.from(data, 'hex');
	const crcValue = crc.crc16modbus(buffer);
	// 返回4位16进制字符串，不足补0
	return crcValue.toString(16).padStart(4, '0').toLowerCase();
}