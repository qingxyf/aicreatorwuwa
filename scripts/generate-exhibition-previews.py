"""Generate lighter display images while retaining every original unchanged."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


root = Path(__file__).resolve().parent.parent
manifest_path = root / "src/config/exhibition-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for work in manifest["works"]:
    for media in work["media"]:
        if media["kind"] != "image":
            continue
        original = root / "public" / media["path"]
        preview_path = f"exhibition/preview-{media['id']}.webp"
        target = root / "public" / preview_path
        with Image.open(original) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=88, method=6)
        data = target.read_bytes()
        media["preview"] = {
            "path": preview_path,
            "byteSize": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"previewCount": sum(len(work["media"]) for work in manifest["works"]), "previewBytes": sum(media["preview"]["byteSize"] for work in manifest["works"] for media in work["media"] if "preview" in media)}, ensure_ascii=False))
