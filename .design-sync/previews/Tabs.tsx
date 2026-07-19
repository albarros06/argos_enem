import { Tabs } from 'argos-enem';

export const CompetencyBreakdown = () => (
  <Tabs
    tabs={[
      { label: 'Competência 1', content: 'Domínio da norma culta da língua escrita.' },
      { label: 'Competência 2', content: 'Compreensão da proposta e aplicação de conceitos de várias áreas.' },
      { label: 'Competência 3', content: 'Seleção e organização de argumentos e fatos em defesa de um ponto de vista.' },
      { label: 'Competência 4', content: 'Conhecimento dos mecanismos linguísticos para argumentação.' },
      { label: 'Competência 5', content: 'Proposta de intervenção com respeito aos direitos humanos.' },
    ]}
  />
);

export const SecondTabActive = () => (
  <Tabs
    defaultTab={1}
    tabs={[
      { label: 'Painel', content: 'Resumo dos seus créditos e envios recentes.' },
      { label: 'Redações', content: 'Histórico de redações enviadas e corrigidas.' },
      { label: 'Redação da semana', content: 'Participe do tema da semana e veja o ranking.' },
    ]}
  />
);
