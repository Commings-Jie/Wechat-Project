import { DARK_THEME, LIGHT_THEME, ThemeColors } from '../common/constants/ThemeColors';
import { Category, CONVERT_CATEGORIES } from '../common/constants/ConvertConstants';
import { KEY_IS_DARK, PreferencesUtil } from '../common/utils/PreferencesUtil';

/**
 * 换算首页
 * 顶部：计算 / 换算 Tab + 右上角菜单
 * 中部：3 列网格入口，与样例图一致
 */
@Entry
@Component
struct ConvertHome {
  @StorageLink('isDark') @Watch('onThemeChange') isDark: boolean = false;

  private theme(): ThemeColors {
    return this.isDark ? DARK_THEME : LIGHT_THEME;
  }

  onThemeChange(): void {
    PreferencesUtil.put(KEY_IS_DARK, this.isDark);
  }

  build() {
    Column() {
      this.Header()
      this.GridArea()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme().pageBg)
    .padding({ left: 16, right: 16, top: 16, bottom: 24 })
  }

  @Builder
  Header() {
    // 用 Stack：Tab 行占满整宽居中，右上角 ⋮ 绝对靠右，两者互不影响
    Stack({ alignContent: Alignment.End }) {
      Row() {
        Blank()
          .layoutWeight(1)

        // 计算 Tab（可返回计算器）
        Text('计算')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme().secondaryText)
          .onClick(() => {
            this.getUIContext().getRouter().back();
          })

        Blank()
          .width(24)

        // 换算 Tab（当前页，高亮）
        Text('换算')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().primaryText)

        Blank()
          .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // 右上角菜单（无背景、无边框）
      Text('⋮')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().primaryText)
        .padding({ left: 14, right: 14, top: 2, bottom: 2 })
        .bindMenu([
          {
            value: this.isDark ? '☀  切换亮色' : '☾  切换暗色',
            action: () => {
              this.isDark = !this.isDark;
            }
          }
        ])
    }
    .width('100%')
    .padding({ bottom: 24 })
  }

  @Builder
  GridArea() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start, alignItems: ItemAlign.Start }) {
      ForEach(CONVERT_CATEGORIES, (item: Category) => {
        this.GridItem(item)
      }, (item: Category, index: number) => item.id)
    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  GridItem(item: Category) {
    Column() {
      // 类目图标（橙色线性图标，亮暗主题通用）
      Image(this.categoryIcon(item.id))
        .width(48)
        .height(48)
        .objectFit(ImageFit.Contain)

      // 名称
      Text(item.shortName)
        .fontSize(13)
        .fontColor(this.theme().primaryText)
        .margin({ top: 8 })
    }
    .width('33%')
    .padding({ top: 14, bottom: 14 })
    .onClick(() => {
      this.getUIContext().getRouter().pushUrl({
        url: 'pages/ConvertDetail',
        params: { categoryId: item.id }
      });
    })
  }

  /** 类目 → 图标资源 */
  private categoryIcon(id: string): Resource {
    switch (id) {
      case 'length':
        return $r('app.media.conv_length');
      case 'weight':
        return $r('app.media.conv_weight');
      case 'area':
        return $r('app.media.conv_area');
      case 'time':
        return $r('app.media.conv_time');
      case 'volume':
        return $r('app.media.conv_volume');
      case 'radix':
        return $r('app.media.conv_radix');
      case 'temperature':
        return $r('app.media.conv_temperature');
      default:
        return $r('app.media.conv_speed');
    }
  }
}
