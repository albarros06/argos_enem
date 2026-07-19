import { Checkbox } from 'argos-enem';

export const States = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Checkbox label="Aceito os termos de uso" />
    <Checkbox label="Lembrar de mim" defaultChecked />
    <Checkbox label="Receber novidades por e-mail" disabled />
    <Checkbox label="Plano anual (indisponível)" disabled defaultChecked />
  </div>
);
