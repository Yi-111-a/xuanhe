import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { useUiArt } from './components/UiArt';
import { GameProvider, useGame } from './store/game';
import { AdvicePanel } from './screens/AdvicePanel';
import { AudiencePanel } from './screens/AudiencePanel';
import { ChoiceModal } from './screens/ChoiceModal';
import { DebatePanel } from './screens/DebatePanel';
import { DeskScreen } from './screens/desk/DeskScreen';
import { EdictPanel } from './screens/EdictPanel';
import { EndingScreen } from './screens/EndingScreen';
import { MemorialPanel } from './screens/MemorialPanel';
import { NewGameScreen } from './screens/NewGameScreen';
import { ResultPanel } from './screens/ResultPanel';
import { SettingsPanel } from './screens/SettingsPanel';
import { TimelinePanel } from './screens/TimelinePanel';
import { CommandPanel } from './screens/CommandPanel';
import { RepliesPanel } from './screens/RepliesPanel';
import { Tutorial } from './screens/Tutorial';
import { TitleScreen } from './screens/TitleScreen';

function Shell() {
  const g = useGame();
  useUiArt();

  // Esc closes the top-most layer: open panel → deferred choice → region card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (g.panel) {
        e.preventDefault();
        g.closePanel();
      } else if (g.view?.pending_choices?.length && !g.choiceDeferred && g.screen === 'desk') {
        g.deferChoice(true);
      } else if (g.selectedRegion) {
        g.selectRegion(null);
      } else if (g.screen === 'newgame') {
        g.setScreen('title');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g]);

  const showChoice =
    g.screen === 'desk' && !g.panel && !g.busy.turn && !g.choiceDeferred && (g.view?.pending_choices?.length ?? 0) > 0 && !g.view?.outcome;

  return (
    <div className="app" data-current-screen={g.screen} data-current-panel={g.panel ?? ''}>
      {g.screen === 'title' && <TitleScreen />}
      {g.screen === 'newgame' && <NewGameScreen />}
      {g.screen === 'desk' && g.view && <DeskScreen />}
      {g.screen === 'ending' && <EndingScreen />}
      <AnimatePresence>
        {g.panel === 'memorial' && <MemorialPanel key="memorial" />}
        {g.panel === 'audience' && <AudiencePanel key="audience" />}
        {g.panel === 'debate' && <DebatePanel key="debate" />}
        {g.panel === 'edict' && <EdictPanel key="edict" />}
        {g.panel === 'result' && <ResultPanel key="result" />}
        {g.panel === 'timeline' && <TimelinePanel key="timeline" />}
        {g.panel === 'settings' && <SettingsPanel key="settings" />}
        {g.panel === 'advice' && <AdvicePanel key="advice" />}
        {g.panel === 'command' && <CommandPanel key="command" />}
        {g.panel === 'replies' && <RepliesPanel key="replies" />}
        {showChoice && g.view?.pending_choices[0] && (
          // one instance per choice: when two choices come back to back, the leaving one must not
          // stay clickable (it would re-send the already resolved choice id)
          <ChoiceModal key={`choice-${g.view.pending_choices[0].id}`} choice={g.view.pending_choices[0]} />
        )}
      </AnimatePresence>
      {g.screen === 'desk' && g.view && !showChoice && <Tutorial />}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <GameProvider>
        <Shell />
      </GameProvider>
    </ToastProvider>
  );
}
