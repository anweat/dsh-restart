window.__ModuleLoader__.load({
	id: "dsh-restart",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/settings-source.ts
		function isFormsService(value) {
			return typeof value === "object" && value !== null && typeof value.get === "function";
		}
		function isLegacyScope(value) {
			return typeof value === "object" && value !== null && typeof value.bind === "function";
		}
		/**
		* Resolve the settings form for one profile entry, preferring the native
		* 0.1.7 service over the legacy scope.
		* @param ctx - the client cordis context.
		* @param entryId - the profile entry id whose configuration the page edits.
		* @returns a source the page can project, write through, and dispose.
		*/
		function createSettingsSource(ctx, entryId) {
			const listeners = /* @__PURE__ */ new Set();
			let form;
			let unsubscribeForm;
			const notify = () => {
				for (const listener of [...listeners]) listener();
			};
			const attach = (next) => {
				if (next === void 0 || next === form) return;
				unsubscribeForm?.();
				unsubscribeForm = void 0;
				form = next;
				try {
					unsubscribeForm = next.subscribe(notify);
				} catch {
					unsubscribeForm = void 0;
				}
				notify();
			};
			try {
				ctx.inject(["configForms"], (formsCtx) => {
					const service = formsCtx.configForms;
					if (!isFormsService(service)) return;
					try {
						attach(service.get(entryId));
					} catch {}
				});
			} catch {}
			try {
				ctx.inject(["settingsScope"], (scopeCtx) => {
					if (form !== void 0) return;
					const service = scopeCtx.settingsScope;
					if (!isLegacyScope(service)) return;
					try {
						attach(service.bind({ namespace: entryId }));
					} catch {}
				});
			} catch {}
			return {
				snapshot() {
					try {
						return form?.getSnapshot();
					} catch {
						return;
					}
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(field, value) {
					try {
						form?.set(field, value);
					} catch {}
				},
				unset(field) {
					try {
						form?.unset(field);
					} catch {}
				},
				dispose() {
					unsubscribeForm?.();
					unsubscribeForm = void 0;
					form = void 0;
					listeners.clear();
				}
			};
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* Stable local class names plus the single stylesheet the client half injects.
		*
		* Every colour/radius reads a DSH design token with a literal fallback, so the
		* plugin keeps rendering when a token is absent (it must work on the 0.1.5 line
		* it still declares as a peer, and on 0.1.7). Nothing here positions the plugin
		* against another plugin's DOM: only the confirmation dialog paints its own fixed
		* layer (in a portal, above the app).
		*/
		const styles = {
			page: "dsh-restart-page",
			pageTitle: "dsh-restart-page-title",
			pageDescription: "dsh-restart-page-description",
			readOnly: "dsh-restart-read-only",
			rows: "dsh-restart-rows",
			row: "dsh-restart-row",
			field: "dsh-restart-field",
			toggleField: "dsh-restart-toggle-field",
			toggleCopy: "dsh-restart-toggle-copy",
			groupTitle: "dsh-restart-group-title",
			label: "dsh-restart-label",
			hint: "dsh-restart-hint",
			checkbox: "dsh-restart-checkbox",
			input: "dsh-restart-input",
			footer: "dsh-restart-footer",
			actionHint: "dsh-restart-action-hint",
			failed: "dsh-restart-failed",
			restart: "dsh-restart-button",
			confirmOverlay: "dsh-restart-confirm-overlay",
			confirmPanel: "dsh-restart-confirm-panel",
			confirmTitle: "dsh-restart-confirm-title",
			confirmBody: "dsh-restart-confirm-body",
			confirmActions: "dsh-restart-confirm-actions",
			confirmCancel: "dsh-restart-confirm-cancel",
			confirmRestart: "dsh-restart-confirm-restart"
		};
		const STYLE_ID = "dsh-restart-client-styles";
		const SHEET = `
.dsh-restart-page{display:flex;flex-direction:column;width:100%}
.dsh-restart-page-title{margin:4px 0 0;font-size:16px;font-weight:500;line-height:24px;color:var(--dsw-alias-label-primary)}
.dsh-restart-page-description{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-read-only{margin:8px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-rows{display:flex;flex-direction:column;margin-top:12px}
.dsh-restart-rows>.dsh-restart-row+.dsh-restart-row{border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-group-title{margin:0;padding:16px 0 0;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsh-restart-field,.dsh-restart-toggle-field{display:flex;gap:6px;padding:14px 0}
.dsh-restart-field{flex-direction:column}
.dsh-restart-toggle-field{align-items:flex-start;cursor:pointer}
.dsh-restart-toggle-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-label{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-restart-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-checkbox{width:16px;height:16px;margin:2px 2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsh-restart-checkbox:disabled{cursor:default;opacity:.5}
.dsh-restart-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-restart-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.dsh-restart-footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-action-hint,.dsh-restart-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:18px}
.dsh-restart-action-hint{color:var(--dsw-alias-label-tertiary)}.dsh-restart-failed{color:var(--dsw-alias-label-error)}
.dsh-restart-button{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-button:disabled{opacity:.4;cursor:default}
.dsh-restart-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@media(max-width:480px){.dsh-restart-footer{align-items:stretch;flex-direction:column}.dsh-restart-button{width:100%}}
.dsh-restart-confirm-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45))}
.dsh-restart-confirm-panel{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:min(400px,calc(100vw - 48px));padding:20px;border-radius:var(--dsw-radius-panel,16px);background:var(--dsw-alias-bg-layer-2,#1f2023);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.4))}
.dsh-restart-confirm-title{margin:0;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-restart-confirm-body{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.dsh-restart-confirm-cancel{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:none;color:var(--dsw-alias-label-primary)}
.dsh-restart-confirm-cancel:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-4))}
.dsh-restart-confirm-cancel:focus-visible,.dsh-restart-confirm-restart:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-confirm-restart{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-confirm-cancel:disabled,.dsh-restart-confirm-restart:disabled{opacity:.4;cursor:default}
`;
		/** Install the stylesheet once, under one id, without a second network asset. */
		function ensureStyles() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = SHEET;
			document.head.append(style);
		}
		//#endregion
		//#region src/client/RestartConfirmDialog.tsx
		/**
		* The secondary confirmation every restart trigger goes through.
		*
		* The surface is rendered into `document.body` through a portal rather than
		* inline: the seats this plugin occupies (the 56px sidebar rail, the
		* conversation header) clip or transform their children, so an inline dialog
		* would be cut off or trapped under another plugin's overlay. The portal's
		* first child is a plain function component so the markup stays
		* server-renderable and testable.
		*/
		const TITLE_ID = "dsh-restart-confirm-title";
		const BODY_ID = "dsh-restart-confirm-body";
		/**
		* The confirmation markup on its own: no portal, no effects, no DOM access.
		* @param props - copy, busy state, and the two decisions.
		* @returns the dialog element tree.
		*/
		function ConfirmDialogSurface({ t, busy, onConfirm, onCancel }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: styles.confirmOverlay,
				role: "presentation",
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: styles.confirmPanel,
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": TITLE_ID,
					"aria-describedby": BODY_ID,
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: styles.confirmTitle,
							id: TITLE_ID,
							children: t("confirmTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: styles.confirmBody,
							id: BODY_ID,
							children: t("confirmBody")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: styles.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: styles.confirmCancel,
								disabled: busy,
								onClick: onCancel,
								children: t("confirmCancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: styles.confirmRestart,
								disabled: busy,
								autoFocus: true,
								onClick: onConfirm,
								children: t("confirmRestart")
							})]
						})
					]
				})
			});
		}
		/** The mounted dialog: the surface, portalled to the document body, Escape-aware. */
		function RestartConfirmDialog(props) {
			const { onCancel } = props;
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") onCancel();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [onCancel]);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmDialogSurface, { ...props }), document.body);
		}
		//#endregion
		//#region src/client/restart-marker.ts
		/**
		* Restart-completion marker.
		*
		* A restart no longer reloads the page: the run that arranged it reports success
		* from its own React state. The marker covers the one case React state cannot —
		* a manual refresh right after a restart, whose fresh run would otherwise have
		* nothing to report. It is written on success and consumed once.
		*/
		const RESTART_COMPLETED_KEY = "dsh-restart:completed";
		/** Record a successful restart so a later page load can still report it. */
		function rememberRestartCompleted() {
			try {
				sessionStorage.setItem(RESTART_COMPLETED_KEY, "1");
			} catch {}
		}
		/** Read and clear the marker; true on the first load after a successful restart. */
		function consumeRestartCompleted() {
			try {
				const completed = sessionStorage.getItem(RESTART_COMPLETED_KEY) === "1";
				if (completed) sessionStorage.removeItem(RESTART_COMPLETED_KEY);
				return completed;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/restart-monitor.ts
		const RESTART_URL = "/plugins/dsh-restart/restart";
		var RestartProbeUnavailableError = class extends Error {
			constructor(message, options) {
				super(message, options);
				this.name = "RestartProbeUnavailableError";
			}
		};
		function abortError(signal) {
			return signal?.reason ?? new DOMException("The operation was aborted.", "AbortError");
		}
		function defaultSleep(delayMs, signal) {
			if (signal?.aborted) return Promise.reject(abortError(signal));
			return new Promise((resolve, reject) => {
				const onAbort = () => {
					window.clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					reject(abortError(signal));
				};
				const timer = window.setTimeout(() => {
					signal?.removeEventListener("abort", onAbort);
					resolve();
				}, delayMs);
				signal?.addEventListener("abort", onAbort, { once: true });
			});
		}
		function parseRestartIdentity(value) {
			const candidate = value;
			if (candidate === null || !Number.isInteger(candidate.pid) || Number(candidate.pid) <= 0 || typeof candidate.startedAt !== "string" || candidate.startedAt === "") throw new Error("invalid restart identity");
			return {
				pid: Number(candidate.pid),
				startedAt: candidate.startedAt
			};
		}
		async function fetchRestartIdentity(fetchImpl, signal) {
			let response;
			try {
				response = await fetchImpl(RESTART_URL, {
					method: "GET",
					cache: "no-store",
					signal
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				throw new RestartProbeUnavailableError("identity probe unavailable", { cause: error });
			}
			if (!response.ok) throw new RestartProbeUnavailableError(`identity probe failed: HTTP ${response.status}`);
			return parseRestartIdentity(await response.json());
		}
		async function frontendReady(fetchImpl, signal) {
			let response;
			try {
				response = await fetchImpl("/", {
					method: "GET",
					cache: "no-store",
					signal
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				throw new RestartProbeUnavailableError("frontend probe unavailable", { cause: error });
			}
			if (response.status === 401 || response.status === 403) throw new Error(`restart recovery unauthorized: HTTP ${response.status}`);
			return response.ok;
		}
		function identityChanged(before, after) {
			return before.pid !== after.pid || before.startedAt !== after.startedAt;
		}
		/** Restart DSH and wait until the process identity changes. */
		async function restartAndWait(options = {}) {
			const fetchImpl = options.fetchImpl ?? fetch;
			const isVisible = options.isVisible ?? (() => document.visibilityState === "visible");
			const maxRecoveryProbes = options.maxRecoveryProbes ?? 120;
			const maxVisibleStableProbes = options.maxVisibleStableProbes ?? 90;
			const pollIntervalMs = options.pollIntervalMs ?? 1e3;
			const sleep = options.sleep ?? defaultSleep;
			const { signal } = options;
			const baseline = await fetchRestartIdentity(fetchImpl, signal);
			const response = await fetchImpl(RESTART_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
				signal
			});
			if (!response.ok) throw new Error(`restart request failed: HTTP ${response.status}`);
			let visibleStableProbes = 0;
			let recoveryProbes = 0;
			while (visibleStableProbes < maxVisibleStableProbes) {
				await sleep(pollIntervalMs, signal);
				let current;
				try {
					current = await fetchRestartIdentity(fetchImpl, signal);
				} catch (error) {
					if (!(error instanceof RestartProbeUnavailableError)) throw error;
					continue;
				}
				if (identityChanged(baseline, current)) {
					recoveryProbes += 1;
					try {
						if (await frontendReady(fetchImpl, signal)) return "restarted";
					} catch (error) {
						if (!(error instanceof RestartProbeUnavailableError)) throw error;
					}
					if (recoveryProbes >= maxRecoveryProbes) throw new Error("restarted process did not serve the authenticated frontend");
					continue;
				}
				if (isVisible()) visibleStableProbes += 1;
			}
			return "stale";
		}
		//#endregion
		//#region src/client/restart-action.ts
		/**
		* The restart confirmation gate: a pure transition table plus the React hook
		* that drives it.
		*
		* Every restart this plugin triggers from the Web UI takes the same path —
		* `request` only arms the confirmation, `confirm` is the one transition that
		* talks to the Host. Keeping the table pure (and out of the components) is what
		* makes "a stray confirm can never restart DSH" checkable without a DOM, and it
		* is the single place where the secondary-confirmation requirement lives.
		*/
		/**
		* Advance the confirmation gate.
		*
		* `confirm` is deliberately inert outside `confirming`: the restart request can
		* only follow a `request` the user has already answered in the dialog. `fail`
		* is inert outside `busy` for the same reason — a late rejection from an
		* aborted attempt cannot paint an error on an idle button.
		*
		* @param phase - current phase.
		* @param event - the transition to apply.
		* @returns the next phase.
		*/
		function reduceRestartPhase(phase, event) {
			switch (event) {
				case "request": return phase === "busy" ? phase : "confirming";
				case "cancel": return phase === "confirming" ? "idle" : phase;
				case "confirm": return phase === "confirming" ? "busy" : phase;
				case "fail": return phase === "busy" ? "failed" : phase;
				case "settle": return phase === "failed" ? "idle" : phase;
			}
		}
		const IDLE = {
			phase: "idle",
			stale: false,
			detail: "",
			succeeded: false
		};
		/**
		* Drive the gate from one component.
		*
		* The returned handlers keep their identity per render but are all safe to call
		* from a stale closure: every update goes through the functional setState form,
		* and the only value read from the render scope is the phase `confirm` guards
		* on.
		*
		* @returns the gate state and its handlers.
		*/
		function useRestartAction() {
			const [state, setState] = (0, react.useState)(IDLE);
			const controller = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => {
				controller.current?.abort();
			}, []);
			const transition = (event) => {
				setState((current) => {
					const next = reduceRestartPhase(current.phase, event);
					if (next === current.phase) return current.succeeded ? {
						...current,
						succeeded: false
					} : current;
					return {
						phase: next,
						stale: false,
						detail: "",
						succeeded: false
					};
				});
			};
			const confirm = () => {
				if (state.phase !== "confirming") return;
				const aborter = new AbortController();
				controller.current = aborter;
				setState({
					phase: "busy",
					stale: false,
					detail: "",
					succeeded: false
				});
				restartAndWait({
					signal: aborter.signal,
					isVisible: () => document.visibilityState === "visible"
				}).then((outcome) => {
					if (aborter.signal.aborted) return;
					if (outcome === "restarted") {
						rememberRestartCompleted();
						setState({
							phase: "idle",
							stale: false,
							detail: "",
							succeeded: true
						});
						return;
					}
					setState({
						phase: reduceRestartPhase("busy", "fail"),
						stale: true,
						detail: "",
						succeeded: false
					});
				}).catch((error) => {
					if (aborter.signal.aborted) return;
					setState({
						phase: reduceRestartPhase("busy", "fail"),
						stale: false,
						detail: error instanceof Error ? error.message : String(error),
						succeeded: false
					});
				}).finally(() => {
					if (controller.current === aborter) controller.current = null;
				});
			};
			return {
				...state,
				request: () => {
					transition("request");
				},
				cancel: () => {
					transition("cancel");
				},
				confirm,
				settle: () => {
					transition("settle");
				}
			};
		}
		//#endregion
		//#region src/client/RestartSection.tsx
		/**
		* The dsh-restart settings page: 设置 → DSH 重启.
		*
		* Registered into `settings.section`, which gives this plugin its own row in
		* the settings navigation (the 0.1.7 replacement for the per-plugin card list
		* that 0.1.5 rendered from `settings.plugin.item`) and a full page to lay out
		* its restart behaviour. Everything it edits is the host's own settings
		* namespace, so the values round-trip through settings.yaml.
		*
		* The restart button goes through a confirmation gate: this page can restart the
		* process the page itself is running in.
		*/
		/** How long the success note stays on the page after a restart. */
		const SUCCESS_MS = 5e3;
		/** The dsh-restart settings page. */
		function RestartSection(props) {
			ensureStyles();
			const { t, set, clear, useDshRestart } = props;
			const state = useDshRestart((snapshot) => snapshot);
			const restart = useRestartAction();
			const [completed, setCompleted] = (0, react.useState)(consumeRestartCompleted);
			const [draft, setDraft] = (0, react.useState)(null);
			const lastSent = (0, react.useRef)(null);
			const succeeded = completed || restart.succeeded;
			(0, react.useEffect)(() => {
				if (!succeeded) return;
				const timer = window.setTimeout(() => {
					setCompleted(false);
					restart.settle();
				}, SUCCESS_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [succeeded]);
			const editable = state.available;
			const disabled = !editable || !state.writable;
			const busy = restart.phase === "busy";
			const writeText = (field, value) => {
				if (value.trim() === "") clear(field);
				else set(field, value.trim());
			};
			const promptValue = draft ?? state.continuePrompt;
			const commitPrompt = () => {
				if (draft === null) return;
				const next = draft.trim();
				if (next === state.continuePrompt) {
					setDraft(null);
					return;
				}
				lastSent.current = next;
				writeText("continuePrompt", next);
			};
			(0, react.useEffect)(() => {
				if (draft === null) return;
				const next = draft.trim();
				if (next === state.continuePrompt) {
					lastSent.current = null;
					setDraft(null);
					return;
				}
				if (lastSent.current === next) return;
				const timer = window.setTimeout(() => {
					lastSent.current = next;
					writeText("continuePrompt", next);
				}, 500);
				return () => {
					window.clearTimeout(timer);
				};
			}, [draft, state.continuePrompt]);
			const status = restart.phase === "failed" ? restart.stale ? t("restartStale") : t("restartFailed") : succeeded ? t("restartSucceeded") : t("restartHint");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: styles.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: styles.pageTitle,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: styles.pageDescription,
						children: t("description")
					}),
					editable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: styles.readOnly,
						role: "status",
						children: t("settingsUnavailable")
					}),
					!editable || state.writable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: styles.readOnly,
						role: "status",
						children: t("readOnly")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: styles.rows,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.row + " " + styles.toggleField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: styles.checkbox,
								type: "checkbox",
								checked: state.legacyRestart,
								disabled,
								onChange: (event) => {
									set("legacyRestart", event.currentTarget.checked);
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
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.row + " " + styles.field,
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
									value: promptValue,
									disabled,
									onChange: (event) => {
										setDraft(event.currentTarget.value);
									},
									onBlur: commitPrompt,
									onKeyDown: (event) => {
										if (event.key === "Enter") commitPrompt();
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("continuePromptHint")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: styles.footer,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: restart.phase === "failed" ? styles.failed : styles.actionHint,
							role: "status",
							"aria-live": "polite",
							children: busy ? t("restarting") : status
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: styles.restart,
							disabled: busy,
							"aria-haspopup": "dialog",
							onClick: restart.request,
							children: t(busy ? "restarting" : "restartNow")
						})]
					}),
					restart.phase === "confirming" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RestartConfirmDialog, {
						t,
						busy,
						onConfirm: restart.confirm,
						onCancel: restart.cancel
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			title: "DSH 重启",
			description: "重启方式、自动继续提示词，以及主面板上的快捷重启入口。",
			legacyRestart: "旧重启方式",
			legacyRestartHint: "true = 用 PowerShell/WMI/taskkill 旧方式重启（适配）；false = Node 原生重启",
			continuePrompt: "重启后注入的提示词",
			continuePromptHint: "重启后自动继续时注入给 agent 的文本（空则用默认）",
			readOnly: "当前配置为只读",
			settingsUnavailable: "设置服务暂不可用：下方开关需要 DSH 为本插件提供设置命名空间，重启按钮不受影响。",
			restartNow: "立即重启",
			restarting: "正在重启…",
			restartHint: "配置修改会自动保存；立即重启会短暂断开当前页面。",
			restartFailed: "未能安排重启，请检查服务日志后重试。",
			restartStale: "已发送重启请求，但进程身份始终未变化。请检查服务日志。",
			restartSucceeded: "DSH 已重启并恢复连接。",
			confirmTitle: "确认重启 DSH？",
			confirmBody: "将重启整个 DSH 进程：当前页面会短暂断开，正在运行的任务会被中断。",
			confirmCancel: "取消",
			confirmRestart: "确认重启"
		};
		const en = {
			title: "DSH Restart",
			description: "Restart method, auto-continue prompt, and the quick restart entry on the main panel.",
			legacyRestart: "Legacy restart",
			legacyRestartHint: "true = old PowerShell/WMI/taskkill restart; false = Node-native restart",
			continuePrompt: "Continue prompt",
			continuePromptHint: "Text injected to the agent after restart (empty = default)",
			readOnly: "This configuration is read-only",
			settingsUnavailable: "The settings service is unavailable: the switches below need DSH to serve this plugin a settings namespace. The restart button still works.",
			restartNow: "Restart now",
			restarting: "Restarting…",
			restartHint: "Configuration changes save automatically; restarting briefly disconnects this page.",
			restartFailed: "Could not schedule the restart. Check the service logs and try again.",
			restartStale: "The restart was requested, but the process identity never changed. Check the service logs.",
			restartSucceeded: "DSH restarted and reconnected.",
			confirmTitle: "Restart DSH?",
			confirmBody: "This restarts the whole DSH process: this page disconnects briefly and any running task is interrupted.",
			confirmCancel: "Cancel",
			confirmRestart: "Restart"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-restart-client";
		const inject = ["slots", "locale"];
		const NS = "restart.card";
		/** Seams the test suite exercises directly (the bundle exposes no other one). */
		const internals = {
			ConfirmDialogSurface,
			reduceRestartPhase
		};
		/**
		* Wire the three surfaces up to the host settings namespace.
		* @param ctx - the client cordis context.
		*/
		function apply(ctx) {
			ensureStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-restart: dictionaries");
			const source = createSettingsSource(ctx, "dsh-restart");
			const t = ctx.locale.bind(NS);
			const project = () => {
				const snap = source.snapshot();
				const value = snap?.value ?? {};
				return {
					available: snap?.status === "ready",
					writable: snap?.writable === true,
					legacyRestart: value.legacyRestart === true,
					continuePrompt: typeof value.continuePrompt === "string" ? value.continuePrompt : ""
				};
			};
			const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(project());
			const unsubscribeSettings = source.subscribe(() => {
				store.set(project());
			});
			ctx.effect(() => () => {
				unsubscribeSettings();
				source.dispose();
			}, "dsh-restart: settings source");
			const hooksOnly = () => ({ hooks: { dshRestart: store } });
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-restart",
				order: 50,
				label: () => t("title"),
				locale: NS,
				inject: () => ({
					...hooksOnly(),
					set: (field, value) => {
						source.set(field, value);
					},
					clear: (field) => {
						source.unset(field);
					}
				})
			}, RestartSection));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.internals = internals;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map