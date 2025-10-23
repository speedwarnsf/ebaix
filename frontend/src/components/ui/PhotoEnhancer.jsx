// PhotoEnhancer.jsx - Photo enhancement component
import React, { useState, useRef } from "react";

export function PhotoEnhancer({ userCredits, onSuccess }) {
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
      setPreview(e.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const addPinkBackground = async (imageBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const padding = 100; // Add padding around the product
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(imageBase64);
          return;
        }

        // Fill with pink background (#F5D5E0)
        ctx.fillStyle = "#F5D5E0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Center the product image
        const x = padding;
        const y = padding;
        ctx.drawImage(img, x, y);

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.src = imageBase64;
    });
  };

  const addWatermark = async (imageBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
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

        const fontSize = Math.max(20, img.width / 20);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";

        const padding = 20;
        const text = "ebai.me";
        ctx.fillText(text, img.width - padding, img.height - padding);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.strokeText(text, img.width - padding, img.height - padding);

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.src = imageBase64;
    });
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

          // Apply pink background, then watermark
          const pinkBgImage = await addPinkBackground(result.image);
          const watermarkedImage = await addWatermark(pinkBgImage);
          setEnhancedImage(watermarkedImage);
          onSuccess();
        } catch (err) {
          setError(err?.message || "Failed to enhance image");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (err) {
      setError(err?.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedImage) return;

    const link = document.createElement("a");
    link.href = enhancedImage;
    link.download = `ebai-enhanced-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Photo Enhancer</h2>
      <p className="text-gray-600 mb-8">
        Remove backgrounds and add professional pink studio backdrops to your product photos.
      </p>

      <div className="space-y-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-14-8v12m6-6l-6 6-6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-sm text-gray-600">PNG, JPG, GIF up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {preview && !enhancedImage && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Original</h3>
              <img
                src={preview}
                alt="Original"
                className="w-full h-64 object-cover rounded-lg border border-gray-200"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              <div className="w-full h-64 bg-gradient-to-br from-pink-100 to-pink-50 rounded-lg border border-gray-200 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Processing will show preview here</p>
              </div>
            </div>
          </div>
        )}

        {enhancedImage && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Original</h3>
              <img src={preview} alt="Original" className="w-full h-64 object-cover rounded-lg border border-gray-200" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Enhanced</h3>
              <img src={enhancedImage} alt="Enhanced" className="w-full h-64 object-cover rounded-lg border border-gray-200" />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          {!enhancedImage ? (
            <>
              <button
                onClick={handleEnhancePhoto}
                disabled={!preview || loading || userCredits < 1}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? "Processing..." : "Enhance Photo"}
              </button>
              {userCredits < 1 && (
                <p className="text-red-600 text-sm self-center">Insufficient credits</p>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Download Enhanced Image
              </button>
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setPreview("");
                  setEnhancedImage("");
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Process Another Photo
              </button>
            </>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Each enhancement costs 1 credit. You have <span className="font-semibold">{userCredits}</span> credits available.
          </p>
        </div>
      </div>
    </div>
  );
}
