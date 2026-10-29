// "My orders": the ids of orders placed in this browser, so a customer who closed the tab can find them
// again at /track. Only this browser keeps them; the order code and phone number still work anywhere.
const KEY = 'wearsketch-orders';
const MAX = 20;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export function rememberedOrders(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(ids) ? ids.filter(isId).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberOrder(id: string) {
  if (!isId(id)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...rememberedOrders().filter((x) => x !== id)].slice(0, MAX)));
  } catch { /* storage blocked: the order code and phone number still find it */ }
}
