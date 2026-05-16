"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Option {
  id: string;
  name: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: Option[];
  onCreated: (option: Option) => void;
  onUpdated?: (option: Option) => void;
  onDeleted?: (id: string) => void;
  createEndpoint: string;
  deleteEndpointBase?: string;
  updateEndpointBase?: string;
  placeholder?: string;
  createBody?: Record<string, unknown>;
  disableCreate?: boolean;
  disableCreateReason?: string;
  disableSelect?: boolean;
  disableDelete?: boolean;
  disableDeleteReason?: string;
  disableEdit?: boolean;
  disableEditReason?: string;
}

export default function SelectWithCreate({
  label,
  value,
  onChange,
  options,
  onCreated,
  onUpdated,
  onDeleted,
  createEndpoint,
  deleteEndpointBase,
  updateEndpointBase,
  placeholder = "— None —",
  createBody,
  disableCreate = false,
  disableCreateReason,
  disableSelect = false,
  disableDelete = false,
  disableDeleteReason,
  disableEdit = false,
  disableEditReason,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = options.find((o) => o.id === value);
  const updateBase = updateEndpointBase ?? deleteEndpointBase;

  function closeInlineForms() {
    setCreating(false);
    setEditing(false);
    setNewName("");
    setEditName("");
  }

  async function create() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(createEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), ...(createBody ?? {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      const option: Option = { id: data.id, name: data.name };
      onCreated(option);
      onChange(data.id);
      closeInlineForms();
      toast.success(`"${data.name}" created`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!updateBase || !value || !selected) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed === selected.name) {
      closeInlineForms();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${updateBase}/${value}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      const option: Option = { id: data.id, name: data.name };
      onUpdated?.(option);
      closeInlineForms();
      toast.success(`"${option.name}" updated`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (!selected) return;
    setCreating(false);
    setNewName("");
    setEditing(true);
    setEditName(selected.name);
  }

  async function removeSelected() {
    if (!deleteEndpointBase || !value || !selected) return;
    const ok = window.confirm(`Delete "${selected.name}" from ${label}?`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`${deleteEndpointBase}/${value}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Failed to delete");
      onDeleted?.(value);
      onChange("");
      closeInlineForms();
      toast.success(`"${selected.name}" removed`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-dark">{label}</span>
        <div className="flex items-center gap-2">
          {updateBase ? (
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-dark-3 hover:text-dark hover:underline disabled:text-meta-4 disabled:no-underline"
              disabled={disableEdit || saving || deleting || !value}
              title={disableEdit ? disableEditReason : !value ? `Select ${label.toLowerCase()} first` : undefined}
            >
              Edit
            </button>
          ) : null}
          {deleteEndpointBase ? (
            <button
              type="button"
              onClick={removeSelected}
              className="text-xs text-red-600 hover:underline disabled:text-meta-4 disabled:no-underline"
              disabled={disableDelete || deleting || !value}
              title={disableDelete ? disableDeleteReason : !value ? `Select ${label.toLowerCase()} first` : undefined}
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (creating) {
                setCreating(false);
                setNewName("");
              } else {
                setEditing(false);
                setEditName("");
                setCreating(true);
              }
            }}
            className="text-xs text-blue hover:underline disabled:text-meta-4 disabled:no-underline"
            disabled={disableCreate}
            title={disableCreate ? disableCreateReason : undefined}
          >
            {creating ? "Cancel" : "+ New"}
          </button>
        </div>
      </div>

      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), create())}
            placeholder={`New ${label.toLowerCase()} name`}
            className="flex-1 rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <button
            type="button"
            onClick={create}
            disabled={saving || !newName.trim()}
            className="rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {saving ? "…" : "Add"}
          </button>
        </div>
      ) : editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveEdit())}
            placeholder={`${label} name`}
            className="flex-1 rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <button
            type="button"
            onClick={() => closeInlineForms()}
            className="rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-medium text-meta-3 hover:bg-gray-1 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving || !editName.trim()}
            className="rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            closeInlineForms();
            onChange(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          disabled={disableSelect}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
