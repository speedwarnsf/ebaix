import React, { useRef, useState } from "react";
import { Aperture, Loader2, Upload, X } from "lucide-react";

/**
 * Standalone recreation of the ZenSpace lens aperture interaction that
 * lets us experiment with the device inside the nudio UI. The component
 * handles drag/drop as well as click-to-upload for demo purposes only.
 */
export function LensApertureDemo({
  onImageSelected,
  onImageCleared,
  label = "Drop Photo",
}) {
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = (file) => {
    if (!file?.type?.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setPreview(dataUrl);
      if (typeof onImageSelected === "function") {
        onImageSelected(file, dataUrl);
      }
      setIsAnalyzing(true);
      // Fake a focusing cycle so the aperture feels alive.
      window.setTimeout(() => setIsAnalyzing(false), 1400);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const clearImage = (event) => {
    event.stopPropagation();
    setPreview(null);
    setIsAnalyzing(false);
    if (typeof onImageCleared === "function") {
      onImageCleared();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex justify-center">
      <div
        className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#121014] shadow-[0_30px_60px_rgba(7,5,9,0.55)] flex items-center justify-center cursor-pointer group transition-all duration-500 hover:scale-[1.02]"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Lens barrel texture */}
        <div
          className="absolute inset-0 rounded-full border-[18px] border-[#100d11] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              120deg,
              rgba(255,255,255,0.02),
              rgba(255,255,255,0.02) 6px,
              transparent 6px,
              transparent 12px
            )`,
          }}
        />

        {/* Text ring */}
        <div className="absolute inset-[18px] rounded-full bg-[#0b090d] border border-[#241b22] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-1 animate-[spin_45s_linear_infinite] opacity-80">
            <svg className="w-full h-full" viewBox="0 0 200 200">
              <path
                id="nudioLensPath"
                d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
                fill="transparent"
              />
              <text className="text-[5px] uppercase font-semibold fill-[#c59aa8] tracking-[0.4em]">
                <textPath href="#nudioLensPath" startOffset="0%">
                  nudio planar
                </textPath>
                <textPath href="#nudioLensPath" startOffset="50%">
                  f/2.0 58mm bloom
                </textPath>
              </text>
            </svg>
          </div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.5em] text-[#f08cac] font-semibold">
            NU
          </div>
        </div>

        {/* Glass housing */}
        <div className="absolute inset-[48px] rounded-full bg-black border-[3px] border-[#1d1420] shadow-[inset_0_15px_35px_rgba(0,0,0,1)] overflow-hidden">
          {/* Gradient wash */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)] opacity-60 mix-blend-screen pointer-events-none" />
          <div className="absolute inset-0 bg-[conic-gradient(from_180deg,#f472b6,#a855f7,#f9a8d4)] opacity-10 mix-blend-screen pointer-events-none" />

          {!preview && !isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center opacity-25 group-hover:opacity-10 transition-all duration-700">
              <Aperture className="w-4/5 h-4/5 text-[#46313f]" strokeWidth={0.4} />
            </div>
          )}

          {preview && (
            <>
              <img
                src={preview}
                alt="Lens preview"
                className="w-full h-full object-cover opacity-95"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={clearImage}
                  className="p-3 rounded-full bg-[#f06ca8]/90 text-white hover:bg-[#fd93c1] transition-colors"
                  title="Remove"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </>
          )}

          {!preview && !isAnalyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#d9b6c5] gap-2 uppercase tracking-[0.4em] text-[10px]">
              <Upload className="w-9 h-9" />
              {label}
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-[#f08cac] gap-3">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#fbcfe8] animate-spin" />
                <Loader2 className="w-full h-full animate-spin" />
              </div>
              <span className="font-mono text-xs tracking-[0.3em]">
                focusing
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
