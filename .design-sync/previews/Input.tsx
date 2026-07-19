import { Input } from 'argos-enem';

export const Sizes = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
    <Input id="email-sm" size="sm" label="E-mail" placeholder="voce@email.com" />
    <Input id="email-md" size="md" label="E-mail" placeholder="voce@email.com" />
    <Input id="email-lg" size="lg" label="E-mail" placeholder="voce@email.com" />
  </div>
);

export const WithError = () => (
  <div style={{ width: 320 }}>
    <Input
      id="email-error"
      label="E-mail"
      value="nao-e-um-email"
      error="Informe um e-mail válido."
    />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 320 }}>
    <Input id="name-disabled" label="Nome" value="Maria Silva" disabled />
  </div>
);
