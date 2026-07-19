import { Switch } from 'argos-enem';

export const States = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Switch label="Notificações por e-mail" />
    <Switch label="Modo escuro automático" defaultChecked />
    <Switch label="Renovação automática (indisponível)" disabled />
  </div>
);
