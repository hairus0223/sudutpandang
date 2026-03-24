"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/env";

export function RegisterForm({
  onRegistered,
}: {
  onRegistered?: (user: string) => void;
}) {
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPeople, setRegPeople] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    if (!regName || !regPhone || !regPeople) {
      setMessage("Semua field wajib diisi.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          peopleCount: Number(regPeople),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error("Register failed");
      }

      setMessage("Registrasi berhasil! Silakan Check Photo.");

      // ⬇️ kirim userId ke parent (optional)
      onRegistered?.(data.customer.user);

      setRegName("");
      setRegPhone("");
      setRegPeople("");
    } catch (err) {
      console.error(err);
      setMessage("Gagal registrasi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg mt-6 p-4 border border-white/30 rounded-lg items-start">
      <h1 className="text-[#B49240] font-extrabold">
        Registrasi
      </h1>

      <input
        type="text"
        placeholder="Nama..."
        className="border-2 border-white/30 rounded p-3 text-white bg-transparent w-full"
        value={regName}
        onChange={(e) => setRegName(e.target.value)}
      />

      <input
        type="text"
        placeholder="Nomor Telepon..."
        className="border-2 border-white/30 rounded p-3 text-white bg-transparent w-full"
        value={regPhone}
        onChange={(e) => setRegPhone(e.target.value)}
      />

      <input
        type="number"
        placeholder="Jumlah Orang..."
        className="border-2 border-white/30 rounded p-3 text-white bg-transparent w-full"
        value={regPeople}
        onChange={(e) => setRegPeople(e.target.value)}
      />

      <button
        onClick={handleRegister}
        disabled={loading}
        className="px-4 py-3 w-full rounded bg-white font-semibold disabled:opacity-50"
      >
        {loading ? "Mendaftarkan..." : "Registrasi"}
      </button>

      {message && (
        <p className="text-white/80 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
