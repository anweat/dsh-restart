# dsh-restart

重启整个 DeepSeek Harness 进程的插件，用于重新加载插件与配置（profile 的 cordis 组合、settings 等）。host + client 双半，装进 profile 的 bundle 后即可用。

![DSH 重启插件设置](./docs/images/dsh-restart-settings.png)

> 截图为 `0.1.5-alpha.1` 期的设置卡片，仅示意配置项；`0.1.7-rc.2` 起本插件改为在设置
> 左栏注册独立页「DSH 重启」（list slot `settings.section`），不再挂在「插件」分组下。

## 功能

- **模型工具 `restart_harness`**：让 agent 直接安排一次进程重启（可选 `delayMs`）。
- **`/restart` 斜杠命令**：在 UI 里手动触发重启。
- **独立配置页**（设置 → 左栏「DSH 重启」，list slot `settings.section`）：可视化编辑以下设置，改动即时写入 `settings.yaml`：
  - `legacyRestart` — 旧 PowerShell/WMI/taskkill 重启方式（默认关闭，用 Node 原生方式）。
  - `continuePrompt` — 重启后自动继续时注入给 agent 的提示词。
  - `quickRestartSidebar` — 是否在主面板左下角动作栏（恰好是 Settings 上方）显示一键重启，默认开。
  - `quickRestartHeader` — 是否在对话标题右侧显示一键重启，默认关。
- **「立即重启」按钮（二次确认）**：先弹确认对话框，确认后才读取当前进程身份、安排重启，并等待新进程恢复后在原地提示「重启完成」（不再强制刷新页面）。只读 GET 返回 `{ pid, startedAt }`；重启路由复用 Connection 的信任栅栏（Host/Origin + 浏览器认证），与 `/api` 走同一道门，所以页面能用的访问方式（含受信任的反向代理 / Tailscale）按钮一样可用。宿主没有 Connection 服务时退回历史规则：仅环回同源。
- **主面板一键重启（两处可选 seat）**：主面板左下角动作栏（`sidebar.footer.action`，渲染在
  Settings 这一行上方，默认开）与对话标题右侧（`conversation.session.header.actions`，
  默认关，用于侧边栏收起/隐藏时）。两个 seat 都是 `list` slot，其它插件是并排叠加而不是
  争抢同一个格子；侧边栏折叠成图标栏时只显示 `↻`，展开时显示文案，只用主题 token 自适应
  宽度。任一 seat 触发重启都会先走同一个二次确认（Escape 或点击遮罩取消）。

> 自 `0.1.3-alpha.4` 起，内置 detached watchdog 已停用并从设置卡片移除。旧
> `watchdog*` 配置仍可被读取但不会执行；进程异常恢复请交给 systemd、Windows
> 服务或其他拥有完整进程生命周期的外部管理器。插件启动时会保留
> `$DSH_HOME/dsh-stop.flag`，让旧版本遗留的 detached watchdog 自行退出。

## 兼容与发布通道

| 插件发布通道 | DSH 基线 | 兼容承诺 |
|---|---|---|
| npm `latest`（当前正式发布插件） | `dsh-v0.1.1-rc.2` | 已验证维护基线 |
| npm `next` 候选（`0.1.3-alpha.5`） | `dsh-v0.1.5-alpha.1` | 精确依赖与真实 profile 验收目标 |
| 本地验收（`0.1.3-alpha.6`） | `dsh-v0.1.7-rc.2` | 真实 `web` profile 安装 + 单元测试（独立设置页 / 两处一键重启 / 二次确认） |
| 后续 DSH 正式版 | 尚未发布 | 发布并完成真实 profile 门禁后再声明兼容 |

开发版不会覆盖 npm `latest`。`0.1.5-alpha.1` 依赖按精确版本锁定；该版本已移除
`@deepseek-ai/dsh-client-runtime`，客户端契约分别迁移到 Cordis、
`dsh-client-store` 与 `dsh-client-ui-settings`，不会混装 rc.2 运行时。

`0.1.3-alpha.6` 只改客户端注册、一键重启入口与重启后的自动继续（生产者的 source kind + 服务端恢复会话），源码依赖仍锁在
`0.1.5-alpha.1`：用到的 `settings.section` / `sidebar.footer.action` /
`conversation.session.header.actions` 都是 `list` slot，插件既不占别人的格子也不会被别人
顶掉，同一份 bundle 在 `0.1.5-alpha.1` 与 `0.1.7-rc.2` 上都能挂载。

### `0.1.3-alpha.6` 变更

- 修复 `0.1.7-rc.2` 下设置里完全没有本插件入口：旧构建注册的是 `0.1.5` 的 keyed slot
  `settings.plugin.item`（`0.1.7` 已删除），现在改注册 list slot `settings.section`，
  在设置左栏拥有独立页「DSH 重启」。
- 一键重启改为两处可选 seat：`sidebar.footer.action`（左下角动作栏，Settings 上方，默认开）
  与 `conversation.session.header.actions`（对话标题右侧，默认关），两个开关都在设置页里；
  seat 关掉时组件渲染 `null`，注册保持静态，设置一翻转即时生效，不需要重新注册。
- 所有 Web UI 触发的重启都经过同一个二次确认对话框（`role="dialog"` / `aria-modal="true"`，
  焦点落在确认按钮，Escape 取消）。确认门是一张纯函数状态表 `reduceRestartPhase`：不在
  `confirming` 阶段的 `confirm` 是空操作，误触或迟到的回调都无法直接重启进程。
- 修复重启后自动继续在 `0.1.7` 上抛
  `SessionFormatError: format v4 message requires a producer-owned source kind`：会话日志
  v4 只接受生产者自有的 `source.kind`，插件现在像官方生产者一样用 declaration merging
  声明 `'dsh-restart'`，不再复用已废弃的共享 `plugin` kind。
- 重启路由的信任判定改为复用 Connection 的 `requestRejection`，与 `/api` 同一道
  Host/Origin + 浏览器认证栅栏（受信任的局域网 / 反向代理访问同样可用）；宿主没有
  Connection 服务时保留原环回同源规则，也不再需要额外的放行开关。
- 重启成功后不再强制刷新页面：确认后等待新进程恢复，由入口或设置页在原地提示「重启完成」
  并自动回到空闲态；手动刷新仍会显示同一条提示。自动继续也不再要求浏览器重新打开该会话。
- 新增测试：重启路由的信任栅栏（401 / 403 / 无 Connection 时的环回归退）、客户端 slot
  注册、两处 seat 的折叠/展开渲染、设置页与二次确认对话框。

### `0.1.3-alpha.4` 变更

- 禁用并移除内置 detached watchdog；旧配置保留为无操作兼容项。
- Windows 重启通过隐藏控制台拉起，保留完整 argv，避免后续 sandbox 命令闪窗。
- 新进程 PID 变化后继续等待带认证的前端首页返回成功，再刷新页面，避免源码部署
  重启期间因静态前端尚未挂载而停留在 HTTP 404。
- 防止并发请求重复安排 helper；helper 创建失败时保留旧进程，并记录失败日志。
- 自动继续投递失败时保留恢复标记；Web 路由随 Cordis 生命周期正确释放。

### 源码部署排错

- 本开发分支只对齐官方标签 `dsh-v0.1.5-alpha.1`。源码 checkout 先执行
  `corepack pnpm install --frozen-lockfile` 和 `corepack pnpm run build`，再把本地插件
  重新加入隔离 profile；只安装依赖但没有构建 workspace，会表现为缺少
  `@deepseek-ai/*/lib`，并不是 restart 拉起失败。
- DSH `0.1.7-rc.2` 删除了 keyed slot `settings.plugin.item`（旧版「插件」卡片列表），
  设置页改由 list slot 渲染：要独立页就注册 `settings.section`（`id` / `order` / `label`），
  要挂进「插件」分组就注册 `settings.plugins.tab`。本插件用前者，因此
  `dsh.client.inject` 不再声明 `dsh-client-ui-settings-plugins`。若页面报
  `list slot "settings.plugin.item" requires options.id`，说明 Harness 与插件客户端落在
  不同的 slot 契约；请对齐 DSH 标签与插件版本，不要再用 `options.key`。
- pnpm 首次安装 profile 依赖时可能把原生包写成待决的 `allowBuilds` 项。逐项确认
  `true` 或 `false` 后重跑 `dsh plugin --profile <name> add ...`，不要用全局放行绕过。
- 若旧版本重启后已经停在浏览器 HTTP 错误页，请手工打开新进程日志打印的当前
  `dsh web:` URL 完成一次恢复；升级到本版本后，重启会等待首页真正就绪，再在原地报成功。

## 安装

1. 把包加入 profile 依赖并挂进 bundle：

```jsonc
// profiles/<profile>/package.json
{
  "dependencies": { "dsh-restart": "..." },
  "dsh": { "profile": { "bundles": ["...", "dsh-restart"] } }
}
```

2. 重启 DSH（`/restart` 或 `restart_harness`），刷新页面后即可在 设置 → 左栏「DSH 重启」
   里配置重启行为与两处一键重启入口；主面板左下角动作栏（Settings 上方）默认出现 `↻`
   按钮。任何入口都会先弹二次确认，确认后等待新进程恢复，并在原地提示「重启完成」（不再强制刷新页面）。

## 构建

```bash
pnpm install
node scripts/link-dsh-workspace.mjs --source <path-to-deepseek-harness>
pnpm run build
```

host 半由 `tsc` 输出到 `lib/index.js`（`@deepseek-ai/*` 保持外部依赖）；client 半由 `tsdown` 打成单文件 `lib/client.js`。
