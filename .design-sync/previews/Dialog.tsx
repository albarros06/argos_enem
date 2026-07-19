import { createPortal } from 'react-dom';
import { Dialog } from 'argos-enem';

// The card harness wraps every story root in an element with
// `transform: translateZ(0)` (design-sync's .ds-single/.ds-cell), which per
// the CSS spec makes that element the containing block for this component's
// `position: fixed` overlay — so it sizes/centers against its own content
// box instead of the real viewport. Portaling straight to document.body
// (no transformed ancestor) sidesteps that; can't be fixed from the preview
// harness side since lib/emit.mjs (which emits .ds-single/.ds-cell) is
// off-limits to fork.
export const ConfirmDiscard = () =>
  createPortal(
    <Dialog
      isOpen
      onClose={() => {}}
      title="Descartar redação?"
      description="Essa ação não pode ser desfeita. O crédito usado no envio não será devolvido."
      primaryAction={{ label: 'Descartar', onClick: () => {} }}
      secondaryAction={{ label: 'Cancelar', onClick: () => {} }}
    />,
    document.body,
  );

export const InfoOnly = () =>
  createPortal(
    <Dialog
      isOpen
      onClose={() => {}}
      title="Redação enviada"
      description="Você receberá a correção em até 5 minutos."
      primaryAction={{ label: 'Entendi', onClick: () => {} }}
    />,
    document.body,
  );
