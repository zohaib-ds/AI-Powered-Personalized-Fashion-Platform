// Shared design model, used by the studio (browser) and the order API (server).
// The 3D shirt is textured from one 2048 x 2048 canvas laid out like the
// garment's sewing pattern. 1 cm on the shirt is about 15.4 px on that canvas.

export const TEX = 2048;
export const PX_PER_CM = 15.36;
export const CM_PER_IN = 2.54;
export const PRINT_DPI = 300;

export type Zone = 'front' | 'back' | 'sleeveR' | 'sleeveL';
export const ZONES: Zone[] = ['front', 'back', 'sleeveL', 'sleeveR'];

export interface ZoneInfo {
  label: string;
  short: string;
  // print box in texture pixels (top-left corner and size)
  x: number;
  y: number;
  w: number;
  h: number;
  // printed size in cm, for the printer
  wCm: number;
  hCm: number;
}

// Prints are allowed on the front, the back and the outer face of each sleeve.
// Never on the side seams. Front and back fit one A3 sheet, sleeves a 9 cm square.
const box = (cx: number, top: number, wCm: number, hCm: number) => ({
  x: Math.round(cx - (wCm * PX_PER_CM) / 2),
  y: Math.round(top),
  w: Math.round(wCm * PX_PER_CM),
  h: Math.round(hCm * PX_PER_CM),
  wCm,
  hCm,
});

export const ZONE_INFO: Record<Zone, ZoneInfo> = {
  // front neckline sits at y≈1064, back neckline at y≈972 on the texture
  front: { label: 'Front', short: 'Front', ...box(448, 1064 + 7 * PX_PER_CM, 28, 35) },
  back: { label: 'Back', short: 'Back', ...box(1440, 972 + 8 * PX_PER_CM, 28, 35) },
  // outer face of each sleeve, centred between shoulder and cuff. Left and
  // right are the wearer's: the left sleeve is on your right when facing the shirt.
  sleeveL: { label: 'Left sleeve', short: 'L sleeve', ...box(440, 520, 9, 9) },
  sleeveR: { label: 'Right sleeve', short: 'R sleeve', ...box(1430, 520, 9, 9) },
};

export const zoneAt = (x: number, y: number): Zone | null =>
  ZONES.find((k) => {
    const b = ZONE_INFO[k];
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }) ?? null;

export interface Colour {
  id: string;
  name: string;
  hex: string;
}

export const COLOURS: Colour[] = [
  { id: 'white', name: 'White', hex: '#f4f4f1' },
  { id: 'black', name: 'Black', hex: '#1d1e22' },
  { id: 'heather-grey', name: 'Heather grey', hex: '#a9abb0' },
  { id: 'navy', name: 'Navy', hex: '#1f2a4d' },
  { id: 'red', name: 'Red', hex: '#b8262c' },
  { id: 'forest', name: 'Forest', hex: '#24533e' },
  { id: 'mustard', name: 'Mustard', hex: '#d9a32b' },
  { id: 'sky', name: 'Sky', hex: '#8fbbe0' },
  { id: 'pink', name: 'Pink', hex: '#efb2c4' },
];

// Shirt sizes. Every size costs the same. Chest is the body measurement each size suits.
// 'free' is only on old orders and cart items: the printers do not make a free size, so it can't be picked.
export type SizeId = 'free' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export const SIZES: { id: SizeId; label: string; fit: string }[] = [
  { id: 'S', label: 'S', fit: 'Chest 36 to 38 in' },
  { id: 'M', label: 'M', fit: 'Chest 38 to 40 in' },
  { id: 'L', label: 'L', fit: 'Chest 40 to 42 in' },
  { id: 'XL', label: 'XL', fit: 'Chest 42 to 44 in' },
  { id: 'XXL', label: 'XXL', fit: 'Chest 44 to 46 in' },
];
export const isSize = (v: unknown): v is SizeId => SIZES.some((s) => s.id === v);
export const sizeShort = (size?: string) => (!size || size === 'free' ? 'Free size' : size);

// "White free-size tee" or "Black tee, size M". Orders from before sizes were free size.
export function shirtName(colourId: string, size?: string): string {
  const colour = COLOURS.find((c) => c.id === colourId)?.name ?? colourId;
  return !size || size === 'free' ? `${colour} free-size tee` : `${colour} tee, size ${size}`;
}

export const FONTS: Record<string, { weight: string; style: string }> = {
  Anton: { weight: '400', style: '' },
  'Bebas Neue': { weight: '400', style: '' },
  'Permanent Marker': { weight: '400', style: '' },
  Pacifico: { weight: '400', style: '' },
  'Playfair Display': { weight: '700', style: 'italic ' },
  'IBM Plex Mono': { weight: '700', style: '' },
};

// What the order stores about each print. Positions are in cm from the
// centre of its print zone; the PNG print files carry the actual artwork.
export interface PrintSummary {
  type: 'text' | 'image' | 'draw';
  zone: Zone;
  x: number;
  y: number;
  wCm: number;
  hCm: number;
  rot: number;
  text?: string;
  font?: string;
  color?: string;
  dpi?: number;
}

export interface DesignSummary {
  colourId: string;
  size?: SizeId;
  qty: number;
  prints: PrintSummary[];
}

export const zonesUsed = (d: Pick<DesignSummary, 'prints'>): Zone[] => ZONES.filter((z) => d.prints.some((p) => p.zone === z));

export function isDelhiPincode(pin: string): boolean {
  return /^110\d{3}$/.test(pin.trim());
}

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

// Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8 or 9.
export const isMobile = (v: string) => /^[6-9]\d{9}$/.test(v);
// The 10 digits of an Indian mobile number from whatever was typed or pasted: "+91 98765 43210", "098765 43210", "9876543210".
export function mobileDigits(v: string): string {
  let d = v.replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

// The delivery address, asked field by field so the courier can find the door.
export interface Address {
  house: string; // house or flat number
  floor: string; // optional
  building: string; // building, street or gali
  area: string; // area, colony or sector
  landmark: string; // optional
  city: string;
  pincode: string;
}

export const ADDRESS_FIELDS: { key: keyof Address; label: string; required: boolean; max: number; placeholder?: string }[] = [
  { key: 'house', label: 'House or flat number', required: true, max: 40, placeholder: 'e.g. B-24' },
  { key: 'floor', label: 'Floor (optional)', required: false, max: 30, placeholder: 'e.g. 2nd floor' },
  { key: 'building', label: 'Building, street or gali', required: true, max: 120 },
  { key: 'area', label: 'Area, colony or sector', required: true, max: 120 },
  { key: 'landmark', label: 'Landmark (optional)', required: false, max: 120, placeholder: 'e.g. near the metro station' },
  { key: 'city', label: 'City', required: true, max: 60 },
  { key: 'pincode', label: 'Pincode', required: true, max: 6 },
];

// One line for labels and old screens: "B-24, 2nd floor, Rose Apartments, Lajpat Nagar, near the metro station, City"
export function formatAddress(a: Partial<Address>): string {
  const landmark = a.landmark ? (/^(near|opp|opposite|behind|next to)\b/i.test(a.landmark) ? a.landmark : `near ${a.landmark}`) : '';
  return [a.house, a.floor, a.building, a.area, landmark, a.city].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
}
