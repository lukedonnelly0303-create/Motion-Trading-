// Usage: npm run make-admin -- someone@email.com
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-admin -- someone@email.com");
    process.exit(1);
  }
  const [user] = await db.update(users).set({ role: "ADMIN" }).where(eq(users.email, email.toLowerCase())).returning();
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`${user.email} is now an admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
