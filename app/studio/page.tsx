import Studio from '@/components/Studio';

export const metadata = { title: 'Design studio · WearSketch', description: 'Design your own T-shirt on a 3D model in your browser. Add text, images or drawings to the front, back and sleeves and see the price live.', alternates: { canonical: '/studio' } };

export default function StudioPage() {
  return <Studio />;
}
