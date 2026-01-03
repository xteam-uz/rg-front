'use client';

// CLIENT COMPONENT - TanStack Query bilan server-side data fetching

import { useDocuments, useDeleteDocument, documentKeys } from '@/lib/queries/documents';
import { Document } from '@/lib/types';
import { useAppSelector } from '@/store/hooks';
import { useRouter } from 'next/navigation';
import { downloadFile, showNotification } from '@/lib/tgInit';
import { getStorageUrl } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function DocumentList() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: documents = [], isLoading, error } = useDocuments();
    const deleteMutation = useDeleteDocument();
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

    const handleDelete = async (id: number) => {
        if (confirm('Bu dokumentni o\'chirishni xohlaysizmi?')) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (error) {
                console.error('Delete error:', error);
                alert('Xatolik: ' + (error instanceof Error ? error.message : 'Noma\'lum xatolik'));
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

            // Blob ni avval olish (fallback uchun)
            const blob = await response.blob();

            // Document listini yangilash (PDF path ni olish uchun)
            await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

            // Kichik kutish va keyin yangilangan document ni olish
            await new Promise(resolve => setTimeout(resolve, 500));

            // Yangilangan document ni olish
            const updatedDoc = documents.find((doc: Document) => doc.id === id) ||
                (await queryClient.fetchQuery({
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
                }));

            // Agar PDF path mavjud bo'lsa, public URL dan yuklab olish
            if (updatedDoc?.pdf_path) {
                const publicUrl = getStorageUrl(updatedDoc.pdf_path);

                if (isTelegramWebApp) {
                    // Telegram WebApp da: public URL dan to'g'ridan-to'g'ri yuklab olish
                    // Telegram WebApp'da download atributi ishlamasligi mumkin,
                    // shuning uchun openLink yoki to'g'ridan-to'g'ri URL dan foydalanamiz
                    const webApp = (window as any).Telegram.WebApp;

                    // Birinchi: anchor element bilan sinab ko'ramiz
                    const a = document.createElement('a');
                    a.href = publicUrl;
                    a.download = `document_${id}.pdf`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();

                    // Muqobil: blob URL dan yuklab olish
                    setTimeout(async () => {
                        try {
                            const publicResponse = await fetch(publicUrl);
                            const publicBlob = await publicResponse.blob();
                            const blobUrl = window.URL.createObjectURL(publicBlob);

                            const a2 = document.createElement('a');
                            a2.href = blobUrl;
                            a2.download = `document_${id}.pdf`;
                            a2.style.display = 'none';
                            document.body.appendChild(a2);
                            a2.click();

                            setTimeout(() => {
                                window.URL.revokeObjectURL(blobUrl);
                                if (document.body.contains(a2)) {
                                    document.body.removeChild(a2);
                                }
                            }, 2000);
                        } catch (error) {
                            console.error('Blob download error:', error);
                        }
                    }, 100);

                    showNotification('Yuklandi');

                    setTimeout(() => {
                        if (document.body.contains(a)) {
                            document.body.removeChild(a);
                        }
                    }, 2000);
                } else {
                    // Oddiy browser: public URL dan yuklab olish
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

            // Agar PDF path hali mavjud bo'lmasa, blob orqali yuklab olish
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
                    await handleSendViaBot(id);
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

    if (isLoading) {
        return <div className="p-4">Yuklanmoqda...</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-red-500">
                Xatolik: {error instanceof Error ? error.message : 'Ma\'lumotlarni yuklashda xatolik'}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <button
                onClick={handleObyektivkaClick}
                className="block cursor-pointer w-full bg-green-500 text-white text-center py-3 px-4 mb-3 rounded-lg hover:bg-green-600 transition"
            >
                Obyektivka qo'shish
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {documents.length === 0 ? (
                    <p className="text-gray-500 col-span-full text-center py-8">Ҳозирча документ йўқ</p>
                ) : (
                    documents.map((document: Document) => (
                        <div key={document.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition flex flex-col h-full">
                            <div className="flex flex-col flex-1">
                                <h3 className="text-lg font-semibold mb-2">
                                    {getDocumentTypeLabel(document.document_type)}
                                </h3>
                                {document.personal_information && (
                                    <div className="text-sm text-gray-600 mb-2 flex-1">
                                        <p>
                                            <strong>Ф.И.Ш:</strong>{' '}
                                            {document.personal_information.familya}{' '}
                                            {document.personal_information.ism}{' '}
                                            {document.personal_information.sharif}
                                        </p>
                                        <p>
                                            <strong>Тўғилган:</strong>{' '}
                                            {new Date(document.personal_information.tugilgan_sana).toLocaleDateString('uz-UZ')}{' '}
                                            ({document.personal_information.tugilgan_joyi})
                                        </p>
                                        <p>
                                            <strong>Маълумоти:</strong> {document.education_records?.[0]?.malumoti || 'Маълумот топилмади'}
                                        </p>
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 mb-3">
                                    Яратилган: {new Date(document.created_at).toLocaleDateString('uz-UZ')}
                                </p>

                                {/* actions */}
                                <div className="flex flex-col gap-2 mt-auto">
                                    <button
                                        onClick={() => handleView(document.id)}
                                        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                    >
                                        Кўриш
                                    </button>
                                    <button
                                        onClick={() => handleEdit(document.id)}
                                        className="w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                                    >
                                        Таҳрирлаш
                                    </button>
                                    <button
                                        onClick={() => handleDownload(document.id)}
                                        className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                    >
                                        Юклаб олиш
                                    </button>
                                    <button
                                        onClick={() => handleDelete(document.id)}
                                        disabled={deleteMutation.isPending}
                                        className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm disabled:opacity-50"
                                    >
                                        {deleteMutation.isPending ? '...' : 'Ўчириш'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

