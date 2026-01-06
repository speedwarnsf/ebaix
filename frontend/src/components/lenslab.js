import React, { useMemo, useState, useRef } from "react";
import { ArrowLeft, Download, Upload, Loader2, Aperture } from "lucide-react";
import { BACKDROP_OPTIONS } from "../data/backdrops";
import {
  LABS_LENS_CHOICES,
  LABS_RETOUCH_CHOICES,
  LABS_WARDROBE_CHOICES,
  LABS_LIGHTING_GROUPS,
} from "../data/labsLighting";

const CREDIT_COST = 4;

const addWhiteBorder = (imageBase64) =>
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
      resolve(canvas.toDataURL("image/jpeg", 0.96));
    };
    img.onerror = () => resolve(imageBase64);
    img.src = imageBase64;
  });

const addWatermark = (imageBase64) =>
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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0);
        const logoMaxWidth = img.width * 0.1352;
        const logoScale = logoMaxWidth / logo.width;
        const logoWidth = logo.width * logoScale;
        const logoHeight = logo.height * logoScale;
        const padding = img.width * 0.015;
        const x = img.width - logoWidth - padding - 35;
        const y = img.height - logoHeight - padding - 20;
        ctx.globalAlpha = 1;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        resolve(canvas.toDataURL("image/jpeg", 0.96));
      };
      img.onerror = () => resolve(imageBase64);
      img.src = imageBase64;
    };
    logo.onerror = () => resolve(imageBase64);
    logo.src = "/nudiologo.png";
  });

const normalizeResolution = (imageBase64, targetMax) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const largest = Math.max(img.width || 0, img.height || 0);
      if (!largest || largest >= targetMax) {
        resolve({ dataUrl: imageBase64, width: img.width || 0, height: img.height || 0 });
        return;
      }
      const scale = targetMax / largest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ dataUrl: imageBase64, width: img.width || 0, height: img.height || 0 });
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.96), width: canvas.width, height: canvas.height });
    };
    img.onerror = () => resolve({ dataUrl: imageBase64, width: 0, height: 0 });
    img.src = imageBase64;
  });

const readImageDimensions = (imageBase64) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = imageBase64;
  });

const writeUint16BE = (buffer, offset, value) => {
  buffer[offset] = (value >>> 8) & 0xff;
  buffer[offset + 1] = value & 0xff;
};

const writeUint32BE = (buffer, offset, value) => {
  buffer[offset] = (value >>> 24) & 0xff;
  buffer[offset + 1] = (value >>> 16) & 0xff;
  buffer[offset + 2] = (value >>> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
};

const concatUint8 = (...arrays) => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((arr) => {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const buildExifPayload = (text) => {
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  if (!encoder) return null;
  const ascii = encoder.encode(`${text}\0`);
  const userComment = encoder.encode(`ASCII\0\0\0${text}\0`);
  const tiffHeader = new Uint8Array(8);
  tiffHeader[0] = 0x4d;
  tiffHeader[1] = 0x4d;
  tiffHeader[2] = 0x00;
  tiffHeader[3] = 0x2a;
  writeUint32BE(tiffHeader, 4, 0x00000008);
  const entries = [
    { tag: 0x010e, value: ascii },
    { tag: 0x9286, value: userComment },
  ];
  const entryCount = entries.length;
  const ifd = new Uint8Array(2 + entryCount * 12 + 4);
  writeUint16BE(ifd, 0, entryCount);
  let offset = 2;
  let dataOffset = 8 + ifd.length;
  const dataBlocks = [];
  entries.forEach((entry) => {
    const valueBytes = entry.value;
    writeUint16BE(ifd, offset, entry.tag);
    offset += 2;
    writeUint16BE(ifd, offset, 2);
    offset += 2;
    writeUint32BE(ifd, offset, valueBytes.length);
    offset += 4;
    writeUint32BE(ifd, offset, dataOffset);
    offset += 4;
    dataBlocks.push(valueBytes);
    dataOffset += valueBytes.length;
  });
  writeUint32BE(ifd, offset, 0);
  const header = concatUint8(tiffHeader, ifd, ...dataBlocks);
  const exifPrefix = encoder.encode("Exif\0\0");
  return concatUint8(exifPrefix, header);
};

const buildIptcPayload = (text) => {
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  if (!encoder) return null;
  const caption = encoder.encode(text);
  const iptcData = new Uint8Array(5 + caption.length);
  iptcData[0] = 0x1c;
  iptcData[1] = 0x02;
  iptcData[2] = 0x78;
  writeUint16BE(iptcData, 3, caption.length);
  iptcData.set(caption, 5);
  const signature = encoder.encode("Photoshop 3.0\0");
  const resourceSignature = encoder.encode("8BIM");
  const resourceId = new Uint8Array(2);
  writeUint16BE(resourceId, 0, 0x0404);
  const nameField = new Uint8Array(2);
  nameField[0] = 0;
  nameField[1] = 0;
  const dataPadding = iptcData.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array(0);
  const dataLengthBytes = new Uint8Array(4);
  writeUint32BE(dataLengthBytes, 0, iptcData.length);
  const resourceBlock = concatUint8(
    resourceSignature,
    resourceId,
    nameField,
    dataLengthBytes,
    dataPadding.length ? concatUint8(iptcData, dataPadding) : iptcData
  );
  return concatUint8(signature, resourceBlock);
};

const embedJpegMetadata = (dataUrl, text) =>
  new Promise((resolve) => {
    if (typeof window === "undefined" || !dataUrl?.startsWith("data:image/jpeg") || !text?.trim()) {
      resolve(dataUrl);
      return;
    }
    try {
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = base64ToBytes(base64);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        resolve(dataUrl);
        return;
      }
      const payload = buildExifPayload(text);
      if (!payload) {
        resolve(dataUrl);
        return;
      }
      const encoder = new TextEncoder();
      const xmpContent =
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
        `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
        `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
        `<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">` +
        `<dc:description>` +
        `<rdf:Alt><rdf:li xml:lang="x-default">${text}</rdf:li></rdf:Alt>` +
        `</dc:description>` +
        `</rdf:Description>` +
        `</rdf:RDF>` +
        `</x:xmpmeta>` +
        '<?xpacket end="w"?>';
      const xmpBytes = encoder.encode(xmpContent);
      const xmpIdentifier = encoder.encode("http://ns.adobe.com/xap/1.0/\0");
      const xmpPayload = concatUint8(xmpIdentifier, xmpBytes);
      const iptcPayload = buildIptcPayload(text);
      const app1Exif = new Uint8Array(4 + payload.length);
      app1Exif[0] = 0xff;
      app1Exif[1] = 0xe1;
      writeUint16BE(app1Exif, 2, payload.length + 2);
      app1Exif.set(payload, 4);
      const app1Xmp = new Uint8Array(4 + xmpPayload.length);
      app1Xmp[0] = 0xff;
      app1Xmp[1] = 0xe1;
      writeUint16BE(app1Xmp, 2, xmpPayload.length + 2);
      app1Xmp.set(xmpPayload, 4);
      const app13 = iptcPayload
        ? (() => {
            const block = new Uint8Array(4 + iptcPayload.length);
            block[0] = 0xff;
            block[1] = 0xed;
            writeUint16BE(block, 2, iptcPayload.length + 2);
            block.set(iptcPayload, 4);
            return block;
          })()
        : null;
      const totalLength =
        bytes.length + app1Exif.length + app1Xmp.length + (app13 ? app13.length : 0);
      const output = new Uint8Array(totalLength);
      let pointer = 0;
      output.set(bytes.subarray(0, 2), pointer);
      pointer += 2;
      output.set(app1Exif, pointer);
      pointer += app1Exif.length;
      output.set(app1Xmp, pointer);
      pointer += app1Xmp.length;
      if (app13) {
        output.set(app13, pointer);
        pointer += app13.length;
      }
      output.set(bytes.subarray(2), pointer);
      resolve(`data:image/jpeg;base64,${bytesToBase64(output)}`);
    } catch (err) {
      console.error("metadata-embed-error", err);
      resolve(dataUrl);
    }
  });

const DEFAULT_BACKDROP = BACKDROP_OPTIONS.find((option) => option.id === "pink") ?? BACKDROP_OPTIONS[0];
const FALLBACK_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbG9maGx0bmN1c25ha2hlaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzcwOTUsImV4cCI6MjA3NjU1MzA5NX0.evf7AQnHcnp6YSccjVhp_qu8ctLOo14v9oGwnapqvaE";
const FALLBACK_ANON = "60dc0b898c59d583aebe0a8a52d135f30f2d9f00e5bb714f9ffbcb382b574679";
const FALLBACK_URL = "https://cllofhltncusnakhehdw.supabase.co";

const lensDefault = LABS_LENS_CHOICES[0];
const retouchDefault = LABS_RETOUCH_CHOICES[0];
const wardrobeDefault = LABS_WARDROBE_CHOICES[0];

const getOrCreateGuestId = () => {
  if (typeof window === "undefined") return null;
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
  } catch {
    return null;
  }
};

const buildLabsPrompt = ({
  lens,
  retouch,
  wardrobe,
  lighting,
  backdrop,
  enable4k,
}) => {
  const lightingPrompt = lighting.prompt.replaceAll("[USER_COLOR]", backdrop.description ?? backdrop.label);
  const wardrobeLine = wardrobe?.useOriginal
    ? "Use the clothing from the upload but steam away wrinkles and discreetly pin fabrics into the most flattering drape. Reimagine the outfit with new accessories, layers, or styling so each portrait feels freshly tailored even when garments repeat."
    : `Restyle the subject in ${wardrobe.prompt}. Explore varied silhouettes, fabrics, and accessories so the wardrobe never repeats the same combination twice.`;
  const resolutionLine = enable4k
    ? "Trigger the Labs UltraRes pipeline and return a final frame at 4096-by-4096 resolution with maximum retained detail."
    : "Use the Labs portrait workflow at its standard 2048-by-2048 render size for faster turnaround.";
  return `Transform this casual iPhone selfie into a cinematic, fashion-editorial portrait while maintaining absolute realism. Maintain original skin tone and ethnic features exactly. Maintain forehead, nose, lips, eye color, and proportions precisely. Keep grey hair, scars, and asymmetry untouched.

Above every styling decision, the final portrait must feel undeniably like the same person—when they see it, they should instantly recognize themselves in the image.

Preserve bone structure: keep identical cheekbones, jawline width, chin length, ear height, and eye spacing. Do not shrink or enlarge facial features. If the model is uncertain about facial geometry, err on the side of a slightly slimmer interpretation rather than widening the face. Professional retouching, makeup, and hair styling are allowed, but they must sit on top of the original geometry so the subject is instantly recognizable as themselves.

Do not introduce hair color changes or grey strands that weren’t in the upload; honor the original pigment. Use sophisticated posing, body posture, tailored clothing, shaping garments, and flattering angles to naturally slim or elongate the physique while keeping anatomy believable.

Respect the subject’s identity yet allow creative posing and lighting experimentation. Do not alter the shot’s width-to-height proportions—match the original aspect ratio exactly instead of cropping to a new frame.

Render using the Labs portrait research stack with ${lens.prompt}. Style the subject as if a wardrobe stylist, hair stylist, and makeup artist were on set — polished yet effortless.

Place the subject in front of a seamless nudio studio backdrop (${backdrop.label} — ${backdrop.description}) with ${lightingPrompt}. Interpret every lighting diagram as creative direction only—describe the sculpting effect (soft wrap, rim glow, hair separation, etc.) without ever depicting the physical fixtures or their reflections. The light sources must feel implied, invisible, and completely outside the frame.

Never show lighting equipment, stands, modifiers, reflections of fixtures, cables, rolled seamless edges, or studio floors. If any hardware begins to appear, immediately recompose or crop tighter until only the subject and the perfectly smooth ${backdrop.label} seamless wall remain edge to edge. This is non-negotiable: no matter what lighting technique you follow, frame and crop like a master photographer so zero physical lighting elements ever enter the shot. If hiding the gear requires changing the camera height or angle, do so instinctively.

${wardrobeLine} Avoid displaying visible brand logos, monograms, or text on garments or accessories—keep all surfaces clean and label-free by default.

${resolutionLine}

${retouch.prompt}. Composition goals: shallow depth of field (f/2.0–f/4.0 feel), precise focus on the eyes, natural confident expression, studio color grading that feels filmic but still honest. Mood keywords: editorial, refined, confident, minimalism, cinematic realism. Render up to 4K resolution with fully photorealistic detail.`;
};

const flattenLighting = LABS_LIGHTING_GROUPS.flatMap((group) => group.setups.map((setup) => ({ ...setup, group: group.title })));
const WARDROBE_THEME_COLORS = {
  mens: "#6B84FF",
  womens: "#FF8BC0",
  neutral: "#C8C8FF",
};

export function LensLab({
  onBack,
  sessionRole,
  usageSummary,
  accessToken,
  anonKey,
  supabaseUrl,
  onUsageUpdate,
  userEmail,
}) {
  const [lensChoice, setLensChoice] = useState(lensDefault);
  const [retouchChoice, setRetouchChoice] = useState(retouchDefault);
  const [wardrobeChoice, setWardrobeChoice] = useState(wardrobeDefault);
  const [backdropId, setBackdropId] = useState(DEFAULT_BACKDROP.id);
  const [lightingId, setLightingId] = useState(flattenLighting[0].id);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [outputImage, setOutputImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enable4k, setEnable4k] = useState(false);
  const [outputMeta, setOutputMeta] = useState(null);
  const [expandedLighting, setExpandedLighting] = useState(null);
  const fileInputRef = useRef(null);
  const showLensPreview = Boolean(preview);

  const selectedBackdrop = useMemo(
    () => BACKDROP_OPTIONS.find((option) => option.id === backdropId) ?? DEFAULT_BACKDROP,
    [backdropId]
  );

  const selectedLighting = useMemo(
    () => flattenLighting.find((setup) => setup.id === lightingId) ?? flattenLighting[0],
    [lightingId]
  );

  const prompt = useMemo(
    () =>
      buildLabsPrompt({
        lens: lensChoice,
        retouch: retouchChoice,
        wardrobe: wardrobeChoice,
        lighting: selectedLighting,
        backdrop: selectedBackdrop,
        enable4k,
      }),
    [lensChoice, retouchChoice, wardrobeChoice, selectedLighting, selectedBackdrop, enable4k]
  );

  const availableCredits = usageSummary?.creditsBalance ?? 0;
  const unlimited = usageSummary?.unlimited === true;
  const hasCredits = unlimited || availableCredits >= CREDIT_COST;
  const canUseLabs = sessionRole === "member" && hasCredits;

  const handleLensImage = (file, dataUrl = "") => {
    if (!file) return;
    setSelectedFile(file);
    setPreview(dataUrl);
    setOutputImage("");
    setOutputMeta(null);
  };

  const processLensFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("JPG or PNG up to 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result ?? "";
      handleLensImage(file, result);
    };
    reader.readAsDataURL(file);
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

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    processLensFile(file);
  };

  const handleLensDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    processLensFile(file);
  };

  const handleLensDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleProcess = async () => {
    if (!selectedFile || !preview) {
      setError("Drop a portrait selfie first.");
      return;
    }
    if (sessionRole !== "member") {
      setError("Labs currently requires a signed-in member account.");
      return;
    }
    if (!hasCredits) {
      setError("You need at least 4 paid nudios to run Labs.");
      return;
    }
    if (!supabaseUrl) {
      setError("Missing Supabase configuration.");
      return;
    }

    const useUltraRes = enable4k;
    setLoading(true);
    setError("");
    setOutputImage("");
    setOutputMeta(null);

    try {
      const base64Image = preview;
      const rawToken = accessToken || anonKey || FALLBACK_TOKEN;
      const rawAnonKey = anonKey || FALLBACK_ANON;
      const rawUrl = supabaseUrl || FALLBACK_URL;

      const cleanToken = rawToken.replace(/[\r\n\t\s]/g, "");
      const cleanAnonKey = rawAnonKey.replace(/[\r\n\t\s]/g, "");
      const cleanUrl = rawUrl.replace(/[\r\n\t]/g, "").trim();

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanToken}`,
        apikey: cleanAnonKey,
      };

      const body = {
        imageBase64: base64Image,
        mode: "image",
        userEmail,
        guestMode: false,
        variant: "portrait",
        backdropId,
        labsPrompt: prompt,
        enable4k: useUltraRes,
        creditCost: CREDIT_COST,
        requirePaidCredits: true,
      };

      const guestId = getOrCreateGuestId();
      if (guestId) {
        headers["X-Guest-Id"] = guestId;
      }

      const response = await fetch(`${cleanUrl}/functions/v1/optimize-listing`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Labs API failed to process the portrait.");
        return;
      }

      if (payload?.usage) {
        onUsageUpdate?.(payload.usage);
      }

      const normalized = await normalizeResolution(
        payload.image,
        useUltraRes ? 4096 : 2048
      );
      const bordered = await addWhiteBorder(normalized.dataUrl);
      const watermarked = await addWatermark(bordered);
      let finalInfo = null;
      try {
        finalInfo = await readImageDimensions(watermarked);
      } catch {
        finalInfo = null;
      }
      setOutputImage(watermarked);
      const metaTags = [
        `Lens: ${lensChoice.label}`,
        `Retouch: ${retouchChoice.label}`,
        `Wardrobe: ${wardrobeChoice.label}`,
        `Backdrop: ${selectedBackdrop.label}`,
        `Lighting: ${selectedLighting.name}`,
        useUltraRes ? "Mode: UltraRes 4K" : "Mode: Fast portrait",
      ];
      const metaDescription = [
        "nudio.ai portrait lighting lab metadata",
        `Lens: ${lensChoice.label} (${lensChoice.description})`,
        `Retouch: ${retouchChoice.label}`,
        `Wardrobe: ${wardrobeChoice.label} – ${wardrobeChoice.description}`,
        `Backdrop: ${selectedBackdrop.label} – ${selectedBackdrop.description}`,
        `Lighting: ${selectedLighting.name} – ${selectedLighting.summary}`,
        useUltraRes ? "Mode: UltraRes 4K" : "Mode: Fast portrait",
        `Timestamp: ${new Date().toISOString()}`,
      ].join(" | ");

      setOutputMeta({
        ultra: useUltraRes,
        baseWidth: normalized.width,
        baseHeight: normalized.height,
        framedWidth: finalInfo?.width ?? null,
        framedHeight: finalInfo?.height ?? null,
        tags: metaTags,
        metaText: metaDescription,
      });
    } catch (processError) {
      console.error("labs-error", processError);
      setError(processError?.message || "Unable to reach labs.");
    } finally {
      setLoading(false);
      setEnable4k(false);
    }
  };

  const handleDownloadResult = async () => {
    if (!outputImage) return;
    let downloadUrl = outputImage;
    if (outputMeta?.metaText) {
      downloadUrl = await embedPngMetadata(outputImage, "nudio.ai portrait lab", outputMeta.metaText);
    }
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `nudio-labs-${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="min-h-screen bg-[#020203] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        <div className="flex justify-start">
          <img
            src="/affiliate/assets/NudioOverClear.png"
            alt="nudio logotype"
            className="w-48 sm:w-64 h-auto"
            loading="lazy"
          />
        </div>
        <div className="flex flex-col gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to studio
          </button>
          <div className="space-y-4">
            <p className="uppercase tracking-[0.4em] text-xs text-white/40">nudio labs • portrait systems</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              <span className="text-white">Portrait Lighting </span>
              <span className="text-[#E8C874]">Lab</span>
            </h1>
            <p className="text-white/80 max-w-2xl text-base sm:text-lg leading-relaxed">
              Drop a casual selfie and build a full lighting diagram in text. Labs runs our portrait research stack with
              an optional one-click 4K boost. Each portrait costs {CREDIT_COST} paid nudios.
            </p>
            {!canUseLabs && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Labs requires a signed-in member account with at least {CREDIT_COST} credits. Current balance:{" "}
                {unlimited ? "∞" : availableCredits}.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <div className="border border-white/10 rounded-3xl bg-gradient-to-br from-[#1b0e1a] via-[#0b070f] to-[#190914] p-6 flex flex-col items-center gap-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
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
                            id="labsLensPath"
                            d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
                            fill="transparent"
                          />
                          <text className="text-[5px] uppercase font-semibold fill-[#c59aa8] tracking-[0.4em]">
                            <textPath href="#labsLensPath" startOffset="0%">
                              nudio planar
                            </textPath>
                            <textPath href="#labsLensPath" startOffset="50%">
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

                    <span className="sr-only">Drop a portrait photo or press to upload</span>
                  </div>
                </div>
              </div>
              <div className="w-full flex justify-end gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setEnable4k(false)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition ${
                    !enable4k
                      ? "border-white bg-white/10 text-white shadow-[0_10px_25px_rgba(255,255,255,0.12)]"
                      : "border-white/20 text-white/70 hover:border-white/40"
                  }`}
                >
                  Ultra fast portrait
                </button>
                <button
                  type="button"
                  onClick={() => setEnable4k(true)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition ${
                    enable4k
                      ? "border-[#E8C874] bg-[#E8C874]/15 text-white shadow-[0_15px_35px_rgba(232,200,116,0.35)]"
                      : "border-white/20 text-white/70 hover:border-white/40"
                  }`}
                >
                Ultra res portrait (slower)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                <span className="text-[#E8C874]">Mood </span>
                <span className="text-white">director</span>
              </h2>
              <div className="grid gap-5">
                <SelectorRow
                  label="Lens perspective"
                  options={LABS_LENS_CHOICES}
                  selectedId={lensChoice.id}
                  onSelect={(id) => setLensChoice(LABS_LENS_CHOICES.find((option) => option.id === id) ?? lensChoice)}
                />
                <SelectorRow
                  label="Retouch & styling finish"
                  options={LABS_RETOUCH_CHOICES}
                  selectedId={retouchChoice.id}
                  onSelect={(id) =>
                    setRetouchChoice(LABS_RETOUCH_CHOICES.find((option) => option.id === id) ?? retouchChoice)
                  }
                />
                <SelectorRow
                  label="Wardrobe vibe"
                  options={LABS_WARDROBE_CHOICES}
                  selectedId={wardrobeChoice.id}
                  onSelect={(id) =>
                    setWardrobeChoice(LABS_WARDROBE_CHOICES.find((option) => option.id === id) ?? wardrobeChoice)
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Backdrop color</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BACKDROP_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBackdropId(option.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      backdropId === option.id
                        ? "border-white text-white bg-white/5"
                        : "border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    <span
                      className="inline-block h-6 w-6 rounded-full border border-white/20"
                      style={{ backgroundColor: option.hex }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-[11px] text-white/40">{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Lighting library</h2>
              <div className="h-[320px] overflow-y-auto pr-2 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                {LABS_LIGHTING_GROUPS.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">{group.title}</p>
                    <div className="space-y-2">
                      {group.setups.map((setup) => (
                        <div key={setup.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setLightingId(setup.id)}
                            className={`w-full text-left rounded-2xl border px-3 py-2 transition ${
                              lightingId === setup.id
                                ? "border-[#E8C874] bg-[#E8C874]/10 text-white"
                                : "border-white/10 text-white/70 hover:border-white/30"
                            }`}
                          >
                            <p className="text-sm font-semibold">{setup.name}</p>
                            <p className="text-xs text-white/60">{setup.summary}</p>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedLighting((prev) =>
                                prev === setup.id ? null : setup.id
                              );
                            }}
                            className="text-[11px] uppercase tracking-[0.4em] text-white/40 hover:text-white/70 transition"
                          >
                            {expandedLighting === setup.id ? "Hide details" : "Read more"}
                          </button>
                          {expandedLighting === setup.id && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                              {setup.prompt
                                .replaceAll(
                                  "[USER_COLOR]",
                                  selectedBackdrop.description ?? selectedBackdrop.label
                                )
                                .trim()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleProcess}
                disabled={loading || !canUseLabs}
                className={`w-full rounded-full px-4 py-3 text-sm font-semibold uppercase tracking-[0.4em] transition ${
                  loading || !canUseLabs
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white shadow-[0_15px_45px_rgba(192,132,252,0.35)] hover:-translate-y-0.5"
                }`}
              >
                {loading ? "Rendering..." : `Run Labs (${CREDIT_COST} credits)`}
              </button>
              {sessionRole === "member" && !hasCredits && (
                <p className="text-xs text-white/60">
                  Need more tokens? Scroll to the credit bundles in the main studio to top up.
                </p>
              )}
            </div>
          </section>
        </div>

        {outputImage && (
          <section className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Latest output</p>
              <button
                type="button"
                onClick={handleDownloadResult}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/80 hover:border-white"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
            <img src={outputImage} alt="Labs result" className="w-full rounded-2xl" />
            {outputMeta && (
              <div className="text-right text-xs text-white/60">
                {outputMeta.ultra ? "UltraRes pipeline" : "Fast portrait"}
                {outputMeta.baseWidth && outputMeta.baseHeight
                  ? ` • Base ${outputMeta.baseWidth}×${outputMeta.baseHeight}px`
                  : ""}
                {outputMeta.framedWidth && outputMeta.framedHeight
                  ? ` • Framed ${outputMeta.framedWidth}×${outputMeta.framedHeight}px`
                  : ""}
              </div>
            )}
            {outputMeta?.tags && (
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.35em] text-white/60">
                {outputMeta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SelectorRow({ label, options, selectedId, onSelect }) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xl font-semibold text-white">{label}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`rounded-2xl border px-3 py-2 text-left transition ${
              selectedId === option.id
                ? "border-[#E8C874] bg-[#E8C874]/10 text-white"
                : "border-white/10 text-white/70 hover:border-white/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {option.theme && (
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full border border-white/20"
                  style={{ backgroundColor: WARDROBE_THEME_COLORS[option.theme] || "#FFFFFF" }}
                />
              )}
              <p className="text-sm font-semibold">{option.label}</p>
            </div>
            <p className="text-xs text-white/60">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
