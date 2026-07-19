import { useEffect, useRef } from 'react';
import { Select } from 'argos-enem';

const THEME_OPTIONS = [
  { value: 'redes-sociais', label: 'Impactos das redes sociais na juventude' },
  { value: 'mobilidade-urbana', label: 'Desafios da mobilidade urbana no Brasil' },
  { value: 'saude-mental', label: 'Saúde mental na era digital' },
];

export const Placeholder = () => (
  <div style={{ width: 320 }}>
    <Select options={THEME_OPTIONS} placeholder="Escolha o tema da redação" />
  </div>
);

export const Selected = () => (
  <div style={{ width: 320 }}>
    <Select options={THEME_OPTIONS} value="mobilidade-urbana" />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 320 }}>
    <Select options={THEME_OPTIONS} placeholder="Escolha o tema da redação" disabled />
  </div>
);

// Select's open/closed state is internal (useState), not prop-controlled —
// there's no public API to force it open. This story clicks the real
// trigger button on mount (a normal user interaction, not a component
// reimplementation) so the dropdown's styling can be graded too.
export const Open = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.click();
  }, []);
  return (
    <div ref={ref} style={{ width: 320 }}>
      <Select options={THEME_OPTIONS} placeholder="Escolha o tema da redação" />
    </div>
  );
};
