// pages/api/motivate.ts
// This file handles the server-side logic for your AI voice agent.

import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Db } from 'mongodb';

// Define a custom type for the global object to safely store the MongoClientPromise
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri: string = process.env.MONGODB_URI as string;
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// This logic ensures that the MongoDB client is reused across requests
// in development (due to hot-reloading) and in production for efficiency.
if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow POST requests to this API route
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Destructure prompt, inputLanguage, outputLanguage, userId, and userName from the request body.
    const { prompt, inputLanguage, outputLanguage, userId, userName }: { prompt?: string; inputLanguage?: string; outputLanguage?: string; userId?: string; userName?: string } = req.body;

    // Validate that a prompt is provided
    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
    }

    let db: Db;
    try {
        // Connect to MongoDB using the shared client promise
        const connectedClient = await clientPromise;
        db = connectedClient.db('motivai_db'); // Use your database name
        const interactionsCollection = db.collection('interactions'); // Collection to store user interactions

        // --- Gemini API Call ---
        const chatHistory = [];
        // Enhanced prompt for engagement and personalization using userName.
        // Ensure user's first name is used if available, otherwise default to a general greeting.
        const userFirstName = userName && userName !== 'Guest' ? userName.split(' ')[0] : '';
        const greetingPhrase = userFirstName ? `${userFirstName}, ` : '';

        // *** PROMPT REFINED TO ABSOLUTELY PREVENT META-COMMENTARY ***
        const modifiedPrompt = `You are an exceptionally dynamic, direct, and results-oriented AI career coach, specializing in empowering students for placements and internships. Your voice radiates unwavering belief in their potential, coupled with an uncompromising demand for effort and accountability. Your mission is to shatter complacency, transform self-doubt into relentless determination, and stress into strategic, immediate action. You speak directly to the student—never in the third person—like you're looking them in the eye and demanding more.

When responding to the student's input: "${prompt}", craft a message that is:
1.  **Bursting with intense, high-energy directness:** Use powerful, urgent language that cuts straight to the chase and demands attention.
2.  **Action-igniting with zero tolerance for excuses:** Subtly (or not so subtly) guide them towards a concrete, non-negotiable next step or a powerful mindset shift. Your goal is to get them moving, NOW.
3.  **Unflinchingly realistic yet profoundly empowering:** Acknowledge their challenges, stress, or self-doubt with a firm understanding, then immediately pivot to their inherent strength and the absolute necessity of taking action.
4.  **Concise and impactful, no fluff:** Deliver a powerful punch of motivation with absolute clarity and efficiency.
5.  **Personalized and highly demanding:** Always address the user by their first name if available, like "${greetingPhrase}You're capable of more, ${userFirstName}. Prove it." or "${greetingPhrase}Stop making excuses, ${userFirstName}. Get it done." If no name, use universal, challenging terms that demand a response.
6.  **Rich with gritty, challenging metaphors/analogies:** Use relatable imagery that emphasizes effort, grit, and the consequences of inaction (e.g., "This isn't a walk in the park; it's a climb. Stop looking down.", "Your effort isn't planting seeds; it's laying bricks for your damn future. Are you building or just thinking about it?").
7.  **Crucially, provide the response ONLY in ${outputLanguage === 'mr-IN' ? 'Marathi' : 'English'}.** This ensures the text displayed on the frontend matches the desired output language.
8.  **Authentic, unvarnished truth:** Every word should feel genuine and tailored to inspire genuine, sometimes uncomfortable, progress. This isn't about coddling; it's about pushing.
9.  **Varying Lengths:** For the first 2-3 responses, keep them short, sharp, and focused on immediate action. After that, you can expand if the context allows, but always prioritize getting things done.
10. **Deliver ONLY the motivational message.** Do NOT include any introductory phrases, meta-commentary, or descriptions of your role/process. For example, do NOT start with "Understood," "Here's your Marathi response," "I will now provide," or "As your coach, I will." Just give the direct motivational content.
11. **End with a powerful, non-negotiable closing statement that demands follow-through.**
`;

        chatHistory.push({ role: "user", parts: [{ text: modifiedPrompt }] });

        // Payload for the Gemini API request
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.9,
                topK: 50,
                topP: 0.98,
            }
        };

        // Retrieve Gemini API Key from environment variables
        const apiKey: string = process.env.GEMINI_API_KEY as string;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set in environment variables.');
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        console.log('Calling Gemini API with prompt:', modifiedPrompt, 'for input language:', inputLanguage, 'and output language:', outputLanguage);

        // Make the fetch call to the Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Handle non-OK HTTP responses from Gemini API
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error response:', errorText);
            throw new Error(`Gemini API returned an error: ${geminiResponse.status} - ${errorText}`);
        }

        // Parse the JSON response from Gemini
        const result = await geminiResponse.json();
        let aiMotivationalMessage: string = "I'm sorry, I couldn't generate a motivational message right now.";

        // Extract the generated text from the Gemini response structure
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            aiMotivationalMessage = result.candidates[0].content.parts[0].text;
        } else {
            console.warn('Unexpected Gemini response structure:', result);
        }

        // --- Post-processing the AI's response (optional but good for consistency) ---
        // Ensure the message starts with a capital letter (only if English, as capitalization rules differ)
        if (aiMotivationalMessage.length > 0 && outputLanguage === 'en-US') {
            aiMotivationalMessage = aiMotivationalMessage.charAt(0).toUpperCase() + aiMotivationalMessage.slice(1);
        }
        // Remove any leading/trailing whitespace
        aiMotivationalMessage = aiMotivationalMessage.trim();


        // --- MongoDB Interaction (Example: Storing interaction) ---
        // Store the user's prompt, AI's response, and language details in MongoDB
        await interactionsCollection.insertOne({
            userId: userId, // Store the user's ID
            userName: userName, // Store the user's name
            userPrompt: prompt,
            aiResponse: aiMotivationalMessage, // Store the post-processed response
            inputLanguage: inputLanguage, // Store the language the user spoke
            outputLanguage: outputLanguage, // Store the language the AI responded in
            timestamp: new Date(),
        });
        console.log('Interaction saved to MongoDB');

        // Send the AI's motivational message back to the frontend
        res.status(200).json({ message: aiMotivationalMessage });

    } catch (error: unknown) { // Use unknown for caught errors
        // Catch any errors during the process and send a 500 Internal Server Error response
        console.error('Error in API route:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            errorMessage = String((error as { message: unknown }).message);
        }
        res.status(500).json({ message: 'Internal Server Error', error: errorMessage });
    }
}
