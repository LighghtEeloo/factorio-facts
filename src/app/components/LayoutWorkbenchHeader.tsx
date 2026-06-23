import type { ReactNode } from "react";

interface LayoutWorkbenchHeaderProps {
  actions: ReactNode;
  title: ReactNode;
  className?: string;
  panel?: boolean;
  toolbar?: ReactNode;
}

export function LayoutWorkbenchHeader({
  actions,
  className,
  panel = false,
  title,
  toolbar = null,
}: LayoutWorkbenchHeaderProps) {
  return (
    <header
      className={[
        "layout-workbench-header",
        panel ? "app-panel layout-workbench-header--panel" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="layout-workbench-header__title">{title}</div>
      <div className="layout-workbench-header__toolbar">{toolbar}</div>
      <div className="layout-workbench-header__actions">{actions}</div>
    </header>
  );
}

interface LayoutWorkbenchTitleProps {
  icon: ReactNode;
  meta: ReactNode;
  title: string;
  inputLabel?: string;
  name?: string;
  titleId?: string;
  onNameChange?(name: string): void;
}

export function LayoutWorkbenchTitle({
  icon,
  inputLabel = "Layout name",
  meta,
  name,
  onNameChange,
  title,
  titleId,
}: LayoutWorkbenchTitleProps) {
  return (
    <div className="layout-workbench-title">
      {icon}
      {onNameChange ? (
        <label className="layout-workbench-title__text">
          <input
            aria-label={inputLabel}
            className="layout-workbench-title__input"
            placeholder={title}
            value={name ?? ""}
            onChange={(event) => onNameChange(event.target.value)}
          />
          <span className="layout-workbench-title__meta">{meta}</span>
        </label>
      ) : (
        <div className="layout-workbench-title__text">
          <h2 className="layout-workbench-title__heading" id={titleId}>
            {title}
          </h2>
          <span className="layout-workbench-title__meta">{meta}</span>
        </div>
      )}
    </div>
  );
}
