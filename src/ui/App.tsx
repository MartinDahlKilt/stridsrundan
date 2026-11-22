import { useState } from 'react';
import { CombatSession } from '../engine/session';
import { generateMap } from '../engine/mapgen';
import { DEFAULT_RULES, type RulesConfig } from '../engine/rules';
import { DEFAULT_MAP_SPEC, type MapSpec } from '../engine/terrain';
import { CombatScreen } from './CombatScreen';
import { characterById, loadCustoms, saveCustoms, type CustomCharacter } from './customCharacters';
import { SetupScreen, type FighterSetup } from './SetupScreen';

export interface FightConfig {
  fighters: FighterSetup[];
  seed: number;
  rules: Partial<RulesConfig>;
  /** The battlefield: setting, size and layout seed. */
  map?: MapSpec;
  pauseAfterEachAction: boolean;
}

export function App() {
  const [fight, setFight] = useState<{ session: CombatSession; config: FightConfig } | null>(null);
  const [lastConfig, setLastConfig] = useState<FightConfig | null>(null);
  const [customs, setCustoms] = useState<CustomCharacter[]>(loadCustoms);
  const changeCustoms = (list: CustomCharacter[]) => {
    setCustoms(list);
    saveCustoms(list);
  };

  const start = (config: FightConfig) => {
    const session = new CombatSession(
      config.fighters.map((f) => ({ sheet: characterById(f.presetId, customs), team: f.team, controller: f.controller, pos: f.pos, hidden: f.hidden })),
      config.seed,
      config.rules,
      generateMap(config.map ?? { ...DEFAULT_MAP_SPEC, seed: config.seed }, { ...DEFAULT_RULES, ...config.rules }.grid),
    );
    setLastConfig(config);
    setFight({ session, config });
  };

  if (!fight) return <SetupScreen initial={lastConfig} customs={customs} onCustomsChange={changeCustoms} onStart={start} />;
  return (
    <CombatScreen
      key={fight.session.state.seed + ':' + fight.config.fighters.map((f) => f.presetId).join()}
      session={fight.session}
      config={fight.config}
      onNewFight={() => setFight(null)}
      onRematch={() => start({ ...fight.config, seed: Math.floor(Math.random() * 1e6) })}
    />
  );
}
