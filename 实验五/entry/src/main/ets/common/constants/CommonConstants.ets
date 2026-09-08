/**
 * 计算器公共常量
 */
export default class CommonConstants {
  // 运算符（界面显示符号）
  static readonly ADD: string = '+';
  static readonly SUB: string = '−';
  static readonly MUL: string = '×';
  static readonly DIV: string = '÷';
  static readonly PERCENT: string = '%';

  // 功能键
  static readonly POINT: string = '.';
  static readonly EQUAL: string = '=';
  static readonly CLEAR: string = 'C';
  static readonly DELETE: string = '⌫';
  static readonly NEGATE: string = '+/-';

  // 括号 / 幂运算
  static readonly LPAREN: string = '(';
  static readonly RPAREN: string = ')';
  static readonly POW: string = '^';

  // 科学函数键（按键上显示的文字）
  static readonly SIN_KEY: string = 'sin';
  static readonly COS_KEY: string = 'cos';
  static readonly TAN_KEY: string = 'tan';
  static readonly LG_KEY: string = 'lg';
  static readonly LN_KEY: string = 'ln';
  static readonly SQRT_KEY: string = '√x';
  static readonly SQR_KEY: string = 'x²';
  static readonly FACT_KEY: string = 'x!';
  static readonly INV_KEY: string = '1/x';

  // 2nd 切换出的反三角函数键
  static readonly SECOND_KEY: string = '2nd';
  static readonly SIN_INV_KEY: string = 'sin⁻¹';
  static readonly COS_INV_KEY: string = 'cos⁻¹';
  static readonly TAN_INV_KEY: string = 'tan⁻¹';
  static readonly ASIN: string = 'asin';
  static readonly ACOS: string = 'acos';
  static readonly ATAN: string = 'atan';

  // deg / rad 角度弧度切换键
  static readonly DEG_KEY: string = 'deg';
  static readonly RAD_KEY: string = 'rad';

  // 常量按键与对应数值
  static readonly PI: string = 'π';
  static readonly E: string = 'e';
  static readonly PI_VALUE: string = '3.14159265358979';
  static readonly E_VALUE: string = '2.71828182845905';

  // 后缀运算符（写入表达式里的真实字符）
  static readonly SQR: string = '²';
  static readonly FACT: string = '!';
  static readonly INV: string = '⁻¹';

  // 展开 / 收起科学键盘按钮
  static readonly EXPAND: string = '▾';
  static readonly COLLAPSE: string = '▴';

  // 数字
  static readonly ZERO: string = '0';

  // 除法最多保留的小数位数
  static readonly MAX_FRACTION: number = 10;

  // 科学计数法保留的有效数字位数
  static readonly SIGNIFICANT_DIGITS: number = 9;

  // 数值太长（整数部分超过 12 位）或太小（≤1e-6）时改用科学计数法显示
  static readonly SCIENTIFIC_UPPER: number = 12;
  static readonly SCIENTIFIC_LOWER: number = 6;

  // 历史记录
  static readonly MAX_HISTORY: number = 20;
  static readonly HISTORY_SEPARATOR: string = '|';
  static readonly HISTORY_EQUAL: string = '#';

  // 出错时的提示文案
  static readonly RESULT_ERROR: string = '出错';
}
