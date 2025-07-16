// pages/login.tsx
import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

const LoginPage: React.FC = () => {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Redirect to home page if already authenticated
    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/'); // Redirect to the main app page
        }
    }, [status, router]);

    // Show loading state while checking session
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-white text-2xl animate-pulse">Loading...</p>
            </div>
        );
    }

    // Render login page if unauthenticated
    return (
        <div className="min-h-screen bg-gray-1000 flex items-center justify-center p-4 font-inter">
            {/* Main content card */}
            <div className="bg-white rounded-lg shadow-xl p-8 md:p-12 w-full max-w-md text-center border border-gray-200">
                {/* Logo/Icon (simplified to a dark gray) */}
                <div className="mb-6">
                    <svg className="w-16 h-16 mx-auto text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27l6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2z"/>
                    </svg>
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                    DemotivAI
                </h1>
                <p className="text-gray-700 text-lg md:text-xl mb-8">
                    Sign in to get demotivated 
                </p>
                <button
                    onClick={() => signIn('google')}
                    className="bg-gray-900 hover:bg-gray-900 text-white font-bold py-3 px-6 rounded-md shadow-lg transition-all duration-300 ease-in-out text-lg flex items-center justify-center mx-auto transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.24 10.285V14.4h6.806c-.275 1.764-1.832 4.017-4.903 4.017-3.629 0-6.56-2.932-6.56-6.56s2.931-6.56 6.56-6.56c1.765 0 3.13 0.738 4.223 1.786l2.804-2.804C19.012 2.98 16.16 2 12.24 2 6.86 2 2.22 6.64 2.22 12s4.64 10 10.02 10c5.757 0 9.77-4.07 9.77-9.77 0-.71-.087-1.37-.202-2.015H12.24z"/>
                    </svg>
                    <span>Sign In with Google</span>
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
