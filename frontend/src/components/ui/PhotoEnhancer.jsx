import React, { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "../../context/SessionContext";

const MAX_GUEST_NUDIOS = 3;

export function PhotoEnhancer() {
  const { sessionRole, accessToken, userId } = useSession();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const fileInputRef = useRef(null);

  const getCurrentGuestUsage = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const storageKey = `nudio_guest_usage_${currentMonth}`;
    return parseInt(localStorage.getItem(storageKey) || '0');
  };

  const incrementGuestUsage = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const storageKey = `nudio_guest_usage_${currentMonth}`;
    const currentUsage = getCurrentGuestUsage();
    localStorage.setItem(storageKey, (currentUsage + 1).toString());
    setUsageCount(currentUsage + 1);
  };

  useEffect(() => {
    if (sessionRole === "guest") {
      setUsageCount(getCurrentGuestUsage());
    }
  }, [sessionRole]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setProcessedImageUrl(null);
    }
  };

  const canProcessImage = () => {
    if (sessionRole === "member") return true;
    if (sessionRole === "guest") return usageCount < MAX_GUEST_NUDIOS;
    return false;
  };

  const cleanAuthHeaders = (token) => {
    if (!token) return null;
    return token.replace(/[\r\n\t\s]/g, '').trim();
  };

  const processImage = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    if (!canProcessImage()) {
      toast.error(`Guest limit reached. You've used all ${MAX_GUEST_NUDIOS} complimentary nudios this month.`);
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const headers = {};
      
      if (sessionRole === "member" && accessToken) {
        const cleanToken = cleanAuthHeaders(accessToken);
        if (cleanToken) {
          headers.Authorization = `Bearer ${cleanToken}`;
        }
      }

      if (userId) {
        headers["X-User-ID"] = userId;
      }

      const response = await fetch("https://api.ebaix.com/enhance", {
        method: "POST",
        body: formData,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const processedUrl = URL.createObjectURL(blob);
      setProcessedImageUrl(processedUrl);

      if (sessionRole === "guest") {
        incrementGuestUsage();
      }

      toast.success("Image enhanced successfully!");
    } catch (error) {
      console.error("Enhancement error:", error);
      toast.error(`Enhancement failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, sessionRole, accessToken, userId, usageCount]);

  const handleDownload = () => {
    if (processedImageUrl) {
      const link = document.createElement("a");
      link.href = processedImageUrl;
      link.download = `enhanced_${selectedFile.name}`;
      link.click();
    }
  };

  const remainingGuestNudios = sessionRole === "guest" ? Math.max(0, MAX_GUEST_NUDIOS - usageCount) : null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Nudio Photo Enhancer</h1>
        <p className="text-slate-600">Upload and enhance your photos with AI</p>
        
        {sessionRole === "guest" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              Guest mode: {remainingGuestNudios} complimentary nudios remaining this month
            </p>
          </div>
        )}
      </div>

      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {!previewUrl ? (
          <div className="space-y-4">
            <div className="text-slate-400">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg transition"
            >
              Choose Image
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-64 mx-auto rounded-lg" />
            <div className="space-x-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-4 py-2 rounded-lg transition"
              >
                Choose Different Image
              </button>
              <button
                onClick={processImage}
                disabled={isProcessing || !canProcessImage()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition"
              >
                {isProcessing ? "Enhancing..." : "Enhance Image"}
              </button>
            </div>
          </div>
        )}
      </div>

      {processedImageUrl && (
        <div className="border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Enhanced Result</h3>
          <img src={processedImageUrl} alt="Enhanced" className="max-w-full mx-auto rounded-lg" />
          <button
            onClick={handleDownload}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
          >
            Download Enhanced Image
          </button>
        </div>
      )}
    </div>
  );
}