// pages/api/stats.ts
// This file provides statistics about the application usage.

import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient, Db } from 'mongodb';

const uri: string = process.env.MONGODB_URI as string;
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Reuse MongoDB client across requests for efficiency
if (process.env.NODE_ENV === 'development') {
    if (!(global as any)._mongoClientPromise) {
        client = new MongoClient(uri);
        (global as any)._mongoClientPromise = client.connect();
    }
    clientPromise = (global as any)._mongoClientPromise;
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

    } catch (error: any) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
