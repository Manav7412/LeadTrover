"use client";

// A Delete button that asks "are you sure?" first. Used for contacts and deals.
export default function DeleteContactButton({ action, label = "contact" }: { action: () => Promise<void>; label?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Delete this ${label}? This can't be undone.`)) e.preventDefault(); }}>
      <button className="btn-secondary !text-red-600 hover:!bg-red-50">Delete</button>
    </form>
  );
}
