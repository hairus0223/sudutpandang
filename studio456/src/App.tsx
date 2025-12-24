import React, { useRef, useEffect, useState } from "react";
import { InfoCard } from "./components/InfoCard";
import { PhotoCard } from "./components/PhotoCard";
import { PhotoModal } from "./components/PhotoModal";
import { useLastViewedPhoto } from "./store/useLastViewedPhoto";
import banner from "./assets/banner.jpg";
import ScrollToTopButton from "./components/ScrollToTopButton"

const API_BASE_URL = "http://192.168.139.109:4000";

type AppPhase = "form" | "gallery";
type ImageData = { filename: string; url: string };

function App() {
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<AppPhase>("form");
  const [errorMessage, setErrorMessage] = useState("");

  const { lastViewedPhoto, setLastViewedPhoto } = useLastViewedPhoto();
  const lastViewedPhotoRef = useRef<HTMLDivElement>(null!);

  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);
  const [allowedPrint, setAllowedPrint] = useState<number>(3);

  // Register form states
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPeople, setRegPeople] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplates, setPreviewTemplates] = useState<HTMLCanvasElement[]>([]);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");


  // Scroll ke last viewed image
  useEffect(() => {
    if (lastViewedPhoto !== null && selectedPhoto === null) {
      lastViewedPhotoRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      setLastViewedPhoto(null);
    }
  }, [selectedPhoto, lastViewedPhoto, setLastViewedPhoto]);

  // Parse limit dari userInput (format: name-limit)
  useEffect(() => {
    const parts = userInput.split("-");
    if (parts.length === 3) {
      const limit = parseInt(parts[1]);
      if (!isNaN(limit) && limit > 0) setAllowedPrint(limit);
    }
  }, [userInput]);

  // Toggle pilih cetak
  const togglePrintSelection = (filename: string) => {
    setSelectedForPrint((prev) => {
      if (prev.includes(filename)) return prev.filter((i) => i !== filename); // unselect
      if (prev.length < allowedPrint) return [...prev, filename]; // limit ok
      alert(`Maksimal pilih ${allowedPrint} foto untuk dicetak.`);
      return prev;
    });
  };

  // Handle proses selesai & kirim API
  const handleFinish = async () => {
    if (selectedForPrint.length === 0) {
      alert("Pilih minimal 1 foto.");
      return;
    }

    const files = selectedForPrint.map((name) => {
      const f = images.find((x) => x.filename === name);
      return f?.url || "";
    });

    const templates = await generatePrintTemplates(files, orientation);

    setPreviewTemplates(templates);
    setPreviewOpen(true);

    // // Dapatkan nama dari nama-length
    // const [userId] = userInput.split("-");
    // try {
    //   const res = await fetch(`${API_BASE_URL}/api/print/${userId}`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       filenames: selectedForPrint,
    //     }),
    //   });

    //   if (!res.ok) throw new Error("Gagal proses print");

    //   alert("Print berhasil dikirim!");
    //   setPhase("form");
    //   setSelectedForPrint([]);
    //   setUserInput("");
    // } catch (err) {
    //   console.error(err);
    //   alert("Gagal proses print. Coba lagi.");
    // }
  };
const handlePrintNow = async (editorData: EditorState[]) => {
  const templates = await generatePrintTemplates(
    selectedForPrint.map(f => images.find(img => img.filename === f)!.url),
    editorData,
    orientation
  );

  setPreviewTemplates(templates);

  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup diblokir!");
    return;
  }

  let html = `
    <html>
      <head>
        <style>body{margin:0;padding:0;} img{width:100%;}</style>
      </head>
      <body>
  `;

  templates.forEach((c) => {
    html += `<img src="${c.toDataURL("image/png")}"/>`;
  });

  html += `
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
    </html>`;

  win.document.write(html);
  win.document.close();

  setPreviewOpen(false);
};


  // Fetch images dari backend
  const handleSearch = async () => {
    if (!userInput.trim()) {
      setErrorMessage("Silakan masukkan ID atau nama terlebih dahulu.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/images/${userInput}`);
      if (!res.ok) throw new Error("Data tidak ditemukan atau format salah.");

      const data = await res.json();

      if (!data.images?.length) {
        setErrorMessage("Tidak ada foto untuk ID/nama tersebut.");
        return;
      }

      setImages(data.images || []);
      setPhase("gallery");
      setSelectedPhoto(null);
      setLastViewedPhoto(null);
    } catch (error) {
      console.error("Error fetching images:", error);
      setErrorMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regName.trim() || !regPhone.trim() || !regPeople.trim()) {
      setRegisterMessage("Semua field wajib diisi.");
      return;
    }

    setRegisterLoading(true);
    setRegisterMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          peopleCount: parseInt(regPeople),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error("Gagal registrasi");
      }

      // Auto set userInput → "NamaJumlahOrang"
      setUserInput(data.customer.user);

      setRegisterMessage("Registrasi berhasil! Anda bisa klik Check Photo.");

      // Reset form
      setRegName("");
      setRegPhone("");
      setRegPeople("");
    } catch (err) {
      console.error(err);
      setRegisterMessage("Gagal registrasi. Coba lagi.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // Fungsi navigasi foto
  const handleNext = () =>
    setSelectedPhoto((prev) =>
      prev !== null && prev + 1 < images.length ? prev + 1 : prev
    );

  const handlePrev = () =>
    setSelectedPhoto((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));

  return (
    <div className="bg-black min-h-screen antialiased flex flex-col">
      {/* ===================== FORM SECTION ===================== */}
      {phase === "form" && (
        <>
          <div className="flex h-screen w-full bg-black">
            {/* FORM SECTION */}
            <div className="flex flex-col items-center justify-center w-1/2 gap-6 text-center px-6">
              <div className="flex flex-col gap-3 w-full max-w-lg mt-6 p-4 border border-white/30 rounded-lg">
                <div className="flex flex-col gap-3 w-full max-w-lg items-start">
                  <h1 className="text-[#B49240] font-extrabold">Akses Photo</h1>
                  <label className="text-white">Masukan ID/Nama</label>
                  <input
                    type="text"
                    placeholder="Masukkan ID / Nama..."
                    className="border-2 border-white/50 rounded p-3 text-white bg-transparent w-full focus:border-white transition"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-4 py-3 w-full rounded bg-dark text-white font-semibold hover:bg-gray-200 active:scale-[0.97] transition disabled:opacity-50"
                  >
                    {loading ? "..." : "Check Photo"}
                  </button>
                </div>

                {errorMessage && (
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                )}
              </div>

              {/* REGISTER FORM */}
              <div className="flex flex-col gap-3 w-full max-w-lg mt-6 p-4 border border-white/30 rounded-lg items-start">
                <h1 className="text-[#B49240] font-extrabold">Registrasi</h1>

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
                  disabled={registerLoading}
                  className="px-4 py-3 w-full rounded bg-dark text-white font-semibold hover:bg-gray-200 active:scale-[0.97] transition disabled:opacity-50"
                >
                  {registerLoading ? "Mendaftarkan..." : "Registrasi"}
                </button>

                {registerMessage && (
                  <p className="text-white/80 text-sm mt-1">
                    {registerMessage}
                  </p>
                )}
              </div>
            </div>

            {/* BANNER SECTION */}
            <div className="w-1/2 h-full flex items-center justify-center bg-[#141414]">
              <img
                src={banner}
                alt="Banner"
                className="w-full object-cover opacity-100"
              />
            </div>
          </div>
        </>
      )}

      {/* ===================== GALLERY SECTION ===================== */}
      {phase === "gallery" && (
        <>
          <main className="mx-auto max-w-[1960px] p-4 flex-1">
            <div className="flex flex-row justify-between">
              <button
                onClick={() => setPhase("form")}
                className="mb-4 rounded-full px-4 py-2 text-sm text-white/70 hover:text-white transition"
              >
                ← Back
              </button>

              <div className="flex flex-row justify-center items-center gap-3">
                <div className="text-white/80 mb-4">
                  Maksimal pilih <b>{allowedPrint}</b> foto | Dipilih:{" "}
                  <b>{selectedForPrint.length}</b>
                </div>
                <button
                  disabled={selectedForPrint.length < allowedPrint}
                  onClick={handleFinish}
                  className={`mb-4 rounded-full px-4 py-2 text-sm transition
                  ${
                    selectedForPrint.length < allowedPrint
                      ? "text-white/30"
                      : "text-white/70 hover:text-white"
                  }
                `}
                >
                  Lanjutkan →
                </button>
              </div>
            </div>

            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
              <InfoCard userName={userInput} />

              {images.map((img, index) => (
                <PhotoCard
                  key={index}
                  id={index}
                  src={img.url}
                  filename={img.filename}
                  onClick={() => {
                    setSelectedPhoto(index);
                    setLastViewedPhoto(index);
                  }}
                  refProp={
                    index === lastViewedPhoto ? lastViewedPhotoRef : null
                  }
                  isSelected={selectedForPrint.includes(img.filename)}
                  onTogglePrint={(filename) => togglePrintSelection(filename)}
                />
              ))}
            </div>
          </main>

          <footer className="p-6 text-center text-white/80">
            Copyright © <b>studio</b>456
          </footer>

          <PhotoModal
            open={selectedPhoto !== null}
            onClose={() => setSelectedPhoto(null)}
            photoIndex={selectedPhoto}
            images={images}
            onNext={handleNext}
            onPrev={handlePrev}
            onSetPhoto={(index) => setSelectedPhoto(index)}
            selectedForPrint={selectedForPrint} // ADD
            togglePrintSelection={(filename) => togglePrintSelection(filename)} // ADD
          />

          <ScrollToTopButton />

         {/* <PrintPreviewModal
  open={previewOpen}
  templates={previewTemplates}
  onClose={() => setPreviewOpen(false)}
  onPrint={handlePrintNow}
/> */}


        </>
      )}
    </div>
  );
}

export default App;