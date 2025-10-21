import os, io, uuid, json, shutil, signal, sys, atexit, logging
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from PIL import Image
import boto3
from botocore.exceptions import ClientError

load_dotenv()

UPLOAD_FOLDER = "static/uploads"
S3_BUCKET = os.getenv("S3_BUCKET")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
MAX_IMAGE_SIDE = 1600
DEBUG_SAVE_JSON = True

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rekognition-app")

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

rekognition = boto3.client(
    "rekognition",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
    region_name=os.getenv("AWS_DEFAULT_REGION")
)

s3 = boto3.client('s3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
    region_name=os.getenv("AWS_DEFAULT_REGION")
)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_image_to_bytes(path):
    with Image.open(path) as im:
        w, h = im.size
        max_side = max(w, h)
        if max_side > MAX_IMAGE_SIDE:
            scale = MAX_IMAGE_SIDE / max_side
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=85)
        return buf.getvalue()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze_image():
    file = request.files.get("file")
    features = request.form.getlist("features")

    if not file or not allowed_file(file.filename):
        return "Invalid file type", 400

    filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        s3.upload_file(filepath, S3_BUCKET, filename)
        print(f"Uploaded to S3: s3://{S3_BUCKET}/{filename}")
    except ClientError as e:
        print(f"S3 upload failed: {e}")
        return f"S3 upload failed: {e}", 500

    img_bytes = resize_image_to_bytes(filepath)

    results = {}
    try:
        if "labels" in features:
            results["labels"] = rekognition.detect_labels(Image={"Bytes": img_bytes}).get("Labels", [])
        if "faces" in features:
            results["faces"] = rekognition.detect_faces(Image={"Bytes": img_bytes}, Attributes=["ALL"]).get("FaceDetails", [])
        if "text" in features:
            results["text"] = rekognition.detect_text(Image={"Bytes": img_bytes}).get("TextDetections", [])
        if "celebrities" in features:
            results["celebrities"] = rekognition.recognize_celebrities(Image={"Bytes": img_bytes}).get("CelebrityFaces", [])
        if "ppe" in features:
            results["ppe"] = rekognition.detect_protective_equipment(
                Image={"Bytes": img_bytes},
                SummarizationAttributes={
                    "MinConfidence": 80,
                    "RequiredEquipmentTypes": ["FACE_COVER", "HAND_COVER", "HEAD_COVER"]
                }).get("Persons", [])
        if "moderation" in features:
            results["moderation"] = rekognition.detect_moderation_labels(
                Image={"Bytes": img_bytes},
                MinConfidence=30
            ).get("ModerationLabels", [])   
    except Exception as e:
        logger.error(f"Rekognition error: {e}")
        results["error"] = str(e)

    json_path = os.path.join(UPLOAD_FOLDER, f"{filename}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    return render_template("result.html", filename=filename, features=features, results=results )

@app.route("/api/result/<path:filename>")
def api_result(filename):
    json_path = os.path.join(UPLOAD_FOLDER, f"{filename}.json")
    if not os.path.exists(json_path):
        return jsonify({"error": "No analysis found"}), 404
    with open(json_path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))

@app.route("/compare-faces", methods=["POST"])
def compare_inline():
    source_file = request.files.get("source")
    target_file = request.files.get("target")

    if not source_file or not target_file:
        return "Vui lòng chọn cả hai ảnh!", 400

    if not (allowed_file(source_file.filename) and allowed_file(target_file.filename)):
        return "Chỉ hỗ trợ jpg, jpeg, png!", 400

    source_name = f"src_{uuid.uuid4().hex}_{secure_filename(source_file.filename)}"
    target_name = f"tgt_{uuid.uuid4().hex}_{secure_filename(target_file.filename)}"
    source_path = os.path.join(UPLOAD_FOLDER, source_name)
    target_path = os.path.join(UPLOAD_FOLDER, target_name)

    source_file.save(source_path)
    target_file.save(target_path)

    try:
        source_bytes = resize_image_to_bytes(source_path)
        target_bytes = resize_image_to_bytes(target_path)
        response = rekognition.compare_faces(
            SourceImage={'Bytes': source_bytes},
            TargetImage={'Bytes': target_bytes},
            SimilarityThreshold=60
        )
        matches = response.get('FaceMatches', [])
        unmatched = response.get('UnmatchedFaces', [])

        result = {
            "source": os.path.basename(source_path),
            "target": os.path.basename(target_path),
            "matches": matches,
            "unmatched": unmatched,
        }

        json_path = os.path.join(UPLOAD_FOLDER, f"compare_{uuid.uuid4().hex}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        return render_template("compare-result.html", result=result)

    except Exception as e:
        logger.error(f"CompareFaces error: {e}")
        return f"Lỗi khi gọi Rekognition: {e}", 500

def cleanup_uploads():
    if os.path.exists(UPLOAD_FOLDER):
        try:
            shutil.rmtree(UPLOAD_FOLDER)
            print("Upload folder cleaned.")
        except Exception as e:
            print("Cleanup failed:", e)

atexit.register(cleanup_uploads)
signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
