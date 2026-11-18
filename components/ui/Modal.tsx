"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const secondary =
  "rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";
export const modalSaveButton =
  "rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50";

type FrameProps = {
  open?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  showFooterClose?: boolean;
};

/** Native modal focus handling; only the body scrolls, never the controls. */
export function DialogFrame({
  open = true,
  title,
  description,
  children,
  footer,
  onClose,
  busy = false,
  wide = false,
  showFooterClose = true,
}: FrameProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const lastAlert = useRef("");
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [open]);

  useEffect(() => {
    if (!open || busy) {
      lastAlert.current = "";
      return;
    }
    const element = dialog.current;
    if (!element) return;
    const revealError = () => {
      const alert = element.querySelector<HTMLElement>('[role="alert"]');
      const message = alert?.textContent || "";
      if (alert && message && message !== lastAlert.current) {
        alert.tabIndex = -1;
        alert.focus({ preventScroll: true });
        alert.scrollIntoView({ block: "nearest" });
      }
      lastAlert.current = message;
    };
    revealError();
    const observer = new MutationObserver(revealError);
    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [open, busy]);

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      className={`m-auto max-h-[92dvh] w-[calc(100%-2rem)] ${wide ? "max-w-4xl" : "max-w-2xl"} overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          backdropPress.current &&
          event.target === event.currentTarget &&
          !busy
        )
          onClose();
        backdropPress.current = false;
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-xl font-bold">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-[var(--text-secondary)]"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${secondary} shrink-0`}
          >
            Close <span aria-hidden="true">×</span>
          </button>
        </header>
        <div
          data-modal-body
          className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6"
        >
          {children}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-6">
          {showFooterClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={secondary}
            >
              Close
            </button>
          )}
          {footer}
        </footer>
      </div>
    </dialog>
  );
}

/** The same guard is used by modal forms and the inline calling batch. */
export function useCloseGuard({
  dirty,
  busy = false,
  onClose,
  onSave,
  saveDescription,
}: {
  dirty: boolean;
  busy?: boolean;
  onClose: () => void;
  onSave?: () => void;
  saveDescription?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const pendingSave = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingSave.current !== null)
        cancelAnimationFrame(pendingSave.current);
    },
    [],
  );
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  function requestClose() {
    if (busy) return;
    if (dirty) setConfirming(true);
    else onClose();
  }

  const confirmation = confirming ? (
    <DialogFrame
      showFooterClose={false}
      title="Unsaved changes"
      onClose={() => setConfirming(false)}
      footer={
        <>
          <button
            type="button"
            className={secondary}
            onClick={() => setConfirming(false)}
          >
            Keep editing
          </button>
          <button
            type="button"
            className={`${secondary} text-red-600`}
            onClick={() => {
              setConfirming(false);
              onClose();
            }}
          >
            Close without saving
          </button>
          {onSave && (
            <button
              type="button"
              className={modalSaveButton}
              onClick={() => {
                setConfirming(false);
                // Remove the confirmation's top-layer dialog before validating/focusing the form.
                pendingSave.current = requestAnimationFrame(() => {
                  pendingSave.current = null;
                  onSave();
                });
              }}
            >
              Save and close
            </button>
          )}
        </>
      }
    >
      <p>
        Your changes have not been saved. Save them before closing, discard
        them, or keep editing.
      </p>
      {saveDescription && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {saveDescription}
        </p>
      )}
    </DialogFrame>
  ) : null;
  return { requestClose, confirmation };
}

export default function Modal({
  dirty = false,
  formId,
  saveDescription,
  ...props
}: FrameProps & {
  dirty?: boolean;
  formId?: string;
  saveDescription?: string;
}) {
  const { requestClose, confirmation } = useCloseGuard({
    dirty: props.open === false ? false : dirty,
    busy: props.busy,
    onClose: props.onClose,
    onSave: formId
      ? () => {
          const form = document.getElementById(formId);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }
      : undefined,
    saveDescription,
  });
  return (
    <>
      <DialogFrame {...props} onClose={requestClose} />
      {props.open !== false && confirmation}
    </>
  );
}
