import { useAlertContext } from "@/context/AlertProvider";
import type { AlertPayload } from "@/types/alert";

/**
 * Global alert/toast hook. Must be used inside <AlertProvider>.
 *
 * Full API:
 *   showAlert({ type, title, message })  — full control
 *   showSuccess("Record saved.")         — green toast, title defaults to "Success"
 *   showError("Unable to save.")         — red toast, title defaults to "Error"
 *   showWarning("Unsaved changes.")      — yellow toast, title defaults to "Warning"
 *   showInfo("Processing…")             — blue toast, title defaults to "Info"
 *
 * Optional second arg overrides the title:
 *   showSuccess("Payout marked paid.", "Payout Updated")
 */
export function useAlert() {
  const { showAlert, showSuccess, showError, showWarning, showInfo } =
    useAlertContext();

  return { showAlert, showSuccess, showError, showWarning, showInfo };
}

// Re-export payload type for convenience
export type { AlertPayload };

