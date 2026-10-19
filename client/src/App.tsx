import { useState, useEffect } from "react";
import {
  login,
  logout,
  fetchMe,
  changePassword,
  fetchCategories,
  fetchSystems,
  createTicket,
  fetchTickets,
  fetchTicketDetails,
  uploadAttachment,
  deleteAttachment,
  updateTicketOwner,
  updateTicketStatus,
  indicateResolved,
  fetchComments,
  createComment,
  fetchNotes,
  createNote,
  fetchActionsTaken,
  createActionTaken,
  updateActionTaken,
  fetchRequesterDashboard,
  fetchStaffDashboard,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetUserPassword,
  User,
  Category,
  RelatedSystem,
  Ticket,
  Attachment,
  PublicComment,
  InternalNote,
  ActionTaken,
  RequesterDashboardData,
  StaffDashboardData,
} from "./api.js";

type Screen = "login" | "change_password" | "dashboard" | "list" | "create" | "detail" | "admin_users";

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  "New": ["Open", "In Progress", "Cancelled"],
  "Open": ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Open", "Resolved", "Cancelled"],
  "Resolved": ["Closed", "Reopened"],
  "Reopened": ["Open", "In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "Closed": ["Reopened"],
  "Cancelled": ["Reopened"],
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  // Login States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // Dashboard States
  const [requesterDashboard, setRequesterDashboard] = useState<RequesterDashboardData | null>(null);
  const [staffDashboard, setStaffDashboard] = useState<StaffDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  // List Screen States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterPriority, setFilterPriority] = useState("All Priorities");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterOwner, setFilterOwner] = useState("");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  // Create Screen States
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSystem, setNewSystem] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newSummary, setNewSummary] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdTicketNo, setCreatedTicketNo] = useState("");

  // Detail Screen States
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [ticketDetails, setTicketDetails] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [workflowFeedback, setWorkflowFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [workflowUpdating, setWorkflowUpdating] = useState(false);
  
  // Comments and Notes States
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newNote, setNewNote] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [noteError, setNoteError] = useState("");

  // Actions Taken States (Create + Edit)
  const [actionsTakenList, setActionsTakenList] = useState<ActionTaken[]>([]);
  const [actionDateTime, setActionDateTime] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [actionFollowUpRequired, setActionFollowUpRequired] = useState(false);
  const [actionFollowUpNote, setActionFollowUpNote] = useState("");
  const [actionAttachmentNotes, setActionAttachmentNotes] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Edit Action Taken States
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editActionDescription, setEditActionDescription] = useState("");
  const [editActionResult, setEditActionResult] = useState("");
  const [editActionFollowUpRequired, setEditActionFollowUpRequired] = useState(false);
  const [editActionFollowUpNote, setEditActionFollowUpNote] = useState("");
  const [editActionAttachmentNotes, setEditActionAttachmentNotes] = useState("");
  const [editActionUpdatedAt, setEditActionUpdatedAt] = useState("");
  const [editActionSubmitting, setEditActionSubmitting] = useState(false);
  const [editActionError, setEditActionError] = useState("");

  // IT Staff List (for ticket assignment)
  const [itStaffList, setItStaffList] = useState<User[]>([]);

  // Admin User Management States
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilterRole, setAdminFilterRole] = useState("All Roles");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUserPassword, setResettingUserPassword] = useState<User | null>(null);

  // Admin Forms States
  const [adminFormName, setAdminFormName] = useState("");
  const [adminFormEmail, setAdminFormEmail] = useState("");
  const [adminFormRole, setAdminFormRole] = useState("Requester");
  const [adminFormIsActive, setAdminFormIsActive] = useState(true);
  const [adminFormInitialPassword, setAdminFormInitialPassword] = useState("");
  const [adminFormNewPassword, setAdminFormNewPassword] = useState("");
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");
  const [adminFormLoading, setAdminFormLoading] = useState(false);

  // Detail Attachment Add
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [detailFileErrors, setDetailFileErrors] = useState<string[]>([]);
  const [detailUploadLoading, setDetailUploadLoading] = useState(false);

  // Soft Removal Modal States
  const [removeAttachmentId, setRemoveAttachmentId] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState("");

  // Check session storage on mount
  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");
    const cachedUser = sessionStorage.getItem("current_user");
    const cachedScreen = sessionStorage.getItem("current_screen") as Screen | null;
    const cachedTicketId = sessionStorage.getItem("current_ticket_id");

    if (token && cachedUser) {
      const u = JSON.parse(cachedUser) as User;
      setCurrentUser(u);
      if (cachedTicketId) {
        setDetailTicketId(parseInt(cachedTicketId, 10));
      }
      if (u.mustChangePassword) {
        setScreen("change_password");
      } else if (cachedScreen && cachedScreen !== "login" && cachedScreen !== "change_password") {
        setScreen(cachedScreen);
      } else {
        setScreen("dashboard");
      }
      loadReferenceData();
    } else {
      setScreen("login");
    }
  }, []);

  // Save current screen & detailTicketId to session storage
  useEffect(() => {
    if (screen && screen !== "login" && screen !== "change_password") {
      sessionStorage.setItem("current_screen", screen);
    }
    if (detailTicketId !== null) {
      sessionStorage.setItem("current_ticket_id", detailTicketId.toString());
    } else {
      sessionStorage.removeItem("current_ticket_id");
    }
  }, [screen, detailTicketId]);

  // Fetch reference data
  const loadReferenceData = async () => {
    try {
      const cats = await fetchCategories();
      if (Array.isArray(cats)) setCategories(cats);
      const sys = await fetchSystems();
      if (Array.isArray(sys)) setSystems(sys);
      if (typeof fetchAdminUsers === "function") {
        const users = await fetchAdminUsers("", "ITStaff");
        const admins = await fetchAdminUsers("", "Administrator");
        if (Array.isArray(users) && Array.isArray(admins)) {
          setItStaffList([...users, ...admins].filter(u => u.isActive));
        }
      }
    } catch (_err) {
      // Ignore reference loading error in restricted views
    }
  };

  // Fetch dashboard data
  const loadDashboardData = async () => {
    if (!currentUser) return;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      if (currentUser.role === "Requester") {
        if (typeof fetchRequesterDashboard === "function") {
          const data = await fetchRequesterDashboard();
          setRequesterDashboard(data);
        }
      } else {
        if (typeof fetchStaffDashboard === "function") {
          const data = await fetchStaffDashboard();
          setStaffDashboard(data);
        }
      }
    } catch (err: any) {
      setDashboardError(err.message || "Failed to load dashboard data.");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (screen === "dashboard" && currentUser && !currentUser.mustChangePassword) {
      loadDashboardData();
    }
  }, [screen, currentUser]);

  // Fetch tickets
  useEffect(() => {
    if (currentUser && screen === "list" && !currentUser.mustChangePassword) {
      loadTicketsList();
    }
  }, [currentUser, screen, search, filterCategory, filterPriority, filterStatus, filterOwner, sortBy, page]);

  // Fetch ticket details
  useEffect(() => {
    if (currentUser && screen === "detail" && detailTicketId !== null && !currentUser.mustChangePassword) {
      loadTicketDetails();
    }
  }, [currentUser, screen, detailTicketId]);

  // Fetch admin users list
  useEffect(() => {
    if (currentUser && screen === "admin_users" && currentUser.role === "Administrator" && !currentUser.mustChangePassword) {
      loadAdminUsersList();
    }
  }, [currentUser, screen, adminSearch, adminFilterRole]);

  const loadTicketsList = async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await fetchTickets({
        page,
        limit: 10,
        search,
        category: filterCategory !== "All Categories" ? filterCategory : undefined,
        priority: filterPriority !== "All Priorities" ? filterPriority : undefined,
        status: filterStatus !== "All Statuses" ? filterStatus : undefined,
        owner: filterOwner || undefined,
        sort: sortBy,
      });
      setTickets(res.tickets);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.totalCount);
    } catch (err: any) {
      setListError(err.message || "Failed to load tickets");
    } finally {
      setListLoading(false);
    }
  };

  const loadTicketDetails = async () => {
    if (detailTicketId === null) return;
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await fetchTicketDetails(detailTicketId);
      setTicketDetails(data);
      
      // Load public comments
      setCommentsLoading(true);
      const cmts = await fetchComments(detailTicketId);
      setComments(cmts);
      setCommentsLoading(false);

      // Load internal notes if IT Staff or Admin
      if (currentUser && (currentUser.role === "ITStaff" || currentUser.role === "Administrator")) {
        setNotesLoading(true);
        const nts = await fetchNotes(detailTicketId);
        setInternalNotes(nts);
        setNotesLoading(false);
      }

      // Load actions taken
      if (typeof fetchActionsTaken === "function") {
        const acts = await fetchActionsTaken(detailTicketId);
        setActionsTakenList(acts);
      }
    } catch (_err: any) {
      setDetailError("Failed to fetch ticket details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAdminUsersList = async () => {
    setAdminLoading(true);
    setAdminError("");
    try {
      const users = await fetchAdminUsers(adminSearch, adminFilterRole);
      setAdminUsers(users);
    } catch (_err: any) {
      setAdminError("Failed to load users list.");
    } finally {
      setAdminLoading(false);
    }
  };

  // Auth Operations
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await login(loginEmail, loginPassword);
      setCurrentUser(res.user);
      
      await loadReferenceData();

      if (res.user.mustChangePassword) {
        setScreen("change_password");
      } else {
        setScreen("dashboard");
      }
    } catch (err: any) {
      setLoginError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
    } catch (_err) {
      // Ignore logout network error
    }
    setCurrentUser(null);
    setScreen("login");
    setLoginEmail("");
    setLoginPassword("");
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setChangePasswordError("New password and confirm password do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setChangePasswordError("Password must be at least 8 characters long.");
      return;
    }

    setChangePasswordLoading(true);
    setChangePasswordError("");
    try {
      await changePassword(currentPassword, newPassword);
      setChangePasswordSuccess(true);
      setTimeout(() => {
        if (currentUser) {
          const updated = { ...currentUser, mustChangePassword: false };
          setCurrentUser(updated);
          sessionStorage.setItem("current_user", JSON.stringify(updated));
        }
        setScreen("dashboard");
        setChangePasswordSuccess(false);
      }, 1200);
    } catch (err: any) {
      setChangePasswordError(err.message || "Failed to update password.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Ticket Operations
  const handleOwnerChange = async (newOwnerId: string) => {
    if (!ticketDetails || workflowUpdating) return;
    setWorkflowUpdating(true);
    setWorkflowFeedback(null);
    try {
      const ownerIdNum = newOwnerId === "" ? null : parseInt(newOwnerId, 10);
      await updateTicketOwner(ticketDetails.id, ownerIdNum, ticketDetails.updatedAt);
      setWorkflowFeedback({ type: "success", message: "Ticket owner updated successfully." });
      await loadTicketDetails();
    } catch (err: any) {
      setWorkflowFeedback({ type: "danger", message: err.message || "Failed to assign owner." });
    } finally {
      setWorkflowUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticketDetails || workflowUpdating) return;
    setWorkflowUpdating(true);
    setWorkflowFeedback(null);
    try {
      await updateTicketStatus(ticketDetails.id, {
        currentStatus: newStatus,
        expectedUpdatedAt: ticketDetails.updatedAt,
      });
      setWorkflowFeedback({ type: "success", message: `Ticket status updated to ${newStatus}.` });
      await loadTicketDetails();
    } catch (err: any) {
      setWorkflowFeedback({ type: "danger", message: err.message || "Failed to update ticket status." });
    } finally {
      setWorkflowUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticketDetails || workflowUpdating) return;
    setWorkflowUpdating(true);
    setWorkflowFeedback(null);
    try {
      await updateTicketStatus(ticketDetails.id, {
        itPriority: newPriority,
        expectedUpdatedAt: ticketDetails.updatedAt,
      });
      setWorkflowFeedback({ type: "success", message: `IT Priority updated to ${newPriority}.` });
      await loadTicketDetails();
    } catch (err: any) {
      setWorkflowFeedback({ type: "danger", message: err.message || "Failed to update IT Priority." });
    } finally {
      setWorkflowUpdating(false);
    }
  };

  const handleIndicateResolvedToggle = async () => {
    if (!ticketDetails || workflowUpdating) return;
    setWorkflowUpdating(true);
    setWorkflowFeedback(null);
    try {
      await indicateResolved(ticketDetails.id);
      await loadTicketDetails();
    } catch (err: any) {
      setWorkflowFeedback({ type: "danger", message: err.message || "Failed to toggle resolution indication." });
    } finally {
      setWorkflowUpdating(false);
    }
  };

  // Actions Taken Handlers (Create & Edit)
  const handleAddActionTaken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetails || actionSubmitting) return;
    if (!actionDescription.trim()) {
      setActionError("Action description is required.");
      return;
    }
    if (actionFollowUpRequired && !actionFollowUpNote.trim()) {
      setActionError("Follow-up note is required when follow-up is required.");
      return;
    }

    setActionSubmitting(true);
    setActionError("");

    try {
      await createActionTaken(ticketDetails.id, {
        ...(actionDateTime ? { actionDateTime } : {}),
        actionDescription,
        result: actionResult,
        followUpRequired: actionFollowUpRequired,
        followUpNote: actionFollowUpNote,
        attachmentNotes: actionAttachmentNotes,
      });

      setActionDateTime("");
      setActionDescription("");
      setActionResult("");
      setActionFollowUpRequired(false);
      setActionFollowUpNote("");
      setActionAttachmentNotes("");

      const acts = await fetchActionsTaken(ticketDetails.id);
      setActionsTakenList(acts);
    } catch (err: any) {
      setActionError(err.message || "Failed to add action taken.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleStartEditAction = (action: ActionTaken) => {
    setEditingActionId(action.id);
    setEditActionDescription(action.actionDescription);
    setEditActionResult(action.result || "");
    setEditActionFollowUpRequired(action.followUpRequired);
    setEditActionFollowUpNote(action.followUpNote || "");
    setEditActionAttachmentNotes(action.attachmentNotes || "");
    setEditActionUpdatedAt(action.updatedAt);
    setEditActionError("");
  };

  const handleSaveEditAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetails || editingActionId === null || editActionSubmitting) return;
    if (!editActionDescription.trim()) {
      setEditActionError("Action description cannot be empty.");
      return;
    }
    if (editActionFollowUpRequired && !editActionFollowUpNote.trim()) {
      setEditActionError("Follow-up note is required when follow-up is required.");
      return;
    }

    setEditActionSubmitting(true);
    setEditActionError("");
    try {
      await updateActionTaken(editingActionId, {
        actionDescription: editActionDescription,
        result: editActionResult,
        followUpRequired: editActionFollowUpRequired,
        followUpNote: editActionFollowUpNote,
        attachmentNotes: editActionAttachmentNotes,
        expectedUpdatedAt: editActionUpdatedAt,
      });
      setEditingActionId(null);
      const acts = await fetchActionsTaken(ticketDetails.id);
      setActionsTakenList(acts);
    } catch (err: any) {
      setEditActionError(err.message || "Failed to update action taken.");
    } finally {
      setEditActionSubmitting(false);
    }
  };

  // Comments & Notes Operations
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticketDetails || commentSubmitting) return;
    setCommentSubmitting(true);
    setCommentError("");
    try {
      await createComment(ticketDetails.id, newComment);
      setNewComment("");
      const cmts = await fetchComments(ticketDetails.id);
      setComments(cmts);
    } catch (err: any) {
      setCommentError(err.message || "Failed to post comment.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !ticketDetails || noteSubmitting) return;
    setNoteSubmitting(true);
    setNoteError("");
    try {
      await createNote(ticketDetails.id, newNote);
      setNewNote("");
      const nts = await fetchNotes(ticketDetails.id);
      setInternalNotes(nts);
    } catch (err: any) {
      setNoteError(err.message || "Failed to add internal note.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    if (priority === "HIGH") return "badge bg-danger text-white";
    if (priority === "MEDIUM") return "badge bg-warning text-dark";
    return "badge bg-success text-white";
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "New") return "badge bg-primary text-white";
    if (status === "Open") return "badge bg-info text-dark";
    if (status === "In Progress") return "badge bg-warning text-dark";
    if (status === "Waiting for Requester") return "badge bg-secondary text-white";
    if (status === "Resolved") return "badge bg-success text-white";
    if (status === "Closed") return "badge bg-dark text-white";
    if (status === "Reopened") return "badge bg-info text-dark";
    return "badge bg-danger text-white";
  };

  return (
    <div style={{ backgroundColor: "#F5F7F6", minHeight: "100vh", color: "#1C2E24" }}>
      <style>{`
        .navbar-green { background-color: #006B3C; }
        .text-green-primary { color: #006B3C; }
        .text-green-secondary { color: #0B7A46; }
        .bg-green-pale { background-color: #EAF6EF; }
        .btn-green-primary { background-color: #006B3C; color: #fff; border: none; }
        .btn-green-primary:hover { background-color: #0B7A46; color: #fff; }
        .btn-green-primary:disabled { background-color: #7BB89B; color: #fff; }
        .btn-green-secondary { background-color: transparent; color: #0B7A46; border: 1px solid #0B7A46; }
        .btn-green-secondary:hover { background-color: #EAF6EF; color: #006B3C; }
        .bg-read-only { background-color: #FAF9F6 !important; border: 1px solid #D0D7D3; }
        .card-custom { border: 1px solid #D0D7D3; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); background: white; }
        .page-link-active { background-color: #0B7A46 !important; border-color: #0B7A46 !important; color: white !important; }
        .page-link { color: #0B7A46; }
        .page-link:hover { background-color: #EAF6EF; color: #006B3C; }
        
        .comments-section { border: 2px solid #EAF6EF; border-radius: 8px; }
        .comments-header { background-color: #EAF6EF; color: #006B3C; padding: 10px 15px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px; }
        .notes-section { border: 2px solid #FDF3E7; border-radius: 8px; }
        .notes-header { background-color: #FDF3E7; color: #D48208; padding: 10px 15px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px; }
        .actions-section { border: 2px solid #EBF3FB; border-radius: 8px; }
        .actions-header { background-color: #EBF3FB; color: #104F8C; padding: 10px 15px; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px; }
        .metric-card { border-radius: 8px; transition: transform 0.15s ease-in-out; border: 1px solid #D0D7D3; }
        .metric-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
      `}</style>

      {/* Header Bar */}
      {currentUser && (
        <nav className="navbar navbar-dark navbar-green shadow-sm mb-4">
          <div className="container">
            <span className="navbar-brand fw-bold d-flex align-items-center cursor-pointer" onClick={() => setScreen("dashboard")}>
              <i className="bi bi-ticket-perforated me-2"></i> TokTickIT
            </span>
            <div className="d-flex align-items-center gap-2">
              <button
                className={`btn btn-sm ${screen === "dashboard" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                onClick={() => setScreen("dashboard")}
              >
                Dashboard
              </button>

              {currentUser.role === "Requester" && (
                <>
                  <button
                    className={`btn btn-sm ${screen === "list" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                    onClick={() => {
                      setScreen("list");
                      setPage(1);
                    }}
                  >
                    My Tickets
                  </button>
                  <button
                    className={`btn btn-sm ${screen === "create" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                    onClick={() => {
                      setCreatedTicketNo("");
                      setScreen("create");
                    }}
                  >
                    Create Ticket
                  </button>
                </>
              )}

              {currentUser.role === "ITStaff" && (
                <button
                  className={`btn btn-sm ${screen === "list" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                  onClick={() => {
                    setScreen("list");
                    setPage(1);
                  }}
                >
                  Ticket Queue
                </button>
              )}

              {currentUser.role === "Administrator" && (
                <>
                  <button
                    className={`btn btn-sm ${screen === "admin_users" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                    onClick={() => setScreen("admin_users")}
                  >
                    User Management
                  </button>
                  <button
                    className={`btn btn-sm ${screen === "list" ? "btn-light text-green-primary" : "btn-outline-light"}`}
                    onClick={() => {
                      setScreen("list");
                      setPage(1);
                    }}
                  >
                    Ticket Queue
                  </button>
                </>
              )}

              <div className="text-light d-none d-sm-block ms-2">
                <strong>{currentUser.name}</strong> <span className="badge bg-light text-dark ms-1" style={{ fontSize: "0.75rem" }}>{currentUser.role}</span>
              </div>
              <button className="btn btn-sm btn-outline-light ms-2" onClick={handleLogoutClick}>
                Logout
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <div className="container py-2">
        
        {/* Screen 1: Login Screen */}
        {screen === "login" && (
          <div className="row justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
            <div className="col-md-5">
              <div className="card card-custom p-4 shadow">
                <div className="text-center mb-4">
                  <div className="text-green-primary mb-2" style={{ fontSize: "3rem" }}>
                    <i className="bi bi-shield-lock-fill"></i>
                  </div>
                  <h1 className="h3 fw-bold text-green-primary">Sign in to your account</h1>
                  <p className="text-muted small">Enter your email and password to access the platform</p>
                </div>

                {loginError && <div className="alert alert-danger py-2 px-3 small">{loginError}</div>}

                <form onSubmit={handleLoginSubmit}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email address *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="name@toktickit.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label small fw-semibold">Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-green-primary w-100 py-2 fw-semibold"
                    disabled={loginLoading}
                  >
                    {loginLoading ? "Signing In..." : "Sign In"}
                  </button>
                </form>

                <div className="text-center mt-3">
                  <span className="text-muted small">Default seed password for all accounts is: </span>
                  <br />
                  <code className="text-green-secondary">password123</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Screen 1.5: Mandatory Change Password Screen */}
        {screen === "change_password" && currentUser && (
          <div className="row justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
            <div className="col-md-6">
              <div className="card card-custom p-4 shadow">
                <div className="text-center mb-4">
                  <div className="text-warning mb-2" style={{ fontSize: "3rem" }}>
                    <i className="bi bi-exclamation-triangle-fill"></i>
                  </div>
                  <h1 className="h3 fw-bold text-green-primary">Change Your Password</h1>
                  <p className="text-muted small">You must change your initial password to continue.</p>
                </div>

                {changePasswordError && <div className="alert alert-danger py-2 px-3 small">{changePasswordError}</div>}
                {changePasswordSuccess && <div className="alert alert-success py-2 px-3 small">Password changed successfully! Redirecting...</div>}

                <form onSubmit={handleChangePasswordSubmit}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Current (Temporary) Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label small fw-semibold">Confirm New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-green-primary w-100 py-2 fw-semibold"
                    disabled={changePasswordLoading}
                  >
                    {changePasswordLoading ? "Updating..." : "Update Password & Continue"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Screen 2: Dashboard Screen */}
        {screen === "dashboard" && currentUser && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="h4 fw-bold text-green-primary mb-1">
                  {currentUser.role === "Requester" ? `Welcome, ${currentUser.name}!` : `Welcome back, ${currentUser.name}!`}
                </h2>
                <p className="text-muted small mb-0">Here's what's happening with your service desk operations today.</p>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={loadDashboardData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            {dashboardError && (
              <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                {dashboardError}
              </div>
            )}

            {dashboardLoading && (
              <div className="text-center py-5">
                <div className="spinner-border text-green-primary" role="status"></div>
                <p className="text-muted small mt-2">Loading operational dashboard...</p>
              </div>
            )}

            {/* Requester Dashboard View */}
            {!dashboardLoading && currentUser.role === "Requester" && requesterDashboard && (
              <div>
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="My Open Tickets drill-down"
                      onClick={() => { setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); } }}
                    >
                      <div className="text-muted small fw-semibold">My Open Tickets</div>
                      <div className="h2 fw-bold text-green-primary my-2">{requesterDashboard.metrics.totalOpen}</div>
                      <div className="small text-green-secondary fw-semibold">View all &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="In Progress Tickets drill-down"
                      onClick={() => { setFilterStatus("In Progress"); setFilterOwner(""); setScreen("list"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setFilterStatus("In Progress"); setFilterOwner(""); setScreen("list"); } }}
                    >
                      <div className="text-muted small fw-semibold">In Progress</div>
                      <div className="h2 fw-bold text-warning my-2">{requesterDashboard.metrics.inProgress}</div>
                      <div className="small text-warning fw-semibold">View all &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="Waiting on You Tickets drill-down"
                      onClick={() => { setFilterStatus("Waiting for Requester"); setFilterOwner(""); setScreen("list"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setFilterStatus("Waiting for Requester"); setFilterOwner(""); setScreen("list"); } }}
                    >
                      <div className="text-muted small fw-semibold">Waiting on You</div>
                      <div className="h2 fw-bold text-secondary my-2">{requesterDashboard.metrics.waitingForRequester}</div>
                      <div className="small text-secondary fw-semibold">Action needed &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="Resolved or Closed Tickets drill-down"
                      onClick={() => { setFilterStatus("Resolved"); setFilterOwner(""); setScreen("list"); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setFilterStatus("Resolved"); setFilterOwner(""); setScreen("list"); } }}
                    >
                      <div className="text-muted small fw-semibold">Resolved / Closed (30d)</div>
                      <div className="h2 fw-bold text-success my-2">{requesterDashboard.metrics.recentlyResolved}</div>
                      <div className="small text-success fw-semibold">View all &rarr;</div>
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-md-8">
                    <div className="card card-custom p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold mb-0">My Recent Tickets</h5>
                        <button className="btn btn-sm btn-link text-green-primary p-0 text-decoration-none" onClick={() => { setFilterStatus("All Statuses"); setScreen("list"); }}>View all</button>
                      </div>
                      {requesterDashboard.recentTickets.length === 0 ? (
                        <div className="text-center py-4 text-muted">No tickets found. Create your first ticket!</div>
                      ) : (
                        <div className="list-group list-group-flush">
                          {requesterDashboard.recentTickets.map(t => (
                            <div key={t.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                              <div>
                                <span className="badge bg-light text-dark border me-2">{t.ticketNo}</span>
                                <span className={getStatusBadgeClass(t.currentStatus)}>{t.currentStatus}</span>
                                {t.currentStatus === "Waiting for Requester" && (
                                  <span className="badge bg-warning text-dark ms-2">Attention Required</span>
                                )}
                                <div className="fw-semibold mt-1">{t.summary}</div>
                                <div className="text-muted small">{t.category.name} &bull; Updated {new Date(t.updatedAt).toLocaleDateString()}</div>
                              </div>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setDetailTicketId(t.id); setScreen("detail"); }}>
                                Details
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card card-custom p-4">
                      <h5 className="fw-bold mb-3">Quick Actions</h5>
                      <div className="d-grid gap-2">
                        <button className="btn btn-green-primary py-2" onClick={() => setScreen("create")}>
                          <i className="bi bi-plus-circle me-2"></i> Create Ticket
                        </button>
                        <button className="btn btn-outline-secondary py-2" onClick={() => { setFilterStatus("All Statuses"); setScreen("list"); }}>
                          <i className="bi bi-card-list me-2"></i> View My Tickets
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IT Staff & Admin Dashboard View */}
            {!dashboardLoading && (currentUser.role === "ITStaff" || currentUser.role === "Administrator") && staffDashboard && (
              <div>
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("New"); setFilterOwner(""); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">New</div>
                      <div className="h3 fw-bold text-primary my-1">{staffDashboard.metrics.new}</div>
                      <div className="small text-primary">Queue &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("Open"); setFilterOwner(""); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">Open</div>
                      <div className="h3 fw-bold text-info my-1">{staffDashboard.metrics.open}</div>
                      <div className="small text-info">Queue &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("In Progress"); setFilterOwner(""); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">In Progress</div>
                      <div className="h3 fw-bold text-warning my-1">{staffDashboard.metrics.inProgress}</div>
                      <div className="small text-warning">Queue &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("Waiting for Requester"); setFilterOwner(""); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">Waiting</div>
                      <div className="h3 fw-bold text-secondary my-1">{staffDashboard.metrics.waitingForRequester}</div>
                      <div className="small text-secondary">Queue &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("All Statuses"); setFilterOwner("me"); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">My Assigned</div>
                      <div className="h3 fw-bold text-green-primary my-1">{staffDashboard.metrics.myAssigned}</div>
                      <div className="small text-green-secondary">Active &rarr;</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div
                      className="card metric-card bg-white p-3 shadow-sm cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setFilterStatus("All Statuses"); setFilterOwner("unassigned"); setScreen("list"); }}
                    >
                      <div className="text-muted small fw-semibold">Unassigned</div>
                      <div className="h3 fw-bold text-danger my-1">{staffDashboard.metrics.unassigned}</div>
                      <div className="small text-danger">Claim &rarr;</div>
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-md-8">
                    <div className="card card-custom p-4 mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold mb-0">Recent Queue Activity</h5>
                        <button className="btn btn-sm btn-link text-green-primary p-0 text-decoration-none" onClick={() => { setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}>View full queue</button>
                      </div>
                      {staffDashboard.recentTickets.length === 0 ? (
                        <div className="text-center py-4 text-muted">No tickets found.</div>
                      ) : (
                        <div className="list-group list-group-flush">
                          {staffDashboard.recentTickets.map(t => (
                            <div key={t.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                              <div>
                                <span className="badge bg-light text-dark border me-2">{t.ticketNo}</span>
                                <span className={getStatusBadgeClass(t.currentStatus)}>{t.currentStatus}</span>
                                <span className={`ms-1 ${getPriorityBadgeClass(t.itPriority || t.requestedPriority)}`}>{t.itPriority || t.requestedPriority}</span>
                                <div className="fw-semibold mt-1">{t.summary}</div>
                                <div className="text-muted small">
                                  Requester: {t.requester.name} &bull; Owner: {t.owner ? t.owner.name : "Unassigned"}
                                </div>
                              </div>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setDetailTicketId(t.id); setScreen("detail"); }}>
                                Details
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Current-User Actions Taken Summary */}
                    {staffDashboard.myRecentActions && (
                      <div className="card card-custom p-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="fw-bold mb-0">My Recent Actions Taken</h5>
                          <span className="badge bg-primary">{staffDashboard.metrics.myActionsTakenCount ?? staffDashboard.myRecentActions.length} Recorded</span>
                        </div>
                        {staffDashboard.myRecentActions.length === 0 ? (
                          <div className="text-center py-3 text-muted small">You have not recorded any Actions Taken yet.</div>
                        ) : (
                          <div className="list-group list-group-flush">
                            {staffDashboard.myRecentActions.map(a => (
                              <div key={a.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                                <div>
                                  <span className="badge bg-light text-dark border me-2">{a.ticket?.ticketNo || `Ticket #${a.ticketId}`}</span>
                                  <span className="small fw-semibold">{a.actionDescription}</span>
                                  <div className="text-muted small">
                                    {a.result ? `Result: ${a.result} • ` : ""}{new Date(a.actionDateTime).toLocaleString()}
                                  </div>
                                </div>
                                <button className="btn btn-sm btn-outline-primary" onClick={() => { setDetailTicketId(a.ticketId); setScreen("detail"); }}>
                                  Open Ticket
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <div className="card card-custom p-4 mb-4">
                      <h5 className="fw-bold mb-3">Active Tickets by Priority</h5>
                      <div
                        className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => { setFilterPriority("HIGH"); setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}
                      >
                        <span className="badge bg-danger">HIGH</span>
                        <span className="fw-bold fs-5">{staffDashboard.metrics.byPriority.high}</span>
                      </div>
                      <div
                        className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => { setFilterPriority("MEDIUM"); setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}
                      >
                        <span className="badge bg-warning text-dark">MEDIUM</span>
                        <span className="fw-bold fs-5">{staffDashboard.metrics.byPriority.medium}</span>
                      </div>
                      <div
                        className="d-flex justify-content-between align-items-center cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => { setFilterPriority("LOW"); setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}
                      >
                        <span className="badge bg-success">LOW</span>
                        <span className="fw-bold fs-5">{staffDashboard.metrics.byPriority.low}</span>
                      </div>
                    </div>

                    {currentUser.role === "Administrator" && staffDashboard.metrics.userCounts && (
                      <div className="card card-custom p-4 mb-4">
                        <h5 className="fw-bold mb-3">System User Accounts</h5>
                        <div className="d-flex justify-content-between small mb-1">
                          <span>Total Accounts:</span>
                          <strong>{staffDashboard.metrics.userCounts.totalUsers}</strong>
                        </div>
                        <div className="d-flex justify-content-between small mb-1 text-success">
                          <span>Active Users:</span>
                          <strong>{staffDashboard.metrics.userCounts.activeUsers}</strong>
                        </div>
                        <div className="d-flex justify-content-between small text-muted">
                          <span>Inactive Users:</span>
                          <strong>{staffDashboard.metrics.userCounts.inactiveUsers}</strong>
                        </div>
                      </div>
                    )}

                    <div className="card card-custom p-4">
                      <h5 className="fw-bold mb-3">Quick Navigation</h5>
                      <div className="d-grid gap-2">
                        <button className="btn btn-green-primary py-2" onClick={() => { setFilterStatus("All Statuses"); setFilterOwner(""); setScreen("list"); }}>
                          <i className="bi bi-inbox me-2"></i> IT Ticket Queue
                        </button>
                        {currentUser.role === "Administrator" && (
                          <button className="btn btn-outline-secondary py-2" onClick={() => setScreen("admin_users")}>
                            <i className="bi bi-people me-2"></i> User Administration
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screen 3: List / Queue View */}
        {screen === "list" && currentUser && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h4 fw-bold text-green-primary mb-0">
                {currentUser.role === "Requester" ? "My Tickets" : "IT Staff Ticket Queue"}
              </h2>
              {currentUser.role === "Requester" && (
                <button className="btn btn-green-primary" onClick={() => setScreen("create")}>
                  <i className="bi bi-plus-lg me-1"></i> Create Ticket
                </button>
              )}
            </div>

            {/* Filters and Search Bar */}
            <div className="card card-custom p-3 mb-4">
              <div className="row g-2">
                <div className="col-md-4">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    aria-label="Search tickets"
                    placeholder="Search by summary or ticket #..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select form-select-sm"
                    aria-label="Filter by Category"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="All Categories">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select form-select-sm"
                    aria-label="Filter by Priority"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <option value="All Priorities">All Priorities</option>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select form-select-sm"
                    aria-label="Filter by Status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="All Statuses">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Waiting for Requester">Waiting for Requester</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                    <option value="Reopened">Reopened</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select form-select-sm"
                    aria-label="Sort tickets"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="createdAt_desc">Newest First</option>
                    <option value="createdAt_asc">Oldest First</option>
                    <option value="updatedAt_desc">Recently Updated</option>
                  </select>
                </div>
              </div>
              {filterOwner && (
                <div className="mt-2 d-flex align-items-center gap-2">
                  <span className="badge bg-green-pale text-green-primary border">
                    Filter: {filterOwner === "me" ? "Assigned to Me" : "Unassigned Tickets"}
                  </span>
                  <button className="btn btn-sm btn-link text-danger p-0 small" onClick={() => setFilterOwner("")}>Clear owner filter</button>
                </div>
              )}
            </div>

            {listError && (
              <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                {listError}
              </div>
            )}

            {/* Tickets Table */}
            <div className="card card-custom p-0 overflow-hidden shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Ticket #</th>
                      <th>Created</th>
                      <th>Summary</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Owner</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listLoading ? (
                      <tr><td colSpan={8} className="text-center py-4 text-muted">Loading tickets...</td></tr>
                    ) : tickets.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-4 text-muted">No tickets found.</td></tr>
                    ) : (
                      tickets.map(t => (
                        <tr key={t.id}>
                          <td className="fw-semibold">{t.ticketNo}</td>
                          <td className="small text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div className="text-truncate" style={{ maxWidth: "240px" }}>{t.summary}</div>
                            {t.requesterResolvedIndication && (
                              <span className="badge bg-success-subtle text-success border border-success-subtle small mt-1">
                                <i className="bi bi-check2-circle me-1"></i> Problem Appears Resolved
                              </span>
                            )}
                          </td>
                          <td className="small">{t.category.name}</td>
                          <td><span className={getPriorityBadgeClass(t.itPriority || t.requestedPriority)}>{t.itPriority || t.requestedPriority}</span></td>
                          <td><span className={getStatusBadgeClass(t.currentStatus)}>{t.currentStatus}</span></td>
                          <td className="small">{t.owner ? t.owner.name : <span className="text-muted">Unassigned</span>}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => {
                                setDetailTicketId(t.id);
                                setScreen("detail");
                              }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Screen 4: Create Ticket View */}
        {screen === "create" && currentUser && (
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="card card-custom p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fw-bold text-green-primary mb-0">Create New Ticket</h4>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setScreen("list")}>Back to List</button>
                </div>

                {createError && (
                  <div className="alert alert-danger py-2 px-3 small" role="alert">
                    {createError}
                  </div>
                )}

                {createdTicketNo && (
                  <div className="alert alert-success">
                    <strong>Ticket Created Successfully!</strong> Ticket Number: <code>{createdTicketNo}</code>
                  </div>
                )}

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (createLoading) return;
                  setCreateLoading(true);
                  setCreateError("");
                  try {
                    const t = await createTicket({
                      categoryId: parseInt(newCategoryId, 10),
                      relatedSystem: newSystem,
                      requestedPriority: newPriority,
                      summary: newSummary,
                      description: newDescription,
                    });
                    setCreatedTicketNo(t.ticketNo);
                    setNewSummary("");
                    setNewDescription("");
                  } catch (err: any) {
                    setCreateError(err.message || "Failed to create ticket");
                  } finally {
                    setCreateLoading(false);
                  }
                }}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Category *</label>
                    <select className="form-select" value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Related System *</label>
                    <select className="form-select" value={newSystem} onChange={e => setNewSystem(e.target.value)} required>
                      <option value="">Select System</option>
                      {systems.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Requested Priority *</label>
                    <select className="form-select" value={newPriority} onChange={e => setNewPriority(e.target.value)} required>
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Summary *</label>
                    <input className="form-control" value={newSummary} onChange={e => setNewSummary(e.target.value)} placeholder="Brief summary of the issue" required />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description *</label>
                    <textarea className="form-control" rows={4} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detailed description of the problem" required></textarea>
                  </div>

                  <button type="submit" className="btn btn-green-primary" disabled={createLoading}>
                    {createLoading ? "Creating..." : "Submit Ticket"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Screen 5: Ticket Details View */}
        {screen === "detail" && currentUser && (
          <div>
            {detailLoading && (
              <div className="text-center py-5">
                <div className="spinner-border text-green-primary" role="status"></div>
                <p className="text-muted small mt-2">Loading ticket details...</p>
              </div>
            )}

            {detailError && (
              <div className="alert alert-danger p-3 my-3">
                {detailError}
                <div>
                  <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => { setDetailTicketId(null); setScreen("list"); }}>
                    Back to List
                  </button>
                </div>
              </div>
            )}

            {!detailLoading && ticketDetails && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h4 className="fw-bold text-green-primary mb-1">
                      Ticket Details: <span className="font-monospace">{ticketDetails.ticketNo}</span>
                    </h4>
                    <div className="d-flex align-items-center gap-2">
                      <span className={getStatusBadgeClass(ticketDetails.currentStatus)}>{ticketDetails.currentStatus}</span>
                      <span className={getPriorityBadgeClass(ticketDetails.itPriority || ticketDetails.requestedPriority)}>
                        Priority: {ticketDetails.itPriority || ticketDetails.requestedPriority}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-outline-secondary" onClick={() => { setDetailTicketId(null); setScreen("list"); }}>Back to List</button>
                </div>

                {workflowFeedback && (
                  <div className={`alert alert-${workflowFeedback.type} py-2 px-3 small mb-3 d-flex justify-content-between align-items-center`} role="alert">
                    <span>{workflowFeedback.message}</span>
                    <button type="button" className="btn-close btn-sm" aria-label="Close alert" onClick={() => setWorkflowFeedback(null)}></button>
                  </div>
                )}

            {/* IT Staff Operations Controls */}
            {(currentUser.role === "ITStaff" || currentUser.role === "Administrator") && (
              <div className="card card-custom p-3 mb-4 bg-light">
                <h6 className="fw-bold mb-3 text-green-primary">IT Staff Operations & Workflow Controls</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold" htmlFor="ownerSelect">Assignee / Owner</label>
                    <select
                      id="ownerSelect"
                      className="form-select form-select-sm"
                      value={ticketDetails.ownerId || ""}
                      disabled={workflowUpdating}
                      onChange={(e) => handleOwnerChange(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {itStaffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold" htmlFor="statusSelect">Update Status</label>
                    <select
                      id="statusSelect"
                      className="form-select form-select-sm"
                      value={ticketDetails.currentStatus}
                      disabled={workflowUpdating}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value={ticketDetails.currentStatus}>{ticketDetails.currentStatus} (Current)</option>
                      {(ALLOWED_STATUS_TRANSITIONS[ticketDetails.currentStatus] || []).map((nextSt) => (
                        <option key={nextSt} value={nextSt}>
                          &rarr; {nextSt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold" htmlFor="prioritySelect">Set IT Priority</label>
                    <select
                      id="prioritySelect"
                      className="form-select form-select-sm"
                      value={ticketDetails.itPriority || ticketDetails.requestedPriority}
                      disabled={workflowUpdating}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Requester Resolved Toggle */}
            {currentUser.role === "Requester" && (
              <div className="alert bg-green-pale border-success d-flex justify-content-between align-items-center mb-4">
                <div>
                  <strong>Resolution Status:</strong> {ticketDetails.requesterResolvedIndication ? "You indicated this problem appears resolved (Advisory — awaiting IT Staff review)." : "Problem not marked as resolved yet."}
                </div>
                <button
                  className={`btn btn-sm ${ticketDetails.requesterResolvedIndication ? "btn-outline-danger" : "btn-success"}`}
                  disabled={workflowUpdating}
                  onClick={handleIndicateResolvedToggle}
                >
                  {ticketDetails.requesterResolvedIndication ? "Remove Resolved Indication" : "Problem Appears Resolved"}
                </button>
              </div>
            )}

            {/* Read-Only Details Grid */}
            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <div className="card card-custom p-4 h-100">
                  <h6 className="fw-bold mb-3 border-bottom pb-2">Ticket Summary & Description</h6>
                  <div className="mb-3">
                    <label className="text-muted small">Summary</label>
                    <div className="fw-semibold">{ticketDetails.summary}</div>
                  </div>
                  <div className="mb-3">
                    <label className="text-muted small">Description</label>
                    <div className="bg-read-only p-3 rounded small text-break">{ticketDetails.description}</div>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-6"><span className="text-muted">Category:</span> {ticketDetails.category.name}</div>
                    <div className="col-6"><span className="text-muted">System:</span> {ticketDetails.relatedSystem}</div>
                    <div className="col-6"><span className="text-muted">Requester:</span> {ticketDetails.requester.name}</div>
                    <div className="col-6"><span className="text-muted">Owner:</span> {ticketDetails.owner ? ticketDetails.owner.name : "None"}</div>
                  </div>
                </div>
              </div>

              {/* Actions Taken Section (Lab 4 Core Feature) */}
              <div className="col-md-6">
                <div className="card actions-section h-100">
                  <div className="actions-header d-flex justify-content-between align-items-center">
                    <span><i className="bi bi-clipboard-check me-2"></i> Actions Taken (Work Tracker)</span>
                    <span className="badge bg-light text-primary">{actionsTakenList.length}</span>
                  </div>
                  <div className="card-body p-3 overflow-auto" style={{ maxHeight: "360px" }}>
                    {actionsTakenList.length === 0 ? (
                      <div className="text-muted small text-center py-4">No actions taken recorded yet.</div>
                    ) : (
                      actionsTakenList.map(a => (
                        <div key={a.id} className="border-bottom pb-2 mb-2">
                          <div className="d-flex justify-content-between align-items-center small">
                            <div>
                              <strong>{a.performedBy.name}</strong>{" "}
                              <span className="badge bg-light text-secondary border">{a.performedBy.role}</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="text-muted">{new Date(a.actionDateTime).toLocaleString()}</span>
                              {(currentUser.role === "ITStaff" || currentUser.role === "Administrator") && editingActionId !== a.id && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                                  onClick={() => handleStartEditAction(a)}
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {editingActionId === a.id ? (
                            <form onSubmit={handleSaveEditAction} className="mt-2 p-2 bg-light rounded border">
                              {editActionError && <div className="alert alert-danger py-1 px-2 small mb-2">{editActionError}</div>}
                              <div className="mb-2">
                                <label className="form-label small fw-semibold mb-1">Action Description *</label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={2}
                                  value={editActionDescription}
                                  onChange={(e) => setEditActionDescription(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="row g-2 mb-2">
                                <div className="col-6">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Result..."
                                    value={editActionResult}
                                    onChange={(e) => setEditActionResult(e.target.value)}
                                  />
                                </div>
                                <div className="col-6">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Attachment notes..."
                                    value={editActionAttachmentNotes}
                                    onChange={(e) => setEditActionAttachmentNotes(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="form-check mb-2">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id={`editFollowUp-${a.id}`}
                                  checked={editActionFollowUpRequired}
                                  onChange={(e) => setEditActionFollowUpRequired(e.target.checked)}
                                />
                                <label className="form-check-label small" htmlFor={`editFollowUp-${a.id}`}>Follow-up Required?</label>
                              </div>
                              {editActionFollowUpRequired && (
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Follow-up note (required)..."
                                    value={editActionFollowUpNote}
                                    onChange={(e) => setEditActionFollowUpNote(e.target.value)}
                                    required
                                  />
                                </div>
                              )}
                              <div className="d-flex gap-2">
                                <button type="submit" className="btn btn-sm btn-primary" disabled={editActionSubmitting}>
                                  {editActionSubmitting ? "Saving..." : "Save Action"}
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingActionId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="small mt-1">{a.actionDescription}</div>
                              {a.result && <div className="small text-muted fst-italic mt-1">Result: {a.result}</div>}
                              {a.followUpRequired && (
                                <div className="badge bg-warning text-dark mt-1 me-1">
                                  Follow-Up: {a.followUpNote}
                                </div>
                              )}
                              {a.attachmentNotes && (
                                <div className="small text-secondary mt-1">
                                  <i className="bi bi-paperclip me-1"></i> {a.attachmentNotes}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Action Taken Form for IT Staff / Admin */}
                  {(currentUser.role === "ITStaff" || currentUser.role === "Administrator") && (
                    <div className="card-footer bg-white border-top p-3">
                      {actionError && <div className="alert alert-danger py-1 px-2 small">{actionError}</div>}
                      <form onSubmit={handleAddActionTaken}>
                        <div className="mb-2">
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            placeholder="Record action taken description..."
                            value={actionDescription}
                            onChange={(e) => setActionDescription(e.target.value)}
                            required
                          />
                        </div>
                        <div className="row g-2 mb-2">
                          <div className="col-6">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Result (e.g. fixed/tested)"
                              value={actionResult}
                              onChange={(e) => setActionResult(e.target.value)}
                            />
                          </div>
                          <div className="col-6">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Attachment notes..."
                              value={actionAttachmentNotes}
                              onChange={(e) => setActionAttachmentNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="followUpCheck"
                            checked={actionFollowUpRequired}
                            onChange={(e) => setActionFollowUpRequired(e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="followUpCheck">Follow-up Required?</label>
                        </div>
                        {actionFollowUpRequired && (
                          <div className="mb-2">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Follow-up note (required)..."
                              value={actionFollowUpNote}
                              onChange={(e) => setActionFollowUpNote(e.target.value)}
                              required
                            />
                          </div>
                        )}
                        <button type="submit" className="btn btn-sm btn-primary" disabled={actionSubmitting}>
                          {actionSubmitting ? "Recording..." : "Record Action"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Public Comments & Internal Notes Grid */}
            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <div className="card comments-section">
                  <div className="comments-header">💬 Public Comments (Shared communication)</div>
                  <div className="card-body p-3 overflow-auto" style={{ maxHeight: "280px" }}>
                    {comments.length === 0 ? (
                      <div className="text-muted small text-center py-3">No public comments yet.</div>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="border-bottom pb-2 mb-2">
                          <div className="d-flex justify-content-between small">
                            <strong>{c.author.name} <span className="badge bg-light text-dark">{c.author.role}</span></strong>
                            <span className="text-muted">{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="small mt-1">{c.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="card-footer bg-white p-2">
                    {commentError && <div className="alert alert-danger py-1 px-2 small mb-2">{commentError}</div>}
                    <form onSubmit={handleCommentSubmit} className="d-flex gap-2">
                      <input className="form-control form-control-sm" placeholder="Write a public comment..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                      <button className="btn btn-sm btn-green-primary" type="submit" disabled={commentSubmitting}>
                        {commentSubmitting ? "Posting..." : "Post"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {(currentUser.role === "ITStaff" || currentUser.role === "Administrator") && (
                <div className="col-md-6">
                  <div className="card notes-section">
                    <div className="notes-header">🔒 Internal Notes (Visible to IT Staff & Admin Only)</div>
                    <div className="card-body p-3 overflow-auto" style={{ maxHeight: "280px" }}>
                      {internalNotes.length === 0 ? (
                        <div className="text-muted small text-center py-3">No internal notes recorded yet.</div>
                      ) : (
                        internalNotes.map(n => (
                          <div key={n.id} className="border-bottom pb-2 mb-2">
                            <div className="d-flex justify-content-between small">
                              <strong>{n.author.name} <span className="badge bg-warning text-dark">{n.author.role}</span></strong>
                              <span className="text-muted">{new Date(n.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <div className="small mt-1">{n.content}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="card-footer bg-white p-2">
                      {noteError && <div className="alert alert-danger py-1 px-2 small mb-2">{noteError}</div>}
                      <form onSubmit={handleNoteSubmit} className="d-flex gap-2">
                        <input className="form-control form-control-sm" placeholder="Write an internal note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                        <button className="btn btn-sm btn-warning text-dark" type="submit" disabled={noteSubmitting}>
                          {noteSubmitting ? "Adding..." : "Add Note"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

        {/* Screen 6: Administrator User Management */}
        {screen === "admin_users" && currentUser && currentUser.role === "Administrator" && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h4 fw-bold text-green-primary mb-0">User Accounts Management</h2>
              <button className="btn btn-green-primary" onClick={() => {
                setShowCreateUserForm(true);
                setEditingUser(null);
                setResettingUserPassword(null);
                setAdminFormName("");
                setAdminFormEmail("");
                setAdminFormRole("Requester");
                setAdminFormInitialPassword("password123");
              }}>
                <i className="bi bi-person-plus me-1"></i> Create New User
              </button>
            </div>

            <div className="row g-4">
              <div className="col-md-8">
                <div className="card card-custom p-3 mb-3">
                  <div className="row g-2">
                    <div className="col-md-7">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search users by name or email..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                      />
                    </div>
                    <div className="col-md-5">
                      <select
                        className="form-select form-select-sm"
                        value={adminFilterRole}
                        onChange={(e) => setAdminFilterRole(e.target.value)}
                      >
                        <option value="All Roles">All Roles</option>
                        <option value="Requester">Requester</option>
                        <option value="ITStaff">ITStaff</option>
                        <option value="Administrator">Administrator</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card card-custom p-0 overflow-hidden shadow-sm">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminLoading ? (
                        <tr><td colSpan={5} className="text-center py-4">Loading users...</td></tr>
                      ) : adminUsers.map(u => (
                        <tr key={u.id}>
                          <td className="fw-semibold">{u.name}</td>
                          <td className="small">{u.email}</td>
                          <td><span className="badge bg-light text-dark border">{u.role}</span></td>
                          <td>
                            <span className={`badge ${u.isActive ? "bg-success" : "bg-danger"}`}>
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => {
                                setEditingUser(u);
                                setShowCreateUserForm(false);
                                setResettingUserPassword(null);
                                setAdminFormName(u.name);
                                setAdminFormEmail(u.email);
                                setAdminFormRole(u.role);
                                setAdminFormIsActive(u.isActive);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-warning text-dark"
                              onClick={() => {
                                setResettingUserPassword(u);
                                setShowCreateUserForm(false);
                                setEditingUser(null);
                                setAdminFormNewPassword("");
                              }}
                            >
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Drawer */}
              <div className="col-md-4">
                {showCreateUserForm && (
                  <div className="card card-custom p-4 border-success">
                    <h5 className="fw-bold text-green-primary mb-3">Create User Account</h5>
                    {adminFormError && <div className="alert alert-danger small py-2">{adminFormError}</div>}
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setAdminFormLoading(true);
                      try {
                        await createAdminUser({
                          name: adminFormName,
                          email: adminFormEmail,
                          role: adminFormRole,
                          isActive: true,
                          initialPassword: adminFormInitialPassword,
                        });
                        setShowCreateUserForm(false);
                        loadAdminUsersList();
                      } catch (err: any) {
                        setAdminFormError(err.message || "Failed to create user");
                      } finally {
                        setAdminFormLoading(false);
                      }
                    }}>
                      <div className="mb-2">
                        <label className="form-label small">Name *</label>
                        <input className="form-control form-control-sm" value={adminFormName} onChange={e => setAdminFormName(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small">Email *</label>
                        <input type="email" className="form-control form-control-sm" value={adminFormEmail} onChange={e => setAdminFormEmail(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small">Role *</label>
                        <select className="form-select form-select-sm" value={adminFormRole} onChange={e => setAdminFormRole(e.target.value)}>
                          <option value="Requester">Requester</option>
                          <option value="ITStaff">ITStaff</option>
                          <option value="Administrator">Administrator</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label small">Initial Password *</label>
                        <input className="form-control form-control-sm" value={adminFormInitialPassword} onChange={e => setAdminFormInitialPassword(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn btn-sm btn-green-primary w-100" disabled={adminFormLoading}>Create User</button>
                    </form>
                  </div>
                )}

                {editingUser && (
                  <div className="card card-custom p-4 border-primary">
                    <h5 className="fw-bold text-primary mb-3">Edit User: {editingUser.name}</h5>
                    {adminFormError && <div className="alert alert-danger small py-2">{adminFormError}</div>}
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setAdminFormLoading(true);
                      try {
                        await updateAdminUser(editingUser.id, {
                          name: adminFormName,
                          email: adminFormEmail,
                          role: adminFormRole,
                          isActive: adminFormIsActive,
                        });
                        setEditingUser(null);
                        loadAdminUsersList();
                      } catch (err: any) {
                        setAdminFormError(err.message || "Failed to update user");
                      } finally {
                        setAdminFormLoading(false);
                      }
                    }}>
                      <div className="mb-2">
                        <label className="form-label small">Name</label>
                        <input className="form-control form-control-sm" value={adminFormName} onChange={e => setAdminFormName(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small">Email</label>
                        <input type="email" className="form-control form-control-sm" value={adminFormEmail} onChange={e => setAdminFormEmail(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small">Role</label>
                        <select className="form-select form-select-sm" value={adminFormRole} onChange={e => setAdminFormRole(e.target.value)}>
                          <option value="Requester">Requester</option>
                          <option value="ITStaff">ITStaff</option>
                          <option value="Administrator">Administrator</option>
                        </select>
                      </div>
                      <div className="form-check mb-3">
                        <input type="checkbox" className="form-check-input" id="activeCheck" checked={adminFormIsActive} onChange={e => setAdminFormIsActive(e.target.checked)} />
                        <label className="form-check-label small" htmlFor="activeCheck">Active Account</label>
                      </div>
                      <button type="submit" className="btn btn-sm btn-primary w-100" disabled={adminFormLoading}>Save Changes</button>
                    </form>
                  </div>
                )}

                {resettingUserPassword && (
                  <div className="card card-custom p-4 border-warning">
                    <h5 className="fw-bold text-dark mb-3">Reset Password</h5>
                    <p className="small text-muted">User: <strong>{resettingUserPassword.email}</strong></p>
                    {adminFormError && <div className="alert alert-danger small py-2">{adminFormError}</div>}
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setAdminFormLoading(true);
                      try {
                        await resetUserPassword(resettingUserPassword.id, adminFormNewPassword);
                        setResettingUserPassword(null);
                        loadAdminUsersList();
                      } catch (err: any) {
                        setAdminFormError(err.message || "Failed to reset password");
                      } finally {
                        setAdminFormLoading(false);
                      }
                    }}>
                      <div className="mb-3">
                        <label className="form-label small">New Initial Password *</label>
                        <input className="form-control form-control-sm" value={adminFormNewPassword} onChange={e => setAdminFormNewPassword(e.target.value)} placeholder="Enter new password" required />
                      </div>
                      <button type="submit" className="btn btn-sm btn-warning text-dark w-100" disabled={adminFormLoading}>Reset & Force Change</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
