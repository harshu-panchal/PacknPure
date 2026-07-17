import React, { createContext, useContext } from 'react';

const PosEngineContext = createContext(null);

export const PosEngineProvider = ({ role, children }) => {
    return (
        <PosEngineContext.Provider value={{ role }}>
            {children}
        </PosEngineContext.Provider>
    );
};

export const usePosEngine = () => {
    const context = useContext(PosEngineContext);
    if (!context) {
        throw new Error("usePosEngine must be used within PosEngineProvider");
    }
    return context;
};
