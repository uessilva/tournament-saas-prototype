import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import { sendMagicLinkEmail } from "@/lib/auth/email";
import { db } from "@/lib/db/client";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";
import { isDemoMode } from "@/lib/demo-mode";

const demoProvider = Credentials({
  id: "demo",
  name: "Demo account",
  credentials: {
    email: { label: "Seeded account email", type: "email" },
  },
  async authorize(credentials) {
    if (!isDemoMode()) {
      return null;
    }

    const email = String(credentials?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email.endsWith("@example.com")) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

const providers: NextAuthConfig["providers"] = [
  Nodemailer({
    server: {
      host: process.env.SMTP_HOST ?? "127.0.0.1",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      ignoreTLS: true,
    },
    from: process.env.EMAIL_FROM ?? "Summer Cup <summercup@example.com>",
    async sendVerificationRequest({ identifier, url }) {
      await sendMagicLinkEmail(identifier, url);
    },
  }),
];

if (isDemoMode()) {
  providers.push(demoProvider);
}

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  providers,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
    error: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
      }
      return session;
    },
  },
  trustHost: true,
};
