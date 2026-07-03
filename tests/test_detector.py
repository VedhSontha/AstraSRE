import unittest
from ai.isolation_forest import AnomalyDetector

class TestAnomalyDetector(unittest.TestCase):
    def setUp(self):
        self.detector = AnomalyDetector(window_size=3)
        self.detector.train()

    def test_idle_state_normal(self):
        metrics_idle = {
            "payment": [0.1, 2.0, 0.0],
            "order": [0.2, 3.0, 0.0],
            "inventory": [0.1, 1.0, 0.0],
            "frontend": [0.0, 0.0, 0.0],
            "notification": [0.0, 0.0, 0.0],
        }
        results = self.detector.predict(metrics_idle)
        for svc, res in results.items():
            self.assertEqual(res["severity"], "NORMAL")

    def test_chaos_state_critical(self):
        metrics_chaos = {
            "payment": [95.0, 1200.0, 50.0],
            "order": [60.0, 400.0, 18.0],
            "inventory": [25.0, 140.0, 1.0],
            "frontend": [15.0, 130.0, 0.5],
            "notification": [10.0, 85.0, 0.1],
        }
        results = self.detector.predict(metrics_chaos)
        self.assertEqual(results["payment"]["severity"], "CRITICAL")

if __name__ == "__main__":
    unittest.main()
