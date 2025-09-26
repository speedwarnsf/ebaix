import requests
import sys
import json
import base64
from datetime import datetime
from pathlib import Path

class eBayListingAPITester:
    def __init__(self, base_url="https://ebay-listing-pro-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if not files:
            headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers={k: v for k, v in headers.items() if k != 'Content-Type'})
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_detail = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail += f" - {response.json()}"
                except:
                    error_detail += f" - {response.text}"
                self.log_test(name, False, error_detail)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_register_user(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"email": test_email, "password": test_password}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            return True
        return False

    def test_login_user(self):
        """Test user login with existing credentials"""
        if not self.user_data:
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={"email": self.user_data['email'], "password": "TestPass123!"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_user_profile(self):
        """Test getting user profile"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "user/profile",
            200
        )
        
        if success:
            expected_fields = ['id', 'email', 'is_premium', 'listings_used', 'listings_limit']
            for field in expected_fields:
                if field not in response:
                    self.log_test(f"Profile Field Check - {field}", False, f"Missing field: {field}")
                    return False
            self.log_test("Profile Fields Complete", True)
        return success

    def test_optimize_listing_text_only(self):
        """Test listing optimization with text only"""
        test_description = "iPhone 12 in good condition, minor scratches on back"
        
        success, response = self.run_test(
            "Optimize Listing (Text Only)",
            "POST",
            "listings/optimize",
            200,
            data={"description": test_description}
        )
        
        if success:
            required_fields = ['id', 'original_description', 'optimized_description', 'created_at']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Listing Response Field - {field}", False, f"Missing field: {field}")
                    return False
            
            # Check if description was actually optimized
            if len(response['optimized_description']) <= len(test_description):
                self.log_test("Description Optimization Quality", False, "Optimized description not significantly enhanced")
                return False
            
            self.log_test("Description Optimization Quality", True)
        
        return success

    def create_test_image(self):
        """Create a simple test image for upload testing"""
        try:
            # Create a simple 100x100 red square PNG
            import io
            from PIL import Image
            
            img = Image.new('RGB', (100, 100), color='red')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            return img_bytes.getvalue()
        except ImportError:
            # Fallback: create a minimal PNG manually
            # This is a 1x1 red pixel PNG
            png_data = base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
            )
            return png_data

    def test_optimize_listing_with_image(self):
        """Test listing optimization with image"""
        test_description = "Vintage camera in excellent condition"
        
        try:
            image_data = self.create_test_image()
            files = {'image': ('test_image.png', image_data, 'image/png')}
            data = {'description': test_description}
            
            success, response = self.run_test(
                "Optimize Listing (With Image)",
                "POST",
                "listings/optimize",
                200,
                data=data,
                files=files
            )
            
            if success:
                # Check if optimized image URL is present
                if 'optimized_image_url' not in response or not response['optimized_image_url']:
                    self.log_test("Image Optimization", False, "No optimized image URL returned")
                    return False
                
                # Check if it's a valid data URL
                if not response['optimized_image_url'].startswith('data:image/'):
                    self.log_test("Image URL Format", False, "Invalid image data URL format")
                    return False
                
                self.log_test("Image Optimization", True)
            
            return success
            
        except Exception as e:
            self.log_test("Optimize Listing (With Image)", False, f"Exception: {str(e)}")
            return False

    def test_get_user_listings(self):
        """Test getting user's listings"""
        success, response = self.run_test(
            "Get User Listings",
            "GET",
            "listings",
            200
        )
        
        if success:
            if not isinstance(response, list):
                self.log_test("Listings Response Format", False, "Response should be a list")
                return False
            
            # Should have at least the listings we created
            if len(response) < 2:  # We created 2 listings in previous tests
                self.log_test("Listings Count", False, f"Expected at least 2 listings, got {len(response)}")
                return False
            
            self.log_test("Listings Response Format", True)
        
        return success

    def test_usage_limits(self):
        """Test usage limits for free tier users"""
        # Get current profile to check usage
        success, profile = self.run_test(
            "Check Usage Before Limit Test",
            "GET",
            "user/profile",
            200
        )
        
        if not success:
            return False
        
        initial_usage = profile.get('listings_used', 0)
        limit = profile.get('listings_limit', 5)
        
        # Try to create listings until we hit the limit
        remaining = limit - initial_usage
        
        for i in range(remaining + 1):  # Try one more than the limit
            test_desc = f"Test listing {i+1} for limit testing"
            
            if i < remaining:
                # Should succeed
                success, _ = self.run_test(
                    f"Create Listing {i+1} (Within Limit)",
                    "POST",
                    "listings/optimize",
                    200,
                    data={"description": test_desc}
                )
                if not success:
                    return False
            else:
                # Should fail with 403
                success, _ = self.run_test(
                    "Create Listing (Over Limit)",
                    "POST",
                    "listings/optimize",
                    403,
                    data={"description": test_desc}
                )
                if not success:
                    self.log_test("Usage Limit Enforcement", False, "Should have returned 403 for over-limit request")
                    return False
                else:
                    self.log_test("Usage Limit Enforcement", True)
        
        return True

    def test_invalid_auth(self):
        """Test invalid authentication scenarios"""
        # Store current token
        original_token = self.token
        
        # Test with invalid token
        self.token = "invalid_token_123"
        success, _ = self.run_test(
            "Invalid Token Test",
            "GET",
            "user/profile",
            401
        )
        
        # Test with no token
        self.token = None
        success2, _ = self.run_test(
            "No Token Test",
            "GET",
            "user/profile",
            401
        )
        
        # Restore original token
        self.token = original_token
        
        return success and success2

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting eBay Listing Optimization Tool API Tests")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Authentication tests
        if not self.test_register_user():
            print("❌ User registration failed. Stopping tests.")
            return False
        
        if not self.test_get_user_profile():
            print("❌ Profile retrieval failed. Stopping tests.")
            return False
        
        # Core functionality tests
        if not self.test_optimize_listing_text_only():
            print("❌ Text optimization failed. Continuing with other tests.")
        
        if not self.test_optimize_listing_with_image():
            print("❌ Image optimization failed. Continuing with other tests.")
        
        if not self.test_get_user_listings():
            print("❌ Listings retrieval failed. Continuing with other tests.")
        
        # Advanced tests
        if not self.test_usage_limits():
            print("❌ Usage limits test failed. Continuing with other tests.")
        
        if not self.test_invalid_auth():
            print("❌ Authentication security test failed.")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"✅ Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = eBayListingAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "summary": {
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
            "timestamp": datetime.now().isoformat()
        },
        "detailed_results": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())