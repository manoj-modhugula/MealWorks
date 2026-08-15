import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { upsertOAuthUser } from "./identity-account";

const authSecret =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "dev-only-secret-not-for-prod");

if (!authSecret && process.env.NODE_ENV === "production") {
  console.error("[auth] AUTH_SECRET is required in production");
}

function oauthProviders() {
  const list = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }
  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    list.push(
      Apple({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
      })
    );
  }
  return list;
}

export function oauthEnabled() {
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    apple: Boolean(process.env.APPLE_ID && process.env.APPLE_SECRET),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const { rateLimit } = await import("./rate-limit");
        const rl = rateLimit(`login:${email}`, {
          limit: 12,
          windowMs: 15 * 60_000,
        });
        if (!rl.ok) return null;

        const db = getDb();
        const user = db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .get();
        if (!user?.passwordHash || !user.emailVerifiedAt || user.blockedAt)
          return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: Boolean(user.isAdmin),
        };
      },
    }),
    ...oauthProviders(),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      const email = String(user.email || "")
        .trim()
        .toLowerCase();
      const googleVerified =
        account.provider !== "google" ||
        Boolean(
          (profile as { email_verified?: boolean } | undefined)?.email_verified
        );
      if (account.provider === "google" && !googleVerified) return false;
      const row = upsertOAuthUser({
        email,
        name: user.name || email.split("@")[0] || "Member",
        provider: account.provider,
        providerAccountId: String(account.providerAccountId || ""),
        emailVerified:
          account.provider === "apple" ||
          (account.provider === "google" && googleVerified),
      });
      return Boolean(row);
    },
    async jwt({ token, user, account }) {
      if (account && account.provider !== "credentials") {
        const linked = getDb()
          .select()
          .from(schema.oauthAccounts)
          .where(
            and(
              eq(schema.oauthAccounts.provider, account.provider),
              eq(
                schema.oauthAccounts.providerAccountId,
                String(account.providerAccountId || "")
              )
            )
          )
          .get();
        const byProvider = linked
          ? getDb()
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, linked.userId))
              .get()
          : null;
        const byEmail = user?.email
          ? getDb()
              .select()
              .from(schema.users)
              .where(eq(schema.users.email, String(user.email).toLowerCase()))
              .get()
          : null;
        const row = byProvider || byEmail;
        if (row) {
          token.id = row.id;
          token.isAdmin = Boolean(row.isAdmin);
        }
      } else if (user) {
        token.id = user.id;
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
      }
      const id = String(token.id || "");
      if (id) {
        const row = getDb()
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, id))
          .get();
        if (!row || row.blockedAt) {
          // Only kill a session we already established.
          if (token.email || row?.blockedAt) return null;
          return token;
        }
        token.isAdmin = Boolean(row.isAdmin);
        token.email = row.email;
        token.name = row.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ? String(token.id) : "";
        session.user.isAdmin = Boolean(token.isAdmin);
        if (token.email) session.user.email = String(token.email);
        if (token.name) session.user.name = String(token.name);
      }
      return session;
    },
  },
});
