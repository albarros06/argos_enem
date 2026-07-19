import { useEffect, useRef } from 'react';
import { Tooltip } from 'argos-enem';

// Tooltip only shows content on onMouseEnter (internal useState, no prop to
// force it open), and the capture harness only navigates + screenshots, no
// interaction simulation. Force it open by dispatching a native mouseover on
// mount — React's synthetic event system derives onMouseEnter from it.
// IMPORTANT: must dispatch on the actual node carrying the handler (Tooltip's
// own internal wrapper div, class Tooltip_wrapper), not on an ancestor we
// control — bubbling goes up from the target, not down to descendants, so
// dispatching on our own outer ref (a parent of Tooltip's wrapper) never
// reaches the handler.
// Extra padding: the tooltip bubble is absolutely positioned relative to the
// trigger and can be wider than it (centered above/below, or offset to a
// side) — without room around the trigger, the card's own overflow:hidden
// clips the bubble against the card edge.
function AlwaysHovered({ children }: { children: React.ReactElement }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = containerRef.current?.querySelector('[class*="Tooltip_wrapper"]');
    target?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }, []);
  return (
    <div
      ref={containerRef}
      style={{ width: 520, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </div>
  );
}

export const Top = () => (
  <AlwaysHovered>
    <Tooltip content="Nota final: média das 5 competências (0-1000)" position="top">
      <span style={{ fontWeight: 700 }}>950</span>
    </Tooltip>
  </AlwaysHovered>
);

export const Bottom = () => (
  <AlwaysHovered>
    <Tooltip content="C3: seleção e organização de argumentos" position="bottom">
      <span style={{ fontWeight: 700 }}>C3</span>
    </Tooltip>
  </AlwaysHovered>
);

export const Left = () => (
  <AlwaysHovered>
    <Tooltip content="Envio ainda não corrigido" position="left">
      <span style={{ fontWeight: 700 }}>Pendente</span>
    </Tooltip>
  </AlwaysHovered>
);

export const Right = () => (
  <AlwaysHovered>
    <Tooltip content="Créditos disponíveis para novos envios" position="right">
      <span style={{ fontWeight: 700 }}>3 créditos</span>
    </Tooltip>
  </AlwaysHovered>
);
