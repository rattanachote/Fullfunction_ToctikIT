import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
} from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(cors());
app.use(express.json());

// Setup uploads directory
const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, JPEG, PNG, WEBP, and PDF are allowed."));
    }
  },
});

// Authentication middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    name: string;
    role: string;
    mustChangePassword: boolean;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  let userId: number | null = null;

  const authHeader = req.headers["authorization"];
  const xRequesterId = req.headers["x-requester-id"];

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const session = getSession(token);
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    userId = session.userId;
  } else if (xRequesterId) {
    const parsedId = parseInt(xRequesterId as string, 10);
    if (!isNaN(parsedId)) {
      userId = parsedId;
    }
  }

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "User is inactive or not found" });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };

    // BR-02: A user marked as requiring password change cannot enter the normal application
    if (
      user.mustChangePassword &&
      req.path !== "/api/auth/change-password" &&
      req.path !== "/api/auth/logout" &&
      req.path !== "/api/auth/me"
    ) {
      res.status(403).json({
        error: "Password change required",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication check failed" });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied: insufficient permissions" });
      return;
    }
    next();
  };
};

// 1. Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// 2. Auth Endpoints
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is inactive. Please contact an administrator." });
      return;
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = createSession(user.id, user.email, user.name, user.role);
    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    destroySession(token);
  }
  res.status(200).json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ user: req.user });
});

app.post("/api/auth/change-password", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new passwords are required" });
    return;
  }

  // Password rules validation
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long" });
    return;
  }
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    res.status(400).json({
      error: "Password must include upper and lower case letters, a number, and a special character",
    });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      res.status(400).json({ error: "Invalid current password" });
      return;
    }

    const newHash = hashPassword(newPassword);
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

// 3. User Reference Endpoints (Requester dropdown) - Kept for fallback/compat
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().user.findMany({
      where: { role: "Requester", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, isActive: true },
    });
    res.status(200).json(requesters);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch requesters" });
  }
});

// 4. Categories & Systems Endpoints
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json(systems);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch related systems" });
  }
});

app.post("/api/tickets", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, relatedSystem, requestedPriority, summary, description } = req.body;

    if (!categoryId || !relatedSystem || !requestedPriority || !summary || !description) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    if (summary.trim().length === 0 || description.trim().length === 0) {
      res.status(400).json({ error: "Empty fields are not allowed" });
      return;
    }

    if (summary.length > 100) {
      res.status(400).json({ error: "Summary cannot exceed 100 characters" });
      return;
    }

    if (description.length > 2000) {
      res.status(400).json({ error: "Description cannot exceed 2000 characters" });
      return;
    }

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];
    if (!allowedPriorities.includes(requestedPriority)) {
      res.status(400).json({ error: "Invalid priority level" });
      return;
    }

    // Generate unique Ticket Number (TKT-YYYY-XXXXXX)
    const currentYear = new Date().getFullYear();
    const prefix = `TKT-${currentYear}-`;
    const latestTicket = await getPrisma().ticket.findFirst({
      where: {
        ticketNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNo: "desc",
      },
    });
    const lastSeq = latestTicket ? parseInt(latestTicket.ticketNo.slice(prefix.length), 10) || 0 : 0;
    const seq = String(lastSeq + 1).padStart(6, "0");
    const ticketNo = `${prefix}${seq}`;

    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNo,
        requesterId: req.user!.userId,
        categoryId: parseInt(categoryId, 10),
        relatedSystem,
        requestedPriority,
        itPriority: requestedPriority, // Initially copies requestedPriority
        summary,
        description,
        currentStatus: "New",
      },
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// Retrieve tickets list (RBAC: Requesters get owned only; IT Staff/Admin get all)
app.get("/api/tickets", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const search = req.query.search as string;
    const category = req.query.category as string;
    const priority = req.query.priority as string;
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const sort = (req.query.sort as string) || "createdAt_desc";

    const where: any = {};

    // Filter by ownership if role is Requester
    if (user.role === "Requester") {
      where.requesterId = user.userId;
    }

    if (search) {
      where.OR = [
        { ticketNo: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && category !== "All Categories") {
      const catIdNum = parseInt(category, 10);
      if (!isNaN(catIdNum)) {
        where.categoryId = catIdNum;
      } else {
        where.category = { name: category };
      }
    }

    if (req.query.categoryId) {
      const catIdNum = parseInt(req.query.categoryId as string, 10);
      if (!isNaN(catIdNum)) {
        where.categoryId = catIdNum;
      }
    }

    if (priority && priority !== "All Priorities") {
      if (user.role === "Requester") {
        where.requestedPriority = priority;
      } else {
        where.OR = [
          { requestedPriority: priority },
          { itPriority: priority }
        ];
      }
    }

    if (status && status !== "All Statuses") {
      where.currentStatus = status;
    }

    if (req.query.owner === "unassigned") {
      where.ownerId = null;
    } else if (req.query.owner === "me") {
      where.ownerId = user.userId;
    }

    const effectiveSort = (req.query.sortBy as string) || sort;
    let orderBy: any = { createdAt: "desc" };
    if (effectiveSort === "createdAt_asc") orderBy = { createdAt: "asc" };
    if (effectiveSort === "updatedAt_desc") orderBy = { updatedAt: "desc" };
    if (effectiveSort === "priority_desc") {
      orderBy = user.role === "Requester" ? { requestedPriority: "desc" } : { itPriority: "desc" };
    }
    if (effectiveSort === "priority_asc") {
      orderBy = user.role === "Requester" ? { requestedPriority: "asc" } : { itPriority: "asc" };
    }

    const totalCount = await getPrisma().ticket.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    const tickets = await getPrisma().ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json({
      tickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get ticket detail (RBAC: Requesters must own; IT Staff/Admin can view any)
app.get("/api/tickets/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = req.user!;
    const ticket = await getPrisma().ticket.findUnique({
      where: { id },
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        attachments: true,
        actionsTaken: {
          include: { performedBy: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { actionDateTime: "asc" },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (user.role === "Requester" && ticket.requesterId !== user.userId) {
      if (req.headers["authorization"]) {
        res.status(404).json({ error: "Ticket not found" });
      } else {
        res.status(403).json({ error: "Access denied" });
      }
      return;
    }

    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ticket details" });
  }
});

// IT Ticket Assignment (IT Staff & Admin only)
app.put("/api/tickets/:id/owner", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { ownerId, expectedUpdatedAt } = req.body;

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(ticket.updatedAt).getTime()) {
      res.status(409).json({ error: "Conflict: This ticket was modified by another user. Please refresh and try again." });
      return;
    }

    let ownerData = null;
    if (ownerId !== null && ownerId !== undefined && ownerId !== "") {
      const owner = await getPrisma().user.findUnique({ where: { id: parseInt(ownerId, 10) } });
      if (!owner || !owner.isActive || (owner.role !== "ITStaff" && owner.role !== "Administrator")) {
        res.status(400).json({ error: "Invalid active owner selected" });
        return;
      }
      ownerData = owner.id;
    }

    const updated = await getPrisma().ticket.update({
      where: { id },
      data: { ownerId: ownerData },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update ticket owner" });
  }
});

// Ticket status and IT Priority update (IT Staff & Admin only)
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "New": ["Open", "In Progress", "Cancelled"],
  "Open": ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Open", "Resolved", "Cancelled"],
  "Resolved": ["Closed", "Reopened"],
  "Reopened": ["Open", "In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "Closed": ["Reopened"],
  "Cancelled": ["Reopened"],
};

app.put("/api/tickets/:id/status", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { currentStatus, itPriority, expectedUpdatedAt, requireActionForResolve } = req.body;

  if (!currentStatus && !itPriority) {
    res.status(400).json({ error: "At least one of currentStatus or itPriority must be provided" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id },
      include: { _count: { select: { actionsTaken: true } } },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(ticket.updatedAt).getTime()) {
      res.status(409).json({ error: "Conflict: This ticket was modified by another user. Please refresh and try again." });
      return;
    }

    const updateData: any = {};

    if (currentStatus) {
      // Validate transition
      const from = ticket.currentStatus;
      const to = currentStatus;
      const allowed = ALLOWED_TRANSITIONS[from];
      if (from !== to && (!allowed || !allowed.includes(to))) {
        res.status(400).json({ error: `Invalid status transition from ${from} to ${to}` });
        return;
      }

      if (to === "Resolved" && requireActionForResolve && ticket._count.actionsTaken === 0) {
        res.status(400).json({ error: "Cannot resolve ticket without at least one recorded Action Taken" });
        return;
      }

      updateData.currentStatus = to;
    }

    if (itPriority) {
      const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];
      if (!allowedPriorities.includes(itPriority)) {
        res.status(400).json({ error: "Invalid IT priority level" });
        return;
      }
      updateData.itPriority = itPriority;
    }

    const updated = await getPrisma().ticket.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update ticket status" });
  }
});

// Indicate Resolved (Requester only)
app.post("/api/tickets/:id/indicate-resolved", authenticate, requireRole(["Requester"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (ticket.requesterId !== req.user!.userId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Toggle resolved indication
    const nextVal = !ticket.requesterResolvedIndication;

    const updated = await getPrisma().ticket.update({
      where: { id },
      data: { requesterResolvedIndication: nextVal },
    });

    // Create system comment
    const noteText = nextVal
      ? "marked this ticket as appearing resolved."
      : "removed the indication that this ticket appears resolved.";
    await getPrisma().publicComment.create({
      data: {
        ticketId: id,
        authorId: req.user!.userId,
        content: `[System Notification] Requester ${noteText}`,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle resolved indication" });
  }
});

// 6. Comments & Internal Notes
app.get("/api/tickets/:id/comments", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (user.role === "Requester" && ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.post("/api/tickets/:id/comments", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  const user = req.user!;

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "Comment content cannot be empty" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (user.role === "Requester" && ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const comment = await getPrisma().publicComment.create({
      data: {
        ticketId: id,
        authorId: user.userId,
        content: content.trim(),
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// Internal notes (IT Staff & Admin only)
app.get("/api/tickets/:id/notes", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch internal notes" });
  }
});

app.post("/api/tickets/:id/notes", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  const user = req.user!;

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "Note content cannot be empty" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const note = await getPrisma().internalNote.create({
      data: {
        ticketId: id,
        authorId: user.userId,
        content: content.trim(),
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: "Failed to create internal note" });
  }
});

// 7. Actions Taken Endpoints
app.get("/api/tickets/:id/actions-taken", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (user.role === "Requester" && ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const actions = await getPrisma().actionTaken.findMany({
      where: { ticketId: id },
      orderBy: [{ actionDateTime: "asc" }, { id: "asc" }],
      include: { performedBy: { select: { id: true, name: true, email: true, role: true } } },
    });

    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actions taken" });
  }
});

app.post("/api/tickets/:id/actions-taken", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { actionDateTime, actionDescription, result, followUpRequired, followUpNote, attachmentNotes, assigneeId } = req.body;
  const user = req.user!;

  if (!actionDescription || actionDescription.trim().length === 0) {
    res.status(400).json({ error: "Action description is required" });
    return;
  }

  if (followUpRequired && (!followUpNote || followUpNote.trim().length === 0)) {
    res.status(400).json({ error: "Follow-up note is required when follow-up is required" });
    return;
  }

  let parsedDate = new Date();
  if (actionDateTime !== undefined && actionDateTime !== null && actionDateTime !== "") {
    parsedDate = new Date(actionDateTime);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: "Invalid actionDateTime format" });
      return;
    }
  }

  try {
    if (assigneeId !== undefined && assigneeId !== null) {
      const targetUser = await getPrisma().user.findUnique({ where: { id: parseInt(assigneeId, 10) } });
      if (!targetUser || !targetUser.isActive || (targetUser.role !== "ITStaff" && targetUser.role !== "Administrator")) {
        res.status(400).json({ error: "Cannot assign action to an inactive or non-IT user" });
        return;
      }
    }

    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const action = await getPrisma().actionTaken.create({
      data: {
        ticketId: id,
        actionDateTime: parsedDate,
        actionDescription: actionDescription.trim(),
        result: result ? result.trim() : null,
        performedById: user.userId,
        followUpRequired: Boolean(followUpRequired),
        followUpNote: followUpRequired && followUpNote ? followUpNote.trim() : null,
        attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null,
      },
      include: { performedBy: { select: { id: true, name: true, email: true, role: true } } },
    });

    await getPrisma().ticket.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(action);
  } catch (error) {
    res.status(500).json({ error: "Failed to create action taken" });
  }
});

app.put("/api/actions-taken/:actionId", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const actionId = parseInt(req.params.actionId, 10);
  const { actionDateTime, actionDescription, result, followUpRequired, followUpNote, attachmentNotes, expectedUpdatedAt } = req.body;

  if (actionDescription !== undefined && actionDescription.trim().length === 0) {
    res.status(400).json({ error: "Action description cannot be empty" });
    return;
  }

  let parsedDate: Date | undefined = undefined;
  if (actionDateTime !== undefined && actionDateTime !== null && actionDateTime !== "") {
    parsedDate = new Date(actionDateTime);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: "Invalid actionDateTime format" });
      return;
    }
  }

  try {
    const existing = await getPrisma().actionTaken.findUnique({ where: { id: actionId } });
    if (!existing) {
      res.status(404).json({ error: "Action taken not found" });
      return;
    }

    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(existing.updatedAt).getTime()) {
      res.status(409).json({ error: "Conflict: This action record was updated by another user. Please refresh." });
      return;
    }

    const nextFollowUp = followUpRequired !== undefined ? Boolean(followUpRequired) : existing.followUpRequired;
    const nextNote = followUpNote !== undefined ? (followUpNote ? followUpNote.trim() : null) : existing.followUpNote;

    if (nextFollowUp && (!nextNote || nextNote.length === 0)) {
      res.status(400).json({ error: "Follow-up note is required when follow-up is required" });
      return;
    }

    const updated = await getPrisma().actionTaken.update({
      where: { id: actionId },
      data: {
        ...(parsedDate !== undefined ? { actionDateTime: parsedDate } : {}),
        ...(actionDescription !== undefined ? { actionDescription: actionDescription.trim() } : {}),
        ...(result !== undefined ? { result: result ? result.trim() : null } : {}),
        ...(followUpRequired !== undefined ? { followUpRequired: Boolean(followUpRequired) } : {}),
        ...(followUpNote !== undefined || !nextFollowUp ? { followUpNote: nextFollowUp ? nextNote : null } : {}),
        ...(attachmentNotes !== undefined ? { attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null } : {}),
      },
      include: { performedBy: { select: { id: true, name: true, email: true, role: true } } },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update action taken" });
  }
});

// 8. Dashboards
app.get("/api/dashboard/requester", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const totalOpen = await getPrisma().ticket.count({
      where: {
        requesterId: user.userId,
        currentStatus: { in: ["New", "Open", "In Progress", "Waiting for Requester", "Reopened"] },
      },
    });

    const inProgress = await getPrisma().ticket.count({
      where: {
        requesterId: user.userId,
        currentStatus: "In Progress",
      },
    });

    const waitingForRequester = await getPrisma().ticket.count({
      where: {
        requesterId: user.userId,
        currentStatus: "Waiting for Requester",
      },
    });

    const recentlyResolved = await getPrisma().ticket.count({
      where: {
        requesterId: user.userId,
        currentStatus: { in: ["Resolved", "Closed"] },
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    const recentTickets = await getPrisma().ticket.findMany({
      where: { requesterId: user.userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        category: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json({
      metrics: {
        totalOpen,
        inProgress,
        waitingForRequester,
        recentlyResolved,
      },
      recentTickets,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch requester dashboard data" });
  }
});

app.get("/api/dashboard/staff", authenticate, requireRole(["ITStaff", "Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  try {
    const unassigned = await getPrisma().ticket.count({
      where: {
        ownerId: null,
        currentStatus: { notIn: ["Closed", "Cancelled"] },
      },
    });

    const myAssigned = await getPrisma().ticket.count({
      where: {
        ownerId: user.userId,
        currentStatus: { notIn: ["Closed", "Cancelled"] },
      },
    });

    const myActionsTakenCount = await getPrisma().actionTaken.count({
      where: { performedById: user.userId },
    });

    const newTickets = await getPrisma().ticket.count({ where: { currentStatus: "New" } });
    const openTickets = await getPrisma().ticket.count({ where: { currentStatus: "Open" } });
    const inProgress = await getPrisma().ticket.count({ where: { currentStatus: "In Progress" } });
    const waitingForRequester = await getPrisma().ticket.count({ where: { currentStatus: "Waiting for Requester" } });
    const resolvedTickets = await getPrisma().ticket.count({ where: { currentStatus: "Resolved" } });
    const closedTickets = await getPrisma().ticket.count({ where: { currentStatus: "Closed" } });

    const highPriority = await getPrisma().ticket.count({ where: { itPriority: "HIGH", currentStatus: { notIn: ["Closed", "Cancelled"] } } });
    const mediumPriority = await getPrisma().ticket.count({ where: { itPriority: "MEDIUM", currentStatus: { notIn: ["Closed", "Cancelled"] } } });
    const lowPriority = await getPrisma().ticket.count({ where: { itPriority: "LOW", currentStatus: { notIn: ["Closed", "Cancelled"] } } });

    const recentTickets = await getPrisma().ticket.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    const myRecentActions = await getPrisma().actionTaken.findMany({
      where: { performedById: user.userId },
      orderBy: { actionDateTime: "desc" },
      take: 5,
      include: {
        ticket: { select: { id: true, ticketNo: true, summary: true, currentStatus: true } },
        performedBy: { select: { id: true, name: true, role: true } },
      },
    });

    let userCounts = undefined;
    if (user.role === "Administrator") {
      const totalUsers = await getPrisma().user.count();
      const activeUsers = await getPrisma().user.count({ where: { isActive: true } });
      const inactiveUsers = await getPrisma().user.count({ where: { isActive: false } });
      userCounts = { totalUsers, activeUsers, inactiveUsers };
    }

    res.status(200).json({
      metrics: {
        unassigned,
        myAssigned,
        myActionsTakenCount,
        new: newTickets,
        open: openTickets,
        inProgress,
        waitingForRequester,
        resolved: resolvedTickets,
        closed: closedTickets,
        byPriority: {
          high: highPriority,
          medium: mediumPriority,
          low: lowPriority,
        },
        ...(userCounts ? { userCounts } : {}),
      },
      recentTickets,
      myRecentActions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff dashboard data" });
  }
});

// 9. Administrator User Management Endpoints
app.get("/api/admin/users", authenticate, requireRole(["Administrator"]), async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const role = req.query.role as string;

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role && role !== "All Roles") {
      where.role = role;
    }

    const users = await getPrisma().user.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/users", authenticate, requireRole(["Administrator"]), async (req: Request, res: Response) => {
  const { name, email, role, isActive, initialPassword } = req.body;

  if (!name || !email || !role || initialPassword === undefined) {
    res.status(400).json({ error: "Name, email, role, and initial password are required" });
    return;
  }

  const allowedRoles = ["Requester", "ITStaff", "Administrator"];
  if (!allowedRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role selected" });
    return;
  }

  try {
    // Check duplicate email
    const existing = await getPrisma().user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: "Email address is already in use" });
      return;
    }

    const passwordHash = hashPassword(initialPassword);
    const user = await getPrisma().user.create({
      data: {
        name,
        email,
        role,
        isActive: isActive !== undefined ? isActive : true,
        passwordHash,
        mustChangePassword: true, // New users must change password at first login
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/admin/users/:id", authenticate, requireRole(["Administrator"]), async (req: AuthenticatedRequest, res: Response) => {
  const targetId = parseInt(req.params.id, 10);
  const { name, email, role, isActive } = req.body;

  try {
    const user = await getPrisma().user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Safety checks
    if (targetId === req.user!.userId) {
      // 1. Prevent self-deactivation
      if (isActive === false) {
        res.status(400).json({ error: "Administrators cannot deactivate their own accounts" });
        return;
      }
      // 2. Prevent self-role-change
      if (role && role !== "Administrator") {
        res.status(400).json({ error: "Administrators cannot change their own roles" });
        return;
      }
    }

    // 3. Prevent deactivating/removing the last active Administrator
    if (user.role === "Administrator" && (isActive === false || (role && role !== "Administrator"))) {
      const activeAdminsCount = await getPrisma().user.count({
        where: { role: "Administrator", isActive: true },
      });
      if (activeAdminsCount <= 1) {
        res.status(400).json({
          error: "Cannot deactivate or change role of the last active Administrator in the system",
        });
        return;
      }
    }

    // Check duplicate email
    if (email && email !== user.email) {
      const dupe = await getPrisma().user.findUnique({ where: { email } });
      if (dupe) {
        res.status(400).json({ error: "Email address is already in use" });
        return;
      }
    }

    const updated = await getPrisma().user.update({
      where: { id: targetId },
      data: {
        name,
        email,
        role,
        isActive,
      },
    });

    res.status(200).json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.put("/api/admin/users/:id/reset-password", authenticate, requireRole(["Administrator"]), async (req: Request, res: Response) => {
  const targetId = parseInt(req.params.id, 10);
  const { newInitialPassword } = req.body;

  if (newInitialPassword === undefined || newInitialPassword.trim() === "") {
    res.status(400).json({ error: "New initial password is required" });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordHash = hashPassword(newInitialPassword);
    await getPrisma().user.update({
      where: { id: targetId },
      data: {
        passwordHash,
        mustChangePassword: true, // Forces password change at next login
      },
    });

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// 8. Attachment Upload
app.post("/api/tickets/:id/attachments", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (user.role === "Requester" && ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Check active attachments limit (5)
    const activeCount = await getPrisma().attachment.count({
      where: { ticketId: id, isRemoved: false },
    });

    if (activeCount >= 5) {
      res.status(400).json({ error: "Maximum active attachments limit (5) reached" });
      return;
    }

    upload.single("file")(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const attachment = await getPrisma().attachment.create({
        data: {
          ticketId: id,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      res.status(201).json(attachment);
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// 9. Download active attachment
app.get("/api/attachments/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    const attachment = await getPrisma().attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (user.role === "Requester" && attachment.ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (attachment.isRemoved) {
      res.status(410).json({ error: "This attachment has been removed" });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: "Failed to download file" });
  }
});

// 10. Soft-remove attachment
app.delete("/api/attachments/:id", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { reason } = req.body;
  const user = req.user!;

  if (!reason || reason.trim() === "") {
    res.status(400).json({ error: "Removal reason is required" });
    return;
  }

  try {
    const attachment = await getPrisma().attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (user.role === "Requester" && attachment.ticket.requesterId !== user.userId) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const updated = await getPrisma().attachment.update({
      where: { id },
      data: {
        isRemoved: true,
        removeReason: reason.trim(),
      },
    });

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to remove attachment" });
  }
});

// Serve static production frontend build when available (for unified Docker / cloud deployment)
const CLIENT_DIST_DIR = path.resolve(process.cwd(), "../client/dist");
if (fs.existsSync(path.join(CLIENT_DIST_DIR, "index.html"))) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
  });
}

export default app;

