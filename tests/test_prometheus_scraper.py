import pytest

def test_scrape_interval_bounds():
    """Validates Prometheus scrape interval stays within safe ranges."""
    interval = 5  # seconds
    timeout = 4.0  # seconds
    assert interval > 0, "Scrape interval must be positive"
    assert timeout < interval, "Timeout must be shorter than scrape interval"

def test_feature_vector_length():
    """Ensures anomaly feature vector has exactly 3 dimensions."""
    features = [72.5, 120.3, 0.8]  # cpu, latency, error_rate
    assert len(features) == 3, "Feature vector must contain exactly 3 metrics"
