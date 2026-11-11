import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

// App-styled replacement for window.confirm(). Never use the browser's
// built-in confirm/alert/prompt in the admin panel: call confirmDialog() instead.
//
//   if (!(await confirmDialog({ title: 'Delete area?', message: '...', confirmText: 'Delete', danger: true }))) return;

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((req: Request) => void) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) { resolve(false); return; }
    show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (r) => setReq((prev) => { prev?.resolve(false); return r; });
    return () => { show = null; };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  const danger = !!req.danger;
  const accent = danger ? '#DC2626' : 'var(--primary)';

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="modal-content" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" style={{ maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: danger ? '#FEE2E2' : '#DBEAFE',
          }}>
            {danger ? <AlertTriangle size={22} color="#DC2626" /> : <HelpCircle size={22} color="#1D4ED8" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="confirm-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{req.title}</h2>
            {req.message && (
              <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{req.message}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={() => close(false)}>{req.cancelText || 'Cancel'}</button>
          <button
            ref={confirmBtn}
            type="button"
            className="btn btn-primary"
            onClick={() => close(true)}
            style={{ background: accent, borderColor: accent }}
          >
            {req.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
