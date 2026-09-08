/**
 * 换算功能常量
 * 支持：长度、重量、面积、体积、时间、进制、温度、速度
 */

export interface Unit {
  id: string;
  name: string;     // 中文名称，如"米"
  symbol: string;   // 符号，如"m"
  factor?: number;  // 相对基准单位的换算系数（温度/进制不用）
  base?: number;    // 进制基数（仅进制转换）
}

export type ConvertType = 'ratio' | 'temperature' | 'radix';

export interface Category {
  id: string;
  name: string;        // 页面标题，如"长度转换"
  shortName: string;   // 网格文字，如"长度转换"
  units: Unit[];
  defaultFrom: string;
  defaultTo: string;
  type: ConvertType;
}

/** 网格类目，按样例图顺序排列（3 列） */
export const CONVERT_CATEGORIES: Category[] = [
  {
    id: 'length',
    name: '长度转换',
    shortName: '长度转换',
    type: 'ratio',
    defaultFrom: 'm',
    defaultTo: 'cm',
    units: [
      { id: 'km', name: '千米', symbol: 'km', factor: 1000 },
      { id: 'm', name: '米', symbol: 'm', factor: 1 },
      { id: 'dm', name: '分米', symbol: 'dm', factor: 0.1 },
      { id: 'cm', name: '厘米', symbol: 'cm', factor: 0.01 },
      { id: 'mm', name: '毫米', symbol: 'mm', factor: 0.001 },
      { id: 'um', name: '微米', symbol: 'μm', factor: 0.000001 },
      { id: 'nm', name: '纳米', symbol: 'nm', factor: 0.000000001 },
      { id: 'mi', name: '英里', symbol: 'mi', factor: 1609.344 },
      { id: 'yd', name: '码', symbol: 'yd', factor: 0.9144 },
      { id: 'ft', name: '英尺', symbol: 'ft', factor: 0.3048 },
      { id: 'in', name: '英寸', symbol: 'in', factor: 0.0254 },
      { id: 'nmi', name: '海里', symbol: 'nmi', factor: 1852 }
    ]
  },
  {
    id: 'weight',
    name: '重量转换',
    shortName: '重量转换',
    type: 'ratio',
    defaultFrom: 'kg',
    defaultTo: 'g',
    units: [
      { id: 't', name: '吨', symbol: 't', factor: 1000000 },
      { id: 'kg', name: '千克', symbol: 'kg', factor: 1000 },
      { id: 'g', name: '克', symbol: 'g', factor: 1 },
      { id: 'mg', name: '毫克', symbol: 'mg', factor: 0.001 },
      { id: 'ug', name: '微克', symbol: 'μg', factor: 0.000001 },
      { id: 'jin', name: '斤', symbol: '斤', factor: 500 },
      { id: 'liang', name: '两', symbol: '两', factor: 50 },
      { id: 'lb', name: '磅', symbol: 'lb', factor: 453.59237 },
      { id: 'oz', name: '盎司', symbol: 'oz', factor: 28.34952 },
      { id: 'ct', name: '克拉', symbol: 'ct', factor: 0.2 }
    ]
  },
  {
    id: 'area',
    name: '面积转换',
    shortName: '面积转换',
    type: 'ratio',
    defaultFrom: 'm2',
    defaultTo: 'cm2',
    units: [
      { id: 'km2', name: '平方千米', symbol: 'km²', factor: 1000000 },
      { id: 'ha', name: '公顷', symbol: 'ha', factor: 10000 },
      { id: 'mu', name: '亩', symbol: '亩', factor: 666.6667 },
      { id: 'm2', name: '平方米', symbol: 'm²', factor: 1 },
      { id: 'dm2', name: '平方分米', symbol: 'dm²', factor: 0.01 },
      { id: 'cm2', name: '平方厘米', symbol: 'cm²', factor: 0.0001 },
      { id: 'mm2', name: '平方毫米', symbol: 'mm²', factor: 0.000001 }
    ]
  },
  {
    id: 'time',
    name: '时间转换',
    shortName: '时间转换',
    type: 'ratio',
    defaultFrom: 'min',
    defaultTo: 's',
    units: [
      { id: 'year', name: '年', symbol: 'y', factor: 31536000 },
      { id: 'week', name: '周', symbol: 'wk', factor: 604800 },
      { id: 'day', name: '天', symbol: 'd', factor: 86400 },
      { id: 'h', name: '小时', symbol: 'h', factor: 3600 },
      { id: 'min', name: '分钟', symbol: 'min', factor: 60 },
      { id: 's', name: '秒', symbol: 's', factor: 1 },
      { id: 'ms', name: '毫秒', symbol: 'ms', factor: 0.001 },
      { id: 'us', name: '微秒', symbol: 'μs', factor: 0.000001 }
    ]
  },
  {
    id: 'volume',
    name: '体积转换',
    shortName: '体积转换',
    type: 'ratio',
    defaultFrom: 'm3',
    defaultTo: 'cm3',
    units: [
      { id: 'm3', name: '立方米', symbol: 'm³', factor: 1 },
      { id: 'dm3', name: '立方分米', symbol: 'dm³', factor: 0.001 },
      { id: 'cm3', name: '立方厘米', symbol: 'cm³', factor: 0.000001 },
      { id: 'l', name: '升', symbol: 'L', factor: 0.001 },
      { id: 'ml', name: '毫升', symbol: 'mL', factor: 0.000001 },
      { id: 'gal_us', name: '加仑(美)', symbol: 'gal', factor: 0.00378541 },
      { id: 'oz_us', name: '液盎司(美)', symbol: 'fl oz', factor: 0.00002957 }
    ]
  },
  {
    id: 'radix',
    name: '进制转换',
    shortName: '进制转换',
    type: 'radix',
    defaultFrom: 'dec',
    defaultTo: 'bin',
    units: [
      { id: 'bin', name: '二进制', symbol: 'BIN', base: 2 },
      { id: 'oct', name: '八进制', symbol: 'OCT', base: 8 },
      { id: 'dec', name: '十进制', symbol: 'DEC', base: 10 },
      { id: 'hex', name: '十六进制', symbol: 'HEX', base: 16 }
    ]
  },
  {
    id: 'temperature',
    name: '温度转换',
    shortName: '温度转换',
    type: 'temperature',
    defaultFrom: 'c',
    defaultTo: 'f',
    units: [
      { id: 'c', name: '摄氏度', symbol: '°C' },
      { id: 'f', name: '华氏度', symbol: '°F' },
      { id: 'k', name: '开尔文', symbol: 'K' }
    ]
  },
  {
    id: 'speed',
    name: '速度转换',
    shortName: '速度转换',
    type: 'ratio',
    defaultFrom: 'ms',
    defaultTo: 'kms',
    units: [
      { id: 'ms', name: '米/秒', symbol: 'm/s', factor: 1 },
      { id: 'kms', name: '千米/秒', symbol: 'km/s', factor: 1000 },
      { id: 'kmh', name: '千米/时', symbol: 'km/h', factor: 0.2777778 },
      { id: 'mph', name: '英里/时', symbol: 'mph', factor: 0.44704 },
      { id: 'kn', name: '节', symbol: 'kn', factor: 0.514444 },
      { id: 'mach', name: '马赫', symbol: 'Mach', factor: 340.3 }
    ]
  }
];

/** 根据 ID 查找类目 */
export function findCategory(id: string): Category | undefined {
  return CONVERT_CATEGORIES.find((c: Category) => c.id === id);
}

/** 根据 ID 查找单位 */
export function findUnit(category: Category, unitId: string): Unit | undefined {
  return category.units.find((u: Unit) => u.id === unitId);
}
