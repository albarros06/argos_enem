import { Badge } from 'argos-enem';

export const Variants = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <Badge variant="primary">Novo</Badge>
    <Badge variant="secondary">Rascunho</Badge>
    <Badge variant="success">ponto forte</Badge>
    <Badge variant="warning">a melhorar</Badge>
    <Badge variant="error">Reprovado</Badge>
  </div>
);

export const InContext = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Badge variant="warning">a melhorar</Badge>
    <Badge variant="success">ponto forte</Badge>
  </div>
);
