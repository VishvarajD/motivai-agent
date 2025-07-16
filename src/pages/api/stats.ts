// pages/api/stats.ts
// This file provides statistics about the application usage.

import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Db } from 'mongodb';

// Define a custom type for the global object to safely store the MongoClientPromise
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri: string = process.env.MONGODB_URI as string;
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Reuse MongoDB client across requests for efficiency
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
    // Only allow GET requests for statistics
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    let db: Db;
    try {
        const connectedClient = await clientPromise;
        db = connectedClient.db('motivai_db'); // Use your database name
        const interactionsCollection = db.collection('interactions');

        // Get total number of queries
        const totalQueries = await interactionsCollection.countDocuments();

        // Get total number of unique users
        // Use aggregation to find distinct user IDs
        const distinctUsers = await interactionsCollection.distinct('userId');
        const totalUsers = distinctUsers.length;

        // Send the statistics back
        res.status(200).json({ totalUsers, totalQueries });

    } catch (error: unknown) { // Changed 'any' to 'unknown'
        console.error('Error fetching statistics:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            errorMessage = String((error as { message: unknown }).message);
        }
        res.status(500).json({ message: 'Internal Server Error', error: errorMessage });
    }
}
