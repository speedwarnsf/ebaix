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
      <header className="bg-[#e1d0d0] border-b border-slate-200">
        <div className="w-full max-w-5xl mx-auto px-0 sm:px-0 py-0 flex flex-col">
          <img
            src="/nudioheader.jpg"
            alt="nudio header"
            className="w-full h-auto object-cover"
          />
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
