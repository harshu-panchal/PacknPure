import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import CustomerLoginModal from '../components/auth/CustomerLoginModal';

const CustomerLoginContext = createContext(undefined);

/**
 * Open customer login modal from anywhere in the customer app.
 *
 * @example
 * const { openCustomerLogin } = useCustomerLogin();
 * openCustomerLogin({ title: 'Sign in to checkout' });
 */
export const CustomerLoginProvider = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [modalOptions, setModalOptions] = useState({});

    const openCustomerLogin = useCallback((options = {}) => {
        setModalOptions(options);
        setOpen(true);
    }, []);

    const closeCustomerLogin = useCallback(() => {
        setOpen(false);
        setModalOptions({});
    }, []);

    const value = useMemo(
        () => ({
            isLoginModalOpen: open,
            openCustomerLogin,
            closeCustomerLogin,
        }),
        [open, openCustomerLogin, closeCustomerLogin],
    );

    return (
        <CustomerLoginContext.Provider value={value}>
            {children}
            <CustomerLoginModal
                open={open}
                onClose={closeCustomerLogin}
                title={modalOptions.title}
                subtitle={modalOptions.subtitle}
                onSuccess={modalOptions.onSuccess}
            />
        </CustomerLoginContext.Provider>
    );
};

export const useCustomerLogin = () => {
    const ctx = useContext(CustomerLoginContext);
    if (!ctx) {
        throw new Error('useCustomerLogin must be used within CustomerLoginProvider');
    }
    return ctx;
};

/** Safe hook — returns null open fn when provider is missing (e.g. outside customer tree) */
export const useCustomerLoginOptional = () => useContext(CustomerLoginContext);
