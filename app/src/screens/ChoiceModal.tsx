import { motion, useIsPresent } from 'framer-motion';
import type { PendingChoice } from '../api/types';
import { EventArt } from '../components/EventArt';
import { CuancaoBand } from '../components/Ornaments';
import { Paper } from '../components/Paper';
import { useGame } from '../store/game';

export function ChoiceModal({ choice }: { choice: PendingChoice }) {
  const g = useGame();
  const present = useIsPresent();
  const view = g.view!;
  const left = (choice.deadline_turn ?? view.state.turn + 1) - view.state.turn;
  const def = choice.options.find((o) => o.id === choice.default_option);
  return (
    <motion.div
      className="overlay overlay--choice"
      data-screen="choice"
      // a leaving modal is inert: no clicks, and tests/tools only ever see the live one
      data-testid={present ? 'choice.root' : undefined}
      style={present ? undefined : { pointerEvents: 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="choice" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.45, ease: [0.22, 0.8, 0.24, 1] }}>
        <Paper variant="silk" seed={91} className="choice-paper">
          <div className="choice-art-wrap">
            <EventArt ids={[choice.illustration, `event.${choice.event_id}`]} seed={choice.event_id} className="choice-art" />
            <div className="choice-urgent t-title">急</div>
          </div>
          <CuancaoBand height={14} color="rgba(138,109,44,.85)" />
          <div className="choice-body">
            <h2 className="choice-title t-title">{choice.title}</h2>
            <p className="choice-text selectable">{choice.text}</p>
            <div className="choice-options">
              {choice.options.map((o) => (
                <button key={o.id} className="choice-option" data-testid={present ? `choice.option.${o.id}` : undefined} disabled={g.busy.choice || !present} onClick={() => g.choose(choice.id, o.id)}>
                  <span className="choice-option-text t-title">{o.text}</span>
                  {o.hint && <small>{o.hint}</small>}
                </button>
              ))}
            </div>
            <div className="choice-foot">
              <span className="muted">
                {left <= 1 ? '本季不决，' : `${left}季内不决，`}有司将依例「{def?.text ?? choice.options[0]?.text}」。
                {view.pending_choices.length > 1 && `　尚有${view.pending_choices.length - 1}件待决。`}
              </span>
              <button className="btn btn-outline btn-small" data-testid={present ? "choice.defer" : undefined} disabled={!present} onClick={() => g.deferChoice(true)}>
                暂缓
              </button>
            </div>
          </div>
        </Paper>
      </motion.div>
    </motion.div>
  );
}
