import { Modal as BaseModal } from "@/components/modals/Modals";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onConfirm?: () => void;
  children?: ReactNode;
}

export function Modal({
  open,
  title = "Error",
  description = "",
  onClose,
  onConfirm,
  children,
}: ModalProps) {
  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm ?? onClose}>OK</Button>
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      footer={footer}
      children={children ?? null}
    />
  );
}

export default Modal;
