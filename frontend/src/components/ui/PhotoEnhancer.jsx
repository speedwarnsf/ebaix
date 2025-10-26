import React, { useState, useRef } from "react";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
  createCheckoutSession,
  redirectToCheckout,
} from "../../stripeIntegration";

export function PhotoEnhancer({ userCredits, onCreditUse, userEmail }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [processingBundle, setProcessingBundle] = useState(null);
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
    setShowSaveOptions(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result ?? "");
      setEnhancedImage("");
    };
    reader.readAsDataURL(file);
  };

  const addWhiteBorder = async (imageBase64) =>
    new Promise((resolve) => {
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

  const addWatermark = async (imageBase64) =>
    new Promise((resolve) => {
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
      logo.src = "/nudiologo.png";
    });

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

  const dataUrlToBlob = (dataUrl) => {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  const downloadImage = (filename) => {
    if (!enhancedImage) return;
    const link = document.createElement("a");
    link.href = enhancedImage;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!enhancedImage || !navigator.share) {
      downloadImage(`nudio-enhanced-${Date.now()}.png`);
      return;
    }

    try {
      const blob = dataUrlToBlob(enhancedImage);
      if (!blob) throw new Error("Unable to prepare file for sharing");
      const file = new File([blob], `nudio-enhanced-${Date.now()}.png`, {
        type: blob.type,
      });

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        downloadImage(`nudio-enhanced-${Date.now()}.png`);
        return;
      }

      await navigator.share({
        files: [file],
        title: "Nudio shoot",
        text: "Ready to post your nudio shot.",
      });
    } catch (shareError) {
      console.warn("Share unavailable, falling back to download", shareError);
      downloadImage(`nudio-enhanced-${Date.now()}.png`);
    }
  };

  const handleSaveToCameraRoll = async () => {
    if (!enhancedImage) return;

    try {
      const blob = dataUrlToBlob(enhancedImage);
      if (
        blob &&
        navigator.share &&
        navigator.canShare?.({
          files: [new File([blob], "nudio-camera-roll.png", { type: blob.type })],
        })
      ) {
        const file = new File([blob], `nudio-camera-roll-${Date.now()}.png`, {
          type: blob.type,
        });

        await navigator.share({
          files: [file],
          title: "Nudio shoot",
          text: "Save this nudio shot to your camera roll.",
        });
        return;
      }
    } catch (shareError) {
      console.warn("Camera roll share unavailable, falling back to download", shareError);
    }

    downloadImage(`nudio-camera-roll-${Date.now()}.png`);
  };

  const handleSaveToFiles = () => {
    downloadImage(`nudio-files-${Date.now()}.png`);
  };

  const handleEnhancePhoto = async () => {
    if (!selectedImage || !preview) {
      setError("Please select an image first");
      return;
    }

    if (userCredits < 1) {
      setError("You need at least one credit to enhance a photo.");
      return;
    }

    setLoading(true);
    setError("");
    setShowSaveOptions(false);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target?.result;
          const geminiImage = await enhanceWithGemini(base64Image);
          const borderedImage = await addWhiteBorder(geminiImage);
          const watermarkedImage = await addWatermark(borderedImage);

          setEnhancedImage(watermarkedImage);
          setShowSaveOptions(false);
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

  const handlePurchase = async (bundleType) => {
    setProcessingBundle(bundleType);
    try {
      const checkoutData = await createCheckoutSession({
        bundleType,
        userId: "temp-user-id",
        email: userEmail || "user@example.com",
      });

      await redirectToCheckout(checkoutData);
    } catch (purchaseError) {
      console.error("Purchase failed:", purchaseError);
      alert("Checkout could not start. Please try again.");
    } finally {
      setProcessingBundle(null);
    }
  };

  const resetWorkspace = () => {
    setSelectedImage(null);
    setPreview("");
    setEnhancedImage("");
    setError("");
    setShowSaveOptions(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-8 sm:space-y-10">
      <section className="space-y-6">
        {!enhancedImage && (
          <div
            className={`relative rounded-lg border ${
              preview ? "border-slate-200" : "border-dashed border-slate-300"
            } min-h-[260px] flex items-center justify-center text-center transition-colors cursor-pointer bg-white`}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <img
                src={preview}
                alt="Selected product"
                className="w-full max-h-[520px] object-contain rounded-lg"
              />
            ) : (
              <div className="space-y-4 px-6">
                <svg
                  className="mx-auto h-12 w-12 text-slate-400"
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
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">
                    Click here to start your <span className="italic">nudio</span> shoot.
                  </p>
                  <p className="text-sm text-slate-500">
                    High-resolution JPG or PNG up to 10MB
                  </p>
                </div>
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
        )}

        {preview && !enhancedImage && (
          <p className="text-sm text-slate-500 text-center">
            Ready to enhance? Tap the button below to generate the studio shot.
          </p>
        )}

        {enhancedImage && (
          <div className="space-y-6">
            <div className="space-y-4">
              <img
                src={enhancedImage}
                alt="Enhanced product"
                className="w-full max-h-[560px] object-contain rounded-lg bg-white"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowSaveOptions((prev) => !prev)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-md transition-colors"
                >
                  {showSaveOptions ? "Hide save options" : "Save image"}
                </button>
                {showSaveOptions && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleShare}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
                    >
                      Share
                    </button>
                    <button
                      onClick={handleSaveToCameraRoll}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
                    >
                      Save to camera roll
                    </button>
                    <button
                      onClick={handleSaveToFiles}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
                    >
                      Save to files
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-slate-800">
                Original photo
              </h3>
              <img
                src={preview}
                alt="Original upload"
                className="w-full max-h-[320px] object-contain rounded-lg border border-slate-200 bg-white"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleEnhancePhoto}
            disabled={!preview || loading || userCredits < 1}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-md transition-colors"
          >
          {loading ? "nudioing" : "Process your nudio"}
          </button>
          {enhancedImage && (
            <button
              onClick={resetWorkspace}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium px-6 py-2.5 rounded-md transition-colors"
            >
              Start another photo
            </button>
          )}
        </div>
      </section>

      <section className="space-y-6 border border-slate-200 rounded-md px-5 py-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-slate-900">Credits</p>
            <p className="text-sm text-slate-500">
              {userCredits} remaining · each enhanced image uses 1 credit
            </p>
          </div>
          <button
            onClick={() => setShowPricing((prev) => !prev)}
            className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
          >
            {showPricing ? "Hide pricing" : "Buy more credits"}
          </button>
        </div>

        {showPricing && (
          <div className="space-y-8 pt-4 border-t border-slate-200">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">
                Choose the bundle that fits
              </h3>
              <p className="text-sm text-slate-500">
                Clear, predictable pricing. Your credits never expire.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(CREDIT_BUNDLES).map(([key, bundle]) => (
                <div
                  key={key}
                  className="relative flex flex-col gap-4 border border-slate-200 rounded-md bg-slate-50 px-5 py-5 hover:border-slate-400 transition-colors"
                >
                  {bundle.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                      {bundle.badge}
                    </span>
                  )}
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      {bundle.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      One-time bundle
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-semibold text-slate-900">
                      ${bundle.price}
                    </p>
                    <p className="text-sm text-slate-500">
                      {bundle.credits} credits · $
                      {(bundle.price / bundle.credits).toFixed(2)} per credit
                    </p>
                  </div>
                  <button
                    onClick={() => handlePurchase(key)}
                    disabled={processingBundle === key}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
                  >
                    {processingBundle === key ? "Processing..." : "Purchase"}
                  </button>
                </div>
              ))}
            </div>

            <div className="border border-slate-900 bg-slate-900 text-slate-50 rounded-md px-6 py-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{SUBSCRIPTION.name}</p>
                  <p className="text-sm text-slate-200/80">
                    Ideal for power sellers who want unlimited output
                  </p>
                </div>
                <p className="text-3xl font-semibold">
                  ${SUBSCRIPTION.price}
                  <span className="text-sm font-normal text-slate-300">/month</span>
                </p>
              </div>
              <ul className="text-sm text-slate-200 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  <span>200 listings per month included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  <span>No watermark on enhanced images</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  <span>Priority processing during peak hours</span>
                </li>
              </ul>
              <button
                onClick={() => handlePurchase("subscription")}
                disabled={processingBundle === "subscription"}
                className="w-full bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-300 text-sm font-semibold py-2.5 rounded-md transition-colors"
              >
                {processingBundle === "subscription"
                  ? "Processing..."
                  : "Subscribe"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
