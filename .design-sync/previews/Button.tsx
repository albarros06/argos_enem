import { Button } from 'argos-enem';

export const Variants = () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
    <Button variant="primary">Enviar minha primeira redação</Button>
    <Button variant="secondary">Assinar novamente</Button>
    <Button variant="ghost">Cancelar</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <Button variant="primary" size="sm">Enviar</Button>
    <Button variant="primary" size="md">Enviar</Button>
    <Button variant="primary" size="lg">Enviar</Button>
  </div>
);

export const Disabled = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <Button variant="primary" disabled>Processando...</Button>
    <Button variant="secondary" disabled>Cancelar</Button>
  </div>
);
