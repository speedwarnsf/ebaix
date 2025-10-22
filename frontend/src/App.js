import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Toaster, toast } from "sonner";
import { Sparkles, Zap, Crown, CheckCircle } from "lucide-react";
import { Dashboard } from "./components/ui/Dashboard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authTab, setAuthTab] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [userCredits, setUserCredits] = useState(50); // Start with 50 credits

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      // You can set credits from user data if your backend provides it
      // setUserCredits(response.data.credits || 50);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const handleAuth = async (type) => {
    try {
      const response = await axios.post(`${API}/auth/${type}`, authData);
      setToken(response.data.access_token);
      localStorage.setItem('token', response.data.access_token);
      setUser(response.data.user);
      toast.success(`Successfully ${type === 'login' ? 'logged in' : 'registered'}!`);
      setAuthData({ email: '', password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || `${type} failed`);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setUserCredits(50); // Reset credits on logout
  };

  const handleCreditsUpdate = (newCredits) => {
    setUserCredits(newCredits);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-2 bg-orange-100 rounded-full mb-6">
              <Sparkles className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-6">
              eBay Listing Pro
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Transform your amateur product photos and basic descriptions into professional eBay listings that sell better
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                <CheckCircle className="w-4 h-4 mr-2" />
                AI-Powered Optimization
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                <Zap className="w-4 h-4 mr-2" />
                Professional Studio Photos
              </Badge>
              <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50">
                <FileText className="w-4 h-4 mr-2" />
                Compelling Copy
              </Badge>
            </div>
          </div>

          {/* Auth Section */}
          <div className="max-w-md mx-auto">
            <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-center">Get Started</CardTitle>
                <CardDescription className="text-center">
                  Join thousands of sellers optimizing their listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={authTab} onValueChange={setAuthTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="space-y-4 mt-6">
                    <Input
                      data-testid="login-email"
                      type="email"
                      placeholder="Email"
                      value={authData.email}
                      onChange={(e) => setAuthData(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Input
                      data-testid="login-password"
                      type="password"
                      placeholder="Password"
                      value={authData.password}
                      onChange={(e) => setAuthData(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <Button 
                      data-testid="login-button"
                      onClick={() => handleAuth('login')} 
                      className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                    >
                      Sign In
                    </Button>
                  </TabsContent>
                  <TabsContent value="register" className="space-y-4 mt-6">
                    <Input
                      data-testid="register-email"
                      type="email"
                      placeholder="Email"
                      value={authData.email}
                      onChange={(e) => setAuthData(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Input
                      data-testid="register-password"
                      type="password"
                      placeholder="Password"
                      value={authData.password}
                      onChange={(e) => setAuthData(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <Button 
                      data-testid="register-button"
                      onClick={() => handleAuth('register')} 
                      className="w-full bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600"
                    >
                      Create Account
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div>
      <Dashboard userCredits={userCredits} onCreditsUpdate={handleCreditsUpdate} />
      <Toaster position="top-right" />
    </div>
  );
}

export default App;