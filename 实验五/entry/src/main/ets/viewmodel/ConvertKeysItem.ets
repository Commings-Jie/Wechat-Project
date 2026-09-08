/**
 * 换算键盘按键类型
 */
export enum ConvertKeyType {
  DIGIT,    // 数字、00、A-F
  FUNC,     // C、退格
  OP,       // 运算符与等号（仅用于占位布局，换算页不响应运算）
  SIGN,     // 正负号
  DOT,      // 小数点
  EMPTY     // 占位空白键
}

/**
 * 单个换算键盘按键
 */
export default class ConvertKeysItem {
  text: string;
  type: ConvertKeyType;

  constructor(text: string, type: ConvertKeyType) {
    this.text = text;
    this.type = type;
  }
}
