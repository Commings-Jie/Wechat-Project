import { hilog } from '@kit.PerformanceAnalysisKit';

/**
 * 日志工具
 */
export default class Logger {
  private static readonly DOMAIN: number = 0xFF00;
  private static readonly PREFIX: string = '[Calculator]';

  static info(tag: string, message: string): void {
    hilog.info(Logger.DOMAIN, tag, '%{public}s%{public}s', Logger.PREFIX, message);
  }

  static error(tag: string, message: string): void {
    hilog.error(Logger.DOMAIN, tag, '%{public}s%{public}s', Logger.PREFIX, message);
  }
}
