import { createPortal } from 'react-dom';
import { Toast } from 'argos-enem';

// Same position:fixed / transformed-ancestor issue as Dialog/Modal — portal
// to document.body. Also: Toast auto-dismisses via setTimeout(duration),
// default 3000ms — a long duration keeps it visible through capture's
// navigate + settle + screenshot round trip.
export const Info = () =>
  createPortal(
    <Toast type="info" message="Sua redação foi enviada para correção." duration={999999} />,
    document.body,
  );

export const Success = () =>
  createPortal(
    <Toast type="success" message="Correção concluída! Nota: 920." duration={999999} />,
    document.body,
  );

export const Warning = () =>
  createPortal(
    <Toast type="warning" message="Sua imagem está com baixa qualidade. Envie um novo arquivo." duration={999999} />,
    document.body,
  );

export const Error = () =>
  createPortal(
    <Toast type="error" message="Não foi possível processar o envio. Tente novamente." duration={999999} />,
    document.body,
  );
