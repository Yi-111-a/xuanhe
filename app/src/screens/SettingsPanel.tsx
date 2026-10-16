import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, IS_MOCK } from '../api/client';
import type { Settings, UsageResponse } from '../api/types';
import { Baoxiang } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { useToast } from '../components/Toast';
import { useGame } from '../store/game';
import { cls } from '../lib/util';

const ROLES: { id: string; name: string; note: string }[] = [
  { id: 'edict_interpreter', name: '诏令解析', note: '把诏文拆为可执行条款' },
  { id: 'character_chat', name: '群臣召对', note: '扮演召见之臣' },
  { id: 'court_debate', name: '廷议', note: '撰写廷臣发言' },
  { id: 'narrator', name: '史官纪事', note: '每季纪事' },
  { id: 'edict_polish', name: '润色', note: '润色诏书文辞' },
  { id: 'chronicler', name: '修史', note: '终局本纪' },
];

const PROVIDER_NAMES: Record<string, string> = {
  mock: '演示（不联网）',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  glm: '智谱 GLM',
  ollama: 'Ollama 本地',
  claude_cli: 'Claude（本机 Claude Code，免 API key）',
  codex_cli: 'Codex（本机 Codex CLI，免 API key）',
};

/** 本机 CLI 服务的说明：用的是本机已登录的账号，不填地址和密钥。 */
const LOCAL_CLI_NOTES: Record<string, { login: string; who: string }> = {
  claude_cli: { who: 'Claude', login: 'claude auth login（Claude 桌面版用户：%APPDATA%\Claude\claude-code\<版本>\claude.exe auth login）' },
  codex_cli: { who: 'Codex', login: 'codex login' },
};

const CLAUDE_CMD = `claude mcp add tianbao --env SIM_MCP_MODE=client --env LLM_SIM_HOME="%APPDATA%\\tianbao" -- sim mcp`;
const CODEX_TOML = `[mcp_servers.tianbao]
command = "sim"
args = ["mcp"]
env = { SIM_MCP_MODE = "client", LLM_SIM_HOME = "C:\\\\Users\\\\<用户名>\\\\AppData\\\\Roaming\\\\tianbao" }`;

type Tab = 'models' | 'mcp' | 'usage' | 'game';

interface IntegrationBlock {
  id: string;
  title: string;
  text: string;
  note?: string;
}

const CLIENT_NAMES: Record<string, string> = { claude: 'Claude Code', claude_code: 'Claude Code', codex: 'Codex' };

/** Tolerant reader for GET /api/integration: a list or a map of clients, each a string or an object with command/config text. */
export function parseIntegration(raw: unknown): IntegrationBlock[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  // the engine's documented shape (CONTRACT §2 GET /api/integration)
  if ((obj.claude && typeof obj.claude === 'object') || (obj.codex && typeof obj.codex === 'object')) {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
    const claude = (obj.claude ?? {}) as Record<string, unknown>;
    const codex = (obj.codex ?? {}) as Record<string, unknown>;
    const setup = (obj.setup ?? {}) as Record<string, unknown>;
    const flags = Array.isArray(codex.exec_flags) ? (codex.exec_flags as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const blocks: (IntegrationBlock | null)[] = [
      str(setup.claude) ? { id: 'setup_claude', title: 'Claude Code · 一键配置（PowerShell）', text: str(setup.claude)! } : null,
      str(claude.add) ? { id: 'claude', title: 'Claude Code · 本项目', text: str(claude.add)! } : null,
      str(claude.add_user) ? { id: 'claude_user', title: 'Claude Code · 全局（--scope user）', text: str(claude.add_user)! } : null,
      str(claude.mcp_json) ? { id: 'claude_json', title: 'Claude Code · .mcp.json', text: str(claude.mcp_json)!.trimEnd() } : null,
      str(setup.codex) ? { id: 'setup_codex', title: 'Codex · 一键配置（PowerShell）', text: str(setup.codex)! } : null,
      str(codex.add) ? { id: 'codex', title: 'Codex', text: str(codex.add)! } : null,
      str(codex.toml) ? { id: 'codex_toml', title: 'Codex · ~/.codex/config.toml', text: str(codex.toml)!.trimEnd(), note: str(codex.note) } : null,
      flags.length ? { id: 'codex_exec', title: 'Codex · codex exec 参数', text: flags.map((f) => `-c ${f}`).join(' ') } : null,
    ];
    const out = blocks.filter((b): b is IntegrationBlock => Boolean(b));
    if (out.length && str(obj.home)) out[out.length - 1] = { ...out[out.length - 1], note: [out[out.length - 1].note, `存档目录：${obj.home}（与本应用共用）`].filter(Boolean).join(' ') };
    if (out.length) return out;
  }
  const list: [string, unknown][] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map((r, i) => [String(r?.id ?? r?.client ?? i), r])
    : Array.isArray(obj.clients)
      ? (obj.clients as Record<string, unknown>[]).map((r, i) => [String(r?.id ?? r?.client ?? i), r])
      : Object.entries((obj.clients as Record<string, unknown>) ?? obj).filter(([, v]) => v && (typeof v === 'string' || typeof v === 'object'));
  const out: IntegrationBlock[] = [];
  for (const [id, v] of list) {
    if (typeof v === 'string') {
      out.push({ id, title: CLIENT_NAMES[id] ?? id, text: v });
      continue;
    }
    const r = v as Record<string, unknown>;
    const parts = ['command', 'commands', 'config', 'toml', 'json', 'snippet', 'text']
      .map((k) => r[k])
      .flatMap((x) => (Array.isArray(x) ? x : [x]))
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (!parts.length) continue;
    const file = [r.file, r.path, r.config_path].find((x) => typeof x === 'string') as string | undefined;
    const title = String(r.title ?? r.name ?? CLIENT_NAMES[id] ?? id);
    out.push({ id, title: file ? `${title}（${file}）` : title, text: parts.join(String.fromCharCode(10)), note: typeof r.note === 'string' ? r.note : typeof r.hint === 'string' ? r.hint : undefined });
  }
  return out;
}

export function SettingsPanel() {
  const g = useGame();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('models');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const [test, setTest] = useState<string>('');
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [integration, setIntegration] = useState<IntegrationBlock[] | null>(null);
  useEffect(() => {
    if (tab !== 'mcp' || integration) return;
    let alive = true;
    api.integration().then((raw) => alive && setIntegration(parseIntegration(raw)));
    return () => {
      alive = false;
    };
  }, [tab, integration]);

  const load = useCallback(async () => {
    try {
      const s = await api.settings();
      setSettings(s);
      setForm({ provider: s.provider, base_url: s.base_url, model: s.model, roles: s.roles ?? {}, input_cost_per_million: s.input_cost_per_million, output_cost_per_million: s.output_cost_per_million });
    } catch (err) {
      toast.error(err, '设置未能读取');
      setSettings({});
    }
  }, [toast]);
  const loadUsage = useCallback(async () => {
    try {
      setUsage(await api.usage());
    } catch (err) {
      toast.error(err, '用量未能读取');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (tab === 'usage') void loadUsage();
  }, [tab, loadUsage]);

  const presets = settings?.presets ?? {};
  const providerIds = useMemo(() => Array.from(new Set(['mock', ...Object.keys(presets)])), [presets]);
  const roleProviders = useMemo(
    () => Array.from(new Set(Object.values(form.roles ?? {}).map((r) => r.provider).filter((p) => p && p !== 'default' && p !== form.provider && p !== 'mock'))),
    [form],
  );

  const setRole = (role: string, field: 'provider' | 'model', value: string) =>
    setForm((f) => ({ ...f, roles: { ...(f.roles ?? {}), [role]: { provider: 'default', model: 'default', ...(f.roles?.[role] ?? {}), [field]: value } } }));

  const localCli = Boolean(presets[form.provider ?? '']?.local_cli);

  const pickProvider = (p: string) => {
    const preset = presets[p] ?? {};
    setForm((f) => ({ ...f, provider: p, base_url: preset.base_url ?? f.base_url, model: preset.model ?? f.model }));
  };

  const save = async () => {
    setBusy('save');
    try {
      const body: Partial<Settings> = { ...form };
      if (keys.__global) body.api_key = keys.__global;
      const cfgs: Settings['provider_configs'] = { ...(settings?.provider_configs ?? {}) };
      let touched = false;
      for (const [p, k] of Object.entries(keys)) {
        if (p === '__global' || !k) continue;
        cfgs[p] = { ...(cfgs[p] ?? {}), api_key: k };
        touched = true;
      }
      if (touched) body.provider_configs = cfgs;
      const s = await api.saveSettings(body);
      setSettings(s);
      setKeys({});
      toast.success('设置已存。', '设置');
    } catch (err) {
      toast.error(err, '设置未能保存');
    } finally {
      setBusy('');
    }
  };

  const runTest = async () => {
    setBusy('test');
    setTest('');
    try {
      const r = await api.testSettings();
      setTest(r.ok ? `连接成功${r.model ? ` · ${r.model}` : ''} · ${r.tool_calling ? '支持工具调用' : '以 JSON 模式代替工具调用'}` : '连接失败');
    } catch (err) {
      toast.error(err, '连接测试未通过');
      setTest('连接失败');
    } finally {
      setBusy('');
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已抄录到剪贴板。', '复制');
    } catch {
      toast.info('剪贴板不可用，请手动选中复制。', '复制');
    }
  };

  return (
    <PanelShell screen="settings" onClose={g.closePanel}>
      <Paper variant="paper" seed={515} className="settings-paper">
        <header className="timeline-head">
          <Baoxiang size={28} />
          <h2 className="panel-title">设置</h2>
          <Baoxiang size={28} />
        </header>
        <div className="tabs" role="tablist">
          {(
            [
              ['models', '模型路由'],
              ['mcp', 'MCP 接入'],
              ['usage', '用量与花费'],
              ['game', '对局'],
            ] as [Tab, string][]
          ).map(([id, name]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={cls('tab t-title', tab === id && 'is-on')} data-testid={`settings.tab.${id}`} disabled={tab === id} onClick={() => setTab(id)}>
              {name}
            </button>
          ))}
        </div>

        {tab === 'models' && (
          <div className="settings-body" data-testid="settings.models">
            {!settings ? (
              <div className="ink-loader">
                <i />
                <i />
                <i /> 读取设置
              </div>
            ) : (
              <>
                <div className="settings-grid">
                  <label>
                    <span className="t-title">默认模型服务</span>
                    <select className="field" data-testid="settings.provider" value={form.provider ?? 'mock'} onChange={(e) => pickProvider(e.target.value)}>
                      {providerIds.map((p) => (
                        <option key={p} value={p}>
                          {PROVIDER_NAMES[p] ?? presets[p]?.label ?? p}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!localCli && (
                    <label>
                      <span className="t-title">接口地址</span>
                      <input className="field" data-testid="settings.baseUrl" value={form.base_url ?? ''} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://…/v1" />
                    </label>
                  )}
                  <label>
                    <span className="t-title">模型</span>
                    <input className="field" data-testid="settings.model" value={form.model ?? ''} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                  </label>
                  {!localCli && (
                  <label>
                    <span className="t-title">密钥</span>
                    <input
                      className="field"
                      type="password"
                      autoComplete="off"
                      data-testid="settings.apiKey"
                      value={keys.__global ?? ''}
                      placeholder={settings.api_key ? `已存：${String(settings.api_key)}（留空不改）` : '尚未填写'}
                      onChange={(e) => setKeys((k) => ({ ...k, __global: e.target.value }))}
                    />
                    {presets[form.provider ?? '']?.api_key_url && <small className="muted">申请地址：{presets[form.provider ?? ''].api_key_url}</small>}
                  </label>
                  )}
                </div>
                {localCli && (
                  <p className="muted settings-note" data-testid="settings.localCli">
                    由本机已登录的 {LOCAL_CLI_NOTES[form.provider ?? '']?.who ?? '编程助手'} 扮演群臣、解释诏令，不需要接口地址和密钥，用的是你自己的账号额度。模型填 <code>default</code>
                    即跟随它当前的模型。每句回话约需 5–20 秒。先点下方「测试」：若提示未登录，在终端运行 <code>{LOCAL_CLI_NOTES[form.provider ?? '']?.login}</code> 后再试。
                  </p>
                )}

                <div className="section-label">按职分配模型</div>
                <table className="role-table">
                  <thead>
                    <tr>
                      <th>职司</th>
                      <th>服务</th>
                      <th>模型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <b className="t-title">{r.name}</b>
                          <small>{r.note}</small>
                        </td>
                        <td>
                          <select className="field" data-testid={`settings.role.${r.id}.provider`} value={form.roles?.[r.id]?.provider ?? 'default'} onChange={(e) => setRole(r.id, 'provider', e.target.value)}>
                            <option value="default">同默认</option>
                            {providerIds.map((p) => (
                              <option key={p} value={p}>
                                {PROVIDER_NAMES[p] ?? p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="field"
                            data-testid={`settings.role.${r.id}.model`}
                            value={form.roles?.[r.id]?.model === 'default' ? '' : form.roles?.[r.id]?.model ?? ''}
                            placeholder="同默认"
                            onChange={(e) => setRole(r.id, 'model', e.target.value || 'default')}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {roleProviders.length > 0 && (
                  <div className="settings-grid">
                    {roleProviders.map((p) => (
                      <label key={p}>
                        <span className="t-title">{PROVIDER_NAMES[p] ?? p} 密钥</span>
                        <input
                          className="field"
                          type="password"
                          autoComplete="off"
                          data-testid={`settings.providerKey.${p}`}
                          value={keys[p] ?? ''}
                          placeholder={settings.provider_configs?.[p]?.api_key ? `已存：${settings.provider_configs[p].api_key}` : '尚未填写'}
                          onChange={(e) => setKeys((k) => ({ ...k, [p]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="settings-grid settings-grid--costs">
                  <label>
                    <span className="t-title">输入单价（每百万 token）</span>
                    <input className="field t-num" type="number" step="0.01" data-testid="settings.inputCost" value={form.input_cost_per_million ?? 0} onChange={(e) => setForm((f) => ({ ...f, input_cost_per_million: Number(e.target.value) }))} />
                  </label>
                  <label>
                    <span className="t-title">输出单价（每百万 token）</span>
                    <input className="field t-num" type="number" step="0.01" data-testid="settings.outputCost" value={form.output_cost_per_million ?? 0} onChange={(e) => setForm((f) => ({ ...f, output_cost_per_million: Number(e.target.value) }))} />
                  </label>
                </div>
              </>
            )}
          </div>
        )}
        {tab === 'models' && settings && (
          <footer className="settings-actions">
            <span className="settings-test" data-testid="settings.testResult">
              {test}
            </span>
            <button className="btn btn-outline" data-testid="settings.test" disabled={busy !== ''} onClick={runTest}>
              {busy === 'test' ? '探测中…' : '测试连接'}
            </button>
            <button className="btn btn-ink" data-testid="settings.save" disabled={busy !== ''} onClick={save}>
              {busy === 'save' ? '存档中…' : '保存'}
            </button>
          </footer>
        )}

        {tab === 'mcp' && (
          <div className="settings-body selectable" data-testid="settings.mcp">
            <p>
              《天宝》可作为 MCP 服务接入 Claude Code 或 Codex：由你所用的模型扮演群臣、解释诏令，引擎照常结算。存档与桌面版共用（<code>%APPDATA%\tianbao</code>）。
            </p>
            {integration && integration.length > 0 ? (
              integration.map((b) => (
                <div className="mcp-block" key={b.id} data-testid={`settings.integration.${b.id}`}>
                  <div className="section-label">{b.title}</div>
                  <pre className="code">{b.text}</pre>
                  {b.note && <p className="muted">{b.note}</p>}
                  <button className="btn btn-outline btn-small" data-testid={`settings.copy.${b.id}`} onClick={() => copy(b.text)}>
                    复制
                  </button>
                </div>
              ))
            ) : (
            <>
            <div className="mcp-block">
              <div className="section-label">Claude Code</div>
              <pre className="code">{CLAUDE_CMD}</pre>
              <button className="btn btn-outline btn-small" data-testid="settings.copy.claude" onClick={() => copy(CLAUDE_CMD)}>
                复制命令
              </button>
            </div>
            <div className="mcp-block">
              <div className="section-label">Codex（~/.codex/config.toml）</div>
              <pre className="code">{CODEX_TOML}</pre>
              <button className="btn btn-outline btn-small" data-testid="settings.copy.codex" onClick={() => copy(CODEX_TOML)}>
                复制配置
              </button>
            </div>
            </>
            )}
            <p className="muted">
              模式：<code>SIM_MCP_MODE=client</code>（默认）由调用方模型扮演；改为 <code>server</code> 则使用本页配置的模型服务。接入后对模型说「开一局天宝，先看简报」即可。<code>sim</code> 需在 PATH 中（引擎 backend 安装后提供）。
            </p>
          </div>
        )}

        {tab === 'game' && (
          <div className="settings-body" data-testid="settings.game">
            <div className="settings-toggle-row">
              <div>
                <div className="section-label">新手引导</div>
                <p className="muted">前三季在案上逐步指点：奏疏、批答、诏书、政令卡、召对、廷议、兵部。关闭后不再提示，可随时重开（只影响本局）。</p>
              </div>
              <button
                className={cls('toggle', g.view?.tutorial?.enabled && 'is-on')}
                data-testid="settings.tutorial"
                role="switch"
                aria-checked={Boolean(g.view?.tutorial?.enabled)}
                disabled={!g.view}
                onClick={() => void g.setTutorial(!g.view?.tutorial?.enabled)}
              >
                <span className="toggle-knob" aria-hidden="true" />
                <span className="toggle-text t-title">{g.view?.tutorial?.enabled ? '已开' : '已关'}</span>
              </button>
            </div>
            {g.view?.agenda && (
              <div className="settings-toggle-row">
                <div>
                  <div className="section-label">朝会日程</div>
                  <p className="muted">
                    本季{g.view.agenda.text ?? ''}。召对（面见、书面奏对、遣使问对都算一次）与廷议每季有定数，季末结算后重置；不在京之臣的回奏于下季送达。
                  </p>
                </div>
              </div>
            )}
            {g.view?.provider_mode && (
              <div className="settings-toggle-row">
                <div>
                  <div className="section-label">御笔</div>
                  <p className="muted">
                    {g.view.provider_mode === 'offline'
                      ? '未接模型：诏书中的御笔（自由诏文）只记入史册，不生效力；请用奏疏批答或政令卡。'
                      : '已接模型：御笔由模型解读成条款，未必尽如圣意，颁布前请看有司回执。'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'usage' && (
          <div className="settings-body" data-testid="settings.usage">
            <div className="usage-summary">
              <span>
                调用 <b className="t-num">{usage?.calls.length ?? 0}</b> 次
              </span>
              <span>
                合计 <b className="t-num">{(usage?.total_tokens ?? 0).toLocaleString('zh-CN')}</b> token
              </span>
              <span>
                约 <b className="t-num">{(usage?.estimated_cost ?? 0).toFixed(4)}</b> 元{usage && !usage.cost_rates_configured ? '（未填单价）' : ''}
              </span>
              <button className="btn btn-outline btn-small" data-testid="settings.usage.refresh" onClick={loadUsage}>
                刷新
              </button>
            </div>
            <table className="usage-table">
              <thead>
                <tr>
                  <th>职司</th>
                  <th>模型</th>
                  <th>季</th>
                  <th>输入</th>
                  <th>输出</th>
                  <th>花费</th>
                </tr>
              </thead>
              <tbody>
                {(usage?.calls ?? []).slice(-60).reverse().map((u) => (
                  <tr key={u.id}>
                    <td>{ROLES.find((r) => r.id === u.kind || (u.kind === 'minister_chat' && r.id === 'character_chat'))?.name ?? u.kind}</td>
                    <td>
                      {u.provider} · {u.model}
                    </td>
                    <td className="t-num">{u.turn + 1}</td>
                    <td className="t-num">{u.input_tokens.toLocaleString('zh-CN')}</td>
                    <td className="t-num">{u.output_tokens.toLocaleString('zh-CN')}</td>
                    <td className="t-num">{u.estimated_cost.toFixed(4)}</td>
                  </tr>
                ))}
                {(usage?.calls.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      尚无模型调用记录{IS_MOCK ? '（演示模式）' : ''}。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Paper>
    </PanelShell>
  );
}
