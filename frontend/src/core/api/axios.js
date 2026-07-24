import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

const readTokenFromStorage = (key) => {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return null;

    if (rawValue.startsWith('{')) {
        try {
            const parsed = JSON.parse(rawValue);
            if (typeof parsed?.token === 'string') return parsed.token;
        } catch {
            return null;
        }
    }

    return rawValue;
};

const parseUrlPath = (rawUrl) => {
    if (!rawUrl) return '';
    const value = String(rawUrl);
    if (value.startsWith('/')) return value;
    try {
        return new URL(value).pathname || '';
    } catch {
        return value;
    }
};

axiosInstance.interceptors.request.use(
    (config) => {
        let token = null;
        const pagePath = window.location.pathname;
        const isCustomerPage = !pagePath.startsWith('/admin') && !pagePath.startsWith('/seller') && !pagePath.startsWith('/delivery') && !pagePath.startsWith('/pickup');

        if (pagePath.startsWith('/seller')) {
            token = readTokenFromStorage('auth_seller');
        } else if (pagePath.startsWith('/admin')) {
            token = readTokenFromStorage('auth_admin');
        } else if (pagePath.startsWith('/delivery')) {
            token = readTokenFromStorage('auth_delivery');
        } else if (pagePath.startsWith('/pickup')) {
            token = readTokenFromStorage('auth_pickup_partner');
        } else if (isCustomerPage) {
            token = readTokenFromStorage('auth_customer');
        }

        if (!token) {
            token = readTokenFromStorage('token');
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Let the browser set multipart boundary (default application/json breaks file uploads)
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => {
        const serverDateHeader = response.headers?.date;
        if (serverDateHeader) {
            const serverMs = new Date(serverDateHeader).getTime();
            if (!isNaN(serverMs)) {
                window.__serverTimeOffset = Date.now() - serverMs;
            }
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const pagePath = window.location.pathname;
        const isSuspended =
            error.response?.data?.result?.suspended === true ||
            (error.response?.status === 403 &&
                String(error.response?.data?.message || '')
                    .toLowerCase()
                    .includes('suspended'));

        if (
            (error.response?.status === 401 || isSuspended) &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;

            const sentAuthHeader = Boolean(originalRequest?.headers?.Authorization || originalRequest?.headers?.authorization);
            if (!sentAuthHeader) {
                return Promise.reject(error);
            }

            let targetKey = null;

            if (pagePath.startsWith('/seller')) targetKey = 'auth_seller';
            else if (pagePath.startsWith('/admin')) targetKey = 'auth_admin';
            else if (pagePath.startsWith('/delivery')) targetKey = 'auth_delivery';
            else if (pagePath.startsWith('/pickup')) targetKey = 'auth_pickup_partner';
            else targetKey = 'auth_customer';

            if (targetKey) {
                localStorage.removeItem(targetKey);
            }
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            if (isSuspended && !pagePath.startsWith('/admin') && !pagePath.startsWith('/seller') && !pagePath.startsWith('/delivery') && !pagePath.startsWith('/pickup')) {
                sessionStorage.setItem(
                    'login_suspended',
                    JSON.stringify({
                        supportEmail: error.response?.data?.result?.supportEmail || '',
                        supportPhone: error.response?.data?.result?.supportPhone || '',
                    }),
                );
            }

            window.location.href = pagePath.startsWith('/admin') ? '/admin/auth' :
                pagePath.startsWith('/seller') ? '/seller/auth' :
                    pagePath.startsWith('/delivery') ? '/delivery/auth' :
                        pagePath.startsWith('/pickup') ? '/pickup/auth' : '/login';
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
