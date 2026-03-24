import Image from "next/image";
import Bridge from "@/components/icons/Bridge";
import lightLogo from "@/assets/light-logo.png";

type InfoCardProps = {
  userName: string;
};

export function InfoCard({ userName }: InfoCardProps) {
  return (
    <div
      className="relative mb-5 flex h-[620px] flex-col items-center
                 justify-end overflow-hidden rounded-lg
                 bg-white/10 px-6 pb-14 pt-64 text-center text-white
                 shadow-highlight"
    >
      {/* BACKGROUND ICON */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Bridge />
        <div className="absolute bottom-0 left-0 right-0 h-64
                        bg-gradient-to-b from-transparent to-black" />
      </div>

      {/* LOGO */}
      <Image
        src={lightLogo}
        alt="Studio Logo"
        priority
        className="h-12 w-auto"
      />

      {/* TITLE */}
      <h1 className="mt-6 mb-3 text-sm font-bold uppercase tracking-widest">
        <u>{userName}</u> Event Photos
      </h1>

      {/* CAPTION */}
      <p className="max-w-[38ch] text-sm text-white/80">
        📸 Setiap momen itu unik — sama seperti kamu.
        Terima kasih sudah foto di studio kami,
        sampai ketemu di sesi berikutnya ✨
      </p>
    </div>
  );
}
