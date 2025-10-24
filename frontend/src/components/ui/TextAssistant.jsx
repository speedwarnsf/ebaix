// TextAssistant.jsx - Product description generation component
import React, { useState, useEffect } from "react";

export function TextAssistant({ userCredits, onSuccess, defaultImageUrl }) {
  const [productInfo, setProductInfo] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
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
  }, [defaultImageUrl]);

  const handleGenerateDescription = async () => {
    if (!productInfo.trim()) {
      setError("Please enter product information");
      return;
    }

    if (userCredits < 1) {
      setError("Insufficient credits. Please purchase more credits.");
      return;
    }

    setLoading(true);
    setError("");

    try {
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

      setGeneratedDescription(result.listingText);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate listing text");
    } finally {
      setLoading(false);
    }
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-white border border-green-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wide">
              Listing ready
            </h4>
            <span className="text-xs text-green-600">
              Saved {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 font-serif text-gray-800 leading-relaxed">
            {generatedDescription}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="w-full sm:w-auto flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={handleDownloadAsText}
              className="w-full sm:w-auto flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Download as Text
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={handleGenerateDescription}
          disabled={!productInfo.trim() || loading || userCredits < 1}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          {loading ? "Generating..." : "Generate Listing"}
        </button>
        <p className="text-sm text-gray-600">
          1 credit per listing •{" "}
          <span className="font-semibold text-gray-900">{userCredits}</span>{" "}
          credits remaining
        </p>
      </div>
    </div>
  );
}
