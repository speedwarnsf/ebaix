import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import heic2any from "heic2any";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
  createCheckoutSession,
  redirectToCheckout,
} from "../../stripeIntegration";
import { Aperture, Loader2, Upload } from "lucide-react";
import { BACKDROP_OPTIONS } from "../../data/backdrops";

const GUEST_LIMIT = 3;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
  const [showPricing, setShowPricing] = useState(false);
  const [processingBundle, setProcessingBundle] = useState(null);
  const [variant, setVariant] = useState("product");
  const [backdropId, setBackdropId] = useState(BACKDROP_OPTIONS[0].id);
  const [backdropMenuOpen, setBackdropMenuOpen] = useState(false);
  const [activeVariant, setActiveVariant] = useState(null);
  const [shareShowcase, setShareShowcase] = useState(null);

  useEffect(() => {
    return () => {
      if (shareShowcase?.objectUrl) {
        URL.revokeObjectURL(shareShowcase.objectUrl);
      }
    };
  }, [shareShowcase]);
  const [sharePreparing, setSharePreparing] = useState(false);
  const modeButtons = [
    { id: "product", label: "Product", type: "variant" },
    { id: "labs", label: "Portrait lab", type: "labs" },
  ];
  const isMember = sessionRole === "member";
  const subscriptionActive =
    usageSummary?.subscriptionActive === true ||
    usageSummary?.subscription_active === true;
  const watermarkDisabled =
    Boolean(subscriptionActive) ||
    Boolean(usageSummary?.watermarkDisabled);
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

  const updateShareShowcase = useCallback((payload) => {
    setShareShowcase((previous) => {
      if (previous?.objectUrl) {
        URL.revokeObjectURL(previous.objectUrl);
      }
      return payload;
    });
    setShareRewardError("");
  }, []);

  const loadImageElement = useCallback(
    (src) =>
      new Promise((resolve, reject) => {
        if (!src) {
          reject(new Error("Missing source"));
          return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }),
    []
  );

  const createShareComposite = useCallback(
    async (beforeSrc, afterSrc) => {
      if (!beforeSrc || !afterSrc || typeof document === "undefined") {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const [beforeImg, afterImg, logoImg] = await Promise.all([
        loadImageElement(beforeSrc),
        loadImageElement(afterSrc),
        loadImageElement("/nudioheader.jpg"),
      ]);

      const logoScale = canvas.width / logoImg.width;
      const logoHeight = logoImg.height * logoScale;
      const letterbox = Math.max(0, (canvas.height - logoHeight) / 2);

      const drawBars = () => {
        ctx.fillStyle = "#050305";
        ctx.fillRect(0, 0, canvas.width, letterbox);
        ctx.fillRect(0, canvas.height - letterbox, canvas.width, letterbox);
      };

      const drawLogoStage = () => {
        ctx.fillStyle = "#050305";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBars();
        ctx.drawImage(logoImg, 0, (canvas.height - logoHeight) / 2, canvas.width, logoHeight);
      };

      const drawPinkStage = () => {
        ctx.fillStyle = "rgb(228,203,203)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBars();
      };

      const drawImageFrame = (img) => {
        drawPinkStage();
        const availableHeight = canvas.height - letterbox * 2 - 40;
        const availableWidth = canvas.width * 0.9;
        const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
        const width = img.width * ratio;
        const height = img.height * ratio;
        ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      };

      drawLogoStage();
      drawImageFrame(afterImg);
      drawImageFrame(beforeImg);
      return canvas.toDataURL("image/png");
    },
    [loadImageElement]
  );

  const createShareAnimation = useCallback(
    async (beforeSrc, afterSrc) => {
      if (
        !beforeSrc ||
        !afterSrc ||
        typeof document === "undefined" ||
        typeof MediaRecorder === "undefined"
      ) {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx || typeof canvas.captureStream !== "function") {
        return null;
      }

      const [beforeImg, afterImg, logoImg] = await Promise.all([
        loadImageElement(beforeSrc),
        loadImageElement(afterSrc),
        loadImageElement("/nudioheader.jpg"),
      ]);

      const stream = canvas.captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const logoScale = canvas.width / logoImg.width;
      const logoHeight = logoImg.height * logoScale;
      const LETTERBOX = Math.max(0, (canvas.height - logoHeight) / 2);
      const drawBars = () => {
        ctx.fillStyle = "#030204";
        ctx.fillRect(0, 0, canvas.width, LETTERBOX);
        ctx.fillRect(0, canvas.height - LETTERBOX, canvas.width, LETTERBOX);
      };
      const drawPinkStage = () => {
        ctx.fillStyle = "rgb(228,203,203)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBars();
      };
      const drawLogoStage = () => {
        ctx.fillStyle = "#050305";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBars();
        const ratio = canvas.width / logoImg.width;
        const width = canvas.width;
        const height = logoImg.height * ratio;
        ctx.drawImage(
          logoImg,
          0,
          (canvas.height - height) / 2,
          width,
          height
        );
      };
      const drawImageFit = (img) => {
        drawPinkStage();
        const availableHeight = canvas.height - LETTERBOX * 2 - 40;
        const availableWidth = canvas.width * 0.9;
        const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
        const width = img.width * ratio;
        const height = img.height * ratio;
        ctx.drawImage(
          img,
          (canvas.width - width) / 2,
          (canvas.height - height) / 2,
          width,
          height
        );
      };

      recorder.start();

      const renderPhase = async (drawFn, duration) => {
        const fps = 30;
        const frameTime = 1000 / fps;
        const frames = Math.max(1, Math.round((duration / 1000) * fps));
        for (let i = 0; i < frames; i += 1) {
          drawFn(i / frames);
          await wait(frameTime);
        }
      };

      const sequence = [
        { draw: () => drawLogoStage(), duration: 1600 },
        { draw: () => drawImageFit(afterImg), duration: 2200 },
        { draw: () => drawImageFit(beforeImg), duration: 1500 },
        { draw: () => drawImageFit(afterImg), duration: 2000 },
        { draw: () => drawImageFit(afterImg), duration: 2000 },
        { draw: () => drawImageFit(beforeImg), duration: 1500 },
        { draw: () => drawImageFit(afterImg), duration: 2200 },
        { draw: () => drawLogoStage(), duration: 1600 },
      ];

      for (const phase of sequence) {
        await renderPhase(phase.draw, phase.duration);
      }

      await wait(200);
      const blobPromise = new Promise((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
      });
      recorder.stop();
      const blob = await blobPromise;
      return blob;
    },
    [loadImageElement]
  );

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

  const handleSaveToCameraRoll = useCallback(
    async (imageOverride, silent = false, fileLabel = "nudio", skipDownloadFallback = false) => {
      const source = imageOverride || enhancedImage;
      if (!source || typeof window === "undefined") return;

      try {
        const blob = dataUrlToBlob(source);
        if (!blob) return;
        const fileName = `${fileLabel}-${Date.now()}.png`;
        let shared = false;
        const canAttemptShare =
          navigator.share &&
          navigator.canShare?.({
            files: [new File([blob], fileName, { type: blob.type })],
          });

        if (canAttemptShare) {
          try {
            const file = new File([blob], fileName, { type: blob.type });
            await navigator.share({
              files: [file],
              title: "nudio lens lab",
              text: "Captured straight from the lens.",
              url: "https://nudio.ai",
            });
            shared = true;
          } catch (shareErr) {
            console.warn("native-share-failed", shareErr);
          }
        }

        if (!shared && skipDownloadFallback) {
          if (!silent) {
            toast("Saved locally—check your camera roll.");
          }
          return;
        }

        if (!shared) {
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = downloadUrl;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(downloadUrl);
          if (!silent) {
            toast.success("Saved to downloads.");
          }
        }
      } catch (shareError) {
        if (!silent) {
          console.warn("Camera roll save not available.", shareError);
        }
      }
    },
    [enhancedImage]
  );

  const shareBeforeAfterStory = useCallback(
    async (beforeSrc, afterSrc) => {
      if (!beforeSrc || !afterSrc || typeof window === "undefined") return;
      try {
        setSharePreparing(true);
        const animationBlob = await createShareAnimation(beforeSrc, afterSrc);
        if (animationBlob) {
          const shareFile = new File([animationBlob], `nudio-story-${Date.now()}.webm`, {
            type: animationBlob.type || "video/webm",
          });
          const previewUrl = URL.createObjectURL(animationBlob);
          updateShareShowcase({
            type: "video",
            url: previewUrl,
            objectUrl: previewUrl,
            createdAt: Date.now(),
          });

          if (
            navigator.share &&
            navigator.canShare?.({ files: [shareFile] })
          ) {
            try {
              await navigator.share({
                files: [shareFile],
                title: "nudio before & after",
                text: "Swipe to see the glow-up • nudio.ai",
                url: "https://nudio.ai",
              });
            } catch (shareErr) {
              console.warn("native-share-blocked", shareErr);
            }
          } else {
            toast("Clip ready below—press and hold to save or post.");
          }
          return;
        }

        const fallbackDataUrl = await createShareComposite(beforeSrc, afterSrc);
        if (fallbackDataUrl) {
          updateShareShowcase({
            type: "image",
            url: fallbackDataUrl,
            createdAt: Date.now(),
          });
          toast("Share artwork ready below.");
        }
      } catch (shareError) {
        console.error("share-story-error", shareError);
        toast.error("Couldn’t open sharing—saved the clip instead.");
      } finally {
        setSharePreparing(false);
      }
    },
    [createShareAnimation, createShareComposite, handleSaveToCameraRoll, updateShareShowcase]
  );

  const handleShareAssetDownload = useCallback(() => {
    if (!shareShowcase?.url) return;
    const anchor = document.createElement("a");
    anchor.href = shareShowcase.url;
    anchor.download =
      shareShowcase.type === "video"
        ? `nudio-share-${Date.now()}.webm`
        : `nudio-share-${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [shareShowcase]);

  const optimizeImageFile = useCallback(async (file) => {
    if (!file || file.size <= MAX_UPLOAD_BYTES) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("We couldn't read that image. Try a JPG or PNG."));
        img.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("We couldn't prepare that image. Try a JPG or PNG.");
      }

      let scale = 1;
      let quality = 0.9;
      let blob = null;
      let width = image.width;
      let height = image.height;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality)
        );

        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          break;
        }

        scale *= 0.85;
        quality = Math.max(0.7, quality - 0.1);
      }

      if (!blob) {
        throw new Error("We couldn't optimize that image.");
      }

      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new Error("Image is too large after optimization. Please choose a smaller file.");
      }

      const safeName = file.name.replace(/\\.[^/.]+$/, "") || "upload";
      return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const convertHeicIfNeeded = useCallback(async (file) => {
    if (!file) return file;
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    if (!isHeic) return file;

    try {
      toast("Converting HEIC...");
      const output = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      const blob = Array.isArray(output) ? output[0] : output;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (error) {
      throw new Error("HEIC conversion failed. Please upload a JPG or PNG.");
    }
  }, []);
  const saveOriginalCaptureIfNeeded = useCallback(
    (dataUrl, file) => {
      if (!dataUrl || !file) return;
      const normalized = (file.name || "").toLowerCase();
      const genericName = ["image.jpg", "image.jpeg", "image.png", "capturedimage.jpg"].includes(normalized);
      const recentCapture = Math.abs(Date.now() - (file.lastModified || Date.now())) < 5000;
      if (!genericName && !recentCapture) {
        return;
      }
      handleSaveToCameraRoll(dataUrl, true, "nudio-original", true);
    },
    [handleSaveToCameraRoll]
  );

  const handleIncomingFile = useCallback(
    async (file) => {
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      setError("");
      let preparedFile = file;
      try {
        preparedFile = await convertHeicIfNeeded(preparedFile);
      } catch (convertError) {
        setError(convertError?.message || "HEIC conversion failed.");
        return;
      }
      if (preparedFile.size > MAX_UPLOAD_BYTES) {
        try {
          toast("Large image detected. Optimizing for upload...");
          preparedFile = await optimizeImageFile(preparedFile);
        } catch (optimizeError) {
          setError(optimizeError?.message || "JPG or PNG up to 10MB");
          return;
        }
      }

      setSelectedImage(preparedFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result ?? "";
        setPreview(result);
        setEnhancedImage("");
        saveOriginalCaptureIfNeeded(result, preparedFile);
      };
      reader.readAsDataURL(preparedFile);
    },
    [optimizeImageFile, saveOriginalCaptureIfNeeded]
  );

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
          const finalImage = watermarkDisabled ? borderedImage : await addWatermark(borderedImage);

          setEnhancedImage(finalImage);
          toast.success("Fresh nudio ready! Save it or share it in a tap.");
          await handleSaveToCameraRoll(finalImage, true, "nudio-enhanced", true);
          shareBeforeAfterStory(preview, finalImage);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-8 sm:space-y-10">
      <section className="space-y-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-8">
          <div className="w-full flex justify-center" style={{ maxWidth: "min(420px, calc(100vw - 48px))" }}>
            <div className="relative w-full" style={{ paddingBottom: "100%" }}>
              <div
                className="absolute inset-0 rounded-full bg-[#121014] shadow-[0_30px_60px_rgba(7,5,9,0.55)] flex items-center justify-center cursor-pointer group"
                onClick={handleLensClickUpload}
                onKeyDown={handleLensKeyDown}
                onDrop={handleLensDrop}
                onDragOver={handleLensDragOver}
                role="button"
                tabIndex={0}
              >
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
                <div className="absolute inset-[18px] rounded-full bg-[#0b090d] border border-[#241b22] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
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
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.5em] text-[#f08cac] font-semibold">
                    NU
                  </div>
                </div>

                <div className="absolute inset-[48px] rounded-full bg-black border-[3px] border-[#1d1420] shadow-[inset_0_15px_35px_rgba(0,0,0,1)] overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)] opacity-60 mix-blend-screen pointer-events-none" />
                  <div className="absolute inset-0 bg-[conic-gradient(from_180deg,#f472b6,#a855f7,#f9a8d4)] opacity-10 mix-blend-screen pointer-events-none" />

                  {!showLensPreview && !loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#d9b6c5] gap-2 uppercase tracking-[0.4em] text-[10px]">
                      <Upload className="w-9 h-9" />
                      Drop Photo
                    </div>
                  )}

                  {!showLensPreview && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-25 group-hover:opacity-10 transition-all duration-700">
                      <Aperture className="w-4/5 h-4/5 text-[#46313f]" strokeWidth={0.4} />
                    </div>
                  )}

                  {showLensPreview && (
                    <>
                      <img src={preview} alt="Uploaded preview" className="w-full h-full object-cover opacity-95 rounded-full" />
                      <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="rounded-full bg-[#f06ca8]/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.4em] text-white">
                          tap to change
                        </span>
                      </div>
                    </>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-[#f08cac] gap-3">
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#fbcfe8] animate-spin" />
                        <Loader2 className="w-full h-full animate-spin" />
                      </div>
                      <span className="font-mono text-xs tracking-[0.3em] uppercase">
                        nudioing
                      </span>
                    </div>
                  )}
                </div>

                <span className="sr-only">Drop a product photo or press to upload</span>
              </div>
            </div>
          </div>

          {sessionRole !== "member" && (
            <div className="text-[10px] uppercase tracking-[0.4em] text-white/70 bg-white/5 border border-white/10 rounded-full px-4 py-2">
              guest nudios {freeRemainingDisplay}/{freeLimit}
            </div>
          )}

          <div className="flex gap-2 rounded-full bg-[#140b16] border border-white/10 p-1 text-xs font-semibold uppercase tracking-[0.4em] text-white/70 max-w-md w-full justify-center">
            {modeButtons.map((option) => {
              const isAction = option.type === "labs";
              const isActive = !isAction && variant === option.id;
              const activeClasses = isActive
                ? "bg-white text-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.25)]"
                : "text-white/70";
              const labsClasses = "bg-gradient-to-r from-[#a855f7]/90 to-[#ec4899]/90 text-white shadow-[0_10px_30px_rgba(236,72,153,0.35)]";
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => (isAction ? onLensLabLaunch?.() : setVariant(option.id))}
                  className={`flex-1 rounded-full px-3 py-2 transition ${
                    isAction ? labsClasses : activeClasses
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="w-full flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto text-white">
            <div className="relative flex-1" ref={backdropMenuRef}>
              <button
                type="button"
                onClick={() => setBackdropMenuOpen((prev) => !prev)}
                className="w-full rounded-full border border-white/20 bg-[#140b16] px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-white">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: currentBackdrop.hex }}
                  />
                  {currentBackdrop.label}
                </span>
                <svg className={`h-3 w-3 text-white transition ${backdropMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6">
                  <path d="M9 1.5L5 5.5L1 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {backdropMenuOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b070d] shadow-[0_20px_40px_rgba(5,4,8,0.7)]">
                  {BACKDROP_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setBackdropId(option.id);
                        setBackdropMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                        backdropId === option.id ? "bg-slate-900 text-white" : "text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-white/30"
                        style={{ backgroundColor: option.hex }}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleEnhancePhoto}
              disabled={!preview || loading}
              className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.4em] transition ${
                !preview || loading
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900 shadow-[0_12px_30px_rgba(16,185,129,0.35)] hover:shadow-[0_15px_35px_rgba(190,242,100,0.45)]"
              }`}
            >
              {loading ? "nudioing..." : "process"}
            </button>
          </div>

          {sharePreparing && (
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/70 text-center">
              crafting share clip…
            </p>
          )}
        </div>

        {!loading &&
          freeRemainingRaw !== Infinity &&
          typeof freeRemainingRaw === "number" &&
          freeRemainingRaw <= 0 && (
            <p className="text-sm text-slate-600 text-center">
              Ready for more? Sign in or grab a bundle to keep the magic going.
            </p>
          )}
      </section>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {enhancedImage && (
        <div className="space-y-4 text-center">
          <img src={enhancedImage} alt="Enhanced product" className="block w-full h-auto object-contain rounded-2xl" />
          <button
            onClick={resetWorkspace}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Start another nudio
          </button>
        </div>
      )}

      {shareShowcase && (
        <section className="space-y-5 rounded-[32px] border border-[#211623] bg-gradient-to-br from-[#1b0e1a] via-[#0b070f] to-[#190914] px-6 py-7 text-white shadow-[0_35px_90px_rgba(12,7,18,0.45)]">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/50">share ready</p>
            <p className="text-lg font-semibold">Show it off</p>
            <p className="text-sm text-white/70">
              Tap the preview to download instantly—then drop it on Instagram, TikTok, or wherever your audience hangs out.
            </p>
          </div>

          <div
            className="group relative rounded-3xl border border-white/10 bg-black/40 overflow-hidden cursor-pointer"
            onClick={handleShareAssetDownload}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleShareAssetDownload();
              }
            }}
          >
            {shareShowcase.type === "video" ? (
              <video
                src={shareShowcase.url}
                playsInline
                loop
                muted
                autoPlay
                className="w-full aspect-square sm:aspect-video pointer-events-none"
              />
            ) : (
              <img src={shareShowcase.url} alt="Share preview" className="w-full h-auto block pointer-events-none" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
              <span className="rounded-full border border-white/30 bg-black/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-white">
                tap to download & share
              </span>
            </div>
          </div>

          <p className="text-xs text-white/60">
            Tag <span className="font-semibold">@nudio.ai</span> or #nudio so we can shout you out.
          </p>
        </section>
      )}

      <section className="space-y-6 rounded-[32px] border border-[#211623] bg-gradient-to-br from-[#1b0e1a] via-[#0b070f] to-[#190914] px-6 py-7 text-white shadow-[0_35px_90px_rgba(12,7,18,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/50">
              studio credits
            </p>
            <p className="text-sm text-white/70 max-w-xl font-semibold">
              Unlock nudios instantly
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
