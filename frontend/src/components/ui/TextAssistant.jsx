// TextAssistant.tsx - Product description generation component
import React, { useState } from "react";

interface TextAssistantProps {
  userCredits: number;
  onSuccess: () => void;
}

export function TextAssistant({ userCredits, onSuccess }: TextAssistantProps) {
  const [productInfo, setProductInfo] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

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
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/optimize-listing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            productDescription: productInfo,
            mode: "text",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate description");
      }

      const result = await response.json();

      if (!result.success || !result.description) {
        throw new Error("No description generated");
      }

      setGeneratedDescription(result.description);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate description");
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
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Text Assistant</h2>
      <p className="text-gray-600 mb-8">
        Generate SEO-optimized product descriptions for your eBay listings.
      </p>

      <div className="space-y-8">
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <label htmlFor="productInfo" className="block text-lg font-semibold text-gray-900 mb-4">
            Describe Your Product
          </label>
          <textarea
            id="productInfo"
            value={productInfo}
            onChange={(e) => setProductInfo(e.target.value)}
            placeholder="Example: Vintage wooden bar stool with woven seat, white legs, good condition..."
            className="w-full border border-gray-300 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
          />
          <p className="text-sm text-gray-500 mt-3">
            Include details like material, condition, size, color, brand, and any special features.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {generatedDescription && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">Generated Description</h3>
            <div className="bg-white border border-green-300 rounded-lg p-4 mb-4 font-serif text-gray-800 leading-relaxed">
              {generatedDescription}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopyToClipboard}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleDownloadAsText}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Download as Text
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleGenerateDescription}
            disabled={!productInfo.trim() || loading || userCredits < 1}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? "Generating..." : "Generate Description"}
          </button>
          {userCredits < 1 && (
            <p className="text-red-600 text-sm self-center">Insufficient credits</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Tips for Best Results</h3>
          <ul className="space-y-3 text-blue-800">
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold">✓</span>
              <span>Be specific about condition, size, and materials</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold">✓</span>
              <span>Include any unique features or benefits</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold">✓</span>
              <span>Mention any flaws or imperfections for transparency</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 font-bold">✓</span>
              <span>Include brand name if applicable</span>
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Each description costs 1 credit. You have <span className="font-semibold">{userCredits}</span> credits available.
          </p>
        </div>
      </div>
    </div>
  );
}
