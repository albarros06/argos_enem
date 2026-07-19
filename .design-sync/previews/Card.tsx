import { Badge, Card } from 'argos-enem';

export const CompetencyCard = () => (
  <Card>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>C3 — Argumentação</strong>
        <Badge variant="warning">a melhorar</Badge>
      </div>
      <p style={{ margin: 0 }}>Última: <strong>720</strong> · Média: 680 · ▼ caindo</p>
    </div>
  </Card>
);

export const Variants = () => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <Card variant="default">Default</Card>
    <Card variant="elevated">Elevated</Card>
    <Card variant="outlined">Outlined</Card>
  </div>
);
