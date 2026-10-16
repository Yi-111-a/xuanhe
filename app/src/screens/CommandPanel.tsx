// 官职与兵权: who holds which office, where they are, which armies they command and whether
// they actually command them (在营 / 赴任途中 / 遥领), plus vacancies and the engine's alerts.
import { Baoxiang } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { PanelShell } from '../components/PanelShell';
import { Portrait } from '../components/Portrait';
import { useGame } from '../store/game';
import { cls, fmtWan } from '../lib/util';

const STATUS: Record<string, string> = { present: '在营', en_route: '赴任途中', remote: '遥领', acting: '副将暂摄' };

export function CommandPanel() {
  const g = useGame();
  const table = g.view?.command_table;
  const rows = table?.rows ?? [];
  const vacantOffices = table?.vacancies?.offices ?? [];
  const vacantArmies = table?.vacancies?.armies ?? [];
  return (
    <PanelShell screen="command" onClose={g.closePanel}>
      <Paper variant="paper" seed={404} className="command-paper">
        <header className="timeline-head">
          <Baoxiang size={28} />
          <h2 className="panel-title">官职兵权</h2>
          <Baoxiang size={28} />
        </header>
        {(table?.alerts?.length ?? 0) > 0 && (
          <ul className="command-alerts" data-testid="command.alerts">
            {table!.alerts!.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        <div className="command-body" data-testid="command.table">
          {!table ? (
            <p className="muted">朝廷尚未呈上官职兵权总表。</p>
          ) : (
            <table className="command-table">
              <thead>
                <tr>
                  <th>人物</th>
                  <th>官职</th>
                  <th>所在</th>
                  <th>所统 · 指挥</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.character} data-testid={`command.row.${r.character}`}>
                    <td>
                      <span className="command-who">
                        <Portrait id={r.character} className="portrait--mini" />
                        <b className="t-title">{r.name}</b>
                      </span>
                    </td>
                    <td>{r.offices.map((o) => o.name).join('、') || '—'}</td>
                    <td className={cls(Boolean(r.location?.in_transit) && 'is-moving')}>{r.location?.display ?? r.location?.name ?? '—'}</td>
                    <td>
                      {r.commands.length === 0
                        ? '—'
                        : r.commands.map((c) => (
                            <div key={c.army} className={cls('command-army', `command-army--${c.status ?? 'present'}`)}>
                              {c.name}
                              {c.strength != null && <span className="t-num">　{fmtWan(c.strength)}</span>}
                              {c.whereabouts && <span className="command-whereabouts">（{c.whereabouts}）</span>}
                              <em>{c.label ?? STATUS[c.status ?? ''] ?? ''}</em>
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(vacantOffices.length > 0 || vacantArmies.length > 0) && (
            <section className="command-vacancies">
              <div className="section-label">出缺</div>
              <ul>
                {vacantOffices.map((o) => (
                  <li key={o.id}>{o.name}　出缺</li>
                ))}
                {vacantArmies.map((a) => (
                  <li key={a.army}>
                    {a.name}
                    {a.whereabouts ? `（${a.whereabouts}）` : a.station_name && `（驻${a.station_name}）`}　{a.label ?? STATUS[a.status ?? ''] ?? '无统帅'}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Paper>
    </PanelShell>
  );
}
