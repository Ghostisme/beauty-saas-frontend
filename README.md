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
- 后端当前返回的旧昵称含乱码，因此登录区域显示账号；原始后端数据未在本次修改。

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

本次验证：
- pnpm 首次安装及 `--frozen-lockfile` 安装成功。
- TypeScript + Vite 生产构建成功。
- 9 项浏览器测试通过：1440×1000、834×1112、390×844。
- 额外检查 320×740、375×667、768×1024、1024×768、844×390：登录页、首页、日期弹层均无整页横向溢出。
- 使用真实后端完成登录和刷新保持会话；浏览器无运行时错误。
- 自动化中的失败响应、认证数据和空首页使用浏览器内测试夹具，不进入产品运行代码，也不写业务数据库。

## 当前功能

- 登录页：账号密码校验、提交状态、服务错误提示、密码显示 / 隐藏、忘记密码提示。
- 会话：持久化登录、过期检查、受保护路由、退出、跨标签页退出同步；损坏的本地缓存不会导致白屏。
- 布局：白色顶栏，只保留设置和登录信息；侧栏只保留“首页”。
- 响应式：PC 完整侧栏；Pad 图标侧栏；手机抽屉导航、横向滚动提醒条和两列指标。
- 首页：提醒条、本月目标、“门店 / 我的”切换、业绩概览、今天 / 近7天 / 近30天 / 自定义日期、门店筛选控件。
- 设置：当前浏览器内的门店显示名称、登录账号与用户编号。

范围边界：短信发送 / 登录、密码重置接口、提醒业务、目标和业绩统计接口尚未实现。短信与提醒入口明确提示未开通，目标展示空状态，六项业绩数值目前是参考图对应的零值占位。日期切换和范围选择已可交互，尚未向不存在的统计接口请求数据。门店名称设置只保存当前浏览器的显示偏好。

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
- [pnpm 安装与锁文件](https://pnpm.io/cli/install)

原有源码与未完成的依赖目录已备份到项目旁的 `beauty-saas-frontend-backups/before-react-ts-20260921-203423/`。
