import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Progress } from "./components/ui/progress";
import { Toaster, toast } from "sonner";
import { Upload, Sparkles, Zap, Crown, FileText, Image as ImageIcon, CheckCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authTab, setAuthTab] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [listing, setListing] = useState({ description: '', image: null });
  const [imagePreview, setImagePreview] = useState(null);
  const [optimizedListing, setOptimizedListing] = useState(null);
  const [userListings, setUserListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchUserListings();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const fetchUserListings = async () => {
    try {
      const response = await axios.get(`${API}/listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserListings(response.data);
    } catch (error) {
      console.error('Error fetching listings:', error);
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
    setOptimizedListing(null);
    setUserListings([]);
  };

  const handleFileUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      setListing(prev => ({ ...prev, image: file }));
      
      // Create image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      toast.success('Image uploaded successfully!');
    } else {
      toast.error('Please upload a valid image file');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const optimizeListing = async () => {
    if (!listing.description.trim()) {
      toast.error('Please enter a product description');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('description', listing.description);
      if (listing.image) {
        formData.append('image', listing.image);
      }

      const response = await axios.post(`${API}/listings/optimize`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setOptimizedListing(response.data);
      await fetchUserProfile(); // Update usage count
      await fetchUserListings(); // Refresh listings
      toast.success('Listing optimized successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = () => {
    if (!user) return 0;
    return user.is_premium ? 100 : (user.listings_used / user.listings_limit) * 100;
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              eBay Listing Pro
            </h1>
            <p className="text-gray-600">Welcome back, {user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            {user?.is_premium && (
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                <Crown className="w-4 h-4 mr-2" />
                Premium
              </Badge>
            )}
            <Button 
              data-testid="logout-button"
              variant="outline" 
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Usage Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Usage Statistics
              {!user?.is_premium && (
                <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user?.is_premium ? (
              <div className="flex items-center gap-4">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-lg font-medium">Unlimited listings</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Listings used this month</span>
                  <span>{user?.listings_used || 0} / {user?.listings_limit || 5}</span>
                </div>
                <Progress value={getUsagePercentage()} className="h-2" />
                {user?.listings_used >= user?.listings_limit && (
                  <Alert>
                    <AlertDescription>
                      You've reached your free tier limit. Upgrade to premium for unlimited access!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Create Listing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Create Optimized Listing
              </CardTitle>
              <CardDescription>
                Upload your product photo and description to get professional results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Image</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-orange-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {listing.image ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <img 
                          src={imagePreview} 
                          alt="Product preview" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-green-200"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-green-500" />
                          <p className="text-sm text-green-600 font-medium">{listing.image.name}</p>
                        </div>
                        <Button
                          data-testid="remove-image-button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setListing(prev => ({ ...prev, image: null }));
                            setImagePreview(null);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Drag & drop your product photo here, or{' '}
                        <button
                          className="text-orange-500 hover:text-orange-600"
                          onClick={() => document.getElementById('fileInput').click()}
                        >
                          browse files
                        </button>
                      </p>
                    </div>
                  )}
                  <input
                    id="fileInput"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Description</label>
                <Textarea
                  data-testid="product-description"
                  placeholder="Enter a basic description of your product (e.g., 'iPhone 12 in good condition, minor scratches on back')"
                  value={listing.description}
                  onChange={(e) => setListing(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>

              <Button
                data-testid="optimize-listing-button"
                onClick={optimizeListing}
                disabled={loading || (!user?.is_premium && user?.listings_used >= user?.listings_limit)}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                {loading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Optimize Listing
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Optimized Result</CardTitle>
              <CardDescription>
                Your professional eBay listing is ready
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optimizedListing ? (
                <div className="space-y-6" data-testid="optimized-listing-result">
                  {/* Always show optimized description */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Optimized Description</label>
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {optimizedListing.optimized_description}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Image section - only show if we have an optimized image */}
                  {optimizedListing.optimized_image_url ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">AI-Enhanced Product Image</label>
                        <Badge className="bg-gradient-to-r from-pink-500 to-orange-500 text-white">
                          ✨ Nano Banana Enhanced
                        </Badge>
                      </div>
                      <div className="relative">
                        <img
                          src={optimizedListing.optimized_image_url}
                          alt="AI-enhanced product with pink studio backdrop"
                          className="w-full rounded-lg border shadow-lg"
                          onError={(e) => {
                            console.error('Image load error:', e);
                            e.target.style.display = 'none';
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-pink-600/80 to-transparent rounded-b-lg p-3">
                          <p className="text-xs text-white text-center font-medium">
                            Professional studio lighting • Pink seamless backdrop • Imperfections preserved
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription>
                        <strong>Image Enhancement Unavailable:</strong> AI image processing with Gemini 2.5 Flash (nano-banana) is currently not available due to API quota limits or configuration issues. 
                        <br/>
                        <em className="text-sm">The description optimization above is still fully functional and will help improve your eBay listing performance.</em>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    data-testid="copy-description-button"
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(optimizedListing.optimized_description);
                      toast.success('Description copied to clipboard!');
                    }}
                  >
                    Copy Description
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    Upload an image and description to see your optimized listing here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Previous Listings */}
        {userListings.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Your Previous Listings</CardTitle>
              <CardDescription>
                Browse your optimization history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {userListings.slice(0, 5).map((listing) => (
                  <div key={listing.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">
                        {listing.original_description.substring(0, 100)}...
                      </h4>
                      <Badge variant="outline">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {listing.optimized_description.substring(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;