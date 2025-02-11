import JSONBigNumber from 'json-bigint';
import JSONBigIntModule from 'json-bigint';

// 使用模块时进行初始化
const JSONBigInt = JSONBigIntModule({ useNativeBigInt: true });

// 为 jsonStringify 定义重载
export function jsonStringify(value: any, replacer: (key: string, value: any) => any, space?: string | number): string;
export function jsonStringify(value: any, replacer: (string | number)[], space?: string | number): string;
export function jsonStringify(value: any, replacer?: any, space?: string | number): string {
  try {
    // 使用原生 bigint 类型
    return JSONBigInt.stringify(value, replacer, space);
  } catch (error) {
    console.error('Error using JSONBigInt.stringify:', error);
    // 当 JSON 包含浮点数时，使用 bignumber 库
    return JSONBigNumber.stringify(value, replacer, space);
  }
}

export const jsonParse: typeof JSON.parse = (text: string, reviver?: (key: string, value: any) => any) => {
  try {
    // 当 JSON 仅包含整数时，使用原生 bigint 类型
    return JSONBigInt.parse(text, reviver);
  } catch (error) {
    console.error('Error using JSONBigInt.parse:', error);
    try {
      // 当 JSON 包含浮点数时，使用 bignumber 库
      return JSONBigNumber.parse(text, reviver);
    } catch (error) {
      console.error('Error using JSONBigNumber.parse:', error);
      // 验证 JSON 字符串的有效性，若无效则抛出错误
      return JSON.parse(text, reviver);
    }
  }
};
