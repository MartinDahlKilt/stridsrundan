import { useState } from 'react';
import { CombatSession } from '../engine/session';
import type { RulesConfig } from '../engine/rules';
import { presetById } from '../data/presets';
import { CombatScreen } from './CombatScreen';
import { SetupScreen, type SideSetup } from './SetupScreen';

export interface FightConfig {
  sides: SideSetup[];
  seed: number;
  rules: Partial<RulesConfig>;
  pauseAfterEachAction: boolean;
}

export function App() {
  const [fight, setFight] = useState<{ session: CombatSession; config: FightConfig } | null>(null);
  const [lastConfig, setLastConfig] = useState<FightConfig | null>(null);

  const start = (config: FightConfig) => {
    const session = new CombatSession(
      config.sides.map((s, i) => ({ sheet: presetById(s.presetId), team: i, controller: s.controller })),
      config.seed,
      config.rules,
    );
    setLastConfig(config);
    setFight({ session, config });
  };

  if (!fight) return <SetupScreen initial={lastConfig} onStart={start} />;
  return (
    <CombatScreen
      key={fight.session.state.seed + ':' + fight.config.sides.map((s) => s.presetId).join()}
      session={fight.session}
      config={fight.config}
      onNewFight={() => setFight(null)}
      onRematch={() => start({ ...fight.config, seed: Math.floor(Math.random() * 1e6) })}
    />
  );
}
