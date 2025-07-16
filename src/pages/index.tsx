// pages/index.tsx
import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react'; // 'signIn' removed as it's not used here
import { useRouter } from 'next/router';
import Image from 'next/image'; // Import Image component for optimization

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

// Main App component for the AI Voice Agent
const App: React.FC = () => {
    const { data: session, status } = useSession(); // Get session data and status
    const router = useRouter(); // Initialize router

    // Redirect logic: If not authenticated, redirect to login page
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // State variables with explicit type annotations
    const [listening, setListening] = useState<boolean>(false);
    const [userTranscript, setUserTranscript] = useState<string>('');
    // Updated AI's initial greeting with the user's provided text
    const [aiResponse, setAiResponse] = useState<string>('HHello! how can i funk your mental health today?');
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // New state for the typing animation effect
    const [displayedAiResponse, setDisplayedAiResponse] = useState<string>('');
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State for voice selection
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(''); // Store URI to identify selected voice

    // State for language selection (for both input and output)
    const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US'); // Default to English (US)

    // New states for usage statistics
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [totalQueries, setTotalQueries] = useState<number | null>(null);

    // Refs for Web Speech API objects with specific types
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    // Function to speak text using Web Speech API (memoized with useCallback)
    const speakText = useCallback((text: string) => {
        if (!synthRef.current) {
            console.error('Speech synthesis not initialized.');
            return;
        }

        if (synthRef.current.speaking) {
            synthRef.current.cancel(); // Stop current speech if any
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = selectedLanguage; // Set language for speech

        // Set the selected voice
        const voiceToUse = voices.find(voice => voice.voiceURI === selectedVoiceURI);
        if (voiceToUse) {
            utterance.voice = voiceToUse;
        } else {
            console.warn('Selected voice not found, using default or first available for language.');
            // Fallback to a default or first available voice for the selected language
            utterance.voice = voices.find(voice => voice.lang === selectedLanguage) || voices[0];
        }

        utterance.pitch = 1; // Default pitch
        utterance.rate = 1; // Default rate

        utterance.onstart = () => {
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            console.error('Speech synthesis error:', event.error);
            setIsSpeaking(false);
        };

        synthRef.current.speak(utterance);
    }, [selectedLanguage, selectedVoiceURI, voices]); // Dependencies for speakText

    // Function to get a motivational response from the AI via Next.js API route (memoized with useCallback)
    const getAiMotivationalResponse = useCallback(async (query: string) => {
        setIsLoading(true);
        setAiResponse('Thinking...'); // This will immediately start typing "Thinking..."

        try {
            const response = await fetch('/api/motivate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Pass the selected language for both input and output to the backend
                body: JSON.stringify({
                    prompt: query,
                    inputLanguage: selectedLanguage,
                    outputLanguage: selectedLanguage,
                    userId: session?.user?.id || 'anonymous', // Pass user ID from session
                    userName: session?.user?.name || 'Guest' // Pass user name from session
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
            }

            const data: { message: string } = await response.json();
            const motivationalMessage = data.message;

            setAiResponse(motivationalMessage); // This will trigger the typing animation
            speakText(motivationalMessage);

            // After a successful query, refresh stats
            const statsResponse = await fetch('/api/stats');
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                setTotalUsers(statsData.totalUsers);
                setTotalQueries(statsData.totalQueries);
            }

        } catch (error: unknown) { // Use unknown for caught errors
            console.error('Error fetching AI response:', error);
            let errorMessage = 'An unknown error occurred.';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String((error as { message: unknown }).message);
            }
            setAiResponse(`Sorry, I couldn&apos;t get a response. Please try again. (${errorMessage})`);
            speakText(`Sorry, I couldn&apos;t get a response. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedLanguage, session, speakText]); // Dependencies for getAiMotivationalResponse

    // Effect hook to initialize Web Speech API and load voices on component mount
    // This effect should only run if the user is authenticated.
    useEffect(() => {
        if (status !== 'authenticated' || typeof window === 'undefined') {
            return;
        }

        // Initialize SpeechSynthesis and SpeechRecognition only when window is defined
        // and ensure synthRef.current is assigned before using it.
        if (!synthRef.current) {
            synthRef.current = window.speechSynthesis;
        }

        const populateVoiceList = () => {
            if (synthRef.current) { // Ensure synthRef.current is available
                const availableVoices = synthRef.current.getVoices();
                setVoices(availableVoices);
                // Set a default voice if none is selected or if the previously selected one is not available
                if (!selectedVoiceURI && availableVoices.length > 0) {
                    const defaultVoice = availableVoices.find(voice =>
                        voice.lang === selectedLanguage && voice.name.includes('Google')
                    ) || availableVoices.find(voice => voice.lang === selectedLanguage) || availableVoices[0];
                    setSelectedVoiceURI(defaultVoice.voiceURI);
                }
            }
        };

        // Populate voices initially and whenever voices change (e.g., after loading)
        // Ensure onvoiceschanged is set up only if synthRef.current is valid
        if (synthRef.current) {
            populateVoiceList(); // Call initially
            synthRef.current.onvoiceschanged = populateVoiceList;
        }


        // Check if the browser supports Web Speech API
        if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window) || !('speechSynthesis' in window)) {
            setAiResponse('Your browser does not support Web Speech API. Please use Chrome for full functionality.');
            return;
        }

        // Initialize SpeechRecognition
        const SpeechRecognition = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Listen for a single utterance
        recognitionRef.current.interimResults = false; // Only return final results
        recognitionRef.current.lang = selectedLanguage; // Set language for recognition

        // Event listener for when speech recognition results are available
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            setUserTranscript(transcript);
            console.log('User said:', transcript);
            // Once speech is recognized, send it to the AI for a response
            getAiMotivationalResponse(transcript);
        };

        // Event listener for when speech recognition ends
        recognitionRef.current.onend = () => {
            setListening(false); // Stop listening state
            console.log('Speech recognition ended.');
        };

        // Event listener for speech recognition errors
        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setListening(false); // Stop listening state on error
            setAiResponse(`Error: ${event.error}. Please try again.`);
            speakText(`Error: ${event.error}. Please try again.`);
        };

        // Cleanup function to stop recognition if component unmounts
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (synthRef.current) {
                synthRef.current.cancel(); // Stop any ongoing speech
                synthRef.current.onvoiceschanged = null; // Remove event listener
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [selectedLanguage, status, getAiMotivationalResponse, selectedVoiceURI, speakText]); // All dependencies included

    // Effect for fetching usage statistics
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/stats');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setTotalUsers(data.totalUsers);
                setTotalQueries(data.totalQueries);
            } catch (error: unknown) { // Use unknown for caught errors
                console.error('Failed to fetch usage statistics:', error);
                setTotalUsers(null);
                setTotalQueries(null);
            }
        };

        // Fetch stats only if authenticated and on client side
        if (status === 'authenticated' && typeof window !== 'undefined') {
            fetchStats();
            // Optionally refetch stats periodically or after new query
            // const interval = setInterval(fetchStats, 60000); // Refetch every minute
            // return () => clearInterval(interval);
        }
    }, [status]); // Re-run when authentication status changes

    // Effect for typing animation
    useEffect(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (aiResponse) {
            let i = 0;
            setDisplayedAiResponse(''); // Clear previous displayed text
            const typeText = () => {
                if (i < aiResponse.length) {
                    setDisplayedAiResponse(prev => prev + aiResponse.charAt(i));
                    i++;
                    typingTimeoutRef.current = setTimeout(typeText, 50); // Adjusted typing speed to 50ms per character (slower)
                }
            };
            typeText();
        }

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [aiResponse]); // Re-run effect when aiResponse changes

    // Function to start or stop listening
    const toggleListening = () => {
        if (!recognitionRef.current) {
            setAiResponse('Speech recognition not initialized.');
            speakText('Speech recognition not initialized.');
            return;
        }

        if (listening) {
            recognitionRef.current.stop(); // Stop listening
            setIsSpeaking(false); // Ensure speaking state is reset
        } else {
            setUserTranscript(''); // Clear previous transcript
            setAiResponse('Listening...'); // Indicate listening state
            setIsSpeaking(false); // Ensure speaking state is reset
            try {
                synthRef.current?.cancel(); // Stop any ongoing speech before listening
                recognitionRef.current.lang = selectedLanguage; // Ensure recognition language is updated
                recognitionRef.current.start(); // Start listening
                setListening(true);
                console.log('Listening started...');
            } catch (error: unknown) { // Use unknown for caught errors
                console.error('Error starting recognition:', error);
                setListening(false);
                let errorMessage = 'An unknown error occurred.';
                if (error instanceof Error) {
                    errorMessage = error.message;
                } else if (typeof error === 'object' && error !== null && 'message' in error) {
                    errorMessage = String((error as { message: unknown }).message);
                }
                setAiResponse(`Could not start microphone. Please check permissions. (${errorMessage})`);
                speakText(`Could not start microphone. Please check permissions.`);
            }
        }
    };

    // Function to stop the AI's voice immediately
    const stopSpeaking = () => {
        if (synthRef.current && synthRef.current.speaking) {
            synthRef.current.cancel(); // Stop all speech synthesis
            setIsSpeaking(false); // Update speaking state
            console.log('Speech stopped.');
        }
    };

    // Handler for voice selection change
    const handleVoiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedVoiceURI(event.target.value);
    };

    // Handler for language selection change (for both user input and AI output)
    const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value;
        setSelectedLanguage(newLang);
        // Reset selected voice when language changes, to pick a voice for the new language
        setSelectedVoiceURI('');
        // Stop listening if active, as language change requires re-initialization of recognition
        if (listening) {
            toggleListening();
        }
    };

    // Show loading or redirect message if not authenticated
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                <p className="text-white text-2xl animate-pulse">Loading...</p>
            </div>
        );
    }

    // If not authenticated, the useEffect will redirect. This ensures nothing else renders.
    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                <p className="text-white text-2xl animate-pulse">Redirecting to login...</p>
            </div>
        );
    }

    // Render the main app content only if authenticated
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex flex-col items-center justify-between p-4 font-inter relative overflow-hidden">
            {/* Background elements for visual interest */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://placehold.co/1920x1080/6A0DAD/FFFFFF?text=Motivation+Pattern')] bg-cover bg-center opacity-10 blur-sm animate-pulse-slow"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/80 to-blue-500/80"></div>

            {/* Main content card */}
            <div className="relative z-10 bg-white bg-opacity-95 backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-3xl text-center border-4 border-white border-opacity-40 transform transition-all duration-500 ease-out scale-95 hover:scale-100 mb-auto">
                {/* Header with User Info and Sign Out */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        {session?.user?.image && (
                            <Image
                                src={session.user.image}
                                alt="User Avatar"
                                width={48} // Specify width
                                height={48} // Specify height
                                className="rounded-full border-2 border-blue-400 shadow-md"
                            />
                        )}
                        <p className="text-gray-800 text-xl font-semibold">
                            Welcome, <span className="text-purple-700">{session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0]}</span>!
                        </p>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 text-sm"
                    >
                        Sign Out
                    </button>
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4 drop-shadow-lg leading-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-blue-600">
                        Your Daily MotivAI Boost
                    </span>
                </h1>
                <p className="text-gray-700 text-lg md:text-xl mb-8 font-medium">
                    Ready to conquer your goals? Speak to your AI coach!
                </p>

                {/* AI Response Display */}
                <div className="bg-gray-100 rounded-xl p-6 mb-8 shadow-inner border border-gray-200 min-h-[120px] flex items-center justify-center relative overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center space-x-2 text-gray-500 text-lg">
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            <span>{aiResponse}</span>
                        </div>
                    ) : (
                        <p className={`text-gray-700 text-xl italic ${isSpeaking ? 'animate-pulse text-blue-600 font-semibold font-bold' : 'text-purple-700'}`}>
                            &quot;{displayedAiResponse}
                            {/* Typing cursor only visible while typing is in progress and not loading */}
                            {(!isLoading && displayedAiResponse.length < aiResponse.length) && <span className="animate-blink">|</span>}
                        &quot;</p>
                    )}
                </div>

                {/* User Transcript Display */}
                {userTranscript && (
                    <div className="bg-blue-50 bg-opacity-70 rounded-xl p-4 mb-8 shadow-inner border border-blue-200">
                        <p className="text-blue-700 text-md">
                            <span className="font-semibold">You said:</span> &quot;{userTranscript}&quot;
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                    {/* Microphone Button */}
                    <button
                        onClick={toggleListening}
                        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out
                                    ${listening ? 'bg-red-500 shadow-red-400/50' : 'bg-blue-600 shadow-blue-500/50'}
                                    ${isSpeaking ? 'animate-pulse-light' : ''}
                                    transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300`}
                        disabled={isLoading}
                    >
                        <div className={`absolute inset-0 rounded-full border-4 ${listening ? 'border-red-300 animate-ping-slow' : 'border-blue-300'}`}></div>
                        <svg
                            className={`w-14 h-14 ${listening ? 'text-white' : 'text-white'} transition-colors duration-300`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {listening ? (
                                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.2-3c0 3-2.54 5.1-5.2 5.1S6.8 14 6.8 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.8z"/>
                            ) : (
                                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.2-3c0 3-2.54 5.1-5.2 5.1S6.8 14 6.8 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.8z"/>
                            )}
                        </svg>
                    </button>

                    {/* Stop Voice Button */}
                    <button
                        onClick={stopSpeaking}
                        className={`w-28 h-28 rounded-full flex items-center justify-center bg-gray-500 shadow-gray-400/50 text-white transition-all duration-300 ease-in-out
                                    transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-gray-300
                                    ${!isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!isSpeaking || isLoading} // Only enabled when AI is speaking
                    >
                        <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h12v12H6z"/>
                        </svg>
                    </button>
                </div>
                <p className="mt-4 text-gray-600 text-sm">
                    {listening ? 'Listening... Speak now!' : 'Click microphone to speak | Click square to stop voice'}
                </p>


                {/* Language & Voice Selection Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {/* Language Selection Dropdown (for both user input and AI output) */}
                    <div>
                        <label htmlFor="language-select" className="block text-gray-700 text-lg font-semibold mb-2">
                            Choose Language:
                        </label>
                        <select
                            id="language-select"
                            className="block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800"
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            disabled={isLoading || isSpeaking || listening}
                        >
                            <option value="en-US">English (US)</option>
                            <option value="mr-IN">Marathi (India)</option>
                            {/* Add more languages here */}
                        </select>
                    </div>

                    {/* Voice Selection Dropdown (for AI output voice) */}
                    <div>
                        <label htmlFor="voice-select" className="block text-gray-700 text-lg font-semibold mb-2">
                            Choose AI Voice:
                        </label>
                        <select
                            id="voice-select"
                            className="block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800"
                            value={selectedVoiceURI}
                            onChange={handleVoiceChange}
                            disabled={isLoading || isSpeaking}
                        >
                            {voices.length === 0 ? (
                                <option value="">Loading voices...</option>
                            ) : (
                                voices.filter(voice => voice.lang === selectedLanguage).map((voice) => (
                                    <option key={voice.voiceURI} value={voice.voiceURI}>
                                        {voice.name} ({voice.lang}) {voice.default ? '(Default)' : ''}
                                    </option>
                                ))
                            )}
                             {voices.filter(voice => voice.lang === selectedLanguage).length === 0 && (
                                <option value="">No voices available for this language</option>
                            )}
                        </select>
                        <p className="text-sm text-gray-500 mt-1">
                            Select a voice that matches your chosen language for best results.
                        </p>
                    </div>
                </div>
            </div>

            {/* Combined Footer Section (Usage Statistics and Made by) */}
            {/* This div will naturally flow to the bottom due to flex-col and mb-auto on the main card */}
            <div className="w-full max-w-3xl text-center mt-8 p-4 bg-white bg-opacity-90 backdrop-blur-md rounded-lg shadow-lg border border-gray-200">
                {/* Usage Statistics */}
                <p className="text-gray-700 text-md font-semibold mb-2">
                    <span className="text-gray-600">Users Ignited:</span> <span className="font-bold text-gray-800">{totalUsers !== null ? totalUsers : '...'}</span>
                    <span className="mx-4 text-gray-400">|</span>
                    <span className="text-gray-600">Motivational Boosts:</span> <span className="font-bold text-gray-800">{totalQueries !== null ? totalQueries : '...'}</span>
                </p>
                {/* Made by section */}
                <p className="mt-2 text-gray-500 text-xs">
                    Made by <a href="http://vishvarajdeshmukh.me/Portfolio/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">Vishwvaraj Deshmukh</a>
                </p>
            </div>
        </div>
    );
};

export default App;
