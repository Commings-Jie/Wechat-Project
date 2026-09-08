/**
 * 按键类型
 */
export enum KeyType {
  DIGIT,      // 数字 0-9 和小数点
  OPERATOR,   // + − × ÷
  FUNCTION,   // C 退格 百分号
  EQUAL,      // 等号
  SCI,        // 科学函数键（sin cos √ π 等）
  EXPAND      // 展开 / 收起科学键盘
}

/**
 * 单个按键的数据模型
 * 颜色不写在这里，由主题决定，这样切换亮/暗色时不用重建按键数据
 */
export default class PressKeysItem {
  text: string;    // 按键显示内容
  type: KeyType;   // 按键类型
  span: number;    // 横向占几列，默认占 1 列

  constructor(text: string, type: KeyType, span: number = 1) {
    this.text = text;
    this.type = type;
    this.span = span;
  }
}
