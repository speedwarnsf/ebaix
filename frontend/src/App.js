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
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-3">
          <img
            src="/nudiologo.png"
            alt="nudio"
            className="h-32 sm:h-36 md:h-44 w-auto object-contain"
          />
          <p className="text-base sm:text-lg text-slate-900 font-medium">
            Welcome to your <span className="italic">nu</span> pocket sized lighting studio.
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
