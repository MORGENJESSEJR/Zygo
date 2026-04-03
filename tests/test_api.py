import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from api.main import app


def sample_request() -> dict:
    return {
        "intent": "move-goods",
        "pickup": "magaba",
        "dropoff": "avondale",
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
        self.assertIn("ZygoData", asset_response.text)

    def test_quote_generation(self) -> None:
        response = self.client.post("/quotes", json=sample_request())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "api")
        self.assertGreaterEqual(len(payload["quotes"]), 2)

    def test_register_and_create_booking(self) -> None:
        phone = f"+26377{uuid4().hex[:6]}"
        register_response = self.client.post(
            "/auth/register",
            json={
                "name": "Rumbidzai Moyo",
                "phone": phone,
                "email": f"{uuid4().hex[:6]}@example.com",
                "password": "secret123",
            },
        )
        self.assertEqual(register_response.status_code, 200)
        token = register_response.json()["token"]

        quotes_response = self.client.post("/quotes", json=sample_request())
        vehicle_id = quotes_response.json()["quotes"][0]["vehicleId"]

        booking_response = self.client.post(
            "/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={"request": sample_request(), "vehicleId": vehicle_id},
        )
        self.assertEqual(booking_response.status_code, 200)
        booking = booking_response.json()["booking"]
        self.assertEqual(booking["statusIndex"], 0)

        fetch_response = self.client.get(f"/bookings/{booking['id']}")
        self.assertEqual(fetch_response.status_code, 200)
        self.assertEqual(fetch_response.json()["booking"]["id"], booking["id"])


if __name__ == "__main__":
    unittest.main()
