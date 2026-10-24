// The shopping cart lives in the browser (IndexedDB), because each design carries
// its print files: one 300 DPI PNG per print area plus two pictures of the shirt.
// Nothing is sent to the server until checkout.
import type { PrintSummary, SizeId } from './design';

export interface CartItem {
  id: string;
  addedAt: number;
  colourId: string;
  size?: SizeId; // missing on items added before sizes existed: free size
  qty: number;
  prints: PrintSummary[];
  files: Record<string, Blob>; // zone → print file, plus preview and views
}

const DB = 'wearsketch-cart';
const STORE = 'items';
export const CART_EVENT = 'wearsketch-cart';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot keep a cart.'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the cart.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('The cart could not be saved. Your browser may be out of storage.')); };
  });
}

const changed = () => window.dispatchEvent(new Event(CART_EVENT));

export async function cartItems(): Promise<CartItem[]> {
  const all = (await run<CartItem[]>('readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<void> {
  const full: CartItem = { ...item, id: crypto.randomUUID(), addedAt: Date.now() };
  await run('readwrite', (s) => s.put(full));
  changed();
}

export async function setCartSize(id: string, size: SizeId): Promise<void> {
  const it = (await cartItems()).find((i) => i.id === id);
  if (!it) return;
  await run('readwrite', (s) => s.put({ ...it, size }));
  changed();
}

// the same design again as its own line, so one design can be ordered in several sizes
export async function copyCartItem(id: string): Promise<void> {
  const it = (await cartItems()).find((i) => i.id === id);
  if (!it) return;
  await run('readwrite', (s) => s.put({ ...it, id: crypto.randomUUID(), addedAt: Date.now(), qty: 1 }));
  changed();
}

export async function setCartQty(id: string, qty: number): Promise<void> {
  const items = await cartItems();
  const it = items.find((i) => i.id === id);
  if (!it) return;
  await run('readwrite', (s) => s.put({ ...it, qty }));
  changed();
}

export async function removeFromCart(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
  changed();
}

export async function clearCart(): Promise<void> {
  await run('readwrite', (s) => s.clear());
  changed();
}

// shirts in the cart, for the header link
export async function cartCount(): Promise<number> {
  try {
    return (await cartItems()).reduce((n, i) => n + i.qty, 0);
  } catch {
    return 0;
  }
}
