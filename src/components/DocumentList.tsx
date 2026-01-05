'use client';

// CLIENT COMPONENT - TanStack Query bilan server-side data fetching

import { useState, useEffect } from 'react';
import { useDocuments, useDeleteDocument, documentKeys } from '@/lib/queries/documents';
import { Document } from '@/lib/types';
import { useAppSelector } from '@/store/hooks';
import { useRouter } from 'next/navigation';
import { showNotification } from '@/lib/tgInit';
import { getStorageUrl } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingAnimation } from './LoadingAnimation';
import { BottomBar, MainButton, SecondaryButton } from '@twa-dev/sdk/react';
import { EyeIcon, PencilSquareIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function DocumentList() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);
    const isAdmin = user?.role === 'admin';
    const [activeTab, setActiveTab] = useState<'all' | 'own'>('own');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);

    // console.log(`Is admin: ${isAdmin}, activeTab: ${activeTab}`);
    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    // Admin uchun filter parametri
    const filter = isAdmin ? activeTab : undefined;

    // Fetch documents with pagination and search
    // Note: documents is now PaginatedResponse<Document>
    const { data: documentsData, isLoading, error } = useDocuments(filter, debouncedSearch, page);

    const documents = documentsData?.data || [];
    const pagination = documentsData ? {
        current_page: documentsData.current_page,
        last_page: documentsData.last_page,
        total: documentsData.total,
        from: documentsData.from,
        to: documentsData.to
    } : null;

    const deleteMutation = useDeleteDocument();

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

    const handleDelete = async (id: number) => {
        if (confirm('Bu dokumentni o\'chirishni xohlaysizmi?')) {
            try {
                await deleteMutation.mutateAsync(id);

                // Muvaffaqiyatli o'chirilgandan keyin xabar ko'rsatish
                const isTelegramWebApp = typeof window !== 'undefined' &&
                    (window as any).Telegram?.WebApp;

                if (isTelegramWebApp) {
                    showNotification('Dokument muvaffaqiyatli o\'chirildi');
                } else {
                    alert('Dokument muvaffaqiyatli o\'chirildi');
                }
            } catch (error) {
                console.error('Delete error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Noma\'lum xatolik';

                // Telegram WebApp da bo'lsa, showAlert ishlatish
                const isTelegramWebApp = typeof window !== 'undefined' &&
                    (window as any).Telegram?.WebApp;

                if (isTelegramWebApp) {
                    const webApp = (window as any).Telegram.WebApp;
                    webApp.showAlert('Xatolik: ' + errorMessage);
                } else {
                    alert('Xatolik: ' + errorMessage);
                }
            }
        }
    };

    const handleEdit = (id: number) => {
        router.push(`/documents/${id}/edit`);
    };

    const handleView = (id: number) => {
        router.push(`/documents/${id}`);
    };

    const handleSendViaBot = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Avval tizimga kirishingiz kerak');
                return;
            }

            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

            const response = await fetch(`${API_BASE_URL}/documents/${id}/send-via-bot`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // Backend'dan kelgan aniq xatolik xabarini ko'rsatish
                const errorMessage = data.message || 'Faylni yuborishda xatolik';
                throw new Error(errorMessage);
            }

            // Bildirishnoma ko'rsatish
            const isTelegramWebApp = typeof window !== 'undefined' &&
                (window as any).Telegram?.WebApp;

            if (isTelegramWebApp) {
                showNotification('Fayl Telegram bot orqali yuborildi');
            } else {
                alert('Fayl Telegram bot orqali yuborildi');
            }
        } catch (error) {
            console.error('Send via bot error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Faylni yuborishda xatolik';

            // Telegram WebApp da bo'lsa, showAlert ishlatish
            const isTelegramWebApp = typeof window !== 'undefined' &&
                (window as any).Telegram?.WebApp;

            if (isTelegramWebApp) {
                const webApp = (window as any).Telegram.WebApp;
                webApp.showAlert(errorMessage);
            } else {
                alert('Xatolik: ' + errorMessage);
            }
        }
    };

    const handleDownload = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Avval tizimga kirishingiz kerak');
                return;
            }

            // Telegram WebApp mavjudligini tekshirish
            const isTelegramWebApp = typeof window !== 'undefined' &&
                (window as any).Telegram?.WebApp;

            // Document ma'lumotlarini topish
            const doc = documents.find((doc: Document) => doc.id === id);

            // Agar PDF allaqachon saqlangan bo'lsa, public URL dan foydalanish
            // Bu Telegram WebApp da yaxshi ishlaydi
            if (doc?.pdf_path) {
                const publicUrl = getStorageUrl(doc.pdf_path);

                // Telegram WebApp uchun maxsus yondashuv
                if (isTelegramWebApp) {
                    // Telegram WebApp da: blob orqali yuklab olish (telefonga saqlash uchun)
                    try {
                        const response = await fetch(publicUrl);
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);

                        // Telegram WebApp da faylni yuklab olish
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `document_${id}.pdf`;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();

                        // Bildirishnoma ko'rsatish
                        showNotification('Yuklandi');

                        // Tozalash
                        setTimeout(() => {
                            window.URL.revokeObjectURL(blobUrl);
                            if (document.body.contains(a)) {
                                document.body.removeChild(a);
                            }
                        }, 1000);
                    } catch (error) {
                        console.error('Download error:', error);
                        // Fallback: to'g'ridan-to'g'ri URL dan yuklab olish
                        const a = document.createElement('a');
                        a.href = publicUrl;
                        a.download = `document_${id}.pdf`;
                        a.target = '_blank';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        showNotification('Yuklandi');
                        setTimeout(() => {
                            if (document.body.contains(a)) {
                                document.body.removeChild(a);
                            }
                        }, 100);
                    }
                } else {
                    // Oddiy browser uchun: standart download
                    const a = document.createElement('a');
                    a.href = publicUrl;
                    a.download = `document_${id}.pdf`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    alert('Yuklandi');
                    setTimeout(() => {
                        if (document.body.contains(a)) {
                            document.body.removeChild(a);
                        }
                    }, 100);
                }

                // Fayl yuklab olgandan keyin, Telegram WebApp da bo'lsa bot orqali yuborishni taklif qilish
                if (isTelegramWebApp) {
                    const sendViaBot = confirm('Faylni Telegram bot orqali yuborishni xohlaysizmi?');
                    if (sendViaBot) {
                        await handleSendViaBot(id);
                    }
                }
                return;
            }

            // PDF hali saqlanmagan bo'lsa, API orqali yaratish va yuklab olish
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

            const response = await fetch(`${API_BASE_URL}/documents/${id}/download`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/pdf',
                },
            });

            if (!response.ok) {
                let errorMessage = `PDF yuklab olishda xatolik (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Blob ni avval olish va to'g'ridan-to'g'ri yuklab olish
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `document_${id}.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            if (isTelegramWebApp) {
                showNotification('Yuklandi');
            } else {
                alert('Yuklandi');
            }

            // Tozalash
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                if (document.body.contains(a)) {
                    document.body.removeChild(a);
                }
            }, 2000);

            // Fayl yuklab olgandan keyin, Telegram WebApp da bo'lsa bot orqali yuborishni taklif qilish
            if (isTelegramWebApp) {
                const sendViaBot = confirm('Faylni Telegram bot orqali yuborishni xohlaysizmi?');
                if (sendViaBot) {
                    // PDF path ni olish uchun document ni yangilash va kutish
                    await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

                    // PDF saqlanishini kutish (bir necha marta urinib ko'rish)
                    let updatedDoc = null;
                    let attempts = 0;
                    const maxAttempts = 5;

                    while (attempts < maxAttempts && !updatedDoc?.pdf_path) {
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // API dan to'g'ridan-to'g'ri document ni olish
                        updatedDoc = await queryClient.fetchQuery({
                            queryKey: documentKeys.detail(id),
                            queryFn: async () => {
                                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';
                                const docResponse = await fetch(`${API_BASE_URL}/documents/${id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                    },
                                });
                                const docData = await docResponse.json();
                                return docData.data;
                            },
                        });

                        attempts++;

                        if (updatedDoc?.pdf_path) {
                            break;
                        }
                    }

                    // PDF path mavjud bo'lsa, bot orqali yuborish
                    if (updatedDoc?.pdf_path) {
                        await handleSendViaBot(id);
                    } else {
                        const errorMsg = 'PDF fayl hali saqlanmagan. Iltimos, biroz kutib, qayta urinib ko\'ring.';
                        if (isTelegramWebApp) {
                            const webApp = (window as any).Telegram.WebApp;
                            webApp.showAlert(errorMsg);
                        } else {
                            alert(errorMsg);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Xatolik: ' + (error instanceof Error ? error.message : 'PDF yuklab olishda xatolik'));
        }
    };

    const getDocumentTypeLabel = (type: string) => {
        switch (type) {
            case 'obyektivka':
                return 'Obyektivka';
            case 'ishga_olish_ariza':
                return 'Ishga olish bo\'yicha ariza';
            case 'kochirish_ariza':
                return 'Ko\'chirish bo\'yicha ariza';
            default:
                return type;
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    };

    if (isLoading) {
        return <LoadingAnimation />;
    }

    if (error) {
        return (
            <div className="p-4 text-red-500">
                Xatolik: {error instanceof Error ? error.message : 'Ma\'lumotlarni yuklashda xatolik'}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 pb-24">
            {/* {isAdmin && (
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab('own')}
                        className={`flex-1 py-2 px-4 rounded-lg transition ${activeTab === 'own'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Dokumentlarim
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 py-2 px-4 rounded-lg transition ${activeTab === 'all'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Barcha dokumentlar
                    </button>
                </div>
            )} */}
            {activeTab === 'all' ? (
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Qidirish: F.I.O, Tug'ilgan joy, Ma'lumot, Ish joyi..."
                        value={search}
                        onChange={handleSearchChange}
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            ) : (
                <button
                    onClick={handleObyektivkaClick}
                    className="block cursor-pointer w-full bg-green-500 text-white text-center py-3 px-4 mb-3 rounded-lg hover:bg-green-600 transition"
                >
                    Obyektivka qo'shish
                </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {documents.length === 0 ? (
                    <p className="text-gray-500 col-span-full text-center py-8">
                        {debouncedSearch ? 'So\'rov bo\'yicha hech narsa topilmadi' : 'Hozircha dokument yo\'q'}
                    </p>
                ) : (
                    documents.map((document: Document) => (
                        <div key={document.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition flex flex-col h-full bg-white">
                            <div className="flex flex-col flex-1">
                                <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                                    {getDocumentTypeLabel(document.document_type)}
                                </h3>
                                {document.personal_information && (
                                    <div className="text-sm text-gray-600 mb-2 flex-1">
                                        <p className="mb-1">
                                            <strong>Ф.И.Ш:</strong>{' '}
                                            {document.personal_information.familya}{' '}
                                            {document.personal_information.ism}{' '}
                                            {document.personal_information.sharif}
                                        </p>
                                        <p className="mb-1">
                                            <strong>Тўғилган:</strong>{' '}
                                            {new Date(document.personal_information.tugilgan_sana).toLocaleDateString('uz-UZ')}{' '}
                                            ({document.personal_information.tugilgan_joyi})
                                        </p>
                                        <p className="line-clamp-2">
                                            <strong>Маълумоти:</strong> {document.education_records?.[0]?.malumoti || 'Маълумот топилмади'}
                                        </p>
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 mb-3 mt-1">
                                    Яратилган: {new Date(document.created_at).toLocaleDateString('uz-UZ')}
                                </p>

                                {/* actions */}
                                <div className="flex flex-row gap-2 mt-auto pt-4 border-t border-gray-100 justify-end">
                                    <button
                                        onClick={() => handleView(document.id)}
                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                        title="Ko'rish"
                                    >
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(document.id)}
                                        className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition"
                                        title="Tahrirlash"
                                    >
                                        <PencilSquareIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDownload(document.id)}
                                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                                        title="Yuklab olish"
                                    >
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(document.id)}
                                        disabled={deleteMutation.isPending}
                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                                        title="O'chirish"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.last_page > 1 && (
                <div className="flex justify-center items-center gap-2 mb-20">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition"
                    >
                        Oldingi
                    </button>
                    <span className="text-sm text-gray-700">
                        {pagination.current_page} / {pagination.last_page}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                        disabled={page === pagination.last_page}
                        className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition"
                    >
                        Keyingi
                    </button>
                </div>
            )
            }


            {isAdmin && (
                <>
                    <BottomBar bgColor="#ffffff">
                        <MainButton
                            color={activeTab === 'own' ? "#3b82f6" : "#e5e7eb"}
                            textColor={activeTab === 'own' ? "#ffffff" : "#374151"}
                            text="Meniki"
                            onClick={() => setActiveTab('own')}
                            hasShineEffect={activeTab === 'all'}
                        />
                        <SecondaryButton
                            color={activeTab === 'all' ? "#3b82f6" : "#e5e7eb"}
                            textColor={activeTab === 'all' ? "#ffffff" : "#374151"}
                            text="Barcha"
                            onClick={() => setActiveTab('all')}
                            position="right"
                            hasShineEffect={activeTab === 'own'}
                        />
                    </BottomBar>
                </>
            )}
        </div>
    );
}

