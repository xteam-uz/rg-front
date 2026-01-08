'use client';

import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchUser, register } from '@/store/slices/authSlice';
import { getUserData } from '@/lib/tgInit';
import { LoadingAnimation } from './LoadingAnimation';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Agar allaqachon login qilingan bo'lsa
      if (isAuthenticated) {
        setIsInitializing(false);
        return;
      }

      // 2. LocalStorage da token borligini tekshirish
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await dispatch(fetchUser()).unwrap();
        } catch (error) {
          // Token yaroqsiz bo'lsa, Telegram orqali qayta urinib ko'ramiz
          console.error('Token validation failed:', error);
          handleTelegramAuth();
          return;
        } finally {
          setIsInitializing(false);
        }
        return;
      }

      // 3. Token yo'q bo'lsa, Telegram orqali login qilish
      handleTelegramAuth();
    };

    const handleTelegramAuth = async () => {
      const tgUser = getUserData();

      if (tgUser) {
        try {
          await dispatch(register({
            telegram_user_id: tgUser.id,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
            username: tgUser.username,
          })).unwrap();
        } catch (error) {
          console.error('Telegram auth failed:', error);
        }
      }
      setIsInitializing(false);
    };

    if (typeof window !== 'undefined') {
      initAuth();
    }
  }, [dispatch, isAuthenticated]);

  if (isInitializing || (loading && !isAuthenticated)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <LoadingAnimation />
      </div>
    );
  }

  // Telegramda ochilmagan bo'lsa va login qilinmagan bo'lsa
  if (!isAuthenticated && !loading) {
    const tgUser = typeof window !== 'undefined' ? getUserData() : null;

    if (!tgUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <p className="text-lg text-gray-600 mb-4">
            Ushbu ilova faqat Telegram orqali ishlaydi.
          </p>
          <div className="p-4 bg-gray-100 rounded-lg text-sm text-gray-500 font-mono">
            Debug info: No WebApp data found
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <p className="text-red-500 mb-4">Tizimga kirishda xatolik yuz berdi.</p>
        {loading === false && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 max-w-md break-words">
            {/* Redux state error or specific message */}
            {String(error || 'Noma\'lum xatolik')}
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow active:bg-blue-600 transition-colors"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
