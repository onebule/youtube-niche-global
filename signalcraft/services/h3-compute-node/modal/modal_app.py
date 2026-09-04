"""Isolated MiniMax H3 Modal deployment boundary.

The web application never imports this module.  ``prepare_model`` is CPU-only
and materializes only the ``t2va`` workflow into a persistent Volume.  ``smoke``
is intentionally guarded and is the only function that requests an A100-class
GPU.  No fallback, retry, Canvas integration, or batch execution is present.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import modal


APP_NAME = os.getenv("MODAL_APP_NAME", "signalcraft-h3-t2va")
MODEL_ID = os.getenv("H3_MODEL_REPOSITORY", "MiniMaxAI/MiniMax-H3")
VOLUME_NAME = os.getenv("MODAL_VOLUME_NAME", "minimax-h3-model-cache")
HF_SECRET_NAME = os.getenv("HF_SECRET_NAME", "huggingface-secret")
MODEL_ROOT = Path("/models")
HF_HOME = MODEL_ROOT / "hf"
MANIFEST_PATH = MODEL_ROOT / "h3-t2va-manifest.json"

# The official H3 modular pipeline supports 5–15 seconds at 24 fps.  Keep the
# first smoke at the smallest supported duration rather than sending an invalid
# 4-second request.
SMOKE_DURATION_SECONDS = 5
SMOKE_FPS = 24
# H3 decodes frame counts on the 17*n+5 lattice; 124 is the first supported
# value in the 5-second window (the pipeline will not receive an arbitrary
# frame count).
SMOKE_NUM_FRAMES = 124
SMOKE_WIDTH = 1344
SMOKE_HEIGHT = 768

EXPECTED_COMPONENTS = (
    "transformer",
    "vae",
    "audio_vae",
    "text_encoder",
    "tokenizer",
    "processor",
    "scheduler",
    "audio_scheduler",
    "video_processor",
)

image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg").pip_install_from_requirements(
    str(Path(__file__).with_name("requirements.txt"))
)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
hf_secret = modal.Secret.from_name(HF_SECRET_NAME, required_keys=["HF_TOKEN"])
app = modal.App(APP_NAME, image=image, volumes={str(MODEL_ROOT): volume}, secrets=[hf_secret])


def _configure_hf_cache() -> None:
    HF_HOME.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(HF_HOME)
    os.environ["HF_HUB_CACHE"] = str(HF_HOME / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(HF_HOME / "transformers")


def _runtime_snapshot() -> dict[str, Any]:
    import torch
    import diffusers
    import transformers

    cuda = bool(torch.cuda.is_available())
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": torch.__version__,
        "diffusers": diffusers.__version__,
        "transformers": transformers.__version__,
        "cudaAvailable": cuda,
        "cudaVersion": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(0) if cuda else None,
        "vramBytes": int(torch.cuda.get_device_properties(0).total_memory) if cuda else None,
        "cpuCount": os.cpu_count(),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _component_state() -> dict[str, Any]:
    hub_root = HF_HOME / "hub" / "models--MiniMaxAI--MiniMax-H3" / "snapshots"
    snapshot_dirs = sorted(hub_root.glob("*")) if hub_root.exists() else []
    snapshot = snapshot_dirs[-1] if snapshot_dirs else None
    downloaded = [name for name in EXPECTED_COMPONENTS if snapshot and (snapshot / name).exists()]
    return {
        "downloaded": downloaded,
        "skipped": ["transformer_ref"],
        "total": len(EXPECTED_COMPONENTS),
        "downloadedCount": len(downloaded),
        "cacheRoot": str(HF_HOME),
        "snapshot": str(snapshot) if snapshot else None,
    }


def _write_manifest(runtime: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    manifest = {
        "schemaVersion": "h3-t2va-manifest.v1",
        "modelId": MODEL_ID,
        "workflow": "t2va",
        "audio": "joint_denoise_native_audio",
        "transformerPartition": "transformer",
        "transformerRef": "SKIPPED",
        "components": components,
        "runtime": runtime,
        "preparedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "readiness": "MODEL_CACHE_READY",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    volume.commit()
    return manifest


def _validate_output(path: Path) -> dict[str, Any]:
    """Validate the generated file with the container's authoritative ffprobe."""

    if not path.is_file() or path.stat().st_size <= 0:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: output file is missing or empty")
    if not shutil.which("ffprobe"):
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: FFPROBE_UNAVAILABLE")
    command = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=format_name,duration:stream=codec_type,width,height,r_frame_rate,sample_rate",
        "-of", "json", str(path),
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True, timeout=60)
    if completed.returncode != 0:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: ffprobe could not decode output")
    try:
        probe = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: ffprobe returned invalid JSON") from error
    names = str(probe.get("format", {}).get("format_name", "")).lower().split(",")
    duration = float(probe.get("format", {}).get("duration", 0))
    streams = probe.get("streams", [])
    video = next((item for item in streams if item.get("codec_type") == "video"), None)
    audio = next((item for item in streams if item.get("codec_type") == "audio"), None)
    if "mp4" not in [name.strip() for name in names]:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: container is not MP4")
    if not (5 <= duration <= 15):
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: duration outside 5-15 second contract")
    if not video or int(video.get("width", 0)) % 32 or int(video.get("height", 0)) % 32:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: video dimensions are not supported")
    fps_num, _, fps_den = str(video.get("r_frame_rate", "0/1")).partition("/")
    fps = float(fps_num) / float(fps_den or 1)
    if abs(fps - 24) > 0.01:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: frame rate is not 24 fps")
    if not audio or int(audio.get("sample_rate", 0)) <= 0:
        raise RuntimeError("FAILED_OUTPUT_VALIDATION: native audio stream is missing")
    return {
        "state": "OUTPUT_VALIDATED",
        "container": "mp4",
        "durationSeconds": duration,
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": fps,
        "audioSampleRate": int(audio["sample_rate"]),
        "fileSizeBytes": path.stat().st_size,
    }


def _guard_real_smoke() -> None:
    if os.getenv("ALLOW_REAL_GPU_INFERENCE", "false").lower() != "true":
        raise RuntimeError("BLOCKED_BY_REAL_GPU_GUARD: set ALLOW_REAL_GPU_INFERENCE=true for one explicit smoke test")
    if os.getenv("ALLOW_PAID_GPU_INFERENCE", "false").lower() != "true" and os.getenv("H3_FREE_CREDIT_CONFIRMED", "false").lower() != "true":
        raise RuntimeError("BLOCKED_BY_FREE_CREDIT_GUARD: free credit was not independently confirmed")
    max_cost = float(os.getenv("MAX_REAL_SMOKE_TEST_COST_USD", "0"))
    estimated = os.getenv("H3_ESTIMATED_SMOKE_COST_USD", "").strip()
    if not estimated:
        raise RuntimeError("BLOCKED_BY_COST_ESTIMATE: provider cost is unknown")
    if float(estimated) > max_cost:
        raise RuntimeError("BLOCKED_BY_COST_GUARD: estimated smoke cost exceeds configured maximum")


@app.function(cpu=8, memory=64_000, timeout=3_600)
def prepare_model() -> dict[str, Any]:
    """Download/cache only the T2VA components; never allocates a GPU."""

    if os.getenv("H3_HF_LICENSE_ACCEPTED", "false").lower() != "true":
        raise RuntimeError("LICENSE_ACCEPTANCE_REQUIRED: accept MiniMax-H3 community license first")
    _configure_hf_cache()
    runtime = _runtime_snapshot()
    if runtime["cudaAvailable"]:
        raise RuntimeError("PREPARE_MUST_BE_CPU_ONLY: CUDA was unexpectedly visible")

    import torch
    from diffusers import ModularPipeline

    pipeline = ModularPipeline.from_pretrained(MODEL_ID, workflow="t2va")
    pipeline.load_components(workflow="t2va", dtype=torch.bfloat16)
    components = _component_state()
    return _write_manifest(runtime, components)


@app.function(gpu="A100-80GB", cpu=8, memory=96_000, timeout=3_600, scaledown_window=60)
def smoke(prompt: str = "A quiet mountain lake at sunrise, natural ambience") -> dict[str, Any]:
    """Run exactly one guarded T2VA request and return measured metadata.

    This function is not called by the repository checks.  It never retries or
    falls back and should only be invoked once after ``h3-check`` is green.
    """

    _guard_real_smoke()
    _configure_hf_cache()
    started = time.perf_counter()
    submitted_at = _now_iso()
    runtime = _runtime_snapshot()
    if not runtime["cudaAvailable"]:
        raise RuntimeError("CUDA_UNAVAILABLE")
    if not MANIFEST_PATH.exists():
        raise RuntimeError("MODEL_CACHE_NOT_PREPARED")

    import torch
    from diffusers import ComponentsManager, ModularPipeline
    from diffusers.utils.export_utils import encode_video

    load_started = time.perf_counter()
    manager = ComponentsManager()
    manager.enable_auto_cpu_offload(device="cuda", memory_reserve_margin="12GB")
    pipeline = ModularPipeline.from_pretrained(MODEL_ID, workflow="t2va", components_manager=manager)
    pipeline.load_components(workflow="t2va", dtype=torch.bfloat16)
    model_loaded = time.perf_counter()
    processing_at = _now_iso()

    result = pipeline(
        prompt=prompt,
        width=SMOKE_WIDTH,
        height=SMOKE_HEIGHT,
        num_frames=SMOKE_NUM_FRAMES,
        generator=torch.Generator(device="cuda").manual_seed(7),
        output=["videos", "audio", "sampling_rate"],
    )
    generated = time.perf_counter()
    output_path = MODEL_ROOT / f"h3-smoke-{uuid.uuid4()}.mp4"
    encode_video(
        result["videos"][0],
        fps=SMOKE_FPS,
        output_path=str(output_path),
        audio=result["audio"][0],
        audio_sample_rate=result["sampling_rate"],
    )
    output_validation = _validate_output(output_path)
    completed = time.perf_counter()
    completed_at = _now_iso()
    return {
        "schemaVersion": "h3-smoke.v1",
        "generationId": str(uuid.uuid4()),
        "providerTaskId": None,
        "submittedAt": submitted_at,
        "processingAt": processing_at,
        "completedAt": completed_at,
        "output": str(output_path),
        "durationSeconds": output_validation["durationSeconds"],
        "width": output_validation["width"],
        "height": output_validation["height"],
        "fps": output_validation["fps"],
        "audio": True,
        "outputValidation": output_validation,
        "runtime": runtime,
        "timingsSeconds": {
            "coldStartAndRuntime": None,
            "modelLoad": round(model_loaded - load_started, 3),
            "inference": round(generated - model_loaded, 3),
            "encode": round(completed - generated, 3),
            "total": round(completed - started, 3),
        },
        "cost": {"state": "NOT_MEASURED", "usd": None},
    }
