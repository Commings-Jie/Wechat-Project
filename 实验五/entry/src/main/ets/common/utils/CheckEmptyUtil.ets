/**
 * 判空工具
 */
export default class CheckEmptyUtil {
  static isEmpty(value: string): boolean {
    return value === undefined || value === null || value.length === 0;
  }

  static isNotEmpty(value: string): boolean {
    return !CheckEmptyUtil.isEmpty(value);
  }
}
