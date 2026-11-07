import React, { useMemo, useState } from 'react';
import { Sparkles, Check, Lock } from 'lucide-react';

interface VenueStageMapProps {
  mode: 'customer' | 'admin';
  vipCapacity: number;
  generalCapacity: number;
  occupiedSeats: string[]; // For customer: all unavailable (orders + admin blocked). For admin: order-occupied seats only.
  blockedSeats?: string[]; // Admin-blocked courtesy/reserved seats
  selectedSeats?: string[]; // Customer-selected seats
  targetVipQty?: number;
  targetGeneralQty?: number;
  onToggleCustomerSeat?: (seatId: string, tier: 'vip' | 'general') => void;
  onAutoAssignCustomerSeats?: (seats: string[]) => void;
  onToggleAdminBlockSeat?: (seatId: string) => void;
}

const PAGE_SIZE = 120;

export function formatSeatDisplay(seatId: string): string {
  if (seatId.startsWith('VIP-')) {
    const n = Number(seatId.slice(4)) || 1;
    const rowIdx = Math.floor((n - 1) / 10);
    const col = ((n - 1) % 10) + 1;
    const rowLetter = String.fromCharCode(65 + (rowIdx % 26));
    return `VIP-${rowLetter}${col}`;
  }
  if (seatId.startsWith('GEN-')) {
    const n = Number(seatId.slice(4)) || 1;
    return `G-${String(n).padStart(2, '0')}`;
  }
  return seatId;
}

export const VenueStageMap: React.FC<VenueStageMapProps> = ({
  mode,
  vipCapacity,
  generalCapacity,
  occupiedSeats,
  blockedSeats = [],
  selectedSeats = [],
  targetVipQty = 0,
  targetGeneralQty = 0,
  onToggleCustomerSeat,
  onAutoAssignCustomerSeats,
  onToggleAdminBlockSeat,
}) => {
  const [vipPage, setVipPage] = useState(0);
  const [genPage, setGenPage] = useState(0);

  const occupiedSet = useMemo(() => new Set(occupiedSeats), [occupiedSeats]);
  const blockedSet = useMemo(() => new Set(blockedSeats), [blockedSeats]);
  const selectedSet = useMemo(() => new Set(selectedSeats), [selectedSeats]);

  const selectedVipCount = useMemo(
    () => selectedSeats.filter((s) => s.startsWith('VIP-')).length,
    [selectedSeats]
  );
  const selectedGenCount = useMemo(
    () => selectedSeats.filter((s) => s.startsWith('GEN-')).length,
    [selectedSeats]
  );

  const vipTotalPages = Math.max(1, Math.ceil(vipCapacity / PAGE_SIZE));
  const genTotalPages = Math.max(1, Math.ceil(generalCapacity / PAGE_SIZE));

  const safeVipPage = Math.min(vipPage, vipTotalPages - 1);
  const safeGenPage = Math.min(genPage, genTotalPages - 1);

  const vipSlice = useMemo(() => {
    const start = safeVipPage * PAGE_SIZE + 1;
    const end = Math.min(vipCapacity, start + PAGE_SIZE - 1);
    const list: string[] = [];
    for (let i = start; i <= end; i++) list.push(`VIP-${i}`);
    return list;
  }, [vipCapacity, safeVipPage]);

  const genSlice = useMemo(() => {
    const start = safeGenPage * PAGE_SIZE + 1;
    const end = Math.min(generalCapacity, start + PAGE_SIZE - 1);
    const list: string[] = [];
    for (let i = start; i <= end; i++) list.push(`GEN-${i}`);
    return list;
  }, [generalCapacity, safeGenPage]);

  const handleAutoPick = () => {
    if (!onAutoAssignCustomerSeats) return;
    const next: string[] = [];
    for (let i = 1; i <= vipCapacity && next.filter((s) => s.startsWith('VIP-')).length < targetVipQty; i++) {
      const id = `VIP-${i}`;
      if (!occupiedSet.has(id) && !blockedSet.has(id)) {
        next.push(id);
      }
    }
    let pickedGen = 0;
    for (let i = 1; i <= generalCapacity && pickedGen < targetGeneralQty; i++) {
      const id = `GEN-${i}`;
      if (!occupiedSet.has(id) && !blockedSet.has(id)) {
        next.push(id);
        pickedGen++;
      }
    }
    onAutoAssignCustomerSeats(next);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 md:p-6 dark:border-white/10 dark:bg-[#09090D]">
      {/* Legend Bar (Inspired by Cinex seat map, styled for LA VUELTA SESSIONS) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-xs dark:border-white/10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm border border-[#D4AF37] bg-[#D4AF37]/15" />
            <span className="text-zinc-700 dark:text-zinc-300">VIP Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm border border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-900" />
            <span className="text-zinc-700 dark:text-zinc-300">General Disponible</span>
          </div>
          {mode === 'customer' ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-[#E50914]" />
              <span className="font-semibold text-zinc-900 dark:text-white">Seleccionado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-amber-500" />
              <span className="font-semibold text-zinc-900 dark:text-white">Bloqueo / Cortesía Admin</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm bg-zinc-300 dark:bg-zinc-800" />
            <span className="text-zinc-500">Ocupado / Reservado</span>
          </div>
        </div>

        {mode === 'customer' && (targetVipQty > 0 || targetGeneralQty > 0) && (
          <button
            type="button"
            onClick={handleAutoPick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-asignar mejores ubicaciones ({targetVipQty + targetGeneralQty})</span>
          </button>
        )}
      </div>

      {/* Glowing Stage / DJ Booth Arc */}
      <div className="mx-auto mt-6 mb-7 max-w-xl text-center">
        <div className="mx-auto h-3 w-full rounded-t-full bg-gradient-to-r from-transparent via-[#E50914] to-transparent opacity-90 shadow-[0_6px_24px_rgba(229,9,20,0.45)]" />
        <p className="mt-2 font-display text-lg tracking-[0.22em] text-zinc-800 dark:text-zinc-200">
          TARIMA PRINCIPAL · DJ BOOTH LA VUELTA SESSIONS
        </p>
      </div>

      {/* VIP FRONT STAGE SECTION */}
      {(mode === 'admin' || targetVipQty > 0 || vipCapacity > 0) && vipCapacity > 0 && (
        <div className="mb-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-[#D4AF37]">
                ZONA VIP FRENTE A TARIMA ({vipCapacity} cupos totales)
              </p>
              {mode === 'customer' && (
                <p className="font-mono-tabular text-[11px] text-zinc-500">
                  Seleccionados VIP: {selectedVipCount} de {targetVipQty}
                </p>
              )}
            </div>

            {vipTotalPages > 1 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: vipTotalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setVipPage(idx)}
                    className={`rounded-md px-2.5 py-1 font-mono-tabular text-[11px] font-semibold ${
                      safeVipPage === idx
                        ? 'bg-[#D4AF37] text-zinc-950'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    Bloque {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {vipSlice.map((seatId) => {
              const isOrderOccupied = occupiedSet.has(seatId) && (mode === 'customer' || !blockedSet.has(seatId));
              const isAdminBlocked = blockedSet.has(seatId);
              const isUnavailableCustomer = occupiedSet.has(seatId) || isAdminBlocked;
              const isSelected = selectedSet.has(seatId);
              const disabledForCustomer =
                mode === 'customer' && (isUnavailableCustomer || (targetVipQty === 0 && !isSelected));

              return (
                <button
                  key={seatId}
                  type="button"
                  disabled={mode === 'customer' ? disabledForCustomer : isOrderOccupied}
                  onClick={() => {
                    if (mode === 'customer') {
                      onToggleCustomerSeat?.(seatId, 'vip');
                    } else {
                      onToggleAdminBlockSeat?.(seatId);
                    }
                  }}
                  title={formatSeatDisplay(seatId)}
                  className={`flex h-8 items-center justify-center rounded-md border font-mono-tabular text-[10px] font-semibold transition-colors ${
                    mode === 'customer'
                      ? isSelected
                        ? 'border-[#E50914] bg-[#E50914] text-white'
                        : isUnavailableCustomer
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-200 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-600'
                        : targetVipQty === 0
                        ? 'cursor-not-allowed border-zinc-200/70 bg-zinc-100/60 text-zinc-400 opacity-50 dark:border-white/5 dark:bg-white/[0.02]'
                        : 'border-[#D4AF37]/60 bg-[#D4AF37]/10 text-amber-800 hover:bg-[#D4AF37]/25 dark:text-[#D4AF37]'
                      : isOrderOccupied
                      ? 'cursor-not-allowed border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : isAdminBlocked
                      ? 'border-amber-500 bg-amber-500 text-zinc-950'
                      : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-amber-800 hover:bg-[#D4AF37]/25 dark:text-[#D4AF37]'
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-3 w-3" />
                  ) : mode === 'admin' && isAdminBlocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    formatSeatDisplay(seatId).replace('VIP-', '')
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* GENERAL CLUB FLOOR SECTION */}
      {generalCapacity > 0 && (
        <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                LOCALIDAD GENERAL · PISTA CENTRAL ({generalCapacity} cupos totales)
              </p>
              {mode === 'customer' && (
                <p className="font-mono-tabular text-[11px] text-zinc-500">
                  Seleccionados General: {selectedGenCount} de {targetGeneralQty}
                </p>
              )}
            </div>

            {genTotalPages > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                {Array.from({ length: genTotalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGenPage(idx)}
                    className={`rounded-md px-2.5 py-1 font-mono-tabular text-[11px] font-semibold ${
                      safeGenPage === idx
                        ? 'bg-[#E50914] text-white'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    Zona {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {genSlice.map((seatId) => {
              const isOrderOccupied = occupiedSet.has(seatId) && (mode === 'customer' || !blockedSet.has(seatId));
              const isAdminBlocked = blockedSet.has(seatId);
              const isUnavailableCustomer = occupiedSet.has(seatId) || isAdminBlocked;
              const isSelected = selectedSet.has(seatId);
              const disabledForCustomer =
                mode === 'customer' && (isUnavailableCustomer || (targetGeneralQty === 0 && !isSelected));

              return (
                <button
                  key={seatId}
                  type="button"
                  disabled={mode === 'customer' ? disabledForCustomer : isOrderOccupied}
                  onClick={() => {
                    if (mode === 'customer') {
                      onToggleCustomerSeat?.(seatId, 'general');
                    } else {
                      onToggleAdminBlockSeat?.(seatId);
                    }
                  }}
                  title={formatSeatDisplay(seatId)}
                  className={`flex h-7 items-center justify-center rounded-md border font-mono-tabular text-[10px] font-medium transition-colors ${
                    mode === 'customer'
                      ? isSelected
                        ? 'border-[#E50914] bg-[#E50914] text-white font-bold'
                        : isUnavailableCustomer
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-200 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-600'
                        : targetGeneralQty === 0
                        ? 'cursor-not-allowed border-zinc-200/70 bg-zinc-100/60 text-zinc-400 opacity-50 dark:border-white/5 dark:bg-white/[0.02]'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:border-[#E50914] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                      : isOrderOccupied
                      ? 'cursor-not-allowed border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : isAdminBlocked
                      ? 'border-amber-500 bg-amber-500 text-zinc-950 font-bold'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-3 w-3" />
                  ) : mode === 'admin' && isAdminBlocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    seatId.slice(4)
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection Summary Footer */}
      {mode === 'customer' && (
        <div className="mt-5 border-t border-zinc-200 pt-3.5 text-center text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
          {selectedSeats.length === 0 ? (
            <span>
              Haz clic sobre las localidades disponibles o pulsa <strong>Auto-asignar mejores ubicaciones</strong>.
            </span>
          ) : (
            <span>
              Localidades asignadas ({selectedSeats.length}):{' '}
              <strong className="font-mono-tabular text-zinc-900 dark:text-white">
                {selectedSeats.slice(0, 12).map(formatSeatDisplay).join(', ')}
                {selectedSeats.length > 12 ? ` y ${selectedSeats.length - 12} más` : ''}
              </strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
