# dsh-restart

重启整个 DeepSeek Harness 进程的插件，用于重新加载插件与配置（profile 的 cordis 组合、settings 等）。host + client 双半，装进 profile 的 bundle 后即可用。

![DSH 重启插件设置](./docs/images/dsh-restart-settings.png)

> 截图来自真实 `web` profile 部署，展示当前 DSH 设置页中的重启配置卡片。

## 功能

- **模型工具 `restart_harness`**：让 agent 直接安排一次进程重启（可选 `delayMs`）。
- **`/restart` 斜杠命令**：在 UI 里手动触发重启。
- **配置卡片**（设置 → 插件 → 「dsh-restart」页面）：可视化编辑以下设置，改动即时写入 profile 配置：
  - `legacyRestart` — 旧 PowerShell/WMI/taskkill 重启方式（默认关闭，用 Node 原生方式）。
  - `continuePrompt` — 重启后自动继续时注入给 agent 的提示词。留空时按 DSH「语言」（Language）设置选择默认文案（`zh` 用中文，其余用英文）；未设置语言时界面跟随浏览器，客户端会把当前界面语言上报给 host 并随重启记入恢复标记，都没有时回退英文（与 DSH 自身的 `FALLBACK_LOCALE` 一致）：注入中文会把中文模型后续回复也带成中文。
- **「立即重启」按钮**：先读取当前进程身份，安排重启后等待新进程恢复并自动刷新页面。只读 GET 返回 `{ pid, startedAt }`；出于安全考虑，重启 POST 仍仅接受来自环回地址（127.0.0.1 / localhost）的同源请求，经反向代理/远程访问时会被拒绝（403）。

> 自 `0.1.3-alpha.4` 起，内置 detached watchdog 已停用并从设置卡片移除。旧
> `watchdog*` 配置仍可被读取但不会执行；进程异常恢复请交给 systemd、Windows
> 服务或其他拥有完整进程生命周期的外部管理器。插件启动时会保留
> `$DSH_HOME/dsh-stop.flag`，让旧版本遗留的 detached watchdog 自行退出。

## 兼容与发布通道

| 插件发布通道 | DSH 基线 | 兼容承诺 |
|---|---|---|
| npm `latest`（当前正式发布插件） | `dsh-v0.1.1-rc.2` | 已验证维护基线 |
| npm `next` 候选（`0.1.3-alpha.5`） | `dsh-v0.1.5-alpha.1` | 精确依赖与真实 profile 验收目标 |
| 本分支（DSH `0.2.x` 适配） | `dsh 0.2.0-rc.2` | peer 范围 `^0.2.0-rc.1`，真实 profile 验收目标 |

DSH `0.2.x` 在启动时校验插件的 `@deepseek-ai/dsh-*` peerDependencies，版本不符的
插件会被拒绝加载。本分支的 host 半改为导出 cordis `Config` schema（`ctx.settings`
不再有 `installSection`），客户端配置卡片迁移到 `configForms` 服务与插件管理页的
`plugins.bundle.config` keyed slot；`0.1.x` 仍使用 npm 上已发布的 `0.1.3-alpha.5`。

开发版不会覆盖 npm `latest`。`0.1.5-alpha.1` 依赖按精确版本锁定；该版本已移除
`@deepseek-ai/dsh-client-runtime`，客户端契约分别迁移到 Cordis、
`dsh-client-store` 与 `dsh-client-ui-settings`，不会混装 rc.2 运行时。

### `0.1.3-alpha.4` 变更

- 禁用并移除内置 detached watchdog；旧配置保留为无操作兼容项。
- Windows 重启通过隐藏控制台拉起，保留完整 argv，避免后续 sandbox 命令闪窗。
- 新进程 PID 变化后继续等待带认证的前端首页返回成功，再刷新页面，避免源码部署
  重启期间因静态前端尚未挂载而停留在 HTTP 404。
- 防止并发请求重复安排 helper；helper 创建失败时保留旧进程，并记录失败日志。
- 自动继续投递失败时保留恢复标记；Web 路由随 Cordis 生命周期正确释放。

### 重启流程（本分支）

- 旧进程在 `delayMs` 后经 DSH 自身的 SIGTERM 优雅关闭退出（Windows 仍直接退出）；
  detached helper 等到旧 PID 真正退出后才拉起新进程，旧进程 30 秒内未退出则放弃拉起
  并写入 `logErr`，不会出现两个 DSH 抢同一端口。helper 脚本启动即删除自身。
- 新进程使用 DSH 启动时继承的环境：启动器从 `.env` 物化进 `process.env` 的变量与
  `dsh-http-proxy` 发布的代理变量不会被当作继承环境传下去，新进程会自行重新读取。
- 作为 systemd 服务的主进程运行时（检测 `INVOCATION_ID`/`NOTIFY_SOCKET`、cgroup 所属
  `.service` 且其 `MainPID` 就是本进程）不再使用 helper（它会随服务 cgroup 一起被杀）：
  `Restart=always`/`on-success` 时直接优雅退出由 systemd 拉起（受 `RestartSec` 影响）；
  其它策略时提交 `systemctl [--user] restart --no-block <unit>` 任务；无权重启的系统
  unit 会直接报错而不是让 DSH 停掉。新进程日志见 `journalctl [--user] -u <unit>`。
  设 `DSH_RESTART_SYSTEMD=0` 可关闭该检测。
- 恢复标记只在新进程中消费；没有浏览器重新打开的会话由 host 通过会话控制器
  （`sessionController.resolveAgent`，与 Web 打开会话同一路径、归属控制器而非本插件）
  恢复后再注入继续提示；已继续的会话会立即从标记中移除，已在运行的会话不会再被注入；
  重启安排失败时标记会被清除。

### 源码部署排错

- 本开发分支只对齐 DSH `0.2.x`（`0.2.0-rc.2` 验证）。源码 checkout 先执行
  `corepack pnpm install` 和 `corepack pnpm run build`，再把本地插件
  重新加入隔离 profile；只安装依赖但没有构建 workspace，会表现为缺少
  `@deepseek-ai/*/lib`，并不是 restart 拉起失败。
- DSH `0.2.x` 的插件配置页在「设置 → 插件 → dsh-restart」；若卡片不出现，先确认
  宿主与插件客户端同为 `0.2.x` 契约（`plugins.bundle.config` keyed slot）。
- pnpm 首次安装 profile 依赖时可能把原生包写成待决的 `allowBuilds` 项。逐项确认
  `true` 或 `false` 后重跑 `dsh plugin --profile <name> add ...`，不要用全局放行绕过。
- 若旧版本重启后已经停在浏览器 HTTP 错误页，请手工打开新进程日志打印的当前
  `dsh web:` URL 完成一次恢复；升级到本版本后，设置卡片会等待首页真正就绪再刷新。

## 安装

1. 把包加入 profile 依赖并挂进 bundle：

```jsonc
// profiles/<profile>/package.json
{
  "dependencies": { "dsh-restart": "..." },
  "dsh": { "profile": { "bundles": ["...", "dsh-restart"] } }
}
```

2. 重启 DSH（`/restart` 或 `restart_harness`），刷新页面后即可看到卡片；之后通过卡片重启时会自动等待并恢复页面。

## 构建

```bash
pnpm install
node scripts/link-dsh-workspace.mjs --source <path-to-deepseek-harness>
pnpm run build
```

host 半由 `tsc` 输出到 `lib/index.js`（`@deepseek-ai/*` 保持外部依赖）；client 半由 `tsdown` 打成单文件 `lib/client.js`。
