import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth.js";

async function main() {
  const prisma = getPrisma();

  // 1. Seed Categories (idempotent upsert)
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

  // 2. Seed Related Systems (idempotent upsert)
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

  // Hash password for seeding
  const defaultHash = hashPassword("password123");

  // 3. Seed Users (idempotent upsert by email)
  // Requesters
  const requestersData = [
    { name: "Jennifer Anderson", email: "jennifer.a@example.com", role: "Requester", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "Michael Brown", email: "michael.b@example.com", role: "Requester", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "Sarah Johnson", email: "sarah.j@example.com", role: "Requester", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "David Lee", email: "david.l@example.com", role: "Requester", isActive: true, passwordHash: defaultHash, mustChangePassword: true },
    { name: "Inactive Test User", email: "inactive.user@example.com", role: "Requester", isActive: false, passwordHash: defaultHash, mustChangePassword: true },
  ];

  const dbRequesters: any[] = [];
  for (const r of requestersData) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: { name: r.name, isActive: r.isActive, role: r.role, passwordHash: r.passwordHash, mustChangePassword: r.mustChangePassword },
      create: r,
    });
    dbRequesters.push(user);
  }
  console.log("Seeded requesters.");

  // IT Staff
  const itStaffData = [
    { name: "Sarah IT Support", email: "sarah.it@example.com", role: "ITStaff", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "John Support", email: "john.s@example.com", role: "ITStaff", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "Alice Staff", email: "alice.s@example.com", role: "ITStaff", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
    { name: "Inactive IT Staff", email: "inactive.it@example.com", role: "ITStaff", isActive: false, passwordHash: defaultHash, mustChangePassword: true },
  ];

  const dbITStaff: any[] = [];
  for (const s of itStaffData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, isActive: s.isActive, role: s.role, passwordHash: s.passwordHash, mustChangePassword: s.mustChangePassword },
      create: s,
    });
    dbITStaff.push(user);
  }
  console.log("Seeded IT staff.");

  // Administrators
  const adminsData = [
    { name: "John Smith", email: "john.smith@example.com", role: "Administrator", isActive: true, passwordHash: defaultHash, mustChangePassword: false },
  ];

  const dbAdmins: any[] = [];
  for (const a of adminsData) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, isActive: a.isActive, role: a.role, passwordHash: a.passwordHash, mustChangePassword: a.mustChangePassword },
      create: a,
    });
    dbAdmins.push(user);
  }
  console.log("Seeded administrators.");

  // 4. Seed realistic Tickets covering all statuses, priorities, assigned & unassigned, 0/1/multiple Actions Taken
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
    const ticket = await prisma.ticket.upsert({
      where: { ticketNo: tData.ticketNo },
      update: {
        requesterId: tData.requesterId,
        ownerId: tData.ownerId,
        categoryId: tData.categoryId,
        relatedSystem: tData.relatedSystem,
        requestedPriority: tData.requestedPriority,
        itPriority: tData.itPriority,
        currentStatus: tData.currentStatus,
        requesterResolvedIndication: tData.requesterResolvedIndication,
        summary: tData.summary,
        description: tData.description,
      },
      create: tData,
    });
    dbTickets[tData.ticketNo] = ticket;
  }

  const t1 = dbTickets[`TKT-${currentYear}-000001`];
  const t3 = dbTickets[`TKT-${currentYear}-000003`];
  const t4 = dbTickets[`TKT-${currentYear}-000004`];
  const t5 = dbTickets[`TKT-${currentYear}-000005`];
  const t6 = dbTickets[`TKT-${currentYear}-000006`];

  // Clean and re-seed child items only for our deterministic seed tickets so running seed repeatedly is 100% idempotent
  const seedTicketIds = Object.values(dbTickets).map((t: any) => t.id);
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: seedTicketIds } } });
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: seedTicketIds } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: seedTicketIds } } });

  // Public Comments
  await prisma.publicComment.createMany({
    data: [
      { ticketId: t1.id, authorId: dbRequesters[0].id, content: "I noticed this since the last Windows update last week." },
      { ticketId: t1.id, authorId: dbITStaff[0].id, content: "Thanks for reporting. Could you please run the battery diagnostic tool and share the output?" },
      { ticketId: t3.id, authorId: dbITStaff[1].id, content: "Hi Sarah, are you seeing any errors in your browser dev console? Please send a screenshot." },
      { ticketId: t4.id, authorId: dbITStaff[2].id, content: "We updated the access point configuration on that floor. Please test and confirm." },
      { ticketId: t4.id, authorId: dbRequesters[3].id, content: "It seems stable now! I've been connected for an hour without any dropouts." },
    ],
  });

  // Internal Notes
  await prisma.internalNote.create({
    data: {
      ticketId: t1.id,
      authorId: dbITStaff[0].id,
      content: "Checked similar cases; likely needs a hardware replacement for battery model L19M4P72.",
    },
  });

  // Seed Action Taken records:
  // - Ticket 2 & 8 have 0 Actions Taken
  // - Ticket 3 & 4 have 1 Action Taken
  // - Ticket 1 & 5 have multiple Actions Taken by different IT Staff members (demonstrating BR-02)
  await prisma.actionTaken.createMany({
    data: [
      {
        ticketId: t1.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 5),
        actionDescription: "Ran Lenovo Vantage battery health check and calibrated power management firmware.",
        result: "Wear level reported at 68% capacity; replacement battery required.",
        performedById: dbITStaff[0].id, // Sarah IT (Owner)
        followUpRequired: true,
        followUpNote: "Order replacement battery pack L19M4P72 and schedule swap with user.",
        attachmentNotes: "See battery-report.pdf attached on ticket.",
      },
      {
        ticketId: t1.id,
        actionDateTime: new Date(Date.now() - 3600 * 1000 * 2),
        actionDescription: "Verified spare battery stock in IT cabinet B and reserved unit #SN-88412.",
        result: "Replacement battery ready for installation.",
        performedById: dbITStaff[1].id, // John Support (Different IT Staff assisting Ticket Owner)
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

  console.log("Seeded tickets, comments, notes, and actions taken idempotently.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
