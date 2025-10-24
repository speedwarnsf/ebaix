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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-4">
          <div className="inline-flex items-center justify-center bg-white border border-slate-200 rounded-lg px-6 py-4 shadow-sm w-fit">
            <img
              src="/ebai-logo.png"
              alt="eBai"
              className="h-16 md:h-[4.75rem] w-auto object-contain"
            />
          </div>
          <p className="text-sm tracking-[0.14em] text-slate-500">
            E-commerce Background AI
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
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
