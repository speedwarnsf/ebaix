// PhotoEnhancer.jsx - Unified creative workspace
import React, { useState, useRef } from "react";
import { TextAssistant } from "./TextAssistant";

export function PhotoEnhancer({ userCredits, onCreditUse }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10MB");
      return;
    }

    setSelectedImage(file);
    setError("");

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result ?? "");
      setEnhancedImage("");
    };
    reader.readAsDataURL(file);
  };

  const addWhiteBorder = async (imageBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const borderSize = Math.max(40, Math.floor(img.width * 0.03));
        const canvas = document.createElement("canvas");
        canvas.width = img.width + borderSize * 2;
        canvas.height = img.height + borderSize * 2;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(imageBase64);
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, borderSize, borderSize);

        resolve(canvas.toDataURL("image/png"));
      };
      img.src = imageBase64;
    });
  };

  const addWatermark = async (imageBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      const logo = new Image();

      logo.onload = () => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(imageBase64);
            return;
          }

          ctx.drawImage(img, 0, 0);

          const logoMaxWidth = img.width * 0.104;
          const logoScale = logoMaxWidth / logo.width;
          const logoWidth = logo.width * logoScale;
          const logoHeight = logo.height * logoScale;

          const padding = img.width * 0.015;
          const x = img.width - logoWidth - padding - 35;
          const y = img.height - logoHeight - padding - 20;

          ctx.globalAlpha = 1.0;
          ctx.drawImage(logo, x, y, logoWidth, logoHeight);

          resolve(canvas.toDataURL("image/png"));
        };
        img.src = imageBase64;
      };

      logo.onerror = () => resolve(imageBase64);
      logo.src = "/ebai-logo.png";
    });
  };

  const enhanceWithGemini = async (base64Image) => {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/optimize-listing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          mode: "image",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to enhance image");
    }

    const result = await response.json();
    if (!result.success || !result.image) {
      throw new Error("No enhanced image returned");
    }

    return result.image;
  };

  const handleEnhancePhoto = async () => {
    if (!selectedImage || !preview) {
      setError("Please select an image first");
      return;
    }

    if (userCredits < 1) {
      setError("Insufficient credits. Please purchase more credits.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target?.result;
          const geminiImage = await enhanceWithGemini(base64Image);
          const borderedImage = await addWhiteBorder(geminiImage);
          const watermarkedImage = await addWatermark(borderedImage);

          setEnhancedImage(watermarkedImage);
          onCreditUse?.();
        } catch (err) {
          setError(err?.message || "Failed to enhance image");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (err) {
      setError(err?.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedImage) return;

    const link = document.createElement("a");
    link.href = enhancedImage;
    link.download = `ebai-enhanced-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetWorkspace = () => {
    setSelectedImage(null);
    setPreview("");
    setEnhancedImage("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-10">
      <section className="space-y-6">
        <div
          className={`relative border-2 ${
            preview ? "border-gray-200" : "border-dashed border-gray-300"
          } rounded-xl p-6 transition-colors cursor-pointer`}
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Selected preview"
                className="w-full max-h-[420px] object-contain rounded-lg"
              />
              <span className="absolute top-3 left-3 bg-white/80 text-gray-800 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
                Original upload
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 space-y-3">
              <svg
                className="h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-14-8v12m6-6l-6 6-6-6"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg font-medium text-gray-900">
                Click to upload or drag a product photo
              </p>
              <p className="text-sm">
                High-resolution JPG or PNG up to 10MB
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {enhancedImage && (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                <div className="flex-1">
                  <img
                    src={enhancedImage}
                    alt="Enhanced"
                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                  />
                  <p className="text-xs text-gray-500 text-center mt-3 md:hidden">
                    Tip: tap and hold the image to save it to your camera roll
                  </p>
                </div>
                <div className="md:w-64 space-y-4 mt-4 md:mt-0">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                      Before & After
                    </h4>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <img
                        src={preview}
                        alt="Original thumbnail"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <img
                        src={enhancedImage}
                        alt="Enhanced thumbnail"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        style={{ transform: "scale(1.05)" }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    Download Enhanced Image
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleEnhancePhoto}
            disabled={!preview || loading || userCredits < 1}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            {loading ? "Enhancing..." : "Enhance Photo"}
          </button>
          {enhancedImage && (
            <button
              onClick={resetWorkspace}
              className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Start Another Photo
            </button>
          )}
          {!enhancedImage && userCredits < 1 && (
            <p className="text-sm text-red-600 self-center">
              Add more credits to continue
            </p>
          )}
        </div>
      </section>

      {enhancedImage && (
        <TextAssistant
          userCredits={userCredits}
          onSuccess={(chargeCredit) => {
            if (chargeCredit) {
              onCreditUse?.();
            }
          }}
          defaultImageUrl={enhancedImage}
        />
      )}

      <section className="border border-gray-200 rounded-xl p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">
              Credits available
            </p>
            <p className="text-3xl font-semibold text-gray-900 mt-1">
              {userCredits}
            </p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Photo enhancement • 1 credit</p>
            <p>Listing copy • 1 credit</p>
          </div>
        </div>
        <div className="mt-5 border-t border-gray-200 pt-5">
          <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            About your credits
          </h4>
          <p className="text-sm text-gray-600 mt-2">
            Each enhanced photo and listing description uses one credit. Credits
            never expire, and you can top up at any time. Keep at least two
            credits handy to finish a full listing in one sitting.
          </p>
        </div>
      </section>
    </div>
  );
}
