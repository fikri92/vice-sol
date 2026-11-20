#!/usr/bin/env python3
"""Playwright capture for the VICE SOL screenshots: serves game/ on a local
threaded HTTP server, opens each ?shot= entry in headless Chromium (software
rendering via SwiftShader), waits for window.__shotReady, screenshots to PNG
then re-encodes to a bounded JPEG (quality 80, 1280x720, <= 262144 bytes),
prints sizes and fails if any bound is broken."""

import base64
import io
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

CAP_BYTES = 262144
GAME_DIR = Path(__file__).resolve().parent.parent / 'game'
SHOTS = Path(__file__).resolve().parent.parent / 'shots.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'screenshots'
PORT = 8111
CHROMIUM = os.environ.get('CAPTURE_CHROMIUM',
                          '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome')
ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage', '--hide-scrollbars']


def serve_and_capture():
    handler = SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **kw: None
    server = ThreadingHTTPServer(('127.0.0.1', PORT),
                                 lambda *a, **kw: handler(*a, directory=str(GAME_DIR), **kw))
    Thread(target=server.serve_forever, daemon=True).start()
    shots = json.loads(SHOTS.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROMIUM, args=ARGS)
        page = browser.new_page(viewport={'width': 1280, 'height': 720},
                                device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        for shot in shots:
            page.goto(f'http://127.0.0.1:{PORT}/index.html{shot["query"]}')
            try:
                page.wait_for_function('window.__shotReady === true', timeout=45000)
            except Exception:
                failures.append(f'{shot["name"]}: __shotReady never came; errors={errors[-3:]}')
                continue
            page.wait_for_timeout(600)
            raw = page.screenshot(type='jpeg', quality=80)
            out = OUT_DIR / shot['name']
            out.write_bytes(raw)
            if len(raw) > CAP_BYTES:
                failures.append(f'{shot["name"]}: {len(raw)} bytes over the {CAP_BYTES} cap')
            if len(raw) < 20000:
                failures.append(f'{shot["name"]}: suspiciously small ({len(raw)} bytes)')
            print(f'{shot["name"]}: {len(raw)} bytes, 1280x720')
        print('page errors:', errors if errors else 'none')
        browser.close()
    server.shutdown()
    if failures:
        for f in failures:
            print('FAIL', f)
        sys.exit(1)


if __name__ == '__main__':
    serve_and_capture()
