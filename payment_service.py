from flask import Flask, jsonify
import random
import time

app = Flask(__name__)

@app.route("/")
def payment():
    # simulate latency
    delay = random.uniform(0.1, 0.3)
    time.sleep(delay)

    # simulate failure
    if random.random() < 0.3:
        return jsonify({
            "status": "error",
            "latency": delay
        }), 500

    return jsonify({
        "status": "ok",
        "latency": delay
    })

if __name__ == "__main__":
    app.run(port=5002)