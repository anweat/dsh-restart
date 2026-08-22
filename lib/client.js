window.__ModuleLoader__.load({
	id: "dsh-restart",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/styles.ts
		/** Stable local class names; the plugin ships as one self-contained client.js. */
		const styles = {
			card: "dsh-restart-card",
			cardOpen: "dsh-restart-card-open",
			header: "dsh-restart-header",
			headText: "dsh-restart-head-text",
			name: "dsh-restart-name",
			description: "dsh-restart-description",
			chevron: "dsh-restart-chevron",
			chevronOpen: "dsh-restart-chevron-open",
			body: "dsh-restart-body",
			readOnly: "dsh-restart-read-only",
			field: "dsh-restart-field",
			toggleField: "dsh-restart-toggle-field",
			toggleCopy: "dsh-restart-toggle-copy",
			label: "dsh-restart-label",
			hint: "dsh-restart-hint",
			checkbox: "dsh-restart-checkbox",
			input: "dsh-restart-input",
			footer: "dsh-restart-footer",
			actionHint: "dsh-restart-action-hint",
			failed: "dsh-restart-failed",
			restart: "dsh-restart-button"
		};
		const STYLE_ID = "dsh-restart-settings-card-styles";
		/** Install card styles once without creating a second dynamically loaded asset. */
		function ensureStyles() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = `
.dsh-restart-card{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
.dsh-restart-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dsh-restart-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dsh-restart-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}
.dsh-restart-header:focus-visible,.dsh-restart-button:focus-visible,.dsh-restart-checkbox:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-head-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dsh-restart-description{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}
.dsh-restart-chevron-open{transform:rotate(180deg)}
.dsh-restart-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dsh-restart-read-only{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-field,.dsh-restart-toggle-field{display:flex;gap:6px;padding:12px 0}
.dsh-restart-field{flex-direction:column}.dsh-restart-toggle-field{align-items:flex-start;cursor:pointer}
.dsh-restart-field+.dsh-restart-field,.dsh-restart-field+.dsh-restart-toggle-field,.dsh-restart-toggle-field+.dsh-restart-field,.dsh-restart-toggle-field+.dsh-restart-toggle-field{border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-toggle-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-checkbox{width:16px;height:16px;margin:2px 2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsh-restart-checkbox:disabled{cursor:default;opacity:.5}
.dsh-restart-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-restart-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.dsh-restart-footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-action-hint,.dsh-restart-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5}
.dsh-restart-action-hint{color:var(--dsw-alias-label-tertiary)}.dsh-restart-failed{color:var(--dsw-alias-label-error)}
.dsh-restart-button{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-button:disabled{opacity:.4;cursor:default}
@media(max-width:480px){.dsh-restart-footer{align-items:stretch;flex-direction:column}.dsh-restart-button{width:100%}}
`;
			document.head.append(style);
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		/** The dsh-restart configuration card, styled with the host plugin-card tokens. */
		function SettingsCard(props) {
			const { t, set, clear } = props;
			const state = props.useDshRestart((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [restartFailed, setRestartFailed] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable;
			const toggle = (field, value) => {
				set(field, value);
			};
			const text = (field, value) => {
				if (value.trim() === "") clear(field);
				else set(field, value.trim());
			};
			const number = (field, value) => {
				if (value.trim() === "") {
					clear(field);
					return;
				}
				const parsed = Number(value);
				if (Number.isFinite(parsed)) set(field, parsed);
			};
			const restartNow = async () => {
				if (restarting) return;
				setRestarting(true);
				setRestartFailed(false);
				try {
					const response = await fetch("/plugins/dsh-restart/restart", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: "{}"
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
				} catch {
					setRestartFailed(true);
					setRestarting(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `${styles.card} ${open ? styles.cardOpen : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: styles.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: styles.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: styles.name,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: styles.description,
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: `${styles.chevron} ${open ? styles.chevronOpen : ""}`,
						viewBox: "0 0 14 14",
						width: "14",
						height: "14",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M3.5 5.5 7 9l3.5-3.5",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: styles.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: styles.readOnly,
							role: "status",
							children: t("readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.toggleField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: styles.checkbox,
								type: "checkbox",
								checked: state.legacyRestart,
								disabled,
								onChange: (event) => {
									toggle("legacyRestart", event.currentTarget.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: styles.toggleCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("legacyRestart")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("legacyRestartHint")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.field,
							htmlFor: "dsh-restart-continue-prompt",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("continuePrompt")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "dsh-restart-continue-prompt",
									className: styles.input,
									type: "text",
									value: state.continuePrompt,
									disabled,
									onChange: (event) => {
										text("continuePrompt", event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("continuePromptHint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.toggleField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: styles.checkbox,
								type: "checkbox",
								checked: state.watchdogEnabled,
								disabled,
								onChange: (event) => {
									toggle("watchdogEnabled", event.currentTarget.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: styles.toggleCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("watchdogEnabled")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("watchdogEnabledHint")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.field,
							htmlFor: "dsh-restart-watchdog-cooldown",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("watchdogCooldownMs")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "dsh-restart-watchdog-cooldown",
									className: styles.input,
									type: "number",
									inputMode: "numeric",
									value: state.watchdogCooldownMs || "",
									disabled,
									onChange: (event) => {
										number("watchdogCooldownMs", event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("watchdogCooldownMsHint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.field,
							htmlFor: "dsh-restart-watchdog-poll",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("watchdogPollMs")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "dsh-restart-watchdog-poll",
									className: styles.input,
									type: "number",
									inputMode: "numeric",
									value: state.watchdogPollMs || "",
									disabled,
									onChange: (event) => {
										number("watchdogPollMs", event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("watchdogPollMsHint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: styles.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: restartFailed ? styles.failed : styles.actionHint,
								role: "status",
								"aria-live": "polite",
								children: restartFailed ? t("restartFailed") : t("restartHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: styles.restart,
								disabled: restarting,
								onClick: () => {
									restartNow();
								},
								children: t(restarting ? "restarting" : "restartNow")
							})]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			title: "DSH 重启",
			description: "重启方式、自动继续提示词与看门狗设置（写入 settings.yaml，host 读取）",
			legacyRestart: "旧重启方式",
			legacyRestartHint: "true = 用 PowerShell/WMI/taskkill 旧方式重启（适配）；false = Node 原生重启",
			continuePrompt: "重启后注入的提示词",
			continuePromptHint: "重启后自动继续时注入给 agent 的文本（空则用默认）",
			watchdogEnabled: "看门狗",
			watchdogEnabledHint: "true = 崩溃/关闭时自动拉起 DSH（默认关闭，需谨慎）",
			watchdogCooldownMs: "看门狗冷却（毫秒）",
			watchdogCooldownMsHint: "两次拉起之间的最小间隔",
			watchdogPollMs: "看门狗轮询（毫秒）",
			watchdogPollMsHint: "探测端口存活的间隔",
			expand: "展开",
			collapse: "收起",
			readOnly: "当前配置为只读",
			restartNow: "立即重启",
			restarting: "正在重启…",
			restartHint: "配置修改会自动保存；立即重启会短暂断开当前页面。",
			restartFailed: "未能安排重启，请检查服务日志后重试。"
		};
		const en = {
			title: "DSH Restart",
			description: "Restart method, auto-continue prompt, and watchdog settings (stored in settings.yaml)",
			legacyRestart: "Legacy restart",
			legacyRestartHint: "true = old PowerShell/WMI/taskkill restart; false = Node-native restart",
			continuePrompt: "Continue prompt",
			continuePromptHint: "Text injected to the agent after restart (empty = default)",
			watchdogEnabled: "Watchdog",
			watchdogEnabledHint: "true = auto-relaunch DSH on crash/close (off by default)",
			watchdogCooldownMs: "Watchdog cooldown (ms)",
			watchdogCooldownMsHint: "Minimum interval between relaunches",
			watchdogPollMs: "Watchdog poll (ms)",
			watchdogPollMsHint: "Interval for probing port liveness",
			expand: "Expand",
			collapse: "Collapse",
			readOnly: "This configuration is read-only",
			restartNow: "Restart now",
			restarting: "Restarting…",
			restartHint: "Configuration changes save automatically; restarting briefly disconnects this page.",
			restartFailed: "Could not schedule the restart. Check the service logs and try again."
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-restart-client";
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		const NS = "restart.card";
		function apply(ctx) {
			ensureStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-restart: dictionaries");
			const scope = ctx.settingsScope.bind({ namespace: "dsh-restart" });
			const project = () => {
				const snap = scope.getSnapshot();
				const value = snap.value ?? {};
				return {
					available: snap.status === "ready",
					writable: snap.writable,
					legacyRestart: value.legacyRestart === true,
					continuePrompt: typeof value.continuePrompt === "string" ? value.continuePrompt : "",
					watchdogEnabled: value.watchdogEnabled === true,
					watchdogCooldownMs: typeof value.watchdogCooldownMs === "number" ? value.watchdogCooldownMs : 0,
					watchdogPollMs: typeof value.watchdogPollMs === "number" ? value.watchdogPollMs : 0
				};
			};
			const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
			scope.subscribe(() => {
				store.set(project());
			});
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: "dsh-restart",
				locale: NS,
				inject: () => ({
					hooks: { dshRestart: store },
					set: (field, value) => {
						scope.set(field, value);
					},
					clear: (field) => {
						scope.unset(field);
					}
				})
			}, SettingsCard));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map