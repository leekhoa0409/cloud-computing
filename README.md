# Cloud Rekognition Visualizer

This small Flask app uploads an image, runs multiple AWS Rekognition APIs (labels, faces, text, moderation) and visualizes the results using Plotly and an HTML canvas overlay.

Requirements

- Python 3.9+
- AWS credentials with Rekognition access (set in `.env` or environment variables)

Install

1. Create a virtual environment and activate it.
2. Install requirements:

```
pip install -r requirements.txt
```

Setup

- Copy your AWS credentials into a `.env` file in the project root (or set environment variables). Example keys used by the app:

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...   # optional
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=my-bucket    # optional, app can call Rekognition with image bytes
```

Run

```
python app.py
```

Open http://localhost:5000 and upload an image. After analysis, the result page shows a bar chart of top labels and overlays bounding boxes for faces, labels and detected text.

Notes

- If you provide `S3_BUCKET` and correct bucket permissions, the app will upload the image to S3 and Rekognition will operate on the S3 object (sometimes faster for large images).
- The app writes a JSON snapshot next to the uploaded image in `static/uploads` for debugging.
