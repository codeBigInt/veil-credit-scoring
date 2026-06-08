import { useMemo, useState } from 'react';
import { Check, ChevronDown, Wallet } from 'lucide-react';
import { MidnightWalletOptions, type MidnightWalletId } from '@/context/WalletContext';

type MidnightWalletSelectorProps = {
  readonly selectedWalletId: MidnightWalletId;
  readonly isConnecting: boolean;
  readonly onConnect: (walletId: MidnightWalletId) => void;
};

export default function MidnightWalletSelector({
  selectedWalletId,
  isConnecting,
  onConnect,
}: MidnightWalletSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedWallet = useMemo(
    () => MidnightWalletOptions.find((wallet) => wallet.id === selectedWalletId) ?? MidnightWalletOptions[0],
    [selectedWalletId],
  );

  const handleConnect = (walletId: MidnightWalletId) => {
    setIsOpen(false);
    onConnect(walletId);
  };

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          disabled={isConnecting}
          className="w-full rounded-sm border px-4 py-3 text-left transition-colors disabled:opacity-50"
          style={{
            background: 'oklch(0.12 0 0)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-foreground)',
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                <Wallet size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold uppercase tracking-widest">
                  {selectedWallet.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {selectedWallet.description}
                </span>
              </span>
            </span>
            <ChevronDown size={18} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-sm border"
            style={{
              background: 'oklch(0.1 0 0)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 18px 50px rgb(0 0 0 / 0.35)',
            }}
          >
            {MidnightWalletOptions.map((wallet) => {
              const isSelected = selectedWalletId === wallet.id;
              return (
                <button
                  key={wallet.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={isConnecting}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{wallet.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{wallet.description}</span>
                  </span>
                  {isSelected && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => handleConnect(selectedWallet.id)}
        disabled={isConnecting}
        className="w-full rounded-sm px-8 py-3.5 text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
      >
        {isConnecting ? 'Connecting...' : `Connect ${selectedWallet.shortName}`}
      </button>
    </div>
  );
}
