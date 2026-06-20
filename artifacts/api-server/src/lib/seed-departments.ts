import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const DEPARTMENT_USERS = [
  { name: "Sales Team", email: "sales@umrah.com", passwordHash: "sales123", role: "sales", canIssueTickets: false },
  { name: "Accounts Team", email: "accounts@umrah.com", passwordHash: "accounts123", role: "accounts", canIssueTickets: false },
  { name: "Operations Team", email: "operations@umrah.com", passwordHash: "operations123", role: "operations", canIssueTickets: true },
  { name: "Management", email: "management@umrah.com", passwordHash: "admin123", role: "management", canIssueTickets: true },
];

export async function seedDepartmentAccounts(): Promise<void> {
  try {
    // Migrate legacy admin role → management
    await db.update(usersTable)
      .set({ role: "management" })
      .where(eq(usersTable.role, "admin"));

    // Upsert each department user
    for (const user of DEPARTMENT_USERS) {
      const existing = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, user.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(usersTable).values({
          name: user.name,
          email: user.email,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: true,
          canIssueTickets: user.canIssueTickets,
        });
        logger.info({ email: user.email, role: user.role }, "Seeded department account");
      } else {
        // Ensure role stays correct on each startup
        await db.update(usersTable)
          .set({ role: user.role })
          .where(eq(usersTable.email, user.email));
      }
    }
  } catch (err) {
    logger.warn({ err }, "Department account seeding encountered an error — continuing startup");
  }
}
