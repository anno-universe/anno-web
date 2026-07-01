import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    resolve?: (value: boolean) => void;
  }>({ open: false, title: "", message: "" });

  const confirm = (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  };

  return {
    confirm,
    ConfirmDialog: (
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
  };
}
