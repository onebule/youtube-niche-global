#!/usr/bin/env python3
"""A deliberately small, server-side Gradio bridge for the HF H3 Space.

The bridge discovers the live Space contract before every operation. It never
logs the token and has no retry, fallback, batch, or automatic generation path.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from typing import Any


def clean(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "[TRUNCATED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return re.sub(r"Bearer\s+\S+|hf_[A-Za-z0-9_-]+", "[REDACTED_TOKEN]", value)[:4000]
    if isinstance(value, (list, tuple)):
        return [clean(item, depth + 1) for item in value[:50]]
    if isinstance(value, dict):
        return {str(key): clean(item, depth + 1) for key, item in list(value.items())[:100]}
    for attr in ("path", "url", "name", "orig_name"):
        candidate = getattr(value, attr, None)
        if candidate:
            return clean(str(candidate), depth + 1)
    return clean(str(value), depth + 1)


def classify(message: str) -> str:
    text = message.lower()
    if "quota" in text or "daily limit" in text or "zero gpu" in text and "limit" in text:
        return "HF_ZERO_GPU_QUOTA_EXHAUSTED"
    if "queue" in text or "too many" in text or "busy" in text:
        return "HF_ZERO_GPU_QUEUE_BUSY"
    if "401" in text or "403" in text or "unauthor" in text or "token" in text or "auth" in text:
        return "HF_AUTH_INVALID"
    if "sleep" in text:
        return "HF_SPACE_SLEEPING"
    if "build" in text or "startup" in text:
        return "HF_SPACE_BUILDING"
    if "timeout" in text:
        return "HF_SPACE_CONNECT_TIMEOUT"
    if "api" in text or "endpoint" in text or "parameter" in text:
        return "HF_API_CHANGED"
    return "HF_SPACE_ERROR"


def space_metadata(space: str, token: str) -> dict[str, Any]:
    # Optional metadata is read-only and does not gate discovery if Hub API is
    # unavailable. The Gradio client remains the authority for the live schema.
    import urllib.request

    url = "https://huggingface.co/api/spaces/" + space
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            return clean(json.loads(response.read().decode("utf-8")))
    except Exception as error:
        return {"metadataError": classify(str(error)), "metadataMessage": clean(str(error))}


def client_for(space: str, token: str):
    try:
        from gradio_client import Client
    except Exception as error:
        raise RuntimeError("GRADIO_CLIENT_UNAVAILABLE: " + str(error)) from error
    return Client(space, token=token)


def view_api(client):
    try:
        return client.view_api(return_format="dict")
    except TypeError:
        # Older clients expose view_api without return_format. A textual result
        # is intentionally treated as incompatible rather than guessed.
        return {"viewApiText": clean(client.view_api())}


def check(payload: dict[str, Any]) -> dict[str, Any]:
    space = str(payload.get("space") or "MiniMaxAI/MiniMax-H3-Turbo-Lora")
    token = str(payload.get("token") or "")
    if not token:
        return {"ok": False, "auth": "AUTH_REQUIRED", "reachability": "UNKNOWN", "runtime": None, "hardware": None, "quota": "UNKNOWN", "apiInfo": None, "code": "HF_AUTH_REQUIRED"}
    try:
        metadata = space_metadata(space, token)
        client = client_for(space, token)
        api_info = clean(view_api(client))
        runtime = metadata.get("runtime") if isinstance(metadata, dict) else None
        hardware = runtime.get("hardware") if isinstance(runtime, dict) else None
        stage = str(runtime.get("stage") if isinstance(runtime, dict) else "").upper()
        reachability = "BUILDING" if "BUILD" in stage else "SLEEPING" if "STOP" in stage or "SLEEP" in stage else "REACHABLE"
        return {"ok": True, "auth": "AUTH_VERIFIED", "reachability": reachability, "runtime": clean(runtime), "hardware": clean(hardware), "quota": "UNKNOWN", "apiInfo": api_info, "providerReport": {"spaceId": space, "metadata": metadata, "discovery": "Client.view_api"}}
    except Exception as error:
        message = clean(str(error))
        code = classify(str(error))
        return {"ok": False, "auth": "AUTH_INVALID" if "AUTH" in code else "UNKNOWN", "reachability": "UNREACHABLE" if "SPACE" in code else "UNKNOWN", "runtime": None, "hardware": None, "quota": "EXHAUSTED" if "QUOTA" in code else "UNKNOWN", "apiInfo": None, "code": code, "message": message}


def smoke(payload: dict[str, Any]) -> dict[str, Any]:
    space = str(payload.get("space") or "MiniMaxAI/MiniMax-H3-Turbo-Lora")
    token = str(payload.get("token") or "")
    invocation = payload.get("invocation") or {}
    if not token:
        return {"ok": False, "code": "HF_AUTH_REQUIRED", "message": "HF_TOKEN is required."}
    endpoint = str(invocation.get("endpoint") or "")
    args = invocation.get("args") or []
    if not endpoint:
        return {"ok": False, "code": "HF_API_INCOMPATIBLE", "message": "Discovered generate endpoint is missing."}
    try:
        client = client_for(space, token)
        # Exactly one submit call. Do not add retry or paid fallback here.
        job = client.submit(*args, api_name=endpoint)
        result = job.result()
        return {"ok": True, "providerTaskId": "hf-h3-" + uuid.uuid4().hex, "state": "SUCCEEDED", "result": clean(result), "providerReport": {"spaceId": space, "endpoint": endpoint, "costUsd": 0, "costType": "INCLUDED_QUOTA", "confidence": "LOW", "calibrationRequired": True}}
    except Exception as error:
        message = clean(str(error))
        return {"ok": False, "code": classify(str(error)), "message": message}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=("check", "smoke"), required=True)
    args = parser.parse_args()
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        result = check(payload) if args.action == "check" else smoke(payload)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except Exception as error:
        print(json.dumps({"ok": False, "code": "HF_BRIDGE_ERROR", "message": clean(str(error))}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
