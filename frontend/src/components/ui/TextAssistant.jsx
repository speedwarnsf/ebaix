// TextAssistant.jsx - Product description generation component
import React, { useState, useEffect } from "react";

export function TextAssistant({ onSuccess, defaultImageUrl }) {
  const [productInfo, setProductInfo] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [generationSource, setGenerationSource] = useState(null);
  const [generationReason, setGenerationReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(defaultImageUrl ?? "");
  const [lengthOption, setLengthOption] = useState("short");
  const [toneOption, setToneOption] = useState("streetwise");

  const toneOptions = [
    { value: "streetwise", label: "Streetwise · sardonic & raw" },
    { value: "contemplative", label: "Contemplative · philosophical calm" },
    { value: "transcendent", label: "Transcendent · poetic & expansive" },
  ];

  useEffect(() => {
    setImageUrl(defaultImageUrl ?? "");
    setGeneratedDescription("");
    setGenerationSource(null);
    setGenerationReason("");
  }, [defaultImageUrl]);

  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS = [1500, 3500];

  const handleGenerateDescription = async () => {
    if (!productInfo.trim()) {
      setError("Please enter product information");
      return;
    }

    setLoading(true);
    setError("");
    setGenerationReason("");

    try {
      await attemptGenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate listing text");
    } finally {
      setLoading(false);
    }
  };

  const attemptGenerate = async (attempt = 0) => {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/write-listing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageUrl: (imageUrl && imageUrl.trim()) || defaultImageUrl || undefined,
          userDescription: productInfo,
          length: lengthOption,
          tone: toneOption,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate description");
    }

    const result = await response.json();

    if (!result.listingText) {
      throw new Error("No listing text generated");
    }

    const source =
      result.source ?? (result.success === false ? "fallback" : "gemini");

    setGeneratedDescription(result.listingText);
    setGenerationSource(source);
    setGenerationReason(result.reason ?? "");

    if (source !== "fallback") {
      onSuccess?.();
      return;
    }

    if (result.retryable && attempt < MAX_ATTEMPTS - 1) {
      setGenerationReason("Gemini is catching its breath. Trying again...");
      const delay = RETRY_DELAYS[attempt] ?? 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await attemptGenerate(attempt + 1);
      return;
    }

    setGenerationReason(
      result.reason ??
        "Gemini is momentarily at capacity. This backup copy is ready, and you can try again in a moment for a fresh take."
    );
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedDescription);
  };

  const handleDownloadAsText = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(generatedDescription)
    );
    element.setAttribute("download", `ebai-description-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900">Write the Listing</h3>
        <p className="text-sm text-gray-600 mt-1">
          Blend your product details with the enhanced photo to create a high-converting marketplace description.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <label htmlFor="productInfo" className="text-sm font-semibold text-gray-800">
            Describe the product in your own words
          </label>
          <textarea
            id="productInfo"
            value={productInfo}
            onChange={(e) => setProductInfo(e.target.value)}
            placeholder="Example: Vintage wooden bar stool with woven seat, white legs, good condition..."
            className="w-full border border-gray-300 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={5}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-gray-800">Tone</span>
              <select
                value={toneOption}
                onChange={(e) => setToneOption(e.target.value)}
                className="w-full border border-gray-300 bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {toneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-semibold text-gray-800">Length</span>
              <select
                value={lengthOption}
                onChange={(e) => setLengthOption(e.target.value)}
                className="w-full border border-gray-300 bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="short">Short (60-80 words)</option>
                <option value="long">Long (180-250 words)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-semibold text-gray-800">Image reference (auto-filled)</span>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {defaultImageUrl ? (
              <img
                src={defaultImageUrl}
                alt="Enhanced product"
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                Upload and enhance a product photo first
              </div>
            )}
          </div>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Override with a hosted image URL (optional)"
            className="w-full border border-gray-300 bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500">
            Use a public URL if you want Gemini to reference a hosted product photo instead.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {generatedDescription && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between text-gray-600 text-sm">
            <p className="font-medium text-gray-800">Listing ready</p>
            <span className="text-xs">
              Saved {new Date().toLocaleTimeString()}
            </span>
          </div>
          {generationSource === "fallback" && (
            <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
              Gemini hit a rate limit, so we provided a backup description. Feel free to retry in a moment for a fresh take.
            </div>
          )}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-gray-800 leading-relaxed whitespace-pre-line">
            {generatedDescription}
          </div>
          {generationReason && generationSource === "fallback" && (
            <p className="text-xs text-gray-500">
              Details: {generationReason}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="w-full sm:w-auto flex-1 bg-gray-900 hover:bg-black text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={handleDownloadAsText}
              className="w-full sm:w-auto flex-1 bg-gray-900 hover:bg-black text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Download as Text
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={handleGenerateDescription}
          disabled={!productInfo.trim() || loading}
          className="w-full sm:w-auto bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          {loading ? "Generating..." : "Generate Listing"}
        </button>
        <p className="text-sm text-gray-500">
          Add as much detail as you like—the more specific, the better the copy.
        </p>
      </div>
    </div>
  );
}
