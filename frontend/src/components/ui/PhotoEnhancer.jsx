import React, { useState, useRef } from "react";
import { toast } from "sonner";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
  createCheckoutSession,
  redirectToCheckout,
} from "../../stripeIntegration";

const GUEST_LIMIT = 3;

export function PhotoEnhancer({
  sessionRole,
  userEmail,
  userId,
  usageSummary,
  onUsageUpdate,
  usageError,
  accessToken,
  anonKey,
  supabaseUrl,
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [processingBundle, setProcessingBundle] = useState(null);
  const fileInputRef = useRef(null);

  const isMember = sessionRole === "member";
  const authToken = accessToken || anonKey;

  // Debug logging (remove in production)
  // console.log('PhotoEnhancer Debug:', { sessionRole, accessToken: !!accessToken, anonKey: !!anonKey });

  const isUnlimited = usageSummary?.unlimited ?? false;
  const paidNudios = usageSummary?.creditsBalance ?? 0;
  const freeLimit = usageSummary?.freeCreditsLimit ?? GUEST_LIMIT;

  const freeRemainingRaw =
    isUnlimited === true
      ? Infinity
      : usageSummary?.freeCreditsRemaining ?? (isMember ? 0 : GUEST_LIMIT);

  const freeRemainingDisplay =
    freeRemainingRaw === Infinity
      ? "∞"
      : typeof freeRemainingRaw === "number"
      ? freeRemainingRaw
      : "?";

  const usageSummaryText = usageError
    ? usageError
    : isMember
    ? isUnlimited
      ? "Member access • unlimited nudios every month"
      : `Member access • ${paidNudios} bonus nudios ready to roll`
    : `Guest mode • ${freeRemainingDisplay}/${freeLimit} nudios this month`;

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("JPG or PNG up to 10MB");
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
    // Get tokens from props or environment
    const finalAuthToken = accessToken || anonKey || process.env.REACT_APP_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbG9maGx0bmN1c25ha2hlaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzcwOTUsImV4cCI6MjA3NjU1MzA5NX0.evf7AQnHcnp6YSccjVhp_qu8ctLOo14v9oGwnapqvaE";
    const finalSupabaseUrl = supabaseUrl || process.env.REACT_APP_SUPABASE_URL || "https://cllofhltncusnakhehdw.supabase.co";

    // Validate and clean header values
    const validateHeader = (value) => {
      if (typeof value !== 'string') {
        throw new Error(`Header value is not a string: ${typeof value}`);
      }
      return value.trim();
    };

    const cleanToken = validateHeader(finalAuthToken);
    const cleanUrl = validateHeader(finalSupabaseUrl);

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanToken}`,
      "apikey": cleanToken,
    };

    let response;
    try {
      response = await fetch(`${cleanUrl}/functions/v1/optimize-listing`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageBase64: base64Image,
          mode: "image",
          userEmail: isMember ? userEmail : undefined,
          guestMode: !isMember,
        }),
      });
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload?.error || "Failed to enhance image");
      error.usage = payload?.usage;
      error.status = response.status;
      throw error;
    }

    if (!payload.success || !payload.image) {
      const error = new Error("No enhanced image returned");
      error.usage = payload?.usage;
      throw error;
    }

    return payload;
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
      setError("Pop in a photo first and we’ll do the rest.");
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
          const result = await enhanceWithGemini(base64Image);
          const borderedImage = await addWhiteBorder(result.image);
          const watermarkedImage = await addWatermark(borderedImage);

          setEnhancedImage(watermarkedImage);
          setShowSaveOptions(false);
          toast.success("Fresh nudio ready! Save it or share it in a tap.");

          if (result.usage) {
            onUsageUpdate?.(result.usage);
          }
        } catch (err) {
          if (err?.usage) {
            onUsageUpdate?.(err.usage);
          }
          if (err?.status === 402) {
            setError(
              "You’ve enjoyed this month’s guest nudios. Sign in to unlock more studio time."
            );
            toast("Ready for more nudios? Sign in to keep the glow going!");
          } else {
            setError(err?.message || "We couldn’t finish that nudio just yet.");
            toast.error("That try didn’t stick—give it another go!");
          }
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (err) {
      setError(err?.message || "Something went sideways. Try again.");
      setLoading(false);
    }
  };

  const handlePurchase = async (bundleType) => {
    setProcessingBundle(bundleType);
    try {
      const checkoutData = await createCheckoutSession({
        bundleType,
        userId,
        email: userEmail || "guest@nudio.ai",
        authToken,
      });

      await redirectToCheckout(checkoutData);
    } catch (purchaseError) {
      console.error("Purchase failed:", purchaseError);
      toast.error("Checkout couldn’t open—let’s try that again.");
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
              <>
                <img
                  src={preview}
                  alt="Selected product"
                  className="w-full max-h-[520px] object-contain rounded-lg"
                />
                {loading && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                      <p className="text-sm font-medium text-slate-900">Creating your nudio...</p>
                    </div>
                  </div>
                )}
              </>
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
                    Click here to start
                  </p>
                  <p className="text-sm text-slate-500">
                    JPG or PNG up to 10MB
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
                id="original-photo"
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
            disabled={!preview || loading}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-md transition-colors"
          >
            {loading ? "nudioing" : "Process your nudio"}
          </button>
          {enhancedImage && (
            <button
              onClick={resetWorkspace}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium px-6 py-2.5 rounded-md transition-colors"
            >
              Start another nudio
            </button>
          )}
        </div>
        {!loading &&
          freeRemainingRaw !== Infinity &&
          typeof freeRemainingRaw === "number" &&
          freeRemainingRaw <= 0 && (
            <p className="text-sm text-slate-500">
              Ready for more? Sign in or grab a bundle to keep the magic going.
            </p>
          )}
      </section>

      <section className="space-y-6 border border-slate-200 rounded-md px-5 py-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm text-slate-500">{usageSummaryText}</p>
          </div>

          <button
            onClick={() => setShowPricing((prev) => !prev)}
            className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
          >
            {showPricing ? "Hide bundles" : "Buy more nudios"}
          </button>
        </div>

        {showPricing && (
          <div className="space-y-8 pt-4 border-t border-slate-200">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">
                Choose the bundle that fits
              </h3>
              <p className="text-sm text-slate-500">
                Clear, playful pricing. Your nudios never expire.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(CREDIT_BUNDLES).map(([key, bundle]) => (
                <div
                  key={key}
                  className="relative flex flex-col gap-4 border border-slate-200 rounded-md bg-slate-50 px-5 py-5 hover:border-slate-400 transition-colors"
                >
                  {bundle.badge && (
                    <span className="badge-shimmer text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                      <span>{bundle.badge}</span>
                    </span>
                  )}
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      {bundle.name}
                    </p>
                    <p className="text-xs text-slate-500">One-time bundle</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-semibold text-slate-900">
                      ${bundle.price}
                    </p>
                    <p className="text-sm text-slate-500">
                      {bundle.credits} nudios · ${(bundle.price / bundle.credits).toFixed(2)} each
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
                  <span>200 nudios each month, ready to post</span>
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
                {processingBundle === "subscription" ? "Processing..." : "Subscribe"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
