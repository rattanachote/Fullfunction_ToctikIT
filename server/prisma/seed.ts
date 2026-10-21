import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth.js";

async function main() {
  const prisma = getPrisma();

  // 1. Seed Categories (non-destructive — always ensure reference data exists)
  const categories = ["Account and Access", "Hardware", "Software", "Network"];
  const dbCategories: any[] = [];
  for (const name of categories) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    dbCategories.push(cat);
  }
  console.log("Seeded categories.");

  // 2. Seed Related Systems (non-destructive — always ensure reference data exists)
  const systems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];
  for (const name of systems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }
  console.log("Seeded related systems.");

  // Non-destructive guard: Seed users/tickets only when User table is empty
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    console.log(`Database already contains ${existingUserCount} user(s). Skipping user/ticket seed to preserve existing data.`);
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const shouldSeedDemo = isProduction
    ? process.env.SEED_DEMO_DATA === "true"
    : process.env.SEED_DEMO_DATA !== "false";

  const adminPlainPassword =
    process.env.ADMIN_PASSWORD ||
    (isProduction ? "" : "password123");

  if (!adminPlainPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is required when seeding in production.");
  }

  const demoPlainPassword =
    process.env.DEMO_USER_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    (isProduction ? "" : "password123");

  if (shouldSeedDemo && !demoPlainPassword) {
    throw new Error("DEMO_USER_PASSWORD or ADMIN_PASSWORD environment variable is required when SEED_DEMO_DATA=true in production.");
  }

  const adminHash = hashPassword(adminPlainPassword);

  // 3. Seed Administrator
  const adminsData = [
    { name: "John Smith", email: "john.smith@example.com", role: "Administrator", isActive: true, passwordHash: adminHash, mustChangePassword: true },
  ];

  const dbAdmins: any[] = [];
  for (const a of adminsData) {
    const user = await prisma.user.create({ data: a });
    dbAdmins.push(user);
  }
  console.log("Seeded administrators.");

  if (!shouldSeedDemo) {
    console.log("Production mode (SEED_DEMO_DATA is not 'true'): skipped demo users and sample tickets.");
    return;
  }

  const demoHash = hashPassword(demoPlainPassword);
  const forceDemoChangePassword = isProduction ? true : false;

  // 4. Seed Demo Users & Sample Tickets (only when shouldSeedDemo is true)
  const requestersData = [
    { name: "Jennifer Anderson", email: "jennifer.a@example.com", role: "Requester", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "Michael Brown", email: "michael.b@example.com", role: "Requester", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "Sarah Johnson", email: "sarah.j@example.com", role: "Requester", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "David Lee", email: "david.l@example.com", role: "Requester", isActive: true, passwordHash: demoHash, mustChangePassword: true },
    { name: "Inactive Test User", email: "inactive.user@example.com", role: "Requester", isActive: false, passwordHash: demoHash, mustChangePassword: true },
  ];

  const dbRequesters: any[] = [];
  for (const r of requestersData) {
    const user = await prisma.user.create({ data: r });
    dbRequesters.push(user);
  }
  console.log("Seeded requesters.");

  const itStaffData = [
    { name: "Sarah IT Support", email: "sarah.it@example.com", role: "ITStaff", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "John Support", email: "john.s@example.com", role: "ITStaff", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "Alice Staff", email: "alice.s@example.com", role: "ITStaff", isActive: true, passwordHash: demoHash, mustChangePassword: forceDemoChangePassword },
    { name: "Inactive IT Staff", email: "inactive.it@example.com", role: "ITStaff", isActive: false, passwordHash: demoHash, mustChangePassword: true },
  ];

  const dbITStaff: any[] = [];
  for (const s of itStaffData) {
    const user = await prisma.user.create({ data: s });
    dbITStaff.push(user);
  }
  console.log("Seeded IT staff.");

  const categoriesMap = {
    "Account and Access": dbCategories.find((c) => c.name === "Account and Access").id,
    "Hardware": dbCategories.find((c) => c.name === "Hardware").id,
    "Software": dbCategories.find((c) => c.name === "Software").id,
    "Network": dbCategories.find((c) => c.name === "Network").id,
  };

  const currentYear = new Date().getFullYear();

  const seedTickets = [
    {
      ticketNo: `TKT-${currentYear}-000001`,
      requesterId: dbRequesters[0].id,
      ownerId: dbITStaff[0].id,
      categoryId: categoriesMap["Hardware"],
      relatedSystem: "Corporate Laptop",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "In Progress",
      requesterResolvedIndication: false,
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual, lasting only 30 minutes after a full charge.",
    },
    {
      ticketNo: `TKT-${currentYear}-000002`,
      requesterId: dbRequesters[1].id,
      ownerId: null,
      categoryId: categoriesMap["Account and Access"],
      relatedSystem: "VPN",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "New",
      requesterResolvedIndication: false,
      summary: "VPN access request for remote work",
      description: "Hi Support team, I need remote access to the staging server. Please enable VPN access for my account.",
    },
    {
      ticketNo: `TKT-${currentYear}-000003`,
      requesterId: dbRequesters[2].id,
      ownerId: dbITStaff[1].id,
      categoryId: categoriesMap["Software"],
      relatedSystem: "LEB2 App",
      requestedPriority: "MEDIUM",
      itPriority: "LOW",
      currentStatus: "Waiting for Requester",
      requesterResolvedIndication: false,
      summary: "Cannot access assignment submissions page",
      description: "When I click on the submissions tab, I get a blank screen with a loading spinner that never disappears.",
    },
    {
      ticketNo: `TKT-${currentYear}-000004`,
      requesterId: dbRequesters[3].id,
      ownerId: dbITStaff[2].id,
      categoryId: categoriesMap["Network"],
      relatedSystem: "Campus Wi-Fi",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "Open",
      requesterResolvedIndication: true,
      summary: "Wi-Fi connection drops in Building B",
      description: "I lose Wi-Fi connection every 5 minutes while working in the library on the 3rd floor of Building B.",
    },
    {
      ticketNo: `TKT-${currentYear}-000005`,
      requesterId: dbRequesters[0].id,
      ownerId: dbITStaff[0].id,
      categoryId: categoriesMap["Hardware"],
      relatedSystem: "Printer",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: "Resolved",
      requesterResolvedIndication: true,
      summary: "Department printer paper jam on tray 2",
      description: "The 4th floor network printer shows error code E-04 and refuses to feed A4 sheets from tray 2.",
    },
    {
      ticketNo: `TKT-${currentYear}-000006`,
      requesterId: dbRequesters[1].id,
      ownerId: dbITStaff[1].id,
      categoryId: categoriesMap["Software"],
      relatedSystem: "Grade Submission App",
      requestedPriority: "HIGH",
      itPriority: "MEDIUM",
      currentStatus: "Closed",
      requesterResolvedIndication: true,
      summary: "Export grade CSV encoding issue with Thai characters",
      description: "Exported CSV files display garbled text when opened in Excel unless UTF-8 BOM is added.",
    },
    {
      ticketNo: `TKT-${currentYear}-000007`,
      requesterId: dbRequesters[2].id,
      ownerId: dbITStaff[2].id,
      categoryId: categoriesMap["Account and Access"],
      relatedSystem: "Email",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "Reopened",
      requesterResolvedIndication: false,
      summary: "Two-factor authentication SMS code delayed",
      description: "Verification codes arrive 15 minutes late after the session has already expired.",
    },
    {
      ticketNo: `TKT-${currentYear}-000008`,
      requesterId: dbRequesters[3].id,
      ownerId: null,
      categoryId: categoriesMap["Hardware"],
      relatedSystem: "Corporate Laptop",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: "Cancelled",
      requesterResolvedIndication: false,
      summary: "Request extra USB-C monitor adapter",
      description: "Found the spare adapter in the meeting room drawer; cancelling this request.",
    },
  ];

  const dbTickets: Record<string, any> = {};
  for (const tData of seedTickets) {
    const ticket = await prisma.ticket.create({ data: tData });
    dbTickets[tData.ticketNo] = ticket;
  }

  const t1 = dbTickets[`TKT-${currentYear}-000001`];
  const t3 = dbTickets[`TKT-${currentYear}-000003`];
  const t4 = dbTickets[`TKT-${currentYear}-000004`];
  const t5 = dbTickets[`TKT-${currentYear}-000005`];
  const t6 = dbTickets[`TKT-${currentYear}-000006`];

  await prisma.publicComment.createMany({
    data: [
      { ticketId: t1.id, authorId: dbRequesters[0].id, content: "I noticed this since the last Windows update last week." },
      { ticketId: t1.id, authorId: dbITStaff[0].id, content: "Thanks for reporting. Could you please run the battery diagnostic tool and share the output?" },
      { ticketId: t3.id, authorId: dbITStaff[1].id, content: "Hi Sarah, are you seeing any errors in your browser dev console? Please send a screenshot." },
      { ticketId: t4.id, authorId: dbITStaff[2].id, content: "We updated the access point configuration on that floor. Please test and confirm." },
      { ticketId: t4.id, authorId: dbRequesters[3].id, content: "It seems stable now! I've been connected for an hour without any dropouts." },
    ],
  });

  await prisma.internalNote.create({
    data: {
      ticketId: t1.id,
      authorId: dbITStaff[0].id,
      content: "Checked similar cases; likely needs a hardware replacement for battery model L19M4P72.",
    },
  });

  await prisma.actionTaken.createMany({
    data: [
      {
        ticketId: t1.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 5),
        actionDescription: "Ran Lenovo Vantage battery health check and calibrated power management firmware.",
        result: "Wear level reported at 68% capacity; replacement battery required.",
        performedById: dbITStaff[0].id,
        followUpRequired: true,
        followUpNote: "Order replacement battery pack L19M4P72 and schedule swap with user.",
        attachmentNotes: "See battery-report.pdf attached on ticket.",
      },
      {
        ticketId: t1.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 2),
        actionDescription: "Verified spare battery stock in IT cabinet B and reserved unit #SN-88412.",
        result: "Replacement battery ready for installation.",
        performedById: dbITStaff[1].id,
        followUpRequired: false,
        attachmentNotes: null,
      },
      {
        ticketId: t3.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 4),
        actionDescription: "Cleared cached permissions and restarted Redis session store for user account.",
        result: "Investigating user session timeout.",
        performedById: dbITStaff[1].id,
        followUpRequired: true,
        followUpNote: "Wait for user confirmation after browser cache clear.",
        attachmentNotes: "Check console error log screenshot if issue persists.",
      },
      {
        ticketId: t4.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 3),
        actionDescription: "Rebooted AP-3B and updated radio channel bandwidth to 80MHz.",
        result: "Signal interference decreased by 15dBm.",
        performedById: dbITStaff[2].id,
        followUpRequired: false,
        attachmentNotes: null,
      },
      {
        ticketId: t5.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 6),
        actionDescription: "Disassembled tray 2 pickup roller and removed torn A4 paper fragment.",
        result: "Feed mechanism cleared.",
        performedById: dbITStaff[0].id,
        followUpRequired: false,
        attachmentNotes: "roller-inspection.jpg",
      },
      {
        ticketId: t5.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 1),
        actionDescription: "Printed 20-page duplex test batch and cleaned optical paper sensor.",
        result: "Printer operating normally without jams.",
        performedById: dbAdmins[0].id,
        followUpRequired: false,
        attachmentNotes: null,
      },
      {
        ticketId: t6.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 12),
        actionDescription: "Patched CSV export streamer to prepend UTF-8 BOM header (0xEF,0xBB,0xBF).",
        result: "Verified Thai characters render cleanly in Microsoft Excel 365.",
        performedById: dbITStaff[1].id,
        followUpRequired: false,
        attachmentNotes: null,
      },
    ],
  });

  console.log("Seeded initial tickets, comments, notes, and actions taken.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
