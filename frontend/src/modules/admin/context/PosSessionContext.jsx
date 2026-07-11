import React, { createContext, useContext, useState, useEffect } from 'react';
import { posApi } from '../services/posApi';
import { toast } from 'sonner';

const PosSessionContext = createContext();

export const PosSessionProvider = ({ children }) => {
    const [activeSession, setActiveSession] = useState(null);
    const [activeTerminal, setActiveTerminal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCurrentSession = async () => {
        try {
            setIsLoading(true);
            const { data } = await posApi.getCurrentSession();
            if (data.success && data.result) {
                setActiveSession(data.result);
                // In a real scenario, activeTerminal might be saved in localStorage or fetched with the session
                setActiveTerminal(data.result.terminalId);
            } else {
                setActiveSession(null);
                setActiveTerminal(null);
            }
        } catch (error) {
            // 404 is expected if no active session exists
            if (error.response?.status !== 404) {
                console.error("Failed to fetch session", error);
            }
            setActiveSession(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentSession();
    }, []);

    const openSession = async (terminalId, openingCash) => {
        try {
            const { data } = await posApi.openSession({ terminalId, openingCash });
            if (data.success) {
                setActiveSession(data.result);
                setActiveTerminal(terminalId);
                toast.success("Session opened successfully");
                return true;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to open session");
            return false;
        }
    };

    const closeSession = async (actualCash) => {
        if (!activeSession) return false;
        try {
            const { data } = await posApi.closeSession({ 
                sessionId: activeSession._id, 
                actualCash 
            });
            if (data.success) {
                setActiveSession(null);
                setActiveTerminal(null);
                toast.success("Session closed successfully");
                return true;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to close session");
            return false;
        }
    };

    return (
        <PosSessionContext.Provider value={{
            activeSession,
            activeTerminal,
            isLoading,
            fetchCurrentSession,
            openSession,
            closeSession
        }}>
            {children}
        </PosSessionContext.Provider>
    );
};

export const usePosSession = () => useContext(PosSessionContext);
