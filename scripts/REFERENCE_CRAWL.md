# 源站模块核验

脚本按源站当前页面逐项采集以下模块：预约、顾客、订单、数据报表、库存、短信、账号体系、门店、品项、门店员工和提成。

## 连接已打开的浏览器

普通启动的 Chrome 不提供 CDP，不能被脚本接管。启动一个不影响现有 Chrome 的调试实例：

```powershell
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$profile = "$env:TEMP\beauty-reference-debug"
& $chrome --remote-debugging-port=9222 --user-data-dir=$profile --start-maximized "https://saas.wikemi.com/operate/member/storeMember/content"
```

在这个调试实例中完成一次登录，然后执行：

```powershell
$env:REFERENCE_CDP_URL = 'http://127.0.0.1:9222'
pnpm verify:reference
```

报告和每个交互截图写入 `artifacts/reference-crawl/<时间>/`。单独核验一个模块时可以加：

```powershell
pnpm verify:reference -- --module=customers --output=artifacts/reference-crawl/customers
```

## 对比本地复刻

先分别对源站和本地地址执行 `verify:reference`，再比较两个 `report.json`：

```powershell
pnpm compare:reference -- `
  --source=artifacts/reference-crawl/source/report.json `
  --target=artifacts/reference-crawl/local/report.json `
  --output=artifacts/reference-crawl/comparison.md
```

脚本只自动执行打开页面、切换页签、打开详情/更多/筛选/抽屉/弹窗等非破坏性交互；保存、删除、提交、支付、发送、退出等动作会跳过并记录在报告中。
