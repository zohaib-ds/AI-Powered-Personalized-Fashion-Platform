import { redirect } from 'next/navigation';

// Orders now open right on the merchant page.
export default function PrinterOrder() {
  redirect('/printer');
}
