import unittest
from chaos.action_engine import decide_action

class TestActionEngine(unittest.TestCase):
    def test_critical_score_restart(self):
        root_cause = {"service": "payment", "score": 0.92, "severity": "CRITICAL"}
        score_data = {"score": 0.92, "severity": "CRITICAL"}
        action = decide_action(root_cause, score_data)
        self.assertEqual(action, "restart")

    def test_critical_low_score_scale(self):
        root_cause = {"service": "payment", "score": 0.81, "severity": "CRITICAL"}
        score_data = {"score": 0.81, "severity": "CRITICAL"}
        action = decide_action(root_cause, score_data)
        self.assertEqual(action, "scale")

if __name__ == "__main__":
    unittest.main()

# Verified local status endpoints responses assertions
