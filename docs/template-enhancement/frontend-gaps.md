# Frontend Gap Analysis: morph-template vs genapp

> 分析日期: 2026-02-27
> 目标: 找出 morph-template 前端与 genapp 前端的差距，确定需要补全的基础设施

## 分析方法

GenApp 是基于 morph-template 构建的生产应用，前端比模板复杂 5-10x。本分析**排除 GenApp 特有的业务功能**（如可视化编辑器、AI Agent、项目管理），只关注**通用 SaaS 基础设施**差距。

---

## 差距总览

| # | 功能 | morph-template | genapp | 优先级 |
|---|------|---------------|--------|--------|
| 1 | i18n 国际化 | ❌ 无 | ✅ i18next, 中英双语 | P0 |
| 2 | Settings 多标签模态框 | ⚠️ 单独 /settings 页 | ✅ 多标签 Modal (账户/偏好/账单/用量) | P0 |
| 3 | Paywall 拦截 + 定价弹窗 | ⚠️ 仅 toast 报错 | ✅ PaywallContext + PricingModal | P0 |
| 4 | 订阅制定价页 | ⚠️ 仅算力包 | ✅ 订阅计划 + 算力包 + FAQ | P0 |
| 5 | Sidebar 可折叠导航 | ⚠️ 固定宽度 sidebar | ✅ 52px/260px 切换 + localStorage | P1 |
| 6 | 反馈收集 UI | ❌ 无 | ✅ FeedbackModal | P1 |
| 7 | 推荐系统 UI | ❌ 无 | ✅ ReferralModal + useReferral hook | P1 |
| 8 | OAuth 弹窗登录 | ❌ 页面跳转 | ✅ usePopupLogin hook | P1 |
| 9 | 动画系统 | ⚠️ 基础 framer-motion | ✅ 完整动画库 (BlurFade, Shimmer, DotPattern, etc.) | P2 |
| 10 | SEO 管理 | ❌ 无 | ✅ react-helmet + seo-config | P2 |
| 11 | 文件上传增强 | ⚠️ 基础上传 | ✅ 拖拽上传区 + 预览 + 多类型 | P2 |
| 12 | 用量统计页 | ❌ 无 | ✅ Settings > Usage 标签 | P1 |
| 13 | 模态框层级管理 | ❌ 无 | ✅ ModalBridgeContext + z-index stacking | P2 |
| 14 | 滚动位置记忆 | ❌ 无 | ✅ useScrollRestoration hook | P2 |
| 15 | 路由常量集中管理 | ⚠️ 散落在各处 | ✅ lib/routes.ts 集中定义 | P1 |

---

## 详细分析

### 1. i18n 国际化 (P0)

**当前状态**: morph-template 完全没有国际化支持，所有文本硬编码在组件中。

**genapp 做法**:
- i18next v25 + react-i18next v16
- 浏览器语言检测插件自动选择
- localStorage 持久化语言选择
- API 请求带 `Accept-Language` 头
- 翻译文件按 namespace 组织: `common`, `dashboard`
- 支持中英双语

**模板需要**:
- 安装 i18next + react-i18next + 语言检测插件
- 创建 `src/i18n/` 目录，配置初始化
- 创建 `locales/en/` 和 `locales/zh/` 翻译文件
- 所有硬编码文本用 `t()` 替换
- API 客户端带 `Accept-Language` 头
- Settings 中加语言切换选项

### 2. Settings 多标签模态框 (P0)

**当前状态**: 单独的 `/settings` 页面，只有名字编辑和邮箱显示。

**genapp 做法**:
- SettingsContext 提供全局 `openSettings(tab?)` 方法
- Dialog-based 模态框，4 个标签:
  - Account: 头像、名字、邮箱、删除账号
  - Preferences: 语言、主题
  - Billing: 当前计划、升级、算力包购买
  - Usage: 用量统计、信用记录

**模板需要**:
- 创建 `SettingsContext` 提供全局开关
- 创建 `SettingsModal` 多标签组件
- 标签页: Account / Preferences / Billing / Usage
- 从 sidebar 和 header dropdown 都能打开

### 3. Paywall 拦截 + 定价弹窗 (P0)

**当前状态**: API 错误统一 toast，paywall 错误码 (INSUFFICIENT_CREDITS 等) 只是不 toast 但也没有特殊处理。

**genapp 做法**:
- `PaywallContext` 全局监听 paywall 错误码
- 触发时自动弹出 `PricingModal`
- `PricingModal` 显示订阅计划 + 算力包 + FAQ
- 多入口触发: URL 参数 `?pricing=1`、导航链接、paywall 错误
- `PricingContext` 提供 `openPricingModal()` 方法

**模板需要**:
- 创建 `PaywallContext` 监听 paywall 错误码
- 创建 `PricingContext` 提供全局定价弹窗控制
- 创建 `PricingModal` 组件（显示计划 + 算力包）
- API 错误处理中集成 paywall 检测
- 在 `apiFetch` 的 catch 里触发 paywall 流程

### 4. 订阅制定价页 (P0)

**当前状态**: `/pricing` 页只有算力包 (Starter, Professional, Enterprise)。

**genapp 做法**:
- 订阅计划卡片 (Free, Starter, Pro, Max)
- 月付/年付切换
- 功能对比列表
- 算力包作为补充购买
- FAQ 部分
- 从多个入口可达 (定价页、弹窗、paywall)

**模板需要**:
- 重写 `/pricing` 页面和 `PricingSection` 组件
- 加入订阅计划卡片 (从 `@repo/shared` 读取 PRICING_PLANS)
- 月付/年付切换
- 功能对比表 (从 PLAN_LIMITS 生成)
- CTA 按钮调用 checkout API

### 5. Sidebar 可折叠 (P1)

**当前状态**: 固定宽度 sidebar，没有折叠功能。

**genapp 做法**:
- 展开: 260px，折叠: 52px (只显示图标)
- `useSidebar` hook + localStorage 持久化
- 折叠模式下 hover 显示 tooltip
- 平滑过渡动画

**模板需要**:
- 创建 `useSidebar` hook
- 修改 `dashboard-sidebar.tsx` 支持折叠
- 折叠时显示 tooltip
- localStorage 持久化状态

### 6. 反馈收集 UI (P1)

**当前状态**: 后端有 `/api/feedback` 但前端没有 UI。

**genapp 做法**:
- FeedbackModal 支持 bug/feature/general 类型
- 标题 + 描述 + 截图上传
- 从 sidebar 或 help menu 触发

**模板需要**:
- 创建 `FeedbackModal` 组件
- 类型选择 (bug, feature, general)
- 标题 + 描述表单
- 可选截图上传 (调用 R2 upload)
- 在 sidebar 添加入口

### 7. 推荐系统 UI (P1)

**当前状态**: 后端有 `/api/referral` 但前端没有 UI。

**genapp 做法**:
- ReferralModal 显示推荐链接 + 统计
- useReferral hook 处理 URL 参数中的推荐码
- 注册后自动应用推荐码

**模板需要**:
- 创建 `ReferralModal` 组件
- 显示推荐链接 (复制按钮)
- 推荐统计 (邀请人数、获得算力)
- `useReferral` hook 检测 URL 推荐参数
- 登录后自动调用 apply API

### 8. OAuth 弹窗登录 (P1)

**当前状态**: OAuth 登录通过页面跳转实现。

**genapp 做法**:
- `usePopupLogin` hook
- 在新窗口打开 OAuth 流程
- 跨窗口通信检测完成
- 登录成功后回调

**模板需要**:
- 创建 `usePopupLogin` hook
- 支持 Google/GitHub OAuth 弹窗
- 监听登录完成事件

### 9. 动画系统 (P2)

**当前状态**: 基础 framer-motion 用于 landing page。

**genapp 做法**:
- 完整动画组件库:
  - BlurFade (文字模糊渐入)
  - DotPattern (背景点阵)
  - ShimmerButton (闪光按钮)
  - StaggerContainer / FadeInView (容器动画)
  - TimelineList (时间线动画)
- motion-config.ts 集中管理动画参数

**模板需要**:
- 可以逐步添加，先加最常用的 FadeInView 和 StaggerContainer

### 10. SEO 管理 (P2)

**当前状态**: 没有 meta tag 管理。

**genapp 做法**:
- react-helmet-async
- seo-config.ts 集中管理 meta 数据
- 每个页面设置 title + description + og tags

**模板需要**:
- 安装 react-helmet-async
- 创建 seo-config.ts
- 页面组件中设置 meta tags

### 11. 文件上传增强 (P2)

**当前状态**: 基础 upload 工具 (uploadFile + validateFile)。

**genapp 做法**:
- FileUploadZone 拖拽上传区域
- FilePreviewGrid 图片预览网格
- FileUploadButton 简洁按钮
- useFileUpload hook 管理上传状态
- 支持多文件、PDF base64、文本内容注入

**模板需要**:
- 创建 FileUploadZone 拖拽组件
- 创建 FilePreviewGrid 预览组件
- 创建 useFileUpload hook

### 12. 用量统计页 (P1)

**当前状态**: 没有用量展示 (后端已有 /api/user/usage-history)。

**genapp 做法**:
- Settings > Usage 标签
- 显示信用消耗图表
- 信用记录列表 (type, amount, date)
- 按日期/类型筛选

**模板需要**:
- 在 SettingsModal 中添加 Usage 标签
- 调用 /api/user/usage-history
- 信用记录列表 + 筛选

### 13. 模态框层级管理 (P2)

**当前状态**: 没有统一的模态框管理。

**genapp 做法**:
- ModalBridgeContext 防止循环依赖
- z-index 自动管理 (BASE_Z_INDEX=50)
- callback 注册模式实现跨模态通信

**模板需要**: 等有多个复杂模态框时再加，目前不急。

### 15. 路由常量集中管理 (P1)

**当前状态**: 路由字符串散落在各组件中。

**genapp 做法**:
- `lib/routes.ts` 集中定义所有路由
- 动态路由 helper 函数

**模板需要**:
- 创建 `lib/routes.ts`
- 替换所有硬编码路由字符串

---

## 实施状态

### Phase 1: P0 + P1 核心功能 ✅ 已完成

> 实施日期: 2026-02-27 ~ 2026-03-01

| Stage | 功能 | 状态 | 新增/修改文件 |
|-------|------|------|---------------|
| 1 | Foundation (shadcn/ui + i18n) | ✅ | 7 UI 组件, i18n 配置, 中英翻译文件 |
| 2 | Collapsible Sidebar | ✅ | SidebarProvider, NavItem/NavButton, 折叠逻辑 |
| 3 | Paywall + PricingModal | ✅ | PaywallProvider, PricingProvider, PricingModal, PricingCard |
| 4 | Settings Modal | ✅ | SettingsProvider, 4 标签 (Account/Preferences/Billing/Usage) |
| 5 | Feedback + Referral Modals | ✅ | FeedbackProvider/Modal, ReferralProvider/Modal |
| 6 | i18n Integration | ✅ | ~14 页面文件 t() 替换 |

**验证结果**:
- `pnpm build` — ✅ 通过
- `pnpm check:lines` — ✅ 141 文件均在 500 行内
- `pnpm check` — ✅ biome lint/format 通过

**Provider 组合 (App.tsx)**:
```
ErrorBoundary > QueryClientProvider > PaywallProvider > PricingProvider >
  SettingsProvider > FeedbackProvider > ReferralProvider >
    Routes + PricingModal + SettingsModal + FeedbackModal + ReferralModal
```

### Phase 2: 待实施

| # | 功能 | 优先级 | 备注 |
|---|------|--------|------|
| 8 | OAuth 弹窗登录 | P1 | usePopupLogin hook |
| 9 | 动画系统增强 | P2 | BlurFade, StaggerContainer 等 |
| 10 | SEO 管理 | P2 | react-helmet-async |
| 11 | 文件上传增强 | P2 | 拖拽上传区, 预览 |
| 13 | 模态框层级管理 | P2 | ModalBridgeContext |
| 14 | 滚动位置记忆 | P2 | useScrollRestoration |

> 注: 路由常量 (#15) 已经存在于 `apps/web/src/lib/routes.ts`，无需额外实施。
> 用量统计 (#12) 已包含在 Settings Modal > Usage 标签中。
