# dsh-restart

重启整个 DeepSeek Harness 进程的插件，用于重新加载插件与配置（profile 的 cordis 组合、settings 等）。host + client 双半，装进 profile 的 bundle 后即可用。

![DSH 重启插件设置](./docs/images/dsh-restart-settings.png)

> 截图来自真实 `web` profile 部署，展示当前 DSH 设置页中的重启配置卡片。

## 功能

- **模型工具 `restart_harness`**：让 agent 直接安排一次进程重启（可选 `delayMs`）。
- **`/restart` 斜杠命令**：在 UI 里手动触发重启。
- **配置卡片**（设置 → 插件 → 插件配置 → 「DSH 重启」）：可视化编辑以下设置，改动即时写入 `settings.yaml`：
  - `legacyRestart` — 旧 PowerShell/WMI/taskkill 重启方式（默认关闭，用 Node 原生方式）。
  - `continuePrompt` — 重启后自动继续时注入给 agent 的提示词。
  - `watchdogEnabled` — 崩溃/关闭时自动拉起 DSH（默认关闭，需谨慎）。
  - `watchdogCooldownMs` / `watchdogPollMs` — 看门狗冷却与轮询间隔。
- **「立即重启」按钮**：先读取当前进程身份，安排重启后等待新进程恢复并自动刷新页面。只读 GET 返回 `{ pid, startedAt }`；出于安全考虑，重启 POST 仍仅接受来自环回地址（127.0.0.1 / localhost）的同源请求，经反向代理/远程访问时会被拒绝（403）。

## 兼容与发布通道

| 插件发布通道 | DSH 基线 | 兼容承诺 |
|---|---|---|
| npm `latest`（当前正式发布插件） | `dsh-v0.1.1-rc.2` | 已验证维护基线 |
| npm `next` 候选（`0.1.3-alpha.3`） | `dsh-v0.1.2-alpha.3` | 已通过隔离真实 profile 门禁，仅用于开发预览 |
| 后续 DSH 正式版 `0.1.2` | 尚未发布 | 发布并完成真实 profile 门禁后再声明兼容 |

开发版不会覆盖 npm `latest`。alpha.3 依赖按精确版本锁定；该版本已移除
`@deepseek-ai/dsh-client-runtime`，客户端契约分别迁移到 Cordis、
`dsh-client-store` 与 `dsh-client-ui-settings`，不会混装 rc.2 运行时。

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
