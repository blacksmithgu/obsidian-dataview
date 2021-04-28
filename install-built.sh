#!/usr/bin/env bash
VAULT="$1"
TARGET="$VAULT/.obsidian/plugins/dataview/"
mkdir -p "$TARGET"
cp -f build/main.js styles.css manifest.json "$TARGET"
echo Installed plugin files to "$TARGET"