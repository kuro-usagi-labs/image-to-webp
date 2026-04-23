import os
import shutil
import tempfile
import threading
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image


app = Flask(__name__)

jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()
JOB_TTL = timedelta(hours=1)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def cleanup_old_jobs() -> None:
    cutoff = now_utc() - JOB_TTL
    stale_ids: list[str] = []
    with jobs_lock:
        for job_id, data in jobs.items():
            if data["created_at"] < cutoff:
                stale_ids.append(job_id)

    for job_id in stale_ids:
        cleanup_job(job_id)


def cleanup_job(job_id: str) -> None:
    with jobs_lock:
        data = jobs.pop(job_id, None)
    if not data:
        return
    work_dir = data.get("work_dir")
    if work_dir and os.path.isdir(work_dir):
        shutil.rmtree(work_dir, ignore_errors=True)


def safe_webp_name(target_dir: str, base_name: str) -> str:
    candidate = os.path.join(target_dir, f"{base_name}.webp")
    if not os.path.exists(candidate):
        return candidate
    idx = 1
    while True:
        candidate = os.path.join(target_dir, f"{base_name}_{idx}.webp")
        if not os.path.exists(candidate):
            return candidate
        idx += 1


def set_job(job_id: str, **updates: object) -> None:
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(updates)


def convert_job(job_id: str, quality: int) -> None:
    try:
        with jobs_lock:
            data = jobs[job_id]
            input_dir = data["input_dir"]
            output_dir = data["output_dir"]
            total = data["total"]

        files = sorted(
            [
                os.path.join(input_dir, name)
                for name in os.listdir(input_dir)
                if name.lower().endswith(".png")
            ]
        )

        success = 0
        failed = 0

        for idx, src_path in enumerate(files, start=1):
            base_name = os.path.splitext(os.path.basename(src_path))[0]
            dst_path = safe_webp_name(output_dir, base_name)

            try:
                with Image.open(src_path) as img:
                    if img.mode in ("RGBA", "LA", "P"):
                        img = img.convert("RGBA")
                    else:
                        img = img.convert("RGB")
                    img.save(dst_path, "WEBP", quality=quality, method=6)
                success += 1
                message = f"Berhasil: {os.path.basename(src_path)}"
            except Exception as exc:
                failed += 1
                message = f"Gagal: {os.path.basename(src_path)} ({exc})"

            set_job(
                job_id,
                processed=idx,
                success=success,
                failed=failed,
                message=message,
            )

        with jobs_lock:
            data = jobs.get(job_id)
            if not data:
                return
            work_dir = data["work_dir"]
            zip_path = os.path.join(work_dir, "webp_result.zip")

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
            for name in sorted(os.listdir(output_dir)):
                if name.lower().endswith(".webp"):
                    zipf.write(os.path.join(output_dir, name), arcname=name)

        set_job(
            job_id,
            status="done",
            zip_path=zip_path,
            message=f"Selesai. Berhasil: {success}, Gagal: {failed}.",
            finished_at=now_utc(),
        )

        if total == 0:
            set_job(job_id, status="error", message="Tidak ada file PNG valid.")

    except Exception as exc:
        set_job(job_id, status="error", message=f"Terjadi error: {exc}", finished_at=now_utc())


@app.get("/")
def index():
    cleanup_old_jobs()
    return render_template("index.html")


@app.post("/api/convert")
def start_convert():
    cleanup_old_jobs()
    files = request.files.getlist("files")
    quality = int(request.form.get("quality", "85"))
    quality = max(1, min(100, quality))

    png_files = [f for f in files if f and f.filename and f.filename.lower().endswith(".png")]
    if not png_files:
        return jsonify({"error": "Upload minimal satu file PNG."}), 400

    work_dir = tempfile.mkdtemp(prefix="png2webp_")
    input_dir = os.path.join(work_dir, "input")
    output_dir = os.path.join(work_dir, "output")
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    for file_storage in png_files:
        file_storage.save(os.path.join(input_dir, os.path.basename(file_storage.filename)))

    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {
            "status": "processing",
            "message": "Mulai konversi...",
            "created_at": now_utc(),
            "finished_at": None,
            "total": len(png_files),
            "processed": 0,
            "success": 0,
            "failed": 0,
            "work_dir": work_dir,
            "input_dir": input_dir,
            "output_dir": output_dir,
            "zip_path": None,
        }

    worker = threading.Thread(target=convert_job, args=(job_id, quality), daemon=True)
    worker.start()

    return jsonify({"job_id": job_id})


@app.get("/api/progress/<job_id>")
def progress(job_id: str):
    with jobs_lock:
        data = jobs.get(job_id)

    if not data:
        return jsonify({"error": "Job tidak ditemukan."}), 404

    return jsonify(
        {
            "status": data["status"],
            "message": data["message"],
            "total": data["total"],
            "processed": data["processed"],
            "success": data["success"],
            "failed": data["failed"],
        }
    )


@app.get("/api/download/<job_id>")
def download(job_id: str):
    with jobs_lock:
        data = jobs.get(job_id)

    if not data:
        return jsonify({"error": "Job tidak ditemukan."}), 404
    if data["status"] != "done" or not data["zip_path"]:
        return jsonify({"error": "Hasil belum siap."}), 400

    return send_file(data["zip_path"], as_attachment=True, download_name="webp_result.zip")


@app.delete("/api/job/<job_id>")
def delete_job(job_id: str):
    cleanup_job(job_id)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
