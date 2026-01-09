'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Map component with SSR disabled
const Map = dynamic(() => import('../components/Map'), {
  ssr: false, // This tells Next.js: "Do not run this on the server"
  loading: () => (
    <div className="flex items-center justify-center w-full h-screen bg-gray-100 text-black">
      <p className="text-xl font-bold animate-pulse">Loading GIS Engine...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="w-full h-screen">
      <Map />
    </main>
  );
}