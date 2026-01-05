'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchUser } from '@/store/slices/authSlice';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Protected route'lar ro'yxati
const protectedRoutes = ['/references', '/documents'];
const authRoutes = ['/login', '/register'];

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);

  // App ochilganda, agar token mavjud bo'lsa, bazadan yangi user ma'lumotlarini olish
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tokenFromStorage = localStorage.getItem('token');

    // Token mavjud bo'lsa, bazadan yangi user ma'lumotlarini olish (har doim yangilash)
    if (tokenFromStorage) {
      dispatch(fetchUser());
    }
  }, [dispatch]); // Faqat bir marta, app ochilganda

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Token tekshirish
    const tokenFromStorage = localStorage.getItem('token');

    const isProtectedRoute = protectedRoutes.some(route =>
      pathname?.startsWith(route)
    );
    const isAuthRoute = authRoutes.some(route =>
      pathname?.startsWith(route)
    );

    // Agar token yo'q bo'lsa va protected route bo'lsa, login page'ga yuborish
    if (isProtectedRoute && !tokenFromStorage && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Agar token bo'lsa va auth route'da bo'lsa, root page'ga yuborish
    if (isAuthRoute && (tokenFromStorage || isAuthenticated)) {
      router.replace('/');
      return;
    }
  }, [pathname, isAuthenticated, token, router, dispatch]);

  // Loading holatida hech narsa ko'rsatmaslik
  if (typeof window !== 'undefined') {
    const isProtectedRoute = protectedRoutes.some(route =>
      pathname?.startsWith(route)
    );

    if (isProtectedRoute) {
      const tokenFromStorage = localStorage.getItem('token');
      if (!tokenFromStorage && !isAuthenticated) {
        return null; // Login page'ga redirect qilinmoqda
      }
    }
  }

  return <>{children}</>;
}

