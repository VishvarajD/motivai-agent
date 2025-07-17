// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// Import specific types for callbacks and AuthOptions
import type { Session, Account, Profile, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { AuthOptions } from "next-auth"; // Import AuthOptions type

// For MongoDB integration, you would typically use a database adapter here.
// For simplicity, we'll just focus on the Google authentication part.
// import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
// import clientPromise from "../../../lib/mongodb" // Assuming you have a MongoDB client setup in lib/mongodb.ts

export const authOptions: AuthOptions = { // Explicitly type authOptions as AuthOptions
  // Configure one or more authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    // ...add more providers here
  ],
  // Optional: Add a database adapter if you want to store user accounts in MongoDB
  // adapter: MongoDBAdapter(clientPromise),

  // Callbacks are used to control what happens when an action is performed
  callbacks: {
    // This callback is called whenever a session is checked.
    // It's useful for adding custom data to the session object.
    async session({ session, token, user }) { // Types are inferred or from imported types
      // If you're using a database adapter, `user` object will be available.
      // If not, `token` will contain the JWT from the provider.
      if (token) {
        // Extend the session.user type if needed in a custom next-auth.d.ts file
        // For now, we'll cast to any to add custom properties, but a proper solution
        // involves module augmentation.
        (session.user as any).id = token.sub; // 'sub' is the user ID from the JWT
        (session.user as any).email = token.email;
        (session.user as any).name = token.name;
        (session.user as any).image = token.picture;
      }
      return session;
    },
    // This callback is called when a JWT is created or updated.
    async jwt({ token, user, account, profile, isNewUser }) { // Types are inferred or from imported types
      // Persist the OAuth access_token to the token right after sign-in
      if (account) {
        token.accessToken = account.access_token;
        token.id = user.id; // Store user ID from the database (if using adapter) or provider
      }
      return token;
    }
  },
  // Secret for signing the JWT and encrypting the session cookie
  secret: process.env.NEXTAUTH_SECRET,
  // Session strategy: 'jwt' for stateless sessions (recommended for most cases)
  session: {
    strategy: "jwt",
  },
  // Debug mode for more verbose logging
  debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);
