#!/usr/bin/env python3
import os
import json
import re
from pathlib import Path
from html.parser import HTMLParser

def generate_index():
    repo_root = Path(__file__).parent.parent
    index_data = []

    for json_file in repo_root.glob("*.json"):
        if "channels" in json_file.name:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    channels = json.load(f)
                    for ch in channels:
                        index_data.append({
                            "title": ch.get("name") or ch.get("title"),
                            "code": ch.get("code") or ch.get("id"),
                            "type": "tv",
                            "category": "Live Television",
                            "url": ch.get("url")
                        })
            except Exception as e:
                print(f"Error: {e}")

    html_files = [
        "movies.html", "marvel.html", "pixar-animation.html", 
        "hindi-movies.html", "english-series.html", "animation-sequels.html",
        "007.html", "f-f.html", "marathi-movies.html", "tv.html"
    ]
    
    for filename in html_files:
        file_path = repo_root / filename
        if file_path.exists():
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            matches = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', content, re.DOTALL)
            for href, inner in matches:
                title_clean = re.sub(r'<[^>]+>', '', inner).strip()
                if len(title_clean) > 2 and not title_clean.startswith("http"):
                    ctype = "movie"
                    if "series" in filename: ctype = "series"
                    elif "tv" in filename or "sports" in filename: ctype = "tv"
                    elif "animation" in filename: ctype = "animation"

                    index_data.append({
                        "title": title_clean,
                        "url": href,
                        "type": ctype,
                        "sourcePage": filename
                    })

    output_path = repo_root / "search-index.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    print(f"Generated {len(index_data)} entries.")

if __name__ == "__main__":
    generate_index()
