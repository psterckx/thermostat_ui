#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

cp -r dist/. ../../../../web/personal/psterckx.github.io/thermostat

cd -