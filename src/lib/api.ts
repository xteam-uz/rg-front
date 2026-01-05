// API helper functions - Backend bilan ishlash uchun axios orqali
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

// Backend URL ni sozlash
const getBackendUrl = (apiUrl?: string): string => {
    if (!apiUrl) return 'http://localhost:8001';

    try {
        const url = new URL(apiUrl);
        // /api ni oxiridan olib tashlash
        url.pathname = url.pathname.replace(/\/api\/?$/, '');
        return url.toString().replace(/\/$/, ''); // oxiridagi / ni olib tashlash
    } catch {
        // URL parsing xatolik bo'lsa, eski usulni ishlatish
        return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || getBackendUrl(process.env.NEXT_PUBLIC_API_URL);

// Storage file URL helper
export function getStorageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}/storage/${path}`;
}

// Axios instance yaratish - Backend bilan aloqa uchun
const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 15000, // 15 soniya timeout
    withCredentials: false, // TWA uchun
});

// Request interceptor (token qo'shish uchun)
apiClient.interceptors.request.use(
    (config) => {
        // Token bo'lsa qo'shish mumkin
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor (xatoliklarni boshqarish)
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response) {
            // 401 Unauthorized - token noto'g'ri yoki muddati o'tgan
            if (error.response.status === 401) {
                // Token'ni localStorage'dan o'chirish
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    // Login sahifasiga yuborish
                    window.location.href = '/login';
                }
            }
            // Server xatolik javob berdi
            const message =
                (error.response.data as any)?.message ||
                (error.response.data as any)?.error ||
                `API Error: ${error.response.status} ${error.response.statusText}`;
            throw new Error(message);
        } else if (error.request) {
            // So'rov yuborildi, lekin javob kelmadi
            // Bu CORS muammosi yoki backend ishlamayapti
            const isCorsError = error.message?.includes('CORS') ||
                error.message?.includes('cors') ||
                error.code === 'ERR_NETWORK';

            let errorMessage = `Network error: Backend ga ulanib bo'lmadi. API URL: ${API_BASE_URL}`;
            if (isCorsError) {
                errorMessage += '\nEhtimol CORS muammosi. Backend CORS sozlamalarini tekshiring.';
            }

            console.error('Network Error Details:', {
                message: error.message,
                code: error.code,
                config: error.config,
                request: error.request
            });
            // throw new Error(errorMessage);
        } else {
            // So'rovni sozlashda xatolik
            throw new Error(error.message || 'Xatolik yuz berdi');
        }
    }
);

// GET request uchun helper funksiya
export async function fetchData<T>(
    endpoint: string,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await apiClient.get<T>(endpoint, config);
    return response.data;
}

// POST request uchun helper funksiya
export async function postData<T>(
    endpoint: string,
    data: unknown,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await apiClient.post<T>(endpoint, data, config);
    return response.data;
}

// PUT request uchun helper funksiya
export async function putData<T>(
    endpoint: string,
    data: unknown,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await apiClient.put<T>(endpoint, data, config);
    return response.data;
}

// DELETE request uchun helper funksiya
export async function deleteData<T>(
    endpoint: string,
    config?: AxiosRequestConfig
): Promise<T> {
    const response = await apiClient.delete<T>(endpoint, config);
    return response.data;
}

export default apiClient;

