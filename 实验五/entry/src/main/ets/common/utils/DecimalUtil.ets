import CommonConstants from '../constants/CommonConstants';

/**
 * 高精度十进制运算工具
 *
 * 为什么不用 Number 直接算：JS 的 number 是双精度浮点数，
 * 0.1 + 0.2 会得到 0.30000000000000004。
 * 这里把数字当成字符串，按小学竖式逐位计算，结果是精确的。
 */

interface NumParts {
  sign: number;      // 1 正数，-1 负数
  intPart: string;   // 整数部分
  decPart: string;   // 小数部分（不含小数点）
}

export default class DecimalUtil {

  /** 加法 */
  static add(a: string, b: string): string {
    let pa: NumParts = DecimalUtil.parse(a);
    let pb: NumParts = DecimalUtil.parse(b);
    let maxDec: number = Math.max(pa.decPart.length, pb.decPart.length);
    let ia: string = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(pa.intPart + DecimalUtil.padRight(pa.decPart, maxDec)));
    let ib: string = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(pb.intPart + DecimalUtil.padRight(pb.decPart, maxDec)));

    let sign: number = 1;
    let value: string = '';
    if (pa.sign === pb.sign) {
      value = DecimalUtil.addUnsigned(ia, ib);
      sign = pa.sign;
    } else {
      let cmp: number = DecimalUtil.compareUnsigned(ia, ib);
      if (cmp >= 0) {
        value = DecimalUtil.subUnsigned(ia, ib);
        sign = pa.sign;
      } else {
        value = DecimalUtil.subUnsigned(ib, ia);
        sign = pb.sign;
      }
    }
    let result: string = (sign < 0 ? '-' : '') + DecimalUtil.insertPoint(value, maxDec);
    return DecimalUtil.format(result);
  }

  /** 减法 */
  static sub(a: string, b: string): string {
    return DecimalUtil.add(a, DecimalUtil.negate(b));
  }

  /** 乘法 */
  static mul(a: string, b: string): string {
    let pa: NumParts = DecimalUtil.parse(a);
    let pb: NumParts = DecimalUtil.parse(b);
    let ia: string = DecimalUtil.stripLeadingZeros(pa.intPart + pa.decPart);
    let ib: string = DecimalUtil.stripLeadingZeros(pb.intPart + pb.decPart);
    if (ia.length === 0 || ib.length === 0) {
      return '0';
    }
    let value: string = DecimalUtil.mulUnsigned(ia, ib);
    let decLen: number = pa.decPart.length + pb.decPart.length;
    let sign: number = pa.sign * pb.sign;
    let result: string = (sign < 0 ? '-' : '') + DecimalUtil.insertPoint(value, decLen);
    return DecimalUtil.format(result);
  }

  /**
   * 除法
   * @param precision 最多保留的小数位数
   * @throws 除数为 0 时抛异常
   */
  static div(a: string, b: string, precision: number = 10): string {
    let pa: NumParts = DecimalUtil.parse(a);
    let pb: NumParts = DecimalUtil.parse(b);
    let ia: string = DecimalUtil.stripLeadingZeros(pa.intPart + pa.decPart);
    let ib: string = DecimalUtil.stripLeadingZeros(pb.intPart + pb.decPart);
    if (ib.length === 0 || DecimalUtil.isZeroDigits(ib)) {
      throw new Error('division by zero');
    }
    if (ia.length === 0 || DecimalUtil.isZeroDigits(ia)) {
      return '0';
    }
    // a / b = (ia / ib) × 10^(b的小数位 - a的小数位)
    let quotient: string = DecimalUtil.divUnsigned(ia, ib, precision + 1);
    let shift: number = pb.decPart.length - pa.decPart.length;
    quotient = DecimalUtil.shiftPoint(quotient, shift);
    let sign: number = pa.sign * pb.sign;
    let result: string = (sign < 0 ? '-' : '') + quotient;
    return DecimalUtil.format(DecimalUtil.truncate(result, precision));
  }

  /** 取相反数 */
  static negate(a: string): string {
    if (a.length === 0) {
      return a;
    }
    if (a.charAt(0) === '-') {
      return a.substring(1);
    }
    return '-' + a;
  }

  /** 科学计数法还原成普通数字：1.23e+10 → 12300000000 */
  static fromScientific(value: string): string {
    let text: string = value.trim();
    let eIndex: number = text.indexOf('e');
    if (eIndex < 0) {
      eIndex = text.indexOf('E');
    }
    if (eIndex < 0) {
      return text;
    }
    let mantissa: string = text.substring(0, eIndex);
    let exponent: number = parseInt(text.substring(eIndex + 1), 10);
    if (isNaN(exponent)) {
      throw new Error('bad scientific notation');
    }
    return DecimalUtil.format(DecimalUtil.shiftPoint(mantissa, exponent));
  }

  /** 除以 100（百分号用），不会抛异常 */
  static divByHundred(a: string): string {
    return DecimalUtil.format(DecimalUtil.shiftPoint(a, -2));
  }

  /** 值是否为 0 */
  static isZero(value: string): boolean {
    let p: NumParts = DecimalUtil.parse(value);
    return DecimalUtil.isZeroDigits(p.intPart) && DecimalUtil.isZeroDigits(p.decPart);
  }

  /** 幂运算：整数指数走高精度连乘，其余退化到浮点 */
  static pow(a: string, b: string): string {
    let isIntExp: boolean = b.indexOf('.') < 0 && b.indexOf('e') < 0 && b.indexOf('E') < 0;
    if (isIntExp) {
      let n: number = Number(b);
      if (!isNaN(n) && Math.abs(n) <= 512) {
        let result: string = '1';
        for (let i: number = 0; i < Math.abs(n); i++) {
          result = DecimalUtil.mul(result, a);
        }
        if (n < 0) {
          // 0 的负次幂无意义，直接按出错处理
          if (DecimalUtil.isZero(result)) {
            throw new Error('division by zero');
          }
          try {
            result = DecimalUtil.div('1', result, CommonConstants.MAX_FRACTION);
          } catch (e) {
            throw new Error('division by zero');
          }
        }
        return result;
      }
    }
    let v: number = Math.pow(Number(a), Number(b));
    if (isNaN(v) || !isFinite(v)) {
      throw new Error('pow error');
    }
    let text: string = v.toPrecision(12);
    if (text.indexOf('e') >= 0 || text.indexOf('E') >= 0) {
      return DecimalUtil.fromScientific(text);
    }
    return DecimalUtil.format(text);
  }

  /** 规范化显示：去掉多余的 0，避免出现 0.3000 或 -0 */
  static format(value: string): string {
    let p: NumParts = DecimalUtil.parse(value);
    let intPart: string = DecimalUtil.stripLeadingZeros(p.intPart);
    if (intPart.length === 0) {
      intPart = '0';
    }
    let decPart: string = DecimalUtil.stripTrailingZeros(p.decPart);
    let body: string = decPart.length > 0 ? intPart + '.' + decPart : intPart;
    if (DecimalUtil.isZeroDigits(intPart) && DecimalUtil.isZeroDigits(decPart)) {
      return '0';
    }
    return (p.sign < 0 ? '-' : '') + body;
  }

  /**
   * 判断要不要切成科学计数法：整数部分超过 9 位，或者小到 1e-6 以下
   */
  static needScientific(value: string): boolean {
    let p: NumParts = DecimalUtil.parse(value);
    if (DecimalUtil.isZeroDigits(p.intPart) && DecimalUtil.isZeroDigits(p.decPart)) {
      return false;
    }
    let intLength: number = DecimalUtil.stripLeadingZeros(p.intPart).length;
    if (intLength > CommonConstants.SCIENTIFIC_UPPER) {
      return true;
    }
    if (intLength > 0) {
      return false;
    }
    let zeros: number = 0;
    for (let i: number = 0; i < p.decPart.length; i++) {
      if (p.decPart.charAt(i) === '0') {
        zeros++;
      } else {
        break;
      }
    }
    return zeros >= CommonConstants.SCIENTIFIC_LOWER;
  }

  /**
   * 转科学计数法，例如 12345678901 → 1.23456789e+10
   * @param digits 有效数字位数
   */
  static toScientific(value: string, digits: number): string {
    let p: NumParts = DecimalUtil.parse(value);
    let all: string = p.intPart + p.decPart;
    let significant: string = DecimalUtil.stripLeadingZeros(all);
    if (significant.length === 0) {
      return '0';
    }
    // 值 = significant × 10^(小数位数的相反数)，写成 s.ddd × 10^exp
    let exponent: number = (significant.length - 1) - p.decPart.length;
    let keep: string = significant.length > digits ? significant.substring(0, digits) : significant;
    let mantissa: string = keep.charAt(0);
    let rest: string = DecimalUtil.stripTrailingZeros(keep.substring(1));
    if (rest.length > 0) {
      mantissa = mantissa + '.' + rest;
    }
    let sign: string = p.sign < 0 ? '-' : '';
    let expText: string = exponent >= 0 ? 'e+' + exponent.toString() : 'e' + exponent.toString();
    return sign + mantissa + expText;
  }

  // ---------------- 内部辅助方法 ----------------

  /** 拆分出符号、整数部分、小数部分 */
  private static parse(value: string): NumParts {
    let sign: number = 1;
    let text: string = value.trim();
    if (text.length > 0 && text.charAt(0) === '-') {
      sign = -1;
      text = text.substring(1);
    } else if (text.length > 0 && text.charAt(0) === '+') {
      text = text.substring(1);
    }
    let intPart: string = '0';
    let decPart: string = '';
    let dotIndex: number = text.indexOf('.');
    if (dotIndex >= 0) {
      intPart = text.substring(0, dotIndex);
      decPart = text.substring(dotIndex + 1);
    } else if (text.length > 0) {
      intPart = text;
    }
    if (intPart.length === 0) {
      intPart = '0';
    }
    let parts: NumParts = { sign: sign, intPart: intPart, decPart: decPart };
    return parts;
  }

  /** 在倒数第 decLen 位前插入小数点 */
  private static insertPoint(value: string, decLen: number): string {
    if (decLen <= 0) {
      return value;
    }
    let v: string = value;
    while (v.length <= decLen) {
      v = '0' + v;
    }
    return v.substring(0, v.length - decLen) + '.' + v.substring(v.length - decLen);
  }

  /** 小数点右移 n 位（n 为负则左移） */
  private static shiftPoint(value: string, n: number): string {
    let p: NumParts = DecimalUtil.parse(value);
    let digits: string = p.intPart + p.decPart;
    let sign: string = p.sign < 0 ? '-' : '';
    let pos: number = p.intPart.length + n;
    if (pos <= 0) {
      return sign + '0.' + DecimalUtil.repeatZero(0 - pos) + digits;
    }
    if (pos >= digits.length) {
      return sign + digits + DecimalUtil.repeatZero(pos - digits.length);
    }
    return sign + digits.substring(0, pos) + '.' + digits.substring(pos);
  }

  /** 截断小数位 */
  private static truncate(value: string, precision: number): string {
    let p: NumParts = DecimalUtil.parse(value);
    let dec: string = p.decPart;
    if (dec.length > precision) {
      dec = dec.substring(0, precision);
    }
    let sign: string = p.sign < 0 ? '-' : '';
    let intPart: string = p.intPart.length === 0 ? '0' : p.intPart;
    return sign + intPart + (dec.length > 0 ? '.' + dec : '');
  }

  /** 两个非负整数字符串相加 */
  private static addUnsigned(a: string, b: string): string {
    let carry: number = 0;
    let result: string = '';
    let i: number = a.length - 1;
    let j: number = b.length - 1;
    while (i >= 0 || j >= 0 || carry > 0) {
      let da: number = i >= 0 ? Number(a.charAt(i)) : 0;
      let db: number = j >= 0 ? Number(b.charAt(j)) : 0;
      let sum: number = da + db + carry;
      result = (sum % 10).toString() + result;
      carry = Math.floor(sum / 10);
      i--;
      j--;
    }
    return result.length === 0 ? '0' : result;
  }

  /** 两个非负整数字符串相减，要求 a >= b */
  private static subUnsigned(a: string, b: string): string {
    let borrow: number = 0;
    let result: string = '';
    let i: number = a.length - 1;
    let j: number = b.length - 1;
    while (i >= 0) {
      let da: number = Number(a.charAt(i)) - borrow;
      let db: number = j >= 0 ? Number(b.charAt(j)) : 0;
      if (da < db) {
        da = da + 10;
        borrow = 1;
      } else {
        borrow = 0;
      }
      result = (da - db).toString() + result;
      i--;
      j--;
    }
    return DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(result));
  }

  /** 两个非负整数字符串相乘（竖式） */
  private static mulUnsigned(a: string, b: string): string {
    let len: number = a.length + b.length;
    let res: number[] = new Array<number>(len);
    for (let k: number = 0; k < len; k++) {
      res[k] = 0;
    }
    for (let i: number = a.length - 1; i >= 0; i--) {
      for (let j: number = b.length - 1; j >= 0; j--) {
        let pos: number = i + j + 1;
        let sum: number = Number(a.charAt(i)) * Number(b.charAt(j)) + res[pos];
        res[pos] = sum % 10;
        res[pos - 1] = res[pos - 1] + Math.floor(sum / 10);
      }
    }
    let out: string = '';
    for (let k: number = 0; k < len; k++) {
      out = out + res[k].toString();
    }
    return DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(out));
  }

  /** 两个非负整数字符串相除（长除法），返回带小数的商 */
  private static divUnsigned(a: string, b: string, precision: number): string {
    if (b.length === 0 || DecimalUtil.isZeroDigits(b)) {
      throw new Error('division by zero');
    }
    let remainder: string = '0';
    let intPart: string = '';
    for (let i: number = 0; i < a.length; i++) {
      remainder = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(remainder + a.charAt(i)));
      let digit: number = 0;
      while (DecimalUtil.compareUnsigned(remainder, b) >= 0) {
        remainder = DecimalUtil.toSafe(DecimalUtil.subUnsigned(remainder, b));
        digit++;
      }
      intPart = intPart + digit.toString();
    }
    intPart = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(intPart));
    if (precision <= 0 || DecimalUtil.isZeroDigits(remainder)) {
      return intPart;
    }
    let frac: string = '';
    for (let i: number = 0; i < precision; i++) {
      remainder = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(remainder + '0'));
      let digit: number = 0;
      while (DecimalUtil.compareUnsigned(remainder, b) >= 0) {
        remainder = DecimalUtil.toSafe(DecimalUtil.subUnsigned(remainder, b));
        digit++;
      }
      frac = frac + digit.toString();
      if (DecimalUtil.isZeroDigits(remainder)) {
        break;
      }
    }
    frac = DecimalUtil.stripTrailingZeros(frac);
    if (frac.length === 0) {
      return intPart;
    }
    return intPart + '.' + frac;
  }

  /** 比较两个非负整数字符串大小 */
  private static compareUnsigned(a: string, b: string): number {
    let x: string = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(a));
    let y: string = DecimalUtil.toSafe(DecimalUtil.stripLeadingZeros(b));
    if (x.length > y.length) {
      return 1;
    }
    if (x.length < y.length) {
      return -1;
    }
    for (let i: number = 0; i < x.length; i++) {
      if (x.charAt(i) > y.charAt(i)) {
        return 1;
      }
      if (x.charAt(i) < y.charAt(i)) {
        return -1;
      }
    }
    return 0;
  }

  private static stripLeadingZeros(value: string): string {
    let i: number = 0;
    while (i < value.length && value.charAt(i) === '0') {
      i++;
    }
    return value.substring(i);
  }

  private static stripTrailingZeros(value: string): string {
    let i: number = value.length - 1;
    while (i >= 0 && value.charAt(i) === '0') {
      i--;
    }
    return i < 0 ? '' : value.substring(0, i + 1);
  }

  private static padRight(value: string, len: number): string {
    let out: string = value;
    while (out.length < len) {
      out = out + '0';
    }
    return out;
  }

  private static repeatZero(count: number): string {
    let out: string = '';
    for (let i: number = 0; i < count; i++) {
      out = out + '0';
    }
    return out;
  }

  private static isZeroDigits(value: string): boolean {
    if (value.length === 0) {
      return true;
    }
    for (let i: number = 0; i < value.length; i++) {
      if (value.charAt(i) !== '0') {
        return false;
      }
    }
    return true;
  }

  private static toSafe(value: string): string {
    return value.length === 0 ? '0' : value;
  }
}
