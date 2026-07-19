import { Radio } from 'argos-enem';

export const ThemeChoice = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Radio name="theme-type" label="Tema oficial do ENEM" defaultChecked />
    <Radio name="theme-type" label="Tema livre" />
  </div>
);

export const Disabled = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Radio name="theme-type-disabled" label="Tema oficial do ENEM" disabled />
    <Radio name="theme-type-disabled" label="Tema livre" disabled defaultChecked />
  </div>
);
