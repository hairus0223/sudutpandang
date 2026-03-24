"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccessForm() {
  const router = useRouter();
  const [user, setUser] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const value = user.trim();
    if (!value) return;

    router.push(`/gallery?user=${encodeURIComponent(value)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-3 border border-white/30 rounded-lg p-4"
    >
      <h1 className="text-[#B49240] font-extrabold">
        Akses Photo
      </h1>

      <input
        type="text"
        className="border-2 border-white/30 rounded p-3 text-white bg-transparent"
        placeholder="Masukkan ID / Nama..."
        value={user}
        onChange={(e) => setUser(e.target.value)}
      />

      <button
        type="submit"
        className="rounded bg-white py-3 font-semibold"
      >
        Check Photo
      </button>
    </form>
  );
}
