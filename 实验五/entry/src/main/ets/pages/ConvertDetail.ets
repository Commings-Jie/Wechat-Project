import { DARK_THEME, LIGHT_THEME, ThemeColors } from '../common/constants/ThemeColors';
import { Category, findCategory, findUnit, Unit } from '../common/constants/ConvertConstants';
import ConvertUtil from '../common/utils/ConvertUtil';
import { KEY_IS_DARK, PreferencesUtil } from '../common/utils/PreferencesUtil';
import ConvertKeysItem, { ConvertKeyType } from '../viewmodel/ConvertKeysItem';
import { ConvertKeyboardType, getConvertKeys } from '../viewmodel/ConvertKeysViewModel';

/**
 * 换算详情页
 * 顶部：返回箭头 + 标题
 * 中部：两行单位/数值选择，被选中行数值橙色，点击 ⇅ 原地弹出单位菜单
 * 底部：专用数字键盘
 */
@Entry
@Component
struct ConvertDetail {
  @StorageLink('isDark') @Watch('onThemeChange') isDark: boolean = false;

  // 当前类目与选中的两个单位
  @State category: Category | undefined = undefined;
  @State fromUnitId: string = '';
  @State toUnitId: string = '';
  // 当前正在输入的是哪一行：'from' 或 'to'
  @State activeInput: string = 'from';
  // 两行原始输入值（未加千分号）
  @State fromValue: string = '1';
  @State toValue: string = '';
  // 单位选择器：'' 关闭，'from' / 'to' 表示正在给哪一行选单位
  @State pickerMode: string = '';
  // 该行当前的值是否由换算得出（这种情况再按数字应当重新开始输入）
  @State fromComputed: boolean = false;
  @State toComputed: boolean = true;

  onPageShow(): void {
    let params: object = this.getUIContext().getRouter().getParams() as object;
    let categoryId: string = (params as Record<string, string>)?.['categoryId'] ?? '';
    let cat: Category | undefined = findCategory(categoryId);
    if (!cat) {
      this.getUIContext().getRouter().back();
      return;
    }

    // 只有首次进入或切换了类目时才重置默认值
    let firstEnter: boolean = !this.category || this.category.id !== cat.id;
    this.category = cat;
    if (firstEnter) {
      this.fromUnitId = cat.defaultFrom;
      this.toUnitId = cat.defaultTo;
      this.activeInput = 'from';
      this.fromValue = '1';
      this.compute('from');
    }
  }

  onThemeChange(): void {
    PreferencesUtil.put(KEY_IS_DARK, this.isDark);
  }

  private theme(): ThemeColors {
    return this.isDark ? DARK_THEME : LIGHT_THEME;
  }

  build() {
    Column() {
      this.Header()
      this.UnitArea()
      if (this.pickerMode === '') {
        this.KeyboardArea()
      } else {
        this.UnitPicker()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme().pageBg)
    .padding({ left: 16, right: 16, top: 16, bottom: 24 })
  }

  @Builder
  Header() {
    Row() {
      // 返回箭头（固定宽度占位，保证右侧留对称空白）
      Text('←')
        .fontSize(28)
        .fontColor(this.theme().primaryText)
        .width(48)
        .textAlign(TextAlign.Start)
        .onClick(() => {
          this.getUIContext().getRouter().back();
        })

      // 标题（占满剩余空间并居中）
      Text(this.category ? this.category.name : '')
        .fontSize(20)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme().primaryText)
        .layoutWeight(1)
        .textAlign(TextAlign.Center)

      // 与箭头等宽的占位，使标题真正居中
      Blank()
        .width(48)
    }
    .width('100%')
    .padding({ bottom: 24 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  UnitArea() {
    Column() {
      if (this.category) {
        // 注意：@Builder 按值传参会失去响应式（状态变了 UI 不刷新），
        // 所以这里只传 mode，单位与数值在 UnitRow 内部直接读 this 的状态变量
        this.UnitRow('from')
        this.UnitRow('to')
      }
    }
    .width('100%')
    .layoutWeight(3)
    .justifyContent(FlexAlign.Start)
  }

  @Builder
  UnitRow(mode: string) {
    Row() {
      Column() {
        // 单位名称 + 符号 + 切换箭头
        Row() {
          Text(this.unitName(this.rowUnitId(mode)))
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme().primaryText)

          Text(this.unitSymbol(this.rowUnitId(mode)))
            .fontSize(16)
            .fontColor(this.theme().secondaryText)

          // 单位切换箭头（原地展开单位列表，不跳页）
          Text(this.pickerMode === mode ? '▴' : '⇅')
            .fontSize(14)
            .fontColor(this.theme().operatorText)
            .margin({ left: 8 })
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .borderRadius(12)
            .backgroundColor(this.theme().chipBg)
            .onClick(() => {
              this.togglePicker(mode);
            })
        }

        // 分隔线，选中行显示主色
        if (this.isActiveRow(mode)) {
          Divider()
            .strokeWidth(2)
            .color(this.theme().operatorText)
            .margin({ top: 6 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .onClick(() => {
        this.activeInput = mode;
      })

      // 数值显示（直接读状态变量，保证输入/换单位后立即刷新）
      Text(this.rowDisplay(this.rowValue(mode)))
        .fontSize(30)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.isActiveRow(mode) ? this.theme().operatorText : this.theme().primaryText)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .onClick(() => {
          this.activeInput = mode;
        })
    }
    .width('100%')
    .padding({ top: 20, bottom: 20 })
    .onClick(() => {
      this.activeInput = mode;
    })
  }

  /** 给显示值加千分位（进制除外） */
  private displayValue(value: string): string {
    if (value === '' || value === '−') {
      return value;
    }
    if (this.category?.type === 'radix') {
      return value;
    }
    return ConvertUtil.formatInput(value);
  }

  /** 行是否处于输入态（数值显示橙色） */
  private isActiveRow(mode: string): boolean {
    return this.activeInput === mode;
  }

  /** 指定行的单位 ID（在 Builder 内直接调用，保持响应式） */
  private rowUnitId(mode: string): string {
    return mode === 'from' ? this.fromUnitId : this.toUnitId;
  }

  /** 指定行的原始输入值（在 Builder 内直接调用，保持响应式） */
  private rowValue(mode: string): string {
    return mode === 'from' ? this.fromValue : this.toValue;
  }

  /** 当前输入行所在进制的基数（非进制类目返回 10） */
  private currentBase(): number {
    if (!this.category || this.category.type !== 'radix') {
      return 10;
    }
    let id: string = this.activeInput === 'from' ? this.fromUnitId : this.toUnitId;
    let unit: Unit | undefined = findUnit(this.category, id);
    return unit?.base ?? 10;
  }

  /** 按键是否可用：进制下不符合当前基数的键、以及小数点/正负号都置灰 */
  private isKeyEnabled(item: ConvertKeysItem): boolean {
    if (item.type === ConvertKeyType.EMPTY) {
      return false;
    }
    if (this.category && this.category.type === 'radix') {
      if (item.type === ConvertKeyType.DIGIT) {
        let base: number = this.currentBase();
        for (let i: number = 0; i < item.text.length; i++) {
          if (!ConvertUtil.isValidRadixChar(item.text.charAt(i), base)) {
            return false;
          }
        }
        return true;
      }
      // 进制只处理整数，小数点和正负号不可用
      if (item.type === ConvertKeyType.DOT || item.type === ConvertKeyType.SIGN) {
        return false;
      }
    }
    return true;
  }

  /** 行的显示文本 */
  private rowDisplay(value: string): string {
    let text: string = this.displayValue(value);
    return text === '' ? '0' : text;
  }

  private findUnitSafe(unitId: string): Unit | undefined {
    return this.category ? findUnit(this.category, unitId) : undefined;
  }

  private unitName(unitId: string): string {
    let u: Unit | undefined = this.findUnitSafe(unitId);
    return u ? u.name : '';
  }

  private unitSymbol(unitId: string): string {
    let u: Unit | undefined = this.findUnitSafe(unitId);
    return u ? ' ' + u.symbol : '';
  }

  /** 展开/收起单位选择器 */
  private togglePicker(mode: string): void {
    this.activeInput = mode;
    this.pickerMode = this.pickerMode === mode ? '' : mode;
  }

  /** 当前选择器对应的已选单位 */
  private pickerUnitId(): string {
    return this.pickerMode === 'from' ? this.fromUnitId : this.toUnitId;
  }

  /** 原地展开的单位列表（页面内实现，不跳页、不受行点击事件干扰） */
  @Builder
  UnitPicker() {
    Column() {
      Row() {
        Text(this.pickerMode === 'from' ? '选择源单位' : '选择目标单位')
          .fontSize(14)
          .fontColor(this.theme().secondaryText)
          .layoutWeight(1)

        Text('收起')
          .fontSize(14)
          .fontColor(this.theme().operatorText)
          .onClick(() => {
            this.pickerMode = '';
          })
      }
      .width('100%')
      .padding({ left: 4, right: 4, bottom: 6 })

      List() {
        ForEach(this.category ? this.category.units : [], (unit: Unit) => {
          ListItem() {
            Row() {
              Text(unit.name)
                .fontSize(17)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.isPicked(unit.id) ? this.theme().operatorText : this.theme().primaryText)

              Text(' ' + unit.symbol)
                .fontSize(14)
                .fontColor(this.theme().secondaryText)

              Blank()
                .layoutWeight(1)

              if (this.isPicked(unit.id)) {
                Text('✓')
                  .fontSize(16)
                  .fontColor(this.theme().operatorText)
              }
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 12, bottom: 12 })
            .onClick(() => {
              this.applyUnit(this.pickerMode, unit.id);
            })
          }
          .borderRadius(12)
          .margin({ top: 4, bottom: 4 })
        }, (unit: Unit) => unit.id)
      }
      .layoutWeight(1)
      .divider({ strokeWidth: 0.5, color: this.theme().divider, startMargin: 16, endMargin: 16 })
    }
    .width('100%')
    .layoutWeight(this.getKeyboardWeight())
  }

  private isPicked(unitId: string): boolean {
    return unitId === this.pickerUnitId();
  }

  /** 原地切换单位并重新计算，不跳页 */
  private applyUnit(mode: string, unitId: string): void {
    if (mode === 'from') {
      this.fromUnitId = unitId;
    } else {
      this.toUnitId = unitId;
    }
    // 进制下换单位后，若当前值不符合新基数则重置为 1
    if (this.category && this.category.type === 'radix') {
      let id: string = mode === 'from' ? this.fromUnitId : this.toUnitId;
      let base: number = findUnit(this.category, id)?.base ?? 10;
      let val: string = mode === 'from' ? this.fromValue : this.toValue;
      if (!ConvertUtil.isValidRadixValue(val, base)) {
        if (mode === 'from') {
          this.fromValue = '1';
        } else {
          this.toValue = '1';
        }
      }
    }
    this.activeInput = mode;
    this.pickerMode = '';
    if (mode === 'from') {
      this.compute('from');
    } else {
      this.compute('to');
    }
  }


  @Builder
  KeyboardArea() {
    Column() {
      ForEach(this.getKeys(), (row: ConvertKeysItem[]) => {
        Row() {
          ForEach(row, (item: ConvertKeysItem) => {
            Button(item.text)
              .type(ButtonType.Normal)
              .fontSize(this.keyFontSize(item))
              .fontColor(this.keyTextColor(item))
              .fontWeight(FontWeight.Medium)
              .backgroundColor(this.keyBgColor(item))
              .borderRadius(20)
              .layoutWeight(1)
              .height('100%')
              .margin({ left: 5, right: 5 })
              .enabled(this.isKeyEnabled(item))
              .opacity(this.isKeyEnabled(item) ? 1 : 0.4)
              .onClick(() => {
                this.onKeyClick(item);
              })
          }, (item: ConvertKeysItem, index: number) => index.toString() + '-' + item.text)
        }
        .width('100%')
        .layoutWeight(1)
        .margin({ top: 5, bottom: 5 })
      }, (row: ConvertKeysItem[], rowIndex: number) => (this.getKeyboardType() + '-' + rowIndex.toString()))
    }
    .width('100%')
    .layoutWeight(this.getKeyboardWeight())
  }

  private getKeyboardType(): string {
    if (!this.category) {
      return 'none';
    }
    if (this.category.type === 'radix') {
      return 'hex';
    }
    if (this.category.type === 'temperature') {
      return 'temp';
    }
    return 'std';
  }

  private getKeys(): ConvertKeysItem[][] {
    if (!this.category) {
      return [];
    }
    if (this.category.type === 'radix') {
      return getConvertKeys(ConvertKeyboardType.HEX);
    }
    if (this.category.type === 'temperature') {
      return getConvertKeys(ConvertKeyboardType.TEMP);
    }
    return getConvertKeys(ConvertKeyboardType.STANDARD);
  }

  private getKeyboardWeight(): number {
    if (!this.category) {
      return 0;
    }
    return this.category.type === 'temperature' ? 5 : 7;
  }

  private onKeyClick(item: ConvertKeysItem): void {
    if (item.type === ConvertKeyType.EMPTY) {
      return;
    }
    if (!this.category) {
      return;
    }
    if (item.type === ConvertKeyType.OP) {
      // 换算页不响应运算符
      return;
    }
    if (item.type === ConvertKeyType.FUNC) {
      if (item.text === 'C') {
        this.clearValue();
      } else if (item.text === '⌫') {
        this.backspaceValue();
      }
      return;
    }
    if (item.type === ConvertKeyType.SIGN) {
      this.toggleSign();
      return;
    }
    if (item.type === ConvertKeyType.DOT) {
      this.inputDot();
      return;
    }
    // DIGIT
    this.inputDigit(item.text);
  }

  private clearValue(): void {
    this.setActiveValue('1');
  }

  private backspaceValue(): void {
    let val: string = this.getActiveValue();
    if (val.length <= 1 || val === '−') {
      this.setActiveValue('0');
      return;
    }
    this.setActiveValue(val.substring(0, val.length - 1));
  }

  private toggleSign(): void {
    let val: string = this.getActiveValue();
    if (val === '' || val === '0') {
      return;
    }
    if (val.charAt(0) === '−' || val.charAt(0) === '-') {
      this.setActiveValue(val.substring(1));
    } else {
      this.setActiveValue('−' + val);
    }
  }

  private inputDot(): void {
    // 进制不允许小数点
    if (this.category?.type === 'radix') {
      return;
    }
    let val: string = this.getActiveValue();
    if (val.indexOf('.') >= 0) {
      return;
    }
    this.setActiveValue(val + '.');
  }

  private inputDigit(text: string): void {
    if (this.category?.type === 'radix') {
      let fromBase: number = findUnit(this.category, this.activeInput === 'from' ? this.fromUnitId : this.toUnitId)?.base ?? 10;
      let allValid: boolean = true;
      for (let i: number = 0; i < text.length; i++) {
        if (!ConvertUtil.isValidRadixChar(text.charAt(i), fromBase)) {
          allValid = false;
          break;
        }
      }
      if (!allValid) {
        return;
      }
    }

    let val: string = this.getActiveValue();
    // 这一行刚由换算得出（或还是默认的 1）：按数字直接替换，避免拼出 3.28085 这种值
    if (val === '1' || val === '−1' || val === '0' || val === '' ||
      (this.activeInput === 'from' ? this.fromComputed : this.toComputed)) {
      this.setActiveValue(text);
      return;
    }
    if (val === '−0') {
      this.setActiveValue('−' + text);
      return;
    }
    this.setActiveValue(val + text);
  }

  private getActiveValue(): string {
    return this.activeInput === 'from' ? this.fromValue : this.toValue;
  }

  private setActiveValue(raw: string): void {
    if (this.activeInput === 'from') {
      this.fromValue = raw;
      this.fromComputed = false;
      this.compute('from');
    } else {
      this.toValue = raw;
      this.toComputed = false;
      this.compute('to');
    }
  }

  /** 由输入侧推算另一侧（结果转成内部纯值写入，方便继续编辑） */
  private compute(source: string): void {
    if (!this.category) {
      return;
    }
    let cat: Category = this.category;
    if (source === 'from') {
      let out: string = ConvertUtil.convert(this.fromValue, this.fromUnitId, this.toUnitId, cat);
      this.toValue = out === '' ? '0' : ConvertUtil.toInternal(out);
      this.toComputed = true;
    } else {
      let out: string = ConvertUtil.convert(this.toValue, this.toUnitId, this.fromUnitId, cat);
      this.fromValue = out === '' ? '0' : ConvertUtil.toInternal(out);
      this.fromComputed = true;
    }
  }

  private keyBgColor(item: ConvertKeysItem): string {
    if (item.type === ConvertKeyType.OP && item.text === '=') {
      return this.theme().equalBg;
    }
    if (item.type === ConvertKeyType.FUNC) {
      return this.theme().functionBg;
    }
    return this.theme().digitBg;
  }

  private keyTextColor(item: ConvertKeysItem): string {
    if (!this.isKeyEnabled(item)) {
      return this.theme().secondaryText;
    }
    if (item.type === ConvertKeyType.OP && item.text === '=') {
      return this.theme().equalText;
    }
    if (item.type === ConvertKeyType.OP) {
      return this.theme().operatorText;
    }
    if (item.type === ConvertKeyType.FUNC) {
      return this.theme().functionText;
    }
    if (item.type === ConvertKeyType.SIGN) {
      return this.theme().operatorText;
    }
    return this.theme().digitText;
  }

  private keyFontSize(item: ConvertKeysItem): number {
    if (item.text.length >= 2) {
      return 20;
    }
    return 26;
  }
}
