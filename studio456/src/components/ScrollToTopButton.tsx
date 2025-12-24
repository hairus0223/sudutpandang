import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react"; // optional

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleBtn = () => {
      if (window.scrollY > 300) setVisible(true);
      else setVisible(false);
    };

    window.addEventListener("scroll", toggleBtn);
    return () => window.removeEventListener("scroll", toggleBtn);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-5 right-5 z-50 p-3 rounded-full shadow-lg bg-[var(--color-primary)] text-white transition-all ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <ArrowUp size={20} />
    </button>
  );
}
