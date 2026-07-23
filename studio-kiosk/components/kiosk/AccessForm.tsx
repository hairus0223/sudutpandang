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
      className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-white/15 bg-black/40 p-5 sm:p-6"
    >
      <div>
        <h1 className="text-[#B59240] text-xl font-extrabold tracking-wide">
          Akses Foto
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Masukkan nama folder customer (sama seperti saat registrasi).
        </p>
      </div>

      <input
        type="text"
        className="min-h-11 rounded-md border border-white/20 bg-white/5 p-3 text-white placeholder:text-white/35"
        placeholder="Nama customer…"
        value={user}
        onChange={(e) => setUser(e.target.value)}
      />

      <button
        type="submit"
        className="min-h-11 rounded-lg bg-[#B59240] py-3 font-semibold text-black hover:bg-[#C9A855]"
      >
        Buka Galeri
      </button>
    </form>
  );
}
