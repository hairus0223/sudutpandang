"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen } from "lucide-react";

export function AccessForm() {
  const router = useRouter();
  const [user, setUser] = useState("");

  const trimmed = user.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;

    router.push(`/gallery?user=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-5 rounded-2xl border border-white/12 bg-[#111] p-5 shadow-2xl sm:p-6"
    >
      <div className="flex items-start gap-3 pr-12">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#B59240]/15 text-[#E8C872]">
          <FolderOpen className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-wide text-[#E8C872]">
            Akses Foto
          </h2>
          <p className="mt-0.5 text-sm leading-snug text-white/50">
            Masukkan nama customer sesuai saat registrasi.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="access-user" className="text-xs font-medium text-white/55">
          Nama customer
        </label>
        <input
          id="access-user"
          type="text"
          autoFocus
          autoComplete="off"
          className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#B59240]/60 focus:bg-white/[0.07]"
          placeholder="Contoh: neneng"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={!trimmed}
        className="min-h-12 rounded-xl bg-[#B59240] font-semibold text-black transition hover:bg-[#C9A855] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
      >
        Buka Galeri
      </button>
    </form>
  );
}
