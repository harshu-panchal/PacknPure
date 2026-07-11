import React, { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@mui/material'; // Or custom button if available

export class PosErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("POS Module Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 rounded-lg">
                    <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong in the POS system</h2>
                    <p className="text-gray-600 mb-6 max-w-md">
                        A critical error occurred. Don't worry, the rest of the Admin panel is still functional.
                    </p>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<RefreshCcw />}
                        onClick={() => window.location.reload()}
                    >
                        Reload POS
                    </Button>
                    
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-gray-100 rounded text-left overflow-auto w-full max-w-3xl text-sm text-red-600 font-mono">
                            <p className="font-bold">{this.state.error && this.state.error.toString()}</p>
                            <pre className="mt-2">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children; 
    }
}
