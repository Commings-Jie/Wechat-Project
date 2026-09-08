import { Category, findUnit, Unit } from '../constants/ConvertConstants';

/**
 * 换算核心工具
 */
export default class ConvertUtil {

  /**
   * 执行一次换算
   * @param value 输入字符串（可能带千分位逗号）
   * @param fromId 源单位 ID
   * @param toId 目标单位 ID
   * @param category 类目
   * @returns 结果字符串
   */
  static convert(value: string, fromId: string, toId: string, category: Category): string {
    let raw: string = value.replace(/,/g, '').replace(/−/g, '-');
    if (raw === '' || raw === '-') {
      return '';
    }
    // 进制输入可能是 A-F，不能走 Number()，先处理
    if (category.type === 'radix') {
      return ConvertUtil.convertRadix(raw, fromId, toId, category);
    }
    let num: number = Number(raw);
    if (isNaN(num)) {
      return '';
    }
    if (category.type === 'temperature') {
      return ConvertUtil.convertTemperature(num, fromId, toId);
    }
    return ConvertUtil.convertRatio(num, fromId, toId, category);
  }

  /** 比值类换算：通过基准单位中转 */
  private static convertRatio(num: number, fromId: string, toId: string, category: Category): string {
    let fromUnit: Unit | undefined = findUnit(category, fromId);
    let toUnit: Unit | undefined = findUnit(category, toId);
    if (!fromUnit || !toUnit || fromUnit.factor === undefined || toUnit.factor === undefined) {
      return '';
    }
    let result: number = num * fromUnit.factor / toUnit.factor;
    return ConvertUtil.formatNumber(result);
  }

  /** 温度换算：摄氏度/华氏度/开尔文 */
  private static convertTemperature(num: number, fromId: string, toId: string): string {
    // 统一先转摄氏度
    let celsius: number = num;
    if (fromId === 'f') {
      celsius = (num - 32) * 5 / 9;
    } else if (fromId === 'k') {
      celsius = num - 273.15;
    }
    let result: number = celsius;
    if (toId === 'f') {
      result = celsius * 9 / 5 + 32;
    } else if (toId === 'k') {
      result = celsius + 273.15;
    }
    return ConvertUtil.formatNumber(result);
  }

  /** 进制换算：2/8/10/16 互转 */
  private static convertRadix(raw: string, fromId: string, toId: string, category: Category): string {
    let fromUnit: Unit | undefined = findUnit(category, fromId);
    let toUnit: Unit | undefined = findUnit(category, toId);
    if (!fromUnit || !toUnit || fromUnit.base === undefined || toUnit.base === undefined) {
      return '';
    }
    // 支持负数
    let negative: boolean = false;
    let input: string = raw;
    if (input.charAt(0) === '-') {
      negative = true;
      input = input.substring(1);
    }
    // 去掉小数点，进制只处理整数
    let dotIndex: number = input.indexOf('.');
    if (dotIndex >= 0) {
      input = input.substring(0, dotIndex);
    }
    let decimal: number = parseInt(input, fromUnit.base);
    if (!isFinite(decimal) || isNaN(decimal)) {
      return '';
    }
    let out: string = decimal.toString(toUnit.base).toUpperCase();
    return negative ? '-' + out : out;
  }

  /**
   * 格式化数字：去掉末尾无意义的 0，加千分位
   * 结果最多保留 10 位小数
   */
  static formatNumber(num: number): string {
    if (!isFinite(num) || isNaN(num)) {
      return '';
    }
    // 极小值直接归零
    if (Math.abs(num) < 1e-15) {
      return '0';
    }
    // 先用 10 位小数转成字符串
    let fixed: string = num.toFixed(10);
    // 去掉末尾的 0
    if (fixed.indexOf('.') >= 0) {
      fixed = fixed.replace(/\.?0+$/, '');
    }
    // 加千分位
    return ConvertUtil.addCommas(fixed);
  }

  /** 给整数部分加千分位逗号 */
  private static addCommas(text: string): string {
    if (text.indexOf('e') >= 0 || text.indexOf('E') >= 0) {
      return text;
    }
    let negative: boolean = false;
    if (text.charAt(0) === '-') {
      negative = true;
      text = text.substring(1);
    }
    let parts: string[] = text.split('.');
    let intPart: string = parts[0];
    let decPart: string = parts.length > 1 ? parts[1] : '';
    let out: string = '';
    let count: number = 0;
    for (let i: number = intPart.length - 1; i >= 0; i--) {
      out = intPart.charAt(i) + out;
      count++;
      if (count === 3 && i > 0) {
        out = ',' + out;
        count = 0;
      }
    }
    if (decPart.length > 0) {
      out = out + '.' + decPart;
    }
    return negative ? '-' + out : out;
  }

  /**
   * 格式化输入显示：给输入字符串加千分位
   */
  static formatInput(value: string): string {
    if (value === '' || value === '−') {
      return value;
    }
    let raw: string = value.replace(/,/g, '').replace(/−/g, '-');
    let negative: boolean = false;
    if (raw.charAt(0) === '-') {
      negative = true;
      raw = raw.substring(1);
    }
    let out: string;
    if (raw.indexOf('.') >= 0) {
      let parts: string[] = raw.split('.');
      out = ConvertUtil.addCommas(parts[0]) + '.' + parts[1];
    } else {
      out = ConvertUtil.addCommas(raw);
    }
    return negative ? '−' + out : out;
  }

  /**
   * 换算结果写回输入框前转成「内部原始串」：去掉千分位，负号统一成 −
   * （输入框里只存能被继续编辑的纯值，显示时再走 formatInput 加千分位）
   */
  static toInternal(value: string): string {
    let raw: string = value.replace(/,/g, '');
    if (raw.charAt(0) === '-') {
      raw = '−' + raw.substring(1);
    }
    return raw;
  }

  /** 判断字符是否允许作为进制键盘输入 */
  static isValidRadixChar(c: string, base: number): boolean {
    if (c >= '0' && c <= '9') {
      return c.charCodeAt(0) - '0'.charCodeAt(0) < base;
    }
    if (c >= 'A' && c <= 'F') {
      return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10 < base;
    }
    if (c >= 'a' && c <= 'f') {
      return c.charCodeAt(0) - 'a'.charCodeAt(0) + 10 < base;
    }
    return false;
  }

  /** 判断整段值（可带负号）是否全部符合当前进制 */
  static isValidRadixValue(value: string, base: number): boolean {
    if (value === '') {
      return true;
    }
    let start: number = value.charAt(0) === '−' ? 1 : 0;
    for (let i: number = start; i < value.length; i++) {
      if (!ConvertUtil.isValidRadixChar(value.charAt(i), base)) {
        return false;
      }
    }
    return true;
  }
}
