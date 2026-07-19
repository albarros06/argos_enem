import { createPortal } from 'react-dom';
import { Modal } from 'argos-enem';

// Same containing-block issue as Dialog (see .design-sync/previews/Dialog.tsx):
// the card harness wraps every story root in a `transform: translateZ(0)`
// element, which becomes the containing block for this component's
// `position: fixed` overlay. Portal to document.body to render against the
// real viewport instead.
export const WithTitle = () =>
  createPortal(
    <Modal isOpen onClose={() => {}} title="Detalhes da competência">
      <p>
        C3 avalia a seleção, organização e interpretação de informações, fatos, opiniões e
        argumentos em defesa de um ponto de vista.
      </p>
    </Modal>,
    document.body,
  );

export const NoTitle = () =>
  createPortal(
    <Modal isOpen onClose={() => {}}>
      <p>Processando sua redação. Isso pode levar alguns instantes.</p>
    </Modal>,
    document.body,
  );
