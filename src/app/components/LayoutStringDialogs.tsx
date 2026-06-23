import {
  Check,
  Copy,
  X,
} from "lucide-react";
import { useState } from "react";

interface LayoutExportDialogProps {
  text: string;
  onClose(): void;
}

interface LayoutImportDialogProps {
  onClose(): void;
  onImport(value: string): boolean;
}

export function LayoutExportDialog({
  text,
  onClose,
}: LayoutExportDialogProps) {
  const [isCopied, setIsCopied] = useState(false);

  async function copyExportText() {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div
      className="layout-string-backdrop"
      onClick={onClose}
    >
      <section
        aria-labelledby="layout-export-title"
        aria-modal="true"
        className="layout-string-dialog app-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="layout-string-dialog__header">
          <h2 id="layout-export-title">Export layout string</h2>
          <button
            aria-label="Close export"
            className="icon-button"
            data-tooltip="Close"
            type="button"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <label className="layout-string-dialog__field">
          <span>Layout JSON</span>
          <textarea readOnly spellCheck={false} value={text} />
        </label>
        <div className="layout-string-dialog__actions">
          <button
            className="layout-string-dialog__secondary"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="primary-action-button"
            type="button"
            onClick={() => void copyExportText()}
          >
            {isCopied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {isCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function LayoutImportDialog({
  onClose,
  onImport,
}: LayoutImportDialogProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitImport() {
    const value = draft.trim();

    if (!value) {
      setError("Paste a layout JSON string.");
      return;
    }

    if (onImport(value)) {
      onClose();
      return;
    }

    setError("That string is not a factorio-facts layout export.");
  }

  return (
    <div
      className="layout-string-backdrop"
      onClick={onClose}
    >
      <section
        aria-labelledby="layout-import-title"
        aria-modal="true"
        className="layout-string-dialog app-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="layout-string-dialog__header">
          <h2 id="layout-import-title">Import layout string</h2>
          <button
            aria-label="Close import"
            className="icon-button"
            data-tooltip="Close"
            type="button"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <label className="layout-string-dialog__field">
          <span>Layout JSON</span>
          <textarea
            autoFocus
            spellCheck={false}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error ? (
          <p className="layout-string-dialog__error">{error}</p>
        ) : null}
        <div className="layout-string-dialog__actions">
          <button
            className="layout-string-dialog__secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="primary-action-button"
            type="button"
            onClick={submitImport}
          >
            <Check size={18} aria-hidden="true" />
            Import
          </button>
        </div>
      </section>
    </div>
  );
}
