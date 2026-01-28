import requests
import json

# Test the login endpoint
url = "http://0.0.0.0:8000/api/auth/login"
payload = {
    "username": "kunaldhumal18@gmail.com",
    "password": "Kunal@123"
}

print("Testing login endpoint...")
print(f"URL: {url}")
print(f"Payload: {json.dumps(payload, indent=2)}\n")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}\n")
    print(f"Response Body:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
