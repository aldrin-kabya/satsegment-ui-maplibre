'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Map component with SSR disabled
const Map = dynamic(() => import('../components/Map'), {
  ssr: false, // This tells Next.js: "Do not run this on the server"
  loading: () => (
    <div className="flex items-center justify-center w-full h-screen bg-white">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner Animation */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        {/* Loading Text */}
        <p className="text-xl font-bold text-gray-700">Loading Map</p>
      </div>
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