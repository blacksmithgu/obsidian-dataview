#!/usr/bin/env bash
# Automatically update versions in files and create an autorelease.
# Requires the github CLI.
NEW_VERSION=$1

# Delete old files if they exist
rm package.tmp.json
rm manifest.tmp.json
rm versions.tmp.json

# Rewrite versions in relevant files.
jq ".version=\"${NEW_VERSION}\"" package.json > package.tmp.json && mv package.tmp.json package.json
jq ".version=\"${NEW_VERSION}\"" manifest.json > manifest.tmp.json && mv manifest.tmp.json manifest.json
jq ". + {\"${NEW_VERSION}\": \"0.12.0\"}" versions.json > versions.tmp.json && mv versions.tmp.json versions.json

# Create commit & commit.
git commit -a -m "${NEW_VERSION}"
git push

# Rebuild the project to prepare for a release.
npm run build

# release api
npm publish --access public

# And do a github release.
gh release create "${NEW_VERSION}" build/main.js styles.css manifest.json
