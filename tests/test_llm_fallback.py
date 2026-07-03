import unittest
from ai.llm_agent import _template_report

class TestLLMFallback(unittest.TestCase):
    def test_template_generation(self):
        anomaly_scores = {"payment": {"score": 0.92, "severity": "CRITICAL"}}
        root_cause = {"service": "payment", "score": 0.92, "severity": "CRITICAL", "affected": ["order"]}
        action_result = {"action": "restart", "recovery_time": 4.5, "recovered": True}
        
        report = _template_report(anomaly_scores, root_cause, action_result)
        self.assertIn("payment", report)
        self.assertIn("restart", report)
        self.assertIn("cascaded into order", report)

if __name__ == "__main__":
    unittest.main()
