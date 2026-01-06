'use client';

import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import DocumentList from '@/components/DocumentList';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);

  const handleObyektivkaClick = () => {
    const tokenFromStorage = typeof window !== 'undefined'
      ? localStorage.getItem('token')
      : null;

    if (!tokenFromStorage && !isAuthenticated && !token) {
      router.push('/login');
    } else {
      router.push('/documents/obyektivka');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold text-center">Dokumentlar ro'yxati</h2>

      <div className="max-w-md mx-auto">
        <button
          onClick={handleObyektivkaClick}
          className="hidden cursor-pointer w-full bg-green-500 text-white text-center py-3 px-4 rounded-lg hover:bg-green-600 transition"
        >
          Obyektivka qo'shish
        </button>
      </div>

      <DocumentList />
    </div>
  );
}
