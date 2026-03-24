import Image from "next/image";
import banner from "@/assets/banner.jpg";
import { HeadlineGallery } from "@/components/kiosk/HeadlineGallery";

export default function HomePage() {
  return (
    <main className="flex flex-col lg:flex-row h-screen w-full bg-black min-h-0">
      {/* LEFT — gallery: full width on mobile, 3/5 on web */}
      <section className="flex flex-1 lg:w-3/5 min-h-0 flex-col items-center justify-center pt-3 px-2">
        <HeadlineGallery />
      </section>

      {/* RIGHT — banner: full width below on mobile, 2/5 on web */}
      <section className="relative w-full lg:w-2/5 h-48 sm:h-64 lg:h-auto lg:min-h-0 flex-shrink-0 bg-[#141414]">
        <Image
          src={banner}
          alt="Studio Banner"
          fill
          style={{ objectFit: "contain" }}
          priority
          className="object-contain"
        />
      </section>
    </main>
  );
}
