import React, { useState } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";

function App() {
  const [userCredits, setUserCredits] = useState(50);
  const userEmail = "speedwarnsf@gmail.com";

  const handleCreditUse = () => {
    setUserCredits((prev) => (prev > 0 ? prev - 1 : 0));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-start gap-2 sm:gap-3">
          <img
            src="/ebai-logo.png"
            alt="eBai"
            className="h-20 sm:h-24 md:h-28 w-auto object-contain"
          />
          <p className="text-sm tracking-[0.12em] text-slate-500">
            E-commerce Background AI
          </p>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <PhotoEnhancer
          userCredits={userCredits}
          onCreditUse={handleCreditUse}
          userEmail={userEmail}
        />
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;
