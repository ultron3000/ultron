#!/usr/bin/env python3
import os
import json
import re
from pathlib import Path

def generate_index():
    repo_root = Path(__file__).parent.parent
    index_data = []

    # 1. Parse all JSON files (channels, streams, catalogues)
    for json_file in repo_root.glob("*.json"):
        if json_file.name == "search-index.json":
            continue
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                content = json.load(f)
                
                # Handle list of channels/movies
                items = content if isinstance(content, list) else [content]
                for entry in items:
                    if isinstance(entry, dict):
                        title = entry.get("name") or entry.get("title") or entry.get("channel")
                        if title:
                            index_data.append({
                                "title": title.strip(),
                                "code": entry.get("code") or entry.get("id", ""),
                                "url": entry.get("url") or entry.get("link", "#"),
                                "type": entry.get("type", "tv" if "channel" in json_file.name or "tv" in json_file.name else "movie"),
                                "category": entry.get("category", json_file.stem.replace("-", " ").title()),
                                "sourcePage": json_file.name
                            })
        except Exception as e:
            print(f"Error parsing JSON {json_file.name}: {e}")

    # 2. Parse all HTML files in the repository root
    html_files = [f for f in repo_root.glob("*.html") if f.name != "index.html"]
    
    for html_file in html_files:
        try:
            html_content = html_file.read_text(encoding='utf-8', errors='ignore')
            filename = html_file.name
            
            # Determine default content type based on filename
            default_type = "movie"
            if "series" in filename.lower():
                default_type = "series"
            elif "tv" in filename.lower() or "sports" in filename.lower() or "live" in filename.lower():
                default_type = "tv"
            elif "animation" in filename.lower() or "pixar" in filename.lower() or "dreamworks" in filename.lower():
                default_type = "animation"

            # Pattern A: Extract anchor tags with text and optional data attributes
            # <a href="..." data-code="...">Movie Title</a>
            link_pattern = re.findall(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html_content, re.DOTALL | re.IGNORECASE)
            
            for href, inner_html in link_pattern:
                # Clean HTML tags inside link text
                title = re.sub(r'<[^>]+>', '', inner_html).strip()
                
                # Filter out generic UI elements, navigation headers, or external links
                skip_keywords = ["home", "menu", "back", "next", "cloudtv", "search", "http", "www", "github", "sign", "login"]
                if not title or len(title) <= 2 or any(title.lower() == sk for sk in skip_keywords):
                    continue
                if href.startswith('#') or href.startswith('javascript:'):
                    continue

                # Extract code if present in surrounding context or data attributes
                code_match = re.search(r'data-code=["\']([^"\']+)["\']', href + inner_html, re.IGNORECASE)
                content_code = code_match.group(1) if code_match else ""

                index_data.append({
                    "title": title,
                    "code": content_code,
                    "url": href,
                    "type": default_type,
                    "category": filename.replace(".html", "").replace("-", " ").title(),
                    "sourcePage": filename
                })

            # Pattern B: Extract JSON objects embedded inside JavaScript script tags (common in static movie streaming sites)
            script_blocks = re.findall(r'<script[^>]*>(.*?)</script>', html_content, re.DOTALL | re.IGNORECASE)
            for script in script_blocks:
                # Look for arrays/objects containing titles and codes
                json_matches = re.findall(r'(?:const|let|var)\s+\w+\s*=\s*(\[.*?\]);?', script, re.DOTALL)
                for jstr in json_matches:
                    try:
                        parsed_array = json.loads(jstr)
                        if isinstance(parsed_array, list):
                            for entry in parsed_array:
                                if isinstance(entry, dict) and (entry.get("title") or entry.get("name")):
                                    t = entry.get("title") or entry.get("name")
                                    index_data.append({
                                        "title": t.strip(),
                                        "code": entry.get("code") or entry.get("id", ""),
                                        "url": entry.get("url") or entry.get("link") or f"./{filename}",
                                        "type": entry.get("type", default_type),
                                        "category": entry.get("category", filename.replace(".html", "").replace("-", " ").title()),
                                        "sourcePage": filename
                                    })
                    except:
                        pass

        except Exception as e:
            print(f"Error parsing HTML {html_file.name}: {e}")

    # Deduplicate entries based on title and URL/code
    seen = set()
    unique_items = []
    for item in index_data:
        identifier = (item["title"].lower(), item.get("code", ""), item["url"])
        if identifier not in seen:
            seen.add(identifier)
            unique_items.append(item)

    output_path = repo_root / "search-index.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique_items, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated search-index.json with {len(unique_items)} unique content entries.")

if __name__ == "__main__":
    generate_index()
