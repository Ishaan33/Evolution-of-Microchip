'use client';
import dynamic from 'next/dynamic';
const Exhibit = dynamic(() => import('@/components/Exhibit'), {
    ssr: false,
});
export default function Page() {
    return <Exhibit />;
}
