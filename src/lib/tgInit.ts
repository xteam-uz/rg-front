// SSR-safe Telegram WebApp functions
// WebApp ni dynamic import qilish - faqat client-side da
const getWebApp = () => {
    if (typeof window === 'undefined') return null;
    try {
        return require('@twa-dev/sdk').default;
    } catch {
        return null;
    }
};

export const initTelegramApp = () => {
    const WebApp = getWebApp();
    if (!WebApp) return;

    WebApp.enableClosingConfirmation();
    WebApp.setHeaderColor("#222222");
    WebApp.setBackgroundColor("#ffffff");

    // Ready event
    WebApp.ready();
};

export const getUserData = () => {
    const WebApp = getWebApp();

    // Agar WebApp mavjud bo'lmasa (local development), test userni qaytarish
    if (!WebApp || !WebApp.initDataUnsafe?.user) {
        if (process.env.NODE_ENV === 'development') {
            return testGetUserData();
        }
        return null;
    }

    return WebApp.initDataUnsafe.user;
};

export const testGetUserData = () => {
    return {
        id: 893968025265,
        first_name: "Test",
        last_name: "User",
        username: "test_user",
        language_code: "uz",
        is_premium: false,
        allows_write_to_pm: true,
    };
};



export const sendDataToBot = (data: unknown) => {
    const WebApp = getWebApp();
    if (!WebApp) return;
    WebApp.sendData(JSON.stringify(data));
};

export const closeApp = () => {
    const WebApp = getWebApp();
    if (!WebApp) return;
    WebApp.close();
};

export const hello = () => {
    const WebApp = getWebApp();
    if (!WebApp) return;
    WebApp.showAlert("Hey there!");
};

export const showNotification = (message: string) => {
    const WebApp = getWebApp();
    if (!WebApp) return;
    // Telegram WebApp API da showNotification mavjud bo'lsa ishlatish
    if (typeof WebApp.showNotification === 'function') {
        WebApp.showNotification(message);
    } else {
        // Fallback: showAlert ishlatish
        WebApp.showAlert(message);
    }
};

export const downloadFile = (url: string, filename: string) => {
    const WebApp = getWebApp();
    if (!WebApp) {
        // Telegram WebApp bo'lmasa, oddiy browser download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
    }

    // Telegram WebApp da fayl yuklash
    // openLink metodi Telegram da faylni yuklab olish uchun ishlatiladi
    WebApp.openLink(url);
};
