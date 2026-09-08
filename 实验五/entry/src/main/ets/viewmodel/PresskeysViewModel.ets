import CommonConstants from '../common/constants/CommonConstants';
import PressKeysItem, { KeyType } from './PressKeysItem';

/**
 * 计算器键盘
 * 基础模式：5 行 × 4 列，左下角是展开按钮（原来的正负号位置）
 * 展开模式：7 行 × 5 列，布局与华为计算器科学键盘一致：
 *   2nd deg sin cos tan / xʸ lg ln ( ) / √x C ⌫ % ÷ /
 *   x! 7 8 9 × / 1/x 4 5 6 − / π 1 2 3 + / 展开 e 0 . =
 */
export function getPressKeys(showSci: boolean, secondMode: boolean, degMode: boolean): PressKeysItem[][] {
  if (!showSci) {
    return [
      // 第一行：清空、退格、百分号、除
      [
        new PressKeysItem(CommonConstants.CLEAR, KeyType.FUNCTION),
        new PressKeysItem(CommonConstants.DELETE, KeyType.FUNCTION),
        new PressKeysItem(CommonConstants.PERCENT, KeyType.FUNCTION),
        new PressKeysItem(CommonConstants.DIV, KeyType.OPERATOR)
      ],
      // 第二行：7 8 9 ×
      [
        new PressKeysItem('7', KeyType.DIGIT),
        new PressKeysItem('8', KeyType.DIGIT),
        new PressKeysItem('9', KeyType.DIGIT),
        new PressKeysItem(CommonConstants.MUL, KeyType.OPERATOR)
      ],
      // 第三行：4 5 6 −
      [
        new PressKeysItem('4', KeyType.DIGIT),
        new PressKeysItem('5', KeyType.DIGIT),
        new PressKeysItem('6', KeyType.DIGIT),
        new PressKeysItem(CommonConstants.SUB, KeyType.OPERATOR)
      ],
      // 第四行：1 2 3 +
      [
        new PressKeysItem('1', KeyType.DIGIT),
        new PressKeysItem('2', KeyType.DIGIT),
        new PressKeysItem('3', KeyType.DIGIT),
        new PressKeysItem(CommonConstants.ADD, KeyType.OPERATOR)
      ],
      // 第五行：展开按钮 0 小数点 等号
      [
        new PressKeysItem(CommonConstants.EXPAND, KeyType.EXPAND),
        new PressKeysItem(CommonConstants.ZERO, KeyType.DIGIT),
        new PressKeysItem(CommonConstants.POINT, KeyType.DIGIT),
        new PressKeysItem(CommonConstants.EQUAL, KeyType.EQUAL)
      ]
    ];
  }
  // 展开模式（与华为计算器样例布局一致）
  let sinLabel: string = secondMode ? CommonConstants.SIN_INV_KEY : CommonConstants.SIN_KEY;
  let cosLabel: string = secondMode ? CommonConstants.COS_INV_KEY : CommonConstants.COS_KEY;
  let tanLabel: string = secondMode ? CommonConstants.TAN_INV_KEY : CommonConstants.TAN_KEY;
  let unitLabel: string = degMode ? CommonConstants.DEG_KEY : CommonConstants.RAD_KEY;
  return [
    // 第一行：2nd deg sin cos tan
    [
      new PressKeysItem(CommonConstants.SECOND_KEY, KeyType.SCI),
      new PressKeysItem(unitLabel, KeyType.SCI),
      new PressKeysItem(sinLabel, KeyType.SCI),
      new PressKeysItem(cosLabel, KeyType.SCI),
      new PressKeysItem(tanLabel, KeyType.SCI)
    ],
    // 第二行：xʸ lg ln ( )
    [
      new PressKeysItem('xʸ', KeyType.SCI),
      new PressKeysItem(CommonConstants.LG_KEY, KeyType.SCI),
      new PressKeysItem(CommonConstants.LN_KEY, KeyType.SCI),
      new PressKeysItem(CommonConstants.LPAREN, KeyType.SCI),
      new PressKeysItem(CommonConstants.RPAREN, KeyType.SCI)
    ],
    // 第三行：√x C ⌫ % ÷
    [
      new PressKeysItem(CommonConstants.SQRT_KEY, KeyType.SCI),
      new PressKeysItem(CommonConstants.CLEAR, KeyType.FUNCTION),
      new PressKeysItem(CommonConstants.DELETE, KeyType.FUNCTION),
      new PressKeysItem(CommonConstants.PERCENT, KeyType.FUNCTION),
      new PressKeysItem(CommonConstants.DIV, KeyType.OPERATOR)
    ],
    // 第四行：x! 7 8 9 ×
    [
      new PressKeysItem(CommonConstants.FACT_KEY, KeyType.SCI),
      new PressKeysItem('7', KeyType.DIGIT),
      new PressKeysItem('8', KeyType.DIGIT),
      new PressKeysItem('9', KeyType.DIGIT),
      new PressKeysItem(CommonConstants.MUL, KeyType.OPERATOR)
    ],
    // 第五行：1/x 4 5 6 −
    [
      new PressKeysItem(CommonConstants.INV_KEY, KeyType.SCI),
      new PressKeysItem('4', KeyType.DIGIT),
      new PressKeysItem('5', KeyType.DIGIT),
      new PressKeysItem('6', KeyType.DIGIT),
      new PressKeysItem(CommonConstants.SUB, KeyType.OPERATOR)
    ],
    // 第六行：π 1 2 3 +
    [
      new PressKeysItem(CommonConstants.PI, KeyType.SCI),
      new PressKeysItem('1', KeyType.DIGIT),
      new PressKeysItem('2', KeyType.DIGIT),
      new PressKeysItem('3', KeyType.DIGIT),
      new PressKeysItem(CommonConstants.ADD, KeyType.OPERATOR)
    ],
    // 第七行：收起按钮 e 0 . =
    [
      new PressKeysItem(CommonConstants.COLLAPSE, KeyType.EXPAND),
      new PressKeysItem(CommonConstants.E, KeyType.SCI),
      new PressKeysItem(CommonConstants.ZERO, KeyType.DIGIT),
      new PressKeysItem(CommonConstants.POINT, KeyType.DIGIT),
      new PressKeysItem(CommonConstants.EQUAL, KeyType.EQUAL)
    ]
  ];
}
