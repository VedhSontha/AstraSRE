from sklearn.ensemble import IsolationForest
from collections import defaultdict, deque
import numpy as np
import random
import time

class AnomalyDetector:
    def __init__(self, window_size=3):
        self.model = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100,
            n_jobs=-1
        )
        self.trained = False
        self.window_size = window_size
        self.history = defaultdict(lambda: deque(maxlen=window_size))
        self.score_min = None
        self.score_max = None
        self.threshold_raw = None

    def generate_normal_data(self, n=300):
        data = []
        for _ in range(n):
            cpu = random.uniform(10, 30)
            latency = 120 + (cpu - 10) * 2 + random.uniform(-15, 15)
            errors = max(0, random.uniform(-0.5, 1.0))
            data.append([cpu, latency, errors])
        return data

    def train(self):
        normal_data = self.generate_normal_data()
        self.model.fit(normal_data)
        training_scores = self.model.decision_function(normal_data)
        self.score_min = training_scores.min()
        self.score_max = training_scores.max()
        self.threshold_raw = (
            training_scores.mean() - 2 * training_scores.std()
        )
        self.trained = True
        print(f"[Detector] Trained. Threshold: {self.threshold_raw:.4f}")

    def _normalize(self, raw_scores):
        norm = 1 - (raw_scores - self.score_min) / (
            self.score_max - self.score_min + 1e-8
        )
        return np.clip(norm, 0, 1)

    def _get_severity(self, score):
        if score > 0.85:
            return "CRITICAL"
        elif score > 0.65:
            return "WARNING"
        else:
            return "NORMAL"

    def predict(self, service_metrics):
        """
        service_metrics = {
            "payment":  [cpu, latency, errors],
            "order":    [cpu, latency, errors],
            "frontend": [cpu, latency, errors]
        }
        """
        if not self.trained:
            raise Exception("Call train() first")

        services = list(service_metrics.keys())
        data = np.array(list(service_metrics.values()))
        raw_scores = self.model.decision_function(data)
        norm_scores = self._normalize(raw_scores)

        results = {}
        for service, norm, raw in zip(services, norm_scores, raw_scores):
            self.history[service].append(float(norm))
            smoothed = np.mean(self.history[service])
            results[service] = {
                "score": round(float(smoothed), 3),
                "raw_score": round(float(norm), 3),
                "is_anomaly": bool(raw < self.threshold_raw),
                "severity": self._get_severity(smoothed),
                "confidence": round(
                    len(self.history[service]) / self.window_size, 2
                )
            }
        return results


# ── USAGE ──────────────────────────────────────────────
if __name__ == "__main__":
    detector = AnomalyDetector(window_size=3)
    detector.train()

    for i in range(3):
        service_metrics = {
            "payment":  [88, 650, 15],   # anomalous
            "order":    [60, 300,  5],   # warning
            "frontend": [25, 140,  1]    # normal
        }
        results = detector.predict(service_metrics)
        print(f"\nReading {i+1}:")
        for svc, r in results.items():
            print(
                f"  {svc}: "
                f"score={r['score']} | "
                f"{r['severity']} | "
                f"anomaly={r['is_anomaly']} | "
                f"confidence={r['confidence']}"
            )
        time.sleep(1)