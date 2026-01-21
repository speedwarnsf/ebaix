import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Aperture, Loader2, Upload } from "lucide-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect, ResourcePicker } from "@shopify/app-bridge/actions";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { BACKDROP_OPTIONS } from "../../data/backdrops";
import { resolveShopifyHost, resolveShopifyShop } from "../../lib/shopifyAppBridge";
import { LegalModal } from "./LegalModal";
import { ShopifyPrivacyPolicy } from "./ShopifyPrivacyPolicy";
import { ShopifyTermsOfService } from "./ShopifyTermsOfService";
import heic2any from "heic2any";

const CUSTOM_BACKDROP_ID = "custom";
const CUSTOM_BACKDROP_KEY = "nudio:customBackdrop";
const FRAME_TOGGLE_KEY = "nudio:frameEnabled";
const DEFAULT_CUSTOM_BACKDROP = "#ffffff";
const PROCESS_PRICE = 0.08;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 2400;

export function PhotoEnhancer({
  userEmail,
  anonKey,
  supabaseUrl,
}) {
  const app = useAppBridge();
  const shop = resolveShopifyShop();
  const host = resolveShopifyHost();
  const backendBaseUrl = process.env.REACT_APP_SHOPIFY_BACKEND_URL || "";
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billingReady, setBillingReady] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingChecked, setBillingChecked] = useState(false);
  const [usageCharged, setUsageCharged] = useState(false);
  const [usageChargeError, setUsageChargeError] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [processingFailed, setProcessingFailed] = useState(false);
  const [lastChargeAt, setLastChargeAt] = useState(null);
  const [lastPublishedProductId, setLastPublishedProductId] = useState("");
  const [activeLegal, setActiveLegal] = useState(null);
  const [backdropId, setBackdropId] = useState(BACKDROP_OPTIONS[0].id);
  const [backdropMenuOpen, setBackdropMenuOpen] = useState(false);
  const [shareShowcase, setShareShowcase] = useState(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourceImages, setSourceImages] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceMenuPosition, setSourceMenuPosition] = useState({ x: 0, y: 0 });
  const [installRequired, setInstallRequired] = useState(false);
  const [installUrl, setInstallUrl] = useState("");
  const [customBackdrop, setCustomBackdrop] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM_BACKDROP;
    const stored = window.localStorage.getItem(CUSTOM_BACKDROP_KEY);
    if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
      return stored;
    }
    return DEFAULT_CUSTOM_BACKDROP;
  });
  const [frameEnabled, setFrameEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(FRAME_TOGGLE_KEY);
    if (stored === "false") return false;
    return true;
  });

  useEffect(() => {
    return () => {
      if (shareShowcase?.objectUrl) {
        URL.revokeObjectURL(shareShowcase.objectUrl);
      }
    };
  }, [shareShowcase]);
  const [sharePreparing, setSharePreparing] = useState(false);
  const fileInputRef = useRef(null);
  const backdropMenuRef = useRef(null);
  const sourceMenuRef = useRef(null);
  const lensWrapperRef = useRef(null);
  const installRedirectedRef = useRef(false);
  const watermarkDisabled = true;

  const usageEmail = useMemo(() => {
    if (userEmail) return userEmail;
    if (!shop) return null;
    const safeShop = shop.replace(/[^a-z0-9-]/gi, "-");
    return `shop-${safeShop}@nudio.ai`;
  }, [shop, userEmail]);

  const backdropOptions = useMemo(
    () => [
      ...BACKDROP_OPTIONS,
      {
        id: CUSTOM_BACKDROP_ID,
        label: "Custom color",
        description: "your custom studio backdrop",
        hex: customBackdrop,
      },
    ],
    [customBackdrop]
  );

  const currentBackdrop = useMemo(
    () =>
      backdropOptions.find((option) => option.id === backdropId) ??
      backdropOptions[0],
    [backdropId, backdropOptions]
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

  useEffect(() => {
    if (!sourcePickerOpen) return;

    const handlePointer = (event) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(event.target)) {
        setSourcePickerOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSourcePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [sourcePickerOpen]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_BACKDROP_KEY, customBackdrop);
  }, [customBackdrop]);

  const buildBackendUrl = useCallback(
    (path) => {
      const base = backendBaseUrl.replace(/\/$/, "");
      const url = new URL(path, base);
      if (shop) {
        url.searchParams.set("shop", shop);
      }
      if (host) {
        url.searchParams.set("host", host);
      }
      return url.toString();
    },
    [backendBaseUrl, host, shop]
  );

  const redirectToInstall = useCallback(
    (nextUrl) => {
      if (!nextUrl || !app) return;
      const redirect = Redirect.create(app);
      let resolvedUrl = nextUrl;
      try {
        resolvedUrl = new URL(nextUrl, window.location.origin).toString();
      } catch {
        resolvedUrl = nextUrl;
      }
      redirect.dispatch(Redirect.Action.REMOTE, {
        url: resolvedUrl,
        newContext: true,
      });
    },
    [app]
  );

  useEffect(() => {
    if (installRequired && installUrl && app && !installRedirectedRef.current) {
      installRedirectedRef.current = true;
      redirectToInstall(installUrl);
    } else if (!installRequired) {
      installRedirectedRef.current = false;
    }
  }, [app, installRequired, installUrl, redirectToInstall]);

  const shopifyFetch = useCallback(
    async (path, options = {}) => {
      if (!shop) {
        throw new Error("Missing Shopify shop context.");
      }
      if (!app) {
        throw new Error("Missing Shopify app bridge.");
      }
      let token = "";
      try {
        token = await getSessionToken(app);
      } catch {
        token = "";
      }
      if (!token) {
        throw new Error("Session token unavailable. Open Nudio from Shopify Admin.");
      }
      const { headers: optionHeaders, ...restOptions } = options;
      const response = await fetch(buildBackendUrl(path), {
        ...restOptions,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(optionHeaders || {}),
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail = payload?.detail ?? payload;
        const installLink = detail?.install_url;
        if (installLink) {
          setInstallRequired(true);
          setInstallUrl(installLink);
          throw new Error("Shopify install required.");
        }
        let message = detail?.error || detail?.message || payload?.error;
        if (!message) {
          message = "Shopify request failed.";
        } else if (typeof message === "object") {
          message = JSON.stringify(message);
        }
        throw new Error(message);
      }
      if (installRequired) {
        setInstallRequired(false);
        setInstallUrl("");
      }
      return response.json();
    },
    [app, buildBackendUrl, installRequired, shop]
  );

  const shopifyFetchBlob = useCallback(
    async (path, formData) => {
      if (!shop) {
        throw new Error("Missing Shopify shop context.");
      }
      if (!app) {
        throw new Error("Missing Shopify app bridge.");
      }
      let token = "";
      try {
        token = await getSessionToken(app);
      } catch {
        token = "";
      }
      if (!token) {
        throw new Error("Session token unavailable. Open Nudio from Shopify Admin.");
      }
      const response = await fetch(buildBackendUrl(path), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail = payload?.detail ?? payload;
        const installLink = detail?.install_url;
        if (installLink) {
          setInstallRequired(true);
          setInstallUrl(installLink);
          throw new Error("Shopify install required.");
        }
        let message = detail?.error || detail?.message || payload?.error;
        if (!message) {
          message = "Shopify request failed.";
        } else if (typeof message === "object") {
          message = JSON.stringify(message);
        }
        throw new Error(message);
      }
      if (installRequired) {
        setInstallRequired(false);
        setInstallUrl("");
      }
      return response.blob();
    },
    [app, buildBackendUrl, installRequired, shop]
  );

  useEffect(() => {
    if (!shop || billingChecked || installRequired) return;
    let active = true;
    const fetchBilling = async () => {
      try {
        const payload = await shopifyFetch("/shopify/billing/active");
        if (!active) return;
        const subscriptions = payload?.subscriptions || [];
        const hasActive = subscriptions.some(
          (subscription) => subscription?.name === "Nudio (Product Studio)"
        );
        setBillingReady(hasActive);
      } catch (err) {
        if (!active) return;
        setBillingError(err?.message || "We couldn't confirm billing status.");
      } finally {
        if (active) {
          setBillingChecked(true);
        }
      }
    };
    fetchBilling();
    return () => {
      active = false;
    };
  }, [billingChecked, installRequired, shop, shopifyFetch]);

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

  const openSourceMenu = (event) => {
    const rect = lensWrapperRef.current?.getBoundingClientRect();
    if (rect) {
      const x = event?.clientX ? event.clientX - rect.left : rect.width / 2;
      const y = event?.clientY ? event.clientY - rect.top : rect.height / 2;
      setSourceMenuPosition({ x, y });
    }
    setSourcePickerOpen(true);
  };

  const handleLensClickUpload = (event) => {
    openSourceMenu(event);
  };

  const handleUploadOption = () => {
    setSourcePickerOpen(false);
    setSourceImages([]);
    setSourceError("");
    fileInputRef.current?.click();
  };

  const promptProductSelection = useCallback(() => {
    return new Promise((resolve) => {
      if (!app) {
        resolve(null);
        return;
      }
      const picker = ResourcePicker.create(app, {
        resourceType: ResourcePicker.ResourceType.Product,
        options: { selectMultiple: false },
      });
      picker.subscribe(ResourcePicker.Action.SELECT, ({ selection }) => {
        const product = selection?.[0];
        picker.dispatch(ResourcePicker.Action.CLOSE);
        if (!product) {
          resolve(null);
          return;
        }
        const restId = String(product.id).split("/").pop();
        resolve({ id: restId, title: product.title });
      });
      picker.subscribe(ResourcePicker.Action.CANCEL, () => {
        picker.dispatch(ResourcePicker.Action.CLOSE);
        resolve(null);
      });
      picker.dispatch(ResourcePicker.Action.OPEN);
    });
  }, [app]);

  const handleOpenShopifyPicker = useCallback(async () => {
    setSourceError("");
    setSourceLoading(true);
    try {
      let product = selectedProduct;
      if (!product) {
        product = await promptProductSelection();
        if (!product) {
          setSourcePickerOpen(false);
          return;
        }
        setSelectedProduct(product);
      }
      const payload = await shopifyFetch(`/shopify/products/${product.id}/images`);
      const images = (payload?.images || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      setSourceImages(images);
    } catch (err) {
      setSourceError(err?.message || "Could not load product images.");
    } finally {
      setSourceLoading(false);
    }
  }, [promptProductSelection, selectedProduct, shopifyFetch]);

  const handleLensKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSourceMenu();
    }
  };

  const optimizeImageFile = useCallback(async (file) => {
    if (!file) {
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

      const maxDimension = Math.max(image.width, image.height);
      if (file.size <= MAX_UPLOAD_BYTES && maxDimension <= MAX_UPLOAD_DIMENSION) {
        return file;
      }

      let scale = Math.min(1, MAX_UPLOAD_DIMENSION / maxDimension);
      let quality = 0.9;
      let blob = null;
      let width = image.width;
      let height = image.height;
      const baseScale = scale;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const attemptScale = Math.max(0.35, baseScale * Math.pow(0.85, attempt));
        canvas.width = Math.max(1, Math.floor(width * attemptScale));
        canvas.height = Math.max(1, Math.floor(height * attemptScale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality)
        );

        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          break;
        }

        quality = Math.max(0.8, quality - 0.1);
      }

      if (!blob) {
        throw new Error("We couldn't optimize that image.");
      }

      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new Error("Image is too large after optimization. Please choose a smaller file.");
      }

      const safeName = file.name.replace(/\.[^/.]+$/, "") || "upload";
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
      const formData = new FormData();
      formData.append("file", file, file.name || "upload.heic");
      const blob = await shopifyFetchBlob("/shopify/convert-heic", formData);
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch {
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
      } catch {
        try {
          const objectUrl = URL.createObjectURL(file);
          let bitmap = null;
          try {
            if (typeof createImageBitmap === "function") {
              bitmap = await createImageBitmap(file);
            }
          } catch {
            bitmap = null;
          }

          const image =
            bitmap ||
            (await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = objectUrl;
            }));

          const width = bitmap ? bitmap.width : image.naturalWidth || image.width;
          const height = bitmap ? bitmap.height : image.naturalHeight || image.height;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas unavailable");
          }
          ctx.drawImage(image, 0, 0, width, height);

          const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.92)
          );
          if (!blob) {
            throw new Error("HEIC canvas conversion failed");
          }
          const converted = new File(
            [blob],
            file.name.replace(/\.(heic|heif)$/i, ".jpg"),
            { type: "image/jpeg" }
          );
          if (bitmap && typeof bitmap.close === "function") {
            bitmap.close();
          }
          URL.revokeObjectURL(objectUrl);
          return converted;
        } catch {
          throw new Error("HEIC conversion failed. Please upload a JPG or PNG.");
        }
      }
    }
  }, [shopifyFetchBlob]);

  const handleCustomBackdropChange = useCallback((event) => {
    const nextColor = event.target.value;
    if (!/^#[0-9a-fA-F]{6}$/.test(nextColor)) return;
    setCustomBackdrop(nextColor);
    setBackdropId(CUSTOM_BACKDROP_ID);
    setBackdropMenuOpen(false);
  }, []);

  const handleFrameToggle = () => {
    setFrameEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(FRAME_TOGGLE_KEY, String(next));
      }
      return next;
    });
  };

  const updateShareShowcase = useCallback((payload) => {
    setShareShowcase((previous) => {
      if (previous?.objectUrl) {
        URL.revokeObjectURL(previous.objectUrl);
      }
      return payload;
    });
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
    let payload = {};
    try {
      payload = {
        imageBase64: base64Image,
        mode: "image",
        userEmail: usageEmail,
        variant: selectedVariant,
        backdropId,
      };
      if (backdropId === CUSTOM_BACKDROP_ID) {
        payload.backdropHex = customBackdrop;
      }

      return await shopifyFetch("/shopify/optimize-listing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
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
        console.warn("share-story-fallback", shareError);
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
      try {
        if (preparedFile.size > MAX_UPLOAD_BYTES) {
          toast("Large image detected. Optimizing for upload...");
        }
        preparedFile = await optimizeImageFile(preparedFile);
      } catch (optimizeError) {
        setError(optimizeError?.message || "JPG or PNG up to 6MB");
        return;
      }

      setSelectedImage(preparedFile);
      setUsageCharged(false);
      setUsageChargeError("");
      setPublishError("");
      setProcessingFailed(false);

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

  const dataUrlToFile = async (dataUrl, filename) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  };

  const handleShopifyImageSelect = useCallback(
    async (image) => {
      setSourceError("");
      setSourceLoading(true);
      try {
        const payload = await shopifyFetch(
          `/shopify/images/fetch?src=${encodeURIComponent(image.src)}`
        );
        const dataUrl = payload?.data_url;
        if (!dataUrl) {
          throw new Error("Image fetch failed.");
        }
        const file = await dataUrlToFile(dataUrl, "shopify-image.jpg");
        setSourcePickerOpen(false);
        setSourceImages([]);
        await handleIncomingFile(file);
      } catch (err) {
        setSourceError(err?.message || "Could not import that image.");
      } finally {
        setSourceLoading(false);
      }
    },
    [handleIncomingFile, shopifyFetch]
  );

  const handleEnableBilling = useCallback(async () => {
    if (installRequired && installUrl) {
      redirectToInstall(installUrl);
      return;
    }
    setBillingError("");
    setBillingLoading(true);
    try {
      const payload = await shopifyFetch("/shopify/billing/ensure", {
        method: "POST",
      });
      if (payload?.active) {
        setBillingReady(true);
        return;
      }
      const confirmationUrl = payload?.confirmationUrl;
      if (confirmationUrl) {
        redirectToInstall(confirmationUrl);
      } else {
        throw new Error("Billing confirmation unavailable.");
      }
    } catch (err) {
      setBillingError(err?.message || "Billing setup failed.");
    } finally {
      setBillingLoading(false);
    }
  }, [installRequired, installUrl, redirectToInstall, shopifyFetch]);

  const handleSelectProduct = useCallback(() => {
    if (!app) {
      toast.error("Shopify App Bridge unavailable.");
      return;
    }
    const picker = ResourcePicker.create(app, {
      resourceType: ResourcePicker.ResourceType.Product,
      options: {
        selectMultiple: false,
      },
    });
    picker.subscribe(ResourcePicker.Action.SELECT, ({ selection }) => {
      const product = selection?.[0];
      if (product) {
        const restId = String(product.id).split("/").pop();
        setSelectedProduct({
          id: restId,
          title: product.title,
        });
      }
      picker.dispatch(ResourcePicker.Action.CLOSE);
    });
    picker.dispatch(ResourcePicker.Action.OPEN);
  }, [app]);

  const handleUsageCharge = useCallback(async () => {
    if (usageCharged) return true;
    setUsageChargeError("");
    try {
      await shopifyFetch("/shopify/billing/usage", {
        method: "POST",
        body: JSON.stringify({
          description: "Nudio image processing",
          price: PROCESS_PRICE,
        }),
      });
      setUsageCharged(true);
      setLastChargeAt(new Date());
      return true;
    } catch (err) {
      setUsageChargeError(err?.message || "Usage charge failed.");
      return false;
    }
  }, [shopifyFetch, usageCharged]);

  const handlePublishToShopify = useCallback(async () => {
    if (!selectedProduct?.id || !enhancedImage) return;
    setPublishError("");
    setPublishLoading(true);
    try {
      await shopifyFetch(`/shopify/products/${selectedProduct.id}/images?make_primary=1`, {
        method: "POST",
        body: JSON.stringify({
          image_base64: enhancedImage,
          filename: "nudio-product.png",
        }),
      });
      toast.success("Published to Shopify.");
      setLastPublishedProductId(selectedProduct.id);
    } catch (err) {
      setPublishError(err?.message || "Publish failed.");
    } finally {
      setPublishLoading(false);
    }
  }, [enhancedImage, selectedProduct, shopifyFetch]);

  const handleViewProduct = useCallback(() => {
    if (!app || !lastPublishedProductId) return;
    Redirect.create(app).dispatch(
      Redirect.Action.ADMIN_PATH,
      `/products/${lastPublishedProductId}`
    );
  }, [app, lastPublishedProductId]);

  const handleEnhancePhoto = async () => {
    if (loading) return;

    if (!selectedImage || !preview) {
      setError("Pop in a photo first and we'll do the rest.");
      return;
    }

    if (!usageEmail) {
      setError("We need a Shopify shop context to process this image.");
      return;
    }

    if (!billingReady) {
      setError("Enable billing to process images.");
      return;
    }

    setLoading(true);
    setError("");
    setEnhancedImage("");
    const runVariant = "product";
    setUsageCharged(false);
    setUsageChargeError("");
    setPublishError("");
    setProcessingFailed(false);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target?.result;
          const result = await enhanceWithGemini(base64Image, runVariant);
          const baseImage = frameEnabled ? await addWhiteBorder(result.image) : result.image;
          const finalImage = watermarkDisabled ? baseImage : await addWatermark(baseImage);

          setEnhancedImage(finalImage);
          toast.success("Fresh nudio ready! Save it or share it in a tap.");
          await handleSaveToCameraRoll(finalImage, true, "nudio-enhanced", true);
          shareBeforeAfterStory(preview, finalImage);
          await handleUsageCharge();
        } catch (err) {
          setProcessingFailed(true);
          if (err?.status === 402 || err?.status === 403) {
            const limitMessage =
              err?.message &&
              err.message.toLowerCase().includes("free tier")
                ? err.message
                : "We couldn’t process that image yet.";
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
        }
      };
      reader.readAsDataURL(selectedImage);
    } catch (err) {
      setError(err?.message || "Something went sideways. Try again.");
      setLoading(false);
      setProcessingFailed(true);
    }
  };

  const resetWorkspace = () => {
    setSelectedImage(null);
    setPreview("");
    setEnhancedImage("");
    setError("");
    setUsageCharged(false);
    setUsageChargeError("");
    setPublishError("");
    setProcessingFailed(false);
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
          <div className="w-full flex justify-center" style={{ maxWidth: "min(336px, calc(100vw - 48px))" }}>
            <div ref={lensWrapperRef} className="relative w-full" style={{ paddingBottom: "100%" }}>
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

            {sourcePickerOpen && (
              <div
                ref={sourceMenuRef}
                className="absolute z-30 w-56 rounded-2xl border border-white/10 bg-[#120a14]/95 p-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur"
                style={{
                  left: `${sourceMenuPosition.x}px`,
                  top: `${sourceMenuPosition.y}px`,
                  transform: "translate(8px, 8px)",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                  choose source
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={handleUploadOption}
                    className="w-full rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenShopifyPicker}
                    className="w-full rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10"
                  >
                    Choose from Shopify
                  </button>
                </div>
                {sourceLoading && (
                  <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/60">
                    loading…
                  </p>
                )}
                {sourceError && (
                  <p className="mt-2 text-xs text-rose-200">{sourceError}</p>
                )}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto text-white sm:justify-end sm:items-center">
            <div className="relative w-full sm:w-64" ref={backdropMenuRef}>
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
                  {backdropOptions.map((option) => {
                    if (option.id === CUSTOM_BACKDROP_ID) {
                      const isActive = backdropId === option.id;
                      return (
                        <div
                          key={option.id}
                          className={`w-full px-4 py-2 flex items-center gap-2 ${
                            isActive ? "bg-slate-900 text-white" : "text-slate-200 hover:bg-white/5"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setBackdropId(option.id);
                              setBackdropMenuOpen(false);
                            }}
                            className="flex-1 flex items-center gap-2 text-left"
                          >
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-white/30"
                              style={{ backgroundColor: option.hex }}
                            />
                            {option.label}
                          </button>
                          <input
                            type="color"
                            aria-label="Choose a custom backdrop color"
                            value={customBackdrop}
                            onChange={handleCustomBackdropChange}
                            className="h-6 w-6 rounded-full border border-white/20 bg-transparent"
                          />
                        </div>
                      );
                    }

                    return (
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
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleFrameToggle}
              className={`flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                frameEnabled
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                  : "border-white/20 bg-white/5 text-white/60"
              }`}
              aria-pressed={!frameEnabled}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  frameEnabled ? "bg-emerald-300" : "bg-slate-400"
                }`}
              />
              {frameEnabled ? "frame" : "no frame"}
            </button>
            <button
              type="button"
              onClick={handleEnhancePhoto}
              disabled={!preview || loading || !billingReady}
              className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.4em] transition ${
                !preview || loading || !billingReady
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900 shadow-[0_12px_30px_rgba(16,185,129,0.35)] hover:shadow-[0_15px_35px_rgba(190,242,100,0.45)]"
              }`}
            >
              {loading
                ? "nudioing..."
                : billingReady
                ? "process"
                : "enable billing"}
            </button>
          </div>

          {!!sourceImages.length && (
            <div className="w-full max-w-2xl mx-auto rounded-3xl border border-white/10 bg-[#120a14] px-4 py-4 text-white space-y-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">
                pick a shopify image
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sourceImages.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => handleShopifyImageSelect(image)}
                    className="rounded-2xl overflow-hidden border border-white/10 bg-black/30 hover:border-white/30 transition"
                  >
                    <img
                      src={image.src}
                      alt={image.alt || "Shopify product"}
                      className="w-full h-28 object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="w-full max-w-2xl mx-auto space-y-3 text-white">
            {installRequired && installUrl && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-amber-100/70">
                      install required
                    </p>
                    <p className="text-sm text-white/80">
                      Reconnect Shopify to finish setup and enable billing + webhooks.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => redirectToInstall(installUrl)}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white/90"
                  >
                    Reinstall app
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-[#120a14] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">
                    billing
                  </p>
                  <p className="text-sm text-white/80">
                    8 cents per nudio, billed through Shopify.
                  </p>
                  <p className="text-xs text-white/50">
                    Charges only apply when processing completes.
                  </p>
                </div>
                {billingReady ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
                    billing active
                  </span>
                ) : !billingChecked ? (
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
                    checking...
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableBilling}
                    disabled={billingLoading}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                      billingLoading
                        ? "bg-white/10 text-white/40"
                        : "bg-white text-slate-900 hover:bg-white/90"
                    }`}
                  >
                    {billingLoading ? "loading..." : "Enable 8 cents/image billing"}
                  </button>
                )}
              </div>
              {billingError && (
                <p className="text-xs text-rose-200 mt-2">{billingError}</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#120a14] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">
                    product destination
                  </p>
                  <p className="text-sm text-white/80">
                    {selectedProduct
                      ? `Selected: ${selectedProduct.title}`
                      : "Choose a product to publish this image."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSelectProduct}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10"
                >
                  {selectedProduct ? "Change product" : "Select product"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#120a14] px-4 py-4 text-xs text-white/50 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">status</p>
              <p>
                Billing: {billingReady ? "active" : billingChecked ? "needs setup" : "checking"}
              </p>
              <p>
                Last charge: {lastChargeAt ? lastChargeAt.toLocaleString() : "none yet"}
              </p>
              <p>
                Last publish: {lastPublishedProductId ? (
                  <button type="button" className="underline" onClick={handleViewProduct}>
                    View product
                  </button>
                ) : (
                  "not published yet"
                )}
              </p>
            </div>

            {usageChargeError && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
                <p>{usageChargeError}</p>
                <button
                  type="button"
                  onClick={handleUsageCharge}
                  className="mt-2 underline underline-offset-4"
                >
                  Retry charge
                </button>
              </div>
            )}
          </div>

          {enhancedImage && (
            <div className="w-full max-w-2xl mx-auto space-y-4 text-center">
              <img src={enhancedImage} alt="Enhanced product" className="block w-full h-auto object-contain rounded-2xl" />
              <button
                onClick={resetWorkspace}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Start another nudio
              </button>
              <div className="space-y-3">
                {selectedProduct ? (
                  <button
                    type="button"
                    onClick={handlePublishToShopify}
                    disabled={publishLoading}
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                      publishLoading
                        ? "bg-white/10 text-white/40"
                        : "bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)]"
                    }`}
                  >
                    {publishLoading ? "publishing..." : "Publish to Shopify"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSelectProduct}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10"
                  >
                    Select product to publish
                  </button>
                )}
                {publishError && (
                  <p className="text-xs text-rose-200">{publishError}</p>
                )}
                {usageCharged && (
                  <p className="text-xs text-emerald-200">
                    Usage charge recorded: 8 cents.
                  </p>
                )}
              </div>
            </div>
          )}

          {sharePreparing && (
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/70 text-center">
              crafting share clip…
            </p>
          )}

          {!showLensPreview && !loading && (
            <div className="w-full max-w-2xl mx-auto rounded-3xl border border-white/10 bg-[#120a14] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">
                before / after
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={`${process.env.PUBLIC_URL}/shopify/examples/plant-before.png`}
                    alt="Before example"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={`${process.env.PUBLIC_URL}/shopify/examples/plant-after.png`}
                    alt="After example"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {processingFailed && !usageCharged && (
            <p className="mt-1 text-xs text-red-600">
              Processing failed — no charge applied.
            </p>
          )}
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

      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-10 text-xs text-white/60 flex flex-col sm:flex-row gap-3 items-start sm:items-center sm:justify-between">
        <div>
          Support:{" "}
          <a
            className="underline underline-offset-4"
            href="https://nudio.ai/contact"
            target="_blank"
            rel="noreferrer"
          >
            support@nudio.ai
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a
            className="underline underline-offset-4"
            href="https://nudio.ai"
            target="_blank"
            rel="noreferrer"
          >
            nudio.ai
          </a>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setActiveLegal("privacy")}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setActiveLegal("terms")}
          >
            Terms of Service
          </button>
        </div>
      </footer>

      {activeLegal === "privacy" && (
        <LegalModal title="Privacy Policy" onClose={() => setActiveLegal(null)}>
          <ShopifyPrivacyPolicy />
        </LegalModal>
      )}
      {activeLegal === "terms" && (
        <LegalModal title="Terms of Service" onClose={() => setActiveLegal(null)}>
          <ShopifyTermsOfService />
        </LegalModal>
      )}

    </div>
  );
}
