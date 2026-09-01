import { mkdir, readFile, realpath, rm, symlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// dsh-restart 消费这些 @deepseek-ai 包（类型解析 + 运行时契约；构建时外部化）。
const PACKAGE_PATHS = new Map([
  ['@deepseek-ai/cordis', 'vendor/cordis'],
  ['@deepseek-ai/schemastery', 'vendor/schemastery'],
  ['@deepseek-ai/dsh-tools', 'packages/core/tools'],
  ['@deepseek-ai/dsh-llm', 'packages/llm/llm'],
  ['@deepseek-ai/dsh-settings', 'packages/settings/settings'],
  ['@deepseek-ai/dsh-shell', 'packages/shell/shell'],
  ['@deepseek-ai/dsh-sandbox-policy', 'packages/sandbox/sandbox-policy'],
  ['@deepseek-ai/dsh-commands', 'packages/interaction/commands'],
  ['@deepseek-ai/dsh-agent', 'packages/core/agent'],
  ['@deepseek-ai/dsh-host-webserver', 'packages/host/webserver'],
  ['@deepseek-ai/dsh-client-locale', 'packages/client/locale'],
  ['@deepseek-ai/dsh-client-store', 'packages/client/store'],
  ['@deepseek-ai/dsh-client-ui-settings', 'packages/client/ui-settings'],
  ['@deepseek-ai/dsh-client-ui-settings-plugins', 'packages/client/ui-settings-plugins'],
  ['@deepseek-ai/dsh-client-ui-slots', 'packages/client/ui-slots'],
])

const rawArgv = process.argv.slice(2)
const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv
const sourceIndex = argv.indexOf('--source')
if (sourceIndex === -1 || argv.length !== 2) {
  throw new Error('usage: node scripts/link-dsh-workspace.mjs --source /abs/path/to/deepseek-harness')
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = await realpath(resolve(argv[sourceIndex + 1]))

for (const [expectedName, packagePath] of PACKAGE_PATHS) {
  const packageRoot = await realpath(join(sourceRoot, packagePath))
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (manifest.name !== expectedName) {
    throw new Error(`${packagePath}/package.json names ${String(manifest.name)}; expected ${expectedName}`)
  }
  const target = join(repositoryRoot, 'node_modules', ...expectedName.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await rm(target, { recursive: true, force: true })
  await symlink(packageRoot, target, 'dir')
  process.stdout.write(`linked ${expectedName}\n`)
}
