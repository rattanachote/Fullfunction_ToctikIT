const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string; // "Requester", "ITStaff", "Administrator"
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Attachment {
  id: number;
  ticketId: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  isRemoved: boolean;
  removeReason: string | null;
  createdAt: string;
}

export interface PublicComment {
  id: number;
  ticketId: number;
  authorId: number;
  author: { id: number; name: string; role: string };
  content: string;
  createdAt: string;
}

export interface InternalNote {
  id: number;
  ticketId: number;
  authorId: number;
  author: { id: number; name: string; role: string };
  content: string;
  createdAt: string;
}

export interface ActionTaken {
  id: number;
  ticketId: number;
  actionDateTime: string;
  actionDescription: string;
  result?: string | null;
  performedById: number;
  performedBy: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  followUpRequired: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequesterDashboardData {
  metrics: {
    totalOpen: number;
    inProgress: number;
    waitingForRequester: number;
    recentlyResolved: number;
  };
  recentTickets: Ticket[];
}

export interface StaffDashboardData {
  metrics: {
    unassigned: number;
    myAssigned: number;
    myActionsTakenCount?: number;
    new: number;
    open: number;
    inProgress: number;
    waitingForRequester: number;
    resolved: number;
    closed: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
    userCounts?: {
      totalUsers: number;
      activeUsers: number;
      inactiveUsers: number;
    };
  };
  recentTickets: Ticket[];
  myRecentActions?: (ActionTaken & {
    ticket?: { id: number; ticketNo: string; summary: string; currentStatus: string };
  })[];
}

export interface Ticket {
  id: number;
  ticketNo: string;
  requesterId: number;
  requester: { id: number; name: string; email: string };
  ownerId: number | null;
  owner?: { id: number; name: string; email: string } | null;
  categoryId: number;
  category: Category;
  relatedSystem: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  requesterResolvedIndication: boolean;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  actionsTaken?: ActionTaken[];
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface FetchTicketsResponse {
  tickets: Ticket[];
  pagination: Pagination;
}

const getHeaders = (_requesterId?: number) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

// 1. Auth APIs
export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Login failed");
  }
  const data = await res.json();
  sessionStorage.setItem("auth_token", data.token);
  sessionStorage.setItem("current_user", JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: getHeaders(),
    });
  } catch (_err) {
    // Ignore network logout error and clear local session safely
  } finally {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("current_user");
  }
}

export async function fetchMe(): Promise<{ user: User }> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to update password");
  }
}

// 2. Reference APIs
export async function fetchRequesters(): Promise<{ id: number; name: string; email: string }[]> {
  const res = await fetch(`${API_URL}/api/requesters`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch requesters");
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function fetchSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/systems`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch systems");
  return res.json();
}

// 3. Tickets APIs
export async function createTicket(
  data: {
    categoryId: number;
    relatedSystem: string;
    requestedPriority: string;
    summary: string;
    description: string;
  },
  requesterId?: number
): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: getHeaders(requesterId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to create ticket");
  }
  return res.json();
}

export async function fetchTickets(
  params: {
    search?: string;
    category?: string;
    categoryId?: number;
    priority?: string;
    status?: string;
    owner?: string;
    sort?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  },
  requesterId?: number
): Promise<FetchTicketsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      query.append(key, val.toString());
    }
  });

  const res = await fetch(`${API_URL}/api/tickets?${query.toString()}`, {
    headers: getHeaders(requesterId),
  });
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

export async function fetchTicketDetails(id: number, requesterId?: number): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets/${id}`, {
    headers: getHeaders(requesterId),
  });
  if (!res.ok) throw new Error("Failed to fetch ticket details");
  return res.json();
}

export async function updateTicketOwner(
  ticketId: number,
  ownerId: number | null,
  expectedUpdatedAt?: string
): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/owner`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ ownerId, expectedUpdatedAt }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to assign ticket");
  }
  return res.json();
}

export async function updateTicketStatus(
  ticketId: number,
  currentStatusOrPayload?: string | { currentStatus?: string; itPriority?: string; expectedUpdatedAt?: string; requireActionForResolve?: boolean },
  itPriority?: string,
  expectedUpdatedAt?: string
): Promise<Ticket> {
  const body =
    typeof currentStatusOrPayload === "object" && currentStatusOrPayload !== null
      ? currentStatusOrPayload
      : { currentStatus: currentStatusOrPayload, itPriority, expectedUpdatedAt };

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/status`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to update ticket status/priority");
  }
  return res.json();
}

export async function indicateResolved(ticketId: number): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/indicate-resolved`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to indicate resolution");
  }
  return res.json();
}

// 4. Comments & Internal Notes APIs
export async function fetchComments(ticketId: number): Promise<PublicComment[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch public comments");
  return res.json();
}

export async function createComment(ticketId: number, content: string): Promise<PublicComment> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to add comment");
  }
  return res.json();
}

export async function fetchNotes(ticketId: number): Promise<InternalNote[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/notes`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch internal notes");
  return res.json();
}

export async function createNote(ticketId: number, content: string): Promise<InternalNote> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to add internal note");
  }
  return res.json();
}

// 5. Admin User Management APIs
export async function fetchAdminUsers(search?: string, role?: string): Promise<User[]> {
  const query = new URLSearchParams();
  if (search) query.append("search", search);
  if (role) query.append("role", role);

  const res = await fetch(`${API_URL}/api/admin/users?${query.toString()}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  initialPassword?: string;
}): Promise<User> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to create user");
  }
  return res.json();
}

export async function updateAdminUser(
  userId: number,
  data: {
    name?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
  }
): Promise<User> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to update user");
  }
  return res.json();
}

export async function resetUserPassword(userId: number, newInitialPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/reset-password`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ newInitialPassword }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to reset password");
  }
}

// 6. Actions Taken APIs
export async function fetchActionsTaken(ticketId: number): Promise<ActionTaken[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions-taken`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch actions taken");
  return res.json();
}

export async function createActionTaken(
  ticketId: number,
  data: {
    actionDateTime?: string;
    actionDescription: string;
    result?: string;
    followUpRequired?: boolean;
    followUpNote?: string;
    attachmentNotes?: string;
  }
): Promise<ActionTaken> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions-taken`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to create action taken");
  }
  return res.json();
}

export async function updateActionTaken(
  actionId: number,
  data: {
    actionDateTime?: string;
    actionDescription?: string;
    result?: string;
    followUpRequired?: boolean;
    followUpNote?: string;
    attachmentNotes?: string;
    expectedUpdatedAt?: string;
  }
): Promise<ActionTaken> {
  const res = await fetch(`${API_URL}/api/actions-taken/${actionId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to update action taken");
  }
  return res.json();
}

// 7. Dashboard APIs
export async function fetchRequesterDashboard(): Promise<RequesterDashboardData> {
  const res = await fetch(`${API_URL}/api/dashboard/requester`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch requester dashboard");
  return res.json();
}

export async function fetchStaffDashboard(): Promise<StaffDashboardData> {
  const res = await fetch(`${API_URL}/api/dashboard/staff`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch staff dashboard");
  return res.json();
}

// 6. Attachments APIs
export async function uploadAttachment(
  ticketId: number,
  file: File,
  _requesterId?: number
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: HeadersInit = {};
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to upload file");
  }
  return res.json();
}

export async function deleteAttachment(
  id: number,
  reason: string,
  requesterId?: number
): Promise<Attachment> {
  const res = await fetch(`${API_URL}/api/attachments/${id}`, {
    method: "DELETE",
    headers: getHeaders(requesterId),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to delete attachment");
  }
  return res.json();
}

export async function downloadAttachment(
  id: number,
  originalName: string,
  _requesterId?: number
): Promise<void> {
  const headers: HeadersInit = {};
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/attachments/${id}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    let errMsg = "Failed to download attachment";
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = originalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function checkSystem(): Promise<{ online: boolean; categories: Category[] }> {
  // Try calling categories with no token to see if it responds or needs token.
  // We can just call categories.
  const res = await fetch(`${API_URL}/api/categories`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed");
  const categories = await res.json();
  return { online: true, categories };
}
