import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useOutletContext } from "react-router";
import {
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "@/api/projects";
import { searchUsers } from "@/api/users";
import { PaginatedTable } from "@/components/shared/PaginatedTable";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MemberRoleSelect,
  MemberRemoveButton,
} from "@/components/project/MemberRow";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/date";
import type { Column, PaginationState } from "@/components/shared/PaginatedTable";
import type { ProjectMemberOutput } from "@/types/project";
import type { UserSearchResult } from "@/types/user";
import type { ProjectContext } from "./_app.projects.$projectId";

export default function ProjectMembersPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { project } = useOutletContext<ProjectContext>();

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";
  const isCreator = (userId: number) => userId === project.created_by_id;

  // Member list state
  const [members, setMembers] = useState<ProjectMemberOutput[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    count: 0,
    limit: 20,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add member form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null
  );
  const [addRole, setAddRole] = useState<"worker" | "supervisor">("worker");
  const [addingMember, setAddingMember] = useState(false);

  // Row action state
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<number | null>(
    null
  );
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { confirm, ConfirmDialog } = useConfirm();

  // Fetch members
  const fetchMembers = useCallback(
    async (offset: number, limit: number) => {
      setLoading(true);
      setError("");
      try {
        const data = await getMembers(id, { limit, offset });
        setMembers(data.items);
        setPagination({
          count: data.count,
          limit: data.limit,
          offset: data.offset,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchMembers(0, pagination.limit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePageChange(offset: number, limit: number) {
    fetchMembers(offset, limit);
  }

  // Debounced user search
  function handleSearch(query: string) {
    setSearchQuery(query);
    setSearchError("");
    setSelectedUser(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchUsers({ q: query, limit: 10 });
        setSearchResults(data.items);
      } catch (err: unknown) {
        setSearchError(
          err instanceof Error ? err.message : "Search failed"
        );
        setSearchResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Click-outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectUser(user: UserSearchResult) {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
    setSearchError("");
  }

  async function handleAddMember() {
    if (!selectedUser) return;
    setAddingMember(true);
    try {
      await addMember(id, { user_id: selectedUser.id, role: addRole });
      toast.success(`${selectedUser.username} added as ${addRole}`);
      fetchMembers(pagination.offset, pagination.limit);
      // Reset form
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      setAddRole("worker");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add member";
      toast.error(msg);
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    setRoleUpdatingUserId(userId);
    try {
      await updateMemberRole(id, userId, { role: newRole });
      toast.success("Role updated");
      fetchMembers(pagination.offset, pagination.limit);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update role";
      toast.error(msg);
    } finally {
      setRoleUpdatingUserId(null);
    }
  }

  async function handleRemoveMember(userId: number) {
    const member = members.find((m) => m.user_id === userId);
    const confirmed = await confirm({
      title: "Remove Member",
      message: member
        ? `Remove ${member.username} from this project?`
        : "Remove this member?",
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    setRemovingUserId(userId);
    try {
      await removeMember(id, userId);
      toast.success(member ? `${member.username} removed` : "Member removed");
      fetchMembers(pagination.offset, pagination.limit);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to remove member";
      toast.error(msg);
    } finally {
      setRemovingUserId(null);
    }
  }

  const columns: Column<ProjectMemberOutput>[] = [
    {
      key: "username",
      header: "Username",
      render: (m) => (
        <span className="font-medium text-foreground">
          {m.username}
          {isCreator(m.user_id) && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              (creator)
            </span>
          )}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (m) => (
        <span className="text-muted-foreground">{m.email}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => (
        <MemberRoleSelect
          member={m}
          isCreator={isCreator(m.user_id)}
          disabled={roleUpdatingUserId === m.user_id}
          onChange={handleRoleChange}
        />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      render: (m) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(m.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (m) => (
        <MemberRemoveButton
          member={m}
          isCreator={isCreator(m.user_id)}
          disabled={removingUserId === m.user_id}
          onRemove={handleRemoveMember}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Worker banner — defense in depth */}
      {!isSupervisor && (
        <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Your role is worker. Membership management is restricted to
          supervisors.
        </div>
      )}

      {/* Header + Add button */}
      {isSupervisor && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Members ({pagination.count})
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setShowAddForm(true);
              // Reset form state
              setSearchQuery("");
              setSearchResults([]);
              setSelectedUser(null);
              setSearchError("");
            }}
          >
            Add Member
          </Button>
        </div>
      )}

      {/* Add member modal */}
      <Dialog
        open={showAddForm}
        onOpenChange={(next) => {
          if (!next) {
            setShowAddForm(false);
            setSearchQuery("");
            setSearchResults([]);
            setSelectedUser(null);
            setSearchError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {/* Search input */}
            <div ref={searchContainerRef} className="relative">
              <Field>
                <FieldLabel htmlFor="member-search">
                  Search users by username
                </FieldLabel>
                <Input
                  id="member-search"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Type a username..."
                  disabled={addingMember}
                />
              </Field>

              {/* Search results */}
              {searchQuery && !selectedUser && (
                <div className="mt-1 w-full rounded-md border bg-card shadow-lg max-h-48 overflow-y-auto">
                  {searchingUsers && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Searching...
                    </div>
                  )}
                  {!searchingUsers &&
                    searchResults.length > 0 &&
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col"
                      >
                        <span className="font-medium">{user.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </button>
                    ))}
                  {!searchingUsers &&
                    searchResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No users found
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Role selection (only after user is selected) */}
            {selectedUser && (
              <Field>
                <FieldLabel htmlFor="member-role">Role</FieldLabel>
                <Select
                  value={addRole}
                  onValueChange={(v) =>
                    setAddRole(v as "worker" | "supervisor")
                  }
                  disabled={addingMember}
                >
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {searchError && (
              <p className="text-xs text-destructive">{searchError}</p>
            )}

            {/* Selection summary */}
            {selectedUser && (
              <p className="text-sm text-muted-foreground">
                Adding{" "}
                <span className="font-medium text-foreground">
                  {selectedUser.username}
                </span>
                {selectedUser.email && <> ({selectedUser.email})</>} as{" "}
                <span className="font-medium text-foreground capitalize">
                  {addRole}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setSearchQuery("");
                setSearchResults([]);
                setSelectedUser(null);
                setSearchError("");
              }}
              disabled={addingMember}
            >
              Cancel
            </Button>
            {selectedUser && (
              <Button
                type="button"
                onClick={handleAddMember}
                disabled={addingMember}
              >
                {addingMember ? "Adding..." : `Add as ${addRole}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member list error */}
      {error && (
        <ErrorAlert
          message={error}
          onRetry={() => fetchMembers(pagination.offset, pagination.limit)}
        />
      )}

      {/* Initial loading */}
      {loading && members.length === 0 && !error && (
        <SkeletonTable rows={4} />
      )}

      {/* Member table */}
      {(!loading || members.length > 0) && !error && (
        <PaginatedTable
          columns={columns}
          rows={members}
          pagination={pagination}
          onPageChange={handlePageChange}
          isLoading={loading && members.length > 0}
          getRowKey={(m) => String(m.user_id)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}
