import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
        <h1 className="text-2xl font-bold text-center">Happy Harvests</h1>
        <p className="text-center">Welcome to the garden management app</p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/login" 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Login
          </Link>
          <Link 
            href="/dashboard" 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 