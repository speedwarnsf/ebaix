import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
  createCheckoutSession,
  redirectToCheckout,
} from "../../stripeIntegration";
import { LensApertureDemo } from "../LensApertureDemo";
import { Loader2 } from "lucide-react";

const GUEST_LIMIT = 3;

const BACKDROP_OPTIONS = [
  { id: "pink", label: "nudio Pink", description: "Savage Seamless Light Pink #08", hex: "#F6CADC" },
  { id: "primary-red", label: "Vivid Red", description: "Savage Seamless Primary Red #08R", hex: "#CE1126" },
  { id: "crimson", label: "Crimson", description: "Savage Seamless Crimson #06", hex: "#8C1B2F" },
  { id: "bone", label: "Bone", description: "Savage Seamless Bone #51", hex: "#E8DCC9" },
  { id: "fashion-grey", label: "City Fog", description: "Savage Seamless Fashion Grey #56", hex: "#90969B" },
  { id: "evergreen", label: "Forest", description: "Savage Seamless Evergreen #18", hex: "#2E5339" },
  { id: "deep-yellow", label: "Amber Yellow", description: "Savage Seamless Deep Yellow #71", hex: "#FFB300" },
  { id: "canary", label: "Lt Yellow", description: "Savage Seamless Canary #38", hex: "#FFF44F" },
  { id: "blue-mist", label: "Powder Blue", description: "Savage Seamless Blue Mist #41", hex: "#7CAFD6" },
  { id: "ultramarine", label: "Ocean", description: "Savage Seamless Ultramarine #05", hex: "#2B3D8C" },
  { id: "thunder-grey", label: "Charcoal", description: "Savage Seamless Thunder Grey #27", hex: "#4A4C4E" },
  { id: "mint-green", label: "Pale Green", description: "Savage Seamless Mint Green #40", hex: "#BEE7B8" },
  { id: "black", label: "Midnight", description: "Savage Seamless Black #20", hex: "#000000" },
  { id: "chesnut", label: "Brown", description: "Savage Seamless Chestnut #16", hex: "#6B3F2E" },
  { id: "purple", label: "Deep Purple", description: "Savage Seamless Purple #62", hex: "#6F2DA8" },
];

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
  onLensLabLaunch,
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [processingBundle, setProcessingBundle] = useState(null);
  const [variant, setVariant] = useState("product");
  const [backdropId, setBackdropId] = useState(BACKDROP_OPTIONS[0].id);
  const [backdropMenuOpen, setBackdropMenuOpen] = useState(false);
  const [activeVariant, setActiveVariant] = useState(null);
  const isMember = sessionRole === "member";
  const fileInputRef = useRef(null);
  const backdropMenuRef = useRef(null);

  const currentBackdrop = useMemo(
    () =>
      BACKDROP_OPTIONS.find((option) => option.id === backdropId) ??
      BACKDROP_OPTIONS[0],
    [backdropId]
  );

  useEffect(() => {
    if (!backdropMenuOpen) return;

    const handlePointer = (event) => {
      if (
        backdropMenuRef.current &&
        !backdropMenuRef.current.contains(event.target)
      ) {
        setBackdropMenuOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === "Escape") {
        setBackdropMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [backdropMenuOpen]);

  const computeGuestStorageKey = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return `nudio_guest_usage_${currentMonth}`;
  };

  const getOrCreateGuestId = () => {
    if (isMember || typeof window === "undefined") return null;
    const storageKey = "nudio_guest_id";
    try {
      let existing = window.localStorage.getItem(storageKey);
      if (!existing) {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          existing = crypto.randomUUID();
        } else {
          existing = `guest-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        }
        window.localStorage.setItem(storageKey, existing);
      }
      return existing;
    } catch (storageError) {
      console.warn("guest-id-storage-error", storageError);
      return null;
    }
  };

  const syncGuestUsageFromServer = (remaining) => {
    if (isMember || typeof remaining !== "number") return;
    const storageKey = computeGuestStorageKey();
    const used = Math.min(
      GUEST_LIMIT,
      Math.max(0, GUEST_LIMIT - remaining)
    );
    localStorage.setItem(storageKey, used.toString());
  };

  // Get current guest usage from localStorage
  const getCurrentGuestUsage = () => {
    if (isMember) return 0;
    const storageKey = computeGuestStorageKey();
    return parseInt(localStorage.getItem(storageKey) || '0');
  };

  useEffect(() => {
    if (
      !isMember &&
      typeof usageSummary?.freeCreditsRemaining === "number"
    ) {
      syncGuestUsageFromServer(usageSummary.freeCreditsRemaining);
    }
  }, [isMember, usageSummary?.freeCreditsRemaining]);

  const authToken = accessToken || anonKey;

  // Debug logging (temporary for troubleshooting)
  console.log('PhotoEnhancer Debug:', {
    sessionRole,
    hasAccessToken: !!accessToken,
    hasAnonKey: !!anonKey,
    hasSupabaseUrl: !!supabaseUrl
  });

  const isUnlimited = usageSummary?.unlimited ?? false;
  const paidNudios = usageSummary?.creditsBalance ?? 0;
  const freeLimit = usageSummary?.freeCreditsLimit ?? GUEST_LIMIT;

  const guestUsageCount = getCurrentGuestUsage();
  const freeRemainingRaw =
    isUnlimited === true
      ? Infinity
      : isMember
        ? (usageSummary?.freeCreditsRemaining ?? 0)
        : Math.max(0, GUEST_LIMIT - guestUsageCount);

  const freeRemainingDisplay =
    freeRemainingRaw === Infinity
      ? "∞"
      : typeof freeRemainingRaw === "number"
      ? freeRemainingRaw
      : "?";

  const usageSummaryText = (() => {
    if (usageError) return usageError;
    if (isMember) {
      return isUnlimited
        ? "Member access • unlimited nudios every month"
        : `Member access • ${paidNudios} bonus nudios ready to roll`;
    }
    if (
      typeof freeRemainingRaw === "number" &&
      freeRemainingRaw <= 0
    ) {
      return "Guest mode • You used your 3 free nudios this month";
    }
    return `Guest mode • ${freeRemainingDisplay}/${freeLimit} nudios this month`;
  })();

  const handleIncomingFile = (file) => {
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

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    handleIncomingFile(file);
  };

  const handleLensDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    handleIncomingFile(file);
  };

  const handleLensDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleLensClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleLensKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleLensClickUpload();
    }
  };

  const showLensPreview = Boolean(preview && !enhancedImage);

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

          // Enable high-quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0);

          const logoMaxWidth = img.width * 0.1352; // Increased by 30% (0.104 * 1.3)
          const logoScale = logoMaxWidth / logo.width;
          const logoWidth = logo.width * logoScale;
          const logoHeight = logo.height * logoScale;

          const padding = img.width * 0.015; // Back to original padding
          const x = img.width - logoWidth - padding - 35; // Back to original left position
          const y = img.height - logoHeight - padding - 20; // Back to original bottom position

          ctx.globalAlpha = 1.0;
          // Use high-quality scaling for the watermark
          ctx.drawImage(logo, x, y, logoWidth, logoHeight);

          resolve(canvas.toDataURL("image/png", 1.0)); // Highest quality PNG
        };
        img.src = imageBase64;
      };

      logo.onerror = () => resolve(imageBase64);
      logo.src = "/nudiologo.png";
    });

  const enhanceWithGemini = async (base64Image, selectedVariant) => {
    // Get tokens from props or environment with known good fallbacks
    const rawToken = accessToken || anonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbG9maGx0bmN1c25ha2hlaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzcwOTUsImV4cCI6MjA3NjU1MzA5NX0.evf7AQnHcnp6YSccjVhp_qu8ctLOo14v9oGwnapqvaE";
    const rawAnonKey = anonKey || "60dc0b898c59d583aebe0a8a52d135f30f2d9f00e5bb714f9ffbcb382b574679";
    const rawUrl = supabaseUrl || "https://cllofhltncusnakhehdw.supabase.co";

    // Strict token validation and cleaning
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('No valid auth token available');
    }
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('No valid Supabase URL available');
    }

    // Clean tokens by removing newlines and whitespace
    const cleanToken = rawToken.replace(/[\r\n\t\s]/g, '');
    const cleanAnonKey = rawAnonKey.replace(/[\r\n\t\s]/g, '');
    const cleanUrl = rawUrl.replace(/[\r\n\t]/g, '').trim();

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanToken}`,
      "apikey": cleanAnonKey,
    };
    const guestId = getOrCreateGuestId();
    if (!isMember && guestId) {
      headers["X-Guest-Id"] = guestId;
    }

    let response;
    try {
      response = await fetch(`${cleanUrl}/functions/v1/optimize-listing`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageBase64: base64Image,
          mode: "image",
          userEmail: isMember ? userEmail : null,
          guestMode: !isMember,
          variant: selectedVariant,
          backdropId,
        }),
      });
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }

    let rawBody = null;
    let payload = {};

    try {
      rawBody = await response.text();
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      if (rawBody && !payload) {
        payload = { error: rawBody };
      }
    }

    if (!response.ok) {
      const message =
        typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : typeof payload === "string"
          ? payload
          : "Failed to enhance image";
      const error = new Error(message);
      error.usage = payload?.usage;
      error.status = response.status;
      if (typeof payload?.remaining === "number") {
        error.remaining = payload.remaining;
      }
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

  const handleQuickSave = useCallback(() => {
    if (!enhancedImage) return;
    downloadImage(`nudio-enhanced-${Date.now()}.png`);
  }, [enhancedImage]);

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
        title: "nudio shoot",
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
          title: "nudio shoot",
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
    if (loading) return;

    if (!selectedImage || !preview) {
      setError("Pop in a photo first and we'll do the rest.");
      return;
    }

    // Check guest usage limit before processing
    if (!isMember) {
      const storageKey = computeGuestStorageKey();
      const guestUsage = parseInt(localStorage.getItem(storageKey) || '0');

      if (guestUsage >= GUEST_LIMIT) {
        setError("You've enjoyed this month's guest nudios. Sign in to unlock more studio time.");
        toast("Ready for more nudios? Sign in to keep the glow going!");
        return;
      }
    }

    setLoading(true);
    setError("");
    setShowSaveOptions(false);
    setEnhancedImage("");
    const runVariant = variant;
    setActiveVariant(runVariant);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target?.result;
          const result = await enhanceWithGemini(base64Image, runVariant);
          console.log('Enhance result usage:', result?.usage);
          const borderedImage = await addWhiteBorder(result.image);
          const watermarkedImage = await addWatermark(borderedImage);

          setEnhancedImage(watermarkedImage);
          setShowSaveOptions(false);
          toast.success("Fresh nudio ready! Save it or share it in a tap.");

          if (result.usage) {
            if (!isMember && typeof result.usage.freeCreditsRemaining === "number") {
              syncGuestUsageFromServer(result.usage.freeCreditsRemaining);
            }
            onUsageUpdate?.(result.usage);
          } else if (!isMember) {
            const storageKey = computeGuestStorageKey();
            const currentUsage = parseInt(localStorage.getItem(storageKey) || '0');
            const newUsage = Math.min(GUEST_LIMIT, currentUsage + 1);
            localStorage.setItem(storageKey, newUsage.toString());

            onUsageUpdate?.({
              freeCreditsLimit: GUEST_LIMIT,
              freeCreditsRemaining: Math.max(0, GUEST_LIMIT - newUsage)
            });
          }
        } catch (err) {
          if (!isMember && typeof err?.message === "string") {
            const messageLower = err.message.toLowerCase();
            if (
              messageLower.includes("failed to fetch") ||
              messageLower.includes("cors")
            ) {
              const fallbackMessage =
                "We couldn’t reach the studio. If you’ve used your 3 guest nudios this month, sign in to keep going.";
              syncGuestUsageFromServer(0);
              onUsageUpdate?.({
                freeCreditsLimit: GUEST_LIMIT,
                freeCreditsRemaining: 0,
              });
              setError(fallbackMessage);
              toast(fallbackMessage);
              return;
            }
          }

          if (err?.usage) {
            if (!isMember && typeof err.usage.freeCreditsRemaining === "number") {
              syncGuestUsageFromServer(err.usage.freeCreditsRemaining);
            }
            onUsageUpdate?.(err.usage);
          } else if (!isMember && typeof err?.remaining === "number") {
            const remaining = Math.max(0, Math.min(GUEST_LIMIT, err.remaining));
            syncGuestUsageFromServer(remaining);
            onUsageUpdate?.({
              freeCreditsLimit: GUEST_LIMIT,
              freeCreditsRemaining: remaining,
            });
          }
          if (err?.status === 402 || err?.status === 403) {
            const limitMessage =
              err?.message &&
              err.message.toLowerCase().includes("free tier")
                ? err.message
                : "You’ve enjoyed this month’s guest nudios. Sign in to unlock more studio time.";
            setError(
              limitMessage
            );
            toast(limitMessage);
          } else {
            const fallbackMessage = err?.message || "We couldn’t finish that nudio just yet.";
            setError(fallbackMessage);
            toast.error(fallbackMessage);
          }
        } finally {
          setLoading(false);
          setActiveVariant(null);
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (err) {
      setError(err?.message || "Something went sideways. Try again.");
      setLoading(false);
      setActiveVariant(null);
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {enhancedImage && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleQuickSave}
              className="block w-full"
            >
              <img
                src={enhancedImage}
                alt="Enhanced product"
                className="block w-full h-auto object-contain"
              />
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
        )}

        {preview && (
          <img
            id="original-photo"
            src={preview}
            alt="Original upload"
            className="block w-full h-auto object-contain"
          />
        )}

        <div className="space-y-6">
          <div className="relative rounded-[32px] border border-[#211623] bg-gradient-to-br from-[#1b0e1a] via-[#0b070f] to-[#190914] text-white shadow-[0_35px_90px_rgba(12,7,18,0.55)]">
            <div className="pointer-events-none absolute -right-10 top-6 h-40 w-40 rounded-full bg-[#f8bfd6]/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-4 h-32 w-32 rounded-full bg-[#c084fc]/20 blur-3xl" />
            <div className="relative flex flex-col gap-8 p-6 sm:p-10">
              <div className="flex flex-col items-center text-center gap-5">
                <div
                  className="lens-shell w-full max-w-md aspect-square mx-auto rounded-[36px] border border-white/10 bg-black/20 p-4"
                  onClick={handleLensClickUpload}
                  onKeyDown={handleLensKeyDown}
                  onDrop={handleLensDrop}
                  onDragOver={handleLensDragOver}
                  role="button"
                  tabIndex={0}
                >
                  {showLensPreview ? (
                    <div className="relative h-full w-full rounded-[28px] border border-white/10 bg-[#050308] overflow-hidden flex items-center justify-center">
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)] opacity-40 mix-blend-screen" />
                        <div className="absolute inset-0 bg-[conic-gradient(from_180deg,#f472b6,#a855f7,#f9a8d4)] opacity-10 mix-blend-screen" />
                        <div className="absolute inset-[18px] rounded-full bg-transparent border border-[#241b22] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
                          <div className="absolute inset-1 animate-[spin_45s_linear_infinite] opacity-80">
                            <svg className="w-full h-full" viewBox="0 0 200 200">
                              <path
                                id="nudioLensPathLive"
                                d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
                                fill="transparent"
                              />
                              <text className="text-[5px] uppercase font-semibold fill-[#c59aa8] tracking-[0.4em]">
                                <textPath href="#nudioLensPathLive" startOffset="0%">
                                  nudio planar
                                </textPath>
                                <textPath href="#nudioLensPathLive" startOffset="50%">
                                  f/2.0 58mm bloom
                                </textPath>
                              </text>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <img
                        src={preview}
                        alt="Uploaded preview"
                        className="h-full w-full object-cover rounded-full"
                      />
                      {loading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 text-[#f08cac]">
                          <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#fbcfe8] animate-spin" />
                            <Loader2 className="w-full h-full animate-spin" />
                          </div>
                          <span className="font-mono text-xs tracking-[0.3em] uppercase">
                            nudioing...
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pointer-events-none">
                      <div className="scale-[0.78] sm:scale-90 md:scale-100 origin-center">
                        <LensApertureDemo />
                      </div>
                    </div>
                  )}
                  <span className="sr-only">Drop a product photo or press to upload</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.6em] text-[#f8bfd6]/70">
                    lens controls
                  </p>
                  <h3 className="text-2xl font-semibold">Camera deck</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLensClickUpload}
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/80 transition hover:bg-white/10"
                  >
                    switch photo
                  </button>
                  <button
                    type="button"
                    onClick={handleEnhancePhoto}
                    disabled={!preview || loading}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] transition ${
                      !preview || loading
                        ? "bg-white/10 text-white/30 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900 shadow-[0_12px_30px_rgba(16,185,129,0.35)] hover:shadow-[0_15px_35px_rgba(190,242,100,0.45)]"
                    }`}
                  >
                    {loading ? "nudioing" : "process"}
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full ${
                          loading ? "bg-amber-400 animate-ping" : "bg-emerald-500 opacity-75 animate-pulse"
                        }`}
                      />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.4em] text-white/60">
                      mode dial
                    </p>
                    <div
                      className="flex rounded-full border border-white/10 bg-[#140b16] p-1 text-sm font-semibold"
                      role="group"
                      aria-label="Select subject type"
                    >
                      {[{ id: "product", label: "Product" }, { id: "portrait", label: "Portrait (beta)" }].map(
                        (option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setVariant(option.id)}
                            className={`flex-1 rounded-full px-4 py-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f472b6] ${
                              variant === option.id
                                ? "bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white shadow-[0_10px_25px_rgba(244,114,182,0.35)]"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.4em] text-white/60">
                      backdrop palette
                    </p>
                    <div className="relative" ref={backdropMenuRef}>
                      <button
                        type="button"
                        onClick={() => setBackdropMenuOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#140b16] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#f472b6]/70 transition"
                        aria-label="Choose backdrop color"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: currentBackdrop.hex }}
                            aria-hidden="true"
                          />
                          <span className="font-medium tracking-wide">{currentBackdrop.label}</span>
                        </span>
                        <svg
                          className={`h-3 w-3 text-white/70 transition-transform ${backdropMenuOpen ? "rotate-180" : ""}`}
                          viewBox="0 0 10 6"
                          aria-hidden="true"
                        >
                          <path
                            d="M9 1.5L5 5.5L1 1.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {backdropMenuOpen && (
                        <div className="absolute left-0 right-0 z-20 mt-3 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#050308] shadow-[0_25px_60px_rgba(4,3,8,0.9)]">
                          {BACKDROP_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setBackdropId(option.id);
                                setBackdropMenuOpen(false);
                              }}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                                backdropId === option.id
                                  ? "bg-white/10 text-white"
                                  : "text-white/70 hover:bg-white/5"
                              }`}
                            >
                              <span
                                className="inline-block h-3.5 w-3.5 rounded-full border border-white/30"
                                style={{ backgroundColor: option.hex }}
                                aria-hidden="true"
                              />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
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

      <section className="space-y-6 rounded-[32px] border border-[#211623] bg-gradient-to-br from-[#1b0e1a] via-[#0b070f] to-[#190914] px-6 py-7 text-white shadow-[0_35px_90px_rgba(12,7,18,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/50">
              studio credits
            </p>
            <p className="text-lg font-semibold">
              Choose the bundle that fits
            </p>
            <p className="text-sm text-white/70 max-w-xl">
              {usageSummaryText}
            </p>
          </div>
          <button
            onClick={() => setShowPricing((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/80 transition hover:bg-white/10"
          >
            {showPricing ? "Hide bundles" : "More nudios"}
          </button>
        </div>

        {showPricing && (
          <div className="space-y-8 pt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(CREDIT_BUNDLES).map(([key, bundle]) => (
                <div
                  key={key}
                  className="relative flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-white/90 shadow-[inset_0_0_50px_rgba(255,255,255,0.04)]"
                >
                  {bundle.badge && (
                    <span className="self-start rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white/70">
                      {bundle.badge === "best value" ? "tight budget" : bundle.badge}
                    </span>
                  )}
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">
                      {bundle.name}
                    </p>
                    <p className="text-xs text-white/60">One-time bundle</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-semibold text-white">
                      ${bundle.price}
                    </p>
                    <p className="text-sm text-white/60">
                      {bundle.credits} nudios · ${(bundle.price / bundle.credits).toFixed(2)} each
                    </p>
                  </div>
                  <button
                    onClick={() => handlePurchase(key)}
                    disabled={processingBundle === key}
                    className={`w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      processingBundle === key
                        ? "bg-white/10 text-white/40"
                        : "bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)]"
                    }`}
                  >
                    {processingBundle === key ? "Processing..." : "Purchase"}
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0d090f]/60 px-6 py-6 space-y-4 shadow-[inset_0_0_50px_rgba(255,255,255,0.03)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">subscription</p>
                  <p className="text-lg font-semibold text-white">{SUBSCRIPTION.name}</p>
                  <p className="text-sm text-white/60">
                    Ideal for power sellers who want unlimited output
                  </p>
                </div>
                <p className="text-3xl font-semibold text-white">
                  ${SUBSCRIPTION.price}
                  <span className="text-sm font-normal text-white/60">/month</span>
                </p>
              </div>
              <ul className="text-sm text-white/70 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  <span>200 nudios each month, ready to post</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  <span>No watermark on enhanced images</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  <span>Priority processing during peak hours</span>
                </li>
              </ul>
              <button
                onClick={() => handlePurchase("subscription")}
                disabled={processingBundle === "subscription"}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                  processingBundle === "subscription"
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900 shadow-[0_12px_30px_rgba(16,185,129,0.35)] hover:shadow-[0_15px_35px_rgba(190,242,100,0.45)]"
                }`}
              >
                {processingBundle === "subscription" ? "processing" : "subscribe"}
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full ${
                      processingBundle === "subscription"
                        ? "bg-amber-400 animate-ping"
                        : "bg-emerald-500 opacity-75 animate-pulse"
                    }`}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
