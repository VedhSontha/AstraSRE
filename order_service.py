from flask import Flask, jsonify
import requests
import time

app = Flask(__name__)

@app.route("/")
def order():
    start = time.time()

    try:
        res = requests.get("http://localhost:5002/")
        payment_data = res.json()

        return jsonify({
            "order_status": "success",
            "payment": payment_data,
            "latency": time.time() - start
        })

    except Exception as e:
        return jsonify({
            "order_status": "failed",
            "error": str(e),
            "latency": time.time() - start
        }), 500

if __name__ == "__main__":
    app.run(port=5001)