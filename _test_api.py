import requests
import json

# Login
res = requests.post("http://localhost:8000/api/users/auth/login", json={"username": "yashdhumal90", "password": "password123"})
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

access_token = res.json().get("access")
headers = {"Authorization": f"Bearer {access_token}"}

# Get check details
# checkType slug is usually claimant
res2 = requests.get("http://localhost:8000/api/users/vendor-check-detail/20/claimant", headers=headers)
print("Status Code:", res2.status_code)
data = res2.json()

if "check" in data:
    q = data["check"].get("questionnaire")
    print(f"questionnaire type: {type(q)}")
    print(f"questionnaire value: {q}")
else:
    print("No check field in response:", data)
