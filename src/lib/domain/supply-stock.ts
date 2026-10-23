/**
 * A free supply set up from what is already on the shelf. Picking a stocked
 * item on the Costs screen links the supply to it (0053), so every wash that
 * uses it takes one off that item's count, and the supply shows how much of
 * it is left. The owner types the bottle once, in stock, not twice.
 */
import { STOCK_STATUS_LABEL, type StockLine } from './addon-inventory';

/** "12 left", "Out of stock", "Not counted". */
export function stockLeftLabel(line: Pick<StockLine, 'left' | 'status'>): string {
  if (line.status === 'untracked' || line.left === null) return STOCK_STATUS_LABEL.untracked;
  if (line.status === 'out') return STOCK_STATUS_LABEL.out;
  return `${line.left} left`;
}

export interface SupplyPrefill {
  name: string;
  addonId: string;
  /** The stock item's cost price as typed text, or null when none is set. */
  packCost: string | null;
}

/** What picking a stocked item fills in on a new supply. */
export function supplyFromStock(line: Pick<StockLine, 'addon' | 'unitCost'>): SupplyPrefill {
  return {
    name: line.addon.name,
    addonId: line.addon.id,
    packCost: line.unitCost === null ? null : String(line.unitCost),
  };
}
