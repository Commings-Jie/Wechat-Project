import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

const STORE_NAME: string = 'calculator_store';

export const KEY_IS_DARK: string = 'isDark';
export const KEY_HISTORY: string = 'history';

/**
 * 轻量本地存储
 *
 * PersistentStorage 在 API 18+ 已废弃，这里改用 preferences 手动读写。
 * 启动时读取并灌进 AppStorage，页面仍用 @StorageLink 正常双向绑定。
 */
export class PreferencesUtil {
  private static store: preferences.Preferences | undefined = undefined;

  /** 在 EntryAbility.onCreate 里调用一次 */
  static init(context: common.UIAbilityContext): void {
    try {
      PreferencesUtil.store = preferences.getPreferencesSync(context, { name: STORE_NAME });
    } catch (err) {
      PreferencesUtil.store = undefined;
    }
  }

  static getBoolean(key: string, defValue: boolean): boolean {
    try {
      if (PreferencesUtil.store === undefined) {
        return defValue;
      }
      return PreferencesUtil.store.getSync(key, defValue) as boolean;
    } catch (err) {
      return defValue;
    }
  }

  static getString(key: string, defValue: string): string {
    try {
      if (PreferencesUtil.store === undefined) {
        return defValue;
      }
      return PreferencesUtil.store.getSync(key, defValue) as string;
    } catch (err) {
      return defValue;
    }
  }

  /** 写入并立即落盘 */
  static put(key: string, value: boolean | string): void {
    try {
      if (PreferencesUtil.store === undefined) {
        return;
      }
      PreferencesUtil.store.putSync(key, value);
      PreferencesUtil.store.flushSync();
    } catch (err) {
      // 存不下就算了，不影响计算功能
    }
  }
}