'use client';
import { useEffect, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { cx } from './helpers';
import type { IconName } from './Icon';

export interface SheetProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: 'sheet' | 'dialog';
  open?: boolean;
  inline?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Sheet(p: SheetProps): ReactElement | null {
  const dialog = p.variant === 'dialog';
  const titleId = 'vx-sheet-title' + useId();
  const { onClose } = p;
  useEffect(() => {
    if (!onClose) return undefined;
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  if (p.open === false) return null;
  return (
    <div
      className={cx('vx-overlay', dialog && 'vx-overlay--dialog', p.inline && 'vx-overlay--inline')}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className={cx('vx-sheet', p.className)} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="vx-sheet__grab" aria-hidden="true" />
        <div className="vx-sheet__head">
          <div style={{ flex: 1 }}>
            <h2 className="vx-sheet__title" id={titleId}>{p.title}</h2>
            {p.subtitle ? <p className="vx-sheet__sub">{p.subtitle}</p> : null}
          </div>
          <IconButton icon="x" label="Close" size="s" onClick={onClose} />
        </div>
        {p.children}
        {p.footer}
      </div>
    </div>
  );
}

export interface DialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIcon?: IconName;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  open?: boolean;
  inline?: boolean;
}

export function Dialog(p: DialogProps): ReactElement | null {
  return (
    <Sheet
      variant="dialog"
      inline={p.inline}
      title={p.title}
      onClose={p.onClose}
      open={p.open}
      footer={
        <div className="vx-dialog__btns">
          <Button variant="secondary" onClick={p.onClose}>{p.cancelLabel || 'Cancel'}</Button>
          <Button variant={p.destructive ? 'destructive' : 'primary'} icon={p.confirmIcon} onClick={p.onConfirm}>{p.confirmLabel || 'Confirm'}</Button>
        </div>
      }
    >
      <p className="vx-dialog__body">{p.children}</p>
    </Sheet>
  );
}
