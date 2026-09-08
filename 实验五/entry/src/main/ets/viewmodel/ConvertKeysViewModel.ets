import ConvertKeysItem, { ConvertKeyType } from './ConvertKeysItem';

/**
 * 换算键盘数据源
 * 标准布局（长度/重量/面积/体积/时间/速度）：4 列 × 5 行
 * 进制布局：4 列 × 5 行，带 A-F
 * 温度布局：4 列 × 4 行
 */
export enum ConvertKeyboardType {
  STANDARD,
  HEX,
  TEMP
}

export function getConvertKeys(type: ConvertKeyboardType): ConvertKeysItem[][] {
  switch (type) {
    case ConvertKeyboardType.HEX:
      return [
        [
          new ConvertKeysItem('C', ConvertKeyType.FUNC),
          new ConvertKeysItem('⌫', ConvertKeyType.FUNC),
          new ConvertKeysItem('F', ConvertKeyType.DIGIT),
          new ConvertKeysItem('E', ConvertKeyType.DIGIT)
        ],
        [
          new ConvertKeysItem('7', ConvertKeyType.DIGIT),
          new ConvertKeysItem('8', ConvertKeyType.DIGIT),
          new ConvertKeysItem('9', ConvertKeyType.DIGIT),
          new ConvertKeysItem('D', ConvertKeyType.DIGIT)
        ],
        [
          new ConvertKeysItem('4', ConvertKeyType.DIGIT),
          new ConvertKeysItem('5', ConvertKeyType.DIGIT),
          new ConvertKeysItem('6', ConvertKeyType.DIGIT),
          new ConvertKeysItem('C', ConvertKeyType.DIGIT)
        ],
        [
          new ConvertKeysItem('1', ConvertKeyType.DIGIT),
          new ConvertKeysItem('2', ConvertKeyType.DIGIT),
          new ConvertKeysItem('3', ConvertKeyType.DIGIT),
          new ConvertKeysItem('B', ConvertKeyType.DIGIT)
        ],
        [
          new ConvertKeysItem('00', ConvertKeyType.DIGIT),
          new ConvertKeysItem('0', ConvertKeyType.DIGIT),
          new ConvertKeysItem('.', ConvertKeyType.DOT),
          new ConvertKeysItem('A', ConvertKeyType.DIGIT)
        ]
      ];
    case ConvertKeyboardType.TEMP:
      return [
        [
          new ConvertKeysItem('7', ConvertKeyType.DIGIT),
          new ConvertKeysItem('8', ConvertKeyType.DIGIT),
          new ConvertKeysItem('9', ConvertKeyType.DIGIT),
          new ConvertKeysItem('C', ConvertKeyType.FUNC)
        ],
        [
          new ConvertKeysItem('4', ConvertKeyType.DIGIT),
          new ConvertKeysItem('5', ConvertKeyType.DIGIT),
          new ConvertKeysItem('6', ConvertKeyType.DIGIT),
          new ConvertKeysItem('⌫', ConvertKeyType.FUNC)
        ],
        [
          new ConvertKeysItem('1', ConvertKeyType.DIGIT),
          new ConvertKeysItem('2', ConvertKeyType.DIGIT),
          new ConvertKeysItem('3', ConvertKeyType.DIGIT),
          new ConvertKeysItem('+/-', ConvertKeyType.SIGN)
        ],
        [
          new ConvertKeysItem('00', ConvertKeyType.DIGIT),
          new ConvertKeysItem('0', ConvertKeyType.DIGIT),
          new ConvertKeysItem('.', ConvertKeyType.DOT),
          new ConvertKeysItem('', ConvertKeyType.EMPTY)
        ]
      ];
    default:
      // 标准换算键盘
      return [
        [
          new ConvertKeysItem('C', ConvertKeyType.FUNC),
          new ConvertKeysItem('⌫', ConvertKeyType.FUNC),
          new ConvertKeysItem('%', ConvertKeyType.OP),
          new ConvertKeysItem('÷', ConvertKeyType.OP)
        ],
        [
          new ConvertKeysItem('7', ConvertKeyType.DIGIT),
          new ConvertKeysItem('8', ConvertKeyType.DIGIT),
          new ConvertKeysItem('9', ConvertKeyType.DIGIT),
          new ConvertKeysItem('×', ConvertKeyType.OP)
        ],
        [
          new ConvertKeysItem('4', ConvertKeyType.DIGIT),
          new ConvertKeysItem('5', ConvertKeyType.DIGIT),
          new ConvertKeysItem('6', ConvertKeyType.DIGIT),
          new ConvertKeysItem('−', ConvertKeyType.OP)
        ],
        [
          new ConvertKeysItem('1', ConvertKeyType.DIGIT),
          new ConvertKeysItem('2', ConvertKeyType.DIGIT),
          new ConvertKeysItem('3', ConvertKeyType.DIGIT),
          new ConvertKeysItem('+', ConvertKeyType.OP)
        ],
        [
          new ConvertKeysItem('00', ConvertKeyType.DIGIT),
          new ConvertKeysItem('0', ConvertKeyType.DIGIT),
          new ConvertKeysItem('.', ConvertKeyType.DOT),
          new ConvertKeysItem('=', ConvertKeyType.OP)
        ]
      ];
  }
}
