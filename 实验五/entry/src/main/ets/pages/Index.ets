import CommonConstants from '../common/constants/CommonConstants';
import { DARK_THEME, LIGHT_THEME, ThemeColors } from '../common/constants/ThemeColors';
import CalculateUtil from '../common/utils/CalculateUtil';
import CheckEmptyUtil from '../common/utils/CheckEmptyUtil';
import Logger from '../common/utils/Logger';
import { KEY_HISTORY, KEY_IS_DARK, PreferencesUtil } from '../common/utils/PreferencesUtil';
import PressKeysItem, { KeyType } from '../viewmodel/PressKeysItem';
import { getPressKeys } from '../viewmodel/PresskeysViewModel';

const TAG: string = 'Index';

/**
 * 计算器主页面
 *
 * 顶部右上角三个点菜单（历史 / 主题切换）
 * 中部：输入式（大粗黑） + 结果（小，前缀 =）
 * 底部：基础键盘 5×4，左下角展开按钮可切出 7×5 科学键盘
 */
@Entry
@Component
struct Index {
  // 当前输入的表达式，变化时用 @Watch 触发重新计算
  @State @Watch('onInputChange') inputValue: string = '';
  // 显示的结果
  @State result: string = '0';
  @State showHistory: boolean = false;
  // 是否展开科学键盘
  @State showSci: boolean = false;
  // 2nd 键：切换出反三角函数
  @State secondMode: boolean = false;
  // true 角度制（deg），false 弧度制（rad）
  @State degMode: boolean = true;
  // 这两个启动时从本地读出来，改动时再写回本地
  @StorageLink('isDark') @Watch('onThemeChange') isDark: boolean = false;
  @StorageLink('history') @Watch('onHistoryChange') historyText: string = '';

  private calculator: CalculateUtil = new CalculateUtil();
  // 刚按下等号：此时输入式缩小变次要、结果放大加粗变主视觉（对齐样例），再输入数字则重新开始一轮
  @State justEvaluated: boolean = false;
  // 等号计算的表达式，等号后顶部小字显示它
  @State lastExpression: string = '';

  /** 输入变化监听：实时把表达式算一遍，把结果刷新到结果区 */
  onInputChange(): void {
    if (CheckEmptyUtil.isEmpty(this.inputValue)) {
      this.result = '0';
      return;
    }
    this.result = this.calculator.evaluate(this.balanceParens(this.inputValue), this.degMode);
  }

  /** 主题变化后落盘 */
  onThemeChange(): void {
    PreferencesUtil.put(KEY_IS_DARK, this.isDark);
  }

  /** 历史变化后落盘 */
  onHistoryChange(): void {
    PreferencesUtil.put(KEY_HISTORY, this.historyText);
  }

  private theme(): ThemeColors {
    return this.isDark ? DARK_THEME : LIGHT_THEME;
  }

  build() {
    Column() {
      this.ToolBar()
      if (this.showHistory) {
        this.HistoryPanel()
      } else {
        this.DisplayArea()
      }
      this.KeyboardArea()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme().pageBg)
    .padding({ left: 12, right: 12, top: 16, bottom: 24 })
  }

  @Builder
  ToolBar() {
    // 用 Stack：Tab 行占满整宽居中，右上角 ⋮ 绝对靠右，两者互不影响
    Stack({ alignContent: Alignment.End }) {
      Row() {
        Blank()
          .layoutWeight(1)

        // 计算 Tab（当前页高亮）
        Text('计算')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().primaryText)

        Blank()
          .width(24)

        // 换算 Tab（点击进入换算首页）
        Text('换算')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme().secondaryText)
          .onClick(() => {
            this.getUIContext().getRouter().pushUrl({ url: 'pages/ConvertHome' });
          })

        Blank()
          .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // 右上角三个点，点击弹出菜单（无背景、无边框）
      Text('⋮')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().primaryText)
        .padding({ left: 14, right: 14, top: 2, bottom: 2 })
        .bindMenu([
          {
            value: this.showHistory ? '返回计算' : '历史记录',
            action: () => {
              this.showHistory = !this.showHistory;
            }
          },
          {
            value: this.isDark ? '☀  切换亮色' : '☾  切换暗色',
            action: () => {
              this.isDark = !this.isDark;
            }
          }
        ])
    }
    .width('100%')
    .padding({ bottom: 10 })
  }

  @Builder
  DisplayArea() {
    Column() {
      // 上：未按等号时是输入式（大、粗、黑）；按等号后退居小字
      Text(this.topText())
        .fontSize(this.topFontSize())
        .fontWeight(this.justEvaluated ? FontWeight.Normal : FontWeight.Bold)
        .fontColor(this.theme().primaryText)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.End)
        .width('100%')

      // 下：未按等号时是实时结果（小、灰、前缀 =）；按等号后变成主视觉（大、粗、黑）
      Text(this.result === CommonConstants.RESULT_ERROR ? this.result : '= ' + this.result)
        .fontSize(this.resultFontSize())
        .fontWeight(this.justEvaluated && this.result !== CommonConstants.RESULT_ERROR
          ? FontWeight.Bold : FontWeight.Normal)
        .fontColor(this.result === CommonConstants.RESULT_ERROR
          ? this.theme().errorText
          : (this.justEvaluated ? this.theme().primaryText : this.theme().secondaryText))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.End)
        .width('100%')
        .margin({ top: 6 })
    }
    .width('100%')
    .layoutWeight(3)
    .justifyContent(FlexAlign.End)
    .padding({ left: 16, right: 16, top: 12, bottom: 12 })
    .margin({ bottom: 10 })
  }

  /** 顶部文字：等号后显示原表达式，其余显示输入 */
  private topText(): string {
    if (this.justEvaluated && !CheckEmptyUtil.isEmpty(this.lastExpression)) {
      return this.lastExpression;
    }
    return CheckEmptyUtil.isEmpty(this.inputValue) ? '0' : this.inputValue;
  }

  /** 顶部字号：等号前是主视觉（大），等号后变次要（小） */
  private topFontSize(): number {
    if (!this.justEvaluated) {
      return this.inputFontSize();
    }
    let len: number = this.lastExpression.length;
    if (len <= 12) {
      return 26;
    }
    if (len <= 18) {
      return 22;
    }
    return 18;
  }

  @Builder
  HistoryPanel() {
    Column() {
      if (CheckEmptyUtil.isEmpty(this.historyText)) {
        Column() {
          Text('还没有计算记录')
            .fontSize(16)
            .fontColor(this.theme().secondaryText)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        List() {
          ForEach(this.getHistoryList(), (item: string) => {
            ListItem() {
              Column() {
                Text(this.historyExpression(item))
                  .fontSize(14)
                  .fontColor(this.theme().secondaryText)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .width('100%')
                  .textAlign(TextAlign.End)
                Text('= ' + this.historyValue(item))
                  .fontSize(22)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme().primaryText)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .width('100%')
                  .textAlign(TextAlign.End)
                  .margin({ top: 4 })
              }
              .width('100%')
              .alignItems(HorizontalAlign.End)
              .padding({ left: 16, right: 16, top: 10, bottom: 10 })
              .onClick(() => {
                this.useHistory(item);
              })
            }
          }, (item: string, index: number) => index.toString())
        }
        .layoutWeight(1)
        .divider({ strokeWidth: 0.5, color: this.theme().divider, startMargin: 16, endMargin: 16 })

        Text('清空历史')
          .fontSize(15)
          .fontColor(this.theme().errorText)
          .padding({ top: 10, bottom: 6 })
          .onClick(() => {
            this.clearHistory();
          })
      }
    }
    .width('100%')
    .layoutWeight(3)
    .padding({ top: 6, bottom: 6 })
    .backgroundColor(this.theme().panelBg)
    .borderRadius(20)
    .margin({ bottom: 10 })
  }

  @Builder
  KeyboardArea() {
    Column() {
      ForEach(getPressKeys(this.showSci, this.secondMode, this.degMode), (row: PressKeysItem[]) => {
        Row() {
          ForEach(row, (item: PressKeysItem) => {
            Button(item.text)
              .type(ButtonType.Normal)
              .fontSize(this.keyFontSize(item))
              .fontColor(this.keyTextColor(item))
              .fontWeight(FontWeight.Medium)
              .backgroundColor(this.keyBgColor(item))
              .borderRadius(20)
              .layoutWeight(item.span)
              .height('100%')
              .margin({ left: 5, right: 5 })
              .onClick(() => {
                this.onKeyClick(item);
              })
          }, (item: PressKeysItem) => item.text)
        }
        .width('100%')
        .layoutWeight(1)
        .margin({ top: 5, bottom: 5 })
      }, (row: PressKeysItem[], rowIndex: number) => {
        // key 里带上键盘状态：展开/2nd/deg 任一变化都整组重建，否则 ForEach 复用旧行导致布局错乱
        let prefix: string = (this.showSci ? 'sci' : 'base') +
          (this.secondMode ? '-2nd' : '') + (this.degMode ? '-deg' : '-rad');
        return prefix + '-' + rowIndex;
      })
    }
    .width('100%')
    .layoutWeight(7)
  }

  private onKeyClick(item: PressKeysItem): void {
    // 在历史页面按任意键，先切回计算界面，否则输入了也看不见
    if (this.showHistory) {
      this.showHistory = false;
    }
    if (item.type === KeyType.EXPAND) {
      this.showSci = !this.showSci;
      return;
    }
    if (item.type === KeyType.FUNCTION) {
      this.handleFunction(item.text);
      return;
    }
    if (item.type === KeyType.EQUAL) {
      this.handleEqual();
      return;
    }
    if (item.type === KeyType.SCI) {
      this.handleSci(item.text);
      return;
    }
    if (item.type === KeyType.OPERATOR) {
      this.handleOperator(item.text);
      return;
    }
    this.handleDigit(item.text);
  }

  /** 数字键和小数点 */
  private handleDigit(text: string): void {
    if (this.justEvaluated) {
      // 算完一轮后再按数字，直接开始新表达式
      this.inputValue = text === CommonConstants.POINT ? '0.' : text;
      this.justEvaluated = false;
      return;
    }
    let last: string = this.lastChar();
    // 这些符号后面不能直接接数字，避免 5)2、50%2 这种非法表达式
    if (last === CommonConstants.RPAREN || last === CommonConstants.SQR || last === CommonConstants.FACT ||
      last === CommonConstants.PERCENT || last === '¹' || last === CommonConstants.PI || last === CommonConstants.E) {
      return;
    }
    if (text !== CommonConstants.POINT) {
      // 修复前导零：表达式末尾的数字是 0（或 −0）时直接替换，0 再按 2 显示 2 而不是 02
      let start: number = this.lastNumberStart(this.inputValue);
      let current: string = this.inputValue.substring(start);
      if (current === '0') {
        this.inputValue = this.inputValue.substring(0, start) + text;
        return;
      }
      if (current === CommonConstants.SUB + '0') {
        this.inputValue = this.inputValue.substring(0, start) + CommonConstants.SUB + text;
        return;
      }
    }
    if (text === CommonConstants.POINT) {
      if (CheckEmptyUtil.isEmpty(this.inputValue) || this.isOperator(last) || last === CommonConstants.LPAREN) {
        this.inputValue = this.inputValue + '0.';
        return;
      }
      if (this.currentNumberHasPoint()) {
        return;
      }
    }
    this.inputValue = this.inputValue + text;
  }

  /** 加减乘除（含乘方 ^） */
  private handleOperator(text: string): void {
    let value: string = this.inputValue;
    if (CheckEmptyUtil.isEmpty(value)) {
      // 表达式开头只允许负号
      if (text === CommonConstants.SUB) {
        this.inputValue = CommonConstants.SUB;
      }
      return;
    }
    let last: string = this.lastChar();
    if (last === CommonConstants.LPAREN && text !== CommonConstants.SUB) {
      // 左括号后面不允许直接跟运算符（负号除外）
      return;
    }
    if (this.isOperator(last)) {
      // 连续点运算符，用新的替换旧的
      this.inputValue = value.substring(0, value.length - 1) + text;
      this.justEvaluated = false;
      return;
    }
    if (last === CommonConstants.POINT) {
      return;
    }
    this.inputValue = value + text;
    this.justEvaluated = false;
  }

  /** 清空、退格、百分号 */
  private handleFunction(text: string): void {
    if (text === CommonConstants.CLEAR) {
      this.inputValue = '';
      this.justEvaluated = false;
      return;
    }
    if (text === CommonConstants.DELETE) {
      if (!CheckEmptyUtil.isEmpty(this.inputValue)) {
        this.inputValue = this.inputValue.substring(0, this.inputValue.length - 1);
        this.justEvaluated = false;
      }
      return;
    }
    if (text === CommonConstants.PERCENT) {
      let last: string = this.lastChar();
      if (CheckEmptyUtil.isEmpty(this.inputValue) || this.isOperator(last) ||
        last === CommonConstants.POINT || last === CommonConstants.PERCENT) {
        return;
      }
      this.inputValue = this.inputValue + CommonConstants.PERCENT;
      this.justEvaluated = false;
    }
  }

  /** 科学键：2nd/deg 切换、括号 / 幂 / 常量 / 函数 / 后缀运算 */
  private handleSci(text: string): void {
    if (text === CommonConstants.SECOND_KEY) {
      this.secondMode = !this.secondMode;
      return;
    }
    if (text === CommonConstants.DEG_KEY || text === CommonConstants.RAD_KEY) {
      this.degMode = !this.degMode;
      return;
    }
    if (text === CommonConstants.LPAREN || text === CommonConstants.RPAREN) {
      this.handleParen(text);
      return;
    }
    if (text === CommonConstants.POW || text === 'xʸ') {
      this.handleOperator(CommonConstants.POW);
      return;
    }
    if (text === CommonConstants.PI || text === CommonConstants.E) {
      this.handleConstant(text);
      return;
    }
    if (text === CommonConstants.SQR_KEY) {
      this.handlePostfix(CommonConstants.SQR);
      return;
    }
    if (text === CommonConstants.FACT_KEY) {
      this.handlePostfix(CommonConstants.FACT);
      return;
    }
    if (text === CommonConstants.INV_KEY) {
      this.handlePostfix(CommonConstants.INV);
      return;
    }
    // sin / cos / tan 及 2nd 下的反三角：插入函数名和左括号，如 sin(
    if (text === CommonConstants.SIN_KEY || text === CommonConstants.COS_KEY || text === CommonConstants.TAN_KEY) {
      this.insertFunction(text);
      return;
    }
    if (text === CommonConstants.SIN_INV_KEY) {
      this.insertFunction(CommonConstants.ASIN);
      this.secondMode = false;
      return;
    }
    if (text === CommonConstants.COS_INV_KEY) {
      this.insertFunction(CommonConstants.ACOS);
      this.secondMode = false;
      return;
    }
    if (text === CommonConstants.TAN_INV_KEY) {
      this.insertFunction(CommonConstants.ATAN);
      this.secondMode = false;
      return;
    }
    // lg / ln / √x
    if (!this.canStartOperand()) {
      return;
    }
    let insert: string = text === CommonConstants.SQRT_KEY ? '√(' : text + '(';
    this.inputValue = this.inputValue + insert;
    this.justEvaluated = false;
  }

  /** 插入函数调用前缀，如 sin( */
  private insertFunction(name: string): void {
    if (!this.canStartOperand()) {
      return;
    }
    this.inputValue = this.inputValue + name + '(';
    this.justEvaluated = false;
  }

  /** 括号：左括号只能在操作数开头，右括号要配对 */
  private handleParen(text: string): void {
    if (text === CommonConstants.LPAREN) {
      if (!this.canStartOperand()) {
        return;
      }
      this.inputValue = this.inputValue + text;
    } else {
      if (this.openParenCount() <= 0 || !this.endsWithOperand()) {
        return;
      }
      this.inputValue = this.inputValue + text;
    }
    this.justEvaluated = false;
  }

  /** 常量 π、e：只允许出现在操作数开头 */
  private handleConstant(text: string): void {
    if (!this.canStartOperand()) {
      return;
    }
    this.inputValue = this.inputValue + text;
    this.justEvaluated = false;
  }

  /** 后缀运算：x²、x!、1/x，跟在数字或常量后面 */
  private handlePostfix(text: string): void {
    if (!this.endsWithOperand()) {
      return;
    }
    this.inputValue = this.inputValue + text;
    this.justEvaluated = false;
  }

  /** 等号：自动补齐右括号后求值，成功后字体主次互换（表达式小字在上，答案大粗在下） */
  private handleEqual(): void {
    if (CheckEmptyUtil.isEmpty(this.inputValue)) {
      return;
    }
    let expression: string = this.balanceParens(this.inputValue);
    let value: string = this.calculator.evaluate(expression, this.degMode);
    if (value === CommonConstants.RESULT_ERROR) {
      Logger.error(TAG, 'evaluate failed: ' + expression);
      // 出错不清空输入式：表达式保留在上，下方统一显示「出错」（对齐样例）
      this.result = CommonConstants.RESULT_ERROR;
      this.justEvaluated = false;
      return;
    }
    this.addHistory(expression, value);
    this.lastExpression = expression;
    this.inputValue = value;
    this.result = value;
    this.justEvaluated = true;
  }

  // ---------------- 历史记录 ----------------

  private getHistoryList(): string[] {
    if (CheckEmptyUtil.isEmpty(this.historyText)) {
      return [];
    }
    return this.historyText.split(CommonConstants.HISTORY_SEPARATOR);
  }

  private addHistory(expression: string, value: string): void {
    let list: string[] = this.getHistoryList();
    list.unshift(expression + CommonConstants.HISTORY_EQUAL + value);
    if (list.length > CommonConstants.MAX_HISTORY) {
      list = list.slice(0, CommonConstants.MAX_HISTORY);
    }
    this.historyText = list.join(CommonConstants.HISTORY_SEPARATOR);
  }

  private clearHistory(): void {
    this.historyText = '';
  }

  private useHistory(item: string): void {
    let value: string = this.historyValue(item);
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    this.inputValue = value;
    this.result = value;
    this.justEvaluated = true;
    this.showHistory = false;
  }

  private historyExpression(item: string): string {
    let index: number = item.indexOf(CommonConstants.HISTORY_EQUAL);
    return index < 0 ? item : item.substring(0, index);
  }

  private historyValue(item: string): string {
    let index: number = item.indexOf(CommonConstants.HISTORY_EQUAL);
    return index < 0 ? '' : item.substring(index + 1);
  }

  // ---------------- 按键外观 ----------------

  private keyBgColor(item: PressKeysItem): string {
    if (item.type === KeyType.EQUAL) {
      return this.theme().equalBg;
    }
    if (item.type === KeyType.SCI || item.type === KeyType.EXPAND) {
      return this.theme().sciBg;
    }
    if (item.type === KeyType.OPERATOR) {
      return this.theme().operatorBg;
    }
    if (item.type === KeyType.FUNCTION) {
      return this.theme().functionBg;
    }
    return this.theme().digitBg;
  }

  private keyTextColor(item: PressKeysItem): string {
    // 2nd 激活时高亮橙色；切到 rad 时 deg 键也高亮提醒
    if (item.text === CommonConstants.SECOND_KEY && this.secondMode) {
      return this.theme().operatorText;
    }
    if (item.text === CommonConstants.RAD_KEY) {
      return this.theme().operatorText;
    }
    if (item.type === KeyType.EQUAL) {
      return this.theme().equalText;
    }
    if (item.type === KeyType.SCI || item.type === KeyType.EXPAND) {
      return this.theme().sciText;
    }
    if (item.type === KeyType.OPERATOR) {
      return this.theme().operatorText;
    }
    if (item.type === KeyType.FUNCTION) {
      return this.theme().functionText;
    }
    return this.theme().digitText;
  }

  private keyFontSize(item: PressKeysItem): number {
    if (item.type === KeyType.SCI) {
      // sin⁻¹ 这类长标签用小一号
      return item.text.indexOf('⁻¹') >= 0 ? 13 : 16;
    }
    if (item.type === KeyType.EXPAND) {
      return 24;
    }
    if (item.type === KeyType.DIGIT) {
      return this.showSci ? 22 : 30;
    }
    return this.showSci ? 20 : 26;
  }

  // ---------------- 输入辅助 ----------------

  /** 现在的位置能不能开始一个新操作数（开头 / 运算符或左括号后面） */
  private canStartOperand(): boolean {
    if (CheckEmptyUtil.isEmpty(this.inputValue)) {
      return true;
    }
    let last: string = this.lastChar();
    return this.isOperator(last) || last === CommonConstants.LPAREN;
  }

  /** 现在的位置是不是刚输完一个操作数（数字、百分号、右括号、后缀运算、常量） */
  private endsWithOperand(): boolean {
    let last: string = this.lastChar();
    if (this.isDigitChar(last)) {
      return true;
    }
    return last === CommonConstants.PERCENT || last === CommonConstants.RPAREN ||
      last === CommonConstants.SQR || last === CommonConstants.FACT || last === '¹' ||
      last === CommonConstants.PI || last === CommonConstants.E;
  }

  /** 未配对的左括号数量 */
  private openParenCount(): number {
    let count: number = 0;
    for (let i: number = 0; i < this.inputValue.length; i++) {
      if (this.inputValue.charAt(i) === CommonConstants.LPAREN) {
        count++;
      } else if (this.inputValue.charAt(i) === CommonConstants.RPAREN) {
        count--;
      }
    }
    return count;
  }

  /** 求值前补齐缺失的右括号：sin(30 → sin(30) */
  private balanceParens(expression: string): string {
    let open: number = 0;
    for (let i: number = 0; i < expression.length; i++) {
      let c: string = expression.charAt(i);
      if (c === CommonConstants.LPAREN) {
        open++;
      } else if (c === CommonConstants.RPAREN) {
        open--;
      }
    }
    let out: string = expression;
    while (open > 0) {
      out = out + ')';
      open--;
    }
    return out;
  }

  private lastChar(): string {
    if (CheckEmptyUtil.isEmpty(this.inputValue)) {
      return '';
    }
    return this.inputValue.charAt(this.inputValue.length - 1);
  }

  private isDigitChar(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isOperator(c: string): boolean {
    return c === CommonConstants.ADD || c === CommonConstants.SUB || c === '-' ||
      c === CommonConstants.MUL || c === '*' || c === CommonConstants.DIV || c === '/' ||
      c === CommonConstants.POW;
  }

  /** 当前正在输入的这个数字里是否已经有小数点了 */
  private currentNumberHasPoint(): boolean {
    let value: string = this.inputValue;
    for (let i: number = value.length - 1; i >= 0; i--) {
      let c: string = value.charAt(i);
      if (c === CommonConstants.POINT) {
        return true;
      }
      if (this.isOperator(c) || c === CommonConstants.PERCENT) {
        return false;
      }
    }
    return false;
  }

  /** 最后一个数字（含可能的一元负号）从哪里开始 */
  private lastNumberStart(value: string): number {
    let i: number = value.length - 1;
    while (i >= 0) {
      let c: string = value.charAt(i);
      if (c === CommonConstants.PERCENT) {
        return i + 1;
      }
      if (this.isOperator(c)) {
        let isMinus: boolean = c === CommonConstants.SUB || c === '-';
        if (isMinus && (i === 0 || this.isOperator(value.charAt(i - 1)) || value.charAt(i - 1) === CommonConstants.LPAREN)) {
          // 一元负号属于这个数字
          return i;
        }
        return i + 1;
      }
      i--;
    }
    return 0;
  }

  /** 输入式字号：现在是主视觉，字号大，长度大自动缩小 */
  private inputFontSize(): number {
    let value: string = CheckEmptyUtil.isEmpty(this.inputValue) ? '0' : this.inputValue;
    let len: number = value.length;
    if (len <= 8) {
      return 56;
    }
    if (len <= 12) {
      return 46;
    }
    if (len <= 16) {
      return 36;
    }
    return 26;
  }

  /** 结果字号：现在是次要视觉，字号小，长度大再缩小 */
  private resultFontSize(): number {
    if (this.result === CommonConstants.RESULT_ERROR) {
      return 22;
    }
    let len: number = this.result.length;
    if (len <= 8) {
      return 28;
    }
    if (len <= 14) {
      return 22;
    }
    return 18;
  }
}
