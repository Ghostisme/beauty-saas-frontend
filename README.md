# 余乐圈美业前端

React + TypeScript + Vite + Ant Design，使用 pnpm 管理依赖。当前阶段只实现登录页、首页和基础设置，使用 Ant Design 默认蓝色主题。

## 本地启动

环境：Node.js 22.13+（本机已验证 24.6.0），pnpm 11.23.0。项目通过 `packageManager` 固定 pnpm 版本，所有直接依赖及 `pnpm-lock.yaml` 一并固定。

```powershell
cd "D:\github_code\余乐圈美业项目资料\beauty-saas-frontend"
pnpm install --frozen-lockfile
pnpm dev
```

- PC：<http://localhost:5173>
- 手机 / Pad：与电脑连接同一局域网，访问 `http://电脑局域网IP:5173`。本次机器地址为 `192.168.1.5`，地址变化后以 Vite 终端的 Network 地址为准。
- 后端：<http://127.0.0.1:8080>，Vite 将 `/api` 请求代理给后端。
- 本机已有其他应用占用 3000、3001，因此使用 5173 并开启 `strictPort`，端口冲突会明确报错。
- 已验证当前开发账号：`admin / admin123`。登录通过真实的 `POST /api/user/login` 接口完成。
- 账号区域显示昵称和真实账号；默认管理员旧乱码昵称的本地登录缓存会自动迁移。

安装依赖前请先在前端终端按 Ctrl+C 停止 Vite。Windows 正在运行的原生依赖可能被占用，引发 EPERM。日常使用锁文件安装即可，无需删除锁文件、反复强制安装或切换 npm。

## 命令与验证

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器，端口 5173，支持同网手机与 Pad |
| `pnpm typecheck` | TypeScript 严格类型检查 |
| `pnpm build` | 先检查类型，再生成生产产物到 `dist/` |
| `pnpm preview` | 本地预览生产产物，端口 4173 |
| `pnpm test:e2e` | 在 Chrome 中验证桌面、平板、手机交互 |

浏览器测试使用本机 Chrome。没有安装 Chrome 时，先运行 `pnpm exec playwright install chrome`。测试会自动启动 Vite；已有 5173 开发服务器时复用它。测试产物在 `test-results/`，页面截图在 `artifacts/`，二者均不提交。

验证记录：
- pnpm 首次安装及 `--frozen-lockfile` 安装成功。
- TypeScript + Vite 生产构建成功。
- 55 项浏览器测试通过：2560×1431、1440×1000、1366×768、834×1112、390×844，包含窗口拉高 / 缩回、卡片填满可用高度、页脚位置及内容不裁切的断言。
- 电脑 / PAD 来回切换、键盘操作、布局宽度和触控尺寸、筛选条件保留、刷新记忆、无效偏好回退、手机布局优先及居中布局下的顶部菜单 / 日期弹层定位均有浏览器测试覆盖。
- 五个提醒弹窗的表头、空态居中、横向滚动、键盘 / 遮罩关闭、焦点恢复、数据展示及加载 / 重试状态均通过验证；另检查 320×568、844×390 下弹窗不超出视口，低高度时内容在弹窗内部滚动。
- 额外检查 320×740、375×667、768×1024、1024×768、844×390：登录页、首页、日期弹层均无整页横向溢出。
- 使用真实后端完成登录和刷新保持会话；浏览器无运行时错误。
- 自动化中的失败响应、认证数据和提醒列表样例均为浏览器测试夹具；提醒测试数据位于 `tests/fixtures/home-reminders.tsx`，不被生产入口引用，也不写业务数据库。

## 当前功能

- 登录页：账号密码校验、提交状态、服务错误提示、密码显示 / 隐藏、忘记密码提示。
- 会话：持久化登录、过期检查、受保护路由、退出、跨标签页退出同步；损坏的本地缓存不会导致白屏。
- 布局：白色顶栏，只保留设置和登录信息；侧栏只保留“首页”。
- 显示模式：左下角按钮显示当前“电脑模式 / PAD模式”，点击即可互相切换。电脑模式铺满浏览器宽度，保留完整侧栏；PAD 模式按最大 1024px 的平板宽度居中展示，使用图标侧栏、重新排列的筛选区和较大的触控控件，不通过缩放整页模拟。切换不重置当前筛选条件，刷新后记住已选模式。
- 响应式：未手动选择模式时，按窗口宽度自动选择电脑 / PAD 布局；小于 768px 时始终优先使用手机抽屉导航、横向滚动提醒条和两列指标，窗口变宽后恢复已选模式。首页目标区和业绩区弹性填满可用视口高度，页脚靠底；低高度窗口减少留白，内容放不下时自然滚动，不裁切或压缩文字。
- 首页：提醒条、本月目标、“门店 / 我的”切换、业绩概览、今天 / 近7天 / 近30天 / 自定义日期、门店筛选控件。
- 首页提醒弹窗：顾客生日、待确认预约、持卡未到店、会员卡到期、充值提醒，独立表头 / 列表组件和蓝色空状态；支持关闭按钮、Escape、遮罩关闭、焦点返回原入口，小屏表格内部横向滚动，空状态始终居中。
- 设置：当前浏览器内的门店显示名称、登录账号与用户编号。

范围边界：短信发送 / 登录、密码重置接口、提醒查询、目标和业绩统计接口尚未实现。顾客回访提醒、库存预警仍提示未开通，不在本次范围内；上述五个提醒已完成前端列表弹窗，因后端目前只有登录功能、没有对应业务数据，当前展示空状态，不伪造顾客、会员卡或预约记录、不请求不存在的接口。目标展示空状态，六项业绩数值目前是参考图对应的零值占位。日期切换和范围选择已可交互。门店名称设置只保存当前浏览器的显示偏好。

### 本阶段提醒模块与文件对应

以下文件位于 `src/components/home-reminders/`，共用 `ReminderListModal.tsx`，记录类型位于 `src/types/home-reminders.ts`。

| 首页入口 / 弹窗 | 已确认的表头 | 对应文件 |
| --- | --- | --- |
| 顾客生日 | 顾客信息、日期类型、时间 | `BirthdayReminderModal.tsx` |
| 待确认预约 | 顾客信息、预约项目、预约时间、预约员工 | `PendingAppointmentReminderModal.tsx` |
| 持卡顾客7–100天未到店 / 持卡未到店 | 顾客信息、时间 | `InactiveCardReminderModal.tsx` |
| 会员卡到期 | 顾客信息、卡名称、到期时间 | `MembershipExpiryReminderModal.tsx` |
| 充值提醒 | 会员姓名、跟踪员工、累计消费、总到店次数、所属门店 | `RechargeReminderModal.tsx` |

充值提醒截图右侧未展示完整的列暂不猜测，补充截图后再增加。组件已提供类型化记录、加载 / 失败状态、重试回调和分页参数，后续业务模块的数据查询可接入，不需要重新搭建弹窗。当前没有新增后端表或修改 Docker / 数据库。

## 技术栈

| 项目 | 版本 |
| --- | --- |
| React / React DOM | 19.3.0 |
| TypeScript | 6.0.2 |
| Vite / React 插件 | 8.3.0 / 6.1.1 |
| Ant Design | 6.6.5 |
| React Router | 7.18.4 |
| pnpm | 11.23.0 |

使用官方 React TypeScript 模板对应的版本组合。Vite 配置和 TypeScript 配置都将 `@/*` 指向 `src/*`，统一编辑器、类型检查及构建的路径解析。旧的 JSX、JS、SCSS 入口已替换。请求层使用浏览器原生 fetch，状态通过 React Context 管理。

```text
src/
├── api/auth.ts                 # 登录接口
├── components/                 # 顶栏、侧栏、设置、空状态、页脚
├── config/app.ts               # 产品名和默认门店名称
├── context/                    # 登录会话、显示设置
├── lib/                        # 请求封装、会话校验及存储
├── pages/
│   ├── LoginPage.tsx           # 登录页
│   └── HomePage.tsx            # 首页
├── styles/global.css           # 布局与响应式样式
├── types/auth.ts               # 后端登录契约
├── App.tsx                     # 路由与保护
└── main.tsx                    # 应用入口与 Ant Design 配置
```

## 官方参考资料

- [Vite 官方 React TypeScript 模板](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)
- [Ant Design：在 Vite 中使用](https://ant.design/docs/react/use-with-vite-cn)
- [Ant Design 默认主题与 Token](https://ant.design/docs/react/customize-theme-cn)
- [Ant Design Modal 弹窗](https://ant.design/components/modal-cn/)
- [Ant Design Table 表格](https://ant.design/components/table-cn/)
- [pnpm 安装与锁文件](https://pnpm.io/cli/install)

原有源码与未完成的依赖目录已备份到项目旁的 `beauty-saas-frontend-backups/before-react-ts-20260921-203423/`。
