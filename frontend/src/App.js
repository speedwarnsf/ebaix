import React, { useState } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { Dashboard } from "./components/ui/Dashboard";

function App() {
  const [userCredits, setUserCredits] = useState(50);

  const handleCreditsUpdate = (newCredits) => {
    setUserCredits(newCredits);
  };

  // Skip auth for now - go straight to Dashboard
  return (
    <div>
      <Dashboard
        userCredits={userCredits}
        onCreditsUpdate={handleCreditsUpdate}
        userEmail="speedwarnsf@gmail.com"
      />
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
