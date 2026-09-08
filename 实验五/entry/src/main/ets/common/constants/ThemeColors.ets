/**
 * 主题配色
 * 亮色走 iOS 计算器风格，暗色走黑底灰键风格
 */
export interface ThemeColors {
  pageBg: string;         // 页面背景
  panelBg: string;        // 卡片背景
  primaryText: string;    // 主文字（结果）
  secondaryText: string;  // 次要文字（表达式、历史）
  digitBg: string;        // 数字键背景
  digitText: string;      // 数字键文字
  functionBg: string;     // 功能键背景
  functionText: string;   // 功能键文字
  operatorBg: string;     // 运算符背景
  operatorText: string;   // 运算符文字
  equalBg: string;        // 等号背景（唯一实色键）
  equalText: string;      // 等号文字
  sciBg: string;          // 科学函数键背景
  sciText: string;        // 科学函数键文字
  errorText: string;      // 错误提示
  divider: string;        // 分隔线
  chipBg: string;         // 顶部小按钮背景
}

export const LIGHT_THEME: ThemeColors = {
  pageBg: '#F2F3F5',
  panelBg: '#FFFFFF',
  primaryText: '#1C1C1E',
  secondaryText: '#8A8A8E',
  digitBg: '#FFFFFF',
  digitText: '#1A1A1A',
  functionBg: '#FFFFFF',
  functionText: '#F7811E',
  operatorBg: '#FFFFFF',
  operatorText: '#F7811E',
  equalBg: '#F7811E',
  equalText: '#FFFFFF',
  sciBg: '#FFFFFF',
  sciText: '#5B5B60',
  errorText: '#FF3B30',
  divider: '#E5E5EA',
  chipBg: '#E9E9EE'
};

export const DARK_THEME: ThemeColors = {
  pageBg: '#000000',
  panelBg: '#1C1C1E',
  primaryText: '#FFFFFF',
  secondaryText: '#98989F',
  digitBg: '#2C2C2E',
  digitText: '#FFFFFF',
  functionBg: '#2C2C2E',
  functionText: '#FF9F0A',
  operatorBg: '#2C2C2E',
  operatorText: '#FF9F0A',
  equalBg: '#FF9F0A',
  equalText: '#FFFFFF',
  sciBg: '#2C2C2E',
  sciText: '#98989F',
  errorText: '#FF453A',
  divider: '#3A3A3C',
  chipBg: '#1C1C1E'
};
