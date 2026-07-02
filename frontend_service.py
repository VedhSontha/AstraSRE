from flask import Flask, jsonify
import requests

app = Flask(__name__)

@app.route("/")
def frontend():
    try:
        res = requests.get("http://localhost:5001/")
        order_data = res.json()

        # If order failed → frontend should fail
        if order_data.get("order_status") == "failed":
            return jsonify({
                "frontend_status": "error",
                "order_response": order_data
            }), 500

        return jsonify({
            "frontend_status": "ok",
            "order_response": order_data
        })

    except Exception as e:
        return jsonify({
            "frontend_status": "error",
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(port=5000)