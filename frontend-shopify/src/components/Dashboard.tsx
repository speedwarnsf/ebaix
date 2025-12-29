// Dashboard.tsx - Main dashboard component with exact design match
import React, { useState, useEffect } from "react";
import { PhotoEnhancer } from "./PhotoEnhancer";
import { TextAssistant } from "./TextAssistant";

interface DashboardProps {
  userCredits: number;
  onCreditsUpdate: (credits: number) => void;
}

export function Dashboard({ userCredits, onCreditsUpdate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"home" | "photo" | "text">("home");
  const [ebaiLogo, setEbaiLogo] = useState<string>("");

  useEffect(() => {
    setEbaiLogo("/ebai-logo.png");
  }, []);

  const handlePhotoEnhanced = () => {
    onCreditsUpdate(userCredits - 1);
  };

  const handleTextGenerated = () => {
    onCreditsUpdate(userCredits - 1);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ebaiLogo && (
              <img src={ebaiLogo} alt="eBai" className="h-10 w-auto" />
            )}
            <h1 className="text-2xl font-bold text-gray-900">eBai</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Tokens Used: <span className="font-semibold text-gray-900">{userCredits}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === "home" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-12">Dashboard</h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <svg
                      className="w-6 h-6 text-blue-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Text Assistant
                  </h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Generate compelling, SEO-optimized product descriptions for your eBay listings.
                </p>
                <button
                  onClick={() => setActiveTab("text")}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                >
                  Go to Text Assistant
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <svg
                      className="w-6 h-6 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Photo Enhancer
                  </h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Remove backgrounds and add professional studio backdrops to your product photos.
                </p>
                <button
                  onClick={() => setActiveTab("photo")}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                >
                  Go to Photo Enhancer
                </button>
              </div>
            </div>

            <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                About Your Credits
              </h3>
              <p className="text-blue-800 mb-4">
                Each photo enhancement and text generation uses 1 credit. You currently have{" "}
                <span className="font-bold">{userCredits}</span> credits available.
              </p>
              <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Buy More Credits
              </button>
            </div>
          </div>
        )}

        {activeTab === "photo" && (
          <div>
            <button
              onClick={() => setActiveTab("home")}
              className="mb-6 text-blue-500 hover:text-blue-600 font-medium flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <PhotoEnhancer
              onSuccess={handlePhotoEnhanced}
              userCredits={userCredits}
            />
          </div>
        )}

        {activeTab === "text" && (
          <div>
            <button
              onClick={() => setActiveTab("home")}
              className="mb-6 text-blue-500 hover:text-blue-600 font-medium flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <TextAssistant
              onSuccess={handleTextGenerated}
              userCredits={userCredits}
            />
          </div>
        )}
      </main>
    </div>
  );
}
