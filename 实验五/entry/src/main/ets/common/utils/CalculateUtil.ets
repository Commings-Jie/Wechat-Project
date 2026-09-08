import CommonConstants from '../constants/CommonConstants';
import DecimalUtil from './DecimalUtil';

/**
 * 词法单元
 * type: number（数字）/ op（运算符）/ func（函数）/ lparen（左括号）/ rparen（右括号）/ start（哨兵）
 */
class Token {
  type: string = '';
  value: string = '';

  constructor(type: string, value: string) {
    this.type = type;
    this.value = value;
  }
}

/**
 * 表达式求值工具（Shunting-yard 调车场算法）
 *
 * 流程：中缀表达式 → 词法分析 → 后缀表达式（RPN）→ 栈计算
 * 相比递归下降，这种写法扩展性好：以后要加 sin、x²、阶乘，
 * 只要在 tokenize 里加词法、在 precedence 里加优先级即可，不用改整体结构。
 */
export default class CalculateUtil {

  /**
   * 计算表达式，出错时返回 CommonConstants.RESULT_ERROR
   * @param degreeMode true 角度制（默认），false 弧度制
   */
  evaluate(expression: string, degreeMode: boolean = true): string {
    try {
      let tokens: Token[] = this.tokenize(this.normalize(expression));
      if (tokens.length === 0) {
        return '0';
      }
      let rpn: Token[] = this.toRPN(tokens);
      let value: string = this.evalRPN(rpn, degreeMode);
      let formatted: string = DecimalUtil.format(value);
      if (DecimalUtil.needScientific(formatted)) {
        return DecimalUtil.toScientific(formatted, CommonConstants.SIGNIFICANT_DIGITS);
      }
      return formatted;
    } catch (err) {
      return CommonConstants.RESULT_ERROR;
    }
  }

  /** 把界面符号 − × ÷ 换成 - * / */
  private normalize(expression: string): string {
    let out: string = '';
    for (let i: number = 0; i < expression.length; i++) {
      let c: string = expression.charAt(i);
      if (c === '−' || c === '—') {
        out = out + '-';
      } else if (c === '×' || c === '*') {
        out = out + '*';
      } else if (c === '÷') {
        out = out + '/';
      } else if (c === '（') {
        out = out + '(';
      } else if (c === '）') {
        out = out + ')';
      } else {
        out = out + c;
      }
    }
    return out;
  }

  /**
   * 词法分析
   * 顺带处理：百分号（50% → 0.5）、一元负号（-3 → u- 3）、
   * 科学计数法数字（1.23e+10）、科学函数（sin cos tan lg ln √）、
   * 幂（^）、后缀运算（² ! ⁻¹）、常量（π e）
   */
  private tokenize(expression: string): Token[] {
    let list: Token[] = [];
    let i: number = 0;
    while (i < expression.length) {
      let c: string = expression.charAt(i);
      if (c === ' ') {
        i++;
        continue;
      }
      if (this.isDigit(c) || c === '.') {
        let num: string = '';
        while (i < expression.length && (this.isDigit(expression.charAt(i)) || expression.charAt(i) === '.')) {
          num = num + expression.charAt(i);
          i++;
        }
        // 等号结果回填后可能带科学计数法，把 e+10 / e-7 这部分一起吃进数字
        if (i < expression.length && expression.charAt(i) === 'e') {
          let j: number = i + 1;
          let signLen: number = 0;
          if (j < expression.length && (expression.charAt(j) === '+' || expression.charAt(j) === '-')) {
            signLen = 1;
          }
          if (j + signLen < expression.length && this.isDigit(expression.charAt(j + signLen))) {
            num = num + expression.substring(i, j + signLen + 1);
            i = j + signLen + 1;
          }
        }
        if (num.indexOf('e') >= 0 || num.indexOf('E') >= 0) {
          num = DecimalUtil.fromScientific(num);
        }
        if (i < expression.length && expression.charAt(i) === '%') {
          num = DecimalUtil.divByHundred(num);
          i++;
        }
        list.push(new Token('number', num));
        continue;
      }
      if (c === '-' || c === '+') {
        let prev: Token = list.length > 0 ? list[list.length - 1] : new Token('start', '');
        // 后缀运算（² ! ⁻¹）之后数字已经结束，这里的 +/- 是二元运算符
        let prevIsPostfix: boolean = prev.type === 'op' &&
          (prev.value === 'sqr' || prev.value === 'fact' || prev.value === 'inv');
        let unary: boolean = prev.type === 'start' || prev.type === 'lparen' ||
          (prev.type === 'op' && !prevIsPostfix);
        if (unary) {
          // 一元负号单独记成 u-，一元正号直接忽略
          if (c === '-') {
            list.push(new Token('op', 'u-'));
          }
        } else {
          list.push(new Token('op', c));
        }
        i++;
        continue;
      }
      if (c === '*' || c === '/') {
        list.push(new Token('op', c));
        i++;
        continue;
      }
      if (c === '^') {
        list.push(new Token('op', '^'));
        i++;
        continue;
      }
      if (c === '(') {
        list.push(new Token('lparen', c));
        i++;
        continue;
      }
      if (c === ')') {
        list.push(new Token('rparen', c));
        i++;
        continue;
      }
      // 后缀运算：平方、阶乘、倒数
      if (c === '²') {
        list.push(new Token('op', 'sqr'));
        i++;
        continue;
      }
      if (c === '!') {
        list.push(new Token('op', 'fact'));
        i++;
        continue;
      }
      if (c === '⁻') {
        if (i + 1 < expression.length && expression.charAt(i + 1) === '¹') {
          list.push(new Token('op', 'inv'));
          i += 2;
          continue;
        }
        throw new Error('bad char');
      }
      // 前缀函数与常量
      if (c === '√') {
        list.push(new Token('func', 'sqrt'));
        i++;
        continue;
      }
      if (c === 'π') {
        list.push(new Token('number', CommonConstants.PI_VALUE));
        i++;
        continue;
      }
      if (this.isLetter(c)) {
        let word: string = '';
        while (i < expression.length && this.isLetter(expression.charAt(i))) {
          word = word + expression.charAt(i);
          i++;
        }
        if (word === 'sin' || word === 'cos' || word === 'tan' || word === 'lg' || word === 'ln' ||
          word === 'asin' || word === 'acos' || word === 'atan') {
          list.push(new Token('func', word));
        } else if (word === 'e') {
          list.push(new Token('number', CommonConstants.E_VALUE));
        } else {
          throw new Error('unknown word: ' + word);
        }
        continue;
      }
      i++;
    }
    return list;
  }

  /** 中缀转后缀（Shunting-yard） */
  private toRPN(tokens: Token[]): Token[] {
    let output: Token[] = [];
    let stack: Token[] = [];
    for (let i: number = 0; i < tokens.length; i++) {
      let token: Token = tokens[i];
      if (token.type === 'number') {
        output.push(token);
        continue;
      }
      if (token.type === 'op') {
        let precedence: number = this.precedence(token.value);
        // 后缀运算和 ^ 都是右结合：−3² 要算成 −(3²)，2^3² 算成 2^(3²)
        let rightAssoc: boolean = token.value === 'u-' || token.value === '^' ||
          token.value === 'sqr' || token.value === 'fact' || token.value === 'inv';
        while (stack.length > 0) {
          let top: Token = stack[stack.length - 1];
          if (top.type !== 'op') {
            break;
          }
          let topPrecedence: number = this.precedence(top.value);
          if (topPrecedence > precedence || (topPrecedence === precedence && !rightAssoc)) {
            output.push(top);
            stack.pop();
          } else {
            break;
          }
        }
        stack.push(token);
        continue;
      }
      // 函数是前缀形式（sin( ... )），直接入栈等右括号来收
      if (token.type === 'func') {
        stack.push(token);
        continue;
      }
      if (token.type === 'lparen') {
        stack.push(token);
        continue;
      }
      if (token.type === 'rparen') {
        while (stack.length > 0 && stack[stack.length - 1].type !== 'lparen') {
          let top: Token = stack[stack.length - 1];
          output.push(top);
          stack.pop();
        }
        if (stack.length > 0 && stack[stack.length - 1].type === 'lparen') {
          stack.pop();
        }
        // 右括号收尾时，紧挨着的函数一并出栈（sin(30) → 30 sin）
        if (stack.length > 0 && stack[stack.length - 1].type === 'func') {
          output.push(stack[stack.length - 1]);
          stack.pop();
        }
      }
    }
    while (stack.length > 0) {
      let top: Token = stack[stack.length - 1];
      stack.pop();
      if (top.type === 'op') {
        output.push(top);
      }
    }
    return output;
  }

  /** 计算后缀表达式 */
  private evalRPN(rpn: Token[], degreeMode: boolean = true): string {
    let stack: string[] = [];
    for (let i: number = 0; i < rpn.length; i++) {
      let token: Token = rpn[i];
      if (token.type === 'number') {
        stack.push(token.value);
        continue;
      }
      if (token.type === 'func') {
        let v: string = this.popSafe(stack);
        stack.push(this.applyFunc(token.value, v, degreeMode));
        continue;
      }
      if (token.value === 'u-') {
        let a: string = this.popSafe(stack);
        stack.push(DecimalUtil.negate(a));
        continue;
      }
      // 一元后缀：平方、阶乘、倒数
      if (token.value === 'sqr') {
        let a: string = this.popSafe(stack);
        stack.push(DecimalUtil.mul(a, a));
        continue;
      }
      if (token.value === 'fact') {
        let a: string = this.popSafe(stack);
        stack.push(this.factorial(a));
        continue;
      }
      if (token.value === 'inv') {
        let a: string = this.popSafe(stack);
        if (DecimalUtil.isZero(a)) {
          throw new Error('division by zero');
        }
        try {
          stack.push(DecimalUtil.div('1', a, CommonConstants.MAX_FRACTION));
        } catch (e) {
          throw new Error('division by zero');
        }
        continue;
      }
      let b: string = this.popSafe(stack);
      let a: string = this.popSafe(stack);
      if (token.value === '+') {
        stack.push(DecimalUtil.add(a, b));
      } else if (token.value === '-') {
        stack.push(DecimalUtil.sub(a, b));
      } else if (token.value === '*') {
        stack.push(DecimalUtil.mul(a, b));
      } else if (token.value === '/') {
        try {
          stack.push(DecimalUtil.div(a, b, CommonConstants.MAX_FRACTION));
        } catch (e) {
          throw new Error('division by zero');
        }
      } else if (token.value === '^') {
        stack.push(DecimalUtil.pow(a, b));
      }
    }
    if (stack.length === 0) {
      return '0';
    }
    return stack[stack.length - 1];
  }

  /** 应用科学函数（三角/反三角按 degreeMode 决定角度制或弧度制） */
  private applyFunc(name: string, value: string, degreeMode: boolean = true): string {
    let x: number = Number(value);
    if (isNaN(x)) {
      throw new Error('bad argument');
    }
    if (name === 'sin') {
      return this.roundTrig(Math.sin(this.toRad(x, degreeMode)));
    }
    if (name === 'cos') {
      return this.roundTrig(Math.cos(this.toRad(x, degreeMode)));
    }
    if (name === 'tan') {
      return this.roundTrig(Math.tan(this.toRad(x, degreeMode)));
    }
    if (name === 'asin') {
      if (x < -1 || x > 1) {
        throw new Error('asin domain');
      }
      let v: number = Math.asin(x);
      return this.roundTrig(degreeMode ? v * 180 / Math.PI : v);
    }
    if (name === 'acos') {
      if (x < -1 || x > 1) {
        throw new Error('acos domain');
      }
      let v: number = Math.acos(x);
      return this.roundTrig(degreeMode ? v * 180 / Math.PI : v);
    }
    if (name === 'atan') {
      let v: number = Math.atan(x);
      return this.roundTrig(degreeMode ? v * 180 / Math.PI : v);
    }
    if (name === 'lg') {
      if (x <= 0) {
        throw new Error('lg domain');
      }
      return this.roundNumber(Math.log10(x));
    }
    if (name === 'ln') {
      if (x <= 0) {
        throw new Error('ln domain');
      }
      return this.roundNumber(Math.log(x));
    }
    if (name === 'sqrt') {
      if (x < 0) {
        throw new Error('sqrt domain');
      }
      return this.roundNumber(Math.sqrt(x));
    }
    throw new Error('unknown function');
  }

  /** 角度转弧度（弧度制下原样返回） */
  private toRad(angle: number, degreeMode: boolean): number {
    return degreeMode ? angle * Math.PI / 180 : angle;
  }

  /** 阶乘：只允许非负整数 */
  private factorial(value: string): string {
    if (value.indexOf('.') >= 0 || value.indexOf('e') >= 0 || value.indexOf('E') >= 0) {
      throw new Error('factorial domain');
    }
    let n: number = Number(value);
    if (isNaN(n) || n < 0 || Math.floor(n) !== n) {
      throw new Error('factorial domain');
    }
    if (n > 500) {
      throw new Error('factorial too large');
    }
    let result: string = '1';
    for (let i: number = 2; i <= n; i++) {
      result = DecimalUtil.mul(result, i.toString());
    }
    return result;
  }

  /** 三角函数结果做舍入，避免 sin(30) 算出 0.49999... */
  private roundTrig(v: number): string {
    // 浮点误差造成的极小值（如 sin(180) ≈ 1.2e-16）直接归零
    if (Math.abs(v) < 1e-10) {
      return '0';
    }
    return this.roundNumber(v);
  }

  /** 浮点结果统一保留 12 位有效数字并规范格式 */
  private roundNumber(v: number): string {
    if (isNaN(v) || !isFinite(v)) {
      throw new Error('math error');
    }
    let text: string = Number(v.toPrecision(12)).toString();
    if (text.indexOf('e') >= 0 || text.indexOf('E') >= 0) {
      text = DecimalUtil.fromScientific(text);
    }
    return DecimalUtil.format(text);
  }

  /** 运算符优先级：一元负号与后缀最高，然后乘方，再乘除，最后加减 */
  private precedence(operator: string): number {
    if (operator === 'u-' || operator === 'sqr' || operator === 'fact' || operator === 'inv') {
      return 3;
    }
    if (operator === '^') {
      return 2;
    }
    if (operator === '*' || operator === '/') {
      return 2;
    }
    if (operator === '+' || operator === '-') {
      return 1;
    }
    return 0;
  }

  private popSafe(stack: string[]): string {
    if (stack.length === 0) {
      return '0';
    }
    let value: string = stack[stack.length - 1];
    stack.pop();
    return value;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isLetter(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }
}
