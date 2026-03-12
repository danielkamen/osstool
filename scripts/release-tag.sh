#!/bin/bash
# Push all changes and move the v1 tag to HEAD
set -e

echo "Pushing changes to origin main..."
git push origin main

echo "Moving v1 tag to HEAD..."
git tag -f v1
git push origin v1 --force

echo "Done — v1 now points to $(git rev-parse --short HEAD)"
