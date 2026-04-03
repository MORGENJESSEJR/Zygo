import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from api.main import app


REVIEWER_PHONE = "+263770000001"
REVIEWER_PASSWORD = "review123"


def sample_request(intent: str = "move-goods", pickup: str = "magaba", dropoff: str = "avondale") -> dict:
    return {
        "intent": intent,
        "pickup": pickup,
        "dropoff": dropoff,
        "schedule": "now",
        "paymentMethod": "ecocash",
        "passengers": 1,
        "loadLevel": "medium",
        "hireHours": 2,
        "notes": "Boxes and stock",
    }


class ZygoApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def register_user(self, name: str = "Rumbidzai Moyo") -> dict:
        phone = f"+26377{uuid4().hex[:6]}"
        response = self.client.post(
            "/auth/register",
            json={
                "name": name,
                "phone": phone,
                "email": f"{uuid4().hex[:8]}@example.com",
                "password": "secret123",
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def reviewer_headers(self) -> dict:
        login_response = self.client.post(
            "/auth/login",
            json={"phone": REVIEWER_PHONE, "password": REVIEWER_PASSWORD},
        )
        self.assertEqual(login_response.status_code, 200)
        token = login_response.json()["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_static_root_is_served(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Zygo", response.text)

        asset_response = self.client.get("/data.js")
        self.assertEqual(asset_response.status_code, 200)
        self.assertIn("approveDriverProfile", asset_response.text)

    def test_quote_generation(self) -> None:
        response = self.client.post("/quotes", json=sample_request())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "api")
        self.assertGreaterEqual(len(payload["quotes"]), 2)

    def test_dispatch_booking_safety_flow(self) -> None:
        session = self.register_user()
        headers = {"Authorization": f"Bearer {session['token']}"}

        quotes_response = self.client.post("/quotes", json=sample_request(intent="move-me", pickup="mbare", dropoff="avondale"))
        self.assertEqual(quotes_response.status_code, 200)
        quote = quotes_response.json()["quotes"][0]

        booking_response = self.client.post(
            "/bookings",
            headers=headers,
            json={
                "request": sample_request(intent="move-me", pickup="mbare", dropoff="avondale"),
                "selectionType": quote["selectionType"],
                "selectionId": quote["selectionId"],
            },
        )
        self.assertEqual(booking_response.status_code, 200)
        booking = booking_response.json()["booking"]
        self.assertEqual(booking["state"], "driver_en_route")

        arrived_response = self.client.post(f"/bookings/{booking['id']}/driver-arrived", headers=headers)
        self.assertEqual(arrived_response.status_code, 200)
        booking = arrived_response.json()["booking"]
        self.assertEqual(booking["state"], "awaiting_start_pin")

        wrong_pin_response = self.client.post(
            f"/bookings/{booking['id']}/confirm-start",
            headers=headers,
            json={"pin": "9999"},
        )
        self.assertEqual(wrong_pin_response.status_code, 400)

        start_response = self.client.post(
            f"/bookings/{booking['id']}/confirm-start",
            headers=headers,
            json={"pin": booking["safety"]["startPin"]},
        )
        self.assertEqual(start_response.status_code, 200)
        booking = start_response.json()["booking"]
        self.assertEqual(booking["state"], "on_trip")

        dropoff_response = self.client.post(f"/bookings/{booking['id']}/dropoff-arrived", headers=headers)
        self.assertEqual(dropoff_response.status_code, 200)
        booking = dropoff_response.json()["booking"]
        self.assertEqual(booking["state"], "awaiting_end_pin")

        complete_response = self.client.post(
            f"/bookings/{booking['id']}/confirm-complete",
            headers=headers,
            json={"pin": booking["safety"]["endPin"]},
        )
        self.assertEqual(complete_response.status_code, 200)
        booking = complete_response.json()["booking"]
        self.assertEqual(booking["state"], "completed")
        self.assertGreaterEqual(len(booking["history"]), 4)

    def test_driver_onboarding_requires_reviewer_approval(self) -> None:
        session = self.register_user(name="Farai Ncube")
        driver_headers = {"Authorization": f"Bearer {session['token']}"}

        profile_response = self.client.post(
            "/driver-profiles",
            headers=driver_headers,
            json={
                "driverName": "Farai Ncube",
                "driverPhone": session["user"]["phone"],
                "bio": "Reliable weekday commuter on the Mbare to CBD corridor.",
                "vehicleType": "sedan",
                "vehicleLabel": "Blue Toyota Axio",
                "plateNumber": "AGT 8812",
                "seats": 3,
                "homeArea": "mbare",
                "routeArea": "cbd",
                "availability": "Weekdays 06:30 to 09:00 and 16:30 to 19:00",
                "farePerSeat": 2.2,
                "sharedRideEnabled": True,
                "driverPhotoData": "data:image/png;base64,AAAA",
                "vehiclePhotoData": "data:image/png;base64,BBBB",
            },
        )
        self.assertEqual(profile_response.status_code, 200)
        profile = profile_response.json()["profile"]
        self.assertEqual(profile["approvalStatus"], "pending-review")

        mine_response = self.client.get("/driver-profiles?mine=true", headers=driver_headers)
        self.assertEqual(mine_response.status_code, 200)
        self.assertIn(profile["id"], [entry["id"] for entry in mine_response.json()["profiles"]])

        unauth_queue_response = self.client.get("/driver-profiles?status=pending-review")
        self.assertEqual(unauth_queue_response.status_code, 401)

        regular_queue_response = self.client.get("/driver-profiles?status=pending-review", headers=driver_headers)
        self.assertEqual(regular_queue_response.status_code, 403)

        shared_request = sample_request(intent="shared-ride", pickup="mbare", dropoff="cbd")
        before_quotes = self.client.post("/quotes", json=shared_request)
        self.assertEqual(before_quotes.status_code, 200)
        self.assertNotIn(profile["id"], [quote["selectionId"] for quote in before_quotes.json()["quotes"]])

        reviewer_headers = self.reviewer_headers()
        queue_response = self.client.get("/driver-profiles?status=pending-review", headers=reviewer_headers)
        self.assertEqual(queue_response.status_code, 200)
        self.assertIn(profile["id"], [entry["id"] for entry in queue_response.json()["profiles"]])

        approve_response = self.client.post(
            f"/driver-profiles/{profile['id']}/approve",
            headers=reviewer_headers,
        )
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.json()["profile"]["approvalStatus"], "approved")

        after_quotes = self.client.post("/quotes", json=shared_request)
        self.assertEqual(after_quotes.status_code, 200)
        self.assertIn(profile["id"], [quote["selectionId"] for quote in after_quotes.json()["quotes"]])


if __name__ == "__main__":
    unittest.main()
