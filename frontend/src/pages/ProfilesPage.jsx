import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteGroup, deleteProfile, listGroups, listProfiles } from "../api/profiles";
import GroupModal from "../components/GroupModal";

// ─────────────────────────────────────────────────────────────────────────────
// ProfileCard
// ─────────────────────────────────────────────────────────────────────────────

function ProfileCard({ profile, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProfile(profile.id);
      onDeleted(profile.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  const topCount    = profile.notes_by_layer?.top?.length    ?? 0;
  const middleCount = profile.notes_by_layer?.middle?.length ?? 0;
  const baseCount   = profile.notes_by_layer?.base?.length   ?? 0;

  return (
    <div className="rounded-xl card-neon p-4 flex flex-col gap-3
                    transition-shadow duration-150">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif font-semibold text-brand-950 truncate">{profile.name}</p>
          <p className="text-xs text-brand-700 truncate">{profile.brand}</p>
        </div>
        {profile.link && (
          <a
            href={profile.link}
            target="_blank"
            rel="noopener noreferrer"
            title="Open link"
            className="text-brand-700/50 hover:text-gold transition-colors shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        )}
      </div>

      {/* Note counts */}
      <div className="flex gap-2 text-xs">
        {[
          { label: "Top",  count: topCount    },
          { label: "Mid",  count: middleCount },
          { label: "Base", count: baseCount   },
        ].map(({ label, count }) => (
          <span
            key={label}
            className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium"
          >
            {label} {count}
          </span>
        ))}
      </div>

      {/* Actions */}
      {confirming ? (
        <div className="flex items-center gap-2 pt-1 border-t border-brand-100">
          <span className="text-xs text-red-600 flex-1">Delete this profile?</span>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-brand-700 hover:text-brand-950"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 font-semibold hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : (
        <div className="flex gap-3 pt-1 border-t border-brand-100">
          <Link
            to={`/profiles/${profile.id}/edit`}
            className="text-xs text-brand-700 hover:text-brand-950 font-medium
                       transition-colors duration-150"
          >
            Edit
          </Link>
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-red-500 hover:text-red-700 transition-colors duration-150"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfilesPage
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const [groups,   setGroups]   = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Group modal (create / edit)
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup,   setEditingGroup]   = useState(null);   // group object | null

  // Group delete confirm
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null); // group object | null
  const [deletingGroupId,    setDeletingGroupId]    = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listGroups(), listProfiles()])
      .then(([g, p]) => { setGroups(g); setProfiles(p); })
      .catch(() => setError("Could not load profiles."))
      .finally(() => setLoading(false));
  }, []);

  // ── Profile handlers ────────────────────────────────────────────────────────
  function onProfileDeleted(profileId) {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
  }

  // ── Group handlers ──────────────────────────────────────────────────────────
  function openCreateGroup() {
    setEditingGroup(null);
    setShowGroupModal(true);
  }

  function openEditGroup(group) {
    setEditingGroup(group);
    setShowGroupModal(true);
  }

  function onGroupSaved(savedGroup) {
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === savedGroup.id);
      const updated = exists
        ? prev.map((g) => (g.id === savedGroup.id ? savedGroup : g))
        : [...prev, savedGroup];
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
    setShowGroupModal(false);
    setEditingGroup(null);
  }

  async function handleGroupDelete(group) {
    setDeletingGroupId(group.id);
    try {
      await deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      // Remove all profiles that belonged to this group
      setProfiles((prev) => prev.filter((p) => p.group?.id !== group.id));
    } catch {
      // ignore — keep state as-is
    } finally {
      setDeletingGroupId(null);
      setConfirmDeleteGroup(null);
    }
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <span className="w-8 h-8 border-4 border-brand-200 border-t-gold rounded-full animate-spin" />
      </main>
    );
  }

  const totalProfiles = profiles.length;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-white drop-shadow-lg">My Profiles</h2>
          <p className="text-white/70 mt-1 text-sm drop-shadow">
            Custom fragrance profiles, organised into groups for intergroup comparison.
          </p>
        </div>
        <Link
          to="/profiles/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                     bg-brand-900 text-white font-semibold text-sm tracking-wide
                     shadow-sm hover:bg-brand-800 active:scale-95
                     transition-all duration-150 whitespace-nowrap shrink-0"
        >
          + New Profile
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── My Groups section ── */}
      <section className="flex flex-col gap-6">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl font-bold text-white drop-shadow">My Groups</h3>
            <p className="text-xs text-white/60 mt-0.5">
              {groups.length === 0
                ? "No groups yet — create one to start organising profiles."
                : `${groups.length} group${groups.length !== 1 ? "s" : ""} · ${totalProfiles} profile${totalProfiles !== 1 ? "s" : ""} total`}
            </p>
          </div>
          <button
            onClick={openCreateGroup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                       border border-brand-300 bg-white text-brand-900 text-sm font-semibold
                       hover:bg-brand-50 hover:border-brand-400 active:scale-95
                       transition-all duration-150 whitespace-nowrap shrink-0"
          >
            + New Group
          </button>
        </div>

        {/* Empty state — no groups at all */}
        {!error && groups.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-white/50 animate-fade-in">
            <svg className="w-14 h-14 opacity-30" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="10" width="36" height="28" rx="3" />
              <path d="M16 10V6M32 10V6M6 20h36" strokeLinecap="round" />
            </svg>
            <div className="text-center">
              <p className="font-serif text-xl text-white/70 mb-1">No groups yet</p>
              <p className="text-sm max-w-xs">
                Start by creating a group, then add profiles to it for intergroup comparison.
              </p>
              <button
                onClick={openCreateGroup}
                className="inline-block mt-4 px-6 py-2 rounded-full bg-brand-900 text-white
                           text-sm font-semibold hover:bg-brand-800 transition-colors duration-150"
              >
                Create first group
              </button>
            </div>
          </div>
        )}

        {/* Groups list */}
        {groups.map((group) => {
          const groupProfiles = profiles.filter((p) => p.group?.id === group.id);
          const isConfirming  = confirmDeleteGroup?.id === group.id;
          const isDeleting    = deletingGroupId === group.id;

          return (
            <div
              key={group.id}
              className="rounded-2xl card-neon overflow-hidden"
            >
              {/* Group header */}
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-brand-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h4 className="font-serif text-lg font-bold text-brand-950">{group.name}</h4>
                    <span className="text-xs text-brand-700/50">
                      {groupProfiles.length} profile{groupProfiles.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-xs text-brand-700/60 italic mt-0.5">{group.description}</p>
                  )}
                </div>

                {/* Group actions */}
                {isConfirming ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-red-600">
                      {groupProfiles.length > 0
                        ? `Delete group + ${groupProfiles.length} profile${groupProfiles.length !== 1 ? "s" : ""}?`
                        : "Delete this group?"}
                    </span>
                    <button
                      onClick={() => setConfirmDeleteGroup(null)}
                      className="text-xs text-brand-700 hover:text-brand-950"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleGroupDelete(group)}
                      disabled={isDeleting}
                      className="text-xs text-red-600 font-semibold hover:text-red-800
                                 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting…" : "Confirm"}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => openEditGroup(group)}
                      className="text-xs text-brand-700 hover:text-brand-950 font-medium
                                 transition-colors duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDeleteGroup(group)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors duration-150"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Group profiles */}
              <div className="p-5">
                {groupProfiles.length === 0 ? (
                  <p className="text-sm text-brand-700/40 italic py-1">
                    No profiles in this group yet.{" "}
                    <Link
                      to="/profiles/new"
                      className="text-brand-700 hover:text-brand-950 underline underline-offset-2"
                    >
                      Add one →
                    </Link>
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {groupProfiles.map((p) => (
                      <ProfileCard key={p.id} profile={p} onDeleted={onProfileDeleted} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Group modal (create / edit) ── */}
      {showGroupModal && (
        <GroupModal
          initialGroup={editingGroup}
          onCreated={onGroupSaved}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
        />
      )}
    </main>
  );
}
