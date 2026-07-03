import unittest
from ai.rca_engine import find_root_cause, get_blast_radius

class TestRCAEngine(unittest.TestCase):
    def test_payment_root_cause(self):
        anomaly_scores = {
            "payment": {"is_anomaly": True, "score": 0.95, "severity": "CRITICAL"},
            "inventory": {"is_anomaly": True, "score": 0.85, "severity": "CRITICAL"},
            "order": {"is_anomaly": True, "score": 0.75, "severity": "WARNING"},
            "frontend": {"is_anomaly": True, "score": 0.70, "severity": "WARNING"},
            "notification": {"is_anomaly": False, "score": 0.10, "severity": "NORMAL"},
        }
        rca = find_root_cause(anomaly_scores)
        self.assertIsNotNone(rca)
        self.assertEqual(rca["service"], "payment")

    def test_blast_radius(self):
        blast = get_blast_radius("payment")
        self.assertIn("inventory", blast)
        self.assertIn("order", blast)
        self.assertIn("frontend", blast)

if __name__ == "__main__":
    unittest.main()
