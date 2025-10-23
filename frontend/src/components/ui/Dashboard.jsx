// Dashboard.jsx - Main dashboard component with exact design match
import React, { useState, useEffect } from "react";
import { PhotoEnhancer } from "./PhotoEnhancer";
import { TextAssistant } from "./TextAssistant";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
  createCheckoutSession,
  redirectToCheckout
} from "../../stripeIntegration";

// Owner emails with unlimited access (for testing)
const OWNER_EMAILS = [
  'speedwarnsf@gmail.com',
  'admin@ebai.me',
  'test@ebai.me'
];

export function Dashboard({ userCredits, onCreditsUpdate, userEmail }) {
  const [activeTab, setActiveTab] = useState("home");
  const [ebaiLogo, setEbaiLogo] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if current user is owner (unlimited access)
  const isOwner = userEmail && OWNER_EMAILS.includes(userEmail.toLowerCase());
  const effectiveCredits = isOwner ? 999999 : userCredits;

  useEffect(() => {
    setEbaiLogo("/ebai-logo.png");
  }, []);

  const handlePurchase = async (bundleType) => {
    setIsProcessing(true);
    try {
      // TODO: Get actual userId and email from your auth context
      const sessionId = await createCheckoutSession({
        bundleType,
        userId: "temp-user-id", // Replace with actual user ID
        email: "user@example.com", // Replace with actual user email
      });

      await redirectToCheckout(sessionId);
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoEnhanced = () => {
    if (!isOwner) {
      onCreditsUpdate(userCredits - 1);
    }
    // Owners don't lose credits
  };

  const handleTextGenerated = () => {
    if (!isOwner) {
      onCreditsUpdate(userCredits - 1);
    }
    // Owners don't lose credits
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {ebaiLogo && (
              <img src={ebaiLogo} alt="eBai" className="h-24 w-auto" />
            )}
          </div>
          <div className="flex items-center gap-4">
            {isOwner && (
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold">
                OWNER ACCESS
              </span>
            )}
            <span className="text-sm font-medium text-gray-700">
              Credits: <span className="font-semibold text-gray-900">
                {isOwner ? '∞' : effectiveCredits}
              </span>
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
                <span className="font-bold">{isOwner ? 'unlimited' : effectiveCredits}</span> credits available.
              </p>
              <button
                onClick={() => setShowPricing(!showPricing)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {showPricing ? "Hide Pricing" : "Buy More Credits"}
              </button>
            </div>

            {showPricing && (
              <div className="mt-8 bg-white border border-gray-200 rounded-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Choose Your Plan
                </h3>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  {Object.entries(CREDIT_BUNDLES).map(([key, bundle]) => (
                    <div
                      key={key}
                      className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors relative"
                    >
                      {bundle.badge && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                            {bundle.badge}
                          </span>
                        </div>
                      )}
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">
                        {bundle.name}
                      </h4>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-gray-900">${bundle.price}</span>
                        <span className="text-gray-600 ml-1">one-time</span>
                      </div>
                      <p className="text-gray-600 mb-4">
                        ${(bundle.price / bundle.credits).toFixed(2)} per credit
                      </p>
                      <button
                        onClick={() => handlePurchase(key)}
                        disabled={isProcessing}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        {isProcessing ? "Processing..." : "Purchase"}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-2 border-purple-500 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900 mb-1">
                        {SUBSCRIPTION.name}
                      </h4>
                      <p className="text-gray-600">Best for power sellers</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-gray-900">${SUBSCRIPTION.price}</span>
                      <span className="text-gray-600 ml-1">/month</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase("subscription")}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {isProcessing ? "Processing..." : "Subscribe Now"}
                  </button>
                </div>
              </div>
            )}
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
              userCredits={effectiveCredits}
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
              userCredits={effectiveCredits}
            />
          </div>
        )}
      </main>
    </div>
  );
}
